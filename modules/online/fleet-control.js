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



  // AT05-I05: richiesta persistente e ricevuta terminale a spazio costante.
  const ordinaryDepartures = new Map();
  const ordinaryRecoveries = new Set();
  const ordinaryMutations = new Map();
  const ordinaryAdmissions = new Map();
  const acknowledgedReceipts = new Map();
  const retiredDepartureStates = new WeakSet();
  const recoveryEpochs = new Map();
  const departureKey = (u,uid=getAuth().currentUser?.uid) =>
    'universum:ordinary-departure:v1:'+JSON.stringify([uid,u.id]);
  const terminalStatuses=new Set(['committed','cancelled']);
  function pendingDepartureError(p) {
    return Object.assign(Error('Partenza in verifica. Non ripetere l’invio.'),
      {code:'ordinary-departure-pending',fleetId:p?.operationId || null});
  }
  function storageError(cause) {
    return Object.assign(Error('Memoria locale indisponibile: impossibile garantire una partenza sicura.'),
      {code:'ordinary-departure-storage',cause});
  }
  const validRevision=n=>Number.isSafeInteger(n) && n>=0 && n<Number.MAX_SAFE_INTEGER;
  function readStoredDeparture(u,uid) {
    const key=departureKey(u,uid);
    try {
      const raw=window.localStorage.getItem(key);
      const active=ordinaryDepartures.get(key);
      if (raw===null) return active ? {...active.record,missing:true} : null;
      const record=JSON.parse(raw);
      if (!record || record.accountUid!==uid || record.universeId!==u.id ||
          typeof record.operationId!=='string' || !record.operationId || record.operationId.includes('/') ||
          typeof record.originKey!=='string' || !record.originKey ||
          !(record.expectedRevision===null || validRevision(record.expectedRevision)) ||
          !['pending','settled'].includes(record.status) ||
          (record.status==='settled' && (!terminalStatuses.has(record.terminalStatus) ||
            !(record.terminalRevision===null || Number.isSafeInteger(record.terminalRevision))))) throw Error('Richiesta persistente non valida.');
      // Una scrittura locale parzialmente riuscita non libera la sessione attiva.
      if (active && record.status==='settled') return {...active.record,missing:true};
      return record;
    } catch (error) { throw storageError(error); }
  }
  function readOrdinaryDeparture(u,uid) {
    const record=readStoredDeparture(u,uid);
    return record?.status==='pending' ? record : null;
  }
  function ordinaryDepartureStatus(u,uid=getAuth().currentUser?.uid) {
    if (!u?.id || !uid) return null;
    return readOrdinaryDeparture(u,uid) || (ordinaryAdmissions.has(departureKey(u,uid)) ? {accountUid:uid,universeId:u.id,admissionOnly:true} : null);
  }
  function ordinaryDepartureBusy(u,uid=getAuth().currentUser?.uid) {
    if (!u?.id || !uid) return false;
    const key=departureKey(u,uid);
    return ordinaryRecoveries.has(key) || ordinaryAdmissions.has(key) || Boolean(ordinaryDepartures.get(key)?.busy);
  }
  function ordinaryDepartureInitialBusy(u,uid=getAuth().currentUser?.uid) {
    return Boolean(u?.id && uid && (ordinaryAdmissions.has(departureKey(u,uid)) || ordinaryDepartures.get(departureKey(u,uid))?.busy));
  }
  function notifyOrdinaryDepartureChanged(u) {
    try { window.UniversumUI?.onOrdinaryDepartureChanged?.(u); }
    catch (error) { console.warn('[AT05] Aggiornamento pannello:',error); }
  }
  function beginOrdinaryMutation(u,uid=getAuth().currentUser?.uid) {
    if (!u?.id || !uid || getAuth().currentUser?.uid!==uid) throw Error('Account non attivo.');
    assertOrdinaryMutationAllowed(u,uid);
    const key=departureKey(u,uid);
    ordinaryMutations.set(key,(ordinaryMutations.get(key)||0)+1);
    let released=false;
    return ()=>{
      if (released) return;
      released=true;
      const count=ordinaryMutations.get(key)||0;
      if (count<=1) ordinaryMutations.delete(key);
      else ordinaryMutations.set(key,count-1);
    };
  }
  // AT05: protezione delle API volontarie che non passano dal checkpoint.
  function ordinaryMutationGuard(u,uid=getAuth().currentUser?.uid) {
    const release=beginOrdinaryMutation(u,uid);
    const epoch=ordinaryRecoveryEpoch(u,uid);
    const active=window.UniversumUI?.state?.currentUniverse;
    return {release,check(){
      if (getAuth().currentUser?.uid!==uid || ordinaryRecoveryEpoch(u,uid)!==epoch ||
          window.UniversumUI?.state?.currentUniverse!==active) throw pendingDepartureError(null);
      assertOrdinaryMutationAllowed(u,uid);
    }};
  }
  function ordinaryRecoveryEpoch(u,uid=getAuth().currentUser?.uid) {
    return u?.id && uid ? recoveryEpochs.get(departureKey(u,uid)) || 0 : 0;
  }
  function ordinaryCheckpointBlocked(u,dispatch,uid=getAuth().currentUser?.uid,admission=null) {
    if (!u?.id || !uid) return false;
    if (retiredDepartureStates.has(u)) return true;
    try {
      const p=readOrdinaryDeparture(u,uid);
      if (!p) return ordinaryAdmissions.has(departureKey(u,uid)) && ordinaryAdmissions.get(departureKey(u,uid))!==admission;
      const active=ordinaryDepartures.get(departureKey(u,uid));
      return !(active && dispatch?.ordinary && dispatch===active.dispatch &&
        active.universe===u && !p.missing && JSON.stringify(p)===JSON.stringify(active.record));
    } catch (error) { return true; }
  }
  function assertOrdinaryMutationAllowed(u,uid=getAuth().currentUser?.uid,admission=null) {
    if (ordinaryCheckpointBlocked(u,null,uid,admission)) throw pendingDepartureError(ordinaryDepartureStatus(u,uid));
  }
  function writeDeparture(key,record) {
    try {
      const raw=JSON.stringify(record);
      window.localStorage.setItem(key,raw);
      if (window.localStorage.getItem(key)!==raw) throw Error('Scrittura locale non verificata.');
    } catch (error) { throw storageError(error); }
  }
  function assertDepartureRecord(request) {
    if (window.localStorage.getItem(request.key)!==JSON.stringify(request.record)) throw pendingDepartureError(request.record);
  }
  function reserveOrdinaryDeparture(u,uid,dispatch) {
    const previous=readStoredDeparture(u,uid);
    if (previous?.status==='pending') throw pendingDepartureError(previous);
    const key=departureKey(u,uid);
    if (ordinaryMutations.has(key)) throw Error('Operazione in corso. Attendi prima di inviare la flotta.');
    const record={accountUid:uid,universeId:u.id,operationId:dispatch.ref.id,
      originKey:dispatch.doc.originKey,expectedRevision:validRevision(u.serviceRevision)?u.serviceRevision:null,
      status:'pending',protocol:2,armed:false};
    writeDeparture(key,record);
    const request={key,record,universe:u,dispatch,previous,busy:true};
    ordinaryDepartures.set(key,request);
    notifyOrdinaryDepartureChanged(u);
    return request;
  }
  function prepareOrdinaryDispatch(u,dispatch,uid) {
    const request=ordinaryDepartures.get(departureKey(u,uid));
    if (!request || request.dispatch!==dispatch || ordinaryCheckpointBlocked(u,dispatch,uid))
      throw pendingDepartureError(request?.record);
    const expected=validRevision(u.serviceRevision)?u.serviceRevision:null;
    if (expected===request.record.expectedRevision) return;
    const record={...request.record,expectedRevision:expected};
    writeDeparture(request.key,record);
    request.record=record;
  }
  const incarnation = value => value == null ? null : `${value.seconds}:${value.nanoseconds}`;
  function receiptMatches(record,receipt) {
    return Boolean(receipt && receipt.operationId===record.operationId && receipt.originKey===record.originKey &&
      receipt.expectedRevision===record.expectedRevision && terminalStatuses.has(receipt.status) &&
      receipt.terminalRevision===(record.expectedRevision===null ? null : record.expectedRevision+1) &&
      (record.profileJoinedAt===undefined || receipt.profileJoinedAt===record.profileJoinedAt) &&
      (record.profileIncarnation===undefined || incarnation(receipt.profileCreatedAt)===record.profileIncarnation));
  }
  function settledMatches(record,receipt) {
    return record?.status==='settled' && receiptMatches(record,receipt) &&
      record.terminalStatus===receipt.status && record.terminalRevision===receipt.terminalRevision;
  }
  function bindOrdinaryReceipt(u,dispatch,uid,playerSnap) {
    const request=ordinaryDepartures.get(departureKey(u,uid));
    if (!request || request.dispatch!==dispatch || ordinaryCheckpointBlocked(u,dispatch,uid) || !playerSnap?.exists)
      throw pendingDepartureError(request?.record);
    const player=playerSnap.data();
    const previous=player.ordinaryDispatchReceipt || null;
    // La ricevuta non ancora riconciliata non può essere sovrascritta.
    if (previous && previous.acknowledged!==true)
      throw Object.assign(Error('Ricevuta precedente non riconciliata.'),{code:'ordinary-receipt-unacknowledged'});
    if (previous?.operationId===request.record.operationId) throw pendingDepartureError(request.record);
    const joinedAt=Number.isSafeInteger(player.joinedAt) ? player.joinedAt : null;
    const record={...request.record,armed:true,profileJoinedAt:joinedAt,profileIncarnation:incarnation(player.at05ProfileCreatedAt),previousReceiptId:previous?.operationId || null};
    if (request.record.armed && JSON.stringify(record)!==JSON.stringify(request.record)) throw pendingDepartureError(request.record);
    if (!request.record.armed) {
      writeDeparture(request.key,record);
      request.record=record;
    }
    return {operationId:record.operationId,originKey:record.originKey,expectedRevision:record.expectedRevision,
      terminalRevision:record.expectedRevision===null ? null : record.expectedRevision+1,
      profileJoinedAt:joinedAt,profileCreatedAt:player.at05ProfileCreatedAt ?? null,status:'committed',acknowledged:false};
  }
  function ordinaryReceiptAcknowledgement(u,player,uid) {
    const record=readStoredDeparture(u,uid);
    const receipt=player.ordinaryDispatchReceipt;
    return receipt && receipt.acknowledged!==true && settledMatches(record,receipt) ? {...receipt,acknowledged:true} : null;
  }
  // L'ack non è un checkpoint: non può modificare risorse, revisione o esito.
  async function acknowledgeSettledDeparture(u,uid,admission=null) {
    const record=readStoredDeparture(u,uid);
    if (record?.status!=='settled' || acknowledgedReceipts.get(departureKey(u,uid))===record.operationId) return;
    const ref=getDB().collection('online_universes').doc(u.id).collection('players').doc(uid);
    const result=await getDB().runTransaction(async tx=>{
      if (getAuth().currentUser?.uid!==uid || ordinaryCheckpointBlocked(u,null,uid,admission)) throw pendingDepartureError(record);
      const snap=await tx.get(ref);
      if (!snap.exists || incarnation(snap.data().at05ProfileCreatedAt)!==(record.profileIncarnation ?? null)) throw pendingDepartureError(record);
      const data=snap.data();
      if (validRevision(u.serviceRevision) ? (data.serviceRevision ?? 0)!==u.serviceRevision : data.serviceRevision!=null) return false;
      const receipt=data.ordinaryDispatchReceipt;
      if (!settledMatches(record,receipt)) return false;
      if (receipt.acknowledged!==true) tx.update(ref,{ordinaryDispatchReceipt:{...receipt,acknowledged:true}});
      return true;
    });
    if (result) acknowledgedReceipts.set(departureKey(u,uid),record.operationId);
  }
  function adoptOrdinaryReceipt(u,uid,player,raise=true) {
    const r=player.ordinaryDispatchReceipt;
    if (!r || r.acknowledged===true) return;
    if (getAuth().currentUser?.uid!==uid || !terminalStatuses.has(r.status) ||
        typeof r.operationId!=='string' || !r.operationId || r.operationId.includes('/') ||
        typeof r.originKey!=='string' || r.profileJoinedAt!==(player.joinedAt ?? null) ||
        incarnation(r.profileCreatedAt)!==incarnation(player.at05ProfileCreatedAt)) throw pendingDepartureError(r);
    if (!readOrdinaryDeparture(u,uid)) writeDeparture(departureKey(u,uid),{
      accountUid:uid,universeId:u.id,operationId:r.operationId,originKey:r.originKey,expectedRevision:r.expectedRevision,
      status:'pending',protocol:2,armed:true,profileJoinedAt:r.profileJoinedAt,profileIncarnation:incarnation(r.profileCreatedAt),previousReceiptId:r.operationId});
    if (raise) throw pendingDepartureError(r);
  }
  function clearOrdinaryDeparture(request) {
    // Soltanto fallimento certamente precedente a qualunque commit.
    try {
      assertDepartureRecord(request);
      if (request.previous) writeDeparture(request.key,request.previous);
      else {
        window.localStorage.removeItem(request.key);
        if (window.localStorage.getItem(request.key)!==null) throw Error('Rimozione locale non verificata.');
      }
      ordinaryDepartures.delete(request.key);
    } catch (error) { throw storageError(error); }
  }
  function settleOrdinaryDeparture(request,receipt) {
    if (!receiptMatches(request.record,receipt)) throw pendingDepartureError(request.record);
    assertDepartureRecord(request);
    // Prima la conferma persistente; la ricevuta server rimane fino al prossimo checkpoint.
    const record={...request.record,status:'settled',terminalStatus:receipt.status,terminalRevision:receipt.terminalRevision};
    writeDeparture(request.key,record);
    ordinaryDepartures.delete(request.key);
  }
  function verifyTerminalEvidence(record,evidence) {
    if (!evidence || evidence.uid!==record.accountUid || evidence.universeId!==record.universeId ||
        evidence.operationId!==record.operationId || !Number.isSafeInteger(evidence.revision)) throw pendingDepartureError(record);
    if (record.profileJoinedAt!=null && evidence.joinedAt!==record.profileJoinedAt) throw pendingDepartureError(record);
    if (incarnation(evidence.profileCreatedAt)!==(record.profileIncarnation ?? null)) throw pendingDepartureError(record);
    const fleet=evidence.fleet;
    if (fleet && (fleet.id!==record.operationId || fleet.attackerUid!==record.accountUid || fleet.originKey!==record.originKey))
      throw pendingDepartureError(record);
    if (evidence.operationReceipt && evidence.receipt?.operationId===record.operationId &&
        (!receiptMatches(record,evidence.receipt) || evidence.receipt.status!==evidence.operationReceipt.status))
      throw pendingDepartureError(record);
    const terminal=evidence.operationReceipt || evidence.receipt;
    if (receiptMatches(record,terminal)) {
      if (terminal.status==='cancelled' && fleet) throw pendingDepartureError(record);
      if (terminal.terminalRevision!==null && evidence.revision<terminal.terminalRevision) throw pendingDepartureError(record);
      return terminal;
    }
    // Compatibilità con richieste I01 anteriori al protocollo ricevute:
    // solo presenza positiva della flotta, mai assenza come prova negativa.
    if (record.protocol!==2 && fleet && (record.expectedRevision===null || evidence.revision>record.expectedRevision))
      return {operationId:record.operationId,originKey:record.originKey,expectedRevision:record.expectedRevision,
        terminalRevision:record.expectedRevision===null ? null : record.expectedRevision+1,status:'committed'};
    throw pendingDepartureError(record);
  }
  async function cancelUncertainDeparture(request,passcode,stillCurrent) {
    const {record}=request;
    if (record.protocol!==2 || record.armed!==true || !validRevision(record.expectedRevision) || record.profileJoinedAt==null)
      throw pendingDepartureError(record);
    const uid=record.accountUid;
    const db=getDB(),uni=db.collection('online_universes').doc(record.universeId);
    const playerRef=uni.collection('players').doc(uid),fleetRef=uni.collection('fleets').doc(record.operationId);
    await db.runTransaction(async tx=>{
      if (!stillCurrent()) throw pendingDepartureError(record);
      assertDepartureRecord(request);
      const opRef=uni.collection('ordinaryDispatchOps').doc(record.operationId);
      const [universe,player,fleet,operation]=await Promise.all([tx.get(uni),tx.get(playerRef),tx.get(fleetRef),tx.get(opRef)]);
      if (!universe.exists || !player.exists || player.data().joinedAt!==record.profileJoinedAt || incarnation(player.data().at05ProfileCreatedAt)!==(record.profileIncarnation ?? null)) throw pendingDepartureError(record);
      if (universe.data().passcode && universe.data().passcode!==String(passcode || '').trim()) throw Error('Codice stanza errato.');
      const data=player.data(),receipt=data.ordinaryDispatchReceipt;
      if (operation.exists) {
        if (operation.data().uid===uid && receiptMatches(record,operation.data().receipt)) return;
        throw pendingDepartureError(record);
      }
      if (receiptMatches(record,receipt)) return; // esito già terminale, nessuna nuova scrittura
      if (receipt && receipt.acknowledged!==true) throw pendingDepartureError(record);
      if (fleet.exists || (data.serviceRevision ?? 0)!==record.expectedRevision ||
          (receipt?.operationId || null)!==record.previousReceiptId) throw pendingDepartureError(record);
      if (!stillCurrent()) throw pendingDepartureError(record);
      assertDepartureRecord(request);
      // Barriera sulla stessa revisione letta dal dispatch originale. Non
      // accredita risorse e non crea una flotta: rende impossibile il commit tardivo.
      const terminal={operationId:record.operationId,originKey:record.originKey,expectedRevision:record.expectedRevision,
        terminalRevision:record.expectedRevision+1,profileJoinedAt:record.profileJoinedAt,profileCreatedAt:data.at05ProfileCreatedAt ?? null,status:'cancelled',acknowledged:false};
      tx.set(opRef,{uid,receipt:terminal});
      tx.update(playerRef,{serviceRevision:record.expectedRevision+1,ordinaryDispatchReceipt:terminal});
    });
  }
  async function verifyOrdinaryDeparture(u,{cancel=false,passcode=u?.roomPasscode,isCurrent=null}={}) {
    const uid=getAuth().currentUser?.uid;
    const record=ordinaryDepartureStatus(u,uid);
    if (!record || record.missing) throw pendingDepartureError(record);
    const key=departureKey(u,uid),activeRequest=ordinaryDepartures.get(key);
    if (ordinaryRecoveries.has(key) || activeRequest?.busy || activeRequest?.dispatch) throw pendingDepartureError(record);
    const ui=window.UniversumUI,active=ui?.state?.currentUniverse;
    const stillCurrent=()=>getAuth().currentUser?.uid===uid && ui?.state?.currentUniverse===active &&
      (active ? active===u && ui.state.isMultiplayerMode : !ui?.state?.isMultiplayerMode && typeof isCurrent==='function' && isCurrent());
    if (!stillCurrent()) throw pendingDepartureError(record);
    ordinaryRecoveries.add(key);
    notifyOrdinaryDepartureChanged(active);
    const request={key,record,universe:active};
    try {
      assertDepartureRecord(request);
      if (cancel) await cancelUncertainDeparture(request,passcode,stillCurrent);
      if (!stillCurrent()) throw pendingDepartureError(record);
      const fresh=await G.joinOnlineUniverse(u.id,passcode,{serverOnly:true,operationId:record.operationId});
      const evidence=G.ordinaryRecoveryEvidence(fresh);
      const receipt=verifyTerminalEvidence(record,evidence);
      if (!stillCurrent()) throw pendingDepartureError(record);
      assertDepartureRecord(request);
      if (active) retiredDepartureStates.add(active);
      if (activeRequest?.universe) retiredDepartureStates.add(activeRequest.universe);
      recoveryEpochs.set(key,ordinaryRecoveryEpoch(u,uid)+1);
      ui.startOnlineGame(fresh);
      if (getAuth().currentUser?.uid!==uid || ui.state.currentUniverse!==fresh || !ui.state.isMultiplayerMode)
        throw pendingDepartureError(record);
      settleOrdinaryDeparture(request,receipt);
      if (evidence.receipt?.operationId!==record.operationId && evidence.receipt?.acknowledged===false)
        adoptOrdinaryReceipt(fresh,uid,{ordinaryDispatchReceipt:evidence.receipt,joinedAt:evidence.joinedAt,at05ProfileCreatedAt:evidence.profileCreatedAt},false);
      return {status:receipt.status,operationId:record.operationId};
    } finally { ordinaryRecoveries.delete(key); notifyOrdinaryDepartureChanged(ui?.state?.currentUniverse); }
  }
  async function launchOnlineFleet(universeObj, originPlanetIndex, targetCoords, mission, shipsSelected, cargo = {}, options = {}) {
    const uid=getAuth().currentUser?.uid;
    if (!uid || !universeObj?.id) throw Error('Utente non autenticato.');
    const key=departureKey(universeObj,uid);
    if (ordinaryAdmissions.has(key)) throw pendingDepartureError(null);
    const likelyOrdinary=mission!=='destroyGalattica' && !['invictus','crepuscolo','hephaestusForge','prometheusOracle','mothership'].some(id=>Number(shipsSelected?.[id])>0);
    const admission=likelyOrdinary ? {} : null;
    if (likelyOrdinary) {
      assertOrdinaryMutationAllowed(universeObj,uid);
      if (ordinaryMutations.has(key)) throw Error('Operazione in corso. Attendi prima di inviare la flotta.');
      ordinaryAdmissions.set(key,admission);
      notifyOrdinaryDepartureChanged(universeObj);
    }
    try { return await launchOnlineFleetImpl(universeObj,originPlanetIndex,targetCoords,mission,shipsSelected,cargo,options,admission); }
    finally { if (likelyOrdinary) {ordinaryAdmissions.delete(key);notifyOrdinaryDepartureChanged(universeObj);} }
  }
  async function launchOnlineFleetImpl(universeObj, originPlanetIndex, targetCoords, mission, shipsSelected, cargo, options,admission) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user) throw new Error('Utente non autenticato.');
    assertOrdinaryMutationAllowed(universeObj,user.uid,admission);
    const epoch=ordinaryRecoveryEpoch(universeObj,user.uid);
    const wasActive=window.UniversumUI?.state?.currentUniverse===universeObj;

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
    if (ordinary && universeObj.serviceRevision!==undefined && !validRevision(universeObj.serviceRevision))
      throw Error('Revisione non valida. Riapri la partita multiplayer.');
    if (ordinary && readStoredDeparture(universeObj,user.uid)?.status==='settled')
      await acknowledgeSettledDeparture(universeObj,user.uid,admission);
    if (wasActive && window.UniversumUI?.state?.currentUniverse!==universeObj) throw pendingDepartureError(null);
    const ref = uniRef.collection('fleets').doc();
    if (getAuth().currentUser?.uid!==user.uid) throw Error('Account cambiato durante la partenza.');
    if (ordinaryRecoveryEpoch(universeObj,user.uid)!==epoch) throw pendingDepartureError(null);
    assertOrdinaryMutationAllowed(universeObj,user.uid,admission);
    const dispatch={ref,doc:fleetDoc,ordinary,carrierHangars,specialist:Boolean(specialist),
      debit:{metal:cargoM,crystal:cargoC,deuterium:cargoD+flightStats.fuelCost+blackHoleExtra}};
    const request=ordinary ? reserveOrdinaryDeparture(universeObj,user.uid,dispatch) : null;
    if (request) dispatch.outcome={};
    try {
      let committed;
      try {
        committed=await syncPlayerState(universeObj,{force:true,dispatch});
      } catch (error) {
        // Un callback mai concluso non ha consegnato scritture al commit SDK.
        // Se il callback è stato concluso almeno una volta, non dedurre l’esito.
        if (request && dispatch.outcome.definitePreCommitFailure) clearOrdinaryDeparture(request);
        else if (request) throw pendingDepartureError(request.record);
        throw error;
      } finally {
        // Il privilegio vale soltanto per la chiamata iniziale, non per un retry.
        if (request) request.dispatch=null;
      }
      if (ordinary && (committed !== true || getAuth().currentUser?.uid!==user.uid)) throw pendingDepartureError(request.record);
      fleetDoc.id = ref.id;

      try {
        const savedSnap = await ref.get();
        const serverDepartureMs = _tsToMs(savedSnap.exists ? savedSnap.data()?.departureAt : null);
        if (serverDepartureMs > 0 && getAuth().currentUser?.uid===user.uid && ordinaryRecoveryEpoch(universeObj,user.uid)===epoch) {
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
      if (request) {
        if (getAuth().currentUser?.uid!==user.uid || (wasActive && window.UniversumUI?.state?.currentUniverse!==universeObj))
          throw pendingDepartureError(request.record);
        settleOrdinaryDeparture(request,dispatch.outcome.receipt);
      }

      return fleetDoc;
    } finally { if (request) { request.busy=false; notifyOrdinaryDepartureChanged(universeObj); } }
  }


  async function recallOnlineFleet(universeObj, fleetId) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !universeObj?.id) throw new Error('Utente non autenticato.');
    const releaseMutation=beginOrdinaryMutation(universeObj,user.uid);
    try {
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
      if (getAuth().currentUser?.uid!==user.uid) throw Error('Account cambiato.');
      assertOrdinaryMutationAllowed(universeObj,user.uid);
      tx.update(fleetRef, {
        status: 'returning',
        phase: 'IN RITORNO',
        mission: 'recall',
        arrivalTime: newArrival,
        returnTime: newArrival
      });
    });

    if (getAuth().currentUser?.uid!==user.uid || ordinaryCheckpointBlocked(universeObj,null,user.uid)) return;
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
    } finally { releaseMutation(); }
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

  Object.assign(G, { launchOnlineFleet, ordinaryDepartureStatus, ordinaryDepartureBusy, ordinaryDepartureInitialBusy, beginOrdinaryMutation, ordinaryMutationGuard, ordinaryCheckpointBlocked, ordinaryRecoveryEpoch, assertOrdinaryMutationAllowed, prepareOrdinaryDispatch, bindOrdinaryReceipt, ordinaryReceiptAcknowledgement, acknowledgeSettledDeparture, adoptOrdinaryReceipt, verifyOrdinaryDeparture, recallOnlineFleet, _mpNotifyError, listenOwnFleets, listenIncomingFleets, getLiveFleetDocs, clearLiveFleetDocs, _cleanupReasonText, forceCleanupOnlineFleet, processEmbargoFleets });

})();
