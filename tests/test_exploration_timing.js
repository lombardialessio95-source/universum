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
console.log('TEST ESPLORAZIONE: '+checks+' controlli superati, inclusa Galattica e compatibilita salvataggi.');
