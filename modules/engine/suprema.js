/** Transizioni della costruzione e degli inventari della Nave Madre Suprema. */
(function (root) {
  'use strict';

  const DAY_MS = 86400000;
  const installments = 40;
  const dailyCost = Object.freeze({metal:500000, crystal:300000, deuterium:200000});
  const depotCaps = Object.freeze({metal:5000000, crystal:3000000, deuterium:2000000});
  const slotsPerShip = Object.freeze({lightFighter:1, heavyFighter:3, cruiser:8, battleship:18, bomber:22});
  const roles = Object.freeze(['escort', 'invasion', 'reserve']);
  const requirements = Object.freeze({
    quantumPhysics:7, jumpPropulsion:4, mobilePlanetaryStructure:3,
    stellarReactor:4, spatialTerraforming:3
  });
  const maxSupremes = 3;
  const hangarCapacity = 600;
  const operatingCapacity = 840000;
  const resources = Object.keys(dailyCost);

  function start(universe, planet, id, now, boundInvictus) {
    if (!universe.planets.includes(planet) || typeof id !== 'string' || !id ||
        Number.isSafeInteger(universe.serviceRevision) || !Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(boundInvictus) || boundInvictus < 0) {
      throw Error('Dati della costruzione non validi.');
    }
    const dock = planet.bacinoSpaziale;
    if (dock?.status !== 'active' || boundInvictus || dock.crepuscolo ||
        dock.galatticaConstruction || dock.supremaConstruction) {
      throw Error('La Suprema richiede un Bacino attivo e libero.');
    }
    const active = universe.supremes || [];
    const pending = universe.planets.flatMap(p=>p.bacinoSpaziale?.supremaConstruction || []);
    if (active.length + pending.length >= maxSupremes) throw Error('Limite imperiale delle Supreme raggiunto.');
    if ([...active,...pending].some(x=>x.id===id)) throw Error('ID della Suprema già assegnato.');
    for (const [research,level] of Object.entries(requirements)) {
      if (!(planet.localResearches?.[research]>=level)) throw Error('Ricerca locale insufficiente: '+research);
    }
    dock.supremaConstruction = {id, planetId:planet.id, startedAt:now, nextPaymentAt:now+DAY_MS, daysPaid:0, status:'building'};
    return dock.supremaConstruction;
  }

  function settle(universe, planet, now) {
    const dock = planet.bacinoSpaziale;
    const order = dock?.supremaConstruction;
    if (dock?.status !== 'active' || !order || now < order.nextPaymentAt) return false;
    const affordable = Math.min(...resources.map(k=>Math.floor((planet.resources[k] || 0)/dailyCost[k])));
    if (affordable < 1) {
      order.status = 'stopped';
      return false;
    }
    const due = order.status === 'stopped' ? 1 : 1+Math.floor((now-order.nextPaymentAt)/DAY_MS);
    const count = Math.min(due, affordable, installments-order.daysPaid);
    const lastPaidAt = order.status === 'stopped' ? now : order.nextPaymentAt+(count-1)*DAY_MS;
    for (const key of resources) planet.resources[key] -= count*dailyCost[key];
    order.daysPaid += count;
    order.nextPaymentAt = lastPaidAt+DAY_MS;
    order.status = order.daysPaid < installments && order.nextPaymentAt <= now ? 'stopped' : 'building';
    if (order.daysPaid === installments) {
      universe.supremes ||= [];
      universe.supremes.push({
        id:order.id, planetId:planet.id, status:'docked', completedAt:lastPaidAt,
        resources:{metal:0,crystal:0,deuterium:0}, operatingFuel:0,
        hangar:{escort:{},invasion:{},reserve:{}}, shipyardQueue:[]
      });
      delete dock.supremaConstruction;
    }
    return true;
  }

  function cancel(planet, orderId) {
    const dock = planet.bacinoSpaziale;
    const order = dock?.supremaConstruction;
    if (!order || order.id !== orderId || dock.status !== 'active') return null;
    const refund = {};
    for (const key of resources) {
      refund[key] = order.daysPaid*dailyCost[key]/2;
      planet.resources[key] += refund[key];
    }
    delete dock.supremaConstruction;
    return refund;
  }

  function usedSlots(supreme) {
    let used = 0;
    for (const group of roles) for (const ship of Object.keys(slotsPerShip)) {
      used += (supreme.hangar[group][ship] || 0)*slotsPerShip[ship];
    }
    return used;
  }

  function reservedSlot(supreme) {
    const first = supreme.shipyardQueue[0];
    return first?.finishAt === undefined ? 0 : slotsPerShip[first.ship];
  }

  function load(universe, planet, supreme, ship, count) {
    if (!universe.planets.includes(planet) || !universe.supremes?.includes(supreme) ||
        supreme.status !== 'docked' || supreme.planetId !== planet.id ||
        !Object.hasOwn(slotsPerShip,ship) || !Number.isSafeInteger(count) || count<1) {
      throw Error('Caricamento hangar non valido.');
    }
    if ((planet.fleet[ship] || 0)<count || usedSlots(supreme)+reservedSlot(supreme)+slotsPerShip[ship]*count>hangarCapacity) {
      throw Error('Navi o spazio hangar insufficienti.');
    }
    planet.fleet[ship] -= count;
    supreme.hangar.reserve[ship] = (supreme.hangar.reserve[ship] || 0)+count;
  }

  function assign(supreme, ship, count, source, target) {
    if (supreme.status !== 'docked' || !Object.hasOwn(slotsPerShip,ship) || !roles.includes(source) ||
        !roles.includes(target) || source === target || !Number.isSafeInteger(count) || count < 1 ||
        (supreme.hangar[source][ship] || 0) < count) {
      throw Error('Assegnazione hangar non valida.');
    }
    supreme.hangar[source][ship] -= count;
    supreme.hangar[target][ship] = (supreme.hangar[target][ship] || 0)+count;
  }

  function queueShips(supreme, universe, engine, catalog, id, ship, count, now) {
    if (!Object.hasOwn(slotsPerShip,ship) || !Number.isSafeInteger(count) || count<1 ||
        typeof id !== 'string' || !id || supreme.shipyardQueue.some(order=>order.id===id) ||
        !Number.isSafeInteger(now) || now<0) throw Error('Ordine del cantiere non valido.');
    const cost = catalog[ship].cost;
    const seconds = engine.getSingleUnitTime(universe,{buildings:{shipyard:12}},ship);
    supreme.shipyardQueue.push({id,ship,remaining:count,queuedAt:now,
      duration:Math.max(1000,seconds*1000),cost:Object.fromEntries(resources.map(k=>[k,cost[k]]))});
  }

  function advanceShipyard(supreme, now) {
    const queue = supreme.shipyardQueue;
    let cursor = supreme.shipyardAt ?? 0;
    while (queue.length) {
      const order = queue[0];
      if (order.finishAt !== undefined) {
        if (order.finishAt>now) break;
        cursor = order.finishAt;
        supreme.hangar.reserve[order.ship] = (supreme.hangar.reserve[order.ship] || 0)+1;
        order.remaining--;
        delete order.finishAt;
        if (!order.remaining) queue.shift();
        continue;
      }
      if (order.queuedAt>now) break;
      if (usedSlots(supreme)+slotsPerShip[order.ship]>hangarCapacity ||
          resources.some(k=>supreme.resources[k]<order.cost[k])) {
        // Record when the line was still blocked to avoid retroactive production.
        supreme.shipyardAt = now;
        return;
      }
      for (const key of resources) supreme.resources[key] -= order.cost[key];
      order.finishAt = Math.max(cursor,order.queuedAt)+order.duration;
    }
    supreme.shipyardAt = Math.max(supreme.shipyardAt ?? 0,cursor);
  }

  function cancelShipOrder(supreme, id) {
    const queue = supreme.shipyardQueue;
    const index = queue.findIndex(order=>order.id===id);
    if (index<0) return false;
    const order = queue[index];
    // An active hull stays in production. Only unpaid pending hulls are removed.
    if (order.finishAt !== undefined) {
      if (order.remaining===1) return false;
      order.remaining=1;
    } else queue.splice(index,1);
    return true;
  }

  const core = Object.freeze({DAY_MS, installments, dailyCost, requirements, depotCaps, slotsPerShip, hangarCapacity,
    operatingCapacity, start, settle, cancel, usedSlots, load, assign, queueShips, advanceShipyard, cancelShipOrder});
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  else root.UniversumSuprema = core;
})(typeof window !== 'undefined' ? window : globalThis);
