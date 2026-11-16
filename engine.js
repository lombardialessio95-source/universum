(function () {
  'use strict';

  const CREATIVE_RESOURCE_CAP = 999999999;
  const CREATIVE_ENERGY_CAP = 999999;
  const TURBO_DURATION_MS = 15 * 60 * 1000; // 15 minuti di Turbo 2x

  function getData() {
    return window.UniversumData;
  }

  // Normalizza campi del pianeta per retrocompatibilità tra Step 1 e Step 2
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
  // CALCOLO TEMPI PROGRESSIVI (OBBLIGATORIO)
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

      // Cantiere Navale (una unità alla volta o batch completato)
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
  // CALCOLO PROGRESSI OFFLINE (RAPPORTO DI ASSENZA)
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

  // =========================================================
  // TICK IN TEMPO REALE (CHIAMATO OGNI SECONDO)
  // =========================================================
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

  // =========================================================
  // AZIONI GIOCATORE: EDIFICI, RICERCHE, NAVI, DIFESE, TURBO, CHEAT
  // =========================================================
  function canAfford(resources, cost) {
    return (
      resources.metal >= cost.metal &&
      resources.crystal >= cost.crystal &&
      resources.deuterium >= cost.deuterium
    );
  }

  function deductResources(resources, cost) {
    resources.metal = Math.max(0, resources.metal - cost.metal);
    resources.crystal = Math.max(0, resources.crystal - cost.crystal);
    resources.deuterium = Math.max(0, resources.deuterium - cost.deuterium);
  }

  function startBuilding(universe, planetIndex, buildingId, isMoon = false) {
    const Data = getData();
    const planet = universe.planets[planetIndex];
    if (!planet) throw new Error('Pianeta non trovato.');
    normalizePlanet(planet);

    if (isMoon) {
      if (!planet.moon) throw new Error('Questo pianeta non possiede una Luna.');
      const def = Data.MOON_BUILDINGS[buildingId];
      if (!def) throw new Error('Edificio lunare sconosciuto.');

      const curLv = Number(planet.moon.buildings[buildingId] || 0);
      if (def.maxLevel && curLv >= def.maxLevel) {
        throw new Error(`${def.name} è già al livello massimo (${def.maxLevel}).`);
      }

      if (!universe.creativeMode) {
        if (planet.moon.buildQueue.length > 0) {
          throw new Error('Coda costruzioni lunari già occupata.');
        }
        if (buildingId !== 'lunarBase' && Data.getMoonUsedFields(planet.moon) >= Data.getMoonMaxFields(planet.moon)) {
          throw new Error('Campi lunari esauriti! Amplia la Base Lunare.');
        }
        const reqCheck = Data.checkRequirements(def.requirements, planet, universe, true);
        if (!reqCheck.met) {
          throw new Error(`Requisiti mancanti: ${reqCheck.missing.join(', ')}`);
        }
      }

      const targetLv = curLv + 1;
      if (universe.creativeMode) {
        planet.moon.buildings[buildingId] = targetLv;
        return { instant: true, targetLevel: targetLv };
      }

      const cost = Data.getBuildingCost(buildingId, targetLv, true);
      if (!canAfford(planet.resources, cost)) {
        throw new Error('Risorse insufficienti sul pianeta di supporto per la struttura lunare.');
      }

      deductResources(planet.resources, cost);
      const durationSec = getBuildingBuildTime(universe, planet, buildingId, targetLv, true);
      const now = Date.now();
      planet.moon.buildQueue.push({
        id: buildingId,
        targetLevel: targetLv,
        startTime: now,
        endTime: now + durationSec * 1000,
        durationSec
      });
      return { instant: false, targetLevel: targetLv, durationSec };
    }

    // Edificio Planetario
    const def = Data.BUILDINGS[buildingId];
    if (!def) throw new Error('Edificio sconosciuto.');

    const curLv = Number(planet.buildings[buildingId] || 0);
    if (def.maxLevel && curLv >= def.maxLevel) {
      throw new Error(`${def.name} ha raggiunto il livello massimo (${def.maxLevel}).`);
    }

    if (!universe.creativeMode) {
      if (planet.buildQueue.length > 0) {
        throw new Error('Coda di costruzione già occupata su questo pianeta.');
      }
      if (buildingId !== 'terraformer' && Data.getUsedFields(planet) >= Data.getMaxFields(planet)) {
        throw new Error('Nessun campo libero sul pianeta! Costruisci un Terraformer.');
      }
      const reqCheck = Data.checkRequirements(def.requirements, planet, universe, false);
      if (!reqCheck.met) {
        throw new Error(`Requisiti mancanti: ${reqCheck.missing.join(', ')}`);
      }
    }

    const targetLv = curLv + 1;
    if (universe.creativeMode) {
      planet.buildings[buildingId] = targetLv;
      if (buildingId === 'deuteriumSynth') planet.buildings.deuteriumSynthesizer = targetLv;
      return { instant: true, targetLevel: targetLv };
    }

    const cost = Data.getBuildingCost(buildingId, targetLv, false);
    if (!canAfford(planet.resources, cost)) {
      throw new Error('Risorse insufficienti per avviare la costruzione.');
    }

    deductResources(planet.resources, cost);
    const durationSec = getBuildingBuildTime(universe, planet, buildingId, targetLv, false);
    const now = Date.now();
    planet.buildQueue.push({
      id: buildingId,
      targetLevel: targetLv,
      startTime: now,
      endTime: now + durationSec * 1000,
      durationSec
    });

    return { instant: false, targetLevel: targetLv, durationSec };
  }

  function startResearch(universe, researchId, planetIndex = 0) {
    const Data = getData();
    const def = Data.RESEARCHES[researchId];
    if (!def) throw new Error('Ricerca sconosciuta.');

    const planet = universe.planets[planetIndex] || universe.planets[0];
    normalizePlanet(planet);

    const curLv = Number(universe.researches[researchId] || 0);
    const targetLv = curLv + 1;

    if (!universe.creativeMode) {
      if (universe.researchQueue) {
        throw new Error('Un’altra ricerca è già in corso nei laboratori.');
      }
      const reqCheck = Data.checkRequirements(def.requirements, planet, universe, false);
      if (!reqCheck.met) {
        throw new Error(`Requisiti mancanti: ${reqCheck.missing.join(', ')}`);
      }
    }

    if (universe.creativeMode) {
      universe.researches[researchId] = targetLv;
      return { instant: true, targetLevel: targetLv };
    }

    const cost = Data.getResearchCost(researchId, targetLv);
    if (!canAfford(planet.resources, cost)) {
      throw new Error('Risorse insufficienti sul pianeta attivo per questa ricerca.');
    }

    deductResources(planet.resources, cost);
    const durationSec = getResearchTime(universe, researchId, targetLv);
    const now = Date.now();
    universe.researchQueue = {
      id: researchId,
      targetLevel: targetLv,
      planetId: planet.id,
      startTime: now,
      endTime: now + durationSec * 1000,
      durationSec
    };

    return { instant: false, targetLevel: targetLv, durationSec };
  }

  function buildUnits(universe, planetIndex, unitId, count = 1, isDefense = false) {
    const Data = getData();
    const planet = universe.planets[planetIndex];
    if (!planet) throw new Error('Pianeta non trovato.');
    normalizePlanet(planet);

    const qty = Math.max(1, Math.floor(Number(count) || 1));
    const unit = isDefense ? Data.DEFENSES[unitId] : Data.SHIPS[unitId];
    if (!unit) throw new Error('Unità sconosciuta.');

    if (!universe.creativeMode) {
      const reqCheck = Data.checkRequirements(unit.requirements, planet, universe, false);
      if (!reqCheck.met) {
        throw new Error(`Requisiti mancanti: ${reqCheck.missing.join(', ')}`);
      }
    }

    // Controllo limite Cupola Scudo (max 1)
    if (isDefense && unit.maxCount) {
      const existing = Number(planet.defenses[unitId] || 0);
      const queued = planet.defenseQueue
        .filter((q) => q.id === unitId)
        .reduce((acc, q) => acc + q.remaining, 0);
      if (existing + queued + qty > unit.maxCount) {
        throw new Error(`${unit.name}: massimo ${unit.maxCount} unità consentita per pianeta.`);
      }
    }

    if (universe.creativeMode) {
      if (isDefense) {
        planet.defenses[unitId] = (planet.defenses[unitId] || 0) + qty;
      } else {
        planet.fleet[unitId] = (planet.fleet[unitId] || 0) + qty;
      }
      return { instant: true, count: qty };
    }

    const unitCost = getUnitCostAdjusted(planet, unitId, isDefense);
    const totalCost = {
      metal: unitCost.metal * qty,
      crystal: unitCost.crystal * qty,
      deuterium: unitCost.deuterium * qty
    };

    if (!canAfford(planet.resources, totalCost)) {
      throw new Error('Risorse insufficienti per avviare la produzione.');
    }

    deductResources(planet.resources, totalCost);
    const unitDurationSec = getSingleUnitTime(universe, planet, unitId, isDefense);
    const queue = isDefense ? planet.defenseQueue : planet.shipyardQueue;
    const now = Date.now();
    const startAfter = queue.length > 0 ? queue[queue.length - 1].endTime : now;

    queue.push({
      id: unitId,
      remaining: qty,
      total: qty,
      unitDurationSec,
      nextUnitEndTime: startAfter + unitDurationSec * 1000,
      endTime: startAfter + unitDurationSec * qty * 1000
    });

    return { instant: false, count: qty, totalDurationSec: unitDurationSec * qty };
  }

  function activateTurbo(universe) {
    const now = Date.now();
    if ((universe.turboUntil || 0) > now) {
      return { active: true, remainingSec: Math.ceil((universe.turboUntil - now) / 1000) };
    }
    universe.turboUntil = now + TURBO_DURATION_MS;
    return { active: true, remainingSec: TURBO_DURATION_MS / 1000 };
  }

  function applyCreativeCheat(universe, planetIndex, actionType) {
    if (!universe.creativeMode) {
      throw new Error('Disponibile solo in Modalità Creativa.');
    }
    const Data = getData();
    const planet = universe.planets[planetIndex] || universe.planets[0];
    normalizePlanet(planet);

    switch (actionType) {
      case 'add-res':
        planet.resources.metal += 10000000;
        planet.resources.crystal += 10000000;
        planet.resources.deuterium += 10000000;
        return '+10.000.000 di ogni risorsa aggiunti!';

      case 'finish-queues':
        // Completa istantaneamente tutte le code dell'universo
        if (universe.researchQueue) {
          universe.researches[universe.researchQueue.id] = universe.researchQueue.targetLevel;
          universe.researchQueue = null;
        }
        for (const p of universe.planets) {
          normalizePlanet(p);
          while (p.buildQueue.length > 0) {
            const b = p.buildQueue.shift();
            p.buildings[b.id] = b.targetLevel;
          }
          if (p.moon && Array.isArray(p.moon.buildQueue)) {
            while (p.moon.buildQueue.length > 0) {
              const mb = p.moon.buildQueue.shift();
              p.moon.buildings[mb.id] = mb.targetLevel;
            }
          }
          while (p.shipyardQueue.length > 0) {
            const sq = p.shipyardQueue.shift();
            p.fleet[sq.id] = (p.fleet[sq.id] || 0) + sq.remaining;
          }
          while (p.defenseQueue.length > 0) {
            const dq = p.defenseQueue.shift();
            p.defenses[dq.id] = (p.defenses[dq.id] || 0) + dq.remaining;
          }
        }
        return 'Tutte le code di costruzione, ricerca e cantiere completate!';

      case 'unlock-tech':
        for (const rId of Object.keys(Data.RESEARCHES)) {
          universe.researches[rId] = Math.max(15, Number(universe.researches[rId] || 0));
        }
        return 'Tutte le tecnologie sbloccate al Livello 15!';

      case 'add-rip':
        planet.fleet.deathStar = (planet.fleet.deathStar || 0) + 10;
        return '+10 Morti Nere schierate in orbita!';

      default:
        throw new Error('Comando creativo non riconosciuto.');
    }
  }

  // =========================================================
  // RINOMINA PIANETA E LUNA (SINCRONIZZATI CON galaxyDeltas)
  // =========================================================
  function renamePlanet(universe, planetIndex, newName) {
    const planet = universe.planets[planetIndex];
    if (!planet) throw new Error('Pianeta non trovato.');
    const cleaned = (newName || '').trim().substring(0, 24);
    if (!cleaned) throw new Error('Il nome del pianeta non può essere vuoto.');

    planet.name = cleaned;
    const key = `${planet.coords.g}:${planet.coords.s}:${planet.coords.p}`;
    if (!universe.galaxyDeltas) universe.galaxyDeltas = {};
    universe.galaxyDeltas[key] = Object.assign({}, universe.galaxyDeltas[key], {
      ownerType: 'player',
      emperor: universe.emperor,
      planetName: cleaned,
      planetId: planet.id
    });
    return cleaned;
  }

  function renameMoon(universe, planetIndex, newName) {
    const planet = universe.planets[planetIndex];
    if (!planet || !planet.moon) throw new Error('Nessuna Luna presente su questo pianeta.');
    const cleaned = (newName || '').trim().substring(0, 24);
    if (!cleaned) throw new Error('Il nome della Luna non può essere vuoto.');

    planet.moon.name = cleaned;
    const key = `${planet.coords.g}:${planet.coords.s}:${planet.coords.p}`;
    if (!universe.galaxyDeltas) universe.galaxyDeltas = {};
    universe.galaxyDeltas[key] = Object.assign({}, universe.galaxyDeltas[key], {
      hasMoon: true,
      moonName: cleaned
    });
    return cleaned;
  }

  // =========================================================
  // AUTOSAVE PERIODICO E SU VISIBILITYCHANGE
  // =========================================================
  let activeUniverseRef = null;
  let autosaveInterval = null;

  function bindAutoSave(getUniverseFn) {
    activeUniverseRef = getUniverseFn;
    if (autosaveInterval) clearInterval(autosaveInterval);

    autosaveInterval = setInterval(() => {
      const uni = typeof activeUniverseRef === 'function' ? activeUniverseRef() : null;
      if (uni && window.UniversumDB) {
        window.UniversumDB.save(uni).catch((e) => console.warn('[Autosave] Errore:', e));
      }
    }, 10000);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        const uni = typeof activeUniverseRef === 'function' ? activeUniverseRef() : null;
        if (uni && window.UniversumDB) {
          window.UniversumDB.save(uni).catch(() => {});
        }
      }
    });
  }

  window.UniversumEngine = {
    getEffectiveSpeed,
    getBuildingBuildTime,
    getResearchTime,
    getSingleUnitTime,
    getUnitCostAdjusted,
    getPlanetProduction,
    processOfflineProgress,
    tick,
    startBuilding,
    startResearch,
    buildUnits,
    activateTurbo,
    applyCreativeCheat,
    renamePlanet,
    renameMoon,
    bindAutoSave
  };
})();
