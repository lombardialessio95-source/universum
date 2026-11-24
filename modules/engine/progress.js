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


  function advancePlanetResources(planet, universe, elapsedSec) {
    if (!(elapsedSec > 0)) return;
    const before = getPlanetProduction(planet, universe);
    const fuel = Math.max(0, Number(planet.resources.deuterium) || 0);
    const depletionSec = before.fusionFuelPerHour > 0 && before.deuteriumPerHour < 0 && fuel > 0
      ? fuel * 3600 / -before.deuteriumPerHour : Infinity;
    const firstSec = Math.min(elapsedSec, depletionSec);
    addResourcesWithCap(planet, before.metalPerSec * firstSec, before.crystalPerSec * firstSec,
      before.deuteriumPerSec * firstSec, before.caps);
    if (depletionSec <= elapsedSec) {
      // Il primo intervallo usa la fusione al 100%; il resto usa la massima
      // frazione alimentabile dal sintetizzatore, senza passare sotto zero.
      planet.resources.deuterium = 0;
      const after = getPlanetProduction(planet, universe);
      const remaining = elapsedSec - firstSec;
      if (remaining > 0) addResourcesWithCap(planet, after.metalPerSec * remaining,
        after.crystalPerSec * remaining, after.deuteriumPerSec * remaining, after.caps);
    }
  }

  // =========================================================
  // AVANZAMENTO CODE (EDIFICI, RICERCHE, CANTIERE, DIFESE, LUNA)
  // =========================================================
  function advanceQueuesAtTimestamp(universe, nowTs, summary = null) {
    const Data = getData();
    let queueCompleted = false;

    // Ricerca imperiale + ricerche locali; evento in ordine cronologico.
    queueCompleted = G.advanceResearchQueues(universe, nowTs, summary);

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

      // Cantiere Navale
      while (planet.shipyardQueue.length > 0) {
        const sq = planet.shipyardQueue[0];
        if (nowTs >= sq.nextUnitEndTime) {
          planet.fleet[sq.id] = (planet.fleet[sq.id] || 0) + 1;
          sq.remaining -= 1;
          if (summary) {
            const uName = Data.SHIPS[sq.id]?.name || sq.id;
            summary.completedUnits[uName] = (summary.completedUnits[uName] || 0) + 1;
          }
          if (sq.remaining <= 0) {
            planet.shipyardQueue.shift();
            queueCompleted = true;
          } else {
            sq.nextUnitEndTime += sq.unitDurationSec * 1000;
          }
        } else {
          break;
        }
      }

      // Difesa Planetaria
      while (planet.defenseQueue.length > 0) {
        const dq = planet.defenseQueue[0];
        if (nowTs >= dq.nextUnitEndTime) {
          planet.defenses[dq.id] = (planet.defenses[dq.id] || 0) + 1;
          dq.remaining -= 1;
          if (summary) {
            const dName = Data.DEFENSES[dq.id]?.name || dq.id;
            summary.completedUnits[dName] = (summary.completedUnits[dName] || 0) + 1;
          }
          if (dq.remaining <= 0) {
            planet.defenseQueue.shift();
            queueCompleted = true;
          } else {
            dq.nextUnitEndTime += dq.unitDurationSec * 1000;
          }
        } else {
          break;
        }
      }
    }
    return queueCompleted;
  }


  // =========================================================
  // CALCOLO PROGRESSI OFFLINE & TICK IN TEMPO REALE
  // =========================================================
  function processOfflineProgress(universe) {
    const now = Date.now();
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
      universe.lastSeen = now;
      return report;
    }

    if (deltaSec < 5) {
      for (const planet of universe.planets || []) settleBacinoDue(planet, now, report);
      advanceQueuesAtTimestamp(universe, now, report);
      checkCrepuscoloLimbo(universe, now);
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
        advancePlanetResources(planet, universe, deltaSec);
      }

      report.gained.metal += Math.max(0, Math.floor(planet.resources.metal - beforeM));
      report.gained.crystal += Math.max(0, Math.floor(planet.resources.crystal - beforeC));
      report.gained.deuterium += Math.max(0, Math.floor(planet.resources.deuterium - beforeD));
    }

    addGalatticaProduction(universe, deltaSec);
    transformCompletedGalattiche(universe, report);
    advanceQueuesAtTimestamp(universe, now, report);
    checkCrepuscoloLimbo(universe, now);
    universe.lastSeen = now;
    return report;
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
      return;
    }

    for (const planet of universe.planets || []) {
      advancePlanetResources(planet, universe, deltaSec);
      settleBacinoDue(planet, now, null);
    }
    addGalatticaProduction(universe, deltaSec);
    transformCompletedGalattiche(universe, null);

    const queueCompleted = advanceQueuesAtTimestamp(universe, now, null);
    checkCrepuscoloLimbo(universe, now);
    return queueCompleted;
  }
  Object.assign(G, { addResourcesWithCap, advancePlanetResources, advanceQueuesAtTimestamp, processOfflineProgress, tick });

})();
