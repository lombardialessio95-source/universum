/** UNIVERSUM — client di aggiornamento; isolato dalla simulazione e da Firebase. */
(function () {
  'use strict';
  const sw = navigator.serviceWorker;
  if (!sw) return;
  const pending = new Set();
  let updateLock = false;
  let lastAttempt = 0;
  let registration = null;
  let ready = false;
  let currentRelease = new URLSearchParams(location.search).get('release') || '';
  const label = () => document.getElementById('universum-version-label');
  const versionLabel = (value) => {
    if (!value) return;
    currentRelease = value;
    const node = label();
    if (node) node.textContent = 'UNIVERSUM — Versione ' + value;
  };
  versionLabel(currentRelease);

  const safe = () => ready && !updateLock && !pending.size &&
    !window.UniversumUI?.state?.currentUniverse &&
    document.getElementById('screen-game')?.classList.contains('hidden') !== false;

  function setLock(value) {
    updateLock = value;
    document.getElementById('screen-lobby')?.classList.toggle('universum-update-lock', value);
    // Previene l'avvio di nuove operazioni dalla lobby durante il passaggio di controller.
    if (value) document.getElementById('screen-lobby')?.setAttribute('aria-busy', 'true');
    else document.getElementById('screen-lobby')?.removeAttribute('aria-busy');
  }
  function track(promise) {
    if (!promise || typeof promise.then !== 'function') return promise;
    pending.add(promise);
    Promise.resolve(promise).then(
      () => { pending.delete(promise); },
      () => { pending.delete(promise); }
    );
    return promise;
  }
  function protectWrites() {
    const db = window.UniversumDB;
    for (const method of ['save', 'create', 'rename', 'delete', 'importJSON']) {
      if (typeof db?.[method] !== 'function') continue;
      const original = db[method];
      db[method] = function (...args) {
        if (updateLock) return Promise.reject(new Error('Aggiornamento in corso: operazione rimandata'));
        return track(original.apply(this, args));
      };
    }
    const ui = window.UniversumUI;
    // Un nuovo ingresso in partita non puo' iniziare mentre tutti i client
    // hanno appena autorizzato il cambio di controller.
    for (const name of ['startGame', 'startOnlineGame']) {
      if (typeof ui?.[name] !== 'function') continue;
      const original = ui[name];
      ui[name] = function (...args) {
        if (updateLock) {
          ui.toast?.('Aggiornamento di UNIVERSUM in corso: riapri la partita fra poco.', 'info');
          return;
        }
        return original.apply(this, args);
      };
    }
    if (typeof ui?.persistUniverseState === 'function') {
      const original = ui.persistUniverseState;
      ui.persistUniverseState = function (...args) { return track(original.apply(this, args)); };
    }
  }
  function ask(worker, type, timeoutMs = 5000) {
    return new Promise(resolve => {
      if (!worker) return resolve(null);
      const channel = new MessageChannel();
      let completed = false;
      const finish = value => {
        if (completed) return;
        completed = true;
        clearTimeout(timer);
        channel.port1.close();
        resolve(value);
      };
      const timer = setTimeout(() => finish(null), timeoutMs);
      channel.port1.onmessage = e => finish(e.data);
      try { worker.postMessage({ type }, [channel.port2]); }
      catch (_) { finish(null); }
    });
  }
  function reloadIfSafe() {
    // Nessun reload automatico di una partita o con scritture ancora pendenti.
    if (!ready || pending.size || window.UniversumUI?.state?.currentUniverse) return;
    const controller = sw.controller;
    if (!controller) return;
    ask(controller, 'UNIVERSUM_GET_VERSION').then(info => {
      if (!info?.ready || info.version === currentRelease) {
        setLock(false);
        return;
      }
      const key = 'universum:last-safe-reload';
      let previous = '';
      try { previous = sessionStorage.getItem(key) || ''; } catch (_) { /* navigazione privata */ }
      const marker = currentRelease + '>' + info.version;
      if (previous === marker) {
        // La pagina è già stata ricaricata per questa release: evita loop.
        setLock(false);
        versionLabel(info.version);
        return;
      }
      try { sessionStorage.setItem(key, marker); } catch (_) { /* navigazione privata */ } // Solo metadato; mai partite.
      location.replace('./'); // Ripassa dal bootstrap e dal manifest validato.
    }).catch(() => { setLock(false); });
  }
  async function tryActivate(force = false) {
    if (!ready || !registration?.waiting || !navigator.onLine && !sw.controller) return;
    if (!force && Date.now() - lastAttempt < 1800) return;
    lastAttempt = Date.now();
    // In partita il Service Worker attenderà che tutte le schede tornino sicure.
    if (!safe()) return;
    const result = await ask(registration.waiting, 'UNIVERSUM_TRY_ACTIVATE', 9500);
    if (!result?.activated) setLock(false);
    // Il listener controllerchange ricaricherà la lobby soltanto a controllo concluso.
  }
  function signalSafeLobby() {
    setLock(false);
    tryActivate(true).catch(err => console.warn('[Update] Tentativo:', err));
  }
  sw.addEventListener('message', event => {
    const data = event.data || {};
    if (data.type === 'UNIVERSUM_CAN_UPDATE' && event.ports?.[0]) {
      const consent = safe();
      if (consent) setLock(true); // Congela la lobby nell'intervallo di cambio controller.
      event.ports[0].postMessage({ safe: consent, kind: 'game-client' });
      if (consent) {
        // Un'altra scheda può rifiutare la transizione: rilascia il lock senza loop.
        setTimeout(() => { if (updateLock) setLock(false); }, 12000);
      }
    } else if (data.type === 'UNIVERSUM_UPDATE_BLOCKED') {
      setLock(false);
    }
  });
  sw.addEventListener('controllerchange', reloadIfSafe);
  function watch(reg) {
    registration = reg;
    if (!reg) return;
    const attach = worker => {
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && reg.waiting) tryActivate(true);
      });
    };
    reg.addEventListener('updatefound', () => attach(reg.installing));
    if (reg.installing) attach(reg.installing);
    if (reg.waiting) tryActivate(true);
  }
  function runVersionCheck() {
    if (!registration || !navigator.onLine) return;
    registration.update().catch(err => console.warn('[Update] Rete:', err));
  }
  window.addEventListener('online', runVersionCheck);
  // Un comando esplicito dal flusso di uscita, solo DOPO che il salvataggio è terminato.
  window.UniversumUpdater = { onSafeLobby: signalSafeLobby, track, get version() { return currentRelease; }, get isUpdating() { return updateLock; } };
  function initialize() {
    protectWrites();
    ready = true;
    const id = new URLSearchParams(location.search).get('release');
    if (id) versionLabel(id);
    sw.getRegistration('./').then(reg => {
      watch(reg);
      ask(sw.controller || reg?.active, 'UNIVERSUM_GET_VERSION').then(info => {
        if (info?.ready) {
          if (currentRelease && info.version !== currentRelease) reloadIfSafe();
          else versionLabel(info.version);
        }
      });
    }).catch(err => console.warn('[Update] Registrazione:', err));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
