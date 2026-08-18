// Edge Function: export-leads
//
// Endpoint de solo lectura para que un sistema externo (el sistema de gestión
// interno de la agencia) sincronice leads como métrica de efectividad de
// campañas. No usa sesión de usuario de Supabase — se autentica con una clave
// compartida (header x-api-key) porque quien llama no es un usuario logueado
// del CRM sino otro sistema.
//
// GET /export-leads
// GET /export-leads?since=2026-08-01T00:00:00Z        (solo leads creados desde esa fecha)
// GET /export-leads?workspace_id=<uuid>                (solo los leads de ese cliente)
// Header requerido: x-api-key: <MANAGEMENT_API_KEY>
//
// Cada cuenta del sistema de gestión se conecta a UN cliente del CRM: usá
// list-workspaces para obtener el listado de {id, name, slug} y elegir cuál
// workspace_id corresponde a cada cuenta.

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

  const url = new URL(req.url)
  const since = url.searchParams.get('since')
  const workspaceId = url.searchParams.get('workspace_id')

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  let query = admin
    .from('leads')
    .select(
      'id, workspace_id, created_at, updated_at, first_name, last_name, email, phone, inquiry_type, source_channel, source_campaign_id, landing_page, status, rating, is_spam, workspaces(name)'
    )
    .order('created_at', { ascending: true })

  if (since) query = query.gte('created_at', since)
  if (workspaceId) query = query.eq('workspace_id', workspaceId)

  const { data, error } = await query
  if (error) return json({ error: error.message }, 500)

  const leads = (data ?? []).map((row: any) => ({
    id: row.id,
    workspace_id: row.workspace_id,
    workspace_name: row.workspaces?.name ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    inquiry_type: row.inquiry_type,
    source_channel: row.source_channel,
    source_campaign_id: row.source_campaign_id,
    landing_page: row.landing_page,
    status: row.status,
    rating: row.rating,
    is_spam: row.is_spam,
  }))

  return json({ ok: true, count: leads.length, leads })
})
