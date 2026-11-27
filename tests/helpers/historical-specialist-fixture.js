/** Test-only administrative fixture. Never use outside the loopback demo Emulator. */
'use strict';
const assert = require('node:assert/strict');
const CLOCKS = ['departureTime','arrivalTime','returnTime'];
const CLOCK_FIELDS = [...CLOCKS,'departureAt'];
const PROJECT = 'demo-universum';
const withoutClock = data => Object.fromEntries(Object.entries(data).filter(([k])=>!CLOCK_FIELDS.includes(k)));
async function withDemoAdmin(callback) {
  assert(/^(127\.0\.0\.1|localhost):[0-9]+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''),'Only loopback Emulator permitted');
  for(const name of ['GCLOUD_PROJECT','GOOGLE_CLOUD_PROJECT']) {
    assert(!process.env[name] || process.env[name]===PROJECT,'Only isolated demo-universum permitted');
  }
  const {initializeApp,deleteApp}=require('firebase-admin/app');
  const {getFirestore,Timestamp}=require('firebase-admin/firestore');
  const app=initializeApp({projectId:PROJECT},'at04f-fixture-'+process.pid+'-'+Date.now());
  const db=getFirestore(app);
  try {return await callback(db,Timestamp);} finally {await db.terminate();await deleteApp(app);}
}
async function prepareHistoricalFlight(db,Timestamp,key,id,expected,checkRelated=false) {
  assert(/^smoke[A-Za-z0-9_-]+$/.test(key),'Only smoke fixtures permitted');
  assert(typeof id==='string' && id.length>0 && !id.includes('/'));
  const ref=db.doc(`online_universes/${key}/fleets/${id}`);
  function readFlight(snapshot) {
    assert(snapshot.exists && snapshot.id===id && snapshot.ref.path===ref.path,'Fresh fleet identity required');
    const data=snapshot.data();
    assert(snapshot.readTime instanceof Timestamp && snapshot.updateTime instanceof Timestamp,'Server snapshot clock/version required');
    assert.equal(data.attackerUid,'e2e');assert.equal(data.defenderUid,'e2e');
    assert.equal(data.mission,'deploy');assert.equal(data.status,'outbound');assert.equal(data.resolved,false);
    for(const [k,v] of Object.entries(expected))assert.deepEqual(data[k],v,`original ${k}`);
    assert(CLOCKS.every(k=>typeof data[k]==='number'&&Number.isFinite(data[k])),'Persisted numeric clocks required');
    assert(data.departureAt instanceof Timestamp,'Persisted SDK timestamp required');
    return data;
  }
  // Read and update the very same document inside a Firestore admin transaction.
  // The SDK handles optimistic/pessimistic concurrency and transaction retry; no REST updateTime parsing.
  const prepared=await db.runTransaction(async tx=>{
    const snapshot=await tx.get(ref), old=readFlight(snapshot);
    const related=checkRelated?await tx.getAll(
      db.doc(`online_universes/${key}/planets/${old.originKey}`),
      db.doc(`online_universes/${key}/planets/${old.targetKey}`),
      db.doc(`online_universes/${key}/players/e2e`)
    ):[];
    if(checkRelated){
      assert(related.every(s=>s.exists),'Persisted origin, target and profile required');
      assert.equal(related[0].data().fleet.hephaestusForge,3);
      assert.equal(related[2].data().serviceRevision,2);
      assert(related[2].data().specialistFlights.includes(id));
    }
    const serverMs=snapshot.readTime.toMillis();
    const shift=old.arrivalTime>serverMs?(Math.ceil((old.arrivalTime-serverMs)/1000)+1)*1000:0;
    const update=Object.fromEntries(CLOCKS.map(k=>[k,old[k]-shift]));
    update.departureAt=new Timestamp(old.departureAt.seconds-shift/1000,old.departureAt.nanoseconds);
    assert.equal(update.arrivalTime-update.departureTime,old.arrivalTime-old.departureTime);
    assert.equal(update.returnTime-update.arrivalTime,old.returnTime-old.arrivalTime);
    if(shift)tx.update(ref,update); // only four existing clock fields; no credits or other documents
    return {old,update,shift,readTime:snapshot.readTime,version:snapshot.updateTime,related};
  });
  const snapshot=await ref.get(), matured=readFlight(snapshot);
  const {old,update,shift}=prepared;
  assert(matured.arrivalTime<=snapshot.readTime.toMillis(),'persisted arrival must be due on real server');
  assert.equal(matured.arrivalTime-matured.departureTime,old.arrivalTime-old.departureTime);
  assert.equal(matured.returnTime-matured.arrivalTime,old.returnTime-old.arrivalTime);
  assert.equal(matured.status,'outbound');assert.equal(matured.resolved,false);
  assert.deepEqual(matured.ships,old.ships);assert.deepEqual(matured.cargo,old.cargo);
  assert.deepEqual(withoutClock(matured),withoutClock(old),'Every non-clock fleet field must be unchanged');
  for(const k of CLOCKS)assert.equal(matured[k],update[k],`exact persisted ${k}`);
  assert(matured.departureAt.isEqual(update.departureAt),'Exact persisted departureAt required');
  assert.equal(matured.departureAt.seconds,old.departureAt.seconds-shift/1000);
  assert.equal(matured.departureAt.nanoseconds,old.departureAt.nanoseconds);
  if(shift)assert(snapshot.updateTime.toMillis()>=prepared.version.toMillis(),'Committed version must not regress');
  else assert(snapshot.updateTime.isEqual(prepared.version),'Already-due fixture must not be rewritten');
  if(checkRelated){
    const after=await db.getAll(...prepared.related.map(s=>s.ref));
    for(let i=0;i<after.length;i++){
      assert(after[i].updateTime.isEqual(prepared.related[i].updateTime),'Fixture must not rewrite a stock/profile document');
      assert.deepEqual(after[i].data(),prepared.related[i].data(),'Stocks, debit and specialist registry unchanged');
    }
    console.log('SDK fixture: origin, destination and profile unchanged (data and versions)');
  }
  console.log('SDK fixture: admin transaction, all persisted clocks shifted by',shift,'ms');
  console.log('SDK fixture server readTime',snapshot.readTime.toDate().toISOString(),'persisted ETA',matured.arrivalTime,
    'readTime ms',snapshot.readTime.toMillis(),'timestamp nanos',matured.departureAt.nanoseconds,
    'outbound duration',matured.arrivalTime-matured.departureTime,'return duration',matured.returnTime-matured.arrivalTime,
    'version before',prepared.version.toDate().toISOString(),'version after',snapshot.updateTime.toDate().toISOString());
  return {shift,old,matured};
}
module.exports=(key,id,expected)=>withDemoAdmin((db,Timestamp)=>prepareHistoricalFlight(db,Timestamp,key,id,expected,true));
// Isolated real-SDK preflight of exactly the helper used by the full smoke.
// Seed only a synthetic fleet document; no planet, profile, debit or resource writes.
if(require.main===module)withDemoAdmin(async(db,Timestamp)=>{
  const key='smoke-preflight-'+process.pid+'-'+Date.now(),id='fixture';
  const ref=db.doc(`online_universes/${key}/fleets/${id}`);
  const empty=await ref.get();assert(!empty.exists && empty.readTime instanceof Timestamp);
  const now=Math.floor(empty.readTime.toMillis());
  const data={attackerUid:'e2e',defenderUid:'e2e',mission:'deploy',status:'outbound',resolved:false,
    originKey:'1_1_2',targetKey:'1_2_2',ships:{hephaestusForge:1},cargo:{metal:0,crystal:0,deuterium:0},
    departureTime:now+0.125,arrivalTime:now+60000.125,returnTime:now+120000.125,
    departureAt:new Timestamp(Math.floor(now/1000),123456000),fixtureMarker:'preflight-only'};
  const expected={ships:data.ships,cargo:data.cargo,originKey:data.originKey,targetKey:data.targetKey};
  await ref.create(data);
  const first=await ref.get();
  await assert.rejects(prepareHistoricalFlight(db,Timestamp,key,id,{...expected,originKey:'wrong'}),/original originKey/);
  assert((await ref.get()).updateTime.isEqual(first.updateTime),'Identity rejection must not write');
  const shifted=await prepareHistoricalFlight(db,Timestamp,key,id,expected);
  assert(shifted.shift>0,'Future preflight fixture must be shifted');
  assert.equal(shifted.matured.departureAt.nanoseconds,123456000);
  const due=await prepareHistoricalFlight(db,Timestamp,key,id,expected);
  assert.equal(due.shift,0);
  console.log('PASS fixture preflight: exact clock shift, identity rejection, unchanged already-due version and all non-clock fields');
}).catch(e=>{console.error(e);process.exitCode=1;});
