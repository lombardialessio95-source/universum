'use strict';
// Opzione C — una sola operazione di attacco, senza assedi e senza scheduler.
const I = require('./option-c-inventory');
const materials = ['metal','crystal','deuterium'];
const unit = 'naveMadreSuprema';
const own = (v,k) => Object.prototype.hasOwnProperty.call(v||{},k);
const quantities = value => Object.fromEntries(Object.entries(value||{})
  .filter(([k,n])=>own(I.WEIGHTS,k) && Number.isSafeInteger(n) && n>0));
const sum = obj => Object.values(obj||{}).reduce((n,x)=>n+x,0);
function rng(seed) {
  let h=2166136261;
  for (const c of String(seed)) h=Math.imul(h^c.charCodeAt(0),16777619);
  return ()=>{h=(Math.imul(h,1664525)+1013904223)>>>0;return h/4294967296;};
}
function reduceHangar(hangar,role,survivors) {
  const result={escort:{...hangar.escort},invasion:{...hangar.invasion},reserve:{...hangar.reserve}};
  for (const id of Object.keys(I.WEIGHTS)) {
    if (own(result[role],id)) result[role][id] = Math.min(result[role][id]||0,survivors[id]||0);
  }
  return result;
}
function addDebris(dst,src) {
  for (const k of ['metal','crystal']) dst[k]=(dst[k]||0)+(src?.[k]||0);
}
function cargo(hangar,engine) {
  return Object.values(hangar).reduce((cap,group)=>cap+Object.entries(group).reduce((sum,[id,n])=>
    sum+(engine.data.SHIPS[id]?.cargo||0)*n,0),0);
}
function allocateLoot(planet,ship,engine) {
  const remaining=Math.max(0,cargo(ship.hangar,engine));
  let space=remaining;
  const loot={metal:0,crystal:0,deuterium:0};
  const bunker=Math.min(9,Math.max(0,Number(planet.buildings?.hiddenBunker)||0));
  const factor=Math.max(.1,1-bunker*.1);
  const limits=Object.fromEntries(materials.map(k=>[k,Math.floor(Math.max(0,planet.resources?.[k]||0)*factor*.5)]));
  // Preserve 50%-per-resource cap and both shared cargo and separate depot caps.
  for (const k of materials) {
    const free=Math.max(0,I.ONLINE_CAPACITY>=0 ? engine.core.depotCaps[k]-(ship.resources[k]||0) : 0);
    const n=Math.min(space,free,limits[k]);
    loot[k]=n;
    space-=n;
  }
  for (const k of materials) {
    planet.resources[k]-=loot[k];
    ship.resources[k]=(ship.resources[k]||0)+loot[k];
  }
  return loot;
}
function resolveSingle({engine,supreme,planet,attackerTech={},defenderTech={},missionId}) {
  if (!engine?.resolveCombat || !engine.spec || !engine.data?.SHIPS) throw Error('Motore Fase 4 non disponibile.');
  if (!supreme || !planet || typeof missionId!=='string' || !missionId) throw Error('Combattimento non valido.');
  I.inventory(supreme.hangar);
  const random=rng(missionId);
  const ship=JSON.parse(JSON.stringify(supreme));
  const defender=JSON.parse(JSON.stringify(planet));
  defender.resources ||= {metal:0,crystal:0,deuterium:0};
  defender.fleet ||= {};
  defender.defenses ||= {};
  defender.debris ||= {metal:0,crystal:0};
  const oldFleet={...defender.fleet};
  const oldDefenses={...defender.defenses};
  const oldResources={...defender.resources};
  let orbital=null,planetary=null;
  let destroyed=false;
  const hasFleet=sum(defender.fleet)>0;
  if (hasFleet) {
    orbital=engine.resolveCombat({[unit]:1,...quantities(ship.hangar.escort)},attackerTech,
      {fleet:defender.fleet,tech:defenderTech,defenses:{}},
      {shipSpecs:{[unit]:engine.spec},random,maxRounds:6});
    ship.hangar=reduceHangar(ship.hangar,'escort',orbital.attackerSurvivors);
    defender.fleet={...orbital.defenderFleetSurvivors};
    addDebris(defender.debris,orbital.debris);
    destroyed=!(orbital.attackerSurvivors[unit]>0);
  }
  const wonOrbit=!hasFleet || orbital.result==='attacker_win';
  if (!destroyed && wonOrbit && sum(quantities(ship.hangar.invasion))>0) {
    planetary=engine.resolveCombat(quantities(ship.hangar.invasion),attackerTech,
      {fleet:{},tech:defenderTech,defenses:defender.defenses,buildings:defender.buildings,
        resources:defender.resources},
      {random,maxRounds:6});
    ship.hangar=reduceHangar(ship.hangar,'invasion',planetary.attackerSurvivors);
    defender.defenses={...planetary.repairedDefenses};
    addDebris(defender.debris,planetary.debris);
  }
  let loot={metal:0,crystal:0,deuterium:0};
  if (!destroyed && planetary?.result==='attacker_win') loot=allocateLoot(defender,ship,engine);
  if (destroyed) {
    // La distruzione porta anche alla perdita di TUTTO l'hangar.
    ship.hangar={escort:{},invasion:{},reserve:{}};
    addDebris(defender.debris,{metal:6000000,crystal:3600000});
    if (!defender.moon && !defender.bacinoSpaziale && !defender.galatticaOrigin &&
      typeof engine.makeMoon==='function' && random()<.15) defender.moon=engine.makeMoon('Luna');
  }
  return {ship:destroyed?null:ship,planet:defender,destroyed,loot,
    orbital:orbital?{result:orbital.result,rounds:orbital.roundsPlayed}:null,
    planetary:planetary?{result:planetary.result,rounds:planetary.roundsPlayed}:null,
    before:{fleet:oldFleet,defenses:oldDefenses,resources:oldResources},
    after:{fleet:defender.fleet,defenses:defender.defenses,resources:defender.resources},
    debrisBefore:{...planet.debris},moonBefore:Boolean(planet.moon)};
}
module.exports=Object.freeze({resolveSingle,rng});
