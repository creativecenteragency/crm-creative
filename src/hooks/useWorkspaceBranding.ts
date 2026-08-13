import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { WorkspaceBranding } from '../types/database'

export function useWorkspaceBranding(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['workspace-branding', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspace_branding')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .maybeSingle()
      if (error) throw error
      return data as WorkspaceBranding | null
    },
  })
}

export function useUpdateWorkspaceBranding(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (changes: Partial<Omit<WorkspaceBranding, 'workspace_id' | 'updated_at'>>) => {
      const { error } = await supabase
        .from('workspace_branding')
        .upsert({ ...changes, workspace_id: workspaceId }, { onConflict: 'workspace_id' })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace-branding', workspaceId] }),
  })
}
