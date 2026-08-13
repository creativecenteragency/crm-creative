// Edge Function: send-lead-email
//
// Envía uno o varios emails (típicamente a leads) usando una plantilla ya
// renderizada del lado del cliente. Valida que quien llama sea master o
// miembro del workspace antes de mandar nada. El contenido (subject/html)
// ya viene armado desde el frontend — esta función solo lo despacha por
// Resend, para no exponer la API key en el navegador.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'no-reply@creativecenter.ar'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS_HEADERS } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return json({ error: 'missing_auth' }, 401)

  const { workspace_id, emails } = await req.json().catch(() => ({}))
  if (!workspace_id || !Array.isArray(emails) || emails.length === 0) {
    return json({ error: 'missing_fields' }, 400)
  }

  const anonClient = createClient(SUPABASE_URL, ANON_KEY)
  const { data: userData, error: userError } = await anonClient.auth.getUser(token)
  if (userError || !userData?.user) return json({ error: 'invalid_session' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: profile } = await admin.from('profiles').select('is_master').eq('id', userData.user.id).maybeSingle()

  if (!profile?.is_master) {
    const { data: membership } = await admin
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', userData.user.id)
      .maybeSingle()
    if (!membership) return json({ error: 'forbidden' }, 403)
  }

  let sent = 0
  const errors: string[] = []

  for (const item of emails) {
    if (!item?.to || !item?.subject || !item?.html) {
      errors.push('missing_to_subject_or_html')
      continue
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: item.to, subject: item.subject, html: item.html }),
    })
    if (res.ok) sent++
    else errors.push(await res.text())
  }

  return json({ ok: true, sent, failed: emails.length - sent, errors })
})
