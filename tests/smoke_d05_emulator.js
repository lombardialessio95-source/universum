// Browser SDK and production rules on a disposable local Firestore emulator.
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {initializeApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw Error('Emulatore locale richiesto.');
const db=getFirestore(initializeApp({projectId:'demo-universum'}));
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep) || !fs.existsSync(file)) {res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':'text/plain');
  fs.createReadStream(file).pipe(res);
});
async function main(){
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--single-process','--no-zygote']});
  try {
    const ctx=await browser.newContext({serviceWorkers:'block'});
    const pages=[];
    for(let i=0;i<2;i++){
      const page=await ctx.newPage();pages.push(page);
      await page.route(/^https:/,r=>r.abort());
      await page.goto('http://127.0.0.1:'+server.address().port+'/app.html?release='+require('../release-manifest.json').version);
      for(const js of ['firebase-app-compat.js','firebase-firestore-compat.js'])
        await page.addScriptTag({path:path.join(process.env.FIREBASE_SDK_DIR,js)});
      await page.evaluate(port=>{
        const db=firebase.initializeApp({projectId:'demo-universum',apiKey:'demo'},'exp').firestore();
        db.settings({experimentalForceLongPolling:true});db.useEmulator('127.0.0.1',port,{mockUserToken:{sub:'pilot'}});
        window.fbDB=db;window.fbAuth={currentUser:{uid:'pilot'}};
      },Number(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1]));
    }
    const model=require('./helpers/game').uni(2);
    Object.assign(model,{id:'d05',serviceRevision:0,emperor:'Pilot'});
    const room=db.doc('online_universes/d05');
    const [home,dest]=model.planets;
    for(const p of model.planets) Object.assign(p,{ownerUid:'pilot',ownerName:'Pilot',maxTemp:34,fieldsMax:240,lastUpdated:Date.now()});
    home.bacinoSpaziale={status:'active',startedAt:123,invictusActive:1,crepuscolo:{status:'active'}};
    home.fleet={mothership:1,largeCargo:3};
    home.mothershipHangars=[{id:'mother_smoke',fighters:22}];
    await room.set({speed:1});
    await room.collection('players').doc('pilot').set({uid:'pilot',serviceRevision:0,researches:model.researches});
    for(const p of model.planets) await room.collection('planets').doc([p.coords.g,p.coords.s,p.coords.p].join('_')).set(p);
    const fid=await pages[0].evaluate(async u=>{
      window.u=u;
      const f=await UniversumMP.launchOnlineFleet(u,0,u.planets[1].coords,'deploy',
        {mothership:1,largeCargo:3,invictus:1,crepuscolo:1},{metal:57},{});
      return f.id;
    },model);
    const ref=room.collection('fleets').doc(fid),href=room.collection('planets').doc('1_1_2'),
      dref=room.collection('planets').doc('1_2_2');
    assert.equal((await href.get()).data().bacinoSpaziale.invictusActive,0);
    async function resolve(page) {
      await page.evaluate(async id=>{
        const snap=await fbDB.doc('online_universes/d05/fleets/'+id).get({source:'server'});
        window.__UniversumMPModules.getLiveFleetDocs=()=>[snap];
        await UniversumMP.resolveArrivedOnlineFleets('d05',1);
      },fid);
    }
    await ref.update({arrivalTime:Date.now()-1,returnTime:Date.now()+60000});
    await Promise.all(pages.map(resolve));
    const returning=(await ref.get()).data();
    assert.equal(returning.status,'returning');assert.deepEqual(returning.ships,{invictus:1,crepuscolo:1});
    const ib=(await dref.get()).data().inbox;
    assert.equal(ib.hangarReturns[fid][0].fighters,22);assert.equal(ib.resources.metal,57);
    await ref.update({arrivalTime:Date.now()-100,returnTime:Date.now()-100});
    await Promise.all(pages.map(resolve));await resolve(pages[0]);
    assert.equal((await ref.get()).data().resolved,true);
    await pages[0].evaluate(async()=>{await UniversumMP.syncPlayerState(window.u,{force:true});await UniversumMP.syncPlayerState(window.u,{force:true});});
    const h=(await href.get()).data(),d=(await dref.get()).data();
    assert.equal(h.bacinoSpaziale.invictusActive,1);assert.equal(h.bacinoSpaziale.crepuscolo.status,'active');
    assert.equal(d.fleet.mothership,1);assert.equal(d.fleet.largeCargo,3);
    assert.equal(d.mothershipHangars[0].id,'mother_smoke');assert.equal(d.mothershipHangars[0].fighters,22);
    assert.equal(d.fleet.invictus,undefined);assert.equal(h.inbox,undefined);
    console.log('Schiera mista verificata con due schede Chromium, SDK Firestore, replay e due checkpoint.');
    const gal={id:'g1',name:'Vega',coords:{g:1,s:3,p:2},resources:{metal:500,crystal:0,deuterium:1e8},
      orbitingFleet:{mothership:1},mothershipHangars:[{id:'orbital',fighters:19}],defenses:{}};
    const id=await pages[0].evaluate(async gal=>{
      u.galattiche=[gal];
      const flight=await __UniversumMPModules.launchGalattica(u,'g1',{g:1,s:7,p:2},'transport',{mothership:1},{metal:42});
      await __UniversumMPModules.jumpOnlineGalattica(u,'g1',{g:1,s:8,p:2});
      return flight.id;
    },gal);
    const gf=room.collection('fleets').doc(id), gr=room.collection('galattiche').doc('pilot~g1');
    assert.equal((await gr.get()).data().state.coords.s,8);
    const due=()=>gf.update({status:'returning',returnTime:Date.now()-100,arrivalTime:Date.now()-100});
    const land=page=>page.evaluate(async id=>{
      const snap=await fbDB.doc('online_universes/d05/fleets/'+id).get({source:'server'});
      __UniversumMPModules.getLiveFleetDocs=()=>[snap];await UniversumMP.resolveArrivedOnlineFleets('d05',1);
    },id);
    await due();await Promise.all(pages.map(land));
    assert.equal((await gf.get()).data().galatticaReturn,true);
    await due();await Promise.all(pages.map(land));await land(pages[0]);
    assert.equal((await gf.get()).data().resolved,true);
    const settled=(await gr.get()).data().state;
    assert.equal(settled.resources.metal,500);assert.equal(settled.orbitingFleet.mothership,1);
    assert.deepEqual(settled.mothershipHangars,[{id:'orbital',fighters:19}]);
    console.log('SDK: Galattica lancia, salta e riceve una sola volta scafo, hangar e carico.');
  } finally {await browser.close();server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;server.close();});
