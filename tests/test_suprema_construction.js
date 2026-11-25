'use strict';
const assert = require('node:assert/strict');
const s = require('../modules/engine/suprema.js');
const T = 1700000000000;
const day = s.DAY_MS;
function colony(id) {
  return {id, bacinoSpaziale:{status:'active'}, localResearches:{...s.requirements},
    resources:{metal:3e7, crystal:3e7, deuterium:3e7}, fleet:{lightFighter:601,bomber:10}};
}

const planets = ['a','b','c','d'].map(colony);
const [a,b,c,d] = planets;
const u = {planets, speed:1000, creativeMode:true};
assert.throws(()=>s.start(u,a,'a',T,1),/Bacino/);
d.localResearches.stellarReactor = 3;
assert.throws(()=>s.start(u,d,'d',T,0),/Ricerca locale/);
d.localResearches.stellarReactor = 4;
s.start(u,a,'sup-a',T,0);s.start(u,b,'sup-b',T,0);s.start(u,c,'sup-c',T,0);
assert.throws(()=>s.start(u,d,'sup-d',T,0),/Limite/);
assert.throws(()=>s.start(u,a,'duplicate',T,0),/Bacino/);
assert.equal(s.settle(u,a,T+day-1),false);
for (let n=1;n<=39;n++) {
  assert.equal(s.settle(u,a,T+n*day),true);
  assert.equal(a.bacinoSpaziale.supremaConstruction.daysPaid,n);
  assert.equal(s.settle(u,a,T+n*day),false);
}
assert.equal(u.supremes,undefined);
assert.equal(s.settle(u,a,T+40*day),true);
assert.equal(s.settle(u,a,T+40*day),false);
assert.deepEqual(a.resources,{metal:1e7,crystal:1.8e7,deuterium:2.2e7});
assert.equal(a.bacinoSpaziale.supremaConstruction,undefined);
assert.equal(u.supremes[0].completedAt,T+40*day);

b.resources={metal:0,crystal:0,deuterium:0};
assert.equal(s.settle(u,b,T+2*day),false);
assert.equal(b.bacinoSpaziale.supremaConstruction.status,'stopped');
b.resources={metal:1e6,crystal:1e6,deuterium:1e6};
s.settle(u,b,T+25*day);
assert.equal(b.bacinoSpaziale.supremaConstruction.daysPaid,1);
assert.equal(b.bacinoSpaziale.supremaConstruction.nextPaymentAt,T+26*day);
s.settle(u,b,T+26*day);
assert.deepEqual(s.cancel(b,'sup-b'),s.dailyCost);
assert.equal(s.cancel(b,'sup-b'),null);
assert.deepEqual(b.resources,{metal:500000,crystal:700000,deuterium:800000});
s.start(u,d,'sup-d',T+26*day,0);
s.settle(u,c,T+2*day);
const before = {...c.resources};
c.bacinoSpaziale=null;
assert.equal(s.settle(u,c,T+80*day),false);
assert.equal(s.cancel(c,'sup-c'),null);
assert.deepEqual(c.resources,before);
s.start(u,a,'sup-next',T+40*day,0);

const ship = u.supremes[0];
for (const kind of ['lightFighter','heavyFighter','cruiser','battleship','bomber']) {
  a.fleet[kind] = 1000;
  s.load(u,a,ship,kind,1);
}
assert.equal(s.usedSlots(ship),52);
s.load(u,a,ship,'lightFighter',548);
s.assign(ship,'lightFighter',300,'reserve','invasion');
s.assign(ship,'lightFighter',200,'reserve','escort');
assert.equal(s.usedSlots(ship),600);
assert.equal(ship.hangar.reserve.lightFighter,49);
assert.throws(()=>s.load(u,a,ship,'lightFighter',1),/spazio/);
assert.throws(()=>s.load(u,d,ship,'lightFighter',1),/non valido/);
assert.throws(()=>s.assign(ship,'lightFighter',301,'invasion','escort'),/non valida/);
assert.equal(a.fleet.lightFighter,451);
console.log('Suprema: 40 rate reali, replay, pausa, progressione ripresa, rimborso, cap, Bacini, perdita e hangar verificati.');

const game = require('./helpers/game');
const world = game.uni(1);
const home = world.planets[0];
home.localResearches = {...s.requirements};
home.bacinoSpaziale = {status:'active',invictusConstructions:[]};
world.lastSeen = T;
game.win.UniversumSuprema.start(world,home,'save',T,0);
assert.throws(()=>game.G.startInvictusConstruction(world,0),/Suprema/);
const save = game.plain(world);
game.E.processOfflineProgress(save,T+40*day);
assert.equal(save.supremes.length,1);
assert.equal(save.supremes[0].completedAt,T+40*day);
const balance = game.plain(save.planets[0].resources);
game.E.processOfflineProgress(save,T+40*day);
assert.deepEqual(game.plain(save.planets[0].resources),balance);
console.log('Suprema: recupero dal salvataggio serializzato verificato nel motore offline.');

const yard = game.plain(save.supremes[0]);
yard.status = 'outbound';
const catalog = game.D.SHIPS;
const fighter = catalog.lightFighter;
s.queueShips(yard,world,game.E,catalog,'lot-1','lightFighter',2,T);
s.advanceShipyard(yard,T);
assert.equal(yard.shipyardQueue[0].finishAt,undefined);
assert.equal(yard.shipyardAt,T);
for (const k of Object.keys(yard.resources)) yard.resources[k]=fighter.cost[k]*2;
yard.hangar.reserve.lightFighter=600;
s.advanceShipyard(yard,T+day);
assert.equal(yard.shipyardQueue[0].finishAt,undefined);
yard.hangar.reserve.lightFighter=599;
s.advanceShipyard(yard,T+day);
const due=yard.shipyardQueue[0].finishAt;
assert.equal(due,T+day+game.E.getSingleUnitTime(world,{buildings:{shipyard:12}},'lightFighter')*1000);
assert.equal(yard.resources.metal,fighter.cost.metal);
assert.equal(s.cancelShipOrder(yard,'lot-1'),true);
assert.equal(s.cancelShipOrder(yard,'lot-1'),false);
s.advanceShipyard(yard,due);
s.advanceShipyard(yard,due);
assert.equal(yard.shipyardQueue.length,0);
assert.equal(yard.hangar.reserve.lightFighter,600);
assert.equal(yard.resources.metal,fighter.cost.metal);
console.log('Suprema: cantiere interno Lv.12 in viaggio, sospensione, ripresa, cancellazione pendenti e replay verificati.');
