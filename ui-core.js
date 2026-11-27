/** UNIVERSUM / ui-core.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';

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
    if (UI.pendingDeparture?.()) return;
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


  // AT05: ammissione delle azioni volontarie e pannello di recupero comune.
  UI.pendingDeparture = function (u = UI.state.currentUniverse) {
    if (!u || !UI.state.isMultiplayerMode) return null;
    const G=window.__UniversumMPModules;
    try {
      const p=G?.ordinaryDepartureStatus?.(u);
      if (p) return {...p,busy:G.ordinaryDepartureBusy(u)};
      if (G?.ordinaryCheckpointBlocked?.(u,null)) return {storageUnavailable:true};
      return null;
    } catch (error) { return {storageUnavailable:true}; }
  };
  UI.blockPendingMutation = function (u = UI.state.currentUniverse) {
    if (u && UI.state.currentUniverse!==u) {
      UI.toast('Partita cambiata: riapri la schermata.','info');
      return true;
    }
    if (!UI.pendingDeparture(u)) return false;
    UI.toast('Partenza in verifica: verifica l’esito prima di continuare.','info');
    return true;
  };
  UI._ordinaryEntryGeneration=0;
  UI.updateOrdinaryDeparturePanel = function () {
    const viewport=document.getElementById('game-viewport');
    if (!viewport) return false;
    const uni=UI.state.currentUniverse,p=UI.pendingDeparture(uni);
    let panel=document.getElementById('at05-ordinary-departure-panel');
    if (!p) {
      if (panel) { panel.remove(); viewport.classList.remove('hidden'); }
      return false;
    }
    const signature=JSON.stringify([uni?.id,p.operationId,p.busy,p.storageUnavailable,p.armed,p.expectedRevision,p.profileJoinedAt]);
    if (panel?.dataset.signature===signature) return true;
    if (!panel) {
      panel=document.createElement('div');panel.id='at05-ordinary-departure-panel';
      panel.className='glass-panel';panel.style.padding='18px';viewport.before(panel);
      UI.closeModal();UI.closeResourceDeposit?.();UI.stopPlanetCanvas?.();UI._resetSyncRetry?.();
      if (UI._reconcileTimer) { clearTimeout(UI._reconcileTimer);UI._reconcileTimer=null; }
    }
    viewport.classList.add('hidden');
    panel.dataset.signature=signature;
    const cancellable=p.protocol===2 && p.armed && Number.isSafeInteger(p.expectedRevision) && p.profileJoinedAt!=null;
    panel.innerHTML=`<h3>PARTENZA IN VERIFICA</h3>
      <p class="text-muted">${p.storageUnavailable ? 'Memoria locale non disponibile. I salvataggi sono sospesi.' : p.busy ? 'Operazione in corso. Non ripetere l’invio.' : 'La partita è sospesa fino alla verifica dell’esito e al recupero dal server.'}</p>
      ${p.operationId ? `<p>ID: ${UI.escapeHTML(p.operationId)}</p>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
      <button type="button" class="btn btn-green" data-at05-control="verify" ${p.busy?'disabled':''}>VERIFICA ESITO</button>
      ${cancellable ? `<button type="button" class="btn btn-red" data-at05-control="cancel" ${p.busy?'disabled':''}>ANNULLA SE DIMOSTRABILE</button>` : ''}
      <button type="button" class="btn btn-ghost" data-at05-control="exit" ${p.busy?'disabled':''}>TORNA ALLA LOBBY</button></div>`;
    const act=async cancel=>{
      if (UI.state.currentUniverse!==uni || !UI.state.isMultiplayerMode) return;
      if (p.storageUnavailable) { UI.onOrdinaryDepartureChanged(uni); return; }
      if (cancel && !window.confirm('Annullare soltanto se il server può impedire definitivamente il commit della richiesta?')) return;
      try {
        const result=await window.__UniversumMPModules.verifyOrdinaryDeparture(uni,{cancel});
        UI.toast(result.status==='committed'?'Partenza confermata e partita recuperata.':'Partenza annullata definitivamente.','success');
      } catch (error) { UI.toast(error.message,'error'); }
      finally { UI.onOrdinaryDepartureChanged(UI.state.currentUniverse); }
    };
    panel.querySelector('[data-at05-control="verify"]')?.addEventListener('click',()=>act(false));
    panel.querySelector('[data-at05-control="cancel"]')?.addEventListener('click',()=>act(true));
    panel.querySelector('[data-at05-control="exit"]')?.addEventListener('click',()=>UI.exitActiveGameToLobby());
    return true;
  };
  UI.onOrdinaryDepartureChanged = function (u) {
    if (!u || UI.state.currentUniverse!==u || !UI.state.isMultiplayerMode) return;
    const wasBlocked=Boolean(document.getElementById('at05-ordinary-departure-panel'));
    if (!UI.updateOrdinaryDeparturePanel() && wasBlocked) UI.renderCurrentView?.();
  };
  UI.persistUniverseState = async function (opts = {}) {
    const uni = UI.state.currentUniverse;
    if (!uni) return;

    if (!UI.state.isMultiplayerMode) {
      await window.UniversumDB.save(uni);
      return;
    }
    if (UI.pendingDeparture(uni)) return false;
    if (!window.UniversumMP || typeof window.UniversumMP.syncPlayerState !== 'function') return;

    const r = UI._syncRetry;
    if (opts.notify) UI.toast('Sincronizzazione...', 'info');
    try {
      const saved = await window.UniversumMP.syncPlayerState(uni, { force: opts.force !== false });
      if (saved === false || UI.state.currentUniverse !== uni) return;
      if (r.timer) { clearTimeout(r.timer); r.timer = null; }
      r.attempt = 0;
      if (r.hadFailure) {
        r.hadFailure = false;
        UI.toast('Connessione ripristinata: dati sincronizzati.', 'success');
      } else if (opts.notify) {
        UI.toast('Sincronizzato', 'success');
      }
    } catch (err) {
      if (err.code === 'service-conflict' || err.code==='ordinary-departure-pending' || UI.state.currentUniverse !== uni || UI.pendingDeparture(uni)) throw err;
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
    if (UI.pendingDeparture() || UI._reconcileTimer) return;
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
})();
