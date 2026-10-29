/* EbeApp Service Worker – robustes Offline-Verhalten und kontrollierte Updates. */
const CACHE_PREFIX = 'ebeapp-static-';
const CACHE = `${CACHE_PREFIX}v3`;
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Die App selbst ist Pflicht; fehlt ein Symbol oder das Manifest, soll der Offline-Modus trotzdem starten.
    await cache.add(new Request('./index.html', { cache: 'reload' }));
    await Promise.all(APP_SHELL.filter(p => p !== './index.html')
      .map(p => cache.add(new Request(p, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => (key.startsWith(CACHE_PREFIX) || key === 'trainingsplaner-v1') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Navigations: Netzwerk zuerst, aber nach kurzer Wartezeit zuverlässig aus Cache laden.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      let timeoutId;
      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('network-timeout')), 3500);
      });
      try {
        const response = await Promise.race([fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' }), timeout]);
        clearTimeout(timeoutId);
        if (response && response.ok) cache.put('./index.html', response.clone()).catch(() => {});
        return response;
      } catch (_) {
        clearTimeout(timeoutId);
        return (await cache.match(request)) || (await cache.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Statische App-Dateien: Netzwerk bevorzugen, bei Offline-Betrieb Cache verwenden.
  if (APP_SHELL.some(path => new URL(path, self.registration.scope).pathname === url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request, { cache: 'no-cache' });
        if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
        return response;
      } catch (_) {
        return (await cache.match(request, { ignoreSearch: true })) || Response.error();
      }
    })());
  }
});
