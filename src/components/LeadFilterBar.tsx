import type { ReactNode } from 'react'
import { RATING_LABELS, STATUS_LABELS, STATUS_ORDER } from '../hooks/useLeads'
import type { LeadsView } from '../types/database'

const STATUS_DOT: Record<string, string> = {
  nuevo: 'bg-blue-500',
  contactado: 'bg-amber-500',
  cotizado: 'bg-purple-500',
  ganado: 'bg-green-500',
  perdido: 'bg-slate-400',
}

const RATING_DOT: Record<string, string> = {
  bueno: 'bg-green-500',
  regular: 'bg-amber-500',
  malo: 'bg-red-500',
}

const PAGE_SIZES = [10, 25, 50, 100]

function Chip({
  active,
  onClick,
  dot,
  children,
}: {
  active: boolean
  onClick: () => void
  dot?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-brand-orange bg-brand-orange/10 text-brand-carbon'
          : 'border-brand-line bg-white text-brand-gray hover:bg-brand-cream'
      }`}
    >
      {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
      {children}
    </button>
  )
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-brand-gray">{label}</span>
      {children}
    </div>
  )
}

function Switch({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-xs font-medium text-slate-600"
    >
      <span className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-brand-orange' : 'bg-slate-300'}`}>
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`}
        />
      </span>
      {children}
    </button>
  )
}

// Filtros de la tabla de leads como chips y switches (en vez de desplegables),
// con "Guardar vista" / "Restablecer" para que cada usuario conserve los suyos.
export default function LeadFilterBar({
  view,
  onChange,
  showValidity,
  duplicateCount,
  customPageSize,
  onCustomPageSize,
  saved,
  dirty,
  saving,
  onSave,
  onReset,
}: {
  view: LeadsView
  onChange: (patch: Partial<LeadsView>) => void
  showValidity: boolean
  duplicateCount: number
  customPageSize: boolean
  onCustomPageSize: (on: boolean) => void
  saved: boolean
  dirty: boolean
  saving: boolean
  onSave: () => void
  onReset: () => void
}) {
  return (
    <div className="space-y-2.5 rounded-lg border border-brand-line bg-white p-3">
      <Group label="Estado">
        <Chip active={view.status === 'all'} onClick={() => onChange({ status: 'all' })}>
          Todos
        </Chip>
        {STATUS_ORDER.map((s) => (
          <Chip key={s} active={view.status === s} dot={STATUS_DOT[s]} onClick={() => onChange({ status: s })}>
            {STATUS_LABELS[s]}
          </Chip>
        ))}
      </Group>

      <Group label="Calificación">
        <Chip active={view.rating === 'all'} onClick={() => onChange({ rating: 'all' })}>
          Todas
        </Chip>
        {Object.entries(RATING_LABELS).map(([value, label]) => (
          <Chip
            key={value}
            active={view.rating === value}
            dot={RATING_DOT[value]}
            onClick={() => onChange({ rating: value as LeadsView['rating'] })}
          >
            {label}
          </Chip>
        ))}
      </Group>

      <Group label="Origen">
        <Chip active={view.origin === 'all'} onClick={() => onChange({ origin: 'all' })}>
          Todos
        </Chip>
        <Chip active={view.origin === 'form'} onClick={() => onChange({ origin: 'form' })}>
          Formulario web
        </Chip>
        <Chip active={view.origin === 'kommo'} onClick={() => onChange({ origin: 'kommo' })}>
          Kommo (WhatsApp)
        </Chip>
      </Group>

      {showValidity && (
        <Group label="Métricas">
          <Chip active={view.validity === 'all'} onClick={() => onChange({ validity: 'all' })}>
            Todos
          </Chip>
          <Chip active={view.validity === 'counts'} dot="bg-green-500" onClick={() => onChange({ validity: 'counts' })}>
            Cuentan
          </Chip>
          <Chip active={view.validity === 'excluded'} dot="bg-amber-500" onClick={() => onChange({ validity: 'excluded' })}>
            No cuentan
          </Chip>
        </Group>
      )}

      <Group label="Por página">
        {PAGE_SIZES.map((n) => (
          <Chip
            key={n}
            active={!customPageSize && view.pageSize === n}
            onClick={() => {
              onCustomPageSize(false)
              onChange({ pageSize: n })
            }}
          >
            {n}
          </Chip>
        ))}
        <Chip active={customPageSize} onClick={() => onCustomPageSize(true)}>
          Otro
        </Chip>
        {customPageSize && (
          <input
            type="number"
            min={1}
            value={view.pageSize}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10)
              if (n > 0) onChange({ pageSize: n })
            }}
            className="w-20 rounded-md border border-brand-line px-2 py-1 text-xs"
          />
        )}
      </Group>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-brand-line pt-2.5">
        <Switch checked={view.showSpam} onChange={(v) => onChange({ showSpam: v })}>
          Mostrar spam
        </Switch>
        <Switch checked={view.hideDuplicates} onChange={(v) => onChange({ hideDuplicates: v })}>
          Ocultar duplicados
          {duplicateCount > 0 && <span className="text-brand-orange">({duplicateCount})</span>}
        </Switch>

        <div className="ml-auto flex items-center gap-2">
          {dirty ? (
            <span className="text-xs text-amber-700">● Cambios sin guardar</span>
          ) : saved ? (
            <span className="text-xs text-green-700">✓ Vista guardada</span>
          ) : null}
          <button
            type="button"
            onClick={onReset}
            className="rounded-md border border-brand-line px-3 py-1.5 text-xs font-medium text-brand-gray hover:bg-brand-cream"
            title="Volver a los filtros por defecto y borrar tu vista guardada"
          >
            ↺ Restablecer
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || (saved && !dirty)}
            className="rounded-md bg-brand-orange px-3 py-1.5 text-xs font-semibold text-brand-carbon hover:bg-brand-orange-dark disabled:opacity-40"
            title="Guardar estos filtros y orden como tu vista de esta lista"
          >
            {saving ? 'Guardando…' : '💾 Guardar vista'}
          </button>
        </div>
      </div>
    </div>
  )
}
