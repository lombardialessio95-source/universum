// Verifica caricamento moduli in ordine HTML e compatibilità API. Nessuna rete/Firebase reale.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const scripts=[...html.matchAll(/<script\s+src="\.\/([^" ]+\.js)"(?:\s+defer)?\s*><\/script>/g)].map(x=>x[1]);
const seen=new Set();
for(const src of scripts){assert(!seen.has(src),'script doppio: '+src);seen.add(src);assert(fs.existsSync(path.join(root,src)),'script mancante: '+src);}
const mockDocument={addEventListener:()=>{},getElementById:()=>null,querySelectorAll:()=>[],createElement:()=>({getContext:()=>({})})};
const win={document:mockDocument,navigator:{},addEventListener:()=>{},matchMedia:()=>({matches:false,addListener:()=>{}})};
const sandbox={window:win,document:mockDocument,console,Date,Math,JSON,Set,Map,Number,Object,Array,String,Boolean,Promise,URL,
  navigator:win.navigator,localStorage:{getItem:()=>null,setItem:()=>{}},setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{}};
vm.createContext(sandbox);
for(const script of scripts){if(script.startsWith('graphics-')||script==='firebase-config.js')continue;
vm.runInContext(fs.readFileSync(path.join(root,script),'utf8'),sandbox,{filename:script,timeout:1000});}
const requirements={UniversumDB:['create','save','load','renderLobbyList'],UniversumData:['BUILDINGS','RESEARCHES','SHIPS','DEFENSES','getBuildingCost','getResearchCost'],
UniversumEngine:['getPlanetProduction','getResearchTime','processOfflineProgress','tick','startBuilding'],
UniversumGalaxy:['getSystemData','resolveCombat','launchFleet','processFleetsAndBots','tradeWithBot'],
UniversumMP:['registerOrLogin','joinOnlineUniverse','syncPlayerState','launchOnlineFleet','resolveArrivedOnlineFleets','hireOnlineMoonMerchant','maybeLaunchBotRaid'],
UniversumUI:['renderFleet','renderGalaxy','renderDiplomacy','renderBuildings','renderResearch','renderMoon','startGame','startOnlineGame'],
UniversumMoonMerchant:['inspect','applyOffline']};
for(const [api,fields]of Object.entries(requirements)){assert(win[api],api+' non esposto');for(const field of fields)assert(win[api][field],api+'.'+field+' mancante');}
const Data=win.UniversumData;
assert.deepStrictEqual(JSON.parse(JSON.stringify(Data.getBuildingCost('metalMine',1))),{metal:60,crystal:15,deuterium:0});
assert.deepStrictEqual(JSON.parse(JSON.stringify(Data.getResearchCost('energyTech',1))),{metal:0,crystal:800,deuterium:400});
const sample={seed:31337,createdAt:Date.now()-100000,galaxies:3,systemsPerGalaxy:50,botMode:'peaceful',botLevel:2,speed:1,galaxyDeltas:{},
 planets:[{id:'home',name:'Home',coords:{g:1,s:1,p:2},resources:{metal:10000,crystal:10000,deuterium:10000},buildings:{metalMine:5,crystalMine:3,solarPlant:4,deuteriumSynth:2},fleet:{},defenses:{},buildQueue:[],shipyardQueue:[],defenseQueue:[],maxTemp:30}],researches:{energyTech:1,plasmaTech:0}};
const sys=win.UniversumGalaxy.getSystemData(sample,1,1);assert(sys,'sistema non prodotto');
const prod=win.UniversumEngine.getPlanetProduction(sample.planets[0],sample);assert(Number.isFinite(prod.metalPerHour),'produzione errata');
const time=win.UniversumEngine.getResearchTime(sample,'energyTech',2);assert(Number.isFinite(time),'tempo ricerca errato');
const original=JSON.stringify(sample);win.UniversumGalaxy.getSystemData(sample,2,1);assert.strictEqual(JSON.stringify(sample),original,'lettura del sistema non deve cambiare lo stato');
console.log('SMOKE: '+scripts.length+' moduli HTML, '+Object.keys(requirements).length+' API, formule, generazione e produzione verificati.');
