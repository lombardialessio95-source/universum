/** AT05: UI wiring tests using actual modules with small DOM/timer mocks. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function fixture(){
 const nodes=new Map(), listeners=new Map();let interval;const counters={saves:0,sync:0,ticks:0,resolve:0,occupation:0,render:0,lobby:0,update:0,verify:0};
 function node(id){const classes=new Set();const n={id,style:{},dataset:{},children:new Map(),classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k),toggle:(k,v)=>v?classes.add(k):classes.delete(k)},remove(){nodes.delete(n.id)},before(x){nodes.set(x.id,x)},querySelector(k){if(!n.children.has(k))n.children.set(k,node(k));return n.children.get(k)},addEventListener(k,f){n[k]=f}};return n;}
 for(const id of ['game-viewport','screen-game','screen-lobby','universal-modal'])nodes.set(id,node(id));
 const doc={hidden:true,body:node('body'),getElementById:k=>nodes.get(k)||null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>node(''),addEventListener:(k,f,c)=>listeners.set(k+Boolean(c),f)};
 const u={id:'u',planets:[{id:'p',coords:{g:1,s:1,p:1}}],incomingAttacks:[]};let pending=null,initial=false,storageFail=false;
 const G={ordinaryDepartureStatus:()=>{if(storageFail)throw Error('storage');return pending},ordinaryDepartureBusy:()=>!!pending?.busy,ordinaryCheckpointBlocked:()=>!!pending||storageFail,ordinaryDepartureInitialBusy:()=>initial,verifyOrdinaryDeparture:async()=>{counters.verify++;return {status:'committed'}}};
 const W={__UniversumMPModules:G,UniversumDB:{save:async()=>counters.saves++,renderLobbyList:async()=>counters.lobby++},UniversumMP:{syncPlayerState:async()=>{counters.sync++;return true},resolveArrivedOnlineFleets:async()=>counters.resolve++,processOnlineOccupations:async()=>counters.occupation++},UniversumEngine:{tick:()=>{counters.ticks++;return false}},UniversumGalaxy:{processFleetsAndBots:()=>{}},UniversumUpdater:{onSafeLobby:()=>counters.update++},confirm:()=>true};
 const load=p=>new Function('window','document','localStorage','setInterval','clearInterval','setTimeout','clearTimeout',read(p))(W,doc,{getItem:()=>null},f=>{interval=f;return 1},()=>{},()=>1,()=>{});
 load('ui-core.js');load('modules/ui/runtime.js');load('modules/ui/navigation.js');
 const UI=W.UniversumUI;UI.state.currentUniverse=u;UI.state.isMultiplayerMode=true;UI.toast=()=>{};UI.playSound=()=>{};UI.stopChatListeners=()=>{};UI.updateCommBadges=()=>{};UI.renderOverview=()=>counters.render++;UI.refreshOnlineLobbyState=async()=>{};
 return {UI,W,G,u,nodes,listeners,counters,setPending:(v,b=false)=>{pending=v;initial=b},setStorageFail:v=>storageFail=v,tick:()=>interval()};
}
const record={operationId:'new1',protocol:2,armed:true,expectedRevision:2,profileJoinedAt:1};
async function main(){let passed=0;async function test(name,fn){await fn();console.log('PASS '+name);passed++;}
 await test('UI01 pending hides viewport and blocks rendering',async()=>{const f=fixture();f.setPending(record);await f.UI.renderCurrentView();assert(f.nodes.has('at05-ordinary-departure-panel'));assert(f.nodes.get('game-viewport').classList.contains('hidden'));assert.equal(f.counters.render,0);f.setPending(null);await f.UI.renderCurrentView();assert(!f.nodes.has('at05-ordinary-departure-panel'));assert.equal(f.counters.render,1)});
 await test('UI02 pending blocks online persistence and offline remains independent',async()=>{const f=fixture();f.setPending(record);assert.equal(await f.UI.persistUniverseState(),false);assert.equal(f.counters.sync,0);f.UI.state.isMultiplayerMode=false;await f.UI.persistUniverseState();assert.equal(f.counters.saves,1)});
 await test('UI03 inaccessible storage blocks mutation',async()=>{const f=fixture();f.setStorageFail(true);assert(f.UI.blockPendingMutation(f.u));assert.equal(await f.UI.persistUniverseState(),false);assert.equal(f.counters.sync,0)});
 await test('UI04 stale captured state rejected',async()=>{const f=fixture();assert(f.UI.blockPendingMutation({...f.u}));assert(!f.UI.blockPendingMutation(f.u))});
 await test('UI05 busy exit refused; uncertain exit does not save',async()=>{const f=fixture();f.setPending({...record,busy:true});await f.UI.exitActiveGameToLobby();assert.equal(f.UI.state.currentUniverse,f.u);f.setPending(record);await f.UI.exitActiveGameToLobby();assert.equal(f.UI.state.currentUniverse,null);assert.equal(f.counters.sync,0);assert.equal(f.counters.update,0);assert.equal(f.counters.lobby,1)});
 await test('UI06 normal offline exit saves and allows update',async()=>{const f=fixture();f.UI.state.isMultiplayerMode=false;await f.UI.exitActiveGameToLobby();assert.equal(f.counters.saves,1);assert.equal(f.counters.update,1)});
 await test('UI07 pending freezes local tick, keeps server resolution cadence',async()=>{const f=fixture();f.setPending(record);f.UI.startGameLoop();for(let i=0;i<60;i++)await f.tick();assert.equal(f.counters.ticks,0);assert.equal(f.counters.sync,0);assert.equal(f.counters.resolve,20);assert.equal(f.counters.occupation,2)});
 await test('UI08 initial dispatch keeps local tick without extra checkpoint',async()=>{const f=fixture();f.setPending({...record,busy:true},true);f.UI.startGameLoop();await f.tick();assert.equal(f.counters.ticks,1);assert.equal(f.counters.sync,0)});
 await test('UI09 capture guard blocks fresh user actions but not recovery controls',async()=>{const f=fixture();f.setPending(record);f.UI.bindGlobalUIEvents();let n=0;const ev=allow=>({target:{closest:s=>s.includes('data-at05-control')?allow:true},preventDefault:()=>n++,stopImmediatePropagation:()=>n++});f.listeners.get('clicktrue')(ev(false));assert.equal(n,2);f.listeners.get('clicktrue')(ev(true));assert.equal(n,2)});
 await test('UI10 verification control calls original recovery API',async()=>{const f=fixture();f.setPending(record);f.UI.updateOrdinaryDeparturePanel();const panel=f.nodes.get('at05-ordinary-departure-panel');await panel.querySelector('[data-at05-control="verify"]').click();assert.equal(f.counters.verify,1)});
 console.log(`${passed}/${passed} UI scenarios passed`);
}main().catch(e=>{console.error(e);process.exitCode=1});
