import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Profile, Workspace, WorkspaceField } from '../types/database'

export function useAllWorkspaces() {
  return useQuery({
    queryKey: ['admin', 'workspaces'],
    queryFn: async () => {
      const { data, error } = await supabase.from('workspaces').select('*').order('name')
      if (error) throw error
      return data as Workspace[]
    },
  })
}

export function useWorkspace(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'workspace', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase.from('workspaces').select('*').eq('id', workspaceId!).single()
      if (error) throw error
      return data as Workspace
    },
  })
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const slug = slugify(name)
      const { data, error } = await supabase
        .from('workspaces')
        .insert({ name, slug })
        .select()
        .single()
      if (error) throw error
      return data as Workspace
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'workspaces'] }),
  })
}

export function useUpdateWorkspace(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (changes: Partial<Workspace>) => {
      const { error } = await supabase.from('workspaces').update(changes).eq('id', workspaceId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'workspace', workspaceId] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'workspaces'] })
    },
  })
}

// A diferencia de useUpdateWorkspace (UPDATE directo, solo funciona para el master
// por RLS), este hook llama a un RPC que solo toca field_mapping y funciona tanto
// para master como para miembros del workspace.
export function useUpdateWorkspaceFieldMapping(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fieldMapping: Record<string, string>) => {
      const { error } = await supabase.rpc('update_workspace_field_mapping', {
        p_workspace_id: workspaceId,
        p_field_mapping: fieldMapping,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'workspace', workspaceId] })
    },
  })
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (workspaceId: string) => {
      const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'workspaces'] }),
  })
}

export function useWorkspaceFields(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'workspace-fields', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspace_fields')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .order('sort_order')
      if (error) throw error
      return data as WorkspaceField[]
    },
  })
}

export function useUpsertWorkspaceField(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (field: Partial<WorkspaceField> & { key: string; label: string; field_type: WorkspaceField['field_type'] }) => {
      const { error } = await supabase
        .from('workspace_fields')
        .upsert({ ...field, workspace_id: workspaceId }, { onConflict: 'workspace_id,key' })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'workspace-fields', workspaceId] }),
  })
}

export function useDeleteWorkspaceField(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (key: string) => {
      const { error } = await supabase
        .from('workspace_fields')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('key', key)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'workspace-fields', workspaceId] }),
  })
}

export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'workspace-members', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('workspace_id, user_id, created_at, profiles(*)')
        .eq('workspace_id', workspaceId!)
      if (error) throw error
      return (data ?? []).map((row: any) => row.profiles as Profile)
    },
  })
}

export function useInviteMember(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke<{ ok: boolean; invited: boolean }>('invite-user', {
        body: { email: email.trim(), workspace_id: workspaceId },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'workspace-members', workspaceId] }),
  })
}

export function useRemoveMember(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'workspace-members', workspaceId] }),
  })
}
