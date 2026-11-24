/**
 * Test funzionali con database finto: il client non deve effettuare GET in
 * idle su fleets, e le cache devono evitare query duplicate di galassia.
 * Non verifica le regole Firestore con l'emulatore.
 */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '..');

function loadModule(file, win, extra = {}) {
  const context = vm.createContext({ window: win, console, Date, Math, JSON, Set, Map, Number, Object, Array, String, Boolean, Promise, ...extra });
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename:file});
}
(async () => {
  const uid = 'player_A';
  const listeners = [];
  let getCount = 0;
  const db = {
    collection: () => ({
      doc: () => ({
        get: async () => { getCount++; return { data: () => ({ speed: 10 }) }; },
        collection: () => ({
          get: async () => { getCount++; return { docs: [] }; },
          where: (field, op, value) => ({
            get: async () => { getCount++; return { docs: [] }; },
            where: (field2, op2, value2) => ({
              onSnapshot: (callback) => {
                const item = {field, value, field2, value2, callback, closed:false};
                listeners.push(item);
                return () => {item.closed = true;};
              }
            })
          })
        })
      })
    })
  };
  const G = {
    getAuth: () => ({currentUser:{uid}}),
    getDB: () => db,
    normalizeOnlineFleet: (raw,id) => ({...raw, id}),
    processEmbargoFleets: async () => {},
    _fleetDueTime: (f) => f.arrivalTime
  };
  const win = {__UniversumMPModules: G, __UniversumMPVariables:{FLEET_SCHEMA_VERSION:2, _ONLINE_SUPPORTED_MISSIONS:new Set(), _mpErrorToastAt:new Map()}, fbAuth:{currentUser:{uid}}, UniversumUI:{state:{currentUniverse:{id:'u',speed:10}}}};
  loadModule('modules/online/fleet-control.js', win);
  loadModule('modules/online/combat-resolver.js', win);
  const own = G.listenOwnFleets({id:'u'},()=>{});
  const incoming = G.listenIncomingFleets({id:'u'},()=>{});
  assert.strictEqual(listeners.length, 2, 'listener esistenti riutilizzati');
  const future = Date.now() + 300000;
  const f1 = {id:'f1',ref:{},data:()=>({attackerUid:uid,defenderUid:'B',status:'outbound',mission:'attack',arrivalTime:future,resolved:false})};
  const f2 = {id:'f2',ref:{},data:()=>({attackerUid:'B',defenderUid:uid,status:'outbound',mission:'attack',arrivalTime:future,resolved:false})};
  listeners[0].callback({docs:[f1]});
  assert(listeners[1].value2.includes('returning'), 'il difensore può risolvere anche il rientro');
  listeners[1].callback({docs:[f1,f2]});
  assert.strictEqual(G.getLiveFleetDocs('u').length,2,'flotte proprie e in arrivo ricostruite');
  for (let i=0; i<100; i++) await G.resolveArrivedOnlineFleets('u',10);
  assert.strictEqual(getCount,0,'100 controlli idle: nessuna lettura Firestore');
  own(); incoming();
  assert.strictEqual(G.getLiveFleetDocs('u'),null,'cache eliminata a chiusura partita');
  console.log('✓ flotte: 100 controlli idle, 0 query, 0 letture Firestore');

  const history = Array.from({ length: 100 }, (_, id) => ({ id: String(id) }));
  const recent = { id: 'recent' };
  const requested = [];
  const queryWin = { __UniversumMPModules: {}, __UniversumMPVariables: {} };
  loadModule('modules/online/foundation.js', queryWin);
  const found = await queryWin.__UniversumMPModules.fetchFleetPartyDocs({
    where(field, operator, value) {
      assert.strictEqual(operator, '==');
      assert.strictEqual(value, uid);
      requested.push(field);
      return {
        limit(size) {
          assert.strictEqual(size, 100);
          return {
            get: async () => ({ docs: field === 'attackerUid' ? history : [recent] }),
            startAfter(doc) {
              assert.strictEqual(doc, history[99]);
              return { get: async () => ({ docs: [recent] }) };
            }
          };
        }
      };
    }
  }, uid);
  assert.deepStrictEqual(requested, ['attackerUid', 'defenderUid']);
  assert.strictEqual(found.length, 101, 'la flotta oltre la prima pagina è inclusa una sola volta');
  assert.strictEqual(found[100], recent);
  console.log('✓ fallback: query per partecipante, paginazione e deduplicazione');

  const updates=[];
  const activeTime=Date.now();
  const shipDoc=(elapsed)=>({id:'emb', data:()=>({attackerUid:uid,status:'embargo', resolved:false, siegeDeuterium:100000, ships:{lightFighter:10}, lastSiegeTickAt:activeTime-elapsed*1000, targetKey:'1_1_2'}),ref:{update: async(data)=>updates.push(['fleet',data])}});
  const ref={collection:()=>({doc:()=>({update:async(data)=>updates.push(['planet',data])})})};
  win.UniversumData={SHIPS:{lightFighter:{fuelConsumption:10}},getShipFuelConsumption:()=>10};
  await G.processEmbargoFleets(ref,[shipDoc(10)],activeTime,10);
  assert.strictEqual(updates.length,0,'embargo non scritto ogni 3s');
  await G.processEmbargoFleets(ref,[shipDoc(31)],activeTime,10);
  assert.strictEqual(updates.length,2,'embargo aggiornato dopo 30s');
  console.log('✓ embargo: 0 scritture a 10 secondi, 2 a 31 secondi');

  const systemCalls=[];
  const sysWin={
    __UniversumMPModules:{
      getDB:()=>({collection:()=>({doc:()=>({collection:()=>({where:()=>({where:()=>({get:async()=>{systemCalls.push('planets');return {docs:[]};}})})}),get:async()=>{systemCalls.push('meta'); return {data:()=>({speed:10})}}})})}),
      generatePlanetSpecs:()=>({minTemp:0,maxTemp:20,fieldsMax:150}),
      _effectivePlanetView:x=>x,
      _cacheGet:(map,key,ttl)=>{const e=map.get(key);return e&&Date.now()-e.at<ttl?e.data:null;}
    },
    __UniversumMPVariables:{SYNC_MIN_INTERVAL_MS:600000,SYSTEM_CACHE_TTL_MS:30000,_INBOX_RES_KEYS:['metal','crystal','deuterium'],_syncLastByUni:new Map(),_systemCache:new Map(),_systemPending:new Set()},
    UniversumUI:{state:{currentUniverse:{id:'u',speed:10}}}
  };
  loadModule('modules/online/sync.js',sysWin);
  const sg=sysWin.__UniversumMPModules;
  const responses=await Promise.all([sg.getOnlineSystem('u',1,1),sg.getOnlineSystem('u',1,1),sg.getOnlineSystem('u',1,1)]);
  assert.strictEqual(systemCalls.filter(c=>c==='planets').length,1,'una query contemporanea');
  assert.strictEqual(systemCalls.filter(c=>c==='meta').length,0,'niente lettura velocità');
  assert.strictEqual(responses[0].slots.length,15,'sistema completo senza regressione');
  await sg.getOnlineSystem('u',1,1);
  assert.strictEqual(systemCalls.length,1,'cache hit senza revalidazione superflua');
  console.log('✓ galassia: quattro aperture, 1 query, 0 letture metadati');

  const listCalls=[];
  const listDocs=[{id:'u',data:()=>({name:'Andromeda',createdAt:Date.now(),speed:1})}];
  const listWin={
    __UniversumMPModules:{getDB:()=>({collection:()=>({orderBy:()=>({limit:()=>({get:async()=>{listCalls.push('get');return {docs:listDocs};}})})})})},
    __UniversumMPVariables:{SERVER_LIMIT:3,SERVER_LIMIT_MESSAGE:'max',_leaderboardCache:new Map(),_playersCache:new Map(),_privateCleanupDone:new Set(),_systemCache:new Map()}
  };
  loadModule('modules/online/universes.js', listWin);
  const getUnis=listWin.__UniversumMPModules.getOnlineUniverses;
  await getUnis(); await getUnis();
  assert.strictEqual(listCalls.length,1,'lobby cached solo 30s');
  await getUnis({force:true});
  assert.strictEqual(listCalls.length,2,'aggiornamento manuale bypassa cache');
  console.log('✓ lobby: 2 visite=1 lettura lista; aggiorna=lettura fresca');

  const runtime=fs.readFileSync(path.join(root,'modules/ui/runtime.js'),'utf8');
  assert(runtime.includes('persistUniverseState({ force: false })'),'heartbeat non forzato');
  assert(runtime.includes('resolveArrivedOnlineFleets(uni.id, uni.speed)'),'velocità riusata');
  assert(runtime.includes('uni.botConfig?.raids'),'BOT pacifici non fanno query di raid');
  const rules=fs.readFileSync(path.join(root,'firestore.rules'),'utf8');
  assert(rules.includes('function validHumanFleetCreate'),'regole anticheat mantenute');
  console.log('✓ heartbeat, raid pacifici e regole di sicurezza conservati');
})().catch(err=>{console.error(err);process.exitCode=1;});
