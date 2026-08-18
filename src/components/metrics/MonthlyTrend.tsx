import { useMemo } from 'react'
import type { Lead } from '../../types/database'
import { monthKey, monthLabel } from '../../lib/metrics'

const MONTHS_BACK = 12

export default function MonthlyTrend({ leads }: { leads: Lead[] }) {
  const data = useMemo(() => {
    const now = new Date()
    const counts = new Map<string, number>()
    const keys: string[] = []
    for (let i = MONTHS_BACK - 1; i >= 0; i--) {
      const key = monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1))
      keys.push(key)
      counts.set(key, 0)
    }
    for (const lead of leads) {
      const key = monthKey(lead.created_at)
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return keys.map((key) => ({ key, label: monthLabel(key), value: counts.get(key) ?? 0 }))
  }, [leads])

  const max = Math.max(1, ...data.map((d) => d.value))

  if (data.every((d) => d.value === 0)) {
    return <p className="text-sm text-slate-400">Todavía no hay datos.</p>
  }

  return (
    <div className="flex items-end gap-1.5 h-36">
      {data.map((d) => (
        <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[11px] text-brand-carbon font-medium tabular-nums">{d.value || ''}</span>
          <div className="w-full flex items-end h-24 rounded-sm bg-brand-cream overflow-hidden">
            <div className="w-full bg-brand-orange rounded-t-sm" style={{ height: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="text-[10px] text-brand-gray whitespace-nowrap">{d.label}</span>
        </div>
      ))}
    </div>
  )
}
