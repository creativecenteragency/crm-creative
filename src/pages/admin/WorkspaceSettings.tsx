import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import {
  useDeleteWorkspaceField,
  useInviteMember,
  useRemoveMember,
  useUpdateWorkspace,
  useUpsertWorkspaceField,
  useWorkspace,
  useWorkspaceFields,
  useWorkspaceMembers,
} from '../../hooks/useAdmin'
import { useAuth } from '../../context/AuthContext'
import type { FieldType, Profile } from '../../types/database'
import CsvImportSection from './CsvImportSection'

const CORE_KEYS: { key: string; label: string }[] = [
  { key: 'first_name', label: 'Nombre' },
  { key: 'last_name', label: 'Apellido' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'inquiry_type', label: 'Tipo de consulta (select)' },
  { key: 'message', label: 'Mensaje' },
]

type CustomFieldRow = {
  key: string
  label: string
  field_type: FieldType
  optionsText: string
  slug: string
}

const EMPTY_CUSTOM_FIELD: CustomFieldRow = { key: '', label: '', field_type: 'text', optionsText: '', slug: '' }

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Texto',
  textarea: 'Texto largo',
  select: 'Select',
  checkbox: 'Checkbox',
}

export default function WorkspaceSettings() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { data: workspace, isLoading } = useWorkspace(workspaceId)
  const updateWorkspace = useUpdateWorkspace(workspaceId!)
  const { data: fields } = useWorkspaceFields(workspaceId)
  const upsertField = useUpsertWorkspaceField(workspaceId!)
  const deleteField = useDeleteWorkspaceField(workspaceId!)
  const { data: members } = useWorkspaceMembers(workspaceId)
  const inviteMember = useInviteMember(workspaceId!)
  const removeMember = useRemoveMember(workspaceId!)
  const { resetPassword } = useAuth()

  const [name, setName] = useState('')
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [inquiryOptions, setInquiryOptions] = useState('')
  const [customFields, setCustomFields] = useState<CustomFieldRow[]>([])
  const [initialCustomKeys, setInitialCustomKeys] = useState<string[]>([])
  const [customFieldsSaving, setCustomFieldsSaving] = useState(false)
  const [customFieldsSaved, setCustomFieldsSaved] = useState(false)
  const [memberEmail, setMemberEmail] = useState('')
  const [memberError, setMemberError] = useState<string | null>(null)
  const [memberSuccess, setMemberSuccess] = useState<string | null>(null)
  const [resetInfo, setResetInfo] = useState<{ id: string; ok: boolean; message: string } | null>(null)

  useEffect(() => {
    if (workspace) {
      setName(workspace.name)
      setMapping(workspace.field_mapping ?? {})
    }
  }, [workspace])

  useEffect(() => {
    const inquiryField = fields?.find((f) => f.key === 'inquiry_type')
    setInquiryOptions((inquiryField?.options ?? []).join(', '))
  }, [fields])

  // Un "campo adicional" combina dos fuentes: su definición (tipo, opciones)
  // vive en workspace_fields, y su slug de Forminator vive en field_mapping.
  // Acá las juntamos en una sola fila editable por campo.
  useEffect(() => {
    if (!workspace || !fields) return
    const wsMapping = workspace.field_mapping ?? {}
    const keys = new Set<string>()
    fields.forEach((f) => {
      if (f.key !== 'inquiry_type') keys.add(f.key)
    })
    Object.keys(wsMapping).forEach((k) => {
      if (!CORE_KEYS.some((c) => c.key === k)) keys.add(k)
    })
    const rows: CustomFieldRow[] = [...keys].map((key) => {
      const f = fields.find((x) => x.key === key)
      return {
        key,
        label: f?.label ?? key,
        field_type: f?.field_type ?? 'text',
        optionsText: (f?.options ?? []).join(', '),
        slug: wsMapping[key] ?? '',
      }
    })
    setCustomFields(rows)
    setInitialCustomKeys([...keys])
    setCustomFieldsSaved(false)
  }, [workspace, fields])

  if (isLoading || !workspace) return <div className="p-8 text-sm text-slate-500">Cargando…</div>

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-lead?token=${workspace.webhook_token}`

  function updateMappingKey(key: string, slug: string) {
    setMapping((prev) => ({ ...prev, [key]: slug }))
  }

  async function saveGeneral() {
    await updateWorkspace.mutateAsync({ name })
  }

  async function saveMapping() {
    await updateWorkspace.mutateAsync({ field_mapping: mapping })
  }

  function updateCustomField(index: number, changes: Partial<CustomFieldRow>) {
    setCustomFields((prev) => prev.map((row, i) => (i === index ? { ...row, ...changes } : row)))
    setCustomFieldsSaved(false)
  }

  function addCustomField() {
    setCustomFields((prev) => [...prev, { ...EMPTY_CUSTOM_FIELD }])
  }

  function removeCustomFieldRow(index: number) {
    setCustomFields((prev) => prev.filter((_, i) => i !== index))
    setCustomFieldsSaved(false)
  }

  async function saveCustomFields() {
    setCustomFieldsSaving(true)
    const validRows = customFields.filter((r) => r.key.trim())
    const currentKeys = new Set(validRows.map((r) => r.key.trim()))

    for (const row of validRows) {
      const key = row.key.trim()
      const needsOptions = row.field_type === 'select' || row.field_type === 'checkbox'
      const options = needsOptions
        ? row.optionsText.split(',').map((o) => o.trim()).filter(Boolean)
        : null
      await upsertField.mutateAsync({ key, label: row.label.trim() || key, field_type: row.field_type, options })
    }

    for (const oldKey of initialCustomKeys) {
      if (!currentKeys.has(oldKey)) await deleteField.mutateAsync(oldKey)
    }

    const newMapping: Record<string, string> = { ...mapping }
    for (const oldKey of initialCustomKeys) {
      if (!currentKeys.has(oldKey)) delete newMapping[oldKey]
    }
    for (const row of validRows) {
      const key = row.key.trim()
      if (row.slug.trim()) newMapping[key] = row.slug.trim()
      else delete newMapping[key]
    }
    await updateWorkspace.mutateAsync({ field_mapping: newMapping })

    setCustomFieldsSaving(false)
    setCustomFieldsSaved(true)
  }

  async function saveInquiryOptions() {
    const options = inquiryOptions
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
    await upsertField.mutateAsync({ key: 'inquiry_type', label: 'Tipo de consulta', field_type: 'select', options })
  }

  async function handleAddMember() {
    setMemberError(null)
    setMemberSuccess(null)
    try {
      const result = await inviteMember.mutateAsync(memberEmail)
      setMemberSuccess(
        result?.invited
          ? 'Invitación enviada por email. El usuario va a poder configurar su contraseña desde ahí.'
          : 'Usuario existente asignado al workspace.'
      )
      setMemberEmail('')
    } catch (err) {
      setMemberError((err as Error).message)
    }
  }

  async function handleResetPassword(member: Profile) {
    if (!member.email) return
    setResetInfo(null)
    const { error } = await resetPassword(member.email)
    setResetInfo({
      id: member.id,
      ok: !error,
      message: error ?? 'Le enviamos un email para elegir una contraseña nueva.',
    })
  }

  return (
    <div className="p-6 max-w-3xl space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-brand-carbon">{workspace.name}</h1>
        <p className="text-sm text-slate-400">/{workspace.slug}</p>
      </div>

      <Section title="General">
        <Field label="Nombre">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-brand-line px-3 py-2 text-sm"
          />
        </Field>
        <p className="text-xs text-slate-400">
          El logo, color institucional y firma se configuran en "Ajustes" (visible en el menú de este workspace).
        </p>
        <button
          onClick={saveGeneral}
          className="rounded-md bg-brand-orange text-brand-carbon text-sm font-semibold px-4 py-2 hover:bg-brand-orange-dark"
        >
          Guardar
        </button>
      </Section>

      <Section title="Webhook de Forminator" description="Pegá esta URL en el webhook de Forminator para que los leads entren directo al CRM.">
        <div className="flex gap-2">
          <input readOnly value={webhookUrl} className="flex-1 rounded-md border border-brand-line px-3 py-2 text-xs font-mono bg-brand-cream" />
          <button
            onClick={() => navigator.clipboard.writeText(webhookUrl)}
            className="rounded-md border border-brand-line px-3 py-2 text-sm hover:bg-brand-cream"
          >
            Copiar
          </button>
        </div>
      </Section>

      <Section
        title="Mapeo de campos"
        description="Indicá qué slug de Forminator corresponde a cada campo básico del CRM."
      >
        <div className="space-y-2">
          {CORE_KEYS.map(({ key, label }) => (
            <div key={key} className="grid grid-cols-2 gap-2 items-center">
              <label className="text-sm text-slate-600">{label}</label>
              <input
                value={mapping[key] ?? ''}
                onChange={(e) => updateMappingKey(key, e.target.value)}
                placeholder="ej: name-1"
                className="rounded-md border border-brand-line px-3 py-1.5 text-sm font-mono"
              />
            </div>
          ))}
        </div>

        <button
          onClick={saveMapping}
          className="rounded-md bg-brand-orange text-brand-carbon text-sm font-semibold px-4 py-2 hover:bg-brand-orange-dark"
        >
          Guardar mapeo
        </button>
      </Section>

      <Section
        title="Campos adicionales"
        description="Campos propios de este formulario que no son los básicos de arriba: selects, checkboxes, texto libre, etc. Quedan visibles en la ficha de cada lead."
      >
        <div className="space-y-3">
          {customFields.map((row, i) => (
            <div key={i} className="rounded-md border border-brand-line p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={row.key}
                  onChange={(e) => updateCustomField(i, { key: e.target.value })}
                  placeholder="nombre interno (ej: como_te_enteraste)"
                  className="rounded-md border border-brand-line px-3 py-1.5 text-sm font-mono"
                />
                <input
                  value={row.label}
                  onChange={(e) => updateCustomField(i, { label: e.target.value })}
                  placeholder="etiqueta (ej: ¿Cómo te enteraste?)"
                  className="rounded-md border border-brand-line px-3 py-1.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={row.field_type}
                  onChange={(e) => updateCustomField(i, { field_type: e.target.value as FieldType })}
                  className="rounded-md border border-brand-line px-3 py-1.5 text-sm"
                >
                  {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
                    <option key={t} value={t}>
                      {FIELD_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                <input
                  value={row.slug}
                  onChange={(e) => updateCustomField(i, { slug: e.target.value })}
                  placeholder="slug de Forminator"
                  className="rounded-md border border-brand-line px-3 py-1.5 text-sm font-mono"
                />
              </div>
              {(row.field_type === 'select' || row.field_type === 'checkbox') && (
                <input
                  value={row.optionsText}
                  onChange={(e) => updateCustomField(i, { optionsText: e.target.value })}
                  placeholder="Opciones separadas por coma: Curso A, Curso B"
                  className="w-full rounded-md border border-brand-line px-3 py-1.5 text-sm"
                />
              )}
              <button onClick={() => removeCustomFieldRow(i)} className="text-xs text-red-500 hover:underline">
                quitar campo
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addCustomField}
          className="rounded-md border border-brand-line px-3 py-1.5 text-sm hover:bg-brand-cream"
        >
          + Agregar campo
        </button>

        <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
          <button
            onClick={saveCustomFields}
            disabled={customFieldsSaving}
            className="rounded-md bg-brand-orange text-brand-carbon text-sm font-semibold px-4 py-2 hover:bg-brand-orange-dark disabled:opacity-50"
          >
            {customFieldsSaving ? 'Guardando…' : 'Guardar campos adicionales'}
          </button>
          {customFieldsSaved && !customFieldsSaving && <span className="text-xs text-green-600">Guardado ✓</span>}
        </div>
      </Section>

      <Section
        title="Importar leads (CSV)"
        description="Subí un CSV con leads históricos, mapeá las columnas y confirmá para cargarlos a este workspace."
      >
        <CsvImportSection workspaceId={workspaceId!} />
      </Section>

      <Section
        title="Opciones del select 'Tipo de consulta'"
        description="Separadas por coma, tal como aparecen en el formulario."
      >
        <input
          value={inquiryOptions}
          onChange={(e) => setInquiryOptions(e.target.value)}
          placeholder="Cursos, Equipos DEA"
          className="w-full rounded-md border border-brand-line px-3 py-2 text-sm"
        />
        <button
          onClick={saveInquiryOptions}
          className="rounded-md bg-brand-orange text-brand-carbon text-sm font-semibold px-4 py-2 hover:bg-brand-orange-dark"
        >
          Guardar opciones
        </button>
      </Section>

      <Section
        title="Usuarios con acceso"
        description="Invitá a un usuario por email. Si no tiene cuenta todavía, le llega un mail para crear su contraseña."
      >
        <div className="flex gap-2">
          <input
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
            placeholder="email@cliente.com"
            className="flex-1 rounded-md border border-brand-line px-3 py-2 text-sm"
          />
          <button
            onClick={handleAddMember}
            disabled={inviteMember.isPending}
            className="rounded-md bg-brand-orange text-brand-carbon text-sm font-semibold px-4 py-2 hover:bg-brand-orange-dark disabled:opacity-50"
          >
            {inviteMember.isPending ? 'Invitando…' : 'Invitar'}
          </button>
        </div>
        {memberError && <p className="text-sm text-red-600">{memberError}</p>}
        {memberSuccess && <p className="text-sm text-green-600">{memberSuccess}</p>}

        <div className="divide-y divide-slate-100 rounded-lg border border-brand-line">
          {(members ?? []).map((m) => (
            <div key={m.id} className="px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700">{m.email ?? m.full_name ?? m.id}</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleResetPassword(m)}
                    className="text-xs text-brand-orange hover:underline"
                  >
                    Restablecer contraseña
                  </button>
                  <button
                    onClick={() => removeMember.mutate(m.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    quitar
                  </button>
                </div>
              </div>
              {resetInfo?.id === m.id && (
                <p className={`text-xs mt-1 ${resetInfo.ok ? 'text-green-600' : 'text-red-600'}`}>
                  {resetInfo.message}
                </p>
              )}
            </div>
          ))}
          {members?.length === 0 && <p className="px-3 py-4 text-sm text-slate-400">Sin usuarios asignados.</p>}
        </div>
      </Section>
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3 bg-white border border-brand-line rounded-lg p-4">
      <div>
        <h2 className="text-sm font-semibold text-brand-carbon">{title}</h2>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm text-slate-600">{label}</label>
      {children}
    </div>
  )
}
