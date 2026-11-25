/** UNIVERSUM Fase 3 — hangar individuali delle Navi Madre normali.
 * Nessun timer, asset grafico o accesso al database: la persistenza usa i salvataggi esistenti.
 */
(function () {
  'use strict';
  const MAX_FIGHTERS = 50;
  const asInt = n => Math.max(0, Math.floor(Number(n) || 0));
  const copy = h => ({ id: String(h.id), fighters: asInt(h.fighters) });
  const safeId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id);
  const planetKey = p => String(p.id || `g${p.coords?.g}s${p.coords?.s}p${p.coords?.p}`).replace(/[^\w-]/g, '_');
  const uniqueId = p => 'ms_' + planetKey(p) + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
  const quantity = p => asInt(p?.fleet?.mothership);

  function normalizePlanet(p) {
    if (!p || !p.fleet) throw new Error('Pianeta o flotta non validi.');
    const n = quantity(p);
    const current = Array.isArray(p.mothershipHangars) ? p.mothershipHangars : [];
    const seen = new Set(), output = [];
    for (const h of current) {
      if (!h || !safeId(h.id) || seen.has(h.id) || !Number.isSafeInteger(Number(h.fighters)) || Number(h.fighters) < 0 || Number(h.fighters) > MAX_FIGHTERS) {
        throw new Error('Identificativo o carico degli hangar non valido: aggiornamento bloccato per evitare perdite.');
      }
      seen.add(h.id);
      output.push(copy(h));
    }
    if (output.length > n) throw Error('Più hangar che Navi Madre: sincronizzazione necessaria prima di continuare.');
    // Prima attivazione di un salvataggio precedente: gli hangar sono vuoti,
    // i caccia rimangono nello stock planetario (nessuna risorsa gratuita).
    for (let i = output.length; i < n; i++) {
      let id = `${planetKey(p)}_mother_${i}`;
      if (seen.has(id)) id = uniqueId(p);
      seen.add(id);
      output.push({ id, fighters: 0 });
    }
    p.mothershipHangars = output;
    return output;
  }
  function applyInbox(p, inbox, oldCount) {
    const previous=oldCount == null ? quantity(p) : asInt(oldCount);
    const before={id:p.id,coords:p.coords,fleet:{mothership:previous},mothershipHangars:p.mothershipHangars || []};
    normalizePlanet(before);
    const lost=new Set(Object.values(inbox?.hangarLosses || {}).flat());
    let manifest=before.mothershipHangars.filter(h=>!lost.has(h.id));
    const current=new Set(manifest.map(h=>h.id));
    for (const list of Object.values(inbox?.hangarReturns || {})) for (const h of verifyManifest(list)) {
      if (current.has(h.id)) throw Error('Hangar di rientro duplicato.');
      current.add(h.id);manifest.push(h);
    }
    p.mothershipHangars=manifest;
    return normalizePlanet(p);
  }
  function changeLoad(p, id, amount) {
    if (!Number.isSafeInteger(amount) || !amount) throw new Error('Quantità di caccia non valida.');
    const all = normalizePlanet(p), h = all.find(x => x.id === id);
    if (!h) throw new Error('Nave Madre non disponibile su questo pianeta.');
    if (h.fighters + amount < 0 || h.fighters + amount > MAX_FIGHTERS) throw new Error('Capacità hangar: da 0 a 50 Caccia Leggeri.');
    if (amount > 0 && asInt(p.fleet.lightFighter) < amount) throw new Error('Caccia Leggeri liberi insufficienti.');
    p.fleet.lightFighter = asInt(p.fleet.lightFighter) - amount;
    h.fighters += amount;
    return h;
  }
  function verifyManifest(manifest, required = null, loaded = false) {
    if (!Array.isArray(manifest) || !manifest.length) throw new Error('Seleziona almeno una Nave Madre.');
    if (required != null && manifest.length !== required) throw new Error('Numero Navi Madre e numero hangar non coincidono.');
    const seen = new Set();
    for (const h of manifest) {
      if (!h || !safeId(h.id) || seen.has(h.id) || !Number.isSafeInteger(Number(h.fighters)) || h.fighters < 0 || h.fighters > MAX_FIGHTERS) {
        throw new Error('Manifesto degli hangar non valido.');
      }
      if (loaded && h.fighters < 1) throw new Error('Ogni Nave Madre in incursione deve avere almeno un Caccia Leggero.');
      seen.add(h.id);
    }
    return manifest.map(copy);
  }
  function select(p, count, ids = null, mustBeLoaded = false) {
    const all = normalizePlanet(p), n = asInt(count);
    if (n === 0 || n > all.length) throw new Error('Numero Navi Madre insufficiente.');
    let chosen;
    if (ids != null) {
      if (!Array.isArray(ids) || ids.length !== n || new Set(ids).size !== n) throw new Error('Selezione degli hangar non valida.');
      chosen = ids.map(id => all.find(h => h.id === id));
      if (chosen.some(h => !h)) throw new Error('Una Nave Madre selezionata non è più disponibile.');
    } else {
      chosen = mustBeLoaded ? all.filter(h => h.fighters > 0).slice(0,n) : all.slice(0,n);
    }
    return verifyManifest(chosen,n,mustBeLoaded);
  }
  function take(p, manifest) {
    const all = normalizePlanet(p), taken = verifyManifest(manifest);
    const byId = new Map(all.map(h => [h.id,h]));
    if (taken.some(h => !byId.has(h.id) || byId.get(h.id).fighters !== h.fighters)) throw new Error('Hangar modificati da un altro client; partenza annullata.');
    const ids = new Set(taken.map(h=>h.id));
    p.mothershipHangars = all.filter(h => !ids.has(h.id));
    // Il numero fisico di navi viene decrementato separatamente dalla flotta.
    return taken;
  }
  function restore(p, manifest) {
    const incoming = Array.isArray(manifest) ? manifest : [];
    if (!incoming.length) return;
    const existing = Array.isArray(p.mothershipHangars) ? p.mothershipHangars : [];
    const ids = new Set(existing.map(h=>h.id));
    const add = verifyManifest(incoming);
    for (const h of add) {
      if (ids.has(h.id)) throw new Error('Hangar già presente: rientro duplicato bloccato.');
      ids.add(h.id);
    }
    p.mothershipHangars = existing.concat(add);
  }
  function validateMission(ships, manifest) {
    const n = asInt(ships?.mothership);
    if (Object.entries(ships || {}).some(([id, q]) => asInt(q) > 0 && id !== 'mothership')) {
      throw new Error('Incursione Planetaria: sono consentite solo Navi Madre normali.');
    }
    return verifyManifest(manifest, n, true);
  }
  const sum = map => Object.values(map || {}).reduce((a,n)=>a + asInt(n),0);
  // Ogni combattente è etichettato con l'identità del vettore di origine.
  // I superstiti vengono contati per identità: non vengono riassegnati.
  function resolveIncursion(manifest, attackerTech, defender, cargo = {}) {
    const carriers = verifyManifest(manifest, null, true);
    const G = window.UniversumGalaxy;
    if (!G || typeof G.resolveCombat !== 'function') throw new Error('Motore di combattimento non disponibile.');
    const empty = { metal:0, crystal:0, deuterium:0 };
    const carrierIds = carriers.map(h=>h.id);
    const fighterTags = carriers.flatMap(h=>Array(h.fighters).fill(h.id));
    const defenderManifest=defender.mothershipHangars || [];
    const orbit = G.resolveCombat({mothership:carriers.length}, attackerTech, {
      fleet:defender.fleet || {}, defenses:{}, tech:defender.tech || {}, resources:empty, buildings:{}, moon:null
    }, {maxRounds:3, attackerTags:{mothership:carrierIds},
      defenderTags:defenderManifest.length ? {mothership:defenderManifest.map(h=>h.id)} : {}});
    const ground = G.resolveCombat({lightFighter:fighterTags.length}, attackerTech, {
      fleet:{}, defenses:defender.defenses || {}, tech:defender.tech || {}, resources:empty, buildings:{}, moon:null
    }, {maxRounds:3, attackerTags:{lightFighter:fighterTags}});
    const survivorIds = new Set(orbit.attackerTagsAlive?.mothership || []);
    const aliveCounts = new Map();
    for (const id of ground.attackerTagsAlive?.lightFighter || []) aliveCounts.set(id,(aliveCounts.get(id)||0)+1);
    const recovered = carriers.filter(h=>survivorIds.has(h.id)).map(h=>({id:h.id,fighters:aliveCounts.get(h.id)||0}));
    const recoveredFighters = recovered.reduce((n,h)=>n+h.fighters,0);
    const lostWithCarriers = Math.max(0,sum(ground.attackerSurvivors) - recoveredFighters);
    const resources = defender.resources || empty;
    const bunker = Math.min(9,asInt(defender.buildings?.hiddenBunker));
    const protection = Math.max(.1,1-bunker*.1);
    const keys = ['metal','crystal','deuterium'];
    const available = keys.map(k=>Math.floor(asInt(resources[k]) * protection * .5));
    const rawCargo = keys.reduce((n,k)=>n+asInt(cargo[k]),0);
    const maxCargo = Math.max(0,carriers.length ? recovered.length * (window.UniversumData?.SHIPS?.mothership?.cargo || 0) - rawCargo : 0);
    const limit = Math.min(recoveredFighters*1000,maxCargo,available.reduce((a,b)=>a+b,0));
    const loot = {metal:0,crystal:0,deuterium:0};
    if (limit>0) {
      const sumAvail = available.reduce((a,b)=>a+b,0);
      let used=0;
      available.forEach((cap,i)=>{loot[keys[i]]=Math.floor(limit*cap/sumAvail);used+=loot[keys[i]];});
      let remaining=limit-used;
      // Ripartizione deterministica di eventuali unità intere residue.
      for(let i=0;remaining>0 && i<3;i++) {const give=Math.min(remaining,available[i]-loot[keys[i]]);loot[keys[i]]+=give;remaining-=give;}
    }
    const extraDebris = window.UniversumData?.SHIPS?.lightFighter?.cost || {metal:0,crystal:0};
    return {
      orbit, ground, carriers:recovered, recoveredFighters, lostWithCarriers,
      loot, ships:{mothership:recovered.length},
      defenderFleet:orbit.defenderFleetSurvivors || {},
      defenderHangars:defenderManifest.length ? defenderManifest.filter(h=>new Set(orbit.defenderTagsAlive?.mothership || []).has(h.id)) : [],
      defenderDefenses:ground.repairedDefenses || {},
      debris:{metal:orbit.debris.metal+ground.debris.metal+Math.floor((extraDebris.metal||0)*lostWithCarriers*.3),
        crystal:orbit.debris.crystal+ground.debris.crystal+Math.floor((extraDebris.crystal||0)*lostWithCarriers*.3)}
    };
  }
  window.UniversumHangars = Object.freeze({ MAX_FIGHTERS, normalizePlanet, applyInbox, changeLoad, select, take, restore, validateMission, verifyManifest, resolveIncursion });
})();
