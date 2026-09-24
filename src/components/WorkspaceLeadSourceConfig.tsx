import { useAuth } from '../context/AuthContext'
import { useUpdateWorkspace, useWorkspace } from '../hooks/useAdmin'
import KommoSyncSection from './KommoSyncSection'
import WorkspaceFieldMappingSection from './WorkspaceFieldMappingSection'

const SOURCE_LABELS = { forminator: 'Formulario web (Forminator)', kommo: 'Kommo' } as const

// Elige de dónde entran los leads de este cliente y muestra solo la
// configuración que corresponde a esa fuente. Forminator y Kommo traen los datos
// de forma distinta (slugs de un formulario vs. campos/etiquetas/embudos de un
// CRM), así que no tiene sentido mostrar el mapeo de una cuando la activa es la otra.
// Compartido entre la Configuración del cliente y el panel del master.
export default function WorkspaceLeadSourceConfig({ workspaceId }: { workspaceId: string }) {
  const { profile } = useAuth()
  const { data: workspace } = useWorkspace(workspaceId)
  const updateWorkspace = useUpdateWorkspace(workspaceId)

  if (!workspace) return null
  const source = workspace.lead_source ?? 'forminator'
  // El UPDATE sobre workspaces es solo del master (RLS): a un admin del cliente
  // se le muestra la fuente pero no puede cambiarla.
  const canChange = !!profile?.is_master

  return (
    <>
      <section className="space-y-2 bg-white border border-brand-line rounded-lg p-4">
        <h2 className="text-sm font-semibold text-brand-carbon">Fuente de los leads</h2>
        {canChange ? (
          <>
            <select
              value={source}
              onChange={(e) => updateWorkspace.mutate({ lead_source: e.target.value as 'forminator' | 'kommo' })}
              disabled={updateWorkspace.isPending}
              className="rounded-md border border-brand-line px-3 py-2 text-sm"
            >
              {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <p className="text-xs text-brand-gray">
              Los leads ya cargados de la otra fuente no se tocan: siguen en la tabla y en Métricas. Esto solo define
              qué configuración se muestra y qué columnas usa la tabla por defecto.
            </p>
          </>
        ) : (
          <p className="text-sm text-brand-carbon">{SOURCE_LABELS[source]}</p>
        )}
      </section>

      {source === 'kommo' ? (
        <>
          <KommoSyncSection workspaceId={workspaceId} />
          <details className="bg-white border border-brand-line rounded-lg">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand-carbon">
              Formulario web (Forminator) — histórico
            </summary>
            <div className="p-4 pt-0 space-y-6">
              <p className="text-xs text-brand-gray">
                Ya no entran leads por acá. Se conserva para interpretar los leads históricos y para importar CSV.
              </p>
              <WorkspaceFieldMappingSection workspaceId={workspaceId} />
            </div>
          </details>
        </>
      ) : (
        <WorkspaceFieldMappingSection workspaceId={workspaceId} />
      )}
    </>
  )
}
