import { useMemo, useState } from 'react'
import type { Lead, WorkspaceField } from '../../types/database'
import { getDimensionValue, periodKey, periodLabel, type Granularity } from '../../lib/metrics'

const CORE_DIMENSIONS = [
  { key: 'source_channel', label: 'Fuente' },
  { key: 'inquiry_type', label: 'Tipo de consulta' },
  { key: 'status', label: 'Estado' },
  { key: 'rating', label: 'Calificación' },
]

const MAX_COLUMNS = 8
const OTHER = 'Otros'

function defaultFrom(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 5)
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function CustomReport({ leads, workspaceFields }: { leads: Lead[]; workspaceFields: WorkspaceField[] }) {
  const dimensionOptions = useMemo(
    () => [
      ...CORE_DIMENSIONS,
      ...workspaceFields
        .filter((f) => f.key !== 'inquiry_type' && (f.field_type === 'select' || f.field_type === 'checkbox'))
        .map((f) => ({ key: `extra:${f.key}`, label: f.label })),
    ],
    [workspaceFields]
  )

  const [dimension, setDimension] = useState(dimensionOptions[0]?.key ?? 'source_channel')
  const [granularity, setGranularity] = useState<Granularity>('month')
  const [from, setFrom] = useState(defaultFrom())
  const [to, setTo] = useState(defaultTo())

  const { columns, table, rowTotals, columnTotals, grandTotal } = useMemo(() => {
    const fromTime = new Date(from).getTime()
    const toTime = new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1
    const rows = leads.filter((l) => {
      if (l.is_spam) return false
      const t = new Date(l.created_at).getTime()
      return t >= fromTime && t <= toTime
    })

    const valueCounts = new Map<string, number>()
    for (const lead of rows) {
      const v = getDimensionValue(lead, dimension)
      valueCounts.set(v, (valueCounts.get(v) ?? 0) + 1)
    }
    const sortedValues = [...valueCounts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v)
    const topValues = sortedValues.slice(0, MAX_COLUMNS)
    const columns = sortedValues.length > MAX_COLUMNS ? [...topValues, OTHER] : topValues

    const pivot = new Map<string, Map<string, number>>()
    for (const lead of rows) {
      const period = periodKey(lead.created_at, granularity)
      const rawValue = getDimensionValue(lead, dimension)
      const value = topValues.includes(rawValue) ? rawValue : OTHER
      if (!pivot.has(period)) pivot.set(period, new Map())
      const bucket = pivot.get(period)!
      bucket.set(value, (bucket.get(value) ?? 0) + 1)
    }

    const table = [...pivot.keys()].sort().map((period) => {
      const bucket = pivot.get(period)!
      const cells = columns.map((c) => bucket.get(c) ?? 0)
      return { period, cells, total: cells.reduce((a, b) => a + b, 0) }
    })

    const columnTotals = columns.map((_, i) => table.reduce((sum, r) => sum + r.cells[i], 0))
    const grandTotal = columnTotals.reduce((a, b) => a + b, 0)
    const rowTotals = table.map((r) => r.total)

    return { columns, table, rowTotals, columnTotals, grandTotal }
  }, [leads, dimension, granularity, from, to])

  return (
    <div className="rounded-lg border border-brand-line bg-white p-4 space-y-4">
      <h2 className="text-sm font-semibold text-brand-carbon">Reporte personalizado</h2>
      <p className="text-xs text-slate-400">Cruzá una variable con un período de tiempo.</p>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={dimension}
          onChange={(e) => setDimension(e.target.value)}
          className="rounded-md border border-brand-line px-3 py-1.5 text-sm"
        >
          {dimensionOptions.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
        <select
          value={granularity}
          onChange={(e) => setGranularity(e.target.value as Granularity)}
          className="rounded-md border border-brand-line px-3 py-1.5 text-sm"
        >
          <option value="day">Por día</option>
          <option value="week">Por semana</option>
          <option value="month">Por mes</option>
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-md border border-brand-line px-3 py-1.5 text-sm"
        />
        <span className="text-sm text-brand-gray">a</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-md border border-brand-line px-3 py-1.5 text-sm"
        />
      </div>

      {table.length === 0 ? (
        <p className="text-sm text-slate-400">No hay leads en ese rango.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-brand-line">
          <table className="w-full text-xs">
            <thead className="bg-brand-cream text-left text-brand-gray uppercase">
              <tr>
                <th className="px-2 py-1.5 whitespace-nowrap">Período</th>
                {columns.map((c) => (
                  <th key={c} className="px-2 py-1.5 whitespace-nowrap">
                    {c}
                  </th>
                ))}
                <th className="px-2 py-1.5 whitespace-nowrap">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.map((row, i) => (
                <tr key={row.period}>
                  <td className="px-2 py-1.5 whitespace-nowrap text-slate-500">
                    {periodLabel(row.period, granularity)}
                  </td>
                  {row.cells.map((v, j) => (
                    <td key={j} className="px-2 py-1.5 text-slate-700 tabular-nums">
                      {v || ''}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 font-medium text-brand-carbon tabular-nums">{rowTotals[i]}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-brand-line font-medium bg-brand-cream/50">
                <td className="px-2 py-1.5 text-slate-600">Total</td>
                {columnTotals.map((v, i) => (
                  <td key={i} className="px-2 py-1.5 text-brand-carbon tabular-nums">
                    {v}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-brand-carbon tabular-nums">{grandTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
