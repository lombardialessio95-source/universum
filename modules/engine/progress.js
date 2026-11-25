/** UNIVERSUM / modules/engine/progress.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumEngineModules;
  const { CREATIVE_RESOURCE_CAP } = window.__UniversumEngineConstants;
  const addGalatticaProduction = (...args) => G.addGalatticaProduction(...args);
  const checkCrepuscoloLimbo = (...args) => G.checkCrepuscoloLimbo(...args);
  const getData = (...args) => G.getData(...args);
  const getPlanetProduction = (...args) => G.getPlanetProduction(...args);
  const normalizePlanet = (...args) => G.normalizePlanet(...args);
  const settleBacinoDue = (...args) => G.settleBacinoDue(...args);
  const settleBacinoOffline = (...args) => G.settleBacinoOffline(...args);
  const settleInvictusOffline = (...args) => G.settleInvictusOffline(...args);
  const transformCompletedGalattiche = (...args) => G.transformCompletedGalattiche(...args);


  function addResourcesWithCap(planet, dMetal, dCrystal, dDeut, caps) {
    if (dMetal > 0 && planet.resources.metal < caps.metal) {
      planet.resources.metal = Math.min(caps.metal, planet.resources.metal + dMetal);
    }
    if (dCrystal > 0 && planet.resources.crystal < caps.crystal) {
      planet.resources.crystal = Math.min(caps.crystal, planet.resources.crystal + dCrystal);
    }
    if (dDeut !== 0) {
      if (dDeut > 0 && planet.resources.deuterium < caps.deuterium) {
        planet.resources.deuterium = Math.min(caps.deuterium, planet.resources.deuterium + dDeut);
      } else if (dDeut < 0) {
        planet.resources.deuterium = Math.max(0, planet.resources.deuterium + dDeut);
      }
    }
  }


  function advancePlanetResources(planet, universe, elapsedSec, serviceTime = null) {
    if (!(elapsedSec > 0)) return;
    const before = getPlanetProduction(planet, universe);
    const billService = serviceTime !== null && window.UniversumServices?.ids.some(id=>planet.fleet?.[id] > 0);
    const opening = billService && {...planet.resources};
    const inflow = {};
    const caps = billService ? {metal:Infinity,crystal:Infinity,deuterium:Infinity} : before.caps;
    const fuel = Math.max(0, Number(planet.resources.deuterium) || 0);
    const depletionSec = before.fusionFuelPerHour > 0 && before.deuteriumPerHour < 0 && fuel > 0
      ? fuel * 3600 / -before.deuteriumPerHour : Infinity;
    const firstSec = Math.min(elapsedSec, depletionSec);
    addResourcesWithCap(planet, before.metalPerSec * firstSec, before.crystalPerSec * firstSec,
      before.deuteriumPerSec * firstSec, caps);
    if (depletionSec <= elapsedSec) {
      // Il primo intervallo usa la fusione al 100%; il resto usa la massima
      // frazione alimentabile dal sintetizzatore, senza passare sotto zero.
      planet.resources.deuterium = 0;
      const after = getPlanetProduction(planet, universe);
      const remaining = elapsedSec - firstSec;
      if (remaining > 0) addResourcesWithCap(planet, after.metalPerSec * remaining,
        after.crystalPerSec * remaining, after.deuteriumPerSec * remaining, billService ? caps : after.caps);
    }
    if (billService) {
      // La produzione continua a coprire il consumo anche a deposito pieno.
      for (const k of ['metal','crystal','deuterium']) inflow[k] = planet.resources[k];
      window.UniversumServices.settlePlanet(universe,planet,serviceTime);
      for (const k of Object.keys(inflow)) {
        const spent = inflow[k] - planet.resources[k];
        planet.resources[k] = Math.min(planet.resources[k],Math.max(before.caps[k],opening[k]-spent));
      }
    }
  }

  // =========================================================
  // AVANZAMENTO CODE (EDIFICI, RICERCHE, CANTIERE, DIFESE, LUNA)
  // =========================================================
  function advanceQueuesAtTimestamp(universe, nowTs, summary = null) {
    const Data = getData();
    const services = window.UniversumServices;
    for (const p of universe.planets || []) services?.settlePlanet(universe,p,nowTs);
    let queueCompleted = false;

    // Ricerca imperiale + ricerche locali; evento in ordine cronologico.
    queueCompleted = G.advanceResearchQueues(universe, nowTs, summary);

    // Helper istanziato una sola volta per tick, non una volta per pianeta.
    function advanceUnitQueue(queue, stock, catalog, planet = null) {
      while (queue.length > 0) {
        const item = queue[0];
        if (!(nowTs >= item.nextUnitEndTime)) break;
        const step = item.unitDurationSec * 1000;
        const remaining = item.remaining;
        const owned = stock[item.id];
        const name = catalog[item.id]?.name || item.id;
        const previousSummary = summary?.completedUnits?.[name];
        const specialist = planet && services?.ids.includes(item.id);
        const canAggregate = !specialist && Number.isSafeInteger(nowTs) &&
          Number.isSafeInteger(item.nextUnitEndTime) &&
          Number.isSafeInteger(step) && step > 0 &&
          Number.isSafeInteger(remaining) && remaining > 0 &&
          (!owned || (Number.isSafeInteger(owned) && Number.isSafeInteger(owned + remaining))) &&
          (previousSummary === undefined || (Number.isSafeInteger(previousSummary) &&
            Number.isSafeInteger(previousSummary + remaining))) &&
          Number.isSafeInteger(item.nextUnitEndTime + remaining * step);
        if (canAggregate) {
          const count = Math.min(remaining, 1 + Math.floor((nowTs - item.nextUnitEndTime) / step));
          stock[item.id] = (owned || 0) + count;
          item.remaining -= count;
          if (summary) summary.completedUnits[name] = (previousSummary || 0) + count;
          if (item.remaining <= 0) {
            queue.shift();
            queueCompleted = true;
          } else {
            item.nextUnitEndTime += count * step;
          }
        } else {
          // Compatibilita' rigorosa con queue legacy/non-intere: unita' per unita'.
          if (specialist) services.settle(universe, planet, item.id, item.nextUnitEndTime);
          stock[item.id] = (stock[item.id] || 0) + 1;
          if (specialist) {
            services.completed(universe, item.id, 1, item);
            services.settle(universe, planet, item.id, item.nextUnitEndTime);
            queueCompleted = true;
          }
          item.remaining -= 1;
          if (summary) summary.completedUnits[name] = (summary.completedUnits[name] || 0) + 1;
          if (item.remaining <= 0) {
            queue.shift();
            queueCompleted = true;
          } else {
            item.nextUnitEndTime += step;
          }
        }
      }
    }

    // 2. Code per ogni pianeta e luna
    for (const planet of universe.planets || []) {
      normalizePlanet(planet);

      // Edifici planetari
      if (planet.buildQueue.length > 0 && nowTs >= planet.buildQueue[0].endTime) {
        const item = planet.buildQueue.shift();
        queueCompleted = true;
        planet.buildings[item.id] = item.targetLevel;
        if (item.id === 'deuteriumSynth') {
          planet.buildings.deuteriumSynthesizer = item.targetLevel;
        }
        if (summary) {
          const bName = Data.BUILDINGS[item.id]?.name || item.id;
          summary.completedBuildings.push(`${bName} Lv.${item.targetLevel} (${planet.name})`);
        }
      }

      // Edifici lunari
      if (planet.moon && Array.isArray(planet.moon.buildQueue) && planet.moon.buildQueue.length > 0) {
        if (nowTs >= planet.moon.buildQueue[0].endTime) {
          const mItem = planet.moon.buildQueue.shift();
          queueCompleted = true;
          planet.moon.buildings[mItem.id] = mItem.targetLevel;
          if (summary) {
            const mbName = Data.MOON_BUILDINGS[mItem.id]?.name || mItem.id;
            summary.completedBuildings.push(`${mbName} Lv.${mItem.targetLevel} (${planet.moon.name || 'Luna'})`);
          }
        }
      }

      // Cantiere e difese: aggregazione soltanto se la somma in millisecondi
      // e' intera e sicura; per vecchi dati anomali resta il percorso originale.
      if (planet.shipyardQueue.length) advanceUnitQueue(planet.shipyardQueue, planet.fleet, Data.SHIPS, planet);
      if (planet.defenseQueue.length) advanceUnitQueue(planet.defenseQueue, planet.defenses, Data.DEFENSES);

    }
    return Boolean(services?.advance(universe,nowTs)) || queueCompleted;
  }


  // =========================================================
  // CALCOLO PROGRESSI OFFLINE & TICK IN TEMPO REALE
  // =========================================================
  function processOfflineProgress(universe, now = Date.now()) {
    const services = window.UniversumServices;
    const pendingSupreme = universe.planets?.some(p=>p.bacinoSpaziale?.supremaConstruction);
    const fleetEvents = services && !Number.isSafeInteger(universe.serviceRevision) &&
      universe.fleetsInFlight?.some(f=>services.ids.some(id=>(f.fleet || f.ships)?.[id]));
    if (!(pendingSupreme || fleetEvents || services?.hasServices(universe)) || !universe.lastSeen || universe.lastSeen >= now || (universe.creativeMode && !pendingSupreme)) {
      const summary = processOfflineInterval(universe,now);
      window.UniversumSupremaSieges?.advanceOffline(universe, now);
      return summary;
    }
    const start = universe.lastSeen;
    const report = processOfflineInterval(universe,start,true);
    while (universe.lastSeen < now) {
      let boundary = services?.nextBoundary(universe,universe.lastSeen,now) ?? now;
      if (pendingSupreme) for (const p of universe.planets) {
        const order = p.bacinoSpaziale?.supremaConstruction;
        if (order?.status === 'building' && order.nextPaymentAt > universe.lastSeen && order.nextPaymentAt < boundary) {
          boundary = order.nextPaymentAt;
        }
      }
      if (fleetEvents) for (const f of universe.fleetsInFlight) {
        if (!services.ids.some(id=>(f.fleet || f.ships)?.[id])) continue;
        const at = f.status==='returning' ? f.returnTime : f.arrivalTime;
        if (at > universe.lastSeen && at < boundary) boundary = at;
      }
      const part = processOfflineInterval(universe,boundary,true);
      if (fleetEvents) window.__UniversumGalaxyModules.processFleetsAndBots(universe,boundary,true);
      for (const k of Object.keys(report.gained)) report.gained[k] += part.gained[k];
      report.completedResearches.push(...part.completedResearches);
      report.completedBuildings.push(...part.completedBuildings);
      for (const [key,count] of Object.entries(part.completedUnits)) report.completedUnits[key] = (report.completedUnits[key] || 0) + count;
    }
    report.offlineSeconds = Math.floor((now-start)/1000);
    window.UniversumSupremaSieges?.advanceOffline(universe, now);
    return report;
  }

  function processOfflineInterval(universe, now, exact = false) {
    const lastSeen = Number(universe.lastSeen) || now;
    const deltaSec = Math.max(0, (now - lastSeen) / 1000);

    const report = {
      offlineSeconds: Math.floor(deltaSec),
      gained: { metal: 0, crystal: 0, deuterium: 0 },
      completedBuildings: [],
      completedResearches: [],
      completedUnits: {}
    };

    if (universe.creativeMode) {
      G.normalizeResearchState(universe);
      for (const p of universe.planets || []) {
        normalizePlanet(p);
        p.resources.metal = CREATIVE_RESOURCE_CAP;
        p.resources.crystal = CREATIVE_RESOURCE_CAP;
        p.resources.deuterium = CREATIVE_RESOURCE_CAP;
      }
      settleSupremes(universe, now, report);
      universe.lastSeen = now;
      return report;
    }

    if (deltaSec < 5 && !exact) {
      for (const planet of universe.planets || []) settleBacinoDue(planet, now, report);
      advanceQueuesAtTimestamp(universe, now, report);
      checkCrepuscoloLimbo(universe, now);
      settleSupremes(universe, now, report);
      universe.lastSeen = now;
      return report;
    }

    for (const planet of universe.planets || []) {
      normalizePlanet(planet);
      const beforeM = planet.resources.metal;
      const beforeC = planet.resources.crystal;
      const beforeD = planet.resources.deuterium;

      if (planet.bacinoSpaziale && planet.bacinoSpaziale.status !== 'active') {
        settleBacinoOffline(planet, universe, lastSeen, now, report);
      } else if (planet.bacinoSpaziale && ((Array.isArray(planet.bacinoSpaziale.invictusConstructions) && planet.bacinoSpaziale.invictusConstructions.length > 0) || (planet.bacinoSpaziale.crepuscolo && planet.bacinoSpaziale.crepuscolo.status !== 'active') || planet.bacinoSpaziale.galatticaConstruction)) {
        settleInvictusOffline(planet, universe, lastSeen, now, report);
      } else {
        advancePlanetResources(planet, universe, deltaSec,now);
      }

      report.gained.metal += Math.max(0, Math.floor(planet.resources.metal - beforeM));
      report.gained.crystal += Math.max(0, Math.floor(planet.resources.crystal - beforeC));
      report.gained.deuterium += Math.max(0, Math.floor(planet.resources.deuterium - beforeD));
    }

    addGalatticaProduction(universe, deltaSec);
    transformCompletedGalattiche(universe, report);
    advanceQueuesAtTimestamp(universe, now, report);
    checkCrepuscoloLimbo(universe, now);
    settleSupremes(universe, now, report);
    universe.lastSeen = now;
    return report;
  }


  function settleSupremes(universe, now, report = null) {
    if (!window.UniversumSuprema || Number.isSafeInteger(universe.serviceRevision)) return false;
    let changed = false;
    for (const planet of universe.planets || []) {
      if (!planet.bacinoSpaziale?.supremaConstruction) continue;
      if (window.UniversumSuprema.settle(universe, planet, now)) {
        changed = true;
        if (report && !planet.bacinoSpaziale.supremaConstruction) {
          report.completedUnits['Nave Madre Suprema'] = (report.completedUnits['Nave Madre Suprema'] || 0) + 1;
        }
      }
    }
    return changed;
  }


  function tick(universe, deltaSec = 1) {
    if (!universe) return;
    const now = Date.now();

    if (universe.creativeMode) {
      for (const planet of universe.planets || []) {
        normalizePlanet(planet);
        planet.resources.metal = CREATIVE_RESOURCE_CAP;
        planet.resources.crystal = CREATIVE_RESOURCE_CAP;
        planet.resources.deuterium = CREATIVE_RESOURCE_CAP;
      }
      return settleSupremes(universe, now);
    }

    for (const planet of universe.planets || []) {
      advancePlanetResources(planet, universe, deltaSec,now);
      settleBacinoDue(planet, now, null);
    }
    addGalatticaProduction(universe, deltaSec);
    transformCompletedGalattiche(universe, null);

    const queueCompleted = advanceQueuesAtTimestamp(universe, now, null);
    checkCrepuscoloLimbo(universe, now);
    window.UniversumSupremaSieges?.advanceOffline(universe,now);
    return settleSupremes(universe, now) || queueCompleted;
  }
  Object.assign(G, { addResourcesWithCap, advancePlanetResources, advanceQueuesAtTimestamp, processOfflineProgress, tick });

})();
