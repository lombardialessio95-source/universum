(function () {
  'use strict';

  let currentUniverse = null;
  let isMultiplayerMode = false;
  let currentView = 'overview';
  let gameLoopTimer = null;
  let audioCtx = null;
  let soundMuted = localStorage.getItem('universum_muted') === 'true';

  // Listener Firestore attivi per Multiplayer
  let unsubChatListener = null;
  let unsubFleetsListener = null;
  let unsubPrivateConvsListener = null;
  let unsubPrivateMsgsListener = null;

  let chatMessagesCache = [];
  let privateConversationsCache = [];
  let privateMessagesCache = [];
  let unreadPrivateCount = 0;

  const uiState = {
    shipyardTab: 'ships',
    galaxyG: 1,
    galaxyS: 1,
    galaxyFilter: 'all',
    fleetSelection: {},
    fleetTarget: { g: 1, s: 1, p: 1 },
    fleetMission: 'attack',
    fleetCargo: { metal: 0, crystal: 0, deuterium: 0 },
    fleetBlackHole: false,
    selectedSpyReportId: null,
    simFleet: {},
    simDebounceTimer: null,
    lastAlertCount: 0,
    planetAnimAngle: 0,
    planetAnimId: null,
    commTab: 'galactic', // 'galactic' | 'private'
    activePrivateTarget: null // { uid, nickname } | null
  };

  // =========================================================
  // 1. ICONA PWA DINAMICA (CANVAS 512x512) E WEB AUDIO API
  // =========================================================
  function generateDynamicPWAIcon() {
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
  }

  function playSound(type) {
    if (soundMuted) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioCtx) audioCtx = new AudioContextClass();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

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
  }

  // =========================================================
  // UTILITY DI FORMATTAZIONE E MODALI
  // =========================================================
  function escapeHTML(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatNum(num) {
    const n = Math.floor(Number(num) || 0);
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    return n.toLocaleString('it-IT');
  }

  function formatDuration(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    if (s === 0) return '0s';
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (v) => String(v).padStart(2, '0');
    if (d > 0) return `${d}g${pad(h)}:${pad(m)}:${pad(sec)}`;
    return `${pad(h)}:${pad(m)}:${pad(sec)}`; }  function toast(msg, type = 'info') { const container = document.getElementById('toast-container'); if (!container) return; const el = document.createElement('div'); el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3400);
  }

  function openModal(title, bodyHTML) {
    const modal = document.getElementById('universal-modal');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    if (!modal || !titleEl || !bodyEl) return;
    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHTML;
    modal.classList.remove('hidden');
  }

  function closeModal() {
    const modal = document.getElementById('universal-modal');
    if (modal) modal.classList.add('hidden');
  }

  function getActivePlanetIndex() {
    if (!currentUniverse || !currentUniverse.planets.length) return 0;
    const idx = currentUniverse.planets.findIndex((p) => p.id === currentUniverse.activePlanetId);
    return idx >= 0 ? idx : 0;
  }

  function getActivePlanet() {
    return currentUniverse.planets[getActivePlanetIndex()];
  }

  async function persistUniverseState() {
    if (!currentUniverse) return;
    if (isMultiplayerMode) {
      if (window.UniversumMP && typeof window.UniversumMP.syncPlayerState === 'function') {
        await window.UniversumMP.syncPlayerState(currentUniverse);
      }
    } else {
      await window.UniversumDB.save(currentUniverse);
    }
  }

  function closePrivateMessageStream() {
    if (typeof unsubPrivateMsgsListener === 'function') {
      unsubPrivateMsgsListener();
      unsubPrivateMsgsListener = null;
    }
    privateMessagesCache = [];
  }

  function updateCommBadges() {
    const sb = document.getElementById('sidebar-chat-badge');
    const db = document.getElementById('drawer-chat-badge');
    const tabBadge = document.getElementById('tab-private-unread-badge');
    const menuDot = document.getElementById('mobile-menu-unread-dot');
    const show = isMultiplayerMode && unreadPrivateCount > 0;

    if (sb) {
      sb.textContent = unreadPrivateCount;
      sb.classList.toggle('hidden', !show);
    }
    if (db) {
      db.textContent = unreadPrivateCount;
      db.classList.toggle('hidden', !show);
    }
    if (tabBadge) {
      tabBadge.textContent = unreadPrivateCount;
      tabBadge.classList.toggle('hidden', !show);
    }
    if (menuDot) {
      menuDot.classList.toggle('hidden', !show);
    }
  }

  function openPrivateChatWith(targetUid, targetNickname) {
    if (!isMultiplayerMode || !targetUid) return;
    const myUid = window.fbAuth?.currentUser?.uid;
    if (targetUid === myUid) return;

    uiState.commTab = 'private';
    uiState.activePrivateTarget = {
      uid: targetUid,
      nickname: targetNickname || 'Comandante'
    };
    switchView('chat');
  }

  // =========================================================
  // LOBBY OFFLINE VS ONLINE (ALLINEATO A index.html)
  // =========================================================
  function setupLobbyTabs() {
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
      await refreshOnlineLobbyState();
    });

    // Form Login / Registrazione Multiplayer
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
        await refreshOnlineLobbyState();
      } catch (err) {
        playSound('error');
        toast(err.message || 'Errore autenticazione Firebase.', 'error');
      }
    });

    document.getElementById('btn-mp-logout')?.addEventListener('click', async () => {
      if (window.fbAuth) await window.fbAuth.signOut();
      await refreshOnlineLobbyState();
      toast('Disconnesso dal server online.', 'info');
    });

    document.getElementById('btn-mp-refresh')?.addEventListener('click', async () => {
      playSound('click');
      await renderOnlineUniversesList();
    });

    // Modale Crea Universo Online
    document.getElementById('btn-mp-create-uni')?.addEventListener('click', () => {
      playSound('click');
      openModal('CREA NUOVO UNIVERSO ONLINE PvP', `
        <form id="form-mp-create-uni-modal">
          <div class="form-group">
            <label for="mp-uni-name">Nome Universo Online</label>
            <input type="text" id="mp-uni-name" class="form-control" placeholder="Es. Andromeda PvP" maxlength="32" required>
          </div>
          <div class="form-group">
            <label for="mp-uni-npc">Modalità Avamposti</label>
            <select id="mp-uni-npc" class="form-control">
              <option value="none">100% PvP (Zero BOT)</option>
              <option value="limited">PvP + Max 10 Avamposti Neutrali</option>
            </select>
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
          <button type="submit" class="btn btn-green" style="width:100%; margin-top:8px;">🌐 FONDA E ENTRA NELL'UNIVERSO</button>
        </form>
      `);

      document.getElementById('form-mp-create-uni-modal')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!window.UniversumMP) return;
        try {
          const cfg = {
            name: document.getElementById('mp-uni-name').value,
            npcMode: document.getElementById('mp-uni-npc').value,
            speed: Number(document.getElementById('mp-uni-speed').value),
            galaxies: Number(document.getElementById('mp-uni-galaxies').value),
            systemsPerGalaxy: Number(document.getElementById('mp-uni-systems').value),
            passcode: document.getElementById('mp-uni-passcode').value.trim()
          };
          const uni = await window.UniversumMP.createOnlineUniverse(cfg);
          closeModal();
          playSound('complete');
          toast(`Universo Online "\${uni.name}" fondato!`, 'success');
          startOnlineGame(uni);
        } catch (err) {
          playSound('error');
          toast(err.message, 'error');
        }
      });
    });
  }

  async function refreshOnlineLobbyState() {
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

    await renderOnlineUniversesList();
  }

  async function renderOnlineUniversesList() {
    const listEl = document.getElementById('mp-universe-list');
    if (!listEl || !window.UniversumMP) return;

    listEl.innerHTML = `<div class="glass-panel" style="padding:16px; text-align:center;"><p class="text-muted">Scansione universi online in corso...</p></div>`;

    try {
      const universes = await window.UniversumMP.getOnlineUniverses();
      if (!universes || universes.length === 0) {
        listEl.innerHTML = `<div class="glass-panel" style="padding:20px; text-align:center;"><p class="text-muted">Nessun universo online attivo. Clicca su "+ CREA UNIVERSO ONLINE" qui sopra!</p></div>`;
        return;
      }

      listEl.innerHTML = universes.map((u) => {
        const npcBadge = u.npcMode === 'limited'
          ? '<span class="badge badge-neutral">MAX 10 AVAMPOSTI NEUTRALI</span>'
          : '<span class="badge badge-red">100% PvP • ZERO BOT</span>';
        return `
          <article class="universe-card glass-panel">
            <div class="universe-card-header">
              <div>
                <div class="universe-name">\${escapeHTML(u.name)}</div>
                <div class="text-muted" style="font-size:0.9rem;">Fondatore: <strong style="color:#fff;">\${escapeHTML(u.founderName || 'Imperatore')}</strong></div>
              </div>
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                \${npcBadge}
                <span class="badge badge-green">${u.speed}x</span>${u.hasPasscode ? '<span class="badge badge-blue">🔒 PRIVATO</span>' : ''}
              </div>
            </div>
            <div class="universe-meta">
              <span>Giocatori iscritti: <strong>\${u.playerCount || 1}</strong></span>
              <span>Mappa: <strong>${u.galaxies}G × ${u.systemsPerGalaxy}S</strong></span>
            </div>
            <button type="button" class="btn btn-green btn-sm btn-join-online-uni" data-uid="${u.id}" data-locked="${u.hasPasscode ? '1' : '0'}">
              🌐 ENTRA NELL'UNIVERSO
            </button>
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
    } catch (err) {
      listEl.innerHTML = `<div class="glass-panel" style="padding:16px;"><p style="color:#ff5252;">Errore caricamento universi: \${escapeHTML(err.message)}</p></div>`;
    }
  }

  // =========================================================
  // MODALI RINOMINA PIANETA E LUNA
  // =========================================================
  function openRenamePlanetModal(planetIndex) {
    const planet = currentUniverse.planets[planetIndex];
    if (!planet) return;
    openModal('RINOMINA PIANETA', `
      <form id="form-rename-planet">
        <div class="form-group">
          <label for="input-planet-name">Nuovo nome per [\${planet.coords.g}:${planet.coords.s}:${planet.coords.p}]</label>
          <input type="text" id="input-planet-name" class="form-control" maxlength="24" value="\${escapeHTML(planet.name)}" required>
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

    document.getElementById('cancel-rename-planet')?.addEventListener('click', closeModal);
    document.getElementById('form-rename-planet')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const newName = window.UniversumEngine.renamePlanet(currentUniverse, planetIndex, inp.value);
        if (isMultiplayerMode && window.UniversumMP?.renameOnlinePlanet) {
          await window.UniversumMP.renameOnlinePlanet(currentUniverse.id, planet.coords, newName);
        } else {
          await window.UniversumDB.save(currentUniverse);
        }
        closeModal();
        refreshPlanetSelector();
        renderCurrentView();
        playSound('success');
        toast(`Pianeta rinominato in "\${newName}"`, 'success');
      } catch (err) {
        playSound('error');
        toast(err.message, 'error');
      }
    });
  }

  function openRenameMoonModal(planetIndex) {
    const planet = currentUniverse.planets[planetIndex];
    if (!planet || !planet.moon) return;
    openModal('RINOMINA LUNA', `
      <form id="form-rename-moon">
        <div class="form-group">
          <label for="input-moon-name">Nuovo nome Luna di \${escapeHTML(planet.name)}</label>
          <input type="text" id="input-moon-name" class="form-control" maxlength="24" value="\${escapeHTML(planet.moon.name || 'Luna')}" required>
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

    document.getElementById('cancel-rename-moon')?.addEventListener('click', closeModal);
    document.getElementById('form-rename-moon')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const newName = window.UniversumEngine.renameMoon(currentUniverse, planetIndex, inp.value);
        if (isMultiplayerMode && window.UniversumMP?.renameOnlineMoon) {
          await window.UniversumMP.renameOnlineMoon(currentUniverse.id, planet.coords, newName);
        } else {
          await window.UniversumDB.save(currentUniverse);
        }
        closeModal();
        renderCurrentView();
        playSound('success');
        toast(`Luna rinominata in "\${newName}"`, 'success');
      } catch (err) {
        playSound('error');
        toast(err.message, 'error');
      }
    });
  }

  // =========================================================
  // RENDERING PIANETA 2D PROCEDURALE (CANVAS)
  // =========================================================
  function startPlanetCanvas(planet) {
    if (uiState.planetAnimId) {
      cancelAnimationFrame(uiState.planetAnimId);
      uiState.planetAnimId = null;
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

    function drawFrame() {
      if (!document.getElementById('overview-planet-canvas')) return;
      uiState.planetAnimAngle += 0.008;
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

      const drift = Math.sin(uiState.planetAnimAngle) * 18;
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

      if (planet.moon) {
        const mx = cx + Math.cos(uiState.planetAnimAngle * 1.8) * (radius + 26);
        const my = cy + Math.sin(uiState.planetAnimAngle * 1.8) * 18;
        const mGrad = ctx.createRadialGradient(mx - 3, my - 3, 2, mx, my, 11);
        mGrad.addColorStop(0, '#eceff1');
        mGrad.addColorStop(1, '#37474f');
        ctx.fillStyle = mGrad;
        ctx.beginPath();
        ctx.arc(mx, my, 11, 0, Math.PI * 2);
        ctx.fill();
      }

      uiState.planetAnimId = requestAnimationFrame(drawFrame);
    }

    drawFrame();
  }

  // =========================================================
  // AGGIORNAMENTO HEADER RISORSE E NAVIGAZIONE
  // =========================================================
  function refreshPlanetSelector() {
    const select = document.getElementById('active-planet-select');
    if (!select || !currentUniverse) return;
    const activeIdx = getActivePlanetIndex();
    select.innerHTML = currentUniverse.planets.map((p, idx) =>
      `<option value="${p.id}" ${idx === activeIdx ? 'selected' : ''}>${escapeHTML(p.name)} [${p.coords.g}:${p.coords.s}:${p.coords.p}]${p.moon ? ' 🌑' : ''}</option>` ).join(''); }  function updateTopBarNumbers() { if (!currentUniverse) return; const planet = getActivePlanet(); if (!planet) return;  const prod = window.UniversumEngine.getPlanetProduction(planet, currentUniverse); const mEl = document.getElementById('res-metal-val'); const cEl = document.getElementById('res-crystal-val'); const dEl = document.getElementById('res-deuterium-val'); const eEl = document.getElementById('res-energy-val');  if (currentUniverse.creativeMode && !isMultiplayerMode) { if (mEl) mEl.textContent = '∞'; if (cEl) cEl.textContent = '∞'; if (dEl) dEl.textContent = '∞'; if (eEl) eEl.textContent = '∞'; } else { if (mEl) mEl.textContent = formatNum(planet.resources.metal); if (cEl) cEl.textContent = formatNum(planet.resources.crystal); if (dEl) dEl.textContent = formatNum(planet.resources.deuterium); if (eEl) { eEl.textContent = `${formatNum(prod.energyBalance)} / ${formatNum(prod.energyProduced)}`; eEl.style.color = prod.energyBalance < 0 ? 'var(--btn-red)' : 'var(--res-energy)'; } }  const turboBtn = document.getElementById('btn-turbo-toggle'); if (turboBtn) { turboBtn.classList.toggle('hidden', isMultiplayerMode); const remTurbo = Math.max(0, Math.ceil(((currentUniverse.turboUntil \vert{}\vert{} 0) - Date.now()) / 1000)); if (remTurbo > 0) { turboBtn.classList.add('active'); turboBtn.textContent = `⚡ ${formatDuration(remTurbo)}`;
      } else {
        turboBtn.classList.remove('active');
        turboBtn.textContent = '⚡ TURBO';
      }
    }
  }

  function switchView(viewName) {
    if (currentView === 'chat' && viewName !== 'chat') {
      closePrivateMessageStream();
    }

    currentView = viewName;
    playSound('click');

    document.querySelectorAll('.sidebar-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    document.querySelectorAll('.nav-tab-btn[data-view]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    document.getElementById('mobile-menu-drawer')?.classList.add('hidden');
    renderCurrentView();
  }

  // =========================================================
  // RENDERING DELLE SCHERMATE (OFFLINE + MULTIPLAYER PvP)
  // =========================================================
  async function renderCurrentView() {
    const viewport = document.getElementById('game-viewport');
    if (!viewport || !currentUniverse) return;

    if (uiState.planetAnimId && currentView !== 'overview') {
      cancelAnimationFrame(uiState.planetAnimId);
      uiState.planetAnimId = null;
    }

    switch (currentView) {
      case 'overview': renderOverview(viewport); break;
      case 'buildings': renderBuildings(viewport); break;
      case 'research': renderResearch(viewport); break;
      case 'shipyard':
      case 'defense':
        if (currentView === 'defense') uiState.shipyardTab = 'defense';
        renderShipyardAndDefense(viewport);
        break;
      case 'fleet': renderFleet(viewport); break;
      case 'galaxy': await renderGalaxy(viewport); break;
      case 'espionage': renderEspionageAndSim(viewport); break;
      case 'moon': renderMoon(viewport); break;
      case 'diplomacy': renderDiplomacy(viewport); break;
      case 'empire': renderEmpire(viewport); break;
      case 'highscore': await renderHighscoreAndQuests(viewport); break;
      case 'chat': await renderCommunications(viewport); break;
      case 'saves': renderSavesMenu(viewport); break;
      default: renderOverview(viewport);
    }
  }

  // ---------------------------------------------------------
  // 1. PANORAMICA
  // ---------------------------------------------------------
  function renderOverview(viewport) {
    const Data = window.UniversumData;
    const Engine = window.UniversumEngine;
    const pIdx = getActivePlanetIndex();
    const planet = getActivePlanet();
    const prod = Engine.getPlanetProduction(planet, currentUniverse);
    const usedFields = Data.getUsedFields(planet);
    const maxFields = Data.getMaxFields(planet);

    const incoming = currentUniverse.incomingAttacks || [];
    const flights = currentUniverse.fleetsInFlight || [];
    const messages = (currentUniverse.messages || []).slice(0, 6);

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        \${incoming.length > 0 ? `
          <div class="glass-panel" style="padding:14px; border-color:var(--btn-red); background:rgba(255,23,68,0.18);">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
              <strong style="color:#ff5252; font-family:var(--font-display);">🚨 ALLARME ATTACCO OSTILE IN ARRIVO (${incoming.length})</strong>
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
                <h2 style="font-size:1.3rem; color:#fff;">\${escapeHTML(planet.name)}</h2>
                <button type="button" id="btn-rename-active-planet" class="btn btn-blue btn-sm" style="min-width:44px; min-height:44px;">✏️ Rinomina</button>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:0.95rem;">
                <div>Coordinate: <strong class="text-crystal">[\${planet.coords.g}:${planet.coords.s}:${planet.coords.p}]</strong></div>
                <div>Campi: <strong>${usedFields} /${maxFields}</strong></div>
                <div>Temperatura: <strong>${planet.minTemp}°C / ${planet.maxTemp}°C</strong></div>
                <div>Velocità: <strong class="text-metal">\${Engine.getEffectiveSpeed(currentUniverse)}x</strong></div>
              </div>
              \${!isMultiplayerMode ? `
                <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;">
                  <button type="button" id="btn-overview-turbo" class="btn btn-creative btn-sm">⚡ TURBO (2x VELOCITÀ)</button>
                  <button type="button" id="btn-overview-event" class="btn btn-blue btn-sm">🎲 SCANSIONE EVENTO</button>
                </div>
              ` : `
                <div style="margin-top:12px;">
                  <button type="button" id="btn-overview-open-chat" class="btn btn-blue btn-sm">💬 APRI COMUNICAZIONI</button>
                </div>
              `}
            </div>
          </div>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:0.95rem; color:var(--res-crystal); margin-bottom:10px;">PRODUZIONE ORARIA PIANETA</h3>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; text-align:center;">
            <div style="background:rgba(0,0,0,0.35); padding:8px; border-radius:8px;">
              <div class="text-muted" style="font-size:0.8rem;">METALLO/H</div>
              <div class="font-display text-metal" style="font-size:0.95rem;">+\${formatNum(prod.metalPerHour)}</div>
            </div>
            <div style="background:rgba(0,0,0,0.35); padding:8px; border-radius:8px;">
              <div class="text-muted" style="font-size:0.8rem;">CRISTALLO/H</div>
              <div class="font-display text-crystal" style="font-size:0.95rem;">+\${formatNum(prod.crystalPerHour)}</div>
            </div>
            <div style="background:rgba(0,0,0,0.35); padding:8px; border-radius:8px;">
              <div class="text-muted" style="font-size:0.8rem;">DEUTERIO/H</div>
              <div class="font-display text-deuterium" style="font-size:0.95rem;">${prod.deuteriumPerHour >= 0 ? '+' : ''}${formatNum(prod.deuteriumPerHour)}</div>
            </div>
          </div>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:0.95rem; color:var(--res-crystal); margin-bottom:10px;">CODE DI PRODUZIONE & RICERCA</h3>
          <div style="display:flex; flex-direction:column; gap:8px;">
            \${renderQueuesSummaryHTML(planet)}
          </div>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:0.95rem; color:var(--res-crystal); margin-bottom:10px;">MOVIMENTI FLOTTA (${flights.length})</h3>${flights.length === 0 ? '<p class="text-muted">Nessuna flotta in transito.</p>' : `
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${flights.map((f) => {
                const targetTs = f.status === 'outbound' ? f.arrivalTime : f.returnTime;
                return `
                  <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35); padding:10px; border-radius:8px;">
                    <div>
                      <strong style="text-transform:uppercase; color:var(--res-crystal);">\${escapeHTML(f.mission)}</strong>
                      <span class="badge \${f.status === 'outbound' ? 'badge-green' : '
