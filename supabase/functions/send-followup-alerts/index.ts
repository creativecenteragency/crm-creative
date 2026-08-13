// Edge Function: send-followup-alerts
//
// Digest diario de seguimientos vencidos o para hoy, por workspace. Pensada
// para ser invocada por un cron (pg_cron + pg_net), no por un usuario final:
// no valida sesión, valida un secreto compartido en el header x-cron-secret.
// Verify JWT debe estar OFF para esta función (igual que ingest-lead).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'no-reply@creativecenter.ar'
const CRON_SECRET = Deno.env.get('CRON_SECRET')!
const APP_URL = Deno.env.get('APP_URL') ?? 'https://creativecenteragency.github.io/crm-creative'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) return json({ error: 'forbidden' }, 403)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const today = new Date().toISOString().slice(0, 10)

  const { data: workspaces } = await admin.from('workspaces').select('id, name')
  if (!workspaces) return json({ ok: true, sent: 0 })

  const { data: masters } = await admin.from('profiles').select('email').eq('is_master', true)
  const masterEmails = (masters ?? []).map((m) => m.email).filter((e): e is string => !!e)

  let workspacesSent = 0

  for (const ws of workspaces) {
    const { data: leads } = await admin
      .from('leads')
      .select('id, first_name, last_name, email, phone, inquiry_type, status, next_contact_at')
      .eq('workspace_id', ws.id)
      .eq('is_spam', false)
      .not('next_contact_at', 'is', null)
      .lte('next_contact_at', `${today}T23:59:59`)
      .not('status', 'in', '(ganado,perdido)')

    if (!leads || leads.length === 0) continue

    const { data: members } = await admin
      .from('workspace_members')
      .select('profiles(email)')
      .eq('workspace_id', ws.id)

    const memberEmails = (members ?? [])
      .map((m: any) => m.profiles?.email)
      .filter((e: string | null): e is string => !!e)

    const recipients = [...new Set([...memberEmails, ...masterEmails])]
    if (recipients.length === 0) continue

    const rows = leads
      .sort((a, b) => (a.next_contact_at! < b.next_contact_at! ? -1 : 1))
      .map((l) => {
        const dueDate = l.next_contact_at!.slice(0, 10)
        const tag = dueDate < today ? 'Atrasado' : 'Hoy'
        const name = escapeHtml(`${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || '(sin nombre)')
        return `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;color:${dueDate < today ? '#b91c1c' : '#b45309'}">${tag}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${name}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${escapeHtml(l.email ?? l.phone ?? '')}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${escapeHtml(l.inquiry_type ?? '')}</td>
        </tr>`
      })
      .join('')

    const html = `
      <div style="font-family:system-ui,sans-serif;color:#151515">
        <h2 style="margin:0 0 4px">Seguimientos de ${escapeHtml(ws.name)}</h2>
        <p style="color:#7d7b78;margin:0 0 16px">${leads.length} lead(s) atrasados o para hoy.</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px">
          <thead><tr style="text-align:left;color:#7d7b78;text-transform:uppercase;font-size:12px">
            <th style="padding:6px 10px">Estado</th><th style="padding:6px 10px">Nombre</th>
            <th style="padding:6px 10px">Contacto</th><th style="padding:6px 10px">Consulta</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:16px"><a href="${APP_URL}/w/${ws.id}/followups">Ver seguimientos en el CRM →</a></p>
      </div>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: recipients,
        subject: `${leads.length} seguimiento(s) pendientes — ${ws.name}`,
        html,
      }),
    })
    if (res.ok) workspacesSent++
  }

  return json({ ok: true, workspaces_notified: workspacesSent })
})
