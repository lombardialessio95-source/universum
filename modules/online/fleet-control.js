/** UNIVERSUM / modules/online/fleet-control.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumMPModules;
  const { FLEET_SCHEMA_VERSION, _ONLINE_SUPPORTED_MISSIONS, _mpErrorToastAt } = window.__UniversumMPVariables;
  // Bridge lazy per le funzioni definite negli altri moduli.
  const _inboxCredit = (...args) => G._inboxCredit(...args);
  const _resolveCreditRef = (...args) => G._resolveCreditRef(...args);
  const _tsToMs = (...args) => G._tsToMs(...args);
  const coordsToKey = (...args) => G.coordsToKey(...args);
  const getAuth = (...args) => G.getAuth(...args);
  const getDB = (...args) => G.getDB(...args);
  const normalizeOnlineFleet = (...args) => G.normalizeOnlineFleet(...args);
  const syncPlayerState = (...args) => G.syncPlayerState(...args);

  // I listener che alimentano radar e flotta sono anche la fonte per il resolver.
  // Non interrogare l'intera collezione fleets ogni tre secondi: dopo migliaia di
  // missioni completate quella query leggeva fino a 100 documenti inutili ogni tick.
  const _liveFleetDocs = new Map();
  function _fleetCacheKey(uniId, uid) { return `${uniId}|${uid}`; }
  function _updateLiveFleetDocs(uniId, uid, kind, docs) {
    const key = _fleetCacheKey(uniId, uid);
    const entry = _liveFleetDocs.get(key) || { own: null, incoming: null };
    entry[kind] = docs;
    entry.combined = entry.own && entry.incoming
      ? [...new Map([...entry.own, ...entry.incoming].map((doc) => [doc.id, doc])).values()]
      : null;
    _liveFleetDocs.set(key, entry);
  }
  function getLiveFleetDocs(uniId) {
    const uid = getAuth().currentUser?.uid;
    const entry = uid ? _liveFleetDocs.get(_fleetCacheKey(uniId, uid)) : null;
    // null = i listener non sono ancora inizializzati (o hanno dato errore).
    return entry?.combined ?? null;
  }
  function clearLiveFleetDocs(uniId, uid) {
    _liveFleetDocs.delete(_fleetCacheKey(uniId, uid));
  }



  async function launchOnlineFleet(universeObj, originPlanetIndex, targetCoords, mission, shipsSelected, cargo = {}, options = {}) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user) throw new Error('Utente non autenticato.');

    const planet = universeObj.planets[originPlanetIndex];
    if (!planet) throw new Error('Pianeta di partenza non valido.');

    const normalizedMission = mission === 'explore' ? 'expedition' : mission;

    const originKey = coordsToKey(planet.coords);
    const uniRef = db.collection('online_universes').doc(universeObj.id);
    const freshOriginSnap = await uniRef.collection('planets').doc(originKey).get();
    if (freshOriginSnap.exists) {
      const freshOrigin = freshOriginSnap.data();
      if (freshOrigin.embargo && freshOrigin.embargo.attackerUid !== user.uid) {
        throw new Error(`Impossibile lanciare flotte: pianeta sotto embargo da ${freshOrigin.embargo.attackerName}!`);
      }
      if (freshOrigin.occupation && freshOrigin.occupation.occupierUid !== user.uid) {
        throw new Error(`Impossibile lanciare flotte: pianeta occupato da ${freshOrigin.occupation.occupierName}!`);
      }
    }

    const MCore = window.UniversumMissionsCore;
    const maxSlots = MCore ? MCore.getMaxFleetSlots(universeObj) : (5 + Number(universeObj.researches?.computerTech || 0));
    const activeCount = (universeObj.fleetsInFlight || []).filter((f) => !f.resolved).length;
    if (activeCount >= maxSlots) {
      throw new Error(`Slot flotta esauriti (${activeCount}/${maxSlots}). Potenzia Tecnologia Informatica.`);
    }

    const cleanShips = {};
    let totalShips = 0;
    for (const [sId, count] of Object.entries(shipsSelected || {})) {
      const qty = Math.max(0, Math.floor(Number(count) || 0));
      if (qty > 0 && sId !== 'solarSatellite') {
        if ((planet.fleet[sId] || 0) < qty) {
          throw new Error(`Navi insufficienti (${sId}).`);
        }
        cleanShips[sId] = qty;
        totalShips += qty;
      }
    }
    if (totalShips === 0) throw new Error('Seleziona almeno una nave.');
    const H=window.UniversumHangars;
    const carrierHangars=cleanShips.mothership && H ?
      H.select(planet,cleanShips.mothership,options.carrierIds || null,normalizedMission === 'incursion') : [];
    if (normalizedMission === 'incursion') H.validateMission(cleanShips,carrierHangars);
    if (normalizedMission === 'colonize' && !cleanShips.colonyShip) {
      throw new Error('Devi includere almeno una Colonizzatrice per fondare una colonia.');
    }
    if (normalizedMission === 'spy' && !cleanShips.espionageProbe) {
      throw new Error('Devi includere almeno una Sonda Spia.');
    }

    const speedPct = Math.min(100, Math.max(10, Number(options.fuelPercent || options.speedPct) || 100));
    const expeditionHours = Math.min(MCore?.getMaxExploreHours(universeObj) || 1,
      Math.max(1, Math.floor(Number(options.exploreHours || options.expeditionHours) || 1)));
    const dist = window.UniversumGalaxy.calculateDistance(planet.coords, targetCoords);
    const flightStats = window.UniversumGalaxy.getFleetSpeedAndFuel(universeObj, cleanShips, dist, speedPct);

    const cargoM = Math.max(0, Math.floor(Number(cargo.metal) || 0));
    const cargoC = Math.max(0, Math.floor(Number(cargo.crystal) || 0));
    const cargoD = Math.max(0, Math.floor(Number(cargo.deuterium) || 0));
    const blackHoleExtra = (normalizedMission === 'expedition' && options.blackHole) ? 50000 : 0;

    if (planet.resources.metal < cargoM || planet.resources.crystal < cargoC || planet.resources.deuterium < cargoD + flightStats.fuelCost + blackHoleExtra) {
      throw new Error('Risorse o Deuterio per il carburante insufficienti.');
    }

    const specialist = window.UniversumServices?.transfer(universeObj,normalizedMission,targetCoords,cleanShips);
    if (specialist) {
      const capacity = Object.entries(cleanShips).reduce((n,[id,q])=>n + q*(window.UniversumData.SHIPS[id]?.cargo || 0),0);
      if (cargoM+cargoC+cargoD > Math.max(0,capacity-flightStats.fuelCost)) throw Error('Capacità della stiva superata.');
    }
    const targetKey = coordsToKey(targetCoords);
    if (specialist && originKey === targetKey) throw Error('Scegli una colonia di destinazione diversa.');
    const targetSnap = await uniRef.collection('planets').doc(targetKey).get();
    if (normalizedMission === 'incursion' && (!targetSnap.exists ||
        (!targetSnap.data().ownerUid && !targetSnap.data().isNpc) || targetSnap.data().ownerUid === user.uid)) {
      throw new Error('Incursione consentita solo su un pianeta nemico valido.');
    }
    if (normalizedMission === 'colonize' && targetSnap.exists) {
      throw new Error(`Lo slot [${targetCoords.g}:${targetCoords.s}:${targetCoords.p}] è già occupato!`);
    }

    if (!specialist && !carrierHangars.length) {
      for (const [sId, qty] of Object.entries(cleanShips)) {
        planet.fleet[sId] -= qty;
      }
      planet.resources.metal -= cargoM;
      planet.resources.crystal -= cargoC;
      planet.resources.deuterium -= (cargoD + flightStats.fuelCost + blackHoleExtra);

      await syncPlayerState(universeObj, { force: true });
    }

    const defenderUid = targetSnap.exists ? (targetSnap.data().ownerUid || null) : null;
    if (carrierHangars.length) {
      const cap=Object.entries(cleanShips).reduce((s,[id,n])=>s+n*(window.UniversumData.SHIPS[id]?.cargo || 0),0);
      if (cargoM+cargoC+cargoD+flightStats.fuelCost > cap) throw Error('Stiva Nave Madre insufficiente per carico e carburante.');
    }

    const now = Date.now();
    const holdDurationSec = normalizedMission === 'expedition'
      ? MCore.getExplorationHoldDurationSec(universeObj, expeditionHours)
      : 0;
    const timeline = normalizedMission === 'expedition'
      ? MCore.buildExplorationTimeline(now, flightStats.durationSec, holdDurationSec)
      : null;
    const arrivalTime = timeline ? timeline.arrivalTime : now + flightStats.durationSec * 1000;
    const returnTime = timeline ? timeline.returnTime : arrivalTime + flightStats.durationSec * 1000;

    const ransom = options.ransom ? {
      metal: Math.max(0, Math.floor(Number(options.ransom.metal) || 0)),
      crystal: Math.max(0, Math.floor(Number(options.ransom.crystal) || 0)),
      deuterium: Math.max(0, Math.floor(Number(options.ransom.deuterium) || 0))
    } : { metal: 50000, crystal: 25000, deuterium: 10000 };

    const serverTs = (typeof firebase !== 'undefined' && firebase.firestore?.FieldValue?.serverTimestamp)
      ? firebase.firestore.FieldValue.serverTimestamp() : null;
    const fleetDoc = {
      schemaVersion: FLEET_SCHEMA_VERSION,
      phase: 'IN VIAGGIO',
      departureAt: serverTs,
      attackerUid: user.uid,
      attackerName: universeObj.emperor || user.displayName || 'Comandante',
      attackerTech: {
        weaponsTech: universeObj.researches?.weaponsTech || 0,
        shieldingTech: universeObj.researches?.shieldingTech || 0,
        armourTech: universeObj.researches?.armourTech || 0,
        expeditionTech: universeObj.researches?.expeditionTech || 0,
        espionageTech: universeObj.researches?.espionageTech || 0
      },
      defenderUid,
      originCoords: Object.assign({}, planet.coords),
      originKey,
      targetCoords: { g: Number(targetCoords.g), s: Number(targetCoords.s), p: Number(targetCoords.p) },
      targetKey,
      mission: normalizedMission,
      speedPct,
      expeditionHours,
      ransom,
      ships: cleanShips,
      carrierHangars,
      cargo: { metal: cargoM, crystal: cargoC, deuterium: cargoD },
      blackHole: Boolean(options.blackHole),
      status: 'outbound',
      departureTime: now,
      arrivalTime,
      returnTime,
      ...(timeline || {}),
      resolved: false
    };

    let ref;
    if (specialist || carrierHangars.length) {
      ref = uniRef.collection('fleets').doc();
      await syncPlayerState(universeObj,{force:true,dispatch:{ref,doc:fleetDoc,
        carrierHangars,specialist:Boolean(specialist),
        debit:{metal:cargoM,crystal:cargoC,deuterium:cargoD+flightStats.fuelCost}}});
    } else ref = await uniRef.collection('fleets').add(fleetDoc);
    fleetDoc.id = ref.id;

    try {
      const savedSnap = await ref.get();
      const serverDepartureMs = _tsToMs(savedSnap.exists ? savedSnap.data()?.departureAt : null);
      if (serverDepartureMs > 0) {
        const durationMs = arrivalTime - now;
        const returnDurationMs = returnTime - arrivalTime;
        fleetDoc.departureTime = serverDepartureMs;
        if (timeline) {
          Object.assign(fleetDoc, MCore.buildExplorationTimeline(
            serverDepartureMs, flightStats.durationSec, holdDurationSec));
        } else {
          fleetDoc.arrivalTime = serverDepartureMs + durationMs;
          fleetDoc.returnTime = fleetDoc.arrivalTime + returnDurationMs;
        }
        await ref.update({
          departureTime: fleetDoc.departureTime,
          arrivalTime: fleetDoc.arrivalTime,
          returnTime: fleetDoc.returnTime,
          ...(timeline ? {
            zoneArrivalTime: fleetDoc.zoneArrivalTime,
            explorationEndTime: fleetDoc.explorationEndTime
          } : {})
        });
      }
    } catch (e) { /* fallback ai tempi gia' salvati */ }

    if (!universeObj.fleetsInFlight.some(f=>f.id===ref.id)) universeObj.fleetsInFlight.push(fleetDoc);

    return fleetDoc;
  }


  async function recallOnlineFleet(universeObj, fleetId) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !universeObj?.id) throw new Error('Utente non autenticato.');

    const uniRef = db.collection('online_universes').doc(universeObj.id);
    const fleetRef = uniRef.collection('fleets').doc(fleetId);
    let newArrival = 0;

    // Una sola transazione: due schede non possono richiamare due volte la
    // stessa missione o sostituire reciprocamente i timestamp di ritorno.
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(fleetRef);
      if (!snap.exists) throw new Error('Flotta non trovata.');
      const fleet = snap.data();
      if (fleet.attackerUid !== user.uid) throw new Error('Non puoi richiamare una flotta non tua.');
      if (fleet.resolved || fleet.status !== 'outbound') {
        throw new Error('La flotta sta già rientrando o ha completato la missione.');
      }
      const now = Date.now();
      const MCore = window.UniversumMissionsCore;
      const durationMs = MCore
        ? MCore.getRecallDurationMs(fleet, now)
        : Math.max(2000, now - Number(fleet.departureTime || now));
      newArrival = now + durationMs;
      tx.update(fleetRef, {
        status: 'returning',
        phase: 'IN RITORNO',
        mission: 'recall',
        arrivalTime: newArrival,
        returnTime: newArrival
      });
    });

    const local = (universeObj.fleetsInFlight || []).find((f) => f.id === fleetId);
    if (local) {
      local.status = 'returning';
      local.phase = 'IN RITORNO';
      local.mission = 'recall';
      local.recalled = true;
      local.returnStartTime = Date.now();
      local.arrivalTime = newArrival;
      local.returnTime = newArrival;
    }
  }

  function _mpNotifyError(context, err) {
    console.warn(`[MP] Errore (${context}):`, err);
    const code = String(err?.code || '');
    let msg = null;
    if (code === 'permission-denied') {
      msg = "Il server ha rifiutato un'operazione (permessi insufficienti).";
    } else if (code === 'failed-precondition') {
      msg = 'Indice Firestore mancante per il radar/flotte. Controlla la console Firebase.';
    } else if (code === 'unavailable' || code === 'deadline-exceeded') {
      msg = 'Connessione al server instabile: alcune operazioni verranno riprovate.';
    }
    if (!msg) return;
    const last = _mpErrorToastAt.get(code) || 0;
    if (Date.now() - last < 30000) return;
    _mpErrorToastAt.set(code, Date.now());
    window.UniversumUI?.toast?.(msg, 'error');
  }


  function listenOwnFleets(universeObj, callback) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !universeObj?.id) return () => {};

    const uniId = universeObj.id;
    const unsubscribe = db.collection('online_universes').doc(uniId).collection('fleets')
      .where('attackerUid', '==', user.uid)
      .where('status', 'in', ['outbound', 'returning', 'embargo', 'occupy'])
      .onSnapshot((snap) => {
        _updateLiveFleetDocs(uniId, user.uid, 'own', snap.docs);
        const list = snap.docs
          .map((d) => normalizeOnlineFleet(d.data(), d.id))
          .filter((f) => !f.resolved);
        callback(list);
      }, (err) => {
        clearLiveFleetDocs(uniId, user.uid);
        _mpNotifyError('listener flotte proprie', err);
      });
    return () => { unsubscribe(); clearLiveFleetDocs(uniId, user.uid); };
  }


  function listenIncomingFleets(universeObj, callback) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !universeObj?.id) return () => {};

    const hostileMissions = new Set(['attack', 'spy', 'destroyMoon', 'blockade', 'embargo', 'occupy']);

    const uniId = universeObj.id;
    const unsubscribe = db.collection('online_universes').doc(uniId).collection('fleets')
      .where('defenderUid', '==', user.uid)
      .where('status', 'in', ['outbound', 'returning', 'embargo', 'occupy'])
      .onSnapshot((snap) => {
        _updateLiveFleetDocs(uniId, user.uid, 'incoming', snap.docs);
        const list = snap.docs
          .map((d) => Object.assign({ id: d.id }, d.data()))
          .filter((f) => f.status === 'outbound' && f.attackerUid !== user.uid && hostileMissions.has(f.mission));
        callback(list);
      }, (err) => {
        clearLiveFleetDocs(uniId, user.uid);
        _mpNotifyError('listener flotte in arrivo', err);
      });
    return () => { unsubscribe(); clearLiveFleetDocs(uniId, user.uid); };
  }


  function _cleanupReasonText(fleet, reason) {
    const r = String(reason || '');
    let why;
    if (r === 'repair-button') {
      why = 'Riparazione manuale richiesta dal comandante.';
    } else if (r === 'missing-route') {
      why = 'Dati di rotta mancanti o non validi.';
    } else if (fleet && fleet.mission && !_ONLINE_SUPPORTED_MISSIONS.has(fleet.mission)) {
      why = `La missione "${fleet.mission}" non è supportata in modalità online.`;
    } else {
      why = 'Errore temporaneo durante la risoluzione (missione ferma da oltre 60 secondi).';
    }
    return `${why} Missione annullata: flotta e carico restituiti al pianeta di partenza.`;
  }


  async function forceCleanupOnlineFleet(uniRef, fleet, fleetRef, reason) {
    const db = getDB();
    const now = Date.now();
    const creditRef = await _resolveCreditRef(uniRef, fleet.attackerUid, fleet.originCoords);
    try {
      await db.runTransaction(async (tx) => {
        const freshSnap = await tx.get(fleetRef);
        if (!freshSnap.exists || freshSnap.data().resolved) return;
        const fresh = freshSnap.data();
        let previous;
        if (window.UniversumServices?.ids.some(id=>fresh.ships?.[id])) {
          const home = creditRef && (await tx.get(creditRef)).data();
          if (home?.ownerUid !== fresh.attackerUid) throw Error('Colonia di rientro non disponibile.');
          previous = home.inbox?.serviceEvents;
        }
        _inboxCredit(tx, creditRef, {resources:fresh.cargo || {},fleet:fresh.ships || {}},previous);
        tx.update(fleetRef, {
          status: 'completed', phase: 'COMPLETATA', resolved: true,
          completedAt: now, repaired: true, repairReason: String(reason || 'orphan')
        });
        if (fleet.attackerUid) {
          const msgRef = uniRef.collection('messages').doc();
          tx.set(msgRef, {
            recipientUid: fleet.attackerUid,
            title: `Missione riparata [${fleet.targetKey || 'sconosciuta'}]`,
            body: _cleanupReasonText(fleet, reason),
            timestamp: now
          });
        }
      });
      return true;
    } catch (e) {
      if (!window.UniversumServices?.ids.some(id=>fleet.ships?.[id])) {
        await fleetRef.update({ status: 'completed', phase: 'COMPLETATA', resolved: true, completedAt: now, repaired: true }).catch((e) => _mpNotifyError('chiusura forzata flotta', e));
      }
      return false;
    }
  }


  // P1 FIX: accetta parametro opzionale `speed` per evitare letture extra quando già disponibile
  async function processEmbargoFleets(uniRef, fleetDocs, now, speed = null) {
    const Data = window.UniversumData;
    // P1 FIX: se non passata, leggi la velocità reale una volta sola
    let realSpeed = speed;
    if (!realSpeed) {
      const uniSnap = await uniRef.get().catch(() => null);
      realSpeed = uniSnap && uniSnap.exists ? (uniSnap.data().speed || 10) : 10;
    }
    for (const fDoc of fleetDocs) {
      const fleet = normalizeOnlineFleet(fDoc.data(), fDoc.id);
      if (fleet.status !== 'embargo' || fleet.resolved) continue;
      try {
        const elapsedSec = Math.max(0, (now - Number(fleet.lastSiegeTickAt || now)) / 1000);
        if (elapsedSec < 1) continue;
        let hourlyBurn = 0;
        for (const [sid, qty] of Object.entries(fleet.ships || {})) {
          hourlyBurn += Data.getShipFuelConsumption(sid) * Number(qty || 0);
        }
        hourlyBurn = Math.max(40, hourlyBurn);
        let remaining = Math.max(0, Number(fleet.siegeDeuterium || 0) - (hourlyBurn / 3600) * elapsedSec);
        // Il tempo avanza matematicamente anche senza scrivere ogni 3 secondi.
        // Quando il carburante termina la transizione avviene al prossimo tick.
        if (remaining > 0 && elapsedSec < 30) continue;
        const targetRef = uniRef.collection('planets').doc(fleet.targetKey);
        if (remaining > 0) {
          await fDoc.ref.update({ siegeDeuterium: remaining, lastSiegeTickAt: now });
          await targetRef.update({ 'embargo.deuterium': remaining }).catch((e) => _mpNotifyError('tick deuterio embargo', e));
        } else {
          // P1 FIX: usa la velocità reale dell'universo (era hardcoded 10)
          const durationSec = window.UniversumGalaxy?.getFleetSpeedAndFuel
            ? Math.max(5, window.UniversumGalaxy.getFleetSpeedAndFuel({ speed: realSpeed, researches: {} }, fleet.ships, window.UniversumGalaxy.calculateDistance(fleet.targetCoords, fleet.originCoords)).durationSec || 60)
            : 60;
          await targetRef.update({ embargo: null }).catch((e) => _mpNotifyError('fine embargo', e));
          await fDoc.ref.update({
            status: 'returning', phase: 'IN RITORNO', siegeDeuterium: 0, lastSiegeTickAt: now,
            arrivalTime: now + durationSec * 1000, returnTime: now + durationSec * 1000
          });
          if (fleet.attackerUid) {
            await uniRef.collection('messages').add({
              recipientUid: fleet.attackerUid,
              title: `Embargo terminato [${fleet.targetKey}]`,
              body: 'Deuterio nella stiva esaurito: la flotta embargo sta rientrando automaticamente alla base.',
              timestamp: now
            }).catch(() => {});
          }
          if (fleet.defenderUid) {
            await uniRef.collection('messages').add({
              recipientUid: fleet.defenderUid,
              title: `Embargo terminato [${fleet.targetKey}]`,
              body: 'Il Deuterio della flotta embargo si e esaurito: le rotte del pianeta sono di nuovo libere.',
              timestamp: now
            }).catch(() => {});
          }
        }
      } catch (e) { /* il prossimo tick riprova; mai bloccare le altre missioni */ }
    }
  }

  Object.assign(G, { launchOnlineFleet, recallOnlineFleet, _mpNotifyError, listenOwnFleets, listenIncomingFleets, getLiveFleetDocs, clearLiveFleetDocs, _cleanupReasonText, forceCleanupOnlineFleet, processEmbargoFleets });

})();
