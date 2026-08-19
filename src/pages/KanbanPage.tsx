import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLeads, useUpdateLead, STATUS_LABELS, STATUS_ORDER } from '../hooks/useLeads'
import type { Lead, LeadStatus } from '../types/database'
import { RatingBadge } from '../components/LeadBadges'
import LeadDrawer from '../components/LeadDrawer'

export default function KanbanPage() {
  const { workspaceId } = useParams()
  const { data: leads, isLoading, error } = useLeads(workspaceId)
  const updateLead = useUpdateLead(workspaceId)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<LeadStatus | null>(null)

  if (isLoading) return <div className="p-8 text-sm text-slate-500">Cargando leads…</div>
  if (error) return <div className="p-8 text-sm text-red-600">Error cargando leads.</div>

  const visibleLeads = (leads ?? []).filter((l) => !l.is_spam)

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col">
      <h1 className="text-lg font-semibold text-brand-carbon mb-4">Kanban de leads</h1>
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

      {selected && <LeadDrawer lead={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
