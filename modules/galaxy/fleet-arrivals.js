/** UNIVERSUM / modules/galaxy/fleet-arrivals.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumGalaxyModules;
  // Bridge lazy per le funzioni definite negli altri moduli.
  const assignCrepuscoloWreck = (...args) => G.assignCrepuscoloWreck(...args);
  const coordKey = (...args) => G.coordKey(...args);
  const findGalatticaAt = (...args) => G.findGalatticaAt(...args);
  const generateProceduralSlot = (...args) => G.generateProceduralSlot(...args);
  const getCrepuscoloState = (...args) => G.getCrepuscoloState(...args);
  const isBacinoVuoto = (...args) => G.isBacinoVuoto(...args);
  const makeMoon = (...args) => G.makeMoon(...args);
  const resolveCombat = (...args) => G.resolveCombat(...args);



  function formatUnitList(map) {
    const Data = window.UniversumData;
    const parts = Object.entries(map || {})
      .filter(([, cnt]) => Number(cnt) > 0)
      .map(([id, cnt]) => `${(Data.SHIPS[id] || Data.DEFENSES[id])?.name || id} x${Number(cnt).toLocaleString('it-IT')}`);
    return parts.length > 0 ? parts.join(', ') : 'nessuna';
  }


  function formatCombatDetails(combat) {
    if (!combat) return '';
    return `Perdite attaccante: ${formatUnitList(combat.attackerLosses)}. ` +
      `Perdite difensore: ${formatUnitList(combat.defenderLosses)}. ` +
      `Superstiti attaccante: ${formatUnitList(combat.attackerSurvivors)}. ` +
      `Superstiti difensore: ${formatUnitList(combat.defenderFleetSurvivors)} (flotta), ${formatUnitList(combat.repairedDefenses)} (difese dopo riparazione).`;
  }


  function addMessage(universe, type, title, body) {
    if (!Array.isArray(universe.messages)) universe.messages = [];
    universe.messages.unshift({
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      time: Date.now(),
      type,
      title,
      body
    });
    if (universe.messages.length > 80) {
      universe.messages.length = 80;
    }
  }


  function deployOrdinaryShips(inventory, ships) {
    const returning = {};
    for (const [id, qty] of Object.entries(ships)) {
      if (!(qty > 0)) continue;
      if (id === 'invictus' || id === 'crepuscolo') returning[id] = qty;
      else inventory[id] = (inventory[id] || 0) + qty;
    }
    return returning;
  }

  function handleMissionArrival(universe, flt, now = Date.now()) {
    const key = coordKey(flt.targetCoords.g, flt.targetCoords.s, flt.targetCoords.p);
    if (!universe.galaxyDeltas) universe.galaxyDeltas = {};

    if (!flt.fleet && flt.ships) flt.fleet = Object.assign({}, flt.ships);
    if (!flt.ships && flt.fleet) flt.ships = Object.assign({}, flt.fleet);

    if (flt.mission === 'spy') {
      const slot = generateProceduralSlot(universe, flt.targetCoords.g, flt.targetCoords.s, flt.targetCoords.p);
      if (slot.ownerType !== 'bot') {
        addMessage(universe, 'spy', `Spionaggio [${key}]`, 'Nessuna civiltà rilevata alle coordinate indicate.');
      } else {
        const probes = flt.fleet.espionageProbe || 1;
        const myEsp = Number(universe.researches?.espionageTech || 0);
        const defEsp = Number(slot.tech?.espionageTech || 0);
        const defProbes = Number(slot.fleet?.espionageProbe || 0);

        const {diff,probesLost} = G.evaluateEspionage(probes,myEsp,defEsp,defProbes);
        flt.fleet.espionageProbe = Math.max(0, probes - probesLost);
        flt.ships = Object.assign({}, flt.fleet);

        if (!Array.isArray(universe.spyReports)) universe.spyReports = [];
        const prevScans = universe.spyReports.filter((r) => r.key === key).length;

        const report = {
          id: 'spy_' + now + '_' + Math.random().toString(36).substring(2, 5),
          time: now,
          key,
          coords: Object.assign({}, flt.targetCoords),
          targetName: slot.name,
          emperor: slot.emperor,
          tier: slot.tier,
          personality: slot.personality,
          scanCount: prevScans + 1,
          resources: Object.assign({}, slot.resources),
          fleet: diff >= 0 ? Object.assign({}, slot.fleet) : null,
          defenses: diff >= 1 ? Object.assign({}, slot.defenses) : null,
          buildings: diff >= 2 ? Object.assign({}, slot.buildings) : null,
          tech: diff >= 3 ? Object.assign({}, slot.tech) : null,
          hasMoon: Boolean(slot.moon)
        };
        universe.spyReports.unshift(report);
        if (universe.spyReports.length > 50) universe.spyReports.length = 50;

        addMessage(
          universe,
          'spy',
          `Rapporto Spia: ${slot.name} [${key}]`,
          `Scansione #${report.scanCount} completata su ${slot.emperor} (${slot.tier}). Risorse: ${slot.resources.metal.toLocaleString()} M, ${slot.resources.crystal.toLocaleString()} C, ${slot.resources.deuterium.toLocaleString()} D. Sonde perse: ${probesLost}.`
        );
      }
      flt.status = 'returning';
      return;
    }

    if (flt.mission === 'colonize') {
      const slot = generateProceduralSlot(universe, flt.targetCoords.g, flt.targetCoords.s, flt.targetCoords.p);
      const isSlotFree = slot.ownerType === 'empty' || slot.ownerType === 'none' || slot.type === 'empty';
      if (!isSlotFree) {
        addMessage(universe, 'fleet', `Colonizzazione Fallita [${key}]`, 'Lo slot è già occupato da un altro pianeta. La flotta torna alla base.');
        flt.status = 'returning';
        return;
      }

      if ((flt.fleet.colonyShip || 0) < 1) {
        addMessage(universe, 'fleet', `Colonizzazione Fallita [${key}]`, 'Nessuna Colonizzatrice presente nella flotta.');
        flt.status = 'returning';
        return;
      }

      flt.fleet.colonyShip = Math.max(0, (flt.fleet.colonyShip || 1) - 1);
      flt.ships = Object.assign({}, flt.fleet);

      const colNum = universe.planets.length + 1;
      const colName = `Colonia ${colNum}`;
      const newPlanet = {
        id: 'planet_' + now + '_' + Math.random().toString(36).substring(2, 6),
        name: colName,
        coords: Object.assign({}, flt.targetCoords),
        minTemp: slot.minTemp,
        maxTemp: slot.maxTemp,
        fieldsMax: slot.fieldsMax,
        resources: {
          metal: 1000 + (flt.cargo.metal || 0),
          crystal: 1000 + (flt.cargo.crystal || 0),
          deuterium: 500 + (flt.cargo.deuterium || 0)
        },
        buildings: {
          metalMine: 0, crystalMine: 0, deuteriumSynth: 0, solarPlant: 0, fusionReactor: 0,
          roboticsFactory: 0, naniteFactory: 0, shipyard: 0, metalStorage: 0, crystalStorage: 0,
          deuteriumTank: 0, researchLab: 0, terraformer: 0, hiddenBunker: 0
        },
        defenses: {},
        fleet: {},
        buildQueue: [],
        shipyardQueue: [],
        defenseQueue: [],
        localResearches: {},
        localResearchQueue: null,
        moon: null,
        bacinoSpaziale: null
      };

      universe.planets.push(newPlanet);
      universe.galaxyDeltas[key] = Object.assign({}, universe.galaxyDeltas[key], {
        destroyed: false,
        owner: 'player',
        ownerType: 'player',
        emperor: universe.emperor,
        planetName: colName,
        planetId: newPlanet.id
      });

      if (window.UniversumUI?.refreshPlanetSelector) {
        window.UniversumUI.refreshPlanetSelector();
      }

      flt.cargo = { metal: 0, crystal: 0, deuterium: 0 };
      flt.status = 'returning';
      addMessage(universe, 'fleet', `Nuova Colonia Fondata [${key}]`, `${colName} (${slot.fieldsMax} campi) è ora parte del tuo Impero!`);
      return;
    }

    if (flt.mission === 'transport' || flt.mission === 'deploy') {
      const destPlanet = universe.planets.find(
        (p) => p.coords.g === flt.targetCoords.g && p.coords.s === flt.targetCoords.s && p.coords.p === flt.targetCoords.p
      );
      if (destPlanet) {
        window.UniversumServices?.settlePlanet(universe,destPlanet,now);
        destPlanet.resources.metal += flt.cargo.metal;
        destPlanet.resources.crystal += flt.cargo.crystal;
        destPlanet.resources.deuterium += flt.cargo.deuterium;
        flt.cargo = { metal: 0, crystal: 0, deuterium: 0 };

        if (flt.mission === 'deploy') {
          if (flt.carrierHangars?.length) window.UniversumHangars.restore(destPlanet,flt.carrierHangars);
          const returning = deployOrdinaryShips(destPlanet.fleet,flt.fleet);
          flt.carrierHangars=[];
          window.UniversumServices?.settlePlanet(universe,destPlanet,now);
          if (Object.keys(returning).length) {
            flt.ships={...returning}; flt.fleet=returning; flt.status='returning';
            addMessage(universe,'fleet','Schieramento completato','Carico e unità ordinarie consegnati. Le unità speciali rientrano al Bacino.');
            return;
          }
          addMessage(universe, 'fleet', `Flotta Schierata su ${destPlanet.name}`, 'Navi e risorse trasferite con successo.');
          return 'remove';
        }
        addMessage(universe, 'fleet', `Trasporto Consegnato su ${destPlanet.name}`, 'Risorse scaricate. La flotta rientra.');
      }
      flt.status = 'returning';
      return;
    }

    if (flt.mission === 'recycle') {
      const slot = generateProceduralSlot(universe, flt.targetCoords.g, flt.targetCoords.s, flt.targetCoords.p);
      const debris = slot.debris || { metal: 0, crystal: 0 };
      const Data = window.UniversumData;
      let recCap = 0;
      for (const [id, qty] of Object.entries(flt.fleet)) {
        recCap += (Data.SHIPS[id]?.cargo || 0) * qty;
      }
      const alreadyLoaded = flt.cargo.metal + flt.cargo.crystal + flt.cargo.deuterium;
      const freeCap = Math.max(0, recCap - alreadyLoaded);

      const takeM = Math.min(debris.metal, Math.floor(freeCap * 0.6));
      const takeC = Math.min(debris.crystal, freeCap - takeM);

      flt.cargo.metal += takeM;
      flt.cargo.crystal += takeC;
      universe.galaxyDeltas[key] = Object.assign({}, universe.galaxyDeltas[key], {
        debris: {
          metal: Math.max(0, debris.metal - takeM),
          crystal: Math.max(0, debris.crystal - takeC)
        }
      });

      addMessage(universe, 'fleet', `Raccolta Detriti [${key}]`, `Riciclati ${takeM.toLocaleString()} Metallo e ${takeC.toLocaleString()} Cristallo.`);
      flt.status = 'returning';
      return;
    }

    if (flt.mission === 'explore') {
      const crepDef = window.UniversumData.CREPUSCOLO;
      const exploreHours = Number(flt.exploreHours || flt.options?.exploreHours || 1);
      const deathStarsArrived = Math.max(0, Math.floor(Number((flt.fleet || {}).deathStar || 0)));
      if (!(flt.options && flt.options.blackHole) && exploreHours >= crepDef.wreckExploreHours && deathStarsArrived >= crepDef.wreckMinDeathStars && Math.random() < crepDef.wreckChance) {
        if (getCrepuscoloState(universe).has) {
          addMessage(universe, 'expedition', `Relitto Crepuscolo Perso [${key}]`,
            'Avete trovato il relitto di una Crepuscolo degli Dei, ma ne possedete già una nel vostro impero (max 1): il relitto è andato perso.');
        } else {
          const emptyPlanet = (universe.planets || []).find((pl) => isBacinoVuoto(pl, universe));
          if (!emptyPlanet) {
            addMessage(universe, 'expedition', `Relitto Crepuscolo Sparito [${key}]`,
              'Avete trovato il relitto di una Crepuscolo degli Dei, ma non esiste un Bacino Spaziale vuoto (Bacini inesistenti oppure attualmente occupati): il relitto è sparito nello spazio profondo.');
          } else if (assignCrepuscoloWreck(universe, emptyPlanet)) {
            addMessage(universe, 'expedition', `🌌 RELITTO CREPUSCOLO RECUPERATO [${key}]!`,
              `Il relitto di una Crepuscolo degli Dei è stato agganciato al Bacino Spaziale vuoto su ${emptyPlanet.name}: riparazione di ${crepDef.wreckRepairDays} giorni reali avviata.`);
          }
        }
        flt.status = 'returning';
        return;
      }
      const roll = Math.random();
      if (flt.options && flt.options.blackHole) {
        if (roll < 0.05) {
          flt.cargo.metal += 500000;
          flt.cargo.crystal += 300000;
          flt.cargo.deuterium += 200000;
          addMessage(universe, 'expedition', `🌌 SINGOLARITÀ SUPERATA [${key}]!`, 'La flotta emerge dall’orizzonte degli eventi con 1.000.000 di risorse esotiche!');
        } else if (roll < 0.35) {
          for (const id of Object.keys(flt.fleet)) {
            flt.fleet[id] = Math.floor(flt.fleet[id] * 0.7);
          }
          flt.ships = Object.assign({}, flt.fleet);
          addMessage(universe, 'expedition', `⚠️ Anomalia Gravitazionale [${key}]`, 'Il Buco Nero ha danneggiato il 30% della flotta esplorativa.');
        } else {
          flt.cargo.deuterium += 25000;
          addMessage(universe, 'expedition', `Spedizione Buco Nero [${key}]`, 'Raccolti 25.000 isotopi di Deuterio puro dalla corona.');
        }
      } else {
        if (roll < 0.35) {
          const foundM = Math.floor(15000 + Math.random() * 45000);
          const foundC = Math.floor(10000 + Math.random() * 30000);
          flt.cargo.metal += foundM;
          flt.cargo.crystal += foundC;
          addMessage(universe, 'expedition', `Giacimento Asteroidi [${key}]`, `Trovati ${foundM.toLocaleString()} Metallo e ${foundC.toLocaleString()} Cristallo.`);
        } else if (roll < 0.55) {
          flt.fleet.lightFighter = (flt.fleet.lightFighter || 0) + 5;
          flt.fleet.cruiser = (flt.fleet.cruiser || 0) + 1;
          flt.ships = Object.assign({}, flt.fleet);
          addMessage(universe, 'expedition', `Relitto Flotta Abbandonata [${key}]`, 'Recuperati 5 Caccia Leggeri e 1 Incrociatore ancora funzionanti!');
        } else if (roll < 0.62) {
          const originP = universe.planets.find((p) => p.id === flt.originPlanetId) || universe.planets[0];
          if (originP && originP.resources.metal >= 250000 && originP.resources.crystal >= 125000) {
            originP.resources.metal -= 250000;
            originP.resources.crystal -= 125000;
            flt.fleet.deathStar = (flt.fleet.deathStar || 0) + 1;
            flt.ships = Object.assign({}, flt.fleet);
            addMessage(universe, 'expedition', `☠️ RELITTO ANTICO RIPARATO [${key}]!`, 'I tuoi ingegneri hanno riparato una Morte Nera antica usando 250k Metallo e 125k Cristallo!');
          } else {
            flt.cargo.metal += 80000;
            addMessage(universe, 'expedition', `Relitto Antico [${key}]`, 'Trovato scafo di Morte Nera irrecuperabile senza 250k M / 125k C: smantellati 80.000 Metallo.');
          }
        } else if (roll < 0.80) {
          const pirateCombat = resolveCombat(flt.fleet, universe.researches, {
            fleet: { lightFighter: 12, cruiser: 3 },
            defenses: {},
            tech: { weaponsTech: 3, shieldingTech: 3, armourTech: 3 },
            resources: { metal: 12000, crystal: 8000, deuterium: 2000 }
          });
          flt.fleet = pirateCombat.attackerSurvivors;
          flt.ships = Object.assign({}, flt.fleet);
          if (pirateCombat.attackerCrepuscoloDamaged && Number(flt.fleet.crepuscolo || 0) > 0) flt.crepuscoloDamaged = true;
          flt.cargo.metal += pirateCombat.loot.metal;
          flt.cargo.crystal += pirateCombat.loot.crystal;
          addMessage(universe, 'combat', `Imboscata Pirata [${key}]`, `Esito: ${pirateCombat.result}. Round: ${pirateCombat.roundsPlayed}. Bottino recuperato: ${pirateCombat.loot.metal.toLocaleString()} M / ${pirateCombat.loot.crystal.toLocaleString()} C / ${pirateCombat.loot.deuterium.toLocaleString()} D. Detriti: ${pirateCombat.debris.metal.toLocaleString()} M, ${pirateCombat.debris.crystal.toLocaleString()} C. ${formatCombatDetails(pirateCombat)}`);
        } else {
          addMessage(universe, 'expedition', `Spedizione Tranquilla [${key}]`, 'Nessuna anomalia rilevata nel settore.');
        }
      }
      flt.status = 'returning';
      return;
    }

    if (flt.mission === 'embargo' || flt.mission === 'occupy' || flt.mission === 'blockade') {
      const siegeType = flt.mission === 'occupy' ? 'occupy' : 'embargo';
      const slot = generateProceduralSlot(universe, flt.targetCoords.g, flt.targetCoords.s, flt.targetCoords.p);
      const ownPlanet = universe.planets.find((p) => p.coords.g === flt.targetCoords.g && p.coords.s === flt.targetCoords.s && p.coords.p === flt.targetCoords.p);
      const defenderData = ownPlanet
        ? { fleet: ownPlanet.fleet || {}, defenses: ownPlanet.defenses || {}, tech: universe.researches || {}, resources: ownPlanet.resources, buildings: ownPlanet.buildings || {}, moon: ownPlanet.moon || null }
        : slot;
      if (!ownPlanet && slot.ownerType !== 'bot') {
        addMessage(universe, 'combat', `Missione ${siegeType === 'embargo' ? 'Embargo' : 'Occupazione'} annullata [${key}]`, 'Nessun bersaglio ostile alle coordinate.');
        flt.status = 'returning';
        return;
      }
      const H=window.UniversumHangars;
      const defendingHangars=ownPlanet?.fleet?.mothership && H ? H.normalizePlanet(ownPlanet).slice() : [];
      const combat = resolveCombat(flt.fleet, universe.researches, defenderData,
        defendingHangars.length ? {defenderTags:{mothership:defendingHangars.map(h=>h.id)}} : {});
      if (defendingHangars.length) {
        const survivors=new Set(combat.defenderTagsAlive?.mothership || []);
        ownPlanet.mothershipHangars=defendingHangars.filter(h=>survivors.has(h.id));
      }
      addMessage(universe, 'combat', `Rapporto Difesa [${key}] — ${combat.result.toUpperCase()} (${siegeType === 'embargo' ? 'Embargo' : 'Occupazione'})`,
        `Il pianeta attaccato ha affrontato la flotta ${siegeType === 'embargo' ? 'da embargo' : 'di occupazione'}. Round: ${combat.roundsPlayed}. ${formatCombatDetails(combat)}`);
      if (ownPlanet) {
        window.UniversumServices?.settlePlanet(universe,ownPlanet,now);
        ownPlanet.fleet = { ...combat.defenderFleetSurvivors };
        window.UniversumServices?.settlePlanet(universe,ownPlanet,now);
        ownPlanet.defenses = { ...combat.repairedDefenses };
      } else {
        universe.galaxyDeltas[key] = Object.assign({}, universe.galaxyDeltas[key], {
          fleetOverride: combat.defenderFleetSurvivors,
          defensesOverride: combat.repairedDefenses,
          debris: { metal: (slot.debris?.metal || 0) + combat.debris.metal, crystal: (slot.debris?.crystal || 0) + combat.debris.crystal }
        });
      }
      const survivors = combat.attackerSurvivors || {};
      const survivorCount = Object.values(survivors).reduce((acc, q) => acc + Number(q || 0), 0);
      if (combat.result !== 'attacker_win' || survivorCount <= 0) {
        addMessage(universe, 'combat', `Rapporto Battaglia [${key}] — ${combat.result.toUpperCase()} (${siegeType === 'embargo' ? 'Embargo' : 'Occupazione'} respinto)`,
          `Round: ${combat.roundsPlayed}. ${formatCombatDetails(combat)}`);
        flt.fleet = { ...survivors };
        flt.ships = { ...survivors };
        flt.status = 'returning';
        return survivorCount <= 0 ? 'remove' : undefined;
      }
      if (!Array.isArray(universe.activeSieges)) universe.activeSieges = [];
      const startFuel = siegeType === 'embargo' ? Number(flt.cargo?.deuterium || 0) : 0;
      const targetDeut = Number(defenderData.resources?.deuterium || 0);
      universe.activeSieges.push({
        id: 'siege_' + now + '_' + Math.random().toString(36).slice(2, 6),
        type: siegeType,
        originPlanetId: flt.originPlanetId,
        originCoords: { ...flt.originCoords },
        targetCoords: { ...flt.targetCoords },
        targetName: ownPlanet?.name || slot.name || key,
        ships: { ...survivors },
        cargo: { ...(flt.cargo || { metal: 0, crystal: 0, deuterium: 0 }) },
        fuelRemaining: startFuel,
        targetDeuterium: targetDeut,
        deuteriumInitial: siegeType === 'embargo' ? startFuel : targetDeut,
        ransom: flt.ransomDemand || flt.ransom || { metal: 10000, crystal: 5000, deuterium: 2500 },
        startedAt: now,
        lastTickAt: now
      });
      addMessage(universe, 'combat', siegeType === 'embargo' ? `Embargo Planetario attivo su [${key}]` : `Occupazione Planetaria avviata su [${key}]`,
        (siegeType === 'embargo'
          ? `Battaglia vinta. Rotte da/per il pianeta bloccate finche' resta deuterio in stiva (${Math.floor(startFuel).toLocaleString()} D). `
          : `Battaglia vinta. Prelievo 5% risorse/giorno, mantenimento dal deuterio del pianeta occupato (${Math.floor(targetDeut).toLocaleString()} D). `) +
        `Round: ${combat.roundsPlayed}. ${formatCombatDetails(combat)}`);
      return 'remove';
    }

    if (flt.mission === 'incursion') {
      const hangars = window.UniversumHangars;
      hangars.validateMission(flt.fleet, flt.carrierHangars);
      const target = generateProceduralSlot(universe, flt.targetCoords.g, flt.targetCoords.s, flt.targetCoords.p);
      if (target.ownerType !== 'bot') {
        addMessage(universe, 'combat', `Incursione Respinta [${key}]`, 'Il pianeta nemico non è più disponibile. La flotta rientra.');
        flt.status = 'returning';
        return;
      }
      const combat = hangars.resolveIncursion(flt.carrierHangars, universe.researches, target, flt.cargo);
      flt.fleet = combat.ships;
      flt.ships = Object.assign({}, combat.ships);
      flt.carrierHangars = combat.carriers;
      for (const k of ['metal','crystal','deuterium']) flt.cargo[k] = (flt.cargo[k] || 0) + combat.loot[k];
      const remaining = {};
      for (const k of ['metal','crystal','deuterium']) remaining[k] = Math.max(0,(target.resources?.[k] || 0) - combat.loot[k]);
      universe.galaxyDeltas[key] = Object.assign({}, universe.galaxyDeltas[key], {
        lootedAt: now, resourcesOverride: remaining,
        fleetOverride: combat.defenderFleet,
        defensesOverride: combat.defenderDefenses,
        debris: { metal:(target.debris?.metal || 0)+combat.debris.metal,
          crystal:(target.debris?.crystal || 0)+combat.debris.crystal }
      });
      addMessage(universe, 'combat', `Incursione Planetaria [${key}]`,
        `Battaglia orbitale: ${combat.orbit.result}, ${combat.orbit.roundsPlayed}/3 round. ${formatCombatDetails(combat.orbit)} `+
        `Battaglia planetaria: ${combat.ground.result}, ${combat.ground.roundsPlayed}/3 round. ${formatCombatDetails(combat.ground)} `+
        `Navi Madre superstiti ${combat.carriers.length}; Caccia recuperati ${combat.recoveredFighters}; `+
        `Caccia persi per perdita del vettore ${combat.lostWithCarriers}. `+
        `Bottino ${combat.loot.metal} M, ${combat.loot.crystal} C, ${combat.loot.deuterium} D.`);
      flt.status = 'returning';
      return;
    }

    if (flt.mission === 'attack' || flt.mission === 'destroyMoon') {
      const siegeIdx = (universe.incomingSieges || []).findIndex(
        (s) => Number(s.targetCoords?.g) === Number(flt.targetCoords.g) && Number(s.targetCoords?.s) === Number(flt.targetCoords.s) && Number(s.targetCoords?.p) === Number(flt.targetCoords.p)
      );
      if (flt.mission === 'attack' && siegeIdx >= 0) {
        const siege = universe.incomingSieges[siegeIdx];
        const orbitCombat = resolveCombat(flt.fleet, universe.researches, {
          fleet: siege.ships || {},
          defenses: {},
          tech: siege.tech || { weaponsTech: 2, shieldingTech: 2, armourTech: 2 },
          resources: { metal: 0, crystal: 0, deuterium: 0 },
          buildings: {}
        });
        addMessage(universe, 'combat', `Rapporto Difesa [${key}] — ${orbitCombat.result.toUpperCase()} (Scaccia Flotta)`,
          `La flotta in orbita (${siege.type === 'occupy' ? 'Occupazione' : 'Embargo'}) e' stata ingaggiata. Round: ${orbitCombat.roundsPlayed}. Detriti: ${orbitCombat.debris.metal.toLocaleString()} M, ${orbitCombat.debris.crystal.toLocaleString()} C. ${formatCombatDetails(orbitCombat)}`);
        flt.fleet = { ...orbitCombat.attackerSurvivors };
        flt.ships = { ...orbitCombat.attackerSurvivors };
        if (orbitCombat.result === 'attacker_win') {
          universe.incomingSieges.splice(siegeIdx, 1);
          addMessage(universe, 'combat', `Flotta Scacciata [${key}] — ${siege.type === 'occupy' ? 'Occupazione' : 'Embargo'} terminato`,
            `La flotta nemica in orbita e' stata distrutta: ${siege.type === 'occupy' ? "l'Occupazione" : "l'Embargo"} sul pianeta e' finito. ${formatCombatDetails(orbitCombat)}`);
        } else {
          siege.ships = { ...orbitCombat.defenderFleetSurvivors };
        }
        flt.status = 'returning';
        return Object.values(flt.fleet).reduce((acc, q) => acc + Number(q || 0), 0) <= 0 ? 'remove' : undefined;
      }

      const galatticaTarget = flt.mission === 'destroyMoon' ? findGalatticaAt(universe, flt.targetCoords) : null;
      if (galatticaTarget) {
        const gCombat = resolveCombat(flt.fleet, universe.researches, {
          fleet: {}, defenses: galatticaTarget.defenses || {}, tech: {},
          resources: galatticaTarget.resources, buildings: {}, moon: null, bacinoSpaziale: null
        });
        flt.fleet = gCombat.attackerSurvivors;
        flt.ships = Object.assign({}, flt.fleet);
        if (gCombat.attackerCrepuscoloDamaged && Number(flt.fleet.crepuscolo || 0) > 0) flt.crepuscoloDamaged = true;
        const dsCount = Math.max(0, Math.floor(Number(gCombat.attackerSurvivors.deathStar || 0)));
        const destroyChance = 1 - Math.pow(0.90, dsCount);
        if (gCombat.result === 'attacker_win' && dsCount > 0 && Math.random() < destroyChance) {
          universe.galattiche = (universe.galattiche || []).filter((gal) => gal.id !== galatticaTarget.id);
          const moonFormed = Math.random() < 0.75;
          const targetPlanet = (universe.planets || []).find((pl) => pl.coords.g === flt.targetCoords.g && pl.coords.s === flt.targetCoords.s && pl.coords.p === flt.targetCoords.p);
          if (moonFormed && targetPlanet && !targetPlanet.moon && !targetPlanet.bacinoSpaziale) {
            targetPlanet.moon = makeMoon('Luna');
          }
          universe.galaxyDeltas[key] = Object.assign({}, universe.galaxyDeltas[key], {
            galatticaId: null, hasBacino: false,
            hasMoon: moonFormed ? true : Boolean(targetPlanet && targetPlanet.moon),
            moonName: moonFormed ? 'Luna' : undefined
          });
          addMessage(universe, 'combat', `Galattica Distrutta [${key}]!`,
            `La tua Morte Nera ha distrutto la Galattica nemica. Il Bacino non torna: ${moonFormed ? 'dai detriti si è formata una Luna.' : 'resta spazio vuoto.'}`);
        } else {
          addMessage(universe, 'combat', `Attacco alla Galattica [${key}] — ${gCombat.result.toUpperCase()}`,
            `La Galattica alle coordinate ha resistito alla missione di distruzione. ${formatCombatDetails(gCombat)}`);
        }
        flt.status = 'returning';
        return;
      }

      const slot = generateProceduralSlot(universe, flt.targetCoords.g, flt.targetCoords.s, flt.targetCoords.p);
      if (slot.ownerType !== 'bot') {
        addMessage(universe, 'combat', `Missione Annullata [${key}]`, 'Nessun bersaglio ostile alle coordinate.');
        flt.status = 'returning';
        return;
      }

      const hangars = flt.carrierHangars || [];
      const combat = resolveCombat(flt.fleet, universe.researches, slot, { allowBacinoDestruction: flt.mission === 'destroyMoon',
        ...(hangars.length ? {attackerTags:{mothership:hangars.map(h=>h.id)}} : {}) });
      if (hangars.length) {
        const alive = new Set(combat.attackerTagsAlive?.mothership || []);
        flt.carrierHangars = hangars.filter(h=>alive.has(h.id));
      }
      addMessage(universe, 'combat', `Rapporto Difesa [${key}] — ${combat.result.toUpperCase()} (Attacco normale)`,
        `${slot.name} (${slot.emperor || 'Difensore'}) e' stato attaccato. Round: ${combat.roundsPlayed}. Bottino ceduto: ${combat.loot.metal.toLocaleString()} M, ${combat.loot.crystal.toLocaleString()} C, ${combat.loot.deuterium.toLocaleString()} D. ${formatCombatDetails(combat)}`);
      flt.fleet = combat.attackerSurvivors;
      flt.ships = Object.assign({}, flt.fleet);
      if (combat.attackerCrepuscoloDamaged && Number(flt.fleet.crepuscolo || 0) > 0) flt.crepuscoloDamaged = true;
      flt.cargo.metal += combat.loot.metal;
      flt.cargo.crystal += combat.loot.crystal;
      flt.cargo.deuterium += combat.loot.deuterium;

      const prevDebris = slot.debris || { metal: 0, crystal: 0 };
      const newDebris = {
        metal: prevDebris.metal + combat.debris.metal,
        crystal: prevDebris.crystal + combat.debris.crystal
      };

      const moonFormedFromInvictus = combat.invictusLost > 0 && !slot.moon && !slot.bacinoSpaziale && !combat.bacinoDestroyed &&
        Math.random() < Math.min(1, combat.invictusLost * window.UniversumData.INVICTUS.moonChancePerLost);

      if (combat.planetDestroyed) {
        universe.galaxyDeltas[key] = {
          destroyed: true,
          owner: 'none',
          ownerType: 'none',
          hasMoon: false,
          hasBacino: false,
          debris: newDebris
        };
        addMessage(
          universe,
          'combat',
          `☄️ PIANETA DISINTEGRATO [${key}]!`,
          `La tua Morte Nera ha annientato ${slot.name} (${slot.emperor}). Lo slot è ora vuoto e ricolonizzabile!`
        );
      } else {
        const remResources = {
          metal: Math.max(0, slot.resources.metal - combat.loot.metal),
          crystal: Math.max(0, slot.resources.crystal - combat.loot.crystal),
          deuterium: Math.max(0, slot.resources.deuterium - combat.loot.deuterium)
        };

        const noDefendersLeft =
          Object.keys(combat.defenderFleetSurvivors).length === 0 &&
          Object.keys(combat.repairedDefenses).length === 0;
        const hasConquestShip = (flt.fleet.colonyShip || 0) >= 1 || (flt.fleet.mothership || 0) >= 1;

        if (flt.mission === 'attack' && combat.result === 'attacker_win' && noDefendersLeft && hasConquestShip) {
          if (flt.fleet.colonyShip >= 1) flt.fleet.colonyShip -= 1;
          flt.ships = Object.assign({}, flt.fleet);

          const conqueredPlanet = {
            id: 'planet_conq_' + now + '_' + Math.random().toString(36).substring(2, 5),
            name: slot.name,
            coords: Object.assign({}, flt.targetCoords),
            minTemp: slot.minTemp,
            maxTemp: slot.maxTemp,
            fieldsMax: slot.fieldsMax,
            resources: remResources,
            buildings: Object.assign({}, slot.buildings),
            defenses: {},
            fleet: {},
            buildQueue: [],
            shipyardQueue: [],
            defenseQueue: [],
            localResearches: {},
            localResearchQueue: null,
            moon: ((slot.moon && !combat.moonDestroyed) || moonFormedFromInvictus) ? {
              name: (slot.moon && slot.moon.name) || 'Luna',
              diameter: slot.moon.diameter || 7500,
              fieldsMax: 1,
              resources: { metal: 0, crystal: 0, deuterium: 0 },
              buildings: { lunarBase: 0, lunarStorage: 0, lunarShield: 0, secretShipyard: 0, sensorPhalanx: 0, jumpGate: 0 },
              buildQueue: [],
              jumpGateCooldownUntil: 0
            } : null,
            bacinoSpaziale: null
          };

          universe.planets.push(conqueredPlanet);
          universe.galaxyDeltas[key] = {
            destroyed: false,
            owner: 'player',
            ownerType: 'player',
            emperor: universe.emperor,
            planetName: conqueredPlanet.name,
            planetId: conqueredPlanet.id,
            hasMoon: Boolean(conqueredPlanet.moon),
            hasBacino: false,
            moonName: conqueredPlanet.moon ? conqueredPlanet.moon.name : null,
            debris: newDebris
          };

          if (window.UniversumUI?.refreshPlanetSelector) {
            window.UniversumUI.refreshPlanetSelector();
          }

          addMessage(
            universe,
            'combat',
            `👑 PIANETA CONQUISTATO: ${slot.name} [${key}]!`,
            `Hai spazzato via le difese di ${slot.emperor} e annesso ${slot.name} con tutti i suoi edifici al tuo Impero!`
          );
        } else {
          universe.galaxyDeltas[key] = Object.assign({}, universe.galaxyDeltas[key], {
            lootedAt: now,
            resourcesOverride: remResources,
            fleetOverride: combat.defenderFleetSurvivors,
            defensesOverride: combat.repairedDefenses,
            hasMoon: (combat.bacinoDestroyed || moonFormedFromInvictus) ? true : (combat.moonDestroyed ? false : Boolean(slot.moon)),
            hasBacino: combat.bacinoDestroyed ? false : Boolean(slot.bacinoSpaziale),
            moonName: (combat.bacinoDestroyed || moonFormedFromInvictus) ? 'Luna' : undefined,
            debris: newDebris
          });

          const extraNotes = combat.log.length > 0 ? ' ' + combat.log.join(' ') : '';
          addMessage(
            universe,
            'combat',
            `Rapporto Battaglia [${key}] — ${combat.result.toUpperCase()}`,
            `Round: ${combat.roundsPlayed}. Bottino: ${combat.loot.metal.toLocaleString()} M, ${combat.loot.crystal.toLocaleString()} C, ${combat.loot.deuterium.toLocaleString()} D. Detriti: ${newDebris.metal.toLocaleString()} M, ${newDebris.crystal.toLocaleString()} C. ${formatCombatDetails(combat)}${extraNotes}`
          );
        }
      }

      flt.status = 'returning';
    }
  }

  Object.assign(G, { deployOrdinaryShips, formatUnitList, formatCombatDetails, addMessage, handleMissionArrival });

})();
