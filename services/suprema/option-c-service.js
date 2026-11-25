'use strict';
/** Authoritative, single-attack option C. STAGING ONLY, callable is server gated. */
const Engine=require('./engine');
const Inv=require('./option-c-inventory');
const Battle=require('./option-c-battle');
const Yard=require('./option-c-yard');
const DAY=86400000, HOUR=3600000;
const ID=/^[A-Za-z0-9_-]{1,80}$/, COORD=/^\d{1,2}_\d{1,3}_\d{1,2}$/;
const kinds=['metal','crystal','deuterium'];
class OptionCError extends Error {constructor(code,message){super(message);this.code=code;}}
const fail=(code,message)=>{throw new OptionCError(code,message);};
const requireId=(s,label,pattern=ID)=>{if(typeof s!=='string'||!pattern.test(s))fail('invalid-argument',label+' non valido.');return s;};
const qty=n=>Number.isSafeInteger(n)&&n>0;
const clone=o=>JSON.parse(JSON.stringify(o));
const money=(doc,k)=>Math.max(0,Math.floor(Number(doc?.resources?.[k]||0)+Number(doc?.inbox?.resources?.[k]||0)));
const stock=(doc,k)=>Math.max(0,Math.floor(Number(doc?.fleet?.[k]||0)+Number(doc?.inbox?.fleet?.[k]||0)));
const debt=(tx,ref,doc,kind,k,delta)=>tx.update(ref,{['inbox.'+kind+'.'+k]:(Number(doc.inbox?.[kind]?.[k])||0)+delta});
const owned=(doc,uid)=>Boolean(doc?.ownerUid===uid);
const newInv=uid=>({ownerUid:uid,version:1,ships:[],constructions:[]});
const baseFor=(db,universeId)=>db.collection('online_universes').doc(universeId);
const privFor=(base,uid)=>base.collection('supremaOptionCPrivate').doc(uid);
const missionFor=(base,id)=>base.collection('supremaOptionCMissions').doc(id);
const publicFor=(base,id)=>base.collection('supremaOptionCPublic').doc(id);
const receiptFor=(base,uid,id)=>base.collection('supremaOptionCReceipts').doc(uid+'_'+id);
const paid={metal:500000,crystal:300000,deuterium:200000};
function eligibility(planet) {
  const dock=planet?.bacinoSpaziale;
  if (dock?.status!=='active'||dock.crepuscolo||dock.galatticaConstruction||
    dock.supremaConstruction||dock.invictusConstruction||Number(dock.invictusActive||0)>0) {
    fail('failed-precondition','Bacino non disponibile per costruire la Suprema.');
  }
  for (const [id,lv] of Object.entries(Engine.core.requirements)) {
    if (Number(planet.localResearches?.[id]||0)<lv)fail('failed-precondition','Ricerca locale mancante: '+id);
  }
}
function validateShip(s) {
  if(!s||typeof s.id!=='string'||!ID.test(s.id)||!['docked','outbound','returning'].includes(s.status)) {
    fail('failed-precondition','Inventario Suprema non valido.');
  }
  Inv.inventory(s.hangar);
}
function checkInventory(inv,uid) {
  if(inv.ownerUid!==uid||!Array.isArray(inv.ships)||!Array.isArray(inv.constructions)||
     inv.ships.length+inv.constructions.length>3)fail('failed-precondition','Inventario imperiale incoerente.');
  const ids=new Set();
  for(const item of [...inv.ships,...inv.constructions]) {
    if(!ID.test(item.id)||ids.has(item.id))fail('failed-precondition','Identificatori Supreme duplicati.');
    ids.add(item.id);
  }
  for(const s of inv.ships)validateShip(s);
}
function planSettlement(inv,docs,now) {
  const debits=new Map();
  for(const order of inv.constructions) {
    if(order.paidDays>=40)continue;
    if(order.nextPaymentAt>now)continue;
    const planet=docs.get(order.originKey);
    if(!planet)continue;
    let due=order.status==='stopped'?1:Math.floor((now-order.nextPaymentAt)/DAY)+1;
    due=Math.min(40-order.paidDays,due);
    const resource=Object.fromEntries(kinds.map(k=>[k,money(planet,k)-(debits.get(order.originKey)?.[k]||0)]));
    const affordable=Math.max(0,Math.min(...kinds.map(k=>Math.floor(resource[k]/paid[k]))));
    if(affordable===0) {order.status='stopped';continue;}
    const count=Math.min(due,affordable);
    const amounts=debits.get(order.originKey)||{metal:0,crystal:0,deuterium:0};
    for(const k of kinds)amounts[k]+=paid[k]*count;
    debits.set(order.originKey,amounts);
    const previous=order.status==='stopped' ? now : order.nextPaymentAt+(count-1)*DAY;
    order.paidDays+=count;
    order.nextPaymentAt=previous+DAY;
    order.status=order.paidDays<40 && order.nextPaymentAt<=now ? 'stopped' : 'building';
  }
  const ready=inv.constructions.filter(c=>c.paidDays===40);
  inv.constructions=inv.constructions.filter(c=>c.paidDays!==40);
  for(const o of ready) inv.ships.push({
    id:o.id,originKey:o.originKey,status:'docked',completedAt:now,
    resources:{metal:0,crystal:0,deuterium:0},operatingFuel:0,
    hangar:{escort:{},invasion:{},reserve:{}},shipyardQueue:[]
  });
  return debits;
}
function mutateInventory(tx,ref,inv){checkInventory(inv,inv.ownerUid);tx.set(ref,inv);}
function getCoords(key){const [g,s,p]=key.split('_').map(Number);return {g,s,p};}
function projection(mission){return {
  participants:[mission.attackerUid,mission.defenderUid],
  attackerUid:mission.attackerUid,defenderUid:mission.defenderUid,
  originKey:mission.originKey,targetKey:mission.targetKey,
  launchedAt:mission.launchedAt,arrivalAt:mission.arrivalAt,
  returnAt:mission.returnAt||null,status:mission.status,
  ...(mission.report?{report:mission.report}:{})
};}
function fingerprint(command){const copy={...command};delete copy.uid;return JSON.stringify(copy);}
async function commandAction(db,input,clock=Date.now){
  const {uid,universeId,action,commandId}=input||{};
  if(!uid)fail('unauthenticated','Accesso richiesto.');
  requireId(universeId,'Universo');requireId(commandId,'Comando');
  if(!['build','cancelBuild','load','assign','deposit','queue','launch','resolve','return'].includes(action)) {
    fail('invalid-argument','Azione Suprema non supportata.');
  }
  const base=baseFor(db,universeId),inventoryRef=privFor(base,uid),
    receipt=receiptFor(base,uid,commandId),now=clock();
  if(!Number.isSafeInteger(now)||now<0)fail('failed-precondition','Orologio non valido.');
  const fingerprintValue=fingerprint(input);
  const originKey=['build','cancelBuild','load','deposit','launch','return'].includes(action)?
    requireId(input.originKey,'Pianeta',COORD):null;
  const targetKey=action==='launch'?requireId(input.targetKey,'Bersaglio',COORD):null;
  const missionId=['launch','resolve','return'].includes(action)?
    (action==='launch'?uid+'_'+commandId:requireId(input.missionId,'Missione')):null;
  if(action==='launch'&&originKey===targetKey)fail('invalid-argument','Destinazione uguale alla partenza.');
  return db.runTransaction(async tx=>{
    const [receiptSnap,uniSnap,ownSnap]=await Promise.all([tx.get(receipt),tx.get(base),tx.get(inventoryRef)]);
    if(!uniSnap.exists||uniSnap.data().supremaOptionCStaging!==true) {
      fail('failed-precondition','Opzione C non attiva in questo universo di prova.');
    }
    if(receiptSnap.exists) {
      if(receiptSnap.data().fingerprint!==fingerprintValue)fail('already-exists','Comando già utilizzato.');
      return receiptSnap.data().result;
    }
    const inv=ownSnap.exists?clone(ownSnap.data()):newInv(uid);
    if(inv.ownerUid!==uid)fail('permission-denied','Inventario non autorizzato.');
    checkInventory(inv,uid);
    const planetRef=originKey?base.collection('planets').doc(originKey):null;
    const planetSnap=planetRef?await tx.get(planetRef):null;
    const planet=planetSnap?.data();
    const playerRef=action==='launch'?base.collection('players').doc(uid):null;
    const playerSnap=playerRef?await tx.get(playerRef):null;
    const targetRef=targetKey?base.collection('planets').doc(targetKey):null;
    const targetSnap=targetRef?await tx.get(targetRef):null;
    const missionRef=missionId?missionFor(base,missionId):null;
    const missionSnap=missionRef?await tx.get(missionRef):null;
    const publicRef=missionId?publicFor(base,missionId):null;
    const target=targetSnap?.data();
    if(planetRef && !owned(planet,uid))fail('permission-denied','Pianeta non tuo.');
    let result={}, mission=null, originChanges={}, targetChanges={};
    if(action==='build'){
      const supremeId=requireId(input.supremeId,'ID Suprema');
      eligibility(planet);
      if(inv.ships.length+inv.constructions.length>=3)fail('failed-precondition','Massimo tre Supreme, anche in costruzione.');
      if([...inv.ships,...inv.constructions].some(s=>s.id===supremeId))fail('already-exists','ID Supremo duplicato.');
      if(inv.constructions.some(c=>c.originKey===originKey))fail('failed-precondition','Un progetto per Bacino.');
      inv.constructions.push({id:supremeId,originKey,startedAt:now,paidDays:0,nextPaymentAt:now+DAY,status:'building'});
      result={supremeId,nextPaymentAt:now+DAY,status:'building'};
    }
    if(action==='cancelBuild'){
      const supremeId=requireId(input.supremeId,'ID Suprema');
      const index=inv.constructions.findIndex(c=>c.id===supremeId&&c.originKey===originKey);
      if(index<0)fail('failed-precondition','Costruzione non più annullabile.');
      const order=inv.constructions[index];
      const refund={};
      for(const k of kinds){
        refund[k]=order.paidDays*paid[k]/2;
        originChanges['inbox.resources.'+k]=(Number(planet.inbox?.resources?.[k])||0)+refund[k];
      }
      inv.constructions.splice(index,1);
      result={supremeId,cancelled:true,refund};
    }
    if(['load','assign','deposit','queue','launch'].includes(action)){
      const supremeId=requireId(input.supremeId,'ID Suprema');
      const ship=inv.ships.find(s=>s.id===supremeId);
      if(!ship||ship.status!=='docked')fail('failed-precondition','Suprema non disponibile.');
      if(ship.originKey!==originKey && !['assign','queue'].includes(action))fail('failed-precondition','Suprema non presente su questo pianeta.');
      for(const member of inv.ships)Yard.advance(member,now);
      if(action==='load'){
        const type=requireId(input.ship,'Classe');
        if(!qty(input.count))fail('invalid-argument','Quantità non valida.');
        if(stock(planet,type)<input.count)fail('failed-precondition','Navi insufficienti.');
        if(Inv.inventory(ship.hangar)+Yard.reserved(ship)+input.count*Inv.WEIGHTS[type]>4000) {
          fail('failed-precondition','Cantiere e carico superano i 4000 slot.');
        }
        const prepared=Inv.planLoad({...planet.fleet,[type]:stock(planet,type)},ship.hangar,type,input.count);
        ship.hangar=prepared.hangar;
        originChanges['inbox.fleet.'+type]=(Number(planet.inbox?.fleet?.[type])||0)-input.count;
        result={supremeId,usedSlots:prepared.usedSlots,loaded:input.count,ship:type};
      }else if(action==='assign'){
        const type=requireId(input.ship,'Classe');
        const from=input.from,to=input.to;
        if(!Inv.ROLES.includes(from)||!Inv.ROLES.includes(to)||from===to||!qty(input.count)||
          (ship.hangar[from]?.[type]||0)<input.count)fail('failed-precondition','Riassegnazione impossibile.');
        ship.hangar[from][type]-=input.count;
        ship.hangar[to][type]=(ship.hangar[to][type]||0)+input.count;
        Inv.inventory(ship.hangar);
        result={supremeId,usedSlots:Inv.inventory(ship.hangar)};
      }else if(action==='queue'){
        const type=requireId(input.ship,'Classe cantiere');
        const count=input.count;
        if(!qty(count))fail('invalid-argument','Quantità cantiere non valida.');
        try {result=Yard.start(ship,Engine,type,count,uid+'_'+commandId,now,uniSnap.data().speed||1);}
        catch(err){fail('failed-precondition',err.message);}
        Yard.advance(ship,now);
      }else if(action==='deposit'){
        const kind=input.resource;
        if(!kinds.includes(kind)||!qty(input.amount))fail('invalid-argument','Risorsa o importo non valido.');
        const limit=Engine.core.depotCaps[kind];
        if(money(planet,kind)<input.amount||ship.resources[kind]+input.amount>limit) {
          fail('failed-precondition','Depositi o risorse insufficienti.');
        }
        ship.resources[kind]+=input.amount;
        Yard.advance(ship,now);
        originChanges['inbox.resources.'+kind]=(Number(planet.inbox?.resources?.[kind])||0)-input.amount;
        result={supremeId,resource:kind,stored:ship.resources[kind]};
      }else if(action==='launch'){
        if(!playerSnap?.exists||!target||!target.ownerUid||target.ownerUid===uid||
           target.isNpc===true||missionSnap?.exists) {
          fail('failed-precondition','Giocatore bersaglio o missione non validi.');
        }
        const attackerTech=playerSnap.data().researches||{};
        const dist=Engine.calculateDistance(getCoords(originKey),getCoords(targetKey));
        const speed=Number(uniSnap.data().militarySpeed)||1;
        const flight=Engine.getFleetSpeedAndFuel({researches:attackerTech,creativeMode:false},
          {naveMadreSuprema:1},dist,100,{shipSpecs:{naveMadreSuprema:Engine.spec},speed});
        const fuel=flight.fuelCost*2;
        if(money(planet,'deuterium')<fuel)fail('failed-precondition','Carburante di viaggio insufficiente.');
        originChanges['inbox.resources.deuterium']=(Number(planet.inbox?.resources?.deuterium)||0)-fuel;
        ship.status='outbound';ship.missionId=missionId;ship.returnReserve=flight.fuelCost;
        mission={id:missionId,attackerUid:uid,defenderUid:target.ownerUid,
          supremeId,originKey,targetKey,launchedAt:now,arrivalAt:now+flight.durationSec*1000,
          flightDurationMs:flight.durationSec*1000,attackerTech,missionSpeed:speed,status:'outbound'};
        result={missionId,arrivalAt:mission.arrivalAt,flightDurationSec:flight.durationSec};
      }
    }
    if(action==='resolve'||action==='return'){
      if(!missionSnap?.exists)fail('failed-precondition','Missione non trovata.');
      mission=clone(missionSnap.data());
      if(action==='resolve'){
        if(![mission.attackerUid,mission.defenderUid].includes(uid))fail('permission-denied','Non partecipi alla missione.');
        if(mission.status!=='outbound'||mission.arrivalAt>now)fail('failed-precondition','Missione non ancora arrivata.');
      }else{
        if(mission.attackerUid!==uid||mission.status!=='returning'||mission.returnAt>now) {
          fail('failed-precondition','Rientro non disponibile.');
        }
      }
      const attackerRef=privFor(base,mission.attackerUid);
      const attackerSnap=mission.attackerUid===uid?ownSnap:await tx.get(attackerRef);
      const attacker=attackerSnap.exists?clone(attackerSnap.data()):null;
      if(!attacker)fail('failed-precondition','Inventario attaccante mancante.');
      checkInventory(attacker,mission.attackerUid);
      const ship=attacker.ships.find(s=>s.id===mission.supremeId&&s.missionId===missionId);
      if(!ship)fail('failed-precondition','Suprema in viaggio mancante.');
      if(action==='resolve'){
        const defenderRef=base.collection('players').doc(mission.defenderUid);
        const destinationRef=base.collection('planets').doc(mission.targetKey);
        const [defenderSnap,destinationSnap]=await Promise.all([tx.get(defenderRef),tx.get(destinationRef)]);
        const destination=destinationSnap.data();
        let fight=null;
        if(destination && destination.ownerUid===mission.defenderUid) {
          const effective=clone(destination);
          for(const k of kinds)effective.resources[k]=money(destination,k);
          for(const key of ['fleet','defenses'])for(const [id,delta] of Object.entries(destination.inbox?.[key]||{})){
            effective[key]||={};effective[key][id]=Math.max(0,(effective[key][id]||0)+delta);
          }
          fight=Battle.resolveSingle({engine:Engine,supreme:ship,planet:effective,
            attackerTech:mission.attackerTech,defenderTech:defenderSnap.data()?.researches||{},missionId});
          for(const key of ['fleet','defenses','resources']) {
            const ids=new Set([...Object.keys(fight.before[key]||{}),...Object.keys(fight.after[key]||{})]);
            for(const id of ids){
              const delta=(fight.after[key]?.[id]||0)-(fight.before[key]?.[id]||0);
              if(delta)targetChanges['inbox.'+key+'.'+id]=(Number(destination.inbox?.[key]?.[id])||0)+delta;
            }
          }
          targetChanges.debris=fight.planet.debris;
          if(fight.planet.moon&&!destination.moon)targetChanges.moon=fight.planet.moon;
          if(fight.destroyed)attacker.ships=attacker.ships.filter(s=>s.id!==ship.id);
          else Object.assign(ship,fight.ship);
        }
        mission.status=fight?.destroyed?'destroyed':'returning';
        mission.returnAt=fight?.destroyed?null:now+mission.flightDurationMs;
        mission.report=fight?{orbital:fight.orbital,planetary:fight.planetary,loot:fight.loot,
          supremeDestroyed:fight.destroyed}: {cancelled:'Il pianeta ha cambiato proprietario.'};
        if(ship && !fight?.destroyed){ship.status='returning';ship.returnAt=mission.returnAt;}
        if(Object.keys(targetChanges).length)tx.update(destinationRef,targetChanges);
        mutateInventory(tx,attackerRef,attacker);
        result={missionId,status:mission.status,returnAt:mission.returnAt,report:mission.report};
      }else{
        if(!owned(planet,uid))fail('failed-precondition','Pianeta di rientro non disponibile.');
        ship.status='docked';ship.originKey=originKey;
        delete ship.missionId;delete ship.returnAt;delete ship.returnReserve;
        mission.status='completed';
        mission.completedAt=now;
        mutateInventory(tx,attackerRef,attacker);
        result={missionId,status:'completed',supremeId:ship.id};
      }
    }
    if(action==='launch'||action==='resolve'||action==='return'){
      tx.set(missionRef,mission);
      tx.set(publicRef,projection(mission));
    }
    if(Object.keys(originChanges).length)tx.update(planetRef,originChanges);
    if(action!=='resolve'&&action!=='return')mutateInventory(tx,inventoryRef,inv);
    tx.set(receipt,{uid,action,fingerprint:fingerprintValue,result,at:now});
    return result;
  });
}

async function getState(db,{uid,universeId},clock=Date.now) {
  if(!uid)fail('unauthenticated','Accesso richiesto.');
  requireId(universeId,'Universo');
  const base=baseFor(db,universeId);
  const uni=await base.get();
  if(!uni.exists||uni.data().supremaOptionCStaging!==true) {
    fail('failed-precondition','Opzione C non attiva su questo universo.');
  }
  const ownRef=privFor(base,uid);
  const data=await db.runTransaction(async tx=>{
    const invSnap=await tx.get(ownRef);
    const inv=invSnap.exists?clone(invSnap.data()):newInv(uid);
    checkInventory(inv,uid);
    const keys=[...new Set(inv.constructions.map(c=>c.originKey))];
    const docs=new Map(),refs=new Map();
    for(const key of keys){
      const ref=base.collection('planets').doc(key),snap=await tx.get(ref);
      if(snap.exists&&owned(snap.data(),uid)){docs.set(key,snap.data());refs.set(key,ref);}
    }
    const original=JSON.stringify(inv);
    const at=clock();
    const debits=planSettlement(inv,docs,at);
    for(const ship of inv.ships)Yard.advance(ship,at);
    if(original!==JSON.stringify(inv)) {
      mutateInventory(tx,ownRef,inv);
      for(const [key,amount] of debits) {
        const doc=docs.get(key),updates={};
        for(const k of kinds)updates['inbox.resources.'+k]=(Number(doc.inbox?.resources?.[k])||0)-amount[k];
        tx.update(refs.get(key),updates);
      }
    }
    return inv;
  });
  const publicSnap=await base.collection('supremaOptionCPublic').where('participants','array-contains',uid).get();
  return {inventory:data,missions:publicSnap.docs.map(doc=>({id:doc.id,...doc.data()}))};
}

module.exports=Object.freeze({commandAction,getState,OptionCError,planSettlement});
