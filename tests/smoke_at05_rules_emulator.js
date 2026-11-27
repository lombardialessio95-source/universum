/** AT05: real Firebase Web SDK + two independent clients on disposable Firestore Emulator.
 * No production access. Expected security failures remain failures, never diagnostic PASS.
 * Run with FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 AT05_ROOT=/path/to/patched/source.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const host=process.env.FIRESTORE_EMULATOR_HOST||'';
if(!/^127\.0\.0\.1:[1-9]\d*$/.test(host)){console.error('BLOCKED: FIRESTORE_EMULATOR_HOST must be an IPv4 loopback endpoint.');process.exit(2);}
const projectId='demo-universum-at05';
const root=path.resolve(process.env.AT05_ROOT||path.join(__dirname,'..'));
const rules=fs.readFileSync(path.join(root,'firestore.rules'));
const ruleHash=crypto.createHash('sha1').update(`blob ${rules.length}\0`).update(rules).digest('hex');
// Rules under test are the local checkpoint, loaded by the isolated emulator.
let firebase;try{const app=require('firebase/compat/app');firebase=app.default||app;require('firebase/compat/firestore');}catch(e){console.error('BLOCKED: Firebase Web SDK 10.12.2 not installed:',e.message);process.exit(2);}
const sources=['sync.js','fleet-control.js','universes.js','galattiche.js'].map(x=>fs.readFileSync(path.join(root,'modules/online',x),'utf8'));
const cp=structuredClone,apps=[];let serial=0;const runId=crypto.randomBytes(4).toString('hex');
const uid='pilot',origin={g:1,s:1,p:1},target={g:1,s:1,p:3};
const localKey=id=>'universum:ordinary-departure:v1:'+JSON.stringify([uid,id]);
function value(v){if(v===null)return{nullValue:null};if(typeof v==='boolean')return{booleanValue:v};if(typeof v==='number')return Number.isSafeInteger(v)?{integerValue:String(v)}:{doubleValue:v};if(typeof v==='string')return{stringValue:v};if(Array.isArray(v))return{arrayValue:{values:v.map(value)}};return{mapValue:{fields:fields(v)}};}
function fields(v){return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,value(x)]));}
async function adminSet(key,data){const res=await fetch(`http://${host}/v1/projects/${projectId}/databases/(default)/documents/${key}`,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:fields(data)}),signal:AbortSignal.timeout(10000)});if(!res.ok)throw Error(`Emulator seed ${res.status}: ${await res.text()}`);}
async function adminDelete(key){const res=await fetch(`http://${host}/v1/projects/${projectId}/databases/(default)/documents/${key}`,{method:'DELETE',headers:{Authorization:'Bearer owner'},signal:AbortSignal.timeout(10000)});if(!res.ok)throw Error(`Emulator delete ${res.status}: ${await res.text()}`);}
const room=id=>'online_universes/'+id;
const player=id=>room(id)+'/players/'+uid;
const home=id=>room(id)+'/planets/1_1_1';
const receipt=(id,op,status='committed')=>({operationId:op,originKey:'1_1_1',expectedRevision:2,terminalRevision:3,profileJoinedAt:1,status,acknowledged:false});
async function seed(label,{legacy=false}={}){
 const id=label+'_'+runId+'_'+(++serial),p={id:'p1',name:'home',ownerUid:uid,coords:origin,fleet:{lightFighter:10},resources:{metal:1000,crystal:1000,deuterium:100000},buildings:{},defenses:{},shipyardQueue:[],buildQueue:[],defenseQueue:[],mothershipHangars:[],lastUpdated:Date.now(),...(legacy?{}:{serviceRevision:2})};
 await adminSet(room(id),{name:id,speed:1,founderUid:uid,ownerUid:uid,passcode:'',createdAt:1,playerCount:1});
 await adminSet(player(id),{uid,joinedAt:1,researches:{},specialistFlights:[],...(legacy?{}:{serviceRevision:2})});
 await adminSet(home(id),p);await adminSet(room(id)+'/planets/1_1_3',{id:'enemy',ownerUid:'enemy',coords:target});
 return {id,speed:1,emperor:'Pilot',planets:[cp(p)],fleetsInFlight:[],researches:{},...(legacy?{}:{serviceRevision:2})};
}
function client(u,storage=new Map(),account=uid){
 const app=firebase.initializeApp({apiKey:'demo',projectId,appId:'demo-at05'},'at05-'+(++serial));apps.push(app);
 const raw=app.firestore();raw.settings({experimentalForceLongPolling:true});raw.useEmulator('127.0.0.1',Number(host.split(':')[1]),{mockUserToken:{sub:account}});
 const mode={};
 // The actual SDK runs the transaction. Hooks only inject timing / lost delivery.
 const db={collection:n=>raw.collection(n),runTransaction:async fn=>{
  await mode.beforeTransaction?.();
  const result=await raw.runTransaction(async tx=>{const r=await fn(tx);await mode.afterCallback?.();return r;});
  if(mode.loseOnce){mode.loseOnce=false;throw Object.assign(Error('Injected lost response AFTER real commit'),{code:'unavailable'});}return result;
 }};
 const G={getAuth:()=>({currentUser:{uid:account,displayName:'Pilot'}}),getDB:()=>db,coordsToKey:c=>`${c.g}_${c.s}_${c.p}`,_tsToMs:()=>0};
 const W={localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},__UniversumMPModules:G,__UniversumMPVariables:{SYNC_MIN_INTERVAL_MS:0,_INBOX_RES_KEYS:['metal','crystal','deuterium'],_syncLastByUni:new Map(),_systemCache:new Map(),_systemPending:new Map(),FLEET_SCHEMA_VERSION:1,_mpErrorToastAt:new Map()},UniversumData:{SHIPS:{lightFighter:{cargo:100000,cost:{metal:3000,crystal:1000,deuterium:0}}}},UniversumGalaxy:{calculateDistance:()=>1,getFleetSpeedAndFuel:()=>({fuelCost:40,durationSec:600})},UniversumMissionsCore:{getMaxFleetSlots:()=>100,getMaxExploreHours:()=>4},fbAuth:{currentUser:{uid:account}}};
 for(const source of sources)new Function('window','firebase',source)(W,firebase);
 W.UniversumUI={state:{currentUniverse:u,isMultiplayerMode:true},startOnlineGame(fresh){this.state.currentUniverse=fresh;this.state.isMultiplayerMode=true;},toast(){}};
 const launch=()=>G.launchOnlineFleet(u,0,target,'attack',{lightFighter:3},{metal:100,crystal:50,deuterium:20});
 return {u,G,W,mode,raw,storage,launch,read:key=>raw.doc(key).get({source:'server'}),fleets:()=>raw.collection(room(u.id)+'/fleets').get({source:'server'})};
}
function gate(){let open;const wait=new Promise(r=>open=r);return{open,wait};}
async function denied(fn){await assert.rejects(fn(),e=>String(e?.code||'').endsWith('permission-denied'),'must reject by actual Firestore Rules, not unrelated error');}
async function launchLost(u){const a=client(cp(u));a.mode.loseOnce=true;await assert.rejects(a.launch(),{code:'ordinary-departure-pending'});const p=JSON.parse(a.storage.get(localKey(u.id)));assert.ok(p.armed);return{a,p};}
const cases=[];const test=(name,fn)=>cases.push([name,fn]);
test('I05 real commit lost response, reload, fleet removed, receipt recovery and acknowledgement',async()=>{
 const u=await seed('lost');const {a,p}=await launchLost(u);const pr=(await a.read(player(u.id))).data();assert.equal(pr.ordinaryDispatchReceipt.operationId,p.operationId);assert.equal(pr.serviceRevision,3);assert.equal((await a.read(home(u.id))).data().fleet.lightFighter,7);assert.equal(a.u.planets[0].fleet.lightFighter,10);assert.equal((await a.fleets()).size,1);
 await adminDelete(room(u.id)+'/fleets/'+p.operationId);
 const reload=client(cp(u),a.storage);const result=await reload.G.verifyOrdinaryDeparture(reload.u);assert.equal(result.status,'committed');assert.equal(result.operationId,p.operationId);const fresh=reload.W.UniversumUI.state.currentUniverse;assert.equal(fresh.planets[0].fleet.lightFighter,7);assert.equal(fresh.fleetsInFlight.length,0);assert.equal(await reload.G.syncPlayerState(reload.u,{force:true}),false);assert.equal(await reload.G.syncPlayerState(fresh,{force:true}),true);assert.equal((await reload.read(player(u.id))).data().ordinaryDispatchReceipt.acknowledged,true);assert.equal((await reload.read(home(u.id))).data().fleet.lightFighter,7);
});
test('I05 two clients same UID simultaneous ordinary launches, exactly one debit',async()=>{
 const u=await seed('concurrent');const a=client(cp(u)),b=client(cp(u));const results=await Promise.allSettled([a.launch(),b.launch()]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal((await a.fleets()).size,1);const p=(await a.read(home(u.id))).data();assert.equal(p.fleet.lightFighter,7);assert.deepEqual(p.resources,{metal:900,crystal:950,deuterium:99940});assert.equal((await a.read(player(u.id))).data().serviceRevision,3);
});
test('I05 real transaction cancellation fence against delayed original callback',async()=>{
 const u=await seed('cancelrace'),a=client(cp(u));const ready=gate(),hold=gate();let first=true;
 a.mode.afterCallback=async()=>{if(first){first=false;ready.open();await hold.wait;}};
 const original=a.launch().then(x=>({ok:true,x}),e=>({ok:false,e}));
 try{await Promise.race([ready.wait,original.then(()=>{throw Error('original completed before gate')})]);const snapshot=new Map(a.storage);const b=client(cp(u),snapshot);const result=await b.G.verifyOrdinaryDeparture(b.u,{cancel:true});assert.equal(result.status,'cancelled');hold.open();assert.equal((await original).ok,false);assert.equal((await b.fleets()).size,0);assert.equal((await b.read(home(u.id))).data().fleet.lightFighter,10);assert.equal((await b.read(player(u.id))).data().ordinaryDispatchReceipt.status,'cancelled');}finally{hold.open();await original;}
});
test('E actual SDK server reads; change of legacy inbox between scans rejected',async()=>{
 const u=await seed('readset');const a=client(cp(u)),b=client(cp(u));const stable=await a.G.joinOnlineUniverse(u.id,'',{serverOnly:true});assert.equal(stable.serviceRevision,2);let inject=true;a.mode.beforeTransaction=async()=>{if(inject){inject=false;await b.raw.doc(home(u.id)).update({'inbox.resources.metal':5});}};
 await assert.rejects(()=>a.G.joinOnlineUniverse(u.id,'',{serverOnly:true}),{code:'ordinary-recovery-changed'});assert.equal((await b.read(home(u.id))).data().inbox.resources.metal,5);
 const fresh=await a.G.joinOnlineUniverse(u.id,'',{serverOnly:true});assert.equal(fresh.planets[0].inbox.resources.metal,5);assert.equal((await b.read(home(u.id))).data().inbox.resources.metal,5);
});
test('I05 legacy commit receipt survives missing fleet and absent original revision',async()=>{
 const u=await seed('legacycommit',{legacy:true});const {a,p}=await launchLost(u);const pr=(await a.read(player(u.id))).data();assert.equal(pr.ordinaryDispatchReceipt.operationId,p.operationId);assert.equal(pr.ordinaryDispatchReceipt.status,'committed');await adminDelete(room(u.id)+'/fleets/'+p.operationId);const reload=client(cp(u),a.storage);const result=await reload.G.verifyOrdinaryDeparture(reload.u);assert.equal(result.status,'committed');assert.equal(reload.W.UniversumUI.state.currentUniverse.planets[0].fleet.lightFighter,7);
});
test('I05 legacy absent receipt cannot authorize cancellation',async()=>{
 const u=await seed('legacyunknown',{legacy:true});const a=client(cp(u));a.mode.afterCallback=async()=>{throw Error('Injected rejection before commit');};await assert.rejects(a.launch(),{code:'ordinary-departure-pending'});await assert.rejects(a.G.verifyOrdinaryDeparture(a.u,{cancel:true}),{code:'ordinary-departure-pending'});assert.equal((await a.fleets()).size,0);assert.equal((await a.read(home(u.id))).data().fleet.lightFighter,10);assert.ok(a.storage.has(localKey(u.id)));
});
// Policy tests: intentionally require protections absent from I02 Rules. A successful illicit write is FAIL.
test('RULE R01 independent client cannot overwrite unacknowledged receipt',async()=>{const u=await seed('overwrite');const {a,p}=await launchLost(u);const b=client(cp(u));await denied(()=>b.raw.doc(player(u.id)).update({serviceRevision:4,ordinaryDispatchReceipt:{...receipt(u.id,p.operationId),operationId:'replacement'}}));assert.equal((await a.read(player(u.id))).data().ordinaryDispatchReceipt.operationId,p.operationId);});
test('RULE R02 cannot erase an unacknowledged receipt',async()=>{const u=await seed('erase');const {a,p}=await launchLost(u);const b=client(cp(u));await denied(()=>b.raw.doc(player(u.id)).update({serviceRevision:4,ordinaryDispatchReceipt:firebase.firestore.FieldValue.delete()}));assert.equal((await a.read(player(u.id))).data().ordinaryDispatchReceipt.operationId,p.operationId);});
test('RULE R03 cannot forge committed receipt without a fleet or debit',async()=>{const u=await seed('forge');const b=client(cp(u));await denied(()=>b.raw.doc(player(u.id)).update({serviceRevision:3,ordinaryDispatchReceipt:receipt(u.id,'forged')}));assert.equal((await b.fleets()).size,0);});
test('RULE R04 cannot delete player with unacknowledged receipt',async()=>{const u=await seed('delprofile');const {a}=await launchLost(u);const b=client(cp(u));await denied(()=>b.raw.doc(player(u.id)).delete());assert.ok((await a.read(player(u.id))).exists);});
function oldFleet(){const now=Date.now();return{schemaVersion:1,attackerUid:uid,attackerName:'Pilot',defenderUid:'enemy',originCoords:origin,originKey:'1_1_1',targetCoords:target,targetKey:'1_1_3',mission:'attack',status:'outbound',phase:'IN VIAGGIO',resolved:false,departureTime:now,arrivalTime:now+600000,returnTime:now+1200000,ships:{lightFighter:3},cargo:{metal:0,crystal:0,deuterium:0}};}
test('RULE R05 old client cannot create ordinary fleet outside receipt/checkpoint transaction',async()=>{const u=await seed('oldclient'),b=client(cp(u));await denied(()=>b.raw.doc(room(u.id)+'/fleets/old_fleet').set(oldFleet()));assert.equal((await b.fleets()).size,0);});
test('RULE R06 old client cannot create the same fleet after terminal cancellation',async()=>{const u=await seed('cancelled');await adminSet(player(u.id),{uid,joinedAt:1,serviceRevision:3,researches:{},ordinaryDispatchReceipt:receipt(u.id,'cancelled-id','cancelled')});const b=client(cp(u));await denied(()=>b.raw.doc(room(u.id)+'/fleets/cancelled-id').set(oldFleet()));assert.equal((await b.fleets()).size,0);});
// R07+ permanent evidence, replay, identity and split acknowledgement.
const opPath=(id,op)=>room(id)+'/ordinaryDispatchOps/'+op;
async function forgedCommit(c,id,op,{keepShips=false,proof=true,wrongProjected=false}={}){
 const p=(await c.read(player(id))).data(),h=(await c.read(home(id))).data(),rev=p.serviceRevision||0;
 const r={operationId:op,originKey:'1_1_1',expectedRevision:rev,terminalRevision:rev+1,profileJoinedAt:p.joinedAt??null,profileCreatedAt:p.at05ProfileCreatedAt??null,status:'committed',acknowledged:false};
 const f=oldFleet(),ships=h.fleet.lightFighter;
 const batch=c.raw.batch();
 batch.set(c.raw.doc(room(id)+'/fleets/'+op),f);
 batch.update(c.raw.doc(player(id)),{serviceRevision:rev+1,ordinaryDispatchReceipt:r});
 batch.update(c.raw.doc(home(id)),{serviceRevision:rev+1,ordinaryDispatchId:op,lastUpdated:Date.now(),fleet:{...h.fleet,lightFighter:keepShips?ships:ships-3},resources:{...h.resources,deuterium:h.resources.deuterium-40}});
 batch.set(c.raw.doc(opPath(id,op)),{uid,receipt:r,...(proof?{proof:{shipsBefore:{lightFighter:wrongProjected?ships+3:ships},resourcesBefore:h.resources,resourcesDebit:{metal:0,crystal:0,deuterium:40}}}:{})});
 return batch.commit();
}
test('R07 ack is metadata-only, immutable terminal operation cannot be erased or rewritten',async()=>{
 const u=await seed('ackmeta'),{a,p}=await launchLost(u),b=client(cp(u));
 const before=(await b.read(home(u.id))).data(),profile=(await b.read(player(u.id))).data(),op=(await b.read(opPath(u.id,p.operationId))).data();
 await denied(()=>b.raw.doc(player(u.id)).update({'ordinaryDispatchReceipt.acknowledged':true,serviceRevision:4}));
 await denied(()=>b.raw.doc(player(u.id)).update({'ordinaryDispatchReceipt.acknowledged':true,points:0}));
 await b.raw.doc(player(u.id)).update({'ordinaryDispatchReceipt.acknowledged':true});
 assert.equal((await b.read(player(u.id))).data().serviceRevision,profile.serviceRevision);
 assert.deepEqual((await b.read(home(u.id))).data(),before);
 await denied(()=>b.raw.doc(opPath(u.id,p.operationId)).delete());
 await denied(()=>b.raw.doc(opPath(u.id,p.operationId)).update({'receipt.status':'cancelled'}));
 assert.deepEqual((await b.read(opPath(u.id,p.operationId))).data(),op);
 const other=client(cp(u),new Map(),'other');await denied(()=>other.raw.doc(opPath(u.id,p.operationId)).get({source:'server'}));
});
test('R08 committed ID cannot be replayed after ack, replacement and deletion of fleet',async()=>{
 const u=await seed('replay'),a=client(cp(u));const first=await a.launch();const second=await a.launch();assert.notEqual(first.id,second.id);
 await a.G.syncPlayerState(a.u,{force:true});await a.raw.doc(room(u.id)+'/fleets/'+first.id).delete();
 const profile=(await a.read(player(u.id))).data(),h=(await a.read(home(u.id))).data();
 await denied(()=>forgedCommit(a,u.id,first.id));
 assert.deepEqual((await a.read(player(u.id))).data(),profile);assert.deepEqual((await a.read(home(u.id))).data(),h);
 assert.equal((await a.read(opPath(u.id,first.id))).data().receipt.status,'committed');
});
test('R09 cancelled ID permanently fenced after ack and later dispatch',async()=>{
 const u=await seed('cancelreplay'),a=client(cp(u));a.mode.afterCallback=async()=>{throw Error('response uncertain before commit')};
 await assert.rejects(a.launch(),{code:'ordinary-departure-pending'});a.mode.afterCallback=null;
 const p=JSON.parse(a.storage.get(localKey(u.id)));assert.equal((await a.G.verifyOrdinaryDeparture(a.u,{cancel:true})).status,'cancelled');
 const fresh=a.W.UniversumUI.state.currentUniverse;const next=await a.G.launchOnlineFleet(fresh,0,target,'attack',{lightFighter:3},{});assert.notEqual(next.id,p.operationId);
 await a.G.syncPlayerState(fresh,{force:true});await denied(()=>forgedCommit(a,u.id,p.operationId));
 assert.equal((await a.read(opPath(u.id,p.operationId))).data().receipt.status,'cancelled');
});
test('R10 profile recreation gets new server incarnation; old request and replay rejected',async()=>{
 const u=await seed('recreate'),{a,p}=await launchLost(u),b=client(cp(u));
 await b.raw.doc(player(u.id)).update({'ordinaryDispatchReceipt.acknowledged':true});
 await b.raw.doc(player(u.id)).delete();
 await denied(()=>b.raw.doc(player(u.id)).set({uid,joinedAt:1,serviceRevision:3}));
 await b.raw.doc(player(u.id)).set({uid,joinedAt:1,serviceRevision:3,at05ProfileCreatedAt:firebase.firestore.FieldValue.serverTimestamp()});
 const freshProfile=(await b.read(player(u.id))).data();assert.ok(freshProfile.at05ProfileCreatedAt);
 await denied(()=>b.raw.doc(player(u.id)).update({serviceRevision:4,at05ProfileCreatedAt:firebase.firestore.FieldValue.delete()}));
 const reload=client(cp(u),a.storage);await assert.rejects(reload.G.verifyOrdinaryDeparture(reload.u),{code:'ordinary-departure-pending'});
 assert.equal(reload.W.UniversumUI.state.currentUniverse,reload.u);await denied(()=>forgedCommit(b,u.id,p.operationId));
 assert.equal((await b.read(opPath(u.id,p.operationId))).data().receipt.status,'committed');
});
test('R11 receipt+fleet+stamp without correct debit rejected atomically',async()=>{
 const u=await seed('fakedebit'),b=client(cp(u));const before=(await b.read(home(u.id))).data();
 await denied(()=>forgedCommit(b,u.id,'no-proof',{proof:false}));
 await denied(()=>forgedCommit(b,u.id,'no-debit',{keepShips:true}));
 await denied(()=>forgedCommit(b,u.id,'fake-projection',{keepShips:true,wrongProjected:true}));
 assert.deepEqual((await b.read(home(u.id))).data(),before);assert.equal((await b.fleets()).size,0);
});
test('R12 fake special labels do not bypass ordinary rules',async()=>{
 const u=await seed('labels'),b=client(cp(u));
 for(const [id,d] of [['fake-target',{targetGalatticaId:'fake'}],['fake-dock',{ships:{lightFighter:3,invictus:1},originPlanetId:'p1',birthBacinoAt:1}],['fake-hangar',{carrierHangars:[{id:'fake',fighters:0}]}],['zero-special',{ships:{lightFighter:3,hephaestusForge:0},mission:'deploy',targetKey:'1_1_2'}]]){
   await denied(()=>b.raw.doc(room(u.id)+'/fleets/'+id).set({...oldFleet(),...d}));
 }
 assert.equal((await b.fleets()).size,0);
});
test('R13 another browser without local storage discovers server receipt and recovers',async()=>{
 const u=await seed('adopt'),{a,p}=await launchLost(u),b=client(cp(u));
 await assert.rejects(b.G.joinOnlineUniverse(u.id,''),{code:'ordinary-departure-pending'});
 assert.equal(JSON.parse(b.storage.get(localKey(u.id))).operationId,p.operationId);
 assert.equal((await b.G.verifyOrdinaryDeparture(b.u)).status,'committed');assert.equal(b.W.UniversumUI.state.currentUniverse.planets[0].fleet.lightFighter,7);
});
test('R14 older receipt recovered from permanent evidence even after current slot replaced',async()=>{
 const u=await seed('oldproof'),{a,p}=await launchLost(u),oldStorage=new Map(a.storage);
 await a.G.verifyOrdinaryDeparture(a.u);const fresh=a.W.UniversumUI.state.currentUniverse;
 const next=await a.G.launchOnlineFleet(fresh,0,target,'attack',{lightFighter:3},{});await a.raw.doc(room(u.id)+'/fleets/'+p.operationId).delete();
 const b=client(cp(u),oldStorage);assert.equal((await b.G.verifyOrdinaryDeparture(b.u)).operationId,p.operationId);
 assert.equal(b.W.UniversumUI.state.currentUniverse.planets[0].fleet.lightFighter,4);
 assert.equal(JSON.parse(b.storage.get(localKey(u.id))).operationId,next.id);
 assert.equal((await b.G.verifyOrdinaryDeparture(b.W.UniversumUI.state.currentUniverse)).operationId,next.id);
});
test('E final fence rejects update during preparation of recovered model',async()=>{
 const u=await seed('latechange'),a=client(cp(u)),b=client(cp(u)),orig=a.G.restoreGalattiche;
 a.G.restoreGalattiche=async(...args)=>{await orig(...args);await b.raw.doc(home(u.id)).update({'inbox.resources.metal':9});};
 await assert.rejects(a.G.joinOnlineUniverse(u.id,'',{serverOnly:true}),{code:'ordinary-recovery-changed'});
 a.G.restoreGalattiche=orig;assert.equal((await a.G.joinOnlineUniverse(u.id,'',{serverOnly:true})).planets[0].inbox.resources.metal,9);
});
test('legacy inbox and completed shipyard queue retained by debit proof',async()=>{
 const u=await seed('queuecredit');const a=client(cp(u));
 const queued={id:'lightFighter',remaining:2,total:2,nextUnitEndTime:Date.now()-1,endTime:Date.now()-1,unitDurationSec:1};
 await adminSet(home(u.id),{...u.planets[0],shipyardQueue:[queued],inbox:{fleet:{lightFighter:1},resources:{metal:5}}});
 a.u.planets[0].fleet.lightFighter=12;
 const d=await a.launch();assert.ok(d.id);const h=(await a.read(home(u.id))).data();assert.equal(h.fleet.lightFighter,10);assert.equal(h.resources.metal,905);
});
test('ordinary mixed fleet of all selectable ship classes fits Rules evaluation budget',async()=>{
 const u=await seed('mixed');const ids=['smallCargo','largeCargo','lightFighter','heavyFighter','cruiser','battleship','bomber','battlecruiser','colonyShip','recycler','espionageProbe','mothership','deathStar'];
 u.planets[0].fleet=Object.fromEntries(ids.map(id=>[id,10]));await adminSet(home(u.id),u.planets[0]);
 const a=client(cp(u));for(const id of ids)a.W.UniversumData.SHIPS[id]={cargo:100000,cost:{metal:1,crystal:1,deuterium:0}};
 const d=await a.G.launchOnlineFleet(a.u,0,target,'attack',Object.fromEntries(ids.map(id=>[id,1])),{});
 assert.ok(d.id);const h=(await a.read(home(u.id))).data();for(const id of ids)assert.equal(h.fleet[id],9);
});
test('new profile incarnation allows a genuinely new ordinary dispatch',async()=>{
 const u=await seed('newprofile'),a=client(cp(u));await a.raw.doc(player(u.id)).delete();
 await a.raw.doc(player(u.id)).set({uid,joinedAt:1,serviceRevision:2,researches:{},at05ProfileCreatedAt:firebase.firestore.FieldValue.serverTimestamp()});
 const fresh=await a.G.joinOnlineUniverse(u.id,'',{serverOnly:true});a.W.UniversumUI.state.currentUniverse=fresh;
 const d=await a.G.launchOnlineFleet(fresh,0,target,'attack',{lightFighter:3},{});assert.ok(d.id);
 const op=(await a.read(opPath(u.id,d.id))).data();assert.ok(op.receipt.profileCreatedAt);assert.equal(op.receipt.status,'committed');
});
test('real SDK preserves dock dispatch Invictus and Crepuscolo',async()=>{
 const u=await seed('dockreal');u.planets[0].bacinoSpaziale={status:'active',startedAt:1,invictusActive:1,crepuscolo:{status:'active'}};
 await adminSet(home(u.id),u.planets[0]);const a=client(cp(u));a.W.UniversumGalaxy.getInvictusJumpCost=()=>5;
 for(const id of ['invictus','crepuscolo'])a.W.UniversumData.SHIPS[id]={cargo:100000,cost:{metal:1,crystal:1,deuterium:0}};
 const d=await a.G.launchOnlineFleet(a.u,0,target,'attack',{invictus:1,crepuscolo:1},{});assert.ok(d.id);
 const p=(await a.read(home(u.id))).data();assert.equal(p.bacinoSpaziale.invictusActive,0);assert.equal(p.bacinoSpaziale.crepuscolo.status,'inMission');assert.equal(p.resources.deuterium,99955);
 assert.equal((await a.read(opPath(u.id,d.id))).exists,false);
});
test('real SDK preserves specialist transfer',async()=>{
 const u=await seed('specialreal'),own={...cp(u.planets[0]),id:'p2',coords:{g:1,s:1,p:2},fleet:{}};u.planets[0].fleet.hephaestusForge=1;u.planets.push(own);
 await adminSet(home(u.id),u.planets[0]);await adminSet(room(u.id)+'/planets/1_1_2',own);const a=client(cp(u));
 a.W.UniversumData.SHIPS.hephaestusForge={cargo:100000,cost:{metal:1,crystal:1,deuterium:0}};
 a.W.UniversumServices={ids:['hephaestusForge','prometheusOracle'],forge:'hephaestusForge',oracle:'prometheusOracle',transfer:(u,m,t,ships)=>Boolean(ships.hephaestusForge),settlePlanet:()=>{}};
 const d=await a.G.launchOnlineFleet(a.u,0,own.coords,'deploy',{hephaestusForge:1},{});assert.ok(d.id);assert.equal((await a.read(home(u.id))).data().fleet.hephaestusForge,0);
 assert.equal((await a.read(opPath(u.id,d.id))).exists,false);
});
test('real SDK preserves loaded carrier incursion',async()=>{
 const u=await seed('carrierreal');u.planets[0].fleet.mothership=1;u.planets[0].mothershipHangars=[{id:'hangar1',fighters:20}];await adminSet(home(u.id),u.planets[0]);
 const a=client(cp(u));a.W.UniversumData.SHIPS.mothership={cargo:100000,cost:{metal:1,crystal:1,deuterium:0}};
 new Function('window',fs.readFileSync(path.join(root,'modules/galaxy/hangars.js'),'utf8'))(a.W);
 const d=await a.G.launchOnlineFleet(a.u,0,target,'incursion',{mothership:1},{},{carrierIds:['hangar1']});assert.ok(d.id);
 assert.equal((await a.read(home(u.id))).data().fleet.mothership,0);assert.deepEqual((await a.read(home(u.id))).data().mothershipHangars,[]);assert.equal((await a.read(opPath(u.id,d.id))).exists,false);
});
test('real SDK preserves target Galattica attack',async()=>{
 const u=await seed('galreal');u.planets[0].fleet.deathStar=1;await adminSet(home(u.id),u.planets[0]);await adminSet(room(u.id)+'/galatticheMap/target',{ownerUid:'enemy',coordKey:'1_1_3',destroyed:false});
 const a=client(cp(u));a.W.UniversumData.SHIPS.deathStar={cargo:100000,cost:{metal:1,crystal:1,deuterium:0}};
 const d=await a.G.launchOnlineFleet(a.u,0,target,'destroyGalattica',{deathStar:1},{},{targetGalatticaId:'target'});assert.equal(d.targetGalatticaId,'target');assert.equal((await a.read(opPath(u.id,d.id))).exists,false);
});
test('R15 ack cannot authorize a stale legacy stock checkpoint or direct stock overwrite',async()=>{
 const u=await seed('legacyack',{legacy:true});const {a,p}=await launchLost(u);const b=client(cp(u));
 await b.raw.doc(player(u.id)).update({'ordinaryDispatchReceipt.acknowledged':true});
 const stale=b.raw.batch();stale.update(b.raw.doc(home(u.id)),{fleet:{lightFighter:10},resources:u.planets[0].resources,lastUpdated:Date.now()});stale.update(b.raw.doc(player(u.id)),{points:0,lastSeen:Date.now()});await denied(()=>stale.commit());
 await denied(()=>b.raw.doc(home(u.id)).update({fleet:{lightFighter:10}}));
 await b.raw.doc(home(u.id)).update({'inbox.resources.metal':5});
 const fresh=await b.G.joinOnlineUniverse(u.id,'',{serverOnly:true});b.W.UniversumUI.state.currentUniverse=fresh;
 assert.equal(await b.G.syncPlayerState(fresh,{force:true}),true);const h=(await b.read(home(u.id))).data();assert.equal(h.fleet.lightFighter,7);assert.equal(h.resources.metal,905);
 assert.equal((await b.read(player(u.id))).data().serviceRevision,1);assert.equal((await b.read(opPath(u.id,p.operationId))).exists,true);
});
test('R16 ack cannot authorize a direct versioned stock overwrite',async()=>{
 const u=await seed('versionedack');const {a}=await launchLost(u);await a.raw.doc(player(u.id)).update({'ordinaryDispatchReceipt.acknowledged':true});
 await denied(()=>a.raw.doc(home(u.id)).update({fleet:{lightFighter:10}}));
 await a.raw.doc(home(u.id)).update({'inbox.fleet.lightFighter':1});assert.equal((await a.read(home(u.id))).data().inbox.fleet.lightFighter,1);
});
(async()=>{try{const probe=await fetch(`http://${host}/`,{signal:AbortSignal.timeout(5000)});if(!probe.ok)throw Error(`Emulator health ${probe.status}`);console.log(`SDK=${firebase.SDK_VERSION}; Rules Git blob=${ruleHash}; project=${projectId}`);for(const [name,fn] of cases){try{await fn();console.log('PASS '+name);}catch(e){console.error('FAIL '+name+': '+e.stack);process.exitCode=1;}}}catch(e){console.error('BLOCKED: '+e.stack);process.exitCode=2;}finally{await Promise.allSettled(apps.map(a=>a.delete()));}})();
