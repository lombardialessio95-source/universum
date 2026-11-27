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



  // AT05-I04: solo memoria della pagina, distinta per account e universo.
  const ordinaryDepartures = new Map();
  const retiredDepartureStates = new WeakSet();
  const departureKey = (u,uid=getAuth().currentUser?.uid) => JSON.stringify([uid,u?.id]);
  function pendingOrdinaryDeparture(u) {
    return ordinaryDepartures.get(departureKey(u));
  }
  function ordinaryDepartureStatus(u) {
    const p=pendingOrdinaryDeparture(u);
    return p ? {id:p.ref?.id || null, busy:p.busy, confirmed:p.confirmed} : null;
  }
  function pendingDepartureError(p) {
    return Object.assign(Error(p?.confirmed
      ? 'Partenza confermata; riallineamento non completato. Verifica prima di inviare ancora.'
      : 'Esito della partenza in verifica. Non ripetere l\'invio.'),{code:'ordinary-departure-pending',fleetId:p?.ref?.id,confirmed:!!p?.confirmed});
  }
  function ordinaryCheckpointBlocked(u,dispatch) {
    if (retiredDepartureStates.has(u)) return true;
    const p=pendingOrdinaryDeparture(u);
    return !!p && dispatch?.outcome!==p.outcome;
  }
  function reserveOrdinaryDeparture(u,uid) {
    const key=departureKey(u,uid);
    if (ordinaryDepartures.has(key)) throw pendingDepartureError(ordinaryDepartures.get(key));
    const p={key,uid,universe:u,busy:true,confirmed:false,outcome:{}};
    ordinaryDepartures.set(key,p);
    return p;
  }
  function clearOrdinaryDeparture(p) {
    if (ordinaryDepartures.get(p.key)===p) ordinaryDepartures.delete(p.key);
  }
  async function reconcileOrdinaryDeparture(p) {
    // Solo una lettura esplicita per azione; mai un nuovo dispatch.
    try {
      if (getAuth().currentUser?.uid!==p.uid) throw pendingDepartureError(p);
      const snap=await p.ref.get({source:'server'});
      if (snap.metadata?.fromCache || snap.metadata?.hasPendingWrites) throw pendingDepartureError(p);
      if (snap.exists) {
        const d=snap.data();
        if (snap.id!==p.ref.id || d.attackerUid!==p.uid || d.originKey!==p.doc.originKey) throw pendingDepartureError(p);
        p.confirmed=true;
        p.saved={...d,id:p.ref.id};
      }
      // L'assenza non dimostra l'annullamento. Se il commit era già
      // confermato dall'SDK, è comunque possibile riallineare la partita.
      if (!p.confirmed) throw pendingDepartureError(p);
      const ui=window.UniversumUI;
      const active=ui?.state?.currentUniverse;
      if (!active || active.id!==p.universe.id || !ui.state.isMultiplayerMode) throw pendingDepartureError(p);
      const fresh=await G.joinOnlineUniverse(p.universe.id,p.universe.roomPasscode,{serverOnly:true});
      if (getAuth().currentUser?.uid!==p.uid || ui.state.currentUniverse!==active ||
          !Number.isSafeInteger(fresh.serviceRevision) || fresh.serviceRevision<=(p.outcome.expectedRevision ?? p.expectedRevision)) throw pendingDepartureError(p);
      // Non salvare lo stato vecchio. Le sincronizzazioni già accodate
      // su questi oggetti non devono ripartire quando rimuoviamo il blocco.
      retiredDepartureStates.add(p.universe);
      retiredDepartureStates.add(active);
      ui.startOnlineGame(fresh);
      clearOrdinaryDeparture(p);
      return p.saved || {...p.doc,id:p.ref.id};
    } catch (error) {
      throw pendingDepartureError(p);
    } finally { p.busy=false; }
  }
  async function verifyOrdinaryDeparture(u) {
    const p=pendingOrdinaryDeparture(u);
    if (!p) throw Error('Nessuna partenza in verifica.');
    if (p.busy || !p.ref) throw pendingDepartureError(p);
    p.busy=true;
    return reconcileOrdinaryDeparture(p);
  }
  async function launchOnlineFleet(universeObj, originPlanetIndex, targetCoords, mission, shipsSelected, cargo = {}, options = {}) {
    const uid=getAuth().currentUser?.uid;
    const existing=pendingOrdinaryDeparture(universeObj);
    if (existing || retiredDepartureStates.has(universeObj)) throw pendingDepartureError(existing);
    // Riserva prima del primo await per impedire il doppio clic ordinario.
    const selected=id=>Math.floor(Number(shipsSelected?.[id]) || 0)>0;
    const likelyOrdinary=mission!=='destroyGalattica' && !selected('invictus') && !selected('crepuscolo') &&
      !(selected('mothership') && window.UniversumHangars) &&
      !window.UniversumServices?.ids?.some(selected);
    let request=uid && likelyOrdinary ? reserveOrdinaryDeparture(universeObj,uid) : null;
    try {
      return await launchOnlineFleetImpl(universeObj,originPlanetIndex,targetCoords,mission,shipsSelected,cargo,options,request);
    } finally {
      // Un errore di validazione prima della generazione del documento
      // non è una partenza incerta.
      if (request && !request.ref) {
        request.busy=false;
        clearOrdinaryDeparture(request);
      }
    }
  }

  async function launchOnlineFleetImpl(universeObj, originPlanetIndex, targetCoords, mission, shipsSelected, cargo, options, request) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user) throw new Error('Utente non autenticato.');

    const planet = universeObj.planets[originPlanetIndex];
    if (!planet) throw new Error('Pianeta di partenza non valido.');

    const targeted = mission === 'destroyGalattica';
    const normalizedMission = targeted ? 'destroyMoon' : mission === 'explore' ? 'expedition' : mission;

    const originKey = coordsToKey(planet.coords);
    const uniRef = db.collection('online_universes').doc(universeObj.id);
    let selected = null;
    if (targeted) {
      if (!options.targetGalatticaId || !Number(shipsSelected?.deathStar)) throw new Error('Seleziona una Galattica e una Morte Nera.');
      selected = await G.galatticaMarkers(universeObj.id).doc(options.targetGalatticaId).get();
      if (!selected.exists || selected.data().ownerUid === user.uid || !G.atGalatticaTarget(selected, {
        targetGalatticaId: selected.id, targetKey: coordsToKey(targetCoords), defenderUid: selected.data().ownerUid
      })) throw new Error('Galattica non più disponibile alle coordinate.');
    }
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
        const available=sId==='invictus' ? planet.bacinoSpaziale?.invictusActive || 0 :
          sId==='crepuscolo' ? Number(planet.bacinoSpaziale?.crepuscolo?.status==='active') : planet.fleet[sId] || 0;
        if (available < qty) {
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

    const dockDispatch=Boolean(cleanShips.invictus || cleanShips.crepuscolo);
    if (cleanShips.invictus) {
      if (+planet.coords.g!==+targetCoords.g) throw Error('Invictus: salto tra galassie vietato.');
      flightStats.fuelCost+=window.UniversumGalaxy.getInvictusJumpCost(planet.coords,targetCoords,cleanShips.invictus);
    }
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

    const defenderUid = targeted ? selected.data().ownerUid : targetSnap.exists ? (targetSnap.data().ownerUid || null) : null;
    if (dockDispatch || carrierHangars.length) {
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
      ...(targeted ? {targetGalatticaId:selected.id} : {}),
      ...(dockDispatch ? {originPlanetId:planet.id,birthBacinoAt:planet.bacinoSpaziale.startedAt ?? null} : {}),
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

    const ordinary = !(targeted || dockDispatch || specialist || carrierHangars.length);
    if (ordinary && !request) request=reserveOrdinaryDeparture(universeObj,user.uid);
    if (!ordinary && request) { request.busy=false; clearOrdinaryDeparture(request); request=null; }
    try {
      const ref = uniRef.collection('fleets').doc();
      const dispatch={ref,doc:fleetDoc,ordinary,carrierHangars,specialist:Boolean(specialist),
        debit:{metal:cargoM,crystal:cargoC,deuterium:cargoD+flightStats.fuelCost+blackHoleExtra}};
      if (ordinary) {
        request.ref=ref;
        request.doc=fleetDoc;
        request.expectedRevision=universeObj.serviceRevision;
        dispatch.outcome=request.outcome;
      }
      const committed=await syncPlayerState(universeObj,{force:true,dispatch});
      if (ordinary) {
        if (committed!==true) throw Error('Partenza non confermata.');
        // AT05-I04A: conserva la conferma prima di ogni finalizzazione locale.
        request.confirmed=true;
      }
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
      if (ordinary) clearOrdinaryDeparture(request);

      return fleetDoc;
    } catch (error) {
      if (!ordinary) throw error;
      const o=request.outcome;
      request.confirmed=request.confirmed || !!o.committed;
      if (!request.confirmed && (!o.mayHaveCommitted || o.definiteFailure)) {
        clearOrdinaryDeparture(request);
        throw error;
      }
      // Copre anche le eccezioni dopo il commit, fino alla registrazione
      // locale. Conserva l'ID e non ripete mai l'addebito.
      return await reconcileOrdinaryDeparture(request);
    } finally {
      if (ordinary) request.busy=false;
    }
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
    if (fleet.targetGalatticaId || fleet.originGalatticaKey || fleet.birthBacinoAt!==undefined || fleet.carrierHangars?.length) return false;
    const db = getDB();
    const now = Date.now();
    const creditRef = await _resolveCreditRef(uniRef, fleet.attackerUid, fleet.originCoords);
    // AT02: nessuna chiusura se manca una destinazione valida per la consegna.
    // _inboxCredit ignora un ref nullo: qui va impedita la chiusura silenziosa.
    if (!creditRef) return false;
    try {
      await db.runTransaction(async (tx) => {
        const freshSnap = await tx.get(fleetRef);
        if (!freshSnap.exists || freshSnap.data().resolved) return;
        const fresh = freshSnap.data();
        const homeSnap = await tx.get(creditRef);
        if (!homeSnap.exists || homeSnap.data().ownerUid !== fresh.attackerUid) {
          throw Error('Colonia di rientro non disponibile.');
        }
        const previous = window.UniversumServices?.ids.some(id=>fresh.ships?.[id])
          ? homeSnap.data().inbox?.serviceEvents : undefined;
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
      // La transazione è atomica: se l'accredito fallisce, la flotta e
      // tutto il suo carico devono rimanere persistiti per un nuovo tentativo.
      _mpNotifyError('accredito rientro flotta rinviato', e);
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

  Object.assign(G, { launchOnlineFleet, ordinaryDepartureStatus, verifyOrdinaryDeparture, ordinaryCheckpointBlocked, recallOnlineFleet, _mpNotifyError, listenOwnFleets, listenIncomingFleets, getLiveFleetDocs, clearLiveFleetDocs, _cleanupReasonText, forceCleanupOnlineFleet, processEmbargoFleets });

})();
