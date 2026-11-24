/** UNIVERSUM — Fase 1: ricerche imperiali e planetarie; avanzamento segmentato per laboratorio. */
(function () {
  'use strict';
  const G = window.__UniversumEngineModules;
  const LOCAL_IDS = ['quantumPhysics','jumpPropulsion','mobilePlanetaryStructure','stellarReactor','spatialTerraforming','megastructureEngineering'];
  const isLocalResearch = (id) => window.UniversumData?.RESEARCHES?.[id]?.scope === 'planetary';
  const finiteTime = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;

  function normalizeResearchState(universe) {
    if (!universe || typeof universe !== 'object') return false;
    if (universe.researchModelVersion === 1) return false;
    if (!universe.researches || typeof universe.researches !== 'object') universe.researches = {};
    const planets = Array.isArray(universe.planets) ? universe.planets : [];
    for (const p of planets) G.normalizePlanet(p);
    // Versioned migration: legacy Galattica levels are assigned to ONE existing planet.
    // The original research planet is stored in old queue when available; other origins
    // were never recorded, therefore use the stable first/home planet.
    let changed = false;
    if (universe.researchModelVersion !== 1) {
      const q = universe.researchQueue;
      const primary = planets[0];
      for (const id of LOCAL_IDS) {
        const level = Math.max(0, Math.floor(Number(universe.researches[id]) || 0));
        if (level && primary) {
          primary.localResearches[id] = Math.max(Number(primary.localResearches[id]) || 0, level);
          changed = true;
        }
        if (Object.prototype.hasOwnProperty.call(universe.researches, id)) {
          delete universe.researches[id]; changed = true;
        }
      }
      if (q && isLocalResearch(q.id)) {
        const origin = planets.find(p => p.id === q.planetId) || primary;
        if (origin && !origin.localResearchQueue) {
          origin.localResearchQueue = Object.assign({}, q, { planetId: origin.id });
        }
        universe.researchQueue = null;
        changed = true;
      }
      universe.researchModelVersion = 1;
      changed = true;
    }
    // Discard orphan queues only. Already-built structures are NOT invalidated.
    for (const p of planets) {
      if (p.localResearchQueue && (!isLocalResearch(p.localResearchQueue.id) ||
        !Number.isFinite(Number(p.localResearchQueue.endTime)) || Number(p.localResearchQueue.endTime) <= 0)) {
        p.localResearchQueue = null; changed = true;
      }
    }
    return changed;
  }

  function localBusyAt(planet, timestamp) {
    const q = planet.localResearchQueue;
    if (!q) return false;
    const start = finiteTime(q.startTime);
    const end = finiteTime(q.endTime);
    return start <= timestamp && (end <= 0 || timestamp < end);
  }

  function getFreeLabTotal(universe, timestamp = Date.now()) {
    const net = Math.max(0, Math.floor(Number(universe.researches?.intergalacticNetwork) || 0));
    const levels = (universe.planets || []).filter(p => !localBusyAt(p, timestamp))
      .map(p => {
        const upgrade = p.buildQueue?.[0];
        return Math.max(0, Number(upgrade?.id === 'researchLab' &&
          finiteTime(upgrade.endTime) <= timestamp ? upgrade.targetLevel : p.buildings?.researchLab) || 0);
      }).filter(n => n > 0)
      .sort((a,b) => b-a);
    return levels.slice(0, 1 + net).reduce((a,b) => a+b, 0);
  }

  function researchWork(universe, queue) {
    if (Number(queue.workTotal) > 0) return Number(queue.workTotal);
    const c = window.UniversumData.getResearchCost(queue.id, queue.targetLevel);
    return Math.max(1, (c.metal + c.crystal) * 3.6);
  }

  function researchSpeed(universe, at) {
    const base = Math.max(1, Number(universe.speed) || 1);
    const turbo = finiteTime(universe.turboUntil) > at ? 2 : 1;
    return base * turbo;
  }

  function finishResearch(queue, target, summary, planet = null) {
    target[queue.id] = Math.max(Number(target[queue.id]) || 0, Number(queue.targetLevel) || 0);
    if (summary?.completedResearches) {
      const name = window.UniversumData.RESEARCHES[queue.id]?.name || queue.id;
      summary.completedResearches.push(`${name} Lv.${queue.targetLevel}${planet ? ' (' + planet.name + ')' : ''}`);
    }
  }

  function refreshImperialETA(universe, at = Date.now()) {
    const q = universe.researchQueue;
    if (!q) return;
    if (!Number.isFinite(q.workTotal) || q.workTotal <= 0) return;
    const rate = (1 + getFreeLabTotal(universe, at)) * researchSpeed(universe, at);
    // If no free labs, imperial research pauses rather than using a phantom lv0 lab.
    if (!getFreeLabTotal(universe, at)) { q.endTime = null; return; }
    const remaining = Math.max(0, q.workTotal - (Number(q.workDone) || 0));
    q.endTime = Math.ceil(at + 1000 * remaining / rate);
  }

  // Processes boundary events in absolute chronological order. No historical speed changes
  // are applied retroactively. Runs when tick advances, action starts, or player reloads.
  function advanceResearchQueues(universe, timestamp = Date.now(), summary = null) {
    normalizeResearchState(universe);
    const now = Number(timestamp);
    if (!Number.isFinite(now)) return false;
    let changed = false;
    if (!universe.researches || typeof universe.researches !== 'object') universe.researches = {};
    const planets = universe.planets || [];
    // A malformed/orphan queue must not permanently occupy a laboratory.
    for (const p of planets) {
      const lq = p.localResearchQueue;
      if (lq && (!isLocalResearch(lq.id) || !Number.isFinite(Number(lq.endTime)) ||
          Number(lq.endTime) <= 0 || (lq.ownerUid && p.ownerUid && lq.ownerUid !== p.ownerUid))) {
        p.localResearchQueue = null;
        changed = true;
      }
      if (p.localResearchQueue && (!p.localResearches || typeof p.localResearches !== 'object')) p.localResearches = {};
    }
    let q = universe.researchQueue;
    if (q && !isLocalResearch(q.id) && (!Number.isFinite(q.workTotal) || q.workTotal <= 0)) {
      // Legacy global timer: respect its historical finish date and historical rate.
      if (Number.isFinite(Number(q.endTime)) && Number(q.endTime) <= now) {
        finishResearch(q, universe.researches, summary);
        universe.researchQueue = null; q = null; changed = true;
      } else if (Number(q.endTime) > now) {
        const oldStart = finiteTime(q.startTime) || now;
        const oldEnd = Number(q.endTime);
        const total = researchWork(universe, q);
        q.workTotal = total;
        q.workDone = total * Math.max(0, Math.min(1, (now - oldStart) / Math.max(1, oldEnd - oldStart)));
        q.lastProgressAt = now;
      }
    }
    q = universe.researchQueue;
    // A client clock correction must not rewind the persisted checkpoint.
    if (q && Number(q.lastProgressAt) > now) return changed;
    let cursor = q ? Math.min(now, Number(q.lastProgressAt) || Number(q.startTime) || now) : now;
    // Pre-complete local queues before cursor, then advance the global with changes
    // to the free-lab set at each individual local completion time.
    const completeLocals = (t) => {
      for (const planet of planets) {
        const lq = planet.localResearchQueue;
        if (!lq || !(finiteTime(lq.endTime) > 0) || finiteTime(lq.endTime) > t) continue;
        finishResearch(lq, planet.localResearches, summary, planet);
        planet.localResearchQueue = null;
        changed = true;
      }
    };
    if (q && Number.isFinite(q.workTotal) && q.workTotal > 0) {
      // If a local queue finished before the global's saved checkpoint, it
      // must already have been represented in its previously settled workDone.
      completeLocals(cursor);
      let safety = 0;
      while (cursor < now && universe.researchQueue && safety++ < 10000) {
        const nextLocal = planets.reduce((t,p) => {
          const e = finiteTime(p.localResearchQueue?.endTime);
          return e > cursor && e < t ? e : t;
        }, now);
        const nextUpgrade = planets.reduce((t, p) => {
          const b = p.buildQueue?.[0];
          const e = b?.id === 'researchLab' ? finiteTime(b.endTime) : 0;
          return e > cursor && e < t ? e : t;
        }, nextLocal);
        const turboEnd = finiteTime(universe.turboUntil);
        const next = turboEnd > cursor && turboEnd < nextUpgrade ? turboEnd : nextUpgrade;
        const labs = getFreeLabTotal(universe, cursor);
        const rate = labs > 0 ? (1 + labs) * researchSpeed(universe, cursor) : 0;
        const remaining = Math.max(0, q.workTotal - (Number(q.workDone) || 0));
        const segmentMs = next - cursor;
        const elapsed = rate > 0 ? Math.min(segmentMs, remaining * 1000 / rate) : segmentMs;
        q.workDone = Math.min(q.workTotal, (Number(q.workDone) || 0) + elapsed * rate / 1000);
        cursor += elapsed;
        q.lastProgressAt = cursor;
        if (q.workDone + 0.00001 >= q.workTotal) {
          finishResearch(q, universe.researches, summary);
          universe.researchQueue = null;
          changed = true;
        }
        completeLocals(cursor);
        if (!universe.researchQueue || elapsed < segmentMs) break;
      }
    }
    completeLocals(now);
    if (universe.researchQueue) {
      universe.researchQueue.lastProgressAt = now;
      refreshImperialETA(universe, now);
    }
    return changed;
  }

  Object.assign(G, { isLocalResearch, normalizeResearchState, getFreeLabTotal,
    advanceResearchQueues, refreshImperialETA });
})();
