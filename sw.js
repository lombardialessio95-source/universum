/**
 * UNIVERSUM: Service Worker delle release atomiche.
 * VERSIONE_RELEASE viene compilata da tools/build_release.py a ogni pubblicazione.
 * Tutti gli asset vengono validati con SHA-256 PRIMA dell'attivazione.
 * Non legge, scrive o cancella IndexedDB, localStorage o Firebase.
 */
'use strict';
const VERSIONE_RELEASE = 'r18966a4fa248fc2eb22d';
const CACHE_PREFIX = 'universum-static-release-';
const CACHE_NAME = CACHE_PREFIX + VERSIONE_RELEASE;
const META_PATH = './__universum_cache_metadata__';
const MANIFEST_PATH = './release-manifest.json';
const MAX_PARALLEL_DOWNLOADS = 5;
let manifestPromise = null;
let activationPromise = null;

function scoped(path) { return new URL(path, self.registration.scope).href; }
function isValidManifest(manifest) {
  return !!manifest && manifest.version === VERSIONE_RELEASE &&
    /^[a-f0-9]{64}$/.test(manifest.workerHash || '') &&
    typeof manifest.files === 'object' && manifest.files !== null &&
    Object.keys(manifest.files).length >= 60 &&
    ['index.html', 'app.html', 'style.css', 'update-client.js', 'modules/offline/storage.js'].every(p =>
      /^[a-f0-9]{64}$/.test(manifest.files[p] || '')) &&
    Object.entries(manifest.files).every(([path, hash]) =>
      /^[\w./-]+$/.test(path) && !path.includes('..') && !path.startsWith('/') &&
      /^[a-f0-9]{64}$/.test(hash));
}
async function readValidatedManifest() {
  if (!manifestPromise) {
    manifestPromise = (async () => {
      const cache = await caches.open(CACHE_NAME);
      const res = await cache.match(scoped(META_PATH));
      if (!res) return null;
      const meta = await res.json();
      return isValidManifest(meta) ? meta : null;
    })();
  }
  return manifestPromise;
}
async function sha256(buffer) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
function hasExpectedType(path, response) {
  const type = (response.headers.get('content-type') || '').toLowerCase();
  if (path.endsWith('.js')) return /javascript|ecmascript/.test(type);
  if (path.endsWith('.css')) return type.includes('text/css');
  if (path.endsWith('.html')) return type.includes('text/html');
  if (path.endsWith('.json')) return type.includes('json');
  return true;
}
async function fetchVerified(path, expectedHash, version) {
  const url = new URL(path, self.registration.scope);
  url.searchParams.set('universum_release', version);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url.href, {
      cache: 'no-store', mode: 'same-origin', credentials: 'same-origin',
      redirect: 'error', signal: controller.signal
    });
    if (!response.ok || response.status !== 200 || response.type === 'opaque' || !hasExpectedType(path, response)) {
      throw new Error(`Asset non valido: ${path} (${response.status})`);
    }
    const contents = await response.arrayBuffer();
    if (await sha256(contents) !== expectedHash) throw new Error(`Hash non coerente: ${path}`);
    return new Response(contents, { status: 200, headers: { 'Content-Type': response.headers.get('content-type') || 'application/octet-stream' } });
  } finally { clearTimeout(timer); }
}
async function oldReleaseCache(files) {
  const keys = (await caches.keys()).filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME);
  // La cache più recente è normalmente l'ultima creata, ma una release non verificata
  // non contiene il meta-manifest e non viene mai usata come sorgente.
  for (const key of keys.reverse()) {
    const cache = await caches.open(key);
    const res = await cache.match(scoped(META_PATH));
    if (!res) continue;
    try {
      const meta = await res.json();
      if (meta?.files && Object.keys(meta.files).length >= 60) return { cache, files: meta.files };
    } catch (_) { /* cache parziale o legacy */ }
  }
  return null;
}
async function installRelease() {
  const versionUrl = new URL(MANIFEST_PATH, self.registration.scope);
  versionUrl.searchParams.set('sw_version', VERSIONE_RELEASE);
  const response = await fetch(versionUrl, { cache: 'no-store', credentials: 'same-origin', redirect: 'error' });
  if (!response.ok || !hasExpectedType('release-manifest.json', response)) throw new Error('Manifest di release indisponibile');
  const manifest = await response.json();
  if (!isValidManifest(manifest)) throw new Error('Manifest di release incompatibile o non completo');

  const cache = await caches.open(CACHE_NAME);
  const prior = await oldReleaseCache(manifest.files);
  const entries = Object.entries(manifest.files);
  let cursor = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL_DOWNLOADS, entries.length) }, async () => {
      while (cursor < entries.length) {
        const [path, hash] = entries[cursor++];
        const dest = scoped('./' + path);
        let data = null;
        if (prior?.files[path] === hash) data = await prior.cache.match(dest);
        if (!data) data = await fetchVerified(path, hash, VERSIONE_RELEASE);
        await cache.put(dest, data);
      }
    }));
    // Scrivi il marcatore COMPLETE solo dopo aver popolato e controllato TUTTA la cache.
    for (const [path] of entries) {
      if (!(await cache.match(scoped('./' + path)))) throw new Error('Precache incompleto: ' + path);
    }
    await cache.put(scoped(META_PATH), new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/json' } }));
    manifestPromise = Promise.resolve(manifest);
  } catch (err) {
    await caches.delete(CACHE_NAME); // Solo la nuova cache INCOMPLETA, mai i salvataggi.
    throw err;
  }
}
self.addEventListener('install', event => {
  // NON chiamare skipWaiting qui: eventuali partite aperte mantengono il vecchio controller.
  event.waitUntil(installRelease());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const manifest = await readValidatedManifest();
    if (!manifest) throw new Error('Attivazione di cache non validata impedita');
    await self.clients.claim();
    // Conserva la versione immediatamente precedente per recupero e rollback.
    const old = (await caches.keys()).filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME);
    for (const key of old.slice(0, Math.max(0, old.length - 1))) await caches.delete(key);
    // Le cache legacy precedenti a questa funzionalità restano intatte.
  })());
});
async function askClientSafety(client) {
  const channel = new MessageChannel();
  return await new Promise(resolve => {
    let done = false;
    const complete = value => { if (done) return; done = true; clearTimeout(timeout); channel.port1.close(); resolve(value); };
    const timeout = setTimeout(() => complete(false), 2800);
    channel.port1.onmessage = e => complete(e.data?.safe === true);
    try { client.postMessage({ type: 'UNIVERSUM_CAN_UPDATE', version: VERSIONE_RELEASE }, [channel.port2]); }
    catch (_) { complete(false); }
  });
}
async function activateIfSafe() {
  const meta = await readValidatedManifest();
  if (!meta) return { activated: false, reason: 'precache-incompleto' };
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const permits = await Promise.all(windows.map(askClientSafety));
  if (!permits.every(Boolean)) {
    // Client.postMessage e' void nei browser: non e' una Promise.
    for (const client of windows) {
      try { client.postMessage({ type: 'UNIVERSUM_UPDATE_BLOCKED' }); }
      catch (_) { /* una scheda puo' essersi chiusa nel frattempo */ }
    }
    return { activated: false, reason: 'partita-o-scheda-non-sicura' };
  }
  await self.skipWaiting();
  return { activated: true, version: VERSIONE_RELEASE };
}
self.addEventListener('message', event => {
  const type = event.data?.type;
  if (type === 'UNIVERSUM_GET_VERSION') {
    event.ports?.[0]?.postMessage({ ready: true, version: VERSIONE_RELEASE });
  } else if (type === 'UNIVERSUM_TRY_ACTIVATE') {
    const response = event.ports?.[0];
    if (!activationPromise) activationPromise = activateIfSafe().finally(() => { activationPromise = null; });
    event.waitUntil(activationPromise.then(result => response?.postMessage(result), err => response?.postMessage({ activated: false, reason: String(err) })));
  }
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const manifest = await readValidatedManifest();
    if (!manifest) return Response.error();
    const base = new URL(self.registration.scope);
    const relative = url.pathname.slice(base.pathname.length);
    const key = relative === '' ? 'index.html' : relative;
    // Pagina e moduli: TUTTI serviti soltanto dalla stessa cache immutabile.
    if (manifest.files[key]) {
      const cached = await (await caches.open(CACHE_NAME)).match(scoped('./' + key));
      return cached || Response.error(); // Mai un fallback HTML per un modulo JS.
    }
    if (req.mode === 'navigate') {
      const cached = await (await caches.open(CACHE_NAME)).match(scoped('./index.html'));
      return cached || Response.error();
    }
    // No cache per Firestore, Auth, font remoti o URL non previsti nel manifest.
    return fetch(req);
  })());
});
