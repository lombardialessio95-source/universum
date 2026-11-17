/**
 * UNIVERSUM — Engine Actions (Costruzioni, Ricerche, Flotte/Difese, Cheat & Autosave)
 */
(function () {
  'use strict';

  const TURBO_DURATION_MS = 15 * 60 * 1000; // 15 minuti di Turbo 2x
  const Engine = window.UniversumEngine;
  if (!Engine) return;

  const { getData, normalizePlanet } = Engine._internal;

  function canAfford(resources, cost) {
    return (
      resources.metal >= cost.metal &&
      resources.crystal >= cost.crystal &&
      resources.deuterium >= cost.deuterium
    );
  }

  function deductResources(resources, cost) {
    resources.metal = Math.max(0, resources.metal - cost.metal);
    resources.crystal = Math.max(0, resources.crystal - cost.crystal);
    resources.deuterium = Math.max(0, resources.deuterium - cost.deuterium);
  }

  // =========================================================
  // COSTRUZIONI PLANETARIE E LUNARI
  // =========================================================
  function startBuilding(universe, planetIndex, buildingId, isMoon = false) {
    const Data = getData();
    const planet = universe.planets[planetIndex];
    if (!planet) throw new Error('Pianeta non trovato.');
    normalizePlanet(planet);

    if (isMoon) {
      if (!planet.moon) throw new Error('Questo pianeta non possiede una Luna.');
      const def = Data.MOON_BUILDINGS[buildingId];
      if (!def) throw new Error('Edificio lunare sconosciuto.');

      const curLv = Number(planet.moon.buildings[buildingId] || 0);
      if (def.maxLevel && curLv >= def.maxLevel) {
        throw new Error(`${def.name} è già al livello massimo (${def.maxLevel}).`);
      }

      if (!universe.creativeMode) {
        if (planet.moon.buildQueue.length > 0) {
          throw new Error('Coda costruzioni lunari già occupata.');
        }
        if (buildingId !== 'lunarBase' && Data.getMoonUsedFields(planet.moon) >= Data.getMoonMaxFields(planet.moon)) {
          throw new Error('Campi lunari esauriti! Amplia la Base Lunare.');
        }
        const reqCheck = Data.checkRequirements(def.requirements, planet, universe, true);
        if (!reqCheck.met) {
          throw new Error(`Requisiti mancanti: ${reqCheck.missing.join(', ')}`);
        }
      }

      const targetLv = curLv + 1;
      if (universe.creativeMode) {
        planet.moon.buildings[buildingId] = targetLv;
        return { instant: true, targetLevel: targetLv };
      }

      const cost = Data.getBuildingCost(buildingId, targetLv, true);
      if (!canAfford(planet.resources, cost)) {
        throw new Error('Risorse insufficienti sul pianeta di supporto per la struttura lunare.');
      }

      deductResources(planet.resources, cost);
      const durationSec = Engine.getBuildingBuildTime(universe, planet, buildingId, targetLv, true);
      const now = Date.now();
      planet.moon.buildQueue.push({
        id: buildingId,
        targetLevel: targetLv,
        startTime: now,
        endTime: now + durationSec * 1000,
        durationSec
      });
      return { instant: false, targetLevel: targetLv, durationSec };
    }

    // Edificio Planetario
    const def = Data.BUILDINGS[buildingId];
    if (!def) throw new Error('Edificio sconosciuto.');

    const curLv = Number(planet.buildings[buildingId] || 0);
    if (def.maxLevel && curLv >= def.maxLevel) {
      throw new Error(`${def.name} ha raggiunto il livello massimo (${def.maxLevel}).`);
    }

    if (!universe.creativeMode) {
      if (planet.buildQueue.length > 0) {
        throw new Error('Coda di costruzione già occupata su questo pianeta.');
      }
      if (buildingId !== 'terraformer' && Data.getUsedFields(planet) >= Data.getMaxFields(planet)) {
        throw new Error('Nessun campo libero sul pianeta! Costruisci un Terraformer.');
      }
      const reqCheck = Data.checkRequirements(def.requirements, planet, universe, false);
      if (!reqCheck.met) {
        throw new Error(`Requisiti mancanti: ${reqCheck.missing.join(', ')}`);
      }
    }

    const targetLv = curLv + 1;
    if (universe.creativeMode) {
      planet.buildings[buildingId] = targetLv;
      if (buildingId === 'deuteriumSynth') planet.buildings.deuteriumSynthesizer = targetLv;
      return { instant: true, targetLevel: targetLv };
    }

    const cost = Data.getBuildingCost(buildingId, targetLv, false);
    if (!canAfford(planet.resources, cost)) {
      throw new Error('Risorse insufficienti per avviare la costruzione.');
    }

    deductResources(planet.resources, cost);
    const durationSec = Engine.getBuildingBuildTime(universe, planet, buildingId, targetLv, false);
    const now = Date.now();
    planet.buildQueue.push({
      id: buildingId,
      targetLevel: targetLv,
      startTime: now,
      endTime: now + durationSec * 1000,
      durationSec
    });

    return { instant: false, targetLevel: targetLv, durationSec };
  }

  // =========================================================
  // RICERCHE & CANTIERE NAVALE / DIFESE
  // =========================================================
  function startResearch(universe, researchId, planetIndex = 0) {
    const Data = getData();
    const def = Data.RESEARCHES[researchId];
    if (!def) throw new Error('Ricerca sconosciuta.');

    const planet = universe.planets[planetIndex] || universe.planets[0];
    normalizePlanet(planet);

    const curLv = Number(universe.researches[researchId] || 0);
    const targetLv = curLv + 1;

    if (!universe.creativeMode) {
      if (universe.researchQueue) {
        throw new Error('Un’altra ricerca è già in corso nei laboratori.');
      }
      const reqCheck = Data.checkRequirements(def.requirements, planet, universe, false);
      if (!reqCheck.met) {
        throw new Error(`Requisiti mancanti: ${reqCheck.missing.join(', ')}`);
      }
    }

    if (universe.creativeMode) {
      universe.researches[researchId] = targetLv;
      return { instant: true, targetLevel: targetLv };
    }

    const cost = Data.getResearchCost(researchId, targetLv);
    if (!canAfford(planet.resources, cost)) {
      throw new Error('Risorse insufficienti sul pianeta attivo per questa ricerca.');
    }

    deductResources(planet.resources, cost);
    const durationSec = Engine.getResearchTime(universe, researchId, targetLv);
    const now = Date.now();
    universe.researchQueue = {
      id: researchId,
      targetLevel: targetLv,
      planetId: planet.id,
      startTime: now,
      endTime: now + durationSec * 1000,
      durationSec
    };

    return { instant: false, targetLevel: targetLv, durationSec };
  }

  function buildUnits(universe, planetIndex, unitId, count = 1, isDefense = false) {
    const Data = getData();
    const planet = universe.planets[planetIndex];
    if (!planet) throw new Error('Pianeta non trovato.');
    normalizePlanet(planet);

    const qty = Math.max(1, Math.floor(Number(count) || 1));
    const unit = isDefense ? Data.DEFENSES[unitId] : Data.SHIPS[unitId];
    if (!unit) throw new Error('Unità sconosciuta.');

    if (!universe.creativeMode) {
      const reqCheck = Data.checkRequirements(unit.requirements, planet, universe, false);
      if (!reqCheck.met) {
        throw new Error(`Requisiti mancanti: ${reqCheck.missing.join(', ')}`);
      }
    }

    if (isDefense && unit.maxCount) {
      const existing = Number(planet.defenses[unitId] || 0);
      const queued = planet.defenseQueue
        .filter((q) => q.id === unitId)
        .reduce((acc, q) => acc + q.remaining, 0);
      if (existing + queued + qty > unit.maxCount) {
        throw new Error(`${unit.name}: massimo ${unit.maxCount} unità consentita per pianeta.`);
      }
    }

    if (universe.creativeMode) {
      if (isDefense) {
        planet.defenses[unitId] = (planet.defenses[unitId] || 0) + qty;
      } else {
        planet.fleet[unitId] = (planet.fleet[unitId] || 0) + qty;
      }
      return { instant: true, count: qty };
    }

    const unitCost = Engine.getUnitCostAdjusted(planet, unitId, isDefense);
    const totalCost = {
      metal: unitCost.metal * qty,
      crystal: unitCost.crystal * qty,
      deuterium: unitCost.deuterium * qty
    };

    if (!canAfford(planet.resources, totalCost)) {
      throw new Error('Risorse insufficienti per avviare la produzione.');
    }

    deductResources(planet.resources, totalCost);
    const unitDurationSec = Engine.getSingleUnitTime(universe, planet, unitId, isDefense);
    const queue = isDefense ? planet.defenseQueue : planet.shipyardQueue;
    const now = Date.now();
    const startAfter = queue.length > 0 ? queue[queue.length - 1].endTime : now;

    queue.push({
      id: unitId,
      remaining: qty,
      total: qty,
      unitDurationSec,
      nextUnitEndTime: startAfter + unitDurationSec * 1000,
      endTime: startAfter + unitDurationSec * qty * 1000
    });

    return { instant: false, count: qty, totalDurationSec: unitDurationSec * qty };
  }

  // =========================================================
  // TURBO, CREATIVE CHEATS & RINOMINA CORPI CELESTI
  // =========================================================
  function activateTurbo(universe) {
    const now = Date.now();
    if ((universe.turboUntil || 0) > now) {
      return { active: true, remainingSec: Math.ceil((universe.turboUntil - now) / 1000) };
    }
    universe.turboUntil = now + TURBO_DURATION_MS;
    return { active: true, remainingSec: TURBO_DURATION_MS / 1000 };
  }

  function applyCreativeCheat(universe, planetIndex, actionType) {
    if (!universe.creativeMode) {
      throw new Error('Disponibile solo in Modalità Creativa.');
    }
    const Data = getData();
    const planet = universe.planets[planetIndex] || universe.planets[0];
    normalizePlanet(planet);

    switch (actionType) {
      case 'add-res':
        planet.resources.metal += 10000000;
        planet.resources.crystal += 10000000;
        planet.resources.deuterium += 10000000;
        return '+10.000.000 di ogni risorsa aggiunti!';

      case 'finish-queues':
        if (universe.researchQueue) {
          universe.researches[universe.researchQueue.id] = universe.researchQueue.targetLevel;
          universe.researchQueue = null;
        }
        for (const p of universe.planets) {
          normalizePlanet(p);
          while (p.buildQueue.length > 0) {
            const b = p.buildQueue.shift();
            p.buildings[b.id] = b.targetLevel;
          }
          if (p.moon && Array.isArray(p.moon.buildQueue)) {
            while (p.moon.buildQueue.length > 0) {
              const mb = p.moon.buildQueue.shift();
              p.moon.buildings[mb.id] = mb.targetLevel;
            }
          }
          while (p.shipyardQueue.length > 0) {
            const sq = p.shipyardQueue.shift();
            p.fleet[sq.id] = (p.fleet[sq.id] || 0) + sq.remaining;
          }
          while (p.defenseQueue.length > 0) {
            const dq = p.defenseQueue.shift();
            p.defenses[dq.id] = (p.defenses[dq.id] || 0) + dq.remaining;
          }
        }
        return 'Tutte le code di costruzione, ricerca e cantiere completate!';

      case 'unlock-tech':
        for (const rId of Object.keys(Data.RESEARCHES)) {
          universe.researches[rId] = Math.max(15, Number(universe.researches[rId] || 0));
        }
        return 'Tutte le tecnologie sbloccate al Livello 15!';

      case 'add-rip':
        planet.fleet.deathStar = (planet.fleet.deathStar || 0) + 10;
        return '+10 Morti Nere schierate in orbita!';

      default:
        throw new Error('Comando creativo non riconosciuto.');
    }
  }

  function renamePlanet(universe, planetIndex, newName) {
    const planet = universe.planets[planetIndex];
    if (!planet) throw new Error('Pianeta non trovato.');
    const cleaned = (newName || '').trim().substring(0, 24);
    if (!cleaned) throw new Error('Il nome del pianeta non può essere vuoto.');

    planet.name = cleaned;
    const key = `${planet.coords.g}:${planet.coords.s}:${planet.coords.p}`;
    if (!universe.galaxyDeltas) universe.galaxyDeltas = {};
    universe.galaxyDeltas[key] = Object.assign({}, universe.galaxyDeltas[key], {
      ownerType: 'player',
      emperor: universe.emperor,
      planetName: cleaned,
      planetId: planet.id
    });
    return cleaned;
  }

  function renameMoon(universe, planetIndex, newName) {
    const planet = universe.planets[planetIndex];
    if (!planet || !planet.moon) throw new Error('Nessuna Luna presente su questo pianeta.');
    const cleaned = (newName || '').trim().substring(0, 24);
    if (!cleaned) throw new Error('Il nome della Luna non può essere vuoto.');

    planet.moon.name = cleaned;
    const key = `${planet.coords.g}:${planet.coords.s}:${planet.coords.p}`;
    if (!universe.galaxyDeltas) universe.galaxyDeltas = {};
    universe.galaxyDeltas[key] = Object.assign({}, universe.galaxyDeltas[key], {
      hasMoon: true,
      moonName: cleaned
    });
    return cleaned;
  }

  // =========================================================
  // AUTOSAVE PERIODICO E SU VISIBILITYCHANGE
  // =========================================================
  let activeUniverseRef = null;
  let autosaveInterval = null;

  function bindAutoSave(getUniverseFn) {
    activeUniverseRef = getUniverseFn;
    if (autosaveInterval) clearInterval(autosaveInterval);

    autosaveInterval = setInterval(() => {
      const uni = typeof activeUniverseRef === 'function' ? activeUniverseRef() : null;
      if (uni && window.UniversumDB) {
        window.UniversumDB.save(uni).catch((e) => console.warn('[Autosave] Errore:', e));
      }
    }, 10000);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        const uni = typeof activeUniverseRef === 'function' ? activeUniverseRef() : null;
        if (uni && window.UniversumDB) {
          window.UniversumDB.save(uni).catch(() => {});
        }
      }
    });
  }

  Object.assign(Engine, {
    startBuilding,
    startResearch,
    buildUnits,
    activateTurbo,
    applyCreativeCheat,
    renamePlanet,
    renameMoon,
    bindAutoSave
  });
})();
