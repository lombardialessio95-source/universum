'use strict';
// D25-I01 — test mirati sulle funzioni effettive di colonizzazione.
// Esecuzione: node tests/test_d25_colony_resources.js
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const copy=o=>JSON.parse(JSON.stringify(o));
const coords={g:1,s:2,p:7};
const cargoCases=[{metal:0,crystal:0,deuterium:0},{metal:135,crystal:46,deuterium:29}];
let checks=0;
function eq(actual,expected,label){assert.deepStrictEqual(copy(actual),copy(expected),label);checks++;}
function yes(cond,label){assert.ok(cond,label);checks++;}

const galaxy={coordKey:(g,s,p)=>[g,s,p].join(':'),generateProceduralSlot:()=>({
  type:'empty',ownerType:'empty',minTemp:5,maxTemp:45,fieldsMax:200
})};
vm.runInNewContext(read('modules/galaxy/fleet-arrivals.js'),
  {window:{__UniversumGalaxyModules:galaxy},Date,console,Math});
function runOffline(cargo){
  const u={emperor:'Alice',planets:[{id:'home'}],galaxyDeltas:{},messages:[]};
  const fleet={mission:'colonize',targetCoords:copy(coords),fleet:{colonyShip:1},
    cargo:copy(cargo),status:'outbound'};
  galaxy.handleMissionArrival(u,fleet,Date.now());
  eq(u.planets.length,2,'offline: creazione della colonia');
  eq(fleet.cargo,{metal:0,crystal:0,deuterium:0},'offline: carico trasferito una sola volta');
  return u.planets[1];
}

const store=new Map();
const key=c=>[c.g,c.s,c.p].join('_');
let msgCounter=0;
class Ref {
  constructor(p){this.key=p;this.id=p.split('/').pop();}
  collection(name){return new Collection(this.key+'/'+name);}
  async get(){const value=store.get(this.key);return {exists:value!==undefined,id:this.id,
    data:()=>value===undefined?null:copy(value)};}
}
class Collection {
  constructor(p){this.key=p;}
  doc(id){return new Ref(this.key+'/'+(id||'msg_'+(++msgCounter)));}
}
const db={
  collection:name=>new Collection(name),
  async runTransaction(work){
    // Mock sincrono: niente garanzie di concorrenza Firebase.
    return work({
      get:ref=>ref.get(),
      set:(ref,value)=>store.set(ref.key,copy(value)),
      update:(ref,values)=>store.set(ref.key,{...store.get(ref.key),...copy(values)})
    });
  }
};
const G={
  coordsToKey:key,
  getAuth:()=>({currentUser:{uid:'alice'}}),
  getDB:()=>db,
  processEmbargoFleets:async()=>{},
  _fleetDueTime:f=>f.status==='returning'?f.returnTime:f.arrivalTime,
  normalizeOnlineFleet:(f,id)=>({...copy(f),id}),
  _snapshotForDiff:p=>p?copy(p):null,
  _effectivePlanetView:p=>p,
  combatPlanet:async(tx,uniRef,snap)=>snap.data(),
  _mpNotifyError:(context,err)=>{throw Error(context+': '+err.message)},
  forceCleanupOnlineFleet:async()=>{throw Error('cleanup imprevisto')},
  _resolveCreditRef:async()=>null,
  _inboxCredit:()=>{throw Error('accredito imprevisto')}
};
const variables={SERVER_LIMIT:3,SERVER_LIMIT_MESSAGE:'max',
  _leaderboardCache:new Map(),_playersCache:new Map(),_privateCleanupDone:new Set(),
  _systemCache:new Map(),FLEET_SCHEMA_VERSION:3};
const win={__UniversumMPModules:G,__UniversumMPVariables:variables,
  fbAuth:{currentUser:{uid:'alice'}},UniversumEngine:null};
vm.runInNewContext(read('modules/online/universes.js'),{window:win,console,Date,Math});
vm.runInNewContext(read('modules/online/combat-resolver.js'),{window:win,console,Date,Math});
const starter=G.createStarterPlanetDoc('u',coords,'alice','Alice','originale',false);
eq(starter.resources,{metal:1500,crystal:1000,deuterium:300},
  'helper condiviso: risorse originarie invariate (D07/pianeti generici)');
const starterBuildings=copy(starter.buildings);
eq(starterBuildings,{metalMine:1,crystalMine:1,deuteriumSynth:0,
  solarPlant:1,roboticsFactory:0,shipyard:0,researchLab:0},
  'helper condiviso: livelli edifici originali invariati');
const npc=G.createStarterPlanetDoc('u',coords,'npc','NPC','Avamposto',true);
eq(npc.resources,{metal:50000,crystal:35000,deuterium:15000},
  'helper NPC: risorse invariate');

const rootPath='online_universes/d25';
let seq=0;
G.getLiveFleetDocs=uniId=>[...store.keys()].filter(k=>k.startsWith(rootPath+'/fleets/'))
  .map(k=>{const ref=new Ref(k);return {id:ref.id,ref,data:()=>copy(store.get(k))};});

async function resolveOnline(cargo,{preexisting=false,extraShips=false}={}){
  const id='fleet_'+(++seq),planetRef=rootPath+'/planets/'+key(coords);
  const old=preexisting?{
    ...G.createStarterPlanetDoc('d25',coords,'alice','Alice','Colonia storica',false),
    resources:{metal:87234,crystal:45012,deuterium:9311},
    buildings:{metalMine:12,crystalMine:10,solarPlant:13}
  }:null;
  if(old)store.set(planetRef,copy(old));else store.delete(planetRef);
  const fleet={id,attackerUid:'alice',attackerName:'Alice',originPlanetId:'planet_home',
    originCoords:{g:1,s:1,p:6},targetCoords:copy(coords),targetKey:key(coords),
    mission:'colonize',status:'outbound',resolved:false,arrivalTime:Date.now()-1000,
    returnTime:Date.now()+90000,ships:{colonyShip:1,...(extraShips?{lightFighter:3}:{})},
    cargo:copy(cargo)};
  store.set(rootPath+'/fleets/'+id,copy(fleet));
  await G.resolveArrivedOnlineFleets('d25',1);
  const after=store.get(planetRef),resolvedFleet=store.get(rootPath+'/fleets/'+id);
  return {after,old,resolvedFleet};
}
async function main(){
  for(const cargo of cargoCases){
    const offline=runOffline(cargo);
    const online=await resolveOnline(cargo);
    eq(online.after.resources,offline.resources,
      'stesse risorse online/offline con carico '+JSON.stringify(cargo));
    eq(online.after.resources,{
      metal:1000+cargo.metal,crystal:1000+cargo.crystal,
      deuterium:500+cargo.deuterium
    },'base offline più carico trasportato');
    eq(online.after.buildings,offline.buildings,
      'D26: nuove colonie online/offline hanno gli stessi edifici iniziali');
    eq(online.resolvedFleet.status,'completed','flotta colonizzatrice consumata');
    eq(online.resolvedFleet.resolved,true,'completamento transazionale registrato');
  }
  const carrying=await resolveOnline({metal:15,crystal:26,deuterium:37},
    {extraShips:true});
  eq(carrying.after.resources,{metal:1015,crystal:1026,deuterium:537},
    'carico trasferito anche quando restano navi di scorta');
  eq(carrying.resolvedFleet.cargo,{metal:0,crystal:0,deuterium:0},
    'nessuna seconda consegna del carico al rientro della scorta');
  eq(carrying.resolvedFleet.status,'returning','navi di scorta rientrano normalmente');
  const existing=await resolveOnline({metal:15,crystal:26,deuterium:37},
    {preexisting:true});
  eq(existing.after,existing.old,'colonia preesistente non alterata');
  eq(existing.resolvedFleet.cargo,{metal:15,crystal:26,deuterium:37},
    'fallimento: carico resta con la flotta');
  eq(existing.resolvedFleet.status,'returning',
    'fallimento: ritorno ordinario flotta senza creazione colonia');
  const d07=read('modules/online/universes.js');
  yes(d07.includes('homePlanet.buildings = {'),'D07: inizializzazione edifici madre intatta');
  console.log('D25-I01 PASS: '+checks+' controlli mirati, online/offline e colonie esistenti (Firestore simulato).');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
