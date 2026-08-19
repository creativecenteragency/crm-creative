import type { ReactNode } from 'react'
import type { Lead } from '../types/database'
import { RatingBadge, StatusBadge } from './LeadBadges'
import WhatsAppButton from './WhatsAppButton'

// Tarjeta compacta para mostrar un lead en pantallas chicas, en vez de una
// fila de tabla. A diferencia de la tabla desktop, siempre muestra el mismo
// set de campos clave (no respeta la configuración de columnas, que es un
// concepto propio de la vista de tabla).
export default function LeadCard({
  lead,
  selected,
  onToggleSelect,
  onClick,
  dateText,
  dateBadge,
}: {
  lead: Lead
  selected?: boolean
  onToggleSelect?: (id: string) => void
  onClick: () => void
  // Por default se muestra la fecha de creación; en Seguimientos se pasa la
  // fecha de próximo contacto ya formateada (next_contact_at es date-only,
  // no se puede formatear igual que un timestamp sin correr el día por UTC).
  dateText?: string
  // Insignia opcional junto a la fecha (ej: "Atrasado"/"Hoy" en Seguimientos).
  dateBadge?: ReactNode
}) {
  return (
    <div
      onClick={onClick}
      className="rounded-lg border border-brand-line bg-white p-3 space-y-2 cursor-pointer hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={!!selected}
              onChange={() => onToggleSelect(lead.id)}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 shrink-0"
            />
          )}
          <div className="min-w-0">
            <p className="font-medium text-slate-800 truncate">
              {lead.first_name} {lead.last_name}
              {lead.is_spam && <span className="ml-2 text-xs text-red-500">spam</span>}
            </p>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              {dateText ?? new Date(lead.created_at).toLocaleDateString('es-AR')}
              {dateBadge}
            </p>
          </div>
        </div>
        <StatusBadge status={lead.status} />
      </div>

      <div className="text-sm text-slate-500 space-y-0.5">
        {lead.email && <div className="truncate">{lead.email}</div>}
        {lead.phone && (
          <div className="flex items-center gap-1.5">
            <span>{lead.phone}</span>
            <WhatsAppButton phone={lead.phone} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 truncate">{lead.source_channel || '—'}</span>
        <RatingBadge rating={lead.rating} />
      </div>
    </div>
  )
}
