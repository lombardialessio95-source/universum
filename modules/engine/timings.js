/** UNIVERSUM / modules/engine/timings.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumEngineModules;
  const getData = (...args) => G.getData(...args);


  function getEffectiveSpeed(universe, now = Date.now()) {
    const baseSpeed = Math.max(1, Number(universe.speed) || 1);
    const isTurbo = (universe.turboUntil || 0) > now;
    return isTurbo ? baseSpeed * 2 : baseSpeed;
  }


  // =========================================================
  // CALCOLO TEMPI PROGRESSIVI
  // =========================================================
  function getBuildingBuildTime(universe, planet, buildingId, targetLevel, isMoon = false, now = Date.now()) {
    if (universe.creativeMode) return 0;
    const Data = getData();
    const cost = Data.getBuildingCost(buildingId, targetLevel, isMoon);
    const effectiveSpeed = getEffectiveSpeed(universe, now);

    const roboticsLv = isMoon
      ? Number(planet.moon?.buildings?.lunarBase || 0)
      : Number(planet.buildings?.roboticsFactory || 0);
    const naniteLv = isMoon ? 0 : Number(planet.buildings?.naniteFactory || 0);

    const rawSeconds = ((cost.metal + cost.crystal) /
      (2500 * (1 + roboticsLv) * Math.pow(2, naniteLv) * effectiveSpeed)) * 3600;

    return Math.max(1, Math.floor(rawSeconds));
  }


  function getTotalLabLevel(universe, timestamp = Date.now()) {
    return G.getFreeLabTotal(universe, timestamp);
  }


  function getResearchTime(universe, researchId, targetLevel, planet = null, now = Date.now()) {
    if (universe.creativeMode) return 0;
    const Data = getData();
    const cost = Data.getResearchCost(researchId, targetLevel);
    const effectiveSpeed = getEffectiveSpeed(universe, now);
    const local = Data.RESEARCHES[researchId]?.scope === 'planetary';
    const source = typeof planet === 'number' ? universe.planets?.[planet] : planet;
    if (local && !source) return 0;
    const totalLabLv = local ? Math.max(0, Number(source.buildings?.researchLab) || 0) : getTotalLabLevel(universe, now);

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
  Object.assign(G, { getEffectiveSpeed, getBuildingBuildTime, getTotalLabLevel, getResearchTime, getSingleUnitTime, getUnitCostAdjusted });

})();
