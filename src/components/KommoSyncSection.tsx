import { useEffect, useState } from 'react'
import { useKommoSyncState, useTriggerKommoSync, useUpdateKommoValidTags } from '../hooks/useKommoSync'

// Cómo se traduce cada dato de Kommo a un campo del CRM. Es informativo: el
// mapeo vive en la Edge Function sync-kommo-leads (Kommo no manda "slugs" de
// formulario como Forminator, así que no hay nada que el usuario tenga que
// completar acá).
const KOMMO_MAPPING: { kommo: string; crm: string }[] = [
  { kommo: 'Nombre del lead (o del contacto si es "Lead #número")', crm: 'Nombre' },
  { kommo: 'Contacto principal → Teléfono / Email', crm: 'Contacto' },
  { kommo: 'Origen de la conversación (WhatsApp Business, WhatsApp Lite…)', crm: 'Fuente' },
  { kommo: 'Etiquetas', crm: 'Etiquetas (definen si cuenta para métricas)' },
  { kommo: 'Embudo y etapa', crm: 'Embudo / Etapa' },
  { kommo: 'CUIT, empresa', crm: 'CUIT / Empresa' },
]

// Solo se renderiza algo si el workspace tiene una fila en kommo_sync_state
// (hoy: solo Mercator) — para cualquier otro cliente esto no muestra nada.
export default function KommoSyncSection({ workspaceId }: { workspaceId: string }) {
  const { data: state, isLoading } = useKommoSyncState(workspaceId)
  const sync = useTriggerKommoSync(workspaceId)
  const updateTags = useUpdateKommoValidTags(workspaceId)
  const [tagsText, setTagsText] = useState('')
  const [tagsSaved, setTagsSaved] = useState(false)

  useEffect(() => {
    if (state) setTagsText((state.valid_tags ?? []).join(', '))
  }, [state])

  if (isLoading || !state) return null

  const lastResult = state.last_result

  async function saveTags() {
    const tags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    await updateTags.mutateAsync(tags)
    setTagsSaved(true)
  }

  return (
    <section className="space-y-4 bg-white border border-brand-line rounded-lg p-4">
      <div>
        <h2 className="text-sm font-semibold text-brand-carbon">Kommo</h2>
        <p className="text-xs text-brand-gray">
          Los leads se traen automáticamente cada 6 horas. Usá el botón para forzar una sincronización ahora.
        </p>
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-medium text-slate-500">Qué dato de Kommo va a cada campo</h3>
        <table className="w-full text-xs">
          <tbody>
            {KOMMO_MAPPING.map((row) => (
              <tr key={row.kommo} className="border-t border-brand-line">
                <td className="py-1.5 pr-3 text-brand-gray">{row.kommo}</td>
                <td className="py-1.5 text-brand-carbon font-medium">{row.crm}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-slate-500">Etiquetas válidas para métricas</label>
        <p className="text-xs text-brand-gray">
          Se importan <span className="font-medium">todos</span> los leads de Kommo. Los que no tengan ninguna de estas
          etiquetas se muestran marcados y no cuentan en Métricas. Separalas con coma.
        </p>
        <div className="flex gap-2">
          <input
            value={tagsText}
            onChange={(e) => {
              setTagsText(e.target.value)
              setTagsSaved(false)
            }}
            placeholder="Formulario, Pauta-Directo"
            className="flex-1 rounded-md border border-brand-line px-3 py-2 text-sm"
          />
          <button
            onClick={saveTags}
            disabled={updateTags.isPending}
            className="rounded-md border border-brand-line px-3 py-2 text-sm hover:bg-brand-cream disabled:opacity-50"
          >
            {updateTags.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
        {tagsSaved && !updateTags.isPending && <p className="text-xs text-green-600">Guardado ✓</p>}
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
