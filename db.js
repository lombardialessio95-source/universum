(function () {
  'use strict';

  const DB_NAME = 'UniversumDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'universes';
  const MAX_UNIVERSES = 10;

  let dbInstance = null;
  let deferredInstallPrompt = null;

  // =========================================================
  // MOTORE GRAFICO STARFIELD (SFONDO SPAZIALE NOTTURNO)
  // =========================================================
  function initStarfield() {
    const canvas = document.getElementById('starfield');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let lastFrame = 0;
    const frameInterval = 1000 / 24;
    let nebulaLayer = document.createElement('canvas');
    let nebulaCtx = nebulaLayer.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const starColors = ['#ffffff', '#cce8ff', '#70c4ff', '#b388ff', '#e1f5fe'];
    const numStars = Math.min(220, Math.floor((width * height) / 6500));
    const stars = [];

    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.5 + 0.3,
        color: starColors[Math.floor(Math.random() * starColors.length)],
        alpha: Math.random() * 0.8 + 0.2,
        speed: (Math.random() * 0.015 + 0.004) * (Math.random() < 0.5 ? 1 : -1)
      });
    }

    // Le nebulose sono statiche: disegnate solo all'avvio e dopo resize.
    function rebuildNebulaLayer() {
      nebulaLayer.width = width;
      nebulaLayer.height = height;
      nebulaCtx.fillStyle = '#02020a';
      nebulaCtx.fillRect(0, 0, width, height);
      const neb1 = nebulaCtx.createRadialGradient(width * 0.2, height * 0.3, 10, width * 0.2, height * 0.3, width * 0.55);
      neb1.addColorStop(0, 'rgba(14, 28, 72, 0.28)');
      neb1.addColorStop(1, 'rgba(2, 2, 10, 0)');
      nebulaCtx.fillStyle = neb1;
      nebulaCtx.fillRect(0, 0, width, height);
      const neb2 = nebulaCtx.createRadialGradient(width * 0.8, height * 0.75, 10, width * 0.8, height * 0.75, width * 0.5);
      neb2.addColorStop(0, 'rgba(42, 12, 68, 0.22)');
      neb2.addColorStop(1, 'rgba(2, 2, 10, 0)');
      nebulaCtx.fillStyle = neb2;
      nebulaCtx.fillRect(0, 0, width, height);
    }
    rebuildNebulaLayer();
    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      rebuildNebulaLayer();
    });

    function render(timestamp = 0) {
      requestAnimationFrame(render);
      if (document.hidden || timestamp - lastFrame < frameInterval) return;
      lastFrame = timestamp;
      ctx.drawImage(nebulaLayer, 0, 0);
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.alpha += s.speed;
        if (s.alpha >= 1) {
          s.alpha = 1;
          s.speed = -Math.abs(s.speed);
        } else if (s.alpha <= 0.18) {
          s.alpha = 0.18;
          s.speed = Math.abs(s.speed);
        }

        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    requestAnimationFrame(render);
  }

  // =========================================================
  // DATABASE INDEXEDDB
  // =========================================================
  function init() {
    return new Promise((resolve, reject) => {
      if (dbInstance) {
        resolve(dbInstance);
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('lastSeen', 'lastSeen', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = (event) => {
        reject(event.target.error || new Error('Errore apertura IndexedDB'));
      };
    });
  }

  async function getAll() {
    const db = await init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  function resolveStartingResources(config) {
    if (config.creativeMode) {
      return { metal: 999999999, crystal: 999999999, deuterium: 999999999 };
    }
    switch (config.startTier) {
      case 'poor':
        return { metal: 500, crystal: 500, deuterium: 0 };
      case 'rich':
        return { metal: 50000, crystal: 50000, deuterium: 20000 };
      case 'millionaire':
        return { metal: 500000, crystal: 500000, deuterium: 200000 };
      case 'custom':
        return {
          metal: Math.max(0, Number(config.customMetal) || 5000),
          crystal: Math.max(0, Number(config.customCrystal) || 5000),
          deuterium: Math.max(0, Number(config.customDeuterium) || 1000)
        };
      case 'normal':
      default:
        return { metal: 5000, crystal: 5000, deuterium: 1000 };
    }
  }

  async function create(config) {
    const existing = await getAll();
    if (existing.length >= MAX_UNIVERSES) {
      throw new Error(`Limite massimo raggiunto (${MAX_UNIVERSES} universi). Elimina una partita prima di crearne una nuova.`);
    }

    const now = Date.now();
    const id = 'uni_' + now + '_' + Math.random().toString(36).substring(2, 7);
    const seed = Math.floor(Math.random() * 2147483647) + 1;
    const galaxies = Math.min(9, Math.max(1, Number(config.galaxies) || 3));
    const systemsPerGalaxy = Math.min(499, Math.max(100, Number(config.systemsPerGalaxy) || 250));
    const homeFields = Math.max(120, Number(config.homeFields) || 220);

    // Coordinate casuali per il Pianeta Madre (slot 4-12 temperati)
    const homeG = Math.floor(Math.random() * galaxies) + 1;
    const homeS = Math.floor(Math.random() * systemsPerGalaxy) + 1;
    const homeP = Math.floor(Math.random() * 9) + 4;
    const maxTemp = Math.floor(Math.random() * 45) + 25;
    const minTemp = maxTemp - 40;

    const startRes = resolveStartingResources(config);

    const universe = {
      id,
      seed,
      name: (config.name || 'Nuovo Universo').trim().substring(0, 32),
      emperor: (config.emperor || 'Comandante').trim().substring(0, 24),
      creativeMode: Boolean(config.creativeMode),
      tutorial: config.tutorialEnabled ? { enabled: true, step: 0, done: false, hidden: false, visited: {}, baseline: {} } : null,
      speed: Math.max(1, Number(config.speed) || 10),
      galaxies,
      systemsPerGalaxy,
      botMode: config.botMode === 'peaceful' ? 'peaceful' : 'hostile',
      botLevel: Math.min(4, Math.max(1, Number(config.botLevel) || 2)),
      startTier: config.startTier || 'normal',
      createdAt: now,
      lastSeen: now,
      turboUntil: 0,
      activePlanetId: 'planet_home',
      planets: [
        {
          id: 'planet_home',
          name: 'Pianeta Madre',
          coords: { g: homeG, s: homeS, p: homeP },
          minTemp,
          maxTemp,
          fieldsMax: homeFields,
          resources: {
            metal: startRes.metal,
            crystal: startRes.crystal,
            deuterium: startRes.deuterium
          },
          buildings: {
            metalMine: 0,
            crystalMine: 0,
            deuteriumSynth: 0,
            solarPlant: 0,
            fusionReactor: 0,
            roboticsFactory: 0,
            naniteFactory: 0,
            shipyard: 0,
            metalStorage: 0,
            crystalStorage: 0,
            deuteriumTank: 0,
            researchLab: 0,
            terraformer: 0,
            hiddenBunker: 0
          },
          defenses: {},
          fleet: {},
          buildQueue: [],
          shipyardQueue: [],
          defenseQueue: [],
          moon: null,
          bacinoSpaziale: null
        }
      ],
      researches: {
        energyTech: 0,
        laserTech: 0,
        ionTech: 0,
        hyperspaceTech: 0,
        plasmaTech: 0,
        combustionDrive: 0,
        impulseDrive: 0,
        hyperspaceDrive: 0,
        espionageTech: 0,
        computerTech: 0,
        astrophysics: 0,
        intergalacticNetwork: 0,
        weaponsTech: 0,
        shieldingTech: 0,
        armourTech: 0,
        lunarTech: 0,
        jumpGateTech: 0,
        deathStarTech: 0
      },
      researchQueue: null,
      fleetsInFlight: [],
      incomingAttacks: [],
      spyReports: [],
      messages: [
        {
          id: 'msg_welcome_' + now,
          time: now,
          type: 'system',
          title: 'Benvenuto su UNIVERSUM',
          body: `Imperatore ${config.emperor || 'Comandante'}, la plancia di comando su [${homeG}:${homeS}:${homeP}] è operativa.`
        }
      ],
      contracts: [],
      dailyQuests: [],
      achievements: [],
      galaxyDeltas: {},
      crepuscoloLimbo: null,
      galattiche: []
    };

    await save(universe);
    return universe;
  }

  async function save(universe) {
    if (!universe || !universe.id) {
      throw new Error('Oggetto universo non valido per il salvataggio.');
    }
    const db = await init();
    universe.lastSeen = Date.now();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(universe);
      req.onsuccess = () => resolve(universe);
      req.onerror = () => reject(req.error);
    });
  }

  async function load(id) {
    const db = await init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function remove(id) {
    const db = await init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async function rename(id, newName) {
    const uni = await load(id);
    if (!uni) throw new Error('Universo non trovato.');
    const cleaned = (newName || '').trim().substring(0, 32);
    if (!cleaned) throw new Error('Il nome non può essere vuoto.');
    uni.name = cleaned;
    return save(uni);
  }

  async function exportJSON(id) {
    const uni = await load(id);
    if (!uni) throw new Error('Universo non trovato.');
    return JSON.stringify(uni, null, 2);
  }

  async function importJSON(jsonStr) {
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error('File JSON corrotto o non valido.');
    }

    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.planets) || !parsed.name) {
      throw new Error('Struttura salvataggio UNIVERSUM non riconosciuta.');
    }

    const existing = await getAll();
    if (existing.length >= MAX_UNIVERSES) {
      throw new Error(`Limite massimo raggiunto (${MAX_UNIVERSES} universi). Elimina una partita prima di importare.`);
    }

    // Genera un nuovo ID univoco per evitare sovrascritture accidentali
    parsed.id = 'uni_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    parsed.lastSeen = Date.now();
    await save(parsed);
    return parsed;
  }

  // =========================================================
  // HELPER UI LOBBY IMMEDIATA (FUNZIONA ANCHE PRIMA DI ui.js)
  // =========================================================
  function showToastFallback(msg, type = 'info') {
    if (window.UniversumUI && typeof window.UniversumUI.toast === 'function') {
      window.UniversumUI.toast(msg, type);
      return;
    }
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function formatBotLabel(uni) {
    if (uni.botMode === 'peaceful') return 'BOT: Pacifici';
    const levels = { 1: 'Lv.1 Fastidiosi', 2: 'Lv.2 Aggressivi', 3: 'Lv.3 Guerrafondai', 4: 'Lv.4 INFERNO' };
    return `BOT: Ostili (${levels[uni.botLevel] || 'Lv.2'})`;
  }

  function formatDate(ts) {
    if (!ts) return 'Mai';
    const d = new Date(ts);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
      ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }

  async function renderLobbyList() {
    const listEl = document.getElementById('universe-list');
    const countBadge = document.getElementById('universe-count-badge');
    if (!listEl) return;

    const universes = await getAll();
    if (countBadge) countBadge.textContent = `${universes.length} / ${MAX_UNIVERSES}`;

    if (universes.length === 0) {
      listEl.innerHTML = `
        <div class="glass-panel" style="padding:28px 16px; text-align:center;">
          <p style="font-size:1.1rem; font-weight:700; color:var(--res-crystal); margin-bottom:8px;">NESSUN UNIVERSO ATTIVO</p>
          <p class="text-muted">Crea il tuo primo impero galattico oppure importa un file di salvataggio JSON.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = universes.map((u) => `
      <article class="universe-card glass-panel" data-id="${u.id}">
        <div class="universe-card-header">
          <div>
            <div class="universe-name">${escapeHTML(u.name)}</div>
            <div class="text-muted" style="font-size:0.9rem;">Imperatore: <strong style="color:#fff;">${escapeHTML(u.emperor)}</strong></div>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${u.creativeMode ? '<span class="badge badge-creative">CREATIVA</span>' : '<span class="badge badge-blue">NORMALE</span>'}
            <span class="badge badge-green">${u.speed}x</span>
            <span class="badge ${u.botMode === 'hostile' ? 'badge-red' : 'badge-blue'}">${formatBotLabel(u)}</span>
          </div>
        </div>
        <div class="universe-meta">
          <span>Pianeti: <strong>${(u.planets || []).length}</strong></span>
          <span>Mappa: <strong>${u.galaxies}G × ${u.systemsPerGalaxy}S</strong></span>
          <span>Ultimo accesso: <strong>${formatDate(u.lastSeen)}</strong></span>
        </div>
        <div class="universe-card-actions">
          <button type="button" class="btn btn-green btn-sm" data-action="play" data-id="${u.id}">▶ GIOCA</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="tutorial" data-id="${u.id}">🎓 ${u.tutorial?.enabled && !u.tutorial?.done ? "TUTORIAL" : "ACCADEMIA"}</button>
          <button type="button" class="btn btn-blue btn-sm" data-action="rename" data-id="${u.id}">✎ RINOMINA</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="export" data-id="${u.id}">⬇ JSON</button>
          <button type="button" class="btn btn-red btn-sm" data-action="delete" data-id="${u.id}">🗑 ELIMINA</button>
        </div>
      </article>
    `).join('');
  }

  function escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

  function openCreateUniverseModal() {
    const html = `
      <form id="form-create-universe">
        <div class="form-grid-2">
          <div class="form-group">
            <label for="cfg-name">Nome Universo</label>
            <input type="text" id="cfg-name" class="form-control" value="Andromeda Prime" maxlength="32" required>
          </div>
          <div class="form-group">
            <label for="cfg-emperor">Nome Imperatore</label>
            <input type="text" id="cfg-emperor" class="form-control" value="Comandante" maxlength="24" required>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label for="cfg-mode">Modalità di Gioco</label>
            <select id="cfg-mode" class="form-control">
              <option value="normal" selected>Normale (Strategia Classica)</option>
              <option value="creative">Creativa (Risorse & Energia Infinite)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="cfg-speed">Velocità Universo</label>
            <select id="cfg-speed" class="form-control">
              <option value="1">1x (Reale)</option>
              <option value="2">2x</option>
              <option value="5">5x</option>
              <option value="10" selected>10x (Consigliata)</option>
              <option value="50">50x</option>
              <option value="100">100x</option>
              <option value="500">500x</option>
              <option value="1000">1000x</option>
              <option value="5000">5000x</option>
              <option value="10000">10000x (Caos)</option>
            </select>
          </div>
        </div>

        <div class="form-group" id="group-start-tier">
          <label for="cfg-start-tier">Risorse Iniziali</label>
          <select id="cfg-start-tier" class="form-control">
            <option value="poor">Povero (500 M / 500 C / 0 D)</option>
            <option value="normal" selected>Normale (5.000 M / 5.000 C / 1.000 D)</option>
            <option value="rich">Ricco (50.000 M / 50.000 C / 20.000 D)</option>
            <option value="millionaire">Milionario (500.000 M / 500.000 C / 200.000 D)</option>
            <option value="custom">Personalizzato...</option>
          </select>
        </div>

        <div id="group-custom-res" class="form-grid-3 hidden" style="margin-bottom:14px;">
          <div class="form-group" style="margin:0;">
            <label for="cfg-res-m">Metallo</label>
            <input type="number" id="cfg-res-m" class="form-control" value="10000" min="0">
          </div>
          <div class="form-group" style="margin:0;">
            <label for="cfg-res-c">Cristallo</label>
            <input type="number" id="cfg-res-c" class="form-control" value="10000" min="0">
          </div>
          <div class="form-group" style="margin:0;">
            <label for="cfg-res-d">Deuterio</label>
            <input type="number" id="cfg-res-d" class="form-control" value="5000" min="0">
          </div>
        </div>

        <div class="form-grid-3">
          <div class="form-group">
            <label for="cfg-galaxies">Galassie</label>
            <select id="cfg-galaxies" class="form-control">
              <option value="1">1</option>
              <option value="3" selected>3</option>
              <option value="5">5</option>
              <option value="9">9</option>
            </select>
          </div>
          <div class="form-group">
            <label for="cfg-systems">Sistemi/Gal.</label>
            <select id="cfg-systems" class="form-control">
              <option value="100">100</option>
              <option value="250" selected>250</option>
              <option value="499">499</option>
            </select>
          </div>
          <div class="form-group">
            <label for="cfg-fields">Pianeta Madre</label>
            <select id="cfg-fields" class="form-control">
              <option value="160">Piccolo (160)</option>
              <option value="220" selected>Medio (220)</option>
              <option value="300">Grande (300)</option>
            </select>
          </div>
        </div>

        <div class="form-group" style="padding:12px;border:1px solid rgba(0,210,255,.32);border-radius:10px;background:rgba(0,120,200,.08)">
          <label style="display:flex;gap:10px;align-items:center;cursor:pointer;">
            <input id="cfg-tutorial" type="checkbox" checked style="width:18px;height:18px;accent-color:#00d2ff;">
            <span><strong>🎓 Accademia Imperiale — Tutorial offline</strong><br><small>12 missioni guidate, progressi salvati. Puoi disattivarlo o riprenderlo quando vuoi.</small></span>
          </label>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label for="cfg-bot-mode">Comportamento BOT</label>
            <select id="cfg-bot-mode" class="form-control">
              <option value="peaceful">Pacifici (Solo Difesa/Commercio)</option>
              <option value="hostile" selected>Ostili (Attaccano & Spiano)</option>
            </select>
          </div>
          <div class="form-group" id="group-bot-level">
            <label for="cfg-bot-level">Aggressività BOT</label>
            <select id="cfg-bot-level" class="form-control">
              <option value="1">Livello 1 — Fastidiosi</option>
              <option value="2" selected>Livello 2 — Aggressivi</option>
              <option value="3">Livello 3 — Guerrafondai</option>
              <option value="4">Livello 4 — INFERNO</option>
            </select>
          </div>
        </div>

        <div style="display:flex; gap:10px; margin-top:16px;">
          <button type="submit" class="btn btn-green" style="flex:1;">🚀 AVVIA UNIVERSO</button>
          <button type="button" id="btn-cancel-create" class="btn btn-ghost">ANNULLA</button>
        </div>
      </form>
    `;

    openModal('CREA NUOVO UNIVERSO', html);

    const modeSelect = document.getElementById('cfg-mode');
    const tierSelect = document.getElementById('cfg-start-tier');
    const customBox = document.getElementById('group-custom-res');
    const tierGroup = document.getElementById('group-start-tier');
    const botModeSelect = document.getElementById('cfg-bot-mode');
    const botLevelGroup = document.getElementById('group-bot-level');

    modeSelect.addEventListener('change', () => {
      const isCreative = modeSelect.value === 'creative';
      tierGroup.classList.toggle('hidden', isCreative);
      if (isCreative) customBox.classList.add('hidden');
    });

    tierSelect.addEventListener('change', () => {
      customBox.classList.toggle('hidden', tierSelect.value !== 'custom');
    });

    botModeSelect.addEventListener('change', () => {
      botLevelGroup.classList.toggle('hidden', botModeSelect.value === 'peaceful');
    });

    document.getElementById('btn-cancel-create').addEventListener('click', closeModal);

    document.getElementById('form-create-universe').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const uni = await create({
          name: document.getElementById('cfg-name').value,
          emperor: document.getElementById('cfg-emperor').value,
          creativeMode: modeSelect.value === 'creative',
          tutorialEnabled: document.getElementById('cfg-tutorial').checked,
          speed: Number(document.getElementById('cfg-speed').value),
          startTier: tierSelect.value,
          customMetal: Number(document.getElementById('cfg-res-m').value),
          customCrystal: Number(document.getElementById('cfg-res-c').value),
          customDeuterium: Number(document.getElementById('cfg-res-d').value),
          galaxies: Number(document.getElementById('cfg-galaxies').value),
          systemsPerGalaxy: Number(document.getElementById('cfg-systems').value),
          homeFields: Number(document.getElementById('cfg-fields').value),
          botMode: botModeSelect.value,
          botLevel: Number(document.getElementById('cfg-bot-level').value)
        });
        closeModal();
        await renderLobbyList();
        showToastFallback(`Universo "${uni.name}" creato!`, 'success');
        launchUniverse(uni.id);
      } catch (err) {
        showToastFallback(err.message, 'error');
      }
    });
  }

  async function launchUniverse(id) {
    const uni = await load(id);
    if (!uni) {
      showToastFallback('Impossibile caricare l\'universo selezionato.', 'error');
      return;
    }
    await save(uni);

    if (window.UniversumUI && typeof window.UniversumUI.startGame === 'function') {
      window.UniversumUI.startGame(uni);
      return;
    }

    // Fallback operativo per Step 1 se ui.js non è ancora caricato
    document.getElementById('screen-lobby').classList.add('hidden');
    document.getElementById('screen-game').classList.remove('hidden');
    const creativeBar = document.getElementById('creative-quick-bar');
    if (creativeBar) creativeBar.classList.toggle('hidden', !uni.creativeMode);

    const p = uni.planets[0];
    const select = document.getElementById('active-planet-select');
    if (select && p) {
      select.innerHTML = uni.planets.map((pl) =>
        `<option value="${pl.id}">${escapeHTML(pl.name)} [${pl.coords.g}:${pl.coords.s}:${pl.coords.p}]</option>`
      ).join('');
    }
    if (p) {
      document.getElementById('res-metal-val').textContent = uni.creativeMode ? '∞' : Math.floor(p.resources.metal).toLocaleString('it-IT');
      document.getElementById('res-crystal-val').textContent = uni.creativeMode ? '∞' : Math.floor(p.resources.crystal).toLocaleString('it-IT');
      document.getElementById('res-deuterium-val').textContent = uni.creativeMode ? '∞' : Math.floor(p.resources.deuterium).toLocaleString('it-IT');
      document.getElementById('res-energy-val').textContent = uni.creativeMode ? '∞' : '0 / 0';
    }
    const viewport = document.getElementById('game-viewport');
    if (viewport) {
      viewport.innerHTML = `
        <div class="glass-panel" style="padding:20px;">
          <h2 style="font-size:1.15rem; color:var(--res-crystal); margin-bottom:10px;">PLANCIA DI COMANDO: ${escapeHTML(uni.name)}</h2>
          <p style="margin-bottom:8px;">Imperatore: <strong>${escapeHTML(uni.emperor)}</strong> | Velocità: <strong>${uni.speed}x</strong></p>
          <p class="text-muted">Architettura DB e PWA inizializzata con successo. Pronto per collegare data.js, engine-core.js, engine-actions.js, galaxy.js e ui-core.js.</p>
        </div>
      `;
    }
  }

  function setupPWAInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
    });

    const installBtn = document.getElementById('btn-install-pwa');
    if (!installBtn) return;

    installBtn.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          showToastFallback('Installazione avviata!', 'success');
        }
        deferredInstallPrompt = null;
        return;
      }

      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      if (isIOS) {
        openModal('INSTALLA SU iOS / iPAD', `
          <p style="margin-bottom:12px;">Per installare <strong>UNIVERSUM</strong> come app a schermo intero sul tuo dispositivo Apple:</p>
          <ol style="padding-left:20px; display:flex; flex-direction:column; gap:8px;">
            <li>Tocca l'icona <strong>Condividi</strong> (quadrato con freccia verso l'alto) nella barra di Safari.</li>
            <li>Scorri verso il basso e seleziona <strong>"Aggiungi a schermata Home"</strong>.</li>
            <li>Conferma toccando <strong>Aggiungi</strong> in alto a destra.</li>
          </ol>
        `);
      } else {
        openModal('INSTALLA APP', `
          <p>Apri il menu del browser (⋮) e seleziona <strong>"Installa app"</strong> oppure <strong>"Aggiungi a schermata Home"</strong>.</p>
        `);
      }
    });
  }

  function bindLobbyEvents() {
    document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
    document.getElementById('universal-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'universal-modal') closeModal();
    });

    document.getElementById('btn-open-create')?.addEventListener('click', openCreateUniverseModal);

    const fileInput = document.getElementById('input-import-file');
    document.getElementById('btn-import-json')?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = await importJSON(text);
        await renderLobbyList();
        showToastFallback(`Universo "${imported.name}" importato!`, 'success');
      } catch (err) {
        showToastFallback(err.message, 'error');
      } finally {
        fileInput.value = '';
      }
    });

    document.getElementById('universe-list')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      try {
        if (action === 'play') {
          await launchUniverse(id);
        } else if (action === 'tutorial') {
          const uni = await load(id);
          if (!uni) return;
          uni.tutorial = { enabled: true, step: 0, done: false, hidden: false, visited: {}, baseline: {} };
          await save(uni);
          showToastFallback('Accademia Imperiale attivata: progressi inizializzati.', 'success');
          await launchUniverse(id);
        } else if (action === 'rename') {
          const uni = await load(id);
          if (!uni) return;
          openModal('RINOMINA UNIVERSO', `
            <form id="form-rename-uni">
              <div class="form-group">
                <label for="input-new-uni-name">Nuovo Nome</label>
                <input type="text" id="input-new-uni-name" class="form-control" value="${escapeHTML(uni.name)}" maxlength="32" required>
              </div>
              <button type="submit" class="btn btn-blue" style="width:100%;">SALVA NOME</button>
            </form>
          `);
          document.getElementById('form-rename-uni').addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const val = document.getElementById('input-new-uni-name').value;
            await rename(id, val);
            closeModal();
            await renderLobbyList();
            showToastFallback('Universo rinominato.', 'success');
          });
        } else if (action === 'export') {
          const json = await exportJSON(id);
          const uni = await load(id);
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `UNIVERSUM_${(uni?.name || 'save').replace(/[^a-z0-9]/gi, '_')}.json`;
          a.click();
          URL.revokeObjectURL(url);
          showToastFallback('Esportazione JSON completata.', 'success');
        } else if (action === 'delete') {
          const uni = await load(id);
          if (!uni) return;
          openModal('ELIMINA UNIVERSO', `
            <p style="margin-bottom:16px;">Sei sicuro di voler eliminare definitivamente <strong>${escapeHTML(uni.name)}</strong>? L'azione è irreversibile.</p>
            <div style="display:flex; gap:10px;">
              <button type="button" id="confirm-del-uni" class="btn btn-red" style="flex:1;">ELIMINA DEFINITIVAMENTE</button>
              <button type="button" id="cancel-del-uni" class="btn btn-ghost">ANNULLA</button>
            </div>
          `);
          document.getElementById('cancel-del-uni').addEventListener('click', closeModal);
          document.getElementById('confirm-del-uni').addEventListener('click', async () => {
            await remove(id);
            closeModal();
            await renderLobbyList();
            showToastFallback('Universo eliminato.', 'info');
          });
        }
      } catch (err) {
        showToastFallback(err.message, 'error');
      }
    });

    document.getElementById('btn-back-lobby')?.addEventListener('click', async () => {
      document.getElementById('screen-game').classList.add('hidden');
      document.getElementById('screen-lobby').classList.remove('hidden');
      await renderLobbyList();
    });
  }

  // Esposizione API pubblica globale
  window.UniversumDB = {
    init,
    getAll,
    create,
    save,
    load,
    delete: remove,
    rename,
    exportJSON,
    importJSON,
    renderLobbyList
  };

  // Avvio automatico al caricamento DOM
  document.addEventListener('DOMContentLoaded', async () => {
    initStarfield();
    setupPWAInstall();
    bindLobbyEvents();
    try {
      await init();
      await renderLobbyList();
    } catch (err) {
      console.error('[UniversumDB] Errore inizializzazione:', err);
      showToastFallback('Errore accesso memoria locale IndexedDB.', 'error');
    }
  });
})();
