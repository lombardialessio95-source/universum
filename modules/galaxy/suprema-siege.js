/** Transizioni dell'assedio Suprema condivisibili tra simulazione e persistenza. */
(function () {
  'use strict';
  const G = window.__UniversumGalaxyModules;
  const S = window.UniversumSuprema;
  const unit = 'naveMadreSuprema';
  const spec = Object.freeze({attack:350000,shield:50000,hull:9000000,speed:125,driveType:'hyperspaceDrive',fuel:50000});
  const shipSpecs = Object.freeze({[unit]:spec});
  const materials = Object.keys(S.depotCaps);
  const hulls = Object.keys(S.slotsPerShip);
  const hour = 3600000;
  const launchCost = 10000;
  const fuelMs = 900;
  const total = ships => Object.values(ships).reduce((n,q)=>n+q,0);
  const cargo = ships => Object.entries(ships).reduce((n,[id,q])=>n+(window.UniversumData.SHIPS[id]?.cargo || 0)*q,0);
  const present = (universe,siege) => universe.supremes.filter(s=>s.siegeId===siege.id && s.status==='sieging');
  const full = ship => materials.every(k=>ship.resources[k]>=S.depotCaps[k]);

  function randomFrom(str) {
    let seed = 2166136261;
    for (const c of str) seed = Math.imul(seed ^ c.charCodeAt(0),16777619);
    return () => {
      seed = (Math.imul(seed,1664525)+1013904223)>>>0;
      return seed/4294967296;
    };
  }

  function manifest(ships, role, includeSuprema = false) {
    const fleet = {}, tags = {};
    for (const ship of ships) {
      const groups = includeSuprema ? {...ship.hangar[role],[unit]:1} : ship.hangar[role];
      for (const [id,count] of Object.entries(groups)) {
        if (!count) continue;
        fleet[id] = (fleet[id] || 0)+count;
        tags[id] ||= [];
        for (let n=0;n<count;n++) tags[id].push(ship.id);
      }
    }
    return {fleet,tags};
  }

  function survivors(ships,role,tags) {
    const byId = new Map(ships.map(ship=>[ship.id,ship]));
    for (const ship of ships) ship.hangar[role] = {};
    for (const id of hulls) for (const tag of tags[id] || []) {
      const group = byId.get(tag).hangar[role];
      group[id] = (group[id] || 0)+1;
    }
  }

  function start(universe,origin,target,id,selection,mode,hours,now) {
    if (!universe.planets.includes(origin) || target.ownerUid != null && target.ownerUid===origin.ownerUid ||
        !['prudente','offensiva'].includes(mode) || !Number.isInteger(hours) || hours<1 || hours>10 ||
        typeof id!=='string' || !id || !Number.isSafeInteger(now) || !Array.isArray(selection) || !selection.length || selection.length>3 || new Set(selection.map(x=>x.id)).size!==selection.length) {
      throw Error('Lancio coordinato non valido.');
    }
    const key = G.coordKey(target.coords.g,target.coords.s,target.coords.p);
    const all = universe.supremaSieges || [];
    if (all.some(s=>s.id===id || (s.targetKey===key && !s.endedAt)) ||
        (universe.activeSieges || []).some(s=>s.targetCoords && G.coordKey(
          s.targetCoords.g,s.targetCoords.s,s.targetCoords.p)===key)) throw Error('Pianeta già assediato.');
    const ships = selection.map(({id,whenFull})=>{
      const ship = universe.supremes?.find(s=>s.id===id);
      if (!ship || ship.planetId!==origin.id || ship.status!=='docked' || !['return','support'].includes(whenFull) ||
          ship.operatingFuel<Math.ceil(hours*hour/fuelMs)+(total(ship.hangar.invasion)?launchCost:0)) {
        throw Error('Suprema indisponibile o carburante operativo insufficiente.');
      }
      return {ship,whenFull};
    });
    if (!ships.some(({ship})=>total(ship.hangar.invasion))) throw Error('Assegna almeno una nave all’invasione.');
    const distance = G.calculateDistance(origin.coords,target.coords);
    const militarySpeed = Number(universe.militarySpeed) || 1;
    const travel = G.getFleetSpeedAndFuel({...universe,creativeMode:false},{[unit]:1},distance,100,{shipSpecs,speed:militarySpeed});
    const fuel = 2*travel.fuelCost*ships.length;
    if (origin.resources.deuterium<fuel) throw Error('Deuterio insufficiente per andata e ritorno protetto.');
    origin.resources.deuterium -= fuel;
    const arrival = now+travel.durationSec*1000;
    for (const {ship,whenFull} of ships) {
      ship.status = 'outbound';
      ship.siegeId = id;
      ship.whenFull = whenFull;
      ship.returnReserve = travel.fuelCost;
    }
    const siege = {id,mode,targetKey:key,targetCoords:{...target.coords},targetOwner:target.ownerUid ?? target.emperor,
      originId:origin.id,arrival,travel,attackTech:{...universe.researches},waveHours:hours,sequence:0,nextAt:arrival};
    universe.supremaSieges = [...all,siege];
    return siege;
  }

  function returnShip(ship,siege,at) {
    ship.status = 'returning';
    ship.returnAt = at+siege.travel.durationSec*1000;
  }

  function endIfNeeded(universe,siege,at,loss=false) {
    const ships = present(universe,siege);
    if ((loss && siege.mode==='prudente') || ships.every(s=>s.role==='support')) {
      for (const ship of ships) returnShip(ship,siege,at);
      siege.endedAt = at;
    }
  }

  function charge(universe,siege,at) {
    for (const ship of present(universe,siege)) {
      const amount = Math.floor((at-ship.fuelAt)/fuelMs);
      if (amount>=ship.operatingFuel) {
        const exhaustedAt = ship.fuelAt+ship.operatingFuel*fuelMs;
        ship.operatingFuel = 0;
        returnShip(ship,siege,exhaustedAt);
      } else if (amount>0) {
        ship.operatingFuel -= amount;
        ship.fuelAt += amount*fuelMs;
      }
    }
    endIfNeeded(universe,siege,at);
  }

  // Allocate first by proportional shares, then redistribute capped shares and rounding residue.
  function distribute(target,ships,limit) {
    const capacities = new Map(ships.map(s=>[s.id,cargo(s.hangar.invasion)]));
    for (const key of materials) {
      let remaining = Math.min(Math.floor(target.resources[key] || 0),limit[key] || 0);
      while (remaining>0) {
        const eligible = ships.filter(s=>capacities.get(s.id)>0 && s.resources[key]<S.depotCaps[key]);
        const weight = eligible.reduce((n,s)=>n+capacities.get(s.id),0);
        if (!weight) break;
        const initial = remaining;
        for (const s of eligible) {
          const capacity = capacities.get(s.id);
          const share = Math.max(1,Math.floor(initial*capacity/weight));
          const gain = Math.min(share,remaining,capacity,S.depotCaps[key]-s.resources[key]);
          s.resources[key] += gain;
          target.resources[key] -= gain;
          remaining -= gain;
          capacities.set(s.id,capacity-gain);
        }
      }
    }
  }

  function destroy(universe,siege,target,ships,at,random,capture=false,winningFleet={},originalCargo={}) {
    const captured = {};
    const loot = Object.fromEntries(materials.map(k=>[k,0]));
    let space = Math.max(0,cargo(winningFleet)-total(originalCargo));
    target.debris ||= {metal:0,crystal:0};
    for (const ship of ships) {
      if (capture) for (const id of hulls) {
        const internal = (ship.hangar.reserve[id] || 0)+(ship.hangar.invasion[id] || 0);
        const n = Math.floor(internal*0.3)+Math.floor((ship.hangar.escort[id] || 0)*0.5);
        if (n) captured[id] = (captured[id] || 0)+n;
      }
      for (const k of materials) {
        const take = Math.min(space,Math.floor(ship.resources[k]*0.5));
        loot[k] += take;
        space -= take;
      }
      target.debris.metal += 6000000;
      target.debris.crystal += 3600000;
      if (!target.moon && !target.bacinoSpaziale && !target.galatticaOrigin && random()<0.15) target.moon=G.makeMoon('Luna');
    }
    const removed = new Set(ships.map(ship=>ship.id));
    universe.supremes = universe.supremes.filter(ship=>!removed.has(ship.id));
    if (ships.length) endIfNeeded(universe,siege,at,true);
    return {captured,loot};
  }

  function wave(universe,siege,target,at) {
    for (const ship of present(universe,siege)) S.advanceShipyard(ship,at);
    charge(universe,siege,at);
    const attacking = [];
    for (const ship of present(universe,siege)) {
      if (ship.role==='support' || !total(ship.hangar.invasion)) continue;
      if (ship.operatingFuel<launchCost) returnShip(ship,siege,at);
      else attacking.push(ship);
    }
    const {fleet,tags} = manifest(attacking,'invasion');
    if (attacking.length) {
      for (const ship of attacking) ship.operatingFuel-=launchCost;
      const battle = G.resolveCombat(fleet,siege.attackTech,{...target,fleet:{},moon:null},
        {attackerTags:tags,random:randomFrom(siege.id+'/wave/'+siege.sequence)});
      survivors(attacking,'invasion',battle.attackerTagsAlive);
      target.defenses = Object.fromEntries(Object.entries(target.defenses || {}).map(([id,q])=>[id,Math.max(0,q-(battle.defenderLosses[id] || 0))]));
      if (battle.result==='attacker_win') distribute(target,attacking,battle.loot);
      for (const ship of attacking) if (full(ship)) {
        if (ship.whenFull==='support') ship.role='support';
        else returnShip(ship,siege,at);
      }
    }
    siege.sequence++;
    siege.nextAt = at+siege.waveHours*hour;
    endIfNeeded(universe,siege,at);
  }

  function orbital(universe,siege,target,fleet,tech,at,seed,targetSupremeId=null,originalCargo={}) {
    if (!siege.started || siege.endedAt) return null;
    charge(universe,siege,at);
    if (siege.endedAt) return null;
    const ships = present(universe,siege).filter(s=>!targetSupremeId || s.id===targetSupremeId || s.role==='support');
    if (targetSupremeId && !ships.some(s=>s.id===targetSupremeId)) return null;
    if (!ships.length) return null;
    const {fleet:defenders,tags} = manifest(ships,'escort',true);
    const random = randomFrom(siege.id+'/'+seed);
    const battle = G.resolveCombat(fleet,tech,{fleet:defenders,tech:siege.attackTech},{defenderTags:tags,shipSpecs,random});
    survivors(ships,'escort',battle.defenderTagsAlive);
    const alive = new Set(battle.defenderTagsAlive[unit] || []);
    const losses = ships.filter(s=>!alive.has(s.id));
    target.debris ||= {metal:0,crystal:0};
    target.debris.metal += battle.debris.metal;
    target.debris.crystal += battle.debris.crystal;
    const result = destroy(universe,siege,target,losses,at,random,Boolean(targetSupremeId),
      battle.result==='attacker_win'?battle.attackerSurvivors:{},originalCargo);
    return {...battle,...result};
  }

  function trimCargo(load, capacity) {
    const cargoAtArrival = {};
    for (const key of materials) {
      const kept = Math.min(capacity,Math.max(0,Math.floor(load?.[key] || 0)));
      cargoAtArrival[key] = kept;
      capacity -= kept;
    }
    return cargoAtArrival;
  }

  // Callers check ownership from their fresh planet snapshot. A fleet of an
  // ally is left to the ordinary arrival flow. The returned fleet and cargo
  // must replace the originals in the same write that records the combat.
  function interceptArrival(universe,siege,planet,fleet,at) {
    if (planet.ownerUid == null || fleet.attackerUid !== planet.ownerUid ||
        planet.ownerUid !== siege.targetOwner || fleet.targetKey !== siege.targetKey ||
        !fleet.id) return null;
    const battle = orbital(universe,siege,planet,fleet.ships,fleet.attackerTech || {},at,fleet.id);
    if (!battle) return null;
    return {
      ships:battle.attackerSurvivors,
      cargo:trimCargo(fleet.cargo,cargo(battle.attackerSurvivors)),
      result:battle.result,
      rounds:battle.roundsPlayed
    };
  }

  // Alliance membership is an input from a trusted snapshot of current
  // permissions. It must never be copied from a flag in a fleet document.
  function counteroffensive(universe,siege,planet,fleet,targetId,at,isAuthorizedAlly) {
    if (planet.ownerUid == null || planet.ownerUid!==siege.targetOwner ||
        fleet.targetKey!==siege.targetKey || !fleet.id || !targetId) return null;
    if (fleet.attackerUid!==planet.ownerUid && !isAuthorizedAlly(fleet.attackerUid,planet.ownerUid)) {
      throw Error('Controffensiva riservata al difensore e agli alleati autorizzati.');
    }
    const battle = orbital(universe,siege,planet,fleet.ships,fleet.attackerTech || {},at,fleet.id,targetId,fleet.cargo);
    if (!battle) return null;
    const ships={...battle.attackerSurvivors};
    const carried=trimCargo(fleet.cargo,cargo(ships));
    const space=Math.max(0,cargo(ships)-total(carried));
    const collected=trimCargo(battle.loot,space);
    for (const key of materials) carried[key]+=collected[key];
    if (total(ships)>0) for (const [id,n] of Object.entries(battle.captured)) {
      ships[id]=(ships[id] || 0)+n;
    }
    return {ships,cargo:carried,result:battle.result,rounds:battle.roundsPlayed};
  }

  function publicSiege(universe,siege) {
    return {
      attackerUid:siege.attackerUid || null,
      targetKey:siege.targetKey,
      ships:present(universe,siege).length,
      frequencyHours:siege.waveHours,
      nextWaveAt:siege.endedAt ? null : siege.nextAt
    };
  }

  function spySupreme(universe,siege,planet,fleet,targetId) {
    const probes = Math.floor(Number(fleet.ships?.espionageProbe || 0));
    if (planet.ownerUid==null || fleet.attackerUid!==planet.ownerUid || planet.ownerUid!==siege.targetOwner ||
        fleet.targetKey!==siege.targetKey || !fleet.id || !(probes>0)) return null;
    const ship=present(universe,siege).find(x=>x.id===targetId);
    if (!ship) return null;
    const {diff,probesLost}=G.evaluateEspionage(probes,Number(fleet.attackerTech?.espionageTech || 0),
      Number(siege.attackTech.espionageTech || 0),0,randomFrom(siege.id+'/spy/'+fleet.id));
    return {
      resources:{...ship.resources},
      fleet:diff>=0 ? {...ship.hangar.escort} : null,
      internals:diff>=1 ? {reserve:{...ship.hangar.reserve},invasion:{...ship.hangar.invasion}} : null,
      probesLost
    };
  }

  function changeFrequency(siege,hours,at=null) {
    if (siege.endedAt || !Number.isInteger(hours) || hours<1 || hours>10) throw Error('Frequenza non valida.');
    if (siege.started && at!==null && siege.nextAt<=at) throw Error('Attendere il recupero delle ondate scadute.');
    siege.waveHours=hours;
  }

  function advance(universe,siege,target,now,limit=32) {
    let steps=0;
    while (!siege.endedAt && siege.nextAt<=now && steps<limit) {
      const at = siege.nextAt;
      if (!siege.started) {
        for (const ship of universe.supremes.filter(s=>s.siegeId===siege.id && s.status==='outbound')) {
          ship.status='sieging';
          ship.role='offense';
          ship.fuelAt=at;
        }
        siege.started=true;
        if (total(target.fleet || {})) {
          const fight=orbital(universe,siege,target,target.fleet,target.tech || {},at,'arrival');
          if (fight) target.fleet=fight.attackerSurvivors;
          if (total(target.fleet)) {
            for (const ship of present(universe,siege)) returnShip(ship,siege,at);
            siege.endedAt=at;
            break;
          }
        }
      }
      if (!siege.endedAt) wave(universe,siege,target,at);
      steps++;
    }
    if (!siege.endedAt && siege.started && siege.nextAt>now) charge(universe,siege,now);
    return steps;
  }

  function recall(universe,siege,at) {
    if (siege.endedAt) return false;
    for (const ship of universe.supremes) {
      if (ship.siegeId===siege.id && ['outbound','sieging'].includes(ship.status)) returnShip(ship,siege,at);
    }
    siege.endedAt=at;
    return true;
  }

  function settleReturns(universe,now) {
    for (const ship of universe.supremes || []) {
      if (ship.status!=='returning' || ship.returnAt>now) continue;
      const home=universe.planets.find(p=>p.id===ship.planetId) || universe.planets[0];
      if (!home) continue;
      ship.planetId=home.id;
      ship.status='docked';
      delete ship.returnAt;
      delete ship.siegeId;
      delete ship.returnReserve;
      delete ship.role;
    }
  }

  function transfer(origin,ship,key,amount,now) {
    if (ship.status!=='docked' || ship.planetId!==origin.id || !Number.isSafeInteger(amount) || !amount ||
        (key!=='fuel' && !Object.hasOwn(S.depotCaps,key))) throw Error('Trasferimento non valido.');
    S.advanceShipyard(ship,now);
    const tank=key==='fuel';
    const balance=tank?ship.operatingFuel:ship.resources[key];
    const cap=tank?S.operatingCapacity:S.depotCaps[key];
    const fromKey=tank?'deuterium':key;
    if (balance+amount<0 || (amount>0 && (balance+amount>cap || origin.resources[fromKey]<amount))) {
      throw Error('Risorse o capienza insufficienti.');
    }
    origin.resources[fromKey]-=amount;
    if (tank) ship.operatingFuel+=amount;
    else ship.resources[key]+=amount;
    S.advanceShipyard(ship,now);
  }

  function advanceOffline(universe,now) {
    if (!universe.supremes?.length || Number.isSafeInteger(universe.serviceRevision)) return;
    for (const siege of universe.supremaSieges || []) {
      if (siege.endedAt) continue;
      if (siege.nextAt>now) {
        if (siege.started) {
          for (const ship of present(universe,siege)) S.advanceShipyard(ship,now);
          charge(universe,siege,now);
        } else for (const ship of universe.supremes) {
          if (ship.siegeId===siege.id && ship.status==='outbound') S.advanceShipyard(ship,now);
        }
        continue;
      }
      const c=siege.targetCoords;
      const target=G.generateProceduralSlot(universe,c.g,c.s,c.p);
      if (target.ownerType!=='bot' || target.emperor!==siege.targetOwner) {
        recall(universe,siege,Math.min(now,siege.nextAt));
        continue;
      }
      // The procedural slot can share its resource object with galaxyDeltas.
      target.resources={...target.resources};
      target.debris={...target.debris};
      if (advance(universe,siege,target,now)) {
        universe.galaxyDeltas ||= {};
        universe.galaxyDeltas[siege.targetKey] = {
          ...universe.galaxyDeltas[siege.targetKey],
          resourcesOverride:target.resources,fleetOverride:target.fleet,defensesOverride:target.defenses,
          debris:target.debris,hasMoon:Boolean(target.moon),hasBacino:Boolean(target.bacinoSpaziale)
        };
      }
    }
    settleReturns(universe,now);
    for (const ship of universe.supremes) {
      if (ship.status==='docked' || ship.status==='returning') S.advanceShipyard(ship,now);
    }
    if (universe.supremaSieges?.some(s=>s.endedAt)) {
      const outstanding=new Set(universe.supremes.map(s=>s.siegeId));
      universe.supremaSieges=universe.supremaSieges.filter(s=>!s.endedAt || outstanding.has(s.id));
    }
  }

  window.UniversumSupremaSieges = Object.freeze({spec,start,advance,orbital,recall,changeFrequency,settleReturns,advanceOffline,transfer,distribute,interceptArrival,counteroffensive,publicSiege,spySupreme});
})();
