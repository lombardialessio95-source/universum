/**
 * UNIVERSUM — Engine Core (Formule, Produzione, Code, Tick & Offline)
 */
(function () {
  'use strict';

  const CREATIVE_RESOURCE_CAP = 999999999;
  const CREATIVE_ENERGY_CAP = 999999;

  function getData() {
    return window.UniversumData;
  }

  // Normalizza campi del pianeta per retrocompatibilità
  function normalizePlanet(planet) {
    if (!planet.buildings) planet.buildings = {};
    if (planet.buildings.deuteriumSynthesizer !== undefined && planet.buildings.deuteriumSynth === undefined) {
      planet.buildings.deuteriumSynth = planet.buildings.deuteriumSynthesizer;
    }
    if (planet.buildings.deuteriumSynth === undefined) {
      planet.buildings.deuteriumSynth = 0;
    }
    if (planet.buildings.hiddenBunker === undefined) {
      planet.buildings.hiddenBunker = 0;
    }
    if (!Array.isArray(planet.buildQueue)) planet.buildQueue = [];
    if (!Array.isArray(planet.shipyardQueue)) planet.shipyardQueue = [];
    if (!Array.isArray(planet.defenseQueue)) planet.defenseQueue = [];
    if (!planet.defenses) planet.defenses = {};
    if (!planet.fleet) planet.fleet = {};
    if (planet.moon) {
      if (!planet.moon.buildings) planet.moon.buildings = {};
      if (!Array.isArray(planet.moon.buildQueue)) planet.moon.buildQueue = [];
      if (!planet.moon.resources) planet.moon.resources = { metal: 0, crystal: 0, deuterium: 0 };
    }
    return planet;
  }

  function getEffectiveSpeed(universe) {
    const baseSpeed = Math.max(1, Number(universe.speed) || 1);
    const isTurbo = (universe.turboUntil || 0) > Date.now();
    return isTurbo ? baseSpeed * 2 : baseSpeed;
  }

  // =========================================================
  // CALCOLO TEMPI PROGRESSIVI
  // =========================================================
  function getBuildingBuildTime(universe, planet, buildingId, targetLevel, isMoon = false) {
    if (universe.creativeMode) return 0;
    const Data = getData();
    const cost = Data.getBuildingCost(buildingId, targetLevel, isMoon);
    const effectiveSpeed = getEffectiveSpeed(universe);

    const roboticsLv = isMoon
      ? Number(planet.moon?.buildings?.lunarBase || 0)
      : Number(planet.buildings?.roboticsFactory || 0);
    const naniteLv = isMoon ? 0 : Number(planet.buildings?.naniteFactory || 0);

    const rawSeconds = ((cost.metal + cost.crystal) /
      (2500 * (1 + roboticsLv) * Math.pow(2, naniteLv) * effectiveSpeed)) * 3600;

    return Math.max(1, Math.floor(rawSeconds));
  }

  function getTotalLabLevel(universe) {
    const netLv = Number(universe.researches?.intergalacticNetwork || 0);
    const labLevels = (universe.planets || [])
      .map((p) => Number(p.buildings?.researchLab || 0))
      .filter((lv) => lv > 0)
      .sort((a, b) => b - a);

    if (labLevels.length === 0) return 0;
    const countToSum = Math.min(labLevels.length, 1 + netLv);
    let sum = 0;
    for (let i = 0; i < countToSum; i++) {
      sum += labLevels[i];
    }
    return sum;
  }

  function getResearchTime(universe, researchId, targetLevel) {
    if (universe.creativeMode) return 0;
    const Data = getData();
    const cost = Data.getResearchCost(researchId, targetLevel);
    const effectiveSpeed = getEffectiveSpeed(universe);
    const totalLabLv = getTotalLabLevel(universe);

    const rawSeconds = ((cost.metal + cost.crystal) /
      (1000 * (1 + totalLabLv) * effectiveSpeed)) * 3600;

    return Math.max(1, Math.floor(rawSeconds));
  }

  function getSingleUnitTime(universe, planet, unitId, isDefense = false) {
    if (universe.creativeMode) return 0;
    const Data = getData();
    const unit = isDefense ? Data.DEFENSES[unitId] : Data.SHIPS[unitId];
    if (!unit) return 1;

    const effectiveSpeed = getEffectiveSpeed(universe);
    const shipyardLv = Number(planet.buildings?.shipyard || 0);
    const naniteLv = Number(planet.buildings?.naniteFactory || 0);
    const secretYardLv = Number(planet.moon?.buildings?.secretShipyard || 0);

    let rawSeconds = (((unit.cost.metal + unit.cost.crystal) + (unit.attack + unit.shield) * 0.5 + (unit.complexity || 1) * 500) /
      (2500 * (1 + shipyardLv) * Math.pow(2, naniteLv) * effectiveSpeed)) * 3600;

    // Bonus Cantiere Segreto Lunare (-20% tempo per livello max fino al 60%)
    if (!isDefense && secretYardLv > 0) {
      const discount = Math.min(0.6, secretYardLv * 0.2);
      rawSeconds *= (1 - discount);
    }

    return Math.max(1, Math.floor(rawSeconds));
  }

  function getUnitCostAdjusted(planet, unitId, isDefense = false) {
    const Data = getData();
    const unit = isDefense ? Data.DEFENSES[unitId] : Data.SHIPS[unitId];
    if (!unit) return { metal: 0, crystal: 0, deuterium: 0 };

    const secretYardLv = Number(planet.moon?.buildings?.secretShipyard || 0);
    const mult = (!isDefense && secretYardLv > 0) ? 1.2 : 1.0;

    return {
      metal: Math.floor(unit.cost.metal * mult),
      crystal: Math.floor(unit.cost.crystal * mult),
      deuterium: Math.floor(unit.cost.deuterium * mult)
    };
  }

  // =========================================================
  // PRODUZIONE RISORSE E DEPOSITI
  // =========================================================
  function getPlanetProduction(planet, universe) {
    normalizePlanet(planet);
    const Data = getData();

    if (universe.creativeMode) {
      return {
        metalPerHour: 9999999,
        crystalPerHour: 9999999,
        deuteriumPerHour: 9999999,
        metalPerSec: 2777,
        crystalPerSec: 2777,
        deuteriumPerSec: 2777,
        energyProduced: CREATIVE_ENERGY_CAP,
        energyConsumed: 0,
        energyBalance: CREATIVE_ENERGY_CAP,
        efficiency: 1,
        caps: {
          metal: CREATIVE_RESOURCE_CAP,
          crystal: CREATIVE_RESOURCE_CAP,
          deuterium: CREATIVE_RESOURCE_CAP
        }
      };
    }

    const effectiveSpeed = getEffectiveSpeed(universe);
    const maxTemp = Number(planet.maxTemp ?? 30);
    const b = planet.buildings;
    const plasmaLv = Number(universe.researches?.plasmaTech || 0);
    const energyLv = Number(universe.researches?.energyTech || 0);

    // Energia prodotta e consumata
    const solarEnergy = Data.getBuildingEnergyDelta('solarPlant', b.solarPlant || 0, maxTemp);
    const fusionBase = Data.getBuildingEnergyDelta('fusionReactor', b.fusionReactor || 0, maxTemp);
    const fusionEnergy = Math.floor(fusionBase * (1 + energyLv * 0.05));
    const satCount = Number(planet.fleet?.solarSatellite || 0);
    const satEnergy = satCount * Math.max(10, Math.floor((maxTemp + 140) / 6));

    const energyProduced = solarEnergy + fusionEnergy + satEnergy;

    const metalEnergyNeed = Math.abs(Data.getBuildingEnergyDelta('metalMine', b.metalMine || 0, maxTemp));
    const crystalEnergyNeed = Math.abs(Data.getBuildingEnergyDelta('crystalMine', b.crystalMine || 0, maxTemp));
    const deutEnergyNeed = Math.abs(Data.getBuildingEnergyDelta('deuteriumSynth', b.deuteriumSynth || 0, maxTemp));
    const energyConsumed = metalEnergyNeed + crystalEnergyNeed + deutEnergyNeed;

    const energyBalance = energyProduced - energyConsumed;
    const efficiency = energyConsumed === 0 ? 1 : Math.min(1, Math.max(0.1, energyProduced / energyConsumed));

    // Produzione base + miniere
    const baseMetal = 30 * effectiveSpeed;
    const baseCrystal = 15 * effectiveSpeed;

    const mineMetal = Data.getBaseHourlyProduction('metalMine', b.metalMine || 0, maxTemp) *
      (1 + plasmaLv * 0.01) * efficiency * effectiveSpeed;
    const mineCrystal = Data.getBaseHourlyProduction('crystalMine', b.crystalMine || 0, maxTemp) *
      (1 + plasmaLv * 0.0066) * efficiency * effectiveSpeed;

    // Consumo deuterio del Reattore a Fusione
    const fusionDeutUpkeep = (b.fusionReactor || 0) > 0
      ? Math.ceil(10 * b.fusionReactor * Math.pow(1.1, b.fusionReactor) * effectiveSpeed)
      : 0;

    const mineDeut = Data.getBaseHourlyProduction('deuteriumSynth', b.deuteriumSynth || 0, maxTemp) *
      (1 + plasmaLv * 0.0033) * efficiency * effectiveSpeed - fusionDeutUpkeep;

    const metalPerHour = Math.floor(baseMetal + mineMetal);
    const crystalPerHour = Math.floor(baseCrystal + mineCrystal);
    const deuteriumPerHour = Math.floor(mineDeut);

    const caps = {
      metal: Data.getStorageCapacity(b.metalStorage || 0),
      crystal: Data.getStorageCapacity(b.crystalStorage || 0),
      deuterium: Data.getStorageCapacity(b.deuteriumTank || 0)
    };

    return {
      metalPerHour,
      crystalPerHour,
      deuteriumPerHour,
      metalPerSec: metalPerHour / 3600,
      crystalPerSec: crystalPerHour / 3600,
      deuteriumPerSec: deuteriumPerHour / 3600,
      energyProduced,
      energyConsumed,
      energyBalance,
      efficiency,
      caps
    };
  }

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

  // =========================================================
  // AVANZAMENTO CODE (EDIFICI, RICERCHE, CANTIERE, DIFESE, LUNA)
  // =========================================================
  function advanceQueuesAtTimestamp(universe, nowTs, summary = null) {
    const Data = getData();

    // 1. Ricerca Globale
    if (universe.researchQueue && nowTs >= universe.researchQueue.endTime) {
      const rq = universe.researchQueue;
      universe.researches[rq.id] = rq.targetLevel;
      universe.researchQueue = null;
      if (summary) {
        const rName = Data.RESEARCHES[rq.id]?.name || rq.id;
        summary.completedResearches.push(`${rName} Lv.${rq.targetLevel}`);
      }
    }

    // 2. Code per ogni pianeta e luna
    for (const planet of universe.planets || []) {
      normalizePlanet(planet);

      // Edifici planetari
      if (planet.buildQueue.length > 0 && nowTs >= planet.buildQueue[0].endTime) {
        const item = planet.buildQueue.shift();
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
          } else {
            dq.nextUnitEndTime += dq.unitDurationSec * 1000;
          }
        } else {
          break;
        }
      }
    }
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
      advanceQueuesAtTimestamp(universe, now, report);
      universe.lastSeen = now;
      return report;
    }

    for (const planet of universe.planets || []) {
      const prod = getPlanetProduction(planet, universe);
      const beforeM = planet.resources.metal;
      const beforeC = planet.resources.crystal;
      const beforeD = planet.resources.deuterium;

      addResourcesWithCap(
        planet,
        prod.metalPerSec * deltaSec,
        prod.crystalPerSec * deltaSec,
        prod.deuteriumPerSec * deltaSec,
        prod.caps
      );

      report.gained.metal += Math.max(0, Math.floor(planet.resources.metal - beforeM));
      report.gained.crystal += Math.max(0, Math.floor(planet.resources.crystal - beforeC));
      report.gained.deuterium += Math.max(0, Math.floor(planet.resources.deuterium - beforeD));
    }

    advanceQueuesAtTimestamp(universe, now, report);
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
      const prod = getPlanetProduction(planet, universe);
      addResourcesWithCap(
        planet,
        prod.metalPerSec * deltaSec,
        prod.crystalPerSec * deltaSec,
        prod.deuteriumPerSec * deltaSec,
        prod.caps
      );
    }

    advanceQueuesAtTimestamp(universe, now, null);
  }

  window.UniversumEngine = {
    _internal: {
      getData,
      normalizePlanet
    },
    getEffectiveSpeed,
    getBuildingBuildTime,
    getResearchTime,
    getSingleUnitTime,
    getUnitCostAdjusted,
    getPlanetProduction,
    processOfflineProgress,
    tick
  };
})();
