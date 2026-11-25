'use strict';

const recovery = require('../../modules/online/siege-recovery');
const engine = require('./engine');

class RecoveryError extends Error {
  constructor(code,message) {
    super(message);
    this.code=code;
  }
}

const materials = ['metal','crystal','deuterium'];

function effectiveMap(doc,key) {
  const maps = doc.inbox?.[key] || {};
  return Object.fromEntries([...new Set([...Object.keys(doc[key] || {}),...Object.keys(maps)])]
    .map(id=>[id,Math.max(0,Math.floor((doc[key]?.[id] || 0)+(maps[id] || 0)))]));
}

function diffTarget(doc,before,after) {
  const patch = {};
  for (const key of ['resources','fleet','defenses']) {
    for (const id of Object.keys(before[key])) {
      const delta=(after[key]?.[id] || 0)-before[key][id];
      if (delta) patch['inbox.'+key+'.'+id]=(doc.inbox?.[key]?.[id] || 0)+delta;
    }
  }
  if (after.moon && !doc.moon) patch.moon=after.moon;
  if (after.debris && JSON.stringify(after.debris)!==JSON.stringify(doc.debris)) patch.debris=after.debris;
  return patch;
}

const validId = id => typeof id==='string' && /^[A-Za-z0-9_-]{1,100}$/.test(id);

/**
 * The beta collections are seeded only by privileged code. A single
 * transaction commits the private battle, public projection and receipt.
 * A browser submits identifiers, never a clock, fuel state or battle result.
 */
async function recoverAtLogin(db,{uid,universeId,siegeId},clock=Date.now) {
  if (!uid) throw new RecoveryError('unauthenticated','Accesso richiesto.');
  if (!validId(universeId) || !validId(siegeId)) throw new RecoveryError('invalid-argument','Identificatore non valido.');
  const base = db.collection('online_universes').doc(universeId);
  const siegeRef = base.collection('supremaRecoveryPrivate').doc(siegeId);
  const publicRef = base.collection('supremaRecoveryPublic').doc(siegeId);
  const now = clock();

  const result = await recovery.catchUp({
    db,siegeRef,now,actor:uid,
    documents(siege,event) {
      if (!siege.targetDocKey) return [publicRef];
      if (event.kind==='departure') return [publicRef,
        base.collection('supremaInventoryPrivate').doc(siege.attackerUid),
        base.collection('planets').doc(siege.originKey)];
      return [publicRef,base.collection('planets').doc(siege.targetDocKey),
        base.collection('supremaTargetPrivate').doc(siege.targetDocKey)];
    },
    reduce({siege,event,values,snapshots}) {
      const {battle,supremes} = siege;
      if (!values[0]) throw new RecoveryError('failed-precondition','Vista pubblica assente.');
      if (event.kind==='departure') {
        const [,inventory,origin] = values;
        if (inventory?.ownerUid!==siege.attackerUid || origin?.ownerUid!==siege.attackerUid) {
          throw new RecoveryError('failed-precondition','Origine del rientro non disponibile.');
        }
        const ship=supremes.find(s=>s.id===event.shipId && s.status==='returning' && s.returnAt===event.at);
        if (!ship || inventory.ships.some(s=>s.id===event.shipId)) {
          throw new RecoveryError('failed-precondition','Suprema già accreditata o rientro non valido.');
        }
        engine.settleReturns({supremes:[ship],planets:[origin]},event.at);
        siege.supremes=supremes.filter(s=>s.id!==ship.id);
        return {updates:[{...engine.publicSiege({supremes:siege.supremes},battle),nextEventAt:siege.pending[0]?.at || null},
          {ships:[...inventory.ships,ship]},null]};
      }
      const canonical = siege.targetDocKey ? values[1] : null;
      if (siege.targetDocKey && (!canonical || canonical.ownerUid!==siege.defenderUid)) {
        throw new RecoveryError('failed-precondition','Il pianeta assediato ha cambiato proprietario.');
      }
      if (canonical) {
        const lock = values[2];
        const expected = lock?.sharedCommit ? snapshots[2].updateTime : lock?.planetVersion;
        if (lock?.siegeId !== battle.id || !expected || !snapshots[1].updateTime.isEqual(expected)) {
          throw new RecoveryError('failed-precondition','Cronologia del pianeta da riconciliare prima dell’ondata.');
        }
      }
      const target = canonical ? {...canonical,resources:effectiveMap(canonical,'resources'),
        defenses:effectiveMap(canonical,'defenses'),fleet:effectiveMap(canonical,'fleet')} : siege.target;
      if (canonical) for (const key of materials) target.resources[key] ||= 0;
      const before = canonical ? {resources:{...target.resources},defenses:{...target.defenses},fleet:{...target.fleet}} : null;
      if (!values[0]) throw new RecoveryError('failed-precondition','Vista pubblica assente.');
      if (event.kind!=='wave' || event.at!==battle.nextAt || event.sequence!==battle.sequence) {
        throw new RecoveryError('failed-precondition','Evento non compatibile con il checkpoint.');
      }
      const state = {supremes};
      if (engine.advance(state,battle,target,event.at,1)!==1 && !battle.endedAt) {
        throw new RecoveryError('failed-precondition','Ondata non elaborata.');
      }
      siege.supremes = state.supremes;
      if (!battle.endedAt) recovery.enqueue(siege,{id:'wave-'+battle.sequence,kind:'wave',
        at:battle.nextAt,sequence:battle.sequence});
      const updates = [engine.publicSiege(state,battle)];
      if (canonical) {
        const patch=diffTarget(canonical,before,target);
        const changed = Object.keys(patch).length > 0;
        // Firestore uses one commit time for documents updated by the same atomic transaction.
        const nextLock = battle.endedAt ? {siegeId:null} :
          changed ? {sharedCommit:true,sequence:event.sequence} : null;
        updates.push(changed ? patch : null,nextLock);
        for (const ship of state.supremes) if (ship.status==='returning') {
          recovery.enqueue(siege,{id:'return-'+ship.id,kind:'departure',shipId:ship.id,at:ship.returnAt});
        }
      }
      updates[0].nextEventAt=siege.pending[0]?.at || null;
      return {updates};
    }
  });

  const snap = await siegeRef.get();
  if (!snap.exists || ![snap.data().attackerUid,snap.data().defenderUid].includes(uid)) {
    throw new RecoveryError('permission-denied','Accesso all’assedio non consentito.');
  }
  const view = await publicRef.get();
  const info = view.exists ? view.data() : null;
  return {
    applied:result.applied, needsMore:result.needsMore, nextWaveAt:info?.nextWaveAt || null,
    ships:info?.ships || 0, nextEventAt:info?.nextEventAt || null
  };
}

module.exports = {recoverAtLogin,RecoveryError};
