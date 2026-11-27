/** AT05-I02/I03: regressione mirata, Firestore simulato. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
async function runTests(fleetSource,syncSource) {
  const results=[];
  const cp=x=>JSON.parse(JSON.stringify(x));
  const eq=(x,y,label)=>{if(JSON.stringify(x)!==JSON.stringify(y))throw Error(label+": "+JSON.stringify(x)+" != "+JSON.stringify(y))};
  const ok=(x,label)=>{if(!x)throw Error(label)};
  const origin="1_1_1", own="1_1_2", enemy="1_1_3", empty="1_1_4";
  function fixture({versioned=true,queue=false,initial=10}={}) {
    const mk=(key,id)=>({id,name:key,coords:{g:1,s:1,p:Number(key.slice(-1))},ownerUid:"me",
      fleet:{lightFighter:initial,hephaestusForge:1,invictus:0,crepuscolo:0,mothership:1,deathStar:1,colonyShip:1,espionageProbe:1},
      resources:{metal:1000,crystal:1000,deuterium:100000},buildings:{},defenses:{},
      shipyardQueue:queue?[{id:"prometheusOracle",remaining:1}]:[],
      mothershipHangars:[{id:"hangar1",fighters:0}],
      bacinoSpaziale:{status:"active",startedAt:1,invictusActive:1,crepuscolo:{status:"active"}}});
    const p=mk(origin,"p1"), p2=mk(own,"p2"); p2.fleet.hephaestusForge=0;p2.shipyardQueue=[];
    const u={id:"u",emperor:"test",planets:[p,p2],fleetsInFlight:[],researches:{},...(versioned?{serviceRevision:2}:{})};
    const root="online_universes/u", planets=root+"/planets/", fleets=root+"/fleets/", player=root+"/players/me";
    const store=new Map([[planets+origin,cp(p)],[planets+own,cp(p2)],[planets+enemy,{ownerUid:"enemy"}],[player,{...(versioned?{serviceRevision:2}:{}),specialistFlights:["existing"]}],[fleets+"existing",{resolved:false,ships:{prometheusOracle:1}}]]);
    const mode={fail:null,retry:false,attempts:0,commits:0,settles:0,normalizations:0,reads:[],writes:[],calls:0};
    let next=0;
    mode.serverReads=[];mode.reloads=0;mode.reloadFail=false;mode.readFail=false;mode.hideFleet=false;mode.timestampWrites=0;
    function snap(path){return {id:path.split("/").pop(),exists:store.has(path),data:()=>store.has(path)?cp(store.get(path)):undefined}}
    function ref(path){return {path,id:path.split("/").pop(),collection:n=>col(path+"/"+n),
      get:async options=>{
        if(options?.source==="server"){mode.serverReads.push(path);if(mode.readFail)throw Error("offline");if(mode.hideFleet&&path.startsWith(fleets))return {id:path.split("/").pop(),exists:false,data:()=>undefined};}
        return snap(path);
      },update:async d=>{if(path.startsWith(fleets))mode.timestampWrites++;store.set(path,{...store.get(path),...cp(d)})}}}
    function col(path){return {doc:id=>ref(path+"/"+(id??("new"+(++next)))),
      add:async d=>{mode.calls++;throw Error("La candidata non deve usare add")}}}
    const db={collection:n=>col(n),runTransaction:async cb=>{
      const count=mode.retry?2:1;
      for(let i=0;i<count;i++){
        mode.attempts++;
        const staged=[];
        const tx={get:async r=>{mode.reads.push(r.path);return snap(r.path)},
          set:(r,d,opt)=>{if(mode.fail==="create"&&r.path.startsWith(fleets))throw Error("create rejected");staged.push([r.path,cp(d),!!opt?.merge])},
          update:(r,d)=>staged.push([r.path,cp(d),true])};
        await cb(tx);
        if(mode.fail==="commit")throw Object.assign(Error("commit rejected"),{code:"aborted"});
        if(i+1<count)continue;
        for(const [path,d,merge] of staged){store.set(path,merge?{...store.get(path),...d}:d);mode.writes.push(path)}
        mode.commits++;
        if(mode.fail==="lostAck")throw Error("commit acknowledged by server but response lost");
      }
    }};
    const ids=["hephaestusForge","prometheusOracle"];
    const G={getAuth:()=>({currentUser:{uid:"me"}}),getDB:()=>db,coordsToKey:c=>`${c.g}_${c.s}_${c.p}`, _tsToMs:()=>0,
      galatticaMarkers:()=>({doc:()=>({get:async()=>({exists:true,id:"gal1",data:()=>({ownerUid:"enemy"})})})}),atGalatticaTarget:()=>true};
    const ships=Object.fromEntries(["lightFighter","hephaestusForge","prometheusOracle","invictus","crepuscolo","mothership","deathStar","colonyShip","espionageProbe"].map(id=>[id,{cargo:100000,cost:{metal:3000,crystal:1000,deuterium:0}}]));
    const W={__UniversumMPModules:G,__UniversumMPVariables:{SYNC_MIN_INTERVAL_MS:0,_INBOX_RES_KEYS:["metal","crystal","deuterium"],_syncLastByUni:new Map(),_systemCache:new Map(),_systemPending:new Map(),FLEET_SCHEMA_VERSION:1,_mpErrorToastAt:new Map()},
      UniversumEngine:{normalizeResearchState:()=>{mode.normalizations++}},
      UniversumData:{SHIPS:ships},UniversumGalaxy:{calculateDistance:()=>1,getFleetSpeedAndFuel:()=>({fuelCost:40,durationSec:60}),getInvictusJumpCost:()=>5},
      UniversumMissionsCore:{getMaxFleetSlots:()=>100,getMaxExploreHours:()=>4,getExplorationHoldDurationSec:(u,h)=>h*3600,buildExplorationTimeline:(now,d,h)=>({departureTime:now,zoneArrivalTime:now+d*1000,explorationEndTime:now+(d+h)*1000,arrivalTime:now+(d+h)*1000,returnTime:now+(2*d+h)*1000,travelDurationMs:d*1000,explorationHoldMs:h*1000,returnTravelDurationMs:d*1000})},
      UniversumServices:{ids,forge:ids[0],oracle:ids[1],transfer:(u,m,t,ships)=>ids.some(id=>ships[id]),settlePlanet:()=>{mode.settles++}},
      UniversumHangars:{select:p=>cp(p.mothershipHangars),take:(p,hs)=>{p.mothershipHangars=p.mothershipHangars.filter(h=>!hs.some(x=>x.id===h.id))},normalizePlanet:()=>{},validateMission:()=>{},verifyManifest:x=>x}};
    const firebase={firestore:{FieldValue:{serverTimestamp:()=>null,delete:()=>null}}};
    new Function("window","firebase",syncSource)(W,firebase);
    new Function("window","firebase",fleetSource)(W,firebase);
    G.joinOnlineUniverse=async(id,passcode,opts)=>{
      if(opts?.serverOnly!==true)throw Error("not server-only");
      mode.reloads++;
      if(mode.reloadFail)throw Error("reload failed");
      return {...cp(u),serviceRevision:store.get(player).serviceRevision,planets:[cp(store.get(planets+origin)),cp(store.get(planets+own))],
        fleetsInFlight:[...store].filter(([k,d])=>k.startsWith(fleets+"new")&&!d.resolved).map(([k,d])=>({...cp(d),id:k.split("/").pop()}))};
    };
    W.UniversumUI={state:{currentUniverse:u,isMultiplayerMode:true},startOnlineGame:fresh=>{W.UniversumUI.state.currentUniverse=fresh;},toast:()=>{},exitToLobbyAfterServerRemoval:async()=>{}};
    const launch=(target=enemy,mission="attack",ships={lightFighter:3},cargo={metal:100,crystal:50,deuterium:20},options={})=>G.launchOnlineFleet(u,0,{g:1,s:1,p:Number(target.slice(-1))},mission,ships,cargo,options);
    const state=()=>({local:cp(p),remote:cp(store.get(planets+origin)),flights:u.fleetsInFlight.length,created:[...store.keys()].filter(k=>k.startsWith(fleets+"new")).length,player:cp(store.get(player))});
    return {G,u,p,mode,store,state,launch,planets,player,fleets,W};
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
  // AT05-I03: il precedente caso di successo ordinario non versionato
  // deve ora essere rifiutato, prima di normalizzazione e transazione.
  for (const [label,revision] of [
    ["absent",undefined],["null",null],["string","2"],["fraction",1.5],
    ["negative",-1],["max safe",Number.MAX_SAFE_INTEGER],
    ["above max safe",Number.MAX_SAFE_INTEGER+1],["NaN",NaN],["infinity",Infinity]
  ]) {
    await test("I03 invalid revision "+label,async()=>{
      const f=fixture({versioned:false});
      if(revision!==undefined) f.u.serviceRevision=revision;
      const before=f.state(), beforeStore=cp([...f.store]), beforeLocal=cp(f.u);
      const error=await rejected(()=>f.launch(),"invalid revision");
      eq(error.message,"Revisione non valida. Riapri la partita multiplayer.","explicit rejection");
      eq(f.state(),before,"no debit or fleet");
      eq([...f.store],beforeStore,"no remote change");
      eq(cp(f.u),beforeLocal,"no local change");
      ok(Object.is(f.u.serviceRevision,revision),"revision not converted");
      eq([f.mode.attempts,f.mode.commits,f.mode.normalizations,f.mode.writes.length],[0,0,0,0],"no transaction, normalization or write");
    });
  }
  for(const revision of [0,2,Number.MAX_SAFE_INTEGER-1]){
    await test("I03 valid revision "+revision,async()=>{
      const f=fixture({versioned:revision!==0});
      f.u.serviceRevision=revision;
      if(revision!==0) f.store.get(f.player).serviceRevision=revision;
      await f.launch();
      const s=f.state();
      eq([s.local.fleet.lightFighter,s.remote.fleet.lightFighter,s.created,s.flights,f.mode.commits],[7,7,1,1,1],"one departure");
      eq(s.local.resources,debit,"debit");
      eq(s.remote.resources,debit,"remote debit");
      eq(f.u.serviceRevision,revision+1,"local revision increment");
      eq(s.player.serviceRevision,revision+1,"remote revision increment");
    });
  }
  await test("I03 non-dispatch legacy checkpoint unchanged",async()=>{
    const f=fixture({versioned:false});
    eq(await f.G.syncPlayerState(f.u,{force:true}),true,"checkpoint succeeds");
    eq([f.mode.commits,f.state().created,f.u.serviceRevision],[1,0,undefined],"legacy checkpoint preserved");
  });
  await test("I03 special legacy dispatch unchanged",async()=>{
    const f=fixture({versioned:false});
    const d=await f.launch(enemy,"attack",{invictus:1,crepuscolo:1},{});
    eq(d.originPlanetId,"p1","special origin");
    eq([f.mode.commits,f.state().created,f.u.serviceRevision],[1,1,undefined],"special checkpoint preserved");
    eq(f.state().remote.bacinoSpaziale.crepuscolo.status,"inMission","special debit");
  });
  await test("T01 missing checkpoint confirmation",async()=>{const f=fixture();f.G.syncPlayerState=async()=>undefined;const before=f.state();await rejected(()=>f.launch(),"not confirmed");eq(f.state(),before,"no local flight");});
  await test("T10 partial: stale revision rejected after another commit",async()=>{const f=fixture();const stale=cp(f.u);await f.launch();const before=f.state();await rejected(()=>f.G.launchOnlineFleet(stale,0,{g:1,s:1,p:3},"attack",{lightFighter:3},{}),"stale revision");eq(f.state(),before,"no second commit");});
  await test("T09-03 lost acknowledgment reconciled from server",async()=>{const f=fixture();f.mode.fail="lostAck";const d=await f.launch();const fresh=f.W.UniversumUI.state.currentUniverse;eq([f.state().created,fresh.fleetsInFlight.length,fresh.planets[0].fleet.lightFighter,f.state().remote.fleet.lightFighter,fresh.serviceRevision],[1,1,7,7,3],"one debit");eq(f.mode.serverReads,[f.fleets+d.id],"same server ID");eq([f.mode.reloads,f.mode.timestampWrites],[1,0],"no timestamp rewrite");eq(f.G.ordinaryDepartureStatus(fresh),null,"cleared");});
  await test("T09-04/06 unavailable server then explicit verification",async()=>{const f=fixture();f.mode.fail="lostAck";f.mode.readFail=true;const e=await rejected(()=>f.launch(),"uncertain");eq(e.code,"ordinary-departure-pending","pending");const pending=f.G.ordinaryDepartureStatus(f.u);eq(pending.id,e.fleetId,"same ID");eq(await f.G.syncPlayerState(f.u,{force:true}),false,"no stale save");const attempts=f.mode.attempts;await rejected(()=>f.launch(),"no repeat");eq(f.mode.attempts,attempts,"no transaction");f.mode.readFail=false;const d=await f.G.verifyOrdinaryDeparture(f.u);eq(d.id,pending.id,"original ID");eq(f.state().created,1,"one fleet");eq(f.G.ordinaryDepartureStatus(f.W.UniversumUI.state.currentUniverse),null,"cleared");});
  await test("T09-05 absent document is not definitive",async()=>{const f=fixture();f.mode.fail="lostAck";f.mode.hideFleet=true;const e=await rejected(()=>f.launch(),"absent");eq(e.code,"ordinary-departure-pending","pending");eq(f.mode.reloads,0,"no reload");eq(f.G.ordinaryDepartureStatus(f.u).id,e.fleetId,"kept");f.mode.hideFleet=false;await f.G.verifyOrdinaryDeparture(f.u);eq(f.state().created,1,"one fleet");});
  await test("T09-08 completed mission never reactivated",async()=>{const f=fixture();f.mode.fail="lostAck";f.mode.readFail=true;const e=await rejected(()=>f.launch(),"uncertain");const d=f.store.get(f.fleets+e.fleetId);d.resolved=true;d.status="completed";f.mode.readFail=false;await f.G.verifyOrdinaryDeparture(f.u);eq(f.W.UniversumUI.state.currentUniverse.fleetsInFlight.length,0,"not active");eq(f.mode.timestampWrites,0,"no timestamp rewrite");});
  await test("T09-09 voluntary identical departure gets new ID",async()=>{const f=fixture();f.mode.fail="lostAck";const d=await f.launch();f.mode.fail=null;const fresh=f.W.UniversumUI.state.currentUniverse;const d2=await f.G.launchOnlineFleet(fresh,0,{g:1,s:1,p:3},"attack",{lightFighter:3},{metal:100,crystal:50,deuterium:20});ok(d.id!==d2.id,"new request");eq([f.state().created,f.state().remote.fleet.lightFighter],[2,4],"two voluntary debits");});
  await test("T09-10 double click and rebuilt universe blocked",async()=>{const f=fixture();f.mode.fail="lostAck";f.mode.readFail=true;const first=f.launch();const second=f.launch();const rs=await Promise.allSettled([first,second]);eq(rs.map(x=>x.status),["rejected","rejected"],"pending and duplicate");eq(f.state().created,1,"one fleet");const fresh=cp(f.u);f.W.UniversumUI.state.currentUniverse=fresh;eq(f.G.ordinaryDepartureStatus(fresh).id,rs[0].reason.fleetId,"survives reconstructed state");await rejected(()=>f.G.launchOnlineFleet(fresh,0,{g:1,s:1,p:3},"attack",{lightFighter:3},{}),"blocked");eq(f.state().created,1,"no second fleet");});
  await test("T09-11 confirmed commit but local reload fails",async()=>{const f=fixture();f.mode.fail="lostAck";f.mode.reloadFail=true;const e=await rejected(()=>f.launch(),"reload");eq([e.code,e.confirmed],["ordinary-departure-pending",true],"confirmed but pending");eq(await f.G.syncPlayerState(f.u,{force:true}),false,"no stale save");f.mode.reloadFail=false;await f.G.verifyOrdinaryDeparture(f.u);eq([f.state().created,f.mode.reloads,f.mode.timestampWrites],[1,2,0],"reconciled once");eq(await f.G.syncPlayerState(f.u,{force:true}),false,"retired state cannot save");});
  await test("T09-11 SDK confirmed then local application error",async()=>{const f=fixture();const original=f.G.syncPlayerState;f.G.syncPlayerState=async(...args)=>{await original(...args);throw Error("local apply failure")};const d=await f.launch();eq(f.state().created,1,"one fleet");eq(f.W.UniversumUI.state.currentUniverse.planets[0].fleet.lightFighter,7,"no double debit");eq(f.mode.serverReads,[f.fleets+d.id],"server confirmation");});

  // AT05-I04A: eccezioni reali dopo il commit, senza nuovo dispatch.
  for (const phase of ["id","some","push","afterPush","sync"]) {
    await test("I04A R04-T06 postcommit "+phase+" releases busy and retains ID",async()=>{
      const f=fixture();f.mode.reloadFail=true;
      const original=f.G.syncPlayerState;
      f.G.syncPlayerState=async(...args)=>{
        const result=await original(...args);
        if(phase==="id") Object.freeze(args[1].dispatch.doc);
        if(phase==="some") f.u.fleetsInFlight.some=()=>{throw Error("some failed")};
        if(phase==="push") Object.freeze(f.u.fleetsInFlight);
        if(phase==="afterPush") f.u.fleetsInFlight.push=function(d){Array.prototype.push.call(this,d);throw Error("push then fail")};
        if(phase==="sync") throw Error("local sync failure");
        return result;
      };
      const e=await rejected(()=>f.launch(),"postcommit exception");
      eq([e.code,e.confirmed],["ordinary-departure-pending",true],"confirmed pending");
      const p=f.G.ordinaryDepartureStatus(f.u);
      eq([p.id,p.busy,p.confirmed],[e.fleetId,false,true],"retryable same ID");
      eq([f.state().created,f.state().remote.fleet.lightFighter,f.mode.commits],[1,7,1],"one committed debit");
      eq(f.state().remote.resources,{metal:900,crystal:950,deuterium:99940},"one resource debit");
      const attempts=f.mode.attempts;
      await rejected(()=>f.launch(),"duplicate blocked");
      eq(f.mode.attempts,attempts,"no second transaction");
      f.mode.reloadFail=false;
      const d=await f.G.verifyOrdinaryDeparture(f.u);
      eq(d.id,p.id,"same ID");
      const fresh=f.W.UniversumUI.state.currentUniverse;
      eq([fresh.fleetsInFlight.length,fresh.planets[0].fleet.lightFighter,fresh.serviceRevision],[1,7,3],"reconciled");
      eq([f.state().created,f.mode.commits,f.mode.timestampWrites],[1,1,0],"no double debit or timestamp rewrite");
      eq(f.G.ordinaryDepartureStatus(fresh),null,"released after complete recovery");
      ok(f.mode.serverReads.every(path=>path===f.fleets+p.id),"only original document");
    });
  }
  await test("I04A postcommit exception with immediate recovery",async()=>{
    const f=fixture();Object.freeze(f.u.fleetsInFlight);
    const d=await f.launch();eq([f.state().created,f.mode.commits],[1,1],"single commit");
    eq(f.mode.serverReads,[f.fleets+d.id],"same ID");
    eq(f.G.ordinaryDepartureStatus(f.W.UniversumUI.state.currentUniverse),null,"released");
  });
  await test("I04A confirmed commit and server unavailable, second verification",async()=>{
    const f=fixture();Object.freeze(f.u.fleetsInFlight);f.mode.readFail=true;
    const e=await rejected(()=>f.launch(),"offline");eq(e.confirmed,true,"SDK confirmation retained");
    eq(f.G.ordinaryDepartureStatus(f.u).busy,false,"not stuck");
    f.mode.readFail=false;const d=await f.G.verifyOrdinaryDeparture(f.u);eq(d.id,e.fleetId,"same ID");
    eq([f.state().created,f.mode.commits],[1,1],"single debit");
  });
  await test("I04A R04-T09 definitive failure and subsequent voluntary launch",async()=>{
    const f=fixture();f.mode.fail="commit";const before=f.state();
    await rejected(()=>f.launch(),"definitive abort");
    eq(f.state(),before,"no debit");eq(f.G.ordinaryDepartureStatus(f.u),null,"released");
    f.mode.fail=null;await f.launch();
    eq([f.state().created,f.mode.commits,f.state().remote.fleet.lightFighter],[1,1,7],"new departure");
  });
  await test("I04A normal launch without reconciliation",async()=>{
    const f=fixture();const d=await f.launch();eq([f.state().created,f.state().flights,f.mode.commits,f.mode.reloads],[1,1,1,0],"normal");
    eq(f.u.fleetsInFlight[0].id,d.id,"registered");eq(f.G.ordinaryDepartureStatus(f.u),null,"released");
  });
  await test("I04A timestamp read failure retains normal fallback",async()=>{
    const f=fixture();const original=f.G.syncPlayerState;
    f.G.syncPlayerState=async(...args)=>{const result=await original(...args);args[1].dispatch.ref.get=async()=>{throw Error("timestamp read failed")};return result};
    await f.launch();eq([f.state().created,f.state().flights,f.mode.commits,f.mode.reloads],[1,1,1,0],"existing fallback");
    eq(f.G.ordinaryDepartureStatus(f.u),null,"released");
  });
  await test("I04A special postcommit exception unchanged",async()=>{
    const f=fixture();Object.freeze(f.u.fleetsInFlight);const e=await rejected(()=>f.launch(enemy,"attack",{invictus:1,crepuscolo:1},{}),"special push");
    ok(e.code!=="ordinary-departure-pending","special not intercepted");
    eq([f.state().created,f.mode.commits,f.mode.reloads],[1,1,0],"original special behavior");
    eq(f.G.ordinaryDepartureStatus(f.u),null,"no ordinary reservation");
  });
  return results;
}
const root = path.join(__dirname, '..');
runTests(fs.readFileSync(path.join(root,'modules/online/fleet-control.js'),'utf8'),fs.readFileSync(path.join(root,'modules/online/sync.js'),'utf8')).then(results=>{for(const r of results) console.log((r.pass?'PASS ':'FAIL ')+r.name+(r.error?': '+r.error:''));if(results.some(r=>!r.pass)) process.exitCode=1;}).catch(e=>{console.error(e);process.exitCode=1;});
