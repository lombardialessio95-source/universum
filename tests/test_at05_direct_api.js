/** AT05: protezione delle API volontarie (mock; non sostituisce Emulator). */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const sources=['fleet-control.js','communications.js','sieges.js','bots.js'].map(p=>fs.readFileSync(path.join(root,'modules/online',p),'utf8'));
const key='universum:ordinary-departure:v1:'+JSON.stringify(['me','u']);
const pending={accountUid:'me',universeId:'u',operationId:'pending',originKey:'1_1_1',expectedRevision:2,status:'pending',protocol:2,armed:true,profileJoinedAt:1,previousReceiptId:null};
const coords={g:1,s:1,p:2};
function fixture({blocked=false,serverReceipt=false,cache=false,otherReceipt=false}={}){
 const trace=[],storage=new Map(),mode={},auth={uid:'me'};
 if(blocked)storage.set(key,JSON.stringify(pending));
 const sentinel=kind=>{trace.push(kind);throw Error('WRITE_ENTRY:'+kind)};
 const meta={fromCache:cache,hasPendingWrites:false};
 const planet={id:'p',ownerUid:'me',coords:{g:1,s:1,p:1},fleet:{lightFighter:10},resources:{metal:100000,crystal:100000,deuterium:100000},isNpc:true,botPersonality:'Pacifico'};
 const receipt={operationId:'older',status:'committed',acknowledged:false};
 const u={id:'u',speed:10,serviceRevision:2,emperor:'test',planets:[structuredClone(planet)],fleetsInFlight:[],researches:{}};
 const ref=(key='')=>({id:key.split('/').pop(),path:key,collection:n=>ref(key+'/'+n),doc:n=>ref(key+'/'+(n||'new')),where:()=>ref(key),orderBy:()=>ref(key),limit:()=>ref(key),get:async opts=>{
   if(mode.onGet)await mode.onGet(key,opts);
   const data=key.endsWith('/u')?{founderUid:'me',speed:10}:key.endsWith('/players/me')?{uid:'me',...(serverReceipt?{ordinaryDispatchReceipt:receipt}:{})}:planet;
   return {id:key.split('/').pop(),exists:true,data:()=>data,metadata:meta,docs:[{id:'sample',ref:ref(key+'/sample'),metadata:meta,data:()=>({uid:'me',recipientUid:'me',...(otherReceipt?{ordinaryDispatchReceipt:receipt}:{})})}],empty:false};
 },set:()=>sentinel('set'),update:()=>sentinel('update'),add:()=>sentinel('add'),delete:()=>sentinel('delete')});
 const db={collection:n=>ref(n),batch:()=>({delete:()=>{},commit:()=>sentinel('batch.commit')}),runTransaction:async cb=>{
  if(!mode.runCallback)return sentinel('runTransaction');
  return cb({get:async r=>r.get(),update:()=>sentinel('tx.update'),set:()=>sentinel('tx.set')});
 }};
 const G={getAuth:()=>({currentUser:{uid:auth.uid}}),getDB:()=>db,coordsToKey:c=>`${c.g}_${c.s}_${c.p}`,syncPlayerState:()=>sentinel('dispatch'),migrateOnlineFleets:()=>sentinel('migrateOnlineFleets'),resolveArrivedOnlineFleets:()=>sentinel('resolveArrivedOnlineFleets'),releaseServerSlot:()=>sentinel('releaseServerSlot'),_effectivePlanetView:x=>x,_resolveCreditRef:async()=>null,normalizeOnlineFleet:x=>x};
 const W={localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},__UniversumMPModules:G,__UniversumMPVariables:{},UniversumMoonMerchant:{FEE:20,inspect:()=>({available:true,chance:0,fleet:{lightFighter:1}})},UniversumGalaxy:{calculateDistance:()=>1,getFleetSpeedAndFuel:()=>({fuelCost:40,durationSec:60})},UniversumMissionsCore:{getMaxFleetSlots:()=>100,getMaxExploreHours:()=>4},UniversumData:{SHIPS:{lightFighter:{cargo:100000}}},UniversumUI:{state:{currentUniverse:u}},fbAuth:{currentUser:{uid:'me'}}};
 for(const source of sources)new Function('window','firebase',source)(W,{firestore:{FieldValue:{increment:x=>x}}});
 const args={deleteReport:['u','r'],deleteAllReports:['u'],leaveOnlineUniverse:['u'],deleteOnlineUniverse:['u'],repairStuckMissions:['u'],payOnlineSiegeRansom:['u',coords],liftOnlineSiege:['u',coords],hireOnlineMoonMerchant:[u,coords],tradeWithOnlineBot:[u,coords,'metal',100,'crystal']};
 const call=name=>G[name](...args[name]);
 return {G,u,W,trace,mode,auth,storage,call,launch:()=>G.launchOnlineFleet(u,0,coords,'attack',{lightFighter:1},{})};
}
const cases=[];const test=(name,fn)=>cases.push([name,fn]);
const normal={deleteReport:'delete',deleteAllReports:'batch.commit',leaveOnlineUniverse:'batch.commit',deleteOnlineUniverse:'add',repairStuckMissions:'migrateOnlineFleets',payOnlineSiegeRansom:'runTransaction',liftOnlineSiege:'runTransaction',hireOnlineMoonMerchant:'runTransaction',tradeWithOnlineBot:'runTransaction'};
for(const [name,entry] of Object.entries(normal)){
 test('blocked '+name+' before any write',async()=>{const f=fixture({blocked:true});await assert.rejects(f.call(name),{code:'ordinary-departure-pending'});assert.deepEqual(f.trace,[]);});
 test('normal '+name+' reaches original write path',async()=>{const f=fixture();await assert.rejects(f.call(name),new RegExp('WRITE_ENTRY:'+entry));assert.deepEqual(f.trace,[entry]);});
}
test('leave rejects unacknowledged server receipt even without local request',async()=>{const f=fixture({serverReceipt:true});await assert.rejects(f.call('leaveOnlineUniverse'),/Ricevuta partenza non riconciliata/);assert.deepEqual(f.trace,[]);});
test('founder deletion rejects other player unacknowledged receipt',async()=>{const f=fixture({otherReceipt:true});await assert.rejects(f.call('deleteOnlineUniverse'),/Ricevuta partenza non riconciliata/);assert.deepEqual(f.trace,[]);});
for(const name of ['leaveOnlineUniverse','deleteOnlineUniverse'])test('cache rejected '+name,async()=>{const f=fixture({cache:true});await assert.rejects(f.call(name),/verificat[io] dal server/);assert.deepEqual(f.trace,[]);});
test('account switches during report query',async()=>{const f=fixture();f.mode.onGet=()=>{f.auth.uid='other'};await assert.rejects(f.call('deleteAllReports'),{code:'ordinary-departure-pending'});assert.deepEqual(f.trace,[]);});
test('active universe switches during trade query',async()=>{const f=fixture();f.mode.onGet=()=>{f.W.UniversumUI.state.currentUniverse={id:'other'}};await assert.rejects(f.call('tradeWithOnlineBot'),{code:'ordinary-departure-pending'});assert.deepEqual(f.trace,[]);});
test('pending appears during transaction read, merchant cannot debit',async()=>{const f=fixture();f.mode.runCallback=true;f.mode.onGet=()=>{f.storage.set(key,JSON.stringify(pending))};await assert.rejects(f.call('hireOnlineMoonMerchant'),{code:'ordinary-departure-pending'});assert.deepEqual(f.trace,[]);});
test('pending appears during BOT read, trade cannot debit',async()=>{const f=fixture();f.mode.onGet=()=>{f.storage.set(key,JSON.stringify(pending))};await assert.rejects(f.call('tradeWithOnlineBot'),{code:'ordinary-departure-pending'});assert.deepEqual(f.trace,[]);});
test('in-flight direct operation blocks dispatch and releases guard on rejection',async()=>{const f=fixture();let enter,release;const entered=new Promise(r=>enter=r),hold=new Promise(r=>release=r);f.mode.onGet=async p=>{if(p.endsWith('/messages')){enter();await hold;}};const action=f.call('deleteAllReports').catch(e=>e);await entered;await assert.rejects(f.launch(),/Operazione in corso/);assert.deepEqual(f.trace,[]);release();assert.match(String(await action),/WRITE_ENTRY:batch.commit/);await assert.rejects(f.launch(),{code:'ordinary-departure-pending'});assert.deepEqual(f.trace,['batch.commit','dispatch']);});
(async()=>{for(const [name,fn] of cases){try{await fn();console.log('PASS '+name);}catch(e){console.error('FAIL '+name+': '+e.stack);process.exitCode=1;}}})();
