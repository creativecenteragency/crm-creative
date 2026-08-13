import type { Lead, LeadRating, LeadStatus } from '../types/database'
import { RATING_LABELS, STATUS_LABELS, STATUS_ORDER, useUpdateLead } from '../hooks/useLeads'

export default function LeadDrawer({
  lead,
  onClose,
}: {
  lead: Lead
  onClose: () => void
}) {
  const updateLead = useUpdateLead(lead.workspace_id)
  const ratings: LeadRating[] = ['bueno', 'regular', 'malo']

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-xl p-6 overflow-y-auto space-y-6">
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
          <Field label="Teléfono" value={lead.phone} />
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
            value={lead.status}
            onChange={(e) => updateLead.mutate({ id: lead.id, changes: { status: e.target.value as LeadStatus } })}
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
                onClick={() => updateLead.mutate({ id: lead.id, changes: { rating: r } })}
                className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                  lead.rating === r
                    ? 'border-brand-orange bg-brand-orange text-brand-carbon font-medium'
                    : 'border-brand-line text-slate-600 hover:bg-brand-cream'
                }`}
              >
                {RATING_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <input
            id="is_spam"
            type="checkbox"
            checked={lead.is_spam}
            onChange={(e) => updateLead.mutate({ id: lead.id, changes: { is_spam: e.target.checked } })}
          />
          <label htmlFor="is_spam" className="text-sm text-slate-600">
            Marcar como spam
          </label>
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
