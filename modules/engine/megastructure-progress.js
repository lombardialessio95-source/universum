/** UNIVERSUM / modules/engine/megastructure-progress.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumEngineModules;
  const addResourcesWithCap = (...args) => G.addResourcesWithCap(...args);
  const canPayDaily = (...args) => G.canPayDaily(...args);
  const getData = (...args) => G.getData(...args);
  const getEffectiveSpeed = (...args) => G.getEffectiveSpeed(...args);
  const advancePlanetResources = (...args) => G.advancePlanetResources(...args);
  const normalizePlanet = (...args) => G.normalizePlanet(...args);


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
    const fusionLv = Math.max(0, Number(s.reattoreFusione) || 0);
    const fusionFull = Data.getBuildingEnergyDelta('fusionReactor', fusionLv, 30, energyLv);
    const energyConsumed =
      Math.abs(Data.getBuildingEnergyDelta('metalMine', s.generatoreMetallo || 0, 30)) +
      Math.abs(Data.getBuildingEnergyDelta('crystalMine', s.generatoreCristallo || 0, 30)) +
      Math.abs(Data.getBuildingEnergyDelta('deuteriumSynth', s.sintetizzatoreDeuterio || 0, 30));
    const deutGross = Data.getBaseHourlyProduction('deuteriumSynth', s.sintetizzatoreDeuterio || 0, 30) *
      (1 + plasmaLv * 0.0033) * speed;
    const fusionUpkeep = fusionLv > 0 ? Math.ceil(10 * fusionLv * Math.pow(1.1, fusionLv) * speed) : 0;
    const fusion = G.getFusionStats(0, fusionFull, energyConsumed, deutGross, fusionUpkeep,
      Math.max(0, Number(galattica.resources.deuterium) || 0));
    const { energyProduced, efficiency } = fusion;
    const energyBalance = energyProduced - energyConsumed;
    const metalPerHour = Math.floor(Data.getBaseHourlyProduction('metalMine', s.generatoreMetallo || 0, 30) * (1 + plasmaLv * 0.01) * efficiency * speed);
    const crystalPerHour = Math.floor(Data.getBaseHourlyProduction('crystalMine', s.generatoreCristallo || 0, 30) * (1 + plasmaLv * 0.0066) * efficiency * speed);
    const deutNet = Math.floor(deutGross * efficiency) - fusion.fuelPerHour;
    const deuteriumPerHour = Math.floor((galattica.resources.deuterium > 0 ? deutNet : Math.max(0, deutNet)) + 1e-7);
    return {
      metalPerHour, crystalPerHour, deuteriumPerHour,
      metalPerSec: metalPerHour / 3600, crystalPerSec: crystalPerHour / 3600, deuteriumPerSec: deuteriumPerHour / 3600,
      energyProduced, energyConsumed, energyBalance, efficiency,
      fusionFraction: fusion.fraction, fusionEnergy: fusion.fusionEnergy, fusionFuelPerHour: fusion.fuelPerHour
    };
  }


  function addGalatticaProduction(universe, deltaSec) {
    if (!(deltaSec > 0)) return;
    for (const galattica of universe.galattiche || []) {
      const before = getGalatticaProduction(galattica, universe);
      const fuel = Math.max(0, Number(galattica.resources.deuterium) || 0);
      const depletionSec = before.fusionFuelPerHour > 0 && before.deuteriumPerHour < 0 && fuel > 0
        ? fuel * 3600 / -before.deuteriumPerHour : Infinity;
      const firstSec = Math.min(deltaSec, depletionSec);
      const add = (prod, sec) => {
        galattica.resources.metal = Math.max(0, galattica.resources.metal + prod.metalPerSec * sec);
        galattica.resources.crystal = Math.max(0, galattica.resources.crystal + prod.crystalPerSec * sec);
        galattica.resources.deuterium = Math.max(0, galattica.resources.deuterium + prod.deuteriumPerSec * sec);
      };
      add(before, firstSec);
      if (depletionSec <= deltaSec) {
        galattica.resources.deuterium = 0;
        add(getGalatticaProduction(galattica, universe), deltaSec - firstSec);
      }
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
    const addFor = (from, to) => advancePlanetResources(planet, universe, Math.max(0, (to - from) / 1000));
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
  Object.assign(G, { payInvictusDay, payCrepuscoloDay, payGalatticaDay, settleGalatticaDue, transformCompletedGalattiche, normalizeGalattica, getGalatticaProduction, addGalatticaProduction, settleCrepuscoloDue, checkCrepuscoloLimbo, collectDoneInvictus, settleInvictusDue, settleInvictusOffline });

})();
