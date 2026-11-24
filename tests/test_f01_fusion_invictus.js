/** UNIVERSUM F01 — Test della fusione alimentata, energia OGame e Invictus.
 * Prove locali deterministiche: nessuna lettura Firestore né rete esterna.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const NOW = 1800000000000;
class FixedDate extends Date { static now() { return NOW; } }
const document = { addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; }, createElement() { return { getContext() { return {}; } }; } };
const win = { document, navigator: {}, addEventListener() {}, matchMedia() { return { matches: false, addListener() {} }; } };
const context = { window: win, document, console, Date: FixedDate, Math, JSON, Set, Map, Number, Object, Array, String, Boolean, Promise, URL,
  navigator: win.navigator, localStorage: { getItem() { return null; }, setItem() {} }, setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {} };
vm.createContext(context);
const html = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
for (const m of html.matchAll(/<script\s+src="\.\/([^" ]+\.js)"(?:\s+defer)?\s*><\/script>/g)) {
  const file = m[1]; if (file.startsWith('graphics-') || file === 'firebase-config.js') continue;
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'), context, {filename:file,timeout:2000});
}
const D = win.UniversumData, E = win.UniversumEngine, G = win.UniversumGalaxy, MP = win.UniversumMP;
const intern = win.__UniversumEngineModules;
const plain=x=>JSON.parse(JSON.stringify(x));
let checks=0;
function check(value, expected, name){assert.equal(value,expected,name);checks++;}
function near(value, expected, tolerance, name){assert(Math.abs(value-expected)<=tolerance, `${name}: ${value} != ${expected} (±${tolerance})`);checks++;}
function ok(condition,name){assert(condition,name);checks++;}
function planet(resources={},buildings={}){
  return {id:'p0',name:'Pianeta',coords:{g:1,s:1,p:2},maxTemp:30,
    resources:{metal:0,crystal:0,deuterium:0,...resources},
    buildings:{metalMine:0,crystalMine:0,deuteriumSynth:0,solarPlant:0,fusionReactor:0,metalStorage:20,crystalStorage:20,deuteriumTank:20,...buildings},
    fleet:{},defenses:{},moon:null,buildQueue:[],shipyardQueue:[],defenseQueue:[],localResearches:{},localResearchQueue:null,bacinoSpaziale:null};
}
function universe(p, research={}) {return {id:'f01',speed:1,creativeMode:false,planets:[p],researches:{...research},researchQueue:null,
  galattiche:[],fleetSelection:{},fleetsInFlight:[],activeSieges:[],incomingSieges:[],messages:[],lastSeen:NOW,galaxyDeltas:{}};}

// Formula OGame per qualunque livello 0-30 e tecnologie campione, nessun bonus lineare.
for(let lv=0;lv<=30;lv++) for(const tech of [0,1,3,5,8,12,20]){
  const expected = Math.floor(30*lv*(1.05+0.01*tech)**lv);
  check(D.getBuildingEnergyDelta('fusionReactor',lv,30,tech),expected,`Energia fusione lv.${lv}, tech.${tech}`);
  if(lv>0){const p=planet({deuterium:1e9},{fusionReactor:lv});const v=E.getPlanetProduction(p,universe(p,{energyTech:tech}));
    check(v.fusionEnergy,expected,'Energia del motore = formula, non doppio bonus');
    check(v.energyProduced,expected,'Reattore alimentato al 100%');}
}

// Energia minima e proporzionale, con produzione base gratuita distinta dalla miniera.
for(const [made,needed,eff] of [[0,10000,.03],[100,10000,.03],[300,10000,.03],[500,10000,.05],[5000,10000,.5],[10000,10000,1],[15000,10000,1],[5000,0,1]])
  near(intern.getMineEfficiency(made,needed),eff,1e-12,'Efficienza '+made+'/'+needed);
const noEnergy=planet({}, {metalMine:10,crystalMine:10,deuteriumSynth:10});
const pNo=E.getPlanetProduction(noEnergy,universe(noEnergy));
check(pNo.efficiency,.03,'Senza energia miniera al 3%');
ok(pNo.metalPerHour>30,'La miniera produce al 3%');
ok(pNo.crystalPerHour>15,'Produzione base gratuita non soppressa');

// Senza combustibile e senza produzione di deuterio la fusione è spenta.
const dead=planet({deuterium:0},{fusionReactor:15,metalMine:6});
const deadStats=E.getPlanetProduction(dead,universe(dead,{energyTech:6}));
check(deadStats.fusionEnergy,0,'Fusione spenta senza carburante');
check(deadStats.fusionFraction,0,'Nessuna attività phantom');
check(deadStats.fusionFuelPerHour,0,'Consumo nullo a centrale spenta');
check(deadStats.efficiency,.03,'Miniera al 3% con fusione spenta');

// Con carburante la fusione eroga l'energia nominale, consuma l'upkeep esatto.
const fueled=planet({deuterium:20000},{fusionReactor:10,metalMine:10,deuteriumSynth:0});
const vf=E.getPlanetProduction(fueled,universe(fueled,{energyTech:4}));
const nominalBurn=Math.ceil(10*10*1.1**10);
check(vf.fusionFraction,1,'A pieno regime con carburante');
check(vf.fusionEnergy,D.getBuildingEnergyDelta('fusionReactor',10,30,4),'Energia esatta alimentata');
check(vf.fusionFuelPerHour,nominalBurn,'Formula nominale combustibile invariata');
check(vf.deuteriumPerHour,-nominalBurn,'Deuterio realmente consumato');

// Senza scorte ma produzione sufficiente la centrale resta accesa al 100%.
const self=planet({deuterium:0},{solarPlant:50,deuteriumSynth:12,fusionReactor:2});
const selfU=universe(self);
const vs=E.getPlanetProduction(self,selfU);
check(vs.fusionFraction,1,'Autosostentamento senza riserva');
check(vs.fusionFuelPerHour,Math.ceil(10*2*1.1**2),'Autoconsumo completo');
ok(vs.deuteriumPerHour>=0,'Consumo compensato dal sintetizzatore');
E.tick(selfU,7200);ok(self.resources.deuterium>=0,'Due ore senza riserva e senza negativo');

// Insufficiente: regime proporzionale, la produzione effettiva copre il consumo.
const partial=planet({deuterium:0},{deuteriumSynth:3,fusionReactor:10,metalMine:6});
const partialU=universe(partial);const vp=E.getPlanetProduction(partial,partialU);
ok(vp.fusionFraction>0 && vp.fusionFraction<1,'Parzializzazione senza riserve');
ok(vp.fusionEnergy>0 && vp.fusionEnergy< D.getBuildingEnergyDelta('fusionReactor',10),'Energia ridotta');
ok(vp.deuteriumPerHour>=0,'Nessun carburante creato dal nulla');
const raw = D.getBaseHourlyProduction('deuteriumSynth',3,30);
ok(Math.floor(raw*vp.efficiency)+1e-8>=vp.fusionFuelPerHour,'Energia alimentata da consumo reale');
for(let i=0;i<60;i++) E.tick(partialU,60);
check(partial.resources.deuterium,0,'Nessuna oscillazione artificiale o deuterio negativo');
near(E.getPlanetProduction(partial,partialU).fusionFraction,vp.fusionFraction,1e-10,'Stato di equilibrio stabile');

// Sweep deterministico: nessuna combinazione può emettere energia non finanziata
// dal deuterio prodotto quando lo stock è zero (anche agli estremi 0 e 30).
for (const fl of [0,1,3,6,10,15,20,25,30])
for (const dl of [0,1,3,7,15,25])
for (const sl of [0,8,25,50])
for (const tech of [0,3,9,18]) {
  const sw=planet({deuterium:0},{fusionReactor:fl,deuteriumSynth:dl,solarPlant:sl,metalMine:12});
  const uw=universe(sw,{energyTech:tech});
  const v=E.getPlanetProduction(sw,uw);
  const full=D.getBuildingEnergyDelta('fusionReactor',fl,30,tech);
  const supplied=Math.floor(D.getBaseHourlyProduction('deuteriumSynth',dl,30)*v.efficiency);
  ok(Number.isFinite(v.fusionFraction) && v.fusionFraction>=0 && v.fusionFraction<=1,'Sweep frazione fisica');
  ok(v.fusionEnergy>=0 && v.fusionEnergy<=full,'Sweep energia bounded');
  ok(v.deuteriumPerHour>=0,'Sweep zero stock non negativo');
  ok(supplied+1e-7>=v.fusionFuelPerHour,'Sweep nessuna energia senza D pagato');
}

// Esaurimento a metà del periodo: non contare la fusione piena per tutto l'intervallo.
const first=planet({deuterium:3},{fusionReactor:20,metalMine:20});
const uFirst=universe(first);const prodFirst=E.getPlanetProduction(first,uFirst);
const tDry=3*3600/(-prodFirst.deuteriumPerHour);
const atZero=planet({deuterium:0},{fusionReactor:20,metalMine:20});
const prodAfter=E.getPlanetProduction(atZero,universe(atZero));
E.tick(uFirst,3600);
check(first.resources.deuterium,0,'Esaurimento non va in negativo');
near(first.resources.metal, prodFirst.metalPerSec*tDry + prodAfter.metalPerSec*(3600-tDry),1e-5,'Accredito in due periodi');
check(E.getPlanetProduction(first,uFirst).fusionEnergy,0,'Al termine energia fusione zero');
first.resources.deuterium=500;check(E.getPlanetProduction(first,uFirst).fusionFraction,1,'Riattivazione con rifornimento');

// Offline rapido/assenza lunga e online: ricostruzione identica, con cap depositi.
const off=universe(planet({deuterium:100},{solarPlant:0,fusionReactor:12,metalMine:25,deuteriumSynth:0}),{energyTech:7});
const tickCopy=universe(plain(off.planets[0]),{energyTech:7});
E.tick(tickCopy,7200);off.lastSeen=NOW-7200*1000;E.processOfflineProgress(off);
for(const id of ['metal','crystal','deuterium']) near(off.planets[0].resources[id],tickCopy.planets[0].resources[id],1e-7,'Offline vs tick '+id);
const doc={...plain(tickCopy.planets[0]),resources:{metal:0,crystal:0,deuterium:100},ownerUid:'tester',lastUpdated:NOW-7200*1000};
win.fbAuth={currentUser:{uid:'tester'}};
win.UniversumUI.state.currentUniverse=tickCopy;
const online=MP.calculateLiveResources(doc,1);
for(const id of ['metal','crystal','deuterium']) check(online.resources[id],Math.floor(tickCopy.planets[0].resources[id]),'Online vs offline '+id);

// Galattica: stessa fisica del combustibile, senza modificare la sua produzione base.
const gal={id:'g',resources:{metal:0,crystal:0,deuterium:0},structures:{reattoreFusione:12,generatoreMetallo:10,generatoreCristallo:0,sintetizzatoreDeuterio:0},defenses:{},orbitingFleet:{}};
const uGal=universe(planet());uGal.galattiche=[gal];
check(E.getGalatticaProduction(gal,uGal).energyProduced,0,'Galattica senza D: fusione spenta');
gal.resources.deuterium=2;E.tick(uGal,3600);
check(gal.resources.deuterium,0,'Galattica: combustibile esaurito');
ok(gal.resources.metal>=0,'Galattica produzione limitata dopo fine carburante');

// Invictus: coefficiente 5000, cargo invariato, zero esplicito valido.
check(D.SHIPS.invictus.fuelConsumption,5000,'Invictus 5000');
check(D.SHIPS.invictus.cargo,1000000,'Stiva originale');
check(D.getShipFuelConsumption('solarSatellite'),0,'Zero esplicito non diventa 10');
check(D.getShipFuelConsumption('ghost'),10,'Fallback solo valore assente');
for(const pct of [10,30,50,70,100]) for(const distance of [5,1000,3000,20000,50000]){
  const uv=universe(planet());const stats=G.getFleetSpeedAndFuel(uv,{invictus:1},distance,pct);
  const f=pct/100,expect=Math.max(1,Math.floor((1+5000*distance/35000)*(.2+.8*f*f)));
  check(stats.fuelCost,expect,`Invictus viaggio ${distance}/${pct}%`);
}
const fleetOther={lightFighter:10,smallCargo:2};
for(const pct of [10,50,100])for(const dist of [1000,20000,50000]){
  const uv=universe(planet());const stats=G.getFleetSpeedAndFuel(uv,fleetOther,dist,pct);
  const sum=10*D.SHIPS.lightFighter.fuelConsumption+2*D.SHIPS.smallCargo.fuelConsumption;
  check(stats.fuelCost,Math.max(1,Math.floor((1+sum*dist/35000)*(.2+.8*(pct/100)**2))),'Altre navi invariate');
}
// Costo ordinario + fee salto UNA SOLA VOLTA; fallimento senza sottrarre D.
function invFleet(deut){const p=planet({deuterium:deut,metal:1000,crystal:1000});p.bacinoSpaziale={status:'active',invictusActive:1,invictusConstructions:[],crepuscolo:null,paid:{metal:0,crystal:0,deuterium:0}};return universe(p);}
for(const pct of [10,50,100]){
 const uni=invFleet(1e7);const target={g:1,s:498,p:2};const distance=G.calculateDistance(uni.planets[0].coords,target);
 const regular=G.getFleetSpeedAndFuel(uni,{invictus:1},distance,pct).fuelCost;
 const jump=G.getInvictusJumpCost(uni.planets[0].coords,target,1);
 ok(regular+jump<D.SHIPS.invictus.cargo,'Missione massima fattibile con stiva invariata');
 const before=uni.planets[0].resources.deuterium;
 const mission=G.launchFleet(uni,0,target,'attack',{invictus:1},{metal:0,crystal:0,deuterium:0},{fuelPercent:pct});
 check(before-uni.planets[0].resources.deuterium,regular+jump,'Consumo ordinario + salto una sola volta');
 check(uni.planets[0].bacinoSpaziale.invictusActive,0,'Invictus lascia solo il Bacino d’origine');
 check(mission.originPlanetId,'p0','Origine Bacino conservata nel viaggio');
 const noFuel=invFleet(regular+jump-1);
 assert.throws(()=>G.launchFleet(noFuel,0,target,'attack',{invictus:1},{},{fuelPercent:pct}),/insufficienti/i);
 check(noFuel.planets[0].bacinoSpaziale.invictusActive,1,'Fallimento non rimuove Invictus');
 ok(noFuel.planets[0].resources.deuterium>=0,'Nessun addebito su carburante insufficiente');
}
// Il rientro restituisce la nave esattamente al Bacino di partenza.
const returning=invFleet(1e7);
const ret=G.launchFleet(returning,0,{g:1,s:2,p:2},'attack',{invictus:1});
ret.status='returning';ret.returnTime=NOW-1000;
G.processFleetsAndBots(returning);
check(returning.planets[0].bacinoSpaziale.invictusActive,1,'Rientro al Bacino originale');
check(returning.fleetsInFlight.length,0,'Flotta di rientro rimossa una sola volta');
const intergalactic=invFleet(1e7);
assert.throws(()=>G.launchFleet(intergalactic,0,{g:2,s:1,p:2},'attack',{invictus:1}),/altra galassia/);
check(intergalactic.planets[0].bacinoSpaziale.invictusActive,1,'Divieto intergalattico conservato');

// No timer/Firestore/polling aggiuntivo nei moduli: controllo statico.
const body=['modules/engine/production.js','modules/engine/progress.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
for(const forbidden of ['onSnapshot(','.collection(','.runTransaction(','setInterval('])ok(!body.includes(forbidden),'Nessun nuovo accesso Firestore/timer: '+forbidden);
console.log(`F01: ${checks} verifiche su fusione, minimo 3%, offline, multiplayer, galattica e Invictus superate.`);
