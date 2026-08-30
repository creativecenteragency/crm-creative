import { useState } from 'react'
import {
  useInviteMember,
  useRemoveMember,
  useUpdateMemberRole,
  useWorkspaceMembers,
  type WorkspaceMemberRow,
} from '../hooks/useAdmin'
import { useAuth } from '../context/AuthContext'
import type { WorkspaceRole } from '../types/database'

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  admin: 'Admin',
  member: 'Usuario',
}

// Sección de gestión de usuarios de un workspace: invitar, ver quién ya
// aceptó la invitación (entró y eligió contraseña) vs. quién sigue
// pendiente, cambiar rol, quitar acceso y restablecer contraseña. La usan
// tanto el panel del master (WorkspaceSettings) como la página "Usuarios"
// visible para los admins del propio workspace — mismo componente en los
// dos contextos, igual que WorkspaceFieldMappingSection.
export default function WorkspaceUsersSection({ workspaceId }: { workspaceId: string }) {
  const { data: members } = useWorkspaceMembers(workspaceId)
  const inviteMember = useInviteMember(workspaceId)
  const updateRole = useUpdateMemberRole(workspaceId)
  const removeMember = useRemoveMember(workspaceId)
  const { resetPassword } = useAuth()

  const [memberEmail, setMemberEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member')
  const [memberError, setMemberError] = useState<string | null>(null)
  const [memberSuccess, setMemberSuccess] = useState<string | null>(null)
  const [resetInfo, setResetInfo] = useState<{ id: string; ok: boolean; message: string } | null>(null)

  async function handleAddMember() {
    setMemberError(null)
    setMemberSuccess(null)
    try {
      const result = await inviteMember.mutateAsync({ email: memberEmail, role: inviteRole })
      setMemberSuccess(
        result?.invited
          ? 'Invitación enviada por email. El usuario va a poder configurar su contraseña desde ahí.'
          : 'Usuario existente asignado al workspace.'
      )
      setMemberEmail('')
      setInviteRole('member')
    } catch (err) {
      setMemberError((err as Error).message)
    }
  }

  async function handleResetPassword(member: WorkspaceMemberRow) {
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
    <section className="space-y-3 bg-white border border-brand-line rounded-lg p-4">
      <div>
        <h2 className="text-sm font-semibold text-brand-carbon">Usuarios con acceso</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Invitá a un usuario por email. "Admin" puede gestionar usuarios, Configuración, Ajustes de marca, importar
          leads por CSV y borrar leads — "Usuario" ve y trabaja los leads sin tocar esa configuración.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={memberEmail}
          onChange={(e) => setMemberEmail(e.target.value)}
          placeholder="email@cliente.com"
          className="flex-1 min-w-40 rounded-md border border-brand-line px-3 py-2 text-sm"
        />
        <select
          value={inviteRole}
          onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
          className="rounded-md border border-brand-line px-3 py-2 text-sm"
        >
          <option value="member">Usuario</option>
          <option value="admin">Admin</option>
        </select>
        <button
          onClick={handleAddMember}
          disabled={inviteMember.isPending || !memberEmail.trim()}
          className="rounded-md bg-brand-orange text-brand-carbon text-sm font-semibold px-4 py-2 hover:bg-brand-orange-dark disabled:opacity-50"
        >
          {inviteMember.isPending ? 'Invitando…' : 'Invitar'}
        </button>
      </div>
      {memberError && <p className="text-sm text-red-600">{memberError}</p>}
      {memberSuccess && <p className="text-sm text-green-600">{memberSuccess}</p>}

      <div className="divide-y divide-slate-100 rounded-lg border border-brand-line">
        {(members ?? []).map((m) => {
          const pending = !m.last_sign_in_at
          return (
            <div key={m.id} className="px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-slate-700 truncate">{m.email ?? m.full_name ?? m.id}</span>
                  <span
                    className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      pending ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {pending ? 'Invitación pendiente' : 'Activo'}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <select
                    value={m.role}
                    onChange={(e) => updateRole.mutate({ userId: m.id, role: e.target.value as WorkspaceRole })}
                    disabled={updateRole.isPending}
                    className="rounded-md border border-brand-line px-2 py-1 text-xs"
                  >
                    {(Object.keys(ROLE_LABELS) as WorkspaceRole[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => handleResetPassword(m)} className="text-xs text-brand-orange hover:underline">
                    Restablecer contraseña
                  </button>
                  <button onClick={() => removeMember.mutate(m.id)} className="text-xs text-red-500 hover:underline">
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
          )
        })}
        {members?.length === 0 && <p className="px-3 py-4 text-sm text-slate-400">Sin usuarios asignados.</p>}
      </div>
    </section>
  )
}
