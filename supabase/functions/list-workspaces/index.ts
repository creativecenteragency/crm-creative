// Edge Function: list-workspaces
//
// Devuelve la lista de clientes (workspaces) del CRM para que el sistema de
// gestión externo pueda elegir, al configurar cada una de sus cuentas, a qué
// workspace_id conectarla (ver export-leads?workspace_id=...).
//
// GET /list-workspaces
// Header requerido: x-api-key: <MANAGEMENT_API_KEY>

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const API_KEY = Deno.env.get('MANAGEMENT_API_KEY')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-api-key, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS_HEADERS } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405)
  if (req.headers.get('x-api-key') !== API_KEY) return json({ error: 'unauthorized' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const { data, error } = await admin.from('workspaces').select('id, name, slug').order('name')
  if (error) return json({ error: error.message }, 500)

  return json({ ok: true, workspaces: data })
})
