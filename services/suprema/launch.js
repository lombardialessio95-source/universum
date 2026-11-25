'use strict';

const engine = require('./engine');
const {RecoveryError} = require('./recover');

const uuid = /^[A-Za-z0-9_-]{1,100}$/;
const coords = /^\d{1,2}_\d{1,3}_\d{1,2}$/;
const valid = (value,pattern) => typeof value==='string' && pattern.test(value);

function startStagingSiege(db,command,clock=Date.now) {
  const {uid,universeId,originKey,targetKey,siegeId,selection,mode,hours} = command;
  if (!uid) throw new RecoveryError('unauthenticated','Accesso richiesto.');
  if (!valid(universeId,uuid) || !valid(siegeId,uuid) || !valid(originKey,coords) || !valid(targetKey,coords) ||
      originKey===targetKey || !Array.isArray(selection) || selection.length<1 || selection.length>3 ||
      selection.some(s=>!valid(s?.id,uuid) || !['return','support'].includes(s.whenFull)) ||
      !['prudente','offensiva'].includes(mode) || !Number.isInteger(hours) || hours<1 || hours>10) {
    throw new RecoveryError('invalid-argument','Lancio non valido.');
  }

  const base = db.collection('online_universes').doc(universeId);
  const originRef = base.collection('planets').doc(originKey);
  const targetRef = base.collection('planets').doc(targetKey);
  const playerRef = base.collection('players').doc(uid);
  const inventoryRef = base.collection('supremaInventoryPrivate').doc(uid);
  const targetLock = base.collection('supremaTargetPrivate').doc(targetKey);
  const privateRef = base.collection('supremaRecoveryPrivate').doc(siegeId);
  const publicRef = base.collection('supremaRecoveryPublic').doc(siegeId);
  const now = clock();

  return db.runTransaction(async tx=>{
    const [uni,originDoc,targetDoc,player,inventoryDoc,lock,existing] = await Promise.all(
      [base,originRef,targetRef,playerRef,inventoryRef,targetLock,privateRef].map(ref=>tx.get(ref)));
    if (!uni.exists || uni.data().supremaRecoveryStaging!==true) {
      throw new RecoveryError('failed-precondition','Universo di collaudo non abilitato.');
    }
    const origin=originDoc.data(), target=targetDoc.data();
    if (!origin || origin.ownerUid!==uid || !player.exists || !inventoryDoc.exists ||
        !target || target.ownerUid===uid || typeof target.ownerUid!=='string') {
      throw new RecoveryError('permission-denied','Origine, destinazione o Supremo non autorizzato.');
    }
    if (existing.exists) {
      const previous=existing.data();
      if (previous.attackerUid!==uid || previous.originKey!==originKey || previous.targetDocKey!==targetKey) {
        throw new RecoveryError('already-exists','Identificatore già utilizzato.');
      }
      return {siegeId,arrivalAt:previous.battle.arrival};
    }
    if (lock.data()?.siegeId || target.occupation || target.embargo) {
      throw new RecoveryError('failed-precondition','Il pianeta ha già un assedio.');
    }
    const inventory=inventoryDoc.data();
    if (inventory.ownerUid!==uid || !Array.isArray(inventory.ships)) {
      throw new RecoveryError('failed-precondition','Inventario non valido.');
    }
    const allShips=inventory.ships;
    const ships=selection.map(({id})=>allShips.find(ship=>ship.id===id));
    if (new Set(selection.map(s=>s.id)).size!==selection.length || ships.some(ship=>!ship)) {
      throw new RecoveryError('failed-precondition','Selezione non disponibile.');
    }
    // Settlements in staging use the same inbox reconciliation as ordinary fleet arrivals.
    const settledOrigin={...origin,resources:{...origin.resources,deuterium:
      Math.max(0,(origin.resources?.deuterium || 0)+(origin.inbox?.resources?.deuterium || 0))}};
    const unchangedFuel=settledOrigin.resources.deuterium;
    const stagingUniverse={planets:[settledOrigin],supremes:ships,researches:player.data().researches || {},
      militarySpeed:uni.data().militarySpeed};
    let battle;
    try { battle=engine.start(stagingUniverse,settledOrigin,target,siegeId,selection,mode,hours,now); }
    catch (err) { throw new RecoveryError('failed-precondition',err.message); }
    battle.attackerUid=uid;
    const participants=[uid,target.ownerUid];
    const remaining=allShips.filter(ship=>!selection.some(s=>s.id===ship.id));
    const inboxFuel=(origin.inbox?.resources?.deuterium || 0)+settledOrigin.resources.deuterium-unchangedFuel;
    tx.update(originRef,{'inbox.resources.deuterium':inboxFuel});
    tx.update(inventoryRef,{ships:remaining});
    tx.set(targetLock,{siegeId});
    tx.set(privateRef,{
      attackerUid:uid,defenderUid:target.ownerUid,originKey,targetDocKey:targetKey,revision:0,
      pending:[{id:'wave-0',kind:'wave',sequence:0,at:battle.arrival}],battle,supremes:ships
    });
    tx.set(publicRef,{participants,...engine.publicSiege(stagingUniverse,battle),nextEventAt:battle.arrival});
    return {siegeId,arrivalAt:battle.arrival};
  });
}

module.exports = {startStagingSiege};
