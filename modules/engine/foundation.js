/** UNIVERSUM / modules/engine/foundation.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumEngineModules;


  function getData() {
    return window.UniversumData;
  }


  // Normalizza campi del pianeta per retrocompatibilità
  function normalizePlanet(planet) {
    if (!planet || typeof planet !== 'object') return planet;
    if (!planet.localResearches || typeof planet.localResearches !== 'object' || Array.isArray(planet.localResearches)) planet.localResearches = {};
    if (planet.localResearchQueue === undefined) planet.localResearchQueue = null;
    if (!planet.buildings) planet.buildings = {};
    if (planet.buildings.deuteriumSynthesizer !== undefined && planet.buildings.deuteriumSynth === undefined) {
      planet.buildings.deuteriumSynth = planet.buildings.deuteriumSynthesizer;
    }
    if (planet.buildings.deuteriumSynth === undefined) {
      planet.buildings.deuteriumSynth = 0;
    }
    if (planet.buildings.hiddenBunker === undefined) {
      planet.buildings.hiddenBunker = 0;
    }
    if (!Array.isArray(planet.buildQueue)) planet.buildQueue = [];
    if (!Array.isArray(planet.shipyardQueue)) planet.shipyardQueue = [];
    if (!Array.isArray(planet.defenseQueue)) planet.defenseQueue = [];
    if (!planet.defenses) planet.defenses = {};
    if (!planet.fleet) planet.fleet = {};
    if (planet.moon) {
      if (!planet.moon.buildings) planet.moon.buildings = {};
      if (!Array.isArray(planet.moon.buildQueue)) planet.moon.buildQueue = [];
      if (!planet.moon.resources) planet.moon.resources = { metal: 0, crystal: 0, deuterium: 0 };
    }
    // Bacino Spaziale: campo opzionale, i salvataggi vecchi lo ricevono come null.
    if (planet.bacinoSpaziale === undefined) planet.bacinoSpaziale = null;
    if (planet.bacinoSpaziale) {
      const b = planet.bacinoSpaziale;
      if (!b.paid) b.paid = { metal: 0, crystal: 0, deuterium: 0 };
      b.daysPaid = Math.max(0, Math.min(20, Math.floor(Number(b.daysPaid) || 0)));
      if (!b.status) b.status = b.daysPaid >= 20 ? 'active' : 'building';
      if (!Number(b.nextPaymentAt)) b.nextPaymentAt = 0;
      // Nessun tetto qui: troncare a 4 cancellerebbe in silenzio Invictus legittime (es. in rientro).
      b.invictusActive = Math.max(0, Math.floor(Number(b.invictusActive) || 0));
      if (!Array.isArray(b.invictusConstructions)) b.invictusConstructions = [];
      for (const c of b.invictusConstructions) {
        if (!c.paid) c.paid = { metal: 0, crystal: 0, deuterium: 0 };
        c.daysPaid = Math.max(0, Math.min(20, Math.floor(Number(c.daysPaid) || 0)));
        if (!c.status) c.status = 'building';
        if (!Number(c.nextPaymentAt)) c.nextPaymentAt = 0;
      }
      // Crepuscolo: progetto unico nel Bacino + flag permanente di Bacino mai usato.
      if (b.crepuscolo === undefined) b.crepuscolo = null;
      if (b.crepuscolo) {
        const c = b.crepuscolo;
        if (!c.paid) c.paid = { metal: 0, crystal: 0, deuterium: 0 };
        if (!c.status) c.status = 'active';
        if (!Number(c.daysTotal)) c.daysTotal = getData().CREPUSCOLO.buildDays;
        c.daysPaid = Math.max(0, Math.min(c.daysTotal, Math.floor(Number(c.daysPaid) || 0)));
        if (!Number(c.nextPaymentAt)) c.nextPaymentAt = 0;
        if (c.repairKind === undefined) c.repairKind = null;
        if (!c.projectKind) c.projectKind = c.status === 'repairing' ? (c.repairKind || 'battle') : 'build';
      }
      if (b.everUsed === undefined) {
        b.everUsed = b.invictusActive > 0 || b.invictusConstructions.length > 0 || !!b.crepuscolo;
      }
      if (b.galatticaConstruction === undefined) b.galatticaConstruction = null;
      if (b.galatticaConstruction) {
        const gc = b.galatticaConstruction;
        if (!gc.paid) gc.paid = { metal: 0, crystal: 0, deuterium: 0 };
        if (!gc.status) gc.status = 'building';
        gc.daysPaid = Math.max(0, Math.min(getData().GALATTICA.buildDays, Math.floor(Number(gc.daysPaid) || 0)));
        if (!Number(gc.nextPaymentAt)) gc.nextPaymentAt = 0;
      }
    }
    if (planet.galatticaOrigin === undefined) planet.galatticaOrigin = false;
    return planet;
  }
  Object.assign(G, { getData, normalizePlanet });

})();
