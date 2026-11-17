// =========================================================
// SERVICE WORKER — UNIVERSUM PWA
// Ricorda: incrementa di +1 la versione qui sotto ogni volta
// che aggiungi/rinomini file o pubblichi aggiornamenti su GitHub.
// =========================================================
const CACHE_NAME = 'universum-v6';

const STATIC_ASSETS = [
  // 1. Shell & Stile Base
  './',
  './index.html',
  './style.css',
  './manifest.json',

  // 2. Persistenza Locale, Dizionari & Grafica
  './db.js',
  './data.js',
  './graphics.js',

  // 3. Motore di Simulazione, Galassia & Multiplayer Firebase
  './engine.js',
  './galaxy.js',
  './firebase-config.js',
  './multiplayer.js',

  // 4. Interfaccia Utente (divisa per macroaree)
  './ui-core.js',      // Stato globale, lobby, loop 1s, audio, canvas pianeta, panoramica, salvataggi
  './ui-economy.js',   // Edifici, ricerche, cantiere navale, difesa, luna, impero
  './ui-tactical.js',  // Flotta, galassia, spionaggio/simulatore, commercio
  './ui-social.js'     // Classifica, chat galattica (50), messaggi privati (15)
];

// =========================================================
// INSTALLAZIONE E PRE-CACHE DEI FILE STATICI
// =========================================================
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache parziale:', err);
      });
    })
  );
});

// =========================================================
// ATTIVAZIONE E PULIZIA VECCHIE CACHE
// =========================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// =========================================================
// INTERCETTAZIONE RICHIESTE (NETWORK-FIRST + FALLBACK CACHE)
// =========================================================
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // Escludi le API real-time di Firebase / Google Auth
  if (
    event.request.url.includes('firestore.googleapis.com') ||
    event.request.url.includes('identitytoolkit.googleapis.com') ||
    event.request.url.includes('securetoken.googleapis.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
