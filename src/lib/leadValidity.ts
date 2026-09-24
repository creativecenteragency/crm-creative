import type { Lead } from '../types/database'

// Un lead de Kommo cuenta para las métricas solo si tiene alguna de las
// etiquetas válidas del workspace. Los que entraron por formulario (Forminator,
// CSV) no dependen de etiquetas y siempre cuentan. Se decide al LEER, no al
// importar: todos los leads se guardan igual, así que si mañana cambia qué
// etiquetas valen no se pierde nada ni hay que re-sincronizar.
export function leadCountsForMetrics(lead: Lead, validTags: string[] | undefined): boolean {
  if (lead.external_source !== 'kommo') return true
  // Sin lista configurada (todavía cargando) no descartamos nada.
  if (!validTags || validTags.length === 0) return true
  const valid = new Set(validTags.map((t) => t.trim().toLowerCase()))
  return (lead.tags ?? []).some((t) => valid.has(t.trim().toLowerCase()))
}
