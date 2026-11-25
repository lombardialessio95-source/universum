'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load exactly the gameplay modules executed in the browser. The callable
// supplies its own snapshots; no SDK state or user payload reaches the VM.
const root = path.resolve(__dirname,'../..');
const files = [
  'modules/data/buildings.js','modules/data/megastructures.js','modules/data/researches.js',
  'modules/data/ships.js','modules/data/defenses.js','data.js',
  'modules/engine/suprema.js','modules/galaxy/context.js','modules/galaxy/generation.js',
  'modules/galaxy/megastructures.js','modules/galaxy/combat.js',
  'modules/galaxy/fleet-dispatch.js','modules/galaxy/suprema-siege.js'
];
const window = {};
const context = vm.createContext({window});
for (const filename of files) {
  const code = fs.readFileSync(path.join(root,filename),'utf8');
  vm.runInContext(code,context,{filename,timeout:1000});
}
// Mantiene tutti gli export dell'assedio staging; i servizi Opzione C
// usano direttamente gli STESSI risolutori di combattimento e volo del gioco.
module.exports = Object.freeze({
  ...window.UniversumSupremaSieges,
  core: window.UniversumSuprema,
  resolveCombat: window.__UniversumGalaxyModules.resolveCombat,
  calculateDistance: window.__UniversumGalaxyModules.calculateDistance,
  getFleetSpeedAndFuel: window.__UniversumGalaxyModules.getFleetSpeedAndFuel,
  data: window.UniversumData
});
