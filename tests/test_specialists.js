'use strict';
const {E,D,G,win,plain,uni,test,passed,assert,now,setTime} = require('./helpers/game');
const S = win.UniversumServices;
const [forge,oracle] = S.ids;
const T = now();
const day = 86400000;
function game(n=2) {
  setTime(T);
  const u = uni(n);
  Object.assign(u.researches,{computerTech:10,impulseDrive:3,combustionDrive:6});
  for (const p of u.planets) { p.maxTemp=30; p.fieldsMax=240; }
  return u;
}
const advance = (u,t)=>win.__UniversumEngineModules.advanceQueuesAtTimestamp(u,t);
test('Catalogo, prerequisiti locali e imperiali, costo e statistiche',()=>{
  const u=game(),p=u.planets[0];
  for (const [id,stats,cost] of [[forge,[5,100,20000,5000],[220000,150000,45000]],[oracle,[0,150,15000,6000],[160000,220000,65000]]]) {
    const d=D.SHIPS[id];
    assert.deepEqual([d.attack,d.shield,d.hull,d.speed],stats);
    assert.deepEqual(Object.values(d.cost),cost);
    assert.equal(d.cargo,0); assert.equal(d.driveType,'impulseDrive'); assert.deepEqual(plain(d.rapidFire),{});
    for (const [k,level] of Object.entries(d.requirements.buildings)) {
      const prev=p.buildings[k]; p.buildings[k]=level-1;
      assert.throws(()=>E.buildUnits(u,0,id),/Requisiti/); p.buildings[k]=prev;
    }
    for (const [k,level] of Object.entries(d.requirements.researches)) {
      const prev=u.researches[k];u.researches[k]=level-1;
      assert.throws(()=>E.buildUnits(u,0,id),/Requisiti/);u.researches[k]=prev;
    }
  }
});
test('Massimi con più pianeti, prenotazioni, voli e storia dopo perdite/import',()=>{
  const u=game(),p=u.planets[0];
  for (const [id,max] of [[forge,5],[oracle,3]]) {
    p.fleet[id]=max-2;u.fleetsInFlight=[{ships:{[id]:1}}];
    E.buildUnits(u,1,id);
    assert.throws(()=>E.buildUnits(u,0,id),/Limite/); assert.equal(u.specialistBuilt?.[id],undefined);
    advance(u,u.planets[1].shipyardQueue[0].endTime);assert.equal(u.specialistBuilt[id],1);
    advance(u,u.planets[1].services[id].at);assert.equal(u.specialistBuilt[id],1);
    u.fleetsInFlight=[];p.fleet[id]=0;u.planets[1].fleet[id]=0;
    u.specialistBuilt[id]=4;
    const v=plain(u);const before=v.planets[0].resources.metal;
    E.buildUnits(v,0,id,2);assert.equal(before-v.planets[0].resources.metal,D.SHIPS[id].cost.metal*3);
    const end=v.planets[0].shipyardQueue[0].endTime;advance(v,end);assert.equal(v.specialistBuilt[id],6);
    assert.equal(S.quote(v,id,1).cost.metal,2*D.SHIPS[id].cost.metal);
    v.specialistBuilt[id]=7;assert.equal(S.quote(v,id,1).cost.metal,2*D.SHIPS[id].cost.metal);
  }
});
test('Soglie slot indipendenti dal numero di specialiste',()=>{
  assert.deepEqual(Array.from({length:15},(_,n)=>S.slots(forge,n)),[1,1,1,1,2,2,2,3,3,3,4,4,4,5,5]);
  assert.deepEqual(Array.from({length:12},(_,n)=>S.slots(oracle,n)),[0,0,0,0,0,1,2,3,3,4,5,5]);
  const u=game();u.researches.computerTech=5;const p=u.planets[0];p.fleet[oracle]=2;
  S.queue(u,p,oracle,'energyTech');assert.throws(()=>S.queue(u,p,oracle,'plasmaTech'),/esauriti/);
});
test('FIFO, costo solo alla partenza, linea manuale, permanenza e perdita',()=>{
  const u=game(),p=u.planets[0];p.fleet[forge]=2;
  E.startBuilding(u,0,'metalStorage');const resources=plain(p.resources);
  S.queue(u,p,forge,'crystalStorage');S.queue(u,p,forge,'metalStorage');
  S.advance(u,T);const s=p.services[forge];
  assert.equal(s.queue.length,2);assert.match(s.queue[0].reason,/occupata/);
  assert.deepEqual(plain(p.resources),resources);
  const end=p.buildQueue[0].endTime;advance(u,end);
  assert.equal(p.buildQueue[0].id,'crystalStorage');assert.ok(p.buildQueue[0].serviceCost>0);
  const activeId=p.buildQueue[0].workId;
  p.fleet[forge]=1;S.settlePlanet(u,p,end);assert.equal(s.queue.length,1);
  p.fleet[forge]=0;S.settlePlanet(u,p,end);assert.equal(s.queue.length,0);assert.equal(p.buildQueue[0].workId,activeId);
});
test('Oracoli concorrenti: ordine deterministico, una ricerca globale, due locali',()=>{
  const u=game(3);for (const p of u.planets) p.fleet[oracle]=1;
  const [a,b,c]=u.planets;
  S.queue(u,a,oracle,'energyTech',T);S.queue(u,b,oracle,'plasmaTech',T);
  a.services[oracle].queue[0].workId='z';b.services[oracle].queue[0].workId='a';
  S.advance(u,T);assert.equal(u.researchQueue.planetId,b.id);assert.equal(a.services[oracle].queue.length,1);
  S.queue(u,b,oracle,'megastructureEngineering',T);S.queue(u,c,oracle,'megastructureEngineering',T);
  S.advance(u,T);assert.ok(b.localResearchQueue && c.localResearchQueue);
  assert.equal(E.getTotalLabLevel(u,T),a.buildings.researchLab);
});
test('Manutenzione proporzionale, maggiorazione solo automatica, checkpoint idempotente',()=>{
  for (const id of S.ids) {
    const u=game(),p=u.planets[0];p.fleet[id]=1;
    const before=plain(p.resources);S.settlePlanet(u,p,T);
    const job={id:'x',startTime:T,endTime:T+day,serviceCost:1e7,planetId:p.id};
    if (id===forge) p.buildQueue=[job];else p.localResearchQueue=job;
    S.settlePlanet(u,p,T+day/2);const copy=plain(u);
    S.settlePlanet(copy,copy.planets[0],T+day);S.settlePlanet(u,p,T+day);
    assert.deepEqual(plain(copy.planets[0].resources),plain(p.resources));
    const paid=plain(p.resources);S.settlePlanet(u,p,T+day);assert.deepEqual(plain(p.resources),paid);
    for (const k of Object.keys(before)) assert.equal(before[k]-p.resources[k],Math.floor(D.SHIPS[id].upkeep[k]*S.multiplier(1e7)));
    delete job.serviceCost;S.settlePlanet(u,p,T+day*2);
    for (const k of Object.keys(before)) assert.equal(paid[k]-p.resources[k],D.SHIPS[id].upkeep[k]);
  }
});
test('Insolvenza e ripresa, nessun debito accumulato',()=>{
  const u=game(),p=u.planets[0];p.fleet[forge]=1;p.resources={metal:0,crystal:0,deuterium:0};
  S.queue(u,p,forge,'metalStorage',T);S.advance(u,T+day*90);
  assert.equal(p.buildQueue.length,0);assert.equal(p.services[forge].queue.length,1);
  assert.match(p.services[forge].queue[0].reason,/Manutenzione/);
  Object.assign(p.resources,{metal:1e6,crystal:1e6,deuterium:1e6});S.advance(u,T+day*90);
  assert.equal(p.buildQueue.length,1);assert.equal(p.resources.metal,1e6-D.getBuildingCost('metalStorage',1).metal);
});
test('Ripresa cronologica durante assenza: sequenza di due livelli, nessun doppio addebito',()=>{
  const u=game(),p=u.planets[0];p.fleet[forge]=1;
  S.queue(u,p,forge,'metalStorage',T);S.queue(u,p,forge,'metalStorage',T);S.advance(u,T);
  const saved=plain(u); setTime(T+day);
  const summary=E.processOfflineProgress(saved);assert.equal(saved.planets[0].buildings.metalStorage,2);
  assert.equal(summary.completedBuildings.length,2);const balance=plain(saved.planets[0].resources);
  E.processOfflineProgress(saved);assert.deepEqual(plain(saved.planets[0].resources),balance);
});
test('Trasferimento con carburante, divieto d’attacco, nessun servizio in volo',()=>{
  const u=game(),[a,b]=u.planets;a.fleet[forge]=1;S.queue(u,a,forge,'crystalStorage',T);
  for (const mission of ['attack','spy','explore','occupy','recycle']) assert.throws(()=>G.launchFleet(u,0,b.coords,mission,{[forge]:1}),/colonie proprie/);
  assert.throws(()=>G.launchFleet(u,0,{g:2,s:1,p:1},'deploy',{[forge]:1}),/colonie proprie/);
  const fuel=a.resources.deuterium;
  G.launchFleet(u,0,b.coords,'deploy',{[forge]:1});assert(a.resources.deuterium<fuel);assert.equal(a.fleet[forge],0);assert.equal(a.services[forge].queue.length,0);
  assert.equal(S.quote(u,forge,1).free,4);
  const flight=u.fleetsInFlight[0];setTime(flight.arrivalTime);G.processFleetsAndBots(u);
  assert.equal(b.fleet[forge],1);assert.equal(u.fleetsInFlight.length,0);
});
test('Lotti navali/difensivi: cancellazione selettiva, ETA e unità completate',()=>{
  for (const [id,def] of [['lightFighter',false],['rocketLauncher',true]]) {
    const u=game(),p=u.planets[0];for (const qty of [25,50,25]) E.buildUnits(u,0,id,qty,def);
    const q=def?p.defenseQueue:p.shipyardQueue;const [a,b,c]=q;
    const at=a.nextUnitEndTime+4*a.unitDurationSec*1000;
    win.UniversumUI.changeWorkOrder(u,p,b.workId,'cancel',at);
    assert.equal(q.length,2);assert.equal(q[0].workId,a.workId);assert.equal(a.remaining,20);
    assert.equal(q[1].endTime,a.endTime+c.remaining*c.unitDurationSec*1000);
    win.UniversumUI.changeWorkOrder(u,p,a.workId,'cancel',at);
    assert.equal((def?p.defenses:p.fleet)[id],5);assert.equal(q[0].workId,c.workId);
    assert.equal(q[0].endTime,at+25*c.unitDurationSec*1000);
  }
});
test('Tariffa imperiale liberata dalla cancellazione e cantieri che terminano in ordine inverso',()=>{
  const u=game(),[a,b]=u.planets;u.specialistBuilt={[forge]:4};b.buildings.naniteFactory=3;
  E.buildUnits(u,0,forge);E.buildUnits(u,1,forge);
  assert.equal(b.shipyardQueue[0].baseReservations,0);
  const saved=plain(u),before=b.resources.metal;
  win.UniversumUI.changeWorkOrder(u,a,a.shipyardQueue[0].workId,'cancel',T);
  assert.equal(b.shipyardQueue[0].baseReservations,1);assert.equal(b.resources.metal-before,D.SHIPS[forge].cost.metal);
  S.releaseReservations(u,forge);assert.equal(b.resources.metal-before,D.SHIPS[forge].cost.metal);
  advance(saved,saved.planets[1].shipyardQueue[0].endTime);
  assert.equal(saved.specialistBuilt[forge],5);assert.equal(saved.planets[0].shipyardQueue[0].baseReservations,0);
  advance(saved,saved.planets[0].shipyardQueue[0].endTime);assert.equal(saved.specialistBuilt[forge],6);
});
test('Distruzione in difesa orbitale di entrambe le classi',()=>{
  const u=game(),p=u.planets[0];p.fleet={[forge]:1,[oracle]:1};
  const r=G.resolveCombat({deathStar:10},{weaponsTech:20},{fleet:p.fleet,defenses:{},tech:{},resources:p.resources,buildings:p.buildings});
  assert.equal(r.defenderLosses[forge],1);assert.equal(r.defenderLosses[oracle],1);
});
test('Due linee sul medesimo pianeta e abbandono senza interruzione del laboratorio',()=>{
  const u=game(),p=u.planets[0];p.fleet[oracle]=1;
  S.queue(u,p,oracle,'megastructureEngineering',T);S.queue(u,p,oracle,'plasmaTech',T);S.advance(u,T);
  assert.equal(p.localResearchQueue.startTime,T);assert.equal(u.researchQueue.startTime,T);
  p.fleet[oracle]=0;S.settlePlanet(u,p,T);assert(p.localResearchQueue && u.researchQueue);
  assert.equal(E.getTotalLabLevel(u,T),u.planets[1].buildings.researchLab);
});
test('Schieramento durante assenza: manutenzione alla destinazione dal momento di arrivo',()=>{
  const u=game(),[a,b]=u.planets;a.fleet[forge]=1;b.resources={metal:1e8,crystal:1e8,deuterium:1e8};
  G.launchFleet(u,0,b.coords,'deploy',{[forge]:1});const flight=u.fleetsInFlight[0];
  const balance=b.resources.metal;setTime(flight.arrivalTime+day/2);E.processOfflineProgress(u);
  assert.equal(b.fleet[forge],1);assert.equal(b.services[forge].at,now());assert.equal(balance-b.resources.metal,2000);
  assert.equal(u.fleetsInFlight.length,0);
});
test('Contabilità a deposito pieno: intervallo lungo e passi brevi equivalenti',()=>{
  const u=game(),p=u.planets[0];p.fleet[forge]=1;p.buildings.metalMine=12;p.buildings.deuteriumSynth=12;
  const cap=E.getPlanetProduction(p,u).caps;
  p.resources={...cap};S.settlePlanet(u,p,T);const other=plain(u);
  const sim=win.__UniversumEngineModules.advancePlanetResources;
  sim(p,u,3600,T+3600000);
  for(let i=1;i<=3600;i++) sim(other.planets[0],other,1,T+1000*i);
  for(const k of Object.keys(cap)) assert(Math.abs(p.resources[k]-other.planets[0].resources[k])<1.001);
});
console.log(passed.length+' gruppi Fase 2 superati');
