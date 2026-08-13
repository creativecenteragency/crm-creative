import { useEffect, useState } from 'react'
import type { Lead, LeadRating, LeadStatus } from '../types/database'
import { RATING_LABELS, STATUS_LABELS, STATUS_ORDER, useUpdateLead } from '../hooks/useLeads'
import WhatsAppButton from './WhatsAppButton'

function addDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function LeadDrawer({
  lead,
  onClose,
}: {
  lead: Lead
  onClose: () => void
}) {
  const updateLead = useUpdateLead(lead.workspace_id)
  const ratings: LeadRating[] = ['bueno', 'regular', 'malo']

  const [status, setStatus] = useState<LeadStatus>(lead.status)
  const [rating, setRating] = useState<LeadRating | null>(lead.rating)
  const [isSpam, setIsSpam] = useState(lead.is_spam)
  const [nextContactAt, setNextContactAt] = useState<string | null>(lead.next_contact_at?.slice(0, 10) ?? null)
  const [baseline, setBaseline] = useState({
    status: lead.status,
    rating: lead.rating,
    is_spam: lead.is_spam,
    next_contact_at: lead.next_contact_at?.slice(0, 10) ?? null,
  })
  const [justSaved, setJustSaved] = useState(false)

  // El prop `lead` es una foto fija tomada al abrir el drawer (no se actualiza solo),
  // así que llevamos el estado de edición acá y lo reseteamos si se abre otro lead.
  useEffect(() => {
    setStatus(lead.status)
    setRating(lead.rating)
    setIsSpam(lead.is_spam)
    setNextContactAt(lead.next_contact_at?.slice(0, 10) ?? null)
    setBaseline({
      status: lead.status,
      rating: lead.rating,
      is_spam: lead.is_spam,
      next_contact_at: lead.next_contact_at?.slice(0, 10) ?? null,
    })
    setJustSaved(false)
  }, [lead.id])

  const dirty =
    status !== baseline.status ||
    rating !== baseline.rating ||
    isSpam !== baseline.is_spam ||
    nextContactAt !== baseline.next_contact_at

  async function handleSave() {
    await updateLead.mutateAsync({ id: lead.id, changes: { status, rating, is_spam: isSpam, next_contact_at: nextContactAt } })
    setBaseline({ status, rating, is_spam: isSpam, next_contact_at: nextContactAt })
    setJustSaved(true)
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-xl p-6 overflow-y-auto space-y-6 flex flex-col">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-brand-carbon">
              {lead.first_name} {lead.last_name}
            </h2>
            <p className="text-sm text-slate-500">{new Date(lead.created_at).toLocaleString('es-AR')}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm">
            Cerrar ✕
          </button>
        </div>

        <div className="space-y-2 text-sm">
          <Field label="Email" value={lead.email} />
          {lead.phone && (
            <div>
              <p className="text-xs font-medium text-slate-400">Teléfono</p>
              <p className="text-slate-700 flex items-center gap-2">
                {lead.phone}
                <WhatsAppButton phone={lead.phone} />
              </p>
            </div>
          )}
          <Field label="Consulta" value={lead.inquiry_type} />
          <Field label="Mensaje" value={lead.message} multiline />
          <Field label="Fuente" value={sourceLabel(lead)} />
          {Object.entries(lead.extra ?? {}).map(([key, value]) => (
            <Field key={key} label={key} value={value} />
          ))}
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-500">Estado</label>
          <select
            className="w-full rounded-md border border-brand-line px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as LeadStatus)}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-500">Calificación</label>
          <div className="flex gap-2">
            {ratings.map((r) => (
              <button
                key={r}
                onClick={() => setRating(r)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                  rating === r
                    ? 'border-brand-orange bg-brand-orange text-brand-carbon font-medium'
                    : 'border-brand-line text-slate-600 hover:bg-brand-cream'
                }`}
              >
                {RATING_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-500">Próximo contacto</label>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            <button
              type="button"
              onClick={() => setNextContactAt(addDays(0))}
              className="rounded-md border border-brand-line px-2 py-1 text-xs hover:bg-brand-cream"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setNextContactAt(addDays(1))}
              className="rounded-md border border-brand-line px-2 py-1 text-xs hover:bg-brand-cream"
            >
              Mañana
            </button>
            <button
              type="button"
              onClick={() => setNextContactAt(addDays(3))}
              className="rounded-md border border-brand-line px-2 py-1 text-xs hover:bg-brand-cream"
            >
              +3 días
            </button>
            <button
              type="button"
              onClick={() => setNextContactAt(addDays(7))}
              className="rounded-md border border-brand-line px-2 py-1 text-xs hover:bg-brand-cream"
            >
              +7 días
            </button>
            {nextContactAt && (
              <button
                type="button"
                onClick={() => setNextContactAt(null)}
                className="rounded-md border border-brand-line px-2 py-1 text-xs text-red-500 hover:bg-red-50"
              >
                Quitar
              </button>
            )}
          </div>
          <input
            type="date"
            value={nextContactAt ?? ''}
            onChange={(e) => setNextContactAt(e.target.value || null)}
            className="w-full rounded-md border border-brand-line px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <input
            id="is_spam"
            type="checkbox"
            checked={isSpam}
            onChange={(e) => setIsSpam(e.target.checked)}
          />
          <label htmlFor="is_spam" className="text-sm text-slate-600">
            Marcar como spam
          </label>
        </div>

        <div className="mt-auto pt-4 border-t border-brand-line flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!dirty || updateLead.isPending}
            className="rounded-md bg-brand-orange text-brand-carbon text-sm font-semibold px-4 py-2 hover:bg-brand-orange-dark disabled:opacity-50"
          >
            {updateLead.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {justSaved && !dirty && !updateLead.isPending && <span className="text-xs text-green-600">Guardado ✓</span>}
          {updateLead.isError && <span className="text-xs text-red-600">Error al guardar.</span>}
        </div>
      </div>
    </div>
  )
}

function sourceLabel(lead: Lead) {
  if (!lead.source_channel) return '—'
  const parts = [lead.source_channel]
  if (lead.source_campaign_id) parts.push(`campaña ${lead.source_campaign_id}`)
  if (lead.landing_page) parts.push(lead.landing_page)
  return parts.join(' · ')
}

function Field({ label, value, multiline = false }: { label: string; value: string | null; multiline?: boolean }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className={multiline ? 'whitespace-pre-wrap text-slate-700' : 'text-slate-700'}>{value}</p>
    </div>
  )
}
