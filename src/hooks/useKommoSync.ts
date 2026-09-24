import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { KommoSyncState } from '../types/database'

// Si existe una fila en kommo_sync_state para este workspace, tiene la
// integración de Kommo habilitada (hoy: solo Mercator) y se muestra el botón
// de sincronizar. Si no existe ninguna, el hook no rompe nada — simplemente
// no hay nada que mostrar.
export function useKommoSyncState(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['kommo-sync-state', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kommo_sync_state')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .maybeSingle()
      if (error) throw error
      return data as KommoSyncState | null
    },
  })
}

export function useTriggerKommoSync(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<{
        ok: boolean
        revisados: number
        upserted: number
        errors: string[]
        tope_alcanzado: boolean
      }>('sync-kommo-leads', { body: {} })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kommo-sync-state', workspaceId] })
      queryClient.invalidateQueries({ queryKey: ['leads', workspaceId] })
    },
  })
}

export function useUpdateKommoValidTags(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (validTags: string[]) => {
      const { error } = await supabase
        .from('kommo_sync_state')
        .update({ valid_tags: validTags })
        .eq('workspace_id', workspaceId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kommo-sync-state', workspaceId] }),
  })
}
