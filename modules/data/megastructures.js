/** UNIVERSUM / modules/data/megastructures.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';


  // Bacino Spaziale: occupa lo slot orbitale al posto della Luna (mai insieme).
  // Tempi in giorni reali (non scalati dalla velocita' dell'universo).
  const BACINO_SPAZIALE = {
    id: 'bacino_spaziale',
    name: 'Bacino Spaziale',
    icon: '🛠️',
    description: 'Grande cantiere orbitale costruito al posto della Luna: 20 giorni reali, pagato a rate giornaliere.',
    totalDays: 20,
    dayMs: 86400000,
    totalCost: { metal: 5000000, crystal: 3000000, deuterium: 1000000 },
    dailyCost: { metal: 250000, crystal: 150000, deuterium: 50000 }
  };


  // Invictus: nave legata a un Bacino Spaziale (max 4 tra attive e in costruzione).
  const INVICTUS = {
    id: 'invictus',
    name: 'Invictus',
    maxPerBacino: 4,
    totalDays: 20,
    dayMs: 86400000,
    totalCost: { metal: 4000000, crystal: 2400000, deuterium: 1600000 },
    dailyCost: { metal: 200000, crystal: 120000, deuterium: 80000 },
    jumpDeuteriumPerShip: 5000,
    jumpSystemsStep: 3,
    moonChancePerLost: 0.15
  };


  // Crepuscolo degli Dei: nave unica d'impero, solo in un Bacino mai usato (vuoto).
  const CREPUSCOLO = {
    id: 'crepuscolo',
    name: 'Crepuscolo degli Dei',
    maxPerEmpire: 1,
    buildDays: 100,
    wreckRepairDays: 30,
    battleRepairDays: 10,
    dayMs: 86400000,
    totalCost: { metal: 50000000, crystal: 30000000, deuterium: 20000000 },
    dailyCost: { metal: 500000, crystal: 300000, deuterium: 200000 },
    wreckChance: 0.005,
    wreckMinDeathStars: 4,
    wreckExploreHours: 24
  };


  // Galattica: nave-pianeta errante che nasce nel Bacino e ne prende il posto (max 3 per impero).
  const GALATTICA = {
    id: 'galattica',
    name: 'Galattica',
    maxPerEmpire: 3,
    buildDays: 100,
    dayMs: 86400000,
    totalCost: { metal: 45000000, crystal: 27000000, deuterium: 18000000 },
    dailyCost: { metal: 450000, crystal: 270000, deuterium: 180000 },
    jumpDeuteriumPerSystemStep: 25000,
    jumpSystemsStep: 3,
    jumpGalaxyExtraDeuterium: 100000,
    defenseCostMultiplier: 2,
    requirements: {
      researches: { quantumPhysics: 10, jumpPropulsion: 8, mobilePlanetaryStructure: 5, stellarReactor: 7, spatialTerraforming: 5 }
    }
  };


  const GALATTICA_STRUCTURES = {
    cantiereSpaziale: { id: 'cantiereSpaziale', name: 'Cantiere Spaziale', icon: '🚀', baseCost: { metal: 2000, crystal: 1000, deuterium: 500 }, factor: 2.0 },
    generatoreMetallo: { id: 'generatoreMetallo', name: 'Generatore di Metallo', icon: '⛏️', baseCost: { metal: 300, crystal: 75, deuterium: 0 }, factor: 1.5 },
    generatoreCristallo: { id: 'generatoreCristallo', name: 'Generatore di Cristallo', icon: '💎', baseCost: { metal: 240, crystal: 120, deuterium: 0 }, factor: 1.6 },
    sintetizzatoreDeuterio: { id: 'sintetizzatoreDeuterio', name: 'Sintetizzatore di Deuterio', icon: '🧪', baseCost: { metal: 1125, crystal: 375, deuterium: 0 }, factor: 1.5 },
    reattoreFusione: { id: 'reattoreFusione', name: 'Reattore a Fusione', icon: '⚛️', baseCost: { metal: 4500, crystal: 1800, deuterium: 900 }, factor: 1.8 }
  };
  Object.assign(window.__UniversumCatalog || (window.__UniversumCatalog = {}), {BACINO_SPAZIALE, INVICTUS, CREPUSCOLO, GALATTICA, GALATTICA_STRUCTURES});
})();
