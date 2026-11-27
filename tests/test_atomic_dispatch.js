/** AT05-I02: regressione mirata, Firestore simulato. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
async function runTests(fleetSource,syncSource,universesSource,galatticheSource) {
  const results=[];
  const cp=x=>JSON.parse(JSON.stringify(x));
  const eq=(x,y,label)=>{if(JSON.stringify(x)!==JSON.stringify(y))throw Error(label+": "+JSON.stringify(x)+" != "+JSON.stringify(y))};
  const ok=(x,label)=>{if(!x)throw Error(label)};
  const origin="1_1_1", own="1_1_2", enemy="1_1_3", empty="1_1_4";
  function fixture({versioned=true,queue=false,initial=10,uid="me",uniId="u",storageMap=new Map(),sharedStore=null,counter={next:0},recovery=false}={}) {
    const storageMode={};
    const localStorage={getItem:k=>{if(storageMode.failGet)throw Error("storage read denied");return storageMap.get(k)??null},
      setItem:(k,v)=>{if(storageMode.failSet)throw Error("storage quota");if(!storageMode.dropWrite)storageMap.set(k,String(v))},
      removeItem:k=>{if(storageMode.failRemove)throw Error("storage remove denied");storageMap.delete(k)}};
    const auth={uid};
    const mk=(key,id)=>({id,name:key,coords:{g:1,s:1,p:Number(key.slice(-1))},ownerUid:uid,
      fleet:{lightFighter:initial,hephaestusForge:1,invictus:0,crepuscolo:0,mothership:1,deathStar:1,colonyShip:1,espionageProbe:1},
      resources:{metal:1000,crystal:1000,deuterium:100000},buildings:{},defenses:{},
      shipyardQueue:queue?[{id:"prometheusOracle",remaining:1}]:[],
      mothershipHangars:[{id:"hangar1",fighters:0}],
      bacinoSpaziale:{status:"active",startedAt:1,invictusActive:1,crepuscolo:{status:"active"}}});
    const p=mk(origin,"p1"), p2=mk(own,"p2"); p2.fleet.hephaestusForge=0;p2.shipyardQueue=[];
    const u={id:uniId,emperor:"test",planets:[p,p2],fleetsInFlight:[],researches:{},...(versioned?{serviceRevision:2}:{})};
    const root="online_universes/"+uniId, planets=root+"/planets/", fleets=root+"/fleets/", player=root+"/players/"+uid;
    const store=sharedStore || new Map([[root,{name:"test"}],[planets+origin,cp(p)],[planets+own,cp(p2)],[planets+enemy,{ownerUid:"enemy"}],[player,{joinedAt:1,...(versioned?{serviceRevision:2}:{}),specialistFlights:["existing"]}],[fleets+"existing",{resolved:false,ships:{prometheusOracle:1}}]]);
    const mode={fail:null,retry:false,attempts:0,commits:0,settles:0,reads:[],writes:[],calls:0};
    function snap(path){const data=store.has(path)?cp(store.get(path)):undefined;return {id:path.split("/").pop(),ref:ref(path),exists:data!==undefined,data:()=>data===undefined?undefined:cp(data),metadata:{fromCache:mode.cache===path,hasPendingWrites:mode.pendingWrite===path}}}
    function ref(path){return {path,id:path.split("/").pop(),collection:n=>col(path+"/"+n),
      get:async opts=>{if(opts?.source==='server' && mode.readFail)throw Error('server unavailable');return snap(path)},update:async d=>store.set(path,{...store.get(path),...cp(d)})}}
    function col(path,filters=[],max=null){return {doc:id=>ref(path+"/"+(id??("new"+(++counter.next)))),
      where:(k,op,v)=>{eq(op,'==','query operator');return col(path,[...filters,[k,v]],max)},orderBy:()=>col(path,filters,max),limit:n=>col(path,filters,n),
      get:async opts=>{eq(opts?.source,'server','recovery reads server');if(mode.readFail)throw Error('server unavailable');let docs=[...store.keys()].filter(k=>k.startsWith(path+'/')&&!k.slice(path.length+1).includes('/')&&filters.every(([field,v])=>store.get(k)[field]===v)).map(snap);if(max!==null)docs=docs.slice(0,max);return {docs,metadata:{fromCache:mode.cache===path,hasPendingWrites:mode.pendingWrite===path}};},
      add:async d=>{mode.calls++;throw Error("La candidata non deve usare add")}}}
    const db={collection:n=>col(n),runTransaction:async cb=>{
      const count=mode.retry?2:1;
      for(let i=0;i<count;i++){
        mode.attempts++;
        const staged=[],readVersions=new Map();
        const tx={get:async r=>{mode.reads.push(r.path);const s=snap(r.path);readVersions.set(r.path,JSON.stringify(s.data()));return s;},
          set:(r,d,opt)=>{if(mode.fail==="create"&&r.path.startsWith(fleets))throw Error("create rejected");staged.push([r.path,cp(d),!!opt?.merge])},
          update:(r,d)=>staged.push([r.path,cp(d),true])};
        await mode.beforeCallback?.();
        const result=await cb(tx);
        await mode.afterCallback?.();
        if(mode.fail==="commit")throw Error("commit rejected");
        if(i+1<count)continue;
        for(const [key,data] of readVersions)if(JSON.stringify(store.get(key))!==data)throw Object.assign(Error('mock transaction conflict'),{code:'aborted'});
        if(!staged.length){mode.readTransactions=(mode.readTransactions || 0)+1;return result;}
        for(const [path,d,merge] of staged){store.set(path,merge?{...store.get(path),...d}:d);mode.writes.push(path)}
        mode.commits++;
        await mode.afterCommit?.();
        if(mode.fail==="lostAck")throw Error("commit acknowledged by server but response lost");
        return result;
      }
    }};
    const ids=["hephaestusForge","prometheusOracle"];
    const G={getAuth:()=>({currentUser:{uid:auth.uid,displayName:"test"}}),getDB:()=>db,coordsToKey:c=>`${c.g}_${c.s}_${c.p}`, _tsToMs:()=>0,
      galatticaMarkers:()=>({doc:()=>({get:async()=>({exists:true,id:"gal1",data:()=>({ownerUid:"enemy"})})})}),atGalatticaTarget:()=>true};
    const ships=Object.fromEntries(["lightFighter","hephaestusForge","prometheusOracle","invictus","crepuscolo","mothership","deathStar","colonyShip","espionageProbe"].map(id=>[id,{cargo:100000,cost:{metal:3000,crystal:1000,deuterium:0}}]));
    const W={localStorage,__UniversumMPModules:G,__UniversumMPVariables:{SYNC_MIN_INTERVAL_MS:0,_INBOX_RES_KEYS:["metal","crystal","deuterium"],_syncLastByUni:new Map(),_systemCache:new Map(),_systemPending:new Map(),FLEET_SCHEMA_VERSION:1,_mpErrorToastAt:new Map()},
      UniversumData:{SHIPS:ships},UniversumGalaxy:{calculateDistance:()=>1,getFleetSpeedAndFuel:()=>({fuelCost:40,durationSec:60}),getInvictusJumpCost:()=>5},
      UniversumMissionsCore:{getMaxFleetSlots:()=>100,getMaxExploreHours:()=>4,getExplorationHoldDurationSec:(u,h)=>h*3600,buildExplorationTimeline:(now,d,h)=>({departureTime:now,zoneArrivalTime:now+d*1000,explorationEndTime:now+(d+h)*1000,arrivalTime:now+(d+h)*1000,returnTime:now+(2*d+h)*1000,travelDurationMs:d*1000,explorationHoldMs:h*1000,returnTravelDurationMs:d*1000})},
      UniversumServices:{ids,forge:ids[0],oracle:ids[1],transfer:(u,m,t,ships)=>ids.some(id=>ships[id]),settlePlanet:()=>{mode.settles++}},
      UniversumHangars:{select:p=>cp(p.mothershipHangars),take:(p,hs)=>{p.mothershipHangars=p.mothershipHangars.filter(h=>!hs.some(x=>x.id===h.id))},normalizePlanet:()=>{},validateMission:()=>{},verifyManifest:x=>x}};
    const firebase={firestore:{FieldValue:{serverTimestamp:()=>null,delete:()=>null}}};
    new Function("window","firebase",syncSource)(W,firebase);
    new Function("window","firebase",fleetSource)(W,firebase);
    if(recovery){
      new Function("window","firebase",universesSource)(W,firebase);
      new Function("window","firebase",galatticheSource)(W,firebase);
      W.UniversumUI={state:{currentUniverse:u,isMultiplayerMode:true},startOnlineGame(fresh){if(mode.installFail==='throw')throw Error('install failed');if(mode.installFail==='skip')return;this.state.currentUniverse=fresh;this.state.isMultiplayerMode=true;if(mode.installFail==='partial')throw Error('partial install');},toast(){}};
    }
    const launch=(target=enemy,mission="attack",ships={lightFighter:3},cargo={metal:100,crystal:50,deuterium:20},options={})=>G.launchOnlineFleet(u,0,{g:1,s:1,p:Number(target.slice(-1))},mission,ships,cargo,options);
    const state=()=>({local:cp(p),remote:cp(store.get(planets+origin)),flights:u.fleetsInFlight.length,created:[...store.keys()].filter(k=>k.startsWith(fleets+"new")).length,player:cp(store.get(player))});
    return {G,u,p,mode,store,state,launch,planets,player,fleets,W,storageMap,storageMode,auth,counter,root};
  }
  async function rejected(f,label){let error;try{await f()}catch(e){error=e}ok(error,label+" expected rejection");return error}
  async function test(name,fn){try{await fn();results.push({name,pass:true})}catch(e){results.push({name,pass:false,error:String(e)})}}
  const debit={metal:900,crystal:950,deuterium:99940};
  await test("T01/T11 attack succeeds, atomic planet+fleet+player",async()=>{const f=fixture();const d=await f.launch();const s=f.state();eq(s.local.fleet.lightFighter,7,"local ships");eq(s.remote.fleet.lightFighter,7,"remote ships");eq(s.local.resources,debit,"local resources");eq(s.remote.resources,debit,"remote resources");eq([s.created,s.flights,f.mode.commits,f.mode.calls],[1,1,1,0],"one commit");ok(f.mode.writes.includes(f.fleets+d.id),"fleet in tx");ok(f.mode.writes.includes(f.planets+origin),"planet in tx");ok(f.mode.writes.includes(f.player),"player in tx");eq(d.defenderUid,"enemy","enemy destination");eq(s.player.specialistFlights,["existing"],"specialist registry");eq(f.mode.settles,0,"no new specialist upkeep");eq(s.player.points,f.G.computePlayerPoints(f.u),"points after debit");});
  await test("T02/T04/T05/T06 create fails, no losses",async()=>{const f=fixture();const before=f.state();f.mode.fail="create";await rejected(()=>f.launch(),"create");eq(f.state(),before,"full conservation");eq(f.mode.commits,0,"no commit");});
  await test("T03/T04/T05/T06 transaction fails, no losses",async()=>{const f=fixture();const before=f.state();f.mode.fail="commit";await rejected(()=>f.launch(),"commit");eq(f.state(),before,"full conservation");eq(f.mode.commits,0,"no commit");});
  await test("T07 new attempt after rejection",async()=>{const f=fixture();f.mode.fail="create";await rejected(()=>f.launch(),"create");f.mode.fail=null;await f.launch();const s=f.state();eq([s.local.fleet.lightFighter,s.remote.fleet.lightFighter,s.created,s.flights],[7,7,1,1],"one debit");eq(s.local.resources,debit,"one cargo and fuel");});
  await test("T08 transaction callback retry",async()=>{const f=fixture();f.mode.retry=true;await f.launch();const s=f.state();eq([s.local.fleet.lightFighter,s.remote.fleet.lightFighter,s.created,s.flights,f.mode.attempts,f.mode.commits],[7,7,1,1,2,1],"one commit despite two attempts");eq(s.local.resources,debit,"one debit");});
  await test("T12 empty destination and colony ship",async()=>{const f=fixture();const d=await f.launch(empty,"colonize",{colonyShip:1},{});eq(d.defenderUid,null,"empty");eq(f.state().remote.fleet.colonyShip,0,"colonizer debited");});
  await test("T12/T19 expedition timeline and black hole cost",async()=>{const f=fixture();const d=await f.launch(empty,"explore",{lightFighter:1},{deuterium:20},{blackHole:true,exploreHours:2});eq(d.mission,"expedition","mission");eq(d.explorationEndTime-d.zoneArrivalTime,7200000,"hold");eq(d.returnTime-d.explorationEndTime,60000,"return");eq(f.state().remote.resources.deuterium,49940,"fuel+black hole+carried");});
  await test("T13 specialist destination and registry",async()=>{const f=fixture();const d=await f.launch(own,"deploy",{hephaestusForge:1},{});eq(f.state().remote.fleet.hephaestusForge,0,"specialist debit");eq(f.state().player.specialistFlights,["existing",d.id],"specialist registry");ok(f.mode.settles>0,"settlement retained");ok(f.mode.reads.includes(f.fleets+"existing"),"capacity check retained");});
  await test("T13 specialist rejected on enemy",async()=>{const f=fixture();const before=f.state();await rejected(()=>f.launch(enemy,"transport",{hephaestusForge:1},{}),"specialist");eq(f.state(),before,"no write");});
  await test("T14 Invictus and Crepuscolo",async()=>{const f=fixture();const d=await f.launch(enemy,"attack",{invictus:1,crepuscolo:1},{});eq(d.originPlanetId,"p1","birth origin");eq(f.state().local.bacinoSpaziale.invictusActive,0,"invictus");eq(f.state().remote.bacinoSpaziale.crepuscolo.status,"inMission","crepuscolo");eq(f.state().remote.resources.deuterium,99955,"invictus fuel");eq(f.state().player.specialistFlights,["existing"],"registry unchanged");});
  await test("T15 mother ship hangar and incursion",async()=>{const f=fixture();const d=await f.launch(enemy,"incursion",{mothership:1},{});eq(d.carrierHangars,[{id:"hangar1",fighters:0}],"manifest");eq(f.state().local.fleet.mothership,0,"carrier");eq(f.state().remote.mothershipHangars,[],"hangar moved");eq(f.state().player.specialistFlights,["existing"],"registry unchanged");});
  await test("T16 targeted Galattica attack",async()=>{const f=fixture();const d=await f.launch(enemy,"destroyGalattica",{deathStar:1},{},{targetGalatticaId:"gal1"});eq(d.targetGalatticaId,"gal1","target");eq(d.mission,"destroyMoon","normalized mission");eq(f.state().remote.fleet.deathStar,0,"death star");eq(f.state().player.specialistFlights,["existing"],"registry unchanged");});
  await test("T17 ordinary dispatch does not activate capacity by itself",async()=>{const f=fixture();await f.launch();ok(!f.mode.reads.includes(f.fleets+"existing"),"no specialist flight read");eq(f.state().player.specialistFlights,["existing"],"registry preserved");});
  await test("T17 ordinary dispatch preserves capacity triggered by queue",async()=>{const f=fixture({queue:true});await f.launch();ok(f.mode.reads.includes(f.fleets+"existing"),"queue-triggered capacity");eq(f.state().player.specialistFlights,["existing"],"no ordinary flight in registry");});
  await test("T19 unversioned checkpoint path",async()=>{const f=fixture({versioned:false});await f.launch();eq(f.state().remote.resources,debit,"legacy debit");eq(f.state().created,1,"legacy fleet");});
  await test("T01 missing checkpoint confirmation",async()=>{const f=fixture();f.G.syncPlayerState=async()=>undefined;const before=f.state();await rejected(()=>f.launch(),"not confirmed");eq(f.state(),before,"no local flight");});
  await test("T10 partial: stale revision rejected after another commit",async()=>{const f=fixture();const stale=cp(f.u);await f.launch();const before=f.state();await rejected(()=>f.G.launchOnlineFleet(stale,0,{g:1,s:1,p:3},"attack",{lightFighter:3},{}),"stale revision");eq(f.state(),before,"no second commit");});
  await test("T09 diagnostic: ambiguous acknowledgment leaves local stale",async()=>{const f=fixture();f.mode.fail="lostAck";await rejected(()=>f.launch(),"lost ack");const s=f.state();eq([s.created,s.flights,s.local.fleet.lightFighter,s.remote.fleet.lightFighter],[1,0,10,7],"ambiguity reproduced");});
  // AT05-I03-I01: persistenza locale e blocco; nessun recupero automatico.
  const pending=f=>f.G.ordinaryDepartureStatus(f.u);
  const gate=()=>{let open;const wait=new Promise(r=>open=r);return {open,wait}};
  const until=async condition=>{for(let i=0;i<200;i++){if(condition())return;await Promise.resolve()}throw Error("condizione non raggiunta")};
  await test("I01-01 original dispatch persists ID before transaction, then clears on known success",async()=>{
    const f=fixture();f.mode.beforeCallback=()=>{const p=pending(f);eq(p.operationId,"new1","original ID before tx");eq(p.expectedRevision,2,"revision");eq(f.storageMap.size,1,"durable");ok(f.G.ordinaryCheckpointBlocked(f.u,{ordinary:true,ref:{id:"new1"}}),"forged dispatch blocked")};
    const d=await f.launch();eq(d.id,"new1","same ID");eq(pending(f),null,"known success cleared");eq(JSON.parse([...f.storageMap.values()][0]).status,"settled","durable terminal");eq(f.mode.commits,1,"initial permitted");
    f.mode.beforeCallback=null;
    eq(await f.G.syncPlayerState(f.u,{force:true}),true,"normal sync resumes");
  });
  await test("I01-02 lost ack retained, original ID, no retries or stale saves",async()=>{
    const f=fixture();f.mode.fail="lostAck";const err=await rejected(()=>f.launch(),"lost ack");eq(err.code,"ordinary-departure-pending","typed error");
    const p=pending(f),before=f.state();eq(p.operationId,"new1","retained ID");eq(f.storageMap.size,1,"persisted");f.mode.fail=null;
    await rejected(()=>f.launch(),"no repeat");await rejected(()=>f.launch(own,"deploy",{hephaestusForge:1},{}),"special launch blocked");
    eq(await f.G.syncPlayerState(f.u,{force:true}),false,"forced sync blocked");eq(await f.G.syncPlayerState(cp(f.u),{force:false}),false,"other object blocked");
    eq(f.state(),before,"no changes");eq(f.mode.commits,1,"no duplicate");eq(pending(f),p,"same record");
  });
  await test("I01-03 page reload retains exact request; no dispatch authorization survives",async()=>{
    const f=fixture({versioned:false});f.mode.fail="lostAck";await rejected(()=>f.launch(),"lost ack");const saved=pending(f);eq(saved.expectedRevision,null,"legacy");
    const fresh=fixture({storageMap:f.storageMap,versioned:false});eq(pending(fresh),saved,"same durable ID after reload");
    await rejected(()=>fresh.launch(),"reload launch");eq(await fresh.G.syncPlayerState(fresh.u,{force:true}),false,"reload sync");eq(fresh.mode.commits,0,"no new commit");
  });
  await test("I01-04 pending isolated by account and universe",async()=>{
    const f=fixture();f.mode.fail="lostAck";await rejected(()=>f.launch(),"lost ack");const saved=pending(f);
    const other=fixture({uid:"other",storageMap:f.storageMap});eq(pending(other),null,"other account");await other.launch();eq(other.mode.commits,1,"other account dispatch");
    const universe=fixture({uniId:"other-universe",storageMap:f.storageMap});eq(pending(universe),null,"other universe");await universe.launch();eq(universe.mode.commits,1,"other universe dispatch");
    eq(pending(f),saved,"original unaffected");eq(f.storageMap.size,3,"one marker per account and universe");
  });
  await test("I01-05 storage unavailable before dispatch fails closed",async()=>{
    for(const mode of ["failGet","failSet","dropWrite"]){const f=fixture();f.storageMode[mode]=true;const before=f.state();
      const e=await rejected(()=>f.launch(),mode);eq(e.code,"ordinary-departure-storage",mode);eq(f.state(),before,"no debit");eq(f.mode.commits,0,"no tx commit");eq(f.mode.attempts,0,"no tx start");}
  });
  await test("I01-06 storage corrupt or unreadable blocks checkpoints",async()=>{
    const f=fixture();f.storageMode.failGet=true;eq(await f.G.syncPlayerState(f.u,{force:true}),false,"storage unavailable");
    f.storageMode.failGet=false;f.storageMap.set('universum:ordinary-departure:v1:'+JSON.stringify(["me","u"]),"{bad");
    eq(await f.G.syncPlayerState(f.u,{force:true}),false,"invalid record");await rejected(()=>f.launch(),"corrupt record");eq(f.mode.commits,0,"no writes");
  });
  await test("I01-07 failure persisting terminal marker after confirmed commit remains blocked",async()=>{
    const f=fixture();f.mode.afterCommit=()=>{f.storageMode.failSet=true};await rejected(()=>f.launch(),"terminal marker");eq(f.mode.commits,1,"commit known");eq(pending(f).operationId,"new1","retained");
    f.storageMode.failSet=false;await rejected(()=>f.launch(),"still blocked");eq(await f.G.syncPlayerState(f.u,{force:true}),false,"still blocked sync");eq(f.mode.commits,1,"no duplicate");
  });
  await test("I01-08 prequeued checkpoint blocked at execution",async()=>{
    const f=fixture(),hold=gate(),entered=gate();f.mode.beforeCallback=async()=>{if(f.mode.attempts===1){entered.open();await hold.wait}};
    const first=f.G.syncPlayerState(f.u,{force:true}).catch(e=>e);await entered.wait;
    const queued=f.G.syncPlayerState(f.u,{force:true});const launch=f.launch().catch(e=>e);await until(()=>f.storageMap.size===1);
    f.mode.fail="lostAck";hold.open();const a=await first;eq(a.code,"ordinary-departure-pending","inflight pre-callback blocked");eq(await queued,false,"queued blocked");
    eq((await launch).code,"ordinary-departure-pending","dispatch lost ack");eq(f.mode.attempts,2,"queued did not start tx");eq(f.mode.commits,1,"only original dispatch committed");
  });
  await test("I01-09 already submitted checkpoint precedes dispatch; actual revision persisted",async()=>{
    const f=fixture(),hold=gate(),entered=gate();f.mode.afterCallback=async()=>{if(f.mode.attempts===1){entered.open();await hold.wait}};
    const first=f.G.syncPlayerState(f.u,{force:true});await entered.wait;
    const launch=f.launch();await until(()=>f.storageMap.size===1);eq(pending(f).expectedRevision,2,"reservation revision");
    f.mode.beforeCallback=()=>{if(f.mode.attempts===2)eq(pending(f).expectedRevision,3,"actual dispatch revision")};
    hold.open();eq(await first,true,"prior checkpoint");await launch;eq(f.mode.commits,2,"two authorized commits");eq(pending(f),null,"clear success");
  });
  await test("I01-10 retry internal callback preserves original request",async()=>{
    const f=fixture();f.mode.retry=true;const observed=[];f.mode.beforeCallback=()=>observed.push(pending(f).operationId);await f.launch();eq(observed,["new1","new1"],"stable ID");eq(f.mode.commits,1,"single debit");
  });
  await test("I01-11 unknown commit failure remains pending even with missing fleet",async()=>{
    const f=fixture();f.mode.fail="commit";await rejected(()=>f.launch(),"uncertain");eq(f.state().created,0,"no doc in mock");eq(pending(f).operationId,"new1","no negative inference");
    f.mode.fail=null;await rejected(()=>f.launch(),"no retry");eq(f.mode.commits,0,"no commits");
  });
  await test("I01-12 definitive failure before commit permits new attempt",async()=>{
    const f=fixture();f.mode.fail="create";await rejected(()=>f.launch(),"known precommit");eq(pending(f),null,"definite failure");f.mode.fail=null;await f.launch();eq(f.mode.commits,1,"new attempt");
  });
  await test("I01-13 undefined confirmation remains pending",async()=>{
    const f=fixture();f.G.syncPlayerState=async()=>undefined;await rejected(()=>f.launch(),"no confirmation");eq(pending(f).operationId,"new1","retained");
  });
  await test("I01-14 authorization revoked after uncertain dispatch",async()=>{
    const f=fixture(),original=f.G.syncPlayerState;let options;
    f.G.syncPlayerState=(u,o)=>{options=o;return original(u,o)};f.mode.fail="lostAck";await rejected(()=>f.launch(),"lost");
    f.mode.fail=null;await rejected(()=>original(f.u,options),"same dispatch no longer authorized");eq(f.mode.commits,1,"no re-dispatch");
  });
  // I05: terminal receipts and actual E recovery path.
  const uncertain=async (mode='lostAck',versioned=true)=>{const f=fixture({recovery:true,versioned});f.mode.fail=mode;await rejected(()=>f.launch(),mode);f.mode.fail=null;return f;};
  const installed=f=>f.W.UniversumUI.state.currentUniverse;
  const verify=(f,options={})=>f.G.verifyOrdinaryDeparture(installed(f),options);
  const receipt=f=>f.store.get(f.player).ordinaryDispatchReceipt;
  await test("I05-01 commit receipt atomic; normal checkpoint acknowledges and preserves",async()=>{
    const f=fixture({recovery:true});const d=await f.launch();eq(receipt(f).operationId,d.id,"receipt ID");eq(receipt(f).status,"committed","terminal");eq(receipt(f).terminalRevision,3,"terminal revision");eq(receipt(f).acknowledged,false,"initial receipt protected");eq(f.mode.commits,1,"one dispatch commit");await f.G.syncPlayerState(f.u,{force:true});eq(receipt(f).acknowledged,true,"later checkpoint acknowledgement");eq(receipt(f).operationId,d.id,"preserved receipt");
  });
  await test("I05-02 lost ack, actual E recovers once, no new debit",async()=>{
    const f=await uncertain();const id=pending(f).operationId,old=f.u;eq(receipt(f).operationId,id,"same ID");const result=await verify(f);eq(result,{status:"committed",operationId:id},"verified result");eq(installed(f).planets[0].fleet.lightFighter,7,"authoritative stock");eq(installed(f).planets[0].resources,debit,"authoritative resources");eq(installed(f).fleetsInFlight.length,1,"mission recovered");eq(pending(f),null,"pending cleared");eq(await f.G.syncPlayerState(old,{force:true}),false,"retired state blocked");eq(f.mode.commits,1,"no repeated commit");eq(await f.G.syncPlayerState(installed(f),{force:true}),true,"fresh checkpoint resumes");eq(receipt(f).acknowledged,true,"receipt acknowledged");
  });
  await test("I05-03 completed and deleted fleet still provable after full reload",async()=>{
    const f=await uncertain();const id=pending(f).operationId;f.store.delete(f.fleets+id);
    const reload=fixture({recovery:true,storageMap:f.storageMap,sharedStore:f.store,counter:f.counter});const result=await verify(reload);eq(result.operationId,id,"persisted ID");eq(result.status,"committed","receipt proof");eq(installed(reload).fleetsInFlight.length,0,"no resurrected mission");eq(installed(reload).planets[0].fleet.lightFighter,7,"no second debit");eq(reload.mode.commits,0,"read-only recovery");
  });
  await test("I05-04 absent fleet and receipt do not unlock",async()=>{const f=await uncertain("commit");await rejected(()=>verify(f),"no positive proof");eq(pending(f).operationId,"new1","still pending");eq(f.mode.commits,0,"no cancellation without explicit action");});
  await test("I05-05 explicit fenced cancellation yields terminal negative without debit",async()=>{const f=await uncertain("commit");const before=cp(f.store.get(f.planets+origin));const result=await verify(f,{cancel:true});eq(result.status,"cancelled","negative terminal");eq(receipt(f).status,"cancelled","receipt");eq(receipt(f).terminalRevision,3,"barrier");eq(f.store.get(f.planets+origin),before,"stock unchanged");eq(f.state().created,0,"no mission");eq(installed(f).serviceRevision,3,"fresh revision");eq(pending(f),null,"safe release");});
  await test("I05-06 cancellation lost ack: retain request, later verify terminal",async()=>{const f=await uncertain("commit");f.mode.fail="lostAck";await rejected(()=>verify(f,{cancel:true}),"lost cancellation ack");eq(receipt(f).status,"cancelled","barrier committed");eq(pending(f).operationId,"new1","retained");f.mode.fail=null;eq((await verify(f)).status,"cancelled","terminal recovered");eq(f.mode.commits,1,"no duplicate barrier");});
  await test("I05-07 changed revision not evidence of cancellation",async()=>{const f=await uncertain("commit");f.store.get(f.player).serviceRevision++;await rejected(()=>verify(f,{cancel:true}),"revision changed");eq(pending(f).operationId,"new1","still pending");eq(receipt(f),undefined,"no fabricated negative");});
  await test("I05-08 replaced profile does not permit cancellation",async()=>{const f=await uncertain("commit");f.store.get(f.player).joinedAt=2;await rejected(()=>verify(f,{cancel:true}),"profile recreated");eq(pending(f).operationId,"new1","still pending");});
  await test("I05-09 legacy commit receipt recoverable; legacy negative remains uncertain",async()=>{const f=await uncertain("lostAck",false);eq(receipt(f).terminalRevision,null,"legacy terminal revision");f.store.delete(f.fleets+"new1");eq((await verify(f)).status,"committed","legacy positive");const n=await uncertain("commit",false);await rejected(()=>verify(n,{cancel:true}),"legacy no fence");eq(pending(n).operationId,"new1","legacy blocked");});
  await test("I05-10 read failure, cache and write metadata do not unlock",async()=>{const f=await uncertain();f.mode.readFail=true;await rejected(()=>verify(f),"server failure");f.mode.readFail=false;f.mode.cache=f.player;await rejected(()=>verify(f),"cache");f.mode.cache=null;f.mode.pendingWrite=f.player;await rejected(()=>verify(f),"pending metadata");eq(pending(f).operationId,"new1","same ID");eq(f.mode.commits,1,"no repeated dispatch");});
  await test("I05-11 mismatched proof or contradictory cancelled receipt rejected",async()=>{const f=await uncertain();receipt(f).originKey="bad";await rejected(()=>verify(f),"wrong origin");receipt(f).originKey=origin;receipt(f).status="cancelled";await rejected(()=>verify(f),"fleet contradicts cancellation");eq(pending(f).operationId,"new1","retained");});
  await test("I05-12 failed install or updater suppression retains pending",async()=>{for(const installFail of ['throw','skip','partial']){const f=await uncertain();f.mode.installFail=installFail;await rejected(()=>verify(f),installFail);eq(pending(f).operationId,"new1","retained");eq(await f.G.syncPlayerState(installed(f),{force:true}),false,"still blocked");f.mode.installFail=null;eq((await verify(f)).status,"committed","retry succeeds");}});
  await test("I05-13 duplicate verification and account switch",async()=>{const f=await uncertain(),hold=gate(),entered=gate();f.mode.beforeCallback=async()=>{entered.open();await hold.wait};const first=verify(f).catch(e=>e);await entered.wait;await rejected(()=>verify(f),"busy");f.auth.uid="other";hold.open();ok((await first) instanceof Error,"old account not installed");f.auth.uid="me";eq(pending(f).operationId,"new1","original still pending");});
  await test("I05-14 previous unacknowledged receipt cannot be overwritten without proof",async()=>{const f=fixture({recovery:true});await f.launch();const noStorage=fixture({recovery:true,sharedStore:f.store,counter:f.counter});noStorage.u.serviceRevision=3;await rejected(()=>noStorage.launch(),"protected slot");eq(receipt(f).operationId,"new1","receipt not replaced");eq(noStorage.mode.commits,0,"no new commit");const next=await f.launch();eq(next.id,"new3","known local receipt may be replaced");eq(receipt(f).operationId,next.id,"one receipt slot");});
  await test("I05-15 recovery local storage failure keeps original request",async()=>{const f=await uncertain();f.storageMode.failSet=true;await rejected(()=>verify(f),"storage error");eq(pending(f).operationId,"new1","retained");f.storageMode.failSet=false;eq((await verify(f)).status,"committed","retry safe");});
  await test("I05-16 old I01 pending: only positive fleet proof releases",async()=>{const f=await uncertain();const key=[...f.storageMap.keys()][0];const p=JSON.parse(f.storageMap.get(key));delete p.protocol;delete p.armed;delete p.profileJoinedAt;delete p.previousReceiptId;f.storageMap.set(key,JSON.stringify(p));delete f.store.get(f.player).ordinaryDispatchReceipt;const reload=fixture({recovery:true,storageMap:f.storageMap,sharedStore:f.store,counter:f.counter});eq((await verify(reload)).status,"committed","old proof via fleet");});
  await test("I05-17 late original commit fenced by terminal cancellation",async()=>{const f=fixture({recovery:true}),hold=gate(),entered=gate();f.mode.afterCallback=async()=>{entered.open();await hold.wait};const original=f.launch().catch(e=>e);await entered.wait;const reload=fixture({recovery:true,storageMap:f.storageMap,sharedStore:f.store,counter:f.counter});eq((await verify(reload,{cancel:true})).status,"cancelled","barrier committed first");hold.open();ok((await original) instanceof Error,"old transaction rejected on changed read");eq(f.state().created,0,"no late fleet");eq(f.store.get(f.planets+origin).fleet.lightFighter,10,"no late debit");eq(receipt(f).status,"cancelled","terminal unchanged");});
  await test("I05-18 verify in lobby guarded; active change prevents stale install",async()=>{const f=await uncertain();f.W.UniversumUI.state.currentUniverse=null;f.W.UniversumUI.state.isMultiplayerMode=false;let current=true;const hold=gate(),entered=gate();f.mode.beforeCallback=async()=>{entered.open();await hold.wait};const first=f.G.verifyOrdinaryDeparture({id:f.u.id},{isCurrent:()=>current}).catch(e=>e);await entered.wait;current=false;hold.open();ok((await first) instanceof Error,"obsolete lobby entry rejected");eq(f.W.UniversumUI.state.currentUniverse,null,"no stale install");eq(pending(f).operationId,"new1","retained");f.mode.beforeCallback=null;eq((await f.G.verifyOrdinaryDeparture({id:f.u.id},{isCurrent:()=>true})).status,"committed","current lobby recovery");});
  await test("B/C01 direct rename, recall, hangar blocked before writes",async()=>{
    const f=fixture();f.mode.fail="lostAck";await rejected(()=>f.launch(),"lost ack");const before=JSON.stringify([...f.store]);
    await rejected(()=>f.G.renameOnlinePlanet(f.u.id,f.p.coords,"changed"),"rename");
    await rejected(()=>f.G.renameOnlineMoon(f.u.id,f.p.coords,"changed"),"moon");
    await rejected(()=>f.G.recallOnlineFleet(f.u,"new1"),"recall");
    await rejected(()=>f.G.changeOnlineMothershipHangar(f.u,0,"hangar1",1),"hangar");
    eq(JSON.stringify([...f.store]),before,"no direct writes");
  });
  await test("B/C02 admitted direct mutation excludes ordinary dispatch until release",async()=>{
    const f=fixture();const release=f.G.beginOrdinaryMutation(f.u);await rejected(()=>f.launch(),"busy direct mutation");eq(f.mode.commits,0,"no commit");eq(pending(f),null,"no pending record");release();release();await f.launch();eq(f.mode.commits,1,"normal dispatch resumes");
  });
  await test("B/C03 normal direct rename still works",async()=>{
    const f=fixture();await f.G.renameOnlinePlanet(f.u.id,f.p.coords,"changed");eq(f.store.get(f.planets+origin).name,"changed","normal rename");await f.launch();eq(f.mode.commits,1,"lock released");
  });
  await test("B/C04 ordinary join cannot bypass pending recovery",async()=>{
    const f=fixture({recovery:true});f.mode.fail="lostAck";await rejected(()=>f.launch(),"lost ack");const before=JSON.stringify([...f.store]);await rejected(()=>f.G.joinOnlineUniverse(f.u.id),"ordinary join");eq(JSON.stringify([...f.store]),before,"no normal join writes");
  });
  return results;
}
const root = path.join(__dirname, '..');
runTests(...['fleet-control.js','sync.js','universes.js','galattiche.js'].map(file=>fs.readFileSync(path.join(root,'modules/online',file),'utf8'))).then(results=>{for(const r of results) console.log((r.pass?'PASS ':'FAIL ')+r.name+(r.error?': '+r.error:''));if(results.some(r=>!r.pass)) process.exitCode=1;}).catch(e=>{console.error(e);process.exitCode=1;});
