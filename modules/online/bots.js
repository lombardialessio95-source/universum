/** UNIVERSUM / modules/online/bots.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumMPModules;
  const { FLEET_SCHEMA_VERSION } = window.__UniversumMPVariables;
  // Bridge lazy per le funzioni definite negli altri moduli.
  const _effectivePlanetView = (...args) => G._effectivePlanetView(...args);
  const coordsToKey = (...args) => G.coordsToKey(...args);
  const generatePlanetSpecs = (...args) => G.generatePlanetSpecs(...args);
  const getAuth = (...args) => G.getAuth(...args);
  const getDB = (...args) => G.getDB(...args);



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
    const guard=G.ordinaryMutationGuard(universeObj);
    try {
    const user = getAuth().currentUser;
    if (!user) throw new Error('Utente non autenticato.');
    if (!universeObj?.id || universeObj.creativeMode) throw new Error('Servizio disponibile solo negli universi Normali.');
    const mm = window.UniversumMoonMerchant;
    if (!mm) throw new Error('Servizio Mercante di Lune non disponibile.');
    const planetRef = getDB().collection('online_universes').doc(universeObj.id)
      .collection('planets').doc(coordsToKey(coords));
    guard.check();
    const outcome = await getDB().runTransaction(async (tx) => {
      guard.check();
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
      guard.check();
      tx.update(planetRef, updates);
      return { ...check, success, coords, charged: mm.FEE };
    });
    // Resoconto privato dopo il commit. Non si blocca la transazione per un report.
    getDB().collection('online_universes').doc(universeObj.id).collection('messages').add({
      recipientUid: user.uid, type: 'combat', title: outcome.success ? 'Mercante di Lune: LUNA FORMATA' : 'Mercante di Lune: tentativo fallito',
      body: mm.report(outcome), timestamp: Date.now()
    }).catch((e) => console.warn('[MoonMerchant] Report non salvato:', e));
    return outcome;
    } finally { guard.release(); }
  }


  async function tradeWithOnlineBot(universeObj, botCoords, giveRes, giveAmount, getRes) {
    const guard=G.ordinaryMutationGuard(universeObj);
    try {
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
    guard.check();
    await db.runTransaction(async (tx) => {
      guard.check();
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
      guard.check();
      tx.update(homeRef, updHome);
      tx.update(botRef, {
        [`resources.${giveRes}`]: FV.increment(amount),
        [`resources.${getRes}`]: FV.increment(-received),
        lastUpdated: Date.now()
      });
    });

    return { given: amount, received };
    } finally { guard.release(); }
  }


  async function maybeLaunchBotRaid(uniId, configFromSession = undefined) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user) return;

    const uniRef = db.collection('online_universes').doc(uniId);
    // Le opzioni BOT sono fissate alla creazione dell'universo.
    const cfg = configFromSession === undefined
      ? (await uniRef.get()).data()?.botConfig
      : configFromSession;
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

  Object.assign(G, { normalizeBotConfig, _botHashString, _botMulberry32, _botShuffle, _pickBotPersonality, _generateOnlineBotStats, _buildBotDoc, ensureBotsAroundHome, hireOnlineMoonMerchant, tradeWithOnlineBot, maybeLaunchBotRaid });

})();
