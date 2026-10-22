// Offline-Modus: online wird immer die neueste Version geladen, ohne Netz die zuletzt gespeicherte.
const CACHE = 'trainingsplaner-v1';
const DATEIEN = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  const netz = fetch(req).then(res => {
    if (res.ok) {
      const kopie = res.clone();
      caches.open(CACHE).then(c => c.put(req, kopie));
    }
    return res;
  });
  // Bei schlechtem Netz (z. B. am Sportplatz) nach 4 Sekunden auf die gespeicherte Version wechseln
  const zeit = new Promise((_, nein) => setTimeout(() => nein(new Error('timeout')), 4000));

  e.respondWith(
    Promise.race([netz, zeit]).catch(() =>
      caches.match(req, { ignoreSearch: true })
        .then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : null))
        .then(r => r || netz)
    )
  );
});
