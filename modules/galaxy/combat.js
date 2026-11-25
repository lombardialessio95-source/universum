/** UNIVERSUM / modules/galaxy/combat.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumGalaxyModules;
  // Bridge lazy per le funzioni definite negli altri moduli.
  const generateProceduralSlot = (...args) => G.generateProceduralSlot(...args);



  // =========================================================
  // 3. MOTORE DI BATTAGLIA A 6 ROUND
  // =========================================================
  function expandUnitPool(unitMap, tech, isDefenseMap = false, tags = {}, shipSpecs = {}) {
    const Data = window.UniversumData;
    const pool = [];
    const wMult = 1 + (Number(tech?.weaponsTech || 0) * 0.1);
    const sMult = 1 + (Number(tech?.shieldingTech || 0) * 0.1);
    const aMult = 1 + (Number(tech?.armourTech || 0) * 0.1);

    for (const [id, countRaw] of Object.entries(unitMap || {})) {
      const count = Math.max(0, Math.floor(Number(countRaw) || 0));
      if (count <= 0) continue;
      const spec = isDefenseMap ? Data.DEFENSES[id] : (shipSpecs[id] || Data.SHIPS[id] || Data.DEFENSES[id]);
      if (!spec) continue;

      const maxHull = Math.floor(spec.hull * aMult);
      const maxShield = Math.floor(spec.shield * sMult);
      const attack = Math.floor(spec.attack * wMult);

      for (let i = 0; i < count; i++) {
        pool.push({
          carrierTag: tags?.[id]?.[i] || null,
          id,
          isDefense: Boolean(Data.DEFENSES[id]),
          maxHull,
          hull: maxHull,
          maxShield,
          shield: maxShield,
          attack,
          rapidFire: spec.rapidFire || {},
          cost: spec.cost
        });
      }
    }
    return pool;
  }


  function summarizePool(pool) {
    const counts = {};
    for (const u of pool) {
      if (u.hull > 0) {
        counts[u.id] = (counts[u.id] || 0) + 1;
      }
    }
    return counts;
  }


  function evaluateEspionage(probes, myEsp, defEsp, defProbes, random = Math.random) {
    const diff = (myEsp-defEsp)+Math.floor(Math.sqrt(probes));
    const catchChance = Math.min(0.85,Math.max(0.02,(defProbes/(Math.max(1,probes)*8))*0.25-diff*0.03));
    const probesLost = probes>0 && random()<catchChance ? Math.min(probes,Math.ceil(probes*0.5)) : 0;
    return {diff,probesLost};
  }

  function resolveCombat(attackerFleet, attackerTech, defenderData, options = {}) {
    const Data = window.UniversumData;
    const random = options.random || Math.random;
    let attackers = expandUnitPool(attackerFleet, attackerTech, false, options.attackerTags || {}, options.shipSpecs);
    const defFleetUnits = expandUnitPool(defenderData.fleet || {}, defenderData.tech || {}, false, options.defenderTags || {}, options.shipSpecs);

    const defClean = Object.assign({}, defenderData.defenses || {});
    const trapCount = Math.max(0, Math.floor(Number(defClean.spaceTrap || 0)));
    delete defClean.spaceTrap;

    const defDefenseUnits = expandUnitPool(defClean, defenderData.tech || {}, true);
    let defenders = defFleetUnits.concat(defDefenseUnits);

    const log = [];
    const attackerInvictusCount = Math.max(0, Math.floor(Number(attackerFleet?.invictus || 0)));
    const defenderInvictusCount = Math.max(0, Math.floor(Number(defenderData.fleet?.invictus || 0)));

    if (trapCount > 0 && attackers.length > 0) {
      const trapSpec = Data.DEFENSES.spaceTrap;
      const wMult = 1 + (Number(defenderData.tech?.weaponsTech || 0) * 0.1);
      const totalTrapDamage = Math.floor(trapCount * trapSpec.attack * wMult);
      let remainingDmg = totalTrapDamage;
      let destroyedByTraps = 0;

      for (let i = 0; i < attackers.length && remainingDmg > 0; i++) {
        const target = attackers[i];
        if (target.hull <= 0) continue;
        const dmg = Math.min(target.hull, remainingDmg);
        target.hull -= dmg;
        remainingDmg -= dmg;
        if (target.hull <= 0) destroyedByTraps++;
      }
      attackers = attackers.filter((u) => u.hull > 0);
      log.push(`💥 ${trapCount} Trappole Spaziali detonate prima del contatto: ${totalTrapDamage.toLocaleString()} danni inflitti (${destroyedByTraps} navi attaccanti distrutte).`);
    }

    let roundsPlayed = 0;
    const maxRounds = options.maxRounds === 3 ? 3 : 6;
    for (let round = 1; round <= maxRounds; round++) {
      if (attackers.length === 0 || defenders.length === 0) break;
      roundsPlayed = round;

      for (const u of attackers) u.shield = u.maxShield;
      for (const u of defenders) u.shield = u.maxShield;

      for (let i = 0; i < attackers.length; i++) {
        const shooter = attackers[i];
        if (shooter.attack <= 0) continue;
        let keepFiring = true;
        let safetyShots = 0;

        while (keepFiring && safetyShots < 40) {
          keepFiring = false;
          safetyShots++;
          const targetIdx = Math.floor(random() * defenders.length);
          const target = defenders[targetIdx];
          if (!target || target.hull <= 0) continue;

          const crepuscoloBlocked = target.id === 'crepuscolo' && attackerInvictusCount < 4;
          if (!crepuscoloBlocked) {
            if (target.shield > 0 && shooter.attack < target.shield * 0.01) {
            } else if (shooter.attack <= target.shield) {
              target.shield -= shooter.attack;
            } else {
              const hullDmg = shooter.attack - target.shield;
              target.shield = 0;
              target.hull -= hullDmg;
            }

            if (target.hull > 0 && target.hull < target.maxHull * 0.7) {
              const explodeProb = 1 - (target.hull / target.maxHull);
              if (random() < explodeProb) {
                target.hull = 0;
              }
            }
          }

          const rf = shooter.rapidFire[target.id];
          if (rf && rf > 1) {
            if (random() < (rf - 1) / rf) {
              keepFiring = true;
            }
          }
        }
      }

      for (let i = 0; i < defenders.length; i++) {
        const shooter = defenders[i];
        if (shooter.attack <= 0) continue;
        let keepFiring = true;
        let safetyShots = 0;

        while (keepFiring && safetyShots < 40) {
          keepFiring = false;
          safetyShots++;
          const targetIdx = Math.floor(random() * attackers.length);
          const target = attackers[targetIdx];
          if (!target || target.hull <= 0) continue;

          const crepuscoloBlocked = target.id === 'crepuscolo' && defenderInvictusCount < 4;
          if (!crepuscoloBlocked) {
            if (target.shield > 0 && shooter.attack < target.shield * 0.01) {
            } else if (shooter.attack <= target.shield) {
              target.shield -= shooter.attack;
            } else {
              const hullDmg = shooter.attack - target.shield;
              target.shield = 0;
              target.hull -= hullDmg;
            }

            if (target.hull > 0 && target.hull < target.maxHull * 0.7) {
              const explodeProb = 1 - (target.hull / target.maxHull);
              if (random() < explodeProb) {
                target.hull = 0;
              }
            }
          }

          const rf = shooter.rapidFire[target.id];
          if (rf && rf > 1) {
            if (random() < (rf - 1) / rf) {
              keepFiring = true;
            }
          }
        }
      }

      attackers = attackers.filter((u) => u.hull > 0);
      defenders = defenders.filter((u) => u.hull > 0);
    }

    const attackerSurvivors = summarizePool(attackers);
    const defenderAllSurvivors = summarizePool(defenders);

    const attackerCrepUnit = attackers.find((unit) => unit.id === 'crepuscolo');
    const defenderCrepUnit = defenders.find((unit) => unit.id === 'crepuscolo');
    let attackerCrepuscoloDamaged = !!attackerCrepUnit && attackerCrepUnit.hull < attackerCrepUnit.maxHull;
    let defenderCrepuscoloDamaged = !!defenderCrepUnit && defenderCrepUnit.hull < defenderCrepUnit.maxHull;
    if (Number(attackerFleet?.crepuscolo || 0) > 0 && !attackerSurvivors.crepuscolo) {
      attackerSurvivors.crepuscolo = Math.floor(Number(attackerFleet.crepuscolo));
      attackerCrepuscoloDamaged = true;
    }
    if (Number(defenderData.fleet?.crepuscolo || 0) > 0 && !defenderAllSurvivors.crepuscolo) {
      defenderAllSurvivors.crepuscolo = Math.floor(Number(defenderData.fleet.crepuscolo));
      defenderCrepuscoloDamaged = true;
    }

    const defenderFleetSurvivors = {};
    const defenderDefenseSurvivors = {};
    for (const [id, cnt] of Object.entries(defenderAllSurvivors)) {
      if (Data.DEFENSES[id]) defenderDefenseSurvivors[id] = cnt;
      else defenderFleetSurvivors[id] = cnt;
    }

    let debrisMetal = 0;
    let debrisCrystal = 0;
    const attackerLosses = {};
    const defenderLosses = {};

    for (const [id, initCnt] of Object.entries(attackerFleet || {})) {
      const surv = attackerSurvivors[id] || 0;
      const lost = Math.max(0, initCnt - surv);
      if (lost > 0) {
        attackerLosses[id] = lost;
        const spec = Data.SHIPS[id];
        if (spec) {
          debrisMetal += Math.floor(spec.cost.metal * lost * 0.3);
          debrisCrystal += Math.floor(spec.cost.crystal * lost * 0.3);
        }
      }
    }

    for (const [id, initCnt] of Object.entries(defenderData.fleet || {})) {
      const surv = defenderFleetSurvivors[id] || 0;
      const lost = Math.max(0, initCnt - surv);
      if (lost > 0) {
        defenderLosses[id] = lost;
        const spec = Data.SHIPS[id];
        if (spec) {
          debrisMetal += Math.floor(spec.cost.metal * lost * 0.3);
          debrisCrystal += Math.floor(spec.cost.crystal * lost * 0.3);
        }
      }
    }

    const repairedDefenses = Object.assign({}, defenderDefenseSurvivors);
    for (const [id, initCnt] of Object.entries(defClean)) {
      const surv = defenderDefenseSurvivors[id] || 0;
      const lost = Math.max(0, initCnt - surv);
      if (lost > 0) {
        defenderLosses[id] = lost;
        const recovered = Math.floor(lost * 0.7);
        if (recovered > 0) {
          repairedDefenses[id] = (repairedDefenses[id] || 0) + recovered;
        }
      }
    }
    if (trapCount > 0) defenderLosses.spaceTrap = trapCount;

    let result = 'draw';
    if (attackers.length > 0 && defenders.length === 0) result = 'attacker_win';
    else if (attackers.length === 0 && defenders.length > 0) result = 'defender_win';

    const loot = { metal: 0, crystal: 0, deuterium: 0 };
    if (result === 'attacker_win') {
      const bunkerLv = Math.min(9, Number(defenderData.buildings?.hiddenBunker || 0));
      const unprotectedRatio = Math.max(0.1, 1 - bunkerLv * 0.1);
      const maxLootM = Math.floor((defenderData.resources?.metal || 0) * unprotectedRatio * 0.5);
      const maxLootC = Math.floor((defenderData.resources?.crystal || 0) * unprotectedRatio * 0.5);
      const maxLootD = Math.floor((defenderData.resources?.deuterium || 0) * unprotectedRatio * 0.5);

      let totalCargoCap = 0;
      for (const [id, cnt] of Object.entries(attackerSurvivors)) {
        const spec = Data.SHIPS[id];
        if (spec) totalCargoCap += (spec.cargo || 0) * cnt;
      }

      const desiredTotal = maxLootM + maxLootC + maxLootD;
      if (desiredTotal > 0 && totalCargoCap > 0) {
        const ratio = Math.min(1, totalCargoCap / desiredTotal);
        loot.metal = Math.floor(maxLootM * ratio);
        loot.crystal = Math.floor(maxLootC * ratio);
        loot.deuterium = Math.floor(maxLootD * ratio);
      }
    }

    let moonDestroyed = false;
    let bacinoDestroyed = false;
    let planetDestroyed = false;
    const survivingDeathStars = attackerSurvivors.deathStar || 0;

    if (survivingDeathStars > 0) {
      for (let i = 0; i < survivingDeathStars; i++) {
        if (defenderData.moon && !moonDestroyed && random() < 0.10) {
          moonDestroyed = true;
          log.push('🌑💥 UNA MORTE NERA HA POLVERIZZATO LA LUNA NEMICA CON TUTTI I SUOI EDIFICI!');
        }
        if (options.allowBacinoDestruction && defenderData.bacinoSpaziale && defenderData.bacinoSpaziale.status === 'active' && !bacinoDestroyed && random() < 0.10) {
          bacinoDestroyed = true;
          log.push('🛠️💥 UNA MORTE NERA HA POLVERIZZATO IL BACINO SPAZIALE NEMICO!');
        }
        if (!planetDestroyed && random() < 0.01) {
          planetDestroyed = true;
          moonDestroyed = true;
          log.push('☄️☠️ EVENTO EPICO! IL SUPERLASER DELLA MORTE NERA HA DISINTEGRATO L’INTERO PIANETA!');
        }
      }
    }

    return {
      result,
      roundsPlayed,
      attackerTagsAlive: options.attackerTags ? Object.fromEntries(Object.keys(options.attackerTags).map(id =>
        [id, attackers.filter(u => u.id === id && u.carrierTag).map(u => u.carrierTag)])) : undefined,
      attackerSurvivors,
      defenderTagsAlive: options.defenderTags ? Object.fromEntries(Object.keys(options.defenderTags).map(id =>
        [id, defenders.filter(u => u.id === id && u.carrierTag).map(u => u.carrierTag)])) : undefined,
      defenderFleetSurvivors,
      repairedDefenses,
      attackerLosses,
      defenderLosses,
      loot,
      debris: { metal: debrisMetal, crystal: debrisCrystal },
      moonDestroyed,
      bacinoDestroyed,
      invictusLost: (attackerLosses.invictus || 0) + (defenderLosses.invictus || 0),
      attackerCrepuscoloDamaged,
      defenderCrepuscoloDamaged,
      planetDestroyed,
      log
    };
  }


  // =========================================================
  // 4. SIMULATORE
  // =========================================================
  function simulateBattle(attackerFleet, attackerTech, targetCoords, universe, iterations = 30) {
    const Data = window.UniversumData;
    const targetSlot = generateProceduralSlot(universe, targetCoords.g, targetCoords.s, targetCoords.p);
    if (targetSlot.ownerType !== 'bot') {
      throw new Error('Seleziona un pianeta BOT valido come bersaglio di simulazione.');
    }

    const reportsForTarget = (universe.spyReports || []).filter(
      (r) => r.coords && r.coords.g === targetCoords.g && r.coords.s === targetCoords.s && r.coords.p === targetCoords.p
    );
    const spyCount = reportsForTarget.length;

    let uncertainty = 0.25;
    if (spyCount >= 3) uncertainty = 0.05;
    else if (spyCount === 2) uncertainty = 0.10;
    else if (spyCount === 1) uncertainty = 0.20;

    let wins = 0;
    let draws = 0;
    let losses = 0;
    let sumAttackerLossCost = 0;
    let worstAttackerLossCost = 0;
    let sumLoot = 0;
    let sumDebris = 0;

    for (let it = 0; it < iterations; it++) {
      const scaleMap = (map) => {
        const out = {};
        for (const [k, v] of Object.entries(map || {})) {
          const jitter = 1 + ((Math.random() * 2 - 1) * uncertainty);
          out[k] = Math.max(0, Math.round(v * jitter));
        }
        return out;
      };

      const simDef = {
        fleet: scaleMap(targetSlot.fleet),
        defenses: scaleMap(targetSlot.defenses),
        tech: targetSlot.tech,
        resources: targetSlot.resources,
        buildings: targetSlot.buildings,
        moon: targetSlot.moon
      };

      const res = resolveCombat(attackerFleet, attackerTech, simDef);
      if (res.result === 'attacker_win') wins++;
      else if (res.result === 'draw') draws++;
      else losses++;

      let iterLossCost = 0;
      for (const [id, lostCnt] of Object.entries(res.attackerLosses)) {
        const spec = Data.SHIPS[id];
        if (spec) iterLossCost += (spec.cost.metal + spec.cost.crystal + spec.cost.deuterium) * lostCnt;
      }

      sumAttackerLossCost += iterLossCost;
      if (iterLossCost > worstAttackerLossCost) worstAttackerLossCost = iterLossCost;
      sumLoot += res.loot.metal + res.loot.crystal + res.loot.deuterium;
      sumDebris += res.debris.metal + res.debris.crystal;
    }

    const winPct = Math.round((wins / iterations) * 100);
    const drawPct = Math.round((draws / iterations) * 100);
    const losePct = Math.max(0, 100 - winPct - drawPct);
    const dsCount = Math.max(0, Math.floor(Number(attackerFleet?.deathStar || 0)));

    const moonDestroyChance = targetSlot.moon
      ? Math.round((1 - Math.pow(0.90, dsCount)) * 1000) / 10
      : 0;
    const planetDestroyChance = Math.round((1 - Math.pow(0.99, dsCount)) * 1000) / 10;

    let advice = 'ATTACCO RISCHIOSO';
    if (winPct >= 80 && losePct <= 5) advice = 'ATTACCO CONSIGLIATO';
    else if (winPct < 45 || losePct >= 35) advice = 'NON ATTACCARE - SEI TROPPO DEBOLE';

    return {
      iterations,
      spyCount,
      uncertaintyPct: Math.round(uncertainty * 100),
      winPct,
      drawPct,
      losePct,
      avgLosses: Math.floor(sumAttackerLossCost / iterations),
      worstLosses: worstAttackerLossCost,
      estimatedLoot: Math.floor(sumLoot / iterations),
      debrisCreated: Math.floor(sumDebris / iterations),
      moonDestroyChance,
      planetDestroyChance,
      advice
    };
  }

  Object.assign(G, { evaluateEspionage, expandUnitPool, summarizePool, resolveCombat, simulateBattle });

})();
