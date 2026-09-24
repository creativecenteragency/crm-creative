import { useState, type ReactNode } from 'react'
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

const ORIGIN_LABELS: Record<string, string> = { form: 'Formulario web', kommo: 'Kommo (WhatsApp)' }
const VALIDITY_LABELS: Record<string, string> = { counts: 'Cuentan en métricas', excluded: 'No cuentan en métricas' }

// Abierto/cerrado se recuerda en este navegador; si el storage no está, arranca abierto.
const OPEN_KEY = 'crm.leadFilterBar.open'
function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== '0'
  } catch {
    return true
  }
}

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
// en un panel plegable tipo acordeón. "Guardar vista" / "Restablecer" quedan en
// la cabecera para que cada usuario los tenga a mano aunque el panel esté cerrado.
export default function LeadFilterBar({
  view,
  onChange,
  showValidity,
  availableTags,
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
  availableTags: { name: string; count: number }[]
  duplicateCount: number
  customPageSize: boolean
  onCustomPageSize: (on: boolean) => void
  saved: boolean
  dirty: boolean
  saving: boolean
  onSave: () => void
  onReset: () => void
}) {
  const [open, setOpen] = useState(readOpen)
  const [showAllTags, setShowAllTags] = useState(false)
  const selectedTags = view.tags ?? []
  function toggleTag(name: string) {
    onChange({ tags: selectedTags.includes(name) ? selectedTags.filter((t) => t !== name) : [...selectedTags, name] })
  }
  // Las etiquetas elegidas siempre se ven, aunque queden fuera del recorte de "más usadas".
  const TAG_LIMIT = 12
  const visibleTags = showAllTags
    ? availableTags
    : availableTags.filter((t, i) => i < TAG_LIMIT || selectedTags.includes(t.name))
  const tagList = [
    ...visibleTags,
    ...selectedTags.filter((n) => !availableTags.some((t) => t.name === n)).map((name) => ({ name, count: 0 })),
  ]
  function toggleOpen() {
    setOpen((o) => {
      try {
        localStorage.setItem(OPEN_KEY, o ? '0' : '1')
      } catch {
        // sin storage: solo se pierde que se recuerde
      }
      return !o
    })
  }

  // Resumen de lo que está filtrado, visible aunque el panel esté cerrado.
  const active: string[] = []
  if (view.status !== 'all') active.push(STATUS_LABELS[view.status])
  if (view.rating !== 'all') active.push(RATING_LABELS[view.rating])
  if (view.origin !== 'all') active.push(ORIGIN_LABELS[view.origin])
  if (showValidity && view.validity !== 'all') active.push(VALIDITY_LABELS[view.validity])
  for (const t of selectedTags) active.push('Etiqueta: ' + t)
  if (view.showSpam) active.push('Con spam')
  if (!view.hideDuplicates) active.push('Con duplicados')

  return (
    <div className="rounded-lg border border-brand-line bg-white">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-carbon"
        >
          <span className={`inline-block text-xs text-brand-gray transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
          Filtros
          {active.length > 0 && (
            <span className="rounded-full bg-brand-orange px-2 py-0.5 text-[11px] font-semibold text-brand-carbon">
              {active.length}
            </span>
          )}
        </button>

        {!open && (
          <div className="flex flex-wrap items-center gap-1.5">
            {active.length === 0 ? (
              <span className="text-xs text-brand-gray">Sin filtros</span>
            ) : (
              active.map((a) => (
                <span
                  key={a}
                  className="rounded-full border border-brand-orange bg-brand-orange/10 px-2.5 py-0.5 text-xs font-medium text-brand-carbon"
                >
                  {a}
                </span>
              ))
            )}
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
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

      {open && (
        <div className="space-y-2.5 border-t border-brand-line p-3">
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

          {tagList.length > 0 && (
            <Group label="Etiquetas">
              {tagList.map((t) => (
                <Chip key={t.name} active={selectedTags.includes(t.name)} onClick={() => toggleTag(t.name)}>
                  {t.name}
                  {t.count > 0 && <span className="text-[10px] text-brand-gray">{t.count}</span>}
                </Chip>
              ))}
              {availableTags.length > TAG_LIMIT && (
                <button
                  type="button"
                  onClick={() => setShowAllTags((v) => !v)}
                  className="px-2 text-xs font-medium text-brand-orange hover:underline"
                >
                  {showAllTags ? 'Ver menos' : `Ver todas (${availableTags.length})`}
                </button>
              )}
              {selectedTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange({ tags: [] })}
                  className="px-2 text-xs font-medium text-brand-gray hover:underline"
                >
                  Limpiar
                </button>
              )}
              <span className="basis-full pl-[6.5rem] text-[11px] text-brand-gray">
                Podés elegir varias: se muestran los leads que tengan al menos una.
              </span>
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
          </div>
        </div>
      )}
    </div>
  )
}
