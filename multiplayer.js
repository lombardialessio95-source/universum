// =========================================================
// UNIVERSUM - MOTORE MULTIPLAYER ONLINE (window.UniversumMP)
// =========================================================

window.UniversumMP = (function () {
  const EMAIL_DOMAIN = "@universum.pvp";

  function getAuth() {
    if (!window.fbAuth) throw new Error("Firebase Auth non inizializzato.");
    return window.fbAuth;
  }

  function getDB() {
    if (!window.fbDB) throw new Error("Firestore non inizializzato.");
    return window.fbDB;
  }

  function nicknameToEmail(nickname) {
    const clean = String(nickname || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (clean.length < 3) {
      throw new Error("Il nickname deve avere almeno 3 caratteri alfanumerici.");
    }
    return clean + EMAIL_DOMAIN;
  }

  function defaultBuildings() {
    return {
      metalMine: 1,
      crystalMine: 1,
      deuteriumSynth: 0,
      solarPlant: 1,
      fusionReactor: 0,
      shipyard: 0,
      roboticsFactory: 0,
      naniteFactory: 0,
      researchLab: 0,
      metalStorage: 0,
      crystalStorage: 0,
      deuteriumTank: 0,
      terraformer: 0,
      hiddenBunker: 0
    };
  }

  function defaultResearches() {
    return {
      energyTech: 0,
      laserTech: 0,
      ionTech: 0,
      plasmaTech: 0,
      hyperspaceTech: 0,
      combustionDrive: 0,
      impulseDrive: 0,
      hyperspaceDrive: 0,
      weaponsTech: 0,
      shieldingTech: 0,
      armourTech: 0,
      espionageTech: 0,
      computerTech: 0,
      astrophysics: 0,
      intergalacticNetwork: 0,
      jumpGateTech: 0,
      lunarTech: 0,
      deathStarTech: 0
    };
  }

  // ---------------------------------------------------------
  // 1. AUTENTICAZIONE (NICKNAME + PASSWORD)
  // ---------------------------------------------------------
  async function registerOrLogin(nickname, password, isRegister) {
    const auth = getAuth();
    const db = getDB();
    const email = nicknameToEmail(nickname);
    const displayNick = String(nickname).trim().slice(0, 20);

    if (!password || password.length < 6) {
      throw new Error("La password deve contenere almeno 6 caratteri.");
    }

    let cred;
    if (isRegister) {
      cred = await auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: displayNick });
      await db.collection("users").doc(cred.user.uid).set({
        uid: cred.user.uid,
        nickname: displayNick,
        createdAt: Date.now()
      });
    } else {
      cred = await auth.signInWithEmailAndPassword(email, password);
    }

    return {
      uid: cred.user.uid,
      nickname: cred.user.displayName || displayNick
    };
  }

  async function logout() {
    await getAuth().signOut();
  }

  function getCurrentUser() {
    const user = getAuth().currentUser;
    if (!user) return null;
    return {
      uid: user.uid,
      nickname: user.displayName || user.email.split("@")[0]
    };
  }

  // ---------------------------------------------------------
  // 2. LOBBY UNIVERSI ONLINE (ZERO BOT O MAX 10 AVAMPOSTI)
  // ---------------------------------------------------------
  async function getOnlineUniverses() {
    const db = getDB();
    const snap = await db
      .collection("online_universes")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async function createOnlineUniverse(config) {
    const db = getDB();
    const user = getCurrentUser();
    if (!user) throw new Error("Devi effettuare l'accesso prima di creare un universo.");

    const uniData = {
      name: String(config.name || "Universo Alpha").trim().slice(0, 28),
      speed: Number(config.speed) || 10,
      galaxies: Number(config.galaxies) || 3,
      systemsPerGalaxy: Number(config.systemsPerGalaxy) || 100,
      npcMode: config.npcMode === "limited" ? "limited" : "none", // 'none' = 0 BOT, 'limited' = max 10 avamposti passivi
      hasPassword: Boolean(config.password && config.password.trim().length > 0),
      password: config.password ? config.password.trim() : "",
      creativeMode: false, // Sempre disabilitata in Multiplayer
      creatorUid: user.uid,
      creatorName: user.nickname,
      playerCount: 0,
      createdAt: Date.now()
    };

    const ref = await db.collection("online_universes").add(uniData);

    // Se 'limited', genera UNA SOLA VOLTA 8 avamposti neutrali passivi
    if (uniData.npcMode === "limited") {
      const batch = db.batch();
      const outpostNames = [
        "Avamposto Mercante I",
        "Stazione Mineraria Vega",
        "Covo Pirata Nebulosa",
        "Raffineria Orbitale",
        "Avamposto Mercante II",
        "Relitto Commerciale",
        "Base Neutrale Orione",
        "Deposito Galattico"
      ];

      for (let i = 0; i < outpostNames.length; i++) {
        const g = (i % uniData.galaxies) + 1;
        const s = Math.max(1, Math.floor(((i + 1) / (outpostNames.length + 1)) * uniData.systemsPerGalaxy));
        const p = ((i * 3) % 12) + 2;
        const coords = `${g}:${s}:${p}`;

        const planetRef = ref.collection("planets").doc(coords);
        batch.set(planetRef, {
          coords,
          galaxy: g,
          system: s,
          position: p,
          ownerUid: "NEUTRAL_OUTPOST",
          ownerName: "Avamposto Neutrale",
          isNpc: true,
          planetName: outpostNames[i],
          temperature: 15,
          fieldsMax: 200,
          resources: { metal: 50000, crystal: 35000, deuterium: 15000 },
          buildings: { metalMine: 8, crystalMine: 7, deuteriumSynth: 5, solarPlant: 10 },
          defenses: { rocketLauncher: 15, lightLaser: 8 },
          fleet: { smallCargo: 10, lightFighter: 12 },
          moon: null,
          debris: { metal: 0, crystal: 0 },
          lastUpdated: Date.now()
        });
      }
      await batch.commit();
    }

    return ref.id;
  }

  async function joinOnlineUniverse(uniId, passwordInput = "") {
    const db = getDB();
    const user = getCurrentUser();
    if (!user) throw new Error("Devi effettuare l'accesso.");

    const uniRef = db.collection("online_universes").doc(uniId);
    const uniSnap = await uniRef.get();
    if (!uniSnap.exists) throw new Error("Universo non trovato.");

    const uni = { id: uniSnap.id, ...uniSnap.data() };
    if (uni.hasPassword && uni.password !== String(passwordInput).trim()) {
      throw new Error("Codice stanza errato.");
    }

    const playerRef = uniRef.collection("players").doc(user.uid);
    const playerSnap = await playerRef.get();

    // Primo ingresso del giocatore: assegna pianeta madre libero
    if (!playerSnap.exists) {
      let assignedCoords = null;
      let g = 1, s = 1, p = 4;

      for (let attempt = 0; attempt < 40; attempt++) {
        g = Math.floor(Math.random() * uni.galaxies) + 1;
        s = Math.floor(Math.random() * uni.systemsPerGalaxy) + 1;
        p = Math.floor(Math.random() * 9) + 4; // posizioni temperate 4-12
        const candidate = `${g}:${s}:${p}`;
        const check = await uniRef.collection("planets").doc(candidate).get();
        if (!check.exists) {
          assignedCoords = candidate;
          break;
        }
      }

      if (!assignedCoords) {
        throw new Error("Nessuno slot libero trovato, riprova.");
      }

      const temp = Math.floor(Math.random() * 80) - 20;
      const homePlanet = {
        coords: assignedCoords,
        galaxy: g,
        system: s,
        position: p,
        ownerUid: user.uid,
        ownerName: user.nickname,
        isNpc: false,
        planetName: "Pianeta Madre",
        temperature: temp,
        fieldsMax: 220,
        resources: { metal: 5000, crystal: 5000, deuterium: 1000 },
        buildings: defaultBuildings(),
        defenses: {},
        fleet: {},
        moon: null,
        debris: { metal: 0, crystal: 0 },
        lastUpdated: Date.now()
      };

      const batch = db.batch();
      batch.set(uniRef.collection("planets").doc(assignedCoords), homePlanet);
      batch.set(playerRef, {
        uid: user.uid,
        nickname: user.nickname,
        researches: defaultResearches(),
        points: 10,
        joinedAt: Date.now()
      });
      batch.update(uniRef, {
        playerCount: firebase.firestore.FieldValue.increment(1)
      });
      await batch.commit();
    }

    return await loadPlayerOnlineState(uniId);
  }

  async function loadPlayerOnlineState(uniId) {
    const db = getDB();
    const user = getCurrentUser();
    const uniRef = db.collection("online_universes").doc(uniId);

    const [uniSnap, playerSnap, planetsSnap] = await Promise.all([
      uniRef.get(),
      uniRef.collection("players").doc(user.uid).get(),
      uniRef.collection("planets").where("ownerUid", "==", user.uid).get()
    ]);

    const uni = { id: uniSnap.id, ...uniSnap.data() };
    const player = playerSnap.data();
    const planets = planetsSnap.docs.map((d) => calculateLiveResources(d.data(), uni.speed));

    return {
      universe: uni,
      player,
      planets
    };
  }

  // ---------------------------------------------------------
  // 3. CALCOLO RISORSE LIVE E SINCRONIZZAZIONE PIANETI
  // ---------------------------------------------------------
  function calculateLiveResources(planetDoc, speed = 1) {
    const now = Date.now();
    const last = planetDoc.lastUpdated || now;
    const elapsedHours = Math.max(0, (now - last) / 3600000);
    const b = planetDoc.buildings || {};

    // Usa UniversumEngine se disponibile, altrimenti formula standard
    let prodPerHour = { metal: 30 * speed, crystal: 15 * speed, deuterium: 0, energy: 0 };
    if (window.UniversumEngine && typeof window.UniversumEngine.getPlanetProduction === "function") {
      try {
        prodPerHour = window.UniversumEngine.getPlanetProduction(planetDoc, { speed, creativeMode: false });
      } catch (e) {
        // fallback silenzioso
      }
    } else {
      const mLv = b.metalMine || 0;
      const cLv = b.crystalMine || 0;
      const dLv = b.deuteriumSynth || 0;
      const sLv = b.solarPlant || 0;

      const energyProd = Math.floor(20 * sLv * Math.pow(1.1, sLv));
      const energyCons =
        Math.floor(10 * mLv * Math.pow(1.1, mLv)) +
        Math.floor(10 * cLv * Math.pow(1.1, cLv)) +
        Math.floor(20 * dLv * Math.pow(1.1, dLv));
      const efficiency = energyCons > 0 ? Math.min(1, energyProd / energyCons) : 1;

      prodPerHour = {
        metal: Math.floor((30 + 30 * mLv * Math.pow(1.1, mLv) * efficiency) * speed),
        crystal: Math.floor((15 + 20 * cLv * Math.pow(1.1, cLv) * efficiency) * speed),
        deuterium: Math.floor((10 * dLv * Math.pow(1.1, dLv) * efficiency) * speed),
        energy: energyProd - energyCons
      };
    }

    const capM = 10000 * Math.pow(2, b.metalStorage || 0);
    const capC = 10000 * Math.pow(2, b.crystalStorage || 0);
    const capD = 10000 * Math.pow(2, b.deuteriumTank || 0);

    const res = planetDoc.resources || { metal: 0, crystal: 0, deuterium: 0 };
    return {
      ...planetDoc,
      resources: {
        metal: Math.min(capM, Math.floor(res.metal + (prodPerHour.metal || 0) * elapsedHours)),
        crystal: Math.min(capC, Math.floor(res.crystal + (prodPerHour.crystal || 0) * elapsedHours)),
        deuterium: Math.min(capD, Math.floor(res.deuterium + (prodPerHour.deuterium || 0) * elapsedHours))
      },
      productionPerHour: prodPerHour
    };
  }

  async function syncPlanetToCloud(uniId, planetDoc) {
    const db = getDB();
    const { productionPerHour, ...cleanDoc } = planetDoc;
    cleanDoc.lastUpdated = Date.now();
    await db
      .collection("online_universes")
      .doc(uniId)
      .collection("planets")
      .doc(planetDoc.coords)
      .set(cleanDoc, { merge: true });
  }

  async function renameOnlinePlanet(uniId, coords, newName) {
    const clean = String(newName || "").trim().slice(0, 24);
    if (!clean) throw new Error("Nome pianeta non valido.");
    await getDB()
      .collection("online_universes")
      .doc(uniId)
      .collection("planets")
      .doc(coords)
      .update({ planetName: clean });
    return clean;
  }

  async function renameOnlineMoon(uniId, coords, newName) {
    const clean = String(newName || "").trim().slice(0, 24);
    if (!clean) throw new Error("Nome Luna non valido.");
    await getDB()
      .collection("online_universes")
      .doc(uniId)
      .collection("planets")
      .doc(coords)
      .update({ "moon.name": clean });
    return clean;
  }

  // ---------------------------------------------------------
  // 4. GALASSIA CONDIVISA (SOLO GIOCATORI UMANI + EVENTUALI AVAMPOSTI)
  // ---------------------------------------------------------
  async function getOnlineSystem(uniId, galaxy, system, speed = 1) {
    const db = getDB();
    const snap = await db
      .collection("online_universes")
      .doc(uniId)
      .collection("planets")
      .where("galaxy", "==", Number(galaxy))
      .where("system", "==", Number(system))
      .get();

    const occupiedMap = {};
    snap.docs.forEach((doc) => {
      const data = calculateLiveResources(doc.data(), speed);
      occupiedMap[data.position] = data;
    });

    const slots = [];
    for (let pos = 1; pos <= 15; pos++) {
      if (occupiedMap[pos]) {
        slots.push({
          position: pos,
          coords: `${galaxy}:${system}:${pos}`,
          empty: false,
          ...occupiedMap[pos]
        });
      } else {
        slots.push({
          position: pos,
          coords: `${galaxy}:${system}:${pos}`,
          empty: true,
          planetName: "Pianeta Disabitato",
          ownerUid: null,
          ownerName: null,
          isNpc: false,
          debris: { metal: 0, crystal: 0 }
        });
      }
    }
    return slots;
  }

  // ---------------------------------------------------------
  // 5. MOVIMENTI FLOTTA PvP, RADAR E RISOLUZIONE TRANSAZIONALE
  // ---------------------------------------------------------
  function calculateFlightTimeSeconds(originCoords, targetCoords, speed = 1) {
    const [g1, s1, p1] = originCoords.split(":").map(Number);
    const [g2, s2, p2] = targetCoords.split(":").map(Number);
    let distance = 1000;
    if (g1 !== g2) distance = Math.abs(g1 - g2) * 20000;
    else if (s1 !== s2) distance = Math.abs(s1 - s2) * 95 + 2700;
    else distance = Math.abs(p1 - p2) * 5 + 1000;

    return Math.max(5, Math.floor((distance / 50) / Math.max(1, speed)));
  }

  async function launchOnlineFleet(uniId, originCoords, targetCoords, mission, fleet, cargo = { metal: 0, crystal: 0, deuterium: 0 }) {
    const db = getDB();
    const user = getCurrentUser();
    if (!user) throw new Error("Non autenticato.");

    const uniRef = db.collection("online_universes").doc(uniId);
    const uniSnap = await uniRef.get();
    const speed = uniSnap.data().speed || 1;

    const originRef = uniRef.collection("planets").doc(originCoords);
    const targetRef = uniRef.collection("planets").doc(targetCoords);

    const [originSnap, targetSnap] = await Promise.all([originRef.get(), targetRef.get()]);
    if (!originSnap.exists) throw new Error("Pianeta di partenza non trovato.");

    const originPlanet = calculateLiveResources(originSnap.data(), speed);
    if (originPlanet.ownerUid !== user.uid) throw new Error("Non sei il proprietario di questo pianeta.");

    // Verifica e scala navi + cargo
    const updatedFleet = { ...(originPlanet.fleet || {}) };
    let totalShips = 0;
    for (const [shipId, qty] of Object.entries(fleet || {})) {
      const count = Math.max(0, Math.floor(Number(qty) || 0));
      if (count > 0) {
        if ((updatedFleet[shipId] || 0) < count) {
          throw new Error(`Navi insufficienti: ${shipId}`);
        }
        updatedFleet[shipId] -= count;
        totalShips += count;
      }
    }
    if (totalShips === 0) throw new Error("Seleziona almeno una nave.");

    const fuelCost = Math.max(10, Math.floor(totalShips * 15));
    const totalDeutNeeded = fuelCost + (cargo.deuterium || 0);
    if (
      originPlanet.resources.metal < (cargo.metal || 0) ||
      originPlanet.resources.crystal < (cargo.crystal || 0) ||
      originPlanet.resources.deuterium < totalDeutNeeded
    ) {
      throw new Error("Risorse o Deuterio insufficienti per il viaggio.");
    }

    originPlanet.resources.metal -= cargo.metal || 0;
    originPlanet.resources.crystal -= cargo.crystal || 0;
    originPlanet.resources.deuterium -= totalDeutNeeded;
    originPlanet.fleet = updatedFleet;
    originPlanet.lastUpdated = Date.now();

    const durationSec = calculateFlightTimeSeconds(originCoords, targetCoords, speed);
    const arrivalTime = Date.now() + durationSec * 1000;
    const targetData = targetSnap.exists ? targetSnap.data() : null;

    const batch = db.batch();
    batch.set(originRef, originPlanet);
    batch.set(uniRef.collection("fleets").doc(), {
      status: "active",
      mission,
      attackerUid: user.uid,
      attackerName: user.nickname,
      originCoords,
      targetCoords,
      targetOwnerUid: targetData ? targetData.ownerUid : null,
      fleet,
      cargo,
      departureTime: Date.now(),
      arrivalTime
    });

    await batch.commit();
    return { arrivalTime, durationSec };
  }

  function listenIncomingRadar(uniId, uid, callback) {
    return getDB()
      .collection("online_universes")
      .doc(uniId)
      .collection("fleets")
      .where("targetOwnerUid", "==", uid)
      .where("status", "==", "active")
      .onSnapshot((snap) => {
        const incoming = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        callback(incoming);
      });
  }

  async function resolveArrivedOnlineFleets(uniId) {
    const db = getDB();
    const uniRef = db.collection("online_universes").doc(uniId);
    const uniSnap = await uniRef.get();
    if (!uniSnap.exists) return;
    const speed = uniSnap.data().speed || 1;

    const now = Date.now();
    const snap = await uniRef
      .collection("fleets")
      .where("status", "==", "active")
      .where("arrivalTime", "<=", now)
      .limit(10)
      .get();

    for (const fleetDoc of snap.docs) {
      await db.runTransaction(async (tx) => {
        const freshFleetSnap = await tx.get(fleetDoc.ref);
        if (!freshFleetSnap.exists || freshFleetSnap.data().status !== "active") return;

        const f = freshFleetSnap.data();
        const targetRef = uniRef.collection("planets").doc(f.targetCoords);
        const originRef = uniRef.collection("planets").doc(f.originCoords);
        const [targetSnap, originSnap] = await Promise.all([tx.get(targetRef), tx.get(originRef)]);

        const sendReport = (toUid, title, body) => {
          if (!toUid || toUid === "NEUTRAL_OUTPOST") return;
          const msgRef = uniRef.collection("messages").doc();
          tx.set(msgRef, {
            toUid,
            title,
            body,
            coords: f.targetCoords,
            createdAt: Date.now(),
            read: false
          });
        };

        // --- COLONIZZAZIONE ---
        if (f.mission === "colonize") {
          if (!targetSnap.exists && (f.fleet.colonyShip || 0) >= 1) {
            const [g, s, p] = f.targetCoords.split(":").map(Number);
            const remainingFleet = { ...f.fleet };
            remainingFleet.colonyShip -= 1;

            tx.set(targetRef, {
              coords: f.targetCoords,
              galaxy: g,
              system: s,
              position: p,
              ownerUid: f.attackerUid,
              ownerName: f.attackerName,
              isNpc: false,
              planetName: "Nuova Colonia",
              temperature: Math.floor(Math.random() * 80) - 20,
              fieldsMax: 210,
              resources: {
                metal: 1000 + (f.cargo?.metal || 0),
                crystal: 1000 + (f.cargo?.crystal || 0),
                deuterium: f.cargo?.deuterium || 0
              },
              buildings: defaultBuildings(),
              defenses: {},
              fleet: remainingFleet,
              moon: null,
              debris: { metal: 0, crystal: 0 },
              lastUpdated: Date.now()
            });
            sendReport(f.attackerUid, `Colonia Fondata [${f.targetCoords}]`, "La tua Nave Colonizzatrice ha fondato un nuovo pianeta!");
          } else {
            returnFleetToOrigin(tx, originSnap, originRef, f.fleet, f.cargo, speed);
            sendReport(f.attackerUid, `Colonizzazione Fallita [${f.targetCoords}]`, "Il pianeta era già occupato. La flotta è rientrata.");
          }
          tx.update(fleetDoc.ref, { status: "completed" });
          return;
        }

        // --- TRASPORTO / STAZIONA ---
        if ((f.mission === "transport" || f.mission === "deploy") && targetSnap.exists) {
          const target = calculateLiveResources(targetSnap.data(), speed);
          target.resources.metal += f.cargo?.metal || 0;
          target.resources.crystal += f.cargo?.crystal || 0;
          target.resources.deuterium += f.cargo?.deuterium || 0;
          if (f.mission === "deploy" && target.ownerUid === f.attackerUid) {
            for (const [k, v] of Object.entries(f.fleet)) {
              target.fleet[k] = (target.fleet[k] || 0) + v;
            }
          } else {
            returnFleetToOrigin(tx, originSnap, originRef, f.fleet, { metal: 0, crystal: 0, deuterium: 0 }, speed);
          }
          target.lastUpdated = Date.now();
          tx.set(targetRef, target);
          sendReport(f.attackerUid, `Consegna Completata [${f.targetCoords}]`, "Risorse consegnate a destinazione.");
          tx.update(fleetDoc.ref, { status: "completed" });
          return;
        }

        // --- SPIONAGGIO ---
        if (f.mission === "spy" && targetSnap.exists) {
          const target = calculateLiveResources(targetSnap.data(), speed);
          const reportText = `Risorse: M ${target.resources.metal} | C ${target.resources.crystal} | D ${target.resources.deuterium}\nNavi: ${JSON.stringify(target.fleet)}\nDifese: ${JSON.stringify(target.defenses)}`;
          sendReport(f.attackerUid, `Rapporto Spionaggio [${f.targetCoords}] (${target.ownerName})`, reportText);
          sendReport(target.ownerUid, `Attività Spionaggio Rilevata [${f.targetCoords}]`, `Sonde spia di ${f.attackerName} hanno scansionato il tuo pianeta.`);
          returnFleetToOrigin(tx, originSnap, originRef, f.fleet, f.cargo, speed);
          tx.update(fleetDoc.ref, { status: "completed" });
          return;
        }

        // --- RICICLAGGIO DETRITI ---
        if (f.mission === "recycle" && targetSnap.exists) {
          const target = targetSnap.data();
          const recCount = f.fleet.recycler || 0;
          const cap = recCount * 20000;
          const takeM = Math.min(target.debris?.metal || 0, Math.floor(cap / 2));
          const takeC = Math.min(target.debris?.crystal || 0, cap - takeM);
          target.debris = {
            metal: Math.max(0, (target.debris?.metal || 0) - takeM),
            crystal: Math.max(0, (target.debris?.crystal || 0) - takeC)
          };
          tx.set(targetRef, target);
          returnFleetToOrigin(tx, originSnap, originRef, f.fleet, { metal: takeM, crystal: takeC, deuterium: 0 }, speed);
          sendReport(f.attackerUid, `Detriti Raccolti [${f.targetCoords}]`, `Raccolti ${takeM} Metallo e ${takeC} Cristallo.`);
          tx.update(fleetDoc.ref, { status: "completed" });
          return;
        }

        // --- ATTACCO PvP / DISTRUZIONE ---
        if ((f.mission === "attack" || f.mission === "destroyMoon") && targetSnap.exists) {
          const target = calculateLiveResources(targetSnap.data(), speed);
          const attackerSnap = await tx.get(uniRef.collection("players").doc(f.attackerUid));
          const defenderSnap = target.isNpc ? null : await tx.get(uniRef.collection("players").doc(target.ownerUid));

          const attTech = attackerSnap.exists ? attackerSnap.data().researches : defaultResearches();
          const defTech = defenderSnap && defenderSnap.exists ? defenderSnap.data().researches : defaultResearches();

          const battle = runPvPCombat(f.fleet, attTech, target, defTech);

          if (battle.winner === "attacker") {
            target.resources.metal = Math.max(0, target.resources.metal - battle.loot.metal);
            target.resources.crystal = Math.max(0, target.resources.crystal - battle.loot.crystal);
            target.resources.deuterium = Math.max(0, target.resources.deuterium - battle.loot.deuterium);
            target.fleet = {};
            target.defenses = battle.remainingDefenses;
            target.debris = {
              metal: (target.debris?.metal || 0) + battle.debris.metal,
              crystal: (target.debris?.crystal || 0) + battle.debris.crystal
            };

            let extraLog = "";
            const dsCount = battle.survivingAttacker.deathStar || 0;

            // Effetto Morte Nera: 10% Luna, 1% Pianeta
            if (dsCount > 0) {
              for (let i = 0; i < dsCount; i++) {
                if (target.moon && Math.random() < 0.1) {
                  target.moon = null;
                  extraLog += "\nLA MORTE NERA HA DISTRUTTO LA LUNA!";
                }
                if (!target.isNpc && Math.random() < 0.01) {
                  tx.delete(targetRef);
                  extraLog += "\nLA MORTE NERA HA DISTRUTTO L'INTERO PIANETA!";
                  returnFleetToOrigin(tx, originSnap, originRef, battle.survivingAttacker, battle.loot, speed);
                  sendReport(f.attackerUid, `Vittoria Apocalittica [${f.targetCoords}]`, `Hai vinto lo scontro e saccheggiato risorse!${extraLog}`);
                  sendReport(target.ownerUid, `Pianeta Distrutto [${f.targetCoords}]`, `${f.attackerName} ha distrutto il tuo pianeta con una Morte Nera!${extraLog}`);
                  tx.update(fleetDoc.ref, { status: "completed" });
                  return;
                }
              }
            }

            // Conquista se presente Colonizzatrice o Nave Madre
            const hasConquerShip = (battle.survivingAttacker.colonyShip || 0) > 0 || (battle.survivingAttacker.mothership || 0) > 0;
            if (!target.isNpc && hasConquerShip && Object.keys(battle.remainingDefenses).length === 0) {
              target.ownerUid = f.attackerUid;
              target.ownerName = f.attackerName;
              extraLog += "\nPIANETA CONQUISTATO!";
            }

            target.lastUpdated = Date.now();
            tx.set(targetRef, target);
            returnFleetToOrigin(tx, originSnap, originRef, battle.survivingAttacker, battle.loot, speed);

            sendReport(f.attackerUid, `Vittoria PvP [${f.targetCoords}]`, `Bottino: M ${battle.loot.metal}, C ${battle.loot.crystal}, D ${battle.loot.deuterium}.${extraLog}`);
            sendReport(target.ownerUid, `Sconfitta Difensiva [${f.targetCoords}]`, `${f.attackerName} ha attaccato il tuo pianeta!${extraLog}`);
          } else {
            target.fleet = battle.remainingDefenderFleet;
            target.defenses = battle.remainingDefenses;
            target.debris = {
              metal: (target.debris?.metal || 0) + battle.debris.metal,
              crystal: (target.debris?.crystal || 0) + battle.debris.crystal
            };
            target.lastUpdated = Date.now();
            tx.set(targetRef, target);

            if (Object.keys(battle.survivingAttacker).length > 0) {
              returnFleetToOrigin(tx, originSnap, originRef, battle.survivingAttacker, { metal: 0, crystal: 0, deuterium: 0 }, speed);
            }
            sendReport(f.attackerUid, `Sconfitta PvP [${f.targetCoords}]`, `La tua flotta è stata respinta da ${target.ownerName}.`);
            sendReport(target.ownerUid, `Difesa Riuscita [${f.targetCoords}]`, `Hai respinto l'attacco di ${f.attackerName}!`);
          }
        }

        tx.update(fleetDoc.ref, { status: "completed" });
      });
    }
  }

  function returnFleetToOrigin(tx, originSnap, originRef, fleet, cargo, speed) {
    if (!originSnap.exists) return;
    const origin = calculateLiveResources(originSnap.data(), speed);
    for (const [k, v] of Object.entries(fleet || {})) {
      if (v > 0) origin.fleet[k] = (origin.fleet[k] || 0) + v;
    }
    origin.resources.metal += cargo?.metal || 0;
    origin.resources.crystal += cargo?.crystal || 0;
    origin.resources.deuterium += cargo?.deuterium || 0;
    origin.lastUpdated = Date.now();
    tx.set(originRef, origin);
  }

  function runPvPCombat(attackerFleet, attTech, targetPlanet, defTech) {
    const shipsDB = window.UniversumData?.SHIPS || {};
    const defsDB = window.UniversumData?.DEFENSES || {};

    const calcPower = (units, db, tech) => {
      let total = 0;
      const mult = 1 + ((tech?.weaponsTech || 0) + (tech?.armourTech || 0)) * 0.1;
      for (const [id, count] of Object.entries(units || {})) {
        const u = db[id];
        const atk = u ? u.attack : 100;
        const hull = u ? u.hull : 1000;
        total += count * (atk + hull * 0.1) * mult;
      }
      return total;
    };

    const attPower = calcPower(attackerFleet, shipsDB, attTech);
    const defPower =
      calcPower(targetPlanet.fleet, shipsDB, defTech) +
      calcPower(targetPlanet.defenses, defsDB, defTech);

    const winner = attPower > defPower ? "attacker" : "defender";
    const ratio = winner === "attacker"
      ? Math.min(0.85, (defPower / Math.max(1, attPower)) * 0.7)
      : Math.min(0.85, (attPower / Math.max(1, defPower)) * 0.7);

    const survivingAttacker = {};
    let debrisM = 0, debrisC = 0;

    for (const [id, count] of Object.entries(attackerFleet || {})) {
      const lost = winner === "attacker" ? Math.floor(count * ratio) : count;
      const kept = Math.max(0, count - lost);
      if (kept > 0) survivingAttacker[id] = kept;
      const cost = shipsDB[id]?.cost || { metal: 2000, crystal: 1000 };
      debrisM += Math.floor(lost * cost.metal * 0.3);
      debrisC += Math.floor(lost * cost.crystal * 0.3);
    }

    const remainingDefenderFleet = {};
    if (winner === "defender") {
      for (const [id, count] of Object.entries(targetPlanet.fleet || {})) {
        const kept = Math.max(0, Math.floor(count * (1 - ratio)));
        if (kept > 0) remainingDefenderFleet[id] = kept;
      }
    }

    const remainingDefenses = {};
    for (const [id, count] of Object.entries(targetPlanet.defenses || {})) {
      if (id === "spaceTrap") continue;
      const baseKept = winner === "defender" ? Math.floor(count * (1 - ratio)) : 0;
      const rebuilt = Math.floor((count - baseKept) * 0.7); // 70% ricostruzione difese
      if (baseKept + rebuilt > 0) remainingDefenses[id] = baseKept + rebuilt;
    }

    const bunkerPct = Math.min(0.9, (targetPlanet.buildings?.hiddenBunker || 0) * 0.1);
    const lootableFactor = 0.5 * (1 - bunkerPct);

    const loot = winner === "attacker"
      ? {
          metal: Math.floor(targetPlanet.resources.metal * lootableFactor),
          crystal: Math.floor(targetPlanet.resources.crystal * lootableFactor),
          deuterium: Math.floor(targetPlanet.resources.deuterium * lootableFactor)
        }
      : { metal: 0, crystal: 0, deuterium: 0 };

    return {
      winner,
      survivingAttacker,
      remainingDefenderFleet,
      remainingDefenses,
      loot,
      debris: { metal: debrisM, crystal: debrisC }
    };
  }

  // ---------------------------------------------------------
  // 6. CLASSIFICA GLOBALE E CHAT GALATTICA IN TEMPO REALE
  // ---------------------------------------------------------
  async function updatePlayerPoints(uniId, uid, points) {
    await getDB()
      .collection("online_universes")
      .doc(uniId)
      .collection("players")
      .doc(uid)
      .update({ points: Math.floor(points) });
  }

  async function getLeaderboard(uniId) {
    const snap = await getDB()
      .collection("online_universes")
      .doc(uniId)
      .collection("players")
      .orderBy("points", "desc")
      .limit(50)
      .get();

    return snap.docs.map((d, idx) => ({
      rank: idx + 1,
      ...d.data()
    }));
  }

  async function sendChatMessage(uniId, text) {
    const user = getCurrentUser();
    if (!user) throw new Error("Non autenticato.");
    const clean = String(text || "").trim().slice(0, 240);
    if (!clean) return;

    await getDB()
      .collection("online_universes")
      .doc(uniId)
      .collection("chat")
      .add({
        uid: user.uid,
        nickname: user.nickname,
        text: clean,
        createdAt: Date.now()
      });
  }

  function listenChat(uniId, callback) {
    return getDB()
      .collection("online_universes")
      .doc(uniId)
      .collection("chat")
      .orderBy("createdAt", "desc")
      .limit(40)
      .onSnapshot((snap) => {
        const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
        callback(messages);
      });
  }

  function listenMessages(uniId, uid, callback) {
    return getDB()
      .collection("online_universes")
      .doc(uniId)
      .collection("messages")
      .where("toUid", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(30)
      .onSnapshot((snap) => {
        const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        callback(msgs);
      });
  }

  return {
    registerOrLogin,
    logout,
    getCurrentUser,
    getOnlineUniverses,
    createOnlineUniverse,
    joinOnlineUniverse,
    loadPlayerOnlineState,
    calculateLiveResources,
    syncPlanetToCloud,
    renameOnlinePlanet,
    renameOnlineMoon,
    getOnlineSystem,
    launchOnlineFleet,
    listenIncomingRadar,
    resolveArrivedOnlineFleets,
    updatePlayerPoints,
    getLeaderboard,
    sendChatMessage,
    listenChat,
    listenMessages
  };
})();
