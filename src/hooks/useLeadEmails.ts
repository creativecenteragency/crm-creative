import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { LeadEmail } from '../types/database'

export function useLeadEmails(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-emails', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_emails')
        .select('*')
        .eq('lead_id', leadId!)
        .order('sent_at', { ascending: false })
      if (error) throw error
      return data as LeadEmail[]
    },
  })
}

export function useInvalidateLeadEmails() {
  const queryClient = useQueryClient()
  return (leadId: string) => queryClient.invalidateQueries({ queryKey: ['lead-emails', leadId] })
}
