/* Cache only a public offline page and immutable frontend assets. */
const CACHE_PREFIX = 'cinecompass-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const OFFLINE_URL = '/offline.html';
const OFFLINE_ASSETS = [OFFLINE_URL, '/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_ASSETS)));
  // Let existing windows finish using their current version before activating.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request, { cache: 'no-store' }).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(OFFLINE_URL) || Response.error();
    }));
    return;
  }

  // CRA names production assets by content hash. Never cache HTML or API responses.
  if (!/^\/static\/(js|css)\/[^/]+\.[a-f0-9]{8}\.(js|css)$/.test(url.pathname)) return;
  event.respondWith((async () => {
    let cache;
    try {
      cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
    } catch { /* Storage restrictions must not block the online app. */ }
    const response = await fetch(request);
    if (cache && response.ok && response.type === 'basic') {
      try {
        await cache.put(request, response.clone());
        const keys = await cache.keys();
        const assets = keys.filter(key => new URL(key.url).pathname.startsWith('/static/'));
        await Promise.all(assets.slice(0, Math.max(0, assets.length - 20)).map(key => cache.delete(key)));
      } catch { /* A full cache still allows this network response through. */ }
    }
    return response;
  })());
});
