/** UNIVERSUM / modules/online/universes.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumMPModules;
  const { SERVER_LIMIT, SERVER_LIMIT_MESSAGE, _leaderboardCache, _playersCache, _privateCleanupDone, _systemCache } = window.__UniversumMPVariables;
  // Bridge lazy per le funzioni definite negli altri moduli.
  const calculateLiveResources = (...args) => G.calculateLiveResources(...args);
  const coordsToKey = (...args) => G.coordsToKey(...args);
  const ensureBotsAroundHome = (...args) => G.ensureBotsAroundHome(...args);
  const getAuth = (...args) => G.getAuth(...args);
  const getDB = (...args) => G.getDB(...args);
  const migrateOnlineFleets = (...args) => G.migrateOnlineFleets(...args);
  const normalizeBotConfig = (...args) => G.normalizeBotConfig(...args);



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
      localResearches: {},
      localResearchQueue: null,
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


  // Il lobby puo' ricalcolare le schede spesso; conservarle 30s non modifica
  // il server, e il pulsante AGGIORNA forza sempre una lettura fresca.
  let _universeListCache = null;
  function invalidateOnlineUniverseList() { _universeListCache = null; }
  async function getOnlineUniverses({ force = false } = {}) {
    if (!force && _universeListCache && Date.now() - _universeListCache.at < 30000) {
      return _universeListCache.data.map((u) => ({ ...u }));
    }
    const db = getDB();
    const snap = await db.collection('online_universes')
      .orderBy('createdAt', 'desc')
      .limit(30)
      .get();

    const result = snap.docs.map((doc) => {
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
    _universeListCache = { at: Date.now(), data: result };
    return result.map((u) => ({ ...u }));
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

    invalidateOnlineUniverseList();
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


  // AT05-E: letture di recupero esplicite, nessuna scrittura o migrazione.
  const recoveryEvidence = new WeakMap();
  const recoveryChanged = () => Object.assign(Error('Stato del server variato durante il recupero. Riprova la verifica.'),
    {code:'ordinary-recovery-changed'});
  function requireServerSnapshot(snap) {
    if (snap?.metadata?.fromCache !== false || snap.metadata.hasPendingWrites !== false) throw recoveryChanged();
    return snap;
  }
  function canonicalRecoveryValue(value) {
    return JSON.stringify(value, (key, item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
      return Object.fromEntries(Object.keys(item).sort().map(k=>[k,item[k]]));
    });
  }
  function recoverySignature(snap) {
    if (Array.isArray(snap.docs)) return canonicalRecoveryValue(snap.docs.map(d=>{
      requireServerSnapshot(d);
      return [d.id,d.data()];
    }).sort((a,b)=>a[0].localeCompare(b[0])));
    return canonicalRecoveryValue([snap.id,snap.exists,snap.exists ? snap.data() : null]);
  }
  async function readRecoverySet(db, uniRef, uid, operationId) {
    const assertAccount=()=>{if (getAuth().currentUser?.uid!==uid) throw recoveryChanged();};
    const read=async ref=>requireServerSnapshot(await ref.get({source:'server'}));
    const refs=[uniRef,uniRef.collection('players').doc(uid),
      uniRef.collection('planets').where('ownerUid','==',uid),
      uniRef.collection('fleets').where('attackerUid','==',uid).where('resolved','==',false),
      uniRef.collection('galattiche').where('ownerUid','==',uid)];
    if (operationId) refs.push(uniRef.collection('fleets').doc(operationId));
    assertAccount();
    const first=await Promise.all(refs.map(read));
    assertAccount();
    if (!first[0].exists || !first[1].exists) throw recoveryChanged();
    const signatures=first.map(recoverySignature);
    // La transazione di sola lettura verifica il contenuto dei documenti noti.
    // Le query prima/dopo verificano anche l'insieme dei documenti; non si
    // dichiara uno snapshot atomico globale delle query Firestore Web.
    const known=new Map();
    for (const snap of first) for (const doc of snap.docs || [snap]) {
      requireServerSnapshot(doc);
      const signature=recoverySignature(doc);
      if (known.has(doc.ref.path) && known.get(doc.ref.path).signature!==signature) throw recoveryChanged();
      known.set(doc.ref.path,{ref:doc.ref,signature});
    }
    const knownDocuments=[...known.values()];
    await db.runTransaction(async tx=>{
      assertAccount();
      const docs=await Promise.all(knownDocuments.map(item=>tx.get(item.ref)));
      docs.forEach((doc,i)=>{
        if (recoverySignature(doc)!==knownDocuments[i].signature) throw recoveryChanged();
      });
      assertAccount();
    });
    const second=await Promise.all(refs.map(read));
    assertAccount();
    if (second.some((snap,i)=>recoverySignature(snap)!==signatures[i])) throw recoveryChanged();
    const [uni,player,planets,fleets,galattiche,operation]=second;
    if (planets.docs.some(d=>d.data().ownerUid!==uid) || fleets.docs.some(d=>d.data().attackerUid!==uid || d.data().resolved!==false) ||
        galattiche.docs.some(d=>d.data().ownerUid!==uid)) throw recoveryChanged();
    const revision=player.data().serviceRevision ?? 0;
    if (!Number.isSafeInteger(revision) || revision<0) throw recoveryChanged();
    return {uni,player,planets,fleets,galattiche,operation};
  }
  async function joinOnlineUniverse(universeId, passcode = '', {serverOnly=false,operationId=null} = {}) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user) throw new Error('Devi accedere prima di entrare in un universo.');
    if (!serverOnly) G.assertOrdinaryMutationAllowed?.({id:universeId},user.uid);

    const uniRef = db.collection('online_universes').doc(universeId);
    const recovered=serverOnly ? await readRecoverySet(db,uniRef,user.uid,operationId) : null;
    const uniSnap = recovered ? recovered.uni : await uniRef.get();
    if (!uniSnap.exists) throw new Error('Universo online non trovato.');

    const uniData = uniSnap.data();
    if (uniData.passcode && uniData.passcode !== String(passcode || '').trim()) {
      throw new Error('Codice stanza errato.');
    }

    const playerName = user.displayName || user.email.split('@')[0];
    const playerRef = uniRef.collection('players').doc(user.uid);
    const playerSnap = recovered ? recovered.player : await playerRef.get();

    let playerState;
    let myPlanets = [];

    if (recovered) {
      playerState=playerSnap.data();
      myPlanets=recovered.planets.docs.map(d=>d.data());
    } else if (!playerSnap.exists) {
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

      // D07-I01: solo il NUOVO pianeta madre online parte come l'offline.
      // Non modificare createStarterPlanetDoc: serve anche altri contesti.
      // Non riscrivere pianeti di giocatori già iscritti né colonie.
      homePlanet.buildings = {
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
      };

      await uniRef.collection('planets').doc(homeKey).set(homePlanet);

      playerState = {
        uid: user.uid,
        nickname: playerName,
        researches: {},
        researchQueue: null,
        researchModelVersion: 1,
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

      myPlanets = planetsSnap.docs.map((d) => d.data());
    }

    const activeFleetsSnap = recovered ? recovered.fleets : await uniRef.collection('fleets')
      .where('attackerUid', '==', user.uid)
      .where('resolved', '==', false)
      .get();

    const fleetsInFlight = activeFleetsSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));

    const msgQuery=uniRef.collection('messages').where('recipientUid','==',user.uid).orderBy('timestamp','desc').limit(20);
    const msgSnap = recovered ? requireServerSnapshot(await msgQuery.get({source:'server'})) :
      await msgQuery.get().catch(() => ({ docs: [] }));
    if (recovered) {
      msgSnap.docs.forEach(requireServerSnapshot);
      if (getAuth().currentUser?.uid!==user.uid) throw recoveryChanged();
    }

    const messages = msgSnap.docs.map((d) => d.data());

    if (!recovered) {
      if (playerSnap.exists) {
        await claimServerSlot(db, user.uid, universeId, { alreadyMember: true }).catch(() => {});
      }
      _invalidateUniCaches(universeId);
      // Un giocatore appena creato non ha flotte legacy da migrare.
      if (playerSnap.exists) await migrateOnlineFleets(universeId).catch(() => {});
      await cleanupPrivateMessagesOnce(db, universeId, user.uid);

      // I bot configurabili vengono distribuiti vicino alla prima colonia.
      if (uniData.botConfig?.density > 0 && myPlanets[0]) {
        await ensureBotsAroundHome(universeId, myPlanets[0].coords,
          normalizeBotConfig(uniData.botConfig), uniData)
          .catch((e) => console.warn('[MP Bot] Generazione bot fallita:', e));
      }
    }

    const output = {
      id: universeId,
      serviceRevision: playerState.serviceRevision || 0,
      specialistBuilt: playerState.specialistBuilt || {},
      researchModelVersion: playerState.researchModelVersion || 0,
      founderUid: uniData.founderUid || uniData.ownerUid || null,
      ownerUid: uniData.ownerUid || uniData.founderUid || null,
      name: uniData.name,
      emperor: playerName,
      speed: uniData.speed || 10,
      galaxies: uniData.galaxies || 3,
      systemsPerGalaxy: uniData.systemsPerGalaxy || 100,
      npcMode: uniData.npcMode || 'none',
      supremaRecoveryStaging: uniData.supremaRecoveryStaging === true,
      botConfig: uniData.botConfig || null,
      creativeMode: false,
      planets: myPlanets,
      activePlanetId: myPlanets[0]?.id,
      crepuscoloLimbo: playerState.crepuscoloLimbo || null,
      galaxyDeltas:playerState.orbitalDeltas || {},
      researches: playerState.researches || {},
      researchQueue: playerState.researchQueue || null,
      fleetsInFlight,
      incomingAttacks: [],
      spyReports: [],
      messages
    };
    const recoveredAt=Date.now();
    await G.restoreGalattiche(output,user.uid,recovered ? {snapshot:recovered.galattiche,now:recoveredAt} : undefined);
    Object.defineProperty(output,'roomPasscode',{value:passcode});
    window.UniversumEngine?.normalizeResearchState(output);
    if (playerSnap.exists) G.restoreServices(output,myPlanets,playerState,
      recovered ? recoveredAt : undefined,recovered ? {serverRecovery:true} : undefined);
    if (recovered) {
      if (getAuth().currentUser?.uid!==user.uid) throw recoveryChanged();
      const operation=recovered.operation;
      recoveryEvidence.set(output,Object.freeze({uid:user.uid,universeId,operationId,
        revision:output.serviceRevision,joinedAt:playerState.joinedAt ?? null,
        receipt:playerState.ordinaryDispatchReceipt ? Object.freeze({...playerState.ordinaryDispatchReceipt}) : null,
        fleet:operation?.exists ? Object.freeze({...operation.data(),id:operation.id}) : null}));
    }
    return output;
  }

  Object.assign(G, { ordinaryRecoveryEvidence:u=>recoveryEvidence.get(u) || null, _cacheGet, _invalidateUniCaches, invalidateOnlineUniverseList, getMembership, claimServerSlot, releaseServerSlot, getMyServerMembership, cleanupPrivateMessagesOnce, sanitizeNickname, nicknameToInternalEmail, generatePlanetSpecs, createStarterPlanetDoc, registerOrLogin, getOnlineUniverses, generateNeutralOutpostsOnce, createOnlineUniverse, findFreeHomeCoords, joinOnlineUniverse });

})();
