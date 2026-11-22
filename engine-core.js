/** UNIVERSUM / API motore: la logica risiede in modules/engine. */
(function () {
 'use strict';
 const G = window.__UniversumEngineModules;
 window.UniversumEngine = {
  _internal: {getData:G.getData, normalizePlanet:G.normalizePlanet},
  getEffectiveSpeed:G.getEffectiveSpeed,
  getBuildingBuildTime:G.getBuildingBuildTime,
  getResearchTime:G.getResearchTime,
  getSingleUnitTime:G.getSingleUnitTime,
  getUnitCostAdjusted:G.getUnitCostAdjusted,
  getPlanetProduction:G.getPlanetProduction,
  getBacinoMissingForDay:G.getBacinoMissingForDay,
  getInvictusMissingForDay:G.getInvictusMissingForDay,
  getCrepuscoloMissingForDay:G.getCrepuscoloMissingForDay,
  getGalatticaMissingForDay:G.getGalatticaMissingForDay,
  getGalatticaStructureCost:G.getGalatticaStructureCost,
  getGalatticaProduction:G.getGalatticaProduction,
  transformCompletedGalattiche:G.transformCompletedGalattiche,
  checkCrepuscoloLimbo:G.checkCrepuscoloLimbo,
  processOfflineProgress:G.processOfflineProgress,
  tick:G.tick,
 };
})();
