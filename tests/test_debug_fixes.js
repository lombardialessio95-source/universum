// Regressioni debug profondo: B1 slot, B3/S2 Invictus, L2 Crepuscolo, S1 lastSeen su rename.
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const scripts = [...html.matchAll(/<script\s+src="\.\/([^" ]+\.js)"(?:\s+defer)?\s*><\/script>/g)].map(x => x[1]);

// Fake IndexedDB minimo per modules/offline/storage.js
const storeData = new Map();
function fakeReq(getValue) {
  const req = {};
  Object.defineProperty(req, 'onsuccess', { set(fn) { setTimeout(() => { req.result = getValue(); fn({ target: req }); }, 0); } });
  return req;
}
const fakeDB = {
  objectStoreNames: { contains: () => true },
  createObjectStore: () => ({ createIndex: () => {} }),
  transaction: () => ({
    objectStore: () => ({
      put: (obj) => fakeReq(() => { storeData.set(obj.id, JSON.parse(JSON.stringify(obj))); return obj; }),
      get: (id) => fakeReq(() => storeData.get(id) || null),
      getAll: () => fakeReq(() => [...storeData.values()]),
      delete: (id) => fakeReq(() => { storeData.delete(id); return true; })
    })
  })
};
const indexedDB = {
  open: () => {
    const req = {};
    Object.defineProperty(req, 'onsuccess', { set(fn) { setTimeout(() => { req.result = fakeDB; fn({ target: req }); }, 0); } });
    return req;
  }
};

const mockDocument = { addEventListener: () => {}, getElementById: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => ({}) }) };
const win = { document: mockDocument, navigator: {}, addEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }) };
const sandbox = { window: win, document: mockDocument, console, Date, Math, JSON, Set, Map, Number, Object, Array, String, Boolean, Promise, URL,
  navigator: win.navigator, indexedDB, localStorage: { getItem: () => null, setItem: () => {} }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {} };
vm.createContext(sandbox);
for (const script of scripts) {
  if (script.startsWith('graphics-') || script === 'firebase-config.js') continue;
  vm.runInContext(fs.readFileSync(path.join(root, script), 'utf8'), sandbox, { filename: script, timeout: 1000 });
}
const Galaxy = win.UniversumGalaxy;
const Engine = win.UniversumEngine;

function baseUni() {
  return {
    id: 't1', speed: 1, creativeMode: false, emperor: 'Test', researches: { computerTech: 0 },
    planets: [{ id: 'home', name: 'Home', coords: { g: 1, s: 1, p: 1 }, maxTemp: 30,
      resources: { metal: 100000, crystal: 100000, deuterium: 100000 },
      buildings: {}, fleet: { smallCargo: 1 }, defenses: {}, buildQueue: [], shipyardQueue: [], defenseQueue: [],
      moon: null, bacinoSpaziale: null }],
    fleetsInFlight: [], activeSieges: [], galattiche: [], galaxyDeltas: {}, messages: []
  };
}

// B1: assedi attivi contano come slot (5 slot, 5 assedi, 0 voli -> lancio bloccato)
{
  const uni = baseUni();
  uni.activeSieges = Array.from({ length: 5 }, (_, i) => ({ id: 's' + i, type: 'embargo' }));
  assert.throws(() => Galaxy.launchFleet(uni, 0, { g: 1, s: 2, p: 1 }, 'transport', { smallCargo: 1 }), /Slot flotta esauriti/);
  const uni2 = baseUni();
  uni2.galattiche = Array.from({ length: 5 }, (_, i) => ({ id: 'g' + i }));
  assert.throws(() => Galaxy.launchFleet(uni2, 0, { g: 1, s: 2, p: 1 }, 'transport', { smallCargo: 1 }), /Slot flotta esauriti/);
  const uni3 = baseUni();
  const flt = Galaxy.launchFleet(uni3, 0, { g: 1, s: 2, p: 1 }, 'transport', { smallCargo: 1 });
  assert(flt && uni3.fleetsInFlight.length === 1, 'lancio libero deve riuscire');
}

// B3: Invictus in missione contano nel limite di 4
{
  const uni = baseUni();
  uni.planets[0].bacinoSpaziale = { status: 'active', invictusActive: 0, invictusConstructions: [], everUsed: true, crepuscolo: null, paid: { metal: 0, crystal: 0, deuterium: 0 }, daysPaid: 20 };
  uni.fleetsInFlight = [{ id: 'f1', originPlanetId: 'home', fleet: { invictus: 4 }, ships: { invictus: 4 }, status: 'outbound' }];
  const counts = Galaxy.getInvictusCount(uni.planets[0], uni);
  assert.strictEqual(counts.inFlight, 4); assert.strictEqual(counts.total, 4);
  assert.throws(() => Galaxy.startInvictusConstruction(uni, 0), /Massimo 4 Invictus/);
}

// L2: Crepuscolo in missione (oggetto in Bacino inMission + flotta) conta 1
{
  const uni = baseUni();
  uni.planets[0].bacinoSpaziale = { status: 'active', invictusActive: 0, invictusConstructions: [], everUsed: true,
    crepuscolo: { status: 'inMission', projectKind: 'build', daysPaid: 100, daysTotal: 100, paid: { metal: 0, crystal: 0, deuterium: 0 } },
    paid: { metal: 0, crystal: 0, deuterium: 0 }, daysPaid: 20 };
  uni.fleetsInFlight = [{ id: 'f2', originPlanetId: 'home', fleet: { crepuscolo: 1 }, ships: { crepuscolo: 1 }, status: 'outbound' }];
  assert.strictEqual(Galaxy.getCrepuscoloState(uni).count, 1);
}

// S2: normalizePlanet non tronca Invictus attive
{
  const planet = { buildings: {}, fleet: {}, defenses: {}, bacinoSpaziale: { status: 'active', invictusActive: 7, invictusConstructions: [], paid: { metal: 0, crystal: 0, deuterium: 0 }, daysPaid: 20 } };
  Engine._internal.normalizePlanet(planet);
  assert.strictEqual(planet.bacinoSpaziale.invictusActive, 7);
}

// S1: rename non sposta lastSeen
(async () => {
  const DB = win.UniversumDB;
  const uni = await DB.create({ name: 'Prova', emperor: 'Test', speed: 1 });
  const before = (await DB.load(uni.id)).lastSeen;
  await new Promise(r => setTimeout(r, 15));
  await DB.rename(uni.id, 'Prova Rinominata');
  const after = await DB.load(uni.id);
  assert.strictEqual(after.lastSeen, before, 'rename non deve aggiornare lastSeen');
  assert.strictEqual(after.name, 'Prova Rinominata');
  console.log('DEBUG FIXES: B1 slot (assedi+galattiche), B3 Invictus in missione, L2 Crepuscolo singola, S2 normalize, S1 rename/lastSeen OK.');
})().catch((e) => { console.error(e); process.exit(1); });
