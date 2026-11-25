'use strict';
const {E,D,G,win,plain,planet,uni,test,passed,assert,now,setTime} = require('./helpers/game');
const H=win.UniversumHangars;
assert(H, 'Modulo hangar Fase 3 assente');
const fixture=(n=1,free=150)=>{const p=planet('mother');p.fleet={mothership:n,lightFighter:free};return p;};
const sum=o=>Object.values(o||{}).reduce((a,b)=>a+Number(b||0),0);
const testRaid=(manifest,target={},cargo={})=>H.resolveIncursion(manifest,{},Object.assign({fleet:{},defenses:{},resources:{metal:100000,crystal:100000,deuterium:100000},buildings:{},tech:{}},target),cargo);
const withCombat=(fn,callback)=>{const previous=G.resolveCombat;G.resolveCombat=fn;try{return callback();}finally{G.resolveCombat=previous;}};
test('F3 1: salvataggi precedenti — hangar unici e vuoti, nessuna nave creata',()=>{
 const p=fixture(4,70);const h=H.normalizePlanet(p);assert.equal(h.length,4);assert(h.every(x=>x.fighters===0));
 const before=plain(p);H.normalizePlanet(p);assert.deepEqual(plain(p),before);assert.equal(p.fleet.lightFighter,70);
});
test('F3 2: carico 1 e 50, più vettori, stock mai duplicato',()=>{
 const p=fixture(3,120),h=H.normalizePlanet(p);H.changeLoad(p,h[0].id,1);H.changeLoad(p,h[1].id,50);
 assert.deepEqual(plain(p.mothershipHangars.map(x=>x.fighters)),[1,50,0]);assert.equal(p.fleet.lightFighter,69);
 assert.equal(sum({free:p.fleet.lightFighter,loaded:sum(p.mothershipHangars.map(x=>x.fighters))}),120);
});
test('F3 3: caricamenti/scaricamenti ripetuti, controlli quantità e capienza',()=>{
 const p=fixture(1,75),id=H.normalizePlanet(p)[0].id;
 for(let i=0;i<50;i++)H.changeLoad(p,id,1);
 assert.equal(p.fleet.lightFighter,25);assert.equal(p.mothershipHangars[0].fighters,50);
 assert.throws(()=>H.changeLoad(p,id,1),/Capacità/);
 assert.throws(()=>H.changeLoad(p,id,-51),/Capacità/);
 assert.throws(()=>H.changeLoad(p,id,1.5),/Quantità/);
 for(let i=0;i<50;i++)H.changeLoad(p,id,-1);
 assert.equal(p.fleet.lightFighter,75);assert.equal(p.mothershipHangars[0].fighters,0);
 assert.throws(()=>H.changeLoad(p,id,-1),/Capacità/);
});
test('F3 4: manifesto caricato obbligatorio e flotta esclusivamente Nave Madre',()=>{
 const p=fixture(2,120),h=H.normalizePlanet(p);H.changeLoad(p,h[0].id,1);H.changeLoad(p,h[1].id,50);
 assert.throws(()=>H.validateMission({mothership:2,lightFighter:1},p.mothershipHangars),/solo Navi Madre/);
 assert.throws(()=>H.validateMission({mothership:3},p.mothershipHangars),/numero hangar/i);
 assert.throws(()=>H.validateMission({mothership:1},[{...h[0],fighters:0}]),/almeno un Caccia/);
 assert.throws(()=>H.verifyManifest([{...h[0],fighters:51}]),/non valido/);
 assert.throws(()=>H.verifyManifest([p.mothershipHangars[0],p.mothershipHangars[0]]),/non valido/);
 assert.equal(H.validateMission({mothership:2},p.mothershipHangars).length,2);
});
test('F3 5: presa e rientro mantengono l’identità; doppio rientro respinto',()=>{
 const p=fixture(2,100),a=H.normalizePlanet(p);H.changeLoad(p,a[0].id,20);H.changeLoad(p,a[1].id,40);
 const manifest=H.select(p,1,[a[1].id],true);H.take(p,manifest);p.fleet.mothership--;
 assert.equal(p.mothershipHangars.length,1);assert.equal(p.mothershipHangars[0].fighters,20);
 const reloaded=plain(p);H.restore(reloaded,manifest);reloaded.fleet.mothership++;
 assert.deepEqual(plain(H.normalizePlanet(reloaded)),plain(H.normalizePlanet({...p,fleet:{...p.fleet,mothership:2},mothershipHangars:[p.mothershipHangars[0],...manifest]})));
 assert.throws(()=>H.restore(reloaded,manifest),/duplicato/);
});
test('F3 6: ricostruzione da inbox in un salvataggio multiplayer, una sola volta',()=>{
 const p=fixture(2,20),[a,b]=H.normalizePlanet(p);H.changeLoad(p,a.id,5);H.changeLoad(p,b.id,10);
 p.fleet.mothership=1;
 H.applyInbox(p,{fleet:{mothership:-1},hangarLosses:{battle:[a.id]}},2);
 assert.equal(p.mothershipHangars.length,1);assert.equal(p.mothershipHangars[0].id,b.id);
 const returned={id:a.id,fighters:5};p.fleet.mothership=2;H.applyInbox(p,{fleet:{mothership:1},hangarReturns:{return1:[returned]}},1);
 assert.equal(p.mothershipHangars.length,2);assert.equal(p.mothershipHangars[1].fighters,5);
});
test('F3 7: bersaglio libero — due battaglie indipendenti, bottino teorico 1000 per caccia',()=>{
 const p=fixture(1,50),id=H.normalizePlanet(p)[0].id;H.changeLoad(p,id,50);
 const b=testRaid(p.mothershipHangars);
 assert.equal(b.orbit.roundsPlayed,0);assert.equal(b.ground.roundsPlayed,0);
 assert.equal(b.ships.mothership,1);assert.equal(b.recoveredFighters,50);assert.equal(sum(b.loot),50000);
});
test('F3 8: limite contemporaneo delle stive e delle risorse protette',()=>{
 const p=fixture(2,100),h=H.normalizePlanet(p);H.changeLoad(p,h[0].id,50);H.changeLoad(p,h[1].id,50);
 const b=testRaid(p.mothershipHangars,{resources:{metal:10000,crystal:20000,deuterium:30000},buildings:{hiddenBunker:9}}, {metal:90000});
 assert.equal(sum(b.loot),3000); // 50% della frazione non protetta del pianeta.
 assert.equal(b.loot.metal,500);assert.equal(b.loot.crystal,1000);assert.equal(b.loot.deuterium,1500);
 const full=testRaid(p.mothershipHangars,{}, {metal:100000});assert.equal(sum(full.loot),0);
});
test('F3 9: vittoria non obbligatoria — lo stallo dopo tre round permette bottino',()=>{
 const manifest=[{id:'alpha',fighters:9}];const seen=[];
 const result=withCombat((ships,_tech,enemy,options)=>{
  seen.push({ships:plain(ships),defender:plain(enemy),max:options.maxRounds});
  return {result:'draw',roundsPlayed:3,attackerTagsAlive:options.attackerTags,
    defenderTagsAlive:options.defenderTags||{},attackerSurvivors:ships,attackerLosses:{},defenderLosses:{},
    defenderFleetSurvivors:enemy.fleet||{},repairedDefenses:enemy.defenses||{},debris:{metal:0,crystal:0}};
 },()=>testRaid(manifest,{fleet:{heavyFighter:20},defenses:{rocketLauncher:20}}));
 assert.equal(seen.length,2);assert.deepEqual(plain(seen.map(x=>x.max)),[3,3]);
 assert.deepEqual(plain(seen[0].ships),{mothership:1});assert.deepEqual(plain(seen[0].defender.defenses),{});
 assert.deepEqual(plain(seen[1].ships),{lightFighter:9});assert.deepEqual(plain(seen[1].defender.fleet),{});
 assert.equal(result.recoveredFighters,9);assert.equal(sum(result.loot),9000);
});
test('F3 10: distruzione di un vettore non trasferisce i suoi caccia superstiti',()=>{
 const m=[{id:'carrier_a',fighters:12},{id:'carrier_b',fighters:9}],rounds=[];
 const b=withCombat((ships,tech,enemy,options)=>{
  rounds.push(options.maxRounds);
  if(ships.mothership) return {roundsPlayed:3,result:'draw',attackerTagsAlive:{mothership:['carrier_b']},
    defenderTagsAlive:{},attackerSurvivors:{mothership:1},attackerLosses:{mothership:1},
    defenderFleetSurvivors:enemy.fleet,repairedDefenses:{},debris:{metal:1000,crystal:2000}};
  return {roundsPlayed:3,result:'draw',attackerTagsAlive:{lightFighter:[...Array(12).fill('carrier_a'),...Array(9).fill('carrier_b')]},
    attackerSurvivors:{lightFighter:21},attackerLosses:{},defenderFleetSurvivors:{},repairedDefenses:enemy.defenses,debris:{metal:0,crystal:0}};
 },()=>testRaid(m));
 assert.equal(b.carriers.length,1);assert.equal(b.carriers[0].id,'carrier_b');assert.equal(b.carriers[0].fighters,9);
 assert.equal(b.lostWithCarriers,12);assert.equal(b.recoveredFighters,9);assert.equal(sum(b.loot),9000);
 assert.deepEqual(rounds,[3,3]);
});
test('F3 11: solo difese, solo flotta orbitale e entrambi: separazione reale',()=>{
 const m=[{id:'m1',fighters:4}];
 const onlyDef=testRaid(m,{defenses:{rocketLauncher:5}});
 const onlyFleet=testRaid(m,{fleet:{lightFighter:7}});
 const both=testRaid(m,{fleet:{lightFighter:7},defenses:{rocketLauncher:5}});
 assert.equal(onlyDef.orbit.roundsPlayed,0);assert.equal(onlyFleet.ground.roundsPlayed,0);
 assert(onlyDef.ground.roundsPlayed<=3 && both.ground.roundsPlayed<=3);
 assert(onlyFleet.orbit.roundsPlayed<=3 && both.orbit.roundsPlayed<=3);
});
test('F3 12: nessuna perdita di salvataggio e identità in round-trip JSON',()=>{
 const p=fixture(3,80),h=H.normalizePlanet(p);H.changeLoad(p,h[0].id,20);H.changeLoad(p,h[1].id,50);
 const restored=plain(plain(p));assert.deepEqual(plain(H.normalizePlanet(restored)),plain(p.mothershipHangars));
 assert.equal(restored.fleet.lightFighter+sum(restored.mothershipHangars.map(x=>x.fighters)),80);
});
test('F3 13: viaggio offline completo, salvataggio a meta viaggio, bottino unico e rientro',()=>{
 const u=uni(1),p=u.planets[0],H=win.UniversumHangars;
 p.fleet={mothership:1,lightFighter:50};
 const id=H.normalizePlanet(p)[0].id;H.changeLoad(p,id,50);
 const slot=win.__UniversumGalaxyModules.generateProceduralSlot;
 win.__UniversumGalaxyModules.generateProceduralSlot=()=>({ownerType:'bot',name:'Avversario',fleet:{},defenses:{},
   resources:{metal:100000,crystal:100000,deuterium:100000},buildings:{},tech:{},debris:{metal:0,crystal:0}});
 try {
   G.launchFleet(u,0,{g:1,s:3,p:2},'incursion',{mothership:1},{metal:0,crystal:0,deuterium:0},{carrierIds:[id]});
   assert.equal(p.fleet.mothership,0);assert.equal(p.fleet.lightFighter,0);assert.equal(p.mothershipHangars.length,0);
   const saved=plain(u);const flight=saved.fleetsInFlight[0];
   setTime(flight.arrivalTime);G.processFleetsAndBots(saved);
   assert.equal(saved.fleetsInFlight[0].status,'returning');
   assert.equal(sum(saved.fleetsInFlight[0].cargo),50000);
   assert.equal(saved.fleetsInFlight[0].carrierHangars[0].fighters,50);
   const again=plain(saved);setTime(flight.returnTime);G.processFleetsAndBots(again);
   assert.equal(again.fleetsInFlight.length,0);assert.equal(again.planets[0].fleet.mothership,1);
   assert.equal(again.planets[0].mothershipHangars[0].fighters,50);
   assert.equal(again.planets[0].mothershipHangars[0].id,id);
   const res=plain(again.planets[0].resources);G.processFleetsAndBots(again);
   assert.deepEqual(plain(again.planets[0].resources),res);
 } finally {win.__UniversumGalaxyModules.generateProceduralSlot=slot;setTime(1800000000000);}
});
console.log('FASE 3 —',passed.length,'gruppi hangar/combattimento completati');
