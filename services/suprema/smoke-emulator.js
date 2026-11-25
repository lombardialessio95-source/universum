'use strict';

const assert = require('node:assert/strict');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {recoverAtLogin} = require('./recover');
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!/^127\.0\.0\.1:\d+$/.test(host || '')) throw Error('Avviare un emulatore Firestore locale.');
const projectId = 'demo-universum';
initializeApp({projectId});

async function run() {
  const db = getFirestore();
  const T = 1700000000000, hour = 3600000;
  const path = 'online_universes/suprema-smoke';
  const privateDoc = db.doc(path+'/supremaRecoveryPrivate/siege1');
  const publicDoc = db.doc(path+'/supremaRecoveryPublic/siege1');
  const roster = ['attacker','defender'];
  const ship = {
    id:'one',planetId:'home',siegeId:'siege1',status:'outbound',operatingFuel:200000,returnReserve:10,
    whenFull:'return',shipyardQueue:[],hangar:{escort:{},invasion:{cruiser:10},reserve:{}},
    resources:{metal:0,crystal:0,deuterium:0}
  };
  await privateDoc.set({
    attackerUid:roster[0],defenderUid:roster[1],revision:0,pending:[{id:'wave-0',kind:'wave',sequence:0,at:T}],
    battle:{id:'siege1',attackerUid:roster[0],mode:'prudente',targetKey:'1_1_1',
      sequence:0,nextAt:T,arrival:T,waveHours:1,travel:{durationSec:120},attackTech:{}},
    target:{fleet:{},defenses:{},resources:{metal:1000000,crystal:0,deuterium:0}},
    supremes:[ship]
  });
  await publicDoc.set({participants:roster,attackerUid:roster[0],targetKey:'1_1_1',ships:0,frequencyHours:1,nextWaveAt:T});

  const options = {universeId:'suprema-smoke',siegeId:'siege1'};
  await assert.rejects(()=>recoverAtLogin(db,{...options,uid:null},()=>T),{code:'unauthenticated'});
  await assert.rejects(()=>recoverAtLogin(db,{...options,uid:'outsider'},()=>T),{code:'permission-denied'});
  // The defender alone resolves the first wave. No browser or attacker process is running.
  const initial=await recoverAtLogin(db,{...options,uid:roster[1]},()=>T);
  assert.equal(initial.applied,1);
  assert.equal(initial.nextWaveAt,T+hour);
  assert.deepEqual(Object.keys(initial).sort(),['applied','needsMore','nextWaveAt','ships']);
  const raced=await Promise.all(roster.map(uid=>recoverAtLogin(db,{...options,uid},()=>T+hour)));
  assert.equal(raced.reduce((n,x)=>n+x.applied,0),1);
  assert.equal((await privateDoc.collection('receipts').get()).size,2);
  const saved=(await privateDoc.get()).data();
  assert.equal(saved.revision,2);
  assert.equal(saved.supremes[0].operatingFuel,176000);
  assert.equal(saved.target.resources.metal,984000);
  assert.equal(saved.supremes[0].resources.metal,16000);
  assert.equal(saved.battle.mode,'prudente');
  assert.equal((await recoverAtLogin(db,{...options,uid:roster[1]},()=>T+hour)).applied,0);
  const view=(await publicDoc.get()).data();
  assert(!Object.hasOwn(view,'mode') && !Object.hasOwn(view,'supremes') && !Object.hasOwn(view,'target'));

  const encode=data=>Buffer.from(JSON.stringify(data)).toString('base64url');
  const stamp=Math.floor(Date.now()/1000);
  async function asClient(uid,doc,body) {
    const jwt=encode({alg:'none',typ:'JWT'})+'.'+encode({sub:uid,user_id:uid,aud:projectId,
      iss:'https://securetoken.google.com/'+projectId,iat:stamp,exp:stamp+3600})+'.';
    return fetch('http://'+host+'/v1/projects/'+projectId+'/databases/(default)/documents/'+doc,{
      method:body?'PATCH':'GET',headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body
    });
  }
  assert.equal((await asClient('defender',publicDoc.path)).status,200);
  assert.equal((await asClient('outsider',publicDoc.path)).status,403);
  for (const member of roster) {
    assert.equal((await asClient(member,privateDoc.path)).status,403);
    assert.equal((await asClient(member,publicDoc.path,'{"fields":{}}')).status,403);
  }
  console.log('Emulatore Firestore: recupero con il solo difensore, concorrenza, due ricevute e riservatezza verificati.');
}

run().catch(err=>{console.error(err);process.exitCode=1;});
