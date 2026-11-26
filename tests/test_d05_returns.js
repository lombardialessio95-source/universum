'use strict';
const {G,win,uni,now,plain,assert,test}=require('./helpers/game');
const mod=win.__UniversumGalaxyModules;
function fixture() {
  const u=uni(2);
  const gal={id:'gal_one',coords:{g:1,s:3,p:2},resources:{metal:100,crystal:50,deuterium:1e8},
    orbitingFleet:{mothership:1},mothershipHangars:[{id:'carrier_a',fighters:17}]};
  u.galattiche=[gal];
  const f=G.launchFleet(u,0,u.planets[1].coords,'transport',{mothership:1},{metal:75},
    {originType:'galattica',originGalatticaId:gal.id});
  assert.equal(gal.orbitingFleet.mothership,0);
  assert.equal(gal.mothershipHangars.length,0);
  assert.equal(f.carrierHangars[0].fighters,17);
  f.status='returning';
  return {u,gal,f};
}
test('Galattica spostata, salvataggio a metà tratta e aggancio singolo',()=>{
  const {u,gal,f}=fixture();
  gal.coords.s++;
  mod.processFleetsAndBots(u,f.returnTime);
  assert.equal(u.fleetsInFlight[0].mission,'galattica-return');
  const saved=plain(u), eta=saved.fleetsInFlight[0].arrivalTime;
  mod.processFleetsAndBots(saved,eta);
  mod.processFleetsAndBots(saved,eta+1);
  const g=saved.galattiche[0];
  assert.equal(saved.fleetsInFlight.length,0);
  assert.deepStrictEqual(plain(g.mothershipHangars),[{id:'carrier_a',fighters:17}]);
  assert.equal(g.resources.metal,100);
  assert.equal(g.orbitingFleet.mothership,1);
});
test('Galattica distrutta durante la tratta lenta, hangar e carico sulla colonia',()=>{
  const {u,gal,f}=fixture();
  gal.coords.s++;
  mod.processFleetsAndBots(u,f.returnTime);
  u.galattiche=[];
  mod.processFleetsAndBots(u,u.fleetsInFlight[0].arrivalTime);
  const redirected=u.fleetsInFlight[0];
  const home=u.planets.find(p=>p.id===redirected.originPlanetId);
  const initial=home.resources.metal;
  mod.processFleetsAndBots(u,redirected.returnTime);
  mod.processFleetsAndBots(u,redirected.returnTime);
  assert.equal(u.fleetsInFlight.length,0);
  assert.equal(home.fleet.mothership,1);
  assert.equal(home.resources.metal,initial+75);
  assert.equal(home.mothershipHangars[0].fighters,17);
});
test('Ritiro da occupazione conserva hangar, origine e stato del Bacino',()=>{
  const u=uni(1), source={...u.planets[0].coords};
  u.activeSieges=[{id:'occ',type:'occupy',originCoords:source,targetCoords:{g:1,s:7,p:2},
    originPlanetId:'A',birthBacinoAt:12,crepuscoloDamaged:true,ships:{mothership:1,crepuscolo:1},
    carrierHangars:[{id:'m',fighters:24}],cargo:{metal:39,crystal:12,deuterium:5}}];
  win.UniversumSiege.withdrawSiege(u,'occ');
  const f=u.fleetsInFlight[0];
  assert.equal(f.birthBacinoAt,12); assert.equal(f.crepuscoloDamaged,true);
  assert.equal(f.carrierHangars[0].fighters,24); assert.equal(f.cargo.metal,39);
});
test('Embargo online restituisce il residuo e il riscatto',()=>{
  const cargo=win.__UniversumMPModules.returnCargoWithRansom({mission:'embargo',siegeStartedAt:1,
    cargo:{metal:17,deuterium:500},siegeDeuterium:12.5,pendingRansom:{crystal:8,deuterium:3}});
  assert.deepEqual(plain(cargo),{metal:17,crystal:8,deuterium:15});
});
