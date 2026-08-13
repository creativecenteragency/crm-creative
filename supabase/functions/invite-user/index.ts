// Edge Function: invite-user
//
// Permite que un usuario MASTER invite (o asigne, si ya existe) un usuario
// cliente a un workspace directamente desde el CRM, sin pasar por el
// dashboard de Supabase. Requiere el JWT del usuario que llama (se valida
// que sea master antes de hacer nada).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return json({ error: 'missing_auth' }, 401)

  const { email, workspace_id } = await req.json().catch(() => ({}))
  if (!email || !workspace_id) return json({ error: 'missing_fields' }, 400)

  const anonClient = createClient(SUPABASE_URL, ANON_KEY)
  const { data: userData, error: userError } = await anonClient.auth.getUser(token)
  if (userError || !userData?.user) return json({ error: 'invalid_session' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('is_master')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (!callerProfile?.is_master) return json({ error: 'forbidden' }, 403)

  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .ilike('email', email.trim())
    .maybeSingle()

  let userId = existingProfile?.id

  if (!userId) {
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email.trim())
    if (inviteError || !invited?.user) {
      return json({ error: 'invite_failed', detail: inviteError?.message }, 500)
    }
    userId = invited.user.id
  }

  const { error: memberError } = await admin
    .from('workspace_members')
    .upsert({ workspace_id, user_id: userId }, { onConflict: 'workspace_id,user_id' })

  if (memberError) return json({ error: 'member_insert_failed', detail: memberError.message }, 500)

  return json({ ok: true, invited: !existingProfile })
})
