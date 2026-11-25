'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const root = path.resolve(__dirname, '../..');
let clock = 1_800_000_000_000;
class TestDate extends Date { static now() { return clock; } }
const doc={addEventListener(){},getElementById(){return null},querySelectorAll(){return []},createElement(){return {getContext(){return {}}}}};
const win={document:doc,navigator:{},addEventListener(){},matchMedia(){return {matches:false,addListener(){}}}};
const sb={window:win,document:doc,console,Date:TestDate,Math,JSON,Set,Map,Number,Object,Array,String,Boolean,Promise,URL,
 navigator:win.navigator,localStorage:{getItem(){return null},setItem(){}},setTimeout(){return 0},clearTimeout(){},setInterval(){return 0},clearInterval(){}};
vm.createContext(sb);
const html=fs.readFileSync(path.join(root,'app.html'),'utf8');
const paths=[...html.matchAll(/<script\s+src="\.\/([^" ]+\.js)"(?:\s+defer)?\s*><\/script>/g)].map(x=>x[1]);
for(const p of paths) if(!p.startsWith('graphics-') && p!=='firebase-config.js') vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),sb,{filename:p,timeout:1000});
const E=win.UniversumEngine,D=win.UniversumData,G=win.UniversumGalaxy;
const plain=x=>JSON.parse(JSON.stringify(x));
const passed=[];
function test(name,fn){fn();passed.push(name);console.log('OK',name)}
function planet(id,lab=15){return {id,name:id,coords:{g:1,s:id==='A'?1:2,p:2},resources:{metal:1e11,crystal:1e11,deuterium:1e11},
 buildings:{researchLab:lab,roboticsFactory:12,shipyard:12,solarPlant:50},fleet:{},defenses:{},buildQueue:[],shipyardQueue:[],defenseQueue:[],
 localResearches:{},localResearchQueue:null,moon:null,bacinoSpaziale:null};}
function uni(n=3){return {id:'unit',speed:1,createdAt:clock,seed:1,planets:[planet('A',15),planet('B',12),planet('C',10)].slice(0,n),
 researches:{hyperspaceTech:8,intergalacticNetwork:2,energyTech:20,laserTech:10,ionTech:5,quantumPhysics:0},researchModelVersion:1,researchQueue:null,
 galattiche:[],galaxyDeltas:{},fleetsInFlight:[],messages:[],lastSeen:clock};}
module.exports={E,D,G,win,doc,sb,plain,planet,uni,test,passed,assert,fs,path,root,now:()=>clock,setTime(t){clock=t;}};
