// Test della logica Fase 5 con un Firestore finto in memoria.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

// ---------- Firestore finto ----------
const store = new Map();
const versions = new Map();
const bump = (path) => versions.set(path, (versions.get(path) || 0) + 1);
const clone = (o) => JSON.parse(JSON.stringify(o));
const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v) && !v.__op;
const FV = { increment: (n) => ({ __op: 'inc', n }), delete: () => ({ __op: 'del' }), serverTimestamp: () => Date.now() };

function mergeDeep(target, src) {
  for (const [k, v] of Object.entries(src)) {
    if (v && v.__op === 'del') delete target[k];
    else if (v && v.__op === 'inc') target[k] = (Number(target[k]) || 0) + v.n;
    else if (isPlain(v)) {
      if (!isPlain(target[k])) target[k] = {};
      mergeDeep(target[k], v);
    } else target[k] = clone(v);
  }
}
function applyUpdate(doc, upd) {
  for (const [key, v] of Object.entries(upd)) {
    const parts = key.split('.');
    let cur = doc;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!isPlain(cur[parts[i]])) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    const last = parts[parts.length - 1];
    if (v && v.__op === 'del') delete cur[last];
    else if (v && v.__op === 'inc') cur[last] = (Number(cur[last]) || 0) + v.n;
    else cur[last] = clone(v);
  }
}
const getPath = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);

function docRef(path) {
  const id = path.split('/').pop();
  const ref = {
    path, id,
    async get() {
      const exists = store.has(path);
      return { exists, id, ref, data: () => (exists ? clone(store.get(path)) : undefined) };
    },
    async update(upd) { const d = store.get(path); if (!d) throw new Error('no doc'); applyUpdate(d, upd); bump(path); },
    collection: (n) => colRef(path + '/' + n)
  };
  return ref;
}
function colRef(path) {
  const filters = [];
  let lim = Infinity;
  const q = {
    doc: (id) => docRef(path + '/' + id),
    where(f, op, v) { filters.push([f, op, v]); return q; },
    limit(n) { lim = n; return q; },
    async get() {
      const docs = [];
      for (const [p, d] of store.entries()) {
        if (!p.startsWith(path + '/') || p.slice(path.length + 1).includes('/')) continue;
        const ok = filters.every(([f, op, v]) => {
          const x = getPath(d, f);
          if (op === '==') return x === v;
          if (op === '!=') return x !== undefined && x !== v;
          return true;
        });
        if (ok) docs.push({ id: p.split('/').pop(), ref: docRef(p), exists: true, data: () => clone(d) });
        if (docs.length >= lim) break;
      }
      return { docs, empty: docs.length === 0 };
    }
  };
  return q;
}
const db = {
  collection: (n) => colRef(n),
  async runTransaction(fn) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const writes = [];
      const reads = new Map();
      let wrote = false;
      const tx = {
        get: async (ref) => {
          if (wrote) throw new Error('LETTURA DOPO SCRITTURA nella transazione');
          reads.set(ref.path, versions.get(ref.path) || 0);
          return ref.get();
        },
        set: (ref, data, opts) => { wrote = true; writes.push(() => {
          if (opts && opts.merge) { const d = store.get(ref.path) || {}; mergeDeep(d, data); store.set(ref.path, d); }
          else store.set(ref.path, clone(data));
          bump(ref.path);
        }); },
        update: (ref, upd) => { wrote = true; writes.push(() => {
          const d = store.get(ref.path); if (!d) throw new Error('update su documento mancante: ' + ref.path);
          applyUpdate(d, upd); bump(ref.path);
        }); }
      };
      await fn(tx);
      // Concorrenza ottimistica come Firestore: se un documento letto è cambiato, si ripete la transazione
      let conflict = false;
      for (const [path, v] of reads) if ((versions.get(path) || 0) !== v) conflict = true;
      if (conflict) continue;
      writes.forEach((w) => w());
      return;
    }
    throw new Error('Transazione abortita: troppi conflitti');
  }
};

// ---------- Carica il multiplayer modulare ----------
const path = require('path');
const base = path.resolve(__dirname, '..');
const modulesOnline = ['context.js', 'foundation.js', 'universes.js', 'sync.js', 'fleet-control.js', 'combat-resolver.js', 'sieges.js', 'communications.js', 'bots.js'];

const reconcileCalls = [];
const win = {
  fbAuth: { currentUser: { uid: 'u1', displayName: 'Alice' } },
  fbDB: db,
  UniversumUI: { onOnlineReconciled: (info) => reconcileCalls.push(info), state: {} }
};
const sandbox = { window: win, firebase: { firestore: { FieldValue: FV } }, console, Date, Math, JSON, Promise, Set, Map, Number, Object, Array, String, Boolean, setTimeout, clearTimeout };
vm.createContext(sandbox);
for (const file of modulesOnline) {
  vm.runInContext(fs.readFileSync(path.join(base, 'modules', 'online', file), 'utf8'), sandbox, {filename:file});
}
vm.runInContext(fs.readFileSync(path.join(base, 'multiplayer.js'), 'utf8'), sandbox, {filename:'multiplayer.js'});
win.__mp = Object.fromEntries(['_effectivePlanetView','_snapshotForDiff','_writePlanetResult','_inboxCredit','_resolveCreditRef','_applyUnitDelta','_hasInbox','calculateLiveResources']
  .map(name => [name, win.__UniversumMPModules[name]]));
const MP = win.UniversumMP;
const I = win.__mp;

const P = (g, s, p) => `online_universes/U/planets/${g}_${s}_${p}`;
let passed = 0;
function ok(name, fn) { return Promise.resolve().then(fn).then(() => { passed++; console.log('  ✓', name); }); }

(async () => {
  store.set('online_universes/U', { speed: 10 });
  const base = (owner, name) => ({
    id: name, name, ownerUid: owner, ownerName: owner, isNpc: false,
    resources: { metal: 1000, crystal: 500, deuterium: 200 },
    fleet: { lightFighter: 10 }, defenses: { rocketLauncher: 5 }, buildings: {},
    lastUpdated: Date.now(), coords: { g: 1, s: 1, p: 1 }
  });

  console.log('Inbox e sync');
  store.set(P(1, 1, 1), base('u1', 'Casa'));

  await ok('un attacco scrive solo variazioni (la base del proprietario non cambia)', async () => {
    const ref = docRef(P(1, 1, 1));
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const view = I._effectivePlanetView(snap.data(), 10);
      const before = I._snapshotForDiff(view);
      view.resources.metal -= 300; view.fleet.lightFighter -= 4; view.defenses.rocketLauncher -= 2;
      view.debris = { metal: 50, crystal: 20 };
      I._writePlanetResult(tx, ref, before, view);
    });
    const d = store.get(P(1, 1, 1));
    assert.strictEqual(d.resources.metal, 1000, 'la base non deve cambiare');
    assert.strictEqual(d.fleet.lightFighter, 10);
    assert.strictEqual(d.inbox.resources.metal, -300);
    assert.strictEqual(d.inbox.fleet.lightFighter, -4);
    assert.strictEqual(d.inbox.defenses.rocketLauncher, -2);
    assert.deepStrictEqual(d.debris, { metal: 50, crystal: 20 });
  });

  await ok('un trasporto concorrente si somma (nessuna sovrascrittura)', async () => {
    const ref = docRef(P(1, 1, 1));
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const view = I._effectivePlanetView(snap.data(), 10);
      const before = I._snapshotForDiff(view);
      view.resources.metal += 500;
      I._writePlanetResult(tx, ref, before, view);
    });
    assert.strictEqual(store.get(P(1, 1, 1)).inbox.resources.metal, 200);
  });

  await ok('la vista effettiva = base + inbox', async () => {
    const v = I._effectivePlanetView(store.get(P(1, 1, 1)), 10);
    assert.strictEqual(v.resources.metal, 1200);
    assert.strictEqual(v.fleet.lightFighter, 6);
    assert.strictEqual(v.defenses.rocketLauncher, 3);
  });

  await ok('il sync del proprietario applica l\'inbox e NON cancella gli eventi esterni', async () => {
    // Stato locale "vero": ha prodotto risorse e non sa nulla dell'attacco
    const uni = { id: 'U', emperor: 'Alice', researches: {}, planets: [{
      id: 'Casa', name: 'Casa', coords: { g: 1, s: 1, p: 1 },
      resources: { metal: 1500, crystal: 600, deuterium: 250 },
      fleet: { lightFighter: 10 }, defenses: { rocketLauncher: 5 }, buildings: {}
    }] };
    await MP.syncPlayerState(uni, { force: true });
    const d = store.get(P(1, 1, 1));
    assert.strictEqual(d.resources.metal, 1700, 'base = locale 1500 + inbox 200');
    assert.strictEqual(d.fleet.lightFighter, 6);
    assert.strictEqual(d.defenses.rocketLauncher, 3);
    assert.strictEqual(d.inbox, undefined, 'inbox svuotata');
    assert.deepStrictEqual(d.debris, { metal: 50, crystal: 20 }, 'i detriti (campo server) restano');
    const lp = uni.planets[0];
    assert.strictEqual(lp.resources.metal, 1700);
    assert.strictEqual(lp.fleet.lightFighter, 6);
    assert.strictEqual(lp.defenses.rocketLauncher, 3);
    assert.strictEqual(reconcileCalls.length, 1);
    assert.strictEqual(store.get('online_universes/U/players/u1').planetCount, 1);
  });

  await ok('un secondo sync non applica due volte la stessa inbox', async () => {
    const uni = { id: 'U', planets: [{ id: 'Casa', name: 'Casa', coords: { g: 1, s: 1, p: 1 },
      resources: { metal: 1700, crystal: 600, deuterium: 250 }, fleet: { lightFighter: 6 }, defenses: { rocketLauncher: 3 }, buildings: {} }] };
    await MP.syncPlayerState(uni, { force: true });
    assert.strictEqual(store.get(P(1, 1, 1)).resources.metal, 1700);
    assert.strictEqual(uni.planets[0].fleet.lightFighter, 6);
  });

  await ok('le navi in ritorno (inbox) non vengono perse dal sync', async () => {
    const ref = docRef(P(1, 1, 1));
    await db.runTransaction(async (tx) => {
      I._inboxCredit(tx, ref, { resources: { metal: 100, deuterium: 40 }, fleet: { lightFighter: 3, cruiser: 2 } });
    });
    const uni = { id: 'U', planets: [{ id: 'Casa', name: 'Casa', coords: { g: 1, s: 1, p: 1 },
      resources: { metal: 1710, crystal: 600, deuterium: 250 }, fleet: { lightFighter: 6 }, defenses: { rocketLauncher: 3 }, buildings: {} }] };
    await MP.syncPlayerState(uni, { force: true });
    const d = store.get(P(1, 1, 1));
    assert.strictEqual(d.fleet.lightFighter, 9);
    assert.strictEqual(d.fleet.cruiser, 2);
    assert.strictEqual(d.resources.metal, 1810);
    assert.strictEqual(uni.planets[0].fleet.cruiser, 2);
  });

  await ok('le variazioni non portano mai i valori sotto zero', async () => {
    const out = I._applyUnitDelta({ a: 2 }, { a: -9, b: -1 });
    assert.strictEqual(out.a, 0);
    assert.strictEqual(out.b, 0);
  });

  console.log('Conquista');
  await ok('il cambio di proprietario scrive stato assoluto, svuota inbox e code', async () => {
    store.set(P(1, 1, 2), Object.assign(base('u1', 'Colonia'), {
      coords: { g: 1, s: 1, p: 2 }, buildQueue: [{ id: 'x' }], inbox: { resources: { metal: 99 } }
    }));
    const ref = docRef(P(1, 1, 2));
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const view = I._effectivePlanetView(snap.data(), 10);
      const before = I._snapshotForDiff(view);
      view.ownerUid = 'u2'; view.ownerName = 'Bob'; view.fleet = {}; view.defenses = {};
      I._writePlanetResult(tx, ref, before, view);
    });
    const d = store.get(P(1, 1, 2));
    assert.strictEqual(d.ownerUid, 'u2');
    assert.strictEqual(d.inbox, undefined);
    assert.deepStrictEqual(d.buildQueue, []);
    assert.deepStrictEqual(d.fleet, {});
    assert.strictEqual(d.resources.metal, 1099, 'risorse effettive (base + inbox)');
  });

  await ok('il vecchio proprietario scarta il pianeta perso e NON lo riscrive', async () => {
    reconcileCalls.length = 0;
    const uni = { id: 'U', planets: [
      { id: 'Casa', name: 'Casa', coords: { g: 1, s: 1, p: 1 }, resources: { metal: 1810, crystal: 600, deuterium: 250 }, fleet: {}, defenses: {}, buildings: {} },
      { id: 'Colonia', name: 'Colonia', coords: { g: 1, s: 1, p: 2 }, resources: { metal: 5, crystal: 5, deuterium: 5 }, fleet: { lightFighter: 99 }, defenses: {}, buildings: {} }
    ] };
    await MP.syncPlayerState(uni, { force: true });
    const d = store.get(P(1, 1, 2));
    assert.strictEqual(d.ownerUid, 'u2');
    assert.deepStrictEqual(d.fleet, {}, 'la flotta vecchia non deve tornare');
    assert.strictEqual(d.resources.metal, 1099);
    assert.strictEqual(uni.planets.length, 1);
    assert.strictEqual(reconcileCalls[0].lost.length, 1);
    assert.strictEqual(store.get('online_universes/U/players/u1').planetCount, 1);
  });

  console.log('BOT e accrediti');
  await ok('i pianeti BOT restano a scrittura assoluta', async () => {
    store.set(P(2, 2, 2), Object.assign(base('npc', 'Avamposto'), { isNpc: true, coords: { g: 2, s: 2, p: 2 } }));
    const ref = docRef(P(2, 2, 2));
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const view = I._effectivePlanetView(snap.data(), 10);
      const before = I._snapshotForDiff(view);
      view.resources.metal -= 400; view.fleet.lightFighter = 0;
      I._writePlanetResult(tx, ref, before, view);
    });
    const d = store.get(P(2, 2, 2));
    assert.strictEqual(d.resources.metal, 600);
    assert.strictEqual(d.fleet.lightFighter, 0);
    assert.strictEqual(d.inbox, undefined);
  });

  await ok('l\'origine conquistata non riceve il ritorno: fallback su un altro pianeta del giocatore', async () => {
    const uniRef = docRef('online_universes/U');
    // origine = Colonia (ora di u2). u1 ha ancora Casa.
    const ref = await I._resolveCreditRef(uniRef, 'u1', { g: 1, s: 1, p: 2 });
    assert.ok(ref);
    assert.strictEqual(ref.id, '1_1_1');
    const ref2 = await I._resolveCreditRef(uniRef, 'u1', { g: 1, s: 1, p: 1 });
    assert.strictEqual(ref2.id, '1_1_1', "l'origine ancora propria resta la scelta");
    const none = await I._resolveCreditRef(uniRef, 'u9', { g: 1, s: 1, p: 1 });
    assert.strictEqual(none, null);
  });

  console.log('Tributi di occupazione');
  await ok('il tributo va in inbox, una sola volta, anche con due client', async () => {
    const DAY = 24 * 3600 * 1000;
    store.set(P(3, 3, 3), Object.assign(base('u3', 'Occupato'), {
      coords: { g: 3, s: 3, p: 3 },
      resources: { metal: 10000, crystal: 0, deuterium: 0 }, lastUpdated: Date.now(),
      occupation: { occupierUid: 'u2', originCoords: { g: 1, s: 1, p: 2 }, startedAt: Date.now() - 3 * DAY - 5000, lastTributeAt: Date.now() - 3 * DAY - 5000 }
    }));
    // l'origine dell'occupante è la Colonia (di u2 dopo la conquista)
    await Promise.all([MP.processAllOccupations('U'), MP.processAllOccupations('U')]);
    const t = store.get(P(3, 3, 3));
    const col = store.get(P(1, 1, 2));
    // rate = min(0.5, 0.05 * 3) = 0.15 -> 1500 una volta sola
    assert.strictEqual(t.inbox.resources.metal, -1500);
    assert.strictEqual(col.inbox.resources.metal, 1500);
    assert.ok(t.occupation.lastTributeAt > Date.now() - DAY);
    await MP.processAllOccupations('U');
    assert.strictEqual(store.get(P(3, 3, 3)).inbox.resources.metal, -1500, 'nessun secondo pagamento');
  });

  console.log(`\nTutti i test superati: ${passed}`);
})().catch((e) => { console.error('\nTEST FALLITO:', e); process.exit(1); });
