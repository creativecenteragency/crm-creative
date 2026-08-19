import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useEmailTemplates, useUpsertEmailTemplate } from '../hooks/useEmailTemplates'
import { useWorkspaceBranding } from '../hooks/useWorkspaceBranding'
import { useWorkspace } from '../hooks/useAdmin'
import { ensureHtml, renderTemplate, wrapBrandedEmail } from '../lib/emailTemplate'
import RichTextEditor from '../components/RichTextEditor'
import type { EmailTemplate, Lead } from '../types/database'

const SLOTS = [1, 2, 3]

const SAMPLE_LEAD = {
  first_name: 'Juan',
  last_name: 'Pérez',
  email: 'juan.perez@ejemplo.com',
  phone: '+54 9 11 1234-5678',
  inquiry_type: 'Curso RCP',
  extra: { company: 'Empresa Ejemplo' },
} as unknown as Lead

export default function TemplatesPage() {
  const { workspaceId } = useParams()
  const { data: templates, isLoading } = useEmailTemplates(workspaceId)
  const { data: branding } = useWorkspaceBranding(workspaceId)
  const { data: workspace } = useWorkspace(workspaceId)
  const upsert = useUpsertEmailTemplate(workspaceId!)

  if (isLoading) return <div className="p-8 text-sm text-slate-500">Cargando plantillas…</div>

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-brand-carbon">Plantillas de email</h1>
        <p className="text-sm text-brand-gray">
          Variables disponibles: {'{{nombre}}'} {'{{apellido}}'} {'{{email}}'} {'{{telefono}}'} {'{{consulta}}'}{' '}
          {'{{empresa}}'}
        </p>
      </div>
      {SLOTS.map((slot) => (
        <TemplateCard
          key={slot}
          slot={slot}
          template={templates?.find((t) => t.slot === slot)}
          workspaceName={workspace?.name ?? ''}
          branding={branding}
          onSave={(name, subject, body) => upsert.mutateAsync({ slot, name, subject, body })}
        />
      ))}
    </div>
  )
}

function TemplateCard({
  slot,
  template,
  workspaceName,
  branding,
  onSave,
}: {
  slot: number
  template?: EmailTemplate
  workspaceName: string
  branding: ReturnType<typeof useWorkspaceBranding>['data']
  onSave: (name: string, subject: string, body: string) => Promise<void>
}) {
  const [name, setName] = useState(template?.name ?? '')
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [body, setBody] = useState(template?.body ?? '')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    setName(template?.name ?? '')
    setSubject(template?.subject ?? '')
    setBody(template?.body ?? '')
    setSaved(false)
  }, [template])

  async function handleSave() {
    setSaving(true)
    await onSave(name || `Plantilla ${slot}`, subject, body)
    setSaving(false)
    setSaved(true)
  }

  const previewHtml = wrapBrandedEmail(ensureHtml(renderTemplate(body, SAMPLE_LEAD)), branding, workspaceName)

  return (
    <section className="space-y-3 bg-white border border-brand-line rounded-lg p-4">
      <h2 className="text-sm font-semibold text-brand-carbon">Plantilla {slot}</h2>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-slate-500">Nombre interno</label>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setSaved(false)
          }}
          placeholder={`Plantilla ${slot}`}
          className="w-full rounded-md border border-brand-line px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-slate-500">Asunto</label>
        <input
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value)
            setSaved(false)
          }}
          placeholder="Ej: Info sobre tu consulta, {{nombre}}"
          className="w-full rounded-md border border-brand-line px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-slate-500">Cuerpo</label>
        <RichTextEditor
          value={body}
          onChange={(html) => {
            setBody(html)
            setSaved(false)
          }}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-brand-orange text-brand-carbon text-sm font-semibold px-4 py-2 hover:bg-brand-orange-dark disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="text-sm text-brand-gray hover:text-brand-carbon underline"
        >
          {showPreview ? 'Ocultar vista previa' : 'Ver vista previa'}
        </button>
        {saved && !saving && <span className="text-xs text-green-600">Guardado ✓</span>}
      </div>
      {showPreview && (
        <div className="border border-brand-line rounded-md bg-brand-cream p-4">
          <p className="text-xs text-slate-400 mb-2">
            Así se ve con un lead de ejemplo (Juan Pérez). El logo, color y firma salen de{' '}
            <span className="font-medium">Ajustes</span>.
          </p>
          <div className="bg-white rounded-md p-2" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      )}
    </section>
  )
}
