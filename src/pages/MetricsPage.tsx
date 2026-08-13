import { useMemo, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useLeads, STATUS_LABELS, STATUS_ORDER, RATING_LABELS } from '../hooks/useLeads'
import type { Lead } from '../types/database'
import { leadQualityScore } from '../lib/leadQuality'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function countBy(leads: Lead[], key: (l: Lead) => string | null) {
  const counts = new Map<string, number>()
  for (const lead of leads) {
    const k = key(lead) || 'Sin dato'
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}

export default function MetricsPage() {
  const { workspaceId } = useParams()
  const { data: leads, isLoading, error } = useLeads(workspaceId)

  const metrics = useMemo(() => {
    const rows = (leads ?? []).filter((l) => !l.is_spam)
    const total = rows.length

    const byStatus = STATUS_ORDER.map((s) => ({
      label: STATUS_LABELS[s],
      value: rows.filter((l) => l.status === s).length,
    }))

    const byRating = [
      ...(['bueno', 'regular', 'malo'] as const).map((r) => ({
        label: RATING_LABELS[r],
        value: rows.filter((l) => l.rating === r).length,
      })),
      { label: 'Sin calificar', value: rows.filter((l) => !l.rating).length },
    ]

    const bySource = countBy(rows, (l) => l.source_channel)
    const byInquiry = countBy(rows, (l) => l.inquiry_type)

    const won = rows.filter((l) => l.status === 'ganado').length
    const lost = rows.filter((l) => l.status === 'perdido').length
    const decided = won + lost
    const winRate = decided > 0 ? Math.round((won / decided) * 100) : null

    const avgQuality = total > 0 ? Math.round(rows.reduce((sum, l) => sum + leadQualityScore(l), 0) / total) : 0

    const recent = rows.filter((l) => Date.now() - new Date(l.created_at).getTime() <= THIRTY_DAYS_MS).length

    return { total, byStatus, byRating, bySource, byInquiry, winRate, avgQuality, recent }
  }, [leads])

  if (isLoading) return <div className="p-8 text-sm text-slate-500">Cargando métricas…</div>
  if (error) return <div className="p-8 text-sm text-red-600">Error cargando métricas.</div>

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <h1 className="text-lg font-semibold text-brand-carbon">Métricas</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Leads totales" value={metrics.total} />
        <StatCard label="Últimos 30 días" value={metrics.recent} />
        <StatCard
          label="Tasa de ganados"
          value={metrics.winRate !== null ? `${metrics.winRate}%` : '—'}
          hint="sobre ganados + perdidos"
        />
        <StatCard label="Calidad promedio" value={metrics.avgQuality} hint="sobre 100" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Panel title="Por estado">
          <BarList items={metrics.byStatus} />
        </Panel>
        <Panel title="Por calificación">
          <BarList items={metrics.byRating} />
        </Panel>
        <Panel title="Por fuente">
          <BarList items={metrics.bySource} />
        </Panel>
        <Panel title="Por tipo de consulta">
          <BarList items={metrics.byInquiry.slice(0, 8)} />
        </Panel>
      </div>
    </div>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-brand-line bg-white p-4">
      <p className="text-xs font-medium text-brand-gray">{label}</p>
      <p className="text-2xl font-semibold font-display text-brand-carbon mt-1">{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-brand-line bg-white p-4 space-y-3">
      <h2 className="text-sm font-semibold text-brand-carbon">{title}</h2>
      {children}
    </div>
  )
}

function BarList({ items }: { items: { label: string; value: number }[] }) {
  if (items.every((i) => i.value === 0)) {
    return <p className="text-sm text-slate-400">Todavía no hay datos.</p>
  }
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3 text-sm">
          <span className="w-32 shrink-0 truncate text-slate-600" title={item.label}>
            {item.label}
          </span>
          <div className="flex-1 h-2 rounded-full bg-brand-cream overflow-hidden">
            <div className="h-full rounded-full bg-brand-orange" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          <span className="w-8 text-right text-brand-carbon font-medium tabular-nums">{item.value}</span>
        </div>
      ))}
    </div>
  )
}
