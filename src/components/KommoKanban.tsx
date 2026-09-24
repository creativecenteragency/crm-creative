import { useMemo, useState } from 'react'
import type { KommoPipeline, KommoStage, Lead } from '../types/database'
import { STATUS_LABELS } from '../hooks/useLeads'
import { RatingBadge } from './LeadBadges'
import { leadCountsForMetrics } from '../lib/leadValidity'

const PAGE = 30

// Color de la franja superior de cada columna según el tipo de etapa de Kommo.
function stageAccent(type: number): string {
  if (type === 142) return 'border-t-green-500'
  if (type === 143) return 'border-t-slate-400'
  if (type === 1) return 'border-t-blue-400'
  return 'border-t-brand-orange'
}

type Column = { key: string; name: string; type: number; leads: Lead[] }

// Kanban con las mismas etapas que Kommo: el lead está en la columna de la etapa
// que Kommo dice hoy. Es de solo lectura — la etapa se mueve en Kommo y el CRM la
// refleja en la próxima sincronización.
export default function KommoKanban({
  leads,
  pipelines,
  validTags,
  onOpen,
}: {
  leads: Lead[]
  pipelines: KommoPipeline[] | null | undefined
  validTags: string[] | undefined
  onOpen: (lead: Lead) => void
}) {
  const [onlyCounted, setOnlyCounted] = useState(false)
  const [pipelineName, setPipelineName] = useState<string | null>(null)
  const [shown, setShown] = useState<Record<string, number>>({})

  const kommoLeads = useMemo(
    () =>
      leads
        .filter((l) => l.external_source === 'kommo' && !l.is_spam)
        .filter((l) => !onlyCounted || leadCountsForMetrics(l, validTags))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [leads, onlyCounted, validTags]
  )

  // Embudos: los de Kommo en su orden y, si un lead trae uno que no está en la
  // estructura guardada (o todavía no hay estructura), se agrega igual.
  const pipelineList = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of kommoLeads) {
      const name = l.extra?.Embudo ?? 'Sin embudo'
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    const ordered = (pipelines ?? []).map((p) => p.name)
    const extra = [...counts.keys()].filter((n) => !ordered.includes(n)).sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    return [...ordered, ...extra]
      .filter((name) => (counts.get(name) ?? 0) > 0)
      .map((name) => ({ name, count: counts.get(name) ?? 0 }))
  }, [kommoLeads, pipelines])

  const currentName =
    pipelineName && pipelineList.some((p) => p.name === pipelineName)
      ? pipelineName
      : ([...pipelineList].sort((a, b) => b.count - a.count)[0]?.name ?? null)

  const columns = useMemo<Column[]>(() => {
    if (!currentName) return []
    const inPipeline = kommoLeads.filter((l) => (l.extra?.Embudo ?? 'Sin embudo') === currentName)
    const stages: KommoStage[] = pipelines?.find((p) => p.name === currentName)?.stages ?? []
    const cols: Column[] = stages.map((s) => ({
      key: String(s.id),
      name: s.name,
      type: s.type,
      leads: inPipeline.filter((l) => l.extra?.Etapa === s.name),
    }))
    // Etapas que aparecen en los leads pero no en la estructura (etapa borrada en
    // Kommo, o estructura todavía sin cargar): al final, de la más usada a la menos.
    const known = new Set(stages.map((s) => s.name))
    const orphan = new Map<string, Lead[]>()
    for (const l of inPipeline) {
      const name = l.extra?.Etapa ?? 'Sin etapa'
      if (known.has(name)) continue
      orphan.set(name, [...(orphan.get(name) ?? []), l])
    }
    const orphanCols = [...orphan.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([name, ls]) => ({ key: 'x:' + name, name, type: 0, leads: ls }))
    // Las etapas de estructura vacías se muestran igual (así el tablero se parece al de Kommo).
    return [...cols, ...orphanCols]
  }, [kommoLeads, currentName, pipelines])

  if (kommoLeads.length === 0) {
    return <p className="text-sm text-brand-gray">Todavía no hay leads de Kommo para mostrar.</p>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-brand-gray">Embudo</span>
        {pipelineList.map((p) => (
          <button
            key={p.name}
            type="button"
            aria-pressed={p.name === currentName}
            onClick={() => setPipelineName(p.name)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              p.name === currentName
                ? 'border-brand-orange bg-brand-orange/10 text-brand-carbon'
                : 'border-brand-line bg-white text-brand-gray hover:bg-brand-cream'
            }`}
          >
            {p.name}
            <span className="text-[10px] text-brand-gray">{p.count}</span>
          </button>
        ))}
        <button
          type="button"
          role="switch"
          aria-checked={onlyCounted}
          onClick={() => setOnlyCounted((v) => !v)}
          className="ml-auto inline-flex items-center gap-2 text-xs font-medium text-slate-600"
        >
          <span className={`relative h-5 w-9 rounded-full transition-colors ${onlyCounted ? 'bg-brand-orange' : 'bg-slate-300'}`}>
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${onlyCounted ? 'left-[18px]' : 'left-0.5'}`}
            />
          </span>
          Solo los que cuentan en métricas
        </button>
      </div>

      <p className="text-xs text-brand-gray">
        Las columnas son las etapas de Kommo. La etapa se cambia en Kommo y acá se actualiza en la próxima sincronización.
      </p>

      <div className="flex flex-1 gap-4 overflow-x-auto pb-2">
        {columns.map((col) => {
          const limit = shown[col.key] ?? PAGE
          return (
            <div
              key={col.key}
              className={`flex w-72 shrink-0 flex-col rounded-lg border border-t-4 border-brand-line bg-white ${stageAccent(col.type)}`}
            >
              <div className="flex items-center justify-between border-b border-brand-line px-3 py-2.5">
                <span className="truncate text-sm font-medium text-brand-carbon" title={col.name}>
                  {col.name}
                </span>
                <span className="text-xs text-slate-400">{col.leads.length}</span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {col.leads.slice(0, limit).map((lead) => {
                  const counts = leadCountsForMetrics(lead, validTags)
                  return (
                    <div
                      key={lead.id}
                      onClick={() => onOpen(lead)}
                      className="cursor-pointer rounded-md border border-brand-line bg-white p-3 text-sm hover:shadow-sm"
                    >
                      <p className="font-medium text-brand-carbon">
                        {lead.first_name} {lead.last_name}
                      </p>
                      {(lead.phone || lead.email) && (
                        <p className="mt-0.5 truncate text-xs text-slate-500">{lead.phone || lead.email}</p>
                      )}
                      {lead.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {lead.tags.map((t) => (
                            <span key={t} className="rounded bg-brand-cream px-1.5 py-0.5 text-[10px] font-medium text-brand-carbon">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <RatingBadge rating={lead.rating} />
                        {lead.status !== 'nuevo' && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            CRM: {STATUS_LABELS[lead.status]}
                          </span>
                        )}
                        {!counts && (
                          <span
                            className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                            title="Sin etiqueta válida: no cuenta para métricas"
                          >
                            no cuenta en métricas
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-[10px] text-slate-400">
                        {new Date(lead.created_at).toLocaleDateString('es-AR')}
                        {lead.source_channel ? ' · ' + lead.source_channel : ''}
                      </p>
                    </div>
                  )
                })}
                {col.leads.length > limit && (
                  <button
                    type="button"
                    onClick={() => setShown((s) => ({ ...s, [col.key]: limit + PAGE }))}
                    className="w-full rounded-md border border-brand-line py-1.5 text-xs font-medium text-brand-gray hover:bg-brand-cream"
                  >
                    Mostrar más ({col.leads.length - limit})
                  </button>
                )}
                {col.leads.length === 0 && <p className="py-4 text-center text-xs text-slate-400">Sin leads</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
