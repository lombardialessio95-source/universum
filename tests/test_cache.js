// Assicura che cache, pagina e file siano coerenti per GitHub Pages/PWA.
const fs=require('fs'),path=require('path'),assert=require('assert');const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const scriptList=[...html.matchAll(/<script\s+src="\.\/([^\"]+\.js)"\s+defer\s*>/g)].map(m=>m[1]);
const assetList=[...sw.matchAll(/'\.\/([^']+\.js)'/g)].map(m=>m[1]);
assert(scriptList.length>50,'pochi moduli o defer assente');
assert.strictEqual(new Set(scriptList).size,scriptList.length,'script duplicati');
assert.strictEqual(new Set(assetList).size,assetList.length,'asset duplicati');
for(const f of scriptList){assert(fs.existsSync(path.join(root,f)),'file script assente: '+f);assert(assetList.includes(f),'script non precache: '+f);}
for(const f of assetList)assert(fs.existsSync(path.join(root,f)),'cache punta a file assente '+f);
assert(!html.includes('ui-tactical.js'), 'vecchio modulo UI referenziato');
assert(!html.includes('ui-economy.js'), 'vecchio modulo UI referenziato');
assert(fs.existsSync(path.join(root,'firestore.rules')),'regole di sicurezza assenti');
console.log('CACHE: '+scriptList.length+' script in ordine, tutti inclusi nel precache PWA, file esistenti.');
