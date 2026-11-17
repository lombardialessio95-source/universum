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
        icon: '🧭',
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

    // Slot attualmente occupati (flotte in volo + eventuali embarchi/occupazioni attivi)
    getUsedFleetSlots(universe) {
      if (!universe) return 0;
      const inFlight = Array.isArray(universe.fleetsInFlight) ? universe.fleetsInFlight.length : 0;
      const activeSieges = Array.isArray(universe.activeSieges) ? universe.activeSieges.length : 0;
      return inFlight + activeSieges;
    },

    // Ore massime selezionabili in Esplorazione: 1h base + 1h per livello di expeditionTech
    getMaxExploreHours(universe) {
      const expLv = Math.max(0, Number(universe?.researches?.expeditionTech) || 0);
      return 1 + expLv;
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
      const effSpeed = window.UniversumEngine?.getEffectiveSpeed
        ? window.UniversumEngine.getEffectiveSpeed(universe)
        : Math.max(1, Number(universe?.speed) || 1);
      const holdDurationSec = mission === 'explore'
        ? Math.max(15, Math.floor((validExploreHours * 3600) / Math.sqrt(effSpeed)))
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
          hourlyBurn += (Data.SHIPS[sid].fuelConsumption || 10) * qty;
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
      const departureTime = Number(fleet.departureTime || (fleet.arrivalTime - 30000));
      const elapsedMs = Math.max(3000, now - departureTime);

      fleet.status = 'returning';
      fleet.recalled = true;
      fleet.returnStartTime = now;
      fleet.returnTime = now + elapsedMs;
      fleet.arrivalTime = fleet.returnTime;

      return fleet;
    }
  };

  window.UniversumMissionsCore = MissionsCore;
})();
