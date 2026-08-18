import type { Lead } from '../types/database'
import { RATING_LABELS, STATUS_LABELS } from '../hooks/useLeads'

export type Granularity = 'day' | 'week' | 'month'

export function dayKey(date: string | Date): string {
  return new Date(date).toISOString().slice(0, 10)
}

export function monthKey(date: string | Date): string {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Semana calendario empezando el lunes.
export function weekKey(date: string | Date): string {
  const d = new Date(date)
  const offset = (d.getDay() + 6) % 7
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset)
  return dayKey(monday)
}

export function periodKey(date: string | Date, granularity: Granularity): string {
  if (granularity === 'day') return dayKey(date)
  if (granularity === 'week') return weekKey(date)
  return monthKey(date)
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
}

export function periodLabel(key: string, granularity: Granularity): string {
  if (granularity === 'month') return monthLabel(key)
  return new Date(key).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

// Resuelve el valor de un lead para una "dimensión" de reporte: campos core
// del CRM (source_channel, inquiry_type, status, rating) o un campo adicional
// del workspace, identificado con el prefijo "extra:" (mismo formato que usan
// las columnas configurables de LeadsPage).
export function getDimensionValue(lead: Lead, dimensionKey: string): string {
  if (dimensionKey.startsWith('extra:')) {
    return lead.extra?.[dimensionKey.slice(6)] || 'Sin dato'
  }
  switch (dimensionKey) {
    case 'source_channel':
      return lead.source_channel || 'Sin dato'
    case 'inquiry_type':
      return lead.inquiry_type || 'Sin dato'
    case 'status':
      return STATUS_LABELS[lead.status]
    case 'rating':
      return lead.rating ? RATING_LABELS[lead.rating] : 'Sin calificar'
    default:
      return 'Sin dato'
  }
}
