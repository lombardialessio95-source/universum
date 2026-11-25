/** Navi di servizio: prenotazioni, manutenzione e avvio sulle linee ordinarie. */
(function () {
  'use strict';
  const ids = ['hephaestusForge', 'prometheusOracle'];
  const [forge, oracle] = ids;
  const materials = ['metal', 'crystal', 'deuterium'];
  const day = 86400000;
  const uid = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const data = () => window.UniversumData;
  function slots(id, lv) {
    if (id === forge) return Math.min(5, 1 + Math.floor(Math.max(0,lv - 1) / 3));
    return lv < 5 ? 0 : lv === 5 ? 1 : lv === 6 ? 2 : lv < 9 ? 3 : lv === 9 ? 4 : 5;
  }
  function inventory(u, id) {
    let orbit = 0, reserved = 0;
    for (const p of u.planets) {
      orbit += Number(p.fleet?.[id] || 0);
      for (const lot of p.shipyardQueue || []) if (lot.id === id) reserved += lot.remaining;
    }
    const flight = (u.fleetsInFlight || []).reduce((n,f) => n + (f.resolved ? 0 : Number((f.ships || f.fleet)?.[id] || 0)), 0);
    return {total: orbit + flight + reserved, reserved};
  }
  function quote(u, id, qty) {
    const {total, reserved} = inventory(u,id);
    const history = u.specialistBuilt?.[id] || 0;
    const cheap = Math.min(qty, Math.max(0,5 - history - reserved));
    const cost = {};
    for (const k of materials) cost[k] = data().SHIPS[id].cost[k] * (2 * qty - cheap);
    return {cost, free: Math.max(0,(id === forge ? 5 : 3) - total), cheap};
  }
  // I posti al prezzo base appartengono all'impero. Un cantiere più veloce
  // può completare per primo anche se ha prenotato per ultimo.
  function reservations(u,id) {
    return u.planets.flatMap(planet=>(planet.shipyardQueue || [])
      .filter(lot=>lot.id===id).map(lot=>({planet,lot})))
      .sort((a,b)=>a.lot.nextUnitEndTime-b.lot.nextUnitEndTime || a.lot.workId.localeCompare(b.lot.workId));
  }
  function completed(u,id,count,lot) {
    u.specialistBuilt ||= {};
    const history = u.specialistBuilt[id] || 0;
    if (lot && history < 5) {
      let need = Math.min(count,5-history);
      const own = Math.min(need,lot.baseReservations || 0);
      lot.baseReservations = (lot.baseReservations || 0) - own;
      need -= own;
      if (need) for (const other of reservations(u,id)) {
        const used = Math.min(need,other.lot.baseReservations || 0);
        other.lot.baseReservations = (other.lot.baseReservations || 0) - used;
        need -= used;
        if (!need) break;
      }
    }
    u.specialistBuilt[id] = history + count;
  }
  function releaseReservations(u,id) {
    const pending = reservations(u,id);
    let freed = Math.max(0,5-(u.specialistBuilt?.[id] || 0)-
      pending.reduce((n,item)=>n+(item.lot.baseReservations || 0),0));
    for (const {lot,planet} of pending) {
      if (!freed) break;
      const promoted = Math.min(freed,lot.remaining-(lot.baseReservations || 0));
      if (promoted <= 0) continue;
      lot.baseReservations = (lot.baseReservations || 0) + promoted;
      for (const k of materials) planet.resources[k] += data().SHIPS[id].cost[k]*promoted;
      freed -= promoted;
    }
  }
  function state(p,id,now) {
    p.services ||= {};
    return p.services[id] ||= { queue: [], at: now, fraction: {}, suspended:false };
  }
  function active(u,p,id) {
    return id === forge ? p.buildQueue || [] : [p.localResearchQueue, u.researchQueue?.planetId === p.id && u.researchQueue].filter(Boolean);
  }
  function multiplier(cost) { return 1 + 12 * cost / (cost + 1500000); }
  function settle(u,p,id,now) {
    const count = Number(p.fleet?.[id] || 0);
    if (!count && !p.services?.[id]) return;
    const s = state(p,id,now);
    if (!count) { s.queue.length = 0; s.at = Math.max(s.at,now); s.suspended = false; return; }
    if (now < s.at) return;
    const elapsed = Math.max(0, now - s.at);
    if (u.creativeMode) { s.at = now; s.rate = count; s.suspended = false; return; }
    let weighted = count * elapsed;
    let rate = count;
    for (const job of active(u,p,id)) {
      if (!job.serviceCost || !job.endTime) continue;
      const duration = Math.max(0, Math.min(now,job.endTime) - Math.max(s.at,job.startTime));
      const extra = multiplier(job.serviceCost) - 1;
      weighted += duration * extra;
      if (job.endTime > now) rate += extra;
    }
    s.rate = rate;
    const base = data().SHIPS[id].upkeep;
    const due = materials.map(k => base[k] * weighted / day);
    const payable = Math.min(1,...materials.map((k,i) => due[i] ?
      Math.max(0,p.resources[k] - (s.fraction[k] || 0)) / due[i] : 1));
    for (const [i,k] of materials.entries()) {
      const accrued = (s.fraction[k] || 0) + due[i] * payable;
      const whole = Math.floor(accrued + 1e-10);
      p.resources[k] = Math.max(0,p.resources[k] - whole);
      s.fraction[k] = Math.max(0,accrued - whole);
    }
    s.at = Math.max(s.at,now);
    s.suspended = !u.creativeMode && (payable < 1 || materials.some(k => p.resources[k] - s.fraction[k] < base[k] * rate / 86400));
  }
  function queue(u,p,id,key,now = Date.now()) {
    if (!ids.includes(id) || !(p.fleet?.[id] > 0)) throw Error('Nave di servizio assente.');
    const def = (id === forge ? data().BUILDINGS : data().RESEARCHES)[key];
    if (!def) throw Error('Lavorazione sconosciuta.');
    const s = state(p,id,now);
    if (s.queue.length >= slots(id,u.researches?.computerTech || 0)) throw Error('Posti di programmazione esauriti.');
    const level = id === forge ? p.buildings[key] || 0 : data().getResearchLevel(u,p,key);
    const target = Math.max(level,...active(u,p,id).filter(j=>j.id===key).map(j=>j.targetLevel),
      ...s.queue.filter(j=>j.id===key).map(j=>j.targetLevel)) + 1;
    if (def.maxLevel && target > def.maxLevel) throw Error('Livello massimo raggiunto.');
    s.queue.push({ workId:uid(), id:key, planetId:p.id, targetLevel:target, insertedAt:now });
  }
  function advance(u,now) {
    const heads = [];
    for (const p of u.planets) for (const id of ids) {
      settle(u,p,id,now);
      const s = p.services?.[id];
      if (s?.queue.length) heads.push({p,id,s, job:s.queue[0]});
    }
    const byPriority = (a,b)=>a.job.insertedAt-b.job.insertedAt || a.job.workId.localeCompare(b.job.workId);
    let changed = false;
    // Una nuova testa può usare una linea diversa (ricerca locale e imperiale).
    // Rientra immediatamente nell’arbitraggio, anche durante un recupero offline.
    while (heads.length) {
      heads.sort(byPriority);
      const {p,id,s,job} = heads.shift();
      try {
        if (s.suspended) throw Error('Manutenzione non disponibile');
        if (!slots(id,u.researches?.computerTech || 0)) throw Error('Tecnologia Informatica insufficiente');
        const research = id === oracle;
        const level = research ? data().getResearchLevel(u,p,job.id) : p.buildings[job.id] || 0;
        if (level < job.targetLevel) {
          if (level + 1 !== job.targetLevel) throw Error('Livello precedente richiesto');
          const engine = window.UniversumEngine;
          const index = u.planets.indexOf(p);
          const cost = research ? data().getResearchCost(job.id,job.targetLevel) : data().getBuildingCost(job.id,job.targetLevel);
          if (research) engine.startResearch(u,job.id,index,now);
          else engine.startBuilding(u,index,job.id,false,now);
          const started = active(u,p,id).find(j=>j.id===job.id && j.targetLevel===job.targetLevel);
          if (started) Object.assign(started,{workId:job.workId,serviceCost:materials.reduce((n,k)=>n+cost[k],0)});
        }
        s.queue.shift();
        settle(u,p,id,now);
        changed = true;
        if (s.queue.length) heads.push({p,id,s,job:s.queue[0]});
      } catch (e) { job.reason = e.message; }
    }
    return changed;
  }
  function hasServices(u) {
    return u.planets.some(p=>ids.some(id=>p.fleet?.[id] || p.services?.[id]?.queue?.length ||
      p.shipyardQueue?.some(lot=>lot.id===id)));
  }
  function nextBoundary(u,from,end) {
    let next = end;
    function consider(at) { if (at > from && at < next) next = at; }
    consider(u.researchQueue?.endTime);
    consider(u.turboUntil);
    for (const p of u.planets) {
      consider(p.localResearchQueue?.endTime);
      consider(p.buildQueue?.[0]?.endTime);
      for (const lot of p.shipyardQueue || []) if (ids.includes(lot.id)) consider(lot.nextUnitEndTime);
      for (const id of ids) {
        const service = p.services?.[id], job = service?.queue?.[0];
        if (!job || !/risorse insufficienti|manutenzione non disponibile/i.test(job.reason || '')) continue;
        const production = window.UniversumEngine.getPlanetProduction(p,u);
        const cost = id === forge ? data().getBuildingCost(job.id,job.targetLevel) : data().getResearchCost(job.id,job.targetLevel);
        let wait = 0;
        for (const k of materials) {
          const upkeep = ids.reduce((sum,key)=>sum+(p.fleet?.[key] ? data().SHIPS[key].upkeep[k]*(p.services?.[key]?.rate || p.fleet[key])/86400 : 0),0);
          const required = Math.max(cost[k],upkeep);
          if (required <= p.resources[k]) continue;
          const net = production[k+'PerSec'] - upkeep;
          if (net <= 0 || required > production.caps[k]) { wait = Infinity; break; }
          wait = Math.max(wait,(required-p.resources[k])/net);
        }
        if (wait > 0 && Number.isFinite(wait)) consider(from + Math.max(1000,Math.ceil(wait*1000)));
      }
    }
    return next;
  }
  function transfer(u,mission,target,ships) {
    if (!ids.some(id => ships?.[id] > 0)) return false;
    if (!['transport','deploy'].includes(mission) || !u.planets.some(p =>
      ['g','s','p'].every(k=>Number(p.coords[k])===Number(target[k])))) throw Error('Le specialiste possono viaggiare soltanto tra colonie proprie.');
    return true;
  }
  function settlePlanet(u,p,now = Date.now()) { for (const id of ids) settle(u,p,id,now); }
  window.UniversumServices = {ids,forge,oracle,hasServices,nextBoundary,slots,quote,completed,releaseReservations,uid,settlePlanet,settle,advance,queue,transfer,multiplier};
})();
