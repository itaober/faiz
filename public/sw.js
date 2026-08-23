const CACHE_NAME = 'faiz_taober_v3';

const STATIC_ASSETS = ['/manifest.webmanifest', '/icon-192x192.png', '/icon-512x512.png'];
const STATIC_DESTINATIONS = new Set(['style', 'script', 'font']);
const STATIC_PATH_PREFIXES = ['/_next/static/'];
const STATIC_IMAGE_PATH_PATTERN =
  /^\/(?:icon-\d+x\d+|favicon(?:-\d+x\d+)?|apple-touch-icon(?:-\d+x\d+)?)(?:\.[a-z0-9]+)?$/i;

/**
 * Content-hashed build output: the URL changes whenever the bytes do, so a
 * cache hit can never be stale and revalidating it is pure waste.
 */
const isImmutableAsset = url => url.pathname.startsWith('/_next/static/');

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

  if (request.mode === 'navigate' || request.destination === 'document') {
    return false;
  }

  if (STATIC_ASSETS.includes(url.pathname)) {
    return true;
  }

  if (STATIC_PATH_PREFIXES.some(prefix => url.pathname.startsWith(prefix))) {
    return true;
  }

  if (STATIC_DESTINATIONS.has(request.destination)) {
    return true;
  }

  return request.destination === 'image' && STATIC_IMAGE_PATH_PATTERN.test(url.pathname);
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
// - content-hashed build output (/_next/static/): cache-first
// - other static assets: stale-while-revalidate
// - navigations/documents/data requests: bypass SW cache and use normal network/cache
self.addEventListener('fetch', event => {
  if (!shouldHandleRequest(event.request)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);

      // Hashed assets are cache-first: returning the hit without a background
      // refetch saves a request per asset on every repeat visit.
      if (cached && isImmutableAsset(new URL(event.request.url))) {
        return cached;
      }

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
