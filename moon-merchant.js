/** UNIVERSUM — Mercante di Lune (offline + online, modalità Normale).
 * Formula classica OGame: 1% / 100.000 risorse del campo, massimo 20%.
 * Detriti teorici: 30% metallo + 30% cristallo del costo delle navi perse.
 * Il mercante recupera il 100% dei detriti: non resta un campo riciclabile.
 */
(function () {
  'use strict';
  const FEE = 1000000;
  const DEBRIS_RATE = 0.30;
  const MIN_DEBRIS = 100000;
  const MAX_CHANCE = 20;
  const Data = () => window.UniversumData;
  const positive = (n) => Math.max(0, Math.floor(Number(n) || 0));

  function createMoonData() {
    return {
      name: 'Luna', diameter: 8000, fieldsMax: 1,
      resources: { metal: 0, crystal: 0, deuterium: 0 },
      buildings: { lunarBase: 0, lunarStorage: 0, lunarShield: 0,
        secretShipyard: 0, sensorPhalanx: 0, jumpGate: 0 },
      buildQueue: [], jumpGateCooldownUntil: 0
    };
  }
  function inspect(planet) {
    const fleet = {};
    let ships = 0;
    let metal = 0;
    let crystal = 0;
    for (const [id, raw] of Object.entries(planet?.fleet || {})) {
      const spec = Data()?.SHIPS?.[id];
      const qty = positive(raw);
      if (!spec || !qty) continue;
      fleet[id] = qty;
      ships += qty;
      metal += Math.floor((Number(spec.cost?.metal) || 0) * qty * DEBRIS_RATE);
      crystal += Math.floor((Number(spec.cost?.crystal) || 0) * qty * DEBRIS_RATE);
    }
    const debris = metal + crystal;
    const chance = Math.min(MAX_CHANCE, Math.floor(debris / MIN_DEBRIS));
    let reason = '';
    if (!planet) reason = 'Pianeta non trovato.';
    else if (planet.moon) reason = 'Questo pianeta possiede già una Luna.';
    else if (planet.bacinoSpaziale || planet.galatticaOrigin) reason = 'Slot orbitale occupato da un Bacino o dalla Galattica.';
    else if (positive(planet.resources?.deuterium) < FEE) reason = 'Occorrono 1.000.000 di Deuterio sul pianeta.';
    else if (!ships || debris < MIN_DEBRIS) reason = 'Flotta insufficiente: servono navi capaci di generare almeno 100.000 detriti teorici (1% di probabilità).';
    return { available: !reason, reason, fleet, ships, debrisMetal: metal, debrisCrystal: crystal,
      debris, chance };
  }
  function report(outcome) {
    return `Attacco orbitale del Mercante di Lune concluso. Navi distrutte: ${outcome.ships}. ` +
      `Detriti generati: ${outcome.debrisMetal.toLocaleString('it-IT')} Metallo + ` +
      `${outcome.debrisCrystal.toLocaleString('it-IT')} Cristallo. ` +
      `Probabilità di Luna: ${outcome.chance}%. ` +
      (outcome.success ? 'Una Luna è nata in orbita! ' : 'Nessuna Luna si è formata. ') +
      'Il mercante ha recuperato tutti i detriti; difese, edifici e pianeta non sono stati colpiti. ' +
      'Compenso: 1.000.000 Deuterio.';
  }
  function applyOffline(universe, planetIndex) {
    if (universe?.creativeMode) throw new Error('In Creativa usa il pulsante Crea Luna dalla schermata Luna.');
    const planet = universe?.planets?.[planetIndex];
    const check = inspect(planet);
    if (!check.available) throw new Error(check.reason);
    const success = Math.random() < check.chance / 100;
    planet.resources.deuterium -= FEE;
    for (const id of Object.keys(check.fleet)) planet.fleet[id] = 0;
    if (success) {
      planet.moon = createMoonData();
      const key = `${planet.coords.g}:${planet.coords.s}:${planet.coords.p}`;
      universe.galaxyDeltas = universe.galaxyDeltas || {};
      universe.galaxyDeltas[key] = { ...(universe.galaxyDeltas[key] || {}),
        hasMoon: true, hasBacino: false, moonName: 'Luna' };
    }
    // Non creare / aumentare un campo detriti: il mercante li recupera tutti.
    const outcome = { ...check, success };
    universe.messages = universe.messages || [];
    universe.messages.unshift({ id: `moonmerchant_${Date.now()}`, time: Date.now(),
      type: 'combat', title: success ? 'Mercante di Lune: LUNA FORMATA' : 'Mercante di Lune: tentativo fallito',
      body: report(outcome) });
    return outcome;
  }
  window.UniversumMoonMerchant = { FEE, inspect, applyOffline, createMoonData, report };
})();
