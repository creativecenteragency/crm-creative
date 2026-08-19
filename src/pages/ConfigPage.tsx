import { useParams } from 'react-router-dom'
import WorkspaceFieldMappingSection from '../components/WorkspaceFieldMappingSection'

export default function ConfigPage() {
  const { workspaceId } = useParams()
  if (!workspaceId) return null

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
