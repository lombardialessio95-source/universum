/** Ordina e applica gli eventi persistenti dell'assedio al rientro dei giocatori. */
(function (root) {
  'use strict';

  const priorities = Object.freeze({ upkeep:0, arrival:1, counteroffensive:2, wave:3, departure:4 });
  const hourMs = 3600000;

  function compare(a,b) {
    return a.at-b.at || priorities[a.kind]-priorities[b.kind] || (a.id<b.id ? -1 : a.id>b.id ? 1 : 0);
  }

  function enqueue(siege,event) {
    if (!Object.hasOwn(priorities,event.kind) || !Number.isSafeInteger(event.at) ||
        event.at<0 || typeof event.id!=='string' || !/^[A-Za-z0-9_-]{1,100}$/.test(event.id)) {
      throw Error('Evento di assedio non valido.');
    }
    if (siege.pending.some(item=>item.id===event.id)) return false;
    if (siege.appliedThrough && compare(event,siege.appliedThrough)<=0) throw Error('Evento precedente al checkpoint.');
    siege.pending.push(event);
    siege.pending.sort(compare);
    return true;
  }

  function changeFrequency(siege,hours) {
    if (!Number.isInteger(hours) || hours<1 || hours>10) throw Error('Frequenza ammessa: 1–10 ore.');
    siege.waveHours = hours;
  }

  function scheduleNextWave(siege,wave) {
    const sequence = wave.sequence+1;
    enqueue(siege,{id:'wave-'+sequence,kind:'wave',sequence,at:wave.at+siege.waveHours*hourMs});
  }

  /**
   * Il riduttore è sincrono: può leggere soltanto lo snapshot assunto nella
   * transazione. Allo stesso evento corrisponde lo stesso seed anche nei retry.
   * Tutti i documenti coinvolti devono essere dichiarati prima di scrivere.
   */
  async function applyNext({db,siegeRef,now,actor,documents,reduce}) {
    if (!Number.isSafeInteger(now)) throw Error('Scadenza di recupero non valida.');
    return db.runTransaction(async tx=>{
      const snap = await tx.get(siegeRef);
      if (!snap.exists) return null;
      const siege = snap.data();
      if (actor!==siege.attackerUid && actor!==siege.defenderUid) {
        throw Object.assign(Error('Utente estraneo all’assedio.'),{code:'permission-denied'});
      }
      const event = siege.pending[0];
      if (!event || event.at>now) return null;
      const receiptRef = siegeRef.collection('receipts').doc(event.id);
      const receipt = await tx.get(receiptRef);
      if (receipt.exists) throw Error('Ricevuta presente per un evento ancora in coda.');
      const refs = documents(siege,event);
      const snapshots = await Promise.all(refs.map(ref=>tx.get(ref)));
      const values = snapshots.map(s=>s.exists?s.data():null);
      siege.pending.shift();
      const result = reduce({siege,event,values,snapshots,seed:siegeRef.id+'/'+event.id});
      if (!result || !Array.isArray(result.updates) || result.updates.length!==refs.length) {
        throw Error('Il risultato non corrisponde ai documenti dichiarati.');
      }
      siege.appliedThrough = {at:event.at,kind:event.kind,id:event.id};
      siege.revision++;
      for (const [i,patch] of result.updates.entries()) {
        if (patch!==null) tx.update(refs[i],patch);
      }
      tx.update(siegeRef,siege);
      tx.set(receiptRef,{...siege.appliedThrough,revision:siege.revision});
      return event.id;
    });
  }

  async function catchUp(options, limit = 8) {
    if (!Number.isInteger(limit) || limit<1 || limit>32) throw Error('Limite di recupero non valido.');
    let applied = 0;
    while (applied<limit && await applyNext(options)) applied++;
    return {applied,needsMore:applied===limit};
  }

  const api = Object.freeze({enqueue,changeFrequency,scheduleNextWave,applyNext,catchUp});
  if (typeof module!=='undefined' && module.exports) module.exports=api;
  else root.UniversumSiegeRecovery=api;
})(typeof window!=='undefined' ? window : globalThis);
