'use strict';
// Test di equivalenza matematica. Il riferimento unita'-per-unita' riproduce
// l'algoritmo precedente, indipendentemente dal repository di backup.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const Data = {SHIPS: {fighter:{name:'Caccia'}, cruiser:{name:'Incrociatore'}},DEFENSES:{laser:{name:'Laser'},rocket:{name:'Razzi'}}};
const clock = 1764000000000;
let checks=0;
function ck(v,msg){assert.ok(v,msg);checks++;}
function createEngine(){
  const G = {
    getData:()=>Data,normalizePlanet:()=>{},advanceResearchQueues:()=>false,
    getPlanetProduction:()=>({metalPerSec:0,crystalPerSec:0,deuteriumPerSec:0,caps:{metal:10000,crystal:10000,deuterium:10000}}),
    settleBacinoDue:()=>{},settleBacinoOffline:()=>{},settleInvictusOffline:()=>{},
    checkCrepuscoloLimbo:()=>{},addGalatticaProduction:()=>{},transformCompletedGalattiche:()=>{}
  };
  const win = {__UniversumEngineModules:G,__UniversumEngineConstants:{CREATIVE_RESOURCE_CAP:9999999}};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT,'modules/engine/progress.js'),'utf8'),{window:win,Date,console,Math,Number}, {filename:'progress.js'});
  return G;
}
function reference(planet,now,summary){
  let changed=false;
  for(const [queue,stock,catalog] of [[planet.shipyardQueue,planet.fleet,Data.SHIPS],[planet.defenseQueue,planet.defenses,Data.DEFENSES]]){
    while(queue.length>0){
      const item=queue[0];
      if(now>=item.nextUnitEndTime){
        stock[item.id]=(stock[item.id]||0)+1;
        item.remaining-=1;
        if(summary){const name=catalog[item.id]?.name||item.id;summary.completedUnits[name]=(summary.completedUnits[name]||0)+1;}
        if(item.remaining<=0){queue.shift();changed=true;}
        else item.nextUnitEndTime += item.unitDurationSec*1000;
      }else break;
    }
  }
  return changed;
}
function clone(x){return JSON.parse(JSON.stringify(x));}
const engine=createEngine();
function comparison(label,planet,now){
  const a=clone(planet),b=clone(planet),summaryA={completedUnits:{}},summaryB={completedUnits:{}};
  const old=reference(a,now,summaryA);
  const current=engine.advanceQueuesAtTimestamp({planets:[b],researchModelVersion:1,researches:{}},now,summaryB);
  assert.equal(current,old,`${label}: changed`);checks++;
  assert.deepEqual(b,a,`${label}: queue and stock`);checks++;
  assert.deepEqual(summaryB,summaryA,`${label}: summary`);checks++;
}
const sample=(count,duration=3,start=clock,kind='fighter')=>({
  buildings:{researchLab:12},buildQueue:[],fleet:{},defenses:{},
  resources:{metal:50,crystal:100,deuterium:200},
  shipyardQueue:[{id:kind,remaining:count,total:count,unitDurationSec:duration,nextUnitEndTime:start+duration*1000,endTime:start+duration*count*1000}],
  defenseQueue:[]
});
for(const n of [1,100,1000,10000,100000,1000000]){
  comparison(`${n} completate`,sample(n),clock+n*3000+1);
  comparison(`${n} in corso`,sample(n),clock+3000-1);
  comparison(`${n} meta'`,sample(n),clock+Math.floor(n/2)*3000);
  comparison(`${n} esatte`,sample(n),clock+n*3000);
}
comparison('cambio tipo',{
  ...sample(1),shipyardQueue:[
    {id:'fighter',remaining:100,total:100,unitDurationSec:2,nextUnitEndTime:clock+2000,endTime:clock+200000},
    {id:'cruiser',remaining:100,total:100,unitDurationSec:5,nextUnitEndTime:clock+205000,endTime:clock+700000}
  ]},clock+220000);
comparison('coda difese',{
  ...sample(1),shipyardQueue:[],defenseQueue:[
    {id:'laser',remaining:100,total:100,unitDurationSec:4,nextUnitEndTime:clock+4000,endTime:clock+400000},
    {id:'rocket',remaining:50,total:50,unitDurationSec:7,nextUnitEndTime:clock+407000,endTime:clock+757000}
  ]},clock+520000);
comparison('flotta + difese',{
  ...sample(1000),defenseQueue:[{id:'laser',remaining:2000,total:2000,unitDurationSec:4,nextUnitEndTime:clock+4000,endTime:clock+8000000}]
},clock+9000000);
for(const duration of [0,0.01,0.1,0.33333,1.000001,100]){
  comparison(`durata ${duration}`,sample(100,duration),clock+5000);
}
for(const count of [1,2,10,500]){
  comparison('legacy string count '+count,{...sample(count),shipyardQueue:[{id:'fighter',remaining:String(count),total:count,unitDurationSec:3,nextUnitEndTime:clock+3000}]},clock+200000);
}
// Soglia temporale esatta e precedente; il numero di completamenti non cambia.
for(const n of [1,99,1000]){
  const p=sample(2000,7);
  comparison('soglia -1ms '+n,p,clock+n*7000-1);
  comparison('soglia +0ms '+n,p,clock+n*7000);
  comparison('soglia +1ms '+n,p,clock+n*7000+1);
}
// Ricerca: confronta la funzione di selezione precedente per rete e pianeti diversi.
function createResearch(){
 const G={normalizePlanet:p=>{if(!p.buildings)p.buildings={};},getData:()=>Data};
 const win={__UniversumEngineModules:G,UniversumData:{RESEARCHES:{}}};
 vm.runInNewContext(fs.readFileSync(path.join(ROOT,'modules/engine/research-model.js'),'utf8'),{window:win,Date,Math,Number,Object,Array}, {filename:'research-model.js'});
 return G;
}
const research=createResearch();
function oldLabs(u,t){
 const net=Math.max(0,Math.floor(Number(u.researches?.intergalacticNetwork)||0));
 const finite=v=>Number.isFinite(Number(v))?Number(v):0;
 const busy=(p)=>p.localResearchQueue && finite(p.localResearchQueue.startTime)<=t && (finite(p.localResearchQueue.endTime)<=0||t<finite(p.localResearchQueue.endTime));
 const levels=(u.planets||[]).filter(p=>!busy(p)).map(p=>{
  const up=p.buildQueue?.[0];return Math.max(0,Number(up?.id==='researchLab'&&finite(up.endTime)<=t?up.targetLevel:p.buildings?.researchLab)||0);
 }).filter(n=>n>0).sort((a,b)=>b-a);
 return levels.slice(0,1+net).reduce((a,b)=>a+b,0);
}
for(const size of [0,1,10,50,100]){
 for(const net of [0,1,2,5,20,150]){
  const planets=Array.from({length:size},(_,i)=>({id:String(i),buildings:{researchLab:(i*13)%31},buildQueue:i%8===0?[{id:'researchLab',targetLevel:32,endTime:clock+500}]:[],localResearchQueue:i%7===0?{startTime:clock-999,endTime:clock+5000}:null}));
  const uni={researches:{intergalacticNetwork:net},planets};
  for(const at of [clock-1,clock+500,clock+5000]){
   assert.equal(research.getFreeLabTotal(uni,at),oldLabs(uni,at),`labs ${size}/${net}/${at}`);checks++;
  }
 }
}
// Nessuna animazione stellata: verifica sul documento reale e su tutti i JS attivi.
const app=fs.readFileSync(path.join(ROOT,'app.html'),'utf8');
const db=fs.readFileSync(path.join(ROOT,'db.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'style.css'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'release-manifest.json'),'utf8'));
ck(!app.includes('id="starfield"')&&!app.includes('lobby-starfield.js'),'No canvas or script starfield offline/online');
ck(!db.includes('initStarfield')&&!db.includes('UniversumLobbyStarfield'),'No starfield initializer');
ck(!fs.existsSync(path.join(ROOT,'modules/offline/lobby-starfield.js')),'No animation dead code');
ck(!Object.keys(manifest.files).some(p=>p.includes('starfield')),'No animated assets in SW cache');
ck(css.includes('body.lobby-black { background: #000000; }'),'Black lobby background');
const canvas=fs.readFileSync(path.join(ROOT,'modules/ui/planet-canvas.js'),'utf8');
ck(canvas.includes('UI.stopPlanetCanvas')&&canvas.includes("removeEventListener('visibilitychange'"),'Planet RAF handler lifecycle');
const runtime=fs.readFileSync(path.join(ROOT,'modules/ui/runtime.js'),'utf8');
ck(runtime.includes('pendingCompletionRender'),'Hidden DOM rendering deferred without tick change');
console.log(`CPU OPTIMIZATIONS: ${checks} verifiche di parita' code, 50/100 pianeti, cleanup RAF e cache completate.`);
