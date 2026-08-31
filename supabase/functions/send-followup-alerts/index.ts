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
        const late = dueDate < today
        const tag = late ? 'Atrasado' : 'Hoy'
        const name = escapeHtml(`${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || '(sin nombre)')
        return `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #eeece8;">
            <span style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;background:${late ? '#fdecea' : '#fff4e5'};color:${late ? '#b91c1c' : '#b45309'};">${tag}</span>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #eeece8;color:#151515;font-weight:500;">${name}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eeece8;color:#7d7b78;">${escapeHtml(l.email ?? l.phone ?? '')}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eeece8;color:#7d7b78;">${escapeHtml(l.inquiry_type ?? '')}</td>
        </tr>`
      })
      .join('')

    const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
    const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0; padding:0; background:#f4f1ec;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #eeece8;">
    <tr><td style="background:#f98105; padding:24px 32px; text-align:center;">
      <span style="color:#ffffff; font-size:18px; font-weight:700; font-family:${font};">Seguimientos pendientes</span>
    </td></tr>
    <tr><td style="padding:28px 32px 8px; font-family:${font};">
      <h2 style="margin:0 0 4px; font-size:17px; color:#151515;">${escapeHtml(ws.name)}</h2>
      <p style="margin:0 0 16px; color:#7d7b78; font-size:14px;">${leads.length} lead(s) atrasados o para hoy.</p>
    </td></tr>
    <tr><td style="padding:0 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:13px; font-family:${font};">
        <thead><tr style="text-align:left; color:#7d7b78; text-transform:uppercase; font-size:11px;">
          <th style="padding:6px 12px;">Estado</th><th style="padding:6px 12px;">Nombre</th>
          <th style="padding:6px 12px;">Contacto</th><th style="padding:6px 12px;">Consulta</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </td></tr>
    <tr><td style="padding:24px 32px 28px; text-align:center; font-family:${font};">
      <a href="${APP_URL}/w/${ws.id}/followups" style="display:inline-block; background:#151515; color:#ffffff; text-decoration:none; font-size:14px; font-weight:600; padding:11px 22px; border-radius:8px;">Ver seguimientos en el CRM</a>
    </td></tr>
    <tr><td style="padding:16px 32px; background:#f4f1ec; border-top:1px solid #eeece8; text-align:center; font-family:${font};">
      <p style="margin:0; font-size:12px; color:#7d7b78;">Aviso automático del CRM de <span style="color:#151515; font-weight:600;">Creative Center</span></p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`

    const text = `Seguimientos de ${ws.name}\n${leads.length} lead(s) atrasados o para hoy.\n\n` +
      leads
        .map((l) => {
          const dueDate = l.next_contact_at!.slice(0, 10)
          const tag = dueDate < today ? 'Atrasado' : 'Hoy'
          const name = `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || '(sin nombre)'
          return `- [${tag}] ${name} — ${l.email ?? l.phone ?? ''} — ${l.inquiry_type ?? ''}`
        })
        .join('\n') +
      `\n\nVer seguimientos: ${APP_URL}/w/${ws.id}/followups`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: recipients,
        subject: `${leads.length} seguimiento(s) pendientes — ${ws.name}`,
        html,
        text,
      }),
    })
    if (res.ok) workspacesSent++
  }

  return json({ ok: true, workspaces_notified: workspacesSent })
})
