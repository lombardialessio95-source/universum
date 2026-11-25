'use strict';

/**
 * Fase 4 online — Opzione C: regole PURE dell'inventario.
 * Non usa Firestore né concede autorizzazioni. I chiamanti privilegiati devono
 * applicare i due snapshot e la ricevuta nello STESSO commit transazionale.
 * Il motore offline resta a 600 e NON importa questo modulo.
 */
const ONLINE_CAPACITY = 4000;
const WEIGHTS = Object.freeze({
  lightFighter: 1, heavyFighter: 3, cruiser: 8, battleship: 18, bomber: 22
});
const ROLES = Object.freeze(['escort', 'invasion', 'reserve']);

function unsigned(value, description) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw Error(description + ' non valido.');
  }
  return value;
}
function inventory(hangar) {
  if (!hangar || typeof hangar !== 'object' || Array.isArray(hangar)) {
    throw Error('Hangar online non valido.');
  }
  let used = 0;
  for (const role of ROLES) {
    const group = hangar[role];
    if (!group || typeof group !== 'object' || Array.isArray(group)) {
      throw Error('Ruolo hangar mancante: ' + role);
    }
    for (const [ship, amount] of Object.entries(group)) {
      if (!Object.hasOwn(WEIGHTS, ship)) throw Error('Classe hangar sconosciuta: ' + ship);
      used += unsigned(amount, 'Quantità hangar') * WEIGHTS[ship];
      if (!Number.isSafeInteger(used) || used > ONLINE_CAPACITY) {
        throw Error('Capienza Suprema online superata.');
      }
    }
  }
  return used;
}

/**
 * Calcolo senza side effect per caricamento di navi GIA' ESISTENTI.
 * Entrambi gli oggetti risultanti devono essere scritti atomically insieme
 * alla ricevuta dell'operazione, dopo controllo proprietà e revisione.
 */
function planLoad(planetFleet, hangar, ship, count) {
  if (!Object.hasOwn(WEIGHTS, ship)) throw Error('Classe non autorizzata.');
  if (!planetFleet || typeof planetFleet !== 'object' || Array.isArray(planetFleet)) {
    throw Error('Flotta planetaria non valida.');
  }
  unsigned(count, 'Quantità richiesta');
  if (count === 0) throw Error('Quantità richiesta nulla.');
  const stored = unsigned(planetFleet[ship] ?? 0, 'Navi sul pianeta');
  if (stored < count) throw Error('Navi sul pianeta insufficienti.');
  const occupied = inventory(hangar);
  if (occupied + count * WEIGHTS[ship] > ONLINE_CAPACITY) {
    throw Error('Hangar online pieno.');
  }
  const nextPlanetFleet = {...planetFleet, [ship]:stored-count};
  const nextHangar = Object.fromEntries(ROLES.map(role=>[role,{...hangar[role]}]));
  nextHangar.reserve[ship] = (nextHangar.reserve[ship] ?? 0) + count;
  inventory(nextHangar);
  return {planetFleet:nextPlanetFleet,hangar:nextHangar,usedSlots:occupied+count*WEIGHTS[ship]};
}

module.exports = Object.freeze({ONLINE_CAPACITY,WEIGHTS,ROLES,inventory,planLoad});
