// Offline cache for Europa 1444. Bump CACHE when shipping a new build.
const CACHE = 'europa1444-v2';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/main.js',
  'js/ui.js',
  'js/map.js',
  'js/geo.js',
  'js/data/constants.js',
  'js/data/countries.js',
  'js/data/provinces.js',
  'js/engine/state.js',
  'js/engine/sim.js',
  'js/engine/military.js',
  'js/engine/diplomacy.js',
  'js/engine/events.js',
  'js/engine/ai.js',
  'assets/geo.json',
  'assets/icon.svg',
  'assets/icon-180.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Network-first keeps the app shell fresh after an update; the cache is the
  // offline fallback and is refreshed on every successful online request.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type !== 'opaque') {
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    } catch {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const shell = await cache.match('index.html');
        if (shell) return shell;
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
