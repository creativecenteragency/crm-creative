import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import {
  useInviteMember,
  useRemoveMember,
  useUpdateWorkspace,
  useWorkspace,
  useWorkspaceMembers,
} from '../../hooks/useAdmin'
import { useAuth } from '../../context/AuthContext'
import type { Profile } from '../../types/database'
import WorkspaceFieldMappingSection from '../../components/WorkspaceFieldMappingSection'

export default function WorkspaceSettings() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { data: workspace, isLoading } = useWorkspace(workspaceId)
  const updateWorkspace = useUpdateWorkspace(workspaceId!)
  const { data: members } = useWorkspaceMembers(workspaceId)
  const inviteMember = useInviteMember(workspaceId!)
  const removeMember = useRemoveMember(workspaceId!)
  const { resetPassword } = useAuth()

  const [name, setName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [memberError, setMemberError] = useState<string | null>(null)
  const [memberSuccess, setMemberSuccess] = useState<string | null>(null)
  const [resetInfo, setResetInfo] = useState<{ id: string; ok: boolean; message: string } | null>(null)

  useEffect(() => {
    if (workspace) setName(workspace.name)
  }, [workspace])

  if (isLoading || !workspace) return <div className="p-8 text-sm text-slate-500">Cargando…</div>

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-lead?token=${workspace.webhook_token}`

  async function saveGeneral() {
    await updateWorkspace.mutateAsync({ name })
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

      <WorkspaceFieldMappingSection workspaceId={workspaceId!} />

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
