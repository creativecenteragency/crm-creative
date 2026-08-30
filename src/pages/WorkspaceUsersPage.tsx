import { Navigate, useParams } from 'react-router-dom'
import { useMyWorkspaceRole } from '../hooks/useAdmin'
import WorkspaceUsersSection from '../components/WorkspaceUsersSection'

// Visible en el menú de cada workspace solo para su admin (ver Layout). Un
// "Usuario común" que llegue a esta URL a mano se redirige — la RLS de
// workspace_members igual le impediría cambiar algo, esto es solo para no
// mostrarle una pantalla que no puede usar.
export default function WorkspaceUsersPage() {
  const { workspaceId } = useParams()
  const { role, isLoading } = useMyWorkspaceRole(workspaceId)

  if (!workspaceId) return null
  if (isLoading) return <div className="p-8 text-sm text-slate-500">Cargando…</div>
  if (role !== 'admin') return <Navigate to={`/w/${workspaceId}/leads`} replace />

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-brand-carbon">Usuarios</h1>
        <p className="text-sm text-brand-gray">Quién tiene acceso a este CRM y con qué rol.</p>
      </div>
      <WorkspaceUsersSection workspaceId={workspaceId} />
    </div>
  )
}
