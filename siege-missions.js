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

    formatUnitList(map) {
      const Data = window.UniversumData;
      const parts = Object.entries(map || {})
        .filter(([, cnt]) => Number(cnt) > 0)
        .map(([id, cnt]) => `${(Data.SHIPS[id] || Data.DEFENSES[id])?.name || id} x${Number(cnt).toLocaleString('it-IT')}`);
      return parts.length > 0 ? parts.join(', ') : 'nessuna';
    },

    combatDetails(combat) {
      if (!combat) return '';
      return `Perdite attaccante: ${SiegeMissions.formatUnitList(combat.attackerLosses)}. ` +
        `Perdite difensore: ${SiegeMissions.formatUnitList(combat.defenderLosses)}. ` +
        `Superstiti attaccante: ${SiegeMissions.formatUnitList(combat.attackerSurvivors)}. ` +
        `Superstiti difensore: ${SiegeMissions.formatUnitList(combat.defenderFleetSurvivors)} (flotta), ${SiegeMissions.formatUnitList(combat.repairedDefenses)} (difese).`;
    },

    // Difensore all'arrivo: pianeta del giocatore oppure slot BOT procedurale
    getSiegeTarget(universe, coords) {
      const planet = (universe.planets || []).find((p) => SiegeMissions.sameCoords(p.coords, coords));
      if (planet) {
        return {
          kind: 'planet',
          planet,
          slot: null,
          data: {
            fleet: planet.fleet || {},
            defenses: planet.defenses || {},
            tech: universe.researches || {},
            resources: planet.resources || { metal: 0, crystal: 0, deuterium: 0 },
            buildings: planet.buildings || {},
            moon: planet.moon || null
          }
        };
      }
      const slot = window.UniversumGalaxy?.generateProceduralSlot
        ? window.UniversumGalaxy.generateProceduralSlot(universe, coords.g, coords.s, coords.p)
        : null;
      if (!slot || slot.ownerType !== 'bot') return { kind: 'none', planet: null, slot, data: null };
      return {
        kind: 'bot',
        planet: null,
        slot,
        data: {
          fleet: slot.fleet || {},
          defenses: slot.defenses || {},
          tech: slot.tech || {},
          resources: slot.resources || { metal: 0, crystal: 0, deuterium: 0 },
          buildings: slot.buildings || {},
          moon: slot.moon || null
        }
      };
    },

    // Applica esiti difensivi dopo la battaglia (flotta/difese/detriti, senza bottino istantaneo)
    applySiegeDefenderOutcome(universe, target, combat, coords) {
      if (target.kind === 'planet' && target.planet) {
        target.planet.fleet = { ...(combat.defenderFleetSurvivors || {}) };
        target.planet.defenses = { ...(combat.repairedDefenses || {}) };
        return;
      }
      if (target.kind === 'bot') {
        const key = `${coords.g}:${coords.s}:${coords.p}`;
        if (!universe.galaxyDeltas) universe.galaxyDeltas = {};
        const prev = universe.galaxyDeltas[key] || {};
        universe.galaxyDeltas[key] = {
          ...prev,
          fleetOverride: { ...(combat.defenderFleetSurvivors || {}) },
          defensesOverride: { ...(combat.repairedDefenses || {}) },
          resourcesOverride: { ...(target.data.resources || {}) },
          debris: {
            metal: (prev.debris?.metal || 0) + (combat.debris?.metal || 0),
            crystal: (prev.debris?.crystal || 0) + (combat.debris?.crystal || 0)
          }
        };
      }
    },

    targetDeuterium(universe, siege) {
      const planet = (universe.planets || []).find((p) => SiegeMissions.sameCoords(p.coords, siege.targetCoords));
      if (planet) return Number(planet.resources?.deuterium || 0);
      if (typeof siege.targetDeuterium === 'number') return siege.targetDeuterium;
      const slot = window.UniversumGalaxy?.generateProceduralSlot
        ? window.UniversumGalaxy.generateProceduralSlot(universe, siege.targetCoords.g, siege.targetCoords.s, siege.targetCoords.p)
        : null;
      return Number(slot?.resources?.deuterium || 0);
    },

    // Deuterio rimasto mostrato da barra/contatore, distinto per tipo
    getSiegeDeuteriumRemaining(universe, siege) {
      if (!siege) return 0;
      if (siege.type === 'occupy') return Math.max(0, Math.floor(SiegeMissions.targetDeuterium(universe, siege)));
      return Math.max(0, Math.floor(Number(siege.fuelRemaining ?? siege.cargo?.deuterium ?? 0)));
    },

    getSiegeDeuteriumInitial(siege) {
      if (!siege) return 0;
      const initial = Number(siege.deuteriumInitial || 0);
      if (initial > 0) return initial;
      return siege.type === 'occupy'
        ? Math.max(0, Math.floor(Number(siege.targetDeuterium || 0)))
        : Math.max(0, Math.floor(Number(siege.fuelRemaining ?? siege.cargo?.deuterium ?? 0)));
    },

    // Wrapper unificato per lanciare qualsiasi missione (incluse embargo, occupy, spinta % e ore esplorazione)
    launchEnhancedFleet(universe, planetIndex, targetCoords, mission, fleetSelection, cargo = {}, options = {}) {
      const Data = window.UniversumData;
      const Galaxy = window.UniversumGalaxy;
      const MCore = window.UniversumMissionsCore;

      const planet = universe.planets[planetIndex];
      if (!planet) throw new Error('Pianeta di partenza non valido.');

      // 1. Controllo Slot Flotta (5 base + Tecnologia Informatica)
      const maxSlots = MCore ? MCore.getMaxFleetSlots(universe) : (5 + Number(universe.researches?.computerTech || 0));
      const usedSlots = MCore ? MCore.getUsedFleetSlots(universe) : (universe.fleetsInFlight || []).length;
      if (usedSlots >= maxSlots) {
        throw new Error(`Tutti gli slot flotta sono occupati (${usedSlots}/${maxSlots}). Potenzia Tecnologia Informatica!`);
      }

      // 2. Controllo Embargo su partenza o destinazione (solo un attacco di liberazione puÃ² ingaggiare)
      const originEmbargo = SiegeMissions.hasActiveEmbargo(universe, planet.coords);
      if (originEmbargo && mission !== 'attack') {
        throw new Error(`Partenza bloccata! Il pianeta [${planet.coords.g}:${planet.coords.s}:${planet.coords.p}] Ã¨ sotto Embargo Planetario.`);
      }
      const targetEmbargo = SiegeMissions.hasActiveEmbargo(universe, targetCoords);
      if (targetEmbargo && mission !== 'attack') {
        throw new Error(`Rotta bloccata! [${targetCoords.g}:${targetCoords.s}:${targetCoords.p}] Ã¨ isolato da un Embargo Planetario.`);
      }

      const specialistTransfer = window.UniversumServices?.transfer(universe,mission,targetCoords,fleetSelection);
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

      const orbitingAtOrigin = (universe.incomingSieges || []).some(
        (s) => SiegeMissions.sameCoords(s.targetCoords, planet.coords)
      );
      if (SiegeMissions.sameCoords(planet.coords, targetCoords) && !(mission === 'attack' && orbitingAtOrigin)) {
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

      if (specialistTransfer) window.UniversumServices.settlePlanet(universe,planet);
      if (totalLoad > (specialistTransfer ? Math.max(0,totalCargoCapacity-stats.fuelCost) : totalCargoCapacity)) {
        throw new Error(`CapacitÃ  stiva superata (${totalLoad.toLocaleString('it-IT')} / ${totalCargoCapacity.toLocaleString('it-IT')}).`);
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
      } else if (blackHoleExtra) {
        if (!(planet.resources.deuterium>=blackHoleExtra)) throw Error('Servono 50.000 Deuterio per il Buco Nero.');
        planet.resources.deuterium-=blackHoleExtra;
      }

      // Scala le navi dal pianeta
      for (const [sid, qty] of Object.entries(ships)) {
        planet.fleet[sid] = Math.max(0, (planet.fleet[sid] || 0) - qty);
      }

      const now = Date.now();
      if (specialistTransfer) window.UniversumServices.settlePlanet(universe,planet);
      const timeline = mission === 'explore' && MCore?.buildExplorationTimeline
        ? MCore.buildExplorationTimeline(now, stats.durationSec, stats.holdDurationSec || 0)
        : null;
      const totalOutboundSec = stats.durationSec + (stats.holdDurationSec || 0);
      const arrivalTime = timeline ? timeline.arrivalTime : now + totalOutboundSec * 1000;
      const returnTime = timeline ? timeline.returnTime : arrivalTime + stats.durationSec * 1000;

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
        ...(mission==='explore' ? {rewardRulesVersion:2, rewardTech:{...universe.researches}, blackHoleFeePaid:blackHoleExtra} : {}),
        options: { blackHole: Boolean(options.blackHole) },
        ransomDemand,
        status: 'outbound',
        departureTime: now,
        arrivalTime,
        returnTime,
        ...(timeline || {})
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

        if (f.mission === 'embargo' || f.mission === 'occupy' || f.mission === 'blockade') {
          const siegeType = f.mission === 'occupy' ? 'occupy' : 'embargo';
          const key = `${f.targetCoords.g}:${f.targetCoords.s}:${f.targetCoords.p}`;
          const target = SiegeMissions.getSiegeTarget(universe, f.targetCoords);
          const Galaxy = window.UniversumGalaxy;

          if (!target.data || !Galaxy?.resolveCombat) {
            f.status = 'returning';
            f.returnTime = now + 60000;
            universe.messages.unshift({
              id: 'msg_' + now + '_' + Math.random().toString(36).slice(2, 5),
              type: 'combat',
              title: `Missione ${siegeType === 'embargo' ? 'Embargo' : 'Occupazione'} annullata [${key}]`,
              body: 'Nessun bersaglio valido alle coordinate: la flotta rientra alla base.',
              time: now
            });
            continue;
          }

          // Battaglia preliminare: solo chi vince puo' imporre embargo/occupazione
          const combat = Galaxy.resolveCombat(f.ships || f.fleet || {}, universe.researches, target.data);
          SiegeMissions.applySiegeDefenderOutcome(universe, target, combat, f.targetCoords);

          // Report per l'attaccato (difensore) nel diario di bordo
          universe.messages.unshift({
            id: 'msg_def_' + now + '_' + Math.random().toString(36).slice(2, 5),
            type: 'combat',
            title: `Rapporto Difesa [${key}] — ${combat.result.toUpperCase()} (${siegeType === 'embargo' ? 'Embargo' : 'Occupazione'})`,
            body: `Il pianeta attaccato ha affrontato la flotta ${siegeType === 'embargo' ? 'da embargo' : 'di occupazione'}. Round: ${combat.roundsPlayed}. ${SiegeMissions.combatDetails(combat)}`,
            time: now
          });

          const survivors = combat.attackerSurvivors || {};
          const survivorCount = Object.values(survivors).reduce((acc, q) => acc + Number(q || 0), 0);

          if (combat.result !== 'attacker_win' || survivorCount <= 0) {
            universe.messages.unshift({
              id: 'msg_' + now + '_' + Math.random().toString(36).slice(2, 5),
              type: 'combat',
              title: `Rapporto Battaglia [${key}] — ${combat.result.toUpperCase()} (${siegeType === 'embargo' ? 'Embargo' : 'Occupazione'} respinto)`,
              body: `Round: ${combat.roundsPlayed}. Detriti: ${combat.debris.metal.toLocaleString('it-IT')} M, ${combat.debris.crystal.toLocaleString('it-IT')} C. ${SiegeMissions.combatDetails(combat)}`,
              time: now
            });
            if (survivorCount <= 0) {
              universe.fleetsInFlight.splice(i, 1);
            } else {
              f.ships = { ...survivors };
              f.fleet = { ...survivors };
              f.status = 'returning';
              const back = Galaxy.getFleetSpeedAndFuel ? Galaxy.getFleetSpeedAndFuel(universe, survivors, Galaxy.calculateDistance(f.targetCoords, f.originCoords)) : { durationSec: 60 };
              f.returnTime = now + Math.max(5, back.durationSec || 60) * 1000;
              f.arrivalTime = f.returnTime;
            }
            continue;
          }

          universe.fleetsInFlight.splice(i, 1);
          const startFuel = siegeType === 'embargo' ? Number(f.cargo?.deuterium || 0) : 0;
          const targetDeut = Number(target.data.resources?.deuterium || 0);
          const siegeObj = {
            id: 'siege_' + now + '_' + Math.random().toString(36).slice(2, 6),
            type: siegeType,
            originPlanetId: f.originPlanetId,
            originCoords: { ...f.originCoords },
            targetCoords: { ...f.targetCoords },
            targetName: target.planet?.name || target.slot?.name || key,
            ships: { ...survivors },
            cargo: { ...(f.cargo || { metal: 0, crystal: 0, deuterium: 0 }) },
            fuelRemaining: startFuel,
            targetDeuterium: targetDeut,
            deuteriumInitial: siegeType === 'embargo' ? startFuel : targetDeut,
            ransom: f.ransomDemand || f.ransom || { metal: 10000, crystal: 5000, deuterium: 2500 },
            startedAt: now,
            lastTickAt: now
          };
          if (siegeType === 'embargo') siegeObj.cargo.deuterium = startFuel;

          universe.activeSieges.push(siegeObj);
          universe.messages.unshift({
            id: 'msg_' + now + '_' + Math.random().toString(36).slice(2, 5),
            type: 'combat',
            title: siegeType === 'embargo'
              ? `Embargo Planetario attivo su [${key}]`
              : `Occupazione Planetaria avviata su [${key}]`,
            body: (siegeType === 'embargo'
              ? `Battaglia vinta. Rotte da/per il pianeta bloccate finche' resta deuterio in stiva (${Math.floor(siegeObj.fuelRemaining).toLocaleString('it-IT')} D). `
              : `Battaglia vinta. La flotta occupa il pianeta: preleva il 5% delle risorse al giorno e consuma il deuterio del pianeta occupato (${Math.floor(targetDeut).toLocaleString('it-IT')} D). `) +
              `Round: ${combat.roundsPlayed}. ${SiegeMissions.combatDetails(combat)}`,
            time: now
          });

        }
      }

      // B. Aggiornamento continuo degli embarghi & Occupazioni attivi
      const Data = window.UniversumData;
      for (let i = universe.activeSieges.length - 1; i >= 0; i--) {
        const s = universe.activeSieges[i];
        const elapsedSec = Math.max(0, (now - (s.lastTickAt || now)) / 1000);
        if (elapsedSec < 1) continue;
        s.lastTickAt = now;

        // Calcola consumo orario dei motori in orbita
        let hourlyBurn = 0;
        for (const [sid, qty] of Object.entries(s.ships || {})) {
          hourlyBurn += Data.getShipFuelConsumption(sid) * Number(qty || 0);
        }
        hourlyBurn = Math.max(40, hourlyBurn);
        const burnThisTick = (hourlyBurn / 3600) * elapsedSec;

        if (s.type === 'embargo') {
          // Embargo: dura finche' le stive della flotta assediante hanno Deuterio
          if (typeof s.fuelRemaining !== 'number') s.fuelRemaining = Number(s.cargo?.deuterium || 0);
          if (!s.deuteriumInitial) s.deuteriumInitial = s.fuelRemaining;
          s.fuelRemaining = Math.max(0, s.fuelRemaining - burnThisTick);
          s.cargo.deuterium = s.fuelRemaining;
          if (s.fuelRemaining <= 0) {
            SiegeMissions.withdrawSiege(universe, s.id, 'Deuterio in stiva esaurito: embargo terminato, flotta in rientro.');
          }
        } else if (s.type === 'occupy') {
          // Occupazione: ruba il 5%/giorno delle risorse reali del pianeta e ne consuma il Deuterio
          const target = SiegeMissions.getSiegeTarget(universe, s.targetCoords);
          const res = target.data?.resources;
          if (!res) {
            SiegeMissions.withdrawSiege(universe, s.id, 'Pianeta occupato non piu raggiungibile: flotta in rientro con il bottino.');
            continue;
          }
          if (!s.deuteriumInitial) s.deuteriumInitial = Number(res.deuterium || 0);

          const rate = (0.05 / 86400) * elapsedSec;
          if (!s.theftPending) s.theftPending = { metal: 0, crystal: 0, deuterium: 0 };
          s.theftPending.metal += Number(res.metal || 0) * rate;
          s.theftPending.crystal += Number(res.crystal || 0) * rate;
          s.theftPending.deuterium += Number(res.deuterium || 0) * rate;

          for (const k of ['metal', 'crystal', 'deuterium']) {
            const take = Math.floor(s.theftPending[k]);
            if (take > 0) {
              const actual = Math.min(take, Math.floor(Number(res[k] || 0)));
              res[k] = Math.max(0, Number(res[k] || 0) - actual);
              s.cargo[k] = (s.cargo[k] || 0) + actual;
              s.theftPending[k] -= take;
            }
          }

          // Mantenimento orbitale pagato con il Deuterio del pianeta occupato
          const deutBefore = Number(res.deuterium || 0);
          res.deuterium = Math.max(0, deutBefore - burnThisTick);
          s.targetDeuterium = res.deuterium;

          if (target.kind === 'bot') {
            const key = `${s.targetCoords.g}:${s.targetCoords.s}:${s.targetCoords.p}`;
            if (!universe.galaxyDeltas) universe.galaxyDeltas = {};
            universe.galaxyDeltas[key] = {
              ...(universe.galaxyDeltas[key] || {}),
              resourcesOverride: { metal: res.metal, crystal: res.crystal, deuterium: res.deuterium }
            };
          }

          if (s.targetDeuterium <= 0) {
            SiegeMissions.withdrawSiege(universe, s.id, 'Deuterio del pianeta occupato esaurito: occupazione terminata, flotta in rientro con il bottino.');
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
      if (idx === -1) throw new Error('Occupazione non piÃ¹ attiva.');
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
      if (idx === -1) throw new Error('Flotta orbitale non piÃ¹ presente.');
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

      planet.fleet = combat.attackerSurvivors;
      if (!Array.isArray(universe.messages)) universe.messages = [];
      universe.messages.unshift({
        id: 'msg_def_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        type: 'combat',
        title: `Rapporto Difesa [${siege.targetCoords.g}:${siege.targetCoords.s}:${siege.targetCoords.p}] — ${combat.result.toUpperCase()} (Flotta orbitale)`,
        body: `${planet.name} ha ingaggiato la flotta nemica in orbita (${siege.type === 'occupy' ? 'Occupazione' : 'Embargo'}). Round: ${combat.roundsPlayed}. Detriti: ${combat.debris.metal.toLocaleString('it-IT')} M, ${combat.debris.crystal.toLocaleString('it-IT')} C. ${SiegeMissions.combatDetails(combat)}`,
        time: Date.now()
      });
      if (combat.result === 'attacker_win') {
        universe.incomingSieges.splice(idx, 1);
        window.UniversumUI?.toast('Flotta orbitale distrutta! Il blocco sul pianeta Ã¨ stato spezzato.', 'success');
      } else {
        siege.ships = combat.defenderFleetSurvivors;
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
