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
  'modules/engine/context.js','modules/engine/foundation.js','modules/engine/research-model.js',
  'modules/engine/progress.js','modules/engine/suprema.js','modules/galaxy/context.js','modules/galaxy/generation.js',
  'modules/galaxy/megastructures.js','modules/galaxy/combat.js',
  'modules/galaxy/fleet-dispatch.js','modules/galaxy/suprema-siege.js'
];
const window = {};
const context = vm.createContext({window});
for (const filename of files) {
  const code = fs.readFileSync(path.join(root,filename),'utf8');
  vm.runInContext(code,context,{filename,timeout:1000});
}
// Resolve the paid defense queue using the same unit completion routine as the game.
// Only this queue is projected. Other queues and savings must keep their own checkpoints.
function settleDefenseQueue(planet, at) {
  const queue = planet.defenseQueue;
  if (!queue || (Array.isArray(queue) && queue.length === 0)) return false;
  if (!Array.isArray(queue) || !Number.isSafeInteger(at)) throw Error('Coda difese non valida.');
  for (const order of queue) {
    const step = order?.unitDurationSec * 1000;
    if (!order || !Object.hasOwn(window.UniversumData.DEFENSES,order.id) ||
        !Number.isSafeInteger(order.remaining) || order.remaining < 1 ||
        !Number.isSafeInteger(order.nextUnitEndTime) || order.nextUnitEndTime <= 0 ||
        !Number.isSafeInteger(step) || step <= 0 ||
        !Number.isSafeInteger(order.nextUnitEndTime + step * order.remaining)) {
      throw Error('Ordine difensivo da riconciliare.');
    }
  }
  if (queue[0].nextUnitEndTime > at) return false;
  const projection = {defenses:{...planet.defenses},defenseQueue:queue.map(order=>({...order}))};
  const universe = {researchModelVersion:1,planets:[projection]};
  window.__UniversumEngineModules.advanceQueuesAtTimestamp(universe,at);
  planet.defenses = projection.defenses;
  planet.defenseQueue = projection.defenseQueue;
  return true;
}

module.exports = {...window.UniversumSupremaSieges,settleDefenseQueue};
