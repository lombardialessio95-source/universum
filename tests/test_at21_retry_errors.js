'use strict';
// AT21-I01: errori di elaborazione e commit non devono chiudere una missione.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../modules/online/combat-resolver.js'),'utf8');
const copy=o=>JSON.parse(JSON.stringify(o));
const store=new Map(), prefix='online_universes/AT21';
const originPath=prefix+'/planets/1_1_7',targetPath=prefix+'/planets/1_2_8';
const fleetPath=id=>prefix+'/fleets/'+id;
const cargo={metal:153,crystal:71,deuterium:29};
let nextMessage=0,activeId,processingFails=false,commitFails=false,cleanupCalls=0,errors=[];
function doc(p){return {path:p,id:p.split('/').pop(),
  async get(){return {exists:store.has(p),data:()=>store.has(p)?copy(store.get(p)):undefined};},
  collection:name=>collection(p+'/'+name)};
}
function collection(p){return {doc:id=>doc(p+'/'+(id||'msg_'+(++nextMessage)))};}
function apply(doc,updates){for(const [key,value] of Object.entries(updates)){
  const parts=key.split('.');let cur=doc;
  for(const name of parts.slice(0,-1)){cur[name] ||= {};cur=cur[name];}
  const k=parts[parts.length-1];
  if(value&&typeof value==='object'&&Object.hasOwn(value,'__inc'))cur[k]=(Number(cur[k])||0)+value.__inc;
  else cur[k]=copy(value);
}}
const db={collection,async runTransaction(task){
  const writes=[];
  const tx={get:ref=>ref.get(),update:(ref,value)=>writes.push({op:'update',p:ref.path,value:copy(value)}),
    set:(ref,value)=>writes.push({op:'set',p:ref.path,value:copy(value)})};
  await task(tx);
  if(commitFails){commitFails=false;throw Error('AT21 commit temporaneamente fallito');}
  const staged=new Map([...store].map(([p,v])=>[p,copy(v)]));
  for(const w of writes){if(w.op==='set'){staged.set(w.p,w.value);continue;}
    if(!staged.has(w.p))throw Error('Documento assente: '+w.p);
    apply(staged.get(w.p),w.value);
  }
  store.clear();for(const [p,v] of staged)store.set(p,v);
}};
const G={
  getAuth:()=>({currentUser:{uid:'alice'}}),getDB:()=>db,
  coordsToKey:c=>[c.g,c.s,c.p].join('_'),
  getLiveFleetDocs:()=>activeId?[{id:activeId,ref:doc(fleetPath(activeId)),
    data:()=>copy(store.get(fleetPath(activeId)))}]:[],
  normalizeOnlineFleet:(v,id)=>({...copy(v),id}),
  _fleetDueTime:f=>f.status==='returning'?f.returnTime:f.arrivalTime,
  processEmbargoFleets:async()=>{},
  combatPlanet:async(tx,universe,snap)=>{
    if(processingFails)throw Error('AT21 elaborazione temporaneamente fallita');
    return snap.data();
  },
  _effectivePlanetView:data=>copy(data),
  _snapshotForDiff:data=>data?copy(data):null,
  _writePlanetResult:(tx,ref,before,after)=>tx.update(ref,{resources:copy(after.resources)}),
  _resolveCreditRef:async()=>doc(originPath),
  _inboxCredit:(tx,ref,{resources={},fleet={}})=>{
    const upd={};for(const [k,n] of Object.entries(resources))if(n)upd['inbox.resources.'+k]={__inc:n};
    for(const [k,n] of Object.entries(fleet))if(n)upd['inbox.fleet.'+k]={__inc:n};
    if(Object.keys(upd).length)tx.update(ref,upd);
  },
  _mpNotifyError:(context,err)=>errors.push(context+': '+err.message),
  forceCleanupOnlineFleet:async(u,f,ref)=>{
    // Simula la riparazione sicura AT02: accredito e chiusura nella stessa transazione.
    cleanupCalls++;
    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref);if(!snap.exists||snap.data().resolved)return;
      G._inboxCredit(tx,doc(originPath),{resources:snap.data().cargo,fleet:snap.data().ships});
      tx.update(ref,{resolved:true,status:'completed',repaired:true});
    });
    return true;
  }
};
const win={__UniversumMPModules:G,__UniversumMPVariables:{FLEET_SCHEMA_VERSION:2},
  fbAuth:{currentUser:{uid:'alice'}}};
vm.runInNewContext(source,{window:win,console,Date,Math});
function seed(id){
  const now=Date.now();
  const f={id,attackerUid:'alice',attackerName:'Alice',mission:'transport',
    status:'outbound',resolved:false,originCoords:{g:1,s:1,p:7},
    targetCoords:{g:1,s:2,p:8},targetKey:'1_2_8',
    arrivalTime:now-120000,returnTime:now-120000,
    ships:{smallCargo:2},cargo:copy(cargo)};
  store.set(fleetPath(id),f);
  store.set(originPath,{ownerUid:'alice',resources:{metal:300,crystal:300,deuterium:300},fleet:{}});
  store.set(targetPath,{ownerUid:'alice',name:'Colonia',resources:{metal:1000,crystal:1000,deuterium:1000},
    buildings:{},fleet:{},defenses:{}});
  activeId=id;processingFails=false;commitFails=false;cleanupCalls=0;errors=[];
}
async function resolve(){await G.resolveArrivedOnlineFleets('AT21',1);}
let checks=0;
async function check(label,work){await work();checks++;console.log('  PASS '+label);}
async function main(){
  await check('errore elaborazione >60s: missione, navi e risorse preservate',async()=>{
    seed('error');processingFails=true;await resolve();
    const f=store.get(fleetPath('error'));
    assert.equal(f.status,'outbound');assert.equal(f.resolved,false);
    assert.deepStrictEqual(f.ships,{smallCargo:2});assert.deepStrictEqual(f.cargo,cargo);
    assert.equal(store.get(originPath).inbox,undefined);
    assert.equal(cleanupCalls,0,'errore generico non deve invocare riparazione');
    assert.ok(errors.some(e=>e.includes('AT21 elaborazione')));
  });
  await check('ripetizione dopo errore: carico consegnato una sola volta',async()=>{
    processingFails=false;await resolve();
    assert.equal(store.get(fleetPath('error')).status,'returning');
    assert.deepStrictEqual(store.get(targetPath).resources,{metal:1153,crystal:1071,deuterium:1029});
    await resolve();
    assert.deepStrictEqual(store.get(targetPath).resources,{metal:1153,crystal:1071,deuterium:1029});
    store.get(fleetPath('error')).returnTime=Date.now()-10;
    await resolve();
    assert.equal(store.get(fleetPath('error')).status,'completed');
    assert.deepStrictEqual(store.get(originPath).inbox.fleet,{smallCargo:2});
    const inbox=copy(store.get(originPath).inbox);
    await resolve();
    assert.deepStrictEqual(store.get(originPath).inbox,inbox,'nessun doppio accredito');
  });
  await check('commit fallito: nessuna chiusura né perdita persistente',async()=>{
    seed('commit');commitFails=true;await resolve();
    const f=store.get(fleetPath('commit'));
    assert.equal(f.status,'outbound');assert.equal(f.resolved,false);
    assert.deepStrictEqual(f.ships,{smallCargo:2});assert.deepStrictEqual(f.cargo,cargo);
    assert.deepStrictEqual(store.get(targetPath).resources,{metal:1000,crystal:1000,deuterium:1000});
    assert.equal(cleanupCalls,0,'nessuna chiusura per transazione fallita');
  });
  await check('ripetizione dopo commit fallito: nessuna duplicazione',async()=>{
    await resolve();
    assert.equal(store.get(fleetPath('commit')).status,'returning');
    assert.deepStrictEqual(store.get(targetPath).resources,{metal:1153,crystal:1071,deuterium:1029});
    await resolve();
    assert.deepStrictEqual(store.get(targetPath).resources,{metal:1153,crystal:1071,deuterium:1029});
  });
  console.log('AT21-I01 PASS: '+checks+' scenari mirati, ripetizioni sicure.');
}
main().catch(e=>{console.error('AT21-I01 FAIL:',e);process.exitCode=1;});
