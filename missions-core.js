/**
 * UNIVERSUM — Plugin Core Missioni Avanzate, Carburante Variabile & Slot Flotta
 */
(function () {
  'use strict';

  // 1. Registra la nuova ricerca "Esplorazione Spaziale Profonda" su UniversumData
  function registerExplorationResearch() {
    const Data = window.UniversumData;
    if (!Data || !Data.RESEARCHES) return;
    if (!Data.RESEARCHES.expeditionTech) {
      Data.RESEARCHES.expeditionTech = {
        id: 'expeditionTech',
        name: 'Esplorazione Spaziale Profonda',
        icon: 'radar',
        description: 'Estende l’autonomia delle sonde e delle flotte esplorative: +1 ora massima di durata missione per livello.',
        baseCost: { metal: 3000, crystal: 6000, deuterium: 3000 },
        factor: 1.85,
        requirements: {
          buildings: { researchLab: 4 },
          researches: { astrophysics: 1, impulseDrive: 3 }
        }
      };
    }
  }

  registerExplorationResearch();

  const MissionsCore = {
    BASE_FLEET_SLOTS: 5,

    // Slot massimi: 5 base + 1 per livello di Tecnologia Informatica
    getMaxFleetSlots(universe) {
      const compLv = Math.max(0, Number(universe?.researches?.computerTech) || 0);
      return MissionsCore.BASE_FLEET_SLOTS + compLv;
    },

    // Slot attualmente occupati:
    // flotte in volo + embarghi/occupazioni attivi + 1 slot per ogni Galattica esistente
    // (Fase 5 decisione B2: la Galattica occupa uno slot flotta reale, indipendentemente
    // dallo stato: ferma, in salto, in costruzione NON conta finché non è completata).
    getUsedFleetSlots(universe) {
      if (!universe) return 0;
      const inFlight = Array.isArray(universe.fleetsInFlight) ? universe.fleetsInFlight.length : 0;
      const activeSieges = Array.isArray(universe.activeSieges) ? universe.activeSieges.length : 0;
      const galattiche = Array.isArray(universe.galattiche) ? universe.galattiche.length : 0;
      return inFlight + activeSieges + galattiche;
    },

    // Ore massime selezionabili in Esplorazione: 1h base + 1h per livello di expeditionTech
    getMaxExploreHours(universe) {
      const expLv = Math.max(0, Number(universe?.researches?.expeditionTech) || 0);
      return 1 + expLv;
    },

    // Una sola formula per la permanenza esplorativa planetaria, Galattica e online.
    // La durata del volo militare NON viene modificata.
    getExplorationHoldDurationSec(universe, hours) {
      const maximum = MissionsCore.getMaxExploreHours(universe);
      const validHours = Math.min(maximum, Math.max(1, Math.floor(Number(hours) || 1)));
      const effectiveSpeed = window.UniversumEngine?.getEffectiveSpeed
        ? window.UniversumEngine.getEffectiveSpeed(universe)
        : Math.max(1, Number(universe?.speed) || 1);
      return Math.max(15, Math.floor(validHours * 3600 / Math.sqrt(Math.max(1, effectiveSpeed))));
    },

    // Per il resolver esistente arrivalTime resta la FINE dell'esplorazione,
    // non il primo arrivo: aggiungiamo gli istanti distinti senza cambiare
    // il significato dei timestamp preesistenti.
    buildExplorationTimeline(departureMs, travelSec, holdSec) {
      const travelDurationMs = Math.max(5000, Math.floor(Number(travelSec) || 0) * 1000);
      const explorationHoldMs = Math.max(0, Math.floor(Number(holdSec) || 0) * 1000);
      const zoneArrivalTime = departureMs + travelDurationMs;
      const explorationEndTime = zoneArrivalTime + explorationHoldMs;
      return {
        travelDurationMs,
        returnTravelDurationMs: travelDurationMs,
        explorationHoldMs,
        zoneArrivalTime,
        explorationEndTime,
        arrivalTime: explorationEndTime,
        returnTime: explorationEndTime + travelDurationMs
      };
    },

    // Compatibilità con i vecchi salvataggi: la differenza tra returnTime e
    // arrivalTime contiene la singola tratta, NON le ore di permanenza.
    getExplorationTimeline(fleet) {
      if (!fleet || (!['explore', 'expedition'].includes(fleet.mission)
        && !(fleet.mission === 'recall' && Number(fleet.zoneArrivalTime || 0) > 0))) return null;
      const departureTime = Number(fleet.departureTime || fleet.startTime || 0);
      const explorationEndTime = Number(fleet.explorationEndTime || fleet.arrivalTime || 0);
      const legacyReturnMs = Number(fleet.returnTime || 0) - Number(fleet.arrivalTime || 0);
      const travelDurationMs = [fleet.travelDurationMs, fleet.returnTravelDurationMs,
        (Number(fleet.durationSec) || 0) * 1000, legacyReturnMs]
        .map(Number).find(v => Number.isFinite(v) && v >= 5000) || 0;
      const zoneArrivalTime = Number(fleet.zoneArrivalTime || 0)
        || (departureTime > 0 && travelDurationMs > 0 ? departureTime + travelDurationMs : 0);
      return {
        departureTime, zoneArrivalTime, explorationEndTime, travelDurationMs,
        returnTime: Number(fleet.returnTime || 0)
      };
    },

    // Richiamo prima dell'arrivo: percorre al ritorno la distanza già coperta.
    // Dopo l'arrivo: SOLO la durata di una tratta, mai lo stazionamento.
    getRecallDurationMs(fleet, now = Date.now()) {
      const departureTime = Number(fleet?.departureTime || fleet?.startTime || 0);
      const elapsedMs = Math.max(2000, now - (departureTime || now));
      const timeline = MissionsCore.getExplorationTimeline(fleet);
      if (!timeline || !timeline.travelDurationMs || !timeline.zoneArrivalTime) return elapsedMs;
      if (now >= timeline.zoneArrivalTime) return timeline.travelDurationMs;
      return Math.max(2000, Math.min(elapsedMs, timeline.travelDurationMs));
    },

    // Calcola velocità, durata e consumo carburante in base alla % potenza/carburante (10% - 100%)
    getAdjustedFlightStats(universe, fleetSelection, distance, fuelPercent = 100, exploreHours = 1, mission = 'attack') {
      const Galaxy = window.UniversumGalaxy;
      const pct = Math.min(100, Math.max(10, Math.round(Number(fuelPercent) || 100)));
      const base = Galaxy.getFleetSpeedAndFuel(universe, fleetSelection, distance);

      // Riducendo la % carburante, il consumo cala quasi quadraticamente e la durata aumenta
      const speedFactor = pct / 100;
      const fuelFactor = Math.pow(speedFactor, 1.75);

      const travelDurationSec = Math.max(5, Math.ceil(base.durationSec / speedFactor));
      let fuelCost = Math.max(1, Math.ceil(base.fuelCost * fuelFactor));

      // In esplorazione, ogni ora extra in orbita aggiunge un piccolo consumo di mantenimento
      const validExploreHours = mission === 'explore'
        ? Math.min(MissionsCore.getMaxExploreHours(universe), Math.max(1, Number(exploreHours) || 1))
        : 0;

      if (mission === 'explore' && validExploreHours > 1) {
        fuelCost += Math.ceil(fuelCost * 0.25 * (validExploreHours - 1));
      }

      // Durata stazionamento in esplorazione scalata sulla velocità universo
      const holdDurationSec = mission === 'explore'
        ? MissionsCore.getExplorationHoldDurationSec(universe, validExploreHours)
        : 0;

      return {
        fuelPercent: pct,
        durationSec: travelDurationSec,
        holdDurationSec,
        exploreHours: validExploreHours,
        fuelCost,
        minSpeed: base.minSpeed || 0
      };
    },

    // Calcola l'autonomia in ore di un Embargo Planetario in base al deuterio caricato nei cargo
    calculateEmbargoHours(fleetSelection, cargoDeuterium) {
      const Data = window.UniversumData;
      let hourlyBurn = 0;
      for (const [sid, count] of Object.entries(fleetSelection || {})) {
        const qty = Number(count) || 0;
        if (qty > 0 && Data.SHIPS[sid]) {
          hourlyBurn += Data.getShipFuelConsumption(sid) * qty;
        }
      }
      hourlyBurn = Math.max(50, hourlyBurn);
      const deut = Math.max(0, Number(cargoDeuterium) || 0);
      return Number((deut / hourlyBurn).toFixed(2));
    },

    // Richiama una flotta in volo (solo se in fase 'outbound')
    recallFleet(universe, fleetId) {
      if (!universe || !Array.isArray(universe.fleetsInFlight)) {
        throw new Error('Nessuna flotta attiva trovata.');
      }
      const idx = universe.fleetsInFlight.findIndex((f) => f.id === fleetId);
      if (idx === -1) throw new Error('Missione non più presente.');

      const fleet = universe.fleetsInFlight[idx];
      if (fleet.status !== 'outbound') {
        throw new Error('La flotta è già sulla rotta di rientro.');
      }

      const now = Date.now();
      const recallDurationMs = MissionsCore.getRecallDurationMs(fleet, now);

      fleet.status = 'returning';
      fleet.recalled = true;
      fleet.returnStartTime = now;
      fleet.returnTime = now + Math.max(3000, recallDurationMs);
      fleet.arrivalTime = fleet.returnTime;

      return fleet;
    }
  };

  window.UniversumMissionsCore = MissionsCore;
})();
