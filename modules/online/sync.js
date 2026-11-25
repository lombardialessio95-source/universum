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
      const active = window.UniversumUI?.state?.currentUniverse;
      const ownUid = window.fbAuth?.currentUser?.uid;
      // La tecnologia energetica è già nello stato della propria partita:
      // nessuna lettura aggiuntiva di documenti Firestore.
      const prodResearches = cloned.researches || (ownUid && cloned.ownerUid === ownUid && active?.researches) || {};
      // Calcolo puro: divide l'intervallo anche se il combustibile termina durante l'assenza.
      // Stessa regola usata dal tick offline: la produzione positiva si ferma
      // alla capienza, i trasporti preesistenti oltre soglia non vengono tagliati
      // e il consumo negativo di deuterio continua anche a deposito pieno.
      window.__UniversumEngineModules.advancePlanetResources(
        cloned, { speed, creativeMode: false, researches: prodResearches }, elapsedHours * 3600
      );
      cloned.resources.metal = Math.floor(cloned.resources.metal);
      cloned.resources.crystal = Math.floor(cloned.resources.crystal);
      cloned.resources.deuterium = Math.max(0, Math.floor(cloned.resources.deuterium));
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
      // I Caccia imbarcati non figurano nello stock orbitale, ma rimangono
      // posseduti dal giocatore e continuano a contare nella classifica.
      const fighter = Data?.SHIPS?.lightFighter;
      if (fighter) for (const hangar of p.mothershipHangars || []) {
        pts += Math.floor(((fighter.cost.metal + fighter.cost.crystal + fighter.cost.deuterium) / 1000) * Number(hangar.fighters || 0));
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


  const clone = value => JSON.parse(JSON.stringify(value));
  const appliedEvents = new WeakMap();
  const checkpoints = new WeakMap();
  function recordServiceEvent(upd, before, fleet, resources = {}, defenses = {}, previous = {}) {
    const services = window.UniversumServices;
    if (!services?.ids.some(id=>before?.[id] || fleet[id])) return;
    if (![fleet,resources,defenses].some(map=>Object.values(map).some(Number))) return;
    const events = Object.values(previous || {});
    const at = Math.max(Date.now(),...events.map(e=>e.at));
    const order = 1+events.reduce((n,e)=>Math.max(n,e.order || 0),0);
    upd['inbox.serviceEvents.' + services.uid()] = {at,order,fleet,resources,defenses};
  }
  function restoreServices(u, planets, player, now = Date.now()) {
    const engine = window.UniversumEngine;
    const services = window.UniversumServices;
    const events = planets.flatMap(p=>Object.entries(p.inbox?.serviceEvents || {}).map(([key,event])=>({p,key,event})));
    if (!engine || !services || (!events.length && !services.hasServices({planets}))) {
      u.planets = planets.map(p=>calculateLiveResources(p,u.speed));
      return;
    }
    u.planets = planets;
    u.lastSeen = player.serviceCheckpoint || Math.min(now,...planets.map(p=>Number(p.lastUpdated) || now));
    for (const {p,key,event} of events.sort((a,b)=>a.event.at-b.event.at || (a.event.order || 0)-(b.event.order || 0) || a.key.localeCompare(b.key))) {
      const at = Math.min(now,Math.max(u.lastSeen,event.at));
      engine.processOfflineProgress(u,at);
      for (const part of ['fleet','defenses']) p[part] = _applyUnitDelta(p[part],event[part]);
      for (const [k,n] of Object.entries(event.resources || {})) p.resources[k] = Math.max(0,(p.resources[k] || 0)+n);
      services.settlePlanet(u,p,at);
      const applied = appliedEvents.get(p) || {};
      applied[key] = event;
      appliedEvents.set(p,applied);
    }
    engine.processOfflineProgress(u,now);
  }
  // Una battaglia vede anche le unità completate e i costi sostenuti durante
  // l’assenza. La lettura nella stessa transazione protegge da checkpoint concorrenti.
  async function combatPlanet(tx,uniRef,targetSnap,speed,now) {
    const target = targetSnap.data();
    const services = window.UniversumServices;
    if (!services || target.isNpc || !target.ownerUid ||
        (!services.hasServices({planets:[target]}) && !Object.keys(target.inbox?.serviceEvents || {}).length)) {
      return _effectivePlanetView(target,speed);
    }
    const profile = (await tx.get(uniRef.collection('players').doc(target.ownerUid))).data() || {};
    const keys = profile.checkpointPlanets || [targetSnap.id];
    const others = await Promise.all(keys.filter(key=>key!==targetSnap.id).map(key=>tx.get(uniRef.collection('planets').doc(key))));
    const byKey = new Map([targetSnap,...others].filter(d=>d.exists && d.data().ownerUid===target.ownerUid).map(d=>[d.id,d.data()]));
    const planets = [...new Set([...keys,targetSnap.id])].map(key=>byKey.get(key)).filter(Boolean);
    const u = {speed,planets,researches:profile.researches || {},researchQueue:profile.researchQueue || null,
      researchModelVersion:profile.researchModelVersion || 0,specialistBuilt:profile.specialistBuilt || {},
      serviceRevision:profile.serviceRevision || 0};
    restoreServices(u,planets,profile,now);
    const p = byKey.get(targetSnap.id);
    const inbox = pendingInbox(p,target);
    const oldCount=Number(p.fleet?.mothership || 0);
    for (const key of ['resources','fleet','defenses']) p[key] = _applyUnitDelta(p[key],inbox[key]);
    if (window.UniversumHangars && (oldCount || p.fleet?.mothership || inbox.hangarLosses || inbox.hangarReturns)) {
      window.UniversumHangars.applyInbox(p,inbox,oldCount);
    }
    return p;
  }
  function pendingInbox(p,data) {
    const inbox = clone(data.inbox || {});
    const applied = appliedEvents.get(p) || {};
    if (Object.keys(inbox.serviceEvents || {}).some(key=>!applied[key])) throw conflict();
    for (const key of Object.keys(inbox.serviceEvents || {})) {
      for (const part of ['resources','fleet','defenses']) {
        for (const [id,n] of Object.entries(applied[key][part] || {})) {
          inbox[part] ||= {};
          inbox[part][id] = (inbox[part][id] || 0) - n;
        }
      }
    }
    return inbox;
  }
  function conflict() {
    return Object.assign(new Error('Lo stato sul server è cambiato. Ricaricamento della partita in corso.'), {code:'service-conflict'});
  }
  function _hasInbox(data) {
    const ib = data && data.inbox;
    if (!ib || typeof ib !== 'object') return false;
    if (Object.keys(ib.serviceEvents || {}).length || Object.keys(ib.hangarReturns || {}).length || Object.keys(ib.hangarLosses || {}).length) return true;
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
    if (window.UniversumHangars && (live.fleet.mothership || planetDoc.mothershipHangars?.length ||
        inbox.hangarReturns || inbox.hangarLosses)) {
      window.UniversumHangars.applyInbox(live,inbox,Number(planetDoc.fleet?.mothership || 0));
    }
    live.defenses = _applyUnitDelta(planetDoc.defenses, inbox.defenses);
    delete live.inbox;
    return live;
  }


  function _snapshotForDiff(p) {
    if (!p) return null;
    return JSON.parse(JSON.stringify({
      serviceEvents: p.inbox?.serviceEvents || {},
      hadServices: Boolean(p.services),
      resources: p.resources || {},
      fleet: p.fleet || {},
      mothershipHangars:p.mothershipHangars || [],
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
      upd.mothershipHangars=[];
      upd.defenses = floorMap(after.defenses);
      if (before.hadServices) upd.services = FV.delete();
      upd.buildQueue = [];
      upd.shipyardQueue = [];
      upd.defenseQueue = [];
      upd.lastUpdated = Date.now();
      upd.inbox = FV.delete();
    } else if (after.isNpc) {
      upd.resources = floorMap(after.resources);
      upd.fleet = floorMap(after.fleet);
      upd.mothershipHangars=after.mothershipHangars || [];
      upd.defenses = floorMap(after.defenses);
      upd.lastUpdated = Date.now();
      upd.inbox = FV.delete();
    } else {
      const delta = {resources:{},fleet:{},defenses:{}};
      for (const k of _INBOX_RES_KEYS) {
        const d = Math.round(Number(after.resources?.[k] || 0) - Number(before.resources?.[k] || 0));
        if (d) { delta.resources[k] = d; upd[`inbox.resources.${k}`] = FV.increment(d); }
      }
      for (const part of ['fleet', 'defenses']) {
        const ids = new Set([...Object.keys(before[part] || {}), ...Object.keys(after[part] || {})]);
        for (const id of ids) {
          const d = Math.round(Number(after[part]?.[id] || 0) - Number(before[part]?.[id] || 0));
          if (d) { delta[part][id] = d; upd[`inbox.${part}.${id}`] = FV.increment(d); }
        }
      }
      if (resolutionFleetId) {
        const survivorIds=new Set((after.mothershipHangars || []).map(h=>h.id));
        const losses=(before.mothershipHangars || []).filter(h=>!survivorIds.has(h.id)).map(h=>h.id);
        if (losses.length) upd[`inbox.hangarLosses.${resolutionFleetId}`]=losses;
      }
      recordServiceEvent(upd,before.fleet,delta.fleet,delta.resources,delta.defenses,before.serviceEvents);
    }
    if (Object.keys(upd).length > 0) tx.update(ref, upd);
  }


  function _inboxCredit(tx, ref, { resources = {}, fleet = {}, defenses = {} } = {}, previous = {}) {
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
    recordServiceEvent(upd,null,fleet,resources,defenses,previous);
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


  async function syncPlayerState(u, options = {}) {
    if (!u) return;
    const previous = checkpoints.get(u);
    const operation = (previous || Promise.resolve()).catch(()=>{}).then(()=>saveCheckpoint(u,options));
    checkpoints.set(u,operation);
    try { return await operation; }
    catch (error) {
      // Le regole possono osservare il commit concorrente prima del retry SDK.
      if (error.code === 'permission-denied' && Number.isSafeInteger(u.serviceRevision)) {
        const user = getAuth().currentUser;
        const ref = user && getDB().collection('online_universes').doc(u.id).collection('players').doc(user.uid);
        const fresh = ref && await ref.get({source:'server'}).catch(()=>null);
        if (fresh?.exists && fresh.data().serviceRevision !== u.serviceRevision) error = conflict();
      }
      if (error.code === 'service-conflict' && window.UniversumUI?.state?.currentUniverse === u) {
        const ui = window.UniversumUI;
        ui.toast(error.message,'error');
        await ui.exitToLobbyAfterServerRemoval();
        try { ui.startOnlineGame(await G.joinOnlineUniverse(u.id,u.roomPasscode)); }
        catch (reloadError) { ui.toast(reloadError.message,'error'); }
      }
      throw error;
    } finally { if (checkpoints.get(u) === operation) checkpoints.delete(u); }
  }
  function debitFleet(u,p,dispatch,now,validate = true) {
    window.UniversumServices.settlePlanet(u,p,now);
    if (dispatch.carrierHangars?.length) {
      if (!window.UniversumHangars) throw conflict();
      window.UniversumHangars.take(p,dispatch.carrierHangars);
    }
    const ships = dispatch.doc.ships;
    if (validate && (Object.entries(ships).some(([id,n])=>(p.fleet[id] || 0)<n) ||
        Object.entries(dispatch.debit).some(([k,n])=>p.resources[k]<n))) throw conflict();
    for (const [id,n] of Object.entries(ships)) p.fleet[id] = Math.max(0,(p.fleet[id] || 0)-n);
    for (const [k,n] of Object.entries(dispatch.debit)) p.resources[k] = Math.max(0,p.resources[k]-n);
    window.UniversumServices.settlePlanet(u,p,now);
  }
  async function saveCheckpoint(universeObj, { force = false, dispatch = null } = {}) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !universeObj?.id) return;
    window.UniversumEngine?.normalizeResearchState(universeObj);

    const syncKey = JSON.stringify([user.uid, universeObj.id]);
    const lastSync = _syncLastByUni.get(syncKey);
    if (!force && lastSync !== undefined && Date.now() - lastSync < SYNC_MIN_INTERVAL_MS) return false;
    // Aggiorna il timestamp solo DOPO la transazione riuscita: un errore di
    // rete non deve simulare un checkpoint completato o annullare i retry.

    const FV = firebase.firestore.FieldValue;
    const uniRef = db.collection('online_universes').doc(universeObj.id);
    const planetsCol = uniRef.collection('planets');
    const playerRef = uniRef.collection('players').doc(user.uid);
    const planets = (universeObj.planets || []).slice();

    const versioned = Number.isSafeInteger(universeObj.serviceRevision);
    const expected = universeObj.serviceRevision;
    const services = window.UniversumServices;
    let reconciled = [];
    let lost = [];
    let moonUpdates = [];

    await db.runTransaction(async (tx) => {
      reconciled = [];
      lost = [];
      moonUpdates = [];
      const entries = planets.map((p) => ({ p, ref: planetsCol.doc(coordsToKey(p.coords)) }));
      const snaps = await Promise.all(entries.map((e) => tx.get(e.ref)));
      const playerSnap = versioned ? await tx.get(playerRef) : null;
      const player = playerSnap?.data() || {};
      if (versioned && (player.serviceRevision || 0) !== expected) throw conflict();
      const nowTs = Date.now();
      const flightRefs = player.specialistFlights || [];
      const checkCapacity = versioned && services && (dispatch || planets.some(p=>p.shipyardQueue?.some(lot=>services.ids.includes(lot.id))));
      let activeRefs = flightRefs;
      const totals = {};
      if (checkCapacity) {
        const flights = await Promise.all(flightRefs.map(id=>tx.get(uniRef.collection('fleets').doc(id))));
        activeRefs = [];
        for (const flight of flights) if (flight.exists && !flight.data().resolved) {
          activeRefs.push(flight.id);
          for (const id of services.ids) totals[id] = (totals[id] || 0) + (flight.data().ships?.[id] || 0);
        }
      }
      if (dispatch) {
        const origin = entries.findIndex(e=>e.ref.id===dispatch.doc.originKey);
        if (origin < 0 || snaps[origin].data()?.ownerUid !== user.uid) throw conflict();
        if (dispatch.doc.mission === 'incursion') {
          const dest = await tx.get(planetsCol.doc(dispatch.doc.targetKey));
          if (!dest.exists || (dest.data().ownerUid === user.uid) ||
              (!dest.data().isNpc && !dest.data().ownerUid)) throw conflict();
          if (dispatch.doc.defenderUid !== (dest.data().ownerUid || null)) throw conflict();
          window.UniversumHangars.validateMission(dispatch.doc.ships,dispatch.carrierHangars);
        } else if (dispatch.specialist || !dispatch.carrierHangars?.length) {
          const i = entries.findIndex(e=>e.ref.id===dispatch.doc.targetKey);
          if (i < 0 || snaps[i].data()?.ownerUid !== user.uid) throw conflict();
        }
        if (dispatch.specialist || !dispatch.carrierHangars?.length) activeRefs = [...activeRefs,dispatch.ref.id];
      }

      entries.forEach((e, i) => {
        const snap = snaps[i];
        const p = e.p;
        if (!snap.exists) return;
        const data = snap.data();
        if (data.ownerUid !== user.uid) {
          lost.push(p);
          return;
        }

        const inbox = pendingInbox(p,data);
        const sending = dispatch && e.ref.id === dispatch.doc.originKey;
        const model = sending ? clone(p) : p;
        if (sending) debitFleet(universeObj,model,dispatch,nowTs);
        const res = Object.assign({}, model.resources);
        const H = window.UniversumHangars;
        let savedHangars = Array.isArray(model.mothershipHangars) ? model.mothershipHangars.slice() : [];
        const returns = Object.values(inbox.hangarReturns || {});
        if (H && (Number(model.fleet?.mothership || 0) || savedHangars.length || returns.length)) {
          const snapshot = {id:p.id,coords:p.coords,fleet:{mothership:Number(model.fleet?.mothership || 0)},mothershipHangars:savedHangars};
          H.normalizePlanet(snapshot);
          savedHangars = snapshot.mothershipHangars;
          const lostIds=new Set(Object.values(inbox.hangarLosses || {}).flat());
          savedHangars=savedHangars.filter(h=>!lostIds.has(h.id));
          const ids = new Set(savedHangars.map(h=>h.id));
          for (const list of returns) for (const h of H.verifyManifest(list)) {
            if (ids.has(h.id)) throw conflict();
            ids.add(h.id);
            savedHangars.push(h);
          }
        }
        for (const k of _INBOX_RES_KEYS) {
          res[k] = Math.max(0, Math.floor(Number(model.resources?.[k] || 0) + Number(inbox.resources?.[k] || 0)));
        }
        const payload = {
          name: p.name,
          planetName: p.name,
          resources: res,
          buildings: p.buildings,
          defenses: _applyUnitDelta(p.defenses, inbox.defenses),
          fleet: _applyUnitDelta(model.fleet, inbox.fleet),
          mothershipHangars: savedHangars,
          ...(model.services ? {services:model.services} : {}),
          ...(versioned ? {serviceRevision:expected+1} : {}),
          buildQueue: p.buildQueue || [],
          shipyardQueue: p.shipyardQueue || [],
          defenseQueue: p.defenseQueue || [],
          localResearches: p.localResearches || {},
          localResearchQueue: p.localResearchQueue || null,
          bacinoSpaziale: p.bacinoSpaziale || null,
          lastUpdated: nowTs
        };
        if (H && (payload.fleet.mothership || payload.mothershipHangars.length)) {
          if (payload.mothershipHangars.length > Math.floor(Number(payload.fleet.mothership || 0))) throw conflict();
          const check={id:p.id,coords:p.coords,fleet:payload.fleet,mothershipHangars:payload.mothershipHangars};
          H.normalizePlanet(check);
          payload.mothershipHangars=check.mothershipHangars;
        }
        if (checkCapacity) for (const id of services.ids) {
          const reserved = payload.shipyardQueue.reduce((n,lot)=>n+(lot.id===id ? lot.remaining : 0),0);
          totals[id] = (totals[id] || 0) + (payload.fleet[id] || 0) + reserved + (sending ? dispatch.doc.ships[id] || 0 : 0);
        }
        if (data.inbox !== undefined) payload.inbox = FV.delete();
        // Parità con l'offline: costruzioni/upgrade lunari devono essere salvati.
        // Una Luna nuova non può nascere qui: la crea solo la transazione del Mercante.
        if (data.moon && p.moon) payload.moon = p.moon;
        if (versioned) tx.update(e.ref,payload);
        else tx.set(e.ref, payload, { merge: true });
        // La Luna è gestita nel documento condiviso: recepisci modifiche
        // create da un altro client, non solo i delta della inbox.
        if (Boolean(p.moon) !== Boolean(data.moon)) {
          moonUpdates.push({ planet: p, moon: data.moon || null });
        }
        if (_hasInbox(data)) reconciled.push({ planet: p, inbox });
      });

      if (checkCapacity && (totals[services.forge] > 5 || totals[services.oracle] > 3)) throw conflict();
      if (dispatch) tx.set(dispatch.ref,dispatch.doc);
      const playerPayload = {
        ...(versioned ? {serviceRevision:expected+1,serviceCheckpoint:nowTs,
          checkpointPlanets:entries.filter((e,i)=>snaps[i].data()?.ownerUid===user.uid).map(e=>e.ref.id),
          specialistBuilt:universeObj.specialistBuilt || {}, specialistFlights:activeRefs} : {}),
        nickname: universeObj.emperor || user.displayName || 'Comandante',
        researches: universeObj.researches || {},
        researchQueue: universeObj.researchQueue || null,
        researchModelVersion: universeObj.researchModelVersion || 1,
        points: computePlayerPoints(universeObj),
        planetCount: planets.length - lost.length,
        lastSeen: nowTs
      };
      if (playerSnap?.exists) tx.update(playerRef,playerPayload);
      else tx.set(playerRef,playerPayload,{merge:true});
    });
    if (versioned) universeObj.serviceRevision = expected+1;
    if (dispatch) debitFleet(universeObj,planets.find(p=>coordsToKey(p.coords)===dispatch.doc.originKey),dispatch,Date.now(),false);
    for (const p of planets) appliedEvents.delete(p);
    _syncLastByUni.set(syncKey, Date.now());

    for (const { planet, inbox } of reconciled) {
      planet.resources = Object.assign({ metal: 0, crystal: 0, deuterium: 0 }, planet.resources);
      for (const k of _INBOX_RES_KEYS) {
        const d = Number(inbox.resources?.[k] || 0);
        if (d) planet.resources[k] = Math.max(0, Math.floor(Number(planet.resources[k] || 0) + d));
      }
      const motherCountBefore=Number(planet.fleet?.mothership || 0);
      planet.fleet = _applyUnitDelta(planet.fleet, inbox.fleet);
      planet.defenses = _applyUnitDelta(planet.defenses, inbox.defenses);
      if (window.UniversumHangars && (motherCountBefore || planet.fleet.mothership ||
          inbox.hangarReturns || inbox.hangarLosses)) window.UniversumHangars.applyInbox(planet,inbox,motherCountBefore);
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
    return true;
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


  async function changeOnlineMothershipHangar(u,planetIndex,id,amount) {
    const user=getAuth().currentUser, db=getDB(), H=window.UniversumHangars;
    if (!user || !u?.id || !H || !Number.isSafeInteger(amount) || !amount) throw Error('Operazione hangar non valida.');
    const planet=u.planets[planetIndex];
    if (!planet) throw Error('Pianeta selezionato non disponibile.');
    // Prima conclude qualsiasi checkpoint della partita: i due client non devono
    // usare due versioni diverse del campo fleet mentre spostano i caccia.
    await syncPlayerState(u,{force:true});
    const uni=db.collection('online_universes').doc(u.id);
    const ref=uni.collection('planets').doc(coordsToKey(planet.coords));
    const player=uni.collection('players').doc(user.uid);
    const expected=Number(u.serviceRevision || 0);
    let accepted;
    await db.runTransaction(async tx=>{
      const [pSnap,playerSnap]=await Promise.all([tx.get(ref),tx.get(player)]);
      if (!pSnap.exists || !playerSnap.exists || pSnap.data().ownerUid!==user.uid ||
          Number(playerSnap.data().serviceRevision || 0)!==expected) throw conflict();
      const data=pSnap.data(), before={id:data.id,coords:data.coords,
        fleet:Object.assign({},data.fleet || {}), mothershipHangars:data.mothershipHangars || []};
      // Se nel frattempo sono arrivate perdite/rientri di caccia o vettori,
      // l'hangar non può operare sullo stock precedente: prima serve il checkpoint.
      if (Object.keys(data.inbox?.hangarReturns || {}).length ||
          Object.keys(data.inbox?.hangarLosses || {}).length ||
          Number(data.inbox?.fleet?.lightFighter || 0) !== 0 ||
          Number(data.inbox?.fleet?.mothership || 0) !== 0) throw conflict();
      H.changeLoad(before,id,amount);
      accepted={fleet:before.fleet,hangars:before.mothershipHangars};
      tx.update(ref,{fleet:before.fleet,mothershipHangars:before.mothershipHangars,
        serviceRevision:expected+1,lastUpdated:Date.now()});
      tx.update(player,{serviceRevision:expected+1,serviceCheckpoint:Date.now()});
    });
    planet.fleet.lightFighter=accepted.fleet.lightFighter;
    planet.mothershipHangars=accepted.hangars;
    u.serviceRevision=expected+1;
    return true;
  }

  Object.assign(G, { changeOnlineMothershipHangar, combatPlanet, restoreServices, calculateLiveResources, computePlayerPoints, _applyUnitDelta, _hasInbox, _effectivePlanetView, _snapshotForDiff, _writePlanetResult, _inboxCredit, _resolveCreditRef, syncPlayerState, listenOwnPlanets, renameOnlinePlanet, renameOnlineMoon, getOnlineSystem, fetchOnlineSystem });

})();
