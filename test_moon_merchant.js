// Test del Mercante di Lune e della presenza del suo pannello nelle due modalità.
// Eseguire: node test_moon_merchant.js (dalla cartella del gioco).
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const base = __dirname;
const fleet = { lightFighter: 10000 };
const planet = (name, p) => ({ id: name, name, coords: { g: 1, s: 1, p },
  fleet: { ...fleet }, resources: { metal: 0, crystal: 0, deuterium: 1500000 },
  defenses: { rocketLauncher: 5 }, buildings: { metalMine: 8 }, moon: null });
const data = { SHIPS: { lightFighter: { cost: { metal: 3000, crystal: 1000 } } } };
const UI = { state: {}, getActivePlanetIndex: () => 0, escapeHTML: (s) => String(s),
  formatNum: (n) => Number(n).toLocaleString('it-IT'), svgIcon: () => 'ICON' };
const sandbox = { window: { UniversumData: data, UniversumUI: UI, UniversumGalaxy: {} },
  document: { getElementById: () => null }, console, Math, Date, Number, String, Object, JSON };
vm.createContext(sandbox);
for (const script of ['moon-merchant.js', 'ui-tactical.js']) {
  vm.runInContext(fs.readFileSync(path.join(base, script), 'utf8'), sandbox);
}
const merchant = sandbox.window.UniversumMoonMerchant;
function assertPanel({ online, creative, botMode }) {
  const uni = { creativeMode: creative, botMode, planets: [planet('Casa', 2), planet('Colonia', 4)],
    contracts: [], galaxies: 3, systemsPerGalaxy: 50 };
  UI.state = { isMultiplayerMode: online, currentUniverse: uni, fleetTarget: { g: 1, s: 1, p: 1 } };
  const viewport = { innerHTML: '', querySelector: () => null };
  UI.renderDiplomacy(viewport);
  if (creative) assert(!viewport.innerHTML.includes('id="moon-merchant-planet"'));
  else {
    assert(viewport.innerHTML.includes('id="moon-merchant-planet"'), 'deve esserci il selettore');
    assert(viewport.innerHTML.includes('Casa [1:1:2]'), 'primo pianeta');
    assert(viewport.innerHTML.includes('Colonia [1:1:4]'), 'secondo pianeta');
    assert(viewport.innerHTML.includes('id="btn-moon-merchant"'), 'pulsante di ingaggio');
    assert(viewport.innerHTML.includes('BOT pacifici'), 'spiegazione modalità pacifica');
  }
  if (online) assert(viewport.innerHTML.includes('btn-mp-bot-trade'), 'commercio BOT online');
}
for (const online of [false, true]) for (const botMode of ['peaceful', 'aggressive', 'none']) {
  assertPanel({ online, creative: false, botMode });
}
assertPanel({ online: false, creative: true, botMode: 'peaceful' });
const uni = { creativeMode: false, planets: [planet('Casa', 2)] };
const p = uni.planets[0];
let check = merchant.inspect(p);
assert.strictEqual(check.ships, 10000);
assert.strictEqual(check.debris, 12000000);
assert.strictEqual(check.chance, 20);
const beforeDefense = JSON.stringify(p.defenses);
const beforeBuilding = JSON.stringify(p.buildings);
const originalRandom = sandbox.Math.random;
try {
  sandbox.Math.random = () => 0.99; // fallimento
  const fail = merchant.applyOffline(uni, 0);
  assert.strictEqual(fail.success, false);
  assert.strictEqual(p.fleet.lightFighter, 0);
  assert.strictEqual(p.resources.deuterium, 500000);
  assert.strictEqual(p.moon, null);
  assert.strictEqual(JSON.stringify(p.defenses), beforeDefense);
  assert.strictEqual(JSON.stringify(p.buildings), beforeBuilding);
  assert.strictEqual(p.debris, undefined);
  p.resources.deuterium = 1500000;
  p.fleet.lightFighter = 10000;
  sandbox.Math.random = () => 0.01; // successo
  const win = merchant.applyOffline(uni, 0);
  assert.strictEqual(win.success, true);
  assert(p.moon);
  assert.strictEqual(uni.galaxyDeltas['1:1:2'].hasMoon, true);
  assert.throws(() => merchant.applyOffline(uni, 0), /già una Luna/);
} finally {
  sandbox.Math.random = originalRandom;
}
console.log('Mercante: pannello offline/online (incl. BOT pacifici), Creativa, successo/fallimento e danni selettivi: OK');
