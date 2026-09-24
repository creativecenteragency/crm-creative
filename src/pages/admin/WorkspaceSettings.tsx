import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useUpdateWorkspace, useWorkspace } from '../../hooks/useAdmin'
import WorkspaceUsersSection from '../../components/WorkspaceUsersSection'
import WorkspaceLeadSourceConfig from '../../components/WorkspaceLeadSourceConfig'

export default function WorkspaceSettings() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { data: workspace, isLoading } = useWorkspace(workspaceId)
  const updateWorkspace = useUpdateWorkspace(workspaceId!)

  const [name, setName] = useState('')

  useEffect(() => {
    if (workspace) setName(workspace.name)
  }, [workspace])

  if (isLoading || !workspace) return <div className="p-8 text-sm text-slate-500">Cargando…</div>

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-lead?token=${workspace.webhook_token}`

  async function saveGeneral() {
    await updateWorkspace.mutateAsync({ name })
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

      {workspace.lead_source !== 'kommo' && (
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
      )}

      <WorkspaceLeadSourceConfig workspaceId={workspaceId!} />

      <WorkspaceUsersSection workspaceId={workspaceId!} />
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
