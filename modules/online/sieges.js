/** UNIVERSUM / modules/online/sieges.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumMPModules;
  const { OCCUPATION_SWEEP_MIN_MS, _occupationSweepAt } = window.__UniversumMPVariables;
  // Bridge lazy per le funzioni definite negli altri moduli.
  const _effectivePlanetView = (...args) => G._effectivePlanetView(...args);
  const _fleetDueTime = (...args) => G._fleetDueTime(...args);
  const _inboxCredit = (...args) => G._inboxCredit(...args);
  const _mpNotifyError = (...args) => G._mpNotifyError(...args);
  const _resolveCreditRef = (...args) => G._resolveCreditRef(...args);
  const coordsToKey = (...args) => G.coordsToKey(...args);
  const forceCleanupOnlineFleet = (...args) => G.forceCleanupOnlineFleet(...args);
  const getAuth = (...args) => G.getAuth(...args);
  const getDB = (...args) => G.getDB(...args);
  const migrateOnlineFleets = (...args) => G.migrateOnlineFleets(...args);
  const normalizeOnlineFleet = (...args) => G.normalizeOnlineFleet(...args);
  const resolveArrivedOnlineFleets = (...args) => G.resolveArrivedOnlineFleets(...args);



  async function repairStuckMissions(uniId) {
    await migrateOnlineFleets(uniId, { force: true });
    await resolveArrivedOnlineFleets(uniId);
    const db = getDB();
    const uniRef = db.collection('online_universes').doc(uniId);
    const uid = getAuth().currentUser?.uid;
    if (!uid) return 0;
    const docs = await G.fetchFleetPartyDocs(uniRef.collection('fleets'), uid);
    let repaired = 0;
    const now = Date.now();
    for (const d of docs) {
      const fleet = normalizeOnlineFleet(d.data(), d.id);
      const uid = getAuth().currentUser?.uid;
      if (!uid || (fleet.attackerUid !== uid && fleet.defenderUid !== uid)) continue;
      if (fleet.resolved) continue;
      if (fleet.status === 'embargo' || fleet.status === 'occupy') continue;
      if (_fleetDueTime(fleet) <= now) {
        await forceCleanupOnlineFleet(uniRef, fleet, d.ref, 'repair-button');
        repaired++;
      }
    }
    return repaired;
  }


  async function processAllOccupations(uniId, { onlyUid = null } = {}) {
    const db = getDB();
    if (!uniId) return;
    const uniRef = db.collection('online_universes').doc(uniId);
    const planetsCol = uniRef.collection('planets');
    const query = onlyUid
      ? planetsCol.where('occupation.occupierUid', '==', onlyUid)
      : planetsCol.where('occupation.occupierUid', '!=', null).limit(50);
    const snap = await query.get().catch(() => null);
    if (!snap || !snap.docs || snap.docs.length === 0) return;

    const DAY_MS = 24 * 3600 * 1000;
    const activeUniverse = window.UniversumUI?.state?.currentUniverse;
    const knownSpeed = activeUniverse?.id === uniId ? Number(activeUniverse.speed) : 0;
    const due = snap.docs.filter((doc) => {
      const occ = doc.data().occupation;
      const last = Number(occ?.lastTributeAt || occ?.startedAt || 0);
      return occ?.originCoords && last && Date.now() - last >= DAY_MS;
    });
    if (!due.length) return;
    const occSpeed = knownSpeed > 0 ? knownSpeed
      : ((await uniRef.get().catch(() => null))?.data()?.speed || 10);

    for (const pDoc of due) {
      const occ = pDoc.data().occupation;

      const creditRef = await _resolveCreditRef(uniRef, occ.occupierUid, occ.originCoords);
      if (!creditRef) continue;

      await db.runTransaction(async (tx) => {
        const freshTarget = await tx.get(pDoc.ref);
        if (!freshTarget.exists) return;

        const tData = freshTarget.data();
        const o = tData.occupation;
        if (!o || o.occupierUid !== occ.occupierUid) return;

        const last = Number(o.lastTributeAt || o.startedAt || 0);
        const cycles = Math.floor((Date.now() - last) / DAY_MS);
        if (!last || cycles < 1) return;

        const eff = _effectivePlanetView(tData, occSpeed);
        const rate = Math.min(0.5, 0.05 * cycles);
        const tribM = Math.floor((eff.resources.metal || 0) * rate);
        const tribC = Math.floor((eff.resources.crystal || 0) * rate);
        const tribD = Math.floor((eff.resources.deuterium || 0) * rate);

        const FV = firebase.firestore.FieldValue;
        const upd = {
          'occupation.lastTributeAt': last + cycles * DAY_MS,
          'occupation.prelievoAccumulato': {
            metal: Number(o.prelievoAccumulato?.metal || 0) + tribM,
            crystal: Number(o.prelievoAccumulato?.crystal || 0) + tribC,
            deuterium: Number(o.prelievoAccumulato?.deuterium || 0) + tribD
          }
        };
        if (tData.isNpc) {
          upd['resources.metal'] = Math.max(0, eff.resources.metal - tribM);
          upd['resources.crystal'] = Math.max(0, eff.resources.crystal - tribC);
          upd['resources.deuterium'] = Math.max(0, eff.resources.deuterium - tribD);
          upd.lastUpdated = Date.now();
          upd.inbox = FV.delete();
        } else {
          if (tribM) upd['inbox.resources.metal'] = FV.increment(-tribM);
          if (tribC) upd['inbox.resources.crystal'] = FV.increment(-tribC);
          if (tribD) upd['inbox.resources.deuterium'] = FV.increment(-tribD);
        }
        tx.update(pDoc.ref, upd);
        _inboxCredit(tx, creditRef, { resources: { metal: tribM, crystal: tribC, deuterium: tribD } });
      }).catch((e) => console.warn('[MP Occupazioni] Tributo rinviato:', e));
    }
  }


  async function sweepOccupationsThrottled(uniId) {
    const last = _occupationSweepAt.get(uniId) || 0;
    if (Date.now() - last < OCCUPATION_SWEEP_MIN_MS) return;
    _occupationSweepAt.set(uniId, Date.now());
    const uid = getAuth().currentUser?.uid;
    if (uid) await processAllOccupations(uniId, { onlyUid: uid });
  }


  async function processOnlineOccupations(uniId) {
    const user = getAuth().currentUser;
    if (!user || !uniId) return;
    await processAllOccupations(uniId, { onlyUid: user.uid });
  }


  // P1 FIX: legge la velocità reale dell'universo prima di calcolare il viaggio di ritorno
  async function _transitionSiegeFleetToReturning(uniRef, targetKey, { pendingRansom = null } = {}) {
    const db = getDB();
    const snap = await uniRef.collection('fleets').where('targetKey', '==', targetKey).get().catch(() => ({ docs: [] }));
    const now = Date.now();

    // P1 FIX: la velocità del viaggio di ritorno deve usare la velocità reale dell'universo (era hardcoded 10)
    const uniSnap = await uniRef.get().catch(() => null);
    const realSpeed = uniSnap && uniSnap.exists ? (uniSnap.data().speed || 10) : 10;

    let transitioned = false;
    for (const d of snap.docs) {
      const fleet = normalizeOnlineFleet(d.data(), d.id);
      if (fleet.resolved || (fleet.status !== 'embargo' && fleet.status !== 'occupy')) continue;
      const durationSec = window.UniversumGalaxy?.getFleetSpeedAndFuel
        ? Math.max(5, window.UniversumGalaxy.getFleetSpeedAndFuel({ speed: realSpeed, researches: {} }, fleet.ships, window.UniversumGalaxy.calculateDistance(fleet.targetCoords, fleet.originCoords)).durationSec || 60)
        : 60;
      await d.ref.update({
        status: 'returning',
        phase: 'IN RITORNO',
        resolved: false,
        arrivalTime: now + durationSec * 1000,
        returnTime: now + durationSec * 1000,
        ...(pendingRansom ? { pendingRansom } : {})
      }).catch((e) => _mpNotifyError('rientro flotta assediante', e));
      transitioned = true;
    }
    return transitioned;
  }


  async function payOnlineSiegeRansom(uniId, targetCoords) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user) throw new Error('Utente non autenticato.');

    const uniRef = db.collection('online_universes').doc(uniId);
    const key = coordsToKey(targetCoords);
    const planetRef = uniRef.collection('planets').doc(key);
    let paidRansom = null;
    let siegeShipsForReturn = null;
    const uniSnapPay = await uniRef.get().catch(() => null);
    const paySpeed = uniSnapPay && uniSnapPay.exists ? (uniSnapPay.data().speed || 10) : 10;
    const prePlSnap = await planetRef.get().catch(() => null);
    const prePl = prePlSnap && prePlSnap.exists ? prePlSnap.data() : null;
    const preSiege = prePl ? (prePl.occupation || prePl.embargo) : null;
    const preAttackerUid = preSiege ? (prePl.occupation ? preSiege.occupierUid : preSiege.attackerUid) : null;
    const creditRef = preSiege && preAttackerUid
      ? await _resolveCreditRef(uniRef, preAttackerUid, preSiege.originCoords)
      : null;
    const fleetSnapPre = await uniRef.collection('fleets').where('targetKey', '==', key).get().catch(() => ({ docs: [] }));
    const hasSiegeFleet = fleetSnapPre.docs.some((d) => {
      const ff = normalizeOnlineFleet(d.data(), d.id);
      return !ff.resolved && (ff.status === 'embargo' || ff.status === 'occupy');
    });

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(planetRef);
      if (!snap.exists) throw new Error('Pianeta non trovato.');
      const pl = snap.data();
      if (pl.ownerUid !== user.uid) throw new Error('Non sei il proprietario di questo pianeta.');

      const siege = pl.occupation || pl.embargo;
      const isOcc = Boolean(pl.occupation);
      if (!siege) throw new Error('Nessun embargo o occupazione attiva su questo pianeta.');

      const ransom = siege.ransom || { metal: 0, crystal: 0, deuterium: 0 };
      const effPl = _effectivePlanetView(pl, paySpeed);
      if (
        (effPl.resources.metal || 0) < ransom.metal ||
        (effPl.resources.crystal || 0) < ransom.crystal ||
        (effPl.resources.deuterium || 0) < ransom.deuterium
      ) {
        throw new Error('Risorse insufficienti sul pianeta per pagare il riscatto.');
      }

      paidRansom = { ...ransom };
      siegeShipsForReturn = siege.garrisonShips || siege.ships || {};

      const FV = firebase.firestore.FieldValue;
      const payUpd = { embargo: null, occupation: null };
      if (ransom.metal) payUpd['inbox.resources.metal'] = FV.increment(-Math.round(ransom.metal));
      if (ransom.crystal) payUpd['inbox.resources.crystal'] = FV.increment(-Math.round(ransom.crystal));
      if (ransom.deuterium) payUpd['inbox.resources.deuterium'] = FV.increment(-Math.round(ransom.deuterium));
      tx.update(planetRef, payUpd);

      if (!hasSiegeFleet && creditRef) {
        _inboxCredit(tx, creditRef, {
          resources: ransom,
          fleet: siege.garrisonShips || siege.ships || {}
        });
      }

      const attackerUid = isOcc ? siege.occupierUid : siege.attackerUid;
      if (attackerUid) {
        const msgRef = uniRef.collection('messages').doc();
        tx.set(msgRef, {
          recipientUid: attackerUid,
          title: `Riscatto Pagato [${key}]`,
          body: `${pl.ownerName} ha pagato ${ransom.metal} M, ${ransom.crystal} C, ${ransom.deuterium} D. Le tue navi stanno rientrando.`,
          timestamp: Date.now()
        });
      }
    });

    if (paidRansom) {
      await _transitionSiegeFleetToReturning(uniRef, key, { pendingRansom: paidRansom });
    }
  }


  async function liftOnlineSiege(uniId, targetCoords) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user) throw new Error('Utente non autenticato.');

    const uniRef = db.collection('online_universes').doc(uniId);
    const key = coordsToKey(targetCoords);
    const planetRef = uniRef.collection('planets').doc(key);
    const prePlSnapL = await planetRef.get().catch(() => null);
    const prePlL = prePlSnapL && prePlSnapL.exists ? prePlSnapL.data() : null;
    const preSiegeL = prePlL
      ? ((prePlL.occupation && prePlL.occupation.occupierUid === user.uid) ? prePlL.occupation
        : ((prePlL.embargo && prePlL.embargo.attackerUid === user.uid) ? prePlL.embargo : null))
      : null;
    const creditRefL = preSiegeL ? await _resolveCreditRef(uniRef, user.uid, preSiegeL.originCoords) : null;
    const fleetSnapPre = await uniRef.collection('fleets').where('targetKey', '==', key).get().catch(() => ({ docs: [] }));
    const hasSiegeFleet = fleetSnapPre.docs.some((d) => {
      const ff = normalizeOnlineFleet(d.data(), d.id);
      return !ff.resolved && (ff.status === 'embargo' || ff.status === 'occupy');
    });

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(planetRef);
      if (!snap.exists) throw new Error('Pianeta non trovato.');
      const pl = snap.data();

      const isMyEmbargo = pl.embargo && pl.embargo.attackerUid === user.uid;
      const isMyOccupation = pl.occupation && pl.occupation.occupierUid === user.uid;
      if (!isMyEmbargo && !isMyOccupation) {
        throw new Error('Non hai assedi attivi su questo pianeta.');
      }

      const siege = isMyOccupation ? pl.occupation : pl.embargo;
      tx.update(planetRef, {
        embargo: isMyEmbargo ? null : pl.embargo,
        occupation: isMyOccupation ? null : pl.occupation
      });

      if (!hasSiegeFleet && creditRefL) {
        _inboxCredit(tx, creditRefL, { fleet: siege.garrisonShips || siege.ships || {} });
      }
    });

    await _transitionSiegeFleetToReturning(uniRef, key);
  }

  Object.assign(G, { repairStuckMissions, processAllOccupations, sweepOccupationsThrottled, processOnlineOccupations, _transitionSiegeFleetToReturning, payOnlineSiegeRansom, liftOnlineSiege });

})();
