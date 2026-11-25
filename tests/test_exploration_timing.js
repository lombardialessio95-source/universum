'use strict';
// UNIVERSUM — Timeline esplorativa, retrocompatibilita', Galattica, MP simulato.
// node tests/test_exploration_timing.js
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=p=>fs.readFileSync(path.join(root,p),'utf8');
const T=100000000;
let now=T,checks=0;
class FakeDate extends Date {static now(){return now;}}
function check(value,comment){assert.ok(value,comment);checks++;}
function equal(a,b,comment){assert.equal(a,b,comment);checks++;}
const data={
  RESEARCHES:{}, SHIPS:{lightFighter:{
    id:'lightFighter',name:'Caccia Leggero',speed:12500,cargo:2000,
    driveType:'combustionDrive',fuel:10,attack:50,shield:10,hull:4000,cost:{metal:3000,crystal:1000,deuterium:0}
  }}, getShipFuelConsumption:()=>10
};
function planet(){
  return {id:'p1',coords:{g:1,s:1,p:1},name:'Madre',fleet:{lightFighter:500},
    resources:{metal:1000000,crystal:1000000,deuterium:1000000}};
}
function uni(speed=1,expeditionTech=6){
  return {id:'u1',speed,creativeMode:false,researches:{expeditionTech,computerTech:10},
    planets:[planet()],activeSieges:[],incomingSieges:[],fleetsInFlight:[],messages:[],
    galattiche:[{id:'g1',coords:{g:1,s:1,p:2},orbitingFleet:{lightFighter:500},
      resources:{metal:1000000,crystal:1000000,deuterium:1000000}}]};
}
const travel=()=>({durationSec:3600,fuelCost:100,minSpeed:12500});
const window={UniversumData:data,UniversumEngine:{getEffectiveSpeed:u=>u.speed},
  UniversumGalaxy:{getFleetSpeedAndFuel:travel,calculateDistance:()=>1000}};
const ctx=vm.createContext({window,Date:FakeDate,console,Math});
vm.runInContext(source('missions-core.js'),ctx,{filename:'missions-core.js'});
vm.runInContext(source('siege-missions.js'),ctx,{filename:'siege-missions.js'});
const C=window.UniversumMissionsCore;
function originalFleet(hours=5){
  const t=C.buildExplorationTimeline(T,3600,C.getExplorationHoldDurationSec(uni(),hours));
  return {...t,departureTime:T,mission:'explore',status:'outbound',id:'f1'};
}
for(const speed of [1,10,100]){
  const u=uni(speed),hold=C.getExplorationHoldDurationSec(u,5);
  equal(hold,Math.max(15,Math.floor(18000/Math.sqrt(speed))),'formula sqrt '+speed);
  const t=C.buildExplorationTimeline(T,3600,hold);
  equal(t.zoneArrivalTime,T+3600000,'arrivo zona');
  equal(t.explorationEndTime,T+3600000+hold*1000,'fine stazionamento');
  equal(t.returnTime,T+7200000+hold*1000,'rientro previsto');
}
equal(C.getExplorationHoldDurationSec(uni(1),5),18000,'5 ore reali 1x');
const f=originalFleet();
equal(f.returnTime-f.departureTime,7*3600000,'1+5+1=7 ore');
equal(C.getRecallDurationMs(f,T+1800000),1800000,'richiamo a meta andata');
equal(C.getRecallDurationMs(f,T+3600000),3600000,'richiamo all arrivo');
equal(C.getRecallDurationMs(f,T+3*3600000),3600000,'richiamo dopo due ore esplorazione');
equal(C.getRecallDurationMs(f,T+5*3600000),3600000,'richiamo dopo quattro ore esplorazione');
equal(C.getRecallDurationMs(f,f.explorationEndTime-1),3600000,'richiamo prima della fine');
equal(C.getRecallDurationMs(f,f.explorationEndTime+1),3600000,'richiamo dopo fine');
equal(C.getExplorationHoldDurationSec(uni(1,0),1),3600,'una ora senza ricerca');
equal(C.getMaxExploreHours(uni(1,6)),7,'ore massime ricerca');
equal(C.getExplorationHoldDurationSec(uni(1,6),7),7*3600,'durata massima');
const reloaded=JSON.parse(JSON.stringify(f));
equal(C.getRecallDurationMs(reloaded,T+5*3600000),3600000,'offline reload non altera il richiamo');
const legacy={mission:'explore',status:'outbound',departureTime:T,arrivalTime:T+6*3600000,
  returnTime:T+7*3600000,exploreHours:5};
equal(C.getRecallDurationMs(legacy,T+5*3600000),3600000,'salvataggio precedente');
const oldGal={mission:'explore',status:'outbound',departureTime:T,arrivalTime:T+3600000,
  returnTime:T+7200000};
equal(C.getRecallDurationMs(oldGal,T+1800000),1800000,'vecchia Galattica non retrocalcolata');
const local=uni();local.fleetsInFlight=[originalFleet()];
now=T+5*3600000;
C.recallFleet(local,'f1');
equal(local.fleetsInFlight[0].returnTime,now+3600000,'recall offline durante esplorazione');
check(local.fleetsInFlight[0].recalled,'flotta marcata richiamata');
assert.throws(()=>C.recallFleet(local,'f1'),/già.*rientro/);checks++;
now=T;
const offline=uni(1);
const pflight=window.UniversumSiege.launchEnhancedFleet(offline,0,{g:1,s:1,p:16},'explore',
  {lightFighter:2},{metal:0,crystal:0,deuterium:0},{exploreHours:5});
equal(pflight.returnTime-pflight.departureTime,7*3600000,'missione planetaria 7 ore');
equal(pflight.zoneArrivalTime-pflight.departureTime,3600000,'planetaria arrivo zona persistito');
equal(pflight.arrivalTime,pflight.explorationEndTime,'planetaria resolver si attiva dopo permanenza');
const galaxyWindow={UniversumData:data,UniversumEngine:window.UniversumEngine,
  UniversumMissionsCore:C,__UniversumGalaxyModules:{
    findGalattica:(u,id)=>u.galattiche.find(g=>g.id===id),getInvictusJumpCost:()=>0
  }};
vm.runInNewContext(source('modules/galaxy/fleet-dispatch.js'),
  {window:galaxyWindow,Date:FakeDate,console,Math});
galaxyWindow.UniversumGalaxy=galaxyWindow.__UniversumGalaxyModules;
const gg=uni(1);
const gflight=galaxyWindow.UniversumGalaxy.launchFleet(gg,0,{g:1,s:1,p:16},
  'explore',{lightFighter:2},{},{originType:'galattica',originGalatticaId:'g1',exploreHours:5});
equal(gflight.arrivalTime-gflight.departureTime, (gflight.durationSec+18000)*1000,'Galattica include permanenza');
equal(gflight.returnTime-gflight.departureTime, (gflight.durationSec*2+18000)*1000,'Galattica totale andata esplorazione ritorno');
equal(gflight.exploreHours,5,'Galattica salva ore scelte');
check(gflight.originGalatticaId==='g1','Galattica origine conservata');
const old=uni(1,1);
const limited=galaxyWindow.UniversumGalaxy.launchFleet(old,0,{g:1,s:1,p:16},
  'explore',{lightFighter:1},{},{originType:'galattica',originGalatticaId:'g1',exploreHours:9});
equal(limited.exploreHours,2,'durata bloccata dal livello ricerca');
const normal=uni(1);
const ordinary=galaxyWindow.UniversumGalaxy.launchFleet(normal,0,{g:1,s:1,p:4},
  'transport',{lightFighter:1},{},{originType:'galattica',originGalatticaId:'g1'});
equal(ordinary.returnTime-ordinary.departureTime,2*ordinary.durationSec*1000,'missione normale immutata');
check(!('explorationEndTime' in ordinary),'nessun campo esplorativo sulle altre missioni');
const view=source('ui-fleet-movements.js');
check(view.includes('IN ESPLORAZIONE') && view.includes('Rientro previsto'),'interfaccia a tre fasi');
check(source('modules/ui/ui-galattica.js').includes('gal-fleet-explore-hours'),'selettore Galattica presente');
const resolver=source('modules/online/combat-resolver.js');
check(resolver.includes('plannedReturnAt >= Number(fleet.arrivalTime') &&
  resolver.includes('dueReturnAt'),'resolver rispetta rientro originale');
const online=source('modules/online/fleet-control.js');
check(online.includes('await db.runTransaction(async (tx) =>') &&
  online.includes('getRecallDurationMs(fleet, now)'),'richiamo online in transazione');
check(online.includes('getExplorationHoldDurationSec(universeObj, expeditionHours)'),
  'online formula uguale a offline');
// Test online che esegue DAVVERO launchOnlineFleet e recallOnlineFleet
// con transazioni serializzate come un mock Firestore. Non è Firebase reale.
async function runOnline(){
  const docs=new Map();
  let seq=0,serial=Promise.resolve();
  class Snap {
    constructor(ref){this.exists=docs.has(ref.key);this.id=ref.key.split('/').at(-1);}
    data(){return docs.get(this.refKey)||null;}
  }
  class Ref {
    constructor(key){this.key=key;this.id=key.split('/').at(-1);}
    collection(part){return new Collection(this.key+'/'+part);}
    async get(){
      const value=docs.get(this.key);
      return {exists:value!==undefined,data:()=>value||null,id:this.id};
    }
    async update(data){const v=docs.get(this.key);if(!v)throw Error('document missing');Object.assign(v,data);}
  }
  class Collection{
    constructor(key){this.key=key;}
    doc(id){return new Ref(this.key+'/'+id);}
    async add(data){
      const r=this.doc('fleet'+(++seq));
      docs.set(r.key,{...data});
      return r;
    }
  }
  const db={
    collection:name=>new Collection(name),
    runTransaction(fn){
      const execute=async()=>fn({
        get:ref=>ref.get(),
        update:(ref,data)=>{Object.assign(docs.get(ref.key),data);}
      });
      const job=serial.then(execute);
      serial=job.catch(()=>{});
      return job;
    }
  };
  const mpWindow={
    UniversumData:data,UniversumMissionsCore:C,
    UniversumGalaxy:{calculateDistance:()=>1000,getFleetSpeedAndFuel:travel},
    __UniversumMPVariables:{FLEET_SCHEMA_VERSION:3,_ONLINE_SUPPORTED_MISSIONS:new Set(),_mpErrorToastAt:new Map()},
    __UniversumMPModules:{
      getAuth:()=>({currentUser:{uid:'alice',displayName:'Alice'}}),
      getDB:()=>db,coordsToKey:c=>[c.g,c.s,c.p].join('_'),
      syncPlayerState:async()=>{},_tsToMs:v=>v?.toMillis?.()||0
    }
  };
  const firebase={firestore:{FieldValue:{serverTimestamp:()=>({toMillis:()=>now+900})}}};
  vm.runInNewContext(source('modules/online/fleet-control.js'),
    {window:mpWindow,Date:FakeDate,console,Math,firebase});
  const G=mpWindow.__UniversumMPModules;
  const where={g:1,s:1,p:16};
  const u=uni(1);
  now=T;
  const mission=await G.launchOnlineFleet(u,0,where,'explore',{lightFighter:2},{},{exploreHours:5});
  equal(mission.zoneArrivalTime,mission.departureTime+3600000,'online arrivo zona con orologio Firebase');
  equal(mission.explorationEndTime-mission.zoneArrivalTime,18000000,'online permanenza 5h su 1x');
  equal(mission.returnTime-mission.departureTime,7*3600000,'online 1+5+1');
  const fleetRef='online_universes/u1/fleets/'+mission.id;
  equal(docs.get(fleetRef).returnTime,mission.returnTime,'online timestamp salvato nello store');
  now=mission.zoneArrivalTime+4*3600000;
  await G.recallOnlineFleet(u,mission.id);
  equal(docs.get(fleetRef).returnTime,now+3600000,'online richiamo dopo 4h permanenza');
  check(docs.get(fleetRef).mission==='recall','online richiamo non concede ricompensa');
  await assert.rejects(G.recallOnlineFleet(u,mission.id),/già.*rientr/);checks++;
  const another=uni(10);
  now=T+8*3600000;
  const later=await G.launchOnlineFleet(another,0,where,'explore',{lightFighter:2},{},{exploreHours:5});
  equal(later.explorationEndTime-later.zoneArrivalTime,
    C.getExplorationHoldDurationSec(another,5)*1000,'online 10x uguale offline');
  now=later.departureTime+1800000;
  const concurrent=await Promise.allSettled([
    G.recallOnlineFleet(another,later.id),
    G.recallOnlineFleet(another,later.id)
  ]);
  equal(concurrent.filter(x=>x.status==='fulfilled').length,1,'due client: un solo richiamo');
  equal(concurrent.filter(x=>x.status==='rejected').length,1,'secondo richiamo rifiutato');
  const laterRef='online_universes/u1/fleets/'+later.id;
  equal(docs.get(laterRef).returnTime,now+1800000,'online ritorno meta tratta');
  const old=uni(1);
  const legacyId='oldExpedition';
  docs.set('online_universes/u1/fleets/'+legacyId,{
    attackerUid:'alice',resolved:false,status:'outbound',mission:'expedition',
    departureTime:T,arrivalTime:T+6*3600000,returnTime:T+7*3600000
  });
  now=T+5*3600000;
  await G.recallOnlineFleet(old,legacyId);
  equal(docs.get('online_universes/u1/fleets/'+legacyId).returnTime,
    now+3600000,'online legacy mantiene durata ritorno');
}
runOnline().then(()=>console.log('TEST ESPLORAZIONE: '+checks+
  ' controlli superati (Firestore simulato, NON ambiente reale).'))
  .catch(err=>{console.error(err);process.exitCode=1;});

