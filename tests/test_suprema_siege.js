'use strict';
const {uni,win,D,assert}=require('./helpers/game');
const S=win.UniversumSuprema, B=win.UniversumSupremaSieges;
const T=1700000000000, hour=3600000;
const u=uni(1),p=u.planets[0];
p.resources.deuterium=100000000;
u.researches.hyperspaceDrive=7;
u.supremes=Array.from({length:3},(_,i)=>({
  id:'s'+i,planetId:p.id,status:'docked',operatingFuel:840000,
  hangar:{invasion:{cruiser:20},escort:{},reserve:{lightFighter:10}},
  resources:{metal:0,crystal:0,deuterium:0},shipyardQueue:[]
}));
const target={coords:{g:1,s:2,p:5},ownerUid:'bot',fleet:{},defenses:{},buildings:{hiddenBunker:0},
 resources:{metal:900000,crystal:0,deuterium:0},debris:{metal:0,crystal:0}};
const selected=u.supremes.map(({id})=>({id,whenFull:'support'}));
const before=structuredClone(u);
const s=B.start(u,p,target,'siege-1',selected,'offensiva',2,T);
assert.equal(p.resources.deuterium,before.planets[0].resources.deuterium-6*s.travel.fuelCost);
for (const ship of u.supremes) assert.equal(ship.returnReserve,s.travel.fuelCost);
before.speed=10000;
const other=B.start(before,before.planets[0],target,'other',selected,'offensiva',2,T);
assert.equal(other.arrival,s.arrival);
assert.equal(B.advance(u,s,target,s.arrival-1),0);
assert.equal(B.advance(u,s,target,s.arrival),1);
assert.equal(s.nextAt,s.arrival+2*hour);
const loot=20*3*D.SHIPS.cruiser.cargo;
assert.equal(target.resources.metal,900000-loot);
assert.equal(u.supremes.reduce((n,x)=>n+x.resources.metal,0),loot);
for (const ship of u.supremes) assert.equal(ship.operatingFuel,830000);
s.waveHours=1;
assert.equal(s.nextAt,s.arrival+2*hour);
u.supremes[0].operatingFuel=17999;
u.supremes[1].hangar.invasion={};
assert.equal(B.advance(u,s,target,s.nextAt),1);
assert.equal(u.supremes[0].status,'returning');
assert.equal(u.supremes[1].operatingFuel,822000);
assert.equal(u.supremes[2].operatingFuel,812000);
assert.equal(s.nextAt,s.arrival+3*hour);
assert.equal(B.advance(u,s,target,s.arrival+2*hour),0);
const sup=u.supremes[0], ownOrigin=sup.planetId;
B.settleReturns(u,sup.returnAt);
assert.equal(sup.status,'docked');
assert.equal(sup.planetId,ownOrigin);
assert.equal(sup.returnReserve,undefined);

u.supremes[1].role='support';
u.supremes[1].hangar.escort={lightFighter:10};
u.supremes[2].hangar.escort={lightFighter:10};
const at=s.arrival+2*hour;
const fight=B.orbital(u,s,target,{deathStar:500},{weaponsTech:40},at,'counter-1','s1');
assert(fight);
assert.equal(fight.defenderLosses.naveMadreSuprema,1);
assert.equal(target.debris.metal,6000000+fight.debris.metal);
assert.equal(target.debris.crystal,3600000+fight.debris.crystal);
assert.equal(fight.captured.lightFighter,3);
assert(u.supremes.some(x=>x.id==='s2' && x.status==='sieging'));
assert.equal(B.orbital(u,s,target,{deathStar:1},{},at,'replay','s1'),null);
assert.equal(target.debris.metal,6000000+fight.debris.metal);
assert.equal(B.recall(u,s,at),true);
assert.equal(B.recall(u,s,at),false);
assert.equal(u.supremes.find(x=>x.id==='s2').status,'returning');
console.log('Suprema: lancio, velocità militare, carburante, ondate, bottino, rientri e controffensiva con combattimento reale.');

const prudente=structuredClone(before);
const modeTarget=structuredClone(target);
modeTarget.debris={metal:0,crystal:0};
modeTarget.fleet={};
for (const ship of prudente.supremes) {
  ship.status='docked';ship.operatingFuel=500000;ship.hangar.escort={};
}
prudente.supremaSieges=[];
const safe=B.start(prudente,prudente.planets[0],modeTarget,'safe',selected,'prudente',1,T);
B.advance(prudente,safe,modeTarget,safe.arrival);
prudente.supremes[1].role='support';
const loss=B.orbital(prudente,safe,modeTarget,{deathStar:500},{weaponsTech:40},safe.arrival,'destruction','s1');
assert.equal(loss.defenderLosses.naveMadreSuprema,1);
assert.equal(safe.endedAt,safe.arrival);
assert(prudente.supremes.every(x=>x.status==='returning'));

const intercept=structuredClone(before);
intercept.supremaSieges=[];
for (const ship of intercept.supremes) ship.status='docked';
const is=B.start(intercept,intercept.planets[0],modeTarget,'intercept',selected,'offensiva',1,T);
B.advance(intercept,is,modeTarget,is.arrival);
const result=B.orbital(intercept,is,modeTarget,{deathStar:500},{weaponsTech:40},is.arrival,'defender-arrival');
assert.equal(result.defenderLosses.naveMadreSuprema,3);
assert.deepEqual(Object.keys(result.captured),[]);
assert.equal(is.endedAt,is.arrival);
assert.equal(intercept.supremes.length,0);
console.log('Suprema: distruzione del supporto in modalità Prudente e intercettazione senza catture verificate nel motore.');
