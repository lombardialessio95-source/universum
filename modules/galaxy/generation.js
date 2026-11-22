/** UNIVERSUM / modules/galaxy/generation.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumGalaxyModules;
  // Bridge lazy per le funzioni definite negli altri moduli.
  const findGalatticaAt = (...args) => G.findGalatticaAt(...args);


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

  Object.assign(G, { hashString, mulberry32, coordKey, parseCoordKey, calculatePlanetTemperature, calculateSlotMaxFields, generateProceduralSlot, getSystemData });

})();
