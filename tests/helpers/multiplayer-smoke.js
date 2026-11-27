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
  // The actual dispatch above remains subject to client Rules. For the resolver
  // fixture only, restore the same valid flight as a historical flight in the
  // isolated demo emulator. Shift ALL three clock values and departureAt by
  // the same whole-second offset; do not touch ships, debit, status or ledger.
  // Use Firestore's actual batchGet readTime, never a forged client clock.
  const docs=`http://${target.host}/v1/projects/demo-universum/databases/(default)/documents`;
  const fleetPath=`online_universes/${key}/fleets/${result.fleetId}`;
  const fullName=`projects/demo-universum/databases/(default)/documents/${fleetPath}`;
  const headers={Authorization:'Bearer owner','Content-Type':'application/json'};
  async function serverRead(){
    const response=await fetch(docs+':batchGet',{method:'POST',headers,body:JSON.stringify({documents:[fullName]}),signal:AbortSignal.timeout(10000)});
    assert(response.ok,`server clock read ${response.status}`);
    const raw=await response.json();const rows=Array.isArray(raw)?raw:[raw];
    const row=rows.find(x=>x.found?.name===fullName);
    assert(row?.readTime && Number.isFinite(Date.parse(row.readTime)),'server readTime required');
    return row;
  }
  const initial=await serverRead(), f=initial.found.fields;
  const clocks=['departureTime','arrivalTime','returnTime'];
  const numeric=v=>Number(v.integerValue??v.doubleValue);
  const old=Object.fromEntries(clocks.map(k=>[k,numeric(f[k])]));
  assert(clocks.every(k=>Number.isFinite(old[k])));
  assert.equal(f.status.stringValue,'outbound');assert.equal(f.resolved.booleanValue,false);
  const serverMs=Date.parse(initial.readTime);
  if(old.arrivalTime>serverMs){
    const shift=(Math.ceil((old.arrivalTime-serverMs)/1000)+1)*1000;
    const newFields=Object.fromEntries(clocks.map(k=>[k,{doubleValue:old[k]-shift}]));
    const stamp=f.departureAt.timestampValue;
    const match=stamp.match(/^(.*?)(\.\d+)?Z$/);assert(match,'persisted departureAt required');
    newFields.departureAt={timestampValue:new Date(Date.parse(match[1]+'Z')-shift).toISOString().replace('.000Z',(match[2]||'')+'Z')};
    const query=new URLSearchParams();for(const k of [...clocks,'departureAt'])query.append('updateMask.fieldPaths',k);
    query.set('currentDocument.updateTime',initial.found.updateTime);
    const response=await fetch(docs+'/'+fleetPath+'?'+query,{method:'PATCH',headers,body:JSON.stringify({fields:newFields}),signal:AbortSignal.timeout(10000)});
    assert(response.ok,`historical fixture seed ${response.status}: ${await response.text()}`);
    console.log('SDK fixture: historical flight, all persisted clocks shifted by',shift,'ms');
  }
  const matured=await serverRead(), m=matured.found.fields;
  assert(numeric(m.arrivalTime)<=Date.parse(matured.readTime),'persisted arrival must be due on real server');
  assert.equal(numeric(m.arrivalTime)-numeric(m.departureTime),old.arrivalTime-old.departureTime);
  assert.equal(numeric(m.returnTime)-numeric(m.arrivalTime),old.returnTime-old.arrivalTime);
  assert.equal(m.status.stringValue,'outbound');assert.equal(m.resolved.booleanValue,false);
  assert.deepEqual(m.ships,f.ships);assert.deepEqual(m.cargo,f.cargo);
  console.log('SDK fixture server readTime',matured.readTime,'persisted ETA',numeric(m.arrivalTime));
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
