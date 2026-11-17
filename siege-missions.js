/**
 * UNIVERSUM — Motore Missioni Orbitali (Embargo, Occupazione, Spinta Variabile & Esplorazione)
 */
(function () {
  'use strict';

  const SiegeMissions = {
    sameCoords(a, b) {
      return Number(a?.g) === Number(b?.g) &&
             Number(a?.s) === Number(b?.s) &&
             Number(a?.p) === Number(b?.p);
    },

    // Verifica se un pianeta ha un embargo attivo (che impedisce partenze e arrivi)
    hasActiveEmbargo(universe, coords) {
      if (!universe || !coords) return null;
      const mySieges = (universe.activeSieges || []).find(
        (s) => s.type === 'embargo' && SiegeMissions.sameCoords(s.targetCoords, coords)
      );
      if (mySieges) return mySieges;

      const incSieges = (universe.incomingSieges || []).find(
        (s) => s.type === 'embargo' && SiegeMissions.sameCoords(s.targetCoords, coords)
      );
      return incSieges || null;
    },

    // Wrapper unificato per lanciare qualsiasi missione (incluse embargo, occupy, spinta % e ore esplorazione)
    launchEnhancedFleet(universe, planetIndex, targetCoords, mission, fleetSelection, cargo = {}, options = {}) {
      const Data = window.UniversumData;
      const Galaxy = window.UniversumGalaxy;
      const MCore = window.UniversumMissionsCore;

      const planet = universe.planets[planetIndex];
      if (!planet) throw new Error('Pianeta di partenza non valido.');

      // 1. Controllo Slot Flotta (5 base + Tecnologia Informatica)
      const maxSlots = MCore ? MCore.getMaxFleetSlots(universe) : 5;
      const usedSlots = MCore ? MCore.getUsedFleetSlots(universe) : (universe.fleetsInFlight || []).length;
      if (usedSlots >= maxSlots) {
        throw new Error(`Tutti gli slot flotta sono occupati (${usedSlots}/${maxSlots}). Potenzia Tecnologia Informatica!`);
      }

      // 2. Controllo Embargo su partenza o destinazione (solo un attacco di liberazione può ingaggiare)
      const originEmbargo = SiegeMissions.hasActiveEmbargo(universe, planet.coords);
      if (originEmbargo) {
        throw new Error(`Partenza bloccata! Il pianeta [${planet.coords.g}:${planet.coords.s}:${planet.coords.p}] è sotto Embargo Planetario.`);
      }
      const targetEmbargo = SiegeMissions.hasActiveEmbargo(universe, targetCoords);
      if (targetEmbargo && mission !== 'attack') {
        throw new Error(`Rotta bloccata! [${targetCoords.g}:${targetCoords.s}:${targetCoords.p}] è isolato da un Embargo Planetario.`);
      }

      // 3. Validazione navi selezionate
      const ships = {};
      let totalShips = 0;
      let totalCargoCapacity = 0;

      for (const [sid, rawQty] of Object.entries(fleetSelection || {})) {
        const qty = Math.max(0, Math.floor(Number(rawQty) || 0));
        if (qty <= 0) continue;
        const avail = Number(planet.fleet[sid] || 0);
        if (qty > avail) {
          throw new Error(`Navi insufficienti per ${Data.SHIPS[sid]?.name || sid}.`);
        }
        ships[sid] = qty;
        totalShips += qty;
        totalCargoCapacity += (Data.SHIPS[sid]?.cargo || 0) * qty;
      }

      if (totalShips <= 0) {
        throw new Error('Seleziona almeno una nave per avviare la missione.');
      }

      if (SiegeMissions.sameCoords(planet.coords, targetCoords)) {
        throw new Error('Le coordinate di destinazione coincidono con il pianeta di partenza.');
      }

      // 4. Calcolo distanza e statistiche con Spinta Carburante (10%-100%) ed Esplorazione
      const dist = Galaxy.calculateDistance(planet.coords, targetCoords);
      const fuelPercent = Math.min(100, Math.max(10, Number(options.fuelPercent) || 100));
      const exploreHours = mission === 'explore'
        ? Math.min(MCore ? MCore.getMaxExploreHours(universe) : 1, Math.max(1, Number(options.exploreHours) || 1))
        : 0;

      const stats = MCore
        ? MCore.getAdjustedFlightStats(universe, ships, dist, fuelPercent, exploreHours, mission)
        : Galaxy.getFleetSpeedAndFuel(universe, ships, dist);

      // 5. Controllo Carico e Riserva Deuterio per Embargo/Occupazione
      const loadM = Math.max(0, Math.floor(Number(cargo.metal) || 0));
      const loadC = Math.max(0, Math.floor(Number(cargo.crystal) || 0));
      const loadD = Math.max(0, Math.floor(Number(cargo.deuterium) || 0));
      const totalLoad = loadM + loadC + loadD;

      if (totalLoad > totalCargoCapacity) {
        throw new Error(`Capacità stiva superata (${totalLoad.toLocaleString('it-IT')} / ${totalCargoCapacity.toLocaleString('it-IT')}).`);
      }

      if (mission === 'embargo' && loadD < 500) {
        throw new Error('Per imporre un Embargo Planetario devi caricare almeno 500 Deuterio nelle stive per mantenere l’orbita!');
      }

      const blackHoleExtra = (mission === 'explore' && options.blackHole) ? 50000 : 0;
      const totalDeutNeeded = stats.fuelCost + loadD + blackHoleExtra;

      if (!universe.creativeMode) {
        if ((planet.resources.metal || 0) < loadM ||
            (planet.resources.crystal || 0) < loadC ||
            (planet.resources.deuterium || 0) < totalDeutNeeded) {
          throw new Error(`Risorse o Deuterio insufficienti (richiesti ${totalDeutNeeded.toLocaleString('it-IT')} D inclusi carburante e carico).`);
        }
        planet.resources.metal -= loadM;
        planet.resources.crystal -= loadC;
        planet.resources.deuterium -= totalDeutNeeded;
      }

      // Scala le navi dal pianeta
      for (const [sid, qty] of Object.entries(ships)) {
        planet.fleet[sid] = Math.max(0, (planet.fleet[sid] || 0) - qty);
      }

      const now = Date.now();
      const totalOutboundSec = stats.durationSec + (stats.holdDurationSec || 0);
      const arrivalTime = now + totalOutboundSec * 1000;
      const returnTime = arrivalTime + stats.durationSec * 1000;

      const ransomDemand = mission === 'occupy' ? {
        metal: Math.max(0, Math.floor(Number(options.ransom?.metal) || 0)),
        crystal: Math.max(0, Math.floor(Number(options.ransom?.crystal) || 0)),
        deuterium: Math.max(0, Math.floor(Number(options.ransom?.deuterium) || 0))
      } : null;

      const missionObj = {
        id: 'flt_' + now + '_' + Math.random().toString(36).slice(2, 7),
        originPlanetId: planet.id,
        originCoords: { ...planet.coords },
        targetCoords: { ...targetCoords },
        mission,
        ships,
        cargo: { metal: loadM, crystal: loadC, deuterium: loadD },
        fuelPercent,
        exploreHours,
        blackHole: Boolean(options.blackHole),
        ransomDemand,
        status: 'outbound',
        departureTime: now,
        arrivalTime,
        returnTime
      };

      if (!Array.isArray(universe.fleetsInFlight)) universe.fleetsInFlight = [];
      universe.fleetsInFlight.push(missionObj);

      return missionObj;
    },

    // Processa l'arrivo e il mantenimento continuo di Embargo, Occupazione ed Esplorazione potenziata
    tickSiegesAndMissions(universe) {
      if (!universe) return;
      const now = Date.now();
      if (!Array.isArray(universe.activeSieges)) universe.activeSieges = [];
      if (!Array.isArray(universe.incomingSieges)) universe.incomingSieges = [];
      if (!Array.isArray(universe.messages)) universe.messages = [];

      // A. Intercetta arrivi delle missioni speciali prima del resolver standard
      for (let i = (universe.fleetsInFlight || []).length - 1; i >= 0; i--) {
        const f = universe.fleetsInFlight[i];
        if (f.status !== 'outbound' || now < f.arrivalTime) continue;

        if (f.mission === 'embargo' || f.mission === 'occupy') {
          universe.fleetsInFlight.splice(i, 1);

          const siegeObj = {
            id: 'siege_' + now + '_' + Math.random().toString(36).slice(2, 6),
            type: f.mission, // 'embargo' | 'occupy'
            originPlanetId: f.originPlanetId,
            originCoords: { ...f.originCoords },
            targetCoords: { ...f.targetCoords },
            ships: { ...f.ships },
            cargo: { ...(f.cargo || { metal: 0, crystal: 0, deuterium: 0 }) },
            fuelRemaining: Number(f.cargo?.deuterium || 0),
            ransom: f.ransomDemand || { metal: 10000, crystal: 5000, deuterium: 2500 },
            startedAt: now,
            lastTickAt: now
          };

          universe.activeSieges.push(siegeObj);
          universe.messages.unshift({
            id: 'msg_' + now + '_' + Math.random().toString(36).slice(2, 5),
            title: f.mission === 'embargo'
              ? `Embargo Planetario attivo su [${f.targetCoords.g}:${f.targetCoords.s}:${f.targetCoords.p}]`
              : `Occupazione Planetaria avviata su [${f.targetCoords.g}:${f.targetCoords.s}:${f.targetCoords.p}]`,
            body: f.mission === 'embargo'
              ? `Le rotte commerciali e militari del bersaglio sono bloccate finché c'è deuterio in stiva (${siegeObj.fuelRemaining.toLocaleString('it-IT')} D).`
              : `La flotta preleva il 5% giornaliero delle risorse del pianeta finché c'è deuterio disponibile o finché non viene pagato il riscatto.`,
            time: now
          });
        } else if (f.mission === 'explore' && Number(f.exploreHours || 1) > 1) {
          // Bonus moltiplicato per le ore di esplorazione extra
          const mult = Number(f.exploreHours || 1);
          const bonusM = Math.floor((2500 + Math.random() * 6000) * mult * Math.sqrt(universe.speed || 1));
          const bonusC = Math.floor((1800 + Math.random() * 4500) * mult * Math.sqrt(universe.speed || 1));
          const bonusD = Math.floor((900 + Math.random() * 2500) * mult * Math.sqrt(universe.speed || 1));

          f.cargo.metal = (f.cargo.metal || 0) + bonusM;
          f.cargo.crystal = (f.cargo.crystal || 0) + bonusC;
          f.cargo.deuterium = (f.cargo.deuterium || 0) + bonusD;
          f.status = 'returning';

          universe.messages.unshift({
            id: 'msg_' + now + '_' + Math.random().toString(36).slice(2, 5),
            title: `Spedizione Profonda (${mult}h) completata`,
            body: `Anomalie mappate con successo! Recuperati +${bonusM.toLocaleString('it-IT')} M, +${bonusC.toLocaleString('it-IT')} C, +${bonusD.toLocaleString('it-IT')} D.`,
            time: now
          });
        }
      }

      // B. Aggiornamento continuo degli Embarchi & Occupazioni attivi
      const Data = window.UniversumData;
      for (let i = universe.activeSieges.length - 1; i >= 0; i--) {
        const s = universe.activeSieges[i];
        const elapsedSec = Math.max(0, (now - (s.lastTickAt || now)) / 1000);
        if (elapsedSec < 1) continue;
        s.lastTickAt = now;

        // Calcola consumo orario dei motori in orbita
        let hourlyBurn = 0;
        for (const [sid, qty] of Object.entries(s.ships || {})) {
          hourlyBurn += (Data.SHIPS[sid]?.fuelConsumption || 10) * Number(qty || 0);
        }
        hourlyBurn = Math.max(40, hourlyBurn);
        const burnThisTick = (hourlyBurn / 3600) * elapsedSec;

        if (s.type === 'embargo') {
          s.fuelRemaining = Math.max(0, (s.fuelRemaining || 0) - burnThisTick);
          if (s.fuelRemaining <= 0) {
            // Carburante esaurito: rientro automatico alla base
            SiegeMissions.withdrawSiege(universe, s.id, 'Carburante embargo esaurito: flotta in rientro.');
          }
        } else if (s.type === 'occupy') {
          // Prelievo 5% al giorno = 0.05 / 86400 al secondo, alimentato dal deuterio locale o di bordo
          const dailyRate = 0.05 / 86400;
          const lootM = Math.floor(120000 * dailyRate * elapsedSec * Math.sqrt(universe.speed || 1));
          const lootC = Math.floor(80000 * dailyRate * elapsedSec * Math.sqrt(universe.speed || 1));
          const lootD = Math.floor(45000 * dailyRate * elapsedSec * Math.sqrt(universe.speed || 1));

          s.cargo.metal = (s.cargo.metal || 0) + lootM;
          s.cargo.crystal = (s.cargo.crystal || 0) + lootC;
          s.cargo.deuterium = (s.cargo.deuterium || 0) + lootD;

          // Consuma deuterio dal bottino o dalla riserva
          if ((s.cargo.deuterium || 0) >= burnThisTick) {
            s.cargo.deuterium -= burnThisTick;
          } else {
            SiegeMissions.withdrawSiege(universe, s.id, 'Deuterio esaurito sul pianeta occupato: flotta in rientro con il bottino.');
          }
        }
      }
    },

    // Ritira manualmente una flotta in embargo/occupazione facendola rientrare con il bottino
    withdrawSiege(universe, siegeId, reasonText = '') {
      const idx = (universe.activeSieges || []).findIndex((s) => s.id === siegeId);
      if (idx === -1) return;
      const siege = universe.activeSieges.splice(idx, 1)[0];

      const Galaxy = window.UniversumGalaxy;
      const dist = Galaxy.calculateDistance(siege.originCoords, siege.targetCoords);
      const stats = Galaxy.getFleetSpeedAndFuel(universe, siege.ships, dist);
      const now = Date.now();

      universe.fleetsInFlight.push({
        id: 'flt_ret_' + now + '_' + Math.random().toString(36).slice(2, 6),
        originPlanetId: siege.originPlanetId,
        originCoords: { ...siege.originCoords },
        targetCoords: { ...siege.targetCoords },
        mission: siege.type,
        ships: { ...siege.ships },
        cargo: {
          metal: Math.floor(siege.cargo?.metal || 0),
          crystal: Math.floor(siege.cargo?.crystal || 0),
          deuterium: Math.floor(siege.cargo?.deuterium || 0)
        },
        status: 'returning',
        departureTime: now - stats.durationSec * 1000,
        arrivalTime: now,
        returnStartTime: now,
        returnTime: now + stats.durationSec * 1000
      });

      if (reasonText) {
        universe.messages.unshift({
          id: 'msg_' + now,
          title: `Fine operazione orbitale [${siege.targetCoords.g}:${siege.targetCoords.s}:${siege.targetCoords.p}]`,
          body: reasonText,
          time: now
        });
      }
    },

    // Il difensore paga il riscatto per liberare il proprio pianeta dall'occupazione
    payOccupationRansom(universe, incomingSiegeId) {
      const idx = (universe.incomingSieges || []).findIndex((s) => s.id === incomingSiegeId);
      if (idx === -1) throw new Error('Occupazione non più attiva.');
      const siege = universe.incomingSieges[idx];
      const planet = universe.planets.find((p) => SiegeMissions.sameCoords(p.coords, siege.targetCoords));
      if (!planet) throw new Error('Pianeta non trovato.');

      const rM = Number(siege.ransom?.metal || 0);
      const rC = Number(siege.ransom?.crystal || 0);
      const rD = Number(siege.ransom?.deuterium || 0);

      if ((planet.resources.metal || 0) < rM ||
          (planet.resources.crystal || 0) < rC ||
          (planet.resources.deuterium || 0) < rD) {
        throw new Error('Risorse insufficienti sul pianeta per pagare il riscatto richiesto.');
      }

      planet.resources.metal -= rM;
      planet.resources.crystal -= rC;
      planet.resources.deuterium -= rD;
      universe.incomingSieges.splice(idx, 1);

      window.UniversumUI?.toast('Riscatto pagato! La flotta occupante ha lasciato l’orbita.', 'success');
    },

    // Il difensore lancia un contrattacco locale contro la flotta orbitale
    attackOrbitingSiege(universe, incomingSiegeId) {
      const idx = (universe.incomingSieges || []).findIndex((s) => s.id === incomingSiegeId);
      if (idx === -1) throw new Error('Flotta orbitale non più presente.');
      const siege = universe.incomingSieges[idx];
      const planet = universe.planets.find((p) => SiegeMissions.sameCoords(p.coords, siege.targetCoords));
      if (!planet) throw new Error('Pianeta non trovato.');

      const combat = window.UniversumGalaxy.resolveCombat(planet.fleet, universe.researches, {
        fleet: siege.ships || {},
        defenses: {},
        tech: { weaponsTech: 2, shieldingTech: 2, armourTech: 2 },
        resources: { metal: 0, crystal: 0, deuterium: 0 },
        buildings: {}
      });

      planet.fleet = combat.attackerRemaining;
      if (combat.result === 'attacker_win') {
        universe.incomingSieges.splice(idx, 1);
        window.UniversumUI?.toast('Flotta orbitale distrutta! Il blocco sul pianeta è stato spezzato.', 'success');
      } else {
        siege.ships = combat.defenderRemaining;
        window.UniversumUI?.toast('Contrattacco respinto: la flotta nemica mantiene ancora l’orbita!', 'error');
      }
    }
  };

  // Aggancia automaticamente il tick degli assedi dentro il loop principale senza toccare engine-core.js
  const origTick = window.UniversumEngine?.tick;
  if (typeof origTick === 'function') {
    window.UniversumEngine.tick = function (universe, deltaSec) {
      origTick.call(window.UniversumEngine, universe, deltaSec);
      SiegeMissions.tickSiegesAndMissions(universe);
    };
  }

  window.UniversumSiege = SiegeMissions;
})();
