'use strict';
// Modello eseguibile del vero sw.js, con CacheStorage/Fetch/Clients mock e SHA-256 reale.
// Non sostituisce un test in un browser con supporto Service Worker.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { MessageChannel } = require('worker_threads');
const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://universum.test';
const SCOPE = ORIGIN + '/universum/';
const CURRENT = JSON.parse(fs.readFileSync(path.join(ROOT, 'release-manifest.json'), 'utf8'));
const WORKER = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const assertTests = [];
const check = (value, label) => { assert(value, label); assertTests.push(label); };
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const mime = file => file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/json';
const cacheKey = req => typeof req === 'string' ? req : req.url;
class FakeCache {
  constructor() { this.map = new Map(); }
  async match(req) { const v = this.map.get(cacheKey(req)); return v ? v.clone() : undefined; }
  async put(req, response) { this.map.set(cacheKey(req), response.clone()); }
}
class FakeStorage {
  constructor() { this.map = new Map(); this.deleted = []; }
  async open(name) { if (!this.map.has(name)) this.map.set(name, new FakeCache()); return this.map.get(name); }
  async keys() { return [...this.map.keys()]; }
  async delete(name) { this.deleted.push(name); return this.map.delete(name); }
}
function assetFixture(manifest = CURRENT, overrides = {}) {
  return { manifest, files: Object.fromEntries(Object.keys(manifest.files).map(k => [k, overrides[k] || fs.readFileSync(path.join(ROOT, k))])) };
}
function nextFixture(change) {
  const files = { ...CURRENT.files };
  for (const [name, value] of Object.entries(change)) files[name] = sha(value);
  const canonical = JSON.stringify({ files:Object.fromEntries(Object.entries(files).sort(([a],[b])=> a < b ? -1 : a > b ? 1 : 0)), workerHash: CURRENT.workerHash });
  const version = 'r' + sha(Buffer.from(canonical)).slice(0,20);
  return assetFixture({schema:1,version,workerHash:CURRENT.workerHash,files}, change);
}
function constructSW(fixture, storage, environment = {}) {
  const events = {};
  const sent = [];
  const calls = [];
  let skip = 0;
  const safety = environment.clients || [];
  const failOn = environment.failOn || new Set();
  const badMime = environment.badMime || new Set();
  const offline = () => !!environment.offline;
  const fetcher = async req => {
    const url = new URL(typeof req === 'string' ? req : req instanceof URL ? req.href : req.url);
    const item = url.pathname.slice(new URL(SCOPE).pathname.length);
    calls.push(item);
    if (offline() || failOn.has(item)) throw new Error('network interrupted for ' + item);
    if (item === 'release-manifest.json') {
      return new Response(JSON.stringify(fixture.manifest), {status:200, headers: {'content-type':'application/json'}});
    }
    if (!fixture.files[item]) return new Response('<html>Fallback HTML</html>', {status:200, headers:{'content-type':'text/html'}});
    return new Response(fixture.files[item], {status:200, headers:{'content-type':badMime.has(item) ? 'text/html' : mime(item)}});
  };
  const clientMap = safety.map((c,i) => ({
    id:String(i),
    postMessage(message, ports) {
      sent.push(message);
      if (message.type === 'UNIVERSUM_CAN_UPDATE' && c.reply !== false) {
        ports[0].postMessage({safe: c.safe});
      }
      // Il vero Client.postMessage restituisce undefined, non una Promise.
      return undefined;
    }
  }));
  const self = {
    location: {origin:ORIGIN},
    registration:{scope:SCOPE},
    clients:{claim: async()=>{},matchAll:async()=>clientMap},
    skipWaiting:async()=>{skip++;},
    addEventListener:(type,fn)=>{events[type]=fn;}
  };
  const source = WORKER.replace(CURRENT.version, fixture.manifest.version);
  const ctx={self,URL,Response,Request,AbortController,MessageChannel,caches:storage,fetch:fetcher,crypto:crypto.webcrypto,console,Uint8Array,Array,Map,Set,Promise,setTimeout,clearTimeout};
  vm.runInNewContext(source,ctx,{filename:'sw.js',timeout:5000});
  async function dispatch(type, props = {}) {
    let wait = null, answer=null;
    const evt = {...props,waitUntil(p){wait=p;},respondWith(p){answer=p;}};
    events[type](evt);
    if(wait)await wait;
    return answer ? answer : null;
  }
  async function askActivate() {
    const channel=new MessageChannel();
    let waiter;
    const got=new Promise(resolve=>{channel.port1.onmessage=e=>{channel.port1.close();resolve(e.data);};});
    events.message({data:{type:'UNIVERSUM_TRY_ACTIVATE'},ports:[channel.port2],waitUntil(p){waiter=p;}});
    await waiter;
    return got;
  }
  async function request(url,mode='cors'){
    const req={url: SCOPE+url,method:'GET',mode};
    const response=await dispatch('fetch',{request:req});
    return response ? await response : null;
  }
  return {dispatch,askActivate,request,calls,sent,environment, get skipped(){return skip;}};
}
(async()=>{
  const storage=new FakeStorage();
  const saves=new Map([['UniversumDB:uni_1',{resources:{metal:120000,deuterium:250},researchQueue:{id:'energyTech',endTime:987}}],['Firestore:planet_1',{metal:300}]]);
  const initial=constructSW(assetFixture(),storage);
  await initial.dispatch('install');
  check((await storage.keys()).length===1,'1) Prima apertura: cache completa creata');
  await initial.dispatch('activate');
  const firstCache=await storage.open('universum-static-release-'+CURRENT.version);
  check((await firstCache.match(SCOPE+'__universum_cache_metadata__'))!=null,'2) Manifest COMPLETO presente soltanto al termine');
  const app=await initial.request('app.html?release='+CURRENT.version,'navigate');
  check((await app.text()).includes('modules/engine/production.js'),'3) Documento completo dalla cache verificata');
  const reqBefore=initial.calls.length;
  const js=await initial.request('modules/engine/production.js');
  check((await js.text()).includes('getPlanetProduction')&&initial.calls.length===reqBefore,'4) Riapertura stessa release: 0 download game assets');
  const external=await initial.dispatch('fetch',{request:{url:'https://firestore.googleapis.com/data',method:'GET',mode:'cors'}});
  check(external===null,'5) Nessuna intercettazione Firebase');
  const newData=Buffer.from(fs.readFileSync(path.join(ROOT,'data.js')).toString().replace('UNIVERSUM', 'UNIVERSUM RELEASE TWO'));
  const changed=nextFixture({'data.js':newData});
  check(changed.manifest.version!==CURRENT.version,'6) Nuovo codice produce release ID differente');
  const missing=constructSW(changed,storage,{failOn:new Set(['data.js'])});
  await assert.rejects(missing.dispatch('install'),/network interrupted/);
  check(!(await storage.keys()).includes('universum-static-release-'+changed.manifest.version),'7) Download interrotto: cache nuova eliminata');
  check((await firstCache.match(SCOPE+'app.html'))!=null,'8) Cache funzionante precedente preservata');
  const poisoned=constructSW(changed,storage,{badMime:new Set(['data.js'])});
  await assert.rejects(poisoned.dispatch('install'),/Asset non valido/);
  check((await storage.keys()).length===1,'9) JS con MIME HTML: rifiutato; nessun fallback a index');
  const rolling=constructSW(changed,storage,{failOn:new Set(['data.js'])});
  await assert.rejects(rolling.dispatch('install'));
  check((await firstCache.match(SCOPE+'app.html'))!=null,'10) Distribuzione GitHub Pages parziale: fallback vecchia release');
  // Simula browser chiuso durante un download precedente: cache parziale SENZA marcatore.
  const orphan = await storage.open('universum-static-release-'+changed.manifest.version);
  await orphan.put(SCOPE+'app.html', new Response('download precedente interrotto', {status:200,headers:{'content-type':'text/html'}}));
  const updated=constructSW(changed,storage,{clients:[{safe:true},{safe:false}]});
  await updated.dispatch('install');
  check(!!(await orphan.match(SCOPE+'__universum_cache_metadata__')),'Ripresa da cache parziale ricostruita correttamente');
  check(updated.calls.length<=3,'11) Solo file modificati scaricati, gli altri copiati dalla cache valida');
  const resBlocked=await updated.askActivate();
  check(!resBlocked.activated&&updated.skipped===0,'12) Due schede, una in partita: attivazione bloccata');
  check(resBlocked.reason==='partita-o-scheda-non-sicura', '12b) Risposta di blocco corretta anche con postMessage void');
  check(updated.sent.some(e => e.type==='UNIVERSUM_UPDATE_BLOCKED'), '12c) Notifica effettiva alla lobby quando una scheda rifiuta');
  updated.environment.clients[1].safe=true;
  // Le schede test rispondono tramite oggetti condivisi, senza cambiare clientId.
  const resOk=await updated.askActivate();
  check(resOk.activated&&updated.skipped===1,'13) Tutte le schede sicure: attivazione una sola volta');
  await updated.dispatch('activate');
  const updatedData=await (await updated.request('data.js')).text();
  check(updatedData.includes('RELEASE TWO'),'14) Nuova release serve soltanto il JS della sua cache');
  updated.environment.offline=true;
  const cached=await updated.request('app.html','navigate');
  check((await cached.text()).includes('update-client.js'),'15) Offline: app completa da cache');
  updated.environment.offline=false;
  check((await (await updated.request('modules/engine/production.js')).text()).includes('getPlanetProduction'),'16) Ritorno online: nessuna sostituzione dei file in cache');
  const changedCache=await storage.open('universum-static-release-'+changed.manifest.version);
  changedCache.map.delete(SCOPE+'modules/engine/production.js');
  const notFound=await updated.request('modules/engine/production.js');
  check(notFound.type==='error','17) JS mancante: errore, non HTML');
  check(saves.get('UniversumDB:uni_1').resources.metal===120000&&saves.get('Firestore:planet_1').metal===300,'18) IndexedDB/Firestore simulati non sono stati toccati');
  check(storage.deleted.every(k=>k.startsWith('universum-static-release-')),'19) Eventuali cancellazioni limitate alle cache statiche del gioco');
  check(!WORKER.includes('indexedDB.deleteDatabase')&&!WORKER.includes('localStorage.clear'),'20) SW non contiene API distruttive per salvataggi');
  check(WORKER.includes('UNIVERSUM_CAN_UPDATE') && WORKER.includes('skipWaiting'),'21) Protocollo di consenso prima di skipWaiting');
  check(WORKER.includes('crypto.subtle.digest')&&WORKER.includes('meta')&&WORKER.includes('CACHE_PREFIX'),'22) Integrità SHA-256 e isolamento versioni');
  console.log(`AUTO UPDATE: ${assertTests.length} scenari SW superati (CacheStorage e rete simulati).`);
})().catch(err=>{console.error('AUTO UPDATE FAILED',err);process.exit(1)});
