import { useEffect, useState, type ReactNode } from 'react'
import {
  useDeleteWorkspaceField,
  useUpdateWorkspaceFieldMapping,
  useUpsertWorkspaceField,
  useWorkspace,
  useWorkspaceFields,
} from '../hooks/useAdmin'
import type { FieldType } from '../types/database'
import CsvImportSection from '../pages/admin/CsvImportSection'

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

// Secciones de mapeo de campos y campos adicionales, compartidas entre el
// panel de administración del master (WorkspaceSettings) y la página de
// Configuración visible para los miembros del workspace. El guardado del
// mapeo usa el RPC update_workspace_field_mapping (no un UPDATE directo de
// `workspaces`) para que funcione tanto para master como para clientes.
export default function WorkspaceFieldMappingSection({ workspaceId }: { workspaceId: string }) {
  const { data: workspace, isLoading } = useWorkspace(workspaceId)
  const updateFieldMapping = useUpdateWorkspaceFieldMapping(workspaceId)
  const { data: fields } = useWorkspaceFields(workspaceId)
  const upsertField = useUpsertWorkspaceField(workspaceId)
  const deleteField = useDeleteWorkspaceField(workspaceId)

  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [inquiryOptions, setInquiryOptions] = useState('')
  const [customFields, setCustomFields] = useState<CustomFieldRow[]>([])
  const [initialCustomKeys, setInitialCustomKeys] = useState<string[]>([])
  const [customFieldsSaving, setCustomFieldsSaving] = useState(false)
  const [customFieldsSaved, setCustomFieldsSaved] = useState(false)

  useEffect(() => {
    if (workspace) setMapping(workspace.field_mapping ?? {})
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

  if (isLoading || !workspace) return <div className="p-4 text-sm text-slate-500">Cargando…</div>

  function updateMappingKey(key: string, slug: string) {
    setMapping((prev) => ({ ...prev, [key]: slug }))
  }

  async function saveMapping() {
    await updateFieldMapping.mutateAsync(mapping)
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
    await updateFieldMapping.mutateAsync(newMapping)

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

  return (
    <div className="space-y-8">
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
        <CsvImportSection workspaceId={workspaceId} />
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
