// Edge Function: ingest-lead
//
// Recibe el webhook de Forminator (WordPress) cuando se envía un formulario,
// identifica el workspace por el token en la URL, mapea los campos del form
// usando workspaces.field_mapping, parsea la fuente (Google Ads / orgánico / directo)
// y guarda el lead en la tabla `leads`.
//
// URL a configurar en Forminator: https://<project-ref>.supabase.co/functions/v1/ingest-lead?token=<webhook_token>

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORE_KEYS = ['first_name', 'last_name', 'email', 'phone', 'message', 'inquiry_type'] as const

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// Forminator puede mandar el payload como objeto plano {slug: valor, ...}
// o como { fields: [{ name, value }, ...], ... }. Devolvemos siempre un objeto plano.
function flattenPayload(body: any): Record<string, string> {
  const flat: Record<string, string> = {}

  if (Array.isArray(body?.fields)) {
    for (const f of body.fields) {
      if (f?.name != null) flat[String(f.name)] = f.value ?? ''
    }
  }

  if (body && typeof body === 'object') {
    for (const [key, value] of Object.entries(body)) {
      if (key === 'fields') continue
      if (value != null && (typeof value === 'string' || typeof value === 'number')) {
        flat[key] = String(value)
      }
    }
  }

  return flat
}

function parseSource(rawUrl: string | undefined) {
  if (!rawUrl) return { source_channel: 'direct', source_campaign_id: null, landing_page: null }

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { source_channel: 'direct', source_campaign_id: null, landing_page: null }
  }

  const params = url.searchParams
  const gclid = params.get('gclid')
  const gbraid = params.get('gbraid')
  const gadSource = params.get('gad_source')
  const campaignId = params.get('gad_campaignid') || params.get('campaignid')

  let source_channel = 'direct'
  if (gclid || gbraid || gadSource) {
    source_channel = 'google_ads'
  } else if (url.search) {
    source_channel = 'other_campaign'
  }

  return {
    source_channel,
    source_campaign_id: campaignId ?? null,
    landing_page: url.pathname,
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  const token = new URL(req.url).searchParams.get('token')
  if (!token) {
    return json({ error: 'missing_token' }, 400)
  }

  let payload: any
  const contentType = req.headers.get('content-type') || ''
  try {
    if (contentType.includes('application/json')) {
      payload = await req.json()
    } else {
      const form = await req.formData()
      payload = Object.fromEntries(form.entries())
    }
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('id, field_mapping')
    .eq('webhook_token', token)
    .maybeSingle()

  if (wsError || !workspace) {
    return json({ error: 'invalid_token' }, 404)
  }

  const flat = flattenPayload(payload)
  const mapping = (workspace.field_mapping ?? {}) as Record<string, string>

  const core: Record<string, string | null> = {}
  for (const key of CORE_KEYS) {
    const slug = mapping[key]
    core[key] = slug && flat[slug] !== undefined ? flat[slug] : null
  }

  // Cuando un cliente tiene un formulario de Forminator distinto por cada tipo de
  // consulta (en vez de un único select), el webhook URL puede fijar el valor
  // directo con ?inquiry_type=Cursos, sin depender de un campo mapeado.
  const inquiryOverride = new URL(req.url).searchParams.get('inquiry_type')
  if (inquiryOverride) core.inquiry_type = inquiryOverride

  // Cualquier campo mapeado que no sea "core" (ej: company) va a `extra`.
  const extra: Record<string, string> = {}
  for (const [internalKey, slug] of Object.entries(mapping)) {
    if ((CORE_KEYS as readonly string[]).includes(internalKey)) continue
    if (flat[slug] !== undefined) extra[internalKey] = flat[slug]
  }

  const sourceSlug = mapping['source_url']
  const sourceUrl =
    (sourceSlug && flat[sourceSlug]) ||
    flat['url-referencia'] ||
    flat['url_referencia'] ||
    flat['source_url'] ||
    flat['page_url'] ||
    null
  const source = parseSource(sourceUrl ?? undefined)

  const { error: insertError } = await supabase.from('leads').insert({
    workspace_id: workspace.id,
    first_name: core.first_name,
    last_name: core.last_name,
    email: core.email,
    phone: core.phone,
    message: core.message,
    inquiry_type: core.inquiry_type,
    extra,
    source_url: sourceUrl,
    source_channel: source.source_channel,
    source_campaign_id: source.source_campaign_id,
    landing_page: source.landing_page,
  })

  if (insertError) {
    console.error(insertError)
    return json({ error: 'insert_failed' }, 500)
  }

  return json({ ok: true })
})
