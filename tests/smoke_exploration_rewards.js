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
    const R=require('./helpers/game').win.UniversumExplorationRewards;
    let id;for(let i=1;;i++){id='wreck'+i;let n=R.randomFor(id)();if(n>=.55 && n<.62)break;}
    const uni=db.doc('online_universes/exp');
    const home=uni.collection('planets').doc('1_1_1');
    const fleets=uni.collection('fleets'), at=Date.now()-10000;
    await uni.set({speed:1});await home.set({ownerUid:'pilot',resources:{metal:250000,crystal:125000,deuterium:0},fleet:{}});
    const common={attackerUid:'pilot',mission:'expedition',status:'outbound',resolved:false,
      ships:{largeCargo:1},cargo:{metal:7,crystal:0,deuterium:0},originCoords:{g:1,s:1,p:1},
      originKey:'1_1_1',targetKey:'1_1_16',departureTime:at-10000,arrivalTime:at,returnTime:at+5000,
      expeditionHours:1,attackerTech:{},schemaVersion:3};
    const v2={...common,rewardRulesVersion:2,blackHoleFeePaid:0,blackHole:false,explorationEndTime:at};
    await fleets.doc(id).set(v2);
    await fleets.doc('legacy').set(common);
    async function resolve(page,ids){
      await page.evaluate(async ids=>{
        const uni=fbDB.doc('online_universes/exp');
        const docs=await Promise.all(ids.map(id=>uni.collection('fleets').doc(id).get({source:'server'})));
        window.__UniversumMPModules.getLiveFleetDocs=()=>docs;
        await window.UniversumMP.resolveArrivedOnlineFleets('exp',1);
      },ids);
    }
    await pages[1].evaluate(()=>fbDB.disableNetwork());
    await resolve(pages[0],[id,'legacy']);
    await pages[1].evaluate(()=>fbDB.enableNetwork());
    const flight=(await fleets.doc(id).get()).data();
    assert.equal(flight.status,'returning');assert.equal(flight.rewardResult.event,'wreck');
    assert.equal(flight.ships.deathStar,1);assert.equal(flight.returnTime,v2.returnTime);
    assert.equal(flight.cargo.metal,7);
    assert.equal((await home.get()).data().inbox.resources.metal,-250000);
    const legacy=(await fleets.doc('legacy').get()).data();
    assert.equal(legacy.status,'returning');assert.equal(legacy.rewardResult,undefined);
    await Promise.all(pages.map(p=>resolve(p,[id,'legacy'])));
    const paid=(await home.get()).data().inbox;
    assert.equal(paid.fleet.deathStar,1);assert.equal((await fleets.doc(id).get()).data().resolved,true);
    await resolve(pages[0],[id,'legacy']);
    assert.deepEqual((await home.get()).data().inbox,paid);
    const repairId=id+'-second';
    await fleets.doc(repairId).set(v2);
    await Promise.all(pages.map(p=>resolve(p,[repairId])));
    assert.equal((await fleets.doc(repairId).get()).data().status,'returning');
    assert.equal((await uni.collection('messages').where('title','==','Esplorazione [1_1_16]').get()).size,2);
    const model=require('./helpers/game').uni(1);
    Object.assign(model,{id:'launch',serviceRevision:0,emperor:'Pilot'});
    const planet=model.planets[0];
    Object.assign(planet,{ownerUid:'pilot',ownerName:'Pilot',maxTemp:30,fieldsMax:240,lastUpdated:Date.now()});
    planet.fleet.largeCargo=2;
    const launchUni=db.doc('online_universes/launch');
    await launchUni.set({speed:1});
    await launchUni.collection('players').doc('pilot').set({uid:'pilot',serviceRevision:0,researches:model.researches});
    await launchUni.collection('planets').doc('1_1_2').set(planet);
    const dispatch=await pages[0].evaluate(async model=>{
      const target={g:1,s:1,p:16};
      const G=window.UniversumGalaxy;
      const ships={largeCargo:1};
      const fuel=G.getFleetSpeedAndFuel(model,ships,G.calculateDistance(model.planets[0].coords,target),100).fuelCost;
      const f=await window.UniversumMP.launchOnlineFleet(model,0,target,'explore',ships,{deuterium:5},{blackHole:true});
      return {id:f.id,fuel};
    },model);
    const launched=(await launchUni.collection('fleets').doc(dispatch.id).get()).data();
    assert.equal(launched.rewardRulesVersion,2);assert.equal(launched.blackHoleFeePaid,50000);
    const afterLaunch=(await launchUni.collection('planets').doc('1_1_2').get()).data();
    assert.equal(afterLaunch.resources.deuterium,planet.resources.deuterium-50000-5-dispatch.fuel);
    assert.equal(afterLaunch.fleet.largeCargo,1);
    const refused=await pages[0].evaluate(async id=>{
      const fleet=fbDB.doc('online_universes/launch/fleets/'+id);
      const raw=(await fleet.get()).data();
      async function denied(action) {
        try {await action();return false;} catch(err){return err.code==='permission-denied';}
      }
      return Promise.all([
        denied(()=>fleet.update({rewardRulesVersion:1})),
        denied(()=>fleet.update({status:'returning',arrivalTime:raw.returnTime,
          rewardResult:{eventId:id,version:2,survivors:raw.ships}})),
        denied(()=>fleet.parent.doc('unpaid').set(raw))
      ]);
    },dispatch.id);
    assert.deepEqual(refused,[true,true,true]);
    await pages[0].evaluate(async id=>{
      await window.UniversumMP.recallOnlineFleet({id:'launch'},id);
    },dispatch.id);
    const recalled=(await launchUni.collection('fleets').doc(dispatch.id).get()).data();
    assert.equal(recalled.mission,'recall');assert.equal(recalled.rewardResult,undefined);
    console.log('Lancio online Buco Nero, addebito unico e richiamo senza premio verificati.');
    console.log('Due schede: relitto, addebito unico, legacy, ritardo, rientro e ripetizione verificati.');
  } finally {await browser.close();server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;server.close();});
