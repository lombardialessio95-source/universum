/**
 * UNIVERSUM — Service Worker PWA (Offline-First + Network-First per Firebase)
 */
const CACHE_NAME = 'universum-v4';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './firebase-config.js',
  './multiplayer.js',
  './graphics-core.js',
  './graphics-ships.js',
  './graphics-structures.js',
  './db.js',
  './data.js',
  './engine.js',
  './galaxy.js',
  './ui.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((oldKey) => caches.delete(oldKey))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Escludi le chiamate API di Firebase/Google da cache statica
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com')
  ) {
    return;
  }

  // Strategia Network-First con fallback istantaneo alla Cache
  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200 && url.origin === location.origin) {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return networkRes;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  );
});
