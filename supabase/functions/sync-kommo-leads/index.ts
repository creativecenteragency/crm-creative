// Edge Function: sync-kommo-leads
//
// Trae leads de Kommo (CRM externo, hoy solo lo usa Mercator) por polling y
// los upsertea en public.leads. Reemplaza al webhook de Forminator para ese
// workspace puntual, que dejó de recibir envíos porque Mercator migró la
// captura de leads a Kommo.
//
// Misma lógica de checkpoint/paginado/overlap que el Apps Script que ya
// corría (Kommo → Google Sheets): recorre por `updated_at` en toda la cuenta
// (no filtra por etapa) para no perder leads que cambian de etapa entre
// corridas, con una ventana de solapamiento hacia atrás.
//
// Se puede invocar de dos formas:
//  - Cron (pg_cron + pg_net) con el header x-cron-secret.
//  - Botón "Sincronizar ahora" en el CRM, con el JWT de un master o admin del
//    workspace de Kommo.
//
// No hace UPDATE de status/rating/is_spam/next_contact_at en leads que ya
// existen — esos los administra el equipo desde el CRM y no deben pisarse
// con lo que diga Kommo. Solo se refrescan los datos descriptivos (nombre,
// contacto, embudo/etapa, etiquetas, etc).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')!
const KOMMO_SUBDOMAIN = Deno.env.get('KOMMO_SUBDOMAIN')!
const KOMMO_TOKEN = Deno.env.get('KOMMO_TOKEN')!
const KOMMO_WORKSPACE_ID = Deno.env.get('KOMMO_WORKSPACE_ID')!

// Con ~160ms entre consultas, 100 leads (1-3 consultas c/u) tardan ~40-60s: lejos del tope de tiempo de la función.
const MAX_POR_EJECUCION = 100
const SOLAPAMIENTO_SEG = 900

// CUIT del lead (custom field), igual que en el Apps Script original.
const CUIT_FIELD_ID = 863082

// Kommo no expone el nombre del canal (WhatsApp/Instagram/...) por API para
// leads con integraciones nativas — hay que mapearlo a mano por source_id.
// Mismo mapeo que ya se había descubierto en el Apps Script.
const CANAL_POR_SOURCE_ID: Record<number, string> = {
  29278: 'WhatsApp Business',
  4110: 'WhatsApp Lite',
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS_HEADERS } })
}

// Kommo limita a ~7 consultas/segundo por cuenta. Cada lead necesita 1-2 consultas
// extra (contacto, empresa), así que sin freno una corrida grande se pasa del
// límite. Si Kommo responde 429/5xx, devolver null como con un 404 haría que el
// lead se guardara SIN teléfono y pisara el que ya tenía — por eso acá se
// reintenta con espera y, si sigue fallando, se corta la corrida entera (el
// checkpoint no avanza y la próxima vuelve a intentarlo).
let ultimaConsulta = 0
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function kommoGet(path: string): Promise<any> {
  for (let intento = 0; intento < 4; intento++) {
    const espera = 160 - (Date.now() - ultimaConsulta)
    if (espera > 0) await dormir(espera)
    ultimaConsulta = Date.now()

    const res = await fetch(`https://${KOMMO_SUBDOMAIN}.kommo.com${path}`, {
      headers: { Authorization: `Bearer ${KOMMO_TOKEN}` },
    })
    if (res.status === 204) return null
    if (res.status === 429 || res.status >= 500) {
      await dormir(1000 * (intento + 1))
      continue
    }
    if (!res.ok) {
      // 4xx que no es de límite (ej. 404: contacto borrado) — es un dato que falta, no un error transitorio.
      console.error('kommo_api_error', res.status, path, (await res.text()).slice(0, 300))
      return null
    }
    return res.json()
  }
  throw new Error('kommo_no_disponible ' + path)
}

function valorPorCodigo(campos: any[] | undefined, code: string): string | null {
  const c = (campos ?? []).find((x) => x.field_code === code)
  const v = c?.values?.[0]
  return v ? String(v.value) : null
}

function valorPorFieldId(campos: any[] | undefined, fieldId: number): string | null {
  const c = (campos ?? []).find((x) => x.field_id === fieldId)
  const v = c?.values?.[0]
  return v ? String(v.value) : null
}

async function cargarMapasPipeline(): Promise<{ pipes: Record<number, string>; stages: Record<number, string> }> {
  const data = await kommoGet('/api/v4/leads/pipelines')
  const pipes: Record<number, string> = {}
  const stages: Record<number, string> = {}
  for (const pl of data?._embedded?.pipelines ?? []) {
    pipes[pl.id] = pl.name
    for (const st of pl._embedded?.statuses ?? []) stages[st.id] = st.name
  }
  return { pipes, stages }
}

async function construirRegistro(lead: any, mapas: { pipes: Record<number, string>; stages: Record<number, string> }) {
  const tags = (lead._embedded?.tags ?? []).map((t: any) => t.name)

  let phone: string | null = null
  let email: string | null = null
  let contactName: string | null = null
  const contactos = lead._embedded?.contacts ?? []
  const principal = contactos.find((c: any) => c.is_main) ?? contactos[0]
  if (principal) {
    const contacto = await kommoGet(`/api/v4/contacts/${principal.id}`)
    if (contacto) {
      contactName = contacto.name ?? null
      phone = valorPorCodigo(contacto.custom_fields_values, 'PHONE')
      email = valorPorCodigo(contacto.custom_fields_values, 'EMAIL')
    }
  }

  let empresaNombre: string | null = null
  const empresas = lead._embedded?.companies ?? []
  if (empresas.length) {
    const empresa = await kommoGet(`/api/v4/companies/${empresas[0].id}`)
    if (empresa) {
      empresaNombre = empresa.name ?? null
      if (!phone) phone = valorPorCodigo(empresa.custom_fields_values, 'PHONE')
      if (!email) email = valorPorCodigo(empresa.custom_fields_values, 'EMAIL')
    }
  }

  const extra: Record<string, string> = {}
  const embudo = mapas.pipes[lead.pipeline_id]
  const etapa = mapas.stages[lead.status_id]
  if (embudo) extra['Embudo'] = embudo
  if (etapa) extra['Etapa'] = etapa
  if (tags.length) extra['Etiquetas'] = tags.join(', ')
  if (empresaNombre) extra['Empresa'] = empresaNombre
  if (contactName && contactName !== lead.name) extra['Contacto'] = contactName
  const cuit = valorPorFieldId(lead.custom_fields_values, CUIT_FIELD_ID)
  if (cuit) extra['CUIT'] = cuit
  extra['Kommo Lead ID'] = String(lead.id)

  const source_channel = lead.source_id
    ? CANAL_POR_SOURCE_ID[lead.source_id] ?? `Kommo (fuente ${lead.source_id})`
    : 'Kommo'

  return {
    workspace_id: KOMMO_WORKSPACE_ID,
    external_source: 'kommo',
    external_id: String(lead.id),
    // Kommo nombra por defecto 'Lead #<id>' a los leads que entran sin nombre (ej. por
    // WhatsApp); en ese caso el nombre real es el del contacto.
    first_name: (/^Lead #\d+$/.test(lead.name ?? '') && contactName ? contactName : lead.name) || null,
    last_name: null,
    email,
    phone,
    message: null,
    inquiry_type: null,
    extra,
    tags,
    source_url: null,
    source_channel,
    source_campaign_id: null,
    landing_page: null,
    created_at: lead.created_at ? new Date(lead.created_at * 1000).toISOString() : undefined,
  }
}

async function sync() {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: state } = await admin
    .from('kommo_sync_state')
    .select('last_updated_ts')
    .eq('workspace_id', KOMMO_WORKSPACE_ID)
    .maybeSingle()

  const checkpoint = state?.last_updated_ts ?? 0
  const desde = Math.max(0, checkpoint - SOLAPAMIENTO_SEG)
  const inicioTs = Math.floor(Date.now() / 1000)

  const mapas = await cargarMapasPipeline()

  let revisados = 0
  let ultimoTs = checkpoint
  let topeAlcanzado = false
  let page = 1
  const registros: any[] = []

  procesar: while (true) {
    const params = [
      'limit=250',
      `page=${page}`,
      'with=contacts,source_id',
      'order[updated_at]=asc',
      `filter[updated_at][from]=${desde}`,
    ]
    const data = await kommoGet(`/api/v4/leads?${params.join('&')}`)
    if (!data) break
    const lote = data._embedded?.leads ?? []

    for (const lead of lote) {
      revisados++
      ultimoTs = Math.max(ultimoTs, Number(lead.updated_at) || 0)
      registros.push(await construirRegistro(lead, mapas))

      if (revisados >= MAX_POR_EJECUCION) {
        ultimoTs = Number(lead.updated_at) || ultimoTs
        topeAlcanzado = true
        break procesar
      }
    }

    if (!data._links?.next) break
    page++
  }

  let upserted = 0
  const errors: string[] = []
  if (registros.length) {
    const { error, count } = await admin
      .from('leads')
      .upsert(registros, { onConflict: 'workspace_id,external_source,external_id', count: 'exact' })
    if (error) errors.push(error.message)
    else upserted = count ?? registros.length
  }

  // Si el upsert falló, no avanzamos el checkpoint — si no, los leads que
  // se revisaron pero no se llegaron a guardar quedan huérfanos para siempre
  // (la próxima corrida ya no los volvería a pedir).
  const resultado = { revisados, upserted, errors, tope_alcanzado: topeAlcanzado }
  const patch: Record<string, unknown> = { last_synced_at: new Date().toISOString(), last_result: resultado }
  if (errors.length === 0) patch.last_updated_ts = topeAlcanzado ? ultimoTs : inicioTs

  await admin.from('kommo_sync_state').update(patch).eq('workspace_id', KOMMO_WORKSPACE_ID)

  return resultado
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const isCron = req.headers.get('x-cron-secret') === CRON_SECRET
  if (!isCron) {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    if (!token) return json({ error: 'missing_auth' }, 401)

    const anonClient = createClient(SUPABASE_URL, ANON_KEY)
    const { data: userData, error: userError } = await anonClient.auth.getUser(token)
    if (userError || !userData?.user) return json({ error: 'invalid_session' }, 401)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: profile } = await admin.from('profiles').select('is_master').eq('id', userData.user.id).maybeSingle()

    if (!profile?.is_master) {
      const { data: membership } = await admin
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', KOMMO_WORKSPACE_ID)
        .eq('user_id', userData.user.id)
        .maybeSingle()
      if (membership?.role !== 'admin') return json({ error: 'forbidden' }, 403)
    }
  }

  try {
    const resultado = await sync()
    return json({ ok: true, ...resultado })
  } catch (err) {
    console.error('sync_failed', err)
    return json({ error: 'sync_failed', detail: String(err) }, 500)
  }
})
