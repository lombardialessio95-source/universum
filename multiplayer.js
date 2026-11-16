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

  function parseCoordsKey(key) {
    const [g, s, p] = String(key).split('_').map(Number);
    return { g, s, p };
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
      lastUpdated: Date.now()
    };
  }

  // =========================================================
  // 1. AUTENTICAZIONE SEMPLIFICATA (NICKNAME + PASSWORD)
  // =========================================================
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

  // =========================================================
  // 2. GESTIONE UNIVERSI ONLINE (ZERO BOT O MAX 10 AVAMPOSTI)
  // =========================================================
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
        founderUid: d.founderUid,
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
    const count = 8 + Math.floor(Math.random() * 3); // 8 - 10 avamposti fissi

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

    await uniRef.set({
      name,
      founderUid: user.uid,
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

    // Carica ultimi messaggi di combattimento / spionaggio per il giocatore
    const msgSnap = await uniRef.collection('messages')
      .where('recipientUid', '==', user.uid)
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get()
      .catch(() => ({ docs: [] }));

    const messages = msgSnap.docs.map((d) => d.data());

    return {
      id: universeId,
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
      fleetsInFlight: [],
      incomingAttacks: [],
      spyReports: [],
      messages
    };
  }

  // =========================================================
  // 3. SINCRONIZZAZIONE RISORSE REAL-TIME E STATO GIOCATORE
  // =========================================================
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

  async function syncPlayerState(universeObj) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !universeObj?.id) return;

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

  // =========================================================
  // 4. GALASSIA CONDIVISA (ZERO BOT PROCEDURALI)
  // =========================================================
  async function getOnlineSystem(uniId, galaxy, system) {
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
  // 5. FLOTTE PvP, SPIONAGGIO, BATTAGLIE E RADAR REAL-TIME
  // =========================================================
  async function launchOnlineFleet(universeObj, originPlanetIndex, targetCoords, mission, shipsSelected, cargo = {}, options = {}) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user) throw new Error('Utente non autenticato.');

    const planet = universeObj.planets[originPlanetIndex];
    if (!planet) throw new Error('Pianeta di partenza non valido.');

    const cleanShips = {};
    let totalShips = 0;
    for (const [sId, count] of Object.entries(shipsSelected || {})) {
      const qty = Math.max(0, Math.floor(Number(count) || 0));
      if (qty > 0) {
        if ((planet.fleet[sId] || 0) < qty) {
          throw new Error(`Navi insufficienti (${sId}).`);
        }
        cleanShips[sId] = qty;
        totalShips += qty;
      }
    }
    if (totalShips === 0) throw new Error('Seleziona almeno una nave.');

    const dist = window.UniversumGalaxy.calculateDistance(planet.coords, targetCoords);
    const flightStats = window.UniversumGalaxy.getFleetSpeedAndFuel(universeObj, cleanShips, dist);

    const cargoM = Math.max(0, Math.floor(Number(cargo.metal) || 0));
    const cargoC = Math.max(0, Math.floor(Number(cargo.crystal) || 0));
    const cargoD = Math.max(0, Math.floor(Number(cargo.deuterium) || 0));

    if (planet.resources.metal < cargoM || planet.resources.crystal < cargoC || planet.resources.deuterium < cargoD + flightStats.fuelCost) {
      throw new Error('Risorse o Deuterio per il carburante insufficienti.');
    }

    // Scala navi e risorse dal pianeta locale e sincronizza
    for (const [sId, qty] of Object.entries(cleanShips)) {
      planet.fleet[sId] -= qty;
    }
    planet.resources.metal -= cargoM;
    planet.resources.crystal -= cargoC;
    planet.resources.deuterium -= (cargoD + flightStats.fuelCost);

    await syncPlayerState(universeObj);

    // Determina eventuale proprietario del pianeta bersaglio per notifiche radar
    const targetKey = coordsToKey(targetCoords);
    const uniRef = db.collection('online_universes').doc(universeObj.id);
    const targetSnap = await uniRef.collection('planets').doc(targetKey).get();
    const defenderUid = targetSnap.exists ? (targetSnap.data().ownerUid || null) : null;

    const now = Date.now();
    const arrivalTime = now + flightStats.durationSec * 1000;
    const returnTime = arrivalTime + flightStats.durationSec * 1000;

    const fleetDoc = {
      attackerUid: user.uid,
      attackerName: universeObj.emperor || user.displayName || 'Comandante',
      attackerTech: {
        weaponsTech: universeObj.researches?.weaponsTech || 0,
        shieldingTech: universeObj.researches?.shieldingTech || 0,
        armourTech: universeObj.researches?.armourTech || 0
      },
      defenderUid,
      originCoords: Object.assign({}, planet.coords),
      targetCoords: { g: Number(targetCoords.g), s: Number(targetCoords.s), p: Number(targetCoords.p) },
      targetKey,
      mission,
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
    universeObj.fleetsInFlight.push(fleetDoc);

    return fleetDoc;
  }

  function listenIncomingFleets(universeObj, callback) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !universeObj?.id) return () => {};

    return db.collection('online_universes').doc(universeObj.id).collection('fleets')
      .where('defenderUid', '==', user.uid)
      .where('status', '==', 'outbound')
      .onSnapshot((snap) => {
        const list = snap.docs
          .map((d) => Object.assign({ id: d.id }, d.data()))
          .filter((f) => f.attackerUid !== user.uid && (f.mission === 'attack' || f.mission === 'spy' || f.mission === 'destroyMoon'));
        callback(list);
      }, (err) => {
        console.warn('[MP Radar] Errore listener flotte in arrivo:', err);
      });
  }

  async function resolveArrivedOnlineFleets(uniId) {
    const db = getDB();
    const uniRef = db.collection('online_universes').doc(uniId);
    const now = Date.now();

    const arrivedSnap = await uniRef.collection('fleets')
      .where('status', '==', 'outbound')
      .where('arrivalTime', '<=', now)
      .limit(10)
      .get();

    if (arrivedSnap.empty) return;

    const uniSnap = await uniRef.get();
    const speed = uniSnap.exists ? (uniSnap.data().speed || 10) : 10;

    for (const fDoc of arrivedSnap.docs) {
      const fleet = fDoc.data();
      const fleetRef = fDoc.ref;
      const targetPlanetRef = uniRef.collection('planets').doc(fleet.targetKey);
      const originPlanetRef = uniRef.collection('planets').doc(coordsToKey(fleet.originCoords));

      try {
        await db.runTransaction(async (tx) => {
          const freshFleetSnap = await tx.get(fleetRef);
          if (!freshFleetSnap.exists || freshFleetSnap.data().resolved) return;

          const targetSnap = await tx.get(targetPlanetRef);
          const originSnap = await tx.get(originPlanetRef);

          const targetPlanet = targetSnap.exists ? calculateLiveResources(targetSnap.data(), speed) : null;
          const originPlanet = originSnap.exists ? calculateLiveResources(originSnap.data(), speed) : null;

          let reportTitle = `Missione ${fleet.mission.toUpperCase()} [${fleet.targetKey}]`;
          let reportBody = 'Missione completata.';

          if (fleet.mission === 'spy' && targetPlanet) {
            reportTitle = `👁️ Rapporto Spionaggio su ${targetPlanet.name} [${fleet.targetKey}]`;
            reportBody = `Risorse rilevate — Metallo: ${Math.floor(targetPlanet.resources.metal)}, Cristallo: ${Math.floor(targetPlanet.resources.crystal)}, Deuterio: ${Math.floor(targetPlanet.resources.deuterium)}.`;
          } else if (fleet.mission === 'transport' && targetPlanet) {
            targetPlanet.resources.metal += fleet.cargo.metal || 0;
            targetPlanet.resources.crystal += fleet.cargo.crystal || 0;
            targetPlanet.resources.deuterium += fleet.cargo.deuterium || 0;
            tx.set(targetPlanetRef, targetPlanet, { merge: true });
            reportTitle = `📦 Consegna Risorse su ${targetPlanet.name}`;
            reportBody = `Consegnati ${fleet.cargo.metal} M, ${fleet.cargo.crystal} C, ${fleet.cargo.deuterium} D.`;
          } else if (fleet.mission === 'colonize' && !targetPlanet) {
            const newColony = createStarterPlanetDoc(
              uniId,
              fleet.targetCoords,
              fleet.attackerUid,
              fleet.attackerName,
              `Colonia ${fleet.targetKey}`,
              false
            );
            tx.set(targetPlanetRef, newColony);
            reportTitle = `🌍 Nuova Colonia Fondata [${fleet.targetKey}]`;
            reportBody = `Il pianeta in coordinate [${fleet.targetKey}] è ora sotto il tuo comando.`;
          } else if (fleet.mission === 'attack' && targetPlanet && window.UniversumGalaxy?.resolveCombat) {
            const combat = window.UniversumGalaxy.resolveCombat(
              fleet.ships,
              fleet.attackerTech,
              {
                fleet: targetPlanet.fleet || {},
                defenses: targetPlanet.defenses || {},
                tech: { weaponsTech: 0, shieldingTech: 0, armourTech: 0 },
                resources: targetPlanet.resources,
                buildings: targetPlanet.buildings || {},
                moon: targetPlanet.moon || null
              }
            );

            targetPlanet.fleet = combat.defenderSurvivors;
            targetPlanet.defenses = combat.defenderDefenseSurvivors;
            targetPlanet.resources.metal = Math.max(0, targetPlanet.resources.metal - combat.loot.metal);
            targetPlanet.resources.crystal = Math.max(0, targetPlanet.resources.crystal - combat.loot.crystal);
            targetPlanet.resources.deuterium = Math.max(0, targetPlanet.resources.deuterium - combat.loot.deuterium);
            targetPlanet.debris = {
              metal: (targetPlanet.debris?.metal || 0) + combat.debris.metal,
              crystal: (targetPlanet.debris?.crystal || 0) + combat.debris.crystal
            };
            tx.set(targetPlanetRef, targetPlanet, { merge: true });

            if (originPlanet) {
              for (const [sId, surv] of Object.entries(combat.attackerSurvivors)) {
                originPlanet.fleet[sId] = (originPlanet.fleet[sId] || 0) + surv;
              }
              originPlanet.resources.metal += combat.loot.metal;
              originPlanet.resources.crystal += combat.loot.crystal;
              originPlanet.resources.deuterium += combat.loot.deuterium;
              tx.set(originPlanetRef, originPlanet, { merge: true });
            }

            reportTitle = `⚔️ Battaglia PvP su ${targetPlanet.name} [${fleet.targetKey}]`;
            reportBody = `Esito: ${combat.result}. Bottino: ${combat.loot.metal} M, ${combat.loot.crystal} C, ${combat.loot.deuterium} D.`;
          }

          // Ritorno immediato navi superstiti per missioni non di combattimento
          if (fleet.mission !== 'attack' && originPlanet) {
            for (const [sId, qty] of Object.entries(fleet.ships)) {
              if (fleet.mission === 'colonize' && sId === 'colonyShip') continue;
              originPlanet.fleet[sId] = (originPlanet.fleet[sId] || 0) + qty;
            }
            tx.set(originPlanetRef, originPlanet, { merge: true });
          }

          tx.update(fleetRef, { status: 'completed', resolved: true });

          const msgAttRef = uniRef.collection('messages').doc();
          tx.set(msgAttRef, {
            recipientUid: fleet.attackerUid,
            title: reportTitle,
            body: reportBody,
            timestamp: now
          });

          if (fleet.defenderUid && fleet.defenderUid !== fleet.attackerUid && !targetPlanet?.isNpc) {
            const msgDefRef = uniRef.collection('messages').doc();
            tx.set(msgDefRef, {
              recipientUid: fleet.defenderUid,
              title: `🚨 ${reportTitle}`,
              body: `Attaccante: ${fleet.attackerName}. ${reportBody}`,
              timestamp: now
            });
          }
        });
      } catch (err) {
        console.warn('[MP Transaction] Risoluzione flotta rinviata:', err);
      }
    }
  }

  // =========================================================
  // 6. CLASSIFICA GLOBALE (SOLO GIOCATORI UMANI)
  // =========================================================
  async function getLeaderboard(uniId) {
    const db = getDB();
    const snap = await db.collection('online_universes').doc(uniId).collection('players')
      .orderBy('points', 'desc')
      .limit(50)
      .get();

    return snap.docs.map((d) => d.data());
  }

  // =========================================================
  // 7. CHAT GALATTICA (LIMITE ULTIMI 50 MESSAGGI)
  // =========================================================
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
      .limit(50)
      .onSnapshot((snap) => {
        const messages = snap.docs
          .map((d) => Object.assign({ id: d.id }, d.data()))
          .reverse();
        callback(messages);
      }, (err) => {
        console.warn('[MP Chat] Errore listener chat galattica:', err);
      });
  }

  // =========================================================
  // 8. MESSAGGI PRIVATI TRA GIOCATORI (LIMITE 15 MESSAGGI)
  // =========================================================
  function _getPrivateChatId(uid1, uid2) {
    return [String(uid1), String(uid2)].sort().join('_');
  }

  async function getUniversePlayers(uniId) {
    const auth = getAuth();
    const db = getDB();
    const myUid = auth.currentUser?.uid;
    if (!myUid) return [];

    const snap = await db.collection('online_universes').doc(uniId).collection('players')
      .orderBy('nickname', 'asc')
      .get();

    return snap.docs
      .map((d) => d.data())
      .filter((p) => p.uid && p.uid !== myUid)
      .map((p) => ({
        uid: p.uid,
        nickname: p.nickname || 'Comandante'
      }));
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

    // 1. Aggiunge il nuovo messaggio nella sottoraccolta
    await messagesColRef.add({
      senderUid: myUid,
      senderName: myName,
      text: cleanText,
      timestamp: now
    });

    // 2. Aggiorna i metadati della stanza padre
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

    // 3. Pulizia in background dei messaggi oltre il 15° più recente
    messagesColRef.orderBy('timestamp', 'desc').get().then((snap) => {
      if (snap.size > 15) {
        const batch = db.batch();
        snap.docs.slice(15).forEach((oldDoc) => batch.delete(oldDoc.ref));
        return batch.commit();
      }
    }).catch(() => {});
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
        // Azzera il flag unreadFor se la chat era non letta dall'utente corrente
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

  window.UniversumMP = {
    registerOrLogin,
    getOnlineUniverses,
    createOnlineUniverse,
    joinOnlineUniverse,
    calculateLiveResources,
    syncPlayerState,
    renameOnlinePlanet,
    renameOnlineMoon,
    getOnlineSystem,
    launchOnlineFleet,
    listenIncomingFleets,
    resolveArrivedOnlineFleets,
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
