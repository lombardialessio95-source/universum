'use strict';
const assert = require('node:assert/strict');
const {enqueue,changeFrequency,scheduleNextWave,catchUp} = require('../modules/online/siege-recovery');
const hour = 3600000;
const clone = structuredClone;
function ref(id) {
  return {id,collection:name=>({doc:key=>ref(id+'/'+name+'/'+key)})};
}
const siegeRef=ref('siege-1'), planet=ref('target');
const records=new Map([[siegeRef.id,{attackerUid:'a',defenderUid:'b',revision:0,pending:[],waveHours:3}],[planet.id,{deliveries:0,waves:0}]]);
let version=0;
const db={async runTransaction(fn) {
  // Optimistic retries reproduce two readers sharing an old snapshot.
  for (;;) {
    const expected=version;
    const previous=clone(records);
    const writes=new Map();
    const output=await fn({
      async get(r) {return {exists:previous.has(r.id),data:()=>previous.get(r.id)};},
      update(r,patch) {writes.set(r.id,{...previous.get(r.id),...patch});},
      set(r,value) {writes.set(r.id,value);}
    });
    if (expected!==version) continue;
    for (const [key,value] of writes) records.set(key,value);
    if (writes.size) version++;
    return output;
  }
}};
const s=records.get(siegeRef.id);
enqueue(s,{id:'wave-1',kind:'wave',at:hour,sequence:1});
enqueue(s,{id:'arrival-1',kind:'arrival',at:hour});
assert.equal(enqueue(s,{id:'arrival-1',kind:'arrival',at:hour}),false);
changeFrequency(s,2);
assert.throws(()=>changeFrequency(s,0),/Frequenza/);
assert.equal(s.pending[1].at,hour);
const seenSeeds=[];
const options={db,siegeRef,now:3*hour,actor:'a',documents:()=>[planet],reduce({siege,event,values,seed}) {
  seenSeeds.push(seed);
  const current=values[0];
  if (event.kind==='wave') {
    assert.equal(current.deliveries,1);
    scheduleNextWave(siege,event);
    return {updates:[{waves:current.waves+1}]};
  }
  return {updates:[{deliveries:current.deliveries+1}]};
}};
(async ()=>{
  await assert.rejects(()=>catchUp({...options,actor:'c'}),/estraneo/);
  assert.deepEqual(await catchUp({...options,now:hour-1}),{applied:0,needsMore:false});
  await assert.rejects(()=>catchUp({...options,reduce(){throw Error('failed');}}),/failed/);
  assert.equal(records.get(siegeRef.id).revision,0);
  const results=await Promise.all([catchUp(options,1),catchUp({...options,actor:'b'},1)]);
  assert.equal(results[0].applied+results[1].applied,2);
  assert.deepEqual(records.get(planet.id),{deliveries:1,waves:1});
  assert.equal(records.get(siegeRef.id).pending[0].at,3*hour);
  assert.deepEqual(await catchUp(options),{applied:1,needsMore:false});
  assert.deepEqual(await catchUp(options),{applied:0,needsMore:false});
  assert.deepEqual(records.get(planet.id),{deliveries:1,waves:2});
  assert.equal(records.get(siegeRef.id).revision,3);
  assert.equal([...records.keys()].filter(k=>k.includes('/receipts/')).length,3);
  assert.equal(records.get(siegeRef.id).pending[0].at,5*hour);
  assert.throws(()=>enqueue(records.get(siegeRef.id),{kind:'wave',id:'old',at:hour}),/checkpoint/);
  assert(seenSeeds.filter(seed=>seed==='siege-1/arrival-1').length>=2,'simulate transaction replay');
  console.log('Suprema: arretrati, ordine, intervallo, due sessioni, rollback e ricevute verificati con mock transazionale.');
})().catch(err=>{console.error(err);process.exitCode=1;});
