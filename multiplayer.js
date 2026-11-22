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
        expeditionTech: Number(f.attackerTech?.expeditionTech || 0),
        espionageTech: Number(f.attackerTech?.espionageTech || 0)
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
      const uid = getAuth().currentUser?.uid;
      if (!uid || (raw.attackerUid !== uid && raw.defenderUid !== uid)) continue;
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

    return { minTemp: maxTemp - 40, maxTemp, fieldsMax };
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
        botConfig: d.botConfig || null,
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
    const botConfig = config.botConfig ? normalizeBotConfig(config.botConfig) : null;
    const passcode = String(config.passcode || '').trim().slice(0, 20);
    const founderName = user.displayName || user.email.split('@')[0];

    const uniRef = db.collection('online_universes').doc();
    const uniId = uniRef.id;

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
      ...(botConfig ? { botConfig } : {}),
      passcode,
      creativeMode: false,
      playerCount: 0,
      createdAt: Date.now()
    });

    if (npcMode === 'limited' && !botConfig) {
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

    if (playerSnap.exists) {
      await claimServerSlot(db, user.uid, universeId, { alreadyMember: true }).catch(() => {});
    }
    _invalidateUniCaches(universeId);
    await migrateOnlineFleets(universeId).catch(() => {});
    await cleanupPrivateMessagesOnce(db, universeId, user.uid);

    // I bot configurabili vengono distribuiti vicino alla prima colonia.
    if (uniData.botConfig?.density > 0 && myPlanets[0]) {
      await ensureBotsAroundHome(universeId, myPlanets[0].coords,
        normalizeBotConfig(uniData.botConfig), uniData)
        .catch((e) => console.warn('[MP Bot] Generazione bot fallita:', e));
    }

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
      botConfig: uniData.botConfig || null,
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

  const _INBOX_RES_KEYS = ['metal', 'crystal', 'deuterium'];

  function _applyUnitDelta(base, delta) {
    const out = Object.assign({}, base || {});
    for (const [id, d] of Object.entries(delta || {})) {
      const n = Number(d || 0);
      if (!n) continue;
      out[id] = Math.max(0, Math.floor(Number(out[id] || 0) + n));
    }
    return out;
  }

  function _hasInbox(data) {
    const ib = data && data.inbox;
    if (!ib || typeof ib !== 'object') return false;
    for (const part of ['resources', 'fleet', 'defenses']) {
      const m = ib[part];
      if (m && Object.values(m).some((v) => Number(v) !== 0)) return true;
    }
    return false;
  }

  function _effectivePlanetView(planetDoc, speed = 10) {
    const live = planetDoc?.isNpc && planetDoc.growthEnabled === false
      ? Object.assign({}, planetDoc) : calculateLiveResources(planetDoc, speed);
    if (!live) return live;
    const inbox = (planetDoc && planetDoc.inbox) || {};
    const res = Object.assign({ metal: 0, crystal: 0, deuterium: 0 }, live.resources);
    for (const k of _INBOX_RES_KEYS) {
      res[k] = Math.max(0, Math.floor(Number(res[k] || 0) + Number(inbox.resources?.[k] || 0)));
    }
    live.resources = res;
    live.fleet = _applyUnitDelta(planetDoc.fleet, inbox.fleet);
    live.defenses = _applyUnitDelta(planetDoc.defenses, inbox.defenses);
    delete live.inbox;
    return live;
  }

  function _snapshotForDiff(p) {
    if (!p) return null;
    return JSON.parse(JSON.stringify({
      resources: p.resources || {},
      fleet: p.fleet || {},
      defenses: p.defenses || {},
      debris: p.debris ?? null,
      embargo: p.embargo ?? null,
      occupation: p.occupation ?? null,
      moon: p.moon ?? null,
      ownerUid: p.ownerUid ?? null,
      ownerName: p.ownerName ?? null,
      isNpc: Boolean(p.isNpc)
    }));
  }

  function _writePlanetResult(tx, ref, before, after, resolutionFleetId = null) {
    if (!before || !after) return;
    const FV = firebase.firestore.FieldValue;
    const upd = {};
    const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

    for (const f of ['debris', 'embargo', 'occupation', 'moon']) {
      if (!same(before[f], after[f])) upd[f] = after[f] ?? null;
    }

    const ownerChanged = (before.ownerUid || null) !== (after.ownerUid || null);
    const floorMap = (m) => {
      const o = {};
      for (const [k, v] of Object.entries(m || {})) o[k] = Math.max(0, Math.floor(Number(v) || 0));
      return o;
    };

    if (ownerChanged) {
      if (resolutionFleetId) upd.lastResolutionFleetId = resolutionFleetId;
      upd.ownerUid = after.ownerUid ?? null;
      upd.ownerName = after.ownerName ?? null;
      upd.isNpc = Boolean(after.isNpc);
      upd.resources = floorMap(after.resources);
      upd.fleet = floorMap(after.fleet);
      upd.defenses = floorMap(after.defenses);
      upd.buildQueue = [];
      upd.shipyardQueue = [];
      upd.defenseQueue = [];
      upd.lastUpdated = Date.now();
      upd.inbox = FV.delete();
    } else if (after.isNpc) {
      upd.resources = floorMap(after.resources);
      upd.fleet = floorMap(after.fleet);
      upd.defenses = floorMap(after.defenses);
      upd.lastUpdated = Date.now();
      upd.inbox = FV.delete();
    } else {
      for (const k of _INBOX_RES_KEYS) {
        const d = Math.round(Number(after.resources?.[k] || 0) - Number(before.resources?.[k] || 0));
        if (d) upd[`inbox.resources.${k}`] = FV.increment(d);
      }
      for (const part of ['fleet', 'defenses']) {
        const ids = new Set([...Object.keys(before[part] || {}), ...Object.keys(after[part] || {})]);
        for (const id of ids) {
          const d = Math.round(Number(after[part]?.[id] || 0) - Number(before[part]?.[id] || 0));
          if (d) upd[`inbox.${part}.${id}`] = FV.increment(d);
        }
      }
    }
    if (Object.keys(upd).length > 0) tx.update(ref, upd);
  }

  function _inboxCredit(tx, ref, { resources = {}, fleet = {}, defenses = {} } = {}) {
    if (!ref) return;
    const FV = firebase.firestore.FieldValue;
    const upd = {};
    for (const k of _INBOX_RES_KEYS) {
      const v = Math.round(Number(resources[k] || 0));
      if (v) upd[`inbox.resources.${k}`] = FV.increment(v);
    }
    for (const [id, q] of Object.entries(fleet || {})) {
      const v = Math.floor(Number(q || 0));
      if (v) upd[`inbox.fleet.${id}`] = FV.increment(v);
    }
    for (const [id, q] of Object.entries(defenses || {})) {
      const v = Math.floor(Number(q || 0));
      if (v) upd[`inbox.defenses.${id}`] = FV.increment(v);
    }
    if (Object.keys(upd).length > 0) tx.update(ref, upd);
  }

  async function _resolveCreditRef(uniRef, uid, originCoords) {
    const col = uniRef.collection('planets');
    try {
      if (originCoords) {
        const ref = col.doc(coordsToKey(originCoords));
        const s = await ref.get();
        if (s && s.exists && s.data().ownerUid === uid) return ref;
      }
      const q = await col.where('ownerUid', '==', uid).limit(1).get();
      return q && q.docs && q.docs.length > 0 ? q.docs[0].ref : null;
    } catch (e) {
      console.warn('[MP] Pianeta di accredito non trovato:', e);
      return null;
    }
  }

  async function syncPlayerState(universeObj, { force = false } = {}) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !universeObj?.id) return;

    const lastSync = _syncLastByUni.get(universeObj.id) || 0;
    if (!force && Date.now() - lastSync < SYNC_MIN_INTERVAL_MS) return;
    _syncLastByUni.set(universeObj.id, Date.now());

    const FV = firebase.firestore.FieldValue;
    const uniRef = db.collection('online_universes').doc(universeObj.id);
    const planetsCol = uniRef.collection('planets');
    const playerRef = uniRef.collection('players').doc(user.uid);
    const planets = (universeObj.planets || []).slice();

    let reconciled = [];
    let lost = [];
    let moonUpdates = [];

    await db.runTransaction(async (tx) => {
      reconciled = [];
      lost = [];
      moonUpdates = [];
      const entries = planets.map((p) => ({ p, ref: planetsCol.doc(coordsToKey(p.coords)) }));
      const snaps = await Promise.all(entries.map((e) => tx.get(e.ref)));
      const nowTs = Date.now();

      entries.forEach((e, i) => {
        const snap = snaps[i];
        const p = e.p;
        if (!snap.exists) return;
        const data = snap.data();
        if (data.ownerUid !== user.uid) {
          lost.push(p);
          return;
        }

        const inbox = data.inbox || {};
        const res = Object.assign({}, p.resources);
        for (const k of _INBOX_RES_KEYS) {
          res[k] = Math.max(0, Math.floor(Number(p.resources?.[k] || 0) + Number(inbox.resources?.[k] || 0)));
        }
        const payload = {
          name: p.name,
          planetName: p.name,
          resources: res,
          buildings: p.buildings,
          defenses: _applyUnitDelta(p.defenses, inbox.defenses),
          fleet: _applyUnitDelta(p.fleet, inbox.fleet),
          buildQueue: p.buildQueue || [],
          shipyardQueue: p.shipyardQueue || [],
          defenseQueue: p.defenseQueue || [],
          lastUpdated: nowTs
        };
        if (data.inbox !== undefined) payload.inbox = FV.delete();
        // Parità con l'offline: costruzioni/upgrade lunari devono essere salvati.
        // Una Luna nuova non può nascere qui: la crea solo la transazione del Mercante.
        if (data.moon && p.moon) payload.moon = p.moon;
        tx.set(e.ref, payload, { merge: true });
        // La Luna è gestita nel documento condiviso: recepisci modifiche
        // create da un altro client, non solo i delta della inbox.
        if (Boolean(p.moon) !== Boolean(data.moon)) {
          moonUpdates.push({ planet: p, moon: data.moon || null });
        }
        if (_hasInbox(data)) reconciled.push({ planet: p, inbox });
      });

      tx.set(playerRef, {
        nickname: universeObj.emperor || user.displayName || 'Comandante',
        researches: universeObj.researches || {},
        researchQueue: universeObj.researchQueue || null,
        points: computePlayerPoints(universeObj),
        planetCount: planets.length - lost.length,
        lastSeen: nowTs
      }, { merge: true });
    });

    for (const { planet, inbox } of reconciled) {
      planet.resources = Object.assign({ metal: 0, crystal: 0, deuterium: 0 }, planet.resources);
      for (const k of _INBOX_RES_KEYS) {
        const d = Number(inbox.resources?.[k] || 0);
        if (d) planet.resources[k] = Math.max(0, Math.floor(Number(planet.resources[k] || 0) + d));
      }
      planet.fleet = _applyUnitDelta(planet.fleet, inbox.fleet);
      planet.defenses = _applyUnitDelta(planet.defenses, inbox.defenses);
    }
    for (const { planet, moon } of moonUpdates) {
      planet.moon = moon;
      if (moon && planet.coords) {
        const k = coordsToKey(planet.coords);
        universeObj.galaxyDeltas = universeObj.galaxyDeltas || {};
        universeObj.galaxyDeltas[k] = { ...(universeObj.galaxyDeltas[k] || {}), hasMoon: true, hasBacino: false, moonName: moon.name || 'Luna' };
      }
    }
    if (lost.length > 0) {
      universeObj.planets = (universeObj.planets || []).filter((p) => !lost.includes(p));
    }
    if (reconciled.length > 0 || lost.length > 0 || moonUpdates.length > 0) {
      try {
        window.UniversumUI?.onOnlineReconciled?.({ reconciled, lost });
      } catch (e) {
        console.warn('[MP] Aggiornamento UI dopo riallineamento non riuscito:', e);
      }
    }
  }

  function listenOwnPlanets(universeObj, onChange) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !universeObj?.id) return () => {};

    return db.collection('online_universes').doc(universeObj.id).collection('planets')
      .where('ownerUid', '==', user.uid)
      .onSnapshot((snap) => {
        const gained = [];
        let needSync = false;
        for (const ch of snap.docChanges()) {
          if (ch.type === 'removed') {
            needSync = true;
            continue;
          }
          const data = ch.doc.data();
          const known = (universeObj.planets || []).some((p) => p.coords && coordsToKey(p.coords) === ch.doc.id);
          if (!known) {
            const np = calculateLiveResources(data, universeObj.speed || 10);
            if (!np.id) np.id = ch.doc.id;
            universeObj.planets = universeObj.planets || [];
            universeObj.planets.push(np);
            gained.push(np);
            continue;
          }
          const local = (universeObj.planets || []).find(p => p.coords && coordsToKey(p.coords) === ch.doc.id);
          if (_hasInbox(data) || (local && JSON.stringify(local.moon || null) !== JSON.stringify(data.moon || null))) needSync = true;
        }
        if (gained.length > 0 || needSync) onChange({ gained, needSync });
      }, (err) => _mpNotifyError('listener pianeti', err));
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
      const liveData = _effectivePlanetView(doc.data(), speed);
      occupiedByPos.set(Number(liveData.coords.p), liveData);
    });

    const slots = [];
    for (let pos = 1; pos <= 15; pos++) {
      if (occupiedByPos.has(pos)) {
        const pl = occupiedByPos.get(pos);
        slots.push(Object.assign({}, pl, {
          planetId: pl.id,
          ownerType: pl.isNpc ? 'outpost' : 'player',
          botLevel: pl.botLevel || 1,
          botPersonality: pl.botPersonality || 'Commerciante'
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
        expeditionTech: universeObj.researches?.expeditionTech || 0,
        espionageTech: universeObj.researches?.espionageTech || 0
      },
      defenderUid,
      originCoords: Object.assign({}, planet.coords),
      originKey,
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

  const _mpErrorToastAt = new Map();
  function _mpNotifyError(context, err) {
    console.warn(`[MP] Errore (${context}):`, err);
    const code = String(err?.code || '');
    let msg = null;
    if (code === 'permission-denied') {
      msg = "Il server ha rifiutato un'operazione (permessi insufficienti).";
    } else if (code === 'unavailable' || code === 'deadline-exceeded') {
      msg = 'Connessione al server instabile: alcune operazioni verranno riprovate.';
    }
    if (!msg) return;
    const last = _mpErrorToastAt.get(code) || 0;
    if (Date.now() - last < 30000) return;
    _mpErrorToastAt.set(code, Date.now());
    window.UniversumUI?.toast?.(msg, 'error');
  }

  function listenOwnFleets(universeObj, callback) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !universeObj?.id) return () => {};

    return db.collection('online_universes').doc(universeObj.id).collection('fleets')
      .where('attackerUid', '==', user.uid)
      .where('status', 'in', ['outbound', 'returning', 'embargo', 'occupy'])
      .onSnapshot((snap) => {
        const list = snap.docs
          .map((d) => normalizeOnlineFleet(d.data(), d.id))
          .filter((f) => !f.resolved);
        callback(list);
      }, (err) => _mpNotifyError('listener flotte proprie', err));
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

  const _ONLINE_SUPPORTED_MISSIONS = new Set([
    'attack', 'destroyMoon', 'spy', 'transport', 'deploy', 'colonize', 'recycle',
    'expedition', 'explore', 'embargo', 'blockade', 'occupy', 'recall'
  ]);

  function _cleanupReasonText(fleet, reason) {
    const r = String(reason || '');
    let why;
    if (r === 'repair-button') {
      why = 'Riparazione manuale richiesta dal comandante.';
    } else if (r === 'missing-route') {
      why = 'Dati di rotta mancanti o non validi.';
    } else if (fleet && fleet.mission && !_ONLINE_SUPPORTED_MISSIONS.has(fleet.mission)) {
      why = `La missione "${fleet.mission}" non è supportata in modalità online.`;
    } else {
      why = 'Errore temporaneo durante la risoluzione (missione ferma da oltre 60 secondi).';
    }
    return `${why} Missione annullata: flotta e carico restituiti al pianeta di partenza.`;
  }

  async function forceCleanupOnlineFleet(uniRef, fleet, fleetRef, reason) {
    const db = getDB();
    const now = Date.now();
    const creditRef = await _resolveCreditRef(uniRef, fleet.attackerUid, fleet.originCoords);
    try {
      await db.runTransaction(async (tx) => {
        const freshSnap = await tx.get(fleetRef);
        if (!freshSnap.exists || freshSnap.data().resolved) return;
        _inboxCredit(tx, creditRef, { resources: fleet.cargo || {}, fleet: fleet.ships || {} });
        tx.update(fleetRef, {
          status: 'completed', phase: 'COMPLETATA', resolved: true,
          completedAt: now, repaired: true, repairReason: String(reason || 'orphan')
        });
        if (fleet.attackerUid) {
          const msgRef = uniRef.collection('messages').doc();
          tx.set(msgRef, {
            recipientUid: fleet.attackerUid,
            title: `Missione riparata [${fleet.targetKey || 'sconosciuta'}]`,
            body: _cleanupReasonText(fleet, reason),
            timestamp: now
          });
        }
      });
      return true;
    } catch (e) {
      await fleetRef.update({ status: 'completed', phase: 'COMPLETATA', resolved: true, completedAt: now, repaired: true }).catch((e) => _mpNotifyError('chiusura forzata flotta', e));
      return false;
    }
  }

  // P1 FIX: accetta parametro opzionale `speed` per evitare letture extra quando già disponibile
  async function processEmbargoFleets(uniRef, fleetDocs, now, speed = null) {
    const Data = window.UniversumData;
    // P1 FIX: se non passata, leggi la velocità reale una volta sola
    let realSpeed = speed;
    if (!realSpeed) {
      const uniSnap = await uniRef.get().catch(() => null);
      realSpeed = uniSnap && uniSnap.exists ? (uniSnap.data().speed || 10) : 10;
    }
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
          await targetRef.update({ 'embargo.deuterium': remaining }).catch((e) => _mpNotifyError('tick deuterio embargo', e));
        } else {
          // P1 FIX: usa la velocità reale dell'universo (era hardcoded 10)
          const durationSec = window.UniversumGalaxy?.getFleetSpeedAndFuel
            ? Math.max(5, window.UniversumGalaxy.getFleetSpeedAndFuel({ speed: realSpeed, researches: {} }, fleet.ships, window.UniversumGalaxy.calculateDistance(fleet.targetCoords, fleet.originCoords)).durationSec || 60)
            : 60;
          await targetRef.update({ embargo: null }).catch((e) => _mpNotifyError('fine embargo', e));
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
    await sweepOccupationsThrottled(uniId).catch(() => {});

    const allSnap = await uniRef.collection('fleets').where('arrivalTime', '<=', now).limit(100).get().catch(() => ({ docs: [] }));
    if (!allSnap.docs || allSnap.docs.length === 0) return;
    // Solo l'attaccante o il difensore puo' risolvere una flotta: una sessione
    // estranea non deve tentare di scrivere sui documenti altrui.
    const resolverUid = getAuth().currentUser?.uid;
    const authorizedDocs = allSnap.docs.filter((d) => {
      const f = d.data();
      return resolverUid && (f.attackerUid === resolverUid || f.defenderUid === resolverUid);
    });
    if (!authorizedDocs.length) return;

    const uniSnap = await uniRef.get();
    const speed = uniSnap.exists ? (uniSnap.data().speed || 10) : 10;

    // P1 FIX: passa la velocità reale a processEmbargoFleets
    await processEmbargoFleets(uniRef, authorizedDocs, now, speed);

    const arrivedDocs = authorizedDocs
      .map((d) => ({ doc: d, fleet: normalizeOnlineFleet(d.data(), d.id) }))
      .filter(({ fleet }) => !fleet.resolved && (fleet.status === 'outbound' || fleet.status === 'returning') && _fleetDueTime(fleet) <= now)
      .sort((a, b) => _fleetDueTime(a.fleet) - _fleetDueTime(b.fleet))
      .slice(0, 10);
    if (arrivedDocs.length === 0) return;

    const currentUid = window.fbAuth?.currentUser?.uid;

    for (const { doc: fDoc, fleet: fleetNorm } of arrivedDocs) {
      const fleetRef = fDoc.ref;
      if (!fleetNorm.targetKey || !fleetNorm.originCoords) {
        await forceCleanupOnlineFleet(uniRef, fleetNorm, fleetRef, 'missing-route');
        continue;
      }
      const targetPlanetRef = uniRef.collection('planets').doc(fleetNorm.targetKey);
      const originPlanetRef = uniRef.collection('planets').doc(coordsToKey(fleetNorm.originCoords));

      if (fleetNorm.status === 'outbound' && !['attack', 'destroyMoon', 'recall'].includes(fleetNorm.mission)) {
        const preSnap = await targetPlanetRef.get().catch(() => null);
        const preEmbargo = preSnap && preSnap.exists ? preSnap.data().embargo : null;
        if (preEmbargo && preEmbargo.attackerUid && preEmbargo.attackerUid !== fleetNorm.attackerUid) {
          try {
            await db.runTransaction(async (txR) => {
              const fs = await txR.get(fleetRef);
              if (!fs.exists) return;
              const cur = normalizeOnlineFleet(fs.data(), fDoc.id);
              if (cur.resolved || cur.status !== 'outbound') return;
              const t = Date.now();
              const legMs = Math.max(5000, (Number(cur.returnTime || t) - Number(cur.arrivalTime || t)) || 60000);
              txR.update(fleetRef, {
                status: 'returning', phase: 'IN RITORNO', resolved: false,
                arrivalTime: t + legMs, returnTime: t + legMs,
                schemaVersion: FLEET_SCHEMA_VERSION
              });
              txR.set(uniRef.collection('messages').doc(), {
                recipientUid: cur.attackerUid,
                title: `Missione Respinta [${cur.targetKey}]`,
                body: `Il pianeta è sotto embargo di ${preEmbargo.attackerName || 'un altro comandante'}. La tua flotta sta rientrando alla base.`,
                timestamp: t
              });
            });
          } catch (e) {
            console.warn('[MP Embargo] Respingimento flotta rinviato:', e);
          }
          continue;
        }
      }
      let newlyColonizedPlanet = null;
      const creditRef = fleetNorm.status === 'returning'
        ? await _resolveCreditRef(uniRef, fleetNorm.attackerUid, fleetNorm.originCoords)
        : null;
      let localReturning = null;

      try {
        await db.runTransaction(async (tx) => {
          const freshFleetSnap = await tx.get(fleetRef);
          if (!freshFleetSnap.exists || freshFleetSnap.data().resolved) return;
          const fleet = normalizeOnlineFleet(freshFleetSnap.data(), fDoc.id);
          if ((fleet.status !== 'outbound' && fleet.status !== 'returning') || _fleetDueTime(fleet) > Date.now()) return;

          const targetSnap = await tx.get(targetPlanetRef);

          const targetPlanet = targetSnap.exists ? _effectivePlanetView(targetSnap.data(), speed) : null;
          const targetBefore = _snapshotForDiff(targetPlanet);
          const targetWasNpc = Boolean(targetPlanet && targetPlanet.isNpc);

          let reportTitle = `Missione ${fleet.mission.toUpperCase()} [${fleet.targetKey}]`;
          let reportBody = 'Missione completata.';
          let returnShips = Object.assign({}, fleet.ships || {});
          let returnCargo = Object.assign({ metal: 0, crystal: 0, deuterium: 0 }, fleet.cargo || {});
          let completeNow = fleet.status === 'returning';
          let persistentStatus = null;
          let siegeShips = null;
          let defenderBody;
          let defenderTitle;

          if (fleet.status === 'returning' || fleet.mission === 'recall') {
            reportTitle = `Flotta Richiamata Rientrata [${coordsToKey(fleet.originCoords)}]`;
            reportBody = 'Le navi sono rientrate alla base con il carico integro.';
          } else if (fleet.mission === 'spy' && targetPlanet) {
            const Data = window.UniversumData;
            const probes = Math.max(0, Number(fleet.ships?.espionageProbe || 0));
            const myEsp = Number(fleet.attackerTech?.espionageTech || 0);
            let defEsp = 0;
            if (targetPlanet.ownerUid && !targetPlanet.isNpc) {
              const defSpySnap = await tx.get(uniRef.collection('players').doc(targetPlanet.ownerUid));
              if (defSpySnap.exists) defEsp = Number(defSpySnap.data().researches?.espionageTech || 0);
            }
            const defProbes = Number(targetPlanet.fleet?.espionageProbe || 0);
            const spyDiff = (myEsp - defEsp) + Math.floor(Math.sqrt(probes));
            const catchChance = Math.min(0.85, Math.max(0.02, (defProbes / (Math.max(1, probes) * 8)) * 0.25 - spyDiff * 0.03));
            const probesLost = (probes > 0 && Math.random() < catchChance) ? Math.min(probes, Math.ceil(probes * 0.5)) : 0;
            if (probes > 0) returnShips.espionageProbe = Math.max(0, probes - probesLost);

            const nameOf = (id) => (Data?.SHIPS?.[id] || Data?.DEFENSES?.[id])?.name || id;
            const listUnits = (map) => {
              const parts = Object.entries(map || {})
                .filter(([, q]) => Number(q) > 0)
                .map(([id, q]) => `${nameOf(id)} x${Number(q).toLocaleString('it-IT')}`);
              return parts.length > 0 ? parts.join(', ') : 'nessuna';
            };
            const resInfo = `Risorse: ${Math.floor(targetPlanet.resources.metal)} M, ${Math.floor(targetPlanet.resources.crystal)} C, ${Math.floor(targetPlanet.resources.deuterium)} D.`;
            const fleetInfo = spyDiff >= 0 ? ` Flotta: ${listUnits(targetPlanet.fleet)}.` : ' Flotta: non rilevata.';
            const defInfo = spyDiff >= 1 ? ` Difese: ${listUnits(targetPlanet.defenses)}.` : ' Difese: non rilevate.';
            reportTitle = `Rapporto Spionaggio su ${targetPlanet.name} [${fleet.targetKey}]`;
            reportBody = resInfo + fleetInfo + defInfo + ` Sonde perse: ${probesLost}.`;

            if (probesLost > 0) {
              defenderTitle = `Sonde spia intercettate [${fleet.targetKey}]`;
              defenderBody = `Le tue difese hanno distrutto ${probesLost} sonde spia di ${fleet.attackerName}.`;
            } else {
              defenderBody = null;
            }

            const spyShipsLeft = Object.values(returnShips).reduce((a, q) => a + Math.max(0, Number(q) || 0), 0);
            if (spyShipsLeft <= 0) {
              completeNow = true;
              reportBody += ' Tutte le sonde sono andate perdute.';
            }
          } else if (fleet.mission === 'transport' && targetPlanet) {
            targetPlanet.resources.metal += returnCargo.metal;
            targetPlanet.resources.crystal += returnCargo.crystal;
            targetPlanet.resources.deuterium += returnCargo.deuterium;
            returnCargo = { metal: 0, crystal: 0, deuterium: 0 };
            _writePlanetResult(tx, targetPlanetRef, targetBefore, targetPlanet, fDoc.id);
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
            completeNow = true;
            _writePlanetResult(tx, targetPlanetRef, targetBefore, targetPlanet, fDoc.id);
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
              newColony.fleet = {};
              const shipsLeftAfterColony = Object.values(returnShips).reduce((a, q) => a + Math.max(0, Number(q) || 0), 0);
              completeNow = shipsLeftAfterColony <= 0;
              tx.set(targetPlanetRef, newColony);
              newlyColonizedPlanet = newColony;
              reportTitle = `Nuova Colonia Fondata [${fleet.targetCoords.g}:${fleet.targetCoords.s}:${fleet.targetCoords.p}]`;
              reportBody = 'Il pianeta è ora sotto il tuo comando.' + (shipsLeftAfterColony > 0 ? ' Il resto della flotta sta rientrando alla base.' : '');
            } else {
              reportTitle = `Colonizzazione Fallita [${fleet.targetCoords.g}:${fleet.targetCoords.s}:${fleet.targetCoords.p}]`;
              reportBody = 'Lo slot era già occupato. La Colonizzatrice rientra alla base.';
            }
          } else if (fleet.mission === 'recycle' && targetPlanet) {
            const Data = window.UniversumData;
            const debris = targetPlanet.debris || { metal: 0, crystal: 0 };
            let recCap = 0;
            for (const [sId, qty] of Object.entries(returnShips)) {
              recCap += (Data?.SHIPS?.[sId]?.cargo || 0) * Number(qty || 0);
            }
            const alreadyLoaded = (returnCargo.metal || 0) + (returnCargo.crystal || 0) + (returnCargo.deuterium || 0);
            const freeCap = Math.max(0, recCap - alreadyLoaded);
            const takeM = Math.min(debris.metal || 0, Math.floor(freeCap * 0.6));
            const takeC = Math.min(debris.crystal || 0, freeCap - takeM);
            returnCargo.metal += takeM;
            returnCargo.crystal += takeC;
            targetPlanet.debris = {
              metal: Math.max(0, (debris.metal || 0) - takeM),
              crystal: Math.max(0, (debris.crystal || 0) - takeC)
            };
            _writePlanetResult(tx, targetPlanetRef, targetBefore, targetPlanet, fDoc.id);
            reportTitle = `Raccolta Detriti [${fleet.targetKey}]`;
            reportBody = `Riciclati ${takeM} M e ${takeC} C. Detriti rimasti: ${targetPlanet.debris.metal} M, ${targetPlanet.debris.crystal} C.`;
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
            (fleet.mission === 'attack' || fleet.mission === 'destroyMoon' || fleet.mission === 'blockade' || fleet.mission === 'embargo' || fleet.mission === 'occupy') &&
            targetPlanet &&
            window.UniversumGalaxy?.resolveCombat
          ) {
            const defenderUidForTech = fleet.defenderUid || targetPlanet.ownerUid || null;
            let defenderTech = { weaponsTech: 0, shieldingTech: 0, armourTech: 0 };
            let defenderPlanetCount = 0;
            if (defenderUidForTech && !targetPlanet.isNpc) {
              const defenderSnap = await tx.get(uniRef.collection('players').doc(defenderUidForTech));
              if (defenderSnap.exists) {
                const defResearches = defenderSnap.data().researches || {};
                defenderPlanetCount = Number(defenderSnap.data().planetCount || 0);
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

              if (String(fleet.attackerUid || '').startsWith('npc_raid_')) {
                completeNow = true;
                returnShips = {};
                returnCargo = { metal: 0, crystal: 0, deuterium: 0 };
                reportTitle = `Raid BOT ${combat.result === 'attacker_win' ? 'riuscito' : 'respinto'} su ${targetPlanet.name}`;
              } else {
              const unitsLeft = (m) => Object.values(m || {}).reduce((a, q) => a + Math.max(0, Number(q) || 0), 0);
              const noDefendersLeft = unitsLeft(targetPlanet.fleet) === 0 && unitsLeft(targetPlanet.defenses) === 0;
              const hasConquestShip = (returnShips.colonyShip || 0) >= 1 || (returnShips.mothership || 0) >= 1;
              const canConquerOwner = targetWasNpc || defenderPlanetCount > 1;
              if (combat.result === 'attacker_win' && noDefendersLeft && hasConquestShip && targetPlanet.ownerUid !== fleet.attackerUid && !canConquerOwner) {
                reportBody += " Conquista impossibile: è l'ultimo pianeta del giocatore.";
              }
              if (combat.result === 'attacker_win' && noDefendersLeft && hasConquestShip && targetPlanet.ownerUid !== fleet.attackerUid && canConquerOwner) {
                const siegeIds = Array.from(new Set([targetPlanet.embargo?.fleetId, targetPlanet.occupation?.fleetId].filter(Boolean)));
                const siegeSnaps = [];
                for (const sid of siegeIds) siegeSnaps.push(await tx.get(uniRef.collection('fleets').doc(sid)));
                for (const sSnap of siegeSnaps) {
                  if (!sSnap.exists) continue;
                  const sf = normalizeOnlineFleet(sSnap.data(), sSnap.id);
                  if (sf.resolved || (sf.status !== 'embargo' && sf.status !== 'occupy')) continue;
                  // P1 FIX: usa la velocità reale già in scope (era hardcoded 10)
                  const sDurSec = window.UniversumGalaxy?.getFleetSpeedAndFuel
                    ? Math.max(5, window.UniversumGalaxy.getFleetSpeedAndFuel({ speed: speed, researches: {} }, sf.ships, window.UniversumGalaxy.calculateDistance(sf.targetCoords, sf.originCoords)).durationSec || 60)
                    : 60;
                  tx.update(sSnap.ref, {
                    status: 'returning', phase: 'IN RITORNO', resolved: false,
                    arrivalTime: now + sDurSec * 1000, returnTime: now + sDurSec * 1000
                  });
                }
                if ((returnShips.colonyShip || 0) >= 1) returnShips.colonyShip -= 1;
                targetPlanet.ownerUid = fleet.attackerUid;
                targetPlanet.ownerName = fleet.attackerName;
                targetPlanet.isNpc = false;
                targetPlanet.embargo = null;
                targetPlanet.occupation = null;
                targetPlanet.defenses = {};
                targetPlanet.fleet = {};
                reportTitle = `Pianeta Conquistato: ${targetPlanet.name} [${fleet.targetKey}]!`;
                reportBody = `Hai annientato le difese e annesso ${targetPlanet.name} al tuo Impero.`;
              }
              }
            } else if (fleet.mission === 'destroyMoon') {
              const hadMoon = Boolean(targetPlanet.moon);
              const dsCount = Math.max(0, Math.floor(Number(combat.attackerSurvivors?.deathStar || 0)));
              const destroyChance = 1 - Math.pow(0.90, dsCount);
              let moonDestroyed = false;
              if (combat.result === 'attacker_win' && dsCount > 0 && hadMoon && Math.random() < destroyChance) {
                targetPlanet.moon = null;
                moonDestroyed = true;
              }
              targetPlanet.resources.metal = Math.max(0, targetPlanet.resources.metal - combat.loot.metal);
              targetPlanet.resources.crystal = Math.max(0, targetPlanet.resources.crystal - combat.loot.crystal);
              targetPlanet.resources.deuterium = Math.max(0, targetPlanet.resources.deuterium - combat.loot.deuterium);
              returnShips = combat.attackerSurvivors;
              returnCargo.metal += combat.loot.metal;
              returnCargo.crystal += combat.loot.crystal;
              returnCargo.deuterium += combat.loot.deuterium;
              reportTitle = `Distruzione Luna/Bacino [${fleet.targetKey}]`;
              if (moonDestroyed) {
                reportBody = 'La Morte Nera ha polverizzato la Luna nemica con tutti i suoi edifici.';
              } else if (!hadMoon) {
                reportBody = 'Il pianeta non ha alcuna Luna da distruggere.';
              } else if (dsCount === 0) {
                reportBody = 'Nessuna Morte Nera nella flotta: missione fallita.';
              } else {
                reportBody = 'La Luna ha resistito al superlaser.';
              }
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

            _writePlanetResult(tx, targetPlanetRef, targetBefore, targetPlanet, fDoc.id);
          }

          if (completeNow && fleet.status === 'returning' && creditRef) {
            const ransomBack = fleet.pendingRansom || {};
            _inboxCredit(tx, creditRef, {
              resources: {
                metal: (returnCargo.metal || 0) + (ransomBack.metal || 0),
                crystal: (returnCargo.crystal || 0) + (ransomBack.crystal || 0),
                deuterium: (returnCargo.deuterium || 0) + (ransomBack.deuterium || 0)
              },
              fleet: returnShips
            });
          }

          if (persistentStatus) {
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

          if (fleet.status === 'outbound' && fleet.defenderUid && fleet.defenderUid !== fleet.attackerUid && !targetWasNpc && (fleet.mission !== 'spy' || defenderBody)) {
            const msgDefRef = uniRef.collection('messages').doc();
            tx.set(msgDefRef, {
              recipientUid: fleet.defenderUid,
              title: defenderTitle || reportTitle,
              body: defenderBody || `Comandante: ${fleet.attackerName}. ${reportBody}`,
              timestamp: now
            });
          }
        });

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
        _mpNotifyError('risoluzione flotta', err);
        if (Date.now() - _fleetDueTime(fleetNorm) > 60000) {
          await forceCleanupOnlineFleet(uniRef, fleetNorm, fleetRef, err.message || 'resolve-failed');
        }
      }
    }
  }

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
      const uid = getAuth().currentUser?.uid;
      if (!uid || (fleet.attackerUid !== uid && fleet.defenderUid !== uid)) continue;
      if (fleet.resolved) continue;
      if (fleet.status === 'embargo' || fleet.status === 'occupy') continue;
      if (_fleetDueTime(fleet) <= now) {
        await forceCleanupOnlineFleet(uniRef, fleet, d.ref, 'repair-button');
        repaired++;
      }
    }
    return repaired;
  }

  const _occupationSweepAt = new Map();
  const OCCUPATION_SWEEP_MIN_MS = 10 * 60 * 1000;

  async function processAllOccupations(uniId, { onlyUid = null } = {}) {
    const db = getDB();
    if (!uniId) return;
    const uniRef = db.collection('online_universes').doc(uniId);
    const planetsCol = uniRef.collection('planets');
    const query = onlyUid
      ? planetsCol.where('occupation.occupierUid', '==', onlyUid)
      : planetsCol.where('occupation.occupierUid', '!=', null).limit(50);
    const snap = await query.get().catch(() => null);
    if (!snap || !snap.docs || snap.docs.length === 0) return;

    const DAY_MS = 24 * 3600 * 1000;
    const uniSnapOcc = await uniRef.get().catch(() => null);
    const occSpeed = uniSnapOcc && uniSnapOcc.exists ? (uniSnapOcc.data().speed || 10) : 10;

    for (const pDoc of snap.docs) {
      const occ = pDoc.data().occupation;
      if (!occ || !occ.originCoords) continue;
      const lastSeen = Number(occ.lastTributeAt || occ.startedAt || 0);
      if (!lastSeen || Date.now() - lastSeen < DAY_MS) continue;

      const creditRef = await _resolveCreditRef(uniRef, occ.occupierUid, occ.originCoords);
      if (!creditRef) continue;

      await db.runTransaction(async (tx) => {
        const freshTarget = await tx.get(pDoc.ref);
        if (!freshTarget.exists) return;

        const tData = freshTarget.data();
        const o = tData.occupation;
        if (!o || o.occupierUid !== occ.occupierUid) return;

        const last = Number(o.lastTributeAt || o.startedAt || 0);
        const cycles = Math.floor((Date.now() - last) / DAY_MS);
        if (!last || cycles < 1) return;

        const eff = _effectivePlanetView(tData, occSpeed);
        const rate = Math.min(0.5, 0.05 * cycles);
        const tribM = Math.floor((eff.resources.metal || 0) * rate);
        const tribC = Math.floor((eff.resources.crystal || 0) * rate);
        const tribD = Math.floor((eff.resources.deuterium || 0) * rate);

        const FV = firebase.firestore.FieldValue;
        const upd = {
          'occupation.lastTributeAt': last + cycles * DAY_MS,
          'occupation.prelievoAccumulato': {
            metal: Number(o.prelievoAccumulato?.metal || 0) + tribM,
            crystal: Number(o.prelievoAccumulato?.crystal || 0) + tribC,
            deuterium: Number(o.prelievoAccumulato?.deuterium || 0) + tribD
          }
        };
        if (tData.isNpc) {
          upd['resources.metal'] = Math.max(0, eff.resources.metal - tribM);
          upd['resources.crystal'] = Math.max(0, eff.resources.crystal - tribC);
          upd['resources.deuterium'] = Math.max(0, eff.resources.deuterium - tribD);
          upd.lastUpdated = Date.now();
          upd.inbox = FV.delete();
        } else {
          if (tribM) upd['inbox.resources.metal'] = FV.increment(-tribM);
          if (tribC) upd['inbox.resources.crystal'] = FV.increment(-tribC);
          if (tribD) upd['inbox.resources.deuterium'] = FV.increment(-tribD);
        }
        tx.update(pDoc.ref, upd);
        _inboxCredit(tx, creditRef, { resources: { metal: tribM, crystal: tribC, deuterium: tribD } });
      }).catch((e) => console.warn('[MP Occupazioni] Tributo rinviato:', e));
    }
  }

  async function sweepOccupationsThrottled(uniId) {
    const last = _occupationSweepAt.get(uniId) || 0;
    if (Date.now() - last < OCCUPATION_SWEEP_MIN_MS) return;
    _occupationSweepAt.set(uniId, Date.now());
    const uid = getAuth().currentUser?.uid;
    if (uid) await processAllOccupations(uniId, { onlyUid: uid });
  }

  async function processOnlineOccupations(uniId) {
    const user = getAuth().currentUser;
    if (!user || !uniId) return;
    await processAllOccupations(uniId, { onlyUid: user.uid });
  }

  // P1 FIX: legge la velocità reale dell'universo prima di calcolare il viaggio di ritorno
  async function _transitionSiegeFleetToReturning(uniRef, targetKey, { pendingRansom = null } = {}) {
    const db = getDB();
    const snap = await uniRef.collection('fleets').where('targetKey', '==', targetKey).get().catch(() => ({ docs: [] }));
    const now = Date.now();

    // P1 FIX: la velocità del viaggio di ritorno deve usare la velocità reale dell'universo (era hardcoded 10)
    const uniSnap = await uniRef.get().catch(() => null);
    const realSpeed = uniSnap && uniSnap.exists ? (uniSnap.data().speed || 10) : 10;

    let transitioned = false;
    for (const d of snap.docs) {
      const fleet = normalizeOnlineFleet(d.data(), d.id);
      if (fleet.resolved || (fleet.status !== 'embargo' && fleet.status !== 'occupy')) continue;
      const durationSec = window.UniversumGalaxy?.getFleetSpeedAndFuel
        ? Math.max(5, window.UniversumGalaxy.getFleetSpeedAndFuel({ speed: realSpeed, researches: {} }, fleet.ships, window.UniversumGalaxy.calculateDistance(fleet.targetCoords, fleet.originCoords)).durationSec || 60)
        : 60;
      await d.ref.update({
        status: 'returning',
        phase: 'IN RITORNO',
        resolved: false,
        arrivalTime: now + durationSec * 1000,
        returnTime: now + durationSec * 1000,
        ...(pendingRansom ? { pendingRansom } : {})
      }).catch((e) => _mpNotifyError('rientro flotta assediante', e));
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
    const uniSnapPay = await uniRef.get().catch(() => null);
    const paySpeed = uniSnapPay && uniSnapPay.exists ? (uniSnapPay.data().speed || 10) : 10;
    const prePlSnap = await planetRef.get().catch(() => null);
    const prePl = prePlSnap && prePlSnap.exists ? prePlSnap.data() : null;
    const preSiege = prePl ? (prePl.occupation || prePl.embargo) : null;
    const preAttackerUid = preSiege ? (prePl.occupation ? preSiege.occupierUid : preSiege.attackerUid) : null;
    const creditRef = preSiege && preAttackerUid
      ? await _resolveCreditRef(uniRef, preAttackerUid, preSiege.originCoords)
      : null;
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
      const effPl = _effectivePlanetView(pl, paySpeed);
      if (
        (effPl.resources.metal || 0) < ransom.metal ||
        (effPl.resources.crystal || 0) < ransom.crystal ||
        (effPl.resources.deuterium || 0) < ransom.deuterium
      ) {
        throw new Error('Risorse insufficienti sul pianeta per pagare il riscatto.');
      }

      paidRansom = { ...ransom };
      siegeShipsForReturn = siege.garrisonShips || siege.ships || {};

      const FV = firebase.firestore.FieldValue;
      const payUpd = { embargo: null, occupation: null };
      if (ransom.metal) payUpd['inbox.resources.metal'] = FV.increment(-Math.round(ransom.metal));
      if (ransom.crystal) payUpd['inbox.resources.crystal'] = FV.increment(-Math.round(ransom.crystal));
      if (ransom.deuterium) payUpd['inbox.resources.deuterium'] = FV.increment(-Math.round(ransom.deuterium));
      tx.update(planetRef, payUpd);

      if (!hasSiegeFleet && creditRef) {
        _inboxCredit(tx, creditRef, {
          resources: ransom,
          fleet: siege.garrisonShips || siege.ships || {}
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
    const prePlSnapL = await planetRef.get().catch(() => null);
    const prePlL = prePlSnapL && prePlSnapL.exists ? prePlSnapL.data() : null;
    const preSiegeL = prePlL
      ? ((prePlL.occupation && prePlL.occupation.occupierUid === user.uid) ? prePlL.occupation
        : ((prePlL.embargo && prePlL.embargo.attackerUid === user.uid) ? prePlL.embargo : null))
      : null;
    const creditRefL = preSiegeL ? await _resolveCreditRef(uniRef, user.uid, preSiegeL.originCoords) : null;
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
      tx.update(planetRef, {
        embargo: isMyEmbargo ? null : pl.embargo,
        occupation: isMyOccupation ? null : pl.occupation
      });

      if (!hasSiegeFleet && creditRefL) {
        _inboxCredit(tx, creditRefL, { fleet: siege.garrisonShips || siege.ships || {} });
      }
    });

    await _transitionSiegeFleetToReturning(uniRef, key);
  }

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

    for (const uid of playerUids) {
      await uniRef.collection('messages').add({
        recipientUid: uid,
        title: 'Eliminazione Server',
        body: 'Il server sta per essere eliminato dal creatore.',
        timestamp: Date.now()
      }).catch(() => {});
    }

    for (const uid of playerUids) {
      if (uid) await releaseServerSlot(db, uid, uniId);
    }
    await releaseServerSlot(db, user.uid, uniId);

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

  // =========================================================
  // BOT ONLINE: config, generazione, commercio, raid
  // =========================================================

  function normalizeBotConfig(raw) {
    const d = raw || {};
    let per = d.personality || {};
    let h = Math.max(0, Number(per.hostile) || 0);
    let n = Math.max(0, Number(per.neutral) || 0);
    let p = Math.max(0, Number(per.peaceful) || 0);
    const sum = h + n + p;
    if (sum === 0) { h = 30; n = 40; p = 30; }
    else if (sum !== 100) {
      h = Math.round(h / sum * 100);
      n = Math.round(n / sum * 100);
      p = 100 - h - n;
    }
    return {
      density: Math.min(100, Math.max(0, Math.floor(Number(d.density ?? 20) || 0))),
      personality: { hostile: h, neutral: n, peaceful: p },
      level: Math.min(4, Math.max(1, Math.floor(Number(d.level) || 2))),
      growth: d.growth !== false,
      raids: d.raids !== false
    };
  }

  function _botHashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function _botMulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function _botShuffle(arr, seed) {
    const rng = _botMulberry32(seed);
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function _pickBotPersonality(personalityCfg, seed) {
    const rng = _botMulberry32(_botHashString(seed));
    const roll = rng() * 100;
    if (roll < personalityCfg.hostile) return 'Guerriero';
    if (roll < personalityCfg.hostile + personalityCfg.neutral) return 'Commerciante';
    return 'Pacifico';
  }

  function _generateOnlineBotStats(uniId, coords, botLevel, personality) {
    const Galaxy = window.UniversumGalaxy;
    if (!Galaxy || !Galaxy.generateProceduralSlot) {
      return {
        tier: 'Debole', powerMult: 1, personality,
        resources: { metal: 20000, crystal: 12000, deuterium: 4000 },
        buildings: { metalMine: 6, crystalMine: 5, deuteriumSynth: 3, solarPlant: 7, shipyard: 3 },
        fleet: { lightFighter: 5, smallCargo: 3 },
        defenses: { rocketLauncher: 10, lightLaser: 5 },
        tech: { weaponsTech: 1, shieldingTech: 1, armourTech: 1 }
      };
    }
    const fakeUni = {
      seed: `mpbot:${uniId}`,
      speed: 10, galaxies: 3, systemsPerGalaxy: 100,
      botLevel: botLevel, botMode: 'hostile',
      planets: [], galaxyDeltas: {}, galattiche: [],
      createdAt: Date.now() - 3600000 * 24
    };
    const slot = Galaxy.generateProceduralSlot(fakeUni, coords.g, coords.s, coords.p);
    return {
      tier: slot.tier || 'Debole',
      powerMult: slot.powerMult || 1,
      personality,
      resources: slot.resources,
      buildings: slot.buildings,
      fleet: slot.fleet,
      defenses: slot.defenses,
      tech: slot.tech
    };
  }

  function _buildBotDoc(uniId, coords, botLevel, personality, stats, growthEnabled) {
    const specs = generatePlanetSpecs(coords);
    const key = coordsToKey(coords);
    const label = personality === 'Guerriero' ? 'Ostile'
      : personality === 'Commerciante' ? 'Neutrale' : 'Pacifico';
    const botName = `${label} ${coords.g}:${coords.s}:${coords.p}`;
    const resources = Object.assign({ metal: 0, crystal: 0, deuterium: 0 }, stats.resources || {});
    if (personality === 'Pacifico') {
      resources.metal = Math.floor(resources.metal * 1.5);
      resources.crystal = Math.floor(resources.crystal * 1.5);
      resources.deuterium = Math.floor(resources.deuterium * 1.5);
    } else if (personality === 'Commerciante') {
      resources.metal = Math.floor(resources.metal * 1.2);
      resources.crystal = Math.floor(resources.crystal * 1.2);
    }
    return {
      id: `mp_bot_${uniId}_${key}`,
      coords: { g: coords.g, s: coords.s, p: coords.p },
      key,
      ownerUid: null,
      ownerName: botName,
      isNpc: true,
      botLevel: botLevel,
      botPersonality: personality,
      botCreatedAt: Date.now(),
      growthEnabled: growthEnabled,
      name: botName,
      planetName: botName,
      minTemp: specs.minTemp,
      maxTemp: specs.maxTemp,
      fieldsMax: specs.fieldsMax,
      resources,
      buildings: stats.buildings || {},
      defenses: stats.defenses || {},
      fleet: stats.fleet || {},
      buildQueue: [], shipyardQueue: [], defenseQueue: [],
      moon: null,
      debris: { metal: 0, crystal: 0 },
      embargo: null,
      occupation: null,
      lastUpdated: Date.now()
    };
  }

  async function ensureBotsAroundHome(uniId, homeCoords, botConfig, uniData) {
    const db = getDB();
    const uniRef = db.collection('online_universes').doc(uniId);
    const planetsCol = uniRef.collection('planets');

    // 1. Cap globale
    const npcSnap = await planetsCol.where('isNpc', '==', true).limit(200).get();
    const existingBotKeys = new Set(npcSnap.docs.map((d) => d.id));
    if (existingBotKeys.size >= 200) return 0;

    // 2. Candidati: solo galassia della home, raggio 10 sistemi, posizioni 4-12
    const systemsPerGalaxy = uniData.systemsPerGalaxy || 100;
    const candidates = [];
    for (let s = 1; s <= systemsPerGalaxy; s++) {
      if (Math.abs(s - homeCoords.s) > 10) continue;
      for (let p = 4; p <= 12; p++) {
        const key = `${homeCoords.g}_${s}_${p}`;
        if (existingBotKeys.has(key)) continue;
        candidates.push({ g: homeCoords.g, s, p, key });
      }
    }
    if (candidates.length === 0) return 0;

    // 3. Filtro densità
    const target = Math.min(
      200 - existingBotKeys.size,
      Math.floor(candidates.length * (botConfig.density / 100))
    );
    if (target <= 0) return 0;

    // 4. Shuffle deterministico
    const seed = _botHashString(`${uniId}:${homeCoords.g}:${homeCoords.s}:${homeCoords.p}`);
    const shuffled = _botShuffle(candidates, seed);

    // 5. Batch create
    const batch = db.batch();
    let created = 0;
    for (const c of shuffled) {
      if (created >= target) break;
      const docRef = planetsCol.doc(c.key);
      const existsSnap = await docRef.get();
      if (existsSnap.exists) continue;
      const personality = _pickBotPersonality(botConfig.personality, `${uniId}:${c.key}`);
      const stats = _generateOnlineBotStats(uniId, c, botConfig.level, personality);
      const doc = _buildBotDoc(uniId, c, botConfig.level, personality, stats, botConfig.growth);
      batch.set(docRef, doc);
      created++;
    }
    if (created > 0) await batch.commit();
    return created;
  }

  // Mercante di Lune: operazione atomica sul SOLO pianeta del richiedente.
  // La flotta del mercante non è una flotta PvP reale: risolve un attacco orbitale
  // su commissione e ritira tutti i detriti; difese, edifici e pianeta restano intatti.
  async function hireOnlineMoonMerchant(universeObj, coords) {
    const user = getAuth().currentUser;
    if (!user) throw new Error('Utente non autenticato.');
    if (!universeObj?.id || universeObj.creativeMode) throw new Error('Servizio disponibile solo negli universi Normali.');
    const mm = window.UniversumMoonMerchant;
    if (!mm) throw new Error('Servizio Mercante di Lune non disponibile.');
    const planetRef = getDB().collection('online_universes').doc(universeObj.id)
      .collection('planets').doc(coordsToKey(coords));
    const outcome = await getDB().runTransaction(async (tx) => {
      const snap = await tx.get(planetRef);
      if (!snap.exists || snap.data().ownerUid !== user.uid) throw new Error('Il pianeta non appartiene al tuo impero.');
      const stored = snap.data();
      const live = _effectivePlanetView(stored, universeObj.speed || 10);
      const check = mm.inspect({ ...live, moon: stored.moon, bacinoSpaziale: stored.bacinoSpaziale,
        galatticaOrigin: stored.galatticaOrigin });
      if (!check.available) throw new Error(check.reason);
      const success = Math.random() < check.chance / 100;
      const FV = firebase.firestore.FieldValue;
      const updates = { 'inbox.resources.deuterium': FV.increment(-mm.FEE) };
      for (const [shipId, qty] of Object.entries(check.fleet)) {
        updates[`inbox.fleet.${shipId}`] = FV.increment(-qty);
      }
      if (success) updates.moon = mm.createMoonData();
      tx.update(planetRef, updates);
      return { ...check, success, coords, charged: mm.FEE };
    });
    // Resoconto privato dopo il commit. Non si blocca la transazione per un report.
    getDB().collection('online_universes').doc(universeObj.id).collection('messages').add({
      recipientUid: user.uid, type: 'combat', title: outcome.success ? 'Mercante di Lune: LUNA FORMATA' : 'Mercante di Lune: tentativo fallito',
      body: mm.report(outcome), timestamp: Date.now()
    }).catch((e) => console.warn('[MoonMerchant] Report non salvato:', e));
    return outcome;
  }

  async function tradeWithOnlineBot(universeObj, botCoords, giveRes, giveAmount, getRes) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user) throw new Error('Utente non autenticato.');

    const RES = ['metal', 'crystal', 'deuterium'];
    if (!RES.includes(giveRes) || !RES.includes(getRes) || giveRes === getRes) {
      throw new Error('Risorse non valide per lo scambio.');
    }
    const amount = Math.max(100, Math.floor(Number(giveAmount) || 0));
    const uniRef = db.collection('online_universes').doc(universeObj.id);
    const botKey = coordsToKey(botCoords);
    const botRef = uniRef.collection('planets').doc(botKey);

    const botSnap = await botRef.get();
    if (!botSnap.exists) throw new Error('BOT non trovato.');
    const bot = botSnap.data();
    if (!bot.isNpc) throw new Error('Questo pianeta non è un BOT.');
    if (bot.botPersonality === 'Guerriero') throw new Error('I BOT ostili non commerciano.');

    const home = (universeObj.planets || [])[0];
    if (!home) throw new Error('Nessun pianeta disponibile.');
    const homeRef = uniRef.collection('planets').doc(coordsToKey(home.coords));

    const weights = { metal: 3.0, crystal: 2.0, deuterium: 1.0 };
    const bonus = bot.botPersonality === 'Pacifico' ? 1.2 : 1.0;
    const received = Math.floor((amount / weights[giveRes]) * weights[getRes] * bonus);
    if (received <= 0) throw new Error('Quantità troppo bassa.');

    const FV = firebase.firestore.FieldValue;
    await db.runTransaction(async (tx) => {
      const homeSnap = await tx.get(homeRef);
      const freshBot = await tx.get(botRef);
      if (!homeSnap.exists || !freshBot.exists) throw new Error('Dati non disponibili.');
      if (homeSnap.data().ownerUid !== user.uid || !freshBot.data().isNpc ||
          freshBot.data().botPersonality === 'Guerriero') throw new Error('Scambio non autorizzato.');

      const homeEff = _effectivePlanetView(homeSnap.data(), universeObj.speed || 10);
      const botEff = _effectivePlanetView(freshBot.data(), universeObj.speed || 10);

      if ((homeEff.resources[giveRes] || 0) < amount) {
        throw new Error(`Risorse insufficienti (${giveRes}).`);
      }
      if ((botEff.resources[getRes] || 0) < received) {
        throw new Error('Il BOT non ha abbastanza risorse per questo scambio.');
      }

      const updHome = {
        [`inbox.resources.${giveRes}`]: FV.increment(-amount),
        [`inbox.resources.${getRes}`]: FV.increment(received)
      };
      tx.update(homeRef, updHome);
      tx.update(botRef, {
        [`resources.${giveRes}`]: FV.increment(amount),
        [`resources.${getRes}`]: FV.increment(-received),
        lastUpdated: Date.now()
      });
    });

    return { given: amount, received };
  }

  async function maybeLaunchBotRaid(uniId) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user) return;

    const uniRef = db.collection('online_universes').doc(uniId);
    const uniSnap = await uniRef.get();
    if (!uniSnap.exists) return;
    const uniData = uniSnap.data();
    const cfg = uniData.botConfig;
    if (!cfg || !cfg.raids || !cfg.personality || cfg.personality.hostile <= 0) return;

    // Probabilità hostile/100 * 10%
    const roll = Math.random() * 100;
    if (roll >= (cfg.personality.hostile / 100) * 10) return;

    const myPlanets = await uniRef.collection('planets')
      .where('ownerUid', '==', user.uid).limit(5).get().catch(() => ({ docs: [] }));
    if (myPlanets.docs.length === 0) return;
    const target = myPlanets.docs[Math.floor(Math.random() * myPlanets.docs.length)];
    const targetData = target.data();

    // Non più di un raid incoming alla volta
    const existing = await uniRef.collection('fleets')
      .where('defenderUid', '==', user.uid)
      .where('status', '==', 'outbound')
      .limit(10)
      .get().catch(() => ({ docs: [] }));
    const hasIncoming = existing.docs.some((d) => {
      const f = d.data();
      return String(f.attackerUid || '').startsWith('npc_') && f.mission === 'attack';
    });
    if (hasIncoming) return;

    const lv = cfg.level || 2;
    const mult = lv === 4 ? 15 : lv === 3 ? 5 : lv === 2 ? 2 : 1;
    const raidFleet = {};
    const add = (id, q) => { if (q > 0) raidFleet[id] = Math.floor(q); };
    add('lightFighter', 10 * mult);
    add('heavyFighter', 4 * mult);
    add('cruiser', 2 * mult);
    add('battleship', lv >= 2 ? 2 * mult : 0);
    add('bomber', lv >= 3 ? 2 * mult : 0);

    const now = Date.now();
    const raidDoc = {
      schemaVersion: FLEET_SCHEMA_VERSION,
      mission: 'attack',
      status: 'outbound',
      phase: 'IN VIAGGIO',
      attackerUid: `npc_raid_${uniId}_${now}`,
      attackerName: `Raid BOT Lv.${lv}`,
      attackerTech: {
        weaponsTech: lv * 2, shieldingTech: lv * 2, armourTech: lv * 2,
        expeditionTech: 0, espionageTech: 0
      },
      defenderUid: user.uid,
      originCoords: { g: targetData.coords.g, s: Math.max(1, targetData.coords.s - 3), p: 7 },
      targetCoords: Object.assign({}, targetData.coords),
      targetKey: target.id,
      ships: raidFleet, fleet: raidFleet,
      cargo: { metal: 0, crystal: 0, deuterium: 0 },
      departureTime: now,
      arrivalTime: now + 60000,
      returnTime: now + 60000,
      resolved: false
    };
    const raidRef = uniRef.collection('fleets').doc(`npc_raid_${user.uid}_${Math.floor(now / 60000)}`);
    await db.runTransaction(async (tx) => {
      if ((await tx.get(raidRef)).exists) return;
      tx.set(raidRef, raidDoc);
    });

    await uniRef.collection('messages').add({
      recipientUid: user.uid,
      type: 'alert',
      title: `Allarme Radar: Raid BOT Lv.${lv}`,
      body: `Una flotta BOT colpirà ${targetData.name} tra 60 secondi. Difendi il pianeta!`,
      timestamp: now
    }).catch(() => {});
  }

  window.UniversumMP = {
    registerOrLogin,
    getOnlineUniverses,
    getMyServerMembership,
    createOnlineUniverse,
    tradeWithOnlineBot,
    hireOnlineMoonMerchant,
    maybeLaunchBotRaid,
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
    listenOwnFleets,
    listenOwnPlanets,
    resolveArrivedOnlineFleets,
    migrateOnlineFleets,
    repairStuckMissions,
    getReports,
    deleteReport,
    deleteAllReports,
    processOnlineOccupations,
    processAllOccupations,
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