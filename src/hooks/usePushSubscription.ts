import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { getExistingSubscription, isPushSupported, subscribeToPush, unsubscribeFromPush } from '../lib/push'
import { supabase } from '../lib/supabase'

export function usePushSubscription(workspaceId: string | undefined) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = ['push-subscription', profile?.id, workspaceId]

  const query = useQuery({
    queryKey,
    enabled: !!workspaceId && !!profile?.id && isPushSupported(),
    queryFn: async () => {
      const subscription = await getExistingSubscription()
      if (!subscription) return false
      const { data } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', profile!.id)
        .eq('workspace_id', workspaceId!)
        .eq('endpoint', subscription.endpoint)
        .maybeSingle()
      return !!data
    },
  })

  const subscribe = useMutation({
    mutationFn: async () => {
      if (!profile?.id || !workspaceId) throw new Error('Falta sesión o workspace')
      await subscribeToPush(profile.id, workspaceId)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const unsubscribe = useMutation({
    mutationFn: async () => {
      if (!profile?.id || !workspaceId) throw new Error('Falta sesión o workspace')
      await unsubscribeFromPush(profile.id, workspaceId)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return {
    isSupported: isPushSupported(),
    isSubscribed: query.data ?? false,
    isLoading: query.isLoading,
    subscribe,
    unsubscribe,
  }
}
