'use strict';
// Benchmark CPU isolato (Node.js, NON profiling del browser). Esempio:
// node tests/bench_cpu.js /percorso/alla/precedente/versione
const fs=require('fs'),path=require('path'),vm=require('vm');
const {performance}=require('perf_hooks');
const current=path.resolve(__dirname,'..');
const original=process.argv[2]?path.resolve(process.argv[2]):null;
const clock=1764000000000;
function load(root){
 const G={getData:()=>({SHIPS:{fighter:{name:'Caccia'}},DEFENSES:{laser:{name:'Laser'}}}),normalizePlanet:p=>{},advanceResearchQueues:()=>false,
 getPlanetProduction:()=>({metalPerSec:0.1,crystalPerSec:0.2,deuteriumPerSec:0,caps:{metal:1000000,crystal:1000000,deuterium:1000000},fusionFuelPerHour:0,deuteriumPerHour:0}),
 settleBacinoDue:()=>{},settleBacinoOffline:()=>{},settleInvictusOffline:()=>{},checkCrepuscoloLimbo:()=>{},addGalatticaProduction:()=>{},transformCompletedGalattiche:()=>{},
 };
 const win={__UniversumEngineModules:G,__UniversumEngineConstants:{CREATIVE_RESOURCE_CAP:99999999},UniversumData:{RESEARCHES:{}}};
 const context={window:win,Date,Math,Number,Array,Object,Set,console};
 for(const module of ['modules/engine/progress.js','modules/engine/research-model.js']) vm.runInNewContext(fs.readFileSync(path.join(root,module),'utf8'),context,{filename:module});
 return G;
}
function planet(i=0){return {id:String(i),buildings:{researchLab:(i*13)%30},resources:{metal:1000,crystal:1000,deuterium:0},fleet:{},defenses:{},
 buildQueue:[],shipyardQueue:[],defenseQueue:[],localResearchQueue:i%9===0?{startTime:clock-2000,endTime:clock+200000}:null};}
function bench(f,reps=5){
 const times=[];for(let j=0;j<reps;j++){
  const start=performance.now();f();times.push(performance.now()-start);
 }
 return times.sort((a,b)=>a-b)[Math.floor(times.length/2)];
}
function format(ms){return Number(ms.toFixed(4));}
function cases(G){
 const data=[];
 for(const count of [100000,1000000]){
  const now=clock+(count+5)*3000;
  const runtime=()=>{const p=planet();p.shipyardQueue=[{id:'fighter',remaining:count,total:count,unitDurationSec:3,nextUnitEndTime:clock+3000}];
   G.advanceQueuesAtTimestamp({planets:[p],researches:{},researchModelVersion:1},now);};
  runtime();
  data.push({case:`Coda ${count} unita`,millis:format(bench(runtime,5))});
 }
 for(const size of [50,100]){
  const u={planets:Array.from({length:size},(_,i)=>planet(i)),researches:{intergalacticNetwork:2},researchModelVersion:1,speed:10};
  const f=()=>{let n=0;for(let i=0;i<5000;i++)n+=G.getFreeLabTotal(u,clock+100);if(n<0)throw Error();};
  f();data.push({case:`5000 calcoli Rete ${size} pianeti`,millis:format(bench(f,7))});
  const tick=()=>{for(let i=0;i<50;i++)G.tick(u,1);};
  tick();data.push({case:`50 tick inattivi ${size} pianeti`,millis:format(bench(tick,7))});
 }
 return data;
}
const cur=cases(load(current));
const old=original?cases(load(original)):null;
for(let i=0;i<cur.length;i++)console.log(JSON.stringify({scenario:cur[i].case,baseline_ms:old?.[i].millis??null,optimized_ms:cur[i].millis}));
