(function () {
  'use strict';

  const BOT_PREFIXES = [
    'Impero', 'Egemonia', 'Legione', 'Dominio', 'Collettivo', 'Sovranità',
    'Flotta', 'Ordine', 'Confederazione', 'Dinastia', 'Alleanza', 'Avanguardia'
  ];
  const BOT_NAMES = [
    'Krell', 'Valkor', 'Zorak', 'Aethel', 'Nexis', 'Kryon', 'Vanguard', 'Drakon',
    'Hyperion', 'Orion', 'Xylar', 'Centauri', 'Andromeda', 'Sirius', 'Titan', 'Nova',
    'Omega', 'Tartarus', 'Erebus', 'Chronos', 'Helios', 'Vortex', 'Zenith', 'Spectre'
  ];
  const PLANET_NAMES = [
    'Prime', 'Secundus', 'Outpost', 'Bastion', 'Citadel', 'Forge', 'Sanctum',
    'Aegis', 'Nexus', 'Haven', 'Terminus', 'Vanguard', 'Apex', 'Oblivion', 'Horizon'
  ];

  // =========================================================
  // GENERATORE PSEUDO-CASUALE DETERMINISTICO (MULBERRY32)
  // =========================================================
  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function coordKey(g, s, p) {
    return `${g}:${s}:${p}`;
  }

  function parseCoordKey(key) {
    const parts = String(key).split(':').map(Number);
    return { g: parts[0] || 1, s: parts[1] || 1, p: parts[2] || 1 };
  }

  function calculatePlanetTemperature(position, rngVal) {
    let maxTemp;
    if (position <= 3) {
      maxTemp = Math.floor(55 + rngVal * 45);
    } else if (position <= 11) {
      maxTemp = Math.floor(-5 + rngVal * 55);
    } else {
      maxTemp = Math.floor(-95 + rngVal * 65);
    }
    return { maxTemp, minTemp: maxTemp - 40 };
  }

  function calculateSlotMaxFields(position, rngVal) {
    const centerBonus = Math.max(0, 5 - Math.abs(8 - position)) * 18;
    return Math.floor(130 + centerBonus + rngVal * 95);
  }

  // =========================================================
  // 1. UNIVERSO PROCEDURALE DETERMINISTICO + DELTA
  // =========================================================
  function generateProceduralSlot(universe, g, s, p) {
    const key = coordKey(g, s, p);
    const seed = hashString(`${universe.seed}:${g}:${s}:${p}`);
    const rng = mulberry32(seed);

    const temps = calculatePlanetTemperature(p, rng());
    const maxFields = calculateSlotMaxFields(p, rng());

    const playerPlanet = (universe.planets || []).find(
      (pl) => pl.coords && pl.coords.g === g && pl.coords.s === s && pl.coords.p === p
    );

    const delta = (universe.galaxyDeltas && universe.galaxyDeltas[key]) || null;

    const galatticaHere = findGalatticaAt(universe, { g, s, p });
    const galatticaRef = galatticaHere ? { id: galatticaHere.id, name: galatticaHere.name } : null;

    if (delta && delta.destroyed && !playerPlanet) {
      return {
        coords: { g, s, p },
        key,
        type: 'empty',
        ownerType: 'none',
        name: 'Spazio Profondo (Pianeta Distrutto)',
        emperor: null,
        maxTemp: temps.maxTemp,
        minTemp: temps.minTemp,
        fieldsMax: maxFields,
        moon: null,
        galattica: galatticaRef,
        debris: delta.debris || { metal: 0, crystal: 0 },
        destroyed: true
      };
    }

    if (playerPlanet || (delta && (delta.owner === 'player' || delta.ownerType === 'player'))) {
      const pName = playerPlanet ? playerPlanet.name : (delta.planetName || 'Colonia');
      const hasMoon = Boolean((playerPlanet && playerPlanet.moon) || (delta && delta.hasMoon));
      const moonName = (playerPlanet && playerPlanet.moon && playerPlanet.moon.name) || (delta && delta.moonName) || 'Luna';
      return {
        coords: { g, s, p },
        key,
        type: 'planet',
        ownerType: 'player',
        planetId: playerPlanet ? playerPlanet.id : delta.planetId,
        name: pName,
        emperor: universe.emperor,
        maxTemp: playerPlanet ? playerPlanet.maxTemp : temps.maxTemp,
        minTemp: playerPlanet ? playerPlanet.minTemp : temps.minTemp,
        fieldsMax: playerPlanet ? playerPlanet.fieldsMax : maxFields,
        moon: hasMoon ? { name: moonName, diameter: 8000 } : null,
        bacinoSpaziale: (playerPlanet && playerPlanet.bacinoSpaziale)
          ? { status: playerPlanet.bacinoSpaziale.status }
          : (delta && delta.hasBacino ? { status: 'active' } : null),
        galattica: galatticaRef,
        debris: (delta && delta.debris) || { metal: 0, crystal: 0 }
      };
    }

    const homePlanet = (universe.planets && universe.planets[0]) || { coords: { g: 1, s: 1, p: 4 } };
    const isHomeSystem = (g === homePlanet.coords.g && s === homePlanet.coords.s);
    if (isHomeSystem) {
      return {
        coords: { g, s, p },
        key,
        type: 'empty',
        ownerType: 'none',
        name: 'Slot Colonizzabile',
        emperor: null,
        maxTemp: temps.maxTemp,
        minTemp: temps.minTemp,
        fieldsMax: maxFields,
        moon: null,
        galattica: galatticaRef,
        debris: (delta && delta.debris) || { metal: 0, crystal: 0 }
      };
    }

    const presenceRoll = rng();
    if (presenceRoll > 0.42) {
      return {
        coords: { g, s, p },
        key,
        type: 'empty',
        ownerType: 'none',
        name: 'Slot Colonizzabile',
        emperor: null,
        maxTemp: temps.maxTemp,
        minTemp: temps.minTemp,
        fieldsMax: maxFields,
        moon: null,
        galattica: galatticaRef,
        debris: (delta && delta.debris) || { metal: 0, crystal: 0 }
      };
    }

    const prefix = BOT_PREFIXES[Math.floor(rng() * BOT_PREFIXES.length)];
    const bName = BOT_NAMES[Math.floor(rng() * BOT_NAMES.length)];
    const pSuffix = PLANET_NAMES[Math.floor(rng() * PLANET_NAMES.length)];
    const emperorName = `${prefix} ${bName}`;
    const planetName = `${bName} ${pSuffix}`;

    const personalities = ['Pacifico', 'Commerciante', 'Guerriero'];
    const personality = universe.botMode === 'peaceful'
      ? (rng() < 0.5 ? 'Pacifico' : 'Commerciante')
      : personalities[Math.floor(rng() * personalities.length)];

    const tierRoll = rng() + ((universe.botLevel || 2) - 1) * 0.12;
    let tier = 'Debole';
    let powerMult = 1;
    if (tierRoll > 1.05) {
      tier = 'Elite';
      powerMult = 18;
    } else if (tierRoll > 0.75) {
      tier = 'Forte';
      powerMult = 7;
    } else if (tierRoll > 0.42) {
      tier = 'Medio';
      powerMult = 2.8;
    }

    const hoursElapsed = Math.min(72, Math.max(0.5, (Date.now() - (universe.createdAt || Date.now())) / 3600000));
    const growthFactor = (1 + hoursElapsed * 0.25) * Math.min(20, Math.sqrt(universe.speed || 10));
    const lootPenalty = (delta && delta.lootedAt && (Date.now() - delta.lootedAt < 3600000)) ? 0.25 : 1;

    const baseRes = Math.floor(15000 * powerMult * growthFactor * lootPenalty);
    const resources = (delta && delta.resourcesOverride) || {
      metal: Math.floor(baseRes * (0.9 + rng() * 0.4)),
      crystal: Math.floor(baseRes * 0.65 * (0.9 + rng() * 0.4)),
      deuterium: Math.floor(baseRes * 0.35 * (0.9 + rng() * 0.4))
    };

    const techLv = Math.max(1, Math.floor(powerMult * 1.1 + rng() * 3));
    const tech = {
      weaponsTech: techLv,
      shieldingTech: techLv,
      armourTech: techLv,
      espionageTech: Math.max(1, techLv - 1)
    };

    const mineBase = Math.min(32, Math.max(3, Math.floor(4 + Math.log2(powerMult + 1) * 4.2)));
    const buildings = {
      metalMine: mineBase + Math.floor(rng() * 3),
      crystalMine: Math.max(2, mineBase - 1 + Math.floor(rng() * 3)),
      deuteriumSynth: Math.max(1, mineBase - 2 + Math.floor(rng() * 2)),
      solarPlant: mineBase + 2,
      fusionReactor: powerMult >= 7 ? Math.floor(mineBase / 2) : 0,
      roboticsFactory: Math.min(15, Math.max(2, Math.floor(mineBase / 2))),
      shipyard: Math.min(14, Math.max(2, Math.floor(mineBase / 2))),
      researchLab: Math.min(14, Math.max(2, Math.floor(mineBase / 2))),
      naniteFactory: powerMult >= 7 ? Math.min(5, Math.floor(powerMult / 4)) : 0,
      metalStorage: Math.max(2, Math.floor(mineBase / 3)),
      crystalStorage: Math.max(2, Math.floor(mineBase / 3)),
      deuteriumTank: Math.max(2, Math.floor(mineBase / 3)),
      terraformer: powerMult >= 18 ? 2 : 0,
      hiddenBunker: personality === 'Commerciante' ? 3 : 1
    };

    const fleet = (delta && delta.fleetOverride) ? Object.assign({}, delta.fleetOverride) : {
      smallCargo: Math.floor((4 + rng() * 8) * powerMult),
      largeCargo: Math.floor((2 + rng() * 5) * powerMult),
      lightFighter: Math.floor((12 + rng() * 25) * powerMult),
      heavyFighter: Math.floor((4 + rng() * 10) * powerMult),
      cruiser: powerMult >= 2 ? Math.floor((2 + rng() * 6) * powerMult) : 0,
      battleship: powerMult >= 5 ? Math.floor((1 + rng() * 4) * (powerMult / 2)) : 0,
      battlecruiser: powerMult >= 10 ? Math.floor((1 + rng() * 3) * (powerMult / 4)) : 0,
      espionageProbe: Math.floor((5 + rng() * 15) * powerMult),
      deathStar: (tier === 'Elite' && (universe.botLevel || 2) >= 3 && rng() < 0.35) ? 1 : 0
    };

    const defenses = (delta && delta.defensesOverride) ? Object.assign({}, delta.defensesOverride) : {
      rocketLauncher: Math.floor((15 + rng() * 30) * powerMult),
      lightLaser: Math.floor((10 + rng() * 20) * powerMult),
      heavyLaser: powerMult >= 2 ? Math.floor((4 + rng() * 8) * powerMult) : 0,
      gaussCannon: powerMult >= 5 ? Math.floor((2 + rng() * 4) * (powerMult / 2)) : 0,
      ionCannon: powerMult >= 3 ? Math.floor((2 + rng() * 5) * (powerMult / 2)) : 0,
      plasmaTurret: powerMult >= 12 ? Math.floor(1 + rng() * 3) : 0,
      smallShieldDome: powerMult >= 2 ? 1 : 0,
      largeShieldDome: powerMult >= 8 ? 1 : 0,
      spaceTrap: personality === 'Guerriero' ? Math.floor(2 * powerMult) : 0
    };

    const tradeRates = personality === 'Commerciante'
      ? { metal: 2.5, crystal: 1.5, deuterium: 1.0 }
      : { metal: 3.0, crystal: 2.0, deuterium: 1.0 };

    const hasBotBacino = Boolean(delta && delta.hasBacino);
    const hasBotMoon = hasBotBacino ? false : ((delta && delta.hasMoon !== undefined)
      ? delta.hasMoon
      : (powerMult >= 7 && rng() < 0.35));

    return {
      coords: { g, s, p },
      key,
      type: 'bot',
      ownerType: 'bot',
      name: planetName,
      emperor: emperorName,
      tier,
      personality,
      powerMult,
      maxTemp: temps.maxTemp,
      minTemp: temps.minTemp,
      fieldsMax: maxFields,
      resources,
      buildings,
      fleet,
      defenses,
      tech,
      tradeRates,
      moon: hasBotMoon ? { name: (delta && delta.moonName) || `Luna di ${bName}`, diameter: 7500 } : null,
      bacinoSpaziale: hasBotBacino ? { status: 'active' } : null,
      galattica: galatticaRef,
      debris: (delta && delta.debris) || { metal: 0, crystal: 0 }
    };
  }

  function getSystemData(universe, galaxy, system) {
    const g = Math.min(universe.galaxies || 3, Math.max(1, Number(galaxy) || 1));
    const s = Math.min(universe.systemsPerGalaxy || 250, Math.max(1, Number(system) || 1));
    const slots = [];
    for (let p = 1; p <= 15; p++) {
      slots.push(generateProceduralSlot(universe, g, s, p));
    }
    return {
      galaxy: g,
      system: s,
      slots,
      expeditionSlot: {
        coords: { g, s, p: 16 },
        key: coordKey(g, s, 16),
        name: 'Spazio Profondo / Buco Nero (Pos. 16)'
      }
    };
  }

  // =========================================================
  // 2. CREAZIONE LUNA, PORTALE IPERSPAZIALE E FALANGE
  // =========================================================
  function getMoonCreationCost(universe) {
    if (universe.creativeMode) return { metal: 0, crystal: 0, deuterium: 0 };
    if (universe.startTier === 'rich' || universe.startTier === 'millionaire') {
      return { metal: 20000, crystal: 20000, deuterium: 10000 };
    }
    return { metal: 100000, crystal: 100000, deuterium: 50000 };
  }

  function makeMoon(name = 'Luna') {
    return {
      name,
      diameter: 8000,
      fieldsMax: 1,
      resources: { metal: 0, crystal: 0, deuterium: 0 },
      buildings: {
        lunarBase: 0,
        lunarStorage: 0,
        lunarShield: 0,
        secretShipyard: 0,
        sensorPhalanx: 0,
        jumpGate: 0
      },
      buildQueue: [],
      jumpGateCooldownUntil: 0
    };
  }

  function createMoon(universe, planetIndex) {
    const planet = universe.planets[planetIndex];
    if (!planet) throw new Error('Pianeta non trovato.');
    if (planet.moon) throw new Error('Questo pianeta possiede già una Luna.');
    if (planet.galatticaOrigin) throw new Error('Slot orbitale consumato dalla Galattica: niente Luna su questo pianeta.');
    if (planet.bacinoSpaziale) throw new Error('Slot orbitale occupato dal Bacino Spaziale: niente Luna sullo stesso pianeta.');

    const lunarTechLv = Number(universe.researches?.lunarTech || 0);
    if (!universe.creativeMode && lunarTechLv < 1) {
      throw new Error('Richiede Ingegneria Lunare Livello 1.');
    }

    const cost = getMoonCreationCost(universe);
    if (!universe.creativeMode) {
      if (
        planet.resources.metal < cost.metal ||
        planet.resources.crystal < cost.crystal ||
        planet.resources.deuterium < cost.deuterium
      ) {
        throw new Error(`Risorse insufficienti (${cost.metal.toLocaleString()} M, ${cost.crystal.toLocaleString()} C, ${cost.deuterium.toLocaleString()} D).`);
      }
      planet.resources.metal -= cost.metal;
      planet.resources.crystal -= cost.crystal;
      planet.resources.deuterium -= cost.deuterium;
    }

    planet.moon = makeMoon('Luna');

    const key = coordKey(planet.coords.g, planet.coords.s, planet.coords.p);
    if (!universe.galaxyDeltas) universe.galaxyDeltas = {};
    universe.galaxyDeltas[key] = Object.assign({}, universe.galaxyDeltas[key], {
      hasMoon: true,
      hasBacino: false,
      moonName: 'Luna'
    });

    return planet.moon;
  }

  function startBacinoSpaziale(universe, planetIndex) {
    const Data = window.UniversumData;
    const def = Data.BACINO_SPAZIALE;
    const planet = universe.planets[planetIndex];
    if (!planet) throw new Error('Pianeta non trovato.');
    if (planet.moon) throw new Error('Questo pianeta possiede già una Luna: niente Bacino Spaziale.');
    if (planet.galatticaOrigin) throw new Error('Slot orbitale consumato dalla Galattica: niente Bacino su questo pianeta.');
    if (planet.bacinoSpaziale) throw new Error('Bacino Spaziale già presente su questo pianeta.');
    const now = Date.now();
    if (universe.creativeMode) {
      planet.bacinoSpaziale = {
        status: 'active', daysPaid: def.totalDays, daysTotal: def.totalDays,
        paid: Object.assign({}, def.totalCost), startedAt: now, nextPaymentAt: 0, completedAt: now,
        invictusActive: 0, invictusConstructions: [], everUsed: false, crepuscolo: null
      };
    } else {
      planet.bacinoSpaziale = {
        status: 'building', daysPaid: 0, daysTotal: def.totalDays,
        paid: { metal: 0, crystal: 0, deuterium: 0 }, startedAt: now, nextPaymentAt: now + def.dayMs,
        invictusActive: 0, invictusConstructions: [], everUsed: false, crepuscolo: null
      };
    }
    if (universe.creativeMode && universe.crepuscoloLimbo && window.UniversumEngine?.checkCrepuscoloLimbo) {
      window.UniversumEngine.checkCrepuscoloLimbo(universe, now);
    }
    const key = coordKey(planet.coords.g, planet.coords.s, planet.coords.p);
    if (!universe.galaxyDeltas) universe.galaxyDeltas = {};
    universe.galaxyDeltas[key] = Object.assign({}, universe.galaxyDeltas[key], {
      hasMoon: false, hasBacino: true
    });
    return planet.bacinoSpaziale;
  }

  function getInvictusCount(planet) {
    const b = planet && planet.bacinoSpaziale;
    if (!b) return { active: 0, building: 0, total: 0 };
    const building = Array.isArray(b.invictusConstructions) ? b.invictusConstructions.length : 0;
    const active = Number(b.invictusActive) || 0;
    return { active, building, total: active + building };
  }

  function getInvictusJumpCost(fromCoords, toCoords, count = 1) {
    const def = window.UniversumData.INVICTUS;
    const systemDistance = Math.abs((Number(toCoords.s) || 0) - (Number(fromCoords.s) || 0));
    return Math.ceil(systemDistance / def.jumpSystemsStep) * def.jumpDeuteriumPerShip * Math.max(0, Math.floor(Number(count) || 0));
  }

  function addInvictusDebris(universe, coords, count) {
    const Data = window.UniversumData;
    const spec = Data.SHIPS.invictus;
    const key = coordKey(coords.g, coords.s, coords.p);
    if (!universe.galaxyDeltas) universe.galaxyDeltas = {};
    const prev = (universe.galaxyDeltas[key] && universe.galaxyDeltas[key].debris) || { metal: 0, crystal: 0 };
    universe.galaxyDeltas[key] = Object.assign({}, universe.galaxyDeltas[key], {
      debris: {
        metal: prev.metal + Math.floor(spec.cost.metal * count * 0.3),
        crystal: prev.crystal + Math.floor(spec.cost.crystal * count * 0.3)
      }
    });
  }

  function startInvictusConstruction(universe, planetIndex) {
    const Data = window.UniversumData;
    const def = Data.INVICTUS;
    const planet = universe.planets[planetIndex];
    if (!planet) throw new Error('Pianeta non trovato.');
    const bacino = planet.bacinoSpaziale;
    if (!bacino || bacino.status !== 'active') throw new Error('Serve un Bacino Spaziale attivo per costruire un Invictus.');
    if (!Array.isArray(bacino.invictusConstructions)) bacino.invictusConstructions = [];
    const counts = getInvictusCount(planet);
    if (counts.total >= def.maxPerBacino) throw new Error(`Massimo ${def.maxPerBacino} Invictus per Bacino (attive + in costruzione).`);
    bacino.everUsed = true;
    const now = Date.now();
    if (universe.creativeMode) {
      bacino.invictusActive = counts.active + 1;
      return { instant: true, invictusActive: bacino.invictusActive };
    }
    const construction = {
      status: 'building', daysPaid: 0, daysTotal: def.totalDays,
      paid: { metal: 0, crystal: 0, deuterium: 0 }, startedAt: now, nextPaymentAt: now + def.dayMs
    };
    bacino.invictusConstructions.push(construction);
    return { instant: false, construction };
  }

  function isBacinoVuoto(planet) {
    const b = planet && planet.bacinoSpaziale;
    if (!b || b.status !== 'active' || b.everUsed) return false;
    const counts = getInvictusCount(planet);
    return counts.total === 0 && !b.crepuscolo;
  }

  function getCrepuscoloState(universe) {
    let count = 0;
    const locations = [];
    for (const pl of universe.planets || []) {
      if (pl.bacinoSpaziale && pl.bacinoSpaziale.crepuscolo) { count += 1; locations.push(pl.id); }
    }
    for (const f of universe.fleetsInFlight || []) {
      count += Math.max(0, Math.floor(Number((f.fleet || f.ships || {}).crepuscolo || 0)));
    }
    if (universe.crepuscoloLimbo) count += 1;
    return { count, locations, has: count > 0 };
  }

  function makeCrepuscoloProject(kind, daysTotal, now) {
    return {
      status: kind === 'build' ? 'building' : 'repairing',
      projectKind: kind,
      repairKind: kind === 'build' ? null : kind,
      daysPaid: 0, daysTotal,
      paid: { metal: 0, crystal: 0, deuterium: 0 },
      startedAt: now, nextPaymentAt: now + window.UniversumData.CREPUSCOLO.dayMs
    };
  }

  function beginCrepuscoloBattleRepair(planet, now = Date.now()) {
    const bacino = planet && planet.bacinoSpaziale;
    if (!bacino || !bacino.crepuscolo) return false;
    const def = window.UniversumData.CREPUSCOLO;
    bacino.crepuscolo = Object.assign({}, bacino.crepuscolo, {
      status: 'repairing', projectKind: 'battle', repairKind: 'battle',
      daysPaid: 0, daysTotal: def.battleRepairDays,
      paid: { metal: 0, crystal: 0, deuterium: 0 }, startedAt: now, nextPaymentAt: now + def.dayMs
    });
    return true;
  }

  function startCrepuscoloConstruction(universe, planetIndex) {
    const def = window.UniversumData.CREPUSCOLO;
    const planet = universe.planets[planetIndex];
    if (!planet) throw new Error('Pianeta non trovato.');
    if (getCrepuscoloState(universe).has) throw new Error('Hai già una Crepuscolo degli Dei nel tuo impero (max 1).');
    if (!isBacinoVuoto(planet)) throw new Error('La Crepuscolo richiede un Bacino Spaziale vuoto: mai usato da nessuna nave.');
    const now = Date.now();
    planet.bacinoSpaziale.everUsed = true;
    if (universe.creativeMode) {
      planet.bacinoSpaziale.crepuscolo = {
        status: 'active', projectKind: 'build', repairKind: null,
        daysPaid: def.buildDays, daysTotal: def.buildDays,
        paid: Object.assign({}, def.totalCost), startedAt: now, nextPaymentAt: 0, completedAt: now
      };
      return { instant: true };
    }
    planet.bacinoSpaziale.crepuscolo = makeCrepuscoloProject('build', def.buildDays, now);
    return { instant: false, crepuscolo: planet.bacinoSpaziale.crepuscolo };
  }

  function assignCrepuscoloWreck(universe, planet) {
    const def = window.UniversumData.CREPUSCOLO;
    if (!planet || !isBacinoVuoto(planet) || getCrepuscoloState(universe).has) return false;
    planet.bacinoSpaziale.everUsed = true;
    planet.bacinoSpaziale.crepuscolo = makeCrepuscoloProject('wreck', def.wreckRepairDays, Date.now());
    return true;
  }

  // =========================================================
  // GALATTICA
  // =========================================================
  function findGalatticaAt(universe, coords) {
    return (universe.galattiche || []).find((gal) => gal.coords && gal.coords.g === coords.g && gal.coords.s === coords.s && gal.coords.p === coords.p) || null;
  }

  function getGalatticaCount(universe) {
    let count = (universe.galattiche || []).length;
    for (const pl of universe.planets || []) {
      if (pl.bacinoSpaziale && pl.bacinoSpaziale.galatticaConstruction) count += 1;
    }
    return count;
  }

  function findGalattica(universe, galatticaId) {
    return (universe.galattiche || []).find((gal) => gal.id === galatticaId) || null;
  }

  function startGalatticaConstruction(universe, planetIndex) {
    const Data = window.UniversumData;
    const def = Data.GALATTICA;
    const planet = universe.planets[planetIndex];
    if (!planet) throw new Error('Pianeta non trovato.');
    const req = Data.checkRequirements(def.requirements, planet, universe, false);
    if (!universe.creativeMode && !req.met) throw new Error(`Requisiti mancanti: ${req.missing.join(', ')}`);
    const bacino = planet.bacinoSpaziale;
    if (!bacino || bacino.status !== 'active') throw new Error('Serve un Bacino Spaziale attivo per costruire una Galattica.');
    if (bacino.galatticaConstruction) throw new Error('Costruzione Galattica già in corso in questo Bacino.');
    const invictus = getInvictusCount(planet);
    if (invictus.total > 0 || bacino.crepuscolo) throw new Error('Il Bacino ha navi legate: la Galattica richiede un Bacino senza navi.');
    if (getGalatticaCount(universe) >= def.maxPerEmpire) throw new Error(`Massimo ${def.maxPerEmpire} Galattiche per impero.`);
    const now = Date.now();
    if (universe.creativeMode) {
      bacino.galatticaConstruction = { status: 'done', daysPaid: def.buildDays, paid: Object.assign({}, def.totalCost), startedAt: now, nextPaymentAt: 0 };
      if (window.UniversumEngine?.transformCompletedGalattiche) window.UniversumEngine.transformCompletedGalattiche(universe, null);
      return { instant: true };
    }
    bacino.galatticaConstruction = {
      status: 'building', daysPaid: 0,
      paid: { metal: 0, crystal: 0, deuterium: 0 }, startedAt: now, nextPaymentAt: now + def.dayMs
    };
    return { instant: false, construction: bacino.galatticaConstruction };
  }

  function getGalatticaJumpCost(fromCoords, toCoords) {
    const def = window.UniversumData.GALATTICA;
    const systemDistance = Math.abs((Number(toCoords.s) || 0) - (Number(fromCoords.s) || 0));
    const galaxyDistance = Math.abs((Number(toCoords.g) || 0) - (Number(fromCoords.g) || 0));
    return Math.ceil(systemDistance / def.jumpSystemsStep) * def.jumpDeuteriumPerSystemStep + galaxyDistance * def.jumpGalaxyExtraDeuterium;
  }

  function jumpGalattica(universe, galatticaId, targetCoords) {
    const galattica = findGalattica(universe, galatticaId);
    if (!galattica) throw new Error('Galattica non trovata.');
    const target = { g: Number(targetCoords.g) || 1, s: Number(targetCoords.s) || 1, p: Number(targetCoords.p) || 1 };
    const slot = generateProceduralSlot(universe, target.g, target.s, target.p);
    if (slot.moon || slot.bacinoSpaziale) {
      throw new Error('Salto bloccato: a destinazione è presente una Luna o un Bacino Spaziale.');
    }
    const cost = universe.creativeMode ? 0 : getGalatticaJumpCost(galattica.coords, target);
    if ((Number(galattica.resources.deuterium) || 0) < cost) {
      throw new Error(`Deuterio insufficiente nella stiva della Galattica per il salto (${cost.toLocaleString()} D richiesti).`);
    }

    const originSlot = generateProceduralSlot(universe, galattica.coords.g, galattica.coords.s, galattica.coords.p);
    const remaining = {};
    for (const [shipId, qtyRaw] of Object.entries(galattica.orbitingFleet || {})) {
      const qty = Math.max(0, Math.floor(Number(qtyRaw) || 0));
      if (qty <= 0) continue;
      remaining[shipId] = qty - Math.floor(qty / 2);
    }
    const now = Date.now();
    if (originSlot.ownerType === 'bot') {
      galattica.orbitingFleet = remaining;
    } else {
      galattica.orbitingFleet = {};
      const totalRemaining = Object.values(remaining).reduce((acc, q) => acc + q, 0);
      if (totalRemaining > 0 && (universe.planets || []).length > 0) {
        let nearest = null; let nearestDist = Infinity;
        for (const pl of universe.planets) {
          const d = calculateDistance(galattica.coords, pl.coords);
          if (d < nearestDist) { nearestDist = d; nearest = pl; }
        }
        const stats = getFleetSpeedAndFuel(universe, remaining, nearestDist);
        if (!Array.isArray(universe.fleetsInFlight)) universe.fleetsInFlight = [];
        universe.fleetsInFlight.push({
          id: 'flt_galreturn_' + now, mission: 'deploy', status: 'returning',
          originPlanetId: nearest.id, originCoords: Object.assign({}, galattica.coords),
          targetCoords: Object.assign({}, nearest.coords), fleet: Object.assign({}, remaining), ships: Object.assign({}, remaining),
          cargo: { metal: 0, crystal: 0, deuterium: 0 }, departureTime: now,
          arrivalTime: now + Math.max(1, stats.durationSec) * 20 * 1000, returnTime: now + Math.max(1, stats.durationSec) * 20 * 1000,
          galatticaReturn: true
        });
      }
    }

    galattica.resources.deuterium -= cost;
    const oldKey = coordKey(galattica.coords.g, galattica.coords.s, galattica.coords.p);
    const oldCoords = Object.assign({}, galattica.coords);
    galattica.coords = target;
    if (!universe.galaxyDeltas) universe.galaxyDeltas = {};
    universe.galaxyDeltas[oldKey] = Object.assign({}, universe.galaxyDeltas[oldKey], { galatticaId: null });
    const newKey = coordKey(target.g, target.s, target.p);
    universe.galaxyDeltas[newKey] = Object.assign({}, universe.galaxyDeltas[newKey], { galatticaId: galattica.id });

    const originPlanet = (universe.planets || []).find(
      (pl) => pl.coords && pl.coords.g === oldCoords.g && pl.coords.s === oldCoords.s && pl.coords.p === oldCoords.p
    );
    if (originPlanet && originPlanet.galatticaOrigin) {
      const galStillThere = findGalatticaAt(universe, originPlanet.coords);
      if (!galStillThere) {
        originPlanet.galatticaOrigin = false;
      }
    }

    return { cost, coords: Object.assign({}, target) };
  }

  function upgradeGalatticaStructure(universe, galatticaId, structureId) {
    const Engine = window.UniversumEngine;
    const galattica = findGalattica(universe, galatticaId);
    if (!galattica) throw new Error('Galattica non trovata.');
    const def = window.UniversumData.GALATTICA_STRUCTURES[structureId];
    if (!def) throw new Error('Struttura Galattica sconosciuta.');
    const curLv = Number(galattica.structures[structureId] || 0);
    const cost = Engine.getGalatticaStructureCost(structureId, curLv + 1);
    if (!universe.creativeMode) {
      if (structureId === 'generatoreMetallo' || structureId === 'generatoreCristallo' || structureId === 'sintetizzatoreDeuterio') {
        const projected = Object.assign({}, galattica, { structures: Object.assign({}, galattica.structures, { [structureId]: curLv + 1 }) });
        if (Engine.getGalatticaProduction(projected, universe).energyBalance < 0) {
          throw new Error('Energia insufficiente: potenzia prima il Reattore a Fusione.');
        }
      }
      if (galattica.resources.metal < cost.metal || galattica.resources.crystal < cost.crystal || galattica.resources.deuterium < cost.deuterium) {
        throw new Error('Risorse insufficienti nella stiva della Galattica.');
      }
      galattica.resources.metal -= cost.metal;
      galattica.resources.crystal -= cost.crystal;
      galattica.resources.deuterium -= cost.deuterium;
    }
    galattica.structures[structureId] = curLv + 1;
    return { level: curLv + 1, cost };
  }

  function buildGalatticaDefense(universe, galatticaId, defenseId, count = 1) {
    const Data = window.UniversumData;
    const galattica = findGalattica(universe, galatticaId);
    if (!galattica) throw new Error('Galattica non trovata.');
    const unit = Data.DEFENSES[defenseId];
    if (!unit) throw new Error('Difesa sconosciuta.');
    const qty = Math.max(1, Math.floor(Number(count) || 1));
    const mult = Data.GALATTICA.defenseCostMultiplier;
    const cost = { metal: unit.cost.metal * mult * qty, crystal: unit.cost.crystal * mult * qty, deuterium: unit.cost.deuterium * mult * qty };
    if (!universe.creativeMode) {
      if (galattica.resources.metal < cost.metal || galattica.resources.crystal < cost.crystal || galattica.resources.deuterium < cost.deuterium) {
        throw new Error('Risorse insufficienti nella stiva della Galattica per le difese (prezzo doppio).');
      }
      galattica.resources.metal -= cost.metal;
      galattica.resources.crystal -= cost.crystal;
      galattica.resources.deuterium -= cost.deuterium;
    }
    galattica.defenses[defenseId] = (galattica.defenses[defenseId] || 0) + qty;
    return { count: galattica.defenses[defenseId], cost };
  }

  function buildGalatticaShip(universe, galatticaId, shipId, count = 1) {
    const Data = window.UniversumData;
    const galattica = findGalattica(universe, galatticaId);
    if (!galattica) throw new Error('Galattica non trovata.');
    const unit = Data.SHIPS[shipId];
    if (!unit || unit.specialConstruction === 'bacino') throw new Error('Nave non costruibile nel Cantiere Spaziale della Galattica.');
    const qty = Math.max(1, Math.floor(Number(count) || 1));
    const cost = { metal: unit.cost.metal * qty, crystal: unit.cost.crystal * qty, deuterium: unit.cost.deuterium * qty };
    if (!universe.creativeMode) {
      if (galattica.resources.metal < cost.metal || galattica.resources.crystal < cost.crystal || galattica.resources.deuterium < cost.deuterium) {
        throw new Error('Risorse insufficienti nella stiva della Galattica.');
      }
      galattica.resources.metal -= cost.metal;
      galattica.resources.crystal -= cost.crystal;
      galattica.resources.deuterium -= cost.deuterium;
    }
    galattica.orbitingFleet[shipId] = (galattica.orbitingFleet[shipId] || 0) + qty;
    return { count: galattica.orbitingFleet[shipId], cost };
  }

  function cancelBacinoConstruction(planet) {
    if (!planet || !planet.bacinoSpaziale || planet.bacinoSpaziale.status === 'active') return false;
    planet.bacinoSpaziale = null;
    return true;
  }

  function destroyBacinoAndFormMoon(universe, planet) {
    if (!planet || !planet.bacinoSpaziale || planet.bacinoSpaziale.status !== 'active') return false;
    const dockedInvictus = Number(planet.bacinoSpaziale.invictusActive) || 0;
    if (dockedInvictus > 0) addInvictusDebris(universe, planet.coords, dockedInvictus);
    const cp = planet.bacinoSpaziale.crepuscolo;
    if (cp) {
      if (cp.status === 'repairing') {
        addMessage(universe, 'combat', `Crepuscolo Distrutta [${planet.coords.g}:${planet.coords.s}:${planet.coords.p}]`,
          'La Crepuscolo degli Dei è stata distrutta definitivamente mentre era in riparazione nel Bacino.');
      }
      if (cp.status === 'active') {
        const inFlight = (universe.fleetsInFlight || []).some((f) => f.originPlanetId === planet.id && Number((f.fleet || f.ships || {}).crepuscolo || 0) > 0);
        if (!inFlight) {
          const home = (universe.planets || [])[0];
          if (home) {
            const dist = calculateDistance(planet.coords, home.coords);
            const stats = getFleetSpeedAndFuel(universe, { crepuscolo: 1 }, dist);
            universe.crepuscoloLimbo = {
              status: 'travelling', homePlanetId: home.id,
              arrivalAt: Date.now() + Math.max(1, stats.durationSec) * 100 * 1000
            };
          }
        }
      }
    }
    planet.bacinoSpaziale = null;
    planet.moon = makeMoon('Luna');
    const key = coordKey(planet.coords.g, planet.coords.s, planet.coords.p);
    if (!universe.galaxyDeltas) universe.galaxyDeltas = {};
    universe.galaxyDeltas[key] = Object.assign({}, universe.galaxyDeltas[key], {
      hasBacino: false, hasMoon: true, moonName: 'Luna'
    });
    return true;
  }

  function useJumpGate(universe, fromPlanetIndex, toPlanetIndex, fleetSelection) {
    const fromP = universe.planets[fromPlanetIndex];
    const toP = universe.planets[toPlanetIndex];
    if (!fromP || !toP || fromP.id === toP.id) {
      throw new Error('Seleziona due pianeti diversi dotati di Luna.');
    }
    if (!fromP.moon || !toP.moon) {
      throw new Error('Entrambi i pianeti devono possedere una Luna.');
    }
    if (!universe.creativeMode) {
      if ((fromP.moon.buildings?.jumpGate || 0) < 1 || (toP.moon.buildings?.jumpGate || 0) < 1) {
        throw new Error('Entrambe le Lune devono avere un Portale Iperspaziale operativo.');
      }
      const now = Date.now();
      if ((fromP.moon.jumpGateCooldownUntil || 0) > now) {
        const remSec = Math.ceil((fromP.moon.jumpGateCooldownUntil - now) / 1000);
        throw new Error(`Portale in ricarica: attendi ${remSec} secondi.`);
      }
      if (fromP.resources.deuterium < 10000) {
        throw new Error('Servono 10.000 Deuterio per alimentare il Portale Iperspaziale.');
      }
    }

    let movedCount = 0;
    for (const [shipId, qtyRaw] of Object.entries(fleetSelection || {})) {
      const qty = Math.max(0, Math.floor(Number(qtyRaw) || 0));
      if (qty <= 0 || shipId === 'solarSatellite') continue;
      const avail = Number(fromP.fleet?.[shipId] || 0);
      if (qty > avail) {
        throw new Error(`Navi insufficienti per il salto (${shipId}).`);
      }
      fromP.fleet[shipId] = avail - qty;
      toP.fleet[shipId] = (toP.fleet[shipId] || 0) + qty;
      movedCount += qty;
    }

    if (movedCount === 0) {
      throw new Error('Seleziona almeno una nave da teletrasportare.');
    }

    if (!universe.creativeMode) {
      fromP.resources.deuterium -= 10000;
      const speed = universe.speed || 1;
      const cooldownSec = speed >= 100 ? 0 : Math.floor((30 * 60) / speed);
      fromP.moon.jumpGateCooldownUntil = Date.now() + cooldownSec * 1000;
    }

    return { movedCount };
  }

  function scanWithPhalanx(universe, moonPlanetIndex, targetGalaxy, targetSystem) {
    const originP = universe.planets[moonPlanetIndex];
    if (!originP || !originP.moon) {
      throw new Error('Il pianeta selezionato non ha una Luna.');
    }
    const phalanxLv = Number(originP.moon.buildings?.sensorPhalanx || 0);
    if (!universe.creativeMode && phalanxLv < 1) {
      throw new Error('Costruisci prima la Falange di Sensori sulla Luna.');
    }
    if (Number(targetGalaxy) !== originP.coords.g) {
      throw new Error('La Falange di Sensori opera solo nella stessa Galassia.');
    }
    const maxRange = universe.creativeMode ? 999 : phalanxLv * 2;
    const dist = Math.abs(Number(targetSystem) - originP.coords.s);
    if (dist > maxRange) {
      throw new Error(`Fuori portata! Portata attuale Falange: ±${maxRange} sistemi.`);
    }

    if (!universe.creativeMode) {
      if (originP.resources.deuterium < 5000) {
        throw new Error('Servono 5.000 Deuterio per alimentare la scansione della Falange.');
      }
      originP.resources.deuterium -= 5000;
    }

    const sysData = getSystemData(universe, targetGalaxy, targetSystem);
    const movements = (universe.incomingAttacks || []).filter(
      (atk) => atk.targetCoords && atk.targetCoords.g === Number(targetGalaxy) && atk.targetCoords.s === Number(targetSystem)
    );

    return { system: sysData, movements };
  }

  // =========================================================
  // 3. MOTORE DI BATTAGLIA A 6 ROUND
  // =========================================================
  function expandUnitPool(unitMap, tech, isDefenseMap = false) {
    const Data = window.UniversumData;
    const pool = [];
    const wMult = 1 + (Number(tech?.weaponsTech || 0) * 0.1);
    const sMult = 1 + (Number(tech?.shieldingTech || 0) * 0.1);
    const aMult = 1 + (Number(tech?.armourTech || 0) * 0.1);

    for (const [id, countRaw] of Object.entries(unitMap || {})) {
      const count = Math.max(0, Math.floor(Number(countRaw) || 0));
      if (count <= 0) continue;
      const spec = isDefenseMap ? Data.DEFENSES[id] : (Data.SHIPS[id] || Data.DEFENSES[id]);
      if (!spec) continue;

      const maxHull = Math.floor(spec.hull * aMult);
      const maxShield = Math.floor(spec.shield * sMult);
      const attack = Math.floor(spec.attack * wMult);

      for (let i = 0; i < count; i++) {
        pool.push({
          id,
          isDefense: Boolean(Data.DEFENSES[id]),
          maxHull,
          hull: maxHull,
          maxShield,
          shield: maxShield,
          attack,
          rapidFire: spec.rapidFire || {},
          cost: spec.cost
        });
      }
    }
    return pool;
  }

  function summarizePool(pool) {
    const counts = {};
    for (const u of pool) {
      if (u.hull > 0) {
        counts[u.id] = (counts[u.id] || 0) + 1;
      }
    }
    return counts;
  }

  function resolveCombat(attackerFleet, attackerTech, defenderData, options = {}) {
    const Data = window.UniversumData;
    let attackers = expandUnitPool(attackerFleet, attackerTech, false);
    const defFleetUnits = expandUnitPool(defenderData.fleet || {}, defenderData.tech || {}, false);

    const defClean = Object.assign({}, defenderData.defenses || {});
    const trapCount = Math.max(0, Math.floor(Number(defClean.spaceTrap || 0)));
    delete defClean.spaceTrap;

    const defDefenseUnits = expandUnitPool(defClean, defenderData.tech || {}, true);
    let defenders = defFleetUnits.concat(defDefenseUnits);

    const log = [];
    const attackerInvictusCount = Math.max(0, Math.floor(Number(attackerFleet?.invictus || 0)));
    const defenderInvictusCount = Math.max(0, Math.floor(Number(defenderData.fleet?.invictus || 0)));

    if (trapCount > 0 && attackers.length > 0) {
      const trapSpec = Data.DEFENSES.spaceTrap;
      const wMult = 1 + (Number(defenderData.tech?.weaponsTech || 0) * 0.1);
      const totalTrapDamage = Math.floor(trapCount * trapSpec.attack * wMult);
      let remainingDmg = totalTrapDamage;
      let destroyedByTraps = 0;

      for (let i = 0; i < attackers.length && remainingDmg > 0; i++) {
        const target = attackers[i];
        if (target.hull <= 0) continue;
        const dmg = Math.min(target.hull, remainingDmg);
        target.hull -= dmg;
        remainingDmg -= dmg;
        if (target.hull <= 0) destroyedByTraps++;
      }
      attackers = attackers.filter((u) => u.hull > 0);
      log.push(`💥 ${trapCount} Trappole Spaziali detonate prima del contatto: ${totalTrapDamage.toLocaleString()} danni inflitti (${destroyedByTraps} navi attaccanti distrutte).`);
    }

    let roundsPlayed = 0;
    for (let round = 1; round <= 6; round++) {
      if (attackers.length === 0 || defenders.length === 0) break;
      roundsPlayed = round;

      for (const u of attackers) u.shield = u.maxShield;
      for (const u of defenders) u.shield = u.maxShield;

      for (let i = 0; i < attackers.length; i++) {
        const shooter = attackers[i];
        if (shooter.attack <= 0) continue;
        let keepFiring = true;
        let safetyShots = 0;

        while (keepFiring && safetyShots < 40) {
          keepFiring = false;
          safetyShots++;
          const targetIdx = Math.floor(Math.random() * defenders.length);
          const target = defenders[targetIdx];
          if (!target || target.hull <= 0) continue;

          const crepuscoloBlocked = target.id === 'crepuscolo' && attackerInvictusCount < 4;
          if (!crepuscoloBlocked) {
            if (target.shield > 0 && shooter.attack < target.shield * 0.01) {
            } else if (shooter.attack <= target.shield) {
              target.shield -= shooter.attack;
            } else {
              const hullDmg = shooter.attack - target.shield;
              target.shield = 0;
              target.hull -= hullDmg;
            }

            if (target.hull > 0 && target.hull < target.maxHull * 0.7) {
              const explodeProb = 1 - (target.hull / target.maxHull);
              if (Math.random() < explodeProb) {
                target.hull = 0;
              }
            }
          }

          const rf = shooter.rapidFire[target.id];
          if (rf && rf > 1) {
            if (Math.random() < (rf - 1) / rf) {
              keepFiring = true;
            }
          }
        }
      }

      for (let i = 0; i < defenders.length; i++) {
        const shooter = defenders[i];
        if (shooter.attack <= 0) continue;
        let keepFiring = true;
        let safetyShots = 0;

        while (keepFiring && safetyShots < 40) {
          keepFiring = false;
          safetyShots++;
          const targetIdx = Math.floor(Math.random() * attackers.length);
          const target = attackers[targetIdx];
          if (!target || target.hull <= 0) continue;

          const crepuscoloBlocked = target.id === 'crepuscolo' && defenderInvictusCount < 4;
          if (!crepuscoloBlocked) {
            if (target.shield > 0 && shooter.attack < target.shield * 0.01) {
            } else if (shooter.attack <= target.shield) {
              target.shield -= shooter.attack;
            } else {
              const hullDmg = shooter.attack - target.shield;
              target.shield = 0;
              target.hull -= hullDmg;
            }

            if (target.hull > 0 && target.hull < target.maxHull * 0.7) {
              const explodeProb = 1 - (target.hull / target.maxHull);
              if (Math.random() < explodeProb) {
                target.hull = 0;
              }
            }
          }

          const rf = shooter.rapidFire[target.id];
          if (rf && rf > 1) {
            if (Math.random() < (rf - 1) / rf) {
              keepFiring = true;
            }
          }
        }
      }

      attackers = attackers.filter((u) => u.hull > 0);
      defenders = defenders.filter((u) => u.hull > 0);
    }

    const attackerSurvivors = summarizePool(attackers);
    const defenderAllSurvivors = summarizePool(defenders);

    const attackerCrepUnit = attackers.find((unit) => unit.id === 'crepuscolo');
    const defenderCrepUnit = defenders.find((unit) => unit.id === 'crepuscolo');
    let attackerCrepuscoloDamaged = !!attackerCrepUnit && attackerCrepUnit.hull < attackerCrepUnit.maxHull;
    let defenderCrepuscoloDamaged = !!defenderCrepUnit && defenderCrepUnit.hull < defenderCrepUnit.maxHull;
    if (Number(attackerFleet?.crepuscolo || 0) > 0 && !attackerSurvivors.crepuscolo) {
      attackerSurvivors.crepuscolo = Math.floor(Number(attackerFleet.crepuscolo));
      attackerCrepuscoloDamaged = true;
    }
    if (Number(defenderData.fleet?.crepuscolo || 0) > 0 && !defenderAllSurvivors.crepuscolo) {
      defenderAllSurvivors.crepuscolo = Math.floor(Number(defenderData.fleet.crepuscolo));
      defenderCrepuscoloDamaged = true;
    }

    const defenderFleetSurvivors = {};
    const defenderDefenseSurvivors = {};
    for (const [id, cnt] of Object.entries(defenderAllSurvivors)) {
      if (Data.DEFENSES[id]) defenderDefenseSurvivors[id] = cnt;
      else defenderFleetSurvivors[id] = cnt;
    }

    let debrisMetal = 0;
    let debrisCrystal = 0;
    const attackerLosses = {};
    const defenderLosses = {};

    for (const [id, initCnt] of Object.entries(attackerFleet || {})) {
      const surv = attackerSurvivors[id] || 0;
      const lost = Math.max(0, initCnt - surv);
      if (lost > 0) {
        attackerLosses[id] = lost;
        const spec = Data.SHIPS[id];
        if (spec) {
          debrisMetal += Math.floor(spec.cost.metal * lost * 0.3);
          debrisCrystal += Math.floor(spec.cost.crystal * lost * 0.3);
        }
      }
    }

    for (const [id, initCnt] of Object.entries(defenderData.fleet || {})) {
      const surv = defenderFleetSurvivors[id] || 0;
      const lost = Math.max(0, initCnt - surv);
      if (lost > 0) {
        defenderLosses[id] = lost;
        const spec = Data.SHIPS[id];
        if (spec) {
          debrisMetal += Math.floor(spec.cost.metal * lost * 0.3);
          debrisCrystal += Math.floor(spec.cost.crystal * lost * 0.3);
        }
      }
    }

    const repairedDefenses = Object.assign({}, defenderDefenseSurvivors);
    for (const [id, initCnt] of Object.entries(defClean)) {
      const surv = defenderDefenseSurvivors[id] || 0;
      const lost = Math.max(0, initCnt - surv);
      if (lost > 0) {
        defenderLosses[id] = lost;
        const recovered = Math.floor(lost * 0.7);
        if (recovered > 0) {
          repairedDefenses[id] = (repairedDefenses[id] || 0) + recovered;
        }
      }
    }
    if (trapCount > 0) defenderLosses.spaceTrap = trapCount;

    let result = 'draw';
    if (attackers.length > 0 && defenders.length === 0) result = 'attacker_win';
    else if (attackers.length === 0 && defenders.length > 0) result = 'defender_win';

    const loot = { metal: 0, crystal: 0, deuterium: 0 };
    if (result === 'attacker_win') {
      const bunkerLv = Math.min(9, Number(defenderData.buildings?.hiddenBunker || 0));
      const unprotectedRatio = Math.max(0.1, 1 - bunkerLv * 0.1);
      const maxLootM = Math.floor((defenderData.resources?.metal || 0) * unprotectedRatio * 0.5);
      const maxLootC = Math.floor((defenderData.resources?.crystal || 0) * unprotectedRatio * 0.5);
      const maxLootD = Math.floor((defenderData.resources?.deuterium || 0) * unprotectedRatio * 0.5);

      let totalCargoCap = 0;
      for (const [id, cnt] of Object.entries(attackerSurvivors)) {
        const spec = Data.SHIPS[id];
        if (spec) totalCargoCap += (spec.cargo || 0) * cnt;
      }

      const desiredTotal = maxLootM + maxLootC + maxLootD;
      if (desiredTotal > 0 && totalCargoCap > 0) {
        const ratio = Math.min(1, totalCargoCap / desiredTotal);
        loot.metal = Math.floor(maxLootM * ratio);
        loot.crystal = Math.floor(maxLootC * ratio);
        loot.deuterium = Math.floor(maxLootD * ratio);
      }
    }

    let moonDestroyed = false;
    let bacinoDestroyed = false;
    let planetDestroyed = false;
    const survivingDeathStars = attackerSurvivors.deathStar || 0;

    if (survivingDeathStars > 0) {
      for (let i = 0; i < survivingDeathStars; i++) {
        if (defenderData.moon && !moonDestroyed && Math.random() < 0.10) {
          moonDestroyed = true;
          log.push('🌑💥 UNA MORTE NERA HA POLVERIZZATO LA LUNA NEMICA CON TUTTI I SUOI EDIFICI!');
        }
        if (options.allowBacinoDestruction && defenderData.bacinoSpaziale && defenderData.bacinoSpaziale.status === 'active' && !bacinoDestroyed && Math.random() < 0.10) {
          bacinoDestroyed = true;
          log.push('🛠️💥 UNA MORTE NERA HA POLVERIZZATO IL BACINO SPAZIALE NEMICO!');
        }
        if (!planetDestroyed && Math.random() < 0.01) {
          planetDestroyed = true;
          moonDestroyed = true;
          log.push('☄️☠️ EVENTO EPICO! IL SUPERLASER DELLA MORTE NERA HA DISINTEGRATO L’INTERO PIANETA!');
        }
      }
    }

    return {
      result,
      roundsPlayed,
      attackerSurvivors,
      defenderFleetSurvivors,
      repairedDefenses,
      attackerLosses,
      defenderLosses,
      loot,
      debris: { metal: debrisMetal, crystal: debrisCrystal },
      moonDestroyed,
      bacinoDestroyed,
      invictusLost: (attackerLosses.invictus || 0) + (defenderLosses.invictus || 0),
      attackerCrepuscoloDamaged,
      defenderCrepuscoloDamaged,
      planetDestroyed,
      log
    };
  }

  // =========================================================
  // 4. SIMULATORE
  // =========================================================
  function simulateBattle(attackerFleet, attackerTech, targetCoords, universe, iterations = 30) {
    const Data = window.UniversumData;
    const targetSlot = generateProceduralSlot(universe, targetCoords.g, targetCoords.s, targetCoords.p);
    if (targetSlot.ownerType !== 'bot') {
      throw new Error('Seleziona un pianeta BOT valido come bersaglio di simulazione.');
    }

    const reportsForTarget = (universe.spyReports || []).filter(
      (r) => r.coords && r.coords.g === targetCoords.g && r.coords.s === targetCoords.s && r.coords.p === targetCoords.p
    );
    const spyCount = reportsForTarget.length;

    let uncertainty = 0.25;
    if (spyCount >= 3) uncertainty = 0.05;
    else if (spyCount === 2) uncertainty = 0.10;
    else if (spyCount === 1) uncertainty = 0.20;

    let wins = 0;
    let draws = 0;
    let losses = 0;
    let sumAttackerLossCost = 0;
    let worstAttackerLossCost = 0;
    let sumLoot = 0;
    let sumDebris = 0;

    for (let it = 0; it < iterations; it++) {
      const scaleMap = (map) => {
        const out = {};
        for (const [k, v] of Object.entries(map || {})) {
          const jitter = 1 + ((Math.random() * 2 - 1) * uncertainty);
          out[k] = Math.max(0, Math.round(v * jitter));
        }
        return out;
      };

      const simDef = {
        fleet: scaleMap(targetSlot.fleet),
        defenses: scaleMap(targetSlot.defenses),
        tech: targetSlot.tech,
        resources: targetSlot.resources,
        buildings: targetSlot.buildings,
        moon: targetSlot.moon
      };

      const res = resolveCombat(attackerFleet, attackerTech, simDef);
      if (res.result === 'attacker_win') wins++;
      else if (res.result === 'draw') draws++;
      else losses++;

      let iterLossCost = 0;
      for (const [id, lostCnt] of Object.entries(res.attackerLosses)) {
        const spec = Data.SHIPS[id];
        if (spec) iterLossCost += (spec.cost.metal + spec.cost.crystal + spec.cost.deuterium) * lostCnt;
      }

      sumAttackerLossCost += iterLossCost;
      if (iterLossCost > worstAttackerLossCost) worstAttackerLossCost = iterLossCost;
      sumLoot += res.loot.metal + res.loot.crystal + res.loot.deuterium;
      sumDebris += res.debris.metal + res.debris.crystal;
    }

    const winPct = Math.round((wins / iterations) * 100);
    const drawPct = Math.round((draws / iterations) * 100);
    const losePct = Math.max(0, 100 - winPct - drawPct);
    const dsCount = Math.max(0, Math.floor(Number(attackerFleet?.deathStar || 0)));

    const moonDestroyChance = targetSlot.moon
      ? Math.round((1 - Math.pow(0.90, dsCount)) * 1000) / 10
      : 0;
    const planetDestroyChance = Math.round((1 - Math.pow(0.99, dsCount)) * 1000) / 10;

    let advice = 'ATTACCO RISCHIOSO';
    if (winPct >= 80 && losePct <= 5) advice = 'ATTACCO CONSIGLIATO';
    else if (winPct < 45 || losePct >= 35) advice = 'NON ATTACCARE - SEI TROPPO DEBOLE';

    return {
      iterations,
      spyCount,
      uncertaintyPct: Math.round(uncertainty * 100),
      winPct,
      drawPct,
      losePct,
      avgLosses: Math.floor(sumAttackerLossCost / iterations),
      worstLosses: worstAttackerLossCost,
      estimatedLoot: Math.floor(sumLoot / iterations),
      debrisCreated: Math.floor(sumDebris / iterations),
      moonDestroyChance,
      planetDestroyChance,
      advice
    };
  }

  // =========================================================
  // 5. LANCI FLOTTE, SPIONAGGIO, SPEDIZIONI, COMMERCIO E IA BOT
  // =========================================================
  function calculateDistance(c1, c2) {
    if (c1.g !== c2.g) return Math.abs(c1.g - c2.g) * 20000;
    if (c1.s !== c2.s) return Math.abs(c1.s - c2.s) * 95 + 2700;
    if (c1.p !== c2.p) return Math.abs(c1.p - c2.p) * 5 + 1000;
    return 5;
  }

  function getFleetSpeedAndFuel(universe, fleet, distance, speedPct = 100) {
    const Data = window.UniversumData;
    let minSpeed = Infinity;
    let totalFuelPerDist = 0;

    for (const [shipId, cntRaw] of Object.entries(fleet || {})) {
      const cnt = Math.max(0, Math.floor(Number(cntRaw) || 0));
      if (cnt <= 0 || shipId === 'solarSatellite') continue;
      const spec = Data.SHIPS[shipId];
      if (!spec) continue;

      const driveLv = Number(universe.researches?.[spec.driveType] || 0);
      let bonusPerLv = 0.1;
      if (spec.driveType === 'impulseDrive') bonusPerLv = 0.2;
      else if (spec.driveType === 'hyperspaceDrive') bonusPerLv = 0.3;

      const effectiveShipSpeed = spec.speed * (1 + driveLv * bonusPerLv);
      if (effectiveShipSpeed < minSpeed) minSpeed = effectiveShipSpeed;
      totalFuelPerDist += (spec.fuelConsumption || 10) * cnt;
    }

    if (!isFinite(minSpeed) || minSpeed <= 0) minSpeed = 5000;
    const speedMult = window.UniversumEngine
      ? window.UniversumEngine.getEffectiveSpeed(universe)
      : (universe.speed || 10);

    const pct = Math.min(100, Math.max(10, Number(speedPct) || 100)) / 100;
    const baseSec = 10 + (35000 / Math.sqrt(speedMult)) * Math.sqrt((distance * 10) / minSpeed);
    const durationSec = universe.creativeMode
      ? 3
      : Math.max(5, Math.floor(baseSec / pct));

    const fuelFactor = 0.2 + 0.8 * (pct * pct);
    const fuelCost = universe.creativeMode
      ? 0
      : Math.max(1, Math.floor((1 + (totalFuelPerDist * distance) / 35000) * fuelFactor));

    return { minSpeed, durationSec, fuelCost };
  }

  function findEmbargoAt(universe, coords) {
    if (!universe || !coords) return null;
    const same = (a) => Number(a?.g) === Number(coords.g) && Number(a?.s) === Number(coords.s) && Number(a?.p) === Number(coords.p);
    return (universe.activeSieges || []).find((s) => s.type === 'embargo' && same(s.targetCoords)) ||
      (universe.incomingSieges || []).find((s) => s.type === 'embargo' && same(s.targetCoords)) || null;
  }

  // *** MODIFICA A: launchFleet accetta origine "galattica" ***
  function launchFleet(universe, originPlanetIndex, targetCoords, mission, fleetSelection, cargo = { metal: 0, crystal: 0, deuterium: 0 }, options = {}) {
    const isGalatticaOrigin = options.originType === 'galattica';

    let originP = null;
    let originG = null;
    let originCoords = null;
    let shipSource = null;
    let resourceSource = null;

    if (isGalatticaOrigin) {
      originG = findGalattica(universe, options.originGalatticaId);
      if (!originG) throw new Error('Galattica di partenza non trovata.');
      if (mission === 'colonize' || mission === 'deploy') {
        throw new Error('Missione non disponibile dalla Galattica.');
      }
      originCoords = Object.assign({}, originG.coords);
      shipSource = originG.orbitingFleet;
      resourceSource = originG.resources;
    } else {
      originP = universe.planets[originPlanetIndex];
      if (!originP) throw new Error('Pianeta di partenza non valido.');
      originCoords = Object.assign({}, originP.coords);
      shipSource = originP.fleet;
      resourceSource = originP.resources;
    }

    if (findEmbargoAt(universe, originCoords) && mission !== 'attack') {
      throw new Error(`Partenza bloccata dall'Embargo Planetario su [${originCoords.g}:${originCoords.s}:${originCoords.p}].`);
    }
    if (findEmbargoAt(universe, targetCoords) && mission !== 'attack') {
      throw new Error(`Rotta bloccata dall'Embargo Planetario su [${targetCoords.g}:${targetCoords.s}:${targetCoords.p}].`);
    }

    const maxSlots = universe.creativeMode ? 999 : (5 + Number(universe.researches?.computerTech || 0));
    if ((universe.fleetsInFlight || []).length >= maxSlots) {
      throw new Error(`Slot flotta esauriti (${maxSlots} max). Potenzia Tecnologia Informatica.`);
    }

    const cleanFleet = {};
    let totalShips = 0;
    let totalCargoCap = 0;
    const Data = window.UniversumData;

    for (const [id, rawQty] of Object.entries(fleetSelection || {})) {
      const qty = Math.max(0, Math.floor(Number(rawQty) || 0));
      if (qty <= 0 || id === 'solarSatellite') continue;

      let avail;
      if (isGalatticaOrigin) {
        if (id === 'invictus' || id === 'crepuscolo') continue;
        avail = Number(shipSource[id] || 0);
      } else {
        avail = id === 'invictus'
          ? Number(originP.bacinoSpaziale?.invictusActive || 0)
          : id === 'crepuscolo'
            ? (originP.bacinoSpaziale?.crepuscolo?.status === 'active' ? 1 : 0)
            : Number(originP.fleet?.[id] || 0);
      }
      if (qty > avail) {
        throw new Error(`Navi insufficienti ${isGalatticaOrigin ? 'nella Galattica' : `su ${originP.name}`}: ${Data.SHIPS[id]?.name || id}.`);
      }
      cleanFleet[id] = qty;
      totalShips += qty;
      totalCargoCap += (Data.SHIPS[id]?.cargo || 0) * qty;
    }

    if (totalShips === 0) throw new Error('Seleziona almeno una nave per la missione.');

    if (mission === 'spy' && !cleanFleet.espionageProbe) {
      throw new Error('Devi inviare almeno una Sonda Spia per la missione Spionaggio.');
    }
    if (mission === 'colonize' && !cleanFleet.colonyShip) {
      throw new Error('Devi includere almeno una Colonizzatrice.');
    }
    if (mission === 'recycle' && !cleanFleet.recycler) {
      throw new Error('Devi includere almeno una Riciclatrice.');
    }
    if (mission === 'destroyMoon' && !cleanFleet.deathStar) {
      throw new Error('Serve almeno una Morte Nera per tentare la distruzione di una Luna/Bacino.');
    }

    let invictusJumpFuel = 0;
    if (!isGalatticaOrigin && cleanFleet.invictus) {
      if (Number(targetCoords.g) !== Number(originCoords.g)) {
        throw new Error('L\'Invictus non può saltare tra galassie: destinazione in un\'altra galassia.');
      }
      invictusJumpFuel = universe.creativeMode ? 0 : getInvictusJumpCost(originCoords, targetCoords, cleanFleet.invictus);
    }

    const distance = calculateDistance(originCoords, targetCoords);
    const fleetStats = getFleetSpeedAndFuel(universe, cleanFleet, distance, options.fuelPercent || 100);
    const durationSec = fleetStats.durationSec;
    const fuelCost = fleetStats.fuelCost + invictusJumpFuel;

    const loadM = Math.max(0, Math.floor(Number(cargo.metal) || 0));
    const loadC = Math.max(0, Math.floor(Number(cargo.crystal) || 0));
    const loadD = Math.max(0, Math.floor(Number(cargo.deuterium) || 0));

    const blackHoleFee = (!universe.creativeMode && mission === 'explore' && options.blackHole) ? 50000 : 0;

    if (loadM + loadC + loadD + fuelCost > totalCargoCap && !universe.creativeMode) {
      throw new Error('Capacità di carico delle navi insufficiente per risorse + carburante.');
    }

    if (!universe.creativeMode) {
      if (
        resourceSource.metal < loadM ||
        resourceSource.crystal < loadC ||
        resourceSource.deuterium < (loadD + fuelCost + blackHoleFee)
      ) {
        throw new Error(`Risorse o carburante insufficienti${isGalatticaOrigin ? ' nella stiva della Galattica' : ''} (Carburante richiesto: ${fuelCost.toLocaleString()} D).`);
      }
      resourceSource.metal -= loadM;
      resourceSource.crystal -= loadC;
      resourceSource.deuterium -= (loadD + fuelCost + blackHoleFee);
    }

    for (const [id, qty] of Object.entries(cleanFleet)) {
      if (isGalatticaOrigin) {
        shipSource[id] -= qty;
      } else if (id === 'invictus') {
        originP.bacinoSpaziale.invictusActive -= qty;
      } else if (id === 'crepuscolo') {
        originP.bacinoSpaziale.crepuscolo.status = 'inMission';
      } else {
        originP.fleet[id] -= qty;
      }
    }

    const now = Date.now();
    const missionObj = {
      id: 'flt_' + now + '_' + Math.random().toString(36).substring(2, 6),
      mission,
      originPlanetId: isGalatticaOrigin ? null : originP.id,
      originCoords: Object.assign({}, originCoords),
      targetCoords: Object.assign({}, targetCoords),
      ships: Object.assign({}, cleanFleet),
      fleet: cleanFleet,
      cargo: { metal: loadM, crystal: loadC, deuterium: loadD },
      options,
      status: 'outbound',
      departureTime: now,
      startTime: now,
      arrivalTime: now + durationSec * 1000,
      returnTime: now + durationSec * 2000,
      durationSec
    };

    if (isGalatticaOrigin) {
      missionObj.originGalatticaId = originG.id;
    }

    if (!Array.isArray(universe.fleetsInFlight)) universe.fleetsInFlight = [];
    universe.fleetsInFlight.push(missionObj);
    return missionObj;
  }

  function formatUnitList(map) {
    const Data = window.UniversumData;
    const parts = Object.entries(map || {})
      .filter(([, cnt]) => Number(cnt) > 0)
      .map(([id, cnt]) => `${(Data.SHIPS[id] || Data.DEFENSES[id])?.name || id} x${Number(cnt).toLocaleString('it-IT')}`);
    return parts.length > 0 ? parts.join(', ') : 'nessuna';
  }

  function formatCombatDetails(combat) {
    if (!combat) return '';
    return `Perdite attaccante: ${formatUnitList(combat.attackerLosses)}. ` +
      `Perdite difensore: ${formatUnitList(combat.defenderLosses)}. ` +
      `Superstiti attaccante: ${formatUnitList(combat.attackerSurvivors)}. ` +
      `Superstiti difensore: ${formatUnitList(combat.defenderFleetSurvivors)} (flotta), ${formatUnitList(combat.repairedDefenses)} (difese dopo riparazione).`;
  }

  function addMessage(universe, type, title, body) {
    if (!Array.isArray(universe.messages)) universe.messages = [];
    universe.messages.unshift({
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      time: Date.now(),
      type,
      title,
      body
    });
    if (universe.messages.length > 80) {
      universe.messages.length = 80;
    }
  }

  function handleMissionArrival(universe, flt) {
    const now = Date.now();
    const key = coordKey(flt.targetCoords.g, flt.targetCoords.s, flt.targetCoords.p);
    if (!universe.galaxyDeltas) universe.galaxyDeltas = {};

    if (!flt.fleet && flt.ships) flt.fleet = Object.assign({}, flt.ships);
    if (!flt.ships && flt.fleet) flt.ships = Object.assign({}, flt.fleet);

    if (flt.mission === 'spy') {
      const slot = generateProceduralSlot(universe, flt.targetCoords.g, flt.targetCoords.s, flt.targetCoords.p);
      if (slot.ownerType !== 'bot') {
        addMessage(universe, 'spy', `Spionaggio [${key}]`, 'Nessuna civiltà rilevata alle coordinate indicate.');
      } else {
        const probes = flt.fleet.espionageProbe || 1;
        const myEsp = Number(universe.researches?.espionageTech || 0);
        const defEsp = Number(slot.tech?.espionageTech || 0);
        const defProbes = Number(slot.fleet?.espionageProbe || 0);

        const diff = (myEsp - defEsp) + Math.floor(Math.sqrt(probes));
        const catchChance = Math.min(0.85, Math.max(0.02, (defProbes / (probes * 8)) * 0.25 - diff * 0.03));
        const probesLost = Math.random() < catchChance ? Math.min(probes, Math.ceil(probes * 0.5)) : 0;
        flt.fleet.espionageProbe = Math.max(0, probes - probesLost);
        flt.ships = Object.assign({}, flt.fleet);

        if (!Array.isArray(universe.spyReports)) universe.spyReports = [];
        const prevScans = universe.spyReports.filter((r) => r.key === key).length;

        const report = {
          id: 'spy_' + now + '_' + Math.random().toString(36).substring(2, 5),
          time: now,
          key,
          coords: Object.assign({}, flt.targetCoords),
          targetName: slot.name,
          emperor: slot.emperor,
          tier: slot.tier,
          personality: slot.personality,
          scanCount: prevScans + 1,
          resources: Object.assign({}, slot.resources),
          fleet: diff >= 0 ? Object.assign({}, slot.fleet) : null,
          defenses: diff >= 1 ? Object.assign({}, slot.defenses) : null,
          buildings: diff >= 2 ? Object.assign({}, slot.buildings) : null,
          tech: diff >= 3 ? Object.assign({}, slot.tech) : null,
          hasMoon: Boolean(slot.moon)
        };
        universe.spyReports.unshift(report);
        if (universe.spyReports.length > 50) universe.spyReports.length = 50;

        addMessage(
          universe,
          'spy',
          `Rapporto Spia: ${slot.name} [${key}]`,
          `Scansione #${report.scanCount} completata su ${slot.emperor} (${slot.tier}). Risorse: ${slot.resources.metal.toLocaleString()} M, ${slot.resources.crystal.toLocaleString()} C, ${slot.resources.deuterium.toLocaleString()} D. Sonde perse: ${probesLost}.`
        );
      }
      flt.status = 'returning';
      return;
    }

    if (flt.mission === 'colonize') {
      const slot = generateProceduralSlot(universe, flt.targetCoords.g, flt.targetCoords.s, flt.targetCoords.p);
      const isSlotFree = slot.ownerType === 'empty' || slot.ownerType === 'none' || slot.type === 'empty';
      if (!isSlotFree) {
        addMessage(universe, 'fleet', `Colonizzazione Fallita [${key}]`, 'Lo slot è già occupato da un altro pianeta. La flotta torna alla base.');
        flt.status = 'returning';
        return;
      }

      if ((flt.fleet.colonyShip || 0) < 1) {
        addMessage(universe, 'fleet', `Colonizzazione Fallita [${key}]`, 'Nessuna Colonizzatrice presente nella flotta.');
        flt.status = 'returning';
        return;
      }

      flt.fleet.colonyShip = Math.max(0, (flt.fleet.colonyShip || 1) - 1);
      flt.ships = Object.assign({}, flt.fleet);

      const colNum = universe.planets.length + 1;
      const colName = `Colonia ${colNum}`;
      const newPlanet = {
        id: 'planet_' + now + '_' + Math.random().toString(36).substring(2, 6),
        name: colName,
        coords: Object.assign({}, flt.targetCoords),
        minTemp: slot.minTemp,
        maxTemp: slot.maxTemp,
        fieldsMax: slot.fieldsMax,
        resources: {
          metal: 1000 + (flt.cargo.metal || 0),
          crystal: 1000 + (flt.cargo.crystal || 0),
          deuterium: 500 + (flt.cargo.deuterium || 0)
        },
        buildings: {
          metalMine: 0, crystalMine: 0, deuteriumSynth: 0, solarPlant: 0, fusionReactor: 0,
          roboticsFactory: 0, naniteFactory: 0, shipyard: 0, metalStorage: 0, crystalStorage: 0,
          deuteriumTank: 0, researchLab: 0, terraformer: 0, hiddenBunker: 0
        },
        defenses: {},
        fleet: {},
        buildQueue: [],
        shipyardQueue: [],
        defenseQueue: [],
        moon: null,
        bacinoSpaziale: null
      };

      universe.planets.push(newPlanet);
      universe.galaxyDeltas[key] = Object.assign({}, universe.galaxyDeltas[key], {
        destroyed: false,
        owner: 'player',
        ownerType: 'player',
        emperor: universe.emperor,
        planetName: colName,
        planetId: newPlanet.id
      });

      if (window.UniversumUI?.refreshPlanetSelector) {
        window.UniversumUI.refreshPlanetSelector();
      }

      flt.cargo = { metal: 0, crystal: 0, deuterium: 0 };
      flt.status = 'returning';
      addMessage(universe, 'fleet', `Nuova Colonia Fondata [${key}]`, `${colName} (${slot.fieldsMax} campi) è ora parte del tuo Impero!`);
      return;
    }

    if (flt.mission === 'transport' || flt.mission === 'deploy') {
      const destPlanet = universe.planets.find(
        (p) => p.coords.g === flt.targetCoords.g && p.coords.s === flt.targetCoords.s && p.coords.p === flt.targetCoords.p
      );
      if (destPlanet) {
        destPlanet.resources.metal += flt.cargo.metal;
        destPlanet.resources.crystal += flt.cargo.crystal;
        destPlanet.resources.deuterium += flt.cargo.deuterium;
        flt.cargo = { metal: 0, crystal: 0, deuterium: 0 };

        if (flt.mission === 'deploy') {
          for (const [id, qty] of Object.entries(flt.fleet)) {
            destPlanet.fleet[id] = (destPlanet.fleet[id] || 0) + qty;
          }
          addMessage(universe, 'fleet', `Flotta Schierata su ${destPlanet.name}`, 'Navi e risorse trasferite con successo.');
          return 'remove';
        }
        addMessage(universe, 'fleet', `Trasporto Consegnato su ${destPlanet.name}`, 'Risorse scaricate. La flotta rientra.');
      }
      flt.status = 'returning';
      return;
    }

    if (flt.mission === 'recycle') {
      const slot = generateProceduralSlot(universe, flt.targetCoords.g, flt.targetCoords.s, flt.targetCoords.p);
      const debris = slot.debris || { metal: 0, crystal: 0 };
      const Data = window.UniversumData;
      let recCap = 0;
      for (const [id, qty] of Object.entries(flt.fleet)) {
        recCap += (Data.SHIPS[id]?.cargo || 0) * qty;
      }
      const alreadyLoaded = flt.cargo.metal + flt.cargo.crystal + flt.cargo.deuterium;
      const freeCap = Math.max(0, recCap - alreadyLoaded);

      const takeM = Math.min(debris.metal, Math.floor(freeCap * 0.6));
      const takeC = Math.min(debris.crystal, freeCap - takeM);

      flt.cargo.metal += takeM;
      flt.cargo.crystal += takeC;
      universe.galaxyDeltas[key] = Object.assign({}, universe.galaxyDeltas[key], {
        debris: {
          metal: Math.max(0, debris.metal - takeM),
          crystal: Math.max(0, debris.crystal - takeC)
        }
      });

      addMessage(universe, 'fleet', `Raccolta Detriti [${key}]`, `Riciclati ${takeM.toLocaleString()} Metallo e ${takeC.toLocaleString()} Cristallo.`);
      flt.status = 'returning';
      return;
    }

    if (flt.mission === 'explore') {
      const crepDef = window.UniversumData.CREPUSCOLO;
      const exploreHours = Number(flt.exploreHours || flt.options?.exploreHours || 1);
      const deathStarsArrived = Math.max(0, Math.floor(Number((flt.fleet || {}).deathStar || 0)));
      if (!(flt.options && flt.options.blackHole) && exploreHours >= crepDef.wreckExploreHours && deathStarsArrived >= crepDef.wreckMinDeathStars && Math.random() < crepDef.wreckChance) {
        if (getCrepuscoloState(universe).has) {
          addMessage(universe, 'expedition', `Relitto Crepuscolo Perso [${key}]`,
            'Avete trovato il relitto di una Crepuscolo degli Dei, ma ne possedete già una nel vostro impero (max 1): il relitto è andato perso.');
        } else {
          const emptyPlanet = (universe.planets || []).find((pl) => isBacinoVuoto(pl));
          if (!emptyPlanet) {
            addMessage(universe, 'expedition', `Relitto Crepuscolo Sparito [${key}]`,
              'Avete trovato il relitto di una Crepuscolo degli Dei, ma non esiste un Bacino Spaziale vuoto (Bacini inesistenti oppure già usati/occupati): il relitto è sparito nello spazio profondo.');
          } else if (assignCrepuscoloWreck(universe, emptyPlanet)) {
            addMessage(universe, 'expedition', `🌌 RELITTO CREPUSCOLO RECUPERATO [${key}]!`,
              `Il relitto di una Crepuscolo degli Dei è stato agganciato al Bacino Spaziale vuoto su ${emptyPlanet.name}: riparazione di ${crepDef.wreckRepairDays} giorni reali avviata.`);
          }
        }
        flt.status = 'returning';
        return;
      }
      const roll = Math.random();
      if (flt.options && flt.options.blackHole) {
        if (roll < 0.05) {
          flt.cargo.metal += 500000;
          flt.cargo.crystal += 300000;
          flt.cargo.deuterium += 200000;
          addMessage(universe, 'expedition', `🌌 SINGOLARITÀ SUPERATA [${key}]!`, 'La flotta emerge dall’orizzonte degli eventi con 1.000.000 di risorse esotiche!');
        } else if (roll < 0.35) {
          for (const id of Object.keys(flt.fleet)) {
            flt.fleet[id] = Math.floor(flt.fleet[id] * 0.7);
          }
          flt.ships = Object.assign({}, flt.fleet);
          addMessage(universe, 'expedition', `⚠️ Anomalia Gravitazionale [${key}]`, 'Il Buco Nero ha danneggiato il 30% della flotta esplorativa.');
        } else {
          flt.cargo.deuterium += 25000;
          addMessage(universe, 'expedition', `Spedizione Buco Nero [${key}]`, 'Raccolti 25.000 isotopi di Deuterio puro dalla corona.');
        }
      } else {
        if (roll < 0.35) {
          const foundM = Math.floor(15000 + Math.random() * 45000);
          const foundC = Math.floor(10000 + Math.random() * 30000);
          flt.cargo.metal += foundM;
          flt.cargo.crystal += foundC;
          addMessage(universe, 'expedition', `Giacimento Asteroidi [${key}]`, `Trovati ${foundM.toLocaleString()} Metallo e ${foundC.toLocaleString()} Cristallo.`);
        } else if (roll < 0.55) {
          flt.fleet.lightFighter = (flt.fleet.lightFighter || 0) + 5;
          flt.fleet.cruiser = (flt.fleet.cruiser || 0) + 1;
          flt.ships = Object.assign({}, flt.fleet);
          addMessage(universe, 'expedition', `Relitto Flotta Abbandonata [${key}]`, 'Recuperati 5 Caccia Leggeri e 1 Incrociatore ancora funzionanti!');
        } else if (roll < 0.62) {
          const originP = universe.planets.find((p) => p.id === flt.originPlanetId) || universe.planets[0];
          if (originP && originP.resources.metal >= 250000 && originP.resources.crystal >= 125000) {
            originP.resources.metal -= 250000;
            originP.resources.crystal -= 125000;
            flt.fleet.deathStar = (flt.fleet.deathStar || 0) + 1;
            flt.ships = Object.assign({}, flt.fleet);
            addMessage(universe, 'expedition', `☠️ RELITTO ANTICO RIPARATO [${key}]!`, 'I tuoi ingegneri hanno riparato una Morte Nera antica usando 250k Metallo e 125k Cristallo!');
          } else {
            flt.cargo.metal += 80000;
            addMessage(universe, 'expedition', `Relitto Antico [${key}]`, 'Trovato scafo di Morte Nera irrecuperabile senza 250k M / 125k C: smantellati 80.000 Metallo.');
          }
        } else if (roll < 0.80) {
          const pirateCombat = resolveCombat(flt.fleet, universe.researches, {
            fleet: { lightFighter: 12, cruiser: 3 },
            defenses: {},
            tech: { weaponsTech: 3, shieldingTech: 3, armourTech: 3 },
            resources: { metal: 12000, crystal: 8000, deuterium: 2000 }
          });
          flt.fleet = pirateCombat.attackerSurvivors;
          flt.ships = Object.assign({}, flt.fleet);
          if (pirateCombat.attackerCrepuscoloDamaged && Number(flt.fleet.crepuscolo || 0) > 0) flt.crepuscoloDamaged = true;
          flt.cargo.metal += pirateCombat.loot.metal;
          flt.cargo.crystal += pirateCombat.loot.crystal;
          addMessage(universe, 'combat', `Imboscata Pirata [${key}]`, `Esito: ${pirateCombat.result}. Round: ${pirateCombat.roundsPlayed}. Bottino recuperato: ${pirateCombat.loot.metal.toLocaleString()} M / ${pirateCombat.loot.crystal.toLocaleString()} C / ${pirateCombat.loot.deuterium.toLocaleString()} D. Detriti: ${pirateCombat.debris.metal.toLocaleString()} M, ${pirateCombat.debris.crystal.toLocaleString()} C. ${formatCombatDetails(pirateCombat)}`);
        } else {
          addMessage(universe, 'expedition', `Spedizione Tranquilla [${key}]`, 'Nessuna anomalia rilevata nel settore.');
        }
      }
      flt.status = 'returning';
      return;
    }

    if (flt.mission === 'embargo' || flt.mission === 'occupy' || flt.mission === 'blockade') {
      const siegeType = flt.mission === 'occupy' ? 'occupy' : 'embargo';
      const slot = generateProceduralSlot(universe, flt.targetCoords.g, flt.targetCoords.s, flt.targetCoords.p);
      const ownPlanet = universe.planets.find((p) => p.coords.g === flt.targetCoords.g && p.coords.s === flt.targetCoords.s && p.coords.p === flt.targetCoords.p);
      const defenderData = ownPlanet
        ? { fleet: ownPlanet.fleet || {}, defenses: ownPlanet.defenses || {}, tech: universe.researches || {}, resources: ownPlanet.resources, buildings: ownPlanet.buildings || {}, moon: ownPlanet.moon || null }
        : slot;
      if (!ownPlanet && slot.ownerType !== 'bot') {
        addMessage(universe, 'combat', `Missione ${siegeType === 'embargo' ? 'Embargo' : 'Occupazione'} annullata [${key}]`, 'Nessun bersaglio ostile alle coordinate.');
        flt.status = 'returning';
        return;
      }
      const combat = resolveCombat(flt.fleet, universe.researches, defenderData);
      addMessage(universe, 'combat', `Rapporto Difesa [${key}] — ${combat.result.toUpperCase()} (${siegeType === 'embargo' ? 'Embargo' : 'Occupazione'})`,
        `Il pianeta attaccato ha affrontato la flotta ${siegeType === 'embargo' ? 'da embargo' : 'di occupazione'}. Round: ${combat.roundsPlayed}. ${formatCombatDetails(combat)}`);
      if (ownPlanet) {
        ownPlanet.fleet = { ...combat.defenderFleetSurvivors };
        ownPlanet.defenses = { ...combat.repairedDefenses };
      } else {
        universe.galaxyDeltas[key] = Object.assign({}, universe.galaxyDeltas[key], {
          fleetOverride: combat.defenderFleetSurvivors,
          defensesOverride: combat.repairedDefenses,
          debris: { metal: (slot.debris?.metal || 0) + combat.debris.metal, crystal: (slot.debris?.crystal || 0) + combat.debris.crystal }
        });
      }
      const survivors = combat.attackerSurvivors || {};
      const survivorCount = Object.values(survivors).reduce((acc, q) => acc + Number(q || 0), 0);
      if (combat.result !== 'attacker_win' || survivorCount <= 0) {
        addMessage(universe, 'combat', `Rapporto Battaglia [${key}] — ${combat.result.toUpperCase()} (${siegeType === 'embargo' ? 'Embargo' : 'Occupazione'} respinto)`,
          `Round: ${combat.roundsPlayed}. ${formatCombatDetails(combat)}`);
        flt.fleet = { ...survivors };
        flt.ships = { ...survivors };
        flt.status = 'returning';
        return survivorCount <= 0 ? 'remove' : undefined;
      }
      if (!Array.isArray(universe.activeSieges)) universe.activeSieges = [];
      const startFuel = siegeType === 'embargo' ? Number(flt.cargo?.deuterium || 0) : 0;
      const targetDeut = Number(defenderData.resources?.deuterium || 0);
      universe.activeSieges.push({
        id: 'siege_' + now + '_' + Math.random().toString(36).slice(2, 6),
        type: siegeType,
        originPlanetId: flt.originPlanetId,
        originCoords: { ...flt.originCoords },
        targetCoords: { ...flt.targetCoords },
        targetName: ownPlanet?.name || slot.name || key,
        ships: { ...survivors },
        cargo: { ...(flt.cargo || { metal: 0, crystal: 0, deuterium: 0 }) },
        fuelRemaining: startFuel,
        targetDeuterium: targetDeut,
        deuteriumInitial: siegeType === 'embargo' ? startFuel : targetDeut,
        ransom: flt.ransomDemand || flt.ransom || { metal: 10000, crystal: 5000, deuterium: 2500 },
        startedAt: now,
        lastTickAt: now
      });
      addMessage(universe, 'combat', siegeType === 'embargo' ? `Embargo Planetario attivo su [${key}]` : `Occupazione Planetaria avviata su [${key}]`,
        (siegeType === 'embargo'
          ? `Battaglia vinta. Rotte da/per il pianeta bloccate finche' resta deuterio in stiva (${Math.floor(startFuel).toLocaleString()} D). `
          : `Battaglia vinta. Prelievo 5% risorse/giorno, mantenimento dal deuterio del pianeta occupato (${Math.floor(targetDeut).toLocaleString()} D). `) +
        `Round: ${combat.roundsPlayed}. ${formatCombatDetails(combat)}`);
      return 'remove';
    }

    if (flt.mission === 'attack' || flt.mission === 'destroyMoon') {
      const siegeIdx = (universe.incomingSieges || []).findIndex(
        (s) => Number(s.targetCoords?.g) === Number(flt.targetCoords.g) && Number(s.targetCoords?.s) === Number(flt.targetCoords.s) && Number(s.targetCoords?.p) === Number(flt.targetCoords.p)
      );
      if (flt.mission === 'attack' && siegeIdx >= 0) {
        const siege = universe.incomingSieges[siegeIdx];
        const orbitCombat = resolveCombat(flt.fleet, universe.researches, {
          fleet: siege.ships || {},
          defenses: {},
          tech: siege.tech || { weaponsTech: 2, shieldingTech: 2, armourTech: 2 },
          resources: { metal: 0, crystal: 0, deuterium: 0 },
          buildings: {}
        });
        addMessage(universe, 'combat', `Rapporto Difesa [${key}] — ${orbitCombat.result.toUpperCase()} (Scaccia Flotta)`,
          `La flotta in orbita (${siege.type === 'occupy' ? 'Occupazione' : 'Embargo'}) e' stata ingaggiata. Round: ${orbitCombat.roundsPlayed}. Detriti: ${orbitCombat.debris.metal.toLocaleString()} M, ${orbitCombat.debris.crystal.toLocaleString()} C. ${formatCombatDetails(orbitCombat)}`);
        flt.fleet = { ...orbitCombat.attackerSurvivors };
        flt.ships = { ...orbitCombat.attackerSurvivors };
        if (orbitCombat.result === 'attacker_win') {
          universe.incomingSieges.splice(siegeIdx, 1);
          addMessage(universe, 'combat', `Flotta Scacciata [${key}] — ${siege.type === 'occupy' ? 'Occupazione' : 'Embargo'} terminato`,
            `La flotta nemica in orbita e' stata distrutta: ${siege.type === 'occupy' ? "l'Occupazione" : "l'Embargo"} sul pianeta e' finito. ${formatCombatDetails(orbitCombat)}`);
        } else {
          siege.ships = { ...orbitCombat.defenderFleetSurvivors };
        }
        flt.status = 'returning';
        return Object.values(flt.fleet).reduce((acc, q) => acc + Number(q || 0), 0) <= 0 ? 'remove' : undefined;
      }

      const galatticaTarget = flt.mission === 'destroyMoon' ? findGalatticaAt(universe, flt.targetCoords) : null;
      if (galatticaTarget) {
        const gCombat = resolveCombat(flt.fleet, universe.researches, {
          fleet: {}, defenses: galatticaTarget.defenses || {}, tech: {},
          resources: galatticaTarget.resources, buildings: {}, moon: null, bacinoSpaziale: null
        });
        flt.fleet = gCombat.attackerSurvivors;
        flt.ships = Object.assign({}, flt.fleet);
        if (gCombat.attackerCrepuscoloDamaged && Number(flt.fleet.crepuscolo || 0) > 0) flt.crepuscoloDamaged = true;
        const dsCount = Math.max(0, Math.floor(Number(gCombat.attackerSurvivors.deathStar || 0)));
        const destroyChance = 1 - Math.pow(0.90, dsCount);
        if (gCombat.result === 'attacker_win' && dsCount > 0 && Math.random() < destroyChance) {
          universe.galattiche = (universe.galattiche || []).filter((gal) => gal.id !== galatticaTarget.id);
          const moonFormed = Math.random() < 0.75;
          const targetPlanet = (universe.planets || []).find((pl) => pl.coords.g === flt.targetCoords.g && pl.coords.s === flt.targetCoords.s && pl.coords.p === flt.targetCoords.p);
          if (moonFormed && targetPlanet && !targetPlanet.moon && !targetPlanet.bacinoSpaziale) {
            targetPlanet.moon = makeMoon('Luna');
          }
          universe.galaxyDeltas[key] = Object.assign({}, universe.galaxyDeltas[key], {
            galatticaId: null, hasBacino: false,
            hasMoon: moonFormed ? true : Boolean(targetPlanet && targetPlanet.moon),
            moonName: moonFormed ? 'Luna' : undefined
          });
          addMessage(universe, 'combat', `Galattica Distrutta [${key}]!`,
            `La tua Morte Nera ha distrutto la Galattica nemica. Il Bacino non torna: ${moonFormed ? 'dai detriti si è formata una Luna.' : 'resta spazio vuoto.'}`);
        } else {
          addMessage(universe, 'combat', `Attacco alla Galattica [${key}] — ${gCombat.result.toUpperCase()}`,
            `La Galattica alle coordinate ha resistito alla missione di distruzione. ${formatCombatDetails(gCombat)}`);
        }
        flt.status = 'returning';
        return;
      }

      const slot = generateProceduralSlot(universe, flt.targetCoords.g, flt.targetCoords.s, flt.targetCoords.p);
      if (slot.ownerType !== 'bot') {
        addMessage(universe, 'combat', `Missione Annullata [${key}]`, 'Nessun bersaglio ostile alle coordinate.');
        flt.status = 'returning';
        return;
      }

      const combat = resolveCombat(flt.fleet, universe.researches, slot, { allowBacinoDestruction: flt.mission === 'destroyMoon' });
      addMessage(universe, 'combat', `Rapporto Difesa [${key}] — ${combat.result.toUpperCase()} (Attacco normale)`,
        `${slot.name} (${slot.emperor || 'Difensore'}) e' stato attaccato. Round: ${combat.roundsPlayed}. Bottino ceduto: ${combat.loot.metal.toLocaleString()} M, ${combat.loot.crystal.toLocaleString()} C, ${combat.loot.deuterium.toLocaleString()} D. ${formatCombatDetails(combat)}`);
      flt.fleet = combat.attackerSurvivors;
      flt.ships = Object.assign({}, flt.fleet);
      if (combat.attackerCrepuscoloDamaged && Number(flt.fleet.crepuscolo || 0) > 0) flt.crepuscoloDamaged = true;
      flt.cargo.metal += combat.loot.metal;
      flt.cargo.crystal += combat.loot.crystal;
      flt.cargo.deuterium += combat.loot.deuterium;

      const prevDebris = slot.debris || { metal: 0, crystal: 0 };
      const newDebris = {
        metal: prevDebris.metal + combat.debris.metal,
        crystal: prevDebris.crystal + combat.debris.crystal
      };

      const moonFormedFromInvictus = combat.invictusLost > 0 && !slot.moon && !slot.bacinoSpaziale && !combat.bacinoDestroyed &&
        Math.random() < Math.min(1, combat.invictusLost * window.UniversumData.INVICTUS.moonChancePerLost);

      if (combat.planetDestroyed) {
        universe.galaxyDeltas[key] = {
          destroyed: true,
          owner: 'none',
          ownerType: 'none',
          hasMoon: false,
          hasBacino: false,
          debris: newDebris
        };
        addMessage(
          universe,
          'combat',
          `☄️ PIANETA DISINTEGRATO [${key}]!`,
          `La tua Morte Nera ha annientato ${slot.name} (${slot.emperor}). Lo slot è ora vuoto e ricolonizzabile!`
        );
      } else {
        const remResources = {
          metal: Math.max(0, slot.resources.metal - combat.loot.metal),
          crystal: Math.max(0, slot.resources.crystal - combat.loot.crystal),
          deuterium: Math.max(0, slot.resources.deuterium - combat.loot.deuterium)
        };

        const noDefendersLeft =
          Object.keys(combat.defenderFleetSurvivors).length === 0 &&
          Object.keys(combat.repairedDefenses).length === 0;
        const hasConquestShip = (flt.fleet.colonyShip || 0) >= 1 || (flt.fleet.mothership || 0) >= 1;

        if (flt.mission === 'attack' && combat.result === 'attacker_win' && noDefendersLeft && hasConquestShip) {
          if (flt.fleet.colonyShip >= 1) flt.fleet.colonyShip -= 1;
          flt.ships = Object.assign({}, flt.fleet);

          const conqueredPlanet = {
            id: 'planet_conq_' + now + '_' + Math.random().toString(36).substring(2, 5),
            name: slot.name,
            coords: Object.assign({}, flt.targetCoords),
            minTemp: slot.minTemp,
            maxTemp: slot.maxTemp,
            fieldsMax: slot.fieldsMax,
            resources: remResources,
            buildings: Object.assign({}, slot.buildings),
            defenses: {},
            fleet: {},
            buildQueue: [],
            shipyardQueue: [],
            defenseQueue: [],
            moon: ((slot.moon && !combat.moonDestroyed) || moonFormedFromInvictus) ? {
              name: (slot.moon && slot.moon.name) || 'Luna',
              diameter: slot.moon.diameter || 7500,
              fieldsMax: 1,
              resources: { metal: 0, crystal: 0, deuterium: 0 },
              buildings: { lunarBase: 0, lunarStorage: 0, lunarShield: 0, secretShipyard: 0, sensorPhalanx: 0, jumpGate: 0 },
              buildQueue: [],
              jumpGateCooldownUntil: 0
            } : null,
            bacinoSpaziale: null
          };

          universe.planets.push(conqueredPlanet);
          universe.galaxyDeltas[key] = {
            destroyed: false,
            owner: 'player',
            ownerType: 'player',
            emperor: universe.emperor,
            planetName: conqueredPlanet.name,
            planetId: conqueredPlanet.id,
            hasMoon: Boolean(conqueredPlanet.moon),
            hasBacino: false,
            moonName: conqueredPlanet.moon ? conqueredPlanet.moon.name : null,
            debris: newDebris
          };

          if (window.UniversumUI?.refreshPlanetSelector) {
            window.UniversumUI.refreshPlanetSelector();
          }

          addMessage(
            universe,
            'combat',
            `👑 PIANETA CONQUISTATO: ${slot.name} [${key}]!`,
            `Hai spazzato via le difese di ${slot.emperor} e annesso ${slot.name} con tutti i suoi edifici al tuo Impero!`
          );
        } else {
          universe.galaxyDeltas[key] = Object.assign({}, universe.galaxyDeltas[key], {
            lootedAt: now,
            resourcesOverride: remResources,
            fleetOverride: combat.defenderFleetSurvivors,
            defensesOverride: combat.repairedDefenses,
            hasMoon: (combat.bacinoDestroyed || moonFormedFromInvictus) ? true : (combat.moonDestroyed ? false : Boolean(slot.moon)),
            hasBacino: combat.bacinoDestroyed ? false : Boolean(slot.bacinoSpaziale),
            moonName: (combat.bacinoDestroyed || moonFormedFromInvictus) ? 'Luna' : undefined,
            debris: newDebris
          });

          const extraNotes = combat.log.length > 0 ? ' ' + combat.log.join(' ') : '';
          addMessage(
            universe,
            'combat',
            `Rapporto Battaglia [${key}] — ${combat.result.toUpperCase()}`,
            `Round: ${combat.roundsPlayed}. Bottino: ${combat.loot.metal.toLocaleString()} M, ${combat.loot.crystal.toLocaleString()} C, ${combat.loot.deuterium.toLocaleString()} D. Detriti: ${newDebris.metal.toLocaleString()} M, ${newDebris.crystal.toLocaleString()} C. ${formatCombatDetails(combat)}${extraNotes}`
          );
        }
      }

      flt.status = 'returning';
    }
  }

  function processBotAI(universe) {
    if (universe.botMode !== 'hostile' || universe.creativeMode) return;
    if (!Array.isArray(universe.incomingAttacks)) universe.incomingAttacks = [];

    const now = Date.now();
    const intervalsMs = {
      1: 3 * 3600 * 1000,
      2: 1 * 3600 * 1000,
      3: 20 * 60 * 1000,
      4: 5 * 60 * 1000
    };
    const interval = intervalsMs[universe.botLevel || 2] || intervalsMs[2];
    if (!universe.nextBotRaidAt) {
      universe.nextBotRaidAt = now + interval;
      return;
    }

    for (let i = universe.incomingAttacks.length - 1; i >= 0; i--) {
      const atk = universe.incomingAttacks[i];
      if (now >= atk.arrivalTime) {
        universe.incomingAttacks.splice(i, 1);
        const targetPlanet = universe.planets.find((p) => p.id === atk.targetPlanetId) || universe.planets[0];
        if (!targetPlanet) continue;

        const defenderFleet = Object.assign({}, targetPlanet.fleet);
        if (targetPlanet.bacinoSpaziale && targetPlanet.bacinoSpaziale.status === 'active') {
          defenderFleet.invictus = Number(targetPlanet.bacinoSpaziale.invictusActive) || 0;
          if (targetPlanet.bacinoSpaziale.crepuscolo && targetPlanet.bacinoSpaziale.crepuscolo.status === 'active') {
            defenderFleet.crepuscolo = 1;
          }
        }
        const combat = resolveCombat(atk.fleet, atk.tech, {
          fleet: defenderFleet,
          defenses: targetPlanet.defenses,
          tech: universe.researches,
          resources: targetPlanet.resources,
          buildings: targetPlanet.buildings,
          moon: targetPlanet.moon,
          bacinoSpaziale: targetPlanet.bacinoSpaziale || null
        });

        const fleetSurvivors = Object.assign({}, combat.defenderFleetSurvivors);
        if (targetPlanet.bacinoSpaziale) {
          targetPlanet.bacinoSpaziale.invictusActive = Number(fleetSurvivors.invictus) || 0;
          delete fleetSurvivors.invictus;
          delete fleetSurvivors.crepuscolo;
          if (targetPlanet.bacinoSpaziale.crepuscolo && combat.defenderCrepuscoloDamaged) {
            beginCrepuscoloBattleRepair(targetPlanet);
          }
        }
        targetPlanet.fleet = fleetSurvivors;
        targetPlanet.defenses = combat.repairedDefenses;
        if (combat.invictusLost > 0 && !targetPlanet.moon && !targetPlanet.bacinoSpaziale) {
          const moonChance = Math.min(1, combat.invictusLost * window.UniversumData.INVICTUS.moonChancePerLost);
          if (Math.random() < moonChance) targetPlanet.moon = makeMoon('Luna');
        }

        if (combat.result === 'attacker_win') {
          targetPlanet.resources.metal = Math.max(0, targetPlanet.resources.metal - combat.loot.metal);
          targetPlanet.resources.crystal = Math.max(0, targetPlanet.resources.crystal - combat.loot.crystal);
          targetPlanet.resources.deuterium = Math.max(0, targetPlanet.resources.deuterium - combat.loot.deuterium);

          if (combat.moonDestroyed && targetPlanet.moon) {
            targetPlanet.moon = null;
          }
          if (combat.planetDestroyed && universe.planets.length > 1) {
            const idx = universe.planets.findIndex((p) => p.id === targetPlanet.id);
            if (idx !== -1) universe.planets.splice(idx, 1);
          }

          addMessage(
            universe,
            'combat',
            `🚨 ATTACCO BOT SUBITO SU ${targetPlanet.name}!`,
            `${atk.attackerName} ha sfondato le tue difese! Round: ${combat.roundsPlayed}. Risorse saccheggiate: ${combat.loot.metal.toLocaleString()} M, ${combat.loot.crystal.toLocaleString()} C, ${combat.loot.deuterium.toLocaleString()} D. Detriti: ${combat.debris.metal.toLocaleString()} M, ${combat.debris.crystal.toLocaleString()} C. ${formatCombatDetails(combat)}`
          );
        } else {
          addMessage(
            universe,
            'combat',
            `🛡️ ATTACCO BOT RESPINTO SU ${targetPlanet.name}!`,
            `Le tue difese hanno respinto l'incursione di ${atk.attackerName}! Round: ${combat.roundsPlayed}. Detriti: ${combat.debris.metal.toLocaleString()} M, ${combat.debris.crystal.toLocaleString()} C. ${formatCombatDetails(combat)}`
          );
        }
      }
    }

    if (now >= universe.nextBotRaidAt && universe.planets.length > 0) {
      universe.nextBotRaidAt = now + interval;
      const targetP = universe.planets[Math.floor(Math.random() * universe.planets.length)];
      const lv = universe.botLevel || 2;
      const mult = lv === 4 ? 15 : lv === 3 ? 5 : lv === 2 ? 2 : 1;

      const raidFleet = {
        lightFighter: 10 * mult,
        heavyFighter: 4 * mult,
        cruiser: 2 * mult,
        battleship: lv >= 2 ? 2 * mult : 0,
        bomber: lv >= 3 ? 2 * mult : 0,
        deathStar: lv === 4 ? 1 : 0
      };

      const warnSec = Math.max(45, Math.floor(300 / Math.sqrt(universe.speed || 10)));
      universe.incomingAttacks.push({
        id: 'raid_' + now,
        attackerName: `Flotta Predoni Lv.${lv}`,
        originCoords: { g: targetP.coords.g, s: Math.max(1, targetP.coords.s - 3), p: 7 },
        targetPlanetId: targetP.id,
        targetCoords: Object.assign({}, targetP.coords),
        fleet: raidFleet,
        tech: { weaponsTech: lv * 2, shieldingTech: lv * 2, armourTech: lv * 2 },
        arrivalTime: now + warnSec * 1000
      });

      addMessage(
        universe,
        'alert',
        `⚠️ ALLARME RADAR: Flotta Ostile in Avvicinamento!`,
        `Una flotta BOT (Lv.${lv}) colpirà ${targetP.name} [${coordKey(targetP.coords.g, targetP.coords.s, targetP.coords.p)}] tra ${warnSec} secondi!`
      );
    }
  }

  // *** MODIFICA C: arrivo della missione galattica-return ***
  function handleGalatticaReturnArrival(universe, flt, now) {
    const gal = findGalattica(universe, flt.originGalatticaId);
    const returningFleet = Object.assign({}, flt.fleet || flt.ships || {});
    const cargo = Object.assign({ metal: 0, crystal: 0, deuterium: 0 }, flt.cargo || {});

    if (gal) {
      for (const [id, qty] of Object.entries(returningFleet)) {
        const q = Math.max(0, Math.floor(Number(qty) || 0));
        if (q > 0) {
          gal.orbitingFleet[id] = (gal.orbitingFleet[id] || 0) + q;
        }
      }
      gal.resources.metal += cargo.metal;
      gal.resources.crystal += cargo.crystal;
      gal.resources.deuterium += cargo.deuterium;
      addMessage(universe, 'fleet', `Flotte rientrate alla Galattica [${gal.coords.g}:${gal.coords.s}:${gal.coords.p}].`, '');
      return 'remove';
    }

    // Galattica distrutta durante il rientro lento: dirotta al pianeta più vicino
    const totalRemaining = Object.values(returningFleet).reduce((acc, q) => acc + Math.max(0, Math.floor(Number(q) || 0)), 0);
    if (totalRemaining > 0 && (universe.planets || []).length > 0) {
      let nearest = null;
      let nearestDist = Infinity;
      for (const pl of universe.planets) {
        const d = calculateDistance(flt.targetCoords, pl.coords);
        if (d < nearestDist) { nearestDist = d; nearest = pl; }
      }
      if (nearest) {
        const stats = getFleetSpeedAndFuel(universe, returningFleet, nearestDist);
        const durationSec = Math.max(1, stats.durationSec) * 20;
        universe.fleetsInFlight.push({
          id: 'flt_galret_fallback_' + now,
          mission: 'deploy',
          status: 'returning',
          originPlanetId: nearest.id,
          originCoords: Object.assign({}, flt.targetCoords),
          targetCoords: Object.assign({}, nearest.coords),
          fleet: Object.assign({}, returningFleet),
          ships: Object.assign({}, returningFleet),
          cargo: Object.assign({}, cargo),
          departureTime: now,
          arrivalTime: now + durationSec * 1000,
          returnTime: now + durationSec * 1000,
          galatticaReturn: true
        });
        addMessage(universe, 'fleet',
          `Galattica distrutta durante il rientro lento delle flotte: dirottate al pianeta ${nearest.name} più vicino.`,
          '');
      }
    }
    return 'remove';
  }

  function processFleetsAndBots(universe) {
    if (!universe) return;
    const now = Date.now();
    if (!Array.isArray(universe.fleetsInFlight)) universe.fleetsInFlight = [];

    for (let i = universe.fleetsInFlight.length - 1; i >= 0; i--) {
      const flt = universe.fleetsInFlight[i];
      if (!flt.fleet && flt.ships) flt.fleet = Object.assign({}, flt.ships);
      if (!flt.ships && flt.fleet) flt.ships = Object.assign({}, flt.fleet);

      if (flt.status === 'outbound' && now >= flt.arrivalTime) {
        if (flt.mission === 'galattica-return') {
          const action = handleGalatticaReturnArrival(universe, flt, now);
          if (action === 'remove') {
            universe.fleetsInFlight.splice(i, 1);
            continue;
          }
        } else {
          const action = handleMissionArrival(universe, flt);
          if (action === 'remove') {
            universe.fleetsInFlight.splice(i, 1);
            continue;
          }
        }
      }

      if (flt.status === 'returning' && now >= flt.returnTime) {
        // *** MODIFICA B: gestione ritorno da origine Galattica ***
        if (flt.originGalatticaId) {
          const gal = findGalattica(universe, flt.originGalatticaId);
          if (!gal) {
            // Galattica distrutta: dirotta al pianeta più vicino al 5%
            const returningFleet = Object.assign({}, flt.fleet || flt.ships || {});
            const totalRemaining = Object.values(returningFleet).reduce((acc, q) => acc + Math.max(0, Math.floor(Number(q) || 0)), 0);
            if (totalRemaining > 0 && (universe.planets || []).length > 0) {
              let nearest = null;
              let nearestDist = Infinity;
              for (const pl of universe.planets) {
                const d = calculateDistance(flt.targetCoords, pl.coords);
                if (d < nearestDist) { nearestDist = d; nearest = pl; }
              }
              if (nearest) {
                const stats = getFleetSpeedAndFuel(universe, returningFleet, nearestDist);
                const durationSec = Math.max(1, stats.durationSec) * 20;
                universe.fleetsInFlight.push({
                  id: 'flt_galret_fallback_' + now,
                  mission: 'deploy',
                  status: 'returning',
                  originPlanetId: nearest.id,
                  originCoords: Object.assign({}, flt.targetCoords),
                  targetCoords: Object.assign({}, nearest.coords),
                  fleet: Object.assign({}, returningFleet),
                  ships: Object.assign({}, returningFleet),
                  cargo: Object.assign({}, flt.cargo || { metal: 0, crystal: 0, deuterium: 0 }),
                  departureTime: now,
                  arrivalTime: now + durationSec * 1000,
                  returnTime: now + durationSec * 1000,
                  galatticaReturn: true
                });
                addMessage(universe, 'fleet',
                  'Galattica Distrutta, flotte in rientro deviato',
                  `La Galattica di partenza non esiste più: le flotte sono state dirotte al pianeta ${nearest.name} al 5% della velocità.`);
              }
            }
            universe.fleetsInFlight.splice(i, 1);
            continue;
          }

          // Galattica ancora alle vecchie coordinate? Aggancio normale
          if (gal.coords.g === flt.originCoords.g &&
              gal.coords.s === flt.originCoords.s &&
              gal.coords.p === flt.originCoords.p) {
            const returningFleet = Object.assign({}, flt.fleet || flt.ships || {});
            for (const [id, qty] of Object.entries(returningFleet)) {
              const q = Math.max(0, Math.floor(Number(qty) || 0));
              if (q > 0) {
                gal.orbitingFleet[id] = (gal.orbitingFleet[id] || 0) + q;
              }
            }
            gal.resources.metal += flt.cargo?.metal || 0;
            gal.resources.crystal += flt.cargo?.crystal || 0;
            gal.resources.deuterium += flt.cargo?.deuterium || 0;
            addMessage(universe, 'fleet',
              `Flotte rientrate alla Galattica [${gal.coords.g}:${gal.coords.s}:${gal.coords.p}].`,
              '');
            universe.fleetsInFlight.splice(i, 1);
            continue;
          }

          // Galattica spostata: crea missione galattica-return al 5%
          const returningFleet = Object.assign({}, flt.fleet || flt.ships || {});
          const distance = calculateDistance(flt.targetCoords, gal.coords);
          const stats = getFleetSpeedAndFuel(universe, returningFleet, distance);
          const durationSec = Math.max(1, stats.durationSec) * 20;
          universe.fleetsInFlight.push({
            id: 'flt_galret_' + now + '_' + Math.random().toString(36).substring(2, 6),
            mission: 'galattica-return',
            status: 'outbound',
            originPlanetId: null,
            originCoords: Object.assign({}, flt.targetCoords),
            targetCoords: Object.assign({}, gal.coords),
            fleet: Object.assign({}, returningFleet),
            ships: Object.assign({}, returningFleet),
            cargo: Object.assign({}, flt.cargo || { metal: 0, crystal: 0, deuterium: 0 }),
            departureTime: now,
            startTime: now,
            arrivalTime: now + durationSec * 1000,
            returnTime: now + durationSec * 2000,
            durationSec,
            originGalatticaId: gal.id,
            isGalatticaReturn: true
          });
          addMessage(universe, 'fleet',
            `Flotte in rientro dirottate: Galattica spostata a [${gal.coords.g}:${gal.coords.s}:${gal.coords.p}].`,
            `Viaggio al 5% della velocità, arrivo tra ${Math.round(durationSec / 60)} minuti.`);
          universe.fleetsInFlight.splice(i, 1);
          continue;
        }

        const homeP = universe.planets.find((p) => p.id === flt.originPlanetId) || universe.planets[0];
        const returningFleet = Object.assign({}, flt.fleet || flt.ships || {});
        const returningCrepuscolo = Math.max(0, Math.floor(Number(returningFleet.crepuscolo || 0)));
        if (returningCrepuscolo > 0) {
          delete returningFleet.crepuscolo;
          const exactHome = universe.planets.find((p) => p.id === flt.originPlanetId);
          const homeBacino = exactHome && exactHome.bacinoSpaziale;
          if (flt.crepuscoloDamaged) {
            if (homeBacino && homeBacino.status === 'active' && homeBacino.crepuscolo) {
              beginCrepuscoloBattleRepair(exactHome, now);
              addMessage(universe, 'fleet', `Crepuscolo in Riparazione [${flt.originCoords.g}:${flt.originCoords.s}:${flt.originCoords.p}]`,
                'La Crepuscolo degli Dei è tornata danneggiata al suo Bacino: riparazioni per 10 giorni reali.');
            } else {
              addMessage(universe, 'fleet', `Crepuscolo Distrutta al Rientro [${flt.originCoords.g}:${flt.originCoords.s}:${flt.originCoords.p}]`,
                'La Crepuscolo danneggiata stava tornando per le riparazioni, ma il suo Bacino era distrutto: nave perduta definitivamente.');
            }
          } else if (homeBacino && homeBacino.status === 'active' && homeBacino.crepuscolo) {
            homeBacino.crepuscolo.status = 'active';
          } else {
            const home = (universe.planets || [])[0];
            if (home) {
              const dist = calculateDistance(flt.originCoords, home.coords);
              const stats = getFleetSpeedAndFuel(universe, { crepuscolo: 1 }, dist);
              universe.crepuscoloLimbo = {
                status: 'travelling', homePlanetId: home.id,
                arrivalAt: now + Math.max(1, stats.durationSec) * 100 * 1000
              };
              addMessage(universe, 'fleet', `Crepuscolo in Viaggio verso il Pianeta Madre [${flt.originCoords.g}:${flt.originCoords.s}:${flt.originCoords.p}]`,
                'Il suo Bacino è distrutto: la Crepuscolo si sposta all\'1% della velocità verso il pianeta madre ed entrerà in stato LIMBO.');
            }
          }
        }
        const returningInvictus = Math.max(0, Math.floor(Number(returningFleet.invictus || 0)));
        if (returningInvictus > 0) {
          delete returningFleet.invictus;
          const exactHome = universe.planets.find((p) => p.id === flt.originPlanetId);
          if (exactHome && exactHome.bacinoSpaziale && exactHome.bacinoSpaziale.status === 'active') {
            exactHome.bacinoSpaziale.invictusActive = (Number(exactHome.bacinoSpaziale.invictusActive) || 0) + returningInvictus;
          } else {
            addInvictusDebris(universe, flt.originCoords, returningInvictus);
            addMessage(universe, 'fleet', `Invictus Persa al Rientro [${flt.originCoords.g}:${flt.originCoords.s}:${flt.originCoords.p}]`,
              `${returningInvictus} Invictus non ha trovato il suo Bacino (distrutto) ed è diventata detriti spaziali attorno al pianeta.`);
          }
        }
        if (homeP) {
          for (const [id, qty] of Object.entries(returningFleet)) {
            if (qty > 0) {
              homeP.fleet[id] = (homeP.fleet[id] || 0) + qty;
            }
          }
          homeP.resources.metal += flt.cargo?.metal || 0;
          homeP.resources.crystal += flt.cargo?.crystal || 0;
          homeP.resources.deuterium += flt.cargo?.deuterium || 0;
        }
        universe.fleetsInFlight.splice(i, 1);
      }
    }

    processBotAI(universe);
  }

  // =========================================================
  // COMMERCIO CON BOT, MERCATO NERO E CONTRATTI
  // =========================================================
  function tradeWithBot(universe, planetIndex, botCoords, giveRes, giveAmount, getRes) {
    const planet = universe.planets[planetIndex];
    if (!planet) throw new Error('Pianeta non trovato.');
    if (giveRes === getRes) throw new Error('Seleziona due risorse diverse per lo scambio.');

    const slot = generateProceduralSlot(universe, botCoords.g, botCoords.s, botCoords.p);
    if (slot.ownerType !== 'bot') throw new Error('Nessun BOT commerciante alle coordinate indicate.');

    const amount = Math.max(100, Math.floor(Number(giveAmount) || 0));
    if (!universe.creativeMode && (planet.resources[giveRes] || 0) < amount) {
      throw new Error(`Risorse insufficienti sul pianeta (${giveRes}).`);
    }

    const rates = slot.tradeRates || { metal: 3.0, crystal: 2.0, deuterium: 1.0 };
    const valueInBase = amount / rates[giveRes];
    const receivedAmount = Math.floor(valueInBase * rates[getRes]);

    if (receivedAmount <= 0) throw new Error('Quantità troppo bassa per completare lo scambio.');

    if (!universe.creativeMode) {
      planet.resources[giveRes] -= amount;
    }
    planet.resources[getRes] = (planet.resources[getRes] || 0) + receivedAmount;

    addMessage(
      universe,
      'trade',
      `Scambio Commerciale con ${slot.emperor}`,
      `Ceduti ${amount.toLocaleString()} ${giveRes} per ${receivedAmount.toLocaleString()} ${getRes}.`
    );

    return { given: amount, received: receivedAmount, botName: slot.emperor };
  }

  function blackMarketTrade(universe, planetIndex, giveRes, giveAmount, getRes) {
    const planet = universe.planets[planetIndex];
    if (!planet) throw new Error('Pianeta non trovato.');
    if (giveRes === getRes) throw new Error('Seleziona due risorse diverse.');

    const amount = Math.max(500, Math.floor(Number(giveAmount) || 0));
    if (!universe.creativeMode && (planet.resources[giveRes] || 0) < amount) {
      throw new Error('Risorse insufficienti per il Mercato Nero.');
    }

    const baseWeights = { metal: 3.0, crystal: 2.0, deuterium: 1.0 };
    const receivedAmount = Math.floor((amount / baseWeights[giveRes]) * baseWeights[getRes] * 0.85);

    if (!universe.creativeMode) {
      planet.resources[giveRes] -= amount;
    }
    planet.resources[getRes] = (planet.resources[getRes] || 0) + receivedAmount;

    return { given: amount, received: receivedAmount };
  }

  function signBotContract(universe, planetIndex, botCoords) {
    const planet = universe.planets[planetIndex];
    if (!planet) throw new Error('Pianeta non trovato.');
    const slot = generateProceduralSlot(universe, botCoords.g, botCoords.s, botCoords.p);
    if (slot.ownerType !== 'bot') throw new Error('Coordinate non valide per un contratto BOT.');

    const key = coordKey(botCoords.g, botCoords.s, botCoords.p);
    if (!Array.isArray(universe.contracts)) universe.contracts = [];
    if (universe.contracts.some((c) => c.key === key)) {
      throw new Error('Hai già un contratto attivo con questo BOT.');
    }

    if (!universe.creativeMode) {
      if (planet.resources.metal < 10000) {
        throw new Error('Servono 10.000 Metallo per siglare il contratto di protezione.');
      }
      planet.resources.metal -= 10000;
    }

    const contract = {
      id: 'ctr_' + Date.now(),
      key,
      coords: Object.assign({}, botCoords),
      botName: slot.emperor,
      dailyCostMetal: 10000,
      signedAt: Date.now()
    };
    universe.contracts.push(contract);
    addMessage(universe, 'trade', `Patto Difensivo Siglato`, `${slot.emperor} [${key}] fornirà supporto difensivo in cambio di 10.000 Metallo/giorno.`);
    return contract;
  }

  window.UniversumGalaxy = {
    getSystemData,
    generateProceduralSlot,
    getMoonCreationCost,
    createMoon,
    startBacinoSpaziale,
    startInvictusConstruction,
    getInvictusCount,
    getInvictusJumpCost,
    startCrepuscoloConstruction,
    assignCrepuscoloWreck,
    isBacinoVuoto,
    getCrepuscoloState,
    beginCrepuscoloBattleRepair,
    startGalatticaConstruction,
    getGalatticaCount,
    getGalatticaJumpCost,
    findGalatticaAt,
    findGalattica,
    jumpGalattica,
    upgradeGalatticaStructure,
    buildGalatticaDefense,
    buildGalatticaShip,
    cancelBacinoConstruction,
    destroyBacinoAndFormMoon,
    useJumpGate,
    scanWithPhalanx,
    resolveCombat,
    simulateBattle,
    calculateDistance,
    getFleetSpeedAndFuel,
    launchFleet,
    processFleetsAndBots,
    tradeWithBot,
    blackMarketTrade,
    signBotContract
  };
})();