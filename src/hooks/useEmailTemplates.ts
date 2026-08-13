import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { EmailTemplate } from '../types/database'

export function useEmailTemplates(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['email-templates', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .order('slot')
      if (error) throw error
      return data as EmailTemplate[]
    },
  })
}

export function useUpsertEmailTemplate(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (tpl: { slot: number; name: string; subject: string; body: string }) => {
      const { error } = await supabase
        .from('email_templates')
        .upsert({ ...tpl, workspace_id: workspaceId }, { onConflict: 'workspace_id,slot' })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-templates', workspaceId] }),
  })
}
