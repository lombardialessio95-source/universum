/** UNIVERSUM / modules/engine/production.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumEngineModules;
  const { CREATIVE_ENERGY_CAP, CREATIVE_RESOURCE_CAP } = window.__UniversumEngineConstants;
  const getData = (...args) => G.getData(...args);
  const getEffectiveSpeed = (...args) => G.getEffectiveSpeed(...args);
  const normalizePlanet = (...args) => G.normalizePlanet(...args);


  // =========================================================
  // PRODUZIONE RISORSE, FUSIONE ALIMENTATA E DEPOSITI
  // =========================================================
  function getMineEfficiency(produced, needed) {
    return needed <= 0 ? 1 : Math.min(1, Math.max(0.03, produced / needed));
  }

  // Trova il MASSIMO regime autosostenibile a serbatoio vuoto. Il sintetizzatore
  // dipende dall'energia della fusione, quindi la soluzione si cerca sui tratti
  // lineari della curva (minimo 3%, proporzionale, massimo 100%), senza iterare
  // nel tick e senza rimbalzare tra accensione/spegnimento.
  function getFuelSupportedFusionFraction(energyOther, fusionFull, energyNeed, deutGross, upkeep, storedDeut) {
    if (fusionFull <= 0 || upkeep <= 0) return fusionFull > 0 ? 1 : 0;
    if (storedDeut > 0) return 1; // Il periodo viene diviso all'istante di esaurimento.
    const surplus = (fraction) => deutGross * getMineEfficiency(energyOther + fusionFull * fraction, energyNeed) - upkeep * fraction;
    const feasible = (f) => Math.floor(deutGross * getMineEfficiency(
      energyOther + Math.floor(fusionFull * f), energyNeed)) + 1e-9 >= upkeep * f;
    if (feasible(1)) return 1;
    const cuts = [0, 1];
    if (energyNeed > 0) {
      for (const threshold of [0.03, 1]) {
        const f = (threshold * energyNeed - energyOther) / fusionFull;
        if (f > 0 && f < 1) cuts.push(f);
      }
    }
    cuts.sort((a, b) => a - b);
    for (let i = cuts.length - 2; i >= 0; i--) {
      const lo = cuts[i], hi = cuts[i + 1];
      const sl = surplus(lo), sh = surplus(hi);
      let candidate = -1;
      if (sh >= -1e-8) candidate = hi;
      else if (sl >= -1e-8) candidate = lo + (hi - lo) * sl / (sl - sh);
      if (candidate >= 0) {
        let f = Math.max(0, Math.min(1, candidate));
        // Arrotondamenti discreti di energia/miniera possono costare 1-2 D/h.
        // Mai attribuire energia per combustibile che il sintetizzatore non produce.
        if (feasible(f)) return f;
        for (let attempt = 0; attempt < 6; attempt++) {
          const mine = Math.floor(deutGross * getMineEfficiency(
            energyOther + Math.floor(fusionFull * f), energyNeed));
          f = Math.min(f, mine / upkeep);
          if (feasible(f)) return f;
        }
        // Fallback raro: limite inferiore certamente alimentabile, nessun ciclo
        // nel tempo del gioco; massimo 24 operazioni aritmetiche sullo snapshot.
        let bottom = 0, top = f;
        for (let k = 0; k < 24; k++) {
          const mid = (bottom + top) / 2;
          if (feasible(mid)) bottom = mid;
          else top = mid;
        }
        return bottom;
      }
    }
    return 0;
  }

  function getFusionStats(energyOther, fusionFull, energyNeed, deutGross, upkeep, storedDeut) {
    const fraction = getFuelSupportedFusionFraction(energyOther, fusionFull, energyNeed, deutGross, upkeep, storedDeut);
    const fusionEnergy = Math.floor(fusionFull * fraction);
    const energyProduced = energyOther + fusionEnergy;
    const efficiency = getMineEfficiency(energyProduced, energyNeed);
    // Sempre lo stesso fattore di funzionamento per energia e combustibile.
    const fuelPerHour = upkeep * fraction;
    return { fraction, fusionEnergy, energyProduced, efficiency, fuelPerHour };
  }

  function getPlanetProduction(planet, universe) {
    normalizePlanet(planet);
    const Data = getData();
    if (universe.creativeMode) {
      return {
        metalPerHour: 9999999, crystalPerHour: 9999999, deuteriumPerHour: 9999999,
        metalPerSec: 2777, crystalPerSec: 2777, deuteriumPerSec: 2777,
        energyProduced: CREATIVE_ENERGY_CAP, energyConsumed: 0,
        energyBalance: CREATIVE_ENERGY_CAP, efficiency: 1,
        fusionFraction: 1, fusionEnergy: 0, fusionFuelPerHour: 0,
        caps: { metal: CREATIVE_RESOURCE_CAP, crystal: CREATIVE_RESOURCE_CAP, deuterium: CREATIVE_RESOURCE_CAP }
      };
    }
    const effectiveSpeed = getEffectiveSpeed(universe);
    const maxTemp = Number(planet.maxTemp ?? 30);
    const b = planet.buildings;
    const plasmaLv = Number(universe.researches?.plasmaTech || 0);
    const energyLv = Number(universe.researches?.energyTech || 0);
    const fusionLv = Math.max(0, Number(b.fusionReactor) || 0);

    const solarEnergy = Data.getBuildingEnergyDelta('solarPlant', b.solarPlant || 0, maxTemp);
    const fusionFull = Data.getBuildingEnergyDelta('fusionReactor', fusionLv, maxTemp, energyLv);
    const satCount = Number(planet.fleet?.solarSatellite || 0);
    const satEnergy = satCount * Math.max(10, Math.floor((maxTemp + 140) / 6));
    const energyOther = solarEnergy + satEnergy;
    const metalEnergyNeed = Math.abs(Data.getBuildingEnergyDelta('metalMine', b.metalMine || 0, maxTemp));
    const crystalEnergyNeed = Math.abs(Data.getBuildingEnergyDelta('crystalMine', b.crystalMine || 0, maxTemp));
    const deutEnergyNeed = Math.abs(Data.getBuildingEnergyDelta('deuteriumSynth', b.deuteriumSynth || 0, maxTemp));
    const energyConsumed = metalEnergyNeed + crystalEnergyNeed + deutEnergyNeed;

    const baseMetal = 30 * effectiveSpeed;
    const baseCrystal = 15 * effectiveSpeed;
    const deutGross = Data.getBaseHourlyProduction('deuteriumSynth', b.deuteriumSynth || 0, maxTemp) *
      (1 + plasmaLv * 0.0033) * effectiveSpeed;
    // Formula nominale del consumo INVARIATA; la disponibilita' modifica solo la frazione attiva.
    const nominalUpkeep = fusionLv > 0 ? Math.ceil(10 * fusionLv * Math.pow(1.1, fusionLv) * effectiveSpeed) : 0;
    const fusion = getFusionStats(energyOther, fusionFull, energyConsumed, deutGross, nominalUpkeep,
      Math.max(0, Number(planet.resources?.deuterium) || 0));
    const { energyProduced, efficiency } = fusion;

    const mineMetal = Data.getBaseHourlyProduction('metalMine', b.metalMine || 0, maxTemp) *
      (1 + plasmaLv * 0.01) * efficiency * effectiveSpeed;
    const mineCrystal = Data.getBaseHourlyProduction('crystalMine', b.crystalMine || 0, maxTemp) *
      (1 + plasmaLv * 0.0066) * efficiency * effectiveSpeed;
    const mineDeut = Math.floor(deutGross * efficiency);
    // Zero deuterio immagazzinato: la soluzione autosostenibile non deve mai
    // risultare in un consumo negativo dovuto agli arrotondamenti del display.
    const available = Math.max(0, Number(planet.resources?.deuterium) || 0);
    const netDeut = available > 0 ? mineDeut - fusion.fuelPerHour : Math.max(0, mineDeut - fusion.fuelPerHour);
    const metalPerHour = Math.floor(baseMetal + mineMetal);
    const crystalPerHour = Math.floor(baseCrystal + mineCrystal);
    const deuteriumPerHour = Math.floor(netDeut + 1e-7);
    const caps = {
      metal: Data.getStorageCapacity(b.metalStorage || 0),
      crystal: Data.getStorageCapacity(b.crystalStorage || 0),
      deuterium: Data.getStorageCapacity(b.deuteriumTank || 0)
    };
    return {
      metalPerHour, crystalPerHour, deuteriumPerHour,
      metalPerSec: metalPerHour / 3600, crystalPerSec: crystalPerHour / 3600, deuteriumPerSec: deuteriumPerHour / 3600,
      energyProduced, energyConsumed, energyBalance: energyProduced - energyConsumed,
      efficiency, fusionFraction: fusion.fraction, fusionEnergy: fusion.fusionEnergy,
      fusionFuelPerHour: fusion.fuelPerHour, caps
    };
  }

  Object.assign(G, { getPlanetProduction, getMineEfficiency, getFusionStats });

})();
