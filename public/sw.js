const CACHE = 'ace-tennis-v1'

// Cache the app shell on install
self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(['/', '/manifest.json', '/favicon.svg'])
    )
  )
})

// Clean up old caches on activate
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Never intercept Supabase API calls — always go to network
  if (url.hostname.includes('supabase.co')) return

  // For navigation requests (HTML), network-first so updates land immediately
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/'))
    )
    return
  }

  // For static assets — cache first, then network, cache the response
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response
        const clone = response.clone()
        caches.open(CACHE).then(cache => cache.put(e.request, clone))
        return response
      })
    })
  )
})
