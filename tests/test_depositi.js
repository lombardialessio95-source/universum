// Test puro delle soglie e del tempo stimato: nessuna API browser o rete necessaria.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'modules/ui/resource-deposits.js'), 'utf8');
const ui = { formatNum: (n) => String(n), state: { isMultiplayerMode: false } };
vm.runInNewContext(src, { window: { UniversumUI: ui } }, { filename: 'resource-deposits.js' });
const uni = { creativeMode: false };
const p = (amount) => ({ resources: { metal: amount } });
const prod = (rate) => ({ caps: { metal: 100000 }, metalPerHour: rate });
const metrics = (amount, rate) => ui.getDepositMetrics(p(amount), prod(rate), uni, 'metal');
let n = 0;
const check = (v, expected, msg) => { assert.equal(v, expected, msg); n++; };

check(metrics(0, 5000).fill, 'normal', 'empty normal');
check(metrics(79999, 5000).fill, 'normal', '79.999% still green');
check(metrics(80000, 5000).fill, 'near', '80% yellow');
check(metrics(99999, 5000).fill, 'near', '99.999% still yellow');
check(metrics(100000, 5000).fill, 'full', '100% red');
check(metrics(120000, 5000).fill, 'full', '>100% red');
check(metrics(100000, 5000).time, 'Deposito pieno', 'full timer');
check(metrics(43000, 5000).time, '11h 24m', 'user example');
check(metrics(43000, 0).time, 'Riempimento non previsto', 'zero production');
check(metrics(43000, -10).time, 'Riempimento non previsto', 'negative production');
check(metrics(43000).time, '—', 'unknown production');
check(metrics(43000, 5000).remaining, 57000, 'remaining');
check(metrics(120000, 5000).remaining, 0, 'negative free space clamped');
check(ui.getDepositMetrics(p(100000), prod(5000), uni, 'metal', true).fill, 'unlimited', 'creative');
check(ui.getDepositMetrics({ resources: {} }, prod(5000), uni, 'metal').fill, 'unknown', 'amount unavailable');
check(ui.getDepositMetrics(p(5000), { caps: {}, metalPerHour: 100 }, uni, 'metal').fill, 'unknown', 'capacity unavailable');
check(ui.getDepositMetrics(p(5000), { caps: { metal: 0 }, metalPerHour: 100 }, uni, 'metal').fill, 'unknown', 'zero capacity');
check(ui.getDepositMetrics(p(5000), { caps: { metal: 100000 }, metalPerHour: 100 }, uni, 'invalid').fill, 'unknown', 'invalid resource');
check(ui.formatDepositFillTime(60), '2g 12h 0m', 'long interval');
check(ui.formatDepositFillTime(0.01), '1m', 'short interval');

// Integrita' strutturale e nessuna duplicazione delle formule produttive.
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
for (const type of ['metal', 'crystal', 'deuterium']) {
  assert(html.includes(`data-deposit="${type}"`), `button ${type} missing`); n++;
}
assert(html.includes('id="resource-deposit-panel"')); n++;
assert(html.includes('resource-deposits.js')); n++;
assert(sw.includes("'./modules/ui/resource-deposits.js'")); n++;
assert(css.includes('.res-deposit-trigger')); n++;
assert(!src.includes('fbDB') && !/window\.UniversumEngine\.getPlanetProduction\s*\(/.test(src), 'no extra DB/production calls'); n++;
console.log('DEPOSITI: '+n+' controlli su soglie, tempo, dati, Creativa, UI e cache superati.');
