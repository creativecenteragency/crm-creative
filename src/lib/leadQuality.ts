import type { Lead } from '../types/database'

// Puntaje simple y transparente (no hay datos históricos de conversión para
// entrenar nada más sofisticado). Reglas, de mayor a menor peso:
// - Empresa cargada en una consulta de Equipos DEA es la señal más fuerte
//   (compra institucional, no particular).
// - Empresa cargada en cualquier otra consulta también suma, pero menos.
// - Teléfono y mensaje con contenido real indican intención de contacto.
export function leadQualityScore(lead: Lead): number {
  let score = 40

  const hasCompany = !!lead.extra?.company?.trim()
  const isDea = /dea/i.test(lead.inquiry_type ?? '')

  if (hasCompany && isDea) score += 30
  else if (hasCompany) score += 15

  if (lead.phone && lead.phone.replace(/\D/g, '').length >= 8) score += 15
  if (lead.message && lead.message.trim().length > 20) score += 15

  return Math.min(100, score)
}
