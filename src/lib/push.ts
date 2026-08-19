import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  const base = import.meta.env.BASE_URL
  navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((err) => {
    console.error('No se pudo registrar el service worker', err)
  })
}

// El navegador espera la VAPID key como Uint8Array (base64url -> bytes).
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64Safe)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const base = import.meta.env.BASE_URL
  return (await navigator.serviceWorker.getRegistration(base)) ?? (await navigator.serviceWorker.ready)
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  const registration = await getRegistration()
  return registration.pushManager.getSubscription()
}

export async function subscribeToPush(userId: string, workspaceId: string): Promise<void> {
  if (!VAPID_PUBLIC_KEY) throw new Error('Falta VITE_VAPID_PUBLIC_KEY')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permiso denegado')

  const registration = await getRegistration()
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }))

  const raw = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      workspace_id: workspaceId,
      endpoint: raw.endpoint!,
      p256dh: raw.keys!.p256dh,
      auth: raw.keys!.auth,
    },
    { onConflict: 'user_id,workspace_id,endpoint' }
  )
  if (error) throw error
}

export async function unsubscribeFromPush(userId: string, workspaceId: string): Promise<void> {
  const subscription = await getExistingSubscription()
  if (subscription) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .eq('endpoint', subscription.endpoint)
  }
  // Solo damos de baja la suscripción del navegador si no queda ligada a
  // ningún otro workspace (el usuario podría tener el aviso activo en más de un cliente).
  const { count } = await supabase
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('endpoint', subscription?.endpoint ?? '')
  if (subscription && !count) await subscription.unsubscribe()
}
