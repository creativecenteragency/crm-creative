// Edge Function: ingest-lead
//
// Recibe el webhook de Forminator (WordPress) cuando se envía un formulario,
// identifica el workspace por el token en la URL, mapea los campos del form
// usando workspaces.field_mapping, parsea la fuente (Google Ads / orgánico / directo)
// y guarda el lead en la tabla `leads`.
//
// URL a configurar en Forminator: https://<project-ref>.supabase.co/functions/v1/ingest-lead?token=<webhook_token>

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL') ?? 'https://creativecenteragency.github.io/crm-creative'
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:mkt.creativecenter@gmail.com'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

// Avisa por Web Push a los dispositivos que se suscribieron a este workspace.
// No debe romper la respuesta del webhook si algo falla acá: cada envío va
// en su propio try/catch, y una suscripción vencida (404/410) se borra sola.
async function notifyNewLead(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  workspaceName: string,
  leadName: string
) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('workspace_id', workspaceId)

  if (!subs || subs.length === 0) return

  const payload = JSON.stringify({
    title: `Nuevo lead — ${workspaceName}`,
    body: leadName || 'Sin nombre',
    url: `${APP_URL}/w/${workspaceId}/leads`,
  })

  for (const sub of subs as any[]) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      } else {
        console.error('push_failed', err)
      }
    }
  }
}

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

// El campo "slug de Forminator" del mapeo a veces se carga copiando el
// merge-tag tal como aparece en los emails/notificaciones de Forminator
// (ej. "{email-1}"), en vez del nombre de campo real que manda el webhook
// ("email-1", sin llaves). Lo toleramos limpiando las llaves acá, así no
// hace falta corregir el mapeo a mano en cada workspace afectado.
function cleanSlug(slug: string | undefined): string | undefined {
  const trimmed = slug?.trim()
  if (!trimmed) return undefined
  return trimmed.replace(/^\{+/, '').replace(/\}+$/, '')
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
    .select('id, name, field_mapping')
    .eq('webhook_token', token)
    .maybeSingle()

  if (wsError || !workspace) {
    return json({ error: 'invalid_token' }, 404)
  }

  const flat = flattenPayload(payload)
  const mapping = (workspace.field_mapping ?? {}) as Record<string, string>

  const core: Record<string, string | null> = {}
  for (const key of CORE_KEYS) {
    const slug = cleanSlug(mapping[key])
    core[key] = slug && flat[slug] !== undefined ? flat[slug] : null
  }

  // Cuando un cliente tiene un formulario de Forminator distinto por cada tipo de
  // consulta (en vez de un único select), el webhook URL puede fijar el valor
  // directo con ?inquiry_type=Cursos, sin depender de un campo mapeado.
  const inquiryOverride = new URL(req.url).searchParams.get('inquiry_type')
  if (inquiryOverride) core.inquiry_type = inquiryOverride

  // Cualquier campo mapeado que no sea "core" (ej: company) va a `extra`.
  const extra: Record<string, string> = {}
  for (const [internalKey, rawSlug] of Object.entries(mapping)) {
    if ((CORE_KEYS as readonly string[]).includes(internalKey)) continue
    const slug = cleanSlug(rawSlug)
    if (slug && flat[slug] !== undefined) extra[internalKey] = flat[slug]
  }

  const sourceSlug = cleanSlug(mapping['source_url'])
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

  const leadName = `${core.first_name ?? ''} ${core.last_name ?? ''}`.trim()
  try {
    await notifyNewLead(supabase, workspace.id, (workspace as any).name ?? '', leadName)
  } catch (err) {
    console.error('notifyNewLead_failed', err)
  }

  return json({ ok: true })
})
