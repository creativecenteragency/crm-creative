import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useBulkUpdateLeads, useLeads, RATING_LABELS, STATUS_LABELS, STATUS_ORDER } from '../hooks/useLeads'
import { useEmailTemplates } from '../hooks/useEmailTemplates'
import { useWorkspaceBranding } from '../hooks/useWorkspaceBranding'
import { useWorkspace } from '../hooks/useAdmin'
import type { Lead, LeadRating, LeadStatus } from '../types/database'
import { RatingBadge, StatusBadge } from '../components/LeadBadges'
import LeadDrawer from '../components/LeadDrawer'
import QualityScore from '../components/QualityScore'
import WhatsAppButton from '../components/WhatsAppButton'
import { leadQualityScore } from '../lib/leadQuality'
import { ensureHtml, renderTemplate, wrapBrandedEmail } from '../lib/emailTemplate'
import { supabase } from '../lib/supabase'

function addDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

type SortKey = 'created_at' | 'name' | 'contact' | 'inquiry_type' | 'source_channel' | 'quality' | 'status' | 'rating'
type SortDirection = 'asc' | 'desc'

const STATUS_RANK: Record<LeadStatus, number> = { nuevo: 0, contactado: 1, cotizado: 2, ganado: 3, perdido: 4 }
const RATING_RANK: Record<LeadRating, number> = { malo: 0, regular: 1, bueno: 2 }

function sortValue(lead: Lead, key: SortKey): string | number {
  switch (key) {
    case 'created_at':
      return new Date(lead.created_at).getTime()
    case 'name':
      return `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim().toLowerCase()
    case 'contact':
      return (lead.email ?? '').toLowerCase()
    case 'inquiry_type':
      return (lead.inquiry_type ?? '').toLowerCase()
    case 'source_channel':
      return (lead.source_channel ?? '').toLowerCase()
    case 'quality':
      return leadQualityScore(lead)
    case 'status':
      return STATUS_RANK[lead.status]
    case 'rating':
      return lead.rating ? RATING_RANK[lead.rating] : -1
  }
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'created_at', label: 'Fecha' },
  { key: 'name', label: 'Nombre' },
  { key: 'contact', label: 'Contacto' },
  { key: 'inquiry_type', label: 'Consulta' },
  { key: 'source_channel', label: 'Fuente' },
  { key: 'quality', label: 'Calidad' },
  { key: 'status', label: 'Estado' },
  { key: 'rating', label: 'Calificación' },
]

export default function LeadsPage() {
  const { workspaceId } = useParams()
  const { data: leads, isLoading, error } = useLeads(workspaceId)
  const bulkUpdate = useBulkUpdateLeads(workspaceId)
  const { data: templates } = useEmailTemplates(workspaceId)
  const { data: branding } = useWorkspaceBranding(workspaceId)
  const { data: workspace } = useWorkspace(workspaceId)
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [ratingFilter, setRatingFilter] = useState<LeadRating | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Lead | null>(null)
  const [showSpam, setShowSpam] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'created_at',
    direction: 'desc',
  })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<LeadStatus>('nuevo')
  const [bulkRating, setBulkRating] = useState<LeadRating>('bueno')
  const [bulkTemplateSlot, setBulkTemplateSlot] = useState<number | null>(null)
  const [bulkEmailState, setBulkEmailState] = useState<'idle' | 'sending'>('idle')
  const [bulkEmailResult, setBulkEmailResult] = useState<string | null>(null)
  const [bulkFollowUpTargets, setBulkFollowUpTargets] = useState<string[] | null>(null)

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    )
  }

  const filtered = useMemo(() => {
    if (!leads) return []
    const rows = leads.filter((lead) => {
      if (!showSpam && lead.is_spam) return false
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false
      if (ratingFilter !== 'all' && lead.rating !== ratingFilter) return false
      if (search) {
        const haystack = `${lead.first_name ?? ''} ${lead.last_name ?? ''} ${lead.email ?? ''} ${lead.phone ?? ''} ${lead.inquiry_type ?? ''} ${lead.extra?.company ?? ''} ${lead.source_channel ?? ''}`.toLowerCase()
        if (!haystack.includes(search.toLowerCase())) return false
      }
      return true
    })

    const dir = sort.direction === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = sortValue(a, sort.key)
      const bv = sortValue(b, sort.key)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [leads, statusFilter, ratingFilter, search, showSpam, sort])

  const allFilteredSelected = filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id))

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      if (allFilteredSelected) return new Set()
      const next = new Set(prev)
      filtered.forEach((l) => next.add(l.id))
      return next
    })
  }

  async function applyBulk(changes: Partial<Pick<Lead, 'status' | 'rating' | 'is_spam'>>) {
    await bulkUpdate.mutateAsync({ ids: [...selectedIds], changes })
    setSelectedIds(new Set())
  }

  const bulkTemplate = templates?.find((t) => t.slot === bulkTemplateSlot)

  async function handleBulkSendEmail() {
    if (!bulkTemplate) return
    const targets = (leads ?? []).filter((l) => selectedIds.has(l.id) && l.email)
    if (targets.length === 0) {
      setBulkEmailResult('Ninguno de los seleccionados tiene email.')
      return
    }
    setBulkEmailState('sending')
    setBulkEmailResult(null)
    const emails = targets.map((lead) => ({
      to: lead.email!,
      subject: renderTemplate(bulkTemplate.subject, lead),
      html: wrapBrandedEmail(ensureHtml(renderTemplate(bulkTemplate.body, lead)), branding, workspace?.name ?? ''),
      lead_id: lead.id,
      template_slot: bulkTemplate.slot,
    }))
    const { data, error } = await supabase.functions.invoke<{
      sent: number
      failed: number
      results: { to: string; lead_id?: string; ok: boolean }[]
    }>('send-lead-email', {
      body: { workspace_id: workspaceId, emails },
    })
    setBulkEmailState('idle')
    if (error) {
      setBulkEmailResult('Error al enviar.')
      return
    }
    setBulkEmailResult(`Enviados: ${data?.sent ?? 0}${data?.failed ? `, fallidos: ${data.failed}` : ''}.`)
    setSelectedIds(new Set())

    const sentLeadIds = (data?.results ?? []).filter((r) => r.ok && r.lead_id).map((r) => r.lead_id!)
    const toUpgrade = targets
      .filter((l) => sentLeadIds.includes(l.id) && l.status !== 'contactado' && l.status !== 'ganado' && l.status !== 'perdido')
      .map((l) => l.id)
    if (toUpgrade.length > 0) {
      await bulkUpdate.mutateAsync({ ids: toUpgrade, changes: { status: 'contactado' } })
    }
    if (sentLeadIds.length > 0) {
      setBulkFollowUpTargets(sentLeadIds)
    }
  }

  async function confirmBulkFollowUp(days: number) {
    if (!bulkFollowUpTargets) return
    await bulkUpdate.mutateAsync({ ids: bulkFollowUpTargets, changes: { next_contact_at: addDays(days) } })
    setBulkFollowUpTargets(null)
  }

  if (isLoading) return <div className="p-8 text-sm text-slate-500">Cargando leads…</div>
  if (error) return <div className="p-8 text-sm text-red-600">Error cargando leads.</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-brand-carbon">Leads</h1>
        <p className="text-sm text-brand-gray">{filtered.length} de {leads?.length ?? 0}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Buscar por nombre, email, consulta, empresa…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-brand-line px-3 py-1.5 text-sm min-w-56 focus:outline-none focus:ring-2 focus:ring-brand-orange/40"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LeadStatus | 'all')}
          className="rounded-md border border-brand-line px-3 py-1.5 text-sm"
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
          className="rounded-md border border-brand-line px-3 py-1.5 text-sm"
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

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-orange bg-brand-cream px-4 py-2.5 text-sm">
          <span className="font-medium text-brand-carbon">{selectedIds.size} seleccionados</span>

          <div className="flex items-center gap-1.5">
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as LeadStatus)}
              className="rounded-md border border-brand-line px-2 py-1 text-sm"
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <button
              onClick={() => applyBulk({ status: bulkStatus })}
              disabled={bulkUpdate.isPending}
              className="rounded-md border border-brand-line px-3 py-1 text-sm hover:bg-white disabled:opacity-50"
            >
              Cambiar estado
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <select
              value={bulkRating}
              onChange={(e) => setBulkRating(e.target.value as LeadRating)}
              className="rounded-md border border-brand-line px-2 py-1 text-sm"
            >
              {Object.entries(RATING_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              onClick={() => applyBulk({ rating: bulkRating })}
              disabled={bulkUpdate.isPending}
              className="rounded-md border border-brand-line px-3 py-1 text-sm hover:bg-white disabled:opacity-50"
            >
              Calificar
            </button>
          </div>

          <button
            onClick={() => applyBulk({ is_spam: true })}
            disabled={bulkUpdate.isPending}
            className="rounded-md border border-brand-line px-3 py-1 text-sm hover:bg-white disabled:opacity-50"
          >
            Marcar spam
          </button>
          <button
            onClick={() => applyBulk({ is_spam: false })}
            disabled={bulkUpdate.isPending}
            className="rounded-md border border-brand-line px-3 py-1 text-sm hover:bg-white disabled:opacity-50"
          >
            Quitar de spam
          </button>

          {templates && templates.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                value={bulkTemplateSlot ?? ''}
                onChange={(e) => setBulkTemplateSlot(e.target.value ? Number(e.target.value) : null)}
                className="rounded-md border border-brand-line px-2 py-1 text-sm"
              >
                <option value="">Elegí plantilla…</option>
                {templates.map((t) => (
                  <option key={t.slot} value={t.slot}>
                    {t.name || `Plantilla ${t.slot}`}
                  </option>
                ))}
              </select>
              <button
                onClick={handleBulkSendEmail}
                disabled={!bulkTemplate || bulkEmailState === 'sending'}
                className="rounded-md border border-brand-line px-3 py-1 text-sm hover:bg-white disabled:opacity-50"
              >
                {bulkEmailState === 'sending' ? 'Enviando…' : 'Enviar email'}
              </button>
            </div>
          )}

          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-sm text-brand-gray hover:text-brand-carbon"
          >
            Cancelar
          </button>
        </div>
      )}
      {bulkEmailResult && <p className="text-sm text-brand-gray">{bulkEmailResult}</p>}

      {bulkFollowUpTargets && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-orange bg-brand-cream px-4 py-2.5 text-sm">
          <span className="text-brand-carbon">
            {bulkFollowUpTargets.length} marcados como Contactado. ¿Programamos un seguimiento?
          </span>
          <button
            onClick={() => confirmBulkFollowUp(1)}
            className="rounded-md border border-brand-line px-3 py-1 text-sm hover:bg-white"
          >
            Mañana
          </button>
          <button
            onClick={() => confirmBulkFollowUp(3)}
            className="rounded-md border border-brand-line px-3 py-1 text-sm hover:bg-white"
          >
            +3 días
          </button>
          <button
            onClick={() => confirmBulkFollowUp(7)}
            className="rounded-md border border-brand-line px-3 py-1 text-sm hover:bg-white"
          >
            +7 días
          </button>
          <button
            onClick={() => setBulkFollowUpTargets(null)}
            className="ml-auto text-sm text-brand-gray hover:text-brand-carbon"
          >
            No, gracias
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-brand-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-cream text-left text-xs font-medium text-brand-gray uppercase">
            <tr>
              <th className="px-4 py-2.5 w-8">
                <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} />
              </th>
              {COLUMNS.map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key)}
                  className="px-4 py-2.5 cursor-pointer select-none hover:text-brand-carbon"
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    {sort.key === key && (
                      <span className="text-brand-orange">{sort.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => setSelected(lead)}
                className="cursor-pointer hover:bg-slate-50"
              >
                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(lead.id)} onChange={() => toggleOne(lead.id)} />
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                  {new Date(lead.created_at).toLocaleDateString('es-AR')}
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-800">
                  {lead.first_name} {lead.last_name}
                  {lead.is_spam && <span className="ml-2 text-xs text-red-500">spam</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-500">
                  <div>{lead.email}</div>
                  <div className="flex items-center gap-1.5">
                    <span>{lead.phone}</span>
                    <WhatsAppButton phone={lead.phone} />
                  </div>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{lead.inquiry_type}</td>
                <td className="px-4 py-2.5 text-slate-500">{lead.source_channel || '—'}</td>
                <td className="px-4 py-2.5">
                  <QualityScore score={leadQualityScore(lead)} />
                </td>
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
                <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-slate-400">
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
