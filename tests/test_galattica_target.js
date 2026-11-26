/* Percorso reale del resolver con un archivio Firestore in memoria. */
const assert = require('node:assert/strict');
global.window = {};
require('../modules/online/context.js');
require('../modules/online/foundation.js');
require('../modules/online/galattiche.js');
require('../modules/online/combat-resolver.js');
const G = window.__UniversumMPModules;
async function scenario(change, expectCombat) {
  const docs = new Map();
  let nextId = 0;
  let battles = 0;
  function col(name) {
    return { doc(id = String(++nextId)) {
      return { id, path: name + '/' + id, collection: col };
    }};
  }
  function snap(ref) {
    const data = docs.get(ref.path);
    return { ref, id: ref.id, exists: !!data, data: () => structuredClone(data) };
  }
  const target = col('galatticheMap').doc('B~2');
  const other = col('galatticheMap').doc('C~1');
  const fleetRef = col('fleets').doc('mission');
  const coords = { g: 1, s: 2, p: 3 };
  const state = { coords, resources: {}, defenses: {} };
  docs.set(other.path, { ownerUid: 'C', state });
  docs.set(target.path, { ownerUid: 'B', coordKey:'1_2_3',defenses:{} });
  change(docs, target);
  docs.set(fleetRef.path, { attackerUid: 'A', defenderUid: 'B', mission: 'destroyMoon',
    originCoords: {g:1,s:1,p:1}, targetCoords: coords, targetKey:'1_2_3',
    targetGalatticaId:target.id, arrivalTime:Date.now()-500, returnTime:Date.now()+30000,
    cargo:{metal:3,crystal:4,deuterium:7}, ships:{deathStar:1}, status:'outbound' });
  const updates = [];
  const reads = [];
  Object.assign(G, {
    getAuth: () => ({ currentUser: { uid:'A' } }),
    getDB: () => ({ collection:col, async runTransaction(fn) {
      const tx = {
        get: async ref => { reads.push(ref.path); return snap(ref); },
        update: (ref, data) => updates.push([ref,data]),
        set: (ref,data) => updates.push([ref,data])
      };
      await fn(tx);
      for (const [ref,data] of updates) docs.set(ref.path,{...docs.get(ref.path),...data});
    }}),
    getLiveFleetDocs: () => [snap(fleetRef)],
    processEmbargoFleets: async () => {},
    _mpNotifyError: (_,err) => { throw err; },
    _snapshotForDiff: () => null
  });
  window.UniversumGalaxy = {resolveCombat() {
    battles++;
    return {result:'draw',attackerSurvivors:{deathStar:1}};
  }};
  await G.resolveArrivedOnlineFleets('universo',10);
  const result = docs.get(fleetRef.path);
  assert.equal(result.status,'returning');
  assert.deepEqual(result.cargo,{metal:3,crystal:4,deuterium:7});
  assert.equal(battles,expectCombat ? 1 : 0);
  assert(!reads.includes(other.path));
  if (!expectCombat) assert(!reads.some(p=>p.startsWith('planets/')));
  assert(!updates.some(([ref])=>ref.path.startsWith('planets/')));
  assert(!updates.some(([ref])=>ref.path===other.path));
  await G.resolveArrivedOnlineFleets('universo',10);
  assert.equal(battles,expectCombat ? 1 : 0);
}
(async () => {
  await scenario(()=>{},true);
  await scenario((d,t)=>d.delete(t.path),false);
  await scenario((d,t)=>{d.get(t.path).coordKey='1_2_4';},false);
  await scenario((d,t)=>{d.get(t.path).ownerUid='C';},false);
  await scenario((d,t)=>{d.get(t.path).destroyed=true;},false);
  console.log('Cinque scenari PvP verificati, inclusi secondo tick, rientro e carico senza rimborso.');
})().catch(e=>{console.error(e);process.exitCode=1;});
