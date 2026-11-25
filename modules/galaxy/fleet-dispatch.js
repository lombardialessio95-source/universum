/** UNIVERSUM / modules/galaxy/fleet-dispatch.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumGalaxyModules;
  // Bridge lazy per le funzioni definite negli altri moduli.
  const findGalattica = (...args) => G.findGalattica(...args);
  const getInvictusJumpCost = (...args) => G.getInvictusJumpCost(...args);



  // =========================================================
  // 5. LANCI FLOTTE, SPIONAGGIO, SPEDIZIONI, COMMERCIO E IA BOT
  // =========================================================
  function calculateDistance(c1, c2) {
    if (c1.g !== c2.g) return Math.abs(c1.g - c2.g) * 20000;
    if (c1.s !== c2.s) return Math.abs(c1.s - c2.s) * 95 + 2700;
    if (c1.p !== c2.p) return Math.abs(c1.p - c2.p) * 5 + 1000;
    return 5;
  }


  function getFleetSpeedAndFuel(universe, fleet, distance, speedPct = 100, options = {}) {
    const Data = window.UniversumData;
    let minSpeed = Infinity;
    let totalFuelPerDist = 0;

    for (const [shipId, cntRaw] of Object.entries(fleet || {})) {
      const cnt = Math.max(0, Math.floor(Number(cntRaw) || 0));
      if (cnt <= 0 || shipId === 'solarSatellite') continue;
      const spec = options.shipSpecs?.[shipId] || Data.SHIPS[shipId];
      if (!spec) continue;

      const driveLv = Number(universe.researches?.[spec.driveType] || 0);
      let bonusPerLv = 0.1;
      if (spec.driveType === 'impulseDrive') bonusPerLv = 0.2;
      else if (spec.driveType === 'hyperspaceDrive') bonusPerLv = 0.3;

      const effectiveShipSpeed = spec.speed * (1 + driveLv * bonusPerLv);
      if (effectiveShipSpeed < minSpeed) minSpeed = effectiveShipSpeed;
      totalFuelPerDist += (options.shipSpecs?.[shipId]?.fuel ?? Data.getShipFuelConsumption(shipId)) * cnt;
    }

    if (!isFinite(minSpeed) || minSpeed <= 0) minSpeed = 5000;
    const speedMult = options.speed ?? (window.UniversumEngine
      ? window.UniversumEngine.getEffectiveSpeed(universe)
      : (universe.speed || 10));

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
    const hangars = window.UniversumHangars;

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
    // Stesso conteggio della UI (missions-core getUsedFleetSlots): voli + assedi attivi + Galattiche.
    const usedSlots = (Array.isArray(universe.fleetsInFlight) ? universe.fleetsInFlight.length : 0) +
      (Array.isArray(universe.activeSieges) ? universe.activeSieges.length : 0) +
      (Array.isArray(universe.galattiche) ? universe.galattiche.length : 0);
    if (usedSlots >= maxSlots) {
      throw new Error(`Slot flotta esauriti (${maxSlots} max). Potenzia Tecnologia Informatica.`);
    }

    const specialistTransfer = window.UniversumServices?.transfer(universe,mission,targetCoords,fleetSelection);
    if (specialistTransfer && !originP) throw Error('Le specialiste partono da una colonia propria.');
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

    if (mission === 'incursion' && isGalatticaOrigin) throw new Error('Incursione: partenza solo da un pianeta.');
    const carrierHangars = cleanFleet.mothership && !isGalatticaOrigin
      ? hangars.select(originP,cleanFleet.mothership,options.carrierIds || null,mission === 'incursion') : [];
    if (mission === 'incursion') {
      hangars.validateMission(cleanFleet,carrierHangars);
      const targetSlot = G.generateProceduralSlot(universe,targetCoords.g,targetCoords.s,targetCoords.p);
      if (targetSlot.ownerType !== 'bot') throw new Error('Incursione consentita solo contro un pianeta nemico.');
    }

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
    const MCore = window.UniversumMissionsCore;
    const exploreHours = mission === 'explore'
      ? Math.min(MCore?.getMaxExploreHours(universe) || 1,
        Math.max(1, Math.floor(Number(options.exploreHours) || 1)))
      : 0;

    const loadM = Math.max(0, Math.floor(Number(cargo.metal) || 0));
    const loadC = Math.max(0, Math.floor(Number(cargo.crystal) || 0));
    const loadD = Math.max(0, Math.floor(Number(cargo.deuterium) || 0));

    const blackHoleFee = (!universe.creativeMode && mission === 'explore' && options.blackHole) ? 50000 : 0;

    // Una specialista a stiva zero può partire scarica, pagando comunque il viaggio.
    if (specialistTransfer) window.UniversumServices.settlePlanet(universe,originP);
    const emptyTransfer = specialistTransfer && loadM+loadC+loadD===0;
    if (!emptyTransfer && loadM + loadC + loadD + fuelCost > totalCargoCap && !universe.creativeMode) {
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

    if (carrierHangars.length) hangars.take(originP,carrierHangars);
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
    const timeline = mission === 'explore' && MCore?.buildExplorationTimeline
      ? MCore.buildExplorationTimeline(now, durationSec,
          MCore.getExplorationHoldDurationSec(universe, exploreHours))
      : null;
    if (specialistTransfer) window.UniversumServices.settlePlanet(universe,originP);
    const missionObj = {
      id: 'flt_' + now + '_' + Math.random().toString(36).substring(2, 6),
      mission,
      originPlanetId: isGalatticaOrigin ? null : originP.id,
      originCoords: Object.assign({}, originCoords),
      targetCoords: Object.assign({}, targetCoords),
      ships: Object.assign({}, cleanFleet),
      fleet: cleanFleet,
      cargo: { metal: loadM, crystal: loadC, deuterium: loadD },
      carrierHangars,
      options,
      status: 'outbound',
      departureTime: now,
      startTime: now,
      arrivalTime: timeline?.arrivalTime ?? now + durationSec * 1000,
      returnTime: timeline?.returnTime ?? now + durationSec * 2000,
      durationSec,
      ...(timeline || {}),
      ...(mission === 'explore' ? { exploreHours } : {})
    };

    if (isGalatticaOrigin) {
      missionObj.originGalatticaId = originG.id;
    }

    if (!Array.isArray(universe.fleetsInFlight)) universe.fleetsInFlight = [];
    universe.fleetsInFlight.push(missionObj);
    return missionObj;
  }

  Object.assign(G, { calculateDistance, getFleetSpeedAndFuel, findEmbargoAt, launchFleet });

})();
