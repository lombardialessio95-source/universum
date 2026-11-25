/** UNIVERSUM — regressioni formula OGame e parita' economica offline/online.
 * Test deterministico in VM, senza richieste Firebase o server esterni.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const FIXED_NOW = 1800000000000;
class FixedDate extends Date { static now() { return FIXED_NOW; } }
const doc = { addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; }, createElement() { return { getContext() { return {}; } }; } };
const win = { document: doc, navigator: {}, addEventListener() {}, matchMedia() { return { matches: false, addListener() {} }; } };
const sandbox = { window: win, document: doc, console, Date: FixedDate, Math, JSON, Set, Map, Number, Object, Array, String, Boolean, Promise, URL,
  navigator: win.navigator, localStorage: { getItem() { return null; }, setItem() {} },
  setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {} };
vm.createContext(sandbox);
const html = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const scripts = [...html.matchAll(/<script\s+src="\.\/([^" ]+\.js)"(?:\s+defer)?\s*><\/script>/g)].map(m => m[1]);
for (const script of scripts) {
  if (script.startsWith('graphics-') || script === 'firebase-config.js') continue;
  vm.runInContext(fs.readFileSync(path.join(root, script), 'utf8'), sandbox, { filename: script, timeout: 1500 });
}
const D = win.UniversumData, E = win.UniversumEngine, MP = win.UniversumMP, UI = win.UniversumUI;
assert(D && E && MP && UI, 'Le API del gioco non devono essere rimosse');
const plain = x => JSON.parse(JSON.stringify(x));
let checks = 0;
function check(actual, expected, msg) { assert.equal(actual, expected, msg); checks++; }
function deep(actual, expected, msg) { assert.deepEqual(plain(actual), expected, msg); checks++; }
const capacity = level => 5000 * Math.floor(2.5 * Math.exp((20 * level) / 33));

// Vettori ufficiali richiesti: non calcolati dalla formula del codice.
const official = new Map([
  [0,10000], [1,20000], [2,40000], [3,75000], [4,140000],
  [5,255000], [6,470000], [7,865000], [8,1590000],
  [9,2920000], [10,5355000], [12,18005000], [15,110925000]
]);
for (const [lv, expected] of official) check(D.getStorageCapacity(lv), expected, `Capacita' ufficiale lv.${lv}`);
for (let lv = 0; lv <= 35; lv++) check(D.getStorageCapacity(lv), capacity(lv), `Formula completa lv.${lv}`);
for (const [value, expected] of [[-1,10000],['4.9',140000],[0.99,10000],[NaN,10000],[null,10000],['',10000]]) {
  check(D.getStorageCapacity(value), expected, `Normalizzazione livello ${String(value)}`);
}

const defs = [
  ['metalStorage',1000,0,0],
  ['crystalStorage',1000,500,0],
  ['deuteriumTank',1000,1000,0]
];
for (const [id,m,c,d] of defs) {
  const def = D.BUILDINGS[id];
  check(def.factor, 2, `${id}: fattore 2 non modificato`);
  deep(def.baseCost,{metal:m,crystal:c,deuterium:d},`${id}: costo base invariato`);
  for(let lv = 0; lv <= 35; lv++) {
    const costLevel = Math.max(1,lv);
    const mult = 2 ** (costLevel - 1);
    deep(D.getBuildingCost(id,lv),{metal:m*mult,crystal:c*mult,deuterium:d},`${id} lv.${lv} costo`);
    check(D.getStorageCapacity(lv), capacity(lv), `${id} lv.${lv} capacita'`);
  }
  for(let target=1;target<=30;target++) {
    const cost=D.getBuildingCost(id,target);
    assert(cost.metal <= D.getStorageCapacity(target-1), `${id} ${target-1}->${target} deve essere finanziabile`);
    checks++;
  }
  const lv31=D.getBuildingCost(id,31);
  assert(lv31.metal>D.getStorageCapacity(30), `${id}: 30->31 limitato matematicamente`);
  check(lv31.metal, 1073741824000, `${id}: costo metallo Lv.31`);
  check(D.getStorageCapacity(30), 984403885000, 'Capacita\' OGame Lv.30');
}
check(1073741824000-984403885000, 89337939000, 'Scarto metallico Lv.30->31');
// Impronta SHA-256 del catalogo dei costi della versione ufficiale pre-modifica
// (commit 400c1d7d). Include 71 oggetti: costi di TUTTI gli edifici,
// edifici lunari e ricerche Lv.1–35, oltre a TUTTE le navi e difese.
const goldenCosts = {};
for (const id of Object.keys(D.BUILDINGS)) goldenCosts['b:'+id] = Array.from({length:35}, (_,i) => D.getBuildingCost(id,i+1));
for (const id of Object.keys(D.MOON_BUILDINGS)) goldenCosts['moon:'+id] = Array.from({length:35}, (_,i) => D.getBuildingCost(id,i+1,true));
for (const id of Object.keys(D.RESEARCHES)) goldenCosts['r:'+id] = Array.from({length:35}, (_,i) => D.getResearchCost(id,i+1));
for (const id of Object.keys(D.SHIPS)) {
  if (!['hephaestusForge','prometheusOracle'].includes(id)) goldenCosts['s:'+id] = D.SHIPS[id].cost;
}
for (const id of Object.keys(D.DEFENSES)) goldenCosts['d:'+id] = D.DEFENSES[id].cost;
check(Object.keys(goldenCosts).length,71,'Numero cataloghi costi confronto baseline');
const costDigest=crypto.createHash('sha256').update(JSON.stringify(goldenCosts)).digest('hex');
check(costDigest,'e4664999747bdb4cb9771b035c4534806ee129d2ad49a444f847c9d04b9a5079',
  'Impronta tutti i costi invariata rispetto a main pre-modifica');

// Campioni di costi estranei: guardia contro modifiche accidentali al bilanciamento.
deep(D.getBuildingCost('metalMine',1),{metal:60,crystal:15,deuterium:0},'Miniera invariata');
deep(D.getResearchCost('energyTech',1),{metal:0,crystal:800,deuterium:400},'Ricerca invariata');
for (const id of Object.keys(D.SHIPS)) {
  const def=D.SHIPS[id];assert(def.cost && def.cost.metal>=0 && def.cost.crystal>=0 && def.cost.deuterium>=0,`${id} costo nave valido`);checks++;
}

function planet(resources, buildings={}) {
  return { id:'A', name:'Pianeta A',coords:{g:1,s:1,p:2},resources:{metal:0,crystal:0,deuterium:0,...resources},
    buildings:{metalMine:0,crystalMine:0,solarPlant:0,deuteriumSynth:0,metalStorage:0,crystalStorage:0,deuteriumTank:0,...buildings},
    fleet:{},defenses:{},maxTemp:30,buildQueue:[],shipyardQueue:[],defenseQueue:[],localResearches:{},localResearchQueue:null,moon:null,bacinoSpaziale:null};
}
function universe(p){return {id:'unit', speed:1, createdAt:FIXED_NOW, seed:1,galaxyDeltas:{},planets:[p],researches:{},researchQueue:null,researchModelVersion:1,galattiche:[],fleetsInFlight:[],messages:[],lastSeen:FIXED_NOW};}
function compare1hour(resources, buildings, label) {
  const p0=planet(resources,buildings),u=universe(plain(p0));
  const onlineDoc={...plain(p0),lastUpdated:FIXED_NOW-3600000};
  const current=D.getStorageCapacity(p0.buildings.metalStorage);
  const actualProduction=E.getPlanetProduction(p0,u);
  check(actualProduction.caps.metal,current,label+' capacita\' metallo dal motore');
  check(actualProduction.caps.crystal,D.getStorageCapacity(p0.buildings.crystalStorage),label+' cristallo');
  check(actualProduction.caps.deuterium,D.getStorageCapacity(p0.buildings.deuteriumTank),label+' deuterio');
  E.tick(u,3600);
  const online=MP.calculateLiveResources(onlineDoc,1);
  const offlineR=u.planets[0].resources;
  for(const key of ['metal','crystal','deuterium']) {
    check(online.resources[key],Math.floor(offlineR[key]),`${label}: ${key} offline/online pari`);
  }
  check(onlineDoc.resources.metal,resources.metal??0,`${label}: nessuna mutazione del documento Firestore`);
  check(online.lastUpdated,FIXED_NOW,`${label}: timestamp aggiornato`);
  return {offline:offlineR,online:online.resources,prod:actualProduction};
}

const atCap=compare1hour({metal:9998,crystal:10000,deuterium:10000},{metalMine:15,crystalMine:15,deuteriumSynth:12,solarPlant:50},'Depositi quasi pieni');
check(atCap.online.metal,10000,'produzione metallo fermata a 10000');
check(atCap.online.crystal,10000,'cristallo pieno non cresce');
check(atCap.online.deuterium,10000,'deuterio pieno non cresce');
const above=compare1hour({metal:23000,crystal:21000,deuterium:32000},{metalMine:18,crystalMine:14,deuteriumSynth:15,solarPlant:50},'Risorse importate sopra soglia');
check(above.online.metal,23000,'metallo sopra soglia mantenuto');
check(above.online.crystal,21000,'cristallo sopra soglia mantenuto');
check(above.online.deuterium,32000,'deuterio sopra soglia mantenuto');
const burn=compare1hour({metal:20000,crystal:20000,deuterium:20000},{fusionReactor:20},'Consumo fusione sopra soglia');
assert(burn.prod.deuteriumPerHour<0,'produzione deuterio negativa nel test');checks++;
check(burn.online.deuterium,20000+burn.prod.deuteriumPerHour,'consumo deuterio continua anche oltre cap');
check(burn.online.metal,20000,'nessun taglio al metallo immagazzinato');
const burnedOut=compare1hour({metal:9999,crystal:9999,deuterium:3},{fusionReactor:20},'Deuterio fino a zero');
check(burnedOut.online.deuterium,0,'consumo deuterio non scende sotto zero');

// Ripresa offline e sessioni multiplayer preesistenti mantengono il livello del deposito.
const offlinePlanet=planet({metal:9900,crystal:30000,deuterium:123456},{metalStorage:0,crystalStorage:2,deuteriumTank:3,metalMine:20});
const oldSave=universe(offlinePlanet); oldSave.lastSeen=FIXED_NOW-3600000;
E.processOfflineProgress(oldSave);
check(oldSave.planets[0].buildings.deuteriumTank,3,'salvataggio: livello cisterna conservato');
check(oldSave.planets[0].resources.crystal,30015,'salvataggio: produ. base cristallo');
check(oldSave.planets[0].resources.metal,10000,'salvataggio: metallo fermo a cap');
check(oldSave.planets[0].resources.deuterium,123456,'salvataggio: sopra capacita\' inalterato');

// Depositi visuali: non derivano una formula autonoma, ma dalla produzione effettiva.
const selected=planet({metal:16000,crystal:5000,deuterium:20000},{metalStorage:1,crystalStorage:2,deuteriumTank:1,metalMine:20,solarPlant:50});
const stats=E.getPlanetProduction(selected,universe(selected));
const m=UI.getDepositMetrics(selected,stats,universe(selected),'metal');
check(m.capacity,20000,'barra metallo usa 20k');
check(m.fill,'near','barra 80% giallo');
check(m.remaining,4000,'barra spazio libero corretto');
const c=UI.getDepositMetrics(selected,stats,universe(selected),'crystal');
check(c.capacity,40000,'barra cristallo usa 40k');
check(c.fill,'normal','barra cristallo verde');
const d=UI.getDepositMetrics(selected,stats,universe(selected),'deuterium');
check(d.capacity,20000,'barra deuterio usa 20k');
check(d.fill,'full','barra deuterio rosso');
check(d.time,'Deposito pieno','barra deuterio avverte quando pieno');
const selected2=planet({metal:10000,crystal:40000,deuterium:500},{metalStorage:3,crystalStorage:2,deuteriumTank:0});
const s2=E.getPlanetProduction(selected2,universe(selected2));
check(UI.getDepositMetrics(selected2,s2,universe(selected2),'metal').capacity,75000,'cambio pianeta: capacita\' diversa');
check(UI.getDepositMetrics(selected2,s2,universe(selected2),'crystal').fill,'full','cambio pianeta: stato cristallo diverso');
const missing=UI.getDepositMetrics(selected2,s2,universe(selected2),'metal');
check(missing.time,UI.formatDepositFillTime((75000-10000)/s2.metalPerHour),'tempo riempimento usa rate effettivo e nuova capacita\'');

// Crediti da trasporto/BOT applicati dopo l'avanzamento: non vanno tagliati.
const transported=planet({metal:9990,crystal:10000,deuterium:10000},{metalMine:20});
const onlineView=win.__UniversumMPModules._effectivePlanetView({
  ...plain(transported),lastUpdated:FIXED_NOW-3600000,
  inbox:{resources:{metal:3500,crystal:0,deuterium:0}}
},1);
check(onlineView.resources.metal,13500,'crediti inbox sopra soglia conservati');
const later=MP.calculateLiveResources({...plain(transported),resources:{metal:13500,crystal:10000,deuterium:10000},lastUpdated:FIXED_NOW-3600000},1);
check(later.resources.metal,13500,'produzione successiva non taglia accrediti sopra soglia');

// Nessun timer dedicato e riutilizzo dell'helper offline.
const code=fs.readFileSync(path.join(root,'modules/online/sync.js'),'utf8');
assert(code.includes('window.__UniversumEngineModules.advancePlanetResources('),'online e offline devono condividere avanzamento con controllo carburante');checks++;
assert(fs.readFileSync(path.join(root,'modules/engine/progress.js'),'utf8').includes('addResourcesWithCap(planet, before.'),"l'avanzamento riusa addResourcesWithCap");checks++;
console.log(`DEPOSITI OGAME: ${checks} verifiche superate; livelli 0–35, costi, offline, online, consumo, overflow, UI.`);
