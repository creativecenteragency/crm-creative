import { useKommoSyncState, useTriggerKommoSync } from '../hooks/useKommoSync'

// Solo se renderiza algo si el workspace tiene una fila en kommo_sync_state
// (hoy: solo Mercator) — para cualquier otro cliente esto no muestra nada.
export default function KommoSyncSection({ workspaceId }: { workspaceId: string }) {
  const { data: state, isLoading } = useKommoSyncState(workspaceId)
  const sync = useTriggerKommoSync(workspaceId)

  if (isLoading || !state) return null

  const lastResult = state.last_result

  return (
    <section className="space-y-3 bg-white border border-brand-line rounded-lg p-4">
      <div>
        <h2 className="text-sm font-semibold text-brand-carbon">Sincronización con Kommo</h2>
        <p className="text-xs text-brand-gray">
          Los leads se traen automáticamente cada 6 horas desde Kommo. Usá este botón para forzar una
          sincronización ahora.
        </p>
      </div>

      <div className="text-sm text-brand-gray space-y-1">
        <p>
          Última corrida:{' '}
          {state.last_synced_at ? (
            <span className="text-brand-carbon font-medium">{new Date(state.last_synced_at).toLocaleString()}</span>
          ) : (
            'todavía no corrió'
          )}
        </p>
        {lastResult && (
          <p>
            Revisados: {lastResult.revisados} — nuevos/actualizados: {lastResult.upserted}
            {lastResult.tope_alcanzado && ' (quedaron más pendientes para la próxima corrida)'}
            {lastResult.errors.length > 0 && (
              <span className="text-red-600"> — errores: {lastResult.errors.join('; ')}</span>
            )}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          className="rounded-md bg-brand-orange text-brand-carbon text-sm font-semibold px-4 py-2 hover:bg-brand-orange-dark disabled:opacity-50"
        >
          {sync.isPending ? 'Sincronizando…' : 'Sincronizar ahora'}
        </button>
        {sync.isSuccess && !sync.isPending && (
          <span className="text-xs text-green-600">
            Listo — {sync.data?.upserted ?? 0} lead(s) nuevos/actualizados.
          </span>
        )}
        {sync.isError && <span className="text-xs text-red-600">No se pudo sincronizar. Probá de nuevo.</span>}
      </div>
    </section>
  )
}
