'use strict';
// AT04-I01C: real Web SDK, test-only fixtures, local demo project. Never production.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const host=process.env.FIRESTORE_EMULATOR_HOST||'';
if(!/^127\.0\.0\.1:[1-9]\d*$/.test(host)){console.error('BLOCKED: loopback Emulator required');process.exit(2);}
const projectId='demo-universum';const root=path.resolve(__dirname,'..');
let firebase;try{const app=require('firebase/compat/app');firebase=app.default||app;require('firebase/compat/firestore');}catch(e){console.error('BLOCKED: SDK missing',e.message);process.exit(2);}
const FV=firebase.firestore.FieldValue, apps=[], runId='at04c_'+crypto.randomBytes(6).toString('hex'), room=`online_universes/${runId}`;
const mode=process.env.AT04_MODE||'candidate';assert(['baseline','candidate'].includes(mode));
function client(uid){const app=firebase.initializeApp({apiKey:'demo',projectId,appId:'demo-at04'},`${runId}_${apps.length}`);apps.push(app);const db=app.firestore();db.settings({experimentalForceLongPolling:true});db.useEmulator('127.0.0.1',Number(host.split(':')[1]),{mockUserToken:{sub:uid}});return db;}
function value(v){if(v?.__at04Ts){const {seconds,nanoseconds}=v.__at04Ts;return{timestampValue:new Date(seconds*1000).toISOString().replace('.000Z','.'+String(nanoseconds).padStart(9,'0')+'Z')};}if(v instanceof Date)return{timestampValue:v.toISOString()};if(v===null)return{nullValue:null};if(typeof v==='boolean')return{booleanValue:v};if(typeof v==='number')return Number.isSafeInteger(v)?{integerValue:String(v)}:{doubleValue:v};if(typeof v==='string')return{stringValue:v};if(Array.isArray(v))return{arrayValue:{values:v.map(value)}};return{mapValue:{fields:fields(v)}};}
function fields(v){return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,value(x)]));}
async function adminSet(key,data){const res=await fetch(`http://${host}/v1/projects/${projectId}/databases/(default)/documents/${key}`,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:fields(data)}),signal:AbortSignal.timeout(10000)});if(!res.ok)throw Error(`Emulator seed ${res.status}: ${await res.text()}`);}
async function denied(fn){await assert.rejects(fn(),e=>String(e?.code||'').endsWith('permission-denied'),'must reject by actual Rules');}
async function snap(ref){return (await ref.get({source:'server'})).data();}
async function main(){
 const rules=process.env.RULES_FILE||path.join(root,'firestore.rules');console.log('Rules FILE SHA256',crypto.createHash('sha256').update(fs.readFileSync(rules)).digest('hex'),'mode',mode);
 const a=client('alice'),b=client('bob'),a2=client('alice');
 const makeCases=require('./helpers/at04_structural_cases');let count=0;
 for(let idx=0;idx<makeCases(0).length;idx++){const c=makeCases(Date.now())[idx];if(c.modelOnly||(mode==='baseline'&&!c.red))continue;const key=room+'/fleets/case'+count++;await adminSet(key,c.old);const ref=(c.uid==='bob'?b:a).doc(key), before=await snap(ref);const upd={...c.patch};for(const k of c.remove)upd[k]=FV.delete();
   if(mode==='baseline'||c.allow)await ref.update(upd);else{await denied(()=>ref.update(upd));assert.deepEqual(await snap(ref),before);}
   console.log('PASS',mode==='baseline'?'old allowed':c.allow?'allow':'deny',c.name);
 }
 console.log('SDK direct case count',count);
 if(mode==='baseline')return;
 const T=Date.now(),base=makeCases(T)[0].old, complete={status:'completed',phase:'COMPLETATA',resolved:true,completedAt:T};
 const seq=a.doc(room+'/fleets/sequence');await adminSet(seq.path,base);
 await denied(()=>seq.update({arrivalTime:T-1,returnTime:T-1}));await denied(()=>seq.update(complete));
 await denied(()=>seq.update({status:'returning',phase:'IN RITORNO',resolved:false,arrivalTime:T-1,returnTime:T-1}));
 await denied(()=>seq.update(complete));console.log('PASS R01/R05/R06 sequential bypass');
 // The recall clock is intentionally preserved; this sequence proves the residual.
 await seq.update({mission:'recall',status:'returning',phase:'IN RITORNO',arrivalTime:T-1,returnTime:T-1});await seq.update(complete);
 await denied(()=>seq.update({status:'returning',phase:'IN RITORNO',resolved:false}));console.log('PASS residual recall accepted; terminal revival denied');
 // Atomic rejection: independently permissible inbox credit plus premature terminal update.
 const home=a.doc(room+'/planets/1_1_1');await adminSet(home.path,{ownerUid:'alice',id:'home',coords:{g:1,s:1,p:1},inbox:{resources:{metal:0}}});
 const early=a.doc(room+'/fleets/early');await adminSet(early.path,base);const h0=await snap(home),f0=await snap(early);
 const batch=a.batch();batch.update(home,{'inbox.resources.metal':FV.increment(10)});batch.update(early,complete);await denied(()=>batch.commit());assert.deepEqual(await snap(home),h0);assert.deepEqual(await snap(early),f0);console.log('PASS actual atomic rollback');
 // Exercise the real cleanup helper, with the original inbox and credit resolution helpers,
 // through two independently authenticated SDK clients. Both see a stale active snapshot.
 const returned={...base,status:'returning',phase:'IN RITORNO',arrivalTime:T-10000,returnTime:T-10000};
 const key=room+'/fleets/cleanup';await adminSet(key,returned);
 function game(db){const W={fbDB:db,fbAuth:{currentUser:{uid:'alice'}},localStorage:{getItem:()=>null,setItem(){},removeItem(){}}};const ctx=vm.createContext({window:W,firebase,console,Date,Math});for(const file of ['context.js','foundation.js','sync.js','fleet-control.js'])vm.runInContext(fs.readFileSync(path.join(root,'modules/online',file),'utf8'),ctx,{filename:file});vm.runInContext(fs.readFileSync(path.join(root,'missions-core.js'),'utf8'),ctx,{filename:'missions-core.js'});return W.__UniversumMPModules;}
 const g1=game(a),g2=game(a2);const u1=a.doc(room),u2=a2.doc(room);
 await Promise.all([g1.forceCleanupOnlineFleet(u1,returned,a.doc(key),'repair-button'),g2.forceCleanupOnlineFleet(u2,returned,a2.doc(key),'repair-button')]);
 assert.equal((await snap(home)).inbox.resources.metal,10);assert.equal((await snap(a.doc(key))).status,'completed');console.log('PASS two real SDK clients / one cleanup credit');
 // Legacy terminal with no resolved flag: fresh check prevents a second credit.
 const legacy={...returned,status:'completed',phase:'COMPLETATA'};delete legacy.resolved;
 const legacyKey=room+'/fleets/legacyTerminal';await adminSet(legacyKey,legacy);
 await g1.forceCleanupOnlineFleet(u1,returned,a.doc(legacyKey),'repair-button');assert.equal((await snap(home)).inbox.resources.metal,10);assert.deepEqual(await snap(a.doc(legacyKey)),legacy);console.log('PASS real cleanup stale legacy terminal');
 // Check that the real client ordinary recall (not a synthetic update) is accepted.
 const recall=a.doc(room+'/fleets/realRecall');await adminSet(recall.path,base);await g1.recallOnlineFleet({id:runId,fleetsInFlight:[]},recall.id);assert.equal((await snap(recall)).mission,'recall');console.log('PASS actual recall helper');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{for(const app of apps)await app.delete();});
