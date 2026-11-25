'use strict';
/**
 * Eseguire dal repository completo con:
 *   node tests/test_suprema_option_c_flow.js
 * È una simulazione transazionale sincrona; NON un vero test Firebase.
 */
const assert=require('node:assert/strict');
const API=require('../services/suprema/option-c-service');
const E=require('../services/suprema/engine');
const day=86400000;
const original=o=>JSON.parse(JSON.stringify(o));
const store=new Map();
class Snap {
  constructor(path){this.path=path;this.exists=store.has(path);this.id=path.split('/').at(-1);}
  data(){return original(store.get(this.path));}
}
class Ref {
  constructor(path){this.path=path;}
  collection(name){return new Collection(this.path+'/'+name);}
}
class Collection {
  constructor(path){this.path=path;}
  doc(id){return new Ref(this.path+'/'+id);}
  where(field,op,value) {
    assert.equal(op,'array-contains');
    return {get:async()=>({docs:[...store.keys()].filter(p=>p.startsWith(this.path+'/')&&
      store.get(p)[field]?.includes(value)).map(p=>new Snap(p))})};
  }
}
function set(ref,obj){store.set(ref.path,original(obj));}
function update(ref,patch){
  const result=original(store.get(ref.path)||{});
  for(const [path,value]of Object.entries(patch)){
    const keys=path.split('.'),last=keys.pop();let part=result;
    for(const key of keys){part[key]||={};part=part[key];}
    part[last]=value;
  }
  store.set(ref.path,result);
}
const db={
  collection(name){return new Collection(name);},
  async runTransaction(callback){
    const tx={get:async ref=>new Snap(ref.path),set,update};
    return callback(tx);
  }
};
const b='online_universes/t1',home=b+'/planets/1_1_1',target=b+'/planets/1_2_1';
store.set(b,{supremaOptionCStaging:true,militarySpeed:1,speed:10});
store.set(b+'/players/userA',{researches:{weaponsTech:10,shieldingTech:10,armourTech:10,hyperspaceDrive:10}});
store.set(b+'/players/userB',{researches:{}});
store.set(home,{
  ownerUid:'userA',resources:{metal:23000000,crystal:15000000,deuterium:10000000},
  fleet:{lightFighter:200},defenses:{},inbox:{resources:{},fleet:{}},
  bacinoSpaziale:{status:'active'},
  localResearches:Object.fromEntries(Object.entries(E.core.requirements).map(([k,v])=>[k,v]))
});
store.set(target,{
  ownerUid:'userB',resources:{metal:10000,crystal:10000,deuterium:10000},
  fleet:{},defenses:{},buildings:{},inbox:{resources:{},fleet:{},defenses:{}}
});
let count=0;
const check=(condition,message)=>{assert.ok(condition,message);count++;};
const act=(uid,data,t)=>API.commandAction(db,{uid,universeId:'t1',...data},()=>t);
async function run(){
  const t=1000000;
  const order=await act('userA',{action:'build',commandId:'b1',originKey:'1_1_1',supremeId:'Sup1'},t);
  check(order.nextPaymentAt===t+day,'primo pagamento dopo un giorno');
  let v=await API.getState(db,{uid:'userA',universeId:'t1'},()=>t+day*40);
  check(v.inventory.ships.length===1&&v.inventory.constructions.length===0,'40 rate concludono la costruzione');
  check(store.get(home).inbox.resources.metal===-20000000,'20 milioni di metallo addebitati');
  check(store.get(home).inbox.resources.crystal===-12000000,'12 milioni di cristallo addebitati');
  check(store.get(home).inbox.resources.deuterium===-8000000,'8 milioni di deuterio addebitati');
  const now=t+day*40+1000;
  const load={action:'load',commandId:'l1',originKey:'1_1_1',supremeId:'Sup1',ship:'lightFighter',count:30};
  await act('userA',load,now);
  check(store.get(home).inbox.fleet.lightFighter===-30,'carico sottratto al pianeta canonico');
  await act('userA',load,now);
  check(store.get(home).inbox.fleet.lightFighter===-30,'replay carico non duplica');
  await assert.rejects(act('userA',{...load,count:31},now),/già utilizzato/i);count++;
  await act('userA',{action:'assign',commandId:'a1',supremeId:'Sup1',ship:'lightFighter',
    count:15,from:'reserve',to:'invasion'},now);
  await act('userA',{action:'deposit',commandId:'d1',originKey:'1_1_1',
    supremeId:'Sup1',resource:'metal',amount:5000},now);
  await act('userA',{action:'queue',commandId:'q1',supremeId:'Sup1',ship:'lightFighter',count:1},now);
  v=await API.getState(db,{uid:'userA',universeId:'t1'},()=>now+60000);
  check(v.inventory.ships[0].shipyardQueue.length<=1,'cantiere online progredisce');
  const launch=await act('userA',{action:'launch',commandId:'fly1',originKey:'1_1_1',
    targetKey:'1_2_1',supremeId:'Sup1'},now+70000);
  check(launch.missionId==='userA_fly1','missione individuale univoca');
  await assert.rejects(act('userA',{action:'launch',commandId:'fly2',originKey:'1_1_1',
    targetKey:'1_2_1',supremeId:'Sup1'},now+70000),/indisponibile/i);count++;
  const result=await act('userB',{action:'resolve',commandId:'resolution1',missionId:launch.missionId},
    launch.arrivalAt+1000);
  check(result.status==='returning' || result.status==='destroyed','una sola battaglia registrata');
  check((result.report.orbital?.rounds||0)<=6&&(result.report.planetary?.rounds||0)<=6,'sei round max fase');
  const before=original(store.get(target).inbox.resources);
  await act('userB',{action:'resolve',commandId:'resolution1',missionId:launch.missionId},
    launch.arrivalAt+2000);
  check(JSON.stringify(store.get(target).inbox.resources)===JSON.stringify(before),
    'replay risoluzione senza doppio bottino');
  if(result.status==='returning') {
    await assert.rejects(act('userB',{action:'return',commandId:'notOwner',
      originKey:'1_1_1',missionId:launch.missionId},result.returnAt+5),/non tuo|non disponibile/i);count++;
    const ret={action:'return',commandId:'r1',originKey:'1_1_1',missionId:launch.missionId};
    await act('userA',ret,result.returnAt+1);
    await act('userA',ret,result.returnAt+2);
    const state=await API.getState(db,{uid:'userA',universeId:'t1'},()=>result.returnAt+2);
    check(state.inventory.ships.length===1&&state.inventory.ships[0].status==='docked',
      'una sola Suprema rientrata');
  }
  console.log('Fase 4 Opzione C: '+count+' asserzioni passate (Firestore simulato, NON staging reale)');
}
run().catch(err=>{console.error(err);process.exitCode=1;});
