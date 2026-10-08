// Bump this version whenever HTML, scripts, styles or local images change.
const VERSION = 'v6';
const PREFIX = `urban-style-shell:${self.registration.scope}:`;
const CACHE_NAME = `${PREFIX}${VERSION}`;
const localURL = path => new URL(path, self.registration.scope).href;
const HOME = localURL('index.html');
const MANIFEST = localURL('manifest.webmanifest');
const STATIC_URLS = new Set([
  'assets/styles.css',
  'assets/img/icon-192.png', 'assets/img/icon-512.png',
  'js/app.js', 'js/catalog.js', 'js/cart.js', 'js/storage.js', 'js/validation.js',
  'js/connectivity.js', 'js/pending-purchases.js',
  'js/preferences.js',
  'assets/photos/camiseta.jpg', 'assets/photos/camiseta_negra.jpg',
  'assets/photos/camisa.jpg', 'assets/photos/jeans.jpg',
  'assets/photos/chompa.jpg', 'assets/photos/chaqueta.jpg',
  'assets/photos/gorra.jpg', 'assets/photos/zapatillas.jpg'
].map(localURL));

function cacheable(response) {
  return response.ok && response.type === 'basic' && !response.redirected;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // Consume each body immediately so parallel downloads cannot exhaust connections.
    // Validate the entire public shell before writing it. No catalog or user data.
    const entries = await Promise.all([HOME, MANIFEST, ...STATIC_URLS].map(async url => {
      const response = await fetch(new Request(url, {
        cache: 'reload', credentials: 'omit', signal: AbortSignal.timeout(30000)
      }));
      if (!cacheable(response)) throw new Error(`No se pudo almacenar ${url}`);
      return [url, new Response(await response.arrayBuffer(), {
        status: response.status, statusText: response.statusText, headers: response.headers
      })];
    }));
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(entries.map(([url, response]) => cache.put(url, response)));
    // Updates wait for existing tabs to close, avoiding mixed script versions.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request.url);
  if (cached) return cached;
  const response = await fetch(new Request(request, { credentials: 'omit' }));
  if (cacheable(response)) {
    try { await cache.put(request.url, response.clone()); }
    catch { /* Storage limits must not discard a valid network response. */ }
  }
  return response;
}

async function navigationFirst(request, cacheKey = HOME) {
  try {
    const response = await fetch(new Request(request, {
      credentials: 'omit', cache: 'no-cache', signal: AbortSignal.timeout(5000)
    }));
    if (cacheable(response)) {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(cacheKey, response.clone());
      } catch { /* Navigation still works when storage is unavailable. */ }
      return response;
    }
    return (await caches.match(cacheKey, { cacheName: CACHE_NAME })) || response;
  } catch {
    return (await caches.match(cacheKey, { cacheName: CACHE_NAME })) || Response.error();
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  // Navigation requests can retain fragments, although HTTP never sends them.
  // Match the document URL without changing the request or the page's anchor.
  url.hash = '';
  // Only explicitly listed public GET resources. Query strings, POST, external
  // URLs and products.json pass through; the catalog retains its IndexedDB fallback.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.search ||
      request.headers.has('authorization') || request.headers.has('range')) return;
  if (request.mode === 'navigate' && [localURL(''), HOME].includes(url.href)) {
    event.respondWith(navigationFirst(request));
  } else if (url.href === MANIFEST) {
    event.respondWith(navigationFirst(request, MANIFEST));
  } else if (STATIC_URLS.has(url.href)) {
    event.respondWith(cacheFirst(request));
  }
});
