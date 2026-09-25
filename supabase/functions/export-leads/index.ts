// Edge Function: export-leads
//
// Endpoint de solo lectura para que un sistema externo (el sistema de gestión
// interno de la agencia, Pangea One) sincronice leads como métrica de efectividad
// de campañas. No usa sesión de usuario de Supabase — se autentica con una clave
// compartida (header x-api-key) porque quien llama no es un usuario logueado
// del CRM sino otro sistema.
//
// GET /export-leads
// GET /export-leads?since=2026-08-01T00:00:00Z         (solo leads CREADOS desde esa fecha)
// GET /export-leads?updated_since=2026-08-01T00:00:00Z (leads creados O modificados desde esa fecha)
// GET /export-leads?workspace_id=<uuid>                 (solo los leads de ese cliente)
// GET /export-leads?include_all=1                      (TAMBIÉN los que no cuentan para métricas)
//
// Campos de seguimiento por lead: utm_source, utm_medium, utm_campaign, utm_content,
// utm_term y referrer. Son null cuando el lead no los trae: en Kommo solo los tienen
// los que entraron desde la web (formulario/anuncio), no los de WhatsApp directo, y
// los leads de formulario (origin "form") no los tienen. utm_campaign puede ser el
// nombre de la campaña o el ID numérico de Meta.
// Header requerido: x-api-key: <MANAGEMENT_API_KEY>
//
// Cada cuenta del sistema de gestión se conecta a UN cliente del CRM: usá
// list-workspaces para obtener el listado de {id, name, slug} y elegir cuál
// workspace_id corresponde a cada cuenta.
//
// Por defecto se devuelven SOLO los leads que cuentan para métricas (los de
// Kommo sin ninguna etiqueta válida quedan afuera): el sistema de gestión los usa
// para medir efectividad de campañas y no debe contarlos. Con include_all=1 vienen
// todos. Cada lead trae `counts_for_metrics`, `tags` y `origin`. `updated_since`
// sirve para el sync incremental:
// `since` mira la fecha de creación, y un lead de Kommo puede llegar tarde al
// CRM con una fecha de creación vieja (queda afuera de `since`, no de `updated_since`).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const API_KEY = Deno.env.get('MANAGEMENT_API_KEY')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-api-key, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

// PostgREST corta cada respuesta en 1000 filas sin avisar; se pide por páginas.
const PAGE = 1000

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS_HEADERS } })
}

// Mismo criterio que src/lib/leadValidity.ts (Deno no puede importar de src/lib):
// un lead de Kommo cuenta para métricas solo si tiene alguna de las etiquetas
// válidas de su workspace. Los que entraron por formulario siempre cuentan.
function countsForMetrics(row: any, validTags: string[] | undefined): boolean {
  if (row.external_source !== 'kommo') return true
  if (!validTags || validTags.length === 0) return true
  const valid = new Set(validTags.map((t) => t.trim().toLowerCase()))
  return (row.tags ?? []).some((t: string) => valid.has(t.trim().toLowerCase()))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405)
  if (req.headers.get('x-api-key') !== API_KEY) return json({ error: 'unauthorized' }, 401)

  const url = new URL(req.url)
  const since = url.searchParams.get('since')
  const updatedSince = url.searchParams.get('updated_since')
  const workspaceId = url.searchParams.get('workspace_id')
  const includeAll = url.searchParams.get('include_all') === '1'

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: states, error: statesError } = await admin.from('kommo_sync_state').select('workspace_id, valid_tags')
  if (statesError) return json({ error: statesError.message }, 500)
  const validTagsByWorkspace = new Map<string, string[]>((states ?? []).map((s: any) => [s.workspace_id, s.valid_tags]))

  const rows: any[] = []
  for (let from = 0; ; from += PAGE) {
    let query = admin
      .from('leads')
      .select(
        'id, workspace_id, created_at, updated_at, first_name, last_name, email, phone, inquiry_type, source_channel, source_campaign_id, landing_page, status, rating, is_spam, external_source, tags, extra, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, workspaces(name)'
      )
      .order('created_at', { ascending: true })
      .order('id')
      .range(from, from + PAGE - 1)

    if (since) query = query.gte('created_at', since)
    if (updatedSince) query = query.gte('updated_at', updatedSince)
    if (workspaceId) query = query.eq('workspace_id', workspaceId)

    const { data, error } = await query
    if (error) return json({ error: error.message }, 500)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }

  const leads = rows
    .map((row: any) => ({
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
      // 'kommo' si se sincronizó desde Kommo; 'form' si entró por formulario/CSV.
      origin: row.external_source ?? 'form',
      tags: row.tags ?? [],
      utm_source: row.utm_source ?? null,
      utm_medium: row.utm_medium ?? null,
      utm_campaign: row.utm_campaign ?? null,
      utm_content: row.utm_content ?? null,
      utm_term: row.utm_term ?? null,
      referrer: row.referrer ?? null,
      embudo: row.extra?.Embudo ?? null,
      etapa: row.extra?.Etapa ?? null,
      counts_for_metrics: countsForMetrics(row, validTagsByWorkspace.get(row.workspace_id)),
    }))
    .filter((l) => includeAll || l.counts_for_metrics)

  return json({ ok: true, count: leads.length, leads })
})
