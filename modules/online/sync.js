/** UNIVERSUM / modules/online/sync.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumMPModules;
  const { SYNC_MIN_INTERVAL_MS, SYSTEM_CACHE_TTL_MS, _INBOX_RES_KEYS, _syncLastByUni, _systemCache, _systemPending } = window.__UniversumMPVariables;
  // Bridge lazy per le funzioni definite negli altri moduli.
  const _cacheGet = (...args) => G._cacheGet(...args);
  const _mpNotifyError = (...args) => G._mpNotifyError(...args);
  const coordsToKey = (...args) => G.coordsToKey(...args);
  const generatePlanetSpecs = (...args) => G.generatePlanetSpecs(...args);
  const getAuth = (...args) => G.getAuth(...args);
  const getDB = (...args) => G.getDB(...args);



  function calculateLiveResources(planetDoc, speed = 10) {
    if (!planetDoc) return planetDoc;
    const now = Date.now();
    const last = Number(planetDoc.lastUpdated || now);
    const elapsedHours = Math.max(0, (now - last) / 3600000);

    const cloned = Object.assign({}, planetDoc, {
      resources: Object.assign({ metal: 0, crystal: 0, deuterium: 0 }, planetDoc.resources || {})
    });

    if (elapsedHours > 0 && window.UniversumEngine?.getPlanetProduction) {
      const prod = window.UniversumEngine.getPlanetProduction(cloned, { speed, creativeMode: false });
      cloned.resources.metal = Math.floor(cloned.resources.metal + prod.metalPerHour * elapsedHours);
      cloned.resources.crystal = Math.floor(cloned.resources.crystal + prod.crystalPerHour * elapsedHours);
      cloned.resources.deuterium = Math.max(0, Math.floor(cloned.resources.deuterium + prod.deuteriumPerHour * elapsedHours));
    }

    cloned.lastUpdated = now;
    return cloned;
  }


  function computePlayerPoints(universeObj) {
    const Data = window.UniversumData;
    let pts = 0;
    for (const p of universeObj.planets || []) {
      for (const lv of Object.values(p.buildings || {})) pts += (Number(lv) || 0) * 150;
      for (const [sId, cnt] of Object.entries(p.fleet || {})) {
        const spec = Data?.SHIPS?.[sId];
        if (spec) pts += Math.floor(((spec.cost.metal + spec.cost.crystal + spec.cost.deuterium) / 1000) * cnt);
      }
      for (const [dId, cnt] of Object.entries(p.defenses || {})) {
        const spec = Data?.DEFENSES?.[dId];
        if (spec) pts += Math.floor(((spec.cost.metal + spec.cost.crystal + spec.cost.deuterium) / 1000) * cnt);
      }
    }
    for (const lv of Object.values(universeObj.researches || {})) {
      pts += (Number(lv) || 0) * 350;
    }
    return pts;
  }


  function _applyUnitDelta(base, delta) {
    const out = Object.assign({}, base || {});
    for (const [id, d] of Object.entries(delta || {})) {
      const n = Number(d || 0);
      if (!n) continue;
      out[id] = Math.max(0, Math.floor(Number(out[id] || 0) + n));
    }
    return out;
  }


  function _hasInbox(data) {
    const ib = data && data.inbox;
    if (!ib || typeof ib !== 'object') return false;
    for (const part of ['resources', 'fleet', 'defenses']) {
      const m = ib[part];
      if (m && Object.values(m).some((v) => Number(v) !== 0)) return true;
    }
    return false;
  }


  function _effectivePlanetView(planetDoc, speed = 10) {
    const live = planetDoc?.isNpc && planetDoc.growthEnabled === false
      ? Object.assign({}, planetDoc) : calculateLiveResources(planetDoc, speed);
    if (!live) return live;
    const inbox = (planetDoc && planetDoc.inbox) || {};
    const res = Object.assign({ metal: 0, crystal: 0, deuterium: 0 }, live.resources);
    for (const k of _INBOX_RES_KEYS) {
      res[k] = Math.max(0, Math.floor(Number(res[k] || 0) + Number(inbox.resources?.[k] || 0)));
    }
    live.resources = res;
    live.fleet = _applyUnitDelta(planetDoc.fleet, inbox.fleet);
    live.defenses = _applyUnitDelta(planetDoc.defenses, inbox.defenses);
    delete live.inbox;
    return live;
  }


  function _snapshotForDiff(p) {
    if (!p) return null;
    return JSON.parse(JSON.stringify({
      resources: p.resources || {},
      fleet: p.fleet || {},
      defenses: p.defenses || {},
      debris: p.debris ?? null,
      embargo: p.embargo ?? null,
      occupation: p.occupation ?? null,
      moon: p.moon ?? null,
      ownerUid: p.ownerUid ?? null,
      ownerName: p.ownerName ?? null,
      isNpc: Boolean(p.isNpc)
    }));
  }


  function _writePlanetResult(tx, ref, before, after, resolutionFleetId = null) {
    if (!before || !after) return;
    const FV = firebase.firestore.FieldValue;
    const upd = {};
    const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

    for (const f of ['debris', 'embargo', 'occupation', 'moon']) {
      if (!same(before[f], after[f])) upd[f] = after[f] ?? null;
    }

    const ownerChanged = (before.ownerUid || null) !== (after.ownerUid || null);
    const floorMap = (m) => {
      const o = {};
      for (const [k, v] of Object.entries(m || {})) o[k] = Math.max(0, Math.floor(Number(v) || 0));
      return o;
    };

    if (ownerChanged) {
      if (resolutionFleetId) upd.lastResolutionFleetId = resolutionFleetId;
      upd.ownerUid = after.ownerUid ?? null;
      upd.ownerName = after.ownerName ?? null;
      upd.isNpc = Boolean(after.isNpc);
      upd.resources = floorMap(after.resources);
      upd.fleet = floorMap(after.fleet);
      upd.defenses = floorMap(after.defenses);
      upd.buildQueue = [];
      upd.shipyardQueue = [];
      upd.defenseQueue = [];
      upd.lastUpdated = Date.now();
      upd.inbox = FV.delete();
    } else if (after.isNpc) {
      upd.resources = floorMap(after.resources);
      upd.fleet = floorMap(after.fleet);
      upd.defenses = floorMap(after.defenses);
      upd.lastUpdated = Date.now();
      upd.inbox = FV.delete();
    } else {
      for (const k of _INBOX_RES_KEYS) {
        const d = Math.round(Number(after.resources?.[k] || 0) - Number(before.resources?.[k] || 0));
        if (d) upd[`inbox.resources.${k}`] = FV.increment(d);
      }
      for (const part of ['fleet', 'defenses']) {
        const ids = new Set([...Object.keys(before[part] || {}), ...Object.keys(after[part] || {})]);
        for (const id of ids) {
          const d = Math.round(Number(after[part]?.[id] || 0) - Number(before[part]?.[id] || 0));
          if (d) upd[`inbox.${part}.${id}`] = FV.increment(d);
        }
      }
    }
    if (Object.keys(upd).length > 0) tx.update(ref, upd);
  }


  function _inboxCredit(tx, ref, { resources = {}, fleet = {}, defenses = {} } = {}) {
    if (!ref) return;
    const FV = firebase.firestore.FieldValue;
    const upd = {};
    for (const k of _INBOX_RES_KEYS) {
      const v = Math.round(Number(resources[k] || 0));
      if (v) upd[`inbox.resources.${k}`] = FV.increment(v);
    }
    for (const [id, q] of Object.entries(fleet || {})) {
      const v = Math.floor(Number(q || 0));
      if (v) upd[`inbox.fleet.${id}`] = FV.increment(v);
    }
    for (const [id, q] of Object.entries(defenses || {})) {
      const v = Math.floor(Number(q || 0));
      if (v) upd[`inbox.defenses.${id}`] = FV.increment(v);
    }
    if (Object.keys(upd).length > 0) tx.update(ref, upd);
  }


  async function _resolveCreditRef(uniRef, uid, originCoords) {
    const col = uniRef.collection('planets');
    try {
      if (originCoords) {
        const ref = col.doc(coordsToKey(originCoords));
        const s = await ref.get();
        if (s && s.exists && s.data().ownerUid === uid) return ref;
      }
      const q = await col.where('ownerUid', '==', uid).limit(1).get();
      return q && q.docs && q.docs.length > 0 ? q.docs[0].ref : null;
    } catch (e) {
      console.warn('[MP] Pianeta di accredito non trovato:', e);
      return null;
    }
  }


  async function syncPlayerState(universeObj, { force = false } = {}) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !universeObj?.id) return;

    const lastSync = _syncLastByUni.get(universeObj.id) || 0;
    if (!force && Date.now() - lastSync < SYNC_MIN_INTERVAL_MS) return;
    // Aggiorna il timestamp solo DOPO la transazione riuscita: un errore di
    // rete non deve simulare un checkpoint completato o annullare i retry.

    const FV = firebase.firestore.FieldValue;
    const uniRef = db.collection('online_universes').doc(universeObj.id);
    const planetsCol = uniRef.collection('planets');
    const playerRef = uniRef.collection('players').doc(user.uid);
    const planets = (universeObj.planets || []).slice();

    let reconciled = [];
    let lost = [];
    let moonUpdates = [];

    await db.runTransaction(async (tx) => {
      reconciled = [];
      lost = [];
      moonUpdates = [];
      const entries = planets.map((p) => ({ p, ref: planetsCol.doc(coordsToKey(p.coords)) }));
      const snaps = await Promise.all(entries.map((e) => tx.get(e.ref)));
      const nowTs = Date.now();

      entries.forEach((e, i) => {
        const snap = snaps[i];
        const p = e.p;
        if (!snap.exists) return;
        const data = snap.data();
        if (data.ownerUid !== user.uid) {
          lost.push(p);
          return;
        }

        const inbox = data.inbox || {};
        const res = Object.assign({}, p.resources);
        for (const k of _INBOX_RES_KEYS) {
          res[k] = Math.max(0, Math.floor(Number(p.resources?.[k] || 0) + Number(inbox.resources?.[k] || 0)));
        }
        const payload = {
          name: p.name,
          planetName: p.name,
          resources: res,
          buildings: p.buildings,
          defenses: _applyUnitDelta(p.defenses, inbox.defenses),
          fleet: _applyUnitDelta(p.fleet, inbox.fleet),
          buildQueue: p.buildQueue || [],
          shipyardQueue: p.shipyardQueue || [],
          defenseQueue: p.defenseQueue || [],
          lastUpdated: nowTs
        };
        if (data.inbox !== undefined) payload.inbox = FV.delete();
        // Parità con l'offline: costruzioni/upgrade lunari devono essere salvati.
        // Una Luna nuova non può nascere qui: la crea solo la transazione del Mercante.
        if (data.moon && p.moon) payload.moon = p.moon;
        tx.set(e.ref, payload, { merge: true });
        // La Luna è gestita nel documento condiviso: recepisci modifiche
        // create da un altro client, non solo i delta della inbox.
        if (Boolean(p.moon) !== Boolean(data.moon)) {
          moonUpdates.push({ planet: p, moon: data.moon || null });
        }
        if (_hasInbox(data)) reconciled.push({ planet: p, inbox });
      });

      tx.set(playerRef, {
        nickname: universeObj.emperor || user.displayName || 'Comandante',
        researches: universeObj.researches || {},
        researchQueue: universeObj.researchQueue || null,
        points: computePlayerPoints(universeObj),
        planetCount: planets.length - lost.length,
        lastSeen: nowTs
      }, { merge: true });
    });
    _syncLastByUni.set(universeObj.id, Date.now());

    for (const { planet, inbox } of reconciled) {
      planet.resources = Object.assign({ metal: 0, crystal: 0, deuterium: 0 }, planet.resources);
      for (const k of _INBOX_RES_KEYS) {
        const d = Number(inbox.resources?.[k] || 0);
        if (d) planet.resources[k] = Math.max(0, Math.floor(Number(planet.resources[k] || 0) + d));
      }
      planet.fleet = _applyUnitDelta(planet.fleet, inbox.fleet);
      planet.defenses = _applyUnitDelta(planet.defenses, inbox.defenses);
    }
    for (const { planet, moon } of moonUpdates) {
      planet.moon = moon;
      if (moon && planet.coords) {
        const k = coordsToKey(planet.coords);
        universeObj.galaxyDeltas = universeObj.galaxyDeltas || {};
        universeObj.galaxyDeltas[k] = { ...(universeObj.galaxyDeltas[k] || {}), hasMoon: true, hasBacino: false, moonName: moon.name || 'Luna' };
      }
    }
    if (lost.length > 0) {
      universeObj.planets = (universeObj.planets || []).filter((p) => !lost.includes(p));
    }
    if (reconciled.length > 0 || lost.length > 0 || moonUpdates.length > 0) {
      try {
        window.UniversumUI?.onOnlineReconciled?.({ reconciled, lost });
      } catch (e) {
        console.warn('[MP] Aggiornamento UI dopo riallineamento non riuscito:', e);
      }
    }
  }


  function listenOwnPlanets(universeObj, onChange) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !universeObj?.id) return () => {};

    return db.collection('online_universes').doc(universeObj.id).collection('planets')
      .where('ownerUid', '==', user.uid)
      .onSnapshot((snap) => {
        const gained = [];
        let needSync = false;
        for (const ch of snap.docChanges()) {
          if (ch.type === 'removed') {
            needSync = true;
            continue;
          }
          const data = ch.doc.data();
          const known = (universeObj.planets || []).some((p) => p.coords && coordsToKey(p.coords) === ch.doc.id);
          if (!known) {
            const np = calculateLiveResources(data, universeObj.speed || 10);
            if (!np.id) np.id = ch.doc.id;
            universeObj.planets = universeObj.planets || [];
            universeObj.planets.push(np);
            gained.push(np);
            continue;
          }
          const local = (universeObj.planets || []).find(p => p.coords && coordsToKey(p.coords) === ch.doc.id);
          if (_hasInbox(data) || (local && JSON.stringify(local.moon || null) !== JSON.stringify(data.moon || null))) needSync = true;
        }
        if (gained.length > 0 || needSync) onChange({ gained, needSync });
      }, (err) => _mpNotifyError('listener pianeti', err));
  }


  async function renameOnlinePlanet(uniId, coords, newName) {
    const db = getDB();
    const key = coordsToKey(coords);
    await db.collection('online_universes').doc(uniId).collection('planets').doc(key).update({
      name: newName,
      planetName: newName
    });
  }


  async function renameOnlineMoon(uniId, coords, newMoonName) {
    const db = getDB();
    const key = coordsToKey(coords);
    await db.collection('online_universes').doc(uniId).collection('planets').doc(key).update({
      'moon.name': newMoonName
    });
  }


  const _systemLoading = new Map();
  async function getOnlineSystem(uniId, galaxy, system) {
    const cacheKey = `${uniId}:${Number(galaxy)}:${Number(system)}`;
    const cached = _cacheGet(_systemCache, cacheKey, SYSTEM_CACHE_TTL_MS);
    if (cached) return cached;
    // In caso di re-render simultanei una sola query, condivisa dai chiamanti.
    if (_systemLoading.has(cacheKey)) return _systemLoading.get(cacheKey);
    const task = fetchOnlineSystem(uniId, galaxy, system)
      .then((fresh) => {
        _systemCache.set(cacheKey, { at: Date.now(), data: fresh });
        return fresh;
      }).finally(() => _systemLoading.delete(cacheKey));
    _systemLoading.set(cacheKey, task);
    return task;
  }


  async function fetchOnlineSystem(uniId, galaxy, system) {
    const db = getDB();
    const uniRef = db.collection('online_universes').doc(uniId);
    const activeUni = window.UniversumUI?.state?.currentUniverse;
    // Se si sta visualizzando l'universo attivo la sua velocita' e' gia' nota.
    const speed = activeUni?.id === uniId ? (activeUni.speed || 10)
      : ((await uniRef.get()).data()?.speed || 10);

    const snap = await uniRef.collection('planets')
      .where('coords.g', '==', Number(galaxy))
      .where('coords.s', '==', Number(system))
      .get();

    const occupiedByPos = new Map();
    snap.docs.forEach((doc) => {
      const liveData = _effectivePlanetView(doc.data(), speed);
      occupiedByPos.set(Number(liveData.coords.p), liveData);
    });

    const slots = [];
    for (let pos = 1; pos <= 15; pos++) {
      if (occupiedByPos.has(pos)) {
        const pl = occupiedByPos.get(pos);
        slots.push(Object.assign({}, pl, {
          planetId: pl.id,
          ownerType: pl.isNpc ? 'outpost' : 'player',
          botLevel: pl.botLevel || 1,
          botPersonality: pl.botPersonality || 'Commerciante'
        }));
      } else {
        const specs = generatePlanetSpecs({ g: galaxy, s: system, p: pos });
        slots.push({
          coords: { g: Number(galaxy), s: Number(system), p: pos },
          name: 'Pianeta Disabitato',
          planetName: 'Pianeta Disabitato',
          ownerUid: null,
          ownerName: null,
          isNpc: false,
          ownerType: 'empty',
          minTemp: specs.minTemp,
          maxTemp: specs.maxTemp,
          fieldsMax: specs.fieldsMax,
          moon: null,
          debris: { metal: 0, crystal: 0 }
        });
      }
    }

    return {
      galaxy: Number(galaxy),
      system: Number(system),
      slots
    };
  }

  Object.assign(G, { calculateLiveResources, computePlayerPoints, _applyUnitDelta, _hasInbox, _effectivePlanetView, _snapshotForDiff, _writePlanetResult, _inboxCredit, _resolveCreditRef, syncPlayerState, listenOwnPlanets, renameOnlinePlanet, renameOnlineMoon, getOnlineSystem, fetchOnlineSystem });

})();
