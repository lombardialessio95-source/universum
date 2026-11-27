'use strict';
// Exact original I02B positive fixture, external to the frozen candidate.
// Seed a single test document only. Actual update is performed by Web SDK.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const host=process.env.FIRESTORE_EMULATOR_HOST||'';
assert.equal(host,'127.0.0.1:8080');
const projectId='demo-universum';
assert.equal(process.env.GCLOUD_PROJECT,projectId);
assert.equal(process.env.GOOGLE_CLOUD_PROJECT,projectId);
const {cases,CLASSES}=require('./original-cases');
const name='all 17 classes change on due attack plus loot and surviving hangars';
const c=cases(Date.now()).find(c=>c.name===name);
assert(c&&c.allow&&c.critical);
assert.equal(CLASSES.length,17);
assert.equal(Object.keys(c.old.ships).length,17);
assert(Object.values(c.old.ships).every(q=>q===3));
assert(Object.values(c.patch.ships).every(q=>q===2));
assert.deepEqual(c.patch.cargo,{metal:150,crystal:90,deuterium:35});
assert.equal(c.patch.carrierHangars.length,2);
assert.equal(c.remove.length,0);
const rules=process.env.RULES_FILE;
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(rules)).digest('hex'),'788adc753f94db55b92a82ecda10484a66c1d07041bea2aaf2f6113174c9eab2');
const imported=require('firebase/compat/app'),firebase=imported.default||imported;require('firebase/compat/firestore');
const app=firebase.initializeApp({apiKey:'demo',projectId,appId:'demo-consolidamento'},'i01f-'+crypto.randomBytes(6).toString('hex'));
const db=app.firestore();db.settings({experimentalForceLongPolling:true});db.useEmulator('127.0.0.1',8080,{mockUserToken:{sub:c.uid}});
function value(v){if(v===null)return{nullValue:null};if(typeof v==='boolean')return{booleanValue:v};if(typeof v==='number')return Number.isSafeInteger(v)?{integerValue:String(v)}:{doubleValue:v};if(typeof v==='string')return{stringValue:v};if(Array.isArray(v))return{arrayValue:{values:v.map(value)}};return{mapValue:{fields:fields(v)}};}
function fields(v){return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,value(x)]));}
async function main(){
 const key='online_universes/consolidamento_'+crypto.randomBytes(6).toString('hex')+'/fleets/mixed';
 const res=await fetch('http://'+host+'/v1/projects/'+projectId+'/databases/(default)/documents/'+key,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:fields(c.old)}),signal:AbortSignal.timeout(10000)});
 assert(res.ok,'seed HTTP '+res.status+' '+(!res.ok?await res.text():''));
 const seed=await res.json();
 assert(Date.parse(seed.updateTime)>=c.old.arrivalTime,'server seed time must be after old ETA');
 const ref=db.doc(key);const before=(await ref.get({source:'server'})).data();
 assert.deepEqual(before,c.old);
 await ref.update(c.patch);
 const after=(await ref.get({source:'server'})).data();
 assert.deepEqual(after,{...c.old,...c.patch});
 console.log('Server seed updateTime',seed.updateTime,'old ETA',c.old.arrivalTime);
 console.log('PASS '+name+'; 17x 3->2, cargo 150/90/35, two surviving hangars; exact persisted snapshot');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>app.delete());
