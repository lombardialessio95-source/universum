'use strict';
const assert = require('node:assert/strict');
const {settleDefenseQueue} = require('../services/suprema/engine');
const hour = 3600000;
const planet = {defenses:{},defenseQueue:[
  {id:'rocketLauncher',remaining:2,unitDurationSec:1800,nextUnitEndTime:14*hour},
  {id:'lightLaser',remaining:1,unitDurationSec:1800,nextUnitEndTime:15*hour}
]};
assert.equal(settleDefenseQueue(planet,14*hour-1),false);
assert.equal(settleDefenseQueue(planet,14*hour),true);
assert.deepEqual(planet.defenses,{rocketLauncher:1});
assert.equal(planet.defenseQueue[0].nextUnitEndTime,14.5*hour);
assert.equal(settleDefenseQueue(planet,14*hour),false);
planet.defenses.rocketLauncher = 0; // Lost in the first battle.
assert.equal(settleDefenseQueue(planet,15*hour),true);
assert.deepEqual(planet.defenses,{rocketLauncher:1,lightLaser:1});
assert.deepEqual(planet.defenseQueue,[]);
assert.equal(settleDefenseQueue(planet,16*hour),false);
const invalid = {defenses:{},defenseQueue:[{id:'rocketLauncher',remaining:-1}]};
assert.throws(()=>settleDefenseQueue(invalid,14*hour),/riconciliare/);
console.log('Due ondate, difesa al confine, completamento interposto, perdita e replay verificati.');
