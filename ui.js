(function () {
  'use strict';

  let currentUniverse = null;
  let isMultiplayerMode = false;
  let currentView = 'overview';
  let gameLoopTimer = null;
  let audioCtx = null;
  let soundMuted = localStorage.getItem('universum_muted') === 'true';

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
    // Stato Multiplayer
    chatMessages: [],
    unreadChatCount: 0,
    lastSeenChatTs: 0,
    mpIncomingAttacks: [],
    mpMyFleets: [],
    mpMessagesUnsub: null,
    mpFleetsUnsub: null,
    mpGalaxyCacheKey: '',
    mpGalaxyCacheData: null
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
  // UTILITY DI FORMATTAZIONE, SALVATAGGIO IBRIDO E MODALI
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
    if (d > 0) return `${d}g ${pad(h)}:${pad(m)}:${pad(sec)}`;
    return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  }

  function toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
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

  async function persistCurrentState(planetToSync = null) {
    if (!currentUniverse) return;
    if (isMultiplayerMode) {
      if (!window.UniversumMP || !window.fbDB) return;
      const p = planetToSync || getActivePlanet();
      if (p) {
        const docPayload = Object.assign({}, p, {
          planetName: p.name,
          lastUpdated: Date.now()
        });
        await window.UniversumMP.syncPlanetState(currentUniverse.id, docPayload);
      }
      const user = window.UniversumMP.getCurrentUser();
      if (user) {
        await window.fbDB.collection('online_universes').doc(currentUniverse.id)
          .collection('players').doc(user.uid)
          .set({ researches: currentUniverse.researches }, { merge: true });
      }
    } else {
      await window.UniversumDB.save(currentUniverse);
    }
  }

  // =========================================================
  // LOBBY MULTIPLAYER (LOGIN, LISTA SERVER, CREA UNIVERSO ONLINE)
  // =========================================================
  function setupLobbyTabsAndMultiplayer() {
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
      const submitter = e.submitter;
      const mode = submitter?.dataset.authMode || 'login';
      const nick = document.getElementById('mp-nickname')?.value;
      const pass = document.getElementById('mp-password')?.value;

      try {
        if (!window.UniversumMP) throw new Error('Modulo Multiplayer non caricato.');
        const profile = await window.UniversumMP.registerOrLogin(nick, pass, mode === 'register');
        playSound('success');
        toast(`Benvenuto nella rete PvP, ${profile.nickname}!`, 'success');
        await refreshOnlineLobbyState();
      } catch (err) {
        playSound('error');
        toast(err.message, 'error');
      }
    });

    document.getElementById('btn-mp-logout')?.addEventListener('click', async () => {
      if (window.UniversumMP) await window.UniversumMP.logout();
      await refreshOnlineLobbyState();
      toast('Disconnesso dalla rete Multiplayer.', 'info');
    });

    document.getElementById('btn-mp-refresh')?.addEventListener('click', async () => {
      playSound('click');
      await refreshOnlineLobbyState();
    });

    document.getElementById('btn-mp-create-uni')?.addEventListener('click', openCreateOnlineUniverseModal);
  }

  async function refreshOnlineLobbyState() {
    const authBox = document.getElementById('mp-auth-box');
    const serversBox = document.getElementById('mp-servers-box');
    const userLabel = document.getElementById('mp-logged-user');
    const listEl = document.getElementById('mp-universe-list');
    if (!authBox || !serversBox || !listEl) return;

    const user = window.UniversumMP ? window.UniversumMP.getCurrentUser() : null;
    if (!user) {
      authBox.classList.remove('hidden');
      serversBox.classList.add('hidden');
      return;
    }

    authBox.classList.add('hidden');
    serversBox.classList.remove('hidden');
    if (userLabel) userLabel.textContent = user.nickname;

    listEl.innerHTML = `<div class="glass-panel" style="padding:20px; text-align:center;"><p class="text-crystal">Sincronizzazione server galattici in corso...</p></div>`;

    try {
      const servers = await window.UniversumMP.getOnlineUniverses();
      if (servers.length === 0) {
        listEl.innerHTML = `
          <div class="glass-panel" style="padding:24px; text-align:center;">
            <p style="font-weight:700; color:var(--res-crystal); margin-bottom:6px;">NESSUN UNIVERSO ONLINE ATTIVO</p>
            <p class="text-muted">Crea il primo server PvP e invita altri comandanti!</p>
          </div>
        `;
        return;
      }

      listEl.innerHTML = servers.map((s) => `
        <article class="universe-card glass-panel">
          <div class="universe-card-header">
            <div>
              <div class="universe-name">${escapeHTML(s.name)} ${s.hasPassword ? '🔒' : ''}</div>
              <div class="text-muted" style="font-size:0.88rem;">Fondato da: <strong style="color:#fff;">${escapeHTML(s.createdBy)}</strong></div>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <span class="badge badge-red">PvP REALE</span>
              <span class="badge badge-green">${s.speed}x</span>
              <span class="badge badge-blue">👥 ${s.playerCount} Giocatori</span>
            </div>
          </div>
          <div class="universe-meta">
            <span>Mappa: <strong>${s.galaxies}G × ${s.systemsPerGalaxy}S</strong></span>
            <span>Modalità Creativa: <strong>Disabilitata</strong></span>
          </div>
          <div>
            <button type="button" class="btn btn-green btn-join-mp-server" data-uid="${s.id}" data-protected="${s.hasPassword ? '1' : '0'}" style="width:100%;">
              🚀 ENTRA NELL'UNIVERSO PvP
            </button>
          </div>
        </article>
      `).join('');

      listEl.querySelectorAll('.btn-join-mp-server').forEach((btn) => {
        btn.addEventListener('click', () => {
          const uniId = btn.dataset.uid;
          const isProtected = btn.dataset.protected === '1';
          if (isProtected) {
            openModal('STANZA PROTETTA DA PASSWORD', `
              <form id="form-join-protected">
                <div class="form-group">
                  <label for="input-room-pwd">Inserisci Password Stanza</label>
                  <input type="password" id="input-room-pwd" class="form-control" required>
                </div>
                <button type="submit" class="btn btn-green" style="width:100%;">ENTRA</button>
              </form>
            `);
            document.getElementById('form-join-protected')?.addEventListener('submit', async (ev) => {
              ev.preventDefault();
              const pwd = document.getElementById('input-room-pwd').value;
              closeModal();
              await enterOnlineUniverse(uniId, pwd);
            });
          } else {
            enterOnlineUniverse(uniId, '');
          }
        });
      });
    } catch (err) {
      listEl.innerHTML = `<div class="glass-panel" style="padding:18px; color:#ff5252;">${escapeHTML(err.message)}</div>`;
    }
  }

  function openCreateOnlineUniverseModal() {
    openModal('CREA UNIVERSO ONLINE PvP', `
      <form id="form-create-mp-uni">
        <div class="form-group">
          <label for="mp-uni-name">Nome Server / Universo</label>
          <input type="text" id="mp-uni-name" class="form-control" value="Universo Alpha 10x" maxlength="32" required>
        </div>
        <div class="form-grid-3">
          <div class="form-group">
            <label for="mp-uni-speed">Velocità</label>
            <select id="mp-uni-speed" class="form-control">
              <option value="1">1x</option>
              <option value="5">5x</option>
              <option value="10" selected>10x</option>
              <option value="50">50x</option>
              <option value="100">100x</option>
              <option value="500">500x (Blitz)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="mp-uni-gal">Galassie</label>
            <select id="mp-uni-gal" class="form-control">
              <option value="1">1</option>
              <option value="3" selected>3</option>
              <option value="5">5</option>
            </select>
          </div>
          <div class="form-group">
            <label for="mp-uni-sys">Sistemi</label>
            <select id="mp-uni-sys" class="form-control">
              <option value="100">100</option>
              <option value="250" selected>250</option>
              <option value="499">499</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="mp-uni-pass">Password Stanza (Opzionale — lascia vuoto per server pubblico)</label>
          <input type="text" id="mp-uni-pass" class="form-control" placeholder="Nessuna password" maxlength="24">
        </div>
        <div style="display:flex; gap:10px; margin-top:16px;">
          <button type="submit" class="btn btn-green" style="flex:1;">🌐 CREA & ENTRA</button>
          <button type="button" id="btn-cancel-mp-uni" class="btn btn-ghost">ANNULLA</button>
        </div>
      </form>
    `);

    document.getElementById('btn-cancel-mp-uni')?.addEventListener('click', closeModal);
    document.getElementById('form-create-mp-uni')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const created = await window.UniversumMP.createOnlineUniverse({
          name: document.getElementById('mp-uni-name').value,
          speed: Number(document.getElementById('mp-uni-speed').value),
          galaxies: Number(document.getElementById('mp-uni-gal').value),
          systemsPerGalaxy: Number(document.getElementById('mp-uni-sys').value),
          roomPassword: document.getElementById('mp-uni-pass').value
        });
        closeModal();
        await enterOnlineUniverse(created.id, document.getElementById('mp-uni-pass')?.value || '');
      } catch (err) {
        playSound('error');
        toast(err.message, 'error');
      }
    });
  }

  async function enterOnlineUniverse(universeId, password = '') {
    try {
      toast('Connessione all\'universo PvP...', 'info');
      const session = await window.UniversumMP.joinOnlineUniverse(universeId, password);

      const normalizedPlanets = session.planets.map((p, idx) => ({
        id: `mp_planet_${p.coords.g}_${p.coords.s}_${p.coords.p}`,
        name: p.planetName || (idx === 0 ? 'Pianeta Madre' : 'Colonia PvP'),
        coords: p.coords,
        minTemp: p.minTemp ?? p.temperature?.min ?? -10,
        maxTemp: p.maxTemp ?? p.temperature?.max ?? 30,
        fieldsMax: p.fieldsMax || 220,
        resources: p.resources || { metal: 5000, crystal: 5000, deuterium: 1000 },
        buildings: p.buildings || {},
        defenses: p.defenses || {},
        fleet: p.fleet || {},
        buildQueue: [],
        shipyardQueue: [],
        defenseQueue: [],
        moon: p.moon || null,
        debris: p.debris || { metal: 0, crystal: 0 },
        ownerUid: p.ownerUid,
        ownerName: p.ownerName,
        lastUpdated: p.lastUpdated || Date.now()
      }));

      const mpUniObj = {
        id: session.universe.id,
        seed: 0,
        name: session.universe.name,
        emperor: session.player.nickname,
        creativeMode: false,
        speed: session.universe.speed || 10,
        galaxies: session.universe.galaxies || 3,
        systemsPerGalaxy: session.universe.systemsPerGalaxy || 250,
        botMode: 'peaceful',
        botLevel: 1,
        turboUntil: 0,
        activePlanetId: normalizedPlanets[0]?.id,
        planets: normalizedPlanets,
        researches: session.player.researches || {},
        researchQueue: null,
        fleetsInFlight: [],
        incomingAttacks: [],
        spyReports: [],
        messages: [],
        contracts: [],
        dailyQuests: []
      };

      startGame(mpUniObj, true);
      playSound('complete');
      toast(`Connesso a "${mpUniObj.name}"!`, 'success');
    } catch (err) {
      playSound('error');
      toast(err.message, 'error');
    }
  }

  // =========================================================
  // MODALI RINOMINA PIANETA E LUNA (NO window.prompt)
  // =========================================================
  function openRenamePlanetModal(planetIndex) {
    const planet = currentUniverse.planets[planetIndex];
    if (!planet) return;
    openModal('RINOMINA PIANETA', `
      <form id="form-rename-planet">
        <div class="form-group">
          <label for="input-planet-name">Nuovo nome per [${planet.coords.g}:${planet.coords.s}:${planet.coords.p}]</label>
          <input type="text" id="input-planet-name" class="form-control" maxlength="24" value="${escapeHTML(planet.name)}" required>
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
        let newName;
        if (isMultiplayerMode) {
          newName = await window.UniversumMP.renameOnlinePlanet(currentUniverse.id, planet.coords, inp.value);
          planet.name = newName;
          uiState.mpGalaxyCacheKey = '';
        } else {
          newName = window.UniversumEngine.renamePlanet(currentUniverse, planetIndex, inp.value);
          await window.UniversumDB.save(currentUniverse);
        }
        closeModal();
        refreshPlanetSelector();
        renderCurrentView();
        playSound('success');
        toast(`Pianeta rinominato in "${newName}"`, 'success');
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
          <label for="input-moon-name">Nuovo nome Luna di ${escapeHTML(planet.name)}</label>
          <input type="text" id="input-moon-name" class="form-control" maxlength="24" value="${escapeHTML(planet.moon.name || 'Luna')}" required>
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
        let newName;
        if (isMultiplayerMode) {
          newName = await window.UniversumMP.renameOnlineMoon(currentUniverse.id, planet.coords, inp.value);
          planet.moon.name = newName;
          uiState.mpGalaxyCacheKey = '';
        } else {
          newName = window.UniversumEngine.renameMoon(currentUniverse, planetIndex, inp.value);
          await window.UniversumDB.save(currentUniverse);
        }
        closeModal();
        renderCurrentView();
        playSound('success');
        toast(`Luna rinominata in "${newName}"`, 'success');
      } catch (err) {
        playSound('error');
        toast(err.message, 'error');
      }
    });
  }

  // =========================================================
  // 2. RENDERING PIANETA 2D PROCEDURALE (CANVAS)
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
  // HEADER, BADGE CHAT NON LETTI & NAVIGAZIONE
  // =========================================================
  function updateChatUnreadBadges() {
    const count = uiState.unreadChatCount;
    const sbBadge = document.getElementById('sidebar-chat-badge');
    const drBadge = document.getElementById('drawer-chat-badge');
    const mobDot = document.getElementById('mobile-menu-unread-dot');

    if (sbBadge) {
      sbBadge.textContent = count > 99 ? '99+' : String(count);
      sbBadge.classList.toggle('hidden', count === 0 || !isMultiplayerMode);
    }
    if (drBadge) {
      drBadge.textContent = count > 99 ? '99+' : String(count);
      drBadge.classList.toggle('hidden', count === 0 || !isMultiplayerMode);
    }
    if (mobDot) {
      mobDot.classList.toggle('hidden', count === 0 || !isMultiplayerMode);
    }
  }

  function refreshPlanetSelector() {
    const select = document.getElementById('active-planet-select');
    if (!select || !currentUniverse) return;
    const activeIdx = getActivePlanetIndex();
    select.innerHTML = currentUniverse.planets.map((p, idx) =>
      `<option value="${p.id}" ${idx === activeIdx ? 'selected' : ''}>${escapeHTML(p.name)} [${p.coords.g}:${p.coords.s}:${p.coords.p}]${p.moon ? ' 🌑' : ''}</option>`
    ).join('');
  }

  function updateTopBarNumbers() {
    if (!currentUniverse) return;
    const planet = getActivePlanet();
    if (!planet) return;

    const prod = window.UniversumEngine.getPlanetProduction(planet, currentUniverse);
    const mEl = document.getElementById('res-metal-val');
    const cEl = document.getElementById('res-crystal-val');
    const dEl = document.getElementById('res-deuterium-val');
    const eEl = document.getElementById('res-energy-val');

    if (currentUniverse.creativeMode) {
      if (mEl) mEl.textContent = '∞';
      if (cEl) cEl.textContent = '∞';
      if (dEl) dEl.textContent = '∞';
      if (eEl) eEl.textContent = '∞';
    } else {
      if (mEl) mEl.textContent = formatNum(planet.resources.metal);
      if (cEl) cEl.textContent = formatNum(planet.resources.crystal);
      if (dEl) dEl.textContent = formatNum(planet.resources.deuterium);
      if (eEl) {
        eEl.textContent = `${formatNum(prod.energyBalance)} / ${formatNum(prod.energyProduced)}`;
        eEl.style.color = prod.energyBalance < 0 ? 'var(--btn-red)' : 'var(--res-energy)';
      }
    }

    const turboBtn = document.getElementById('btn-turbo-toggle');
    if (turboBtn) {
      turboBtn.classList.toggle('hidden', isMultiplayerMode);
      const remTurbo = Math.max(0, Math.ceil(((currentUniverse.turboUntil || 0) - Date.now()) / 1000));
      if (remTurbo > 0) {
        turboBtn.classList.add('active');
        turboBtn.textContent = `⚡ ${formatDuration(remTurbo)}`;
      } else {
        turboBtn.classList.remove('active');
        turboBtn.textContent = '⚡ TURBO';
      }
    }
  }

  function switchView(viewName) {
    currentView = viewName;
    playSound('click');

    if (viewName === 'chat') {
      uiState.unreadChatCount = 0;
      uiState.lastSeenChatTs = Date.now();
      updateChatUnreadBadges();
    }

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
  // RENDERING DELLE SCHERMATE DI GIOCO
  // =========================================================
  function renderCurrentView() {
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
      case 'galaxy': renderGalaxy(viewport); break;
      case 'espionage': renderEspionageAndSim(viewport); break;
      case 'moon': renderMoon(viewport); break;
      case 'diplomacy': renderDiplomacy(viewport); break;
      case 'empire': renderEmpire(viewport); break;
      case 'highscore': renderHighscoreAndQuests(viewport); break;
      case 'chat': renderGalacticChat(viewport); break;
      case 'saves': renderSavesMenu(viewport); break;
      default: renderOverview(viewport);
    }
  }

  // ---------------------------------------------------------
  // 1. PANORAMICA
  // ---------------------------------------------------------
  function ensureDailyQuests() {
    if (!Array.isArray(currentUniverse.dailyQuests) || currentUniverse.dailyQuests.length === 0) {
      currentUniverse.dailyQuests = [
        { id: 'q_mines', title: 'Espansione Estrattiva', desc: 'Porta la Miniera di Metallo almeno al Livello 3.', reward: { metal: 5000, crystal: 2500, deuterium: 500 }, claimed: false },
        { id: 'q_spy', title: 'Occhi nello Spazio', desc: 'Effettua almeno 1 rapporto di spionaggio.', reward: { metal: 4000, crystal: 6000, deuterium: 1000 }, claimed: false },
        { id: 'q_fleet', title: 'Primo Squadrone', desc: 'Possiedi almeno 5 navi da combattimento in orbita.', reward: { metal: 12000, crystal: 8000, deuterium: 2000 }, claimed: false }
      ];
    }
  }

  function checkQuestReady(q, planet) {
    if (q.id === 'q_mines') return (planet.buildings?.metalMine || 0) >= 3;
    if (q.id === 'q_spy') return (currentUniverse.spyReports || []).length >= 1;
    if (q.id === 'q_fleet') {
      const combatShips = (planet.fleet?.lightFighter || 0) + (planet.fleet?.heavyFighter || 0) + (planet.fleet?.cruiser || 0) + (planet.fleet?.battleship || 0);
      return combatShips >= 5;
    }
    return false;
  }

  function renderOverview(viewport) {
    const Data = window.UniversumData;
    const Engine = window.UniversumEngine;
    const pIdx = getActivePlanetIndex();
    const planet = getActivePlanet();
    const prod = Engine.getPlanetProduction(planet, currentUniverse);
    const usedFields = Data.getUsedFields(planet);
    const maxFields = Data.getMaxFields(planet);

    ensureDailyQuests();

    const incoming = isMultiplayerMode ? uiState.mpIncomingAttacks : (currentUniverse.incomingAttacks || []);
    const flights = isMultiplayerMode ? uiState.mpMyFleets : (currentUniverse.fleetsInFlight || []);
    const messages = (currentUniverse.messages || []).slice(0, 6);

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        ${incoming.length > 0 ? `
          <div class="glass-panel" style="padding:14px; border-color:var(--btn-red); background:rgba(255,23,68,0.16);">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
              <strong style="color:#ff5252; font-family:var(--font-display);">🚨 ALLARME ATTACCO IN ARRIVO (${incoming.length})</strong>
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
                <button type="button" id="btn-rename-active-planet" class="btn btn-blue btn-sm" style="min-width:44px; min-height:44px;">✏️ Rinomina</button>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:0.95rem;">
                <div>Coordinate: <strong class="text-crystal">[${planet.coords.g}:${planet.coords.s}:${planet.coords.p}]</strong></div>
                <div>Campi: <strong>${usedFields} / ${maxFields}</strong></div>
                <div>Temperatura: <strong>${planet.minTemp}°C / ${planet.maxTemp}°C</strong></div>
                <div>Velocità Univ.: <strong class="text-metal">${Engine.getEffectiveSpeed(currentUniverse)}x</strong></div>
              </div>
              ${!isMultiplayerMode ? `
                <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;">
                  <button type="button" id="btn-overview-turbo" class="btn btn-creative btn-sm">⚡ TURBO (2x VELOCITÀ)</button>
                  <button type="button" id="btn-overview-event" class="btn btn-blue btn-sm">🎲 SCANSIONE EVENTO</button>
                </div>
              ` : `
                <div style="margin-top:12px;">
                  <button type="button" id="btn-mp-open-chat-quick" class="btn btn-blue btn-sm">💬 APRI CHAT GALATTICA</button>
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
              <div class="font-display text-metal" style="font-size:0.95rem;">+${formatNum(prod.metalPerHour)}</div>
            </div>
            <div style="background:rgba(0,0,0,0.35); padding:8px; border-radius:8px;">
              <div class="text-muted" style="font-size:0.8rem;">CRISTALLO/H</div>
              <div class="font-display text-crystal" style="font-size:0.95rem;">+${formatNum(prod.crystalPerHour)}</div>
            </div>
            <div style="background:rgba(0,0,0,0.35); padding:8px; border-radius:8px;">
              <div class="text-muted" style="font-size:0.8rem;">DEUTERIO/H</div>
              <div class="font-display text-deuterium" style="font-size:0.95rem;">${prod.deuteriumPerHour >= 0 ? '+' : ''}${formatNum(prod.deuteriumPerHour)}</div>
            </div>
          </div>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:0.95rem; color:var(--res-crystal); margin-bottom:10px;">CODE DI PRODUZIONE & RICERCA</h3>
          <div id="overview-queues-list" style="display:flex; flex-direction:column; gap:8px;">
            ${renderQueuesSummaryHTML(planet)}
          </div>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:0.95rem; color:var(--res-crystal); margin-bottom:10px;">MOVIMENTI FLOTTA (${flights.length})</h3>
          ${flights.length === 0 ? '<p class="text-muted">Nessuna flotta attualmente nello spazio profondo.</p>' : `
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

        ${!isMultiplayerMode ? `
          <div class="glass-panel" style="padding:14px;">
            <h3 style="font-size:0.95rem; color:var(--btn-gold); margin-bottom:10px;">MISSIONI GIORNALIERE</h3>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${currentUniverse.dailyQuests.map((q) => {
                const ready = checkQuestReady(q, planet);
                return `
                  <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; background:rgba(0,0,0,0.35); padding:10px; border-radius:8px;">
                    <div>
                      <strong>${escapeHTML(q.title)}</strong>
                      <div class="text-muted" style="font-size:0.88rem;">${escapeHTML(q.desc)}</div>
                      <div style="font-size:0.82rem; color:var(--res-metal);">Premio: ${formatNum(q.reward.metal)} M, ${formatNum(q.reward.crystal)} C, ${formatNum(q.reward.deuterium)} D</div>
                    </div>
                    ${q.claimed
                      ? '<span class="badge badge-blue">RISCATTATA</span>'
                      : `<button type="button" class="btn btn-green btn-sm btn-claim-quest" data-qid="${q.id}" ${ready ? '' : 'disabled'}>${ready ? 'RISCATTA' : 'IN CORSO'}</button>`
                    }
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:0.95rem; color:var(--res-crystal); margin-bottom:10px;">DIARIO DI BORDO & RAPPORTI</h3>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${messages.length === 0 ? '<p class="text-muted">Nessun messaggio recente.</p>' : messages.map((m) => `
              <div style="border-left:3px solid var(--btn-blue); padding-left:10px;">
                <div style="font-weight:700; font-size:0.95rem;">${escapeHTML(m.title)}</div>
                <div class="text-muted" style="font-size:0.88rem;">${escapeHTML(m.body)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    startPlanetCanvas(planet);

    document.getElementById('btn-rename-active-planet')?.addEventListener('click', () => openRenamePlanetModal(pIdx));
    document.getElementById('btn-mp-open-chat-quick')?.addEventListener('click', () => switchView('chat'));

    document.getElementById('btn-overview-turbo')?.addEventListener('click', async () => {
      const res = Engine.activateTurbo(currentUniverse);
      await persistCurrentState();
      updateTopBarNumbers();
      renderCurrentView();
      playSound('success');
      toast(`TURBO 2x attivo per ${formatDuration(res.remainingSec)}!`, 'creative');
    });

    document.getElementById('btn-overview-event')?.addEventListener('click', async () => {
      const bonusM = Math.floor((1500 + Math.random() * 4500) * Math.sqrt(currentUniverse.speed || 1));
      const bonusC = Math.floor((1000 + Math.random() * 3000) * Math.sqrt(currentUniverse.speed || 1));
      planet.resources.metal += bonusM;
      planet.resources.crystal += bonusC;
      await persistCurrentState();
      updateTopBarNumbers();
      playSound('success');
      toast(`Capsula cargo intercettata: +${formatNum(bonusM)} M, +${formatNum(bonusC)} C!`, 'success');
    });

    viewport.querySelectorAll('.btn-claim-quest').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const q = currentUniverse.dailyQuests.find((item) => item.id === btn.dataset.qid);
        if (!q || q.claimed) return;
        q.claimed = true;
        planet.resources.metal += q.reward.metal;
        planet.resources.crystal += q.reward.crystal;
        planet.resources.deuterium += q.reward.deuterium;
        await persistCurrentState();
        updateTopBarNumbers();
        renderCurrentView();
        playSound('complete');
        toast(`Ricompensa "${q.title}" accreditata!`, 'success');
      });
    });
  }

  function renderQueuesSummaryHTML(planet) {
    const Data = window.UniversumData;
    const rows = [];

    if (planet.buildQueue && planet.buildQueue.length > 0) {
      const b = planet.buildQueue[0];
      const name = Data.BUILDINGS[b.id]?.name || b.id;
      rows.push(`
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35); padding:10px; border-radius:8px;">
          <span>🏗️ <strong>${escapeHTML(name)}</strong> → Lv.${b.targetLevel}</span>
          <span class="font-display text-metal live-timer" data-end="${b.endTime}">${formatDuration((b.endTime - Date.now()) / 1000)}</span>
        </div>
      `);
    }

    if (currentUniverse.researchQueue) {
      const r = currentUniverse.researchQueue;
      const name = Data.RESEARCHES[r.id]?.name || r.id;
      rows.push(`
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35); padding:10px; border-radius:8px;">
          <span>🔬 <strong>${escapeHTML(name)}</strong> → Lv.${r.targetLevel}</span>
          <span class="font-display text-crystal live-timer" data-end="${r.endTime}">${formatDuration((r.endTime - Date.now()) / 1000)}</span>
        </div>
      `);
    }

    if (planet.shipyardQueue && planet.shipyardQueue.length > 0) {
      const sq = planet.shipyardQueue[0];
      const name = Data.SHIPS[sq.id]?.name || sq.id;
      rows.push(`
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35); padding:10px; border-radius:8px;">
          <span>🚀 <strong>${escapeHTML(name)}</strong> (Rimanenti: ${sq.remaining})</span>
          <span class="font-display text-energy live-timer" data-end="${sq.endTime}">${formatDuration((sq.endTime - Date.now()) / 1000)}</span>
        </div>
      `);
    }

    if (planet.defenseQueue && planet.defenseQueue.length > 0) {
      const dq = planet.defenseQueue[0];
      const name = Data.DEFENSES[dq.id]?.name || dq.id;
      rows.push(`
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35); padding:10px; border-radius:8px;">
          <span>🛡️ <strong>${escapeHTML(name)}</strong> (Rimanenti: ${dq.remaining})</span>
          <span class="font-display text-energy live-timer" data-end="${dq.endTime}">${formatDuration((dq.endTime - Date.now()) / 1000)}</span>
        </div>
      `);
    }

    return rows.length > 0
      ? rows.join('')
      : '<p class="text-muted">Nessuna costruzione o ricerca in corso.</p>';
  }

  // ---------------------------------------------------------
  // 2. EDIFICI & RISORSE
  // ---------------------------------------------------------
  function renderBuildings(viewport) {
    const Data = window.UniversumData;
    const Engine = window.UniversumEngine;
    const pIdx = getActivePlanetIndex();
    const planet = getActivePlanet();
    const isCreative = currentUniverse.creativeMode;

    const cards = Object.values(Data.BUILDINGS).map((b) => {
      const curLv = Number(planet.buildings[b.id] || 0);
      const nextLv = curLv + 1;
      const cost = Data.getBuildingCost(b.id, nextLv, false);
      const req = Data.checkRequirements(b.requirements, planet, currentUniverse, false);
      const buildSec = Engine.getBuildingBuildTime(currentUniverse, planet, b.id, nextLv, false);

      const hasM = isCreative || planet.resources.metal >= cost.metal;
      const hasC = isCreative || planet.resources.crystal >= cost.crystal;
      const hasD = isCreative || planet.resources.deuterium >= cost.deuterium;
      const canBuild = isCreative || (req.met && hasM && hasC && hasD && planet.buildQueue.length === 0 && (!b.maxLevel || curLv < b.maxLevel));

      return `
        <div class="glass-panel" style="padding:14px; display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:1.05rem;">${b.icon} ${escapeHTML(b.name)}</strong>
            <span class="badge badge-blue">Livello ${curLv}</span>
          </div>
          <p class="text-muted" style="font-size:0.9rem;">${escapeHTML(b.description)}</p>
          ${!req.met && !isCreative ? `<div style="color:#ff5252; font-size:0.85rem;">🔒 Richiede: ${escapeHTML(req.missing.join(', '))}</div>` : ''}
          <div style="display:flex; flex-wrap:wrap; gap:10px; font-size:0.9rem; font-weight:700;">
            ${cost.metal > 0 ? `<span style="color:${hasM ? 'var(--res-metal)' : 'var(--btn-red)'};">M: ${formatNum(cost.metal)}</span>` : ''}
            ${cost.crystal > 0 ? `<span style="color:${hasC ? 'var(--res-crystal)' : 'var(--btn-red)'};">C: ${formatNum(cost.crystal)}</span>` : ''}
            ${cost.deuterium > 0 ? `<span style="color:${hasD ? 'var(--res-deuterium)' : 'var(--btn-red)'};">D: ${formatNum(cost.deuterium)}</span>` : ''}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:auto;">
            <span style="font-size:0.88rem;">⏱️ ${isCreative ? '<strong class="text-metal">ISTANTANEO (0s)</strong>' : formatDuration(buildSec)}</span>
            <button type="button" class="btn btn-green btn-sm btn-build-structure" data-bid="${b.id}" ${canBuild ? '' : 'disabled'}>
              ${b.maxLevel && curLv >= b.maxLevel ? 'MAX' : `COSTRUISCI LV.${nextLv}`}
            </button>
          </div>
        </div>
      `;
    }).join('');

    viewport.innerHTML = `
      <h2 style="font-size:1.1rem; color:var(--res-crystal); margin-bottom:12px;">EDIFICI PLANETARI — ${escapeHTML(planet.name)}</h2>
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(290px, 1fr)); gap:12px;">
        ${cards}
      </div>
    `;

    viewport.querySelectorAll('.btn-build-structure').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const res = Engine.startBuilding(currentUniverse, pIdx, btn.dataset.bid, false);
          await persistCurrentState(planet);
          updateTopBarNumbers();
          renderCurrentView();
          playSound(res.instant ? 'complete' : 'click');
          toast(res.instant ? `Edificio potenziato al Lv.${res.targetLevel}!` : `Costruzione Lv.${res.targetLevel} avviata.`, 'success');
        } catch (err) {
          playSound('error');
          toast(err.message, 'error');
        }
      });
    });
  }

  // ---------------------------------------------------------
  // 3. RICERCHE
  // ---------------------------------------------------------
  function renderResearch(viewport) {
    const Data = window.UniversumData;
    const Engine = window.UniversumEngine;
    const pIdx = getActivePlanetIndex();
    const planet = getActivePlanet();
    const isCreative = currentUniverse.creativeMode;

    const cards = Object.values(Data.RESEARCHES).map((r) => {
      const curLv = Number(currentUniverse.researches[r.id] || 0);
      const nextLv = curLv + 1;
      const cost = Data.getResearchCost(r.id, nextLv);
      const req = Data.checkRequirements(r.requirements, planet, currentUniverse, false);
      const resSec = Engine.getResearchTime(currentUniverse, r.id, nextLv);

      const hasM = isCreative || planet.resources.metal >= cost.metal;
      const hasC = isCreative || planet.resources.crystal >= cost.crystal;
      const hasD = isCreative || planet.resources.deuterium >= cost.deuterium;
      const canResearch = isCreative || (req.met && hasM && hasC && hasD && !currentUniverse.researchQueue);

      return `
        <div class="glass-panel" style="padding:14px; display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:1.05rem;">${r.icon} ${escapeHTML(r.name)}</strong>
            <span class="badge badge-blue">Livello ${curLv}</span>
          </div>
          <p class="text-muted" style="font-size:0.9rem;">${escapeHTML(r.description)}</p>
          ${!req.met && !isCreative ? `<div style="color:#ff5252; font-size:0.85rem;">🔒 Richiede: ${escapeHTML(req.missing.join(', '))}</div>` : ''}
          <div style="display:flex; flex-wrap:wrap; gap:10px; font-size:0.9rem; font-weight:700;">
            ${cost.metal > 0 ? `<span style="color:${hasM ? 'var(--res-metal)' : 'var(--btn-red)'};">M: ${formatNum(cost.metal)}</span>` : ''}
            ${cost.crystal > 0 ? `<span style="color:${hasC ? 'var(--res-crystal)' : 'var(--btn-red)'};">C: ${formatNum(cost.crystal)}</span>` : ''}
            ${cost.deuterium > 0 ? `<span style="color:${hasD ? 'var(--res-deuterium)' : 'var(--btn-red)'};">D: ${formatNum(cost.deuterium)}</span>` : ''}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:auto;">
            <span style="font-size:0.88rem;">⏱️ ${isCreative ? '<strong class="text-metal">ISTANTANEO (0s)</strong>' : formatDuration(resSec)}</span>
            <button type="button" class="btn btn-blue btn-sm btn-start-research" data-rid="${r.id}" ${canResearch ? '' : 'disabled'}>
              RICERCA LV.${nextLv}
            </button>
          </div>
        </div>
      `;
    }).join('');

    viewport.innerHTML = `
      <h2 style="font-size:1.1rem; color:var(--res-crystal); margin-bottom:12px;">LABORATORIO DI RICERCA GALATTICO</h2>
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(290px, 1fr)); gap:12px;">
        ${cards}
      </div>
    `;

    viewport.querySelectorAll('.btn-start-research').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const res = Engine.startResearch(currentUniverse, btn.dataset.rid, pIdx);
          await persistCurrentState(planet);
          updateTopBarNumbers();
          renderCurrentView();
          playSound(res.instant ? 'complete' : 'click');
          toast(res.instant ? `Ricerca completata al Lv.${res.targetLevel}!` : `Ricerca Lv.${res.targetLevel} avviata.`, 'success');
        } catch (err) {
          playSound('error');
          toast(err.message, 'error');
        }
      });
    });
  }

  // ---------------------------------------------------------
  // 4. CANTIERE NAVALE & DIFESA
  // ---------------------------------------------------------
  function renderShipyardAndDefense(viewport) {
    const Data = window.UniversumData;
    const Engine = window.UniversumEngine;
    const pIdx = getActivePlanetIndex();
    const planet = getActivePlanet();
    const isCreative = currentUniverse.creativeMode;
    const isDef = uiState.shipyardTab === 'defense';

    const dict = isDef ? Data.DEFENSES : Data.SHIPS;
    const ownedMap = isDef ? planet.defenses : planet.fleet;

    const cards = Object.values(dict).map((u) => {
      const owned = Number(ownedMap[u.id] || 0);
      const cost = Engine.getUnitCostAdjusted(planet, u.id, isDef);
      const req = Data.checkRequirements(u.requirements, planet, currentUniverse, false);
      const unitSec = Engine.getSingleUnitTime(currentUniverse, planet, u.id, isDef);

      const maxByM = cost.metal > 0 ? Math.floor(planet.resources.metal / cost.metal) : 999999;
      const maxByC = cost.crystal > 0 ? Math.floor(planet.resources.crystal / cost.crystal) : 999999;
      const maxByD = cost.deuterium > 0 ? Math.floor(planet.resources.deuterium / cost.deuterium) : 999999;
      const maxAffordable = isCreative ? 100 : Math.max(0, Math.min(maxByM, maxByC, maxByD, u.maxCount ? 1 : 99999));

      return `
        <div class="glass-panel" style="padding:14px; display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:1.05rem;">${u.icon} ${escapeHTML(u.name)}</strong>
            <span class="badge badge-green">In orbita: ${formatNum(owned)}</span>
          </div>
          <p class="text-muted" style="font-size:0.88rem;">${escapeHTML(u.description)}</p>
          <div style="display:flex; gap:10px; font-size:0.85rem; color:var(--res-crystal);">
            <span>⚔️ ${formatNum(u.attack)}</span>
            <span>🛡️ ${formatNum(u.shield)}</span>
            <span>🔩 ${formatNum(u.hull)}</span>
            ${u.cargo > 0 ? `<span>📦 ${formatNum(u.cargo)}</span>` : ''}
          </div>
          ${!req.met && !isCreative ? `<div style="color:#ff5252; font-size:0.85rem;">🔒 Richiede: ${escapeHTML(req.missing.join(', '))}</div>` : ''}
          <div style="display:flex; flex-wrap:wrap; gap:10px; font-size:0.88rem; font-weight:700;">
            ${cost.metal > 0 ? `<span class="text-metal">M: ${formatNum(cost.metal)}</span>` : ''}
            ${cost.crystal > 0 ? `<span class="text-crystal">C: ${formatNum(cost.crystal)}</span>` : ''}
            ${cost.deuterium > 0 ? `<span class="text-deuterium">D: ${formatNum(cost.deuterium)}</span>` : ''}
            <span>⏱️ ${isCreative ? '<strong class="text-metal">ISTANTANEO (0s)</strong>' : formatDuration(unitSec)}</span>
          </div>

          <div style="display:flex; gap:6px; align-items:center; margin-top:auto;">
            <input type="number" class="form-control unit-qty-input" data-uid="${u.id}" min="1" max="${u.maxCount || 99999}" value="1" style="width:84px; text-align:center;">
            <button type="button" class="btn btn-ghost btn-sm btn-qty-preset" data-uid="${u.id}" data-add="1">+1</button>
            <button type="button" class="btn btn-ghost btn-sm btn-qty-preset" data-uid="${u.id}" data-add="10">+10</button>
            <button type="button" class="btn btn-ghost btn-sm btn-qty-preset" data-uid="${u.id}" data-add="100">+100</button>
            <button type="button" class="btn btn-blue btn-sm btn-qty-max" data-uid="${u.id}" data-max="${maxAffordable}">MAX</button>
          </div>
          <button type="button" class="btn btn-green btn-produce-unit" data-uid="${u.id}" ${(!req.met && !isCreative) ? 'disabled' : ''}>
            PRODUCI UNITÀ
          </button>
        </div>
      `;
    }).join('');

    viewport.innerHTML = `
      <div style="display:flex; gap:10px; margin-bottom:14px;">
        <button type="button" id="tab-btn-ships" class="btn ${!isDef ? 'btn-blue' : 'btn-ghost'}" style="flex:1;">🚀 CANTIERE NAVALE</button>
        <button type="button" id="tab-btn-defense" class="btn ${isDef ? 'btn-blue' : 'btn-ghost'}" style="flex:1;">🛡️ DIFESA PLANETARIA</button>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:12px;">
        ${cards}
      </div>
    `;

    document.getElementById('tab-btn-ships')?.addEventListener('click', () => {
      uiState.shipyardTab = 'ships';
      renderCurrentView();
    });
    document.getElementById('tab-btn-defense')?.addEventListener('click', () => {
      uiState.shipyardTab = 'defense';
      renderCurrentView();
    });

    viewport.querySelectorAll('.btn-qty-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        const inp = viewport.querySelector(`.unit-qty-input[data-uid="${btn.dataset.uid}"]`);
        if (!inp) return;
        inp.value = Math.max(1, (Number(inp.value) || 0) + Number(btn.dataset.add));
      });
    });

    viewport.querySelectorAll('.btn-qty-max').forEach((btn) => {
      btn.addEventListener('click', () => {
        const inp = viewport.querySelector(`.unit-qty-input[data-uid="${btn.dataset.uid}"]`);
        if (!inp) return;
        inp.value = Math.max(1, Number(btn.dataset.max) || 1);
      });
    });

    viewport.querySelectorAll('.btn-produce-unit').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const uid = btn.dataset.uid;
        const inp = viewport.querySelector(`.unit-qty-input[data-uid="${uid}"]`);
        const qty = Math.max(1, Math.floor(Number(inp?.value) || 1));
        try {
          const res = Engine.buildUnits(currentUniverse, pIdx, uid, qty, isDef);
          await persistCurrentState(planet);
          updateTopBarNumbers();
          renderCurrentView();
          playSound(res.instant ? 'complete' : 'click');
          toast(res.instant ? `${qty} unità pronte in orbita!` : `Produzione di ${qty} unità avviata.`, 'success');
        } catch (err) {
          playSound('error');
          toast(err.message, 'error');
        }
      });
    });
  }

  // ---------------------------------------------------------
  // 5. FLOTTA & MISSIONI (OFFLINE + MULTIPLAYER PvP)
  // ---------------------------------------------------------
  function renderFleet(viewport) {
    const Data = window.UniversumData;
    const Galaxy = window.UniversumGalaxy;
    const pIdx = getActivePlanetIndex();
    const planet = getActivePlanet();

    const availableShips = Object.values(Data.SHIPS).filter((s) => s.id !== 'solarSatellite');
    const dist = Galaxy.calculateDistance(planet.coords, uiState.fleetTarget);
    const flightStats = Galaxy.getFleetSpeedAndFuel(currentUniverse, uiState.fleetSelection, dist);

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div class="glass-panel" style="padding:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
            <h2 style="font-size:1.05rem; color:var(--res-crystal);">1. SELEZIONE SQUADRONE</h2>
            <div style="display:flex; gap:8px;">
              <button type="button" id="btn-fleet-all" class="btn btn-blue btn-sm">TUTTI</button>
              <button type="button" id="btn-fleet-zero" class="btn btn-ghost btn-sm">AZZERA</button>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px;">
            ${availableShips.map((s) => {
              const avail = Number(planet.fleet[s.id] || 0);
              const sel = Number(uiState.fleetSelection[s.id] || 0);
              return `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; background:rgba(0,0,0,0.35); padding:8px 10px; border-radius:8px;">
                  <div style="min-width:0; flex:1;">
                    <strong>${s.icon} ${escapeHTML(s.name)}</strong>
                    <div class="text-muted" style="font-size:0.85rem;">Disp: ${formatNum(avail)}</div>
                  </div>
                  <div style="display:flex; gap:6px; align-items:center;">
                    <input type="number" class="form-control fleet-ship-input" data-sid="${s.id}" min="0" max="${avail}" value="${sel}" style="width:82px; text-align:center;" ${avail === 0 ? 'disabled' : ''}>
                    <button type="button" class="btn btn-ghost btn-sm btn-fleet-plus10" data-sid="${s.id}" ${avail === 0 ? 'disabled' : ''}>+10</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h2 style="font-size:1.05rem; color:var(--res-crystal); margin-bottom:10px;">2. COORDINATE & MISSIONE ${isMultiplayerMode ? '(PvP)' : ''}</h2>
          <div class="form-grid-3">
            <div class="form-group">
              <label>Galassia</label>
              <input type="number" id="flt-target-g" class="form-control" min="1" max="${currentUniverse.galaxies}" value="${uiState.fleetTarget.g}">
            </div>
            <div class="form-group">
              <label>Sistema</label>
              <input type="number" id="flt-target-s" class="form-control" min="1" max="${currentUniverse.systemsPerGalaxy}" value="${uiState.fleetTarget.s}">
            </div>
            <div class="form-group">
              <label>Posizione</label>
              <input type="number" id="flt-target-p" class="form-control" min="1" max="16" value="${uiState.fleetTarget.p}">
            </div>
          </div>

          <div class="form-group">
            <label>Tipo Missione</label>
            <select id="flt-mission-select" class="form-control">
              <option value="attack" ${uiState.fleetMission === 'attack' ? 'selected' : ''}>⚔️ Attacca Pianeta</option>
              <option value="spy" ${uiState.fleetMission === 'spy' ? 'selected' : ''}>👁️ Spionaggio</option>
              <option value="colonize" ${uiState.fleetMission === 'colonize' ? 'selected' : ''}>🌍 Colonizza Pianeta Vuoto</option>
              <option value="transport" ${uiState.fleetMission === 'transport' ? 'selected' : ''}>📦 Trasporta Risorse</option>
              ${!isMultiplayerMode ? `<option value="deploy" ${uiState.fleetMission === 'deploy' ? 'selected' : ''}>🛸 Schiera Flotta su Tuo Pianeta</option>` : ''}
              <option value="explore" ${uiState.fleetMission === 'explore' ? 'selected' : ''}>🌌 Esplora Spazio Profondo (Pos. 16)</option>
              <option value="recycle" ${uiState.fleetMission === 'recycle' ? 'selected' : ''}>♻️ Ricicla Campo Detriti</option>
              <option value="destroyMoon" ${uiState.fleetMission === 'destroyMoon' ? 'selected' : ''}>🌑 Distruggi Luna (Morte Nera)</option>
            </select>
          </div>

          <div id="blackhole-option-box" class="${(!isMultiplayerMode && uiState.fleetMission === 'explore') ? '' : 'hidden'}" style="margin-bottom:12px;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="flt-blackhole-chk" ${uiState.fleetBlackHole ? 'checked' : ''} style="width:20px; height:20px;">
              <span>Spedizione Segreta nel Buco Nero (+50.000 Deuterio, 5% di vincere 1.000.000 risorse)</span>
            </label>
          </div>

          <div class="form-grid-3">
            <div class="form-group">
              <label>Carico Metallo</label>
              <input type="number" id="flt-cargo-m" class="form-control" min="0" value="${uiState.fleetCargo.metal}">
            </div>
            <div class="form-group">
              <label>Carico Cristallo</label>
              <input type="number" id="flt-cargo-c" class="form-control" min="0" value="${uiState.fleetCargo.crystal}">
            </div>
            <div class="form-group">
              <label>Carico Deuterio</label>
              <input type="number" id="flt-cargo-d" class="form-control" min="0" value="${uiState.fleetCargo.deuterium}">
            </div>
          </div>

          <div style="background:rgba(0,0,0,0.4); padding:12px; border-radius:8px; margin-bottom:14px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <span>Distanza: <strong>${formatNum(dist)}</strong></span>
            <span>Durata Viaggio: <strong class="text-crystal">${formatDuration(flightStats.durationSec)}</strong></span>
            <span>Consumo Carburante: <strong class="text-deuterium">${formatNum(flightStats.fuelCost)} D</strong></span>
          </div>

          <button type="button" id="btn-launch-fleet" class="btn btn-green" style="width:100%;">🚀 INVIA FLOTTA IN MISSIONE</button>
        </div>
      </div>
    `;

    viewport.querySelectorAll('.fleet-ship-input').forEach((inp) => {
      inp.addEventListener('input', () => {
        uiState.fleetSelection[inp.dataset.sid] = Math.max(0, Math.floor(Number(inp.value) || 0));
      });
    });

    viewport.querySelectorAll('.btn-fleet-plus10').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sid = btn.dataset.sid;
        const avail = Number(planet.fleet[sid] || 0);
        uiState.fleetSelection[sid] = Math.min(avail, (uiState.fleetSelection[sid] || 0) + 10);
        renderCurrentView();
      });
    });

    document.getElementById('btn-fleet-all')?.addEventListener('click', () => {
      for (const s of availableShips) {
        uiState.fleetSelection[s.id] = Number(planet.fleet[s.id] || 0);
      }
      renderCurrentView();
    });

    document.getElementById('btn-fleet-zero')?.addEventListener('click', () => {
      uiState.fleetSelection = {};
      renderCurrentView();
    });

    const syncTarget = () => {
      uiState.fleetTarget.g = Math.max(1, Number(document.getElementById('flt-target-g').value) || 1);
      uiState.fleetTarget.s = Math.max(1, Number(document.getElementById('flt-target-s').value) || 1);
      uiState.fleetTarget.p = Math.max(1, Number(document.getElementById('flt-target-p').value) || 1);
      uiState.fleetMission = document.getElementById('flt-mission-select').value;
      uiState.fleetBlackHole = Boolean(document.getElementById('flt-blackhole-chk')?.checked);
      uiState.fleetCargo.metal = Math.max(0, Number(document.getElementById('flt-cargo-m').value) || 0);
      uiState.fleetCargo.crystal = Math.max(0, Number(document.getElementById('flt-cargo-c').value) || 0);
      uiState.fleetCargo.deuterium = Math.max(0, Number(document.getElementById('flt-cargo-d').value) || 0);
    };

    document.getElementById('flt-mission-select')?.addEventListener('change', (e) => {
      syncTarget();
      if (e.target.value === 'explore') uiState.fleetTarget.p = 16;
      renderCurrentView();
    });

    ['flt-target-g', 'flt-target-s', 'flt-target-p'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', () => {
        syncTarget();
        renderCurrentView();
      });
    });

    document.getElementById('btn-launch-fleet')?.addEventListener('click', async () => {
      syncTarget();
      try {
        if (isMultiplayerMode) {
          await persistCurrentState(planet);
          const mObj = await window.UniversumMP.launchOnlineFleet(
            currentUniverse.id,
            planet.coords,
            uiState.fleetTarget,
            uiState.fleetMission,
            uiState.fleetSelection,
            uiState.fleetCargo
          );
          await syncPlayerOnlinePlanets();
          uiState.fleetSelection = {};
          uiState.fleetCargo = { metal: 0, crystal: 0, deuterium: 0 };
          updateTopBarNumbers();
          playSound('success');
          toast(`Flotta PvP inviata verso [${mObj.targetCoords.g}:${mObj.targetCoords.s}:${mObj.targetCoords.p}]!`, 'success');
          switchView('overview');
        } else {
          const missionObj = Galaxy.launchFleet(
            currentUniverse,
            pIdx,
            uiState.fleetTarget,
            uiState.fleetMission,
            uiState.fleetSelection,
            uiState.fleetCargo,
            { blackHole: uiState.fleetBlackHole }
          );
          uiState.fleetSelection = {};
          uiState.fleetCargo = { metal: 0, crystal: 0, deuterium: 0 };
          await window.UniversumDB.save(currentUniverse);
          updateTopBarNumbers();
          playSound('success');
          toast(`Flotta inviata verso [${missionObj.targetCoords.g}:${missionObj.targetCoords.s}:${missionObj.targetCoords.p}]!`, 'success');
          switchView('overview');
        }
      } catch (err) {
        playSound('error');
        toast(err.message, 'error');
      }
    });
  }

  // ---------------------------------------------------------
  // 6. GALASSIA (OFFLINE + MULTIPLAYER CONDIVISA)
  // ---------------------------------------------------------
  async function renderGalaxy(viewport) {
    const Galaxy = window.UniversumGalaxy;
    const pIdx = getActivePlanetIndex();
    const g = Math.min(currentUniverse.galaxies, Math.max(1, uiState.galaxyG));
    const s = Math.min(currentUniverse.systemsPerGalaxy, Math.max(1, uiState.galaxyS));

    let sysData;
    if (isMultiplayerMode) {
      const cacheKey = `${currentUniverse.id}:${g}:${s}`;
      if (uiState.mpGalaxyCacheKey !== cacheKey || !uiState.mpGalaxyCacheData) {
        viewport.innerHTML = `<div class="glass-panel" style="padding:24px; text-align:center;"><p class="text-crystal">Scansione sistema [${g}:${s}] nella rete galattica...</p></div>`;
        try {
          uiState.mpGalaxyCacheData = await window.UniversumMP.getOnlineSystem(currentUniverse.id, g, s);
          uiState.mpGalaxyCacheKey = cacheKey;
        } catch (err) {
          viewport.innerHTML = `<div class="glass-panel" style="padding:20px; color:#ff5252;">${escapeHTML(err.message)}</div>`;
          return;
        }
      }
      sysData = uiState.mpGalaxyCacheData;
    } else {
      sysData = Galaxy.getSystemData(currentUniverse, g, s);
    }

    const filteredSlots = sysData.slots.filter((slot) => {
      if (uiState.galaxyFilter === 'mine') return slot.ownerType === 'player';
      if (uiState.galaxyFilter === 'bot') return slot.ownerType === 'bot' || slot.ownerType === 'enemy_player';
      if (uiState.galaxyFilter === 'empty') return slot.ownerType === 'empty';
      if (uiState.galaxyFilter === 'moon') return Boolean(slot.moon);
      return true;
    });

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div class="glass-panel" style="padding:14px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
            <div>
              <label style="font-size:0.8rem; color:var(--res-crystal);">GALASSIA (1-${currentUniverse.galaxies})</label>
              <div style="display:flex; gap:6px; margin-top:4px;">
                <button type="button" id="gal-prev-g" class="btn btn-blue btn-sm">&lt;</button>
                <input type="number" id="gal-inp-g" class="form-control" value="${sysData.galaxy}" min="1" max="${currentUniverse.galaxies}" style="text-align:center;">
                <button type="button" id="gal-next-g" class="btn btn-blue btn-sm">&gt;</button>
              </div>
            </div>
            <div>
              <label style="font-size:0.8rem; color:var(--res-crystal);">SISTEMA (1-${currentUniverse.systemsPerGalaxy})</label>
              <div style="display:flex; gap:6px; margin-top:4px;">
                <button type="button" id="gal-prev-s" class="btn btn-blue btn-sm">&lt;</button>
                <input type="number" id="gal-inp-s" class="form-control" value="${sysData.system}" min="1" max="${currentUniverse.systemsPerGalaxy}" style="text-align:center;">
                <button type="button" id="gal-next-s" class="btn btn-blue btn-sm">&gt;</button>
              </div>
            </div>
          </div>

          <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:4px;">
            ${[
              { id: 'all', label: 'Tutti' },
              { id: 'mine', label: 'Miei' },
              { id: 'bot', label: isMultiplayerMode ? 'Rivali PvP' : 'BOT' },
              { id: 'empty', label: 'Vuoti' },
              { id: 'moon', label: 'Lune' }
            ].map((f) => `
              <button type="button" class="btn btn-sm ${uiState.galaxyFilter === f.id ? 'btn-blue' : 'btn-ghost'} btn-gal-filter" data-filter="${f.id}">${f.label}</button>
            `).join('')}
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px;">
          ${filteredSlots.map((slot) => {
            const hasDebris = (slot.debris?.metal || 0) + (slot.debris?.crystal || 0) > 0;
            const isEnemyPvP = slot.ownerType === 'enemy_player';
            const isHostile = slot.ownerType === 'bot' || isEnemyPvP;

            let badgeHTML = '<span class="badge badge-blue">VUOTO</span>';
            if (slot.ownerType === 'player') {
              badgeHTML = '<span class="badge badge-green">TUO</span>';
            } else if (isEnemyPvP) {
              badgeHTML = '<span class="badge badge-pvp-real"><span class="status-dot-live"></span> GIOCATORE REALE</span>';
            } else if (slot.ownerType === 'bot') {
              badgeHTML = `<span class="badge badge-red">${escapeHTML(slot.tier)} • ${escapeHTML(slot.personality)}</span>`;
            }

            return `
              <div class="glass-panel ${isEnemyPvP ? 'slot-card-pvp-enemy' : ''}" style="padding:12px; display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                  <div>
                    <strong class="font-display text-crystal">[${slot.coords.p}]</strong>
                    <strong style="font-size:1.05rem; margin-left:6px;">${escapeHTML(slot.name)}</strong>
                    ${slot.moon ? `<span title="${escapeHTML(slot.moon.name || 'Luna')}"> 🌑</span>` : ''}
                    ${hasDebris ? `<span class="badge badge-creative" style="margin-left:4px;">♻️ Detriti</span>` : ''}
                  </div>
                  ${badgeHTML}
                </div>

                <div class="text-muted" style="font-size:0.88rem;">
                  ${slot.emperor ? `Imperatore: <strong style="color:#fff;">${escapeHTML(slot.emperor)}</strong> • ` : ''}
                  Temp: ${slot.minTemp}°/${slot.maxTemp}°C • Campi: ${slot.fieldsMax}
                </div>

                <div style="display:flex; flex-wrap:wrap; gap:6px;">
                  ${slot.ownerType === 'player' ? `
                    <button type="button" class="btn btn-green btn-sm btn-gal-action" data-act="manage" data-p="${slot.coords.p}" data-pid="${slot.planetId || ''}">🛰️ Gestisci</button>
                    <button type="button" class="btn btn-blue btn-sm btn-gal-action" data-act="rename-player" data-p="${slot.coords.p}" data-pid="${slot.planetId || ''}">✏️ Rinomina</button>
                  ` : ''}
                  ${isHostile ? `
                    <button type="button" class="btn btn-blue btn-sm btn-gal-action" data-act="quick-spy" data-p="${slot.coords.p}">👁️ Spia</button>
                    <button type="button" class="btn btn-red btn-sm btn-gal-action" data-act="prep-attack" data-p="${slot.coords.p}">⚔️ Attacca</button>
                    ${!isMultiplayerMode ? `<button type="button" class="btn btn-ghost btn-sm btn-gal-action" data-act="trade" data-p="${slot.coords.p}">🤝 Commercia</button>` : ''}
                  ` : ''}
                  ${slot.ownerType === 'empty' ? `
                    <button type="button" class="btn btn-green btn-sm btn-gal-action" data-act="prep-colonize" data-p="${slot.coords.p}">🌍 Colonizza</button>
                  ` : ''}
                  ${hasDebris ? `
                    <button type="button" class="btn btn-creative btn-sm btn-gal-action" data-act="prep-recycle" data-p="${slot.coords.p}">♻️ Ricicla</button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}

          <div class="glass-panel" style="padding:12px; border-color:var(--btn-creative); display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div>
              <strong class="font-display" style="color:var(--btn-gold);">[16] SPAZIO PROFONDO</strong>
              <div class="text-muted" style="font-size:0.88rem;">Invia flotte esplorative alla ricerca di relitti e anomalie.</div>
            </div>
            <button type="button" class="btn btn-creative btn-sm btn-gal-action" data-act="prep-explore" data-p="16">🌌 Esplora</button>
          </div>
        </div>
      </div>
    `;

    const setCoords = (ng, ns) => {
      uiState.galaxyG = Math.min(currentUniverse.galaxies, Math.max(1, ng));
      uiState.galaxyS = Math.min(currentUniverse.systemsPerGalaxy, Math.max(1, ns));
      uiState.mpGalaxyCacheKey = '';
      renderCurrentView();
    };

    document.getElementById('gal-prev-g')?.addEventListener('click', () => setCoords(sysData.galaxy - 1, sysData.system));
    document.getElementById('gal-next-g')?.addEventListener('click', () => setCoords(sysData.galaxy + 1, sysData.system));
    document.getElementById('gal-prev-s')?.addEventListener('click', () => setCoords(sysData.galaxy, sysData.system - 1));
    document.getElementById('gal-next-s')?.addEventListener('click', () => setCoords(sysData.galaxy, sysData.system + 1));

    document.getElementById('gal-inp-g')?.addEventListener('change', (e) => setCoords(Number(e.target.value), sysData.system));
    document.getElementById('gal-inp-s')?.addEventListener('change', (e) => setCoords(sysData.galaxy, Number(e.target.value)));

    viewport.querySelectorAll('.btn-gal-filter').forEach((btn) => {
      btn.addEventListener('click', () => {
        uiState.galaxyFilter = btn.dataset.filter;
        renderCurrentView();
      });
    });

    viewport.querySelectorAll('.btn-gal-action').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const act = btn.dataset.act;
        const pos = Number(btn.dataset.p);

        if (act === 'manage') {
          const found = currentUniverse.planets.find((pl) => pl.id === btn.dataset.pid || (pl.coords.g === sysData.galaxy && pl.coords.s === sysData.system && pl.coords.p === pos));
          if (found) currentUniverse.activePlanetId = found.id;
          refreshPlanetSelector();
          updateTopBarNumbers();
          switchView('overview');
        } else if (act === 'rename-player') {
          const idx = currentUniverse.planets.findIndex((pl) => pl.id === btn.dataset.pid || (pl.coords.g === sysData.galaxy && pl.coords.s === sysData.system && pl.coords.p === pos));
          if (idx >= 0) openRenamePlanetModal(idx);
        } else if (act === 'quick-spy') {
          try {
            if (isMultiplayerMode) {
              const originP = getActivePlanet();
              await persistCurrentState(originP);
              await window.UniversumMP.launchOnlineFleet(currentUniverse.id, originP.coords, { g: sysData.galaxy, s: sysData.system, p: pos }, 'spy', { espionageProbe: 2 });
              await syncPlayerOnlinePlanets();
            } else {
              Galaxy.launchFleet(currentUniverse, pIdx, { g: sysData.galaxy, s: sysData.system, p: pos }, 'spy', { espionageProbe: 2 });
              await window.UniversumDB.save(currentUniverse);
            }
            playSound('success');
            toast(`2 Sonde Spia lanciate verso [${sysData.galaxy}:${sysData.system}:${pos}]!`, 'success');
          } catch (err) {
            playSound('error');
            toast(err.message, 'error');
          }
        } else if (act === 'prep-attack') {
          uiState.fleetTarget = { g: sysData.galaxy, s: sysData.system, p: pos };
          uiState.fleetMission = 'attack';
          switchView('fleet');
        } else if (act === 'prep-colonize') {
          uiState.fleetTarget = { g: sysData.galaxy, s: sysData.system, p: pos };
          uiState.fleetMission = 'colonize';
          switchView('fleet');
        } else if (act === 'prep-recycle') {
          uiState.fleetTarget = { g: sysData.galaxy, s: sysData.system, p: pos };
          uiState.fleetMission = 'recycle';
          switchView('fleet');
        } else if (act === 'prep-explore') {
          uiState.fleetTarget = { g: sysData.galaxy, s: sysData.system, p: 16 };
          uiState.fleetMission = 'explore';
          switchView('fleet');
        } else if (act === 'trade') {
          uiState.fleetTarget = { g: sysData.galaxy, s: sysData.system, p: pos };
          switchView('diplomacy');
        }
      });
    });
  }

  // ---------------------------------------------------------
  // 7. SPIONAGGIO & CALCOLATORE BATTAGLIA INTERATTIVO
  // ---------------------------------------------------------
  function renderEspionageAndSim(viewport) {
    const Data = window.UniversumData;
    const reports = currentUniverse.spyReports || [];
    const selectedReport = reports.find((r) => r.id === uiState.selectedSpyReportId) || null;
    const planet = getActivePlanet();

    const combatShips = Object.values(Data.SHIPS).filter((s) => s.attack > 0 && s.id !== 'solarSatellite');

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        ${selectedReport ? `
          <div class="glass-panel" style="padding:14px; border-color:var(--btn-gold);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
              <h2 style="font-size:1.05rem; color:var(--btn-gold);">SIMULATORE TATTICO — ${escapeHTML(selectedReport.targetName)} [${selectedReport.key}]</h2>
              <button type="button" id="btn-close-sim" class="btn btn-ghost btn-sm">✕ CHIUDI SIMULATORE</button>
            </div>

            <div id="sim-results-panel" style="background:rgba(0,0,0,0.45); padding:12px; border-radius:10px; margin-bottom:12px;"></div>

            <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:14px;">
              ${combatShips.map((s) => {
                const maxOwned = Math.max(Number(planet.fleet[s.id] || 0), currentUniverse.creativeMode ? 500 : 0);
                const curVal = Number(uiState.simFleet[s.id] || 0);
                return `
                  <div style="background:rgba(0,0,0,0.35); padding:8px 10px; border-radius:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                      <span>${s.icon} <strong>${escapeHTML(s.name)}</strong> (Disp: ${formatNum(planet.fleet[s.id] || 0)})</span>
                      <span class="font-display text-crystal" id="sim-lbl-${s.id}">${curVal}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <button type="button" class="btn btn-ghost btn-sm btn-sim-step" data-sid="${s.id}" data-delta="-10" style="min-width:44px;">-</button>
                      <input type="range" class="sim-range-slider" data-sid="${s.id}" min="0" max="${Math.max(100, maxOwned)}" value="${curVal}" style="flex:1; height:32px;">
                      <button type="button" class="btn btn-ghost btn-sm btn-sim-step" data-sid="${s.id}" data-delta="10" style="min-width:44px;">+</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <button type="button" id="btn-sim-real-attack" class="btn btn-red" style="width:100%;">⚔️ INVIA FLOTTA VERA CONTRO [${selectedReport.key}]</button>
          </div>
        ` : ''}

        <div class="glass-panel" style="padding:14px;">
          <h2 style="font-size:1.05rem; color:var(--res-crystal); margin-bottom:10px;">ARCHIVIO RAPPORTI DI SPIONAGGIO (${reports.length})</h2>
          ${reports.length === 0 ? '<p class="text-muted">Nessun rapporto disponibile. Invia Sonde Spia dalla Galassia.</p>' : `
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${reports.map((r) => `
                <div style="background:rgba(0,0,0,0.35); padding:12px; border-radius:8px; border:1px solid rgba(0,210,255,0.2);">
                  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:6px;">
                    <strong>${escapeHTML(r.targetName)} [${r.key}] — ${escapeHTML(r.emperor)}</strong>
                    <span class="badge badge-blue">Scansioni: ${r.scanCount || 1}</span>
                  </div>
                  <div style="font-size:0.9rem; margin-bottom:8px;">
                    Risorse: <span class="text-metal">${formatNum(r.resources.metal)} M</span> |
                    <span class="text-crystal">${formatNum(r.resources.crystal)} C</span> |
                    <span class="text-deuterium">${formatNum(r.resources.deuterium)} D</span>
                  </div>
                  <button type="button" class="btn btn-creative btn-sm btn-open-sim" data-rid="${r.id}">🧮 SIMULA BATTAGLIA</button>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;

    if (selectedReport) {
      runDebouncedSimulation(selectedReport);

      document.getElementById('btn-close-sim')?.addEventListener('click', () => {
        uiState.selectedSpyReportId = null;
        renderCurrentView();
      });

      viewport.querySelectorAll('.sim-range-slider').forEach((slider) => {
        slider.addEventListener('input', () => {
          const sid = slider.dataset.sid;
          const val = Math.max(0, Math.floor(Number(slider.value) || 0));
          uiState.simFleet[sid] = val;
          const lbl = document.getElementById(`sim-lbl-${sid}`);
          if (lbl) lbl.textContent = val;
          runDebouncedSimulation(selectedReport);
        });
      });

      viewport.querySelectorAll('.btn-sim-step').forEach((btn) => {
        btn.addEventListener('click', () => {
          const sid = btn.dataset.sid;
          const delta = Number(btn.dataset.delta);
          const slider = viewport.querySelector(`.sim-range-slider[data-sid="${sid}"]`);
          const next = Math.max(0, (uiState.simFleet[sid] || 0) + delta);
          uiState.simFleet[sid] = next;
          if (slider) {
            if (next > Number(slider.max)) slider.max = next;
            slider.value = next;
          }
          const lbl = document.getElementById(`sim-lbl-${sid}`);
          if (lbl) lbl.textContent = next;
          runDebouncedSimulation(selectedReport);
        });
      });

      document.getElementById('btn-sim-real-attack')?.addEventListener('click', () => {
        uiState.fleetSelection = Object.assign({}, uiState.simFleet);
        uiState.fleetTarget = Object.assign({}, selectedReport.coords);
        uiState.fleetMission = 'attack';
        switchView('fleet');
      });
    }

    viewport.querySelectorAll('.btn-open-sim').forEach((btn) => {
      btn.addEventListener('click', () => {
        uiState.selectedSpyReportId = btn.dataset.rid;
        uiState.simFleet = {};
        for (const s of combatShips) {
          uiState.simFleet[s.id] = Number(planet.fleet[s.id] || 0);
        }
        renderCurrentView();
      });
    });
  }

  function runDebouncedSimulation(report) {
    if (uiState.simDebounceTimer) clearTimeout(uiState.simDebounceTimer);
    uiState.simDebounceTimer = setTimeout(() => {
      const box = document.getElementById('sim-results-panel');
      if (!box) return;
      try {
        let res;
        if (isMultiplayerMode && report.fleet) {
          // Simulazione diretta sui dati spiati del giocatore PvP
          let wins = 0;
          let draws = 0;
          let losses = 0;
          const iterations = 25;
          for (let i = 0; i < iterations; i++) {
            const c = window.UniversumGalaxy.resolveCombat(uiState.simFleet, currentUniverse.researches, {
              fleet: report.fleet || {},
              defenses: report.defenses || {},
              tech: {},
              resources: report.resources,
              buildings: report.buildings || {},
              moon: report.moon
            });
            if (c.result === 'attacker_win') wins++;
            else if (c.result === 'draw') draws++;
            else losses++;
          }
          const winPct = Math.round((wins / iterations) * 100);
          const drawPct = Math.round((draws / iterations) * 100);
          const losePct = Math.max(0, 100 - winPct - drawPct);
          res = {
            winPct,
            drawPct,
            losePct,
            uncertaintyPct: 5,
            avgLosses: 0,
            estimatedLoot: Math.floor(((report.resources.metal + report.resources.crystal + report.resources.deuterium) * 0.5) * (winPct / 100)),
            debrisCreated: 0,
            moonDestroyChance: 0,
            planetDestroyChance: 0,
            advice: winPct >= 80 ? 'ATTACCO CONSIGLIATO' : winPct < 45 ? 'NON ATTACCARE - SEI TROPPO DEBOLE' : 'ATTACCO RISCHIOSO'
          };
        } else {
          res = window.UniversumGalaxy.simulateBattle(
            uiState.simFleet,
            currentUniverse.researches,
            report.coords,
            currentUniverse,
            30
          );
        }

        let adviceColor = 'var(--res-energy)';
        if (res.advice === 'ATTACCO CONSIGLIATO') adviceColor = 'var(--btn-green)';
        else if (res.advice.startsWith('NON ATTACCARE')) adviceColor = 'var(--btn-red)';

        box.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
            <strong class="font-display" style="color:${adviceColor};">${res.advice}</strong>
            <span class="badge badge-blue">Incertezza Spia: ±${res.uncertaintyPct}%</span>
          </div>
          <div style="display:flex; height:14px; border-radius:7px; overflow:hidden; background:#111; margin-bottom:8px;">
            <div style="width:${res.winPct}%; background:var(--btn-green);"></div>
            <div style="width:${res.drawPct}%; background:var(--res-energy);"></div>
            <div style="width:${res.losePct}%; background:var(--btn-red);"></div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.88rem; margin-bottom:8px;">
            <span class="text-metal">Vittoria: ${res.winPct}%</span>
            <span class="text-energy">Pareggio: ${res.drawPct}%</span>
            <span style="color:var(--btn-red);">Sconfitta: ${res.losePct}%</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:0.86rem;">
            <div>Perdite Medie: <strong>${formatNum(res.avgLosses)}</strong></div>
            <div>Bottino Stimato: <strong class="text-metal">${formatNum(res.estimatedLoot)}</strong></div>
            <div>Detriti Generati: <strong class="text-crystal">${formatNum(res.debrisCreated)}</strong></div>
            <div>Distruzione Luna/Pianeta: <strong>${res.moonDestroyChance}% / ${res.planetDestroyChance}%</strong></div>
          </div>
        `;
      } catch (e) {
        box.innerHTML = `<p class="text-muted">${escapeHTML(e.message)}</p>`;
      }
    }, 100);
  }

  // ---------------------------------------------------------
  // 8. LUNA
  // ---------------------------------------------------------
  function renderMoon(viewport) {
    const Data = window.UniversumData;
    const Engine = window.UniversumEngine;
    const Galaxy = window.UniversumGalaxy;
    const pIdx = getActivePlanetIndex();
    const planet = getActivePlanet();
    const isCreative = currentUniverse.creativeMode;

    if (!planet.moon) {
      const cost = Galaxy.getMoonCreationCost(currentUniverse);
      viewport.innerHTML = `
        <div class="glass-panel" style="padding:20px; text-align:center;">
          <div style="font-size:3rem; margin-bottom:8px;">🌑</div>
          <h2 style="font-size:1.15rem; color:var(--res-crystal); margin-bottom:8px;">NESSUNA LUNA IN ORBITA SU ${escapeHTML(planet.name)}</h2>
          <p class="text-muted" style="margin-bottom:14px;">Stabilizza i detriti gravitazionali per creare un satellite artificiale dotato di Falange di Sensori e Portale Iperspaziale (Richiede Ingegneria Lunare Lv.1).</p>
          <div style="margin-bottom:16px; font-weight:700;">
            Costo: <span class="text-metal">${formatNum(cost.metal)} M</span> • <span class="text-crystal">${formatNum(cost.crystal)} C</span> • <span class="text-deuterium">${formatNum(cost.deuterium)} D</span>
          </div>
          <button type="button" id="btn-create-moon" class="btn btn-green">🌑 CREA LUNA ORA</button>
        </div>
      `;

      document.getElementById('btn-create-moon')?.addEventListener('click', async () => {
        try {
          Galaxy.createMoon(currentUniverse, pIdx);
          await persistCurrentState(planet);
          refreshPlanetSelector();
          updateTopBarNumbers();
          renderCurrentView();
          playSound('complete');
          toast('Nuova Luna stabilizzata in orbita!', 'success');
        } catch (err) {
          playSound('error');
          toast(err.message, 'error');
        }
      });
      return;
    }

    const moon = planet.moon;
    const usedFields = Data.getMoonUsedFields(moon);
    const maxFields = Data.getMoonMaxFields(moon);
    const otherMoons = currentUniverse.planets
      .map((pl, i) => ({ pl, i }))
      .filter((item) => item.i !== pIdx && item.pl.moon);

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div class="glass-panel" style="padding:14px;">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <h2 style="font-size:1.2rem; color:#fff;">🌑 ${escapeHTML(moon.name || 'Luna')}</h2>
              <button type="button" id="btn-rename-moon" class="btn btn-blue btn-sm" style="min-width:44px; min-height:44px;">✏️ Rinomina Luna</button>
            </div>
            <span class="badge badge-blue">Campi Lunari: ${usedFields} / ${maxFields}</span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:12px;">
          ${Object.values(Data.MOON_BUILDINGS).map((mb) => {
            const curLv = Number(moon.buildings?.[mb.id] || 0);
            const nextLv = curLv + 1;
            const cost = Data.getBuildingCost(mb.id, nextLv, true);
            const buildSec = Engine.getBuildingBuildTime(currentUniverse, planet, mb.id, nextLv, true);
            return `
              <div class="glass-panel" style="padding:14px; display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between;">
                  <strong>${mb.icon} ${escapeHTML(mb.name)}</strong>
                  <span class="badge badge-blue">Lv.${curLv}</span>
                </div>
                <p class="text-muted" style="font-size:0.88rem;">${escapeHTML(mb.description)}</p>
                <div style="font-size:0.88rem; font-weight:700;">
                  <span class="text-metal">M: ${formatNum(cost.metal)}</span> •
                  <span class="text-crystal">C: ${formatNum(cost.crystal)}</span> •
                  <span class="text-deuterium">D: ${formatNum(cost.deuterium)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto;">
                  <span>⏱️ ${isCreative ? '<strong class="text-metal">ISTANTANEO (0s)</strong>' : formatDuration(buildSec)}</span>
                  <button type="button" class="btn btn-green btn-sm btn-build-moon" data-mbid="${mb.id}">COSTRUISCI</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:1rem; color:var(--btn-gold); margin-bottom:8px;">🌀 PORTALE IPERSPAZIALE (SALTO ISTANTANEO)</h3>
          ${otherMoons.length === 0 ? '<p class="text-muted">Crea almeno un’altra Luna su una colonia per attivare i salti tra Portali.</p>' : `
            <div class="form-group">
              <label>Luna di Destinazione</label>
              <select id="jumpgate-dest-select" class="form-control">
                ${otherMoons.map((m) => `<option value="${m.i}">${escapeHTML(m.pl.moon.name || 'Luna')} (${escapeHTML(m.pl.name)} [${m.pl.coords.g}:${m.pl.coords.s}:${m.pl.coords.p}])</option>`).join('')}
              </select>
            </div>
            <button type="button" id="btn-trigger-jumpgate" class="btn btn-creative" style="width:100%;">🌀 TELETRASPORTA TUTTA LA FLOTTA (10.000 D)</button>
          `}
        </div>
      </div>
    `;

    document.getElementById('btn-rename-moon')?.addEventListener('click', () => openRenameMoonModal(pIdx));

    viewport.querySelectorAll('.btn-build-moon').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const res = Engine.startBuilding(currentUniverse, pIdx, btn.dataset.mbid, true);
          await persistCurrentState(planet);
          updateTopBarNumbers();
          renderCurrentView();
          playSound(res.instant ? 'complete' : 'click');
          toast(res.instant ? 'Struttura lunare completata!' : 'Costruzione lunare avviata.', 'success');
        } catch (err) {
          playSound('error');
          toast(err.message, 'error');
        }
      });
    });

    document.getElementById('btn-trigger-jumpgate')?.addEventListener('click', async () => {
      try {
        const destIdx = Number(document.getElementById('jumpgate-dest-select').value);
        const res = Galaxy.useJumpGate(currentUniverse, pIdx, destIdx, planet.fleet);
        await persistCurrentState(planet);
        if (isMultiplayerMode) {
          await persistCurrentState(currentUniverse.planets[destIdx]);
        }
        updateTopBarNumbers();
        renderCurrentView();
        playSound('complete');
        toast(`Salto iperspaziale completato: ${res.movedCount} navi teletrasportate!`, 'creative');
      } catch (err) {
        playSound('error');
        toast(err.message, 'error');
      }
    });
  }

  // ---------------------------------------------------------
  // 9. COMMERCIO & DIPLOMAZIA
  // ---------------------------------------------------------
  function renderDiplomacy(viewport) {
    const Galaxy = window.UniversumGalaxy;
    const pIdx = getActivePlanetIndex();
    const contracts = currentUniverse.contracts || [];

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        ${!isMultiplayerMode ? `
          <div class="glass-panel" style="padding:14px;">
            <h2 style="font-size:1.05rem; color:var(--res-crystal); margin-bottom:10px;">🤝 SCAMBIO COMMERCIALE CON BOT</h2>
            <div class="form-grid-3">
              <div class="form-group">
                <label>Galassia BOT</label>
                <input type="number" id="trd-g" class="form-control" value="${uiState.fleetTarget.g}" min="1" max="${currentUniverse.galaxies}">
              </div>
              <div class="form-group">
                <label>Sistema BOT</label>
                <input type="number" id="trd-s" class="form-control" value="${uiState.fleetTarget.s}" min="1" max="${currentUniverse.systemsPerGalaxy}">
              </div>
              <div class="form-group">
                <label>Posizione BOT</label>
                <input type="number" id="trd-p" class="form-control" value="${uiState.fleetTarget.p}" min="1" max="15">
              </div>
            </div>
            <div class="form-grid-3">
              <div class="form-group">
                <label>Cedi</label>
                <select id="trd-give-res" class="form-control">
                  <option value="metal">Metallo</option>
                  <option value="crystal">Cristallo</option>
                  <option value="deuterium">Deuterio</option>
                </select>
              </div>
              <div class="form-group">
                <label>Quantità</label>
                <input type="number" id="trd-amount" class="form-control" value="10000" min="100">
              </div>
              <div class="form-group">
                <label>Ricevi</label>
                <select id="trd-get-res" class="form-control">
                  <option value="crystal">Cristallo</option>
                  <option value="deuterium">Deuterio</option>
                  <option value="metal">Metallo</option>
                </select>
              </div>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:10px;">
              <button type="button" id="btn-exec-bot-trade" class="btn btn-green" style="flex:1;">SCAMBIA CON BOT</button>
              <button type="button" id="btn-sign-bot-contract" class="btn btn-blue" style="flex:1;">🛡️ PATTO DIFESA (10k M)</button>
            </div>
          </div>
        ` : ''}

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:1rem; color:var(--btn-gold); margin-bottom:10px;">🕶️ MERCATO NERO GALATTICO (TASSO 3:2:1 -15%)</h3>
          <div class="form-grid-3">
            <div class="form-group">
              <label>Offri</label>
              <select id="bm-give" class="form-control">
                <option value="metal">Metallo</option>
                <option value="crystal">Cristallo</option>
                <option value="deuterium">Deuterio</option>
              </select>
            </div>
            <div class="form-group">
              <label>Quantità</label>
              <input type="number" id="bm-amount" class="form-control" value="15000" min="500">
            </div>
            <div class="form-group">
              <label>Ottieni</label>
              <select id="bm-get" class="form-control">
                <option value="deuterium">Deuterio</option>
                <option value="crystal">Cristallo</option>
                <option value="metal">Metallo</option>
              </select>
            </div>
          </div>
          <button type="button" id="btn-exec-blackmarket" class="btn btn-creative" style="width:100%;">ESEGUI TRANSAZIONE ISTANTANEA</button>
        </div>

        ${!isMultiplayerMode ? `
          <div class="glass-panel" style="padding:14px;">
            <h3 style="font-size:1rem; color:var(--res-crystal); margin-bottom:8px;">CONTRATTI ATTIVI (${contracts.length})</h3>
            ${contracts.length === 0 ? '<p class="text-muted">Nessun patto siglato.</p>' : contracts.map((c) => `
              <div style="padding:8px; background:rgba(0,0,0,0.35); border-radius:8px; margin-bottom:6px;">
                <strong>${escapeHTML(c.botName)} [${c.key}]</strong> — Protezione attiva (${formatNum(c.dailyCostMetal)} M/giorno)
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;

    document.getElementById('btn-exec-bot-trade')?.addEventListener('click', async () => {
      try {
        const coords = {
          g: Number(document.getElementById('trd-g').value),
          s: Number(document.getElementById('trd-s').value),
          p: Number(document.getElementById('trd-p').value)
        };
        const res = Galaxy.tradeWithBot(
          currentUniverse,
          pIdx,
          coords,
          document.getElementById('trd-give-res').value,
          Number(document.getElementById('trd-amount').value),
          document.getElementById('trd-get-res').value
        );
        await persistCurrentState();
        updateTopBarNumbers();
        playSound('success');
        toast(`Scambio con ${res.botName}: ricevuti ${formatNum(res.received)}!`, 'success');
      } catch (err) {
        playSound('error');
        toast(err.message, 'error');
      }
    });

    document.getElementById('btn-sign-bot-contract')?.addEventListener('click', async () => {
      try {
        const coords = {
          g: Number(document.getElementById('trd-g').value),
          s: Number(document.getElementById('trd-s').value),
          p: Number(document.getElementById('trd-p').value)
        };
        const ctr = Galaxy.signBotContract(currentUniverse, pIdx, coords);
        await persistCurrentState();
        updateTopBarNumbers();
        renderCurrentView();
        playSound('complete');
        toast(`Patto siglato con ${ctr.botName}!`, 'success');
      } catch (err) {
        playSound('error');
        toast(err.message, 'error');
      }
    });

    document.getElementById('btn-exec-blackmarket')?.addEventListener('click', async () => {
      try {
        const res = Galaxy.blackMarketTrade(
          currentUniverse,
          pIdx,
          document.getElementById('bm-give').value,
          Number(document.getElementById('bm-amount').value),
          document.getElementById('bm-get').value
        );
        await persistCurrentState();
        updateTopBarNumbers();
        playSound('success');
        toast(`Mercato Nero: ottenuti ${formatNum(res.received)}!`, 'creative');
      } catch (err) {
        playSound('error');
        toast(err.message, 'error');
      }
    });
  }

  // ---------------------------------------------------------
  // 10. VISTA IMPERIALE
  // ---------------------------------------------------------
  function renderEmpire(viewport) {
    const Engine = window.UniversumEngine;
    let totM = 0;
    let totC = 0;
    let totD = 0;

    const rows = currentUniverse.planets.map((p, idx) => {
      const prod = Engine.getPlanetProduction(p, currentUniverse);
      totM += prod.metalPerHour;
      totC += prod.crystalPerHour;
      totD += prod.deuteriumPerHour;

      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:6px;">
              <button type="button" class="btn btn-ghost btn-sm btn-emp-rename" data-idx="${idx}" style="min-width:40px; min-height:40px; padding:4px 8px;" title="Rinomina">✏️</button>
              <button type="button" class="btn btn-blue btn-sm btn-emp-select" data-pid="${p.id}">${escapeHTML(p.name)}</button>
            </div>
          </td>
          <td class="font-display">[${p.coords.g}:${p.coords.s}:${p.coords.p}]${p.moon ? ' 🌑' : ''}</td>
          <td class="text-metal">${formatNum(p.resources.metal)} (+${formatNum(prod.metalPerHour)}/h)</td>
          <td class="text-crystal">${formatNum(p.resources.crystal)} (+${formatNum(prod.crystalPerHour)}/h)</td>
          <td class="text-deuterium">${formatNum(p.resources.deuterium)} (+${formatNum(prod.deuteriumPerHour)}/h)</td>
          <td>M:${p.buildings.metalMine || 0} C:${p.buildings.crystalMine || 0} D:${p.buildings.deuteriumSynth || 0}</td>
        </tr>
      `;
    }).join('');

    viewport.innerHTML = `
      <div class="glass-panel" style="padding:14px;">
        <h2 style="font-size:1.1rem; color:var(--res-crystal); margin-bottom:8px;">👑 RIEPILOGO IMPERIALE (${currentUniverse.planets.length} PIANETI)</h2>
        <p style="margin-bottom:12px; font-size:0.95rem;">
          Produzione Totale Impero:
          <strong class="text-metal">+${formatNum(totM)} M/h</strong> •
          <strong class="text-crystal">+${formatNum(totC)} C/h</strong> •
          <strong class="text-deuterium">+${formatNum(totD)} D/h</strong>
        </p>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Pianeta</th>
                <th>Coord.</th>
                <th>Metallo</th>
                <th>Cristallo</th>
                <th>Deuterio</th>
                <th>Miniere</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;

    viewport.querySelectorAll('.btn-emp-rename').forEach((btn) => {
      btn.addEventListener('click', () => openRenamePlanetModal(Number(btn.dataset.idx)));
    });

    viewport.querySelectorAll('.btn-emp-select').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentUniverse.activePlanetId = btn.dataset.pid;
        refreshPlanetSelector();
        updateTopBarNumbers();
        switchView('overview');
      });
    });
  }

  // ---------------------------------------------------------
  // 11. CLASSIFICA (REALE IN MULTIPLAYER, VS BOT IN OFFLINE)
  // ---------------------------------------------------------
  async function renderHighscoreAndQuests(viewport) {
    if (isMultiplayerMode && window.UniversumMP) {
      viewport.innerHTML = `<div class="glass-panel" style="padding:24px; text-align:center;"><p class="text-crystal">Calcolo classifica imperatori PvP...</p></div>`;
      try {
        const leaderboard = await window.UniversumMP.getLeaderboard(currentUniverse.id);
        const me = window.UniversumMP.getCurrentUser();
        const myUid = me ? me.uid : null;

        viewport.innerHTML = `
          <div class="glass-panel" style="padding:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
              <h2 style="font-size:1.1rem; color:var(--btn-gold);">🏆 CLASSIFICA GLOBALE PvP (${leaderboard.length} IMPERATORI)</h2>
              <button type="button" id="btn-refresh-mp-rank" class="btn btn-blue btn-sm">↻ AGGIORNA</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${leaderboard.map((row, idx) => {
                const isMe = row.uid === myUid;
                return `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-radius:8px; background:${isMe ? 'rgba(0,210,255,0.2)' : 'rgba(0,0,0,0.38)'}; border:1px solid ${isMe ? 'var(--btn-blue)' : 'rgba(255,255,255,0.08)'};">
                    <div>
                      <strong class="font-display" style="color:${idx === 0 ? 'var(--btn-gold)' : '#fff'};">#${idx + 1}</strong>
                      <strong style="margin-left:8px; font-size:1.05rem;">${escapeHTML(row.nickname)}</strong>
                      ${isMe ? '<span class="badge badge-green" style="margin-left:6px;">TU</span>' : '<span class="badge badge-red" style="margin-left:6px;">PvP</span>'}
                      <div class="text-muted" style="font-size:0.84rem; margin-top:2px;">
                        Pianeti: ${row.planetCount} • Edifici: ${formatNum(row.buildingPts)} • Ricerche: ${formatNum(row.researchPts)} • Flotta: ${formatNum(row.fleetPts)}
                      </div>
                    </div>
                    <strong class="font-display text-crystal" style="font-size:1rem;">${formatNum(row.totalPts)} pt</strong>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;

        document.getElementById('btn-refresh-mp-rank')?.addEventListener('click', () => renderCurrentView());
      } catch (err) {
        viewport.innerHTML = `<div class="glass-panel" style="padding:18px; color:#ff5252;">${escapeHTML(err.message)}</div>`;
      }
      return;
    }

    // Modalità Offline
    const Data = window.UniversumData;
    let buildingPts = 0;
    let fleetPts = 0;
    for (const p of currentUniverse.planets) {
      for (const lv of Object.values(p.buildings || {})) buildingPts += (Number(lv) || 0) * 150;
      for (const [sId, cnt] of Object.entries(p.fleet || {})) {
        const spec = Data.SHIPS[sId];
        if (spec) fleetPts += Math.floor(((spec.cost.metal + spec.cost.crystal + spec.cost.deuterium) / 1000) * cnt);
      }
    }
    let researchPts = 0;
    for (const lv of Object.values(currentUniverse.researches || {})) {
      researchPts += (Number(lv) || 0) * 350;
    }

    const playerTotal = buildingPts + researchPts + fleetPts;
    const rivals = [
      { name: 'Egemonia Valkor', pts: Math.floor(playerTotal * 1.45 + 12000), tag: 'BOT Elite' },
      { name: 'Dominio Krell', pts: Math.floor(playerTotal * 0.95 + 6500), tag: 'BOT Forte' },
      { name: `${currentUniverse.emperor} (Tu)`, pts: playerTotal, tag: 'IMPERATORE', isPlayer: true },
      { name: 'Alleanza Orion', pts: Math.floor(playerTotal * 0.6 + 2200), tag: 'BOT Medio' },
      { name: 'Avanguardia Sirius', pts: Math.floor(playerTotal * 0.3 + 800), tag: 'BOT Debole' }
    ].sort((a, b) => b.pts - a.pts);

    const achievements = [
      { title: 'Signore delle Stelle', desc: 'Possiedi almeno 3 pianeti nel tuo Impero.', unlocked: currentUniverse.planets.length >= 3 },
      { title: 'Architetto Lunare', desc: 'Stabilizza almeno 1 Luna in orbita.', unlocked: currentUniverse.planets.some((p) => Boolean(p.moon)) },
      { title: 'Terrore della Galassia', desc: 'Costruisci o conquista almeno 1 Morte Nera.', unlocked: currentUniverse.planets.some((p) => (p.fleet?.deathStar || 0) >= 1) },
      { title: 'Maestro dello Spionaggio', desc: 'Accumula 5 rapporti di spionaggio.', unlocked: (currentUniverse.spyReports || []).length >= 5 }
    ];

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div class="glass-panel" style="padding:14px;">
          <h2 style="font-size:1.1rem; color:var(--btn-gold); margin-bottom:10px;">🏆 CLASSIFICA GALATTICA</h2>
          <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:12px; font-size:0.9rem;">
            <span>Edifici: <strong>${formatNum(buildingPts)}</strong></span>
            <span>Ricerche: <strong>${formatNum(researchPts)}</strong></span>
            <span>Flotta: <strong>${formatNum(fleetPts)}</strong></span>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${rivals.map((r, i) => `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-radius:8px; background:${r.isPlayer ? 'rgba(0,210,255,0.18)' : 'rgba(0,0,0,0.35)'}; border:1px solid ${r.isPlayer ? 'var(--btn-blue)' : 'transparent'};">
                <div>
                  <strong class="font-display">#${i + 1}</strong>
                  <strong style="margin-left:8px;">${escapeHTML(r.name)}</strong>
                  <span class="badge ${r.isPlayer ? 'badge-green' : 'badge-blue'}" style="margin-left:6px;">${r.tag}</span>
                </div>
                <strong class="font-display text-crystal">${formatNum(r.pts)} pt</strong>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:1rem; color:var(--res-crystal); margin-bottom:10px;">🎖️ OBIETTIVI & TITOLI SBLOCCABILI</h3>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${achievements.map((a) => `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-radius:8px; background:rgba(0,0,0,0.35);">
                <div>
                  <strong>${escapeHTML(a.title)}</strong>
                  <div class="text-muted" style="font-size:0.88rem;">${escapeHTML(a.desc)}</div>
                </div>
                <span class="badge ${a.unlocked ? 'badge-green' : 'badge-blue'}">${a.unlocked ? 'SBLOCCATO' : 'BLOCCATO'}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // ---------------------------------------------------------
  // 12. CHAT GALATTICA (SOLO MULTIPLAYER)
  // ---------------------------------------------------------
  function renderGalacticChat(viewport) {
    if (!isMultiplayerMode || !window.UniversumMP) {
      viewport.innerHTML = `<div class="glass-panel" style="padding:20px;"><p class="text-muted">La Chat Galattica è disponibile negli Universi Online Multiplayer.</p></div>`;
      return;
    }

    const me = window.UniversumMP.getCurrentUser();
    const myUid = me ? me.uid : null;

    viewport.innerHTML = `
      <div class="glass-panel chat-container" style="padding:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <h2 style="font-size:1.05rem; color:var(--res-crystal);">💬 FREQUENZA GALATTICA — ${escapeHTML(currentUniverse.name)}</h2>
          <span class="badge badge-green"><span class="status-dot-live"></span> LIVE</span>
        </div>

        <div id="chat-messages-feed" class="chat-messages-box">
          ${renderChatMessagesHTML(uiState.chatMessages, myUid)}
        </div>

        <form id="form-send-chat" class="chat-input-bar">
          <input type="text" id="input-chat-msg" class="form-control" placeholder="Trasmetti messaggio agli imperatori..." maxlength="240" autocomplete="off" required>
          <button type="submit" class="btn btn-green">INVIA</button>
        </form>
      </div>
    `;

    const feedEl = document.getElementById('chat-messages-feed');
    if (feedEl) feedEl.scrollTop = feedEl.scrollHeight;

    document.getElementById('form-send-chat')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const inp = document.getElementById('input-chat-msg');
      const txt = inp?.value || '';
      if (!txt.trim()) return;
      inp.value = '';
      try {
        await window.UniversumMP.sendChatMessage(currentUniverse.id, txt);
        playSound('click');
      } catch (err) {
        playSound('error');
        toast(err.message, 'error');
      }
    });
  }

  function renderChatMessagesHTML(messages, myUid) {
    if (!messages || messages.length === 0) {
      return '<p class="text-muted" style="text-align:center; margin:auto;">Nessuna trasmissione recente su questo canale.</p>';
    }
    return messages.map((m) => {
      const isMine = myUid && m.senderUid === myUid;
      const d = new Date(m.time || Date.now());
      const timeStr = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="chat-msg-item ${isMine ? 'mine' : ''}">
          <div class="chat-msg-header">
            <span class="chat-sender-name">${escapeHTML(m.senderName || 'Comandante')}</span>
            <span class="chat-timestamp">${timeStr}</span>
          </div>
          <div class="chat-msg-text">${escapeHTML(m.text)}</div>
        </div>
      `;
    }).join('');
  }

  // ---------------------------------------------------------
  // 13. GESTIONE PARTITA & RITORNO LOBBY
  // ---------------------------------------------------------
  function renderSavesMenu(viewport) {
    viewport.innerHTML = `
      <div class="glass-panel" style="padding:18px; display:flex; flex-direction:column; gap:12px;">
        <h2 style="font-size:1.1rem; color:var(--res-crystal);">💾 GESTIONE PARTITA & SISTEMA</h2>
        <p class="text-muted">Universo attivo: <strong style="color:#fff;">${escapeHTML(currentUniverse.name)}</strong> ${isMultiplayerMode ? '<span class="badge badge-red">ONLINE PvP</span>' : ''}</p>

        <button type="button" id="btn-save-now" class="btn btn-green">💾 ${isMultiplayerMode ? 'SINCRONIZZA SU CLOUD ORA' : 'SALVA UNIVERSO ORA'}</button>
        ${!isMultiplayerMode ? `
          <button type="button" id="btn-export-download" class="btn btn-blue">⬇ SCARICA BACKUP JSON</button>
          <button type="button" id="btn-export-copy" class="btn btn-ghost">📋 COPIA JSON NEGLI APPUNTI</button>
        ` : ''}
        <button type="button" id="btn-toggle-sound" class="btn btn-ghost">${soundMuted ? '🔇 SUONI: DISATTIVATI (ATTIVA)' : '🔊 SUONI: ATTIVI (DISATTIVA)'}</button>
        <button type="button" id="btn-return-lobby-view" class="btn btn-red">🏠 TORNA A "LE MIE PARTITE"</button>
      </div>
    `;

    document.getElementById('btn-save-now')?.addEventListener('click', async () => {
      await persistCurrentState();
      playSound('success');
      toast(isMultiplayerMode ? 'Stato sincronizzato su Firestore!' : 'Partita salvata su IndexedDB!', 'success');
    });

    document.getElementById('btn-export-download')?.addEventListener('click', async () => {
      const json = await window.UniversumDB.exportJSON(currentUniverse.id);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `UNIVERSUM_${currentUniverse.name.replace(/[^a-z0-9]/gi, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('File JSON scaricato.', 'success');
    });

    document.getElementById('btn-export-copy')?.addEventListener('click', async () => {
      const json = await window.UniversumDB.exportJSON(currentUniverse.id);
      await navigator.clipboard.writeText(json);
      toast('Salvataggio JSON copiato negli appunti!', 'success');
    });

    document.getElementById('btn-toggle-sound')?.addEventListener('click', () => {
      soundMuted = !soundMuted;
      localStorage.setItem('universum_muted', String(soundMuted));
      if (!soundMuted) playSound('click');
      renderCurrentView();
    });

    document.getElementById('btn-return-lobby-view')?.addEventListener('click', exitToLobby);
  }

  async function exitToLobby() {
    try {
      await persistCurrentState();
    } catch (e) {}

    stopGameLoop();
    if (isMultiplayerMode && window.UniversumMP) {
      window.UniversumMP.stopListeners();
    }
    if (uiState.mpMessagesUnsub) {
      uiState.mpMessagesUnsub();
      uiState.mpMessagesUnsub = null;
    }
    if (uiState.mpFleetsUnsub) {
      uiState.mpFleetsUnsub();
      uiState.mpFleetsUnsub = null;
    }

    isMultiplayerMode = false;
    currentUniverse = null;
    document.getElementById('screen-game')?.classList.add('hidden');
    document.getElementById('screen-lobby')?.classList.remove('hidden');
    await window.UniversumDB.renderLobbyList();
  }

  // =========================================================
  // SINCRONIZZAZIONE REAL-TIME MULTIPLAYER
  // =========================================================
  async function syncPlayerOnlinePlanets() {
    if (!isMultiplayerMode || !window.fbDB || !window.UniversumMP) return;
    const user = window.UniversumMP.getCurrentUser();
    if (!user) return;

    const snap = await window.fbDB.collection('online_universes').doc(currentUniverse.id)
      .collection('planets').where('ownerUid', '==', user.uid).get();

    const updated = snap.docs.map((d, idx) => {
      const raw = d.data();
      const live = window.UniversumMP.calculateLiveResources(raw, currentUniverse.speed, currentUniverse.researches);
      return {
        id: `mp_planet_${live.coords.g}_${live.coords.s}_${live.coords.p}`,
        name: live.planetName || (idx === 0 ? 'Pianeta Madre' : 'Colonia PvP'),
        coords: live.coords,
        minTemp: live.minTemp ?? live.temperature?.min ?? -10,
        maxTemp: live.maxTemp ?? live.temperature?.max ?? 30,
        fieldsMax: live.fieldsMax || 220,
        resources: live.resources,
        buildings: live.buildings || {},
        defenses: live.defenses || {},
        fleet: live.fleet || {},
        buildQueue: [],
        shipyardQueue: [],
        defenseQueue: [],
        moon: live.moon || null,
        debris: live.debris || { metal: 0, crystal: 0 },
        ownerUid: live.ownerUid,
        ownerName: live.ownerName,
        lastUpdated: live.lastUpdated || Date.now()
      };
    });

    if (updated.length > 0) {
      currentUniverse.planets = updated;
      refreshPlanetSelector();
    }
  }

  function attachMultiplayerRealtimeFeeds(uniId) {
    if (!window.UniversumMP || !window.fbDB) return;
    const user = window.UniversumMP.getCurrentUser();
    if (!user) return;

    uiState.chatMessages = [];
    uiState.unreadChatCount = 0;
    uiState.lastSeenChatTs = Date.now();
    updateChatUnreadBadges();

    // 1. Chat Galattica in tempo reale
    window.UniversumMP.listenChat(uniId, (msgs) => {
      uiState.chatMessages = msgs;
      if (currentView === 'chat') {
        uiState.unreadChatCount = 0;
        uiState.lastSeenChatTs = Date.now();
        const feedEl = document.getElementById('chat-messages-feed');
        if (feedEl) {
          feedEl.innerHTML = renderChatMessagesHTML(msgs, user.uid);
          feedEl.scrollTop = feedEl.scrollHeight;
        }
      } else {
        const unread = msgs.filter((m) => m.senderUid !== user.uid && (m.time || 0) > uiState.lastSeenChatTs).length;
        uiState.unreadChatCount = unread;
      }
      updateChatUnreadBadges();
    });

    // 2. Radar Attacchi in arrivo
    window.UniversumMP.listenIncomingRadar(uniId, (incomingList) => {
      uiState.mpIncomingAttacks = incomingList;
      if (currentView === 'overview') renderCurrentView();
    });

    // 3. Flotte proprie in transito
    if (uiState.mpFleetsUnsub) uiState.mpFleetsUnsub();
    uiState.mpFleetsUnsub = window.fbDB.collection('online_universes').doc(uniId).collection('fleets')
      .where('attackerUid', '==', user.uid)
      .onSnapshot((snap) => {
        uiState.mpMyFleets = snap.docs.map((d) => d.data());
        if (currentView === 'overview') renderCurrentView();
      });

    // 4. Messaggi / Rapporti Spia e Battaglie PvP
    if (uiState.mpMessagesUnsub) uiState.mpMessagesUnsub();
    uiState.mpMessagesUnsub = window.fbDB.collection('online_universes').doc(uniId).collection('messages')
      .where('recipientUid', '==', user.uid)
      .orderBy('time', 'desc')
      .limit(30)
      .onSnapshot((snap) => {
        const msgs = [];
        const spies = [];
        snap.forEach((doc) => {
          const m = Object.assign({ id: doc.id }, doc.data());
          msgs.push(m);
          if (m.type === 'spy' && m.reportData) {
            spies.push({
              id: doc.id,
              time: m.time,
              key: `${m.reportData.coords.g}:${m.reportData.coords.s}:${m.reportData.coords.p}`,
              coords: m.reportData.coords,
              targetName: m.reportData.ownerName || 'Pianeta PvP',
              emperor: m.reportData.ownerName || 'Comandante',
              scanCount: 1,
              resources: m.reportData.resources,
              fleet: m.reportData.fleet,
              defenses: m.reportData.defenses,
              buildings: m.reportData.buildings,
              moon: m.reportData.moon
            });
          }
        });
        currentUniverse.messages = msgs;
        currentUniverse.spyReports = spies;
        if (currentView === 'overview' || currentView === 'espionage') {
          renderCurrentView();
        }
      });
  }

  // =========================================================
  // LOOP DI AGGIORNAMENTO IN TEMPO REALE (1000ms)
  // =========================================================
  function stopGameLoop() {
    if (gameLoopTimer) {
      clearInterval(gameLoopTimer);
      gameLoopTimer = null;
    }
    if (uiState.planetAnimId) {
      cancelAnimationFrame(uiState.planetAnimId);
      uiState.planetAnimId = null;
    }
  }

  function startGameLoop() {
    stopGameLoop();
    let mpSyncCounter = 0;

    gameLoopTimer = setInterval(async () => {
      if (!currentUniverse) return;

      const prevQueueCount = getActivePlanet().buildQueue.length +
        getActivePlanet().shipyardQueue.length +
        getActivePlanet().defenseQueue.length +
        (currentUniverse.researchQueue ? 1 : 0);

      window.UniversumEngine.tick(currentUniverse, 1);

      if (isMultiplayerMode) {
        mpSyncCounter++;
        if (mpSyncCounter >= 12) {
          mpSyncCounter = 0;
          await window.UniversumMP.resolveArrivedOnlineFleets(currentUniverse.id).catch(() => {});
          await syncPlayerOnlinePlanets().catch(() => {});
        }
      } else {
        window.UniversumGalaxy.processFleetsAndBots(currentUniverse);
      }

      const newQueueCount = getActivePlanet().buildQueue.length +
        getActivePlanet().shipyardQueue.length +
        getActivePlanet().defenseQueue.length +
        (currentUniverse.researchQueue ? 1 : 0);

      if (newQueueCount < prevQueueCount) {
        playSound('complete');
        if (isMultiplayerMode) {
          persistCurrentState().catch(() => {});
        }
        if (currentView === 'overview' || currentView === 'buildings' || currentView === 'research' || currentView === 'shipyard') {
          renderCurrentView();
        }
      }

      if (!isMultiplayerMode) {
        const atkCount = (currentUniverse.incomingAttacks || []).length;
        if (atkCount > uiState.lastAlertCount) {
          playSound('alarm');
          toast('🚨 ATTENZIONE: Attacco BOT rilevato dai sensori!', 'error');
        }
        uiState.lastAlertCount = atkCount;
      }

      updateTopBarNumbers();
      document.querySelectorAll('.live-timer').forEach((el) => {
        const endTs = Number(el.dataset.end || 0);
        const remSec = Math.max(0, Math.ceil((endTs - Date.now()) / 1000));
        el.textContent = formatDuration(remSec);
      });
    }, 1000);
  }

  // =========================================================
  // AVVIO PARTITA (OFFLINE O MULTIPLAYER)
  // =========================================================
  function startGame(universe, multiplayerFlag = false) {
    currentUniverse = universe;
    isMultiplayerMode = Boolean(multiplayerFlag);

    let offlineReport = { offlineSeconds: 0 };
    if (!isMultiplayerMode) {
      offlineReport = window.UniversumEngine.processOfflineProgress(currentUniverse);
      window.UniversumGalaxy.processFleetsAndBots(currentUniverse);
    }

    const home = currentUniverse.planets[0];
    if (home) {
      uiState.galaxyG = home.coords.g;
      uiState.galaxyS = home.coords.s;
      uiState.fleetTarget = { g: home.coords.g, s: home.coords.s, p: home.coords.p };
    }
    uiState.lastAlertCount = (currentUniverse.incomingAttacks || []).length;

    document.getElementById('screen-lobby')?.classList.add('hidden');
    document.getElementById('screen-game')?.classList.remove('hidden');

    // Mostra/nascondi elementi specifici Multiplayer vs Creativa
    document.getElementById('mp-live-badge')?.classList.toggle('hidden', !isMultiplayerMode);
    document.querySelectorAll('.mp-only-nav').forEach((el) => {
      el.classList.toggle('hidden', !isMultiplayerMode);
    });

    const creativeBar = document.getElementById('creative-quick-bar');
    if (creativeBar) {
      creativeBar.classList.toggle('hidden', isMultiplayerMode || !currentUniverse.creativeMode);
    }

    if (isMultiplayerMode) {
      attachMultiplayerRealtimeFeeds(currentUniverse.id);
    }

    refreshPlanetSelector();
    updateTopBarNumbers();
    switchView('overview');
    startGameLoop();

    if (!isMultiplayerMode && !currentUniverse.creativeMode && offlineReport.offlineSeconds >= 30) {
      const unitNames = Object.entries(offlineReport.completedUnits)
        .map(([k, v]) => `${v}× ${k}`)
        .join(', ');

      openModal('RAPPORTO DI ASSENZA OFFLINE', `
        <p style="margin-bottom:10px;">Bentornato Imperatore! Tempo trascorso offline: <strong>${formatDuration(offlineReport.offlineSeconds)}</strong>.</p>
        <div style="background:rgba(0,0,0,0.4); padding:12px; border-radius:8px; margin-bottom:12px;">
          <div>Metallo estratto: <strong class="text-metal">+${formatNum(offlineReport.gained.metal)}</strong></div>
          <div>Cristallo estratto: <strong class="text-crystal">+${formatNum(offlineReport.gained.crystal)}</strong></div>
          <div>Deuterio estratto: <strong class="text-deuterium">+${formatNum(offlineReport.gained.deuterium)}</strong></div>
        </div>
        ${offlineReport.completedBuildings.length > 0 ? `<p style="font-size:0.9rem; margin-bottom:6px;">🏗️ Edifici completati: <strong>${escapeHTML(offlineReport.completedBuildings.join(', '))}</strong></p>` : ''}
        ${offlineReport.completedResearches.length > 0 ? `<p style="font-size:0.9rem; margin-bottom:6px;">🔬 Ricerche completate: <strong>${escapeHTML(offlineReport.completedResearches.join(', '))}</strong></p>` : ''}
        ${unitNames ? `<p style="font-size:0.9rem;">🚀 Unità costruite: <strong>${escapeHTML(unitNames)}</strong></p>` : ''}
      `);
    }
  }

  function bindGlobalUIEvents() {
    document.getElementById('active-planet-select')?.addEventListener('change', (e) => {
      if (!currentUniverse) return;
      currentUniverse.activePlanetId = e.target.value;
      updateTopBarNumbers();
      renderCurrentView();
      playSound('click');
    });

    document.getElementById('btn-turbo-toggle')?.addEventListener('click', async () => {
      if (!currentUniverse || isMultiplayerMode) return;
      const res = window.UniversumEngine.activateTurbo(currentUniverse);
      await persistCurrentState();
      updateTopBarNumbers();
      playSound('success');
      toast(`TURBO 2x attivo (${formatDuration(res.remainingSec)})!`, 'creative');
    });

    document.querySelectorAll('#creative-quick-bar [data-creative]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!currentUniverse || isMultiplayerMode) return;
        try {
          const msg = window.UniversumEngine.applyCreativeCheat(
            currentUniverse,
            getActivePlanetIndex(),
            btn.dataset.creative
          );
          await persistCurrentState();
          updateTopBarNumbers();
          renderCurrentView();
          playSound('complete');
          toast(msg, 'creative');
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    });

    document.querySelectorAll('.sidebar-btn[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    document.querySelectorAll('.nav-tab-btn[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    const drawer = document.getElementById('mobile-menu-drawer');
    document.getElementById('btn-mobile-menu')?.addEventListener('click', () => {
      playSound('click');
      drawer?.classList.remove('hidden');
    });
    document.getElementById('btn-close-drawer')?.addEventListener('click', () => {
      drawer?.classList.add('hidden');
    });
    drawer?.addEventListener('click', (e) => {
      if (e.target === drawer) drawer.classList.add('hidden');
    });

    document.querySelectorAll('.drawer-item[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    document.getElementById('drawer-btn-lobby')?.addEventListener('click', () => {
      drawer?.classList.add('hidden');
      switchView('saves');
    });

    document.getElementById('btn-back-lobby')?.addEventListener('click', exitToLobby);

    if (window.UniversumEngine && typeof window.UniversumEngine.bindAutoSave === 'function') {
      window.UniversumEngine.bindAutoSave(() => (!isMultiplayerMode ? currentUniverse : null));
    }
  }

  function init() {
    generateDynamicPWAIcon();
    setupLobbyTabsAndMultiplayer();
    bindGlobalUIEvents();
  }

  window.UniversumUI = {
    init,
    startGame,
    switchView,
    toast,
    playSound
  };

  document.addEventListener('DOMContentLoaded', init);
})();
