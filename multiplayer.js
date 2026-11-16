(function () {
  'use strict';

  const COL_USERS = 'users';
  const COL_UNIVERSES = 'online_universes';

  let currentUserProfile = null;
  let radarUnsubscribe = null;
  let chatUnsubscribe = null;
  let fleetSweepTimer = null;

  function ensureFirebase() {
    if (!window.fbAuth || !window.fbDB) {
      throw new Error('Firebase non inizializzato. Configura le chiavi in firebase-config.js.');
    }
    return { auth: window.fbAuth, db: window.fbDB };
  }

  function coordKey(g, s, p) {
    return `${g}:${s}:${p}`;
  }

  function nicknameToEmail(nickname) {
    const clean = String(nickname || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    if (clean.length < 3) {
      throw new Error('Il nickname deve contenere almeno 3 caratteri alfanumerici.');
    }
    return `${clean}@universum.pvp`;
  }

  // =========================================================================
  // 1. AUTENTICAZIONE SEMPLIFICATA (NICKNAME + PASSWORD)
  // =========================================================================
  async function registerOrLogin(nickname, password, isRegister = false) {
    const { auth, db } = ensureFirebase();
    const displayNick = String(nickname || '').trim().substring(0, 24);
    const email = nicknameToEmail(displayNick);

    if (!password || String(password).length < 6) {
      throw new Error('La password deve avere almeno 6 caratteri.');
    }

    let cred;
    if (isRegister) {
      cred = await auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: displayNick });
      const profile = {
        uid: cred.user.uid,
        nickname: displayNick,
        createdAt: Date.now(),
        lastLogin: Date.now()
      };
      await db.collection(COL_USERS).doc(cred.user.uid).set(profile);
      currentUserProfile = profile;
      return profile;
    } else {
      cred = await auth.signInWithEmailAndPassword(email, password);
      const userRef = db.collection(COL_USERS).doc(cred.user.uid);
      const snap = await userRef.get();
      if (snap.exists) {
        await userRef.update({ lastLogin: Date.now() });
        currentUserProfile = snap.data();
      } else {
        currentUserProfile = {
          uid: cred.user.uid,
          nickname: cred.user.displayName || displayNick,
          createdAt: Date.now(),
          lastLogin: Date.now()
        };
        await userRef.set(currentUserProfile);
      }
      return currentUserProfile;
    }
  }

  async function logout() {
    stopListeners();
    if (window.fbAuth) {
      await window.fbAuth.signOut();
    }
    currentUserProfile = null;
  }

  function getCurrentUser() {
    const authUser = window.fbAuth ? window.fbAuth.currentUser : null;
    if (!authUser) return null;
    return currentUserProfile || {
      uid: authUser.uid,
      nickname: authUser.displayName || 'Comandante'
    };
  }

  // =========================================================================
  // 2. LOBBY SERVER / UNIVERSI ONLINE
  // =========================================================================
  async function getOnlineUniverses() {
    const { db } = ensureFirebase();
    const snap = await db.collection(COL_UNIVERSES).orderBy('createdAt', 'desc').get();
    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        speed: data.speed || 10,
        galaxies: data.galaxies || 3,
        systemsPerGalaxy: data.systemsPerGalaxy || 250,
        playerCount: data.playerCount || 0,
        hasPassword: Boolean(data.roomPassword),
        creativeMode: false, // Forzatamente disabilitata online
        createdBy: data.createdByName || 'Sistema',
        createdAt: data.createdAt || Date.now()
      };
    });
  }

  async function createOnlineUniverse(config) {
    const { db } = ensureFirebase();
    const user = getCurrentUser();
    if (!user) throw new Error('Effettua prima il login PvP per creare un universo online.');

    const name = String(config.name || 'Universo PvP').trim().substring(0, 32);
    const speed = Math.min(1000, Math.max(1, Number(config.speed) || 10));
    const galaxies = Math.min(9, Math.max(1, Number(config.galaxies) || 3));
    const systemsPerGalaxy = Math.min(499, Math.max(50, Number(config.systemsPerGalaxy) || 250));
    const roomPassword = String(config.roomPassword || '').trim();

    const uniData = {
      name,
      speed,
      galaxies,
      systemsPerGalaxy,
      roomPassword,
      creativeMode: false,
      playerCount: 0,
      createdByUid: user.uid,
      createdByName: user.nickname,
      createdAt: Date.now()
    };

    const docRef = await db.collection(COL_UNIVERSES).add(uniData);
    return Object.assign({ id: docRef.id, hasPassword: Boolean(roomPassword) }, uniData);
  }

  async function joinOnlineUniverse(universeId, passwordAttempt = '') {
    const { db } = ensureFirebase();
    const user = getCurrentUser();
    if (!user) throw new Error('Devi accedere prima di entrare in un universo online.');

    const uniRef = db.collection(COL_UNIVERSES).doc(universeId);
    const uniSnap = await uniRef.get();
    if (!uniSnap.exists) throw new Error('Universo online non trovato.');

    const uni = Object.assign({ id: uniSnap.id, creativeMode: false }, uniSnap.data());
    if (uni.roomPassword && uni.roomPassword !== String(passwordAttempt || '').trim()) {
      throw new Error('Password della stanza errata.');
    }

    const playerRef = uniRef.collection('players').doc(user.uid);
    const playerSnap = await playerRef.get();
    let playerData;

    if (playerSnap.exists) {
      playerData = playerSnap.data();
    } else {
      // Prima entrata: trova uno slot libero e assegna Pianeta Madre
      const planetsCol = uniRef.collection('planets');
      let assignedCoords = null;

      for (let attempt = 0; attempt < 40; attempt++) {
        const g = Math.floor(Math.random() * (uni.galaxies || 3)) + 1;
        const s = Math.floor(Math.random() * (uni.systemsPerGalaxy || 250)) + 1;
        const p = Math.floor(Math.random() * 9) + 4; // Slot temperati 4..12
        const key = coordKey(g, s, p);
        const checkSnap = await planetsCol.doc(key).get();
        if (!checkSnap.exists || checkSnap.data().ownerUid === null) {
          assignedCoords = { g, s, p, key };
          break;
        }
      }

      if (!assignedCoords) {
        throw new Error('Nessuno slot libero trovato al momento. Riprova.');
      }

      const maxTemp = Math.floor(Math.random() * 45) + 25;
      const minTemp = maxTemp - 40;

      const homePlanetDoc = {
        coords: { g: assignedCoords.g, s: assignedCoords.s, p: assignedCoords.p },
        ownerUid: user.uid,
        ownerName: user.nickname,
        planetName: 'Pianeta Madre',
        temperature: { min: minTemp, max: maxTemp },
        minTemp,
        maxTemp,
        fieldsMax: 220,
        resources: { metal: 10000, crystal: 10000, deuterium: 2500 },
        buildings: {
          metalMine: 0, crystalMine: 0, deuteriumSynth: 0, solarPlant: 0, fusionReactor: 0,
          roboticsFactory: 0, naniteFactory: 0, shipyard: 0, metalStorage: 0, crystalStorage: 0,
          deuteriumTank: 0, researchLab: 0, terraformer: 0, hiddenBunker: 0
        },
        defenses: {},
        fleet: {},
        moon: null,
        debris: { metal: 0, crystal: 0 },
        lastUpdated: Date.now()
      };

      playerData = {
        uid: user.uid,
        nickname: user.nickname,
        joinedAt: Date.now(),
        researches: {
          energyTech: 0, laserTech: 0, ionTech: 0, hyperspaceTech: 0, plasmaTech: 0,
          combustionDrive: 0, impulseDrive: 0, hyperspaceDrive: 0, espionageTech: 0,
          computerTech: 0, astrophysics: 0, intergalacticNetwork: 0, weaponsTech: 0,
          shieldingTech: 0, armourTech: 0, lunarTech: 0, jumpGateTech: 0, deathStarTech: 0
        }
      };

      const batch = db.batch();
      batch.set(planetsCol.doc(assignedCoords.key), homePlanetDoc);
      batch.set(playerRef, playerData);
      batch.update(uniRef, {
        playerCount: firebase.firestore.FieldValue.increment(1)
      });
      await batch.commit();
    }

    // Carica tutti i pianeti posseduti dal giocatore in questo universo
    const myPlanetsSnap = await uniRef.collection('planets').where('ownerUid', '==', user.uid).get();
    const myPlanets = myPlanetsSnap.docs.map((d) => {
      const pData = d.data();
      return calculateLiveResources(pData, uni.speed, playerData.researches);
    });

    startRealtimeListeners(universeId);

    return {
      universe: uni,
      player: playerData,
      planets: myPlanets
    };
  }

  // =========================================================================
  // 3. SINCRONIZZAZIONE PIANETI E RISORSE REAL-TIME
  // =========================================================================
  function calculateLiveResources(planetDoc, universeSpeed = 10, researches = {}) {
    if (!planetDoc) return null;
    const now = Date.now();
    const lastUpdated = Number(planetDoc.lastUpdated) || now;
    const deltaSec = Math.max(0, (now - lastUpdated) / 1000);

    const cloned = JSON.parse(JSON.stringify(planetDoc));
    if (cloned.temperature && cloned.maxTemp === undefined) {
      cloned.maxTemp = cloned.temperature.max;
      cloned.minTemp = cloned.temperature.min;
    }

    if (deltaSec <= 0 || !window.UniversumEngine) {
      return cloned;
    }

    const fakeUni = {
      creativeMode: false,
      speed: universeSpeed,
      turboUntil: 0,
      researches: researches || {}
    };

    const prod = window.UniversumEngine.getPlanetProduction(cloned, fakeUni);
    const curM = Number(cloned.resources?.metal || 0);
    const curC = Number(cloned.resources?.crystal || 0);
    const curD = Number(cloned.resources?.deuterium || 0);

    if (curM < prod.caps.metal) {
      cloned.resources.metal = Math.min(prod.caps.metal, curM + prod.metalPerSec * deltaSec);
    }
    if (curC < prod.caps.crystal) {
      cloned.resources.crystal = Math.min(prod.caps.crystal, curC + prod.crystalPerSec * deltaSec);
    }
    const dDelta = prod.deuteriumPerSec * deltaSec;
    if (dDelta > 0 && curD < prod.caps.deuterium) {
      cloned.resources.deuterium = Math.min(prod.caps.deuterium, curD + dDelta);
    } else if (dDelta < 0) {
      cloned.resources.deuterium = Math.max(0, curD + dDelta);
    }

    cloned.lastUpdated = now;
    return cloned;
  }

  async function syncPlanetState(uniId, planetDoc) {
    const { db } = ensureFirebase();
    if (!planetDoc || !planetDoc.coords) {
      throw new Error('Documento pianeta non valido.');
    }
    const key = coordKey(planetDoc.coords.g, planetDoc.coords.s, planetDoc.coords.p);
    const payload = Object.assign({}, planetDoc, {
      lastUpdated: Date.now()
    });
    await db.collection(COL_UNIVERSES).doc(uniId).collection('planets').doc(key).set(payload, { merge: true });
    return payload;
  }

  async function renameOnlinePlanet(uniId, coords, newName) {
    const { db } = ensureFirebase();
    const user = getCurrentUser();
    if (!user) throw new Error('Non autenticato.');
    const cleaned = String(newName || '').trim().substring(0, 24);
    if (!cleaned) throw new Error('Il nome del pianeta non può essere vuoto.');

    const key = coordKey(coords.g, coords.s, coords.p);
    const ref = db.collection(COL_UNIVERSES).doc(uniId).collection('planets').doc(key);
    const snap = await ref.get();
    if (!snap.exists || snap.data().ownerUid !== user.uid) {
      throw new Error('Non sei il proprietario di questo pianeta.');
    }
    await ref.update({ planetName: cleaned });
    return cleaned;
  }

  async function renameOnlineMoon(uniId, coords, newName) {
    const { db } = ensureFirebase();
    const user = getCurrentUser();
    if (!user) throw new Error('Non autenticato.');
    const cleaned = String(newName || '').trim().substring(0, 24);
    if (!cleaned) throw new Error('Il nome della Luna non può essere vuoto.');

    const key = coordKey(coords.g, coords.s, coords.p);
    const ref = db.collection(COL_UNIVERSES).doc(uniId).collection('planets').doc(key);
    const snap = await ref.get();
    if (!snap.exists || snap.data().ownerUid !== user.uid || !snap.data().moon) {
      throw new Error('Nessuna Luna modificabile su queste coordinate.');
    }
    await ref.update({ 'moon.name': cleaned });
    return cleaned;
  }

  // =========================================================================
  // 4. GALASSIA CONDIVISA
  // =========================================================================
  async function getOnlineSystem(uniId, galaxy, system) {
    const { db } = ensureFirebase();
    const user = getCurrentUser();
    const myUid = user ? user.uid : null;

    const g = Math.max(1, Number(galaxy) || 1);
    const s = Math.max(1, Number(system) || 1);

    const planetsSnap = await db.collection(COL_UNIVERSES).doc(uniId).collection('planets')
      .where('coords.g', '==', g)
      .where('coords.s', '==', s)
      .get();

    const occupiedMap = {};
    planetsSnap.forEach((doc) => {
      const data = doc.data();
      if (data.coords && data.coords.p) {
        occupiedMap[data.coords.p] = data;
      }
    });

    const slots = [];
    for (let p = 1; p <= 15; p++) {
      const key = coordKey(g, s, p);
      const existing = occupiedMap[p];

      if (existing && existing.ownerUid) {
        const isMine = existing.ownerUid === myUid;
        slots.push({
          coords: { g, s, p },
          key,
          type: 'planet',
          ownerType: isMine ? 'player' : 'enemy_player',
          ownerUid: existing.ownerUid,
          emperor: existing.ownerName || 'Comandante',
          name: existing.planetName || 'Colonia',
          maxTemp: existing.maxTemp ?? existing.temperature?.max ?? 30,
          minTemp: existing.minTemp ?? existing.temperature?.min ?? -10,
          fieldsMax: existing.fieldsMax || 200,
          moon: existing.moon || null,
          debris: existing.debris || { metal: 0, crystal: 0 }
        });
      } else {
        const maxTemp = p <= 3 ? 75 : p <= 11 ? 25 : -45;
        slots.push({
          coords: { g, s, p },
          key,
          type: 'empty',
          ownerType: 'none',
          ownerUid: null,
          emperor: null,
          name: 'Pianeta Disabitato (Colonizzabile)',
          maxTemp,
          minTemp: maxTemp - 40,
          fieldsMax: 180 + (5 - Math.abs(8 - p)) * 12,
          moon: null,
          debris: (existing && existing.debris) || { metal: 0, crystal: 0 }
        });
      }
    }

    return {
      galaxy: g,
      system: s,
      slots,
      expeditionSlot: {
        coords: { g, s, p: 16 },
        key: coordKey(g, s, 16),
        name: 'Spazio Profondo (Pos. 16)'
      }
    };
  }

  // =========================================================================
  // 5. FLOTTE PvP, RADAR IN TEMPO REALE E RISOLUZIONE ATOMICA (TRANSACTION)
  // =========================================================================
  async function launchOnlineFleet(uniId, originCoords, targetCoords, mission, fleetSelection, cargo = { metal: 0, crystal: 0, deuterium: 0 }) {
    const { db } = ensureFirebase();
    const user = getCurrentUser();
    if (!user) throw new Error('Non autenticato.');

    const uniRef = db.collection(COL_UNIVERSES).doc(uniId);
    const uniSnap = await uniRef.get();
    if (!uniSnap.exists) throw new Error('Universo non trovato.');
    const uni = uniSnap.data();

    const originKey = coordKey(originCoords.g, originCoords.s, originCoords.p);
    const targetKey = coordKey(targetCoords.g, targetCoords.s, targetCoords.p);

    const originRef = uniRef.collection('planets').doc(originKey);
    const targetRef = uniRef.collection('planets').doc(targetKey);
    const playerRef = uniRef.collection('players').doc(user.uid);

    const [playerSnap, targetSnap] = await Promise.all([playerRef.get(), targetRef.get()]);
    const researches = playerSnap.exists ? (playerSnap.data().researches || {}) : {};
    const defenderUid = (targetSnap.exists && targetSnap.data().ownerUid) ? targetSnap.data().ownerUid : null;

    if (defenderUid === user.uid && (mission === 'attack' || mission === 'spy' || mission === 'destroyMoon')) {
      throw new Error('Non puoi attaccare o spiare un tuo stesso pianeta.');
    }

    const Data = window.UniversumData;
    const Galaxy = window.UniversumGalaxy;

    const cleanFleet = {};
    let totalShips = 0;
    let totalCargoCap = 0;
    for (const [id, rawQty] of Object.entries(fleetSelection || {})) {
      const qty = Math.max(0, Math.floor(Number(rawQty) || 0));
      if (qty <= 0 || id === 'solarSatellite') continue;
      cleanFleet[id] = qty;
      totalShips += qty;
      totalCargoCap += (Data.SHIPS[id]?.cargo || 0) * qty;
    }
    if (totalShips === 0) throw new Error('Seleziona almeno una nave.');

    const dist = Galaxy.calculateDistance(originCoords, targetCoords);
    const fakeUni = { speed: uni.speed || 10, researches, creativeMode: false };
    const { durationSec, fuelCost } = Galaxy.getFleetSpeedAndFuel(fakeUni, cleanFleet, dist);

    const loadM = Math.max(0, Math.floor(Number(cargo.metal) || 0));
    const loadC = Math.max(0, Math.floor(Number(cargo.crystal) || 0));
    const loadD = Math.max(0, Math.floor(Number(cargo.deuterium) || 0));

    if (loadM + loadC + loadD + fuelCost > totalCargoCap) {
      throw new Error('Capacità stiva insufficiente per carico e carburante.');
    }

    const now = Date.now();
    const fleetDocId = `flt_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const fleetRef = uniRef.collection('fleets').doc(fleetDocId);

    const missionPayload = {
      id: fleetDocId,
      mission,
      attackerUid: user.uid,
      attackerName: user.nickname,
      attackerResearches: researches,
      defenderUid,
      originCoords: Object.assign({}, originCoords),
      originKey,
      targetCoords: Object.assign({}, targetCoords),
      targetKey,
      fleet: cleanFleet,
      cargo: { metal: loadM, crystal: loadC, deuterium: loadD },
      status: 'outbound', // 'outbound' | 'returning' | 'completed'
      startTime: now,
      arrivalTime: now + durationSec * 1000,
      returnTime: now + durationSec * 2000,
      durationSec
    };

    await db.runTransaction(async (tx) => {
      const oSnap = await tx.get(originRef);
      if (!oSnap.exists || oSnap.data().ownerUid !== user.uid) {
        throw new Error('Pianeta di partenza non valido o non tuo.');
      }

      const liveOrigin = calculateLiveResources(oSnap.data(), uni.speed || 10, researches);
      for (const [id, qty] of Object.entries(cleanFleet)) {
        if ((liveOrigin.fleet?.[id] || 0) < qty) {
          throw new Error(`Navi insufficienti in orbita (${id}).`);
        }
        liveOrigin.fleet[id] -= qty;
      }

      if (
        liveOrigin.resources.metal < loadM ||
        liveOrigin.resources.crystal < loadC ||
        liveOrigin.resources.deuterium < (loadD + fuelCost)
      ) {
        throw new Error(`Risorse o carburante insufficienti (${fuelCost.toLocaleString()} D).`);
      }

      liveOrigin.resources.metal -= loadM;
      liveOrigin.resources.crystal -= loadC;
      liveOrigin.resources.deuterium -= (loadD + fuelCost);
      liveOrigin.lastUpdated = now;

      tx.set(originRef, liveOrigin);
      tx.set(fleetRef, missionPayload);
    });

    return missionPayload;
  }

  async function resolveSingleArrivedFleet(uniId, uniSpeed, fleetDocRef) {
    const { db } = ensureFirebase();
    const uniRef = db.collection(COL_UNIVERSES).doc(uniId);
    const Galaxy = window.UniversumGalaxy;

    await db.runTransaction(async (tx) => {
      const fSnap = await tx.get(fleetDocRef);
      if (!fSnap.exists) return;
      const flt = fSnap.data();
      const now = Date.now();

      // FASE 1: ARRIVO A DESTINAZIONE (OUTBOUND -> RETURNING)
      if (flt.status === 'outbound' && now >= flt.arrivalTime) {
        const targetRef = uniRef.collection('planets').doc(flt.targetKey);
        const tSnap = await tx.get(targetRef);

        let defResearches = {};
        if (flt.defenderUid) {
          const defPlayerSnap = await tx.get(uniRef.collection('players').doc(flt.defenderUid));
          if (defPlayerSnap.exists) defResearches = defPlayerSnap.data().researches || {};
        }

        // MISSIONE SPIONAGGIO
        if (flt.mission === 'spy') {
          if (tSnap.exists && tSnap.data().ownerUid) {
            const liveTarget = calculateLiveResources(tSnap.data(), uniSpeed, defResearches);
            const msgAttRef = uniRef.collection('messages').doc();
            tx.set(msgAttRef, {
              recipientUid: flt.attackerUid,
              time: now,
              type: 'spy',
              title: `👁️ Rapporto Spia PvP [${flt.targetKey}]`,
              body: `Pianeta di ${liveTarget.ownerName}: Metallo ${Math.floor(liveTarget.resources.metal).toLocaleString()}, Cristallo ${Math.floor(liveTarget.resources.crystal).toLocaleString()}, Deuterio ${Math.floor(liveTarget.resources.deuterium).toLocaleString()}.`,
              reportData: {
                coords: flt.targetCoords,
                ownerName: liveTarget.ownerName,
                resources: liveTarget.resources,
                fleet: liveTarget.fleet,
                defenses: liveTarget.defenses,
                buildings: liveTarget.buildings,
                moon: liveTarget.moon
              }
            });

            if (liveTarget.ownerUid) {
              const msgDefRef = uniRef.collection('messages').doc();
              tx.set(msgDefRef, {
                recipientUid: liveTarget.ownerUid,
                time: now,
                type: 'alert',
                title: `🚨 Sonde Spia Rilevate su [${flt.targetKey}]!`,
                body: `Il giocatore ${flt.attackerName} ha scansionato il tuo pianeta ${liveTarget.planetName}.`
              });
            }
          }
          tx.update(fleetDocRef, { status: 'returning' });
          return;
        }

        // MISSIONE COLONIZZAZIONE
        if (flt.mission === 'colonize') {
          if (!tSnap.exists || !tSnap.data().ownerUid) {
            const remColonyShips = Math.max(0, (flt.fleet.colonyShip || 1) - 1);
            const updatedFleet = Object.assign({}, flt.fleet, { colonyShip: remColonyShips });
            const maxTemp = flt.targetCoords.p <= 3 ? 75 : flt.targetCoords.p <= 11 ? 25 : -45;

            tx.set(targetRef, {
              coords: flt.targetCoords,
              ownerUid: flt.attackerUid,
              ownerName: flt.attackerName,
              planetName: 'Colonia PvP',
              temperature: { min: maxTemp - 40, max: maxTemp },
              minTemp: maxTemp - 40,
              maxTemp,
              fieldsMax: 200,
              resources: {
                metal: 1500 + (flt.cargo.metal || 0),
                crystal: 1500 + (flt.cargo.crystal || 0),
                deuterium: 500 + (flt.cargo.deuterium || 0)
              },
              buildings: {
                metalMine: 0, crystalMine: 0, deuteriumSynth: 0, solarPlant: 0, fusionReactor: 0,
                roboticsFactory: 0, naniteFactory: 0, shipyard: 0, metalStorage: 0, crystalStorage: 0,
                deuteriumTank: 0, researchLab: 0, terraformer: 0, hiddenBunker: 0
              },
              defenses: {},
              fleet: {},
              moon: null,
              debris: (tSnap.exists && tSnap.data().debris) || { metal: 0, crystal: 0 },
              lastUpdated: now
            });

            tx.update(fleetDocRef, {
              status: 'returning',
              fleet: updatedFleet,
              cargo: { metal: 0, crystal: 0, deuterium: 0 }
            });
          } else {
            tx.update(fleetDocRef, { status: 'returning' });
          }
          return;
        }

        // MISSIONE TRASPORTO
        if (flt.mission === 'transport') {
          if (tSnap.exists && tSnap.data().ownerUid) {
            const liveTarget = calculateLiveResources(tSnap.data(), uniSpeed, defResearches);
            liveTarget.resources.metal += flt.cargo.metal || 0;
            liveTarget.resources.crystal += flt.cargo.crystal || 0;
            liveTarget.resources.deuterium += flt.cargo.deuterium || 0;
            liveTarget.lastUpdated = now;
            tx.set(targetRef, liveTarget);
          }
          tx.update(fleetDocRef, {
            status: 'returning',
            cargo: { metal: 0, crystal: 0, deuterium: 0 }
          });
          return;
        }

        // MISSIONE RICICLAGGIO
        if (flt.mission === 'recycle') {
          if (tSnap.exists) {
            const pData = tSnap.data();
            const debris = pData.debris || { metal: 0, crystal: 0 };
            const Data = window.UniversumData;
            let recCap = 0;
            for (const [id, qty] of Object.entries(flt.fleet || {})) {
              recCap += (Data.SHIPS[id]?.cargo || 0) * qty;
            }
            const used = (flt.cargo.metal || 0) + (flt.cargo.crystal || 0) + (flt.cargo.deuterium || 0);
            const free = Math.max(0, recCap - used);
            const takeM = Math.min(debris.metal, Math.floor(free * 0.6));
            const takeC = Math.min(debris.crystal, free - takeM);

            tx.update(targetRef, {
              debris: {
                metal: Math.max(0, debris.metal - takeM),
                crystal: Math.max(0, debris.crystal - takeC)
              }
            });
            tx.update(fleetDocRef, {
              status: 'returning',
              cargo: {
                metal: (flt.cargo.metal || 0) + takeM,
                crystal: (flt.cargo.crystal || 0) + takeC,
                deuterium: flt.cargo.deuterium || 0
              }
            });
          } else {
            tx.update(fleetDocRef, { status: 'returning' });
          }
          return;
        }

        // MISSIONE ATTACCO / DISTRUZIONE LUNA PvP
        if (flt.mission === 'attack' || flt.mission === 'destroyMoon') {
          if (!tSnap.exists || !tSnap.data().ownerUid) {
            tx.update(fleetDocRef, { status: 'returning' });
            return;
          }

          const liveTarget = calculateLiveResources(tSnap.data(), uniSpeed, defResearches);
          const combat = Galaxy.resolveCombat(flt.fleet, flt.attackerResearches || {}, {
            fleet: liveTarget.fleet || {},
            defenses: liveTarget.defenses || {},
            tech: defResearches,
            resources: liveTarget.resources,
            buildings: liveTarget.buildings || {},
            moon: liveTarget.moon
          });

          const prevDebris = liveTarget.debris || { metal: 0, crystal: 0 };
          const updatedDebris = {
            metal: prevDebris.metal + combat.debris.metal,
            crystal: prevDebris.crystal + combat.debris.crystal
          };

          const updatedCargo = {
            metal: (flt.cargo.metal || 0) + combat.loot.metal,
            crystal: (flt.cargo.crystal || 0) + combat.loot.crystal,
            deuterium: (flt.cargo.deuterium || 0) + combat.loot.deuterium
          };

          let summaryText = `Scontro su [${flt.targetKey}] tra ${flt.attackerName} e ${liveTarget.ownerName}. Esito: ${combat.result.toUpperCase()} (${combat.roundsPlayed} round). Bottino: ${combat.loot.metal.toLocaleString()} M, ${combat.loot.crystal.toLocaleString()} C, ${combat.loot.deuterium.toLocaleString()} D.`;

          if (combat.planetDestroyed) {
            // 1% Morte Nera: pianeta polverizzato e reso di nuovo colonizzabile
            tx.set(targetRef, {
              coords: flt.targetCoords,
              ownerUid: null,
              ownerName: null,
              planetName: 'Slot Vuoto (Distrutto da Morte Nera)',
              resources: { metal: 0, crystal: 0, deuterium: 0 },
              buildings: {},
              defenses: {},
              fleet: {},
              moon: null,
              debris: updatedDebris,
              lastUpdated: now
            });
            summaryText += ' ☄️ UNA MORTE NERA HA DISINTEGRATO L’INTERO PIANETA!';
          } else {
            liveTarget.resources.metal = Math.max(0, liveTarget.resources.metal - combat.loot.metal);
            liveTarget.resources.crystal = Math.max(0, liveTarget.resources.crystal - combat.loot.crystal);
            liveTarget.resources.deuterium = Math.max(0, liveTarget.resources.deuterium - combat.loot.deuterium);
            liveTarget.fleet = combat.defenderFleetSurvivors;
            liveTarget.defenses = combat.repairedDefenses;
            liveTarget.debris = updatedDebris;
            if (combat.moonDestroyed && liveTarget.moon) {
              liveTarget.moon = null;
              summaryText += ' 🌑💥 LA LUNA È STATA DISTRUTTA!';
            }

            // Conquista pianeta nemico se distrutto tutto + nave colonizzatrice/madre sopravvissuta
            const noDefLeft =
              Object.keys(combat.defenderFleetSurvivors).length === 0 &&
              Object.keys(combat.repairedDefenses).length === 0;
            const hasConqShip = (combat.attackerSurvivors.colonyShip || 0) >= 1 || (combat.attackerSurvivors.mothership || 0) >= 1;

            if (flt.mission === 'attack' && combat.result === 'attacker_win' && noDefLeft && hasConqShip) {
              if ((combat.attackerSurvivors.colonyShip || 0) >= 1) {
                combat.attackerSurvivors.colonyShip -= 1;
              }
              liveTarget.ownerUid = flt.attackerUid;
              liveTarget.ownerName = flt.attackerName;
              summaryText += ` 👑 ${flt.attackerName} HA CONQUISTATO IL PIANETA!`;
            }

            liveTarget.lastUpdated = now;
            tx.set(targetRef, liveTarget);
          }

          // Invia rapporto di battaglia a entrambi i giocatori
          tx.set(uniRef.collection('messages').doc(), {
            recipientUid: flt.attackerUid,
            time: now,
            type: 'combat',
            title: `⚔️ Rapporto Battaglia PvP [${flt.targetKey}]`,
            body: summaryText
          });

          if (flt.defenderUid) {
            tx.set(uniRef.collection('messages').doc(), {
              recipientUid: flt.defenderUid,
              time: now,
              type: 'combat',
              title: `🛡️ Difesa Planetaria PvP [${flt.targetKey}]`,
              body: summaryText
            });
          }

          tx.update(fleetDocRef, {
            status: 'returning',
            fleet: combat.attackerSurvivors,
            cargo: updatedCargo
          });
          return;
        }

        // Altre missioni (es. explore): rientro semplice
        tx.update(fleetDocRef, { status: 'returning' });
      }

      // FASE 2: RIENTRO ALLA BASE (RETURNING -> COMPLETED)
      const freshSnap = await tx.get(fleetDocRef);
      const updatedFlt = freshSnap.data();
      if (updatedFlt && updatedFlt.status === 'returning' && now >= updatedFlt.returnTime) {
        const originRef = uniRef.collection('planets').doc(updatedFlt.originKey);
        const oSnap = await tx.get(originRef);

        if (oSnap.exists && oSnap.data().ownerUid === updatedFlt.attackerUid) {
          const homePlanet = oSnap.data();
          if (!homePlanet.fleet) homePlanet.fleet = {};
          for (const [id, qty] of Object.entries(updatedFlt.fleet || {})) {
            homePlanet.fleet[id] = (homePlanet.fleet[id] || 0) + qty;
          }
          homePlanet.resources.metal = (homePlanet.resources.metal || 0) + (updatedFlt.cargo?.metal || 0);
          homePlanet.resources.crystal = (homePlanet.resources.crystal || 0) + (updatedFlt.cargo?.crystal || 0);
          homePlanet.resources.deuterium = (homePlanet.resources.deuterium || 0) + (updatedFlt.cargo?.deuterium || 0);
          tx.set(originRef, homePlanet);
        }

        tx.delete(fleetDocRef);
      }
    });
  }

  async function resolveArrivedOnlineFleets(uniId) {
    const { db } = ensureFirebase();
    const user = getCurrentUser();
    if (!user) return;

    const uniRef = db.collection(COL_UNIVERSES).doc(uniId);
    const uniSnap = await uniRef.get();
    if (!uniSnap.exists) return;
    const uniSpeed = uniSnap.data().speed || 10;

    // Controlla sia flotte lanciate dal giocatore sia flotte dirette contro il giocatore
    const [outSnap, inSnap] = await Promise.all([
      uniRef.collection('fleets').where('attackerUid', '==', user.uid).get(),
      uniRef.collection('fleets').where('defenderUid', '==', user.uid).get()
    ]);

    const seenIds = new Set();
    const candidates = [];
    outSnap.forEach((doc) => {
      seenIds.add(doc.id);
      candidates.push(doc);
    });
    inSnap.forEach((doc) => {
      if (!seenIds.has(doc.id)) candidates.push(doc);
    });

    const now = Date.now();
    for (const doc of candidates) {
      const f = doc.data();
      const shouldProcess =
        (f.status === 'outbound' && now >= f.arrivalTime) ||
        (f.status === 'returning' && now >= f.returnTime);

      if (shouldProcess) {
        try {
          await resolveSingleArrivedFleet(uniId, uniSpeed, doc.ref);
        } catch (err) {
          console.warn('[MP] Errore risoluzione transazione flotta:', err);
        }
      }
    }
  }

  // Radar in tempo reale per attacchi / spionaggi nemici in arrivo
  function listenIncomingRadar(uniId, onAlertCallback) {
    const { db } = ensureFirebase();
    const user = getCurrentUser();
    if (!user) return;

    if (radarUnsubscribe) {
      radarUnsubscribe();
      radarUnsubscribe = null;
    }

    radarUnsubscribe = db.collection(COL_UNIVERSES).doc(uniId).collection('fleets')
      .where('defenderUid', '==', user.uid)
      .where('status', '==', 'outbound')
      .onSnapshot((snapshot) => {
        const incoming = snapshot.docs.map((d) => d.data());
        if (typeof onAlertCallback === 'function') {
          onAlertCallback(incoming);
        }
        if (incoming.length > 0 && window.UniversumUI) {
          window.UniversumUI.playSound?.('alarm');
          window.UniversumUI.toast?.(
            `🚨 RADAR PvP: ${incoming.length} flotta/e ostile/i in avvicinamento ai tuoi pianeti!`,
            'error'
          );
        }
      });
  }

  function startRealtimeListeners(uniId) {
    listenIncomingRadar(uniId, null);
    if (fleetSweepTimer) clearInterval(fleetSweepTimer);
    fleetSweepTimer = setInterval(() => {
      resolveArrivedOnlineFleets(uniId).catch(() => {});
    }, 5000);
  }

  function stopListeners() {
    if (radarUnsubscribe) {
      radarUnsubscribe();
      radarUnsubscribe = null;
    }
    if (chatUnsubscribe) {
      chatUnsubscribe();
      chatUnsubscribe = null;
    }
    if (fleetSweepTimer) {
      clearInterval(fleetSweepTimer);
      fleetSweepTimer = null;
    }
  }

  // =========================================================================
  // 6. CLASSIFICA GLOBALE E CHAT GALATTICA IN TEMPO REALE
  // =========================================================================
  async function getLeaderboard(uniId) {
    const { db } = ensureFirebase();
    const Data = window.UniversumData;
    const uniRef = db.collection(COL_UNIVERSES).doc(uniId);

    const [playersSnap, planetsSnap] = await Promise.all([
      uniRef.collection('players').get(),
      uniRef.collection('planets').get()
    ]);

    const scoreMap = {};
    playersSnap.forEach((doc) => {
      const p = doc.data();
      let researchPts = 0;
      for (const lv of Object.values(p.researches || {})) {
        researchPts += (Number(lv) || 0) * 350;
      }
      scoreMap[doc.id] = {
        uid: doc.id,
        nickname: p.nickname || 'Comandante',
        buildingPts: 0,
        researchPts,
        fleetPts: 0,
        planetCount: 0,
        totalPts: researchPts
      };
    });

    planetsSnap.forEach((doc) => {
      const pl = doc.data();
      if (!pl.ownerUid || !scoreMap[pl.ownerUid]) return;
      const entry = scoreMap[pl.ownerUid];
      entry.planetCount += 1;

      for (const lv of Object.values(pl.buildings || {})) {
        entry.buildingPts += (Number(lv) || 0) * 150;
      }
      for (const [sId, cnt] of Object.entries(pl.fleet || {})) {
        const spec = Data?.SHIPS?.[sId];
        if (spec) {
          entry.fleetPts += Math.floor(((spec.cost.metal + spec.cost.crystal + spec.cost.deuterium) / 1000) * cnt);
        }
      }
      entry.totalPts = entry.buildingPts + entry.researchPts + entry.fleetPts;
    });

    return Object.values(scoreMap).sort((a, b) => b.totalPts - a.totalPts);
  }

  async function sendChatMessage(uniId, text) {
    const { db } = ensureFirebase();
    const user = getCurrentUser();
    if (!user) throw new Error('Accedi per scrivere nella Chat Galattica.');

    const cleaned = String(text || '').trim().substring(0, 240);
    if (!cleaned) return;

    await db.collection(COL_UNIVERSES).doc(uniId).collection('chat').add({
      senderUid: user.uid,
      senderName: user.nickname,
      text: cleaned,
      time: Date.now()
    });
  }

  function listenChat(uniId, callback) {
    const { db } = ensureFirebase();
    if (chatUnsubscribe) {
      chatUnsubscribe();
      chatUnsubscribe = null;
    }

    chatUnsubscribe = db.collection(COL_UNIVERSES).doc(uniId).collection('chat')
      .orderBy('time', 'desc')
      .limit(40)
      .onSnapshot((snapshot) => {
        const msgs = snapshot.docs.map((d) => Object.assign({ id: d.id }, d.data())).reverse();
        if (typeof callback === 'function') {
          callback(msgs);
        }
      });

    return chatUnsubscribe;
  }

  // Esposizione API globale
  window.UniversumMP = {
    registerOrLogin,
    logout,
    getCurrentUser,
    getOnlineUniverses,
    createOnlineUniverse,
    joinOnlineUniverse,
    calculateLiveResources,
    syncPlanetState,
    renameOnlinePlanet,
    renameOnlineMoon,
    getOnlineSystem,
    launchOnlineFleet,
    resolveArrivedOnlineFleets,
    listenIncomingRadar,
    stopListeners,
    getLeaderboard,
    sendChatMessage,
    listenChat
  };
})();

