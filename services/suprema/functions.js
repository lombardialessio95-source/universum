'use strict';

const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {onCall,HttpsError} = require('firebase-functions/v2/https');
const {recoverAtLogin} = require('./recover');

initializeApp();
exports.recoverSuprema = onCall({region:'europe-west1',maxInstances:3,timeoutSeconds:30},async request=>{
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (process.env.UNIVERSUM_SUPREMA_STAGING!=='true' || !project || project==='universum-online') {
    throw new HttpsError('failed-precondition','Recupero Suprema riservato allo staging.');
  }
  try {
    return await recoverAtLogin(getFirestore(),{
      uid:request.auth?.uid,universeId:request.data?.universeId,siegeId:request.data?.siegeId
    });
  } catch (err) {
    const codes = ['unauthenticated','permission-denied','invalid-argument','failed-precondition'];
    if (codes.includes(err.code)) throw new HttpsError(err.code,err.message);
    console.error('Suprema recovery transaction failed',err);
    throw new HttpsError('internal','Recupero rinviato. Riprova.');
  }
});
