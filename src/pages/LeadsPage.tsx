import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import {
  useBulkDeleteLeads,
  useBulkUpdateLeads,
  useLeads,
  RATING_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
} from '../hooks/useLeads'
import { useAuth } from '../context/AuthContext'
import { useEmailTemplates } from '../hooks/useEmailTemplates'
import { useWorkspaceBranding } from '../hooks/useWorkspaceBranding'
import { useWorkspace, useWorkspaceFields } from '../hooks/useAdmin'
import { useLeadsColumnPreferences, useUpdateLeadsColumnPreferences } from '../hooks/useLeadsColumnPreferences'
import type { Lead, LeadColumnConfig, LeadRating, LeadStatus } from '../types/database'
import { RatingBadge, StatusBadge } from '../components/LeadBadges'
import LeadCard from '../components/LeadCard'
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

function normalizeEmail(email: string | null): string {
  return (email ?? '').trim().toLowerCase()
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

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

type ColumnDef = {
  key: string
  label: string
  sortKey?: SortKey
  cellClassName?: string
  render: (lead: Lead) => ReactNode
}

// Columnas base del CRM. Las columnas de "campos adicionales" (definidas por
// workspace en Ajustes/Configuración) se agregan dinámicamente más abajo con
// el prefijo "extra:" para no chocar con estas keys.
const CORE_COLUMNS: ColumnDef[] = [
  {
    key: 'created_at',
    label: 'Fecha',
    sortKey: 'created_at',
    cellClassName: 'whitespace-nowrap text-slate-500',
    render: (lead) => new Date(lead.created_at).toLocaleDateString('es-AR'),
  },
  {
    key: 'name',
    label: 'Nombre',
    sortKey: 'name',
    cellClassName: 'font-medium text-slate-800',
    render: (lead) => (
      <>
        {lead.first_name} {lead.last_name}
        {lead.is_spam && <span className="ml-2 text-xs text-red-500">spam</span>}
      </>
    ),
  },
  {
    key: 'contact',
    label: 'Contacto',
    sortKey: 'contact',
    cellClassName: 'text-slate-500',
    render: (lead) => (
      <>
        <div>{lead.email}</div>
        <div className="flex items-center gap-1.5">
          <span>{lead.phone}</span>
          <WhatsAppButton phone={lead.phone} />
        </div>
      </>
    ),
  },
  {
    key: 'inquiry_type',
    label: 'Consulta',
    sortKey: 'inquiry_type',
    cellClassName: 'text-slate-600',
    render: (lead) => lead.inquiry_type,
  },
  {
    key: 'source_channel',
    label: 'Fuente',
    sortKey: 'source_channel',
    cellClassName: 'text-slate-500',
    render: (lead) => lead.source_channel || '—',
  },
  {
    key: 'quality',
    label: 'Calidad',
    sortKey: 'quality',
    render: (lead) => <QualityScore score={leadQualityScore(lead)} />,
  },
  {
    key: 'status',
    label: 'Estado',
    sortKey: 'status',
    render: (lead) => <StatusBadge status={lead.status} />,
  },
  {
    key: 'rating',
    label: 'Calificación',
    sortKey: 'rating',
    render: (lead) => <RatingBadge rating={lead.rating} />,
  },
]

export default function LeadsPage() {
  const { workspaceId } = useParams()
  const { profile } = useAuth()
  const { data: leads, isLoading, error } = useLeads(workspaceId)
  const bulkUpdate = useBulkUpdateLeads(workspaceId)
  const bulkDelete = useBulkDeleteLeads(workspaceId)
  const { data: templates } = useEmailTemplates(workspaceId)
  const { data: branding } = useWorkspaceBranding(workspaceId)
  const { data: workspace } = useWorkspace(workspaceId)
  const { data: workspaceFields } = useWorkspaceFields(workspaceId)
  const { data: savedColumnConfig } = useLeadsColumnPreferences(workspaceId)
  const updateColumnPrefs = useUpdateLeadsColumnPreferences(workspaceId)
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [ratingFilter, setRatingFilter] = useState<LeadRating | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Lead | null>(null)
  const [showSpam, setShowSpam] = useState(false)
  const [duplicatesOnly, setDuplicatesOnly] = useState(false)
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
  const [pageSize, setPageSize] = useState<number>(25)
  const [useCustomPageSize, setUseCustomPageSize] = useState(false)
  const [customPageSizeInput, setCustomPageSizeInput] = useState('')
  const [page, setPage] = useState(1)
  const [columnConfig, setColumnConfig] = useState<LeadColumnConfig[]>([])
  const [showColumnsMenu, setShowColumnsMenu] = useState(false)

  const customColumns = useMemo<ColumnDef[]>(
    () =>
      (workspaceFields ?? [])
        .filter((f) => f.key !== 'inquiry_type')
        .map((f) => ({
          key: `extra:${f.key}`,
          label: f.label,
          cellClassName: 'text-slate-600',
          render: (lead: Lead) => lead.extra?.[f.key] ?? '',
        })),
    [workspaceFields]
  )

  const availableColumns = useMemo(() => [...CORE_COLUMNS, ...customColumns], [customColumns])
  const columnByKey = useMemo(() => new Map(availableColumns.map((c) => [c.key, c])), [availableColumns])

  // Concilia la preferencia guardada del usuario con las columnas realmente
  // disponibles hoy: descarta keys que ya no existen (ej. un campo adicional
  // borrado) y agrega al final, visibles, las columnas nuevas que no estaban
  // guardadas todavía.
  useEffect(() => {
    if (savedColumnConfig === undefined) return
    const availableKeys = availableColumns.map((c) => c.key)
    const base = savedColumnConfig && savedColumnConfig.length > 0 ? savedColumnConfig : availableColumns.map((c) => ({ key: c.key, visible: true }))
    const reconciled = base.filter((c) => availableKeys.includes(c.key))
    const missingKeys = availableKeys.filter((k) => !reconciled.some((c) => c.key === k))
    setColumnConfig([...reconciled, ...missingKeys.map((k) => ({ key: k, visible: true }))])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedColumnConfig, availableColumns])

  const visibleColumns = useMemo(
    () =>
      columnConfig
        .filter((c) => c.visible)
        .map((c) => columnByKey.get(c.key))
        .filter((c): c is ColumnDef => !!c),
    [columnConfig, columnByKey]
  )

  function persistColumnConfig(next: LeadColumnConfig[]) {
    setColumnConfig(next)
    updateColumnPrefs.mutate(next)
  }

  function toggleColumnVisible(key: string) {
    persistColumnConfig(columnConfig.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)))
  }

  function moveColumn(key: string, direction: -1 | 1) {
    const idx = columnConfig.findIndex((c) => c.key === key)
    const targetIdx = idx + direction
    if (idx === -1 || targetIdx < 0 || targetIdx >= columnConfig.length) return
    const next = [...columnConfig]
    ;[next[idx], next[targetIdx]] = [next[targetIdx], next[idx]]
    persistColumnConfig(next)
  }

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    )
  }

  const duplicateEmails = useMemo(() => {
    const counts = new Map<string, number>()
    for (const lead of leads ?? []) {
      if (lead.is_spam) continue
      const email = normalizeEmail(lead.email)
      if (!email) continue
      counts.set(email, (counts.get(email) ?? 0) + 1)
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([email]) => email))
  }, [leads])

  const filtered = useMemo(() => {
    if (!leads) return []
    const rows = leads.filter((lead) => {
      if (!showSpam && lead.is_spam) return false
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false
      if (ratingFilter !== 'all' && lead.rating !== ratingFilter) return false
      if (duplicatesOnly && !duplicateEmails.has(normalizeEmail(lead.email))) return false
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
  }, [leads, statusFilter, ratingFilter, search, showSpam, duplicatesOnly, duplicateEmails, sort])

  // Si cambian los filtros, el orden o el tamaño de página, volvemos a la página 1
  // para no quedar mostrando una página vacía por accidente.
  useEffect(() => {
    setPage(1)
  }, [statusFilter, ratingFilter, search, showSpam, duplicatesOnly, sort, pageSize])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize]
  )

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

  async function handleBulkDelete() {
    const ok = window.confirm(
      `¿Eliminar ${selectedIds.size} lead${selectedIds.size === 1 ? '' : 's'}? Esta acción no se puede deshacer.`
    )
    if (!ok) return
    await bulkDelete.mutateAsync([...selectedIds])
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
    <div className="p-4 sm:p-6 space-y-4">
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
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={duplicatesOnly} onChange={(e) => setDuplicatesOnly(e.target.checked)} />
          Ver solo duplicados
          {duplicateEmails.size > 0 && <span className="text-brand-orange">({duplicateEmails.size})</span>}
        </label>

        <div className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setShowColumnsMenu((v) => !v)}
            className="rounded-md border border-brand-line px-3 py-1.5 text-sm hover:bg-brand-cream"
          >
            Columnas
          </button>
          {showColumnsMenu && (
            <div className="absolute z-10 mt-1 w-72 rounded-md border border-brand-line bg-white p-2 shadow-lg">
              <div className="max-h-80 overflow-y-auto space-y-0.5">
                {columnConfig.map((c, i) => {
                  const col = columnByKey.get(c.key)
                  if (!col) return null
                  return (
                    <div key={c.key} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-brand-cream">
                      <input
                        type="checkbox"
                        checked={c.visible}
                        onChange={() => toggleColumnVisible(c.key)}
                        className="shrink-0"
                      />
                      <span className="flex-1 text-sm text-slate-700 truncate">{col.label}</span>
                      <button
                        type="button"
                        onClick={() => moveColumn(c.key, -1)}
                        disabled={i === 0}
                        className="text-xs text-brand-gray hover:text-brand-carbon disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveColumn(c.key, 1)}
                        disabled={i === columnConfig.length - 1}
                        className="text-xs text-brand-gray hover:text-brand-carbon disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={() => setShowColumnsMenu(false)}
                className="mt-2 w-full rounded-md border border-brand-line px-3 py-1 text-sm hover:bg-brand-cream"
              >
                Listo
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <select
            value={useCustomPageSize ? 'custom' : String(pageSize)}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setUseCustomPageSize(true)
                const n = parseInt(customPageSizeInput, 10)
                if (n > 0) setPageSize(n)
              } else {
                setUseCustomPageSize(false)
                setPageSize(Number(e.target.value))
              }
            }}
            className="rounded-md border border-brand-line px-3 py-1.5 text-sm"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} por página
              </option>
            ))}
            <option value="custom">Personalizado</option>
          </select>
          {useCustomPageSize && (
            <input
              type="number"
              min={1}
              value={customPageSizeInput}
              onChange={(e) => {
                setCustomPageSizeInput(e.target.value)
                const n = parseInt(e.target.value, 10)
                if (n > 0) setPageSize(n)
              }}
              placeholder="Cantidad"
              className="w-24 rounded-md border border-brand-line px-2 py-1.5 text-sm"
            />
          )}
        </div>
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

          {profile?.is_master && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDelete.isPending}
              className="rounded-md border border-red-200 text-red-600 px-3 py-1 text-sm hover:bg-red-50 disabled:opacity-50"
            >
              {bulkDelete.isPending ? 'Eliminando…' : 'Eliminar'}
            </button>
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

      <div className="hidden md:block overflow-x-auto rounded-lg border border-brand-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-cream text-left text-xs font-medium text-brand-gray uppercase">
            <tr>
              <th className="px-4 py-2.5 w-8">
                <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} />
              </th>
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  onClick={col.sortKey ? () => toggleSort(col.sortKey!) : undefined}
                  className={`px-4 py-2.5 ${col.sortKey ? 'cursor-pointer select-none hover:text-brand-carbon' : ''}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortKey && sort.key === col.sortKey && (
                      <span className="text-brand-orange">{sort.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => setSelected(lead)}
                className="cursor-pointer hover:bg-slate-50"
              >
                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(lead.id)} onChange={() => toggleOne(lead.id)} />
                </td>
                {visibleColumns.map((col) => (
                  <td key={col.key} className={`px-4 py-2.5 ${col.cellClassName ?? ''}`}>
                    {col.render(lead)}
                  </td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length + 1} className="px-4 py-8 text-center text-slate-400">
                  No hay leads que coincidan con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {paginated.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            selected={selectedIds.has(lead.id)}
            onToggleSelect={toggleOne}
            onClick={() => setSelected(lead)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-slate-400 text-sm">No hay leads que coincidan con el filtro.</p>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="flex items-center justify-between px-1 text-sm text-brand-gray">
          <span>
            Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} de{' '}
            {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="rounded-md border border-brand-line px-3 py-1 text-sm hover:bg-brand-cream disabled:opacity-40"
            >
              Anterior
            </button>
            <span>
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-md border border-brand-line px-3 py-1 text-sm hover:bg-brand-cream disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {selected && <LeadDrawer lead={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
