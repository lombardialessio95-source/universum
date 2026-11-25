/** UNIVERSUM / modules/galaxy/fleet-tick.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumGalaxyModules;
  // Bridge lazy per le funzioni definite negli altri moduli.
  const addInvictusDebris = (...args) => G.addInvictusDebris(...args);
  const addMessage = (...args) => G.addMessage(...args);
  const beginCrepuscoloBattleRepair = (...args) => G.beginCrepuscoloBattleRepair(...args);
  const calculateDistance = (...args) => G.calculateDistance(...args);
  const findGalattica = (...args) => G.findGalattica(...args);
  const getFleetSpeedAndFuel = (...args) => G.getFleetSpeedAndFuel(...args);
  const handleMissionArrival = (...args) => G.handleMissionArrival(...args);
  const processBotAI = (...args) => G.processBotAI(...args);



  // *** MODIFICA C: arrivo della missione galattica-return ***
  function handleGalatticaReturnArrival(universe, flt, now) {
    const gal = findGalattica(universe, flt.originGalatticaId);
    const returningFleet = Object.assign({}, flt.fleet || flt.ships || {});
    const cargo = Object.assign({ metal: 0, crystal: 0, deuterium: 0 }, flt.cargo || {});

    if (gal) {
      window.UniversumServices?.settlePlanet(universe,homeP,now);
        for (const [id, qty] of Object.entries(returningFleet)) {
        const q = Math.max(0, Math.floor(Number(qty) || 0));
        if (q > 0) {
          gal.orbitingFleet[id] = (gal.orbitingFleet[id] || 0) + q;
        }
      }
      gal.resources.metal += cargo.metal;
      gal.resources.crystal += cargo.crystal;
      gal.resources.deuterium += cargo.deuterium;
      addMessage(universe, 'fleet', `Flotte rientrate alla Galattica [${gal.coords.g}:${gal.coords.s}:${gal.coords.p}].`, '');
      return 'remove';
    }

    // Galattica distrutta durante il rientro lento: dirotta al pianeta più vicino
    const totalRemaining = Object.values(returningFleet).reduce((acc, q) => acc + Math.max(0, Math.floor(Number(q) || 0)), 0);
    if (totalRemaining > 0 && (universe.planets || []).length > 0) {
      let nearest = null;
      let nearestDist = Infinity;
      for (const pl of universe.planets) {
        const d = calculateDistance(flt.targetCoords, pl.coords);
        if (d < nearestDist) { nearestDist = d; nearest = pl; }
      }
      if (nearest) {
        const stats = getFleetSpeedAndFuel(universe, returningFleet, nearestDist);
        const durationSec = Math.max(1, stats.durationSec) * 20;
        universe.fleetsInFlight.push({
          id: 'flt_galret_fallback_' + now,
          mission: 'deploy',
          status: 'returning',
          originPlanetId: nearest.id,
          originCoords: Object.assign({}, flt.targetCoords),
          targetCoords: Object.assign({}, nearest.coords),
          fleet: Object.assign({}, returningFleet),
          ships: Object.assign({}, returningFleet),
          cargo: Object.assign({}, cargo),
          departureTime: now,
          arrivalTime: now + durationSec * 1000,
          returnTime: now + durationSec * 1000,
          galatticaReturn: true
        });
        addMessage(universe, 'fleet',
          `Galattica distrutta durante il rientro lento delle flotte: dirottate al pianeta ${nearest.name} più vicino.`,
          '');
      }
    }
    return 'remove';
  }


  function processFleetsAndBots(universe,now = Date.now(),servicesOnly = false) {
    if (!universe) return;
    if (!Array.isArray(universe.fleetsInFlight)) universe.fleetsInFlight = [];

    for (let i = universe.fleetsInFlight.length - 1; i >= 0; i--) {
      const flt = universe.fleetsInFlight[i];
      if (servicesOnly && !window.UniversumServices.ids.some(id=>(flt.fleet || flt.ships)?.[id])) continue;
      if (!flt.fleet && flt.ships) flt.fleet = Object.assign({}, flt.ships);
      if (!flt.ships && flt.fleet) flt.ships = Object.assign({}, flt.fleet);

      if (flt.status === 'outbound' && now >= flt.arrivalTime) {
        if (flt.mission === 'galattica-return') {
          const action = handleGalatticaReturnArrival(universe, flt, now);
          if (action === 'remove') {
            universe.fleetsInFlight.splice(i, 1);
            continue;
          }
        } else {
          const action = handleMissionArrival(universe, flt, now);
          if (action === 'remove') {
            universe.fleetsInFlight.splice(i, 1);
            continue;
          }
        }
      }

      if (flt.status === 'returning' && now >= flt.returnTime) {
        // *** MODIFICA B: gestione ritorno da origine Galattica ***
        if (flt.originGalatticaId) {
          const gal = findGalattica(universe, flt.originGalatticaId);
          if (!gal) {
            // Galattica distrutta: dirotta al pianeta più vicino al 5%
            const returningFleet = Object.assign({}, flt.fleet || flt.ships || {});
            const totalRemaining = Object.values(returningFleet).reduce((acc, q) => acc + Math.max(0, Math.floor(Number(q) || 0)), 0);
            if (totalRemaining > 0 && (universe.planets || []).length > 0) {
              let nearest = null;
              let nearestDist = Infinity;
              for (const pl of universe.planets) {
                const d = calculateDistance(flt.targetCoords, pl.coords);
                if (d < nearestDist) { nearestDist = d; nearest = pl; }
              }
              if (nearest) {
                const stats = getFleetSpeedAndFuel(universe, returningFleet, nearestDist);
                const durationSec = Math.max(1, stats.durationSec) * 20;
                universe.fleetsInFlight.push({
                  id: 'flt_galret_fallback_' + now,
                  mission: 'deploy',
                  status: 'returning',
                  originPlanetId: nearest.id,
                  originCoords: Object.assign({}, flt.targetCoords),
                  targetCoords: Object.assign({}, nearest.coords),
                  fleet: Object.assign({}, returningFleet),
                  ships: Object.assign({}, returningFleet),
                  cargo: Object.assign({}, flt.cargo || { metal: 0, crystal: 0, deuterium: 0 }),
                  departureTime: now,
                  arrivalTime: now + durationSec * 1000,
                  returnTime: now + durationSec * 1000,
                  galatticaReturn: true
                });
                addMessage(universe, 'fleet',
                  'Galattica Distrutta, flotte in rientro deviato',
                  `La Galattica di partenza non esiste più: le flotte sono state dirotte al pianeta ${nearest.name} al 5% della velocità.`);
              }
            }
            universe.fleetsInFlight.splice(i, 1);
            continue;
          }

          // Galattica ancora alle vecchie coordinate? Aggancio normale
          if (gal.coords.g === flt.originCoords.g &&
              gal.coords.s === flt.originCoords.s &&
              gal.coords.p === flt.originCoords.p) {
            const returningFleet = Object.assign({}, flt.fleet || flt.ships || {});
            for (const [id, qty] of Object.entries(returningFleet)) {
              const q = Math.max(0, Math.floor(Number(qty) || 0));
              if (q > 0) {
                gal.orbitingFleet[id] = (gal.orbitingFleet[id] || 0) + q;
              }
            }
            gal.resources.metal += flt.cargo?.metal || 0;
            gal.resources.crystal += flt.cargo?.crystal || 0;
            gal.resources.deuterium += flt.cargo?.deuterium || 0;
            addMessage(universe, 'fleet',
              `Flotte rientrate alla Galattica [${gal.coords.g}:${gal.coords.s}:${gal.coords.p}].`,
              '');
            universe.fleetsInFlight.splice(i, 1);
            continue;
          }

          // Galattica spostata: crea missione galattica-return al 5%
          const returningFleet = Object.assign({}, flt.fleet || flt.ships || {});
          const distance = calculateDistance(flt.targetCoords, gal.coords);
          const stats = getFleetSpeedAndFuel(universe, returningFleet, distance);
          const durationSec = Math.max(1, stats.durationSec) * 20;
          universe.fleetsInFlight.push({
            id: 'flt_galret_' + now + '_' + Math.random().toString(36).substring(2, 6),
            mission: 'galattica-return',
            status: 'outbound',
            originPlanetId: null,
            originCoords: Object.assign({}, flt.targetCoords),
            targetCoords: Object.assign({}, gal.coords),
            fleet: Object.assign({}, returningFleet),
            ships: Object.assign({}, returningFleet),
            cargo: Object.assign({}, flt.cargo || { metal: 0, crystal: 0, deuterium: 0 }),
            departureTime: now,
            startTime: now,
            arrivalTime: now + durationSec * 1000,
            returnTime: now + durationSec * 2000,
            durationSec,
            originGalatticaId: gal.id,
            isGalatticaReturn: true
          });
          addMessage(universe, 'fleet',
            `Flotte in rientro dirottate: Galattica spostata a [${gal.coords.g}:${gal.coords.s}:${gal.coords.p}].`,
            `Viaggio al 5% della velocità, arrivo tra ${Math.round(durationSec / 60)} minuti.`);
          universe.fleetsInFlight.splice(i, 1);
          continue;
        }

        const homeP = universe.planets.find((p) => p.id === flt.originPlanetId) || universe.planets[0];
        const returningFleet = Object.assign({}, flt.fleet || flt.ships || {});
        const returningCrepuscolo = Math.max(0, Math.floor(Number(returningFleet.crepuscolo || 0)));
        if (returningCrepuscolo > 0) {
          delete returningFleet.crepuscolo;
          const exactHome = universe.planets.find((p) => p.id === flt.originPlanetId);
          const homeBacino = exactHome && exactHome.bacinoSpaziale;
          if (flt.crepuscoloDamaged) {
            if (homeBacino && homeBacino.status === 'active' && homeBacino.crepuscolo) {
              beginCrepuscoloBattleRepair(exactHome, now);
              addMessage(universe, 'fleet', `Crepuscolo in Riparazione [${flt.originCoords.g}:${flt.originCoords.s}:${flt.originCoords.p}]`,
                'La Crepuscolo degli Dei è tornata danneggiata al suo Bacino: riparazioni per 10 giorni reali.');
            } else {
              addMessage(universe, 'fleet', `Crepuscolo Distrutta al Rientro [${flt.originCoords.g}:${flt.originCoords.s}:${flt.originCoords.p}]`,
                'La Crepuscolo danneggiata stava tornando per le riparazioni, ma il suo Bacino era distrutto: nave perduta definitivamente.');
            }
          } else if (homeBacino && homeBacino.status === 'active' && homeBacino.crepuscolo) {
            homeBacino.crepuscolo.status = 'active';
          } else {
            const home = (universe.planets || [])[0];
            if (home) {
              const dist = calculateDistance(flt.originCoords, home.coords);
              const stats = getFleetSpeedAndFuel(universe, { crepuscolo: 1 }, dist);
              universe.crepuscoloLimbo = {
                status: 'travelling', homePlanetId: home.id,
                arrivalAt: now + Math.max(1, stats.durationSec) * 100 * 1000
              };
              addMessage(universe, 'fleet', `Crepuscolo in Viaggio verso il Pianeta Madre [${flt.originCoords.g}:${flt.originCoords.s}:${flt.originCoords.p}]`,
                'Il suo Bacino è distrutto: la Crepuscolo si sposta all\'1% della velocità verso il pianeta madre ed entrerà in stato LIMBO.');
            }
          }
        }
        const returningInvictus = Math.max(0, Math.floor(Number(returningFleet.invictus || 0)));
        if (returningInvictus > 0) {
          delete returningFleet.invictus;
          const exactHome = universe.planets.find((p) => p.id === flt.originPlanetId);
          if (exactHome && exactHome.bacinoSpaziale && exactHome.bacinoSpaziale.status === 'active') {
            exactHome.bacinoSpaziale.invictusActive = (Number(exactHome.bacinoSpaziale.invictusActive) || 0) + returningInvictus;
          } else {
            addInvictusDebris(universe, flt.originCoords, returningInvictus);
            addMessage(universe, 'fleet', `Invictus Persa al Rientro [${flt.originCoords.g}:${flt.originCoords.s}:${flt.originCoords.p}]`,
              `${returningInvictus} Invictus non ha trovato il suo Bacino (distrutto) ed è diventata detriti spaziali attorno al pianeta.`);
          }
        }
        if (homeP) {
            for (const [id, qty] of Object.entries(returningFleet)) {
            if (qty > 0) {
              homeP.fleet[id] = (homeP.fleet[id] || 0) + qty;
            }
          }
          window.UniversumServices?.settlePlanet(universe,homeP,now);
          homeP.resources.metal += flt.cargo?.metal || 0;
          homeP.resources.crystal += flt.cargo?.crystal || 0;
          homeP.resources.deuterium += flt.cargo?.deuterium || 0;
        }
        universe.fleetsInFlight.splice(i, 1);
      }
    }

    if (!servicesOnly) processBotAI(universe);
  }

  Object.assign(G, { handleGalatticaReturnArrival, processFleetsAndBots });

})();
