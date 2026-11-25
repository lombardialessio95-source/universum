'use strict';

const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {onCall,HttpsError} = require('firebase-functions/v2/https');
const {recoverAtLogin} = require('./recover');
const {startStagingSiege} = require('./launch');
const {commandAction,getState} = require('./option-c-service');

initializeApp();
function stagingCallable(run) {
  return onCall({region:'europe-west1',maxInstances:3,timeoutSeconds:30},async request=>{
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (process.env.UNIVERSUM_SUPREMA_STAGING!=='true' || !project || project==='universum-online') {
    throw new HttpsError('failed-precondition','Recupero Suprema riservato allo staging.');
  }
  try {
    return await run(getFirestore(),{...request.data,uid:request.auth?.uid});
  } catch (err) {
    const codes = ['unauthenticated','permission-denied','invalid-argument','failed-precondition','already-exists'];
    if (codes.includes(err.code)) throw new HttpsError(err.code,err.message);
    console.error('Suprema recovery transaction failed',err);
    throw new HttpsError('internal','Recupero rinviato. Riprova.');
  }
});
}

exports.recoverSuprema = stagingCallable(recoverAtLogin);
exports.launchSuprema = stagingCallable(startStagingSiege);

// Opzione C è indipendente dagli assedi staging. Non disattivare il blocco
// per il progetto universum-online senza il collaudo Firebase richiesto.
exports.optionCSuprema = stagingCallable((db,input)=>
  input.action==='state' ? getState(db,input) : commandAction(db,input));
