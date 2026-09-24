import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLeads, useUpdateLead, STATUS_LABELS, STATUS_ORDER } from '../hooks/useLeads'
import type { Lead, LeadStatus } from '../types/database'
import { RatingBadge } from '../components/LeadBadges'
import LeadDrawer from '../components/LeadDrawer'
import KommoKanban from '../components/KommoKanban'
import { useWorkspace } from '../hooks/useAdmin'
import { useKommoSyncState } from '../hooks/useKommoSync'

export default function KanbanPage() {
  const { workspaceId } = useParams()
  const { data: leads, isLoading, error } = useLeads(workspaceId)
  const updateLead = useUpdateLead(workspaceId)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<LeadStatus | null>(null)
  const { data: workspace } = useWorkspace(workspaceId)
  const { data: kommoState } = useKommoSyncState(workspaceId)
  // Con Kommo como fuente, el tablero por defecto refleja las etapas de Kommo; el de
  // estados propios del CRM (Nuevo → Ganado) sigue disponible con el selector.
  const hasKommoBoard = workspace?.lead_source === 'kommo' && !!kommoState
  const [board, setBoard] = useState<'kommo' | 'crm'>('kommo')
  const showKommo = hasKommoBoard && board === 'kommo'

  if (isLoading) return <div className="p-8 text-sm text-slate-500">Cargando leads…</div>
  if (error) return <div className="p-8 text-sm text-red-600">Error cargando leads.</div>

  const visibleLeads = (leads ?? []).filter((l) => !l.is_spam)

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-brand-carbon">Kanban de leads</h1>
        {hasKommoBoard && (
          <div className="inline-flex rounded-full border border-brand-line bg-white p-0.5 text-xs font-medium">
            {(
              [
                ['kommo', 'Etapas de Kommo'],
                ['crm', 'Estados del CRM'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={board === value}
                onClick={() => setBoard(value)}
                className={`rounded-full px-3 py-1 transition-colors ${
                  board === value ? 'bg-brand-orange/15 text-brand-carbon' : 'text-brand-gray hover:text-brand-carbon'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {showKommo ? (
        <KommoKanban leads={visibleLeads} pipelines={kommoState?.pipelines} validTags={kommoState?.valid_tags} onOpen={setSelected} />
      ) : (
      <div className="flex gap-4 overflow-x-auto flex-1">
        {STATUS_ORDER.map((status) => {
          const columnLeads = visibleLeads.filter((l) => l.status === status)
          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverStatus(status)
              }}
              onDragLeave={() => setDragOverStatus(null)}
              onDrop={(e) => {
                e.preventDefault()
                const leadId = e.dataTransfer.getData('text/lead-id')
                if (leadId) updateLead.mutate({ id: leadId, changes: { status } })
                setDragOverStatus(null)
              }}
              className={`w-72 shrink-0 rounded-lg border bg-white flex flex-col ${
                dragOverStatus === status ? 'border-brand-orange bg-brand-cream' : 'border-brand-line'
              }`}
            >
              <div className="px-3 py-2.5 border-b border-brand-line flex items-center justify-between">
                <span className="text-sm font-medium text-brand-carbon">{STATUS_LABELS[status]}</span>
                <span className="text-xs text-slate-400">{columnLeads.length}</span>
              </div>
              <div className="p-2 space-y-2 overflow-y-auto flex-1">
                {columnLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/lead-id', lead.id)}
                    onClick={() => setSelected(lead)}
                    className="rounded-md border border-brand-line bg-white p-3 text-sm cursor-pointer hover:shadow-sm"
                  >
                    <p className="font-medium text-brand-carbon">
                      {lead.first_name} {lead.last_name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{lead.inquiry_type}</p>
                    <div className="mt-2">
                      <RatingBadge rating={lead.rating} />
                    </div>
                    {/* El drag-and-drop es HTML5 nativo y no funciona por touch;
                        en mobile cambiamos el estado con este select en su lugar. */}
                    <select
                      value={lead.status}
                      onChange={(e) => updateLead.mutate({ id: lead.id, changes: { status: e.target.value as LeadStatus } })}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 w-full text-xs rounded border border-brand-line px-1.5 py-1 md:hidden"
                    >
                      {STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                {columnLeads.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">Sin leads</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
      )}

      {selected && <LeadDrawer lead={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
