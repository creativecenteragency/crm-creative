import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { LeadColumnConfig } from '../types/database'

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
