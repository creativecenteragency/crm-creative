// Clasifica la URL de referencia (de dónde vino el clic) de un lead en un puñado
// de canales legibles, en vez de mostrar la URL cruda (que puede venir con
// parámetros utm/fbclid larguísimos) como "fuente". La URL original nunca se
// pierde: queda en `source_url` para quien necesite el detalle completo.
//
// El mapeo de dominios es específico de lo que se ve hoy en los leads reales
// (instagram.com, campsite.bio como su link-en-bio, facebook.com y variantes,
// google.com, y chatgpt.com/gemini.google.com como asistentes de IA). Si en el
// futuro aparecen dominios nuevos que valga la pena reconocer, se agregan acá.
//
// IMPORTANTE: esta misma clasificación vive duplicada en
// supabase/functions/ingest-lead/index.ts (Deno no puede importar desde src/lib) —
// si se cambia una, hay que cambiar la otra para no desincronizar webhook vs. CSV.
export type SourceClassification = {
  channel: string
  campaign: string | null
}

const DOMAIN_CHANNELS: Record<string, string> = {
  'instagram.com': 'Instagram',
  'campsite.bio': 'Instagram (bio)',
  'facebook.com': 'Facebook',
  'm.facebook.com': 'Facebook',
  'l.facebook.com': 'Facebook',
  'google.com': 'Google',
  'syndicatedsearch.goog': 'Google',
  'chatgpt.com': 'IA',
  'gemini.google.com': 'IA',
  // El referrer es el propio sitio del formulario (alguien ya estaba navegando
  // sumate.mercatorextra.com.ar y llegó al form desde ahí adentro) — a fines de
  // atribución de marketing eso es equivalente a "llegada directa", no un canal externo.
  'sumate.mercatorextra.com.ar': 'Directo',
}

export function classifySource(rawUrl: string | null | undefined): SourceClassification {
  if (!rawUrl || !rawUrl.trim()) return { channel: 'Sin dato', campaign: null }
  if (rawUrl === 'direct') return { channel: 'Directo', campaign: null }

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { channel: 'Otro', campaign: null }
  }

  const host = url.hostname.replace(/^www\./, '')
  const params = url.searchParams
  const campaign =
    params.get('utm_campaign') || params.get('gad_campaignid') || params.get('campaignid') || null

  // Un clic de Google Ads suele aterrizar en el propio dominio del cliente (es la
  // landing page del anuncio), no en un dominio de Google — por eso esto se chequea
  // ANTES que el dominio: si no, un lead de Google Ads en sumate.mercatorextra.com.ar
  // quedaría mal clasificado como "Directo" solo por el dominio.
  // No se separa "Google Ads" de "Google" orgánico: la landing prácticamente no
  // tiene posicionamiento orgánico, así que separar los dos ejes no aporta nada
  // y sí resta claridad — todo lo que venga de Google, pago o no, es un solo canal.
  if (params.get('gclid') || params.get('gbraid') || params.get('gad_source')) {
    return { channel: 'Google', campaign }
  }

  const channel = DOMAIN_CHANNELS[host] ?? 'Otro'
  return { channel, campaign }
}
