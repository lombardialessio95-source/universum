/** Entry point on a staging universe join, with no polling. */
(function () {
  'use strict';

  async function onJoin(universe) {
    const auth = window.fbAuth;
    const db = window.fbDB;
    const user = auth?.currentUser;
    const project = db?.app?.options?.projectId;
    if (!universe.supremaRecoveryStaging || !user || !project || project==='universum-online') return [];
    if (!/^[a-z0-9-]+$/.test(project)) throw Error('Progetto di staging non valido.');

    const publicSieges = await db.collection('online_universes').doc(universe.id)
      .collection('supremaRecoveryPublic').where('participants','array-contains',user.uid).get();
    const url = 'https://europe-west1-'+project+'.cloudfunctions.net/recoverSuprema';
    const token = await user.getIdToken();
    const results = [];
    for (const doc of publicSieges.docs) {
      if (!doc.data().nextWaveAt) continue;
      let result;
      do {
        if (auth.currentUser?.uid!==user.uid || window.UniversumUI?.state?.currentUniverse!==universe) return results;
        const response = await fetch(url,{
          method:'POST',
          headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
          body:JSON.stringify({data:{universeId:universe.id,siegeId:doc.id}})
        });
        const body = await response.json();
        if (!response.ok || !body.result) throw Error('Recupero Suprema temporaneamente indisponibile.');
        result = body.result;
      } while (result.needsMore);
      results.push({id:doc.id,nextWaveAt:result.nextWaveAt,ships:result.ships});
    }
    universe.supremaRecoveryPublic = results;
    return results;
  }

  window.UniversumSupremaStaging = Object.freeze({onJoin});
})();
