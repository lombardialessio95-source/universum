'use strict';
const {win,D,G,uni,assert}=require('./helpers/game');
const R=win.UniversumExplorationRewards;
const input={version:2,id:'test',ships:{largeCargo:12},cargo:{metal:10,crystal:20,deuterium:30},
  catalog:D.SHIPS,combat:G.resolveCombat};
const counts={};
for(const kind of ['normal','black','rare']) {
  const random=R.randomFor('simulation-'+kind), totals={};
  for(let i=0;i<100000;i++){
    const r=R.resolve({...input,random,blackHole:kind==='black',hours:kind==='rare'?24:1,
      canRecoverWreck:kind==='rare',ships:kind==='rare'?{deathStar:4}:input.ships,
      combat:ships=>({attackerSurvivors:ships,loot:{metal:0,crystal:0,deuterium:0},result:'draw',roundsPlayed:6})});
    totals[r.event]=(totals[r.event] || 0)+1;
  }
  const probs=kind==='rare'?{crepuscolo:.005}:kind==='black'?{singularity:.05,anomaly:.30,corona:.65}:
    {asteroids:.35,abandoned:.20,wreck:.07,pirates:.18,quiet:.20};
  for(const [k,p] of Object.entries(probs)) assert(Math.abs(totals[k]-100000*p)<5*Math.sqrt(100000*p*(1-p)));
  counts[kind]=totals;
}
console.log(JSON.stringify(counts));
const run=(roll,opts)=>R.resolve({...input,random:()=>roll,...opts});
assert.equal(run(.56,{originResources:{metal:250000,crystal:125000}}).recovered.deathStar,1);
assert.equal(run(.56,{}).found.metal,80000);
assert.equal(run(.99,{hours:24}).event,'quiet');
assert.equal(run(.01,{blackHole:true,hours:24,canRecoverWreck:true,ships:{deathStar:4}}).event,'singularity');
const cap=run(.01,{blackHole:true,ships:{lightFighter:1},cargo:{metal:49}});
assert.equal(cap.loaded.metal,D.SHIPS.lightFighter.cargo-49);
assert.equal(cap.loaded.crystal,0);
const outcome=R.resolve({...input,id:'p6',ships:{deathStar:5,battleship:40}});
assert(outcome.loaded.deuterium>0);
assert.equal(run(.2,{blackHole:true,ships:{cruiser:1}}).survivors.cruiser,0);
assert.equal(run(.7,{ships:{espionageProbe:1}}).loaded.metal,0);
function keyFor(min,max) {
  for(let i=0;;i++){const id='case'+i;const n=R.randomFor(id)();if(n>=min && n<max)return id;}
}
for (const gal of [false,true]) for (const hours of [1,5]) {
  const u=uni(1),p=u.planets[0],id=keyFor(0,.35);
  const f={id,mission:'explore',status:'outbound',rewardRulesVersion:2,originPlanetId:p.id,
    originCoords:p.coords,targetCoords:{g:1,s:2,p:16},fleet:{largeCargo:20},cargo:{metal:3,crystal:0,deuterium:0},
    exploreHours:hours,departureTime:1,arrivalTime:100,returnTime:200};
  if(gal){u.galattiche=[{id:'gal',coords:p.coords,resources:{...p.resources},orbitingFleet:{}}];f.originGalatticaId='gal';}
  u.fleetsInFlight=[f];
  const copy=JSON.parse(JSON.stringify(u));
  const tick=win.__UniversumGalaxyModules.processFleetsAndBots;
  tick(u,99);assert.equal(f.rewardResult,undefined);
  tick(u,100);assert.equal(f.rewardResult.event,'asteroids');assert.equal(f.returnTime,200);
  tick(u,150);assert.equal(u.messages.filter(x=>x.title.includes('Rapporto esplorativo')).length,1);
  tick(copy,900);tick(u,200);
  assert.equal(copy.fleetsInFlight.length,0);assert.equal(u.fleetsInFlight.length,0);
  const inventory=world=>gal?world.galattiche[0].resources:world.planets[0].resources;
  assert.deepEqual(inventory(u),inventory(copy));
}
const u=uni(1),p=u.planets[0];
p.bacinoSpaziale={status:'active',invictusActive:0,invictusConstructions:[]};
const f={id:keyFor(0,.005),mission:'explore',status:'outbound',originPlanetId:p.id,targetCoords:p.coords,
  exploreHours:24,fleet:{deathStar:4},cargo:{metal:0,crystal:0,deuterium:0}};
win.__UniversumGalaxyModules.handleMissionArrival(u,f);
assert.equal(f.rewardResult.event,'crepuscolo');
assert.equal(p.bacinoSpaziale.crepuscolo.status,'repairing');
assert.equal(f.fleet.crepuscolo,undefined);
console.log('Stiva, rischi, costo, bottino pirata, flotta planetaria e Galattica, ripresa e Bacino verificati.');
