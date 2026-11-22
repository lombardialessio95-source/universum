/** UNIVERSUM / modules/galaxy/trade.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumGalaxyModules;
  // Bridge lazy per le funzioni definite negli altri moduli.
  const addMessage = (...args) => G.addMessage(...args);
  const coordKey = (...args) => G.coordKey(...args);
  const generateProceduralSlot = (...args) => G.generateProceduralSlot(...args);



  // =========================================================
  // COMMERCIO CON BOT, MERCATO NERO E CONTRATTI
  // =========================================================
  function tradeWithBot(universe, planetIndex, botCoords, giveRes, giveAmount, getRes) {
    const planet = universe.planets[planetIndex];
    if (!planet) throw new Error('Pianeta non trovato.');
    if (giveRes === getRes) throw new Error('Seleziona due risorse diverse per lo scambio.');

    const slot = generateProceduralSlot(universe, botCoords.g, botCoords.s, botCoords.p);
    if (slot.ownerType !== 'bot') throw new Error('Nessun BOT commerciante alle coordinate indicate.');

    const amount = Math.max(100, Math.floor(Number(giveAmount) || 0));
    if (!universe.creativeMode && (planet.resources[giveRes] || 0) < amount) {
      throw new Error(`Risorse insufficienti sul pianeta (${giveRes}).`);
    }

    const rates = slot.tradeRates || { metal: 3.0, crystal: 2.0, deuterium: 1.0 };
    const valueInBase = amount / rates[giveRes];
    const receivedAmount = Math.floor(valueInBase * rates[getRes]);

    if (receivedAmount <= 0) throw new Error('Quantità troppo bassa per completare lo scambio.');

    if (!universe.creativeMode) {
      planet.resources[giveRes] -= amount;
    }
    planet.resources[getRes] = (planet.resources[getRes] || 0) + receivedAmount;

    addMessage(
      universe,
      'trade',
      `Scambio Commerciale con ${slot.emperor}`,
      `Ceduti ${amount.toLocaleString()} ${giveRes} per ${receivedAmount.toLocaleString()} ${getRes}.`
    );

    return { given: amount, received: receivedAmount, botName: slot.emperor };
  }


  function blackMarketTrade(universe, planetIndex, giveRes, giveAmount, getRes) {
    const planet = universe.planets[planetIndex];
    if (!planet) throw new Error('Pianeta non trovato.');
    if (giveRes === getRes) throw new Error('Seleziona due risorse diverse.');

    const amount = Math.max(500, Math.floor(Number(giveAmount) || 0));
    if (!universe.creativeMode && (planet.resources[giveRes] || 0) < amount) {
      throw new Error('Risorse insufficienti per il Mercato Nero.');
    }

    const baseWeights = { metal: 3.0, crystal: 2.0, deuterium: 1.0 };
    const receivedAmount = Math.floor((amount / baseWeights[giveRes]) * baseWeights[getRes] * 0.85);

    if (!universe.creativeMode) {
      planet.resources[giveRes] -= amount;
    }
    planet.resources[getRes] = (planet.resources[getRes] || 0) + receivedAmount;

    return { given: amount, received: receivedAmount };
  }


  function signBotContract(universe, planetIndex, botCoords) {
    const planet = universe.planets[planetIndex];
    if (!planet) throw new Error('Pianeta non trovato.');
    const slot = generateProceduralSlot(universe, botCoords.g, botCoords.s, botCoords.p);
    if (slot.ownerType !== 'bot') throw new Error('Coordinate non valide per un contratto BOT.');

    const key = coordKey(botCoords.g, botCoords.s, botCoords.p);
    if (!Array.isArray(universe.contracts)) universe.contracts = [];
    if (universe.contracts.some((c) => c.key === key)) {
      throw new Error('Hai già un contratto attivo con questo BOT.');
    }

    if (!universe.creativeMode) {
      if (planet.resources.metal < 10000) {
        throw new Error('Servono 10.000 Metallo per siglare il contratto di protezione.');
      }
      planet.resources.metal -= 10000;
    }

    const contract = {
      id: 'ctr_' + Date.now(),
      key,
      coords: Object.assign({}, botCoords),
      botName: slot.emperor,
      dailyCostMetal: 10000,
      signedAt: Date.now()
    };
    universe.contracts.push(contract);
    addMessage(universe, 'trade', `Patto Difensivo Siglato`, `${slot.emperor} [${key}] fornirà supporto difensivo in cambio di 10.000 Metallo/giorno.`);
    return contract;
  }

  Object.assign(G, { tradeWithBot, blackMarketTrade, signBotContract });

})();
