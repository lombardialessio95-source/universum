/** UNIVERSUM / modules/galaxy/bot-ai.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumGalaxyModules;
  // Bridge lazy per le funzioni definite negli altri moduli.
  const addMessage = (...args) => G.addMessage(...args);
  const beginCrepuscoloBattleRepair = (...args) => G.beginCrepuscoloBattleRepair(...args);
  const coordKey = (...args) => G.coordKey(...args);
  const formatCombatDetails = (...args) => G.formatCombatDetails(...args);
  const makeMoon = (...args) => G.makeMoon(...args);
  const resolveCombat = (...args) => G.resolveCombat(...args);



  function processBotAI(universe) {
    if (universe.botMode !== 'hostile' || universe.creativeMode) return;
    if (!Array.isArray(universe.incomingAttacks)) universe.incomingAttacks = [];

    const now = Date.now();
    const intervalsMs = {
      1: 3 * 3600 * 1000,
      2: 1 * 3600 * 1000,
      3: 20 * 60 * 1000,
      4: 5 * 60 * 1000
    };
    const interval = intervalsMs[universe.botLevel || 2] || intervalsMs[2];
    if (!universe.nextBotRaidAt) {
      universe.nextBotRaidAt = now + interval;
      return;
    }

    for (let i = universe.incomingAttacks.length - 1; i >= 0; i--) {
      const atk = universe.incomingAttacks[i];
      if (now >= atk.arrivalTime) {
        universe.incomingAttacks.splice(i, 1);
        const targetPlanet = universe.planets.find((p) => p.id === atk.targetPlanetId) || universe.planets[0];
        if (!targetPlanet) continue;

        const defenderFleet = Object.assign({}, targetPlanet.fleet);
        if (targetPlanet.bacinoSpaziale && targetPlanet.bacinoSpaziale.status === 'active') {
          defenderFleet.invictus = Number(targetPlanet.bacinoSpaziale.invictusActive) || 0;
          if (targetPlanet.bacinoSpaziale.crepuscolo && targetPlanet.bacinoSpaziale.crepuscolo.status === 'active') {
            defenderFleet.crepuscolo = 1;
          }
        }
        const combat = resolveCombat(atk.fleet, atk.tech, {
          fleet: defenderFleet,
          defenses: targetPlanet.defenses,
          tech: universe.researches,
          resources: targetPlanet.resources,
          buildings: targetPlanet.buildings,
          moon: targetPlanet.moon,
          bacinoSpaziale: targetPlanet.bacinoSpaziale || null
        });

        const fleetSurvivors = Object.assign({}, combat.defenderFleetSurvivors);
        if (targetPlanet.bacinoSpaziale) {
          targetPlanet.bacinoSpaziale.invictusActive = Number(fleetSurvivors.invictus) || 0;
          delete fleetSurvivors.invictus;
          delete fleetSurvivors.crepuscolo;
          if (targetPlanet.bacinoSpaziale.crepuscolo && combat.defenderCrepuscoloDamaged) {
            beginCrepuscoloBattleRepair(targetPlanet);
          }
        }
        targetPlanet.fleet = fleetSurvivors;
        targetPlanet.defenses = combat.repairedDefenses;
        if (combat.invictusLost > 0 && !targetPlanet.moon && !targetPlanet.bacinoSpaziale) {
          const moonChance = Math.min(1, combat.invictusLost * window.UniversumData.INVICTUS.moonChancePerLost);
          if (Math.random() < moonChance) targetPlanet.moon = makeMoon('Luna');
        }

        if (combat.result === 'attacker_win') {
          targetPlanet.resources.metal = Math.max(0, targetPlanet.resources.metal - combat.loot.metal);
          targetPlanet.resources.crystal = Math.max(0, targetPlanet.resources.crystal - combat.loot.crystal);
          targetPlanet.resources.deuterium = Math.max(0, targetPlanet.resources.deuterium - combat.loot.deuterium);

          if (combat.moonDestroyed && targetPlanet.moon) {
            targetPlanet.moon = null;
          }
          if (combat.planetDestroyed && universe.planets.length > 1) {
            const idx = universe.planets.findIndex((p) => p.id === targetPlanet.id);
            if (idx !== -1) universe.planets.splice(idx, 1);
          }

          addMessage(
            universe,
            'combat',
            `🚨 ATTACCO BOT SUBITO SU ${targetPlanet.name}!`,
            `${atk.attackerName} ha sfondato le tue difese! Round: ${combat.roundsPlayed}. Risorse saccheggiate: ${combat.loot.metal.toLocaleString()} M, ${combat.loot.crystal.toLocaleString()} C, ${combat.loot.deuterium.toLocaleString()} D. Detriti: ${combat.debris.metal.toLocaleString()} M, ${combat.debris.crystal.toLocaleString()} C. ${formatCombatDetails(combat)}`
          );
        } else {
          addMessage(
            universe,
            'combat',
            `🛡️ ATTACCO BOT RESPINTO SU ${targetPlanet.name}!`,
            `Le tue difese hanno respinto l'incursione di ${atk.attackerName}! Round: ${combat.roundsPlayed}. Detriti: ${combat.debris.metal.toLocaleString()} M, ${combat.debris.crystal.toLocaleString()} C. ${formatCombatDetails(combat)}`
          );
        }
      }
    }

    if (now >= universe.nextBotRaidAt && universe.planets.length > 0) {
      universe.nextBotRaidAt = now + interval;
      const targetP = universe.planets[Math.floor(Math.random() * universe.planets.length)];
      const lv = universe.botLevel || 2;
      const mult = lv === 4 ? 15 : lv === 3 ? 5 : lv === 2 ? 2 : 1;

      const raidFleet = {
        lightFighter: 10 * mult,
        heavyFighter: 4 * mult,
        cruiser: 2 * mult,
        battleship: lv >= 2 ? 2 * mult : 0,
        bomber: lv >= 3 ? 2 * mult : 0,
        deathStar: lv === 4 ? 1 : 0
      };

      const warnSec = Math.max(45, Math.floor(300 / Math.sqrt(universe.speed || 10)));
      universe.incomingAttacks.push({
        id: 'raid_' + now,
        attackerName: `Flotta Predoni Lv.${lv}`,
        originCoords: { g: targetP.coords.g, s: Math.max(1, targetP.coords.s - 3), p: 7 },
        targetPlanetId: targetP.id,
        targetCoords: Object.assign({}, targetP.coords),
        fleet: raidFleet,
        tech: { weaponsTech: lv * 2, shieldingTech: lv * 2, armourTech: lv * 2 },
        arrivalTime: now + warnSec * 1000
      });

      addMessage(
        universe,
        'alert',
        `⚠️ ALLARME RADAR: Flotta Ostile in Avvicinamento!`,
        `Una flotta BOT (Lv.${lv}) colpirà ${targetP.name} [${coordKey(targetP.coords.g, targetP.coords.s, targetP.coords.p)}] tra ${warnSec} secondi!`
      );
    }
  }

  Object.assign(G, { processBotAI });

})();
