const CACHE_NAME = 'ski-fr33-phase2-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/yeti_v2.jpg',
  '/bundle.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Ignore non-GET, external API requests, media streaming, and HTTP Range requests
  if (
    e.request.method !== 'GET' ||
    e.request.url.includes('/status') ||
    e.request.url.includes('/api/') ||
    e.request.url.includes('/assets/media/') ||
    e.request.headers.get('range')
  ) {
    return;
  }
  
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(e.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, networkResponse.clone());
          return networkResponse;
        });
      });
    })
  );
});
