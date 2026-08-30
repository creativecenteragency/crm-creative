import { Navigate, useParams } from 'react-router-dom'
import WorkspaceFieldMappingSection from '../components/WorkspaceFieldMappingSection'
import { useMyWorkspaceRole } from '../hooks/useAdmin'

export default function ConfigPage() {
  const { workspaceId } = useParams()
  const { role, isLoading } = useMyWorkspaceRole(workspaceId)
  if (!workspaceId) return null
  if (isLoading) return <div className="p-8 text-sm text-slate-500">Cargando…</div>
  if (role !== 'admin') return <Navigate to={`/w/${workspaceId}/leads`} replace />

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-brand-carbon">Configuración</h1>
        <p className="text-sm text-brand-gray">Mapeo de campos, campos adicionales e importación de leads.</p>
      </div>
      <WorkspaceFieldMappingSection workspaceId={workspaceId} />
    </div>
  )
}
