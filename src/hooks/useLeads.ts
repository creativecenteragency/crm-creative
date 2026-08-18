import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Lead, LeadRating, LeadStatus } from '../types/database'

export function useLeads(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['leads', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Lead[]
    },
  })
}

export function useUpdateLead(workspaceId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      changes,
    }: {
      id: string
      changes: Partial<Pick<Lead, 'status' | 'rating' | 'is_spam' | 'next_contact_at'>>
    }) => {
      const { error } = await supabase.from('leads').update(changes).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', workspaceId] })
    },
  })
}

export function useDeleteLead(workspaceId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', workspaceId] })
    },
  })
}

export function useBulkDeleteLeads(workspaceId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('leads').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', workspaceId] })
    },
  })
}

export function useBulkUpdateLeads(workspaceId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      ids,
      changes,
    }: {
      ids: string[]
      changes: Partial<Pick<Lead, 'status' | 'rating' | 'is_spam' | 'next_contact_at'>>
    }) => {
      const { error } = await supabase.from('leads').update(changes).in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', workspaceId] })
    },
  })
}

export const STATUS_LABELS: Record<LeadStatus, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  cotizado: 'Cotizado',
  ganado: 'Ganado',
  perdido: 'Perdido',
}

export const STATUS_ORDER: LeadStatus[] = ['nuevo', 'contactado', 'cotizado', 'ganado', 'perdido']

export const RATING_LABELS: Record<LeadRating, string> = {
  bueno: 'Bueno',
  regular: 'Regular',
  malo: 'Malo',
}
