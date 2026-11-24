'use strict';
// Prove simulate dello stato client: permessi multitab, salvataggi pendenti, no ricariche in game.
const vm = require('vm'), fs=require('fs'),path=require('path'),assert=require('assert');
const {MessageChannel}=require('worker_threads');
const source=fs.readFileSync(path.resolve(__dirname,'../update-client.js'),'utf8');
const listeners={};
const classNames=new Set(['hidden']);
const lobbyClasses=new Set();
const label={textContent:''};
const saved=new Map([['u1',{id:'u1',metal:42000}]]);
let game=null, replaced=[], started=0, saves=0, resolvedSave;
const doc={
 readyState:'complete',
 getElementById(id){
  if(id==='screen-game')return{classList:{contains:x=>classNames.has(x)}};
  if(id==='screen-lobby')return{classList:{toggle:(x,v)=>v?lobbyClasses.add(x):lobbyClasses.delete(x)},setAttribute(){},removeAttribute(){}};
  if(id==='universum-version-label')return label;
  return null;
 },
 addEventListener(){}
};
const ui={state:{currentUniverse:game},toast(){},startGame(){started++;},startOnlineGame(){started++;},persistUniverseState(){saves++;return Promise.resolve(true);}};
let controllerVersion='r11111111111111111111';
const controller={postMessage(message,ports){if(message.type==='UNIVERSUM_GET_VERSION')ports[0].postMessage({ready:true,version:controllerVersion});}};
const sw={
 controller,
 addEventListener(name,fn){listeners[name]=fn;},
 getRegistration:async()=>({waiting:null,active:controller,addEventListener(){},update:async()=>{}})
};
const session=new Map();
const ctx={
 window:{UniversumUI:ui,UniversumDB:{save:()=>{saves++;return new Promise(resolve=>{resolvedSave=resolve;});}},addEventListener(){}},
 navigator:{serviceWorker:sw,onLine:true},
 document:doc,
 MessageChannel,
 URLSearchParams,
 location:{search:'?release=r11111111111111111111',replace:url=>replaced.push(url)},
 sessionStorage:{getItem:k=>session.get(k),setItem:(k,v)=>session.set(k,v)},
 console,Promise,setTimeout:(fn,n)=>{const id=setTimeout(fn,Math.min(n,60));return id;},clearTimeout,
 Date,Set,URL
};
function askSafety(){return new Promise(resolve=>{
 const channel=new MessageChannel();channel.port1.onmessage=e=>{channel.port1.close();resolve(e.data.safe);};
 listeners.message({data:{type:'UNIVERSUM_CAN_UPDATE'},ports:[channel.port2]});
});}
async function step(){await new Promise(resolve=>setTimeout(resolve,12));}
(async()=>{
 vm.runInNewContext(source,ctx,{filename:'update-client.js'});
 await step();
 assert(label.textContent.includes('r11111111111111111111'),'version label dalla release');
 ui.state.currentUniverse={id:'u1'};classNames.delete('hidden');
 assert.strictEqual(await askSafety(),false,'Partita online o offline non aggiornabile');
 assert.strictEqual(replaced.length,0,'Partita non ricaricata');
 ui.state.currentUniverse=null;classNames.add('hidden');
 const write=ctx.window.UniversumDB.save(saved.get('u1'));
 assert.strictEqual(await askSafety(),false,'Scrittura IndexedDB pendente blocca aggiornamento');
 resolvedSave();await write;await step();
 assert.strictEqual(await askSafety(),true,'Lobby e salvataggio completato possono autorizzare');
 assert(lobbyClasses.has('universum-update-lock'),'Lobby congelata durante switch controller');
 ui.startGame({id:'u1'});
 assert.strictEqual(started,0,'Nessuna nuova partita mentre controller cambia');
 await assert.rejects(ctx.window.UniversumDB.save(saved.get('u1')),/Aggiornamento in corso/);
 listeners.message({data:{type:'UNIVERSUM_UPDATE_BLOCKED'}});
 assert(!lobbyClasses.has('universum-update-lock'),'Lock rilasciato dopo diniego da altra scheda');
 ui.startGame({id:'u1'});
 assert.strictEqual(started,1,'Ritorno al normale avvio partita dopo diniego');
 ui.state.currentUniverse={id:'u1'};classNames.delete('hidden');
 controllerVersion='r22222222222222222222';
 listeners.controllerchange();await step();
 assert.strictEqual(replaced.length,0,'Cambio controller non ricarica partita attiva');
 ui.state.currentUniverse=null;classNames.add('hidden');
 listeners.controllerchange();await step();
 assert.strictEqual(replaced.length,1,'Lobby sicura ricaricata una volta');
 listeners.controllerchange();await step();
 assert.strictEqual(replaced.length,1,'Controllerchange duplicato non causa loop');
 assert.strictEqual(saved.get('u1').metal,42000,'Dati IndexedDB simulati conservati');
 console.log('UPDATE CLIENT: 12 controlli di stato, multitab, salvataggi e anti-loop superati (mock).');
})().catch(e=>{console.error('UPDATE CLIENT FALLITO',e);process.exit(1)});
