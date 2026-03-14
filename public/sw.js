/* eslint-disable no-restricted-globals */
const CACHE_NAME = 'faiz_taober_v2';

// Static assets to cache
const STATIC_ASSETS = ['/', '/manifest.webmanifest', '/icon-192x192.png', '/icon-512x512.png'];

const shouldHandleRequest = request => {
  if (request.method !== 'GET') {
    return false;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return false;
  }

  if (url.pathname.startsWith('/api/')) {
    return false;
  }

  return true;
};

// Install: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      await Promise.all(
        STATIC_ASSETS.map(async asset => {
          try {
            await cache.add(asset);
          } catch (error) {
            console.warn('Failed to precache asset:', asset, error);
          }
        }),
      );
    })(),
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    }),
  );
  self.clients.claim();
});

// Fetch:
// - navigation requests: cache first + background revalidate
// - other same-origin static requests: stale-while-revalidate
self.addEventListener('fetch', event => {
  if (!shouldHandleRequest(event.request)) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        const appShell = await cache.match('/');
        const networkPromise = fetch(event.request)
          .then(response => {
            if (response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(networkPromise);
          return cached;
        }

        const network = await networkPromise;
        if (network) {
          return network;
        }

        return appShell || Response.error();
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      const networkPromise = fetch(event.request)
        .then(response => {
          if (response.status === 200) {
            cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(networkPromise);
        return cached;
      }

      const network = await networkPromise;
      if (network) {
        return network;
      }

      return Response.error();
    })(),
  );
});
