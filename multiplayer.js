/**
 * UNIVERSUM — Modulo Multiplayer PvP (Firebase Auth + Firestore)
 * Supporta: Spinta Motori 10-100%, Colonizzazione Online Live, Esplorazioni Profonde, Embargo & Occupazione PvP
 */
(function () {
  'use strict';

  function getAuth() {
    if (!window.fbAuth) throw new Error('Firebase Auth non inizializzato.');
    return window.fbAuth;
  }

  function getDB() {
    if (!window.fbDB) throw new Error('Firebase Firestore non inizializzato.');
    return window.fbDB;
  }

  function coordsToKey(coords) {
    return `${coords.g}_${coords.s}_${coords.p}`;
  }

  // =========================================================
  // FIX 0 / 0-B: CICLO DI VITA FLOTTE ONLINE, SCHEMA E ORFANE
  // =========================================================
  const FLEET_SCHEMA_VERSION = 2;
  const _migratedFleetUnis = new Set();

  function _tsToMs(v) {
    if (!v) return 0;
    if (typeof v === 'number') return v;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.toDate === 'function') return v.toDate().getTime();
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    return Number(v) || 0;
  }

  function _parseKeyCoords(key) {
    const parts = String(key || '').split('_').map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
    return { g: parts[0], s: parts[1], p: parts[2] };
  }

  function _cleanShips(raw) {
    const out = {};
    for (const [id, qty] of Object.entries(raw || {})) {
      const n = Math.max(0, Math.floor(Number(qty) || 0));
      if (n > 0) out[id] = n;
    }
    return out;
  }

  // Normalizza qualsiasi missione (anche vecchia/pre-deploy) senza perdere flotta/risorse
  function normalizeOnlineFleet(raw, id) {
    const f = raw || {};
    const missionAlias = { blockade: 'embargo', explore: 'expedition' };
    const mission = missionAlias[f.mission] || f.mission || 'attack';
    const targetCoords = f.targetCoords || f.target || _parseKeyCoords(f.targetKey) || null;
    const originCoords = f.originCoords || f.origin || _parseKeyCoords(f.originKey) || null;
    const targetKey = f.targetKey || (targetCoords ? coordsToKey(targetCoords) : null);
    const now = Date.now();
    const departureTime = Number(f.departureTime || _tsToMs(f.departureAt) || now);
    let status = f.status || 'outbound';
    if (!['outbound', 'returning', 'embargo', 'occupy', 'completed'].includes(status)) status = 'outbound';
    const resolved = f.resolved === true || status === 'completed';
    return {
      ...f,
      id: id || f.id,
      schemaVersion: FLEET_SCHEMA_VERSION,
      mission,
      status: resolved ? 'completed' : status,
      phase: resolved ? 'COMPLETATA' : (status === 'outbound' ? 'IN VIAGGIO' : status === 'returning' ? 'IN RITORNO' : status === 'embargo' ? 'IN EMBARGO' : status === 'occupy' ? 'IN OCCUPAZIONE' : status.toUpperCase()),
      ships: _cleanShips(f.ships || f.fleet),
      fleet: _cleanShips(f.ships || f.fleet),
      cargo: {
        metal: Math.max(0, Math.floor(Number(f.cargo?.metal) || 0)),
        crystal: Math.max(0, Math.floor(Number(f.cargo?.crystal) || 0)),
        deuterium: Math.max(0, Math.floor(Number(f.cargo?.deuterium) || 0))
      },
      attackerUid: f.attackerUid || null,
      attackerName: f.attackerName || 'Comandante',
      attackerTech: {
        weaponsTech: Number(f.attackerTech?.weaponsTech || 0),
        shieldingTech: Number(f.attackerTech?.shieldingTech || 0),
        armourTech: Number(f.attackerTech?.armourTech || 0),
        expeditionTech: Number(f.attackerTech?.expeditionTech || 0)
      },
      defenderUid: f.defenderUid || null,
      originCoords,
      targetCoords,
      targetKey,
      departureTime,
      arrivalTime: Number(f.arrivalTime || _tsToMs(f.arrivalAt) || f.returnTime || now),
      returnTime: Number(f.returnTime || f.arrivalTime || _tsToMs(f.arrivalAt) || now),
      resolved,
      ransom: f.ransom || f.ransomDemand || { metal: 50000, crystal: 25000, deuterium: 10000 },
      siegeDeuterium: Math.max(0, Number(f.siegeDeuterium ?? f.cargo?.deuterium ?? 0)),
      lastSiegeTickAt: Number(f.lastSiegeTickAt || f.siegeStartedAt || now)
    };
  }

  function _fleetDueTime(f) {
    return f.status === 'returning' ? Number(f.returnTime || f.arrivalTime || 0) : Number(f.arrivalTime || 0);
  }

  async function migrateOnlineFleets(uniId, { force = false } = {}) {
    if (!force && _migratedFleetUnis.has(uniId)) return 0;
    _migratedFleetUnis.add(uniId);
    const db = getDB();
    const snap = await db.collection('online_universes').doc(uniId).collection('fleets').limit(100).get().catch(() => ({ docs: [] }));
    let migrated = 0;
    for (const d of snap.docs) {
      const raw = d.data() || {};
      const norm = normalizeOnlineFleet(raw, d.id);
      const needs = raw.schemaVersion !== FLEET_SCHEMA_VERSION || raw.resolved === undefined || !raw.targetKey || !raw.ships;
      if (needs) {
        const { id: _omit, ...toWrite } = norm;
        await d.ref.set(toWrite, { merge: true }).catch(() => {});
        migrated++;
      }
    }
    return migrated;
  }

  // =========================================================
  // OTTIMIZZAZIONE SPARK + LIMITE SERVER (max 3 per account)
  // =========================================================
  const SERVER_LIMIT = 3;
  const SERVER_LIMIT_MESSAGE = 'Hai già raggiunto il limite di 3 server. Abbandona un server per entrarne in un altro.';
  const SYNC_MIN_INTERVAL_MS = 60 * 1000;
  const SYSTEM_CACHE_TTL_MS = 30 * 1000;
  const LEADERBOARD_CACHE_TTL_MS = 5 * 60 * 1000;

  const _syncLastByUni = new Map();
  const _systemCache = new Map();
  const _systemPending = new Set();
  const _leaderboardCache = new Map();
  const _playersCache = new Map();
  const _privateCleanupDone = new Set();

  function _cacheGet(map, key, ttlMs) {
    const entry = map.get(key);
    if (!entry) return null;
    return (Date.now() - entry.at) < ttlMs ? entry.data : null;
  }

  function _invalidateUniCaches(uniId) {
    _leaderboardCache.delete(uniId);
    _playersCache.delete(uniId);
    for (const key of [..._systemCache.keys()]) {
      if (key.startsWith(`${uniId}:`)) _systemCache.delete(key);
    }
  }

  async function getMembership(db, uid) {
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) return { serverIds: [], serverCount: 0 };
    const data = snap.data() || {};
    if (Array.isArray(data.serverIds)) {
      return { serverIds: [...data.serverIds], serverCount: data.serverIds.length };
    }
    // Backfill account legacy: ricava le membership dalle schede giocatore esistenti
    const serverIds = [];
    try {
      const unis = await db.collection('online_universes').limit(30).get();
      for (const uniDoc of unis.docs) {
        const pSnap = await uniDoc.ref.collection('players').doc(uid).get();
        if (pSnap.exists) serverIds.push(uniDoc.id);
      }
      await db.collection('users').doc(uid).set({ serverIds, serverCount: serverIds.length }, { merge: true });
    } catch (e) { /* backfill best-effort */ }
    return { serverIds, serverCount: serverIds.length };
  }

  // Registra lo slot server su Firestore in transazione: non bypassabile da reload/browser
  async function claimServerSlot(db, uid, uniId, { alreadyMember = false } = {}) {
    const userRef = db.collection('users').doc(uid);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.exists ? (snap.data() || {}) : {};
      const ids = Array.isArray(data.serverIds) ? [...data.serverIds] : [];
      if (ids.includes(uniId)) {
        if (snap.exists) tx.set(userRef, { serverCount: ids.length }, { merge: true });
        return;
      }
      if (!alreadyMember && ids.length >= SERVER_LIMIT) {
        throw new Error(SERVER_LIMIT_MESSAGE);
      }
      ids.push(uniId);
      tx.set(userRef, { serverIds: ids, serverCount: ids.length }, { merge: true });
    });
  }

  async function releaseServerSlot(db, uid, uniId) {
    const userRef = db.collection('users').doc(uid);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) return;
      const data = snap.data() || {};
      const ids = (Array.isArray(data.serverIds) ? data.serverIds : []).filter((id) => id !== uniId);
      tx.set(userRef, { serverIds: ids, serverCount: ids.length }, { merge: true });
    }).catch(() => {});
    _invalidateUniCaches(uniId);
  }

  async function getMyServerMembership() {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user) return { serverIds: [], serverCount: 0, limit: SERVER_LIMIT };
    const m = await getMembership(db, user.uid);
    return { serverIds: m.serverIds, serverCount: m.serverCount, limit: SERVER_LIMIT };
  }

  // Pulizia messaggi privati oltre i 15: solo al login nel server, mai ad ogni invio
  async function cleanupPrivateMessagesOnce(db, uniId, uid) {
    const key = `${uid}:${uniId}`;
    if (_privateCleanupDone.has(key)) return;
    _privateCleanupDone.add(key);
    try {
      const chatsSnap = await db.collection('online_universes').doc(uniId).collection('private_chats')
        .where('participants', 'array-contains', uid)
        .get();
      for (const chatDoc of chatsSnap.docs) {
        const msgsSnap = await chatDoc.ref.collection('messages').orderBy('timestamp', 'desc').get();
        if (msgsSnap.size > 15) {
          const batch = db.batch();
          msgsSnap.docs.slice(15).forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
    } catch (e) { /* pulizia best-effort al login */ }
  }

  function sanitizeNickname(nick) {
    return String(nick || '').trim().slice(0, 20);
  }

  function nicknameToInternalEmail(nick) {
    const clean = String(nick || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean.length < 3) {
      throw new Error('Il nickname deve contenere almeno 3 caratteri alfanumerici.');
    }
    return `${clean}@universum.pvp`;
  }

  function generatePlanetSpecs(coords) {
    const pos = Number(coords.p);
    let maxTemp = 35;
    let fieldsMax = 200;

    if (pos <= 3) {
      maxTemp = 110 - pos * 15;
      fieldsMax = 155 + pos * 12;
    } else if (pos <= 12) {
      maxTemp = 55 - pos * 5;
      fieldsMax = 210 + (pos % 4) * 15;
    } else {
      maxTemp = -30 - (pos - 12) * 18;
      fieldsMax = 175 + (pos % 3) * 15;
    }

    return {
      minTemp: maxTemp - 40,
      maxTemp,
      fieldsMax
    };
  }

  function createStarterPlanetDoc(uniId, coords, ownerUid, ownerName, planetName, isNpc = false) {
    const specs = generatePlanetSpecs(coords);
    const key = coordsToKey(coords);
    return {
      id: `mp_pl_${uniId}_${key}`,
      coords: { g: Number(coords.g), s: Number(coords.s), p: Number(coords.p) },
      key,
      ownerUid,
      ownerName,
      isNpc: Boolean(isNpc),
      name: planetName,
      planetName,
      minTemp: specs.minTemp,
      maxTemp: specs.maxTemp,
      fieldsMax: specs.fieldsMax,
      resources: isNpc
        ? { metal: 50000, crystal: 35000, deuterium: 15000 }
        : { metal: 1500, crystal: 1000, deuterium: 300 },
      buildings: isNpc
        ? { metalMine: 8, crystalMine: 7, deuteriumSynth: 5, solarPlant: 9, roboticsFactory: 3, shipyard: 3 }
        : { metalMine: 1, crystalMine: 1, deuteriumSynth: 0, solarPlant: 1, roboticsFactory: 0, shipyard: 0, researchLab: 0 },
      defenses: isNpc
        ? { rocketLauncher: 25, lightLaser: 12, smallShieldDome: 1 }
        : {},
      fleet: isNpc
        ? { lightFighter: 10, smallCargo: 8 }
        : {},
      buildQueue: [],
      shipyardQueue: [],
      defenseQueue: [],
      moon: null,
      debris: { metal: 0, crystal: 0 },
      embargo: null,
      occupation: null,
      lastUpdated: Date.now()
    };
  }

  async function registerOrLogin(nickname, password, isRegister) {
    const auth = getAuth();
    const db = getDB();
    const cleanNick = sanitizeNickname(nickname);
    if (cleanNick.length < 3) {
      throw new Error('Inserisci un nickname di almeno 3 caratteri.');
    }
    if (!password || String(password).length < 6) {
      throw new Error('La password deve avere almeno 6 caratteri.');
    }

    const email = nicknameToInternalEmail(cleanNick);
    let cred;

    if (isRegister) {
      cred = await auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: cleanNick });
      await db.collection('users').doc(cred.user.uid).set({
        uid: cred.user.uid,
        nickname: cleanNick,
        createdAt: Date.now()
      }, { merge: true });
    } else {
      cred = await auth.signInWithEmailAndPassword(email, password);
      if (!cred.user.displayName) {
        await cred.user.updateProfile({ displayName: cleanNick });
      }
    }

    return cred.user;
  }

  async function getOnlineUniverses() {
    const db = getDB();
    const snap = await db.collection('online_universes')
      .orderBy('createdAt', 'desc')
      .limit(30)
      .get();

    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name,
        founderUid: d.founderUid || d.ownerUid,
        ownerUid: d.ownerUid || d.founderUid,
        founderName: d.founderName,
        speed: d.speed || 10,
        galaxies: d.galaxies || 3,
        systemsPerGalaxy: d.systemsPerGalaxy || 100,
        npcMode: d.npcMode || 'none',
        playerCount: d.playerCount || 1,
        hasPasscode: Boolean(d.passcode),
        createdAt: d.createdAt || Date.now()
      };
    });
  }

  async function generateNeutralOutpostsOnce(uniId, galaxies, systemsPerGalaxy) {
    const db = getDB();
    const outpostNames = [
      'Mercato Galattico Alpha',
      'Avamposto Mercantile Orion',
      'Covo Pirata Nebulosa',
      'Stazione Franco-Doganale',
      'Bazar Orbitale Vega',
      'Deposito Minerario Krell',
      'Rifugio Contrabbandieri',
      'Nodo Commerciale Sirius',
      'Avamposto Neutrale Altair',
      'Cittadella Libera Zenit'
    ];

    const usedKeys = new Set();
    const batch = db.batch();
    const count = 8 + Math.floor(Math.random() * 3);

    for (let i = 0; i < count; i++) {
      let coords;
      let key;
      let attempts = 0;
      do {
        coords = {
          g: 1 + Math.floor(Math.random() * galaxies),
          s: 1 + Math.floor(Math.random() * systemsPerGalaxy),
          p: 4 + Math.floor(Math.random() * 9)
        };
        key = coordsToKey(coords);
        attempts++;
      } while (usedKeys.has(key) && attempts < 40);

      usedKeys.add(key);
      const docRef = db.collection('online_universes').doc(uniId).collection('planets').doc(key);
      const outpostDoc = createStarterPlanetDoc(
        uniId,
        coords,
        `npc_outpost_${i + 1}`,
        'Avamposto Neutrale',
        outpostNames[i % outpostNames.length],
        true
      );
      batch.set(docRef, outpostDoc);
    }

    await batch.commit();
  }

  async function createOnlineUniverse(config) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user) throw new Error('Devi accedere prima di creare un universo online.');

    const name = String(config.name || '').trim().slice(0, 32);
    if (name.length < 3) throw new Error('Inserisci un nome valido per l’universo.');

    const speed = Math.min(1000, Math.max(1, Number(config.speed) || 10));
    const galaxies = Math.min(9, Math.max(1, Number(config.galaxies) || 3));
    const systemsPerGalaxy = Math.min(499, Math.max(20, Number(config.systemsPerGalaxy) || 100));
    const npcMode = config.npcMode === 'limited' ? 'limited' : 'none';
    const passcode = String(config.passcode || '').trim().slice(0, 20);
    const founderName = user.displayName || user.email.split('@')[0];

    const uniRef = db.collection('online_universes').doc();
    const uniId = uniRef.id;

    // Limite 3 server: slot riservato su Firestore prima di creare il server
    await claimServerSlot(db, user.uid, uniId);

    await uniRef.set({
      name,
      founderUid: user.uid,
      ownerUid: user.uid,
      founderName,
      speed,
      galaxies,
      systemsPerGalaxy,
      npcMode,
      passcode,
      creativeMode: false,
      playerCount: 0,
      createdAt: Date.now()
    });

    if (npcMode === 'limited') {
      await generateNeutralOutpostsOnce(uniId, galaxies, systemsPerGalaxy);
    }

    return await joinOnlineUniverse(uniId, passcode);
  }

  async function findFreeHomeCoords(uniId, galaxies, systemsPerGalaxy) {
    const db = getDB();
    const planetsCol = db.collection('online_universes').doc(uniId).collection('planets');

    for (let attempt = 0; attempt < 60; attempt++) {
      const coords = {
        g: 1 + Math.floor(Math.random() * galaxies),
        s: 1 + Math.floor(Math.random() * systemsPerGalaxy),
        p: 4 + Math.floor(Math.random() * 9)
      };
      const key = coordsToKey(coords);
      const snap = await planetsCol.doc(key).get();
      if (!snap.exists) {
        return coords;
      }
    }
    throw new Error('Nessuna coordinata libera trovata. Riprova.');
  }

  async function joinOnlineUniverse(universeId, passcode = '') {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user) throw new Error('Devi accedere prima di entrare in un universo.');

    const uniRef = db.collection('online_universes').doc(universeId);
    const uniSnap = await uniRef.get();
    if (!uniSnap.exists) throw new Error('Universo online non trovato.');

    const uniData = uniSnap.data();
    if (uniData.passcode && uniData.passcode !== String(passcode || '').trim()) {
      throw new Error('Codice stanza errato.');
    }

    const playerName = user.displayName || user.email.split('@')[0];
    const playerRef = uniRef.collection('players').doc(user.uid);
    const playerSnap = await playerRef.get();

    let playerState;
    let myPlanets = [];

    if (!playerSnap.exists) {
      // Limite 3 server: controllo e registrazione slot su Firestore (lato join)
      await claimServerSlot(db, user.uid, universeId);
      const homeCoords = await findFreeHomeCoords(
        universeId,
        uniData.galaxies || 3,
        uniData.systemsPerGalaxy || 100
      );
      const homeKey = coordsToKey(homeCoords);
      const homePlanet = createStarterPlanetDoc(
        universeId,
        homeCoords,
        user.uid,
        playerName,
        `Pianeta Madre ${playerName}`,
        false
      );

      await uniRef.collection('planets').doc(homeKey).set(homePlanet);

      playerState = {
        uid: user.uid,
        nickname: playerName,
        researches: {},
        researchQueue: null,
        points: 0,
        planetCount: 1,
        joinedAt: Date.now(),
        lastSeen: Date.now()
      };
      await playerRef.set(playerState);

      await uniRef.update({
        playerCount: firebase.firestore.FieldValue.increment(1)
      });

      myPlanets = [homePlanet];
    } else {
      playerState = playerSnap.data();
      await playerRef.update({ lastSeen: Date.now(), nickname: playerName });

      const planetsSnap = await uniRef.collection('planets')
        .where('ownerUid', '==', user.uid)
        .get();

      myPlanets = planetsSnap.docs.map((d) => calculateLiveResources(d.data(), uniData.speed || 10));
    }

    const activeFleetsSnap = await uniRef.collection('fleets')
      .where('attackerUid', '==', user.uid)
      .where('resolved', '==', false)
      .get()
      .catch(() => ({ docs: [] }));

    const fleetsInFlight = activeFleetsSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));

    const msgSnap = await uniRef.collection('messages')
      .where('recipientUid', '==', user.uid)
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get()
      .catch(() => ({ docs: [] }));

    const messages = msgSnap.docs.map((d) => d.data());

    // Gia' membro legacy senza slot registrato: allinea il conteggio senza bloccare la rientrata
    if (playerSnap.exists) {
      await claimServerSlot(db, user.uid, universeId, { alreadyMember: true }).catch(() => {});
    }
    _invalidateUniCaches(universeId);
    await migrateOnlineFleets(universeId).catch(() => {});
    await cleanupPrivateMessagesOnce(db, universeId, user.uid);

    return {
      id: universeId,
      founderUid: uniData.founderUid || uniData.ownerUid || null,
      ownerUid: uniData.ownerUid || uniData.founderUid || null,
      name: uniData.name,
      emperor: playerName,
      speed: uniData.speed || 10,
      galaxies: uniData.galaxies || 3,
      systemsPerGalaxy: uniData.systemsPerGalaxy || 100,
      npcMode: uniData.npcMode || 'none',
      creativeMode: false,
      planets: myPlanets,
      activePlanetId: myPlanets[0]?.id,
      researches: playerState.researches || {},
      researchQueue: playerState.researchQueue || null,
      fleetsInFlight,
      incomingAttacks: [],
      spyReports: [],
      messages
    };
  }

  function calculateLiveResources(planetDoc, speed = 10) {
    if (!planetDoc) return planetDoc;
    const now = Date.now();
    const last = Number(planetDoc.lastUpdated || now);
    const elapsedHours = Math.max(0, (now - last) / 3600000);

    const cloned = Object.assign({}, planetDoc, {
      resources: Object.assign({ metal: 0, crystal: 0, deuterium: 0 }, planetDoc.resources || {})
    });

    if (elapsedHours > 0 && window.UniversumEngine?.getPlanetProduction) {
      const prod = window.UniversumEngine.getPlanetProduction(cloned, { speed, creativeMode: false });
      cloned.resources.metal = Math.floor(cloned.resources.metal + prod.metalPerHour * elapsedHours);
      cloned.resources.crystal = Math.floor(cloned.resources.crystal + prod.crystalPerHour * elapsedHours);
      cloned.resources.deuterium = Math.max(0, Math.floor(cloned.resources.deuterium + prod.deuteriumPerHour * elapsedHours));
    }

    cloned.lastUpdated = now;
    return cloned;
  }

  function computePlayerPoints(universeObj) {
    const Data = window.UniversumData;
    let pts = 0;
    for (const p of universeObj.planets || []) {
      for (const lv of Object.values(p.buildings || {})) pts += (Number(lv) || 0) * 150;
      for (const [sId, cnt] of Object.entries(p.fleet || {})) {
        const spec = Data?.SHIPS?.[sId];
        if (spec) pts += Math.floor(((spec.cost.metal + spec.cost.crystal + spec.cost.deuterium) / 1000) * cnt);
      }
      for (const [dId, cnt] of Object.entries(p.defenses || {})) {
        const spec = Data?.DEFENSES?.[dId];
        if (spec) pts += Math.floor(((spec.cost.metal + spec.cost.crystal + spec.cost.deuterium) / 1000) * cnt);
      }
    }
    for (const lv of Object.values(universeObj.researches || {})) {
      pts += (Number(lv) || 0) * 350;
    }
    return pts;
  }

  async function syncPlayerState(universeObj, { force = false } = {}) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !universeObj?.id) return;

    // Spark: sync periodica al massimo ogni 60s; immediata solo su azione esplicita (force)
    const lastSync = _syncLastByUni.get(universeObj.id) || 0;
    if (!force && Date.now() - lastSync < SYNC_MIN_INTERVAL_MS) return;
    _syncLastByUni.set(universeObj.id, Date.now());

    const uniRef = db.collection('online_universes').doc(universeObj.id);
    const batch = db.batch();

    for (const p of universeObj.planets || []) {
      const key = coordsToKey(p.coords);
      const pRef = uniRef.collection('planets').doc(key);
      batch.set(pRef, {
        name: p.name,
        planetName: p.name,
        resources: p.resources,
        buildings: p.buildings,
        defenses: p.defenses,
        fleet: p.fleet,
        buildQueue: p.buildQueue || [],
        shipyardQueue: p.shipyardQueue || [],
        defenseQueue: p.defenseQueue || [],
        moon: p.moon || null,
        lastUpdated: Date.now()
      }, { merge: true });
    }

    const totalPoints = computePlayerPoints(universeObj);
    const playerRef = uniRef.collection('players').doc(user.uid);
    batch.set(playerRef, {
      nickname: universeObj.emperor || user.displayName || 'Comandante',
      researches: universeObj.researches || {},
      researchQueue: universeObj.researchQueue || null,
      points: totalPoints,
      planetCount: (universeObj.planets || []).length,
      lastSeen: Date.now()
    }, { merge: true });

    await batch.commit();
  }

  async function renameOnlinePlanet(uniId, coords, newName) {
    const db = getDB();
    const key = coordsToKey(coords);
    await db.collection('online_universes').doc(uniId).collection('planets').doc(key).update({
      name: newName,
      planetName: newName
    });
  }

  async function renameOnlineMoon(uniId, coords, newMoonName) {
    const db = getDB();
    const key = coordsToKey(coords);
    await db.collection('online_universes').doc(uniId).collection('planets').doc(key).update({
      'moon.name': newMoonName
    });
  }

  async function getOnlineSystem(uniId, galaxy, system) {
    const cacheKey = `${uniId}:${Number(galaxy)}:${Number(system)}`;
    const cached = _cacheGet(_systemCache, cacheKey, SYSTEM_CACHE_TTL_MS);
    if (cached) {
      // Mostra subito la cache e aggiorna in background (una sola refresh alla volta)
      if (!_systemPending.has(cacheKey)) {
        _systemPending.add(cacheKey);
        fetchOnlineSystem(uniId, galaxy, system)
          .then((fresh) => _systemCache.set(cacheKey, { at: Date.now(), data: fresh }))
          .catch(() => {})
          .finally(() => _systemPending.delete(cacheKey));
      }
      return cached;
    }
    const fresh = await fetchOnlineSystem(uniId, galaxy, system);
    _systemCache.set(cacheKey, { at: Date.now(), data: fresh });
    return fresh;
  }

  async function fetchOnlineSystem(uniId, galaxy, system) {
    const db = getDB();
    const uniRef = db.collection('online_universes').doc(uniId);
    const uniSnap = await uniRef.get();
    const speed = uniSnap.exists ? (uniSnap.data().speed || 10) : 10;

    const snap = await uniRef.collection('planets')
      .where('coords.g', '==', Number(galaxy))
      .where('coords.s', '==', Number(system))
      .get();

    const occupiedByPos = new Map();
    snap.docs.forEach((doc) => {
      const liveData = calculateLiveResources(doc.data(), speed);
      occupiedByPos.set(Number(liveData.coords.p), liveData);
    });

    const slots = [];
    for (let pos = 1; pos <= 15; pos++) {
      if (occupiedByPos.has(pos)) {
        const pl = occupiedByPos.get(pos);
        slots.push(Object.assign({}, pl, {
          planetId: pl.id,
          ownerType: pl.isNpc ? 'outpost' : 'player'
        }));
      } else {
        const specs = generatePlanetSpecs({ g: galaxy, s: system, p: pos });
        slots.push({
          coords: { g: Number(galaxy), s: Number(system), p: pos },
          name: 'Pianeta Disabitato',
          planetName: 'Pianeta Disabitato',
          ownerUid: null,
          ownerName: null,
          isNpc: false,
          ownerType: 'empty',
          minTemp: specs.minTemp,
          maxTemp: specs.maxTemp,
          fieldsMax: specs.fieldsMax,
          moon: null,
          debris: { metal: 0, crystal: 0 }
        });
      }
    }

    return {
      galaxy: Number(galaxy),
      system: Number(system),
      slots
    };
  }

  // =========================================================
  // 5. FLOTTE PvP, COLONIZZAZIONE, SPINTA MOTORI, ESPLORAZIONI & ASSEDI
  // =========================================================
  async function launchOnlineFleet(universeObj, originPlanetIndex, targetCoords, mission, shipsSelected, cargo = {}, options = {}) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user) throw new Error('Utente non autenticato.');

    const planet = universeObj.planets[originPlanetIndex];
    if (!planet) throw new Error('Pianeta di partenza non valido.');

    const normalizedMission = mission === 'explore' ? 'expedition' : mission;

    const originKey = coordsToKey(planet.coords);
    const uniRef = db.collection('online_universes').doc(universeObj.id);
    const freshOriginSnap = await uniRef.collection('planets').doc(originKey).get();
    if (freshOriginSnap.exists) {
      const freshOrigin = freshOriginSnap.data();
      if (freshOrigin.embargo && freshOrigin.embargo.attackerUid !== user.uid) {
        throw new Error(`Impossibile lanciare flotte: pianeta sotto embargo da ${freshOrigin.embargo.attackerName}!`);
      }
      if (freshOrigin.occupation && freshOrigin.occupation.occupierUid !== user.uid) {
        throw new Error(`Impossibile lanciare flotte: pianeta occupato da ${freshOrigin.occupation.occupierName}!`);
      }
    }

    const MCore = window.UniversumMissionsCore;
    const maxSlots = MCore ? MCore.getMaxFleetSlots(universeObj) : (5 + Number(universeObj.researches?.computerTech || 0));
    const activeCount = (universeObj.fleetsInFlight || []).filter((f) => !f.resolved).length;
    if (activeCount >= maxSlots) {
      throw new Error(`Slot flotta esauriti (${activeCount}/${maxSlots}). Potenzia Tecnologia Informatica.`);
    }

    const cleanShips = {};
    let totalShips = 0;
    for (const [sId, count] of Object.entries(shipsSelected || {})) {
      const qty = Math.max(0, Math.floor(Number(count) || 0));
      if (qty > 0 && sId !== 'solarSatellite') {
        if ((planet.fleet[sId] || 0) < qty) {
          throw new Error(`Navi insufficienti (${sId}).`);
        }
        cleanShips[sId] = qty;
        totalShips += qty;
      }
    }
    if (totalShips === 0) throw new Error('Seleziona almeno una nave.');
    if (normalizedMission === 'colonize' && !cleanShips.colonyShip) {
      throw new Error('Devi includere almeno una Colonizzatrice per fondare una colonia.');
    }
    if (normalizedMission === 'spy' && !cleanShips.espionageProbe) {
      throw new Error('Devi includere almeno una Sonda Spia.');
    }

    const speedPct = Math.min(100, Math.max(10, Number(options.fuelPercent || options.speedPct) || 100));
    const expeditionHours = Math.min(24, Math.max(1, Number(options.exploreHours || options.expeditionHours) || 1));
    const dist = window.UniversumGalaxy.calculateDistance(planet.coords, targetCoords);
    const flightStats = window.UniversumGalaxy.getFleetSpeedAndFuel(universeObj, cleanShips, dist, speedPct);

    const cargoM = Math.max(0, Math.floor(Number(cargo.metal) || 0));
    const cargoC = Math.max(0, Math.floor(Number(cargo.crystal) || 0));
    const cargoD = Math.max(0, Math.floor(Number(cargo.deuterium) || 0));
    const blackHoleExtra = (normalizedMission === 'expedition' && options.blackHole) ? 50000 : 0;

    if (planet.resources.metal < cargoM || planet.resources.crystal < cargoC || planet.resources.deuterium < cargoD + flightStats.fuelCost + blackHoleExtra) {
      throw new Error('Risorse o Deuterio per il carburante insufficienti.');
    }

    const targetKey = coordsToKey(targetCoords);
    const targetSnap = await uniRef.collection('planets').doc(targetKey).get();
    if (normalizedMission === 'colonize' && targetSnap.exists) {
      throw new Error(`Lo slot [${targetCoords.g}:${targetCoords.s}:${targetCoords.p}] è già occupato!`);
    }

    for (const [sId, qty] of Object.entries(cleanShips)) {
      planet.fleet[sId] -= qty;
    }
    planet.resources.metal -= cargoM;
    planet.resources.crystal -= cargoC;
    planet.resources.deuterium -= (cargoD + flightStats.fuelCost + blackHoleExtra);

    await syncPlayerState(universeObj, { force: true });

    const defenderUid = targetSnap.exists ? (targetSnap.data().ownerUid || null) : null;

    const now = Date.now();
    const holdDurationSec = normalizedMission === 'expedition'
      ? Math.max(5, Math.round((expeditionHours * 3600) / Math.max(1, universeObj.speed || 10)))
      : 0;
    const arrivalTime = now + (flightStats.durationSec + holdDurationSec) * 1000;
    const returnTime = arrivalTime + flightStats.durationSec * 1000;

    const ransom = options.ransom ? {
      metal: Math.max(0, Math.floor(Number(options.ransom.metal) || 0)),
      crystal: Math.max(0, Math.floor(Number(options.ransom.crystal) || 0)),
      deuterium: Math.max(0, Math.floor(Number(options.ransom.deuterium) || 0))
    } : { metal: 50000, crystal: 25000, deuterium: 10000 };

    const serverTs = (typeof firebase !== 'undefined' && firebase.firestore?.FieldValue?.serverTimestamp)
      ? firebase.firestore.FieldValue.serverTimestamp() : null;
    const fleetDoc = {
      schemaVersion: FLEET_SCHEMA_VERSION,
      phase: 'IN VIAGGIO',
      departureAt: serverTs,
      attackerUid: user.uid,
      attackerName: universeObj.emperor || user.displayName || 'Comandante',
      attackerTech: {
        weaponsTech: universeObj.researches?.weaponsTech || 0,
        shieldingTech: universeObj.researches?.shieldingTech || 0,
        armourTech: universeObj.researches?.armourTech || 0,
        expeditionTech: universeObj.researches?.expeditionTech || 0
      },
      defenderUid,
      originCoords: Object.assign({}, planet.coords),
      targetCoords: { g: Number(targetCoords.g), s: Number(targetCoords.s), p: Number(targetCoords.p) },
      targetKey,
      mission: normalizedMission,
      speedPct,
      expeditionHours,
      ransom,
      ships: cleanShips,
      cargo: { metal: cargoM, crystal: cargoC, deuterium: cargoD },
      blackHole: Boolean(options.blackHole),
      status: 'outbound',
      departureTime: now,
      arrivalTime,
      returnTime,
      resolved: false
    };

    const ref = await uniRef.collection('fleets').add(fleetDoc);
    fleetDoc.id = ref.id;

    // Ancora al tempo server: rilegge il serverTimestamp e riallinea partenza/arrivo una sola volta
    try {
      const savedSnap = await ref.get();
      const serverDepartureMs = _tsToMs(savedSnap.exists ? savedSnap.data()?.departureAt : null);
      if (serverDepartureMs > 0) {
        const durationMs = arrivalTime - now;
        const returnDurationMs = returnTime - arrivalTime;
        fleetDoc.departureTime = serverDepartureMs;
        fleetDoc.arrivalTime = serverDepartureMs + durationMs;
        fleetDoc.returnTime = fleetDoc.arrivalTime + returnDurationMs;
        await ref.update({
          departureTime: fleetDoc.departureTime,
          arrivalTime: fleetDoc.arrivalTime,
          returnTime: fleetDoc.returnTime
        });
      }
    } catch (e) { /* fallback ai tempi gia' salvati */ }

    universeObj.fleetsInFlight.push(fleetDoc);

    return fleetDoc;
  }

  async function recallOnlineFleet(universeObj, fleetId) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !universeObj?.id) throw new Error('Utente non autenticato.');

    const uniRef = db.collection('online_universes').doc(universeObj.id);
    const fleetRef = uniRef.collection('fleets').doc(fleetId);
    const snap = await fleetRef.get();
    if (!snap.exists) throw new Error('Flotta non trovata.');

    const fleet = snap.data();
    if (fleet.attackerUid !== user.uid) throw new Error('Non puoi richiamare una flotta non tua.');
    if (fleet.resolved || fleet.status !== 'outbound') {
      throw new Error('La flotta sta già rientrando o ha completato la missione.');
    }

    const now = Date.now();
    const elapsedMs = Math.max(2000, now - Number(fleet.departureTime || now));
    const newArrival = now + elapsedMs;

    await fleetRef.update({
      status: 'returning',
      mission: 'recall',
      arrivalTime: newArrival,
      returnTime: newArrival
    });

    const local = (universeObj.fleetsInFlight || []).find((f) => f.id === fleetId);
    if (local) {
      local.status = 'returning';
      local.mission = 'recall';
      local.arrivalTime = newArrival;
      local.returnTime = newArrival;
    }
  }

  function listenIncomingFleets(universeObj, callback) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !universeObj?.id) return () => {};

    const hostileMissions = new Set(['attack', 'spy', 'destroyMoon', 'blockade', 'embargo', 'occupy']);

    return db.collection('online_universes').doc(universeObj.id).collection('fleets')
      .where('defenderUid', '==', user.uid)
      .where('status', '==', 'outbound')
      .onSnapshot((snap) => {
        const list = snap.docs
          .map((d) => Object.assign({ id: d.id }, d.data()))
          .filter((f) => f.attackerUid !== user.uid && hostileMissions.has(f.mission));
        callback(list);
      }, (err) => {
        console.warn('[MP Radar] Errore listener flotte in arrivo:', err);
      });
  }

  async function forceCleanupOnlineFleet(uniRef, fleet, fleetRef, reason) {
    const db = getDB();
    const now = Date.now();
    try {
      await db.runTransaction(async (tx) => {
        const freshSnap = await tx.get(fleetRef);
        if (!freshSnap.exists || freshSnap.data().resolved) return;
        const originRef = fleet.originCoords ? uniRef.collection('planets').doc(coordsToKey(fleet.originCoords)) : null;
        const originSnap = originRef ? await tx.get(originRef) : null;
        if (originSnap?.exists) {
          const origin = calculateLiveResources(originSnap.data(), 10);
          origin.fleet = origin.fleet || {};
          for (const [sId, qty] of Object.entries(fleet.ships || {})) {
            if (qty > 0) origin.fleet[sId] = (origin.fleet[sId] || 0) + qty;
          }
          origin.resources.metal += fleet.cargo?.metal || 0;
          origin.resources.crystal += fleet.cargo?.crystal || 0;
          origin.resources.deuterium += fleet.cargo?.deuterium || 0;
          tx.set(originRef, origin, { merge: true });
        }
        tx.update(fleetRef, {
          status: 'completed', phase: 'COMPLETATA', resolved: true,
          completedAt: now, repaired: true, repairReason: String(reason || 'orphan')
        });
        if (fleet.attackerUid) {
          const msgRef = uniRef.collection('messages').doc();
          tx.set(msgRef, {
            recipientUid: fleet.attackerUid,
            title: `Missione riparata [${fleet.targetKey || 'sconosciuta'}]`,
            body: 'Missione scaduta/bloccata ripulita automaticamente: flotta e carico restituiti al pianeta di partenza.',
            timestamp: now
          });
        }
      });
      return true;
    } catch (e) {
      // Ultima risorsa: chiude comunque la missione per non lasciarla mai a 0s
      await fleetRef.update({ status: 'completed', phase: 'COMPLETATA', resolved: true, completedAt: now, repaired: true }).catch(() => {});
      return false;
    }
  }

  async function processEmbargoFleets(uniRef, fleetDocs, now) {
    const Data = window.UniversumData;
    for (const fDoc of fleetDocs) {
      const fleet = normalizeOnlineFleet(fDoc.data(), fDoc.id);
      if (fleet.status !== 'embargo' || fleet.resolved) continue;
      try {
        const elapsedSec = Math.max(0, (now - Number(fleet.lastSiegeTickAt || now)) / 1000);
        if (elapsedSec < 1) continue;
        let hourlyBurn = 0;
        for (const [sid, qty] of Object.entries(fleet.ships || {})) {
          hourlyBurn += (Data?.SHIPS?.[sid]?.fuelConsumption || 10) * Number(qty || 0);
        }
        hourlyBurn = Math.max(40, hourlyBurn);
        let remaining = Math.max(0, Number(fleet.siegeDeuterium || 0) - (hourlyBurn / 3600) * elapsedSec);
        const targetRef = uniRef.collection('planets').doc(fleet.targetKey);
        if (remaining > 0) {
          await fDoc.ref.update({ siegeDeuterium: remaining, lastSiegeTickAt: now });
          await targetRef.update({ 'embargo.deuterium': remaining }).catch(() => {});
        } else {
          // Deuterio finito: embargo finisce e la flotta torna da sola
          const durationSec = window.UniversumGalaxy?.getFleetSpeedAndFuel
            ? Math.max(5, window.UniversumGalaxy.getFleetSpeedAndFuel({ speed: 10, researches: {} }, fleet.ships, window.UniversumGalaxy.calculateDistance(fleet.targetCoords, fleet.originCoords)).durationSec || 60)
            : 60;
          await targetRef.update({ embargo: null }).catch(() => {});
          await fDoc.ref.update({
            status: 'returning', phase: 'IN RITORNO', siegeDeuterium: 0, lastSiegeTickAt: now,
            arrivalTime: now + durationSec * 1000, returnTime: now + durationSec * 1000
          });
          if (fleet.attackerUid) {
            await uniRef.collection('messages').add({
              recipientUid: fleet.attackerUid,
              title: `Embargo terminato [${fleet.targetKey}]`,
              body: 'Deuterio nella stiva esaurito: la flotta embargo sta rientrando automaticamente alla base.',
              timestamp: now
            }).catch(() => {});
          }
          if (fleet.defenderUid) {
            await uniRef.collection('messages').add({
              recipientUid: fleet.defenderUid,
              title: `Embargo terminato [${fleet.targetKey}]`,
              body: 'Il Deuterio della flotta embargo si e esaurito: le rotte del pianeta sono di nuovo libere.',
              timestamp: now
            }).catch(() => {});
          }
        }
      } catch (e) { /* il prossimo tick riprova; mai bloccare le altre missioni */ }
    }
  }

  async function resolveArrivedOnlineFleets(uniId) {
    const db = getDB();
    const uniRef = db.collection('online_universes').doc(uniId);
    const now = Date.now();

    await migrateOnlineFleets(uniId).catch(() => {});

    // Mai resolved==false in query: i documenti vecchi senza quel campo resterebbero esclusi per sempre.
    // Si leggono solo le flotte scadute (arrivalTime <= ora) e si filtra resolved/status in locale.
    const allSnap = await uniRef.collection('fleets').where('arrivalTime', '<=', now).limit(100).get().catch(() => ({ docs: [] }));
    if (!allSnap.docs || allSnap.docs.length === 0) return;

    await processEmbargoFleets(uniRef, allSnap.docs, now);

    const arrivedDocs = allSnap.docs
      .map((d) => ({ doc: d, fleet: normalizeOnlineFleet(d.data(), d.id) }))
      .filter(({ fleet }) => !fleet.resolved && (fleet.status === 'outbound' || fleet.status === 'returning') && _fleetDueTime(fleet) <= now)
      .sort((a, b) => _fleetDueTime(a.fleet) - _fleetDueTime(b.fleet))
      .slice(0, 10);
    if (arrivedDocs.length === 0) return;

    const uniSnap = await uniRef.get();
    const speed = uniSnap.exists ? (uniSnap.data().speed || 10) : 10;
    const currentUid = window.fbAuth?.currentUser?.uid;

    for (const { doc: fDoc, fleet: fleetNorm } of arrivedDocs) {
      const fleetRef = fDoc.ref;
      if (!fleetNorm.targetKey || !fleetNorm.originCoords) {
        await forceCleanupOnlineFleet(uniRef, fleetNorm, fleetRef, 'missing-route');
        continue;
      }
      const targetPlanetRef = uniRef.collection('planets').doc(fleetNorm.targetKey);
      const originPlanetRef = uniRef.collection('planets').doc(coordsToKey(fleetNorm.originCoords));
      let newlyColonizedPlanet = null;
      let localReturning = null;

      try {
        await db.runTransaction(async (tx) => {
          const freshFleetSnap = await tx.get(fleetRef);
          if (!freshFleetSnap.exists || freshFleetSnap.data().resolved) return;
          const fleet = normalizeOnlineFleet(freshFleetSnap.data(), fDoc.id);
          if ((fleet.status !== 'outbound' && fleet.status !== 'returning') || _fleetDueTime(fleet) > Date.now()) return;

          const targetSnap = await tx.get(targetPlanetRef);
          const originSnap = await tx.get(originPlanetRef);

          const targetPlanet = targetSnap.exists ? calculateLiveResources(targetSnap.data(), speed) : null;
          const originPlanet = originSnap.exists ? calculateLiveResources(originSnap.data(), speed) : null;

          let reportTitle = `Missione ${fleet.mission.toUpperCase()} [${fleet.targetKey}]`;
          let reportBody = 'Missione completata.';
          let returnShips = Object.assign({}, fleet.ships || {});
          let returnCargo = Object.assign({ metal: 0, crystal: 0, deuterium: 0 }, fleet.cargo || {});
          // Esito del ciclo di vita: andata+ritorno (default), completamento all'arrivo, o persistente
          let completeNow = fleet.status === 'returning';
          let persistentStatus = null;
          let siegeShips = null;

          if (fleet.status === 'returning' || fleet.mission === 'recall') {
            reportTitle = `Flotta Richiamata Rientrata [${coordsToKey(fleet.originCoords)}]`;
            reportBody = 'Le navi sono rientrate alla base con il carico integro.';
          } else if (fleet.mission === 'spy' && targetPlanet) {
            reportTitle = `Rapporto Spionaggio su ${targetPlanet.name} [${fleet.targetKey}]`;
            reportBody = `Risorse rilevate — Metallo: ${Math.floor(targetPlanet.resources.metal)}, Cristallo: ${Math.floor(targetPlanet.resources.crystal)}, Deuterio: ${Math.floor(targetPlanet.resources.deuterium)}.`;
          } else if (fleet.mission === 'transport' && targetPlanet) {
            targetPlanet.resources.metal += returnCargo.metal;
            targetPlanet.resources.crystal += returnCargo.crystal;
            targetPlanet.resources.deuterium += returnCargo.deuterium;
            returnCargo = { metal: 0, crystal: 0, deuterium: 0 };
            tx.set(targetPlanetRef, targetPlanet, { merge: true });
            reportTitle = `Consegna Risorse su ${targetPlanet.name}`;
            reportBody = `Consegnati ${fleet.cargo.metal} M, ${fleet.cargo.crystal} C, ${fleet.cargo.deuterium} D.`;
          } else if (fleet.mission === 'deploy' && targetPlanet && targetPlanet.ownerUid === fleet.attackerUid) {
            for (const [sId, qty] of Object.entries(returnShips)) {
              targetPlanet.fleet[sId] = (targetPlanet.fleet[sId] || 0) + qty;
            }
            targetPlanet.resources.metal += returnCargo.metal;
            targetPlanet.resources.crystal += returnCargo.crystal;
            targetPlanet.resources.deuterium += returnCargo.deuterium;
            returnShips = {};
            returnCargo = { metal: 0, crystal: 0, deuterium: 0 };
            completeNow = true; // Schiera: la flotta resta a destinazione e la missione finisce
            tx.set(targetPlanetRef, targetPlanet, { merge: true });
            reportTitle = `Schieramento Completato su ${targetPlanet.name}`;
            reportBody = 'La flotta si è unita alla guarnigione locale.';
          } else if (fleet.mission === 'colonize') {
            if (!targetPlanet && (returnShips.colonyShip || 0) >= 1) {
              const newColony = createStarterPlanetDoc(
                uniId,
                fleet.targetCoords,
                fleet.attackerUid,
                fleet.attackerName,
                `Colonia ${fleet.targetCoords.g}:${fleet.targetCoords.s}:${fleet.targetCoords.p}`,
                false
              );
              newColony.resources.metal += returnCargo.metal;
              newColony.resources.crystal += returnCargo.crystal;
              newColony.resources.deuterium += returnCargo.deuterium;
              returnCargo = { metal: 0, crystal: 0, deuterium: 0 };
              returnShips.colonyShip = Math.max(0, returnShips.colonyShip - 1);
              newColony.fleet = Object.assign({}, returnShips); // La flotta resta sulla nuova colonia
              returnShips = {};
              completeNow = true; // Colonizza: crea il pianeta e finisce, nessun ritorno
              tx.set(targetPlanetRef, newColony);
              newlyColonizedPlanet = newColony;
              reportTitle = `Nuova Colonia Fondata [${fleet.targetCoords.g}:${fleet.targetCoords.s}:${fleet.targetCoords.p}]`;
              reportBody = `Il pianeta è ora sotto il tuo comando.`;
            } else {
              reportTitle = `Colonizzazione Fallita [${fleet.targetCoords.g}:${fleet.targetCoords.s}:${fleet.targetCoords.p}]`;
              reportBody = 'Lo slot era già occupato. La Colonizzatrice rientra alla base.';
            }
          } else if (fleet.mission === 'expedition' || fleet.mission === 'explore') {
            const expLv = fleet.attackerTech?.expeditionTech || 0;
            const hrs = fleet.expeditionHours || 1;
            const mult = (1 + expLv * 0.25) * (1 + (hrs - 1) * 0.22);
            const roll = Math.random();
            if (roll < 0.55) {
              const foundM = Math.floor((8000 + Math.random() * 14000) * mult);
              const foundC = Math.floor((5000 + Math.random() * 9000) * mult);
              const foundD = Math.floor((2000 + Math.random() * 5000) * mult);
              returnCargo.metal += foundM;
              returnCargo.crystal += foundC;
              returnCargo.deuterium += foundD;
              reportTitle = `Esplorazione Profonda [${fleet.targetKey}] (${hrs}h)`;
              reportBody = `Relitti recuperati nello spazio profondo: +${foundM} M, +${foundC} C, +${foundD} D.`;
            } else if (roll < 0.78) {
              const bonusShips = Math.max(1, Math.floor((1 + Math.random() * 3) * (1 + expLv * 0.15)));
              returnShips.lightFighter = (returnShips.lightFighter || 0) + bonusShips;
              reportTitle = `Esplorazione Profonda [${fleet.targetKey}] (${hrs}h)`;
              reportBody = `La spedizione ha riattivato ${bonusShips} Caccia Leggeri abbandonati alla deriva!`;
            } else {
              reportTitle = `Esplorazione Profonda [${fleet.targetKey}] (${hrs}h)`;
              reportBody = 'Nessuna anomalia rilevata nel settore esplorato. Flotta rientrata alla base.';
            }
          } else if (
            (fleet.mission === 'attack' || fleet.mission === 'blockade' || fleet.mission === 'embargo' || fleet.mission === 'occupy') &&
            targetPlanet &&
            window.UniversumGalaxy?.resolveCombat
          ) {
            const defenderUidForTech = fleet.defenderUid || targetPlanet.ownerUid || null;
            let defenderTech = { weaponsTech: 0, shieldingTech: 0, armourTech: 0 };
            if (defenderUidForTech && !targetPlanet.isNpc) {
              const defenderSnap = await tx.get(uniRef.collection('players').doc(defenderUidForTech));
              if (defenderSnap.exists) {
                const defResearches = defenderSnap.data().researches || {};
                defenderTech = {
                  weaponsTech: Number(defResearches.weaponsTech || 0),
                  shieldingTech: Number(defResearches.shieldingTech || 0),
                  armourTech: Number(defResearches.armourTech || 0)
                };
              }
            }

            const combat = window.UniversumGalaxy.resolveCombat(
              fleet.ships,
              fleet.attackerTech,
              {
                fleet: targetPlanet.fleet || {},
                defenses: targetPlanet.defenses || {},
                tech: defenderTech,
                resources: targetPlanet.resources,
                buildings: targetPlanet.buildings || {},
                moon: targetPlanet.moon || null
              }
            );

            targetPlanet.fleet = combat.defenderFleetSurvivors || combat.defenderSurvivors || {};
            targetPlanet.defenses = combat.repairedDefenses || combat.defenderDefenseSurvivors || {};
            targetPlanet.debris = {
              metal: (targetPlanet.debris?.metal || 0) + combat.debris.metal,
              crystal: (targetPlanet.debris?.crystal || 0) + combat.debris.crystal
            };

            if (fleet.mission === 'attack') {
              targetPlanet.resources.metal = Math.max(0, targetPlanet.resources.metal - combat.loot.metal);
              targetPlanet.resources.crystal = Math.max(0, targetPlanet.resources.crystal - combat.loot.crystal);
              targetPlanet.resources.deuterium = Math.max(0, targetPlanet.resources.deuterium - combat.loot.deuterium);
              returnShips = combat.attackerSurvivors;
              returnCargo.metal += combat.loot.metal;
              returnCargo.crystal += combat.loot.crystal;
              returnCargo.deuterium += combat.loot.deuterium;
              reportTitle = `Battaglia PvP su ${targetPlanet.name} [${fleet.targetKey}]`;
              reportBody = `Esito: ${combat.result}. Bottino: ${combat.loot.metal} M, ${combat.loot.crystal} C, ${combat.loot.deuterium} D.`;
            } else if (fleet.mission === 'blockade' || fleet.mission === 'embargo') {
              if (combat.result === 'attacker_win') {
                targetPlanet.embargo = {
                  attackerUid: fleet.attackerUid,
                  attackerName: fleet.attackerName,
                  originCoords: fleet.originCoords,
                  ships: combat.attackerSurvivors,
                  ransom: fleet.ransom,
                  deuterium: Number(fleet.cargo?.deuterium || 0),
                  fleetId: fDoc.id,
                  startedAt: now
                };
                persistentStatus = 'embargo';
                siegeShips = combat.attackerSurvivors;
                returnShips = {};
                reportTitle = `Embargo Stabilito su ${targetPlanet.name} [${fleet.targetKey}]`;
                reportBody = `Spazio aereo bloccato. Riscatto richiesto: ${fleet.ransom.metal} M, ${fleet.ransom.crystal} C, ${fleet.ransom.deuterium} D.`;
              } else {
                returnShips = combat.attackerSurvivors;
                reportTitle = `Tentativo di Embargo Respinto [${fleet.targetKey}]`;
                reportBody = `Le difese di ${targetPlanet.name} hanno respinto il blocco navale.`;
              }
            } else if (fleet.mission === 'occupy') {
              if (combat.result === 'attacker_win') {
                targetPlanet.occupation = {
                  occupierUid: fleet.attackerUid,
                  occupierName: fleet.attackerName,
                  originCoords: fleet.originCoords,
                  garrisonShips: combat.attackerSurvivors,
                  ransom: fleet.ransom,
                  prelievoAccumulato: { metal: 0, crystal: 0, deuterium: 0 },
                  fleetId: fDoc.id,
                  startedAt: now,
                  lastTributeAt: now
                };
                persistentStatus = 'occupy';
                siegeShips = combat.attackerSurvivors;
                returnShips = {};
                reportTitle = `Pianeta Occupato: ${targetPlanet.name} [${fleet.targetKey}]`;
                reportBody = `Guarnigione schierata. Tributi automatici del 5% ogni 24h attivi.`;
              } else {
                returnShips = combat.attackerSurvivors;
                reportTitle = `Occupazione Respinta [${fleet.targetKey}]`;
                reportBody = `Assalto fallito su ${targetPlanet.name}.`;
              }
            }

            const fmtUnits = (map) => {
              const Data = window.UniversumData;
              const parts = Object.entries(map || {})
                .filter(([, cnt]) => Number(cnt) > 0)
                .map(([id, cnt]) => `${(Data?.SHIPS?.[id] || Data?.DEFENSES?.[id])?.name || id} x${Number(cnt).toLocaleString('it-IT')}`);
              return parts.length > 0 ? parts.join(', ') : 'nessuna';
            };
            reportBody += ` Dettagli battaglia — Round: ${combat.roundsPlayed}. Perdite attaccante: ${fmtUnits(combat.attackerLosses)}. Perdite difensore: ${fmtUnits(combat.defenderLosses)}. Superstiti attaccante: ${fmtUnits(combat.attackerSurvivors)}. Superstiti difensore: ${fmtUnits(combat.defenderFleetSurvivors)} (flotta), ${fmtUnits(combat.repairedDefenses)} (difese). Detriti: ${combat.debris.metal.toLocaleString('it-IT')} M, ${combat.debris.crystal.toLocaleString('it-IT')} C.`;

            tx.set(targetPlanetRef, targetPlanet, { merge: true });
          }

          // Solo la tratta di RITORNO accredita origine: mai alla risoluzione dell'andata
          if (completeNow && fleet.status === 'returning' && originPlanet) {
            for (const [sId, surv] of Object.entries(returnShips)) {
              if (surv > 0) {
                originPlanet.fleet[sId] = (originPlanet.fleet[sId] || 0) + surv;
              }
            }
            originPlanet.resources.metal += returnCargo.metal || 0;
            originPlanet.resources.crystal += returnCargo.crystal || 0;
            originPlanet.resources.deuterium += returnCargo.deuterium || 0;
            if (fleet.pendingRansom) {
              originPlanet.resources.metal += fleet.pendingRansom.metal || 0;
              originPlanet.resources.crystal += fleet.pendingRansom.crystal || 0;
              originPlanet.resources.deuterium += fleet.pendingRansom.deuterium || 0;
            }
            tx.set(originPlanetRef, originPlanet, { merge: true });
          }

          if (persistentStatus) {
            // Embargo/Occupazione: missione persistente, NON risolta
            tx.update(fleetRef, {
              status: persistentStatus,
              phase: persistentStatus === 'embargo' ? 'IN EMBARGO' : 'IN OCCUPAZIONE',
              resolved: false,
              ships: siegeShips || {},
              fleet: siegeShips || {},
              siegeDeuterium: persistentStatus === 'embargo' ? Number(fleet.cargo?.deuterium || 0) : 0,
              siegeStartedAt: now,
              lastSiegeTickAt: now,
              schemaVersion: FLEET_SCHEMA_VERSION
            });
          } else if (completeNow) {
            tx.update(fleetRef, {
              status: 'completed', phase: 'COMPLETATA', resolved: true, completedAt: now,
              schemaVersion: FLEET_SCHEMA_VERSION
            });
          } else {
            // Andata risolta: passa a IN RITORNO con superstiti e carico, si chiudera' all'arrivo
            const legMs = Math.max(5000, (Number(fleet.returnTime || now) - Number(fleet.arrivalTime || now)) || 60000);
            localReturning = { ships: returnShips, cargo: returnCargo, arrivalTime: now + legMs };
            tx.update(fleetRef, {
              status: 'returning',
              phase: 'IN RITORNO',
              resolved: false,
              ships: returnShips,
              fleet: returnShips,
              cargo: returnCargo,
              arrivalTime: now + legMs,
              returnTime: now + legMs,
              schemaVersion: FLEET_SCHEMA_VERSION
            });
          }

          const msgAttRef = uniRef.collection('messages').doc();
          tx.set(msgAttRef, {
            recipientUid: fleet.attackerUid,
            type: fleet.mission,
            title: reportTitle,
            body: reportBody,
            timestamp: now
          });

          if (fleet.status === 'outbound' && fleet.defenderUid && fleet.defenderUid !== fleet.attackerUid && !targetPlanet?.isNpc) {
            const msgDefRef = uniRef.collection('messages').doc();
            tx.set(msgDefRef, {
              recipientUid: fleet.defenderUid,
              title: reportTitle,
              body: `Comandante: ${fleet.attackerName}. ${reportBody}`,
              timestamp: now
            });
          }
        });

        // Aggiorna subito lo stato locale UI se la flotta appartiene al giocatore corrente
        const localUni = window.UniversumUI?.state?.currentUniverse;
        if (localUni && fleetNorm.attackerUid === currentUid) {
          if (localReturning) {
            const localFleet = (localUni.fleetsInFlight || []).find((f) => f.id === fDoc.id);
            if (localFleet) {
              localFleet.status = 'returning';
              localFleet.phase = 'IN RITORNO';
              localFleet.ships = localReturning.ships;
              localFleet.fleet = localReturning.ships;
              localFleet.cargo = localReturning.cargo;
              localFleet.arrivalTime = localReturning.arrivalTime;
              localFleet.returnTime = localReturning.arrivalTime;
            }
          } else {
            localUni.fleetsInFlight = (localUni.fleetsInFlight || []).filter((f) => f.id !== fDoc.id);
          }
          if (newlyColonizedPlanet && !localUni.planets.some((p) => p.id === newlyColonizedPlanet.id)) {
            localUni.planets.push(newlyColonizedPlanet);
            window.UniversumUI?.refreshPlanetSelector?.();
            window.UniversumUI?.toast?.(`Nuova colonia fondata: ${newlyColonizedPlanet.name}!`, 'success');
          }
        }
      } catch (err) {
        console.warn('[MP Transaction] Risoluzione flotta rinviata:', err);
        // Orfana scaduta da oltre 60s: mai lasciarla a 0s, ripulizia forzata
        if (Date.now() - _fleetDueTime(fleetNorm) > 60000) {
          await forceCleanupOnlineFleet(uniRef, fleetNorm, fleetRef, err.message || 'resolve-failed');
        }
      }
    }
  }

  // FIX 0-B: ripara missioni bloccate/scadute (migrazione + risoluzione forzata)
  async function repairStuckMissions(uniId) {
    await migrateOnlineFleets(uniId, { force: true });
    await resolveArrivedOnlineFleets(uniId);
    const db = getDB();
    const uniRef = db.collection('online_universes').doc(uniId);
    const snap = await uniRef.collection('fleets').limit(100).get().catch(() => ({ docs: [] }));
    let repaired = 0;
    const now = Date.now();
    for (const d of snap.docs) {
      const fleet = normalizeOnlineFleet(d.data(), d.id);
      if (fleet.resolved) continue;
      if (fleet.status === 'embargo' || fleet.status === 'occupy') continue;
      if (_fleetDueTime(fleet) <= now) {
        await forceCleanupOnlineFleet(uniRef, fleet, d.ref, 'repair-button');
        repaired++;
      }
    }
    return repaired;
  }

  async function processOnlineOccupations(uniId) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !uniId) return;

    const uniRef = db.collection('online_universes').doc(uniId);
    const snap = await uniRef.collection('planets')
      .where('occupation.occupierUid', '==', user.uid)
      .get()
      .catch(() => ({ docs: [] }));

    if (snap.empty) return;

    const now = Date.now();
    const DAY_MS = 24 * 3600 * 1000;

    for (const pDoc of snap.docs) {
      const pl = pDoc.data();
      const occ = pl.occupation;
      if (!occ) continue;

      const elapsed = now - Number(occ.lastTributeAt || occ.startedAt || now);
      const cycles = Math.floor(elapsed / DAY_MS);
      if (cycles < 1) continue;

      const rate = Math.min(0.5, 0.05 * cycles);
      const tribM = Math.floor((pl.resources?.metal || 0) * rate);
      const tribC = Math.floor((pl.resources?.crystal || 0) * rate);
      const tribD = Math.floor((pl.resources?.deuterium || 0) * rate);

      const originKey = coordsToKey(occ.originCoords);
      const originRef = uniRef.collection('planets').doc(originKey);

      await db.runTransaction(async (tx) => {
        const freshTarget = await tx.get(pDoc.ref);
        const freshOrigin = await tx.get(originRef);
        if (!freshTarget.exists || !freshOrigin.exists) return;

        const tData = freshTarget.data();
        const oData = freshOrigin.data();
        if (!tData.occupation || tData.occupation.occupierUid !== user.uid) return;

        tx.update(pDoc.ref, {
          'resources.metal': Math.max(0, (tData.resources?.metal || 0) - tribM),
          'resources.crystal': Math.max(0, (tData.resources?.crystal || 0) - tribC),
          'resources.deuterium': Math.max(0, (tData.resources?.deuterium || 0) - tribD),
          'occupation.lastTributeAt': Number(occ.lastTributeAt || occ.startedAt) + cycles * DAY_MS,
          'occupation.prelievoAccumulato': {
            metal: Number(tData.occupation.prelievoAccumulato?.metal || 0) + tribM,
            crystal: Number(tData.occupation.prelievoAccumulato?.crystal || 0) + tribC,
            deuterium: Number(tData.occupation.prelievoAccumulato?.deuterium || 0) + tribD
          }
        });

        tx.update(originRef, {
          'resources.metal': (oData.resources?.metal || 0) + tribM,
          'resources.crystal': (oData.resources?.crystal || 0) + tribC,
          'resources.deuterium': (oData.resources?.deuterium || 0) + tribD
        });
      }).catch(() => {});
    }
  }

  // Porta la flotta assediante a IN RITORNO (niente accrediti/teletrasporti istantanei)
  async function _transitionSiegeFleetToReturning(uniRef, targetKey, { pendingRansom = null } = {}) {
    const db = getDB();
    const snap = await uniRef.collection('fleets').where('targetKey', '==', targetKey).get().catch(() => ({ docs: [] }));
    const now = Date.now();
    let transitioned = false;
    for (const d of snap.docs) {
      const fleet = normalizeOnlineFleet(d.data(), d.id);
      if (fleet.resolved || (fleet.status !== 'embargo' && fleet.status !== 'occupy')) continue;
      const durationSec = window.UniversumGalaxy?.getFleetSpeedAndFuel
        ? Math.max(5, window.UniversumGalaxy.getFleetSpeedAndFuel({ speed: 10, researches: {} }, fleet.ships, window.UniversumGalaxy.calculateDistance(fleet.targetCoords, fleet.originCoords)).durationSec || 60)
        : 60;
      await d.ref.update({
        status: 'returning',
        phase: 'IN RITORNO',
        resolved: false,
        arrivalTime: now + durationSec * 1000,
        returnTime: now + durationSec * 1000,
        ...(pendingRansom ? { pendingRansom } : {})
      }).catch(() => {});
      transitioned = true;
    }
    return transitioned;
  }

  async function payOnlineSiegeRansom(uniId, targetCoords) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user) throw new Error('Utente non autenticato.');

    const uniRef = db.collection('online_universes').doc(uniId);
    const key = coordsToKey(targetCoords);
    const planetRef = uniRef.collection('planets').doc(key);
    let paidRansom = null;
    let siegeShipsForReturn = null;
    const fleetSnapPre = await uniRef.collection('fleets').where('targetKey', '==', key).get().catch(() => ({ docs: [] }));
    const hasSiegeFleet = fleetSnapPre.docs.some((d) => {
      const ff = normalizeOnlineFleet(d.data(), d.id);
      return !ff.resolved && (ff.status === 'embargo' || ff.status === 'occupy');
    });

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(planetRef);
      if (!snap.exists) throw new Error('Pianeta non trovato.');
      const pl = snap.data();
      if (pl.ownerUid !== user.uid) throw new Error('Non sei il proprietario di questo pianeta.');

      const siege = pl.occupation || pl.embargo;
      const isOcc = Boolean(pl.occupation);
      if (!siege) throw new Error('Nessun embargo o occupazione attiva su questo pianeta.');

      const ransom = siege.ransom || { metal: 0, crystal: 0, deuterium: 0 };
      if (
        (pl.resources?.metal || 0) < ransom.metal ||
        (pl.resources?.crystal || 0) < ransom.crystal ||
        (pl.resources?.deuterium || 0) < ransom.deuterium
      ) {
        throw new Error('Risorse insufficienti sul pianeta per pagare il riscatto.');
      }

      paidRansom = { ...ransom };
      siegeShipsForReturn = siege.garrisonShips || siege.ships || {};

      const attackerOriginKey = coordsToKey(siege.originCoords);
      const attackerOriginRef = uniRef.collection('planets').doc(attackerOriginKey);
      const attackerOriginSnap = await tx.get(attackerOriginRef);

      tx.update(planetRef, {
        'resources.metal': pl.resources.metal - ransom.metal,
        'resources.crystal': pl.resources.crystal - ransom.crystal,
        'resources.deuterium': pl.resources.deuterium - ransom.deuterium,
        embargo: null,
        occupation: null
      });

      // Con flotta assediante tracciata: niente accredito istantaneo, rientra e accredita all'arrivo
      if (!hasSiegeFleet && attackerOriginSnap.exists) {
        const attPl = attackerOriginSnap.data();
        const updatedFleet = Object.assign({}, attPl.fleet || {});
        const returningShips = siege.garrisonShips || siege.ships || {};
        for (const [sId, qty] of Object.entries(returningShips)) {
          updatedFleet[sId] = (updatedFleet[sId] || 0) + qty;
        }
        tx.update(attackerOriginRef, {
          'resources.metal': (attPl.resources?.metal || 0) + ransom.metal,
          'resources.crystal': (attPl.resources?.crystal || 0) + ransom.crystal,
          'resources.deuterium': (attPl.resources?.deuterium || 0) + ransom.deuterium,
          fleet: updatedFleet
        });
      }

      const attackerUid = isOcc ? siege.occupierUid : siege.attackerUid;
      if (attackerUid) {
        const msgRef = uniRef.collection('messages').doc();
        tx.set(msgRef, {
          recipientUid: attackerUid,
          title: `Riscatto Pagato [${key}]`,
          body: `${pl.ownerName} ha pagato ${ransom.metal} M, ${ransom.crystal} C, ${ransom.deuterium} D. Le tue navi stanno rientrando.`,
          timestamp: Date.now()
        });
      }
    });

    if (paidRansom) {
      await _transitionSiegeFleetToReturning(uniRef, key, { pendingRansom: paidRansom });
    }
  }

  async function liftOnlineSiege(uniId, targetCoords) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user) throw new Error('Utente non autenticato.');

    const uniRef = db.collection('online_universes').doc(uniId);
    const key = coordsToKey(targetCoords);
    const planetRef = uniRef.collection('planets').doc(key);
    const fleetSnapPre = await uniRef.collection('fleets').where('targetKey', '==', key).get().catch(() => ({ docs: [] }));
    const hasSiegeFleet = fleetSnapPre.docs.some((d) => {
      const ff = normalizeOnlineFleet(d.data(), d.id);
      return !ff.resolved && (ff.status === 'embargo' || ff.status === 'occupy');
    });

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(planetRef);
      if (!snap.exists) throw new Error('Pianeta non trovato.');
      const pl = snap.data();

      const isMyEmbargo = pl.embargo && pl.embargo.attackerUid === user.uid;
      const isMyOccupation = pl.occupation && pl.occupation.occupierUid === user.uid;
      if (!isMyEmbargo && !isMyOccupation) {
        throw new Error('Non hai assedi attivi su questo pianeta.');
      }

      const siege = isMyOccupation ? pl.occupation : pl.embargo;
      const originRef = uniRef.collection('planets').doc(coordsToKey(siege.originCoords));
      const originSnap = await tx.get(originRef);

      tx.update(planetRef, {
        embargo: isMyEmbargo ? null : pl.embargo,
        occupation: isMyOccupation ? null : pl.occupation
      });

      // Con flotta tracciata: passa a IN RITORNO, accredito solo all'arrivo
      if (!hasSiegeFleet && originSnap.exists) {
        const oPl = originSnap.data();
        const updatedFleet = Object.assign({}, oPl.fleet || {});
        const returningShips = siege.garrisonShips || siege.ships || {};
        for (const [sId, qty] of Object.entries(returningShips)) {
          updatedFleet[sId] = (updatedFleet[sId] || 0) + qty;
        }
        tx.update(originRef, { fleet: updatedFleet });
      }
    });

    await _transitionSiegeFleetToReturning(uniRef, key);
  }

  // FIX 1: Pagina Rapporti persistente su Firestore (messages per utente)
  async function getReports(uniId) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !uniId) return [];
    const snap = await db.collection('online_universes').doc(uniId).collection('messages')
      .where('recipientUid', '==', user.uid)
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get()
      .catch(() => ({ docs: [] }));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async function deleteReport(uniId, reportId) {
    const db = getDB();
    await db.collection('online_universes').doc(uniId).collection('messages').doc(reportId).delete();
  }

  async function deleteAllReports(uniId) {
    const reports = await getReports(uniId);
    const db = getDB();
    const batch = db.batch();
    reports.forEach((r) => batch.delete(db.collection('online_universes').doc(uniId).collection('messages').doc(r.id)));
    await batch.commit();
    return reports.length;
  }

  async function getLeaderboard(uniId) {
    const cached = _cacheGet(_leaderboardCache, uniId, LEADERBOARD_CACHE_TTL_MS);
    if (cached) return [...cached];
    const db = getDB();
    const snap = await db.collection('online_universes').doc(uniId).collection('players')
      .orderBy('points', 'desc')
      .limit(50)
      .get();

    const data = snap.docs.map((d) => d.data());
    _leaderboardCache.set(uniId, { at: Date.now(), data });
    return [...data];
  }

  async function sendChatMessage(uniId, text) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user) throw new Error('Devi accedere per inviare messaggi.');

    const cleanText = String(text || '').trim().slice(0, 240);
    if (!cleanText) return;

    const nickname = user.displayName || user.email.split('@')[0];
    await db.collection('online_universes').doc(uniId).collection('chat').add({
      uid: user.uid,
      nickname,
      text: cleanText,
      timestamp: Date.now()
    });
  }

  function listenChat(uniId, callback) {
    const db = getDB();
    return db.collection('online_universes').doc(uniId).collection('chat')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .onSnapshot((snap) => {
        const messages = snap.docs
          .map((d) => Object.assign({ id: d.id }, d.data()))
          .reverse();
        callback(messages);
      }, (err) => {
        console.warn('[MP Chat] Errore listener chat galattica:', err);
      });
  }

  function _getPrivateChatId(uid1, uid2) {
    return [String(uid1), String(uid2)].sort().join('_');
  }

  async function getUniversePlayers(uniId) {
    const auth = getAuth();
    const myUid = auth.currentUser?.uid;
    if (!myUid) return [];

    const cached = _cacheGet(_playersCache, uniId, LEADERBOARD_CACHE_TTL_MS);
    if (cached) return cached.filter((p) => p.uid !== myUid).map((p) => ({ ...p }));

    const db = getDB();
    const snap = await db.collection('online_universes').doc(uniId).collection('players')
      .orderBy('nickname', 'asc')
      .get();

    const data = snap.docs
      .map((d) => d.data())
      .filter((p) => p.uid)
      .map((p) => ({
        uid: p.uid,
        nickname: p.nickname || 'Comandante'
      }));
    _playersCache.set(uniId, { at: Date.now(), data });
    return data.filter((p) => p.uid !== myUid).map((p) => ({ ...p }));
  }

  async function sendPrivateMessage(uniId, targetUid, targetName, text) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user) throw new Error('Devi accedere per inviare messaggi privati.');

    const cleanText = String(text || '').trim().slice(0, 300);
    if (!cleanText) throw new Error('Il messaggio non può essere vuoto.');
    if (!targetUid || targetUid === user.uid) throw new Error('Destinatario non valido.');

    const myUid = user.uid;
    const myName = user.displayName || user.email.split('@')[0];
    const safeTargetName = sanitizeNickname(targetName) || 'Comandante';
    const chatId = this._getPrivateChatId(myUid, targetUid);
    const now = Date.now();

    const chatDocRef = db.collection('online_universes').doc(uniId)
      .collection('private_chats').doc(chatId);
    const messagesColRef = chatDocRef.collection('messages');

    await messagesColRef.add({
      senderUid: myUid,
      senderName: myName,
      text: cleanText,
      timestamp: now
    });

    await chatDocRef.set({
      participants: [myUid, targetUid],
      participantNames: {
        [myUid]: myName,
        [targetUid]: safeTargetName
      },
      lastMessage: cleanText,
      lastTimestamp: now,
      unreadFor: targetUid
    }, { merge: true });

    // Nessuna pulizia qui: i messaggi oltre i 15 vengono rimossi solo al login (cleanupPrivateMessagesOnce)
  }

  function listenPrivateConversations(uniId, callback) {
    const auth = getAuth();
    const db = getDB();
    const myUid = auth.currentUser?.uid;
    if (!myUid) return () => {};

    return db.collection('online_universes').doc(uniId).collection('private_chats')
      .where('participants', 'array-contains', myUid)
      .orderBy('lastTimestamp', 'desc')
      .onSnapshot((snap) => {
        let unreadCount = 0;
        const conversations = snap.docs.map((doc) => {
          const data = doc.data();
          if (data.unreadFor === myUid) unreadCount++;
          const otherUid = (data.participants || []).find((id) => id !== myUid) || '';
          const otherName = (data.participantNames && data.participantNames[otherUid]) || 'Comandante';
          return {
            chatId: doc.id,
            otherUid,
            otherName,
            lastMessage: data.lastMessage || '',
            lastTimestamp: data.lastTimestamp || 0,
            isUnread: data.unreadFor === myUid
          };
        });
        callback(conversations, unreadCount);
      }, (err) => {
        console.warn('[MP Private] Errore listener conversazioni private:', err);
      });
  }

  function listenPrivateMessages(uniId, otherUid, callback) {
    const auth = getAuth();
    const db = getDB();
    const myUid = auth.currentUser?.uid;
    if (!myUid || !otherUid) return () => {};

    const chatId = this._getPrivateChatId(myUid, otherUid);
    const chatDocRef = db.collection('online_universes').doc(uniId)
      .collection('private_chats').doc(chatId);

    return chatDocRef.collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(15)
      .onSnapshot(async (snap) => {
        chatDocRef.get().then((roomSnap) => {
          if (roomSnap.exists && roomSnap.data().unreadFor === myUid) {
            chatDocRef.update({ unreadFor: null }).catch(() => {});
          }
        }).catch(() => {});

        const messages = snap.docs
          .map((d) => Object.assign({ id: d.id }, d.data()))
          .reverse();
        callback(messages);
      }, (err) => {
        console.warn('[MP Private] Errore listener messaggi privati:', err);
      });
  }

  async function _deleteCollectionDocs(colRef) {
    let snap = await colRef.limit(400).get();
    while (!snap.empty) {
      const batch = getDB().batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      snap = await colRef.limit(400).get();
    }
  }

  async function leaveOnlineUniverse(uniId) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !uniId) throw new Error('Utente non autenticato.');

    const uniRef = db.collection('online_universes').doc(uniId);
    const playerRef = uniRef.collection('players').doc(user.uid);
    const playerSnap = await playerRef.get();
    if (!playerSnap.exists) {
      await releaseServerSlot(db, user.uid, uniId);
      return;
    }

    const planetsSnap = await uniRef.collection('planets').where('ownerUid', '==', user.uid).get();
    const fleetsSnap = await uniRef.collection('fleets').where('attackerUid', '==', user.uid).get().catch(() => ({ docs: [] }));

    const batch = db.batch();
    planetsSnap.docs.forEach((d) => batch.delete(d.ref));
    fleetsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(playerRef);
    await batch.commit();

    await uniRef.update({ playerCount: firebase.firestore.FieldValue.increment(-1) }).catch(() => {});
    await releaseServerSlot(db, user.uid, uniId);
  }

  async function deleteOnlineUniverse(uniId) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !uniId) throw new Error('Utente non autenticato.');

    const uniRef = db.collection('online_universes').doc(uniId);
    const uniSnap = await uniRef.get();
    if (!uniSnap.exists) throw new Error('Server non trovato.');
    const uniData = uniSnap.data() || {};
    const founderUid = uniData.founderUid || uniData.ownerUid;
    if (founderUid !== user.uid) {
      throw new Error("Solo l'utente che ha creato il server puo' eliminarlo.");
    }

    const playersSnap = await uniRef.collection('players').get();
    const playerUids = playersSnap.docs.map((d) => d.data()?.uid || d.id);

    // Avvisa tutti i giocatori prima di eliminare i dati
    for (const uid of playerUids) {
      await uniRef.collection('messages').add({
        recipientUid: uid,
        title: 'Eliminazione Server',
        body: 'Il server sta per essere eliminato dal creatore.',
        timestamp: Date.now()
      }).catch(() => {});
    }

    // Libera lo slot per creatore e per tutti i giocatori del server
    for (const uid of playerUids) {
      if (uid) await releaseServerSlot(db, uid, uniId);
    }
    await releaseServerSlot(db, user.uid, uniId);

    // Elimina tutti i dati del solo server indicato (altri server intatti)
    const privateChatsSnap = await uniRef.collection('private_chats').get().catch(() => ({ docs: [] }));
    for (const chatDoc of privateChatsSnap.docs) {
      await _deleteCollectionDocs(chatDoc.ref.collection('messages'));
    }
    await _deleteCollectionDocs(uniRef.collection('private_chats'));
    await _deleteCollectionDocs(uniRef.collection('players'));
    await _deleteCollectionDocs(uniRef.collection('planets'));
    await _deleteCollectionDocs(uniRef.collection('fleets'));
    await _deleteCollectionDocs(uniRef.collection('messages'));
    await _deleteCollectionDocs(uniRef.collection('chat'));
    await uniRef.delete();

    _invalidateUniCaches(uniId);
    _syncLastByUni.delete(uniId);
  }

  function listenUniverseDeleted(uniId, callback) {
    const db = getDB();
    return db.collection('online_universes').doc(uniId)
      .onSnapshot((snap) => {
        if (!snap.exists) callback();
      }, () => {});
  }

  window.UniversumMP = {
    registerOrLogin,
    getOnlineUniverses,
    getMyServerMembership,
    createOnlineUniverse,
    joinOnlineUniverse,
    leaveOnlineUniverse,
    deleteOnlineUniverse,
    listenUniverseDeleted,
    calculateLiveResources,
    syncPlayerState,
    renameOnlinePlanet,
    renameOnlineMoon,
    getOnlineSystem,
    launchOnlineFleet,
    recallOnlineFleet,
    listenIncomingFleets,
    resolveArrivedOnlineFleets,
    migrateOnlineFleets,
    repairStuckMissions,
    getReports,
    deleteReport,
    deleteAllReports,
    processOnlineOccupations,
    payOnlineSiegeRansom,
    liftOnlineSiege,
    getLeaderboard,
    sendChatMessage,
    listenChat,
    _getPrivateChatId,
    getUniversePlayers,
    sendPrivateMessage,
    listenPrivateConversations,
    listenPrivateMessages
  };
})();
