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
    // Bacino Spaziale: campo opzionale, i salvataggi vecchi lo ricevono come null.
    if (planet.bacinoSpaziale === undefined) planet.bacinoSpaziale = null;
    if (planet.bacinoSpaziale) {
      const b = planet.bacinoSpaziale;
      if (!b.paid) b.paid = { metal: 0, crystal: 0, deuterium: 0 };
      b.daysPaid = Math.max(0, Math.min(20, Math.floor(Number(b.daysPaid) || 0)));
      if (!b.status) b.status = b.daysPaid >= 20 ? 'active' : 'building';
      if (!Number(b.nextPaymentAt)) b.nextPaymentAt = 0;
      b.invictusActive = Math.max(0, Math.min(4, Math.floor(Number(b.invictusActive) || 0)));
      if (!Array.isArray(b.invictusConstructions)) b.invictusConstructions = [];
      for (const c of b.invictusConstructions) {
        if (!c.paid) c.paid = { metal: 0, crystal: 0, deuterium: 0 };
        c.daysPaid = Math.max(0, Math.min(20, Math.floor(Number(c.daysPaid) || 0)));
        if (!c.status) c.status = 'building';
        if (!Number(c.nextPaymentAt)) c.nextPaymentAt = 0;
      }
      // Crepuscolo: progetto unico nel Bacino + flag permanente di Bacino mai usato.
      if (b.crepuscolo === undefined) b.crepuscolo = null;
      if (b.crepuscolo) {
        const c = b.crepuscolo;
        if (!c.paid) c.paid = { metal: 0, crystal: 0, deuterium: 0 };
        if (!c.status) c.status = 'active';
        if (!Number(c.daysTotal)) c.daysTotal = getData().CREPUSCOLO.buildDays;
        c.daysPaid = Math.max(0, Math.min(c.daysTotal, Math.floor(Number(c.daysPaid) || 0)));
        if (!Number(c.nextPaymentAt)) c.nextPaymentAt = 0;
        if (c.repairKind === undefined) c.repairKind = null;
        if (!c.projectKind) c.projectKind = c.status === 'repairing' ? (c.repairKind || 'battle') : 'build';
      }
      if (b.everUsed === undefined) {
        b.everUsed = b.invictusActive > 0 || b.invictusConstructions.length > 0 || !!b.crepuscolo;
      }
      if (b.galatticaConstruction === undefined) b.galatticaConstruction = null;
      if (b.galatticaConstruction) {
        const gc = b.galatticaConstruction;
        if (!gc.paid) gc.paid = { metal: 0, crystal: 0, deuterium: 0 };
        if (!gc.status) gc.status = 'building';
        gc.daysPaid = Math.max(0, Math.min(getData().GALATTICA.buildDays, Math.floor(Number(gc.daysPaid) || 0)));
        if (!Number(gc.nextPaymentAt)) gc.nextPaymentAt = 0;
      }
    }
    if (planet.galatticaOrigin === undefined) planet.galatticaOrigin = false;
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

  // =========================================================
  // BACINO SPAZIALE: RATE GIORNALIERE (GIORNI REALI)
  // =========================================================
  function getProjectMissingForDay(planet, dailyCost) {
    const res = (planet && planet.resources) || {};
    return {
      metal: Math.max(0, dailyCost.metal - (Number(res.metal) || 0)),
      crystal: Math.max(0, dailyCost.crystal - (Number(res.crystal) || 0)),
      deuterium: Math.max(0, dailyCost.deuterium - (Number(res.deuterium) || 0))
    };
  }

  function getBacinoMissingForDay(planet) {
    return getProjectMissingForDay(planet, getData().BACINO_SPAZIALE.dailyCost);
  }

  function getInvictusMissingForDay(planet) {
    return getProjectMissingForDay(planet, getData().INVICTUS.dailyCost);
  }

  function getCrepuscoloMissingForDay(planet) {
    return getProjectMissingForDay(planet, getData().CREPUSCOLO.dailyCost);
  }

  function getGalatticaMissingForDay(planet) {
    return getProjectMissingForDay(planet, getData().GALATTICA.dailyCost);
  }

  function getGalatticaStructureCost(structureId, targetLevel) {
    const def = getData().GALATTICA_STRUCTURES[structureId];
    if (!def) return { metal: 0, crystal: 0, deuterium: 0 };
    const lv = Math.max(1, Number(targetLevel) || 1);
    const mult = Math.pow(def.factor, lv - 1);
    return {
      metal: Math.floor(def.baseCost.metal * mult),
      crystal: Math.floor(def.baseCost.crystal * mult),
      deuterium: Math.floor(def.baseCost.deuterium * mult)
    };
  }

  function canPayDaily(planet, dailyCost) {
    const missing = getProjectMissingForDay(planet, dailyCost);
    return missing.metal === 0 && missing.crystal === 0 && missing.deuterium === 0;
  }

  function canPayBacinoDay(planet) {
    return canPayDaily(planet, getData().BACINO_SPAZIALE.dailyCost);
  }

  function payBacinoDay(planet, summary) {
    const def = getData().BACINO_SPAZIALE;
    const bacino = planet.bacinoSpaziale;
    planet.resources.metal -= def.dailyCost.metal;
    planet.resources.crystal -= def.dailyCost.crystal;
    planet.resources.deuterium -= def.dailyCost.deuterium;
    bacino.paid.metal += def.dailyCost.metal;
    bacino.paid.crystal += def.dailyCost.crystal;
    bacino.paid.deuterium += def.dailyCost.deuterium;
    bacino.daysPaid += 1;
    if (bacino.daysPaid >= def.totalDays) {
      bacino.status = 'active';
      bacino.nextPaymentAt = 0;
      bacino.completedAt = Date.now();
      if (summary) summary.completedBuildings.push(`Bacino Spaziale completato (${planet.name})`);
    } else {
      bacino.status = 'building';
    }
  }

  // Paga le rate scadute con le risorse gia' presenti (tick in tempo reale).
  function settleBacinoDue(planet, nowTs, summary) {
    normalizePlanet(planet);
    const bacino = planet.bacinoSpaziale;
    if (!bacino) return;
    if (bacino.status === 'active') { settleInvictusDue(planet, nowTs, summary); return; }
    const def = getData().BACINO_SPAZIALE;
    if (!bacino.nextPaymentAt) { bacino.nextPaymentAt = nowTs + def.dayMs; return; }
    while (bacino.status !== 'active' && bacino.nextPaymentAt <= nowTs) {
      if (!canPayBacinoDay(planet)) { bacino.status = 'stopped'; return; }
      payBacinoDay(planet, summary);
      if (bacino.status !== 'active') bacino.nextPaymentAt += def.dayMs;
    }
  }

  // Assenza: accredita la produzione giorno per giorno e paga solo i giorni coperti.
  function settleBacinoOffline(planet, universe, fromTs, toTs, summary) {
    const bacino = planet.bacinoSpaziale;
    const def = getData().BACINO_SPAZIALE;
    const prod = getPlanetProduction(planet, universe);
    const addFor = (from, to) => {
      const sec = Math.max(0, (to - from) / 1000);
      if (sec > 0) addResourcesWithCap(planet, prod.metalPerSec * sec, prod.crystalPerSec * sec, prod.deuteriumPerSec * sec, prod.caps);
    };
    if (!bacino.nextPaymentAt) bacino.nextPaymentAt = fromTs + def.dayMs;
    let cursor = fromTs;
    while (bacino.status !== 'active' && bacino.nextPaymentAt > cursor && bacino.nextPaymentAt <= toTs) {
      addFor(cursor, bacino.nextPaymentAt);
      cursor = bacino.nextPaymentAt;
      if (!canPayBacinoDay(planet)) { bacino.status = 'stopped'; break; }
      payBacinoDay(planet, summary);
      if (bacino.status !== 'active') bacino.nextPaymentAt += def.dayMs;
    }
    addFor(cursor, toTs);
    // Giorno scaduto ma coperto solo con la produzione maturata entro la riapertura.
    if (bacino.status === 'stopped' && bacino.nextPaymentAt <= toTs && canPayBacinoDay(planet)) {
      payBacinoDay(planet, summary);
      if (bacino.status !== 'active') bacino.nextPaymentAt = toTs + def.dayMs;
    }
  }

  // Invictus: stesse rate giornaliere, progetto dentro il Bacino attivo.
  function payInvictusDay(planet, construction) {
    const def = getData().INVICTUS;
    planet.resources.metal -= def.dailyCost.metal;
    planet.resources.crystal -= def.dailyCost.crystal;
    planet.resources.deuterium -= def.dailyCost.deuterium;
    construction.paid.metal += def.dailyCost.metal;
    construction.paid.crystal += def.dailyCost.crystal;
    construction.paid.deuterium += def.dailyCost.deuterium;
    construction.daysPaid += 1;
    construction.status = construction.daysPaid >= def.totalDays ? 'done' : 'building';
  }

  function payCrepuscoloDay(planet, summary) {
    const def = getData().CREPUSCOLO;
    const c = planet.bacinoSpaziale.crepuscolo;
    planet.resources.metal -= def.dailyCost.metal;
    planet.resources.crystal -= def.dailyCost.crystal;
    planet.resources.deuterium -= def.dailyCost.deuterium;
    c.paid.metal += def.dailyCost.metal;
    c.paid.crystal += def.dailyCost.crystal;
    c.paid.deuterium += def.dailyCost.deuterium;
    c.daysPaid += 1;
    if (c.daysPaid >= c.daysTotal) {
      c.status = 'active';
      c.repairKind = null;
      c.nextPaymentAt = 0;
      c.completedAt = Date.now();
      if (summary) summary.completedBuildings.push(`Crepuscolo degli Dei operativa (${planet.name})`);
    } else {
      c.status = c.projectKind === 'build' ? 'building' : 'repairing';
    }
  }

  function payGalatticaDay(planet) {
    const def = getData().GALATTICA;
    const gc = planet.bacinoSpaziale.galatticaConstruction;
    planet.resources.metal -= def.dailyCost.metal;
    planet.resources.crystal -= def.dailyCost.crystal;
    planet.resources.deuterium -= def.dailyCost.deuterium;
    gc.paid.metal += def.dailyCost.metal;
    gc.paid.crystal += def.dailyCost.crystal;
    gc.paid.deuterium += def.dailyCost.deuterium;
    gc.daysPaid += 1;
    gc.status = gc.daysPaid >= def.buildDays ? 'done' : 'building';
  }

  function settleGalatticaDue(planet, nowTs) {
    const bacino = planet.bacinoSpaziale;
    const gc = bacino && bacino.galatticaConstruction;
    if (!gc || gc.status === 'done') return;
    const def = getData().GALATTICA;
    if (!gc.nextPaymentAt) { gc.nextPaymentAt = nowTs + def.dayMs; return; }
    while (gc.status !== 'done' && gc.nextPaymentAt <= nowTs) {
      if (!canPayDaily(planet, def.dailyCost)) { gc.status = 'stopped'; return; }
      payGalatticaDay(planet);
      if (gc.status !== 'done') gc.nextPaymentAt += def.dayMs;
    }
  }

  // Al completamento il Bacino sparisce e nasce la Galattica alle coordinate del pianeta.
  function transformCompletedGalattiche(universe, summary) {
    if (!universe) return;
    if (!Array.isArray(universe.galattiche)) universe.galattiche = [];
    for (const planet of universe.planets || []) {
      normalizePlanet(planet);
      const bacino = planet.bacinoSpaziale;
      if (!bacino || !bacino.galatticaConstruction || bacino.galatticaConstruction.status !== 'done') continue;
      const galattica = {
        id: 'gal_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: 'Galattica',
        coords: Object.assign({}, planet.coords),
        originPlanetId: planet.id,
        resources: { metal: 0, crystal: 0, deuterium: 0 },
        structures: { cantiereSpaziale: 1, generatoreMetallo: 1, generatoreCristallo: 1, sintetizzatoreDeuterio: 1, reattoreFusione: 1 },
        defenses: {},
        orbitingFleet: {}
      };
      universe.galattiche.push(galattica);
      planet.bacinoSpaziale = null;
      planet.galatticaOrigin = true;
      const key = `${planet.coords.g}:${planet.coords.s}:${planet.coords.p}`;
      if (!universe.galaxyDeltas) universe.galaxyDeltas = {};
      universe.galaxyDeltas[key] = Object.assign({}, universe.galaxyDeltas[key], { hasMoon: false, hasBacino: false, galatticaId: galattica.id });
      if (summary) summary.completedBuildings.push(`Galattica completata (${planet.name})`);
    }
  }

  function normalizeGalattica(galattica) {
    if (!galattica.resources) galattica.resources = { metal: 0, crystal: 0, deuterium: 0 };
    if (!galattica.structures) galattica.structures = { cantiereSpaziale: 0, generatoreMetallo: 0, generatoreCristallo: 0, sintetizzatoreDeuterio: 0, reattoreFusione: 0 };
    if (!galattica.defenses) galattica.defenses = {};
    if (!galattica.orbitingFleet) galattica.orbitingFleet = {};
    return galattica;
  }

  // Economia interna Galattica: solo Reattore a Fusione alimenta generatori/sintetizzatori.
  function getGalatticaProduction(galattica, universe) {
    normalizeGalattica(galattica);
    const Data = getData();
    if (universe.creativeMode) {
      return { metalPerHour: 0, crystalPerHour: 0, deuteriumPerHour: 0, metalPerSec: 0, crystalPerSec: 0, deuteriumPerSec: 0, energyProduced: 999999, energyConsumed: 0, energyBalance: 999999, efficiency: 1 };
    }
    const s = galattica.structures;
    const speed = getEffectiveSpeed(universe);
    const plasmaLv = Number(universe.researches?.plasmaTech || 0);
    const energyLv = Number(universe.researches?.energyTech || 0);
    const fusionBase = Data.getBuildingEnergyDelta('fusionReactor', s.reattoreFusione || 0, 30);
    const energyProduced = Math.floor(fusionBase * (1 + energyLv * 0.05));
    const energyConsumed =
      Math.abs(Data.getBuildingEnergyDelta('metalMine', s.generatoreMetallo || 0, 30)) +
      Math.abs(Data.getBuildingEnergyDelta('crystalMine', s.generatoreCristallo || 0, 30)) +
      Math.abs(Data.getBuildingEnergyDelta('deuteriumSynth', s.sintetizzatoreDeuterio || 0, 30));
    const energyBalance = energyProduced - energyConsumed;
    const efficiency = energyConsumed === 0 ? 1 : Math.min(1, Math.max(0.1, energyProduced / energyConsumed));
    const fusionUpkeep = (s.reattoreFusione || 0) > 0 ? Math.ceil(10 * s.reattoreFusione * Math.pow(1.1, s.reattoreFusione) * speed) : 0;
    const metalPerHour = Math.floor(Data.getBaseHourlyProduction('metalMine', s.generatoreMetallo || 0, 30) * (1 + plasmaLv * 0.01) * efficiency * speed);
    const crystalPerHour = Math.floor(Data.getBaseHourlyProduction('crystalMine', s.generatoreCristallo || 0, 30) * (1 + plasmaLv * 0.0066) * efficiency * speed);
    const deuteriumPerHour = Math.floor(Data.getBaseHourlyProduction('deuteriumSynth', s.sintetizzatoreDeuterio || 0, 30) * (1 + plasmaLv * 0.0033) * efficiency * speed) - fusionUpkeep;
    return {
      metalPerHour, crystalPerHour, deuteriumPerHour,
      metalPerSec: metalPerHour / 3600, crystalPerSec: crystalPerHour / 3600, deuteriumPerSec: deuteriumPerHour / 3600,
      energyProduced, energyConsumed, energyBalance, efficiency
    };
  }

  function addGalatticaProduction(universe, deltaSec) {
    for (const galattica of universe.galattiche || []) {
      const prod = getGalatticaProduction(galattica, universe);
      galattica.resources.metal = Math.max(0, galattica.resources.metal + prod.metalPerSec * deltaSec);
      galattica.resources.crystal = Math.max(0, galattica.resources.crystal + prod.crystalPerSec * deltaSec);
      galattica.resources.deuterium = Math.max(0, galattica.resources.deuterium + prod.deuteriumPerSec * deltaSec);
    }
  }

  function settleCrepuscoloDue(planet, nowTs, summary) {
    const bacino = planet.bacinoSpaziale;
    const c = bacino && bacino.crepuscolo;
    if (!c || c.status === 'active') return;
    const def = getData().CREPUSCOLO;
    if (!c.nextPaymentAt) { c.nextPaymentAt = nowTs + def.dayMs; return; }
    while (c.status !== 'active' && c.nextPaymentAt <= nowTs) {
      if (!canPayDaily(planet, def.dailyCost)) { c.status = 'stopped'; return; }
      payCrepuscoloDay(planet, summary);
      if (c.status !== 'active') c.nextPaymentAt += def.dayMs;
    }
  }

  // Limbo Crepuscolo: arrivo al pianeta madre e legame al primo Bacino attivo libero.
  function checkCrepuscoloLimbo(universe, nowTs) {
    const limbo = universe && universe.crepuscoloLimbo;
    if (!limbo) return;
    if (limbo.status === 'travelling' && nowTs >= (Number(limbo.arrivalAt) || 0)) limbo.status = 'limbo';
    if (limbo.status !== 'limbo') return;
    const target = (universe.planets || []).find((pl) => pl.bacinoSpaziale && pl.bacinoSpaziale.status === 'active' && !pl.bacinoSpaziale.crepuscolo);
    if (!target) return;
    target.bacinoSpaziale.crepuscolo = {
      status: 'active', projectKind: 'build', repairKind: null,
      daysPaid: getData().CREPUSCOLO.buildDays, daysTotal: getData().CREPUSCOLO.buildDays,
      paid: Object.assign({}, getData().CREPUSCOLO.totalCost), startedAt: nowTs, nextPaymentAt: 0, completedAt: nowTs
    };
    target.bacinoSpaziale.everUsed = true;
    universe.crepuscoloLimbo = null;
  }

  function collectDoneInvictus(planet, summary) {
    const bacino = planet.bacinoSpaziale;
    if (!bacino || !Array.isArray(bacino.invictusConstructions)) return;
    const done = bacino.invictusConstructions.filter((c) => c.status === 'done');
    if (done.length === 0) return;
    bacino.invictusConstructions = bacino.invictusConstructions.filter((c) => c.status !== 'done');
    bacino.invictusActive = Math.min(getData().INVICTUS.maxPerBacino, (Number(bacino.invictusActive) || 0) + done.length);
    if (summary) for (let i = 0; i < done.length; i++) summary.completedBuildings.push(`Invictus completata (${planet.name})`);
  }

  function settleInvictusDue(planet, nowTs, summary) {
    const bacino = planet.bacinoSpaziale;
    if (!bacino || !Array.isArray(bacino.invictusConstructions)) return;
    const def = getData().INVICTUS;
    for (const c of bacino.invictusConstructions) {
      if (c.status === 'done') continue;
      if (!c.nextPaymentAt) { c.nextPaymentAt = nowTs + def.dayMs; continue; }
      while (c.status !== 'done' && c.nextPaymentAt <= nowTs) {
        if (!canPayDaily(planet, def.dailyCost)) { c.status = 'stopped'; break; }
        payInvictusDay(planet, c);
        if (c.status !== 'done') c.nextPaymentAt += def.dayMs;
      }
    }
    collectDoneInvictus(planet, summary);
    settleCrepuscoloDue(planet, nowTs, summary);
    settleGalatticaDue(planet, nowTs);
  }

  // Assenza con Invictus in costruzione: produzione accreditata fino a ogni scadenza.
  function settleInvictusOffline(planet, universe, fromTs, toTs, summary) {
    const bacino = planet.bacinoSpaziale;
    const def = getData().INVICTUS;
    const prod = getPlanetProduction(planet, universe);
    const addFor = (from, to) => {
      const sec = Math.max(0, (to - from) / 1000);
      if (sec > 0) addResourcesWithCap(planet, prod.metalPerSec * sec, prod.crystalPerSec * sec, prod.deuteriumPerSec * sec, prod.caps);
    };
    const crepDef = getData().CREPUSCOLO;
    let cursor = fromTs;
    for (const c of bacino.invictusConstructions) if (!c.nextPaymentAt) c.nextPaymentAt = fromTs + def.dayMs;
    if (bacino.crepuscolo && bacino.crepuscolo.status !== 'active' && !bacino.crepuscolo.nextPaymentAt) {
      bacino.crepuscolo.nextPaymentAt = fromTs + crepDef.dayMs;
    }
    if (bacino.galatticaConstruction && bacino.galatticaConstruction.status !== 'done' && !bacino.galatticaConstruction.nextPaymentAt) {
      bacino.galatticaConstruction.nextPaymentAt = fromTs + getData().GALATTICA.dayMs;
    }
    for (;;) {
      const items = [];
      for (const c of bacino.invictusConstructions) if (c.status === 'building') items.push({ p: c, kind: 'invictus' });
      const cp = bacino.crepuscolo;
      if (cp && (cp.status === 'building' || cp.status === 'repairing')) items.push({ p: cp, kind: 'crepuscolo' });
      const gc = bacino.galatticaConstruction;
      if (gc && gc.status === 'building') items.push({ p: gc, kind: 'galattica' });
      if (items.length === 0) break;
      const nextDue = Math.min(...items.map((it) => it.p.nextPaymentAt));
      if (nextDue > toTs) break;
      if (nextDue > cursor) { addFor(cursor, nextDue); cursor = nextDue; }
      for (const it of items) {
        if (it.p.nextPaymentAt > cursor) continue;
        if (it.kind === 'invictus') {
          if (!canPayDaily(planet, def.dailyCost)) { it.p.status = 'stopped'; continue; }
          payInvictusDay(planet, it.p);
          if (it.p.status !== 'done') it.p.nextPaymentAt += def.dayMs;
        } else if (it.kind === 'crepuscolo') {
          if (!canPayDaily(planet, crepDef.dailyCost)) { it.p.status = 'stopped'; continue; }
          payCrepuscoloDay(planet, summary);
          if (it.p.status !== 'active') it.p.nextPaymentAt += crepDef.dayMs;
        } else {
          const galDef = getData().GALATTICA;
          if (!canPayDaily(planet, galDef.dailyCost)) { it.p.status = 'stopped'; continue; }
          payGalatticaDay(planet);
          if (it.p.status !== 'done') it.p.nextPaymentAt += galDef.dayMs;
        }
      }
    }
    addFor(cursor, toTs);
    for (const c of bacino.invictusConstructions) {
      if (c.status === 'stopped' && c.nextPaymentAt <= toTs && canPayDaily(planet, def.dailyCost)) {
        payInvictusDay(planet, c);
        if (c.status !== 'done') c.nextPaymentAt = toTs + def.dayMs;
      }
    }
    const cpStopped = bacino.crepuscolo;
    if (cpStopped && cpStopped.status === 'stopped' && cpStopped.nextPaymentAt <= toTs && canPayDaily(planet, crepDef.dailyCost)) {
      payCrepuscoloDay(planet, summary);
      if (cpStopped.status !== 'active') cpStopped.nextPaymentAt = toTs + crepDef.dayMs;
    }
    const gcStopped = bacino.galatticaConstruction;
    if (gcStopped && gcStopped.status === 'stopped' && gcStopped.nextPaymentAt <= toTs && canPayDaily(planet, getData().GALATTICA.dailyCost)) {
      payGalatticaDay(planet);
      if (gcStopped.status !== 'done') gcStopped.nextPaymentAt = toTs + getData().GALATTICA.dayMs;
    }
    collectDoneInvictus(planet, summary);
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
        const prod = getPlanetProduction(planet, universe);
        addResourcesWithCap(
          planet,
          prod.metalPerSec * deltaSec,
          prod.crystalPerSec * deltaSec,
          prod.deuteriumPerSec * deltaSec,
          prod.caps
        );
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
      const prod = getPlanetProduction(planet, universe);
      addResourcesWithCap(
        planet,
        prod.metalPerSec * deltaSec,
        prod.crystalPerSec * deltaSec,
        prod.deuteriumPerSec * deltaSec,
        prod.caps
      );
      settleBacinoDue(planet, now, null);
    }
    addGalatticaProduction(universe, deltaSec);
    transformCompletedGalattiche(universe, null);

    advanceQueuesAtTimestamp(universe, now, null);
    checkCrepuscoloLimbo(universe, now);
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
    getBacinoMissingForDay,
    getInvictusMissingForDay,
    getCrepuscoloMissingForDay,
    getGalatticaMissingForDay,
    getGalatticaStructureCost,
    getGalatticaProduction,
    transformCompletedGalattiche,
    checkCrepuscoloLimbo,
    processOfflineProgress,
    tick
  };
})();
