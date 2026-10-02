/* ============================================================
   Service Worker — Simulador Crédito/EFI Pro v17.5
   Estrategia:
   - Assets locales (HTML, icons, manifest) → cache-first
   - CDNs externos (fonts, librerías) → network-first con fallback
   ============================================================ */

const VERSION = 'v17.5';
const CACHE_STATIC  = `simulador-static-${VERSION}`;
const CACHE_RUNTIME = `simulador-runtime-${VERSION}`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

/* --- INSTALL: precachear estáticos --- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

/* --- ACTIVATE: limpiar cachés viejos --- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_RUNTIME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* --- FETCH --- */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // CDN externo → network-first
  if (url.origin !== location.origin) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_RUNTIME).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Local → cache-first
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_STATIC).then(c => c.put(req, copy)).catch(() => {});
        return res;
      });
    }).catch(() => caches.match('./index.html'))
  );
});

/* --- Mensaje para forzar actualización --- */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});