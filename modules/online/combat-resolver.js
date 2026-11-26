/** UNIVERSUM / modules/online/combat-resolver.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumMPModules;
  const { FLEET_SCHEMA_VERSION } = window.__UniversumMPVariables;
  // Bridge lazy per le funzioni definite negli altri moduli.
  const _effectivePlanetView = (...args) => G._effectivePlanetView(...args);
  const _fleetDueTime = (...args) => G._fleetDueTime(...args);
  const _inboxCredit = (...args) => G._inboxCredit(...args);
  const _mpNotifyError = (...args) => G._mpNotifyError(...args);
  const _resolveCreditRef = (...args) => G._resolveCreditRef(...args);
  const _snapshotForDiff = (...args) => G._snapshotForDiff(...args);
  const _writePlanetResult = (...args) => G._writePlanetResult(...args);
  const coordsToKey = (...args) => G.coordsToKey(...args);
  const createStarterPlanetDoc = (...args) => G.createStarterPlanetDoc(...args);
  const forceCleanupOnlineFleet = (...args) => G.forceCleanupOnlineFleet(...args);
  const getAuth = (...args) => G.getAuth(...args);
  const getDB = (...args) => G.getDB(...args);
  const normalizeOnlineFleet = (...args) => G.normalizeOnlineFleet(...args);
  const processEmbargoFleets = (...args) => G.processEmbargoFleets(...args);



  G.returnCargoWithRansom = function(fleet) {
    const cargo={...fleet.cargo};
    if (fleet.siegeStartedAt && ['blockade','embargo'].includes(fleet.mission)) {
      cargo.deuterium=Math.min(cargo.deuterium || 0,Math.max(0,Math.floor(fleet.siegeDeuterium || 0)));
    }
    for (const key of ['metal','crystal','deuterium']) cargo[key]=(cargo[key] || 0)+(fleet.pendingRansom?.[key] || 0);
    return cargo;
  };

  const _resolutionInFlight = new Map();
  // Piano B solo quando i listener falliscono: una query per account e non
  // il vecchio scan globale eseguito ogni 3 secondi.
  const _fleetListenerFallback = new Map();
  async function resolveArrivedOnlineFleets(uniId, knownSpeed) {
    const key = `${uniId}|${getAuth().currentUser?.uid || ''}`;
    if (_resolutionInFlight.has(key)) return _resolutionInFlight.get(key);
    const work = _resolveArrivedOnlineFleetsImpl(uniId, knownSpeed)
      .finally(() => _resolutionInFlight.delete(key));
    _resolutionInFlight.set(key, work);
    return work;
  }

  async function _resolveArrivedOnlineFleetsImpl(uniId, knownSpeed) {
    const db = getDB();
    const uniRef = db.collection('online_universes').doc(uniId);
    const now = Date.now();

    // Gli snapshot delle flotte sono gia' mantenuti in tempo reale dal radar e
    // dalla lista flotte. Nessuna query periodica e nessun limite che escluda
    // le nuove flotte per colpa di documenti completed storici.
    let activeDocs = G.getLiveFleetDocs(uniId);
    if (activeDocs === null) {
      const uid = getAuth().currentUser?.uid;
      if (!uid) return;
      const key = `${uniId}|${uid}`;
      const state = _fleetListenerFallback.get(key) || { start: now, queried: -Infinity };
      _fleetListenerFallback.set(key, state);
      // Lascia avviare i normali listener per 15s; dopo un errore riprova
      // una volta al minuto con query PER UTENTE, non su tutta la galassia.
      if (now - state.start < 15000 || now - state.queried < 60000) return;
      state.queried = now;
      try {
        const fleetsCol = uniRef.collection('fleets');
        activeDocs = (await G.fetchFleetPartyDocs(fleetsCol, uid))
          .filter((d) => {
            const f = normalizeOnlineFleet(d.data(), d.id);
            return !f.resolved && ['outbound','returning','embargo','occupy'].includes(f.status);
          });
      } catch (e) {
        _mpNotifyError('fallback listener flotte', e);
        return;
      }
    } else {
      _fleetListenerFallback.delete(`${uniId}|${getAuth().currentUser?.uid || ''}`);
    }
    if (activeDocs.length === 0) return;
    const allSnap = { docs: activeDocs };
    // Solo l'attaccante o il difensore puo' risolvere una flotta: una sessione
    // estranea non deve tentare di scrivere sui documenti altrui.
    const resolverUid = getAuth().currentUser?.uid;
    const authorizedDocs = allSnap.docs.filter((d) => {
      const f = d.data();
      return resolverUid && (f.attackerUid === resolverUid || f.defenderUid === resolverUid);
    });
    if (!authorizedDocs.length) return;

    // Speed noto alla sessione: non rileggere online_universes a ogni arrivo.
    const activeUniverse = window.UniversumUI?.state?.currentUniverse;
    const sessionSpeed = Number(knownSpeed) || (activeUniverse?.id === uniId ? Number(activeUniverse.speed) : 0);
    const speed = sessionSpeed > 0 ? sessionSpeed : ((await uniRef.get()).data()?.speed || 10);

    // I tick dell'embargo vengono aggregati (non 2 scritture ogni 3 secondi).
    await processEmbargoFleets(uniRef, authorizedDocs, now, speed);

    const arrivedDocs = authorizedDocs
      .map((d) => ({ doc: d, fleet: normalizeOnlineFleet(d.data(), d.id) }))
      .filter(({ fleet }) => !fleet.resolved && (fleet.status === 'outbound' || fleet.status === 'returning') && _fleetDueTime(fleet) <= now
        && !(fleet.status==='returning' && (fleet.originGalatticaKey || fleet.originPlanetId) && fleet.attackerUid!==resolverUid))
      .sort((a, b) => _fleetDueTime(a.fleet) - _fleetDueTime(b.fleet))
      .slice(0, 10);
    if (arrivedDocs.length === 0) return;

    const currentUid = window.fbAuth?.currentUser?.uid;

    for (const { doc: fDoc, fleet: fleetNorm } of arrivedDocs) {
      const fleetRef = fDoc.ref;
      if (!fleetNorm.targetKey || !fleetNorm.originCoords) {
        await forceCleanupOnlineFleet(uniRef, fleetNorm, fleetRef, 'missing-route');
        continue;
      }
      const targetPlanetRef = uniRef.collection('planets').doc(fleetNorm.targetKey);
      const originPlanetRef = uniRef.collection('planets').doc(coordsToKey(fleetNorm.originCoords));

      if (fleetNorm.status === 'outbound' && !['attack', 'destroyMoon', 'recall'].includes(fleetNorm.mission)) {
        const preSnap = await targetPlanetRef.get().catch(() => null);
        const preEmbargo = preSnap && preSnap.exists ? preSnap.data().embargo : null;
        if (preEmbargo && preEmbargo.attackerUid && preEmbargo.attackerUid !== fleetNorm.attackerUid) {
          try {
            await db.runTransaction(async (txR) => {
              const fs = await txR.get(fleetRef);
              if (!fs.exists) return;
              const cur = normalizeOnlineFleet(fs.data(), fDoc.id);
              if (cur.resolved || cur.status !== 'outbound') return;
              const t = Date.now();
              const legMs = Math.max(5000, (Number(cur.returnTime || t) - Number(cur.arrivalTime || t)) || 60000);
              txR.update(fleetRef, {
                status: 'returning', phase: 'IN RITORNO', resolved: false,
                arrivalTime: t + legMs, returnTime: t + legMs,
                schemaVersion: FLEET_SCHEMA_VERSION
              });
              txR.set(uniRef.collection('messages').doc(), {
                recipientUid: cur.attackerUid,
                title: `Missione Respinta [${cur.targetKey}]`,
                body: `Il pianeta è sotto embargo di ${preEmbargo.attackerName || 'un altro comandante'}. La tua flotta sta rientrando alla base.`,
                timestamp: t
              });
            });
          } catch (e) {
            console.warn('[MP Embargo] Respingimento flotta rinviato:', e);
          }
          continue;
        }
      }
      let newlyColonizedPlanet = null;
      const creditRef = fleetNorm.status === 'returning' && !fleetNorm.originGalatticaKey
        ? await _resolveCreditRef(uniRef, fleetNorm.attackerUid, fleetNorm.originCoords)
        : null;
      let localReturning = null,galCredit=null;

      try {
        await db.runTransaction(async (tx) => {
          galCredit=null; localReturning=null;
          const freshFleetSnap = await tx.get(fleetRef);
          if (!freshFleetSnap.exists || freshFleetSnap.data().resolved) return;
          const fleet = normalizeOnlineFleet(freshFleetSnap.data(), fDoc.id);
          if (fleet.status!==fleetNorm.status) return;
          if (fleet.status==='returning' && fleet.originGalatticaKey) {
            fleet.cargo = G.returnCargoWithRansom(fleet);
            const eta = _fleetDueTime(fleet)>now ? _fleetDueTime(fleet) : await G.returnGalattica(tx,uniRef,fleetRef,fleet,now,speed);
            if (typeof eta==='number') localReturning={...fleet,arrivalTime:eta};
            else galCredit=eta;
            return;
          }
          if (fleet.status==='returning' && !creditRef) throw Error('Destinazione di rientro indisponibile.');
          if ((fleet.status !== 'outbound' && fleet.status !== 'returning') || _fleetDueTime(fleet) > Date.now()) return;

          const targeted = fleet.status==='outbound' && fleet.targetGalatticaId;
          const selected = targeted ? await tx.get(G.galatticaMarkers(uniId).doc(fleet.targetGalatticaId)) : null;
          const targetSnap = targeted && !G.atGalatticaTarget(selected,fleet) ? {exists:false} : await tx.get(targetPlanetRef);

          const targetPlanet = !targeted && targetSnap.exists ? (fleet.status === 'outbound'
            ? await G.combatPlanet(tx,uniRef,targetSnap,speed,Date.now()) : _effectivePlanetView(targetSnap.data(),speed)) : null;
          const targetBefore = _snapshotForDiff(targetPlanet);
          const targetWasNpc = Boolean(targetPlanet && targetPlanet.isNpc);

          let reportTitle = `Missione ${fleet.mission.toUpperCase()} [${fleet.targetKey}]`;
          let reportBody = 'Missione completata.';
          let returnShips = Object.assign({}, fleet.ships || {});
          let crepuscoloDamaged=Boolean(fleet.crepuscoloDamaged);
          let returnHangars = Array.isArray(fleet.carrierHangars) ? fleet.carrierHangars.slice() : [];
          let returnCargo = Object.assign({ metal: 0, crystal: 0, deuterium: 0 }, fleet.cargo || {});
          let completeNow = fleet.status === 'returning';
          let persistentStatus = null;
          let siegeShips = null;
          let defenderBody;
          let defenderTitle;

          let creditEvents;
          if (fleet.status === 'returning' || fleet.mission === 'recall') {
            if (fleet.ships?.invictus || fleet.ships?.crepuscolo || fleet.carrierHangars?.length || window.UniversumServices?.ids.some(id=>fleet.ships?.[id])) {
              const receiving = creditRef && (await tx.get(creditRef)).data();
              if (receiving?.ownerUid !== fleet.attackerUid) throw Error('Colonia di rientro non disponibile.');
              creditEvents = receiving.inbox?.serviceEvents;
            }
            reportTitle = `Flotta Richiamata Rientrata [${coordsToKey(fleet.originCoords)}]`;
            reportBody = 'Le navi sono rientrate alla base con il carico integro.';
          } else if (targeted) {
            if (!G.atGalatticaTarget(selected,fleet)) {
              reportBody='La Galattica selezionata non si trova alle coordinate previste. La flotta rientra senza rimborso del carburante.';
            } else {
              const combat=window.UniversumGalaxy.resolveCombat(fleet.ships,fleet.attackerTech,{
                fleet:{},defenses:selected.data().defenses || {},tech:{},resources:{metal:0,crystal:0,deuterium:0},
                buildings:{},moon:null,bacinoSpaziale:null
              },returnHangars.length ? {attackerTags:{mothership:returnHangars.map(h=>h.id)}} : {});
              returnShips=combat.attackerSurvivors;
              const alive=new Set(combat.attackerTagsAlive?.mothership || []);
              returnHangars=returnHangars.filter(h=>alive.has(h.id));
              if (combat.attackerCrepuscoloDamaged && returnShips.crepuscolo) crepuscoloDamaged=true;
              const stars=returnShips.deathStar || 0;
              if (combat.result==='attacker_win' && stars && Math.random()<1-Math.pow(0.90,stars)) {
                const loss={destroyed:true,destroyedBy:fDoc.id};
                tx.update(selected.ref,loss);
                tx.update(uniRef.collection('galattiche').doc(selected.id),loss);
                if (Math.random()<0.75 && targetSnap.exists && !targetSnap.data().moon && !targetSnap.data().bacinoSpaziale) {
                  tx.update(targetPlanetRef,{moon:window.__UniversumGalaxyModules.makeMoon('Luna')});
                }
                reportBody='Galattica selezionata distrutta.';
              } else reportBody='La Galattica selezionata ha resistito.';
            }
          } else if (fleet.mission === 'spy' && targetPlanet) {
            const Data = window.UniversumData;
            const probes = Math.max(0, Number(fleet.ships?.espionageProbe || 0));
            const myEsp = Number(fleet.attackerTech?.espionageTech || 0);
            let defEsp = 0;
            if (targetPlanet.ownerUid && !targetPlanet.isNpc) {
              const defSpySnap = await tx.get(uniRef.collection('players').doc(targetPlanet.ownerUid));
              if (defSpySnap.exists) defEsp = Number(defSpySnap.data().researches?.espionageTech || 0);
            }
            const defProbes = Number(targetPlanet.fleet?.espionageProbe || 0);
            const spyDiff = (myEsp - defEsp) + Math.floor(Math.sqrt(probes));
            const catchChance = Math.min(0.85, Math.max(0.02, (defProbes / (Math.max(1, probes) * 8)) * 0.25 - spyDiff * 0.03));
            const probesLost = (probes > 0 && Math.random() < catchChance) ? Math.min(probes, Math.ceil(probes * 0.5)) : 0;
            if (probes > 0) returnShips.espionageProbe = Math.max(0, probes - probesLost);

            const nameOf = (id) => (Data?.SHIPS?.[id] || Data?.DEFENSES?.[id])?.name || id;
            const listUnits = (map) => {
              const parts = Object.entries(map || {})
                .filter(([, q]) => Number(q) > 0)
                .map(([id, q]) => `${nameOf(id)} x${Number(q).toLocaleString('it-IT')}`);
              return parts.length > 0 ? parts.join(', ') : 'nessuna';
            };
            const resInfo = `Risorse: ${Math.floor(targetPlanet.resources.metal)} M, ${Math.floor(targetPlanet.resources.crystal)} C, ${Math.floor(targetPlanet.resources.deuterium)} D.`;
            const fleetInfo = spyDiff >= 0 ? ` Flotta: ${listUnits(targetPlanet.fleet)}.` : ' Flotta: non rilevata.';
            const defInfo = spyDiff >= 1 ? ` Difese: ${listUnits(targetPlanet.defenses)}.` : ' Difese: non rilevate.';
            reportTitle = `Rapporto Spionaggio su ${targetPlanet.name} [${fleet.targetKey}]`;
            reportBody = resInfo + fleetInfo + defInfo + ` Sonde perse: ${probesLost}.`;

            if (probesLost > 0) {
              defenderTitle = `Sonde spia intercettate [${fleet.targetKey}]`;
              defenderBody = `Le tue difese hanno distrutto ${probesLost} sonde spia di ${fleet.attackerName}.`;
            } else {
              defenderBody = null;
            }

            const spyShipsLeft = Object.values(returnShips).reduce((a, q) => a + Math.max(0, Number(q) || 0), 0);
            if (spyShipsLeft <= 0) {
              completeNow = true;
              reportBody += ' Tutte le sonde sono andate perdute.';
            }
          } else if (fleet.mission === 'transport' && targetPlanet && (targetPlanet.ownerUid === fleet.attackerUid || !window.UniversumServices?.ids.some(id=>fleet.ships?.[id]))) {
            targetPlanet.resources.metal += returnCargo.metal;
            targetPlanet.resources.crystal += returnCargo.crystal;
            targetPlanet.resources.deuterium += returnCargo.deuterium;
            returnCargo = { metal: 0, crystal: 0, deuterium: 0 };
            _writePlanetResult(tx, targetPlanetRef, targetBefore, targetPlanet, fDoc.id);
            reportTitle = `Consegna Risorse su ${targetPlanet.name}`;
            reportBody = `Consegnati ${fleet.cargo.metal} M, ${fleet.cargo.crystal} C, ${fleet.cargo.deuterium} D.`;
          } else if (fleet.mission === 'deploy' && targetPlanet && targetPlanet.ownerUid === fleet.attackerUid) {
            const special=window.__UniversumGalaxyModules.deployOrdinaryShips(targetPlanet.fleet,returnShips);
            targetPlanet.resources.metal += returnCargo.metal;
            targetPlanet.resources.crystal += returnCargo.crystal;
            targetPlanet.resources.deuterium += returnCargo.deuterium;
            // Le Navi Madre schierate mantengono i propri hangar come un evento
            // di accredito atomico, evitando che il checkpoint successivo li ricrei vuoti.
            if (returnHangars.length) {
              window.UniversumHangars.verifyManifest(returnHangars, Number(returnShips.mothership || 0));
              if (targetBefore?.inbox?.hangarReturns?.[fDoc.id]) throw Error('Hangar schierati già accreditati.');
              tx.update(targetPlanetRef,{[`inbox.hangarReturns.${fDoc.id}`]:returnHangars});
              returnHangars=[];
            }
            returnShips = special;
            returnCargo = { metal: 0, crystal: 0, deuterium: 0 };
            completeNow = !Object.keys(special).length;
            _writePlanetResult(tx, targetPlanetRef, targetBefore, targetPlanet, fDoc.id);
            reportTitle = `Schieramento Completato su ${targetPlanet.name}`;
            reportBody = completeNow ? 'La flotta si è unita alla guarnigione locale.' : 'Carico e unità ordinarie consegnati. Le speciali rientrano al Bacino.';
          } else if (fleet.mission === 'colonize') {
            if (!targetPlanet && (returnShips.colonyShip || 0) >= 1) {
              const newColony = createStarterPlanetDoc(
                uniId,
                fleet.targetCoords,
                fleet.attackerUid,
                fleet.attackerName,
                `Colonia ${fleet.targetCoords.g}:${fleet.targetCoords.s}:${fleet.targetCoords.p}`,
                false
              );
              // D25-I01: solo la nuova colonia online adotta le risorse base
              // offline. L'helper condiviso (pianeti madre/NPC) resta invariato.
              // Il carico trasportato viene aggiunto subito sotto, come prima.
              newColony.resources = { metal: 1000, crystal: 1000, deuterium: 500 };
              // D26-I01: soltanto le nuove colonie online nascono con i 14
              // edifici a livello 0, come nell'offline. D07, D25 e l'helper
              // createStarterPlanetDoc restano invariati.
              newColony.buildings = {
                metalMine: 0, crystalMine: 0, deuteriumSynth: 0, solarPlant: 0,
                fusionReactor: 0, roboticsFactory: 0, naniteFactory: 0, shipyard: 0,
                metalStorage: 0, crystalStorage: 0, deuteriumTank: 0, researchLab: 0,
                terraformer: 0, hiddenBunker: 0
              };
              newColony.resources.metal += returnCargo.metal;
              newColony.resources.crystal += returnCargo.crystal;
              newColony.resources.deuterium += returnCargo.deuterium;
              returnCargo = { metal: 0, crystal: 0, deuterium: 0 };
              returnShips.colonyShip = Math.max(0, returnShips.colonyShip - 1);
              newColony.fleet = {};
              const shipsLeftAfterColony = Object.values(returnShips).reduce((a, q) => a + Math.max(0, Number(q) || 0), 0);
              completeNow = shipsLeftAfterColony <= 0;
              tx.set(targetPlanetRef, newColony);
              newlyColonizedPlanet = newColony;
              reportTitle = `Nuova Colonia Fondata [${fleet.targetCoords.g}:${fleet.targetCoords.s}:${fleet.targetCoords.p}]`;
              reportBody = 'Il pianeta è ora sotto il tuo comando.' + (shipsLeftAfterColony > 0 ? ' Il resto della flotta sta rientrando alla base.' : '');
            } else {
              reportTitle = `Colonizzazione Fallita [${fleet.targetCoords.g}:${fleet.targetCoords.s}:${fleet.targetCoords.p}]`;
              reportBody = 'Lo slot era già occupato. La Colonizzatrice rientra alla base.';
            }
          } else if (fleet.mission === 'recycle' && targetPlanet) {
            const Data = window.UniversumData;
            const debris = targetPlanet.debris || { metal: 0, crystal: 0 };
            let recCap = 0;
            for (const [sId, qty] of Object.entries(returnShips)) {
              recCap += (Data?.SHIPS?.[sId]?.cargo || 0) * Number(qty || 0);
            }
            const alreadyLoaded = (returnCargo.metal || 0) + (returnCargo.crystal || 0) + (returnCargo.deuterium || 0);
            const freeCap = Math.max(0, recCap - alreadyLoaded);
            const takeM = Math.min(debris.metal || 0, Math.floor(freeCap * 0.6));
            const takeC = Math.min(debris.crystal || 0, freeCap - takeM);
            returnCargo.metal += takeM;
            returnCargo.crystal += takeC;
            targetPlanet.debris = {
              metal: Math.max(0, (debris.metal || 0) - takeM),
              crystal: Math.max(0, (debris.crystal || 0) - takeC)
            };
            _writePlanetResult(tx, targetPlanetRef, targetBefore, targetPlanet, fDoc.id);
            reportTitle = `Raccolta Detriti [${fleet.targetKey}]`;
            reportBody = `Riciclati ${takeM} M e ${takeC} C. Detriti rimasti: ${targetPlanet.debris.metal} M, ${targetPlanet.debris.crystal} C.`;
          } else if (fleet.mission === 'expedition' || fleet.mission === 'explore') {
            const expLv = fleet.attackerTech?.expeditionTech || 0;
            const hrs = fleet.expeditionHours || 1;
            const mult = (1 + expLv * 0.25) * (1 + (hrs - 1) * 0.22);
            const roll = Math.random();
            if (roll < 0.55) {
              const foundM = Math.floor((8000 + Math.random() * 14000) * mult);
              const foundC = Math.floor((5000 + Math.random() * 9000) * mult);
              const foundD = Math.floor((2000 + Math.random() * 5000) * mult);
              returnCargo.metal += foundM;
              returnCargo.crystal += foundC;
              returnCargo.deuterium += foundD;
              reportTitle = `Esplorazione Profonda [${fleet.targetKey}] (${hrs}h)`;
              reportBody = `Relitti recuperati nello spazio profondo: +${foundM} M, +${foundC} C, +${foundD} D.`;
            } else if (roll < 0.78) {
              const bonusShips = Math.max(1, Math.floor((1 + Math.random() * 3) * (1 + expLv * 0.15)));
              returnShips.lightFighter = (returnShips.lightFighter || 0) + bonusShips;
              reportTitle = `Esplorazione Profonda [${fleet.targetKey}] (${hrs}h)`;
              reportBody = `La spedizione ha riattivato ${bonusShips} Caccia Leggeri abbandonati alla deriva!`;
            } else {
              reportTitle = `Esplorazione Profonda [${fleet.targetKey}] (${hrs}h)`;
              reportBody = 'Nessuna anomalia rilevata nel settore esplorato. Flotta rientrata alla base.';
            }
          } else if (fleet.mission === 'incursion') {
            const H=window.UniversumHangars;
            if (!H) throw Error('Hangar non disponibile: missione rinviata.');
            H.validateMission(fleet.ships,returnHangars);
            if (!targetPlanet || targetPlanet.ownerUid === fleet.attackerUid ||
                (!targetPlanet.isNpc && !targetPlanet.ownerUid)) {
              reportTitle=`Incursione Annullata [${fleet.targetKey}]`;
              reportBody='Il bersaglio nemico non è più valido. Le Navi Madre rientrano con i propri caccia.';
            } else {
              let defTech={weaponsTech:0,shieldingTech:0,armourTech:0};
              const defenderUid=fleet.defenderUid || targetPlanet.ownerUid;
              if (defenderUid && !targetPlanet.isNpc) {
                const snap=await tx.get(uniRef.collection('players').doc(defenderUid));
                const r=snap.exists ? (snap.data().researches || {}) : {};
                defTech={weaponsTech:Number(r.weaponsTech||0),shieldingTech:Number(r.shieldingTech||0),armourTech:Number(r.armourTech||0)};
              }
              if (targetPlanet.fleet?.mothership) H.normalizePlanet(targetPlanet);
              const battle=H.resolveIncursion(returnHangars,fleet.attackerTech,{
                fleet:targetPlanet.fleet || {},defenses:targetPlanet.defenses || {},
                mothershipHangars:targetPlanet.mothershipHangars || [],
                resources:targetPlanet.resources || {},buildings:targetPlanet.buildings || {},tech:defTech
              },returnCargo);
              targetPlanet.fleet=battle.defenderFleet;
              targetPlanet.mothershipHangars=battle.defenderHangars;
              targetPlanet.defenses=battle.defenderDefenses;
              for (const key of ['metal','crystal','deuterium']) {
                targetPlanet.resources[key]=Math.max(0,(targetPlanet.resources[key]||0)-battle.loot[key]);
                returnCargo[key]=(returnCargo[key]||0)+battle.loot[key];
              }
              targetPlanet.debris={metal:(targetPlanet.debris?.metal||0)+battle.debris.metal,
                crystal:(targetPlanet.debris?.crystal||0)+battle.debris.crystal};
              returnShips=battle.ships;
              returnHangars=battle.carriers;
              reportTitle=`Incursione Planetaria [${fleet.targetKey}]`;
              reportBody=`Orbitale: ${battle.orbit.result}, round ${battle.orbit.roundsPlayed}/3; `+
                `perdite Navi Madre ${battle.orbit.attackerLosses.mothership||0}. `+
                `Planetaria: ${battle.ground.result}, round ${battle.ground.roundsPlayed}/3; `+
                `perdite Caccia ${battle.ground.attackerLosses.lightFighter||0}. `+
                `Navi Madre rientranti ${battle.carriers.length}; Caccia recuperati ${battle.recoveredFighters}, `+
                `persi con i vettori ${battle.lostWithCarriers}. `+
                `Bottino: ${battle.loot.metal} M, ${battle.loot.crystal} C, ${battle.loot.deuterium} D. `+
                `Difese superstiti ${JSON.stringify(battle.defenderDefenses)}. Flotta superstite ${JSON.stringify(battle.defenderFleet)}.`;
              _writePlanetResult(tx,targetPlanetRef,targetBefore,targetPlanet,fDoc.id);
            }
          } else if (
            (fleet.mission === 'attack' || fleet.mission === 'destroyMoon' || fleet.mission === 'blockade' || fleet.mission === 'embargo' || fleet.mission === 'occupy') &&
            targetPlanet &&
            window.UniversumGalaxy?.resolveCombat
          ) {
            const defenderUidForTech = fleet.defenderUid || targetPlanet.ownerUid || null;
            let defenderTech = { weaponsTech: 0, shieldingTech: 0, armourTech: 0 };
            let defenderPlanetCount = 0;
            if (defenderUidForTech && !targetPlanet.isNpc) {
              const defenderSnap = await tx.get(uniRef.collection('players').doc(defenderUidForTech));
              if (defenderSnap.exists) {
                const defResearches = defenderSnap.data().researches || {};
                defenderPlanetCount = Number(defenderSnap.data().planetCount || 0);
                defenderTech = {
                  weaponsTech: Number(defResearches.weaponsTech || 0),
                  shieldingTech: Number(defResearches.shieldingTech || 0),
                  armourTech: Number(defResearches.armourTech || 0)
                };
              }
            }

            if (targetPlanet.fleet?.mothership) window.UniversumHangars?.normalizePlanet(targetPlanet);
            const defendingHangars = targetPlanet.mothershipHangars || [];
            const combat = window.UniversumGalaxy.resolveCombat(
              fleet.ships,
              fleet.attackerTech,
              {
                fleet: targetPlanet.fleet || {},
                defenses: targetPlanet.defenses || {},
                tech: defenderTech,
                resources: targetPlanet.resources,
                buildings: targetPlanet.buildings || {},
                moon: targetPlanet.moon || null
              },
              {
                ...(returnHangars.length ? {attackerTags:{mothership:returnHangars.map(h=>h.id)}} : {}),
                ...(defendingHangars.length ? {defenderTags:{mothership:defendingHangars.map(h=>h.id)}} : {})
              }
            );
            if (combat.attackerCrepuscoloDamaged && combat.attackerSurvivors.crepuscolo) crepuscoloDamaged=true;
            if (defendingHangars.length) {
              const alive=new Set(combat.defenderTagsAlive?.mothership || []);
              targetPlanet.mothershipHangars=defendingHangars.filter(h=>alive.has(h.id));
            }
            if (returnHangars.length) {
              const alive=new Set(combat.attackerTagsAlive?.mothership || []);
              returnHangars=returnHangars.filter(h=>alive.has(h.id));
            }

            targetPlanet.fleet = combat.defenderFleetSurvivors || combat.defenderSurvivors || {};
            targetPlanet.defenses = combat.repairedDefenses || combat.defenderDefenseSurvivors || {};
            targetPlanet.debris = {
              metal: (targetPlanet.debris?.metal || 0) + combat.debris.metal,
              crystal: (targetPlanet.debris?.crystal || 0) + combat.debris.crystal
            };

            if (fleet.mission === 'attack') {
              targetPlanet.resources.metal = Math.max(0, targetPlanet.resources.metal - combat.loot.metal);
              targetPlanet.resources.crystal = Math.max(0, targetPlanet.resources.crystal - combat.loot.crystal);
              targetPlanet.resources.deuterium = Math.max(0, targetPlanet.resources.deuterium - combat.loot.deuterium);
              returnShips = combat.attackerSurvivors;
              returnCargo.metal += combat.loot.metal;
              returnCargo.crystal += combat.loot.crystal;
              returnCargo.deuterium += combat.loot.deuterium;
              reportTitle = `Battaglia PvP su ${targetPlanet.name} [${fleet.targetKey}]`;
              reportBody = `Esito: ${combat.result}. Bottino: ${combat.loot.metal} M, ${combat.loot.crystal} C, ${combat.loot.deuterium} D.`;

              if (String(fleet.attackerUid || '').startsWith('npc_raid_')) {
                completeNow = true;
                returnShips = {};
                returnCargo = { metal: 0, crystal: 0, deuterium: 0 };
                reportTitle = `Raid BOT ${combat.result === 'attacker_win' ? 'riuscito' : 'respinto'} su ${targetPlanet.name}`;
              } else {
              const unitsLeft = (m) => Object.values(m || {}).reduce((a, q) => a + Math.max(0, Number(q) || 0), 0);
              const noDefendersLeft = unitsLeft(targetPlanet.fleet) === 0 && unitsLeft(targetPlanet.defenses) === 0;
              const hasConquestShip = (returnShips.colonyShip || 0) >= 1 || (returnShips.mothership || 0) >= 1;
              const canConquerOwner = targetWasNpc || defenderPlanetCount > 1;
              if (combat.result === 'attacker_win' && noDefendersLeft && hasConquestShip && targetPlanet.ownerUid !== fleet.attackerUid && !canConquerOwner) {
                reportBody += " Conquista impossibile: è l'ultimo pianeta del giocatore.";
              }
              if (combat.result === 'attacker_win' && noDefendersLeft && hasConquestShip && targetPlanet.ownerUid !== fleet.attackerUid && canConquerOwner) {
                const siegeIds = Array.from(new Set([targetPlanet.embargo?.fleetId, targetPlanet.occupation?.fleetId].filter(Boolean)));
                const siegeSnaps = [];
                for (const sid of siegeIds) siegeSnaps.push(await tx.get(uniRef.collection('fleets').doc(sid)));
                for (const sSnap of siegeSnaps) {
                  if (!sSnap.exists) continue;
                  const sf = normalizeOnlineFleet(sSnap.data(), sSnap.id);
                  if (sf.resolved || (sf.status !== 'embargo' && sf.status !== 'occupy')) continue;
                  // P1 FIX: usa la velocità reale già in scope (era hardcoded 10)
                  const sDurSec = window.UniversumGalaxy?.getFleetSpeedAndFuel
                    ? Math.max(5, window.UniversumGalaxy.getFleetSpeedAndFuel({ speed: speed, researches: {} }, sf.ships, window.UniversumGalaxy.calculateDistance(sf.targetCoords, sf.originCoords)).durationSec || 60)
                    : 60;
                  tx.update(sSnap.ref, {
                    status: 'returning', phase: 'IN RITORNO', resolved: false,
                    arrivalTime: now + sDurSec * 1000, returnTime: now + sDurSec * 1000
                  });
                }
                if ((returnShips.colonyShip || 0) >= 1) returnShips.colonyShip -= 1;
                targetPlanet.ownerUid = fleet.attackerUid;
                targetPlanet.ownerName = fleet.attackerName;
                targetPlanet.isNpc = false;
                targetPlanet.embargo = null;
                targetPlanet.occupation = null;
                targetPlanet.defenses = {};
                targetPlanet.fleet = {};
                reportTitle = `Pianeta Conquistato: ${targetPlanet.name} [${fleet.targetKey}]!`;
                reportBody = `Hai annientato le difese e annesso ${targetPlanet.name} al tuo Impero.`;
              }
              }
            } else if (fleet.mission === 'destroyMoon') {
              const hadMoon = Boolean(targetPlanet.moon);
              const dsCount = Math.max(0, Math.floor(Number(combat.attackerSurvivors?.deathStar || 0)));
              const destroyChance = 1 - Math.pow(0.90, dsCount);
              let moonDestroyed = false;
              if (combat.result === 'attacker_win' && dsCount > 0 && hadMoon && Math.random() < destroyChance) {
                targetPlanet.moon = null;
                moonDestroyed = true;
              }
              targetPlanet.resources.metal = Math.max(0, targetPlanet.resources.metal - combat.loot.metal);
              targetPlanet.resources.crystal = Math.max(0, targetPlanet.resources.crystal - combat.loot.crystal);
              targetPlanet.resources.deuterium = Math.max(0, targetPlanet.resources.deuterium - combat.loot.deuterium);
              returnShips = combat.attackerSurvivors;
              returnCargo.metal += combat.loot.metal;
              returnCargo.crystal += combat.loot.crystal;
              returnCargo.deuterium += combat.loot.deuterium;
              reportTitle = `Distruzione Luna/Bacino [${fleet.targetKey}]`;
              if (moonDestroyed) {
                reportBody = 'La Morte Nera ha polverizzato la Luna nemica con tutti i suoi edifici.';
              } else if (!hadMoon) {
                reportBody = 'Il pianeta non ha alcuna Luna da distruggere.';
              } else if (dsCount === 0) {
                reportBody = 'Nessuna Morte Nera nella flotta: missione fallita.';
              } else {
                reportBody = 'La Luna ha resistito al superlaser.';
              }
            } else if (fleet.mission === 'blockade' || fleet.mission === 'embargo') {
              if (combat.result === 'attacker_win') {
                targetPlanet.embargo = {
                  attackerUid: fleet.attackerUid,
                  attackerName: fleet.attackerName,
                  originCoords: fleet.originCoords,
                  ships: combat.attackerSurvivors,
                  ransom: fleet.ransom,
                  deuterium: Number(fleet.cargo?.deuterium || 0),
                  fleetId: fDoc.id,
                  startedAt: now
                };
                persistentStatus = 'embargo';
                siegeShips = combat.attackerSurvivors;
                returnShips = {};
                reportTitle = `Embargo Stabilito su ${targetPlanet.name} [${fleet.targetKey}]`;
                reportBody = `Spazio aereo bloccato. Riscatto richiesto: ${fleet.ransom.metal} M, ${fleet.ransom.crystal} C, ${fleet.ransom.deuterium} D.`;
              } else {
                returnShips = combat.attackerSurvivors;
                reportTitle = `Tentativo di Embargo Respinto [${fleet.targetKey}]`;
                reportBody = `Le difese di ${targetPlanet.name} hanno respinto il blocco navale.`;
              }
            } else if (fleet.mission === 'occupy') {
              if (combat.result === 'attacker_win') {
                targetPlanet.occupation = {
                  occupierUid: fleet.attackerUid,
                  occupierName: fleet.attackerName,
                  originCoords: fleet.originCoords,
                  garrisonShips: combat.attackerSurvivors,
                  ransom: fleet.ransom,
                  prelievoAccumulato: { metal: 0, crystal: 0, deuterium: 0 },
                  fleetId: fDoc.id,
                  startedAt: now,
                  lastTributeAt: now
                };
                persistentStatus = 'occupy';
                siegeShips = combat.attackerSurvivors;
                returnShips = {};
                reportTitle = `Pianeta Occupato: ${targetPlanet.name} [${fleet.targetKey}]`;
                reportBody = `Guarnigione schierata. Tributi automatici del 5% ogni 24h attivi.`;
              } else {
                returnShips = combat.attackerSurvivors;
                reportTitle = `Occupazione Respinta [${fleet.targetKey}]`;
                reportBody = `Assalto fallito su ${targetPlanet.name}.`;
              }
            }

            const fmtUnits = (map) => {
              const Data = window.UniversumData;
              const parts = Object.entries(map || {})
                .filter(([, cnt]) => Number(cnt) > 0)
                .map(([id, cnt]) => `${(Data?.SHIPS?.[id] || Data?.DEFENSES?.[id])?.name || id} x${Number(cnt).toLocaleString('it-IT')}`);
              return parts.length > 0 ? parts.join(', ') : 'nessuna';
            };
            reportBody += ` Dettagli battaglia — Round: ${combat.roundsPlayed}. Perdite attaccante: ${fmtUnits(combat.attackerLosses)}. Perdite difensore: ${fmtUnits(combat.defenderLosses)}. Superstiti attaccante: ${fmtUnits(combat.attackerSurvivors)}. Superstiti difensore: ${fmtUnits(combat.defenderFleetSurvivors)} (flotta), ${fmtUnits(combat.repairedDefenses)} (difese). Detriti: ${combat.debris.metal.toLocaleString('it-IT')} M, ${combat.debris.crystal.toLocaleString('it-IT')} C.`;

            _writePlanetResult(tx, targetPlanetRef, targetBefore, targetPlanet, fDoc.id);
          }

          // Riduzione di Nave Madre per eventi non bellici: nessun hangar
          // può tornare senza il proprio vettore fisico.
          if (!persistentStatus && returnHangars.length > Number(returnShips.mothership || 0)) {
            returnHangars=returnHangars.slice(0,Math.max(0,Math.floor(Number(returnShips.mothership || 0))));
          }
          if (completeNow && fleet.status === 'returning' && creditRef) {
            const dockReturn=fleet.originPlanetId && (returnShips.invictus || returnShips.crepuscolo);
            if (dockReturn || returnHangars.length) {
              const receiving=await tx.get(creditRef);
              if (!receiving.exists || receiving.data().ownerUid!==fleet.attackerUid) throw Error('Destinazione di rientro non più disponibile.');
              if (dockReturn) {
                tx.update(creditRef,{[`inbox.dockReturns.${fDoc.id}`]:{originPlanetId:fleet.originPlanetId,
                  originCoords:fleet.originCoords,birthBacinoAt:fleet.birthBacinoAt ?? null,arrivedAt:now,
                  crepuscoloDamaged:Boolean(fleet.crepuscoloDamaged),ships:{invictus:returnShips.invictus || 0,crepuscolo:returnShips.crepuscolo || 0}}});
                delete returnShips.invictus; delete returnShips.crepuscolo;
              }
            }
            if (returnHangars.length) {
              if (Number(returnShips.mothership || 0)!==returnHangars.length) throw Error('Rientro Nave Madre inconsistente.');
              tx.update(creditRef,{[`inbox.hangarReturns.${fDoc.id}`]:returnHangars});
            }
            const delivery = G.returnCargoWithRansom({...fleet,cargo:returnCargo});
            _inboxCredit(tx, creditRef, {
              resources: delivery,
              fleet: returnShips
            },creditEvents);
          }

          if (persistentStatus) {
            tx.update(fleetRef, {
              status: persistentStatus,
              phase: persistentStatus === 'embargo' ? 'IN EMBARGO' : 'IN OCCUPAZIONE',
              resolved: false,
              ships: siegeShips || {},
              carrierHangars:returnHangars,
              ...(crepuscoloDamaged ? {crepuscoloDamaged:true} : {}),
              fleet: siegeShips || {},
              siegeDeuterium: persistentStatus === 'embargo' ? Number(fleet.cargo?.deuterium || 0) : 0,
              siegeStartedAt: now,
              lastSiegeTickAt: now,
              schemaVersion: FLEET_SCHEMA_VERSION
            });
          } else if (completeNow) {
            tx.update(fleetRef, {
              status: 'completed', phase: 'COMPLETATA', resolved: true, completedAt: now,
              schemaVersion: FLEET_SCHEMA_VERSION
            });
          } else {
            const legMs = Math.max(5000, (Number(fleet.returnTime || now) - Number(fleet.arrivalTime || now)) || 60000);
            // Le spedizioni hanno già il rientro programmato alla partenza.
            // Se Firestore risolve in ritardo, NON allungare il viaggio:
            // il tick successivo accrediterà la flotta una sola volta.
            const isExploration = fleet.mission === 'expedition' || fleet.mission === 'explore';
            const plannedReturnAt = Number(fleet.returnTime || 0);
            const dueReturnAt = isExploration && plannedReturnAt >= Number(fleet.arrivalTime || 0)
              ? plannedReturnAt : now + legMs;
            localReturning = { ships: returnShips, cargo: returnCargo, carrierHangars:returnHangars, arrivalTime: dueReturnAt };
            tx.update(fleetRef, {
              status: 'returning',
              phase: 'IN RITORNO',
              resolved: false,
              ships: returnShips,
              fleet: returnShips,
              cargo: returnCargo,
              carrierHangars:returnHangars,
              ...(crepuscoloDamaged ? {crepuscoloDamaged:true} : {}),
              arrivalTime: dueReturnAt,
              returnTime: dueReturnAt,
              schemaVersion: FLEET_SCHEMA_VERSION
            });
          }

          const msgAttRef = uniRef.collection('messages').doc();
          tx.set(msgAttRef, {
            recipientUid: fleet.attackerUid,
            type: fleet.mission,
            title: reportTitle,
            body: reportBody,
            timestamp: now
          });

          if (fleet.status === 'outbound' && fleet.defenderUid && fleet.defenderUid !== fleet.attackerUid && !targetWasNpc && (fleet.mission !== 'spy' || defenderBody)) {
            const msgDefRef = uniRef.collection('messages').doc();
            tx.set(msgDefRef, {
              recipientUid: fleet.defenderUid,
              title: defenderTitle || reportTitle,
              body: defenderBody || `Comandante: ${fleet.attackerName}. ${reportBody}`,
              timestamp: now
            });
          }
        });

        const localUni = window.UniversumUI?.state?.currentUniverse;
        if (localUni?.id===uniId && galCredit && localUni.galatticaVersions?.[galCredit.key]===galCredit.previous) {
          const gal=localUni.galattiche.find(g=>g.id===galCredit.id);
          if (gal) {
            window.UniversumHangars.restore(gal,galCredit.manifest);
            for (const [id,n] of Object.entries(galCredit.ships)) gal.orbitingFleet[id]=(gal.orbitingFleet[id] || 0)+n;
            for (const k of ['metal','crystal','deuterium']) gal.resources[k]+=galCredit.cargo[k] || 0;
            localUni.galatticaVersions[galCredit.key]++;
          }
        }
        if (localUni && fleetNorm.attackerUid === currentUid) {
          if (localReturning) {
            const localFleet = (localUni.fleetsInFlight || []).find((f) => f.id === fDoc.id);
            if (localFleet) {
              localFleet.status = 'returning';
              localFleet.phase = 'IN RITORNO';
              localFleet.ships = localReturning.ships;
              localFleet.fleet = localReturning.ships;
              localFleet.cargo = localReturning.cargo;
              localFleet.carrierHangars = localReturning.carrierHangars;
              localFleet.arrivalTime = localReturning.arrivalTime;
              localFleet.returnTime = localReturning.arrivalTime;
            }
          } else {
            localUni.fleetsInFlight = (localUni.fleetsInFlight || []).filter((f) => f.id !== fDoc.id);
          }
          if (newlyColonizedPlanet && !localUni.planets.some((p) => p.id === newlyColonizedPlanet.id)) {
            localUni.planets.push(newlyColonizedPlanet);
            window.UniversumUI?.refreshPlanetSelector?.();
            window.UniversumUI?.toast?.(`Nuova colonia fondata: ${newlyColonizedPlanet.name}!`, 'success');
          }
        }
      } catch (err) {
        _mpNotifyError('risoluzione flotta', err);
        // Fase 3: mai eliminare una missione con hangar dopo un errore temporaneo.
        // Senza una transazione di rientro verificata perderemmo Navi Madre e
        // caccia: conserviamo il documento e lasciamo riprovare il resolver.
        if (!fleetNorm.originGalatticaKey && !fleetNorm.originPlanetId && !fleetNorm.carrierHangars?.length && fleetNorm.mission !== 'incursion' && Date.now() - _fleetDueTime(fleetNorm) > 60000) {
          await forceCleanupOnlineFleet(uniRef, fleetNorm, fleetRef, err.message || 'resolve-failed');
        }
      }
    }
  }

  Object.assign(G, { resolveArrivedOnlineFleets });

})();
