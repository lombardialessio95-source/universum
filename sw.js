/**
 * UNIVERSUM — Service Worker PWA (Offline-First + Network-First per Firebase)
 */
const CACHE_NAME = 'universum-v9';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './style.css',

  // Moduli Core Applicazione
  './db.js',                  // Database locale IndexedDB
  './data.js',                // Enciclopedia: edifici, ricerche, navi e difese
  './graphics-core.js',       // Nucleo grafico Canvas/SVG
  './graphics-ships.js',      // Ritratti procedurali navi e difese
  './graphics-structures.js', // Ritratti procedurali edifici, luna e ricerche
  './engine-core.js',         // Motore matematico, produzione e tick
  './engine-actions.js',      // Azioni giocatore, turbo, creative e autosave
  './galaxy.js',              // Galassia procedurale, combattimenti e IA BOT
  './firebase-config.js',     // Configurazione Firebase Auth + Firestore
  './multiplayer.js',         // Logica PvP online, chat e classifica
  './ui-core.js',             // Regia UI, loop 1s, Panoramica e salvataggi
  './ui-economy.js',          // UI Edifici, Ricerche, Cantiere, Difese e Luna
  './ui-tactical.js',         // UI Flotta, Galassia, Spionaggio e Simulatore
  './ui-social.js',           // UI Commercio, Classifica e Comunicazioni

  // Moduli Plugin Espansione
  './missions-core.js',       // Ricerca Esplorazione, spinta 10-100%, slot e richiamo
  './ui-fleet-movements.js'   // Schermata UI Movimento Flotta e stato assedi
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

  // Escludi le chiamate API di Firebase/Google dalla cache statica
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
