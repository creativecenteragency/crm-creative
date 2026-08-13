import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLeads } from '../hooks/useLeads'
import type { Lead, LeadRating, LeadStatus } from '../types/database'
import { RatingBadge, StatusBadge } from '../components/LeadBadges'
import { STATUS_LABELS, STATUS_ORDER, RATING_LABELS } from '../hooks/useLeads'
import LeadDrawer from '../components/LeadDrawer'

export default function LeadsPage() {
  const { workspaceId } = useParams()
  const { data: leads, isLoading, error } = useLeads(workspaceId)
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [ratingFilter, setRatingFilter] = useState<LeadRating | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Lead | null>(null)
  const [showSpam, setShowSpam] = useState(false)

  const filtered = useMemo(() => {
    if (!leads) return []
    return leads.filter((lead) => {
      if (!showSpam && lead.is_spam) return false
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false
      if (ratingFilter !== 'all' && lead.rating !== ratingFilter) return false
      if (search) {
        const haystack = `${lead.first_name ?? ''} ${lead.last_name ?? ''} ${lead.email ?? ''} ${lead.inquiry_type ?? ''}`.toLowerCase()
        if (!haystack.includes(search.toLowerCase())) return false
      }
      return true
    })
  }, [leads, statusFilter, ratingFilter, search, showSpam])

  if (isLoading) return <div className="p-8 text-sm text-slate-500">Cargando leads…</div>
  if (error) return <div className="p-8 text-sm text-red-600">Error cargando leads.</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Leads</h1>
        <p className="text-sm text-slate-500">{filtered.length} de {leads?.length ?? 0}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Buscar por nombre, email, consulta…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm min-w-56"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LeadStatus | 'all')}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="all">Todos los estados</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value as LeadRating | 'all')}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="all">Todas las calificaciones</option>
          {Object.entries(RATING_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showSpam} onChange={(e) => setShowSpam(e.target.checked)} />
          Mostrar spam
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2.5">Fecha</th>
              <th className="px-4 py-2.5">Nombre</th>
              <th className="px-4 py-2.5">Contacto</th>
              <th className="px-4 py-2.5">Consulta</th>
              <th className="px-4 py-2.5">Fuente</th>
              <th className="px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5">Calificación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => setSelected(lead)}
                className="cursor-pointer hover:bg-slate-50"
              >
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                  {new Date(lead.created_at).toLocaleDateString('es-AR')}
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-800">
                  {lead.first_name} {lead.last_name}
                  {lead.is_spam && <span className="ml-2 text-xs text-red-500">spam</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-500">
                  <div>{lead.email}</div>
                  <div>{lead.phone}</div>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{lead.inquiry_type}</td>
                <td className="px-4 py-2.5 text-slate-500">{lead.source_channel ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-4 py-2.5">
                  <RatingBadge rating={lead.rating} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No hay leads que coincidan con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && <LeadDrawer lead={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
