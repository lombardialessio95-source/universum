/** UNIVERSUM / offline/storage.js / IndexedDB — modulo estratto conservando la logica originale. */
(function () {
  'use strict';


  const DB_NAME = 'UniversumDB';

  const DB_VERSION = 1;

  const STORE_NAME = 'universes';

  const MAX_UNIVERSES = 10;


  let dbInstance = null;


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
  window.__UniversumDBStore = { MAX_UNIVERSES, init, getAll, resolveStartingResources, create, save, load, remove, rename, exportJSON, importJSON };

})();
