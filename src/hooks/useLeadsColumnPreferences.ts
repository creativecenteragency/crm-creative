import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { LeadColumnConfig, LeadsView } from '../types/database'

export function useLeadsColumnPreferences(workspaceId: string | undefined) {
  const { profile } = useAuth()
  return useQuery({
    queryKey: ['leads-column-preferences', profile?.id, workspaceId],
    enabled: !!workspaceId && !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads_column_preferences')
        .select('columns')
        .eq('user_id', profile!.id)
        .eq('workspace_id', workspaceId!)
        .maybeSingle()
      if (error) throw error
      return (data?.columns ?? null) as LeadColumnConfig[] | null
    },
  })
}

export function useUpdateLeadsColumnPreferences(workspaceId: string | undefined) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (columns: LeadColumnConfig[]) => {
      const { error } = await supabase
        .from('leads_column_preferences')
        .upsert(
          { user_id: profile!.id, workspace_id: workspaceId!, columns, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,workspace_id' }
        )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-column-preferences', profile?.id, workspaceId] })
    },
  })
}

// Vista guardada (filtros + orden) del usuario. Comparte fila con las columnas
// visibles; null = nunca guardó una, se usan los valores por defecto.
export function useLeadsView(workspaceId: string | undefined) {
  const { profile } = useAuth()
  return useQuery({
    queryKey: ['leads-view', profile?.id, workspaceId],
    enabled: !!workspaceId && !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads_column_preferences')
        .select('view')
        .eq('user_id', profile!.id)
        .eq('workspace_id', workspaceId!)
        .maybeSingle()
      if (error) throw error
      return (data?.view ?? null) as LeadsView | null
    },
  })
}

export function useSaveLeadsView(workspaceId: string | undefined) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    // null borra la vista guardada (Restablecer).
    mutationFn: async (view: LeadsView | null) => {
      const { error } = await supabase
        .from('leads_column_preferences')
        .upsert(
          { user_id: profile!.id, workspace_id: workspaceId!, view, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,workspace_id' }
        )
      if (error) throw error
    },
    onSuccess: (_data, view) => {
      queryClient.setQueryData(['leads-view', profile?.id, workspaceId], view)
    },
  })
}
