'use strict';

const recovery = require('../../modules/online/siege-recovery');
const engine = require('./engine');

class RecoveryError extends Error {
  constructor(code,message) {
    super(message);
    this.code=code;
  }
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
    documents:()=>[publicRef],
    reduce({siege,event,values}) {
      const {battle,supremes,target} = siege;
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
      return {updates:[engine.publicSiege(state,battle)]};
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
    ships:info?.ships || 0
  };
}

module.exports = {recoverAtLogin,RecoveryError};
