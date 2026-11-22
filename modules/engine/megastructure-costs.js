/** UNIVERSUM / modules/engine/megastructure-costs.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumEngineModules;
  const addResourcesWithCap = (...args) => G.addResourcesWithCap(...args);
  const getData = (...args) => G.getData(...args);
  const getPlanetProduction = (...args) => G.getPlanetProduction(...args);
  const normalizePlanet = (...args) => G.normalizePlanet(...args);
  const settleInvictusDue = (...args) => G.settleInvictusDue(...args);
  const tick = (...args) => G.tick(...args);


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
  Object.assign(G, { getProjectMissingForDay, getBacinoMissingForDay, getInvictusMissingForDay, getCrepuscoloMissingForDay, getGalatticaMissingForDay, getGalatticaStructureCost, canPayDaily, canPayBacinoDay, payBacinoDay, settleBacinoDue, settleBacinoOffline });

})();
