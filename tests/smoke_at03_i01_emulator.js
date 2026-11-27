// AT03-I01/I02: structural creation and specialist debit only. Real SDK, isolated loopback Emulator.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const host=process.env.FIRESTORE_EMULATOR_HOST||'';
if(!/^127\.0\.0\.1:[1-9]\d*$/.test(host)){console.error('BLOCKED: FIRESTORE_EMULATOR_HOST must be an IPv4 loopback endpoint.');process.exit(2);}
const projectId='demo-universum-at03-i01';
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
const opPath=(id,op)=>room(id)+'/ordinaryDispatchOps/'+op;
const receipt=(id,op,status='committed')=>({operationId:op,originKey:'1_1_1',expectedRevision:2,terminalRevision:3,profileJoinedAt:1,status,acknowledged:false});
async function seed(label,{legacy=false}={}){
 const id=label+'_'+runId+'_'+(++serial),p={id:'p1',name:'home',ownerUid:uid,coords:origin,fleet:{lightFighter:10},resources:{metal:1000,crystal:1000,deuterium:100000},buildings:{},defenses:{},shipyardQueue:[],buildQueue:[],defenseQueue:[],mothershipHangars:[],lastUpdated:Date.now(),...(legacy?{}:{serviceRevision:2})};
 await adminSet(room(id),{name:id,speed:1,galaxies:3,systemsPerGalaxy:100,founderUid:uid,ownerUid:uid,passcode:'',createdAt:1,playerCount:1});
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
 const W={localStorage:{get length(){return storage.size},key:i=>[...storage.keys()][i]??null,getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},__UniversumMPModules:G,__UniversumMPVariables:{SYNC_MIN_INTERVAL_MS:0,_INBOX_RES_KEYS:['metal','crystal','deuterium'],_syncLastByUni:new Map(),_systemCache:new Map(),_systemPending:new Map(),FLEET_SCHEMA_VERSION:1,_mpErrorToastAt:new Map()},UniversumData:{SHIPS:{lightFighter:{cargo:100000,cost:{metal:3000,crystal:1000,deuterium:0}}}},UniversumGalaxy:{calculateDistance:()=>1,getFleetSpeedAndFuel:()=>({fuelCost:40,durationSec:600})},UniversumMissionsCore:{getMaxFleetSlots:()=>100,getMaxExploreHours:()=>4},fbAuth:{currentUser:{uid:account}}};
 for(const source of sources)new Function('window','firebase',source)(W,firebase);
 W.UniversumUI={state:{currentUniverse:u,isMultiplayerMode:true},startOnlineGame(fresh){this.state.currentUniverse=fresh;this.state.isMultiplayerMode=true;},toast(){}};
 const launch=()=>G.launchOnlineFleet(u,0,target,'attack',{lightFighter:3},{metal:100,crystal:50,deuterium:20});
 return {u,G,W,mode,raw,storage,launch,read:key=>raw.doc(key).get({source:'server'}),fleets:()=>raw.collection(room(u.id)+'/fleets').get({source:'server'})};
}
function gate(){let open;const wait=new Promise(r=>open=r);return{open,wait};}
async function denied(fn){await assert.rejects(fn(),e=>String(e?.code||'').endsWith('permission-denied'),'must reject by actual Firestore Rules, not unrelated error');}
async function launchLost(u){const a=client(cp(u));a.mode.loseOnce=true;await assert.rejects(a.launch(),{code:'ordinary-departure-pending'});const p=JSON.parse(a.storage.get(localKey(u.id)));assert.ok(p.armed);return{a,p};}

function fullClient(model){
 const app=firebase.initializeApp({apiKey:'demo',projectId,appId:'demo-at05'},'at05-'+(++serial));apps.push(app);const raw=app.firestore();raw.settings({experimentalForceLongPolling:true});raw.useEmulator('127.0.0.1',Number(host.split(':')[1]),{mockUserToken:{sub:uid}});
 const doc={addEventListener(){},getElementById(){return null},querySelectorAll(){return []},createElement(){return {getContext(){return {}}}}};const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
 const W={document:doc,navigator:{},addEventListener(){},matchMedia(){return {matches:false,addListener(){}}},localStorage:storage,fbDB:raw,fbAuth:{currentUser:{uid,displayName:'Pilot',email:'pilot@example.invalid'}}};
 const paths=[...fs.readFileSync(path.join(root,'app.html'),'utf8').matchAll(/<script\s+src="\.\/([^" ]+\.js)"(?:\s+defer)?\s*><\/script>/g)].map(x=>x[1]).filter(x=>/^modules\/(data|engine|galaxy|online)\//.test(x)||['data.js','engine-core.js','engine-actions.js','galaxy.js','moon-merchant.js','multiplayer.js','missions-core.js','siege-missions.js'].includes(x));
 for(const name of paths)new Function('window','document','firebase','localStorage','navigator',fs.readFileSync(path.join(root,name),'utf8'))(W,doc,firebase,storage,W.navigator);
 return {G:W.__UniversumMPModules,W,u:cp(model),raw,read:k=>raw.doc(k).get({source:'server'})};
}
async function adminUpdate(key,changes){const query=Object.keys(changes).map(k=>'updateMask.fieldPaths='+encodeURIComponent(k)).join('&');const res=await fetch(`http://${host}/v1/projects/${projectId}/databases/(default)/documents/${key}?${query}`,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:fields(changes)}),signal:AbortSignal.timeout(10000)});if(!res.ok)throw Error('Emulator update '+res.status+' '+await res.text());}
function fleet(patch={}) {
 const now=Date.now();return {schemaVersion:1,attackerUid:uid,attackerName:'Pilot',defenderUid:'enemy',originCoords:origin,originKey:'1_1_1',targetCoords:target,targetKey:'1_1_3',mission:'attack',status:'outbound',phase:'IN VIAGGIO',resolved:false,departureTime:now,arrivalTime:now+600000,returnTime:now+1200000,ships:{lightFighter:3},fleet:{lightFighter:3},cargo:{metal:0,crystal:0,deuterium:0},...patch};
}
const cases=[]; const test=(name,fn)=>cases.push([name,fn]);
// Use a complete transaction and valid AT05 terminal record, changing just the AT03 field under examination.
async function ordinary(label,patch,extra={}) {
 const u=await seed(label),c=client(cp(u)),id='residual-'+label, h=(await c.read(home(u.id))).data();
 const r={operationId:id,originKey:'1_1_1',expectedRevision:2,terminalRevision:3,profileJoinedAt:1,profileCreatedAt:null,status:'committed',acknowledged:false};
 const f=fleet(patch);if(extra.noAlias)delete f.fleet;const debit={metal:f.cargo.metal,crystal:f.cargo.crystal,deuterium:40+Math.ceil(Math.max(0,f.cargo.deuterium))};
 if(extra.debit)Object.assign(debit,extra.debit);
 const resources=Object.fromEntries(Object.entries(h.resources).map(([k,v])=>[k,Math.max(0,v-debit[k])]));
 const batch=c.raw.batch(), fp=room(u.id)+'/fleets/'+id;
 batch.set(c.raw.doc(fp),f); batch.update(c.raw.doc(player(u.id)),{serviceRevision:3,ordinaryDispatchReceipt:r});
 batch.update(c.raw.doc(home(u.id)),{serviceRevision:3,ordinaryDispatchId:id,lastUpdated:Date.now(),fleet:{lightFighter:7},resources});
 batch.set(c.raw.doc(room(u.id)+'/ordinaryDispatchOps/'+id),{uid,receipt:r,proof:{shipsBefore:{lightFighter:10},resourcesBefore:h.resources,resourcesDebit:debit}});
 try{await batch.commit();}catch(e){if(String(e?.code||'').endsWith('permission-denied')){assert.deepEqual((await c.read(home(u.id))).data(),h);assert.equal((await c.read(player(u.id))).data().serviceRevision,2);assert.equal((await c.read(fp)).exists,false);assert.equal((await c.read(opPath(u.id,id))).exists,false);}throw e;}const snap=await c.read(fp);assert(snap.exists);return {fleet: snap.data(),home:(await c.read(home(u.id))).data().resources};
}

const rejectOrd=(name,patch)=>test(name,()=>denied(()=>ordinary(name.replace(/[^a-zA-Z0-9]/g,''),patch)));
rejectOrd('AT03-R01 original incoherent origin coordinates',{originCoords:{g:1,s:1,p:2}});
rejectOrd('AT03-R02 original incoherent target coordinates',{targetCoords:{g:1,s:2,p:3}});
rejectOrd('AT03-R03 original wrong defender',{defenderUid:'unrelated'});
rejectOrd('AT03-R04 original negative cargo',{cargo:{metal:0,crystal:0,deuterium:-1}});
rejectOrd('AT03-R05 original return before departure',{returnTime:1});
rejectOrd('AT03-R06 original colonize without colony ship',{mission:'colonize',targetCoords:{g:1,s:1,p:4},targetKey:'1_1_4',defenderUid:null});
rejectOrd('AT03-R07 original mismatched alias',{fleet:{lightFighter:4}});
rejectOrd('R02 outside configured galaxies',{targetCoords:{g:4,s:1,p:1},targetKey:'4_1_1',defenderUid:null});
rejectOrd('R02 outside configured systems',{targetCoords:{g:1,s:101,p:1},targetKey:'1_101_1',defenderUid:null});
rejectOrd('R02 noninteger coordinates',{targetCoords:{g:1,s:1,p:3.5},targetKey:'1_1_3.5',defenderUid:null});
rejectOrd('R02 position outside game domain',{targetCoords:{g:1,s:1,p:17},targetKey:'1_1_17',defenderUid:null});
rejectOrd('R03 null defender on occupied human planet',{defenderUid:null});
rejectOrd('R03 defender on empty slot',{targetCoords:{g:1,s:1,p:4},targetKey:'1_1_4'});
rejectOrd('R04 fractional cargo',{cargo:{metal:0,crystal:0,deuterium:0.5}});
rejectOrd('R04 unknown cargo key',{cargo:{metal:0,crystal:0,deuterium:0,invalid:0}});
rejectOrd('R05 return between departure and arrival',{returnTime:Date.now()+10000});
for(const mission of ['spy','recycle','destroyMoon'])rejectOrd('R06 missing required ship '+mission,{mission});
async function npcWrite(label,patch={}){
 const u=await seed(label),c=client(cp(u)),now=Date.now();const doc=fleet({attackerUid:'npc_raid_demo',defenderUid:uid,targetKey:'1_1_1',targetCoords:origin,originCoords:{g:1,s:1,p:7},departureTime:now,arrivalTime:now+60000,returnTime:now+60000,...patch});delete doc.originKey;
 const ref=c.raw.doc(room(u.id)+'/fleets/npc_raid_pilot_123');await ref.set(doc);assert((await ref.get({source:'server'})).exists);
}
test('AT03-R09 original negative NPC quantity',()=>denied(()=>npcWrite('npcneg',{ships:{lightFighter:-1},fleet:{lightFighter:-1}})));
test('R09 fractional NPC quantity',()=>denied(()=>npcWrite('npcfrac',{ships:{lightFighter:1.5},fleet:{lightFighter:1.5}})));
test('R09 unsupported NPC class',()=>denied(()=>npcWrite('npcclass',{ships:{deathStar:1},fleet:{deathStar:1}})));
test('R09 empty NPC fleet',()=>denied(()=>npcWrite('npcempty',{ships:{},fleet:{}})));
test('Regression: false special labels cannot exempt an ordinary dispatch',async()=>{
 const u=await seed('labels'),c=client(cp(u));
 await adminSet(room(u.id)+'/planets/1_1_2',{id:'own',ownerUid:uid,coords:{g:1,s:1,p:2}});
 for(const [id,patch] of [['fake-target',{targetGalatticaId:'fake'}],['fake-dock',{ships:{lightFighter:3,invictus:1},originPlanetId:'p1',birthBacinoAt:1}],['fake-hangar',{carrierHangars:[{id:'fake',fighters:0}]}],['zero-special',{ships:{lightFighter:3,hephaestusForge:0},mission:'deploy',targetKey:'1_1_2',targetCoords:{g:1,s:1,p:2},defenderUid:uid}]]){
  const f=fleet(patch);f.fleet=f.ships;await denied(()=>c.raw.doc(room(u.id)+'/fleets/'+id).set(f));
 }
 assert.equal((await c.fleets()).size,0);
});
test('R07 normal alias omitted',()=>ordinary('noalias',{}, {noAlias:true}));
test('R07 normal alias matches',()=>ordinary('aliasok',{}));
test('R09 normal raid equality of arrival/return and synthetic origin',()=>npcWrite('npcok',{ships:{lightFighter:150,heavyFighter:60,cruiser:30,battleship:30,bomber:30},fleet:{lightFighter:150,heavyFighter:60,cruiser:30,battleship:30,bomber:30}}));
for(const [mission,ship] of [['colonize','colonyShip'],['spy','espionageProbe'],['recycle','recycler'],['destroyMoon','deathStar']])test('R06 legitimate '+mission,async()=>{
 const u=await seed('valid'+mission);u.planets[0].fleet[ship]=2;await adminSet(home(u.id),u.planets[0]);const a=client(cp(u));a.W.UniversumData.SHIPS[ship]={cargo:100000,cost:{metal:1,crystal:1,deuterium:0}};
 const to=mission==='colonize'?{g:1,s:1,p:4}:target;const d=await a.G.launchOnlineFleet(a.u,0,to,mission,{[ship]:1},{});assert.ok(d.id);assert.equal((await a.read(home(u.id))).data().fleet[ship],1);
});
test('R03 NPC target with null owner',async()=>{const u=await seed('npctarget'),c=client(cp(u));await adminSet(room(u.id)+'/planets/1_1_3',{id:'npc',ownerUid:null,isNpc:true,coords:target});const d=await c.launch();assert.equal((await c.read(room(u.id)+'/fleets/'+d.id)).data().defenderUid,null);});
test('Legacy planet/profile without revision: new valid departure',async()=>{const u=await seed('legacy',{legacy:true});const c=client(cp(u));const d=await c.launch();assert.ok(d.id);assert.equal((await c.read(home(u.id))).data().fleet.lightFighter,7);});
test('Legacy fleet read and legitimate update with no new schema requirements',async()=>{const u=await seed('legacydoc'),c=client(cp(u)),key=room(u.id)+'/fleets/legacy';const f=fleet();delete f.originKey;delete f.ships;delete f.returnTime;await adminSet(key,f);await c.raw.doc(key).update({schemaVersion:2});assert.equal((await c.read(key)).data().schemaVersion,2);});
test('Real NPC launch using unmodified bot generator, four levels',async()=>{
 for(const level of [1,2,3,4]){const u=await seed('bot'+level),a=fullClient(u);const original=Math.random;try{Math.random=()=>0;await a.G.maybeLaunchBotRaid(u.id,{level,raids:true,personality:{hostile:100}});}finally{Math.random=original;}const q=await a.raw.collection(room(u.id)+'/fleets').get({source:'server'});assert.equal(q.size,1);const d=q.docs[0].data();assert.equal(d.defenderUid,uid);assert.equal(d.returnTime,d.arrivalTime);assert.deepEqual(d.fleet,d.ships);}
});
test('ordinary mixed fleet of all selectable ship classes fits Rules evaluation budget',async()=>{
 const u=await seed('mixed');const ids=['smallCargo','largeCargo','lightFighter','heavyFighter','cruiser','battleship','bomber','battlecruiser','colonyShip','recycler','espionageProbe','mothership','deathStar'];
 u.planets[0].fleet=Object.fromEntries(ids.map(id=>[id,10]));await adminSet(home(u.id),u.planets[0]);
 const a=client(cp(u));for(const id of ids)a.W.UniversumData.SHIPS[id]={cargo:100000,cost:{metal:1,crystal:1,deuterium:0}};
 const d=await a.G.launchOnlineFleet(a.u,0,target,'attack',Object.fromEntries(ids.map(id=>[id,1])),{});
 assert.ok(d.id);const h=(await a.read(home(u.id))).data();for(const id of ids)assert.equal(h.fleet[id],9);
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
test('D05 supplemental: real complete game engine, two SDK clients, Schiera mixed and moving Galattica',async()=>{
 const model=JSON.parse(JSON.stringify(require(path.join(root,'tests/helpers/game.js')).uni(2)));Object.assign(model,{id:'d05_'+runId,serviceRevision:0,emperor:'Pilot'});const [h,d]=model.planets;for(const p of model.planets)Object.assign(p,{ownerUid:uid,ownerName:'Pilot',maxTemp:34,fieldsMax:240,lastUpdated:Date.now()});h.bacinoSpaziale={status:'active',startedAt:123,invictusActive:1,crepuscolo:{status:'active'}};h.fleet={mothership:1,largeCargo:3};h.mothershipHangars=[{id:'mother_smoke',fighters:22}];
 const base=room(model.id),href=base+'/planets/1_1_2',dref=base+'/planets/1_2_2';await adminSet(base,{speed:1});await adminSet(player(model.id),{uid,serviceRevision:0,researches:model.researches});for(const p of model.planets)await adminSet(base+'/planets/'+[p.coords.g,p.coords.s,p.coords.p].join('_'),p);
 const a=fullClient(model),b=fullClient(model);const f=await a.G.launchOnlineFleet(a.u,0,a.u.planets[1].coords,'deploy',{mothership:1,largeCargo:3,invictus:1,crepuscolo:1},{metal:57},{});const fp=base+'/fleets/'+f.id;assert.equal((await a.read(href)).data().bacinoSpaziale.invictusActive,0);
 const resolve=async(c,key)=>{const snap=await c.read(key);c.G.getLiveFleetDocs=()=>[snap];await c.G.resolveArrivedOnlineFleets(model.id,1);};await adminUpdate(fp,{arrivalTime:Date.now()-1,returnTime:Date.now()+60000});await Promise.all([resolve(a,fp),resolve(b,fp)]);const returning=(await a.read(fp)).data();assert.equal(returning.status,'returning');assert.deepEqual(returning.ships,{invictus:1,crepuscolo:1});const ib=(await a.read(dref)).data().inbox;assert.equal(ib.hangarReturns[f.id][0].fighters,22);assert.equal(ib.resources.metal,57);await adminUpdate(fp,{arrivalTime:Date.now()-100,returnTime:Date.now()-100});await Promise.all([resolve(a,fp),resolve(b,fp)]);await resolve(a,fp);assert.equal((await a.read(fp)).data().resolved,true);
 await a.G.syncPlayerState(a.u,{force:true});await a.G.syncPlayerState(a.u,{force:true});const hp=(await a.read(href)).data(),dp=(await a.read(dref)).data();assert.equal(hp.bacinoSpaziale.invictusActive,1);assert.equal(hp.bacinoSpaziale.crepuscolo.status,'active');assert.equal(dp.fleet.mothership,1);assert.equal(dp.fleet.largeCargo,3);assert.equal(dp.mothershipHangars[0].id,'mother_smoke');assert.equal(dp.mothershipHangars[0].fighters,22);assert.equal(dp.fleet.invictus,undefined);assert.equal(hp.inbox,undefined);console.log('PASS D05 Schiera mixed: exactly one cargo/carrier credit and return of dock units');
 const gal={id:'g1',name:'Vega',coords:{g:1,s:3,p:2},resources:{metal:500,crystal:0,deuterium:1e8},orbitingFleet:{mothership:1},mothershipHangars:[{id:'orbital',fighters:19}],defenses:{}};a.u.galattiche=[gal];const flight=await a.G.launchGalattica(a.u,'g1',{g:1,s:7,p:2},'transport',{mothership:1},{metal:42});await a.G.jumpOnlineGalattica(a.u,'g1',{g:1,s:8,p:2});const gf=base+'/fleets/'+flight.id,gr=base+'/galattiche/pilot~g1';assert.equal((await a.read(gr)).data().state.coords.s,8);const due=()=>adminUpdate(gf,{status:'returning',returnTime:Date.now()-100,arrivalTime:Date.now()-100});await due();await Promise.all([resolve(a,gf),resolve(b,gf)]);assert.equal((await a.read(gf)).data().galatticaReturn,true);await due();await Promise.all([resolve(a,gf),resolve(b,gf)]);await resolve(a,gf);assert.equal((await a.read(gf)).data().resolved,true);const settled=(await a.read(gr)).data().state;assert.equal(settled.resources.metal,500);assert.equal(settled.orbitingFleet.mothership,1);assert.deepEqual(settled.mothershipHangars,[{id:'orbital',fighters:19}]);console.log('PASS D05 moving Galattica: exactly one hull, hangar and cargo return');
});
const ids=['smallCargo','largeCargo','lightFighter','heavyFighter','cruiser','battleship','bomber','battlecruiser','colonyShip','recycler','espionageProbe','mothership','deathStar'];
const stock=()=>Object.fromEntries(ids.map(id=>[id,10]));
function supply(a){for(const id of ids)a.W.UniversumData.SHIPS[id]={cargo:100000,cost:{metal:1,crystal:1,deuterium:0}};}
async function big(n){
 const u=await seed('scale'+n); u.planets[0].fleet=stock(); await adminSet(home(u.id),u.planets[0]);
 for(let start=1;start<n;start+=10){const todo=[];for(let i=start;i<Math.min(n,start+10);i++){
  const p={...cp(u.planets[0]),id:'p'+(i+1),name:'colony '+i,coords:{g:1,s:i+1,p:1},fleet:{lightFighter:10}};u.planets.push(p);
  todo.push(adminSet(room(u.id)+'/planets/1_'+(i+1)+'_1',{...p,...(i===n-1?{inbox:{resources:{metal:17},fleet:{lightFighter:2}}}:{})}));
 }await Promise.all(todo);}
 return u;
}
for(const n of [60])test('Scale '+n+' owned planets, 13 ordinary classes, competing launch and recovery',async()=>{
 const u=await big(n),a=client(cp(u)),b=client(cp(u));supply(a);supply(b);
 const selection=Object.fromEntries(ids.map(id=>[id,1]));const launch=c=>c.G.launchOnlineFleet(c.u,0,target,'attack',selection,{metal:100,crystal:50,deuterium:20});
 const t=Date.now();const outcomes=await Promise.allSettled([launch(a),launch(b)]);const good=outcomes.filter(x=>x.status==='fulfilled');assert.equal(good.length,1,JSON.stringify(outcomes.map(x=>x.status==='rejected'?{code:x.reason.code,message:x.reason.message}:x.status)));assert.equal((await a.fleets()).size,1);const h=(await a.read(home(u.id))).data();for(const id of ids)assert.equal(h.fleet[id],9,id);assert.deepEqual(h.resources,{metal:900,crystal:950,deuterium:99940});
 const last=(await a.read(room(u.id)+'/planets/1_'+n+'_1')).data();assert.equal(last.resources.metal,1017);assert.equal(last.fleet.lightFighter,12);assert.equal(last.inbox,undefined);const pr=(await a.read(player(u.id))).data();assert.equal(pr.serviceRevision,3);
 const c=outcomes[0].status==='fulfilled'?a:b;const fresh=await c.G.joinOnlineUniverse(u.id,'',{serverOnly:true,operationId:good[0].value.id});assert.equal(fresh.planets.length,n);assert.equal(fresh.fleetsInFlight.length,1);console.log('METRIC scale planets='+n+' elapsed_ms='+(Date.now()-t));
});


test('Real expedition to position 16 preserves complete timeline',async()=>{
 const u=await seed('expedition');u.planets[0].fleet.lightFighter=10;const a=client(cp(u));new Function('window',fs.readFileSync(path.join(root,'missions-core.js'),'utf8'))(a.W);
 const d=await a.G.launchOnlineFleet(a.u,0,{g:1,s:1,p:16},'explore',{lightFighter:3},{metal:0,crystal:0,deuterium:20},{blackHole:true,exploreHours:1});
 const f=(await a.read(room(u.id)+'/fleets/'+d.id)).data();assert.equal(f.targetKey,'1_1_16');assert.equal(f.mission,'expedition');assert.equal(f.returnTime-f.arrivalTime,600000);assert.equal(f.arrivalTime-f.zoneArrivalTime,3600000);
});
for(const [specialists,carrier] of [[true,true],[false,true],[false,false]])test('Maximum legitimate special mixed fleet, '+(specialists?17:carrier?15:14)+' classes and two own planets',async()=>{
 const model=JSON.parse(JSON.stringify(require(path.join(root,'tests/helpers/game.js')).uni(2)));Object.assign(model,{id:'maxspecial_'+(specialists?'17':carrier?'15':'14')+'_'+runId,serviceRevision:0,emperor:'Pilot'});
 const [h,d]=model.planets;for(const p of model.planets)Object.assign(p,{ownerUid:uid,ownerName:'Pilot',maxTemp:34,fieldsMax:240,lastUpdated:Date.now()});
 const keys=['smallCargo','largeCargo','lightFighter','heavyFighter','cruiser','battleship','bomber','battlecruiser','colonyShip','recycler','espionageProbe','mothership','deathStar','hephaestusForge','prometheusOracle','invictus','crepuscolo'];
 const selection=keys.filter(k=>(specialists||!['hephaestusForge','prometheusOracle'].includes(k))&&(carrier||k!=='mothership'));h.fleet=Object.fromEntries(selection.filter(k=>!['invictus','crepuscolo'].includes(k)).map(k=>[k,1]));h.mothershipHangars=carrier?[{id:'max_mother',fighters:20}]:[];h.bacinoSpaziale={status:'active',startedAt:123,invictusActive:1,crepuscolo:{status:'active'}};
 const base=room(model.id);await adminSet(base,{speed:1,galaxies:3,systemsPerGalaxy:100});await adminSet(player(model.id),{uid,serviceRevision:0,researches:model.researches});for(const p of model.planets)await adminSet(base+'/planets/'+[p.coords.g,p.coords.s,p.coords.p].join('_'),p);
 const a=fullClient(model);const f=await a.G.launchOnlineFleet(a.u,0,d.coords,'deploy',Object.fromEntries(selection.map(k=>[k,1])),{});assert.equal(Object.keys((await a.read(base+'/fleets/'+f.id)).data().ships).length,selection.length);
});
test('Forced Galattica return with equal arrival and return times',async()=>{
 const model=JSON.parse(JSON.stringify(require(path.join(root,'tests/helpers/game.js')).uni(2)));Object.assign(model,{id:'galforced_'+runId,serviceRevision:0,emperor:'Pilot'});const [h,d]=model.planets;for(const p of model.planets)Object.assign(p,{ownerUid:uid,ownerName:'Pilot',maxTemp:34,fieldsMax:240,lastUpdated:Date.now()});
 const base=room(model.id);await adminSet(base,{speed:1,galaxies:3,systemsPerGalaxy:100});await adminSet(player(model.id),{uid,serviceRevision:0,researches:model.researches});for(const p of model.planets)await adminSet(base+'/planets/'+[p.coords.g,p.coords.s,p.coords.p].join('_'),p);
 const a=fullClient(model),gal={id:'g1',name:'Vega',coords:{g:1,s:3,p:2},resources:{metal:500,crystal:0,deuterium:1e11},orbitingFleet:{mothership:2,lightFighter:10},mothershipHangars:[{id:'forced1',fighters:19},{id:'forced2',fighters:21}],defenses:{}};
 // Persist the Galattica before jump. Choose a free procedural origin to exercise the exact forced-return branch.
 for(let s=3;s<100;s++){gal.coords.s=s;if(a.W.UniversumGalaxy.generateProceduralSlot(a.u,1,s,2).ownerType!=='bot')break;}
 a.u.galattiche=[gal];await a.G.syncPlayerState(a.u,{force:true});const oldS=gal.coords.s;let to={g:1,s:oldS+1,p:2};for(let s=oldS+1;s<100;s++){to={g:1,s,p:2};const slot=a.W.UniversumGalaxy.generateProceduralSlot(a.u,1,s,2);if(!slot.moon&&!slot.bacinoSpaziale)break;}
 await a.G.jumpOnlineGalattica(a.u,'g1',to);const q=await a.raw.collection(base+'/fleets').get({source:'server'});assert.equal(q.size,1);const f=q.docs[0].data();assert.equal(f.mission,'deploy');assert.equal(f.galatticaReturn,true);assert.equal(f.arrivalTime,f.returnTime);assert.equal(f.defenderUid,uid);
});
// AT03-I02: negative cases use the real Rules and assert rollback of the entire batch.
async function specialistFixture(label,stock={},options={}){
 const u=await seed('i02_'+label,{legacy:options.legacy||false});
 const h=u.planets[0];Object.assign(h.fleet,stock);if(options.inbox)h.inbox=options.inbox;
 const own={...cp(h),id:'p2',coords:{g:1,s:1,p:2},fleet:{}};delete own.inbox;
 await adminSet(home(u.id),h);await adminSet(room(u.id)+'/planets/1_1_2',own);u.planets.push(own);
 const a=client(cp(u));a.W.UniversumServices={ids:['hephaestusForge','prometheusOracle'],forge:'hephaestusForge',oracle:'prometheusOracle',transfer:(u,m,t,ships)=>Boolean(ships.hephaestusForge||ships.prometheusOracle),settlePlanet:()=>{}};
 for(const id of ['hephaestusForge','prometheusOracle'])a.W.UniversumData.SHIPS[id]={cargo:100000,cost:{metal:1,crystal:1,deuterium:0}};
 return {u,a,own};
}
function specialistDoc(ships={hephaestusForge:1},patch={}){return fleet({defenderUid:uid,targetCoords:{g:1,s:1,p:2},targetKey:'1_1_2',mission:'deploy',ships,fleet:ships,...patch});}
async function specialBatch(x,{ships={hephaestusForge:1},originUpdate,register=true,ids=['new1'],registry,patch={}}={}){
 const {u,a}=x,base=room(u.id),b=a.raw.batch(),p=(await a.read(player(u.id))).data();
 if(originUpdate)b.update(a.raw.doc(home(u.id)),{...originUpdate,...(p.serviceRevision===undefined?{}:{serviceRevision:p.serviceRevision+1})});
 if(register)b.update(a.raw.doc(player(u.id)),{specialistFlights:registry??[...(p.specialistFlights||[]),...ids],...(p.serviceRevision===undefined?{}:{serviceRevision:p.serviceRevision+1})});
 for(const id of ids)b.set(a.raw.doc(base+'/fleets/'+id),specialistDoc(ships,patch));
 return b.commit();
}
async function deniedUnchanged(x,run){
 const {u,a}=x;const snapshot=async()=>({home:(await a.read(home(u.id))).data(),player:(await a.read(player(u.id))).data(),flights:(await a.fleets()).docs.map(s=>[s.id,s.data()])});
 const before=await snapshot();await denied(run);assert.deepEqual(await snapshot(),before,'denied batch must not change stock, profile or flights');
}
test('I02 R08 original specialist absent, standalone create',async()=>{
 const x=await specialistFixture('absent');await deniedUnchanged(x,()=>x.a.raw.doc(room(x.u.id)+'/fleets/standalone').set(specialistDoc()));
});
test('I02 existing stock but standalone create',async()=>{const x=await specialistFixture('standalone',{hephaestusForge:1});await deniedUnchanged(x,()=>x.a.raw.doc(room(x.u.id)+'/fleets/standalone').set(specialistDoc()));});
test('I02 registered flight without stock debit',async()=>{const x=await specialistFixture('nodebit',{hephaestusForge:2});await deniedUnchanged(x,()=>specialBatch(x));});
test('I02 debit without existing profile flight registration',async()=>{const x=await specialistFixture('noreg',{hephaestusForge:2},{legacy:true});await deniedUnchanged(x,()=>specialBatch(x,{originUpdate:{'fleet.hephaestusForge':1},register:false}));});
test('I02 insufficient stock cannot be clamped to zero',async()=>{const x=await specialistFixture('understock',{hephaestusForge:1});await deniedUnchanged(x,()=>specialBatch(x,{ships:{hephaestusForge:2},originUpdate:{'fleet.hephaestusForge':0}}));});
test('I02 partial debit cannot authorize two specialists',async()=>{const x=await specialistFixture('partial',{hephaestusForge:2,prometheusOracle:1});await deniedUnchanged(x,()=>specialBatch(x,{ships:{hephaestusForge:1,prometheusOracle:1},originUpdate:{'fleet.hephaestusForge':1}}));});
test('I02 two IDs cannot reuse one debit',async()=>{const x=await specialistFixture('twoids',{hephaestusForge:2});await deniedUnchanged(x,()=>specialBatch(x,{ids:['new1','new2'],originUpdate:{'fleet.hephaestusForge':1}}));});
test('I02 negative inbox is not a debit',async()=>{const x=await specialistFixture('negativeinbox',{hephaestusForge:1});await deniedUnchanged(x,()=>specialBatch(x,{originUpdate:{'inbox.fleet.hephaestusForge':-1}}));});
test('I02 pending credit cannot be retained after debit',async()=>{const x=await specialistFixture('keepinbox',{hephaestusForge:1},{inbox:{fleet:{hephaestusForge:1}}});await deniedUnchanged(x,()=>specialBatch(x,{originUpdate:{'fleet.hephaestusForge':1}}));});
test('I02 pending loss must reduce available stock',async()=>{const x=await specialistFixture('loss',{hephaestusForge:1},{inbox:{fleet:{hephaestusForge:-1}}});await deniedUnchanged(x,()=>specialBatch(x,{originUpdate:{'fleet.hephaestusForge':0,inbox:firebase.firestore.FieldValue.delete()}}));});
test('I02 already registered ID cannot authorize another create',async()=>{const x=await specialistFixture('oldid',{hephaestusForge:2});await adminUpdate(player(x.u.id),{specialistFlights:['new1']});await deniedUnchanged(x,()=>specialBatch(x,{originUpdate:{'fleet.hephaestusForge':1},registry:['new1']}));});
test('I02 fake hangar/dock fields do not bypass specialist debit',async()=>{const x=await specialistFixture('exempt',{hephaestusForge:1});await deniedUnchanged(x,()=>specialBatch(x,{ships:{hephaestusForge:1,mothership:1,invictus:1},patch:{carrierHangars:[{id:'fake',fighters:0}],originPlanetId:'p1',birthBacinoAt:1}}));});
for(const [mission,ships] of [['deploy',{hephaestusForge:1}],['transport',{prometheusOracle:1}],['deploy',{hephaestusForge:1,prometheusOracle:1,lightFighter:3}]])test('I02 actual SDK '+mission+' '+Object.keys(ships).join('+'),async()=>{
 const x=await specialistFixture('positive',{hephaestusForge:2,prometheusOracle:2});const {a,u,own}=x;
 const d=await a.G.launchOnlineFleet(a.u,0,own.coords,mission,ships,{});
 const h=(await a.read(home(u.id))).data(),p=(await a.read(player(u.id))).data();for(const [id,n] of Object.entries(ships))assert.equal(h.fleet[id],u.planets[0].fleet[id]-n,id);assert.deepEqual(p.specialistFlights,[d.id]);assert.equal((await a.read(opPath(u.id,d.id))).exists,false);
});
test('I02 existing pending credit is consumed with correct net stock',async()=>{const x=await specialistFixture('credit',{hephaestusForge:1},{inbox:{fleet:{hephaestusForge:1}}});const {a,u,own}=x;const d=await a.G.launchOnlineFleet(a.u,0,own.coords,'deploy',{hephaestusForge:1},{});const h=(await a.read(home(u.id))).data();assert.equal(h.fleet.hephaestusForge,1);assert.equal(h.inbox,undefined);assert.deepEqual((await a.read(player(u.id))).data().specialistFlights,[d.id]);});
test('I02 legacy unversioned specialist transfer uses existing registry',async()=>{const x=await specialistFixture('legacy',{hephaestusForge:1},{legacy:true});const {a,u,own}=x;await adminUpdate(player(u.id),{specialistFlights:['old']});const d=await a.G.launchOnlineFleet(a.u,0,own.coords,'transport',{hephaestusForge:1},{});assert.equal((await a.read(home(u.id))).data().fleet.hephaestusForge,0);const p=(await a.read(player(u.id))).data();assert.deepEqual(p.specialistFlights,['old',d.id]);assert.equal(p.serviceRevision,undefined);});
test('I02 two real SDK clients compete for last specialist',async()=>{
 const x=await specialistFixture('compete',{hephaestusForge:1});const y=client(cp(x.u));y.W.UniversumServices=x.a.W.UniversumServices;y.W.UniversumData.SHIPS=x.a.W.UniversumData.SHIPS;
 // A conflict reload is a UI concern, not part of this test.
 x.a.W.UniversumUI=undefined;y.W.UniversumUI=undefined;
 const run=a=>a.G.launchOnlineFleet(a.u,0,x.own.coords,'deploy',{hephaestusForge:1},{});const out=await Promise.allSettled([run(x.a),run(y)]);assert.equal(out.filter(r=>r.status==='fulfilled').length,1,JSON.stringify(out.map(r=>r.status==='rejected'?r.reason.message:r.status)));assert.equal((await x.a.fleets()).size,1);assert.equal((await x.a.read(home(x.u.id))).data().fleet.hephaestusForge,0);assert.equal((await x.a.read(player(x.u.id))).data().specialistFlights.length,1);
});
test('I02 legacy active specialist flight can still be resolved/updated',async()=>{const x=await specialistFixture('inflight');const path=room(x.u.id)+'/fleets/old';await adminSet(path,specialistDoc());await x.a.raw.doc(path).update({schemaVersion:2});assert.equal((await x.a.read(path)).data().schemaVersion,2);});
// These batches contain valid stock/registry writes so I01 quantity checks
// cannot appear to pass solely because the new R08 admission is missing.
for(const [label,ships] of [['zero',{hephaestusForge:0,lightFighter:1}],['negative',{hephaestusForge:-1}],['fraction',{hephaestusForge:0.5}],['unknown',{hephaestusForge:1,unknownShip:1}],['other fraction',{hephaestusForge:1,lightFighter:0.5}]])test('I02 I01 quantity gate '+label,async()=>{
 const x=await specialistFixture('quantity',{hephaestusForge:2});const q=ships.hephaestusForge;
 await deniedUnchanged(x,()=>specialBatch(x,{ships,originUpdate:{'fleet.hephaestusForge':2-q}}));
});
test('I02 registered exact atomic batch with existing active reference',async()=>{
 const x=await specialistFixture('atomic',{hephaestusForge:2,prometheusOracle:1});const {a,u}=x;
 await adminUpdate(player(u.id),{specialistFlights:['existing']});
 await specialBatch(x,{ships:{hephaestusForge:1,prometheusOracle:1},originUpdate:{'fleet.hephaestusForge':1,'fleet.prometheusOracle':0}});
 assert.equal((await a.fleets()).size,1);const h=(await a.read(home(u.id))).data();assert.equal(h.fleet.hephaestusForge,1);assert.equal(h.fleet.prometheusOracle,0);assert.deepEqual((await a.read(player(u.id))).data().specialistFlights,['existing','new1']);
});
async function fullSpecialistWorld(label,n=2){
 const model=cp(require(path.join(root,'tests/helpers/game.js')).uni(2));Object.assign(model,{id:'i02_'+label+'_'+runId+'_'+(++serial),serviceRevision:0,emperor:'Pilot',speed:1,createdAt:Date.now(),lastSeen:Date.now(),specialistBuilt:{hephaestusForge:1,prometheusOracle:1}});
 Object.assign(model.researches,{impulseDrive:3,computerTech:10});
 for(let k=2;k<n;k++){const p=cp(model.planets[1]);p.id='colony'+k;p.name=p.id;p.coords={g:1,s:k+1,p:2};model.planets.push(p);}
 for(const p of model.planets)Object.assign(p,{ownerUid:uid,ownerName:'Pilot',maxTemp:34,fieldsMax:240,lastUpdated:Date.now(),isNpc:false});
 const base=room(model.id);await adminSet(base,{founderUid:uid,ownerUid:uid,name:label,speed:1,galaxies:3,systemsPerGalaxy:100});
 return {model,base,href:base+'/planets/1_1_2',dref:base+'/planets/1_2_2'};
}
async function persistFullFixture(x){
 const {model,base}=x;await adminSet(player(model.id),{uid,serviceRevision:0,joinedAt:1,nickname:'Pilot',researches:model.researches,specialistBuilt:model.specialistBuilt,specialistFlights:[],serviceCheckpoint:Date.now(),researchModelVersion:1,checkpointPlanets:model.planets.map(p=>[p.coords.g,p.coords.s,p.coords.p].join('_'))});
 for(let start=0;start<model.planets.length;start+=10)await Promise.all(model.planets.slice(start,start+10).map(p=>adminSet(base+'/planets/'+[p.coords.g,p.coords.s,p.coords.p].join('_'),p)));
}
async function resolveTwice(a,b,base,fp,speed=1){
 const resolve=async(c)=>{const snap=await c.read(fp);c.G.getLiveFleetDocs=()=>[snap];await c.G.resolveArrivedOnlineFleets(base.split('/').pop(),speed);};
 await Promise.all([resolve(a),resolve(b)]);await resolve(a);
}
for(const mission of ['deploy','transport'])test('I02 full engine '+mission+' with concurrent resolver and reconciliation',async()=>{
 const x=await fullSpecialistWorld(mission);const {model,base,href,dref}=x;model.planets[0].fleet={hephaestusForge:1,prometheusOracle:1,largeCargo:2};await persistFullFixture(x);
 const a=fullClient(model),b=fullClient(model);const f=await a.G.launchOnlineFleet(a.u,0,model.planets[1].coords,mission,{hephaestusForge:1,prometheusOracle:1,largeCargo:1},{metal:100});const fp=base+'/fleets/'+f.id;
 let h=(await a.read(href)).data();assert.equal(h.fleet.hephaestusForge,0);assert.equal(h.fleet.prometheusOracle,0);assert.equal(h.fleet.largeCargo,1);assert.deepEqual((await a.read(player(model.id))).data().specialistFlights,[f.id]);
 await adminUpdate(fp,{arrivalTime:Date.now()-1,returnTime:Date.now()+60000});await resolveTwice(a,b,base,fp);let flight=(await a.read(fp)).data();const delivered=(await a.read(dref)).data();assert.equal(delivered.inbox.resources.metal,100);
 if(mission==='deploy'){assert.equal(flight.resolved,true);assert.equal(delivered.inbox.fleet.hephaestusForge,1);assert.equal(delivered.inbox.fleet.prometheusOracle,1);assert.equal(delivered.inbox.fleet.largeCargo,1);}
 else {assert.equal(flight.status,'returning');assert.equal(delivered.inbox.fleet?.hephaestusForge||0,0);assert.equal(flight.ships.hephaestusForge,1);await adminUpdate(fp,{returnTime:Date.now()-1});await resolveTwice(a,b,base,fp);flight=(await a.read(fp)).data();assert.equal(flight.resolved,true);h=(await a.read(href)).data();assert.equal(h.inbox.fleet.hephaestusForge,1);assert.equal(h.inbox.fleet.prometheusOracle,1);assert.equal(h.inbox.fleet.largeCargo,1);}
 const fresh=await a.G.joinOnlineUniverse(model.id);await a.G.syncPlayerState(fresh,{force:true});await a.G.syncPlayerState(fresh,{force:true});
 h=(await a.read(href)).data();const d=(await a.read(dref)).data();assert.equal(h.inbox,undefined);assert.equal(d.inbox,undefined);assert.equal((h.fleet.hephaestusForge||0)+(d.fleet.hephaestusForge||0),1);assert.equal((h.fleet.prometheusOracle||0)+(d.fleet.prometheusOracle||0),1);assert.equal((h.fleet.largeCargo||0)+(d.fleet.largeCargo||0),2);
});
test('I02 60 planets and all 17 classes, full engine and real SDK',async()=>{
 const x=await fullSpecialistWorld('scale17',60),{model,base,href}=x;const keys=[...ids,'hephaestusForge','prometheusOracle','invictus','crepuscolo'];const h=model.planets[0];h.fleet=Object.fromEntries(keys.filter(k=>!['invictus','crepuscolo'].includes(k)).map(k=>[k,1]));h.mothershipHangars=[{id:'full17',fighters:20}];h.bacinoSpaziale={status:'active',startedAt:123,invictusActive:1,crepuscolo:{status:'active'}};await persistFullFixture(x);
 const a=fullClient(model);const f=await a.G.launchOnlineFleet(a.u,0,model.planets[1].coords,'deploy',Object.fromEntries(keys.map(k=>[k,1])),{});const p=(await a.read(href)).data();assert.equal(p.fleet.hephaestusForge,0);assert.equal(p.fleet.prometheusOracle,0);assert.equal(p.bacinoSpaziale.invictusActive,0);assert.equal(p.bacinoSpaziale.crepuscolo.status,'inMission');assert.equal(p.mothershipHangars.length,0);assert.equal(Object.keys((await a.read(base+'/fleets/'+f.id)).data().ships).length,17);assert.deepEqual((await a.read(player(model.id))).data().specialistFlights,[f.id]);
});
test('I02 legacy Galattica forced return binds actual orbital stock',async()=>{
 const x=await fullSpecialistWorld('legacygal'),{model,base}=x;await persistFullFixture(x);const a=fullClient(model),gal={id:'legacy',name:'Legacy',coords:{g:1,s:3,p:2},resources:{metal:500,crystal:0,deuterium:1e11},orbitingFleet:{hephaestusForge:2,prometheusOracle:1,lightFighter:10},defenses:{}};
 // A legacy orbit may contain specialists even though normal construction and launch disallow them.
 for(let s=3;s<100;s++){gal.coords.s=s;if(a.W.UniversumGalaxy.generateProceduralSlot(a.u,1,s,2).ownerType!=='bot')break;}
 a.u.galattiche=[gal];await a.G.syncPlayerState(a.u,{force:true});let to={g:1,s:gal.coords.s+1,p:2};for(let s=gal.coords.s+1;s<100;s++){to={g:1,s,p:2};const slot=a.W.UniversumGalaxy.generateProceduralSlot(a.u,1,s,2);if(!slot.moon&&!slot.bacinoSpaziale)break;}
 await a.G.jumpOnlineGalattica(a.u,'legacy',to);const q=await a.raw.collection(base+'/fleets').get({source:'server'});assert.equal(q.size,1);const doc=q.docs[0];assert.equal(doc.data().galatticaReturn,true);assert.equal(doc.data().ships.hephaestusForge,1);assert.equal(doc.data().ships.prometheusOracle,1);assert.deepEqual((await a.read(base+'/galattiche/'+uid+'~legacy')).data().state.orbitingFleet,{});assert.deepEqual((await a.read(player(model.id))).data().specialistFlights,[doc.id]);
});
test('I02 actual completed specialist can depart after existing checkpoint',async()=>{
 const x=await fullSpecialistWorld('completion'),{model,href}=x;model.specialistBuilt={};model.planets[0].fleet={};await persistFullFixture(x);const a=fullClient(model);
 a.W.UniversumEngine.buildUnits(a.u,0,'hephaestusForge',1);await a.G.syncPlayerState(a.u,{force:true});const lot=a.u.planets[0].shipyardQueue[0];assert(lot);const until=lot.nextUnitEndTime+1;
 a.W.UniversumEngine.processOfflineProgress(a.u,until);assert.equal(a.u.planets[0].fleet.hephaestusForge,1);
 const before=(await a.read(href)).data();assert.equal(before.fleet.hephaestusForge||0,0);
 const launch=()=>a.G.launchOnlineFleet(a.u,0,model.planets[1].coords,'deploy',{hephaestusForge:1},{});
 // The completed local unit is not server stock until the existing checkpoint.
 await denied(launch);assert.deepEqual((await a.read(href)).data(),before);assert.equal(a.u.planets[0].fleet.hephaestusForge,1);
 const saved=a.G.syncPlayerState(a.u,{force:true});const launched=launch();await saved;await launched;
 assert.equal((await a.read(href)).data().fleet.hephaestusForge,0);
});
test('I02 existing registry cleanup on next specialist launch',async()=>{
 const x=await specialistFixture('cleanup',{hephaestusForge:1});const {a,u,own}=x;
 await adminSet(room(u.id)+'/fleets/old',specialistDoc({hephaestusForge:1},{resolved:true,status:'completed'}));await adminUpdate(player(u.id),{specialistFlights:['old']});
 const d=await a.G.launchOnlineFleet(a.u,0,own.coords,'deploy',{hephaestusForge:1},{});assert.deepEqual((await a.read(player(u.id))).data().specialistFlights,[d.id]);
});
test('I02 legacy Galattica forced return without orbital stock rejected',async()=>{
 const x=await specialistFixture('fakegal');const {a,u}=x,base=room(u.id),key=uid+'~g1',gr=base+'/galattiche/'+key,fp=base+'/fleets/fake';
 const gal={ownerUid:uid,version:1,destroyed:false,coordKey:'1_2_1',systemKey:'1_2',state:{id:'g1',coords:{g:1,s:2,p:1},orbitingFleet:{}}};await adminSet(gr,gal);
 const before=(await a.read(gr)).data(),profile=(await a.read(player(u.id))).data();
 const b=a.raw.batch();b.update(a.raw.doc(gr),{version:2,coordKey:'1_3_1',systemKey:'1_3',state:{...gal.state,coords:{g:1,s:3,p:1}}});b.update(a.raw.doc(player(u.id)),{serviceRevision:3,specialistFlights:['fake']});
 b.set(a.raw.doc(fp),specialistDoc({hephaestusForge:1},{originCoords:gal.state.coords,originKey:gal.coordKey,originGalatticaId:'g1',originGalatticaKey:key,galatticaReturn:true}));
 await denied(()=>b.commit());assert.deepEqual((await a.read(gr)).data(),before);assert.deepEqual((await a.read(player(u.id))).data(),profile);assert.equal((await a.read(fp)).exists,false);
});
test('I02 max mixed dispatch after AT05 ordinary receipt',async()=>{
 const x=await fullSpecialistWorld('afterordinary'),{model,base,href}=x;const keys=[...ids,'hephaestusForge','prometheusOracle','invictus','crepuscolo'];const h=model.planets[0];h.fleet=Object.fromEntries(keys.filter(k=>!['invictus','crepuscolo'].includes(k)).map(k=>[k,k==='lightFighter'?2:1]));h.mothershipHangars=[{id:'full17ack',fighters:20}];h.bacinoSpaziale={status:'active',startedAt:123,invictusActive:1,crepuscolo:{status:'active'}};await persistFullFixture(x);
 const a=fullClient(model);const first=await a.G.launchOnlineFleet(a.u,0,model.planets[1].coords,'transport',{lightFighter:1},{});const prior=(await a.read(player(model.id))).data();assert.equal(prior.ordinaryDispatchReceipt.operationId,first.id);assert((await a.read(opPath(model.id,first.id))).exists);
 const second=await a.G.launchOnlineFleet(a.u,0,model.planets[1].coords,'deploy',Object.fromEntries(keys.map(k=>[k,1])),{});const p=(await a.read(player(model.id))).data();assert.equal(p.serviceRevision,prior.serviceRevision+1);assert.equal(p.ordinaryDispatchReceipt.operationId,first.id);assert.equal(p.ordinaryDispatchReceipt.acknowledged,true);assert.deepEqual(p.specialistFlights,[second.id]);assert.equal((await a.read(href)).data().fleet.hephaestusForge,0);assert.equal(Object.keys((await a.read(base+'/fleets/'+second.id)).data().ships).length,17);
});
(async()=>{try{const probe=await fetch(`http://${host}/`,{signal:AbortSignal.timeout(5000)});assert(probe.ok);console.log(`SDK=${firebase.SDK_VERSION}; Rules Git blob=${ruleHash}; project=${projectId}`);const selected=process.argv.length>2?cases.filter(([n])=>process.argv.slice(2).some(x=>n.includes(x))):cases;let pass=0,fail=0;for(const [name,fn] of selected){try{await fn();pass++;console.log('PASS '+name);}catch(e){fail++;console.error('FAIL '+name+': '+e.stack);process.exitCode=1;}}console.log(JSON.stringify({total:selected.length,pass,fail}));}catch(e){console.error('BLOCKED: '+e.stack);process.exitCode=2;}finally{await Promise.allSettled(apps.map(async a=>{await a.firestore().terminate();await a.delete();}));}})();
