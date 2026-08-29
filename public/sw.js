const CACHE_NAME = 'skifree-v2-cache-v7';
const ASSETS = [
  '/',
  '/index.html',
  '/landing.html',
  '/manifest.json',
  '/assets/yeti_v2.jpg',
  '/assets/npc_skiers.jpg',
  '/assets/pine_tree.png',
  '/assets/snow_texture.jpg',
  '/assets/ice_texture.jpg',
  '/assets/mountain_horizon.jpg',
  '/assets/media/waltz_on_the_slope.mp3'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/ws') || event.request.url.includes('/api/')) {
    return;
  }
  // Network-first for HTML navigations to prevent stale game builds
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        }
        return networkResponse;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }).catch(() => fetch(event.request))
  );
});
