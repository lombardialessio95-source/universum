/** Due schede indipendenti, SDK compat del gioco ed emulatore locale Spark. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
module.exports = async function multiplayerSmoke(ctx,baseUrl) {
  const target=new URL('http://'+process.env.FIRESTORE_EMULATOR_HOST);
  if (!['127.0.0.1','localhost'].includes(target.hostname)) throw Error('Usare un emulatore locale.');
  const clients=[];
  for(let i=0;i<2;i++) {
    const page=await ctx.newPage();clients.push(page);
    await page.route(/^https:/,r=>r.abort());
    await page.goto(baseUrl);
    for(const name of ['firebase-app-compat.js','firebase-firestore-compat.js']) {
      await page.addScriptTag({path:path.join(process.env.FIREBASE_SDK_DIR,name)});
    }
    await page.evaluate(({host,port})=>{
      const app=firebase.initializeApp({projectId:'demo-universum',apiKey:'demo'},'phase2');
      const db=app.firestore();
      db.settings({experimentalForceLongPolling:true});
      db.useEmulator(host,port,{mockUserToken:{sub:'e2e',user_id:'e2e'}});
      window.fbDB=db;window.fbAuth={currentUser:{uid:'e2e',displayName:'E2E',email:'e2e@example.invalid'}};
    },{host:target.hostname,port:Number(target.port)});
  }
  const key='smoke'+Date.now();
  const seed=require('./game').uni(2);
  Object.assign(seed,{id:key,speed:1000,emperor:'E2E',serviceRevision:0,specialistBuilt:{hephaestusForge:4}});
  Object.assign(seed.researches,{impulseDrive:3,computerTech:10});
  for(const p of seed.planets) Object.assign(p,{ownerUid:'e2e',ownerName:'E2E',maxTemp:34,fieldsMax:240,lastUpdated:Date.now(),isNpc:false});
  seed.planets[0].fleet.hephaestusForge=4;
  seed.at05ProfileIncarnation=await clients[0].evaluate(async u=>{
    const ref=fbDB.collection('online_universes').doc(u.id);
    await ref.set({founderUid:'e2e',ownerUid:'e2e',name:'E2E',speed:1000});
    await ref.collection('players').doc('e2e').set({uid:'e2e',nickname:'E2E',researches:u.researches,specialistBuilt:u.specialistBuilt,serviceRevision:0,researchModelVersion:1,joinedAt:Date.now(),at05ProfileCreatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    for(const p of u.planets) await ref.collection('planets').doc([p.coords.g,p.coords.s,p.coords.p].join('_')).set(p);
    const created=(await ref.collection('players').doc('e2e').get({source:'server'})).data().at05ProfileCreatedAt;
    return `${created.seconds}:${created.nanoseconds}`;
  },seed);
  console.log('SDK: profilo e colonie inizializzati.');
  const outcomes=await Promise.all(clients.map((page,i)=>page.evaluate(async ({u,i})=>{
    window.u=u;
    UniversumEngine.buildUnits(u,i,'hephaestusForge',1);
    try {await UniversumMP.syncPlayerState(u,{force:true});return 'saved';} catch(e){return e.code || e.message;}
  },{u:seed,i})));
  assert.deepEqual([...outcomes].sort(),['saved','service-conflict']);
  console.log('SDK: prenotazione concorrente verificata.');
  const winner=clients[outcomes.indexOf('saved')];
  const result=await winner.evaluate(async()=>{
    const ref=fbDB.collection('online_universes').doc(u.id);
    const fleet=await UniversumMP.launchOnlineFleet(u,0,u.planets[1].coords,'deploy',{hephaestusForge:1});
    const snap=await ref.collection('fleets').doc(fleet.id).get({source:'server'});
    const origin=(await ref.collection('planets').doc(fleet.originKey).get({source:'server'})).data();
    const profile=(await ref.collection('players').doc('e2e').get({source:'server'})).data();
    return {ships:snap.data().ships,remaining:origin.fleet.hephaestusForge,rev:profile.serviceRevision,
      tracked:profile.specialistFlights.includes(fleet.id),fleetId:fleet.id,arrival:fleet.arrivalTime};
  });
  assert.deepEqual(result.ships,{hephaestusForge:1});assert.equal(result.remaining,3);assert.equal(result.rev,2);assert(result.tracked);
  console.log('SDK: trasferimento registrato.');
  // Prepare the same real, already debited flight in the isolated demo Emulator.
  // The admin transaction changes only its four clock fields, preserving durations
  // and fractional timestamp precision. The actual resolver remains unchanged.
  await require('./historical-specialist-fixture')(key,result.fleetId,{
    ships:result.ships, cargo:{metal:0,crystal:0,deuterium:0}, originKey:'1_1_2',targetKey:'1_2_2'
  });
  await winner.evaluate(async key=>{
    await new Promise(resolve=>{
      let own=false,incoming=false;
      const ready=()=>{if(own && incoming) resolve();};
      window.stopOwn=UniversumMP.listenOwnFleets(u,()=>{own=true;ready();});
      window.stopIncoming=UniversumMP.listenIncomingFleets(u,()=>{incoming=true;ready();});
    });
  },key);
  // No client clock manipulation: the persisted flight is already due.
  const recovered=await winner.evaluate(async ({key,id})=>{
    const persisted=(await fbDB.collection('online_universes').doc(key).collection('fleets').doc(id).get({source:'server'})).data();
    if(persisted.arrivalTime>Date.now())throw Error('Historical fixture is not due on client');
    await UniversumMP.resolveArrivedOnlineFleets(key,1000);
    const ref=fbDB.collection('online_universes').doc(key);
    const fleet=(await ref.collection('fleets').doc(id).get({source:'server'})).data();
    const fresh=await UniversumMP.joinOnlineUniverse(key);
    await UniversumMP.syncPlayerState(fresh,{force:true});await UniversumMP.syncPlayerState(fresh,{force:true});
    const dest=(await ref.collection('planets').doc('1_2_2').get({source:'server'})).data();
    return {resolved:fleet.resolved,atDestination:dest.fleet.hephaestusForge || 0,inbox:!!dest.inbox,
      count:fresh.planets.reduce((n,p)=>n+(p.fleet.hephaestusForge || 0)+p.shipyardQueue.filter(q=>q.id==='hephaestusForge').reduce((a,q)=>a+q.remaining,0),0)};
  },{key,id:result.fleetId});
  assert.equal(recovered.resolved,true);assert(recovered.atDestination>=1);assert.equal(recovered.inbox,false);assert.equal(recovered.count,5);
  for(const page of clients) await page.close();
  console.log('SDK Firestore: due sessioni, limite imperiale, trasferimento atomico, arrivo, riconnessione e doppio checkpoint superati.');
};
