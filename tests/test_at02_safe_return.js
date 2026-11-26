'use strict';
// AT02-I01: test mirato del resolver e della riparazione della flotta online.
// Eseguire prima e dopo la correzione: node tests/test_at02_safe_return.js
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const copy=o=>JSON.parse(JSON.stringify(o));
const store=new Map();
const res={metal:173,crystal:97,deuterium:43};
const origin={g:1,s:1,p:7},target={g:1,s:2,p:8};
const rootPath='online_universes/AT02';
const planetPath=rootPath+'/planets/1_1_7';
const fleetPath=id=>rootPath+'/fleets/'+id;
let failNextTransaction=false, failTransactions=false, activeId, checked=0;
const op={increment:n=>({__at02_increment:n})};
function applyUpdate(doc,upd){
  for(const [key,value] of Object.entries(upd)){
    const parts=key.split('.');
    let o=doc;
    for(const part of parts.slice(0,-1)){o[part]||={};o=o[part];}
    const k=parts[parts.length-1];
    if(value&&typeof value==='object'&&Object.hasOwn(value,'__at02_increment'))
      o[k]=(Number(o[k])||0)+value.__at02_increment;
    else o[k]=copy(value);
  }
}
function ref(p){
  return {
    id:p.split('/').pop(),path:p,
    async get(){
      const exists=store.has(p);
      return {exists,data:()=>exists?copy(store.get(p)):undefined};
    },
    async update(upd){
      if(!store.has(p))throw Error('Documento assente');
      const d=copy(store.get(p));applyUpdate(d,upd);store.set(p,d);
    },
    collection:name=>collection(p+'/'+name)
  };
}
function collection(p){
  const filters=[];
  let limit=Infinity;
  return {
    doc:id=>ref(p+'/'+(id||'message_'+Math.random().toString(36).slice(2))),
    where:(field,op,value)=>{filters.push([field,op,value]);return collectionQuery();},
    limit:n=>{limit=n;return collectionQuery();},
    get:async()=>collectionQuery().get()
  };
  function collectionQuery(){
    return {
      where:(field,op,value)=>{filters.push([field,op,value]);return collectionQuery();},
      limit:n=>{limit=n;return collectionQuery();},
      async get(){
        const docs=[];
        for(const [key,value] of store){
          if(!key.startsWith(p+'/')||key.slice(p.length+1).includes('/'))continue;
          if(!filters.every(([field,op,v])=>op==='=='&&value[field]===v))continue;
          docs.push({id:key.split('/').pop(),ref:ref(key),data:()=>copy(value),exists:true});
          if(docs.length>=limit)break;
        }
        return {docs};
      }
    };
  }
}
const db={
  collection,
  async runTransaction(work){
    const changes=[];
    const tx={
      get:r=>r.get(),
      update:(r,upd)=>changes.push({kind:'update',path:r.path,value:copy(upd)}),
      set:(r,doc)=>changes.push({kind:'set',path:r.path,value:copy(doc)})
    };
    if(failTransactions||failNextTransaction){
      failNextTransaction=false;
      throw Error('Rete indisponibile: transazione abortita');
    }
    await work(tx);
    // Applica insieme tutte le scritture solo se sono valide.
    const preview=new Map([...store].map(([key,v])=>[key,copy(v)]));
    for(const change of changes){
      if(change.kind==='set'){preview.set(change.path,change.value);continue;}
      if(!preview.has(change.path))throw Error('Documento di accredito scomparso');
      applyUpdate(preview.get(change.path),change.value);
    }
    store.clear();
    for(const [key,v] of preview)store.set(key,v);
  }
};
const win={fbAuth:{currentUser:{uid:'alice'}},fbDB:db};
const sandbox={window:win,firebase:{firestore:{FieldValue:op}},console,Date,Math,Promise,Map,Set};
vm.createContext(sandbox);
for(const f of ['context.js','foundation.js','sync.js','fleet-control.js','combat-resolver.js'])
  vm.runInContext(fs.readFileSync(path.join(root,'modules/online',f),'utf8'),sandbox,{filename:f});
const G=win.__UniversumMPModules;
G.processEmbargoFleets=async()=>{};
G.getLiveFleetDocs=()=>activeId?[{id:activeId,ref:ref(fleetPath(activeId)),
  data:()=>copy(store.get(fleetPath(activeId)))}]:[];
const problems=[];
async function check(name,work){
  try{await work();checked++;console.log('  PASS '+name);}
  catch(e){problems.push(name+': '+e.message);console.error('  FAIL '+name+': '+e.message);}
}
function planet(){return {ownerUid:'alice',resources:{metal:2000,crystal:1300,deuterium:900},
  buildings:{},fleet:{},defenses:{},coords:origin};}
function seed(id){
  const f={id,attackerUid:'alice',attackerName:'Alice',mission:'transport',
    originCoords:origin,targetCoords:target,targetKey:'1_2_8',status:'returning',
    resolved:false,arrivalTime:Date.now()-190000,returnTime:Date.now()-190000,
    ships:{smallCargo:2},cargo:copy(res)};
  store.set(fleetPath(id),f);
  activeId=id;
  return f;
}
async function run(){
  store.set(rootPath,{speed:1});
  await check('rientro ordinario: tre risorse accreditate atomicamente',async()=>{
    store.set(planetPath,planet());const f=seed('normal');
    await G.resolveArrivedOnlineFleets('AT02',1);
    const after=store.get(fleetPath(f.id)),p=store.get(planetPath);
    assert.equal(after.status,'completed');
    assert.equal(after.resolved,true);
    assert.deepEqual(p.inbox.resources,res);
    assert.equal(p.inbox.fleet.smallCargo,2);
  });
  await check('seconda sincronizzazione: nessuna duplicazione del carico',async()=>{
    const before=copy(store.get(planetPath).inbox);
    await G.resolveArrivedOnlineFleets('AT02',1);
    assert.deepEqual(store.get(planetPath).inbox,before);
  });
  await check('destinazione indisponibile: non si chiude la flotta né si perde il carico',async()=>{
    store.delete(planetPath);
    const f=seed('no-destination');
    const result=await G.forceCleanupOnlineFleet(ref(rootPath),f,ref(fleetPath(f.id)),'missing-route');
    assert.equal(result,false);
    assert.equal(store.get(fleetPath(f.id)).resolved,false);
    assert.deepEqual(store.get(fleetPath(f.id)).cargo,res);
  });
  await check('transazione di accredito fallita: nessuna chiusura autonoma',async()=>{
    store.set(planetPath,planet());
    const f=seed('transaction-failure');
    failTransactions=true;
    try{
      const result=await G.forceCleanupOnlineFleet(ref(rootPath),f,ref(fleetPath(f.id)),'resolution-failed');
      assert.equal(result,false);
      assert.equal(store.get(fleetPath(f.id)).resolved,false);
      assert.deepEqual(store.get(fleetPath(f.id)).cargo,res);
      assert.equal(store.get(planetPath).inbox,undefined);
    }finally{failTransactions=false;}
  });
  await check('dopo errore: nuovo tentativo accredita una volta sola',async()=>{
    const f=store.get(fleetPath('transaction-failure'));
    activeId=f.id;
    await G.resolveArrivedOnlineFleets('AT02',1);
    assert.equal(store.get(fleetPath(f.id)).resolved,true);
    assert.deepEqual(store.get(planetPath).inbox.resources,res);
    await G.resolveArrivedOnlineFleets('AT02',1);
    assert.deepEqual(store.get(planetPath).inbox.resources,res);
  });
  console.log('AT02-I01: '+checked+'/5 scenari superati.');
  if(problems.length){console.error(problems.join('\n'));process.exitCode=1;}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
