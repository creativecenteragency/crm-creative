import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Lead, LeadRating, LeadStatus } from '../types/database'
import { RATING_LABELS, STATUS_LABELS, STATUS_ORDER, useUpdateLead } from '../hooks/useLeads'
import { useEmailTemplates } from '../hooks/useEmailTemplates'
import { useLeadEmails } from '../hooks/useLeadEmails'
import { useWorkspaceBranding } from '../hooks/useWorkspaceBranding'
import { useWorkspace } from '../hooks/useAdmin'
import { ensureHtml, renderTemplate, wrapBrandedEmail } from '../lib/emailTemplate'
import { supabase } from '../lib/supabase'
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
  const queryClient = useQueryClient()
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

  const { data: templates } = useEmailTemplates(lead.workspace_id)
  const { data: branding } = useWorkspaceBranding(lead.workspace_id)
  const { data: workspace } = useWorkspace(lead.workspace_id)
  const { data: leadEmails, isLoading: emailsLoading } = useLeadEmails(lead.id)
  const [templateSlot, setTemplateSlot] = useState<number | null>(null)
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [sendError, setSendError] = useState<string | null>(null)
  const [showFollowUpPrompt, setShowFollowUpPrompt] = useState(false)
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null)

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
    setTemplateSlot(null)
    setSendState('idle')
    setSendError(null)
    setShowFollowUpPrompt(false)
    setExpandedEmailId(null)
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

  const selectedTemplate = templates?.find((t) => t.slot === templateSlot)
  const previewSubject = selectedTemplate ? renderTemplate(selectedTemplate.subject, lead) : ''
  const previewBody = selectedTemplate ? renderTemplate(selectedTemplate.body, lead) : ''

  async function handleSendEmail() {
    if (!lead.email || !selectedTemplate) return
    setSendState('sending')
    setSendError(null)
    const html = wrapBrandedEmail(ensureHtml(previewBody), branding, workspace?.name ?? '')
    const { data, error } = await supabase.functions.invoke<{ sent: number }>('send-lead-email', {
      body: {
        workspace_id: lead.workspace_id,
        emails: [
          { to: lead.email, subject: previewSubject, html, lead_id: lead.id, template_slot: selectedTemplate.slot },
        ],
      },
    })
    if (error || !data?.sent) {
      setSendState('error')
      setSendError(error?.message ?? 'No se pudo enviar.')
      return
    }
    setSendState('sent')
    queryClient.invalidateQueries({ queryKey: ['lead-emails', lead.id] })
    if (status !== 'contactado' && status !== 'ganado' && status !== 'perdido') {
      await updateLead.mutateAsync({ id: lead.id, changes: { status: 'contactado' } })
      setStatus('contactado')
      setBaseline((b) => ({ ...b, status: 'contactado' }))
    }
    setShowFollowUpPrompt(true)
  }

  async function confirmFollowUp(days: number) {
    const date = addDays(days)
    await updateLead.mutateAsync({ id: lead.id, changes: { next_contact_at: date } })
    setNextContactAt(date)
    setBaseline((b) => ({ ...b, next_contact_at: date }))
    setShowFollowUpPrompt(false)
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

        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="block text-xs font-medium text-slate-500">Enviar email</label>
          {!lead.email && <p className="text-xs text-slate-400">Este lead no tiene email.</p>}
          {lead.email && (!templates || templates.length === 0) && (
            <p className="text-xs text-slate-400">Todavía no hay plantillas creadas (ver Plantillas en el menú).</p>
          )}
          {lead.email && templates && templates.length > 0 && (
            <>
              <select
                value={templateSlot ?? ''}
                onChange={(e) => {
                  setTemplateSlot(e.target.value ? Number(e.target.value) : null)
                  setSendState('idle')
                }}
                className="w-full rounded-md border border-brand-line px-3 py-2 text-sm"
              >
                <option value="">Elegí una plantilla</option>
                {templates.map((t) => (
                  <option key={t.slot} value={t.slot}>
                    {t.name || `Plantilla ${t.slot}`}
                  </option>
                ))}
              </select>
              {selectedTemplate && (
                <div className="rounded-md border border-brand-line bg-brand-cream p-3 text-xs space-y-1">
                  <p className="font-medium text-brand-carbon">{previewSubject}</p>
                  <div className="text-slate-600" dangerouslySetInnerHTML={{ __html: ensureHtml(previewBody) }} />
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSendEmail}
                  disabled={!selectedTemplate || sendState === 'sending'}
                  className="rounded-md border border-brand-line px-3 py-1.5 text-sm hover:bg-brand-cream disabled:opacity-50"
                >
                  {sendState === 'sending' ? 'Enviando…' : 'Enviar email'}
                </button>
                {sendState === 'sent' && <span className="text-xs text-green-600">Enviado ✓</span>}
                {sendState === 'error' && <span className="text-xs text-red-600">{sendError}</span>}
              </div>
              {showFollowUpPrompt && (
                <div className="rounded-md border border-brand-orange bg-brand-cream p-3 text-xs space-y-2">
                  <p className="text-brand-carbon">Se marcó como Contactado. ¿Programamos un seguimiento?</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => confirmFollowUp(1)}
                      className="rounded-md border border-brand-line px-2 py-1 hover:bg-white"
                    >
                      Mañana
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmFollowUp(3)}
                      className="rounded-md border border-brand-line px-2 py-1 hover:bg-white"
                    >
                      +3 días
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmFollowUp(7)}
                      className="rounded-md border border-brand-line px-2 py-1 hover:bg-white"
                    >
                      +7 días
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFollowUpPrompt(false)}
                      className="rounded-md px-2 py-1 text-brand-gray hover:text-brand-carbon"
                    >
                      No, gracias
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="block text-xs font-medium text-slate-500">Historial de emails</label>
          {emailsLoading && <p className="text-xs text-slate-400">Cargando…</p>}
          {!emailsLoading && (!leadEmails || leadEmails.length === 0) && (
            <p className="text-xs text-slate-400">Todavía no se envió ningún email a este lead.</p>
          )}
          {leadEmails && leadEmails.length > 0 && (
            <ul className="space-y-1.5 max-h-48 overflow-y-auto">
              {leadEmails.map((e) => (
                <li key={e.id} className="text-xs border border-brand-line rounded-md">
                  <button
                    type="button"
                    onClick={() => setExpandedEmailId((cur) => (cur === e.id ? null : e.id))}
                    className="w-full text-left px-2 py-1.5 flex items-center justify-between gap-2 hover:bg-brand-cream"
                  >
                    <span className="truncate text-slate-700">{e.subject}</span>
                    <span className="shrink-0 text-slate-400">{new Date(e.sent_at).toLocaleDateString('es-AR')}</span>
                  </button>
                  {expandedEmailId === e.id && (
                    <div
                      className="px-2 pb-2 border-t border-slate-100 pt-2 text-slate-600 overflow-x-auto"
                      dangerouslySetInnerHTML={{ __html: e.body_html }}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
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
