/** AT05-E: letture server e riconciliazione senza alterare gli accrediti. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const sources=['sync.js','galattiche.js','universes.js'].map(f=>fs.readFileSync(path.join(root,'modules/online',f),'utf8'));
const cp=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const base='online_universes/u', player=base+'/players/me', home=base+'/planets/1_1_1',fleet=base+'/fleets/f1',gal=base+'/galattiche/me~g1';
 const now=Date.now();
 const store=new Map([[base,{name:'test',speed:10,passcode:'secret',createdAt:1,botConfig:{density:1}}],
  [player,{uid:'me',joinedAt:1,serviceRevision:3,researches:{energyTech:7},ordinaryDispatchReceipt:{operationId:'f1',status:'committed'}}],
  [home,{ownerUid:'me',id:'p1',coords:{g:1,s:1,p:1},resources:{metal:100,crystal:200,deuterium:300},fleet:{lightFighter:7},lastUpdated:now-3600000,inbox:{fleet:{lightFighter:3},resources:{metal:5}}}],
  [fleet,{attackerUid:'me',resolved:false,originKey:'1_1_1',ships:{lightFighter:3}}],
  [gal,{ownerUid:'me',version:4,updatedAt:now-1000,state:{id:'g1',resources:{metal:3}}}],
  [base+'/messages/m1',{recipientUid:'me',timestamp:now,title:'test'}],
  [base+'/planets/1_1_2',{ownerUid:'enemy'}]]);
 const mode={gets:[],txReads:[],txCount:0,writes:0,restoreResearch:[],auth:'me'};
 const checkWrite=()=>{mode.writes++;throw Error('scrittura vietata nel recupero')};
 const meta=(key)=>({fromCache:mode.cache===key,hasPendingWrites:mode.pending===key});
 const snap=(key)=>{const data=store.has(key)?cp(store.get(key)):undefined;return {id:key.split('/').pop(),ref:ref(key),exists:data!==undefined,data:()=>data===undefined?undefined:cp(data),metadata:meta(key)}};
 const ref=key=>({path:key,id:key.split('/').pop(),collection:n=>col(key+'/'+n),set:checkWrite,update:checkWrite,delete:checkWrite,
  get:async opt=>{assert.equal(opt?.source,'server');mode.gets.push(key);if(mode.error===key)throw Error('lettura fallita');return snap(key)}});
 function col(key,filters=[],order=null,max=null){return {doc:id=>ref(key+'/'+id),where:(k,op,v)=>{assert.equal(op,'==');return col(key,[...filters,[k,v]],order,max)},orderBy:(k,o)=>col(key,filters,[k,o],max),limit:n=>col(key,filters,order,n),get:async opt=>{
  assert.equal(opt?.source,'server');mode.gets.push(key);if(mode.error===key)throw Error('query fallita');
  let docs=[...store.keys()].filter(k=>k.startsWith(key+'/')&&!k.slice(key.length+1).includes('/')&&filters.every(([field,v])=>store.get(k)[field]===v)).map(snap);
  if(order)docs.sort((a,b)=>(a.data()[order[0]]-b.data()[order[0]])*(order[1]==='desc'?-1:1));
  if(max!==null)docs=docs.slice(0,max);
  return {docs,metadata:meta(key)};
 }}}
 const db={collection:n=>col(n),runTransaction:async cb=>{mode.txCount++;mode.beforeTx?.();const result=await cb({get:async r=>{mode.txReads.push(r.path);return snap(r.path)},set:checkWrite,update:checkWrite,delete:checkWrite});mode.afterTx?.();return result;},batch:checkWrite};
 const G={getAuth:()=>({currentUser:{uid:mode.auth,displayName:'test'}}),getDB:()=>db,coordsToKey:c=>`${c.g}_${c.s}_${c.p}`,ensureBotsAroundHome:checkWrite,migrateOnlineFleets:checkWrite};
 const W={__UniversumMPModules:G,__UniversumMPVariables:{},fbAuth:{currentUser:{uid:'me'}},UniversumUI:{state:{currentUniverse:{researches:{energyTech:999}}}},UniversumEngine:{getPlanetProduction(){},normalizeResearchState(){}},__UniversumEngineModules:{advancePlanetResources(p,u){mode.restoreResearch.push(u.researches.energyTech)},addGalatticaProduction(u,dt){mode.galTime=dt;}}};
 for(const source of sources)new Function('window','firebase',source)(W,{});
 const recover=(id='f1',pass='secret')=>G.joinOnlineUniverse('u',pass,{serverOnly:true,operationId:id});
 return {G,mode,W,store,recover,base,player,home,fleet,gal};
}
const cases=[];
function test(name,fn){cases.push([name,fn]);}
test('E01 verified server state, legacy inbox unchanged, correct research, no writes',async()=>{const f=fixture(),u=await f.recover();assert.equal(u.serviceRevision,3);assert.equal(u.planets.length,1);assert.equal(u.planets[0].fleet.lightFighter,7);assert.equal(u.planets[0].inbox.fleet.lightFighter,3);assert.equal(u.fleetsInFlight.length,1);assert.equal(u.galattiche.length,1);assert.deepEqual(f.mode.restoreResearch,[7]);assert.equal(f.mode.writes,0);assert.equal(f.mode.txCount,1);assert.ok(f.mode.txReads.includes(f.home));assert.ok(f.mode.txReads.includes(f.gal));assert.equal(f.G.ordinaryRecoveryEvidence(u).fleet.id,'f1');assert.equal(f.G.ordinaryRecoveryEvidence(u).receipt.operationId,'f1');});
test('E02 cache query rejected',async()=>{const f=fixture();f.mode.cache=f.base+'/planets';await assert.rejects(f.recover(),{code:'ordinary-recovery-changed'});assert.equal(f.mode.writes,0);});
test('E03 pending local document rejected',async()=>{const f=fixture();f.mode.pending=f.home;await assert.rejects(f.recover(),{code:'ordinary-recovery-changed'});});
test('E04 profile changes before transaction',async()=>{const f=fixture();f.mode.beforeTx=()=>f.store.get(f.player).serviceRevision++;await assert.rejects(f.recover(),{code:'ordinary-recovery-changed'});});
test('E05 planet inbox changes during recovery',async()=>{const f=fixture();f.mode.beforeTx=()=>f.store.get(f.home).inbox.fleet.lightFighter++;await assert.rejects(f.recover(),{code:'ordinary-recovery-changed'});});
test('E06 fleet resolution after transaction',async()=>{const f=fixture();f.mode.afterTx=()=>f.store.get(f.fleet).resolved=true;await assert.rejects(f.recover(),{code:'ordinary-recovery-changed'});});
test('E07 planet query membership changes after transaction',async()=>{const f=fixture();f.mode.afterTx=()=>f.store.set(f.base+'/planets/1_1_4',{ownerUid:'me'});await assert.rejects(f.recover(),{code:'ordinary-recovery-changed'});});
test('E08 Galattica mutation rejected',async()=>{const f=fixture();f.mode.afterTx=()=>f.store.get(f.gal).version++;await assert.rejects(f.recover(),{code:'ordinary-recovery-changed'});});
test('E09 absent fleet retained as evidence, not classified negative',async()=>{const f=fixture();f.store.delete(f.fleet);const u=await f.recover();assert.equal(f.G.ordinaryRecoveryEvidence(u).fleet,null);assert.equal(f.G.ordinaryRecoveryEvidence(u).receipt.operationId,'f1');assert.equal(f.mode.writes,0);});
test('E10 server query failure not converted into empty list',async()=>{const f=fixture();f.mode.error=f.base+'/fleets';await assert.rejects(f.recover(),/query fallita/);});
test('E11 missing profile never created in recovery',async()=>{const f=fixture();f.store.delete(f.player);await assert.rejects(f.recover(),{code:'ordinary-recovery-changed'});assert.equal(f.mode.writes,0);});
test('E12 account switch rejected',async()=>{const f=fixture();f.mode.afterTx=()=>f.mode.auth='other';await assert.rejects(f.recover(),{code:'ordinary-recovery-changed'});});
test('E13 passcode enforced',async()=>{const f=fixture();await assert.rejects(f.recover('f1','wrong'),/Codice stanza errato/);assert.equal(f.mode.writes,0);});
test('E14 message cache rejected',async()=>{const f=fixture();f.mode.cache=f.base+'/messages/m1';await assert.rejects(f.recover(),{code:'ordinary-recovery-changed'});});
test('E15 legacy profile without revision recoverable, no migration',async()=>{const f=fixture();delete f.store.get(f.player).serviceRevision;const u=await f.recover();assert.equal(u.serviceRevision,0);assert.equal(f.mode.writes,0);});
test('E16 invalid revision rejected',async()=>{const f=fixture();f.store.get(f.player).serviceRevision=-1;await assert.rejects(f.recover(),{code:'ordinary-recovery-changed'});});
(async()=>{for(const [name,fn] of cases){try{await fn();console.log('PASS '+name);}catch(e){console.error('FAIL '+name+': '+e.stack);process.exitCode=1;}}})();
