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
      .filter(({ fleet }) => !fleet.resolved && (fleet.status === 'outbound' || fleet.status === 'returning') && _fleetDueTime(fleet) <= now)
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
      const creditRef = fleetNorm.status === 'returning'
        ? await _resolveCreditRef(uniRef, fleetNorm.attackerUid, fleetNorm.originCoords)
        : null;
      let localReturning = null;

      try {
        await db.runTransaction(async (tx) => {
          const freshFleetSnap = await tx.get(fleetRef);
          if (!freshFleetSnap.exists || freshFleetSnap.data().resolved) return;
          const fleet = normalizeOnlineFleet(freshFleetSnap.data(), fDoc.id);
          if ((fleet.status !== 'outbound' && fleet.status !== 'returning') || _fleetDueTime(fleet) > Date.now()) return;

          const targetSnap = await tx.get(targetPlanetRef);

          const targetPlanet = targetSnap.exists ? _effectivePlanetView(targetSnap.data(), speed) : null;
          const targetBefore = _snapshotForDiff(targetPlanet);
          const targetWasNpc = Boolean(targetPlanet && targetPlanet.isNpc);

          let reportTitle = `Missione ${fleet.mission.toUpperCase()} [${fleet.targetKey}]`;
          let reportBody = 'Missione completata.';
          let returnShips = Object.assign({}, fleet.ships || {});
          let returnCargo = Object.assign({ metal: 0, crystal: 0, deuterium: 0 }, fleet.cargo || {});
          let completeNow = fleet.status === 'returning';
          let persistentStatus = null;
          let siegeShips = null;
          let defenderBody;
          let defenderTitle;

          if (fleet.status === 'returning' || fleet.mission === 'recall') {
            reportTitle = `Flotta Richiamata Rientrata [${coordsToKey(fleet.originCoords)}]`;
            reportBody = 'Le navi sono rientrate alla base con il carico integro.';
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
          } else if (fleet.mission === 'transport' && targetPlanet) {
            targetPlanet.resources.metal += returnCargo.metal;
            targetPlanet.resources.crystal += returnCargo.crystal;
            targetPlanet.resources.deuterium += returnCargo.deuterium;
            returnCargo = { metal: 0, crystal: 0, deuterium: 0 };
            _writePlanetResult(tx, targetPlanetRef, targetBefore, targetPlanet, fDoc.id);
            reportTitle = `Consegna Risorse su ${targetPlanet.name}`;
            reportBody = `Consegnati ${fleet.cargo.metal} M, ${fleet.cargo.crystal} C, ${fleet.cargo.deuterium} D.`;
          } else if (fleet.mission === 'deploy' && targetPlanet && targetPlanet.ownerUid === fleet.attackerUid) {
            for (const [sId, qty] of Object.entries(returnShips)) {
              targetPlanet.fleet[sId] = (targetPlanet.fleet[sId] || 0) + qty;
            }
            targetPlanet.resources.metal += returnCargo.metal;
            targetPlanet.resources.crystal += returnCargo.crystal;
            targetPlanet.resources.deuterium += returnCargo.deuterium;
            returnShips = {};
            returnCargo = { metal: 0, crystal: 0, deuterium: 0 };
            completeNow = true;
            _writePlanetResult(tx, targetPlanetRef, targetBefore, targetPlanet, fDoc.id);
            reportTitle = `Schieramento Completato su ${targetPlanet.name}`;
            reportBody = 'La flotta si è unita alla guarnigione locale.';
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
              }
            );

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

          if (completeNow && fleet.status === 'returning' && creditRef) {
            const ransomBack = fleet.pendingRansom || {};
            _inboxCredit(tx, creditRef, {
              resources: {
                metal: (returnCargo.metal || 0) + (ransomBack.metal || 0),
                crystal: (returnCargo.crystal || 0) + (ransomBack.crystal || 0),
                deuterium: (returnCargo.deuterium || 0) + (ransomBack.deuterium || 0)
              },
              fleet: returnShips
            });
          }

          if (persistentStatus) {
            tx.update(fleetRef, {
              status: persistentStatus,
              phase: persistentStatus === 'embargo' ? 'IN EMBARGO' : 'IN OCCUPAZIONE',
              resolved: false,
              ships: siegeShips || {},
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
            localReturning = { ships: returnShips, cargo: returnCargo, arrivalTime: now + legMs };
            tx.update(fleetRef, {
              status: 'returning',
              phase: 'IN RITORNO',
              resolved: false,
              ships: returnShips,
              fleet: returnShips,
              cargo: returnCargo,
              arrivalTime: now + legMs,
              returnTime: now + legMs,
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
        if (localUni && fleetNorm.attackerUid === currentUid) {
          if (localReturning) {
            const localFleet = (localUni.fleetsInFlight || []).find((f) => f.id === fDoc.id);
            if (localFleet) {
              localFleet.status = 'returning';
              localFleet.phase = 'IN RITORNO';
              localFleet.ships = localReturning.ships;
              localFleet.fleet = localReturning.ships;
              localFleet.cargo = localReturning.cargo;
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
        if (Date.now() - _fleetDueTime(fleetNorm) > 60000) {
          await forceCleanupOnlineFleet(uniRef, fleetNorm, fleetRef, err.message || 'resolve-failed');
        }
      }
    }
  }

  Object.assign(G, { resolveArrivedOnlineFleets });

})();
