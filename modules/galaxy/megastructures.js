/** UNIVERSUM / modules/galaxy/megastructures.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumGalaxyModules;
  // Bridge lazy per le funzioni definite negli altri moduli.
  const addMessage = (...args) => G.addMessage(...args);
  const calculateDistance = (...args) => G.calculateDistance(...args);
  const coordKey = (...args) => G.coordKey(...args);
  const generateProceduralSlot = (...args) => G.generateProceduralSlot(...args);
  const getFleetSpeedAndFuel = (...args) => G.getFleetSpeedAndFuel(...args);
  const getSystemData = (...args) => G.getSystemData(...args);



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
    if (!universe.creativeMode) throw new Error('In modalità Normale la Luna si ottiene con il Mercante di Lune, dal menu Commercio e BOT.');
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
    if (!universe.creativeMode) {
      const check = Data.getBacinoStartRequirements(universe, planet);
      if (!check.met) throw new Error(`Requisiti Bacino mancanti: ${check.missing.join(', ')}`);
    }
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


  function getInvictusCount(planet, universe) {
    const b = planet && planet.bacinoSpaziale;
    if (!b) return { active: 0, building: 0, inFlight: 0, total: 0 };
    const building = Array.isArray(b.invictusConstructions) ? b.invictusConstructions.length : 0;
    const active = Number(b.invictusActive) || 0;
    let inFlight = 0;
    if (universe && Array.isArray(universe.fleetsInFlight) && planet.id) {
      for (const f of universe.fleetsInFlight) {
        if (f.originPlanetId === planet.id) {
          inFlight += Math.max(0, Math.floor(Number((f.fleet || f.ships || {}).invictus || 0)));
        }
      }
    }
    return { active, building, inFlight, total: active + building + inFlight };
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
    if (bacino.supremaConstruction) throw Error('Il Bacino è impegnato nella costruzione della Suprema.');
    if (!Array.isArray(bacino.invictusConstructions)) bacino.invictusConstructions = [];
    const counts = getInvictusCount(planet, universe);
    if (counts.total >= def.maxPerBacino) throw new Error(`Massimo ${def.maxPerBacino} Invictus per Bacino (attive + in costruzione + in missione).`);
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


  function isBacinoVuoto(planet, universe) {
    const b = planet && planet.bacinoSpaziale;
    if (!b || b.status !== 'active') return false;
    const counts = getInvictusCount(planet, universe);
    return counts.total === 0 && !b.crepuscolo && !b.galatticaConstruction && !b.supremaConstruction;
  }


  function getCrepuscoloState(universe) {
    let count = 0;
    const locations = [];
    const inMissionFrom = new Set();
    for (const pl of universe.planets || []) {
      if (pl.bacinoSpaziale && pl.bacinoSpaziale.crepuscolo) {
        count += 1; locations.push(pl.id);
        if (pl.bacinoSpaziale.crepuscolo.status === 'inMission') inMissionFrom.add(pl.id);
      }
    }
    for (const f of universe.fleetsInFlight || []) {
      const n = Math.max(0, Math.floor(Number((f.fleet || f.ships || {}).crepuscolo || 0)));
      if (n <= 0) continue;
      // Gia' contata come oggetto nel Bacino con stato inMission: non contarla due volte.
      if (inMissionFrom.has(f.originPlanetId)) continue;
      count += n;
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
    if (!isBacinoVuoto(planet, universe)) throw new Error('La Crepuscolo richiede un Bacino Spaziale attualmente libero, senza navi legate.');
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
    if (!planet || !isBacinoVuoto(planet, universe) || getCrepuscoloState(universe).has) return false;
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
    if (bacino.supremaConstruction) throw Error('Il Bacino è impegnato nella costruzione della Suprema.');
    if (bacino.galatticaConstruction) throw new Error('Costruzione Galattica già in corso in questo Bacino.');
    const invictus = getInvictusCount(planet, universe);
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
    if (!unit || unit.normalShipyardOnly || unit.specialConstruction === 'bacino') throw new Error('Nave non costruibile nel Cantiere Spaziale della Galattica.');
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

    const selected = Object.entries(fleetSelection || {}).map(([id,n])=>[id,Math.max(0,Math.floor(Number(n) || 0))])
      .filter(([id,n])=>n > 0 && id !== 'solarSatellite');
    if (!selected.length) throw Error('Seleziona almeno una nave da teletrasportare.');
    if (selected.some(([id,n])=>(fromP.fleet?.[id] || 0) < n)) throw Error('Navi insufficienti per il salto.');
    const at = Date.now();
    const specialist = selected.some(([id])=>window.UniversumServices?.ids.includes(id));
    if (specialist) {
      window.UniversumServices.settlePlanet(universe,fromP,at);
      window.UniversumServices.settlePlanet(universe,toP,at);
    }
    let movedCount = 0;
    for (const [id,n] of selected) {
      fromP.fleet[id] -= n;
      toP.fleet[id] = (toP.fleet[id] || 0) + n;
      movedCount += n;
    }
    if (specialist) {
      window.UniversumServices.settlePlanet(universe,fromP,at);
      window.UniversumServices.settlePlanet(universe,toP,at);
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

  Object.assign(G, { getMoonCreationCost, makeMoon, createMoon, startBacinoSpaziale, getInvictusCount, getInvictusJumpCost, addInvictusDebris, startInvictusConstruction, isBacinoVuoto, getCrepuscoloState, makeCrepuscoloProject, beginCrepuscoloBattleRepair, startCrepuscoloConstruction, assignCrepuscoloWreck, findGalatticaAt, getGalatticaCount, findGalattica, startGalatticaConstruction, getGalatticaJumpCost, jumpGalattica, upgradeGalatticaStructure, buildGalatticaDefense, buildGalatticaShip, cancelBacinoConstruction, destroyBacinoAndFormMoon, useJumpGate, scanWithPhalanx });

})();
