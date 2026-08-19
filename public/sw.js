// Service worker mínimo: solo existe para poder recibir Web Push y abrir el
// CRM al hacer click en la notificación. No hace precaching ni maneja modo
// offline (no es el objetivo de esta PWA).

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = { title: 'CRM Creative', body: 'Tenés novedades.', url: './' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    // payload no era JSON, usamos los defaults
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './favicon.png',
      badge: './favicon.png',
      data: { url: data.url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url ?? './', self.registration.scope).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === targetUrl && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    })
  )
})
