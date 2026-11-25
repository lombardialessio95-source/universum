/** Fase 1: ricerca globale/locale, laboratori, salvataggi legacy, Bacino, costi. */
'use strict';
const {E,D,G,win,doc,sb,plain,planet,uni,test,passed,assert,fs,path,root,now}=require('./helpers/game');
const clock=now();
const costs=[[120000,80000,40000],[240000,160000,80000],[480000,320000,160000],[960000,640000,320000],[1920000,1280000,640000]];
test('Ingegneria Megastrutturale: 5 livelli con costi esatti, massimale',()=>{
 assert.equal(D.RESEARCHES.megastructureEngineering.scope,'planetary');assert.equal(D.RESEARCHES.megastructureEngineering.maxLevel,5);
 for(let i=1;i<=5;i++)assert.deepStrictEqual(Object.values(D.getResearchCost('megastructureEngineering',i)),costs[i-1]);
});
test('Tecnologie generali imperiali, 5 Galattica locali e prerequisiti misti',()=>{
 for(const id of ['quantumPhysics','jumpPropulsion','mobilePlanetaryStructure','stellarReactor','spatialTerraforming'])assert.equal(D.RESEARCHES[id].scope,'planetary');
 for(const id of ['hyperspaceTech','armourTech','energyTech','plasmaTech','computerTech','intergalacticNetwork'])assert.notEqual(D.RESEARCHES[id].scope,'planetary');
 const u=uni(2); u.planets[0].localResearches.quantumPhysics=10; assert.equal(D.getResearchLevel(u,u.planets[0],'quantumPhysics'),10);
 assert.equal(D.getResearchLevel(u,u.planets[1],'quantumPhysics'),0);
 assert.equal(D.checkRequirements({researches:{quantumPhysics:10,hyperspaceTech:6}},u.planets[1],u).met,false);
 assert.equal(D.checkRequirements({researches:{quantumPhysics:10,hyperspaceTech:6}},u.planets[0],u).met,true);
});
test('Bacino: blocco motore senza tech, successo solo su A, rate e 20 giorni invariati',()=>{
 const u=uni(2);assert.throws(()=>G.startBacinoSpaziale(u,0),/Ingegneria Megastrutturale/);
 u.planets[0].localResearches.megastructureEngineering=5;assert.equal(D.getBacinoStartRequirements(u,u.planets[0]).met,true);
 assert.equal(D.getBacinoStartRequirements(u,u.planets[1]).met,false);
 const initial=plain(u.planets[0].resources);const b=G.startBacinoSpaziale(u,0);
 assert.equal(b.daysTotal,20);assert.equal(b.nextPaymentAt-clock,86400000);assert.equal(b.daysPaid,0);
 assert.deepStrictEqual(plain(u.planets[0].resources),initial);
 assert.deepStrictEqual(plain(D.BACINO_SPAZIALE.totalCost),{metal:5e6,crystal:3e6,deuterium:1e6});
 assert.deepStrictEqual(plain(D.BACINO_SPAZIALE.dailyCost),{metal:250000,crystal:150000,deuterium:50000});
 assert.throws(()=>G.startBacinoSpaziale(u,1),/Ingegneria Megastrutturale/);
});
test('Bacini legacy già in costruzione o attivi non cancellati',()=>{
 const u=uni(2);u.planets[0].bacinoSpaziale={status:'building',daysTotal:20,daysPaid:7,nextPaymentAt:clock+86400000};
 E.normalizeResearchState(u);E._internal.normalizePlanet(u.planets[0]);assert.equal(u.planets[0].bacinoSpaziale.daysPaid,7);
 assert.throws(()=>G.startBacinoSpaziale(u,0),/già presente/);
 u.planets[0].bacinoSpaziale.status='active';assert.equal(u.planets[0].bacinoSpaziale.status,'active');
});
test('Coda locale A/B e imperiale: parallele, deduzioni solo sul pianeta sorgente',()=>{
 const u=uni(3);let a=plain(u.planets[0].resources),b=plain(u.planets[1].resources);
 let rA=E.startResearch(u,'megastructureEngineering',0),rB=E.startResearch(u,'megastructureEngineering',1);
 assert(rA.durationSec>0&&rB.durationSec>0);assert(u.planets[0].localResearchQueue && u.planets[1].localResearchQueue);
 const rg=E.startResearch(u,'plasmaTech',2);assert(rg.durationSec>0&&u.researchQueue);
 assert.equal(a.metal-u.planets[0].resources.metal,120000);assert.equal(b.metal-u.planets[1].resources.metal,120000);
 assert.equal(b.metal-u.planets[1].resources.metal,120000);assert.equal(u.planets[0].localResearches.megastructureEngineering||0,0);
 assert.throws(()=>E.startResearch(u,'stellarReactor',0),/occupato/i);
 const snapshot=plain(u); const reloaded=plain(snapshot);reloaded.activePlanetId='B';
 const due=Math.max(reloaded.planets[0].localResearchQueue.endTime,reloaded.planets[1].localResearchQueue.endTime,reloaded.researchQueue.endTime||0)+1000;
 E.advanceResearchQueues(reloaded,due);
 assert.equal(reloaded.planets[0].localResearches.megastructureEngineering,1);
 assert.equal(reloaded.planets[1].localResearches.megastructureEngineering,1);
 assert.equal(reloaded.researches.plasmaTech,1);assert.equal(reloaded.researches.megastructureEngineering,undefined);
 const levels=plain(reloaded.planets.map(p=>p.localResearches));E.advanceResearchQueues(reloaded,due+1000);
 assert.deepStrictEqual(plain(reloaded.planets.map(p=>p.localResearches)),levels);
});
test('Lab 15 locale escluso dalla rete 2; segmentazione 22 -> 37 senza retroattività',()=>{
 const u=uni();const T=clock;u.planets[0].localResearchQueue={id:'megastructureEngineering',targetLevel:1,planetId:'A',startTime:T,endTime:T+3600e3};
 u.researchQueue={id:'plasmaTech',targetLevel:1,planetId:'B',startTime:T,lastProgressAt:T,workTotal:5e7,workDone:0,endTime:T+20e6};
 assert.equal(E.getTotalLabLevel(u,T),22);E.advanceResearchQueues(u,T+3600e3);
 assert.equal(u.researchQueue.workDone,23*3600);assert.equal(u.planets[0].localResearches.megastructureEngineering,1);
 assert.equal(E.getTotalLabLevel(u,T+3600e3),37);E.advanceResearchQueues(u,T+7200e3);
 assert.equal(u.researchQueue.workDone,23*3600+38*3600);E.advanceResearchQueues(u,T+7200e3);
 assert.equal(u.researchQueue.workDone,23*3600+38*3600);
});
test('Ricerca locale non accelerata dalla Rete su altre colonie',()=>{
 const u=uni(); const A=u.planets[0];const t=E.getResearchTime(u,'megastructureEngineering',1,A);
 u.researches.intergalacticNetwork=99;u.planets[1].buildings.researchLab=1000;u.planets[2].buildings.researchLab=999;
 assert.equal(E.getResearchTime(u,'megastructureEngineering',1,A),t);
 assert(E.getResearchTime(u,'plasmaTech',2)<t);
});
test('Migrazione idempotente: livelli speciali solo alla capitale, coda d’origine separata',()=>{
 const u=uni(2);delete u.researchModelVersion;
 u.researches.quantumPhysics=6;u.researches.jumpPropulsion=4;
 u.researchQueue={id:'stellarReactor',targetLevel:1,planetId:'B',startTime:clock,endTime:clock+5000,durationSec:5};
 assert(E.normalizeResearchState(u));assert.equal(u.planets[0].localResearches.quantumPhysics,6);
 assert.equal(u.planets[0].localResearches.jumpPropulsion,4);assert.equal(u.planets[1].localResearches.quantumPhysics||0,0);
 assert.equal(u.planets[1].localResearchQueue.id,'stellarReactor');assert.equal(u.researchQueue,null);
 const snap=plain(u);assert.equal(E.normalizeResearchState(u),false);assert.deepStrictEqual(plain(u),snap);
 E.advanceResearchQueues(u,clock+5000);assert.equal(u.planets[1].localResearches.stellarReactor,1);
});
test('Creativa: istantanea, locale non diffusa e max5 imposto',()=>{
 const u=uni(2);u.creativeMode=true;
 for(let i=1;i<=5;i++)assert.equal(E.startResearch(u,'megastructureEngineering',0).targetLevel,i);
 assert.equal(u.planets[1].localResearches.megastructureEngineering,undefined);
 assert.throws(()=>E.startResearch(u,'megastructureEngineering',0),/livello massimo/i);
 assert.equal(E.startResearch(u,'energyTech',0).targetLevel,21);
});
test('Crepuscolo: Bacino attualmente libero anche se usato in passato',()=>{
 const u=uni(1),p=u.planets[0];p.bacinoSpaziale={status:'active',everUsed:true,invictusActive:0,invictusConstructions:[],crepuscolo:null,galatticaConstruction:null};
 assert.equal(G.isBacinoVuoto(p,u),true);p.bacinoSpaziale.galatticaConstruction={status:'building'};
 assert.equal(G.isBacinoVuoto(p,u),false);
});
test('Costi e detrazioni 1-5: una sola volta, soltanto sulla colonia A',()=>{
 const u=uni(2);const A=u.planets[0],B=u.planets[1];const startA=plain(A.resources),startB=plain(B.resources);
 for(let i=1;i<=5;i++){
  const receipt=E.startResearch(u,'megastructureEngineering',0);assert.equal(receipt.targetLevel,i);
  assert.equal(startA.metal-A.resources.metal,costs.slice(0,i).reduce((sum,c)=>sum+c[0],0));
  assert.equal(startA.crystal-A.resources.crystal,costs.slice(0,i).reduce((sum,c)=>sum+c[1],0));
  assert.equal(startA.deuterium-A.resources.deuterium,costs.slice(0,i).reduce((sum,c)=>sum+c[2],0));
  assert.deepStrictEqual(plain(B.resources),startB);
  E.advanceResearchQueues(u,A.localResearchQueue.endTime);
  assert.equal(A.localResearches.megastructureEngineering,i);
 }
 assert.deepStrictEqual(plain(costs.reduce((acc,c)=>acc.map((x,i)=>x+c[i]),[0,0,0])),[3720000,2480000,1240000]);
 assert.throws(()=>E.startResearch(u,'megastructureEngineering',0),/livello massimo/i);
});
test('Nessun laboratorio libero: ricerca imperiale in pausa e riprende dopo locale',()=>{
 const u=uni(1),p=u.planets[0],T=clock;
 u.researchQueue={id:'energyTech',targetLevel:21,planetId:'A',startTime:T,lastProgressAt:T,workTotal:1e8,workDone:15,endTime:T+20e6};
 p.localResearchQueue={id:'megastructureEngineering',targetLevel:1,planetId:'A',startTime:T,endTime:T+7200e3};
 E.refreshImperialETA(u,T);assert.equal(u.researchQueue.endTime,null);
 E.advanceResearchQueues(u,T+3600e3);assert.equal(u.researchQueue.workDone,15);
 E.advanceResearchQueues(u,T+10800e3);assert.equal(u.researchQueue.workDone,15+16*3600);
 assert.equal(p.localResearches.megastructureEngineering,1);
 assert(Number.isFinite(u.researchQueue.endTime));
});
test('Upgrade Laboratorio durante ricerca imperiale: aumento solo dal timestamp upgrade',()=>{
 const u=uni(1),T=clock,p=u.planets[0];
 p.buildings.researchLab=10;
 p.buildQueue=[{id:'researchLab',targetLevel:15,startTime:T,endTime:T+1000e3}];
 u.researchQueue={id:'energyTech',targetLevel:21,startTime:T,lastProgressAt:T,workTotal:1e8,workDone:0,endTime:T+90e6};
 E.advanceResearchQueues(u,T+2000e3);
 assert.equal(u.researchQueue.workDone,11*1000+16*1000);
});
test('Cancellazione/loss del pianeta locale non completa la ricerca su altre colonie',()=>{
 const u=uni(2),T=clock;
 u.planets[0].localResearchQueue={id:'megastructureEngineering',targetLevel:3,planetId:'A',startTime:T,endTime:T+10};
 u.planets.shift();E.advanceResearchQueues(u,T+100000);
 assert.equal(u.planets[0].localResearches.megastructureEngineering,undefined);
});
test('Coda con nuovo proprietario non attribuisce un livello al conquistatore',()=>{
 const u=uni(1),p=u.planets[0];p.ownerUid='new';
 p.localResearchQueue={id:'megastructureEngineering',ownerUid:'old',targetLevel:5,planetId:'A',startTime:clock-5000,endTime:clock-1000};
 E.advanceResearchQueues(u,clock);assert.equal(p.localResearchQueue,null);
 assert.equal(p.localResearches.megastructureEngineering,undefined);
});
test('Impossibile avviare ricerca con pianeta inesistente o coda locale già occupata',()=>{
 const u=uni(2);assert.throws(()=>E.startResearch(u,'megastructureEngineering',10),/Pianeta non trovato/);
 E.startResearch(u,'megastructureEngineering',0);
 assert.throws(()=>E.startResearch(u,'megastructureEngineering',0),/occupato/i);
});
test('Salto offline di giorni: completamenti locali e globale cronologici una volta',()=>{
 const u=uni(2),T=clock;
 u.planets[0].localResearchQueue={id:'megastructureEngineering',targetLevel:1,planetId:'A',startTime:T,endTime:T+1e6};
 u.planets[1].localResearchQueue={id:'megastructureEngineering',targetLevel:1,planetId:'B',startTime:T,endTime:T+2e6};
 u.researchQueue={id:'energyTech',targetLevel:21,planetId:'A',startTime:T,lastProgressAt:T,workTotal:5e6,workDone:0,endTime:T+1e8};
 E.advanceResearchQueues(u,T+3*86400e3);
 assert.equal(u.planets[0].localResearches.megastructureEngineering,1);
 assert.equal(u.planets[1].localResearches.megastructureEngineering,1);
 assert.equal(u.researches.energyTech,21);
 assert.equal(u.researchQueue,null);
 const snapshot=plain(u);E.advanceResearchQueues(u,T+3*86400e3);
 assert.deepStrictEqual(plain(u),snapshot);
});
console.log('TEST FASE 1: '+passed.length+' scenari superati');
