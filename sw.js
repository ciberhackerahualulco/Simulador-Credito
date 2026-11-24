/* Simulador Credito/EFI - Service Worker v19
 * HTML: network-first; assets locales: stale-while-revalidate.
 * No almacena datos de clientes ni respuestas de servicios externos.
 */
const VERSION = 'v19-20261124';
const CACHE_NAME = `simulador-static-${VERSION}`;
const APP_SHELL = ['./', './index.html', './manifest.json'];
const OPTIONAL_ASSETS = [
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // La instalacion solo requiere que index.html este disponible.
    await cache.add('./index.html');
    await Promise.allSettled([...APP_SHELL, ...OPTIONAL_ASSETS]
      .filter(path => path !== './index.html')
      .map(path => cache.add(path)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('simulador-') && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope);
  if (!url.pathname.startsWith(scope.pathname)) return;

  if (request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const cache = await caches.open(CACHE_NAME);
        await cache.put('./index.html', response.clone());
        return response;
      } catch (_) {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Solo cachear archivos locales definidos, no URL con datos ni parametros.
  const relative = './' + url.pathname.slice(scope.pathname.length);
  if (![...APP_SHELL, ...OPTIONAL_ASSETS].includes(relative)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(relative);
    const refresh = fetch(request).then(response => {
      if (response.ok) event.waitUntil(cache.put(relative, response.clone()));
      return response;
    });
    if (cached) {
      event.waitUntil(refresh.catch(() => {}));
      return cached;
    }
    return refresh.catch(() => Response.error());
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
