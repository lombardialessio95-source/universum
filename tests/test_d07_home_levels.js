'use strict';
// D07-I01: verifica puntuale dell'inizializzazione pianeta madre online/offline.
// Esecuzione: node tests/test_d07_home_levels.js
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const offline=fs.readFileSync(path.join(root,'modules/offline/storage.js'),'utf8');
const online=fs.readFileSync(path.join(root,'modules/online/universes.js'),'utf8');
let checks=0;
// Normalizza gli oggetti VM nello stesso realm senza eliminare proprietà o
// cambiare i valori: deepStrictEqual continua a controllare tutta la struttura.
function eq(actual,expected,label){
  assert.deepStrictEqual(structuredClone(actual),structuredClone(expected),label);
  checks++;
}
function ok(value,label){assert.ok(value,label);checks++;}
const offlineBuildingsMatch=offline.match(/buildings:\s*\{([\s\S]*?)\}\s*,\s*defenses:\s*\{\}/);
ok(offlineBuildingsMatch,'edifici del pianeta madre offline individuati');
const offlineBuildings=vm.runInNewContext('({'+offlineBuildingsMatch[1]+'})');
const offlineExpected=JSON.parse(JSON.stringify(offlineBuildings));
eq(Object.keys(offlineExpected).length,14,'offline contiene 14 tipi di edifici');
ok(Object.values(offlineExpected).every(v=>v===0),'offline inizializza tutti gli edifici a zero');
const store=new Map();
const clone=o=>JSON.parse(JSON.stringify(o));
const coordsToKey=c=>[c.g,c.s,c.p].join('_');
class Ref {
  constructor(key){this.key=key;this.id=key.split('/').pop();}
  collection(name){return new Collection(this.key+'/'+name);}
  async get(){const value=store.get(this.key);return {exists:value!==undefined,id:this.id,data:()=>clone(value)};}
  async set(value,opts={}){store.set(this.key,opts.merge?{...store.get(this.key),...clone(value)}:clone(value));}
  async update(value){store.set(this.key,{...store.get(this.key),...clone(value)});}
}
class Collection {
  constructor(key){this.key=key;}
  doc(id){return new Ref(this.key+'/'+id);}
  where(field,op,value){return new Query(this.key,[[field,op,value]]);}
}
class Query {
  constructor(key,filters){this.key=key;this.filters=filters;}
  where(f,op,v){return new Query(this.key,[...this.filters,[f,op,v]]);}
  orderBy(){return this;}
  limit(){return this;}
  async get(){
    const docs=[];
    for(const [key,value] of store){
      if(!key.startsWith(this.key+'/')||key.slice(this.key.length+1).includes('/'))continue;
      if(!this.filters.every(([k,op,v])=>op==='=='?value[k]===v:op==='array-contains'&&Array.isArray(value[k])&&value[k].includes(v)))continue;
      docs.push({id:key.split('/').pop(),data:()=>clone(value)});
    }
    return {docs,size:docs.length};
  }
}
const db={
  collection:name=>new Collection(name),
  async runTransaction(fn){return fn({
    get:ref=>ref.get(),
    set:(ref,value,opts={})=>{store.set(ref.key,opts.merge?{...store.get(ref.key),...clone(value)}:clone(value));}
  });}
};
const user={uid:'alice',displayName:'Alice',email:'alice@example.test'};
const G={
  coordsToKey,getAuth:()=>({currentUser:user}),getDB:()=>db,
  migrateOnlineFleets:async()=>{},ensureBotsAroundHome:async()=>{},
  normalizeBotConfig:c=>c,restoreGalattiche:async()=>{},restoreServices:()=>{}
};
const win={__UniversumMPModules:G,
  __UniversumMPVariables:{
    SERVER_LIMIT:3,SERVER_LIMIT_MESSAGE:'limit',
    _leaderboardCache:new Map(),_playersCache:new Map(),
    _privateCleanupDone:new Set(),_systemCache:new Map()
  },
  UniversumEngine:{normalizeResearchState:()=>{}}
};
const firebase={firestore:{FieldValue:{increment:n=>n,serverTimestamp:()=>({seconds:1,nanoseconds:0})}}};
vm.runInNewContext(online,{window:win,console,firebase,Date,Math});
const uniRef='online_universes/d07room';
store.set(uniRef,{name:'D07',speed:1,galaxies:1,systemsPerGalaxy:20,playerCount:0});
async function run(){
  const joined=await G.joinOnlineUniverse('d07room');
  eq(joined.planets.length,1,'nuovo account riceve un pianeta madre');
  const home=joined.planets[0];
  eq(home.buildings,offlineExpected,'nuovo pianeta madre online identico ai livelli offline');
  const key=uniRef+'/planets/'+coordsToKey(home.coords);
  eq(store.get(key).buildings,offlineExpected,'livelli salvati nella persistenza Firestore simulata');
  const original=G.createStarterPlanetDoc('u',{g:1,s:1,p:7},'alice','Alice','Colonia',false);
  eq(original.buildings.metalMine,1,'helper colonie/non home invariato: metallo');
  eq(original.buildings.crystalMine,1,'helper colonie/non home invariato: cristallo');
  eq(original.buildings.solarPlant,1,'helper colonie/non home invariato: energia');
  const npc=G.createStarterPlanetDoc('u',{g:1,s:1,p:7},'npc','NPC','Avamposto',true);
  eq(npc.buildings.metalMine,8,'helper NPC invariato');
  // Simuliamo progressione di un giocatore già registrato.
  const progressed=clone(store.get(key));
  progressed.buildings.metalMine=12;
  progressed.buildings.crystalMine=9;
  progressed.buildings.solarPlant=10;
  await new Ref(key).set(progressed);
  const storedBefore=clone(store.get(key));
  const resumed=await G.joinOnlineUniverse('d07room');
  eq(resumed.planets[0].buildings,progressed.buildings,'accesso di giocatore preesistente');
  eq(store.get(key),storedBefore,'nessuna scrittura o reset del pianeta preesistente');
  eq(store.get(uniRef+'/players/alice').planetCount,1,'progressione giocatore non azzerata');
  const expectedHome=online.match(/homePlanet\.buildings\s*=\s*\{([\s\S]*?)\}\s*;/);
  ok(expectedHome,'reset solo alla creazione del pianeta madre');
  console.log('D07-I01 PASS: '+checks+' controlli puntuali; nuovi/vecchi pianeti, helper colonie/NPC.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
