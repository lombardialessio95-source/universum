/* Persistenza e identità orbitale multiplayer. */
(function () {
  'use strict';
  const G = window.__UniversumMPModules;
  function collection(universeId) {
    return G.getDB().collection('online_universes').doc(universeId).collection('galattiche');
  }
  function markers(universeId) {
    return G.getDB().collection('online_universes').doc(universeId).collection('galatticheMap');
  }
  function atGalatticaTarget(snap,fleet) {
    const marker=snap.data();
    return snap.exists && snap.id===fleet.targetGalatticaId && !marker.destroyed &&
      marker.ownerUid===fleet.defenderUid && marker.coordKey===fleet.targetKey;
  }
  async function listGalatticaTargets(universeId,coords) {
    const result=await markers(universeId).where('coordKey','==',G.coordsToKey(coords)).get();
    return result.docs.filter(d=>!d.data().destroyed && d.data().ownerUid!==G.getAuth().currentUser.uid)
      .map(d=>({id:d.id,name:d.data().name,owner:d.data().ownerName}));
  }
  function mapRecord(data) {
    return {ownerUid:data.ownerUid,ownerName:data.ownerName,name:data.state.name || 'Galattica',
      coordKey:data.coordKey,systemKey:data.systemKey,defenses:data.state.defenses || {},destroyed:data.destroyed};
  }
  async function restoreGalattiche(universe, uid) {
    const result = await collection(universe.id).where('ownerUid', '==', uid).get();
    universe.galattiche = [];
    universe.galatticaVersions = {};
    universe.galatticaSignatures = {};
    for (const doc of result.docs) {
      const data = doc.data();
      if (data.destroyed) continue;
      const state = data.state;
      universe.galatticaSignatures[doc.id]=JSON.stringify(state);
      window.__UniversumEngineModules.addGalatticaProduction({ ...universe, galattiche: [state] },
        Math.max(0, (Date.now() - data.updatedAt) / 1000));
      universe.galattiche.push(state);
      universe.galatticaVersions[doc.id] = data.version;
    }
  }
  async function prepareGalattiche(tx, universe, uid, launch) {
    const writes = [];
    const present = new Set();
    for (const local of universe.galattiche || []) {
      const sending=launch?.state.id===local.id;
      const state=JSON.parse(JSON.stringify(sending ? launch.state : local));
      if (sending) {
        const before=JSON.parse(launch.before);
        for (const key of ['metal','crystal','deuterium']) {
          state.resources[key]+=local.resources[key]-before.resources[key];
          if (state.resources[key]<0) throw Error('Risorse della Galattica insufficienti.');
        }
      }
      const ref = collection(universe.id).doc(uid + '~' + state.id);
      present.add(ref.id);
      const snap = await tx.get(ref);
      const expected = universe.galatticaVersions?.[ref.id] || 0;
      if ((snap.exists && (snap.data().destroyed || snap.data().ownerUid !== uid)) ||
          (snap.data()?.version || 0) !== expected) {
        throw Object.assign(Error('Galattica aggiornata da un’altra sessione.'),{code:'service-conflict'});
      }
      if (!sending && universe.galatticaSignatures?.[ref.id]===JSON.stringify(state) && universe.galatticaMapSignatures?.[ref.id]) continue;
      writes.push({ ref, data: { ownerUid: uid, ownerName: universe.emperor || '', state,
        systemKey: state.coords.g + '_' + state.coords.s, coordKey: G.coordsToKey(state.coords), destroyed: false, version: expected + 1, updatedAt: Date.now() } });
    }
    for (const [key,version] of Object.entries(universe.galatticaVersions || {})) {
      if (present.has(key)) continue;
      const ref = collection(universe.id).doc(key);
      const snap = await tx.get(ref);
      if (snap.data()?.version !== version || snap.data().ownerUid !== uid) {
        throw Object.assign(Error('Stato orbitale modificato.'),{code:'service-conflict'});
      }
      writes.push({ref,data:{...snap.data(),destroyed:true,version:version+1,updatedAt:Date.now()}});
    }
    for (const w of writes) {
      const marker=mapRecord(w.data);
      if (JSON.stringify(marker)!==universe.galatticaMapSignatures?.[w.ref.id]) {
        w.marker=marker;
        w.mapRef=markers(universe.id).doc(w.ref.id);
      }
    }
    return writes;
  }
  function driveTech(u) {
    return Object.fromEntries(['combustionDrive','impulseDrive','hyperspaceDrive'].map(key=>[key,u.researches?.[key] || 0]));
  }
  function attackTech(u) {
    return Object.fromEntries(['weaponsTech','shieldingTech','armourTech','espionageTech','expeditionTech'].map(key=>[key,u.researches?.[key] || 0]));
  }
  async function launchGalattica(u,id,target,mission,selection,cargo,options={}) {
    const uid=G.getAuth().currentUser?.uid;
    if (!uid || !Number.isSafeInteger(u.serviceRevision)) throw Error('Riapri la partita multiplayer.');
    const source=u.galattiche?.find(g=>g.id===id);
    if (!source) throw Error('Galattica di origine non disponibile.');
    if (!['attack','spy','transport','recycle','explore','destroyMoon','embargo','blockade','occupy'].includes(mission))
      throw Error('Missione non disponibile dalla Galattica.');
    const before=JSON.stringify(source);
    const expected=u.galatticaVersions?.[uid+'~'+id] || 0;
    const state=JSON.parse(before);
    const simulation={...u,galattiche:u.galattiche.map(g=>g.id===id?state:g),fleetsInFlight:[...u.fleetsInFlight]};
    const flight=window.UniversumGalaxy.launchFleet(simulation,0,target,mission,selection,cargo,
      {...options,originType:'galattica',originGalatticaId:id});
    const base=G.getDB().collection('online_universes').doc(u.id);
    const targetKey=G.coordsToKey(target);
    const dest=await base.collection('planets').doc(targetKey).get();
    const ref=base.collection('fleets').doc();
    const doc={...flight,id:ref.id,originGalatticaId:id,originGalatticaKey:uid+'~'+id,originKey:G.coordsToKey(source.coords),
      departureDriveTech:driveTech(u),targetKey,mission:mission==='explore'?'expedition':mission==='blockade'?'embargo':mission,
      attackerUid:uid,attackerName:u.emperor || 'Comandante',attackerTech:attackTech(u),
      defenderUid:dest.data()?.ownerUid || null,phase:'IN VIAGGIO',resolved:false,
      blackHole:Boolean(options.blackHole),expeditionHours:flight.exploreHours || 1,schemaVersion:window.__UniversumMPVariables.FLEET_SCHEMA_VERSION};
    await G.syncPlayerState(u,{force:true,galLaunch:{ref,doc,state,key:doc.originGalatticaKey,expected,before}});
    if (!u.fleetsInFlight.some(f=>f.id===doc.id)) u.fleetsInFlight.push(doc);
    return doc;
  }

  async function jumpOnlineGalattica(u,id,target) {
    const uid = G.getAuth().currentUser?.uid;
    const source = u.galattiche.find(g=>g.id===id);
    if (!uid || !source || !Number.isSafeInteger(u.serviceRevision)) throw Error('Origine non disponibile.');
    const state = structuredClone(source);
    const simulation = {...u,galattiche:u.galattiche.map(g=>g.id===id?state:g),fleetsInFlight:[],
      planets:u.planets.map(p=>({...p})),galaxyDeltas:{...u.galaxyDeltas}};
    const result = window.UniversumGalaxy.jumpGalattica(simulation,id,target);
    const originGalatticaKey = uid+'~'+id;
    const change = {state,key:originGalatticaKey,before:JSON.stringify(source),
      expected:u.galatticaVersions?.[originGalatticaKey] || 0,jump:simulation};
    const flight = simulation.fleetsInFlight[0];
    if (flight) {
      const ref = G.getDB().collection('online_universes').doc(u.id).collection('fleets').doc();
      change.ref = ref;
      change.doc = {...flight,id:ref.id,mission:'deploy',status:'outbound',phase:'IN VIAGGIO',resolved:false,
        attackerUid:uid,defenderUid:uid,attackerName:u.emperor || 'Comandante',
        originGalatticaKey,originGalatticaId:id,originKey:G.coordsToKey(source.coords),targetKey:G.coordsToKey(flight.targetCoords),
        attackerTech:attackTech(u),departureDriveTech:driveTech(u)};
    }
    await G.syncPlayerState(u,{force:true,galLaunch:change});
    if (change.doc && !u.fleetsInFlight.some(f=>f.id===change.doc.id)) u.fleetsInFlight.push(change.doc);
    return result;
  }
  async function returnGalattica(tx,base,ref,fleet,now,speed) {
    const galRef=base.collection('galattiche').doc(fleet.originGalatticaKey);
    const snap=await tx.get(galRef);
    const doc=snap.data();
    const origin=fleet.originCoords;
    const slow=fleet.galatticaReturn===true;
    const coords=fleet.galReturnCoords || fleet.targetCoords;
    const redirected=fleet.fallbackPlanetKey;
    let dest,credit;
    if (redirected || !doc || doc.destroyed) {
      const profile=(await tx.get(base.collection('players').doc(fleet.attackerUid))).data();
      const keys=profile?.checkpointPlanets || [];
      const planets=await Promise.all(keys.map(k=>tx.get(base.collection('planets').doc(k))));
      const owned=planets.filter(p=>p.exists && p.data().ownerUid===fleet.attackerUid);
      dest=owned.find(p=>p.id===redirected) || owned.sort((a,b)=>
        window.UniversumGalaxy.calculateDistance(coords,a.data().coords)-window.UniversumGalaxy.calculateDistance(coords,b.data().coords) || a.id.localeCompare(b.id))[0];
      if (!dest) throw Error('Rientro sospeso: nessuna colonia disponibile.');
    } else if (doc.ownerUid!==fleet.attackerUid || doc.state.id!==fleet.originGalatticaId) {
      throw Error('Proprietà della Galattica incoerente.');
    }
    const to=dest ? dest.data().coords : doc.state.coords;
    if ((dest && redirected!==dest.id) || (!dest && !slow && G.coordsToKey(to)!==G.coordsToKey(origin))) {
      const duration=window.UniversumGalaxy.getFleetSpeedAndFuel({speed,researches:fleet.departureDriveTech || fleet.attackerTech},fleet.ships,
        window.UniversumGalaxy.calculateDistance(coords,to)).durationSec;
      const eta=now+Math.max(1,duration)*20000;
      tx.update(ref,{galatticaReturn:true,galReturnCoords:to,fallbackPlanetKey:dest?.id || null,returnTime:eta,arrivalTime:eta});
      return eta;
    }
    const manifest=fleet.carrierHangars || [];
    if (manifest.length) window.UniversumHangars.verifyManifest(manifest,fleet.ships.mothership || 0);
    if (dest) {
      G._inboxCredit(tx,dest.ref,{resources:fleet.cargo,fleet:fleet.ships},dest.data().inbox?.serviceEvents);
      if (manifest.length) tx.update(dest.ref,{['inbox.hangarReturns.'+ref.id]:manifest});
    } else {
      const state=doc.state;
      window.UniversumHangars.restore(state,manifest);
      for (const [id,n] of Object.entries(fleet.ships)) state.orbitingFleet[id]=(state.orbitingFleet[id] || 0)+n;
      for (const key of ['metal','crystal','deuterium']) state.resources[key]+=fleet.cargo[key] || 0;
      tx.update(galRef,{state,version:doc.version+1});
      credit={key:galRef.id,id:state.id,previous:doc.version,ships:fleet.ships,cargo:fleet.cargo,manifest};
    }
    tx.update(ref,{status:'completed',phase:'COMPLETATA',resolved:true,completedAt:now});
    return credit;
  }
  Object.assign(G,{galatticaMarkers:markers,atGalatticaTarget,listGalatticaTargets,restoreGalattiche,prepareGalattiche,launchGalattica,jumpOnlineGalattica,returnGalattica});
})();
