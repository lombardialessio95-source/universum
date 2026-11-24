/**
 * UNIVERSUM — Service Worker PWA (Offline-First + Network-First per Firebase)
 */
const CACHE_NAME = 'universum-fase1-mixed-research-v1';

const ASSETS = [
  './', './index.html', './manifest.json', './style.css',
  './modules/offline/storage.js',
  './modules/offline/lobby-starfield.js',
  './db.js',
  './modules/data/buildings.js',
  './modules/data/megastructures.js',
  './modules/data/researches.js',
  './modules/data/ships.js',
  './modules/data/defenses.js',
  './data.js',
  './graphics-core.js',
  './graphics-ships.js',
  './graphics-structures.js',
  './modules/engine/context.js',
  './modules/engine/foundation.js',
  './modules/engine/research-model.js',
  './modules/engine/timings.js',
  './modules/engine/production.js',
  './modules/engine/megastructure-costs.js',
  './modules/engine/megastructure-progress.js',
  './modules/engine/progress.js',
  './engine-core.js',
  './engine-actions.js',
  './modules/galaxy/context.js',
  './modules/galaxy/generation.js',
  './modules/galaxy/megastructures.js',
  './modules/galaxy/combat.js',
  './modules/galaxy/fleet-dispatch.js',
  './modules/galaxy/fleet-arrivals.js',
  './modules/galaxy/bot-ai.js',
  './modules/galaxy/fleet-tick.js',
  './modules/galaxy/trade.js',
  './galaxy.js',
  './firebase-config.js',
  './moon-merchant.js',
  './modules/online/context.js',
  './modules/online/foundation.js',
  './modules/online/universes.js',
  './modules/online/sync.js',
  './modules/online/fleet-control.js',
  './modules/online/combat-resolver.js',
  './modules/online/sieges.js',
  './modules/online/communications.js',
  './modules/online/bots.js',
  './multiplayer.js',
  './ui-core.js',
  './modules/ui/lobby-online.js',
  './modules/ui/planet-canvas.js',
  './modules/ui/resource-deposits.js',
  './modules/ui/navigation.js',
  './modules/ui/runtime.js',
  './modules/ui/selects.js',
  './ui-guide.js',
  './modules/ui/ui-galattica.js',
  './modules/ui/ui-buildings.js',
  './modules/ui/ui-research.js',
  './modules/ui/ui-shipyard.js',
  './modules/ui/ui-moon.js',
  './modules/ui/ui-empire.js',
  './modules/ui/fleet.js',
  './modules/ui/galaxy.js',
  './modules/ui/espionage.js',
  './modules/ui/simulator.js',
  './modules/ui/diplomacy.js',
  './ui-social.js',
  './missions-core.js',
  './siege-missions.js',
  './ui-fleet-movements.js',
  './tutorial.js',
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
