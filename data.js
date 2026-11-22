/** UNIVERSUM / data.js / API e formule — modulo estratto conservando la logica originale. */
(function () {
  'use strict';

  const {BUILDINGS, MOON_BUILDINGS, BACINO_SPAZIALE, INVICTUS, CREPUSCOLO, GALATTICA, GALATTICA_STRUCTURES, RESEARCHES, SHIPS, DEFENSES} = window.__UniversumCatalog;


  // =========================================================
  // FUNZIONI DI CALCOLO COSTI, PRODUZIONI E REQUISITI
  // =========================================================
  function getBuildingCost(buildingId, targetLevel, isMoon = false) {
    const def = isMoon ? MOON_BUILDINGS[buildingId] : BUILDINGS[buildingId];
    if (!def) return { metal: 0, crystal: 0, deuterium: 0 };
    const lv = Math.max(1, Number(targetLevel) || 1);
    const mult = Math.pow(def.factor, lv - 1);
    return {
      metal: Math.floor(def.baseCost.metal * mult),
      crystal: Math.floor(def.baseCost.crystal * mult),
      deuterium: Math.floor(def.baseCost.deuterium * mult)
    };
  }


  function getResearchCost(researchId, targetLevel) {
    const def = RESEARCHES[researchId];
    if (!def) return { metal: 0, crystal: 0, deuterium: 0 };
    const lv = Math.max(1, Number(targetLevel) || 1);
    const mult = Math.pow(def.factor, lv - 1);
    return {
      metal: Math.floor(def.baseCost.metal * mult),
      crystal: Math.floor(def.baseCost.crystal * mult),
      deuterium: Math.floor(def.baseCost.deuterium * mult)
    };
  }


  function getBuildingEnergyDelta(buildingId, level, maxTemp = 30) {
    const lv = Math.max(0, Number(level) || 0);
    if (lv === 0) return 0;
    switch (buildingId) {
      case 'metalMine':
        return -Math.ceil(10 * lv * Math.pow(1.1, lv));
      case 'crystalMine':
        return -Math.ceil(10 * lv * Math.pow(1.1, lv));
      case 'deuteriumSynth':
        return -Math.ceil(20 * lv * Math.pow(1.1, lv));
      case 'solarPlant':
        // Bonus lieve su pianeti caldi
        return Math.floor(20 * lv * Math.pow(1.1, lv) * (1 + maxTemp / 400));
      case 'fusionReactor':
        return Math.floor(30 * lv * Math.pow(1.05, lv));
      default:
        return 0;
    }
  }


  function getBaseHourlyProduction(buildingId, level, maxTemp = 30) {
    const lv = Math.max(0, Number(level) || 0);
    if (lv === 0) return 0;
    switch (buildingId) {
      case 'metalMine':
        return Math.floor(30 * lv * Math.pow(1.1, lv));
      case 'crystalMine':
        return Math.floor(20 * lv * Math.pow(1.1, lv));
      case 'deuteriumSynth': {
        // Pianeti freddi producono significativamente più deuterio
        const tempFactor = Math.max(0.2, 1.36 - 0.004 * maxTemp);
        return Math.floor(10 * lv * Math.pow(1.1, lv) * tempFactor);
      }
      default:
        return 0;
    }
  }


  function getStorageCapacity(level) {
    const lv = Math.max(0, Number(level) || 0);
    return Math.floor(5000 * Math.pow(2.5, Math.floor(lv / 2)) * Math.pow(1.5, lv % 2) + (lv === 0 ? 5000 : 10000 * lv));
  }


  function getMaxFields(planet) {
    const base = Number(planet.fieldsMax) || 200;
    const tf = Number(planet.buildings?.terraformer) || 0;
    return base + tf * 5;
  }


  function getUsedFields(planet) {
    if (!planet || !planet.buildings) return 0;
    let total = 0;
    for (const key of Object.keys(BUILDINGS)) {
      if (key === 'deuteriumSynth') {
        total += Number(planet.buildings.deuteriumSynth ?? planet.buildings.deuteriumSynthesizer ?? 0);
      } else {
        total += Number(planet.buildings[key] || 0);
      }
    }
    return total;
  }


  function getMoonMaxFields(moon) {
    if (!moon) return 0;
    const base = Number(moon.fieldsMax) || 1;
    const lunarBaseLv = Number(moon.buildings?.lunarBase) || 0;
    return base + lunarBaseLv * 3;
  }


  function getMoonUsedFields(moon) {
    if (!moon || !moon.buildings) return 0;
    let total = 0;
    for (const key of Object.keys(MOON_BUILDINGS)) {
      total += Number(moon.buildings[key] || 0);
    }
    return total;
  }


  function checkRequirements(requirements, planet, universe, isMoon = false) {
    if (!requirements) return { met: true, missing: [] };
    const missing = [];

    if (requirements.buildings) {
      for (const [bId, reqLv] of Object.entries(requirements.buildings)) {
        const cur = bId === 'deuteriumSynth'
          ? Number(planet.buildings?.deuteriumSynth ?? planet.buildings?.deuteriumSynthesizer ?? 0)
          : Number(planet.buildings?.[bId] || 0);
        if (cur < reqLv) {
          const name = BUILDINGS[bId]?.name || bId;
          missing.push(`${name} Lv.${reqLv}`);
        }
      }
    }

    if (requirements.moonBuildings && isMoon && planet.moon) {
      for (const [mbId, reqLv] of Object.entries(requirements.moonBuildings)) {
        const cur = Number(planet.moon.buildings?.[mbId] || 0);
        if (cur < reqLv) {
          const name = MOON_BUILDINGS[mbId]?.name || mbId;
          missing.push(`${name} Lv.${reqLv}`);
        }
      }
    }

    if (requirements.researches) {
      for (const [rId, reqLv] of Object.entries(requirements.researches)) {
        const cur = Number(universe.researches?.[rId] || 0);
        if (cur < reqLv) {
          const name = RESEARCHES[rId]?.name || rId;
          missing.push(`${name} Lv.${reqLv}`);
        }
      }
    }

    return { met: missing.length === 0, missing };
  }


  window.UniversumData = {
    BUILDINGS,
    MOON_BUILDINGS,
    BACINO_SPAZIALE,
    INVICTUS,
    CREPUSCOLO,
    GALATTICA,
    GALATTICA_STRUCTURES,
    RESEARCHES,
    SHIPS,
    DEFENSES,
    getBuildingCost,
    getResearchCost,
    getBuildingEnergyDelta,
    getBaseHourlyProduction,
    getStorageCapacity,
    getMaxFields,
    getUsedFields,
    getMoonMaxFields,
    getMoonUsedFields,
    checkRequirements
  };
})();
