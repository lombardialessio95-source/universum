// Verifica integrale manifest, identità release, caricamento moduli e isolamenti dei dati.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const boot = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release-manifest.json'), 'utf8'));
const files = Object.keys(manifest.files);
const scriptList = [...html.matchAll(/<script\s+src="\.\/([^" ]+\.js)"\s+defer\s*>/g)].map(m => m[1]);
assert(scriptList.length > 65, 'Moduli applicazione mancanti');
assert.strictEqual(new Set(scriptList).size, scriptList.length, 'Moduli duplicati');
assert(files.length >= scriptList.length + 4, 'Manifest incompleto');
for (const name of files) {
  const data = fs.readFileSync(path.join(root, name));
  const hex = crypto.createHash('sha256').update(data).digest('hex');
  assert.strictEqual(manifest.files[name], hex, `Hash non corrispondente per ${name}`);
}
for (const name of scriptList) assert(manifest.files[name], `Modulo non protetto: ${name}`);
const normalized = sw.replace(/const VERSIONE_RELEASE = '[^']+';/, "const VERSIONE_RELEASE = '__UNIVERSUM_RELEASE_ID__';");
const workerHash = crypto.createHash('sha256').update(normalized).digest('hex');
assert.strictEqual(workerHash, manifest.workerHash, 'Digest della logica SW non aggiornato');
const canonical = JSON.stringify({files: Object.fromEntries(files.sort().map(k => [k, manifest.files[k]])), workerHash});
const id = 'r' + crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 20);
assert.strictEqual(id, manifest.version, 'Identificativo release non generato dai contenuti');
assert(sw.includes(`const VERSIONE_RELEASE = '${id}';`), 'Service Worker non allineato al manifest');
assert(boot.includes("updateViaCache: 'none'"), 'Registrazione deve ignorare cache HTTP');
assert(boot.includes('await registration.update()'), 'Manca verifica a ogni apertura');
assert(!boot.includes('data.js'), 'Bootstrap non deve eseguire moduli di gioco');
assert(!sw.includes('indexedDB.deleteDatabase') && !sw.includes('localStorage.clear'), 'Cancellazione di salvataggi');
assert(sw.includes('crypto.subtle.digest') && sw.includes('skipWaiting') && sw.includes('UNIVERSUM_CAN_UPDATE'));
assert(sw.includes('return cached || Response.error()'), 'Modulo mancante non deve ricevere un HTML');
assert(fs.existsSync(path.join(root, 'firestore.rules')), 'Regole Firestore assenti');
console.log(`CACHE: ${scriptList.length} script protetti, ${files.length} file verificati, release ${id}`);
