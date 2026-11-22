(function () {
  'use strict';

  const UI = window.UniversumUI || (window.UniversumUI = {});

  UI.state = {
    currentUniverse: null,
    isMultiplayerMode: false,
    currentView: 'overview',
    gameLoopTimer: null,
    audioCtx: null,
    soundMuted: localStorage.getItem('universum_muted') === 'true',

    unsubChatListener: null,
    unsubServerListener: null,
    unsubFleetsListener: null,
    unsubOwnFleetsListener: null,
    unsubOwnPlanetsListener: null,
    unsubPrivateConvsListener: null,
    unsubPrivateMsgsListener: null,

    chatMessagesCache: [],
    privateConversationsCache: [],
    privateMessagesCache: [],
    unreadPrivateCount: 0,

    shipyardTab: 'ships',
    galaxyG: 1,
    galaxyS: 1,
    galaxyFilter: 'all',
    fleetSelection: {},
    fleetTarget: { g: 1, s: 1, p: 1 },
    fleetMission: 'attack',
    fleetCargo: { metal: 0, crystal: 0, deuterium: 0 },
    fleetBlackHole: false,
    fleetFuelPercent: 100,
    fleetExploreHours: 1,
    fleetRansom: { metal: 0, crystal: 0, deuterium: 0 },
    selectedSpyReportId: null,
    simFleet: {},
    simDebounceTimer: null,
    lastAlertCount: 0,
    planetAnimAngle: 0,
    planetAnimId: null,
    commTab: 'galactic',
    activePrivateTarget: null,
    currentGalatticaManageId: null,
    currentGalatticaManagePrevView: null,
    currentGalatticaFleetId: null,
    currentGalatticaFleetPrevView: null
  };

  UI.artTag = function (id, cls = 'unit-art', alt = '') {
    const res = window.UniversumGraphics?.getArt ? window.UniversumGraphics.getArt(id) : '';
    if (!res) return '';
    if (String(res).trim().startsWith('<')) return res;
    return `<img src="${res}" class="${cls}" alt="${UI.escapeHTML(alt)}" loading="lazy">`;
  };

  UI.resIconTag = function (type) {
    const res = window.UniversumGraphics?.getResourceIcon
      ? window.UniversumGraphics.getResourceIcon(type, 'res-icon')
      : '';
    if (!res) return '';
    if (String(res).trim().startsWith('<')) return res;
    return `<img src="${res}" class="res-icon" alt="">`;
  };

  UI.svgIcon = function (name) {
    if (window.UniversumGraphics?.svg) {
      return window.UniversumGraphics.svg(name);
    }
    return '';
  };

  UI.generateDynamicPWAIcon = function () {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      const bgGrad = ctx.createRadialGradient(256, 256, 40, 256, 256, 360);
      bgGrad.addColorStop(0, '#0a1230');
      bgGrad.addColorStop(1, '#02020a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 512, 512);

      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 45; i++) {
        const sx = ((i * 97) % 480) + 16;
        const sy = ((i * 151) % 480) + 16;
        ctx.globalAlpha = 0.4 + (i % 5) * 0.12;
        ctx.beginPath();
        ctx.arc(sx, sy, (i % 3) * 0.7 + 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(225, 255);
      ctx.rotate(-0.38);
      ctx.strokeStyle = 'rgba(0, 210, 255, 0.55)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.ellipse(0, 0, 175, 44, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      const planetGrad = ctx.createRadialGradient(185, 215, 20, 225, 255, 115);
      planetGrad.addColorStop(0, '#00d2ff');
      planetGrad.addColorStop(0.55, '#4a148c');
      planetGrad.addColorStop(1, '#09051c');
      ctx.fillStyle = planetGrad;
      ctx.beginPath();
      ctx.arc(225, 255, 110, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(225, 255);
      ctx.rotate(-0.38);
      ctx.strokeStyle = 'rgba(0, 230, 118, 0.75)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.ellipse(0, 0, 175, 44, 0, 0, Math.PI);
      ctx.stroke();
      ctx.restore();

      const dsX = 378;
      const dsY = 148;
      const dsR = 46;
      const dsGrad = ctx.createRadialGradient(dsX - 14, dsY - 14, 5, dsX, dsY, dsR);
      dsGrad.addColorStop(0, '#cfd8dc');
      dsGrad.addColorStop(0.6, '#546e7a');
      dsGrad.addColorStop(1, '#1c262b');
      ctx.fillStyle = dsGrad;
      ctx.beginPath();
      ctx.arc(dsX, dsY, dsR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#263238';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(dsX - dsR, dsY);
      ctx.lineTo(dsX + dsR, dsY);
      ctx.stroke();

      ctx.fillStyle = '#37474f';
      ctx.beginPath();
      ctx.arc(dsX - 15, dsY - 15, 13, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ff1744';
      ctx.shadowColor = '#ff1744';
      ctx.shadowBlur = 16;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(dsX - 15, dsY - 15);
      ctx.lineTo(275, 225);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = '#00d2ff';
      ctx.lineWidth = 12;
      ctx.strokeRect(10, 10, 492, 492);

      ctx.font = '900 44px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = 'rgba(255, 215, 0, 0.7)';
      ctx.shadowBlur = 14;
      ctx.fillText('UNIVERSUM', 256, 452);
      ctx.shadowBlur = 0;

      const dataUrl = canvas.toDataURL('image/png');
      const fav = document.getElementById('dynamic-favicon');
      const apple = document.getElementById('dynamic-apple-icon');
      if (fav) fav.href = dataUrl;
      if (apple) apple.href = dataUrl;
    } catch (e) {
      console.warn('[UI] Generazione icona Canvas saltata:', e);
    }
  };

  UI.playSound = function (type) {
    const st = UI.state;
    if (st.soundMuted) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!st.audioCtx) st.audioCtx = new AudioContextClass();
      if (st.audioCtx.state === 'suspended') st.audioCtx.resume();

      const now = st.audioCtx.currentTime;
      const osc = st.audioCtx.createOscillator();
      const gain = st.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(st.audioCtx.destination);

      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(620, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc.start(now);
        osc.stop(now + 0.07);
      } else if (type === 'complete' || type === 'success') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.09);
        osc.frequency.setValueAtTime(659.25, now + 0.18);
        osc.frequency.setValueAtTime(880, now + 0.27);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        osc.start(now);
        osc.stop(now + 0.42);
      } else if (type === 'alarm') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(140, now + 0.25);
        osc.frequency.linearRampToValueAtTime(220, now + 0.5);
        gain.gain.setValueAtTime(0.11, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.start(now);
        osc.stop(now + 0.55);
      } else if (type === 'error') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(120, now + 0.16);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
        osc.start(now);
        osc.stop(now + 0.17);
      }
    } catch (e) {}
  };

  UI.escapeHTML = function (str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  UI.formatNum = function (num) {
    const n = Math.floor(Number(num) || 0);
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    return n.toLocaleString('it-IT');
  };

  UI.formatDuration = function (seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    if (s === 0) return '0s';
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (v) => String(v).padStart(2, '0');
    if (d > 0) return `${d}g ${pad(h)}:${pad(m)}:${pad(sec)}`;
    return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  };

  UI.toast = function (msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3400);
  };

  UI.openModal = function (title, bodyHTML) {
    const modal = document.getElementById('universal-modal');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    if (!modal || !titleEl || !bodyEl) return;
    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHTML;
    modal.classList.remove('hidden');
  };

  UI.closeModal = function () {
    const modal = document.getElementById('universal-modal');
    if (modal) modal.classList.add('hidden');
  };

  UI.getActivePlanetIndex = function () {
    const uni = UI.state.currentUniverse;
    if (!uni || !uni.planets.length) return 0;
    const idx = uni.planets.findIndex((p) => p.id === uni.activePlanetId);
    return idx >= 0 ? idx : 0;
  };

  UI.getActivePlanet = function () {
    return UI.state.currentUniverse.planets[UI.getActivePlanetIndex()];
  };

  // FIX 4.1 + 4.4 — Sync online con feedback e retry automatico.
  // - Errori: toast chiaro (max 1 ogni 30s) e log in console.
  // - Errori di rete: retry in background con backoff (5s, 15s, 45s), senza bloccare l'UI.
  // - Permessi negati: nessun retry (non servirebbe), solo avviso.
  // - Chi chiama persistUniverseState({ notify: true }) vede "Sincronizzazione..." / "Sincronizzato"
  //   (non usato di default: il sync automatico gira ogni 60s e riempirebbe lo schermo di toast).
  UI._syncRetry = { attempt: 0, timer: null, lastErrorToastAt: 0, hadFailure: false };
  const SYNC_RETRY_DELAYS_MS = [5000, 15000, 45000];

  UI._resetSyncRetry = function () {
    const r = UI._syncRetry;
    if (r.timer) clearTimeout(r.timer);
    r.timer = null;
    r.attempt = 0;
    r.hadFailure = false;
  };

  UI._scheduleSyncRetry = function () {
    const r = UI._syncRetry;
    if (r.timer || r.attempt >= SYNC_RETRY_DELAYS_MS.length) return;
    const delay = SYNC_RETRY_DELAYS_MS[r.attempt++];
    r.timer = setTimeout(async () => {
      r.timer = null;
      if (!UI.state.isMultiplayerMode || !UI.state.currentUniverse) {
        UI._resetSyncRetry();
        return;
      }
      try {
        await UI.persistUniverseState();
      } catch (e) { /* persistUniverseState ripianifica da sola il tentativo successivo */ }
    }, delay);
  };

  UI.persistUniverseState = async function (opts = {}) {
    const uni = UI.state.currentUniverse;
    if (!uni) return;

    if (!UI.state.isMultiplayerMode) {
      await window.UniversumDB.save(uni);
      return;
    }
    if (!window.UniversumMP || typeof window.UniversumMP.syncPlayerState !== 'function') return;

    const r = UI._syncRetry;
    if (opts.notify) UI.toast('Sincronizzazione...', 'info');
    try {
      await window.UniversumMP.syncPlayerState(uni, { force: true });
      if (r.timer) { clearTimeout(r.timer); r.timer = null; }
      r.attempt = 0;
      if (r.hadFailure) {
        r.hadFailure = false;
        UI.toast('Connessione ripristinata: dati sincronizzati.', 'success');
      } else if (opts.notify) {
        UI.toast('Sincronizzato', 'success');
      }
    } catch (err) {
      r.hadFailure = true;
      console.warn('[Sync] Sincronizzazione online non riuscita:', err);
      const code = String(err?.code || '');
      const now = Date.now();
      if (now - r.lastErrorToastAt > 30000) {
        r.lastErrorToastAt = now;
        if (code === 'permission-denied') {
          UI.toast('Il server ha rifiutato il salvataggio (permessi): i progressi online potrebbero non essere salvati.', 'error');
        } else {
          UI.toast('Errore di rete: sincronizzazione non riuscita, riprovo automaticamente.', 'error');
        }
      }
      const retryable = !['permission-denied', 'unauthenticated', 'invalid-argument'].includes(code);
      if (retryable) UI._scheduleSyncRetry();
      throw err; // stesso comportamento di prima per chi la chiama con await
    }
  };

  // FIX 2.9 — Riallineamento con il server: sync (debounced) quando arrivano variazioni sui pianeti propri
  UI._reconcileTimer = null;
  UI._requestReconcileSync = function () {
    if (UI._reconcileTimer) return;
    UI._reconcileTimer = setTimeout(async () => {
      UI._reconcileTimer = null;
      if (!UI.state.isMultiplayerMode || !UI.state.currentUniverse) return;
      try {
        await UI.persistUniverseState();
      } catch (e) { /* errore già mostrato/ritentato da persistUniverseState */ }
    }, 400);
  };

  // Chiamata da multiplayer.js dopo ogni riallineamento (variazioni applicate o pianeti persi)
  UI.onOnlineReconciled = function ({ reconciled = [], lost = [] } = {}) {
    const st = UI.state;
    const uni = st.currentUniverse;
    if (!uni) return;
    if (lost.length > 0) {
      lost.forEach((p) => UI.toast(`Hai perso il controllo di ${p.name}!`, 'error'));
      if (uni.planets.length > 0 && !uni.planets.some((p) => p.id === uni.activePlanetId)) {
        uni.activePlanetId = uni.planets[0].id;
      }
      UI.refreshPlanetSelector?.();
      UI.playSound?.('alarm');
    }
    UI.updateTopBarNumbers?.();
    if (['overview', 'buildings', 'shipyard', 'defense'].includes(st.currentView)) UI.renderCurrentView();
  };

  UI.closePrivateMessageStream = function () {
    if (typeof UI.state.unsubPrivateMsgsListener === 'function') {
      UI.state.unsubPrivateMsgsListener();
      UI.state.unsubPrivateMsgsListener = null;
    }
    UI.state.privateMessagesCache = [];
  };

  UI.updateCommBadges = function () {
    const st = UI.state;
    const sb = document.getElementById('sidebar-chat-badge');
    const db = document.getElementById('drawer-chat-badge');
    const tabBadge = document.getElementById('tab-private-unread-badge');
    const menuDot = document.getElementById('mobile-menu-unread-dot');
    const show = st.isMultiplayerMode && st.unreadPrivateCount > 0;

    if (sb) {
      sb.textContent = st.unreadPrivateCount;
      sb.classList.toggle('hidden', !show);
    }
    if (db) {
      db.textContent = st.unreadPrivateCount;
      db.classList.toggle('hidden', !show);
    }
    if (tabBadge) {
      tabBadge.textContent = st.unreadPrivateCount;
      tabBadge.classList.toggle('hidden', !show);
    }
    if (menuDot) {
      menuDot.classList.toggle('hidden', !show);
    }
  };

  UI.openPrivateChatWith = function (targetUid, targetNickname) {
    if (!UI.state.isMultiplayerMode || !targetUid) return;
    const myUid = window.fbAuth?.currentUser?.uid;
    if (targetUid === myUid) return;

    UI.state.commTab = 'private';
    UI.state.activePrivateTarget = {
      uid: targetUid,
      nickname: targetNickname || 'Comandante'
    };
    UI.switchView('chat');
  };

  UI.setupLobbyTabs = function () {
    const { playSound, toast, openModal, closeModal, svgIcon, startOnlineGame } = UI;
    const tabOffline = document.getElementById('tab-mode-offline');
    const tabOnline = document.getElementById('tab-mode-online');
    const panelOffline = document.getElementById('lobby-panel-offline');
    const panelOnline = document.getElementById('lobby-panel-online');

    tabOffline?.addEventListener('click', () => {
      playSound('click');
      tabOffline.classList.add('active');
      tabOffline.setAttribute('aria-selected', 'true');
      tabOnline?.classList.remove('active');
      tabOnline?.setAttribute('aria-selected', 'false');
      panelOffline?.classList.remove('hidden');
      panelOnline?.classList.add('hidden');
    });

    tabOnline?.addEventListener('click', async () => {
      playSound('click');
      tabOnline.classList.add('active');
      tabOnline.setAttribute('aria-selected', 'true');
      tabOffline?.classList.remove('active');
      tabOffline?.setAttribute('aria-selected', 'false');
      panelOnline?.classList.remove('hidden');
      panelOffline?.classList.add('hidden');
      await UI.refreshOnlineLobbyState();
    });

    const authForm = document.getElementById('form-mp-auth');
    authForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!window.UniversumMP) {
        toast('Modulo Multiplayer non disponibile.', 'error');
        return;
      }
      const submitter = e.submitter;
      const isRegister = submitter && submitter.dataset.authMode === 'register';
      const nick = document.getElementById('mp-nickname').value;
      const pass = document.getElementById('mp-password').value;

      try {
        await window.UniversumMP.registerOrLogin(nick, pass, isRegister);
        playSound('success');
        toast(isRegister ? 'Account Imperatore registrato!' : 'Accesso effettuato!', 'success');
        await UI.refreshOnlineLobbyState();
      } catch (err) {
        playSound('error');
        toast(err.message || 'Errore autenticazione Firebase.', 'error');
      }
    });

    document.getElementById('btn-mp-logout')?.addEventListener('click', async () => {
      if (window.fbAuth) await window.fbAuth.signOut();
      await UI.refreshOnlineLobbyState();
      toast('Disconnesso dal server online.', 'info');
    });

    document.getElementById('btn-mp-refresh')?.addEventListener('click', async () => {
      playSound('click');
      await UI.renderOnlineUniversesList();
    });

    document.getElementById('btn-mp-create-uni')?.addEventListener('click', () => {
      playSound('click');
      openModal('CREA NUOVO UNIVERSO ONLINE PvP', `
        <form id="form-mp-create-uni-modal">
          <div class="form-group">
            <label for="mp-uni-name">Nome Universo Online</label>
            <input type="text" id="mp-uni-name" class="form-control" placeholder="Es. Andromeda PvP" maxlength="32" required>
          </div>
          <div class="form-grid-3">
            <div class="form-group">
              <label for="mp-uni-speed">Velocità</label>
              <select id="mp-uni-speed" class="form-control">
                <option value="1">1x</option>
                <option value="5">5x</option>
                <option value="10" selected>10x</option>
                <option value="25">25x</option>
                <option value="50">50x</option>
                <option value="100">100x</option>
              </select>
            </div>
            <div class="form-group">
              <label for="mp-uni-galaxies">Galassie</label>
              <input type="number" id="mp-uni-galaxies" class="form-control" value="3" min="1" max="9">
            </div>
            <div class="form-group">
              <label for="mp-uni-systems">Sistemi</label>
              <input type="number" id="mp-uni-systems" class="form-control" value="100" min="20" max="499">
            </div>
          </div>
          <div class="form-group">
            <label for="mp-uni-passcode">Codice Stanza (Opzionale per partita privata)</label>
            <input type="text" id="mp-uni-passcode" class="form-control" placeholder="Lascia vuoto per universo pubblico" maxlength="20">
          </div>
          <div class="glass-panel" style="padding:12px; margin-top:12px;">
            <h4 style="color:var(--res-crystal); margin-bottom:8px;">CONFIGURAZIONE BOT</h4>
            <div class="form-group"><label for="mp-bot-density">Densità BOT: <span id="mp-bot-density-val">20%</span></label>
              <input type="range" id="mp-bot-density" min="0" max="100" value="20" class="form-control"></div>
            <div class="form-grid-3">
              <div class="form-group"><label for="mp-bot-hostile">Ostili %</label><input type="number" id="mp-bot-hostile" class="form-control" min="0" max="100" value="30"></div>
              <div class="form-group"><label for="mp-bot-neutral">Neutrali %</label><input type="number" id="mp-bot-neutral" class="form-control" min="0" max="100" value="40"></div>
              <div class="form-group"><label for="mp-bot-peaceful">Pacifici %</label><input type="number" id="mp-bot-peaceful" class="form-control" min="0" max="100" value="30"></div>
            </div>
            <div class="form-group"><label for="mp-bot-level">Livello BOT</label><select id="mp-bot-level" class="form-control">
              <option value="1">1 — Debole</option><option value="2" selected>2 — Medio</option>
              <option value="3">3 — Forte</option><option value="4">4 — Elite</option></select></div>
            <label style="display:block; margin-top:6px;"><input type="checkbox" id="mp-bot-growth" checked> I BOT crescono nel tempo</label>
            <label style="display:block; margin-top:6px;"><input type="checkbox" id="mp-bot-raids" checked> Raid dei BOT ostili</label>
          </div>
          <button type="submit" class="btn btn-green" style="width:100%; margin-top:8px;">${svgIcon('globe')} FONDA E ENTRA NELL'UNIVERSO</button>
        </form>
      `);

      document.getElementById('mp-bot-density')?.addEventListener('input', (e) => {
        document.getElementById('mp-bot-density-val').textContent = `${e.target.value}%`;
      });
      document.getElementById('mp-bot-hostile')?.addEventListener('input', (e) => {
        document.getElementById('mp-bot-raids').disabled = Number(e.target.value) === 0;
      });
      document.getElementById('form-mp-create-uni-modal')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!window.UniversumMP) return;
        try {
          const h = Number(document.getElementById('mp-bot-hostile').value);
          const n = Number(document.getElementById('mp-bot-neutral').value);
          const p = Number(document.getElementById('mp-bot-peaceful').value);
          if (![h, n, p].every((v) => Number.isInteger(v) && v >= 0 && v <= 100) || h + n + p !== 100) {
            toast('Ostili + Neutrali + Pacifici devono totalizzare il 100%.', 'error');
            return;
          }
          const cfg = {
            name: document.getElementById('mp-uni-name').value,
            botConfig: {
              density: Number(document.getElementById('mp-bot-density').value),
              personality: { hostile: h, neutral: n, peaceful: p },
              level: Number(document.getElementById('mp-bot-level').value),
              growth: document.getElementById('mp-bot-growth').checked,
              raids: h > 0 && document.getElementById('mp-bot-raids').checked
            },
            speed: Number(document.getElementById('mp-uni-speed').value),
            galaxies: Number(document.getElementById('mp-uni-galaxies').value),
            systemsPerGalaxy: Number(document.getElementById('mp-uni-systems').value),
            passcode: document.getElementById('mp-uni-passcode').value.trim()
          };
          const uni = await window.UniversumMP.createOnlineUniverse(cfg);
          closeModal();
          playSound('complete');
          toast(`Universo Online "${uni.name}" fondato!`, 'success');
          startOnlineGame(uni);
        } catch (err) {
          playSound('error');
          toast(err.message, 'error');
        }
      });
    });
  };

  UI.refreshOnlineLobbyState = async function () {
    const authBox = document.getElementById('mp-auth-box');
    const serversBox = document.getElementById('mp-servers-box');
    const user = window.fbAuth ? window.fbAuth.currentUser : null;

    if (!user) {
      authBox?.classList.remove('hidden');
      serversBox?.classList.add('hidden');
      return;
    }

    authBox?.classList.add('hidden');
    serversBox?.classList.remove('hidden');

    const nickEl = document.getElementById('mp-logged-user');
    if (nickEl) {
      nickEl.textContent = user.displayName || (user.email ? user.email.split('@')[0] : 'Comandante');
    }

    await UI.renderOnlineUniversesList();
  };

  UI.renderOnlineUniversesList = async function () {
    const { escapeHTML, svgIcon, openModal, closeModal, playSound, toast, startOnlineGame } = UI;
    const listEl = document.getElementById('mp-universe-list');
    if (!listEl || !window.UniversumMP) return;

    listEl.innerHTML = `<div class="glass-panel" style="padding:16px; text-align:center;"><p class="text-muted">Scansione universi online in corso...</p></div>`;

    try {
      const universes = await window.UniversumMP.getOnlineUniverses();
      const membership = window.UniversumMP.getMyServerMembership
        ? await window.UniversumMP.getMyServerMembership().catch(() => ({ serverIds: [], serverCount: 0, limit: 3 }))
        : { serverIds: [], serverCount: 0, limit: 3 };
      const myUid = window.fbAuth?.currentUser?.uid;
      const atLimit = membership.serverCount >= (membership.limit || 3);

      const createBtn = document.getElementById('btn-mp-create-uni');
      if (createBtn) {
        createBtn.disabled = atLimit;
        createBtn.textContent = atLimit ? 'LIMITE SERVER RAGGIUNTO (3/3)' : '+ CREA UNIVERSO ONLINE';
      }

      const limitHeader = `
        <div class="glass-panel" style="padding:12px 14px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <strong>Server ${membership.serverCount}/${membership.limit || 3}</strong>
          ${atLimit ? '<span class="badge badge-red">Limite raggiunto: abbandona un server per entrarne in un altro</span>' : '<span class="badge badge-green">Puoi ancora entrare in un nuovo server</span>'}
        </div>
      `;

      if (!universes || universes.length === 0) {
        listEl.innerHTML = `${limitHeader}<div class="glass-panel" style="padding:20px; text-align:center;"><p class="text-muted">Nessun universo online attivo. Clicca su "+ CREA UNIVERSO ONLINE" qui sopra!</p></div>`;
        return;
      }

      listEl.innerHTML = limitHeader + universes.map((u) => {
        const isMember = membership.serverIds.includes(u.id);
        const isFounder = myUid && (u.founderUid === myUid || u.ownerUid === myUid);
        const joinDisabled = !isMember && atLimit;
        const npcBadge = u.npcMode === 'limited'
          ? '<span class="badge badge-neutral">MAX 10 AVAMPOSTI NEUTRALI</span>'
          : '<span class="badge badge-red">100% PvP • ZERO BOT</span>';
        return `
          <article class="universe-card glass-panel">
            <div class="universe-card-header">
              <div>
                <div class="universe-name">${escapeHTML(u.name)}</div>
                <div class="text-muted" style="font-size:0.9rem;">Fondatore: <strong style="color:#fff;">${escapeHTML(u.founderName || 'Imperatore')}</strong></div>
              </div>
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                ${npcBadge}
                <span class="badge badge-green">${u.speed}x</span>
                ${u.hasPasscode ? `<span class="badge badge-blue">${svgIcon('lock')} PRIVATO</span>` : ''}
              </div>
            </div>
            <div class="universe-meta">
              <span>Giocatori iscritti: <strong>${u.playerCount || 1}</strong></span>
              <span>Mappa: <strong>${u.galaxies}G × ${u.systemsPerGalaxy}S</strong></span>
            </div>
            ${isMember ? '<span class="badge badge-green">SEI IN QUESTO SERVER</span>' : ''}
            ${isFounder ? '<span class="badge badge-blue">CREATORE</span>' : ''}
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
              <button type="button" class="btn btn-green btn-sm btn-join-online-uni" data-uid="${u.id}" data-locked="${u.hasPasscode ? '1' : '0'}" ${joinDisabled ? 'disabled' : ''}>
                ${svgIcon('globe')} ${joinDisabled ? 'LIMITE 3 SERVER RAGGIUNTO' : (isMember ? "RIENTRA NELL'UNIVERSO" : "ENTRA NELL'UNIVERSO")}
              </button>
              ${isMember ? `<button type="button" class="btn btn-red btn-sm btn-leave-online-uni" data-uid="${u.id}">Abbandona Server</button>` : ''}
            </div>
          </article>
        `;
      }).join('');

      listEl.querySelectorAll('.btn-join-online-uni').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const uniId = btn.dataset.uid;
          const isLocked = btn.dataset.locked === '1';

          const proceedJoin = async (passcode = '') => {
            try {
              const joinedUni = await window.UniversumMP.joinOnlineUniverse(uniId, passcode);
              playSound('complete');
              startOnlineGame(joinedUni);
            } catch (err) {
              playSound('error');
              toast(err.message, 'error');
            }
          };

          if (isLocked) {
            openModal('CODICE STANZA RICHIESTO', `
              <form id="form-mp-passcode">
                <div class="form-group">
                  <label for="inp-room-code">Inserisci Codice Universo</label>
                  <input type="text" id="inp-room-code" class="form-control" required>
                </div>
                <button type="submit" class="btn btn-green" style="width:100%;">ACCEDI</button>
              </form>
            `);
            document.getElementById('form-mp-passcode')?.addEventListener('submit', async (ev) => {
              ev.preventDefault();
              const code = document.getElementById('inp-room-code').value;
              closeModal();
              await proceedJoin(code);
            });
          } else {
            await proceedJoin('');
          }
        });
      });

      listEl.querySelectorAll('.btn-leave-online-uni').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const uniId = btn.dataset.uid;
          openModal('ABBANDONA SERVER', `
            <p style="margin-bottom:12px;">Abbandonando questo server perderai pianeti e progressi su di esso e liberi uno slot (Server ${membership.serverCount}/${membership.limit || 3}).</p>
            <div style="display:flex; gap:10px;">
              <button type="button" id="btn-confirm-leave-server" class="btn btn-red" style="flex:1;">ABBANDONA</button>
              <button type="button" id="btn-cancel-leave-server" class="btn btn-ghost" style="flex:1;">ANNULLA</button>
            </div>
          `);
          document.getElementById('btn-cancel-leave-server')?.addEventListener('click', closeModal);
          document.getElementById('btn-confirm-leave-server')?.addEventListener('click', async () => {
            try {
              await window.UniversumMP.leaveOnlineUniverse(uniId);
              closeModal();
              playSound('success');
              toast('Server abbandonato: slot liberato.', 'success');
              await UI.renderOnlineUniversesList();
            } catch (err) {
              playSound('error');
              toast(err.message, 'error');
            }
          });
        });
      });
    } catch (err) {
      listEl.innerHTML = `<div class="glass-panel" style="padding:16px;"><p style="color:#ff5252;">Errore caricamento universi: ${escapeHTML(err.message)}</p></div>`;
    }
  };

  UI.openRenamePlanetModal = function (planetIndex) {
    const uni = UI.state.currentUniverse;
    const planet = uni.planets[planetIndex];
    if (!planet) return;
    UI.openModal('RINOMINA PIANETA', `
      <form id="form-rename-planet">
        <div class="form-group">
          <label for="input-planet-name">Nuovo nome per [${planet.coords.g}:${planet.coords.s}:${planet.coords.p}]</label>
          <input type="text" id="input-planet-name" class="form-control" maxlength="24" value="${UI.escapeHTML(planet.name)}" required>
        </div>
        <div style="display:flex; gap:10px; margin-top:16px;">
          <button type="submit" class="btn btn-green" style="flex:1;">CONFERMA</button>
          <button type="button" id="cancel-rename-planet" class="btn btn-ghost">ANNULLA</button>
        </div>
      </form>
    `);

    const inp = document.getElementById('input-planet-name');
    inp?.focus();
    inp?.select();

    document.getElementById('cancel-rename-planet')?.addEventListener('click', UI.closeModal);
    document.getElementById('form-rename-planet')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const newName = window.UniversumEngine.renamePlanet(uni, planetIndex, inp.value);
        if (UI.state.isMultiplayerMode && window.UniversumMP?.renameOnlinePlanet) {
          await window.UniversumMP.renameOnlinePlanet(uni.id, planet.coords, newName);
        } else {
          await window.UniversumDB.save(uni);
        }
        UI.closeModal();
        UI.refreshPlanetSelector();
        UI.renderCurrentView();
        UI.playSound('success');
        UI.toast(`Pianeta rinominato in "${newName}"`, 'success');
      } catch (err) {
        UI.playSound('error');
        UI.toast(err.message, 'error');
      }
    });
  };

  UI.openRenameMoonModal = function (planetIndex) {
    const uni = UI.state.currentUniverse;
    const planet = uni.planets[planetIndex];
    if (!planet || !planet.moon) return;
    UI.openModal('RINOMINA LUNA', `
      <form id="form-rename-moon">
        <div class="form-group">
          <label for="input-moon-name">Nuovo nome Luna di ${UI.escapeHTML(planet.name)}</label>
          <input type="text" id="input-moon-name" class="form-control" maxlength="24" value="${UI.escapeHTML(planet.moon.name || 'Luna')}" required>
        </div>
        <div style="display:flex; gap:10px; margin-top:16px;">
          <button type="submit" class="btn btn-green" style="flex:1;">CONFERMA</button>
          <button type="button" id="cancel-rename-moon" class="btn btn-ghost">ANNULLA</button>
        </div>
      </form>
    `);

    const inp = document.getElementById('input-moon-name');
    inp?.focus();
    inp?.select();

    document.getElementById('cancel-rename-moon')?.addEventListener('click', UI.closeModal);
    document.getElementById('form-rename-moon')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const newName = window.UniversumEngine.renameMoon(uni, planetIndex, inp.value);
        if (UI.state.isMultiplayerMode && window.UniversumMP?.renameOnlineMoon) {
          await window.UniversumMP.renameOnlineMoon(uni.id, planet.coords, newName);
        } else {
          await window.UniversumDB.save(uni);
        }
        UI.closeModal();
        UI.renderCurrentView();
        UI.playSound('success');
        UI.toast(`Luna rinominata in "${newName}"`, 'success');
      } catch (err) {
        UI.playSound('error');
        UI.toast(err.message, 'error');
      }
    });
  };

  // =========================================================
  // CANVAS PANORAMICA — Luna + Bacino Spaziale orbitante
  // =========================================================
  UI.startPlanetCanvas = function (planet) {
    const st = UI.state;
    if (st.planetAnimId) {
      cancelAnimationFrame(st.planetAnimId);
      st.planetAnimId = null;
    }
    const canvas = document.getElementById('overview-planet-canvas');
    if (!canvas || !planet) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = 56;

    const temp = Number(planet.maxTemp ?? 25);
    let palette = { core: '#00c853', mid: '#0277bd', dark: '#011627', atmo: 'rgba(0, 210, 255, 0.35)', rings: false };
    if (temp < -20) {
      palette = { core: '#e0f7fa', mid: '#00b0ff', dark: '#051937', atmo: 'rgba(128, 216, 255, 0.45)', rings: true };
    } else if (temp > 50) {
      palette = { core: '#ffab00', mid: '#dd2c00', dark: '#1a0500', atmo: 'rgba(255, 110, 64, 0.4)', rings: false };
    }

    let lastPlanetFrame = 0;
    function drawFrame(timestamp = 0) {
      if (!document.getElementById('overview-planet-canvas')) return;
      st.planetAnimId = requestAnimationFrame(drawFrame);
      if (document.hidden || timestamp - lastPlanetFrame < 1000 / 24) return;
      lastPlanetFrame = timestamp;
      st.planetAnimAngle += 0.02;
      ctx.clearRect(0, 0, w, h);

      const halo = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, radius * 1.45);
      halo.addColorStop(0, palette.atmo);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.45, 0, Math.PI * 2);
      ctx.fill();

      if (palette.rings || planet.fieldsMax >= 250) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.32);
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.35)';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 1.65, radius * 0.42, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const grad = ctx.createRadialGradient(cx - radius * 0.38, cy - radius * 0.35, radius * 0.1, cx, cy, radius);
      grad.addColorStop(0, palette.core);
      grad.addColorStop(0.55, palette.mid);
      grad.addColorStop(1, palette.dark);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = grad;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

      const drift = Math.sin(st.planetAnimAngle) * 18;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.ellipse(cx + drift, cy - 18, 44, 8, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - drift * 0.8, cy + 16, 38, 6, -0.1, 0, Math.PI * 2);
      ctx.fill();

      const shadowGrad = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy + radius * 0.4);
      shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
      shadowGrad.addColorStop(0.65, 'rgba(2,2,10,0.35)');
      shadowGrad.addColorStop(1, 'rgba(2,2,10,0.88)');
      ctx.fillStyle = shadowGrad;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      ctx.restore();

      if (palette.rings || planet.fieldsMax >= 250) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.32);
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.55)';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 1.65, radius * 0.42, 0, 0, Math.PI);
        ctx.stroke();
        ctx.restore();
      }

      // === M1: Satellite orbitante — Luna oppure Bacino Spaziale attivo ===
      if (planet.moon) {
        const mx = cx + Math.cos(st.planetAnimAngle * 1.8) * (radius + 26);
        const my = cy + Math.sin(st.planetAnimAngle * 1.8) * 18;
        const mGrad = ctx.createRadialGradient(mx - 3, my - 3, 2, mx, my, 11);
        mGrad.addColorStop(0, '#eceff1');
        mGrad.addColorStop(1, '#37474f');
        ctx.fillStyle = mGrad;
        ctx.beginPath();
        ctx.arc(mx, my, 11, 0, Math.PI * 2);
        ctx.fill();
      } else if (planet.bacinoSpaziale && planet.bacinoSpaziale.status === 'active') {
        // Bacino Spaziale orbitante: orbita più lenta e più ampia della luna
        const bx = cx + Math.cos(st.planetAnimAngle * 1.2) * (radius + 32);
        const by = cy + Math.sin(st.planetAnimAngle * 1.2) * 20;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(-0.32);

        // Anello orbitale del bacino
        ctx.strokeStyle = 'rgba(0, 230, 118, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 4.8, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Bracci di attracco
        ctx.strokeStyle = '#90a4ae';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-10, 0); ctx.lineTo(-3, 0);
        ctx.moveTo(3, 0); ctx.lineTo(10, 0);
        ctx.stroke();

        // Hub centrale
        const hubGrad = ctx.createRadialGradient(-1, -1, 0.5, 0, 0, 5);
        hubGrad.addColorStop(0, '#b9f6ca');
        hubGrad.addColorStop(0.6, '#00e676');
        hubGrad.addColorStop(1, '#004d40');
        ctx.fillStyle = hubGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Alone verde del bacino attivo
        ctx.shadowColor = '#00e676';
        ctx.shadowBlur = 9;
        ctx.strokeStyle = 'rgba(0, 230, 118, 0.75)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

    }

    st.planetAnimId = requestAnimationFrame(drawFrame);
  };

  UI.refreshPlanetSelector = function () {
    const select = document.getElementById('active-planet-select');
    const uni = UI.state.currentUniverse;
    if (!select || !uni) return;
    const activeIdx = UI.getActivePlanetIndex();
    select.innerHTML = uni.planets.map((p, idx) =>
      `<option value="${p.id}" ${idx === activeIdx ? 'selected' : ''}>${UI.escapeHTML(p.name)} [${p.coords.g}:${p.coords.s}:${p.coords.p}]${p.moon ? ' [LUNA]' : ''}</option>`
    ).join('');
  };

  UI.updateTopBarNumbers = function () {
    const st = UI.state;
    const uni = st.currentUniverse;
    if (!uni) return;
    const planet = UI.getActivePlanet();
    if (!planet) return;

    const prod = window.UniversumEngine.getPlanetProduction(planet, uni);
    const mEl = document.getElementById('res-metal-val');
    const cEl = document.getElementById('res-crystal-val');
    const dEl = document.getElementById('res-deuterium-val');
    const eEl = document.getElementById('res-energy-val');

    if (uni.creativeMode && !st.isMultiplayerMode) {
      if (mEl) mEl.textContent = '∞';
      if (cEl) cEl.textContent = '∞';
      if (dEl) dEl.textContent = '∞';
      if (eEl) eEl.textContent = '∞';
    } else {
      if (mEl) mEl.textContent = UI.formatNum(planet.resources.metal);
      if (cEl) cEl.textContent = UI.formatNum(planet.resources.crystal);
      if (dEl) dEl.textContent = UI.formatNum(planet.resources.deuterium);
      if (eEl) {
        eEl.textContent = `${UI.formatNum(prod.energyBalance)} / ${UI.formatNum(prod.energyProduced)}`;
        eEl.style.color = prod.energyBalance < 0 ? 'var(--btn-red)' : 'var(--res-energy)';
      }
    }

    const turboBtn = document.getElementById('btn-turbo-toggle');
    if (turboBtn) {
      turboBtn.classList.toggle('hidden', st.isMultiplayerMode);
      const remTurbo = Math.max(0, Math.ceil(((uni.turboUntil || 0) - Date.now()) / 1000));
      if (remTurbo > 0) {
        turboBtn.classList.add('active');
        turboBtn.innerHTML = `${UI.svgIcon('bolt')} ${UI.formatDuration(remTurbo)}`;
      } else {
        turboBtn.classList.remove('active');
        turboBtn.innerHTML = `${UI.svgIcon('bolt')} TURBO`;
      }
    }
  };

  UI.startChatListeners = function () {
    const st = UI.state;
    const uni = st.currentUniverse;
    if (!st.isMultiplayerMode || !uni) return;

    if (!st.unsubChatListener && window.UniversumMP?.listenChat) {
      st.unsubChatListener = window.UniversumMP.listenChat(uni.id, (msgs) => {
        st.chatMessagesCache = msgs;
        if (st.currentView === 'chat' && st.commTab === 'galactic' && UI.renderGalacticChatMessagesDOM) {
          UI.renderGalacticChatMessagesDOM();
        }
      });
    }

    if (!st.unsubPrivateConvsListener && window.UniversumMP?.listenPrivateConversations) {
      st.unsubPrivateConvsListener = window.UniversumMP.listenPrivateConversations(
        uni.id,
        (convs, unreadCount) => {
          const prevUnread = st.unreadPrivateCount;
          st.privateConversationsCache = convs;
          st.unreadPrivateCount = unreadCount;
          UI.updateCommBadges();
          if (unreadCount > prevUnread && st.currentView !== 'chat') {
            UI.playSound('click');
            UI.toast('Nuovo messaggio privato ricevuto!', 'info');
          }
        }
      );
    }
  };

  UI.stopChatListeners = function () {
    const st = UI.state;
    if (typeof st.unsubChatListener === 'function') {
      st.unsubChatListener();
      st.unsubChatListener = null;
    }
    if (typeof st.unsubPrivateConvsListener === 'function') {
      st.unsubPrivateConvsListener();
      st.unsubPrivateConvsListener = null;
    }
    UI.closePrivateMessageStream();
  };

  UI.switchView = function (viewName) {
    if (UI.state.currentView === 'chat' && viewName !== 'chat') {
      UI.stopChatListeners();
    }

    UI.state.currentView = viewName;
    window.UniversumTutorial?.onView(viewName);
    UI.playSound('click');

    document.querySelectorAll('.sidebar-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    document.querySelectorAll('.nav-tab-btn[data-view]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    document.getElementById('mobile-menu-drawer')?.classList.add('hidden');
    UI.renderCurrentView();
  };

  UI.renderCurrentView = async function () {
    const viewport = document.getElementById('game-viewport');
    const st = UI.state;
    if (!viewport || !st.currentUniverse) return;

    if (st.planetAnimId && st.currentView !== 'overview') {
      cancelAnimationFrame(st.planetAnimId);
      st.planetAnimId = null;
    }

    switch (st.currentView) {
      case 'overview': UI.renderOverview(viewport); break;
      case 'buildings': UI.renderBuildings(viewport); break;
      case 'research': UI.renderResearch(viewport); break;
      case 'shipyard':
      case 'defense':
        if (st.currentView === 'shipyard') st.shipyardTab = 'ships';
        if (st.currentView === 'defense') st.shipyardTab = 'defense';
        UI.renderShipyardAndDefense(viewport);
        break;
      case 'fleet': UI.renderFleet(viewport); break;
      case 'movements': UI.renderFleetMovements(viewport); break;
      case 'galaxy':
        await UI.renderGalaxy(viewport);
        if (st.isMultiplayerMode && st.currentView === 'galaxy') {
          const tradeButton = document.createElement('button');
          tradeButton.type = 'button';
          tradeButton.className = 'btn btn-blue btn-sm';
          tradeButton.style.margin = '10px 0';
          tradeButton.textContent = 'COMMERCIA CON UN BOT';
          tradeButton.addEventListener('click', UI.openOnlineBotTradeModal);
          viewport.prepend(tradeButton);
        }
        break;
      case 'espionage': UI.renderEspionageAndSim(viewport); break;
      case 'reports': await UI.renderReports(viewport); break;
      case 'moon': UI.renderMoon(viewport); break;
      case 'galattica-manage': UI.renderGalatticaManageView(viewport); break;
      case 'galattica-fleet': UI.renderGalatticaFleetView(viewport); break;
      case 'guide': UI.renderGuideView(viewport); break;
      case 'diplomacy': UI.renderDiplomacy(viewport); break;
      case 'empire': UI.renderEmpire(viewport); break;
      case 'highscore': await UI.renderHighscoreAndQuests(viewport); break;
      case 'chat': await UI.renderCommunications(viewport); break;
      case 'saves': UI.renderSavesMenu(viewport); break;
      default: UI.renderOverview(viewport);
    }
  };

  // Commercio online: solo BOT neutrali e pacifici, rapporto metallo/cristallo/deuterio 3:2:1.
  UI.openOnlineBotTradeModal = function () {
    const uni = UI.state.currentUniverse;
    if (!UI.state.isMultiplayerMode || !uni) return;
    const target = UI.state.fleetTarget || { g: UI.state.galaxyG, s: UI.state.galaxyS, p: 7 };
    UI.openModal('COMMERCIO CON BOT', `
      <form id="form-online-bot-trade">
        <p class="text-muted">Seleziona le coordinate del BOT neutrale o pacifico. Scambio dal tuo primo pianeta (3 metallo = 2 cristallo = 1 deuterio).</p>
        <div class="form-grid-3">
          <div class="form-group"><label for="trade-bot-g">Galassia</label><input id="trade-bot-g" type="number" class="form-control" min="1" max="9" value="${Number(target.g) || 1}" required></div>
          <div class="form-group"><label for="trade-bot-s">Sistema</label><input id="trade-bot-s" type="number" class="form-control" min="1" max="499" value="${Number(target.s) || 1}" required></div>
          <div class="form-group"><label for="trade-bot-p">Posizione</label><input id="trade-bot-p" type="number" class="form-control" min="1" max="15" value="${Number(target.p) || 7}" required></div>
        </div>
        <div class="form-group"><label for="trade-bot-give">Risorsa da offrire</label><select id="trade-bot-give" class="form-control"><option value="metal">Metallo</option><option value="crystal">Cristallo</option><option value="deuterium">Deuterio</option></select></div>
        <div class="form-group"><label for="trade-bot-amount">Quantità da offrire (min. 100)</label><input id="trade-bot-amount" type="number" class="form-control" min="100" step="1" value="300" required></div>
        <div class="form-group"><label for="trade-bot-get">Risorsa richiesta</label><select id="trade-bot-get" class="form-control"><option value="crystal">Cristallo</option><option value="metal">Metallo</option><option value="deuterium">Deuterio</option></select></div>
        <button type="submit" class="btn btn-green" style="width:100%;">CONFERMA SCAMBIO</button>
      </form>
    `);
    document.getElementById('form-online-bot-trade')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const button = e.target.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const coords = { g: Number(document.getElementById('trade-bot-g').value),
          s: Number(document.getElementById('trade-bot-s').value), p: Number(document.getElementById('trade-bot-p').value) };
        const result = await window.UniversumMP.tradeWithOnlineBot(uni, coords,
          document.getElementById('trade-bot-give').value,
          Number(document.getElementById('trade-bot-amount').value),
          document.getElementById('trade-bot-get').value);
        await window.UniversumMP.syncPlayerState(uni, { force: true });
        UI.closeModal();
        UI.updateTopBarNumbers();
        UI.renderCurrentView();
        UI.toast(`Scambio completato: ${UI.formatNum(result.given)} ceduti, ${UI.formatNum(result.received)} ricevuti.`, 'success');
      } catch (err) {
        UI.toast(err.message || 'Scambio non riuscito.', 'error');
      } finally { button.disabled = false; }
    });
  };

  UI.renderOverview = function (viewport) {
    const { escapeHTML, formatNum, formatDuration, svgIcon, resIconTag, artTag } = UI;
    const st = UI.state;
    const uni = st.currentUniverse;
    const Data = window.UniversumData;
    const Engine = window.UniversumEngine;
    const pIdx = UI.getActivePlanetIndex();
    const planet = UI.getActivePlanet();
    const prod = Engine.getPlanetProduction(planet, uni);
    const usedFields = Data.getUsedFields(planet);
    const maxFields = Data.getMaxFields(planet);

    const incoming = uni.incomingAttacks || [];
    const flights = uni.fleetsInFlight || [];
    const messages = (uni.messages || []).slice(0, 6);

    const queueRows = [];
    if (planet.buildQueue && planet.buildQueue.length > 0) {
      const b = planet.buildQueue[0];
      const name = Data.BUILDINGS[b.id]?.name || b.id;
      queueRows.push(`
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35); padding:10px; border-radius:8px;">
          <span style="display:inline-flex; align-items:center; gap:8px;">${artTag(b.id, 'unit-art-sm', name)} <strong>${escapeHTML(name)}</strong> → Lv.${b.targetLevel}</span>
          <span class="font-display text-metal live-timer" data-end="${b.endTime}">${formatDuration((b.endTime - Date.now()) / 1000)}</span>
        </div>
      `);
    }
    if (uni.researchQueue) {
      const r = uni.researchQueue;
      const name = Data.RESEARCHES[r.id]?.name || r.id;
      queueRows.push(`
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35); padding:10px; border-radius:8px;">
          <span style="display:inline-flex; align-items:center; gap:8px;">${artTag(r.id, 'unit-art-sm', name)} <strong>${escapeHTML(name)}</strong> → Lv.${r.targetLevel}</span>
          <span class="font-display text-crystal live-timer" data-end="${r.endTime}">${formatDuration((r.endTime - Date.now()) / 1000)}</span>
        </div>
      `);
    }
    if (planet.shipyardQueue && planet.shipyardQueue.length > 0) {
      const sq = planet.shipyardQueue[0];
      const name = Data.SHIPS[sq.id]?.name || sq.id;
      queueRows.push(`
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35); padding:10px; border-radius:8px;">
          <span style="display:inline-flex; align-items:center; gap:8px;">${artTag(sq.id, 'unit-art-sm', name)} <strong>${escapeHTML(name)}</strong> (Rimanenti: ${sq.remaining})</span>
          <span class="font-display text-energy live-timer" data-end="${sq.endTime}">${formatDuration((sq.endTime - Date.now()) / 1000)}</span>
        </div>
      `);
    }
    if (planet.defenseQueue && planet.defenseQueue.length > 0) {
      const dq = planet.defenseQueue[0];
      const name = Data.DEFENSES[dq.id]?.name || dq.id;
      queueRows.push(`
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35); padding:10px; border-radius:8px;">
          <span style="display:inline-flex; align-items:center; gap:8px;">${artTag(dq.id, 'unit-art-sm', name)} <strong>${escapeHTML(name)}</strong> (Rimanenti: ${dq.remaining})</span>
          <span class="font-display text-energy live-timer" data-end="${dq.endTime}">${formatDuration((dq.endTime - Date.now()) / 1000)}</span>
        </div>
      `);
    }

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        ${incoming.length > 0 ? `
          <div class="glass-panel" style="padding:14px; border-color:var(--btn-red); background:rgba(255,23,68,0.18);">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
              <strong style="color:#ff5252; font-family:var(--font-display);">${svgIcon('alert')} ALLARME ATTACCO OSTILE IN ARRIVO (${incoming.length})</strong>
              <span class="badge badge-red live-timer" data-end="${incoming[0].arrivalTime}">--:--</span>
            </div>
            <p style="font-size:0.95rem; margin-top:6px;">${escapeHTML(incoming[0].attackerName)} diretto verso [${incoming[0].targetCoords.g}:${incoming[0].targetCoords.s}:${incoming[0].targetCoords.p}]</p>
          </div>
        ` : ''}

        <div class="glass-panel" style="padding:16px;">
          <div style="display:flex; flex-wrap:wrap; align-items:center; gap:16px;">
            <canvas id="overview-planet-canvas" width="170" height="170" style="flex-shrink:0; margin:0 auto;"></canvas>
            <div style="flex:1; min-width:220px;">
              <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:8px;">
                <h2 style="font-size:1.3rem; color:#fff;">${escapeHTML(planet.name)}</h2>
                <button type="button" id="btn-rename-active-planet" class="btn btn-blue btn-sm" style="min-width:44px; min-height:44px;">${svgIcon('edit')} Rinomina</button>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:0.95rem;">
                <div>Coordinate: <strong class="text-crystal">[${planet.coords.g}:${planet.coords.s}:${planet.coords.p}]</strong></div>
                <div>Campi: <strong>${usedFields} / ${maxFields}</strong></div>
                <div>Temperatura: <strong>${planet.minTemp}°C / ${planet.maxTemp}°C</strong></div>
                <div>Velocità: <strong class="text-metal">${Engine.getEffectiveSpeed(uni)}x</strong></div>
              </div>
              ${!st.isMultiplayerMode ? `
                <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;">
                  <button type="button" id="btn-overview-turbo" class="btn btn-creative btn-sm">${svgIcon('bolt')} TURBO (2x VELOCITÀ)</button>
                  <button type="button" id="btn-overview-event" class="btn btn-blue btn-sm">${svgIcon('radar')} SCANSIONE EVENTO</button>
                </div>
              ` : `
                <div style="margin-top:12px;">
                  <button type="button" id="btn-overview-open-chat" class="btn btn-blue btn-sm">${svgIcon('chat')} APRI COMUNICAZIONI</button>
                </div>
              `}
            </div>
          </div>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:0.95rem; color:var(--res-crystal); margin-bottom:10px;">PRODUZIONE ORARIA PIANETA</h3>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; text-align:center;">
            <div style="background:rgba(0,0,0,0.35); padding:8px; border-radius:8px;">
              <div class="text-muted" style="font-size:0.8rem; display:inline-flex; align-items:center;">${resIconTag('metal')} METALLO/H</div>
              <div class="font-display text-metal" style="font-size:0.95rem;">+${formatNum(prod.metalPerHour)}</div>
            </div>
            <div style="background:rgba(0,0,0,0.35); padding:8px; border-radius:8px;">
              <div class="text-muted" style="font-size:0.8rem; display:inline-flex; align-items:center;">${resIconTag('crystal')} CRISTALLO/H</div>
              <div class="font-display text-crystal" style="font-size:0.95rem;">+${formatNum(prod.crystalPerHour)}</div>
            </div>
            <div style="background:rgba(0,0,0,0.35); padding:8px; border-radius:8px;">
              <div class="text-muted" style="font-size:0.8rem; display:inline-flex; align-items:center;">${resIconTag('deuterium')} DEUTERIO/H</div>
              <div class="font-display text-deuterium" style="font-size:0.95rem;">${prod.deuteriumPerHour >= 0 ? '+' : ''}${formatNum(prod.deuteriumPerHour)}</div>
            </div>
          </div>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:0.95rem; color:var(--res-crystal); margin-bottom:10px;">CODE DI PRODUZIONE & RICERCA</h3>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${queueRows.length > 0 ? queueRows.join('') : '<p class="text-muted">Nessuna costruzione o ricerca in corso.</p>'}
          </div>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:0.95rem; color:var(--res-crystal); margin-bottom:10px;">MOVIMENTI FLOTTA (${flights.length})</h3>
          ${flights.length === 0 ? '<p class="text-muted">Nessuna flotta in transito.</p>' : `
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${flights.map((f) => {
                const targetTs = f.status === 'outbound' ? f.arrivalTime : f.returnTime;
                return `
                  <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35); padding:10px; border-radius:8px;">
                    <div>
                      <strong style="text-transform:uppercase; color:var(--res-crystal);">${escapeHTML(f.mission)}</strong>
                      <span class="badge ${f.status === 'outbound' ? 'badge-green' : 'badge-blue'}">${f.status === 'outbound' ? 'ANDATA' : 'RIENTRO'}</span>
                      <div class="text-muted" style="font-size:0.85rem;">[${f.originCoords.g}:${f.originCoords.s}:${f.originCoords.p}] → [${f.targetCoords.g}:${f.targetCoords.s}:${f.targetCoords.p}]</div>
                    </div>
                    <span class="font-display text-energy live-timer" data-end="${targetTs}">--:--</span>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:0.95rem; color:var(--res-crystal); margin-bottom:10px;">DIARIO DI BORDO</h3>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${messages.map((m) => `
              <div style="border-left:3px solid ${m.type === 'combat' ? 'var(--btn-red)' : 'var(--btn-blue)'}; padding-left:10px;">
                <div style="font-weight:700; font-size:0.95rem;">${escapeHTML(m.title)}</div>
                ${m.time ? `<div class="text-muted" style="font-size:0.78rem;">${new Date(m.time).toLocaleString('it-IT')}${m.type ? ` • ${escapeHTML(String(m.type).toUpperCase())}` : ''}</div>` : ''}
                <div class="text-muted" style="font-size:0.88rem; white-space:pre-line;">${escapeHTML(m.body)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    UI.startPlanetCanvas(planet);

    document.getElementById('btn-rename-active-planet')?.addEventListener('click', () => UI.openRenamePlanetModal(pIdx));
    document.getElementById('btn-overview-open-chat')?.addEventListener('click', () => UI.switchView('chat'));

    document.getElementById('btn-overview-turbo')?.addEventListener('click', async () => {
      const res = Engine.activateTurbo(uni);
      await UI.persistUniverseState();
      UI.updateTopBarNumbers();
      UI.renderCurrentView();
      UI.playSound('success');
      UI.toast(`TURBO 2x attivo per ${formatDuration(res.remainingSec)}!`, 'creative');
    });

    document.getElementById('btn-overview-event')?.addEventListener('click', async () => {
      const bonusM = Math.floor((1500 + Math.random() * 4500) * Math.sqrt(uni.speed || 1));
      const bonusC = Math.floor((1000 + Math.random() * 3000) * Math.sqrt(uni.speed || 1));
      planet.resources.metal += bonusM;
      planet.resources.crystal += bonusC;
      await UI.persistUniverseState();
      UI.updateTopBarNumbers();
      UI.playSound('success');
      UI.toast(`Capsula cargo intercettata: +${formatNum(bonusM)} M, +${formatNum(bonusC)} C!`, 'success');
    });
  };

  UI.renderSavesMenu = function (viewport) {
    const st = UI.state;
    const uni = st.currentUniverse;
    viewport.innerHTML = `
      <div class="glass-panel" style="padding:18px; display:flex; flex-direction:column; gap:12px;">
        <h2 style="font-size:1.1rem; color:var(--res-crystal);">GESTIONE PARTITA & SISTEMA</h2>
        <p class="text-muted">Universo attivo: <strong style="color:#fff;">${UI.escapeHTML(uni.name)}</strong> (${st.isMultiplayerMode ? 'ONLINE PvP' : 'OFFLINE'})</p>

        <button type="button" id="btn-save-now" class="btn btn-green">${UI.svgIcon('save')} SINCRONIZZA / SALVA ORA</button>
        ${st.isMultiplayerMode && (uni.fleetsInFlight || []).some((f) => !f.resolved) ? `
          <div style="background:rgba(255,170,0,0.12); border:1px solid rgba(255,170,0,0.5); border-radius:8px; padding:10px; font-size:0.9rem;">
            <strong style="color:var(--btn-gold);">Avviso deploy:</strong> Ci sono missioni in corso, il deploy potrebbe bloccarle. Le missioni sono salvate su Firestore (partenza/arrivo/flotta/risorse) e verranno migrate/riprese dopo il deploy.
          </div>
        ` : ''}
        ${st.isMultiplayerMode ? `<button type="button" id="btn-repair-missions" class="btn btn-creative">Ripara missioni bloccate</button>` : ''}
        ${!st.isMultiplayerMode ? `
          <button type="button" id="btn-export-download" class="btn btn-blue">SCARICA BACKUP JSON</button>
          <button type="button" id="btn-export-copy" class="btn btn-ghost">COPIA JSON NEGLI APPUNTI</button>
        ` : ''}
        <button type="button" id="btn-toggle-sound" class="btn btn-ghost">${st.soundMuted ? 'SUONI: DISATTIVATI (ATTIVA)' : 'SUONI: ATTIVI (DISATTIVA)'}</button>
        ${st.isMultiplayerMode ? `
          <div style="border-top:1px solid rgba(255,82,82,0.35); padding-top:12px; display:flex; flex-direction:column; gap:8px;">
            <h3 style="font-size:0.95rem; color:#ff5252;">IMPOSTAZIONI SERVER</h3>
            <button type="button" id="btn-leave-server-view" class="btn btn-ghost">Abbandona Server (libera uno slot)</button>
            ${(uni.founderUid || uni.ownerUid) && window.fbAuth?.currentUser?.uid && (uni.founderUid === window.fbAuth.currentUser.uid || uni.ownerUid === window.fbAuth.currentUser.uid) ? `
              <button type="button" id="btn-delete-server-view" class="btn btn-red">Elimina Server (solo creatore)</button>
            ` : ''}
          </div>
        ` : ''}
        <button type="button" id="btn-return-lobby-view" class="btn btn-red">${UI.svgIcon('home')} TORNA ALLA LOBBY PRINCIPALE</button>
      </div>
    `;

    document.getElementById('btn-leave-server-view')?.addEventListener('click', async () => {
      try {
        await window.UniversumMP.leaveOnlineUniverse(uni.id);
        UI.playSound('success');
        UI.toast('Server abbandonato: slot liberato.', 'success');
        await UI.exitToLobbyAfterServerRemoval();
      } catch (err) {
        UI.playSound('error');
        UI.toast(err.message, 'error');
      }
    });

    document.getElementById('btn-delete-server-view')?.addEventListener('click', () => {
      UI.openModal('ELIMINA SERVER', `
        <p style="margin-bottom:10px; color:#ff5252;"><strong>Sei sicuro? Eliminerai il server per TUTTI i giocatori. Questa azione è irreversibile. Scrivi ELIMINA per confermare.</strong></p>
        <div class="form-group">
          <label for="input-delete-server-confirm">Conferma testuale (doppia conferma)</label>
          <input type="text" id="input-delete-server-confirm" class="form-control" placeholder="ELIMINA" autocomplete="off">
        </div>
        <div style="display:flex; gap:10px; margin-top:14px;">
          <button type="button" id="btn-confirm-delete-server" class="btn btn-red" style="flex:1;" disabled>ELIMINA DEFINITIVAMENTE</button>
          <button type="button" id="btn-cancel-delete-server" class="btn btn-ghost" style="flex:1;">ANNULLA</button>
        </div>
      `);
      const confirmInput = document.getElementById('input-delete-server-confirm');
      const confirmBtn = document.getElementById('btn-confirm-delete-server');
      confirmInput?.addEventListener('input', () => {
        if (confirmBtn) confirmBtn.disabled = confirmInput.value.trim() !== 'ELIMINA';
      });
      document.getElementById('btn-cancel-delete-server')?.addEventListener('click', UI.closeModal);
      confirmBtn?.addEventListener('click', async () => {
        if (confirmInput?.value.trim() !== 'ELIMINA') return;
        try {
          await window.UniversumMP.deleteOnlineUniverse(uni.id);
          UI.closeModal();
          UI.playSound('success');
          UI.toast('Server eliminato per tutti i giocatori. Slot liberati.', 'success');
          await UI.exitToLobbyAfterServerRemoval();
        } catch (err) {
          UI.playSound('error');
          UI.toast(err.message, 'error');
        }
      });
    });

    document.getElementById('btn-repair-missions')?.addEventListener('click', async () => {
      try {
        const repaired = window.UniversumMP?.repairStuckMissions
          ? await window.UniversumMP.repairStuckMissions(uni.id)
          : 0;
        UI.playSound('success');
        UI.toast(repaired > 0 ? `Missioni bloccate riparate: ${repaired}. Flotte restituite ai pianeti di partenza.` : 'Nessuna missione bloccata da riparare.', 'success');
        UI.renderCurrentView();
      } catch (err) {
        UI.playSound('error');
        UI.toast(err.message, 'error');
      }
    });

    document.getElementById('btn-save-now')?.addEventListener('click', async () => {
      await UI.persistUniverseState();
      UI.playSound('success');
      UI.toast(st.isMultiplayerMode ? 'Dati sincronizzati con Firestore!' : 'Partita salvata su IndexedDB!', 'success');
    });

    document.getElementById('btn-export-download')?.addEventListener('click', async () => {
      const json = await window.UniversumDB.exportJSON(uni.id);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `UNIVERSUM_${uni.name.replace(/[^a-z0-9]/gi, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      UI.toast('File JSON scaricato.', 'success');
    });

    document.getElementById('btn-export-copy')?.addEventListener('click', async () => {
      const json = await window.UniversumDB.exportJSON(uni.id);
      await navigator.clipboard.writeText(json);
      UI.toast('Salvataggio JSON copiato negli appunti!', 'success');
    });

    document.getElementById('btn-toggle-sound')?.addEventListener('click', () => {
      st.soundMuted = !st.soundMuted;
      localStorage.setItem('universum_muted', String(st.soundMuted));
      if (!st.soundMuted) UI.playSound('click');
      UI.renderCurrentView();
    });

    document.getElementById('btn-return-lobby-view')?.addEventListener('click', async () => {
      await UI.exitActiveGameToLobby();
    });
  };

  UI.exitActiveGameToLobby = async function () {
    const st = UI.state;
    if (st.currentUniverse) {
      await UI.persistUniverseState();
    }
    UI.stopGameLoop();
    UI.cleanupMultiplayerListeners();
    st.isMultiplayerMode = false;
    st.currentUniverse = null;
    window.UniversumTutorial?.clear();

    document.getElementById('screen-game')?.classList.add('hidden');
    document.getElementById('screen-lobby')?.classList.remove('hidden');
    await window.UniversumDB.renderLobbyList();
  };

  UI.exitToLobbyAfterServerRemoval = async function () {
    const st = UI.state;
    UI.stopGameLoop();
    UI.cleanupMultiplayerListeners();
    st.isMultiplayerMode = false;
    st.currentUniverse = null;
    document.getElementById('screen-game')?.classList.add('hidden');
    document.getElementById('screen-lobby')?.classList.remove('hidden');
    await window.UniversumDB.renderLobbyList();
    await UI.refreshOnlineLobbyState();
  };

  UI.cleanupMultiplayerListeners = function () {
    const st = UI.state;
    UI.stopChatListeners();
    if (typeof st.unsubServerListener === 'function') {
      st.unsubServerListener();
      st.unsubServerListener = null;
    }
    if (typeof st.unsubFleetsListener === 'function') {
      st.unsubFleetsListener();
      st.unsubFleetsListener = null;
    }
    if (typeof st.unsubOwnFleetsListener === 'function') {
      st.unsubOwnFleetsListener();
      st.unsubOwnFleetsListener = null;
    }
    if (typeof st.unsubOwnPlanetsListener === 'function') {
      st.unsubOwnPlanetsListener();
      st.unsubOwnPlanetsListener = null;
    }
    if (UI._reconcileTimer) {
      clearTimeout(UI._reconcileTimer);
      UI._reconcileTimer = null;
    }
    UI._resetSyncRetry?.();

    st.chatMessagesCache = [];
    st.privateConversationsCache = [];
    st.unreadPrivateCount = 0;
    st.activePrivateTarget = null;
    UI.updateCommBadges();
  };

  UI.stopGameLoop = function () {
    const st = UI.state;
    if (st.gameLoopTimer) {
      clearInterval(st.gameLoopTimer);
      st.gameLoopTimer = null;
    }
    if (st.planetAnimId) {
      cancelAnimationFrame(st.planetAnimId);
      st.planetAnimId = null;
    }
  };

  UI.startGameLoop = function () {
    UI.stopGameLoop();
    const st = UI.state;
    let mpTickCounter = 0;

    st.gameLoopTimer = setInterval(async () => {
      const uni = st.currentUniverse;
      if (!uni) return;

      const activeP = UI.getActivePlanet();
      const prevQueueCount = (activeP?.buildQueue?.length || 0) +
        (activeP?.shipyardQueue?.length || 0) +
        (activeP?.defenseQueue?.length || 0) +
        (uni.researchQueue ? 1 : 0);

      window.UniversumEngine.tick(uni, 1);

      if (st.isMultiplayerMode) {
        mpTickCounter++;
        if (mpTickCounter % 3 === 0 && window.UniversumMP?.resolveArrivedOnlineFleets) {
          window.UniversumMP.resolveArrivedOnlineFleets(uni.id).catch(() => {});
        }
        if (mpTickCounter % 30 === 0 && window.UniversumMP?.processOnlineOccupations) {
          window.UniversumMP.processOnlineOccupations(uni.id).catch(() => {});
        }
        if (mpTickCounter % 60 === 0) {
          UI.persistUniverseState().catch(() => {});
          if (window.UniversumMP?.maybeLaunchBotRaid) {
            window.UniversumMP.maybeLaunchBotRaid(uni.id).catch((e) => console.warn('[MP Bot] Raid:', e));
          }
        }
      } else {
        window.UniversumGalaxy.processFleetsAndBots(uni);
      }

      const newQueueCount = (activeP?.buildQueue?.length || 0) +
        (activeP?.shipyardQueue?.length || 0) +
        (activeP?.defenseQueue?.length || 0) +
        (uni.researchQueue ? 1 : 0);

      if (newQueueCount < prevQueueCount) {
        UI.playSound('complete');
        if (st.isMultiplayerMode) UI.persistUniverseState().catch(() => {});
        if (['overview', 'buildings', 'research', 'shipyard'].includes(st.currentView)) {
          UI.renderCurrentView();
        }
      }

      const atkCount = (uni.incomingAttacks || []).length;
      if (atkCount > st.lastAlertCount) {
        UI.playSound('alarm');
        UI.toast('ALLARME RADAR: Flotta ostile in arrivo sul tuo pianeta!', 'error');
      }
      st.lastAlertCount = atkCount;

      if (document.hidden) return; // Mantieni la simulazione, evita soltanto il lavoro DOM.
      UI.updateTopBarNumbers();
      if (!st.isMultiplayerMode) window.UniversumTutorial?.check();
      UI.refreshAffordabilityButtons?.();
      document.querySelectorAll('.live-timer').forEach((el) => {
        const endTs = Number(el.dataset.end || 0);
        const remSec = Math.max(0, Math.ceil((endTs - Date.now()) / 1000));
        el.textContent = UI.formatDuration(remSec);
      });
    }, 1000);
  };

  UI.configureGameShellUI = function () {
    const st = UI.state;
    const uni = st.currentUniverse;
    document.getElementById('screen-lobby')?.classList.add('hidden');
    document.getElementById('screen-game')?.classList.remove('hidden');

    const mpBadge = document.getElementById('mp-live-badge');
    if (mpBadge) mpBadge.classList.toggle('hidden', !st.isMultiplayerMode);

    const creativeBar = document.getElementById('creative-quick-bar');
    if (creativeBar) {
      creativeBar.classList.toggle('hidden', st.isMultiplayerMode || !uni.creativeMode);
    }

    const sbComm = document.querySelector('.sidebar-btn[data-view="chat"]');
    if (sbComm) {
      sbComm.classList.toggle('hidden', !st.isMultiplayerMode);
      sbComm.innerHTML = `${UI.svgIcon('chat')}<span class="sidebar-comm-label">Comunicazioni</span><span id="sidebar-chat-badge" class="badge badge-red ${st.unreadPrivateCount > 0 ? '' : 'hidden'}">${st.unreadPrivateCount}</span>`;
    }

    const drComm = document.querySelector('.drawer-item[data-view="chat"]');
    if (drComm) {
      drComm.classList.toggle('hidden', !st.isMultiplayerMode);
      drComm.innerHTML = `<span class="icon">${UI.svgIcon('chat')}</span><span>Comunicazioni</span> <span id="drawer-chat-badge" class="badge badge-red ${st.unreadPrivateCount > 0 ? '' : 'hidden'}" style="position:absolute; top:6px; right:6px;">${st.unreadPrivateCount}</span>`;
    }
  };

  UI.startGame = function (universe) {
    UI.cleanupMultiplayerListeners();
    const st = UI.state;
    st.isMultiplayerMode = false;
    st.currentUniverse = universe;

    const offlineReport = window.UniversumEngine.processOfflineProgress(universe);
    window.UniversumGalaxy.processFleetsAndBots(universe);

    const home = universe.planets[0];
    if (home) {
      st.galaxyG = home.coords.g;
      st.galaxyS = home.coords.s;
      st.fleetTarget = { g: home.coords.g, s: home.coords.s, p: home.coords.p };
    }
    st.lastAlertCount = (universe.incomingAttacks || []).length;

    UI.configureGameShellUI();
    UI.refreshPlanetSelector();
    UI.updateTopBarNumbers();
    UI.switchView('overview');
    UI.startGameLoop();
    window.UniversumTutorial?.onStart();

    if (!universe.creativeMode && offlineReport.offlineSeconds >= 30) {
      const unitNames = Object.entries(offlineReport.completedUnits)
        .map(([k, v]) => `${v}× ${k}`)
        .join(', ');

      UI.openModal('RAPPORTO DI ASSENZA OFFLINE', `
        <p style="margin-bottom:10px;">Bentornato Imperatore! Tempo trascorso offline: <strong>${UI.formatDuration(offlineReport.offlineSeconds)}</strong>.</p>
        <div style="background:rgba(0,0,0,0.4); padding:12px; border-radius:8px; margin-bottom:12px;">
          <div>Metallo estratto: <strong class="text-metal">+${UI.formatNum(offlineReport.gained.metal)}</strong></div>
          <div>Cristallo estratto: <strong class="text-crystal">+${UI.formatNum(offlineReport.gained.crystal)}</strong></div>
          <div>Deuterio estratto: <strong class="text-deuterium">+${UI.formatNum(offlineReport.gained.deuterium)}</strong></div>
        </div>
        ${offlineReport.completedBuildings.length > 0 ? `<p style="font-size:0.9rem; margin-bottom:6px;">Edifici completati: <strong>${UI.escapeHTML(offlineReport.completedBuildings.join(', '))}</strong></p>` : ''}
        ${offlineReport.completedResearches.length > 0 ? `<p style="font-size:0.9rem; margin-bottom:6px;">Ricerche completate: <strong>${UI.escapeHTML(offlineReport.completedResearches.join(', '))}</strong></p>` : ''}
        ${unitNames ? `<p style="font-size:0.9rem;">Unità costruite: <strong>${UI.escapeHTML(unitNames)}</strong></p>` : ''}
      `);
    }
  };

  UI.startOnlineGame = function (universe) {
    UI.cleanupMultiplayerListeners();
    const st = UI.state;
    st.isMultiplayerMode = true;
    st.currentUniverse = universe;
    universe.creativeMode = false;

    const home = universe.planets[0];
    if (home) {
      st.galaxyG = home.coords.g;
      st.galaxyS = home.coords.s;
      st.fleetTarget = { g: home.coords.g, s: home.coords.s, p: home.coords.p };
    }

    if (window.UniversumMP?.listenUniverseDeleted) {
      st.unsubServerListener = window.UniversumMP.listenUniverseDeleted(universe.id, async () => {
        if (UI.state.currentUniverse?.id !== universe.id) return;
        UI.toast('Il server e stato eliminato dal creatore.', 'error');
        await UI.exitToLobbyAfterServerRemoval();
      });
    }

    if (window.UniversumMP?.listenIncomingFleets) {
      st.unsubFleetsListener = window.UniversumMP.listenIncomingFleets(universe, (incomingList) => {
        universe.incomingAttacks = incomingList;
        if (incomingList.length > st.lastAlertCount) {
          UI.playSound('alarm');
          const hasBot = incomingList.some((f) => String(f.attackerUid || '').startsWith('npc_raid_'));
          UI.toast(hasBot ? 'RADAR: Raid BOT in arrivo sul tuo pianeta!' : 'RADAR PvP: Un giocatore ha lanciato una flotta verso di te!', 'error');
        }
        st.lastAlertCount = incomingList.length;
        if (st.currentView === 'overview') UI.renderCurrentView();
      });
    }

    // FIX 4.2 — Le flotte proprie si aggiornano da sole (partenza, ritorno, rientro assedi)
    if (window.UniversumMP?.listenOwnFleets) {
      st.unsubOwnFleetsListener = window.UniversumMP.listenOwnFleets(universe, (ownList) => {
        if (UI.state.currentUniverse !== universe) return;
        universe.fleetsInFlight = ownList;
        if (['overview', 'movements'].includes(st.currentView)) UI.renderCurrentView();
      });
    }

    // FIX 2.9 — Pianeti propri: variazioni in arrivo, pianeti persi (conquista) o acquisiti
    if (window.UniversumMP?.listenOwnPlanets) {
      st.unsubOwnPlanetsListener = window.UniversumMP.listenOwnPlanets(universe, ({ gained, needSync }) => {
        if (UI.state.currentUniverse !== universe) return;
        if (gained.length > 0) {
          gained.forEach((p) => UI.toast(`Nuovo pianeta nel tuo impero: ${p.name}`, 'success'));
          UI.refreshPlanetSelector?.();
        }
        if (needSync) UI._requestReconcileSync();
        else if (gained.length > 0 && st.currentView === 'overview') UI.renderCurrentView();
      });
    }

    UI.configureGameShellUI();
    UI.refreshPlanetSelector();
    UI.updateTopBarNumbers();
    UI.switchView('overview');
    UI.startGameLoop();
  };

  UI.bindGlobalUIEvents = function () {
    const st = UI.state;
    document.getElementById('active-planet-select')?.addEventListener('change', (e) => {
      if (!st.currentUniverse) return;
      st.currentUniverse.activePlanetId = e.target.value;
      UI.updateTopBarNumbers();
      UI.renderCurrentView();
      UI.playSound('click');
    });

    document.getElementById('btn-turbo-toggle')?.addEventListener('click', async () => {
      if (!st.currentUniverse || st.isMultiplayerMode) return;
      const res = window.UniversumEngine.activateTurbo(st.currentUniverse);
      await UI.persistUniverseState();
      UI.updateTopBarNumbers();
      UI.playSound('success');
      UI.toast(`TURBO 2x attivo (${UI.formatDuration(res.remainingSec)})!`, 'creative');
    });

    document.querySelectorAll('#creative-quick-bar [data-creative]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!st.currentUniverse || st.isMultiplayerMode) return;
        try {
          const msg = window.UniversumEngine.applyCreativeCheat(
            st.currentUniverse,
            UI.getActivePlanetIndex(),
            btn.dataset.creative
          );
          await UI.persistUniverseState();
          UI.updateTopBarNumbers();
          UI.renderCurrentView();
          UI.playSound('complete');
          UI.toast(msg, 'creative');
        } catch (err) {
          UI.toast(err.message, 'error');
        }
      });
    });

    document.querySelectorAll('.sidebar-btn[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => UI.switchView(btn.dataset.view));
    });

    document.querySelectorAll('.nav-tab-btn[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => UI.switchView(btn.dataset.view));
    });

    const drawer = document.getElementById('mobile-menu-drawer');
    document.getElementById('btn-mobile-menu')?.addEventListener('click', () => {
      UI.playSound('click');
      drawer?.classList.remove('hidden');
    });
    document.getElementById('btn-close-drawer')?.addEventListener('click', () => {
      drawer?.classList.add('hidden');
    });
    drawer?.addEventListener('click', (e) => {
      if (e.target === drawer) drawer.classList.add('hidden');
    });

    document.querySelectorAll('.drawer-item[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => UI.switchView(btn.dataset.view));
    });

    document.getElementById('drawer-btn-lobby')?.addEventListener('click', () => {
      drawer?.classList.add('hidden');
      UI.switchView('saves');
    });

    document.getElementById('btn-back-lobby')?.addEventListener('click', async () => {
      await UI.exitActiveGameToLobby();
    });

    if (window.UniversumEngine && typeof window.UniversumEngine.bindAutoSave === 'function') {
      window.UniversumEngine.bindAutoSave(() => (st.isMultiplayerMode ? null : st.currentUniverse));
    }
  };

  UI.init = function () {
    UI.generateDynamicPWAIcon();
    UI.setupLobbyTabs();
    UI.bindGlobalUIEvents();
  };

  document.addEventListener('DOMContentLoaded', UI.init);

  UI.initSciFiSelects = function () {
    let activeMenu = null;
    let activeWrap = null;

    function closeMenu() {
      if (activeMenu) activeMenu.classList.remove('open');
      if (activeWrap) activeWrap.classList.remove('open');
      activeMenu = null;
      activeWrap = null;
    }

    function enhanceSelect(sel) {
      if (!sel || sel.dataset.uniEnhanced === '1') return;
      sel.dataset.uniEnhanced = '1';

      const wrap = document.createElement('div');
      wrap.className = 'uni-select-wrap';
      if (sel.style.width) wrap.style.width = sel.style.width;

      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'uni-select-trigger';
      trigger.disabled = sel.disabled;

      const menu = document.createElement('div');
      menu.className = 'uni-select-menu';
      document.body.appendChild(menu);

      const syncFromSelect = () => {
        const chosen = sel.options[sel.selectedIndex];
        trigger.textContent = chosen ? chosen.textContent : '';
        trigger.disabled = sel.disabled;
        menu.innerHTML = '';

        Array.from(sel.options).forEach((opt, idx) => {
          const item = document.createElement('div');
          item.className = 'uni-select-option' +
            (idx === sel.selectedIndex ? ' selected' : '') +
            (opt.disabled ? ' disabled' : '');
          item.textContent = opt.textContent;
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (opt.disabled) return;
            sel.selectedIndex = idx;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            syncFromSelect();
            closeMenu();
          });
          menu.appendChild(item);
        });
      };

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (sel.disabled) return;
        const wasOpen = menu.classList.contains('open');
        closeMenu();
        if (wasOpen) return;

        syncFromSelect();
        const rect = trigger.getBoundingClientRect();
        const maxMenuWidth = window.innerWidth - 16;
        const menuWidth = Math.min(maxMenuWidth, Math.max(rect.width, 180));
        menu.style.width = `${menuWidth}px`;
        menu.style.left = `${Math.min(window.innerWidth - menuWidth - 8, Math.max(8, rect.left))}px`;

        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < 220 && rect.top > 240) {
          menu.style.top = 'auto';
          menu.style.bottom = `${window.innerHeight - rect.top + 6}px`;
        } else {
          menu.style.bottom = 'auto';
          menu.style.top = `${rect.bottom + 6}px`;
        }

        menu.classList.add('open');
        wrap.classList.add('open');
        activeMenu = menu;
        activeWrap = wrap;
      });

      sel.style.display = 'none';
      sel.parentNode.insertBefore(wrap, sel.nextSibling);
      wrap.appendChild(trigger);
      syncFromSelect();

      const optObserver = new MutationObserver(syncFromSelect);
      optObserver.observe(sel, { childList: true, subtree: true, attributes: true });
    }

    const scanAll = () => {
      document.querySelectorAll('select').forEach(enhanceSelect);
    };

    document.addEventListener('click', closeMenu);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', (e) => {
      if (activeMenu && e.target !== activeMenu && !activeMenu.contains(e.target)) {
        closeMenu();
      }
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });

    const domObserver = new MutationObserver(() => scanAll());
    domObserver.observe(document.body, { childList: true, subtree: true });
    scanAll();
  };

  document.addEventListener('DOMContentLoaded', () => {
    UI.initSciFiSelects();
  });
})();