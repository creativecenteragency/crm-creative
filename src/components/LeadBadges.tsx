import type { LeadRating, LeadStatus } from '../types/database'
import { RATING_LABELS, STATUS_LABELS } from '../hooks/useLeads'

const STATUS_COLORS: Record<LeadStatus, string> = {
  nuevo: 'bg-blue-100 text-blue-700',
  contactado: 'bg-amber-100 text-amber-700',
  cotizado: 'bg-purple-100 text-purple-700',
  ganado: 'bg-green-100 text-green-700',
  perdido: 'bg-slate-200 text-slate-600',
}

const RATING_COLORS: Record<LeadRating, string> = {
  bueno: 'bg-green-100 text-green-700',
  regular: 'bg-amber-100 text-amber-700',
  malo: 'bg-red-100 text-red-700',
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export function RatingBadge({ rating }: { rating: LeadRating | null }) {
  if (!rating) return <span className="text-xs text-slate-400">Sin calificar</span>
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${RATING_COLORS[rating]}`}>
      {RATING_LABELS[rating]}
    </span>
  )
}
