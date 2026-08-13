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

export function useAddMemberByEmail(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (email: string) => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', email.trim())
        .maybeSingle()
      if (profileError) throw profileError
      if (!profile) {
        throw new Error('No existe ningún usuario registrado con ese email. Creálo primero desde el dashboard de Supabase (Authentication → Users → Invite).')
      }
      const { error } = await supabase.from('workspace_members').insert({ workspace_id: workspaceId, user_id: profile.id })
      if (error) throw error
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
