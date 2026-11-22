/** UNIVERSUM / modules/engine/production.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumEngineModules;
  const { CREATIVE_ENERGY_CAP, CREATIVE_RESOURCE_CAP } = window.__UniversumEngineConstants;
  const getData = (...args) => G.getData(...args);
  const getEffectiveSpeed = (...args) => G.getEffectiveSpeed(...args);
  const normalizePlanet = (...args) => G.normalizePlanet(...args);


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
  Object.assign(G, { getPlanetProduction });

})();
