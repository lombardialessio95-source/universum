// Test della logica Fase 5 con un Firestore finto in memoria.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

// ---------- Firestore finto ----------
const store = new Map();
const versions = new Map();
const bump = (path) => versions.set(path, (versions.get(path) || 0) + 1);
const clone = (o) => JSON.parse(JSON.stringify(o));
const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v) && !v.__op;
const FV = { increment: (n) => ({ __op: 'inc', n }), delete: () => ({ __op: 'del' }), serverTimestamp: () => Date.now() };

function mergeDeep(target, src) {
  for (const [k, v] of Object.entries(src)) {
    if (v && v.__op === 'del') delete target[k];
    else if (v && v.__op === 'inc') target[k] = (Number(target[k]) || 0) + v.n;
    else if (isPlain(v)) {
      if (!isPlain(target[k])) target[k] = {};
      mergeDeep(target[k], v);
    } else target[k] = clone(v);
  }
}
function applyUpdate(doc, upd) {
  for (const [key, v] of Object.entries(upd)) {
    const parts = key.split('.');
    let cur = doc;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!isPlain(cur[parts[i]])) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    const last = parts[parts.length - 1];
    if (v && v.__op === 'del') delete cur[last];
    else if (v && v.__op === 'inc') cur[last] = (Number(cur[last]) || 0) + v.n;
    else cur[last] = clone(v);
  }
}
const getPath = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);

function docRef(path) {
  const id = path.split('/').pop();
  const ref = {
    path, id,
    async get() {
      const exists = store.has(path);
      return { exists, id, ref, data: () => (exists ? clone(store.get(path)) : undefined) };
    },
    async update(upd) { const d = store.get(path); if (!d) throw new Error('no doc'); applyUpdate(d, upd); bump(path); },
    collection: (n) => colRef(path + '/' + n)
  };
  return ref;
}
function colRef(path) {
  const filters = [];
  let lim = Infinity;
  const q = {
    doc: (id) => docRef(path + '/' + (id || ('auto_' + String(store.size).padStart(6,'0')))),
    add: async (data) => { const ref=docRef(path+'/auto_'+String(store.size).padStart(6,'0'));store.set(ref.path,clone(data));bump(ref.path);return ref; },
    where(f, op, v) { filters.push([f, op, v]); return q; },
    limit(n) { lim = n; return q; },
    async get() {
      const docs = [];
      for (const [p, d] of store.entries()) {
        if (!p.startsWith(path + '/') || p.slice(path.length + 1).includes('/')) continue;
        const ok = filters.every(([f, op, v]) => {
          const x = getPath(d, f);
          if (op === '==') return x === v;
          if (op === '!=') return x !== undefined && x !== v;
          return true;
        });
        if (ok) docs.push({ id: p.split('/').pop(), ref: docRef(p), exists: true, data: () => clone(d) });
        if (docs.length >= lim) break;
      }
      return { docs, empty: docs.length === 0 };
    }
  };
  return q;
}
const db = {
  collection: (n) => colRef(n),
  async runTransaction(fn) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const writes = [];
      const reads = new Map();
      let wrote = false;
      const tx = {
        get: async (ref) => {
          if (wrote) throw new Error('LETTURA DOPO SCRITTURA nella transazione');
          reads.set(ref.path, versions.get(ref.path) || 0);
          return ref.get();
        },
        set: (ref, data, opts) => { wrote = true; writes.push(() => {
          if (opts && opts.merge) { const d = store.get(ref.path) || {}; mergeDeep(d, data); store.set(ref.path, d); }
          else store.set(ref.path, clone(data));
          bump(ref.path);
        }); },
        update: (ref, upd) => { wrote = true; writes.push(() => {
          const d = store.get(ref.path); if (!d) throw new Error('update su documento mancante: ' + ref.path);
          applyUpdate(d, upd); bump(ref.path);
        }); }
      };
      await fn(tx);
      // Concorrenza ottimistica come Firestore: se un documento letto è cambiato, si ripete la transazione
      let conflict = false;
      for (const [path, v] of reads) if ((versions.get(path) || 0) !== v) conflict = true;
      if (conflict) continue;
      writes.forEach((w) => w());
      return;
    }
    throw new Error('Transazione abortita: troppi conflitti');
  }
};

// ---------- Carica il multiplayer modulare ----------
const path = require('path');
const base = path.resolve(__dirname, '..');
const modulesOnline = ['context.js', 'foundation.js', 'universes.js', 'sync.js', 'fleet-control.js', 'combat-resolver.js', 'sieges.js', 'communications.js', 'bots.js'];

const reconcileCalls = [];
const win = {
  fbAuth: { currentUser: { uid: 'u1', displayName: 'Alice' } },
  fbDB: db,
  UniversumUI: { onOnlineReconciled: (info) => reconcileCalls.push(info), state: {} }
};
const sandbox = { window: win, firebase: { firestore: { FieldValue: FV } }, console, Date, Math, JSON, Promise, Set, Map, Number, Object, Array, String, Boolean, setTimeout, clearTimeout };
vm.createContext(sandbox);
for (const file of modulesOnline) {
  vm.runInContext(fs.readFileSync(path.join(base, 'modules', 'online', file), 'utf8'), sandbox, {filename:file});
}
vm.runInContext(fs.readFileSync(path.join(base, 'multiplayer.js'), 'utf8'), sandbox, {filename:'multiplayer.js'});
win.__mp = Object.fromEntries(['_effectivePlanetView','_snapshotForDiff','_writePlanetResult','_inboxCredit','_resolveCreditRef','_applyUnitDelta','_hasInbox','calculateLiveResources']
  .map(name => [name, win.__UniversumMPModules[name]]));
const MP = win.UniversumMP;
const I = win.__mp;

const P = (g, s, p) => `online_universes/U/planets/${g}_${s}_${p}`;
let passed = 0;
function ok(name, fn) { return Promise.resolve().then(fn).then(() => { passed++; console.log('  ✓', name); }); }


const game = require('./helpers/game');
win.UniversumGalaxy=game.G;
win.UniversumData=game.D;
win.UniversumEngine=game.E;
win.UniversumServices=game.win.UniversumServices;
win.UniversumMissionsCore=game.win.UniversumMissionsCore;
win.__UniversumEngineModules=game.win.__UniversumEngineModules;
vm.runInContext(fs.readFileSync(path.join(base,'modules/galaxy/hangars.js'),'utf8'),sandbox,{filename:'hangars.js'});
const H=win.UniversumHangars;
const t='online_universes/F3';
function setup(){
 store.clear();versions.clear();
 const uni=game.uni(1);uni.id='F3';uni.serviceRevision=0;uni.emperor='Alice';uni.researches.computerTech=12;uni.researches.hyperspaceDrive=4;
 const p=uni.planets[0];p.ownerUid='u1';p.ownerName='Alice';p.lastUpdated=Date.now();p.fleet={mothership:2,lightFighter:100};
 H.normalizePlanet(p);
 store.set(t,{speed:1});store.set(t+'/players/u1',{serviceRevision:0,researches:uni.researches});
 store.set(t+'/planets/1_1_2',clone(p));
 const enemy=game.planet('ENEMY');enemy.coords={g:1,s:3,p:2};enemy.ownerUid='u2';enemy.ownerName='Bob';enemy.isNpc=false;
 enemy.fleet={};enemy.defenses={};enemy.resources={metal:100000,crystal:100000,deuterium:100000};enemy.lastUpdated=Date.now();
 store.set(t+'/planets/1_3_2',clone(enemy));store.set(t+'/players/u2',{serviceRevision:0,researches:{}});
 return {uni,p,enemy};
}
(async()=>{
 const {uni,p}=setup();const h=H.normalizePlanet(p),id=h[0].id;
 await ok('F3 online: i Caccia imbarcati restano nel punteggio imperiale',async()=>{
   const free={planets:[{fleet:{mothership:1,lightFighter:10},defenses:{},buildings:{}}],researches:{}};
   const loaded={planets:[{fleet:{mothership:1,lightFighter:0},mothershipHangars:[{id:'scored',fighters:10}],defenses:{},buildings:{}}],researches:{}};
   assert.strictEqual(win.__UniversumMPModules.computePlayerPoints(free),win.__UniversumMPModules.computePlayerPoints(loaded));
 });
 await ok('F3 online: caricamento transazionale con revisione e persistenza',async()=>{
   await MP.changeOnlineMothershipHangar(uni,0,id,50);
   assert.strictEqual(p.fleet.lightFighter,50);
   assert.strictEqual(p.mothershipHangars[0].fighters,50);
   assert.strictEqual(store.get(t+'/planets/1_1_2').mothershipHangars[0].fighters,50);
   assert.strictEqual(store.get(t+'/players/u1').serviceRevision,uni.serviceRevision);
 });
 await ok('F3 online: due sessioni concorrenti non caricano gli stessi caccia',async()=>{
   const other=clone(uni);
   const results=await Promise.allSettled([
     MP.changeOnlineMothershipHangar(uni,0,id,-20),
     MP.changeOnlineMothershipHangar(other,0,id,-20)
   ]);
   assert.strictEqual(results.filter(r=>r.status==='fulfilled').length,1);
   assert.strictEqual(results.filter(r=>r.status==='rejected').length,1);
   const saved=store.get(t+'/planets/1_1_2');
   assert.strictEqual(saved.fleet.lightFighter,70);
   assert.strictEqual(saved.mothershipHangars[0].fighters,30);
 });

 await ok('F3 online: blocco flotta mista e lancio atomico di una Nave Madre',async()=>{
   await MP.changeOnlineMothershipHangar(uni,0,id,20);
   const fuelBefore=p.resources.deuterium;
   const initial=store.get(t+'/planets/1_1_2');
   await assert.rejects(MP.launchOnlineFleet(uni,0,{g:1,s:3,p:2},'incursion',
     {mothership:1,lightFighter:1},{metal:0,crystal:0,deuterium:0},{carrierIds:[id]}),/solo Navi Madre/);
   assert.strictEqual(store.get(t+'/planets/1_1_2').fleet.mothership,2);
   const ref=await MP.launchOnlineFleet(uni,0,{g:1,s:3,p:2},'incursion',
     {mothership:1},{metal:0,crystal:0,deuterium:0},{carrierIds:[id]});
   const docs=[...store].filter(([key])=>key.startsWith(t+'/fleets/'));
   assert.strictEqual(docs.length,1);
   const flight=docs[0][1];
   assert.strictEqual(flight.mission,'incursion');
   assert.strictEqual(flight.carrierHangars.length,1);
   assert.strictEqual(flight.carrierHangars[0].id,id);
   assert.strictEqual(flight.carrierHangars[0].fighters,50);
   assert.strictEqual(store.get(t+'/planets/1_1_2').fleet.mothership,1);
   assert.strictEqual(store.get(t+'/planets/1_1_2').mothershipHangars.length,1);
   assert.strictEqual(p.fleet.mothership,1);
   assert(p.resources.deuterium<fuelBefore);
 });

 await ok('F3 online: arrivo atomico, bottino sottratto una sola volta e ritorno con hangar',async()=>{
   const path=[...store.keys()].find(key=>key.startsWith(t+'/fleets/'));
   const flight=store.get(path);const flightId=path.split('/').pop();
   const enemyBefore=clone(store.get(t+'/planets/1_3_2').resources);
   flight.arrivalTime=Date.now()-100;
   const oldLive=win.__UniversumMPModules.getLiveFleetDocs;
   const oldEmbargo=win.__UniversumMPModules.processEmbargoFleets;
   win.__UniversumMPModules.getLiveFleetDocs=()=>[{id:flightId,ref:docRef(path),data:()=>clone(store.get(path))}];
   win.__UniversumMPModules.processEmbargoFleets=async()=>{};
   try{
     await MP.resolveArrivedOnlineFleets('F3',1);
     const after=store.get(path);
     assert.strictEqual(after.status,'returning');
     assert.strictEqual(after.ships.mothership,1);
     assert.deepStrictEqual(after.carrierHangars.map(h=>h.id),[id]);
     assert.strictEqual(after.carrierHangars[0].fighters,50);
     const enemy=store.get(t+'/planets/1_3_2');
     const loot=Object.values(after.cargo).reduce((n,v)=>n+v,0);
     const removed=Object.values(enemy.inbox.resources).reduce((n,v)=>n-v,0);
     assert.strictEqual(loot,50000);
     assert.strictEqual(removed,50000);
     await MP.resolveArrivedOnlineFleets('F3',1);
     assert.strictEqual(Object.values(enemy.inbox.resources).reduce((n,v)=>n-v,0),50000);
     after.arrivalTime=Date.now()-100;after.returnTime=after.arrivalTime;
     await MP.resolveArrivedOnlineFleets('F3',1);
     assert.strictEqual(after.status,'completed');
     const home=store.get(t+'/planets/1_1_2');
     assert.strictEqual(home.inbox.fleet.mothership,1);
     assert.strictEqual(home.inbox.hangarReturns[flightId][0].id,id);
     assert.strictEqual(home.inbox.hangarReturns[flightId][0].fighters,50);
     const credited=clone(home.inbox);
     await MP.resolveArrivedOnlineFleets('F3',1);
     assert.deepStrictEqual(home.inbox,credited);
     await MP.syncPlayerState(uni,{force:true});
     assert.strictEqual(store.get(t+'/planets/1_1_2').fleet.mothership,2);
     assert.strictEqual(store.get(t+'/planets/1_1_2').mothershipHangars.length,2);
     assert.strictEqual(store.get(t+'/planets/1_1_2').mothershipHangars.find(h=>h.id===id).fighters,50);
     assert.strictEqual(store.get(t+'/planets/1_1_2').inbox,undefined);
     await MP.syncPlayerState(uni,{force:true});
     assert.strictEqual(store.get(t+'/planets/1_1_2').fleet.mothership,2);
   }finally{win.__UniversumMPModules.getLiveFleetDocs=oldLive;win.__UniversumMPModules.processEmbargoFleets=oldEmbargo;}
 });

 await ok('F3 online: perdita Nave Madre in difesa, hangar perso una volta nel checkpoint del difensore',async()=>{
   const sc=setup(),e=store.get(t+'/planets/1_3_2');
   e.fleet={mothership:1,lightFighter:0};e.mothershipHangars=[{id:'enemy_carrier',fighters:22}];
   const carrier=H.normalizePlanet(sc.p)[0].id;
   await MP.changeOnlineMothershipHangar(sc.uni,0,carrier,10);
   await MP.launchOnlineFleet(sc.uni,0,{g:1,s:3,p:2},'incursion',{mothership:1},{metal:0,crystal:0,deuterium:0},{carrierIds:[carrier]});
   const flightPath=[...store.keys()].find(x=>x.startsWith(t+'/fleets/'));
   const fleetId=flightPath.split('/').pop();store.get(flightPath).arrivalTime=Date.now()-100;
   const oldLive=win.__UniversumMPModules.getLiveFleetDocs,oldEmbargo=win.__UniversumMPModules.processEmbargoFleets;
   const oldCombat=win.UniversumGalaxy.resolveCombat;
   win.__UniversumMPModules.getLiveFleetDocs=()=>[{id:fleetId,ref:docRef(flightPath),data:()=>clone(store.get(flightPath))}];
   win.__UniversumMPModules.processEmbargoFleets=async()=>{};
   win.UniversumGalaxy.resolveCombat=(ships,tech,def,options)=>({
     result:'attacker_win',roundsPlayed:3,
     attackerTagsAlive:options.attackerTags,defenderTagsAlive:{mothership:[]},
     attackerSurvivors:ships,attackerLosses:{},defenderLosses:{mothership:1},
     defenderFleetSurvivors:{},repairedDefenses:def.defenses||{},debris:{metal:0,crystal:0}
   });
   try {
     await MP.resolveArrivedOnlineFleets('F3',1);
     assert.strictEqual(e.fleet.mothership,1,'il documento del proprietario non deve essere sovrascritto');
     assert.strictEqual(e.inbox.fleet.mothership,-1);
     assert.deepStrictEqual(e.inbox.hangarLosses[fleetId],['enemy_carrier']);
     const enemyUni={id:'F3',serviceRevision:0,speed:1,emperor:'Bob',researches:{},
       planets:[{...clone(e),fleet:{mothership:1,lightFighter:0},
         mothershipHangars:[{id:'enemy_carrier',fighters:22}],resources:{...e.resources},
         buildings:{},defenses:{},localResearches:{}}]};
     delete enemyUni.planets[0].inbox;
     win.fbAuth.currentUser={uid:'u2',displayName:'Bob'};
     await MP.syncPlayerState(enemyUni,{force:true});
     const after=store.get(t+'/planets/1_3_2');
     assert.strictEqual(after.fleet.mothership,0);
     assert.deepStrictEqual(after.mothershipHangars,[]);
     assert.strictEqual(after.fleet.lightFighter,0);
     assert.strictEqual(after.inbox,undefined);
     await MP.syncPlayerState(enemyUni,{force:true});
     assert.strictEqual(after.fleet.mothership,0);
   } finally {
     win.fbAuth.currentUser={uid:'u1',displayName:'Alice'};
     win.__UniversumMPModules.getLiveFleetDocs=oldLive;
     win.__UniversumMPModules.processEmbargoFleets=oldEmbargo;
     win.UniversumGalaxy.resolveCombat=oldCombat;
   }
 });

 await ok('F3 online: schieramento fra pianeti propri trasferisce hangar e caccia senza duplicarli',async()=>{
   const sc=setup(),first=sc.p,carrier=H.normalizePlanet(first)[0].id;
   const colony=game.planet('Colony');colony.coords={g:1,s:2,p:2};colony.ownerUid='u1';colony.ownerName='Alice';colony.lastUpdated=Date.now();
   colony.fleet={mothership:0,lightFighter:0};
   sc.uni.planets.push(colony);store.set(t+'/planets/1_2_2',clone(colony));
   await MP.changeOnlineMothershipHangar(sc.uni,0,carrier,20);
   await MP.launchOnlineFleet(sc.uni,0,colony.coords,'deploy',{mothership:1},{metal:0,crystal:0,deuterium:0},{carrierIds:[carrier]});
   const path=[...store.keys()].find(x=>x.startsWith(t+'/fleets/'));
   const flight=store.get(path),flightId=path.split('/').pop();flight.arrivalTime=Date.now()-100;
   const oldLive=win.__UniversumMPModules.getLiveFleetDocs,oldEmbargo=win.__UniversumMPModules.processEmbargoFleets;
   win.__UniversumMPModules.getLiveFleetDocs=()=>[{id:flightId,ref:docRef(path),data:()=>clone(store.get(path))}];
   win.__UniversumMPModules.processEmbargoFleets=async()=>{};
   try {
     await MP.resolveArrivedOnlineFleets('F3',1);
     assert.strictEqual(flight.status,'completed');
     const target=store.get(t+'/planets/1_2_2');
     assert.strictEqual(target.inbox.fleet.mothership,1);
     assert.strictEqual(target.inbox.hangarReturns[flightId][0].id,carrier);
     await MP.syncPlayerState(sc.uni,{force:true});
     assert.strictEqual(store.get(t+'/planets/1_2_2').fleet.mothership,1);
     assert.strictEqual(store.get(t+'/planets/1_2_2').mothershipHangars[0].fighters,20);
     assert.strictEqual(store.get(t+'/planets/1_1_2').fleet.mothership,1);
     assert.strictEqual(store.get(t+'/planets/1_1_2').mothershipHangars.length,1);
     assert.strictEqual(store.get(t+'/planets/1_2_2').inbox,undefined);
   }finally{win.__UniversumMPModules.getLiveFleetDocs=oldLive;win.__UniversumMPModules.processEmbargoFleets=oldEmbargo;}
 });
 console.log('FASE 3 online',passed,'test superati');
})().catch(e=>{console.error('F3 ONLINE FAIL',e.stack);process.exit(1)});
