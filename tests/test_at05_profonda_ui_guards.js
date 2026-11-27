'use strict';
const {assert,win,doc,uni,plain}=require('./helpers/game');
const UI=win.UniversumUI;

async function main() {
  let pending=true, saves=0;
  const messages=[];
  const universe=uni(1);
  const planet=universe.planets[0];
  UI.state.currentUniverse=universe;
  UI.state.isMultiplayerMode=true;
  UI.getActivePlanet=()=>planet;
  UI.getActivePlanetIndex=()=>0;
  UI.persistUniverseState=async()=>{saves++;};
  for (const method of ['renderCurrentView','updateTopBarNumbers','playSound','openModal']) UI[method]=()=>{};
  UI.toast=(message,type)=>messages.push(type);
  win.__UniversumMPModules.ordinaryDepartureStatus=()=>pending ? {operationId:'fleet-a'} : null;
  win.__UniversumMPModules.ordinaryDepartureBusy=()=>false;
  win.__UniversumMPModules.ordinaryCheckpointBlocked=()=>pending;

  const actions=[
    ['renderBuildings','.btn-build-structure',{bid:'metalMine'},'startBuilding'],
    ['renderResearch','.btn-start-research',{rid:'energyTech'},'startResearch'],
    ['renderShipyardAndDefense','.btn-produce-unit',{uid:'lightFighter'},'buildUnits']
  ];
  for (const [render,selector,dataset,engineMethod] of actions) {
    let click, mutations=0;
    const original=win.UniversumEngine[engineMethod];
    win.UniversumEngine[engineMethod]=()=>{mutations++;return {};};
    const button={dataset,addEventListener:(_,fn)=>{click=fn;}};
    UI[render]({querySelectorAll:s=>s===selector ? [button] : [],querySelector:()=>null});
    const before=plain(universe);
    await click();
    assert.deepEqual(plain(universe),before);
    assert.equal(mutations,0);
    assert.equal(messages.at(-1),'info');
    pending=false;
    await click();
    assert.equal(mutations,1);
    assert.equal(messages.at(-1),'success');
    pending=true;
    win.UniversumEngine[engineMethod]=original;
    console.log('PASS',render,'blocca prima del motore e riprende dopo la verifica');
  }
  let submit, trades=0;
  const button={};
  const inputs={
    'form-online-bot-trade':{addEventListener:(_,fn)=>{submit=fn;}},
    'trade-bot-g':{value:'1'},'trade-bot-s':{value:'2'},'trade-bot-p':{value:'3'},
    'trade-bot-give':{value:'metal'},'trade-bot-get':{value:'crystal'},'trade-bot-amount':{value:'300'}
  };
  doc.getElementById=id=>inputs[id] || null;
  win.UniversumMP.tradeWithOnlineBot=async()=>{trades++;return {given:300,received:200};};
  win.UniversumMP.syncPlayerState=async()=>true;
  UI.closeModal=()=>{};
  UI.openOnlineBotTradeModal();
  const evt={preventDefault(){},target:{querySelector:()=>button}};
  await submit(evt);
  assert.equal(trades,0);
  pending=false;
  await submit(evt);
  assert.equal(trades,1);
  assert.equal(messages.at(-1),'success');
  assert.equal(saves,3);
  console.log('PASS commercio: conferma precedente alla verifica bloccata, poi consentita');

  async function guardedClick(render, selector, dataset, methodCalls) {
    let click;
    const element={dataset,addEventListener:(_,fn)=>{click=fn;}};
    const scope={
      querySelectorAll:s=>s===selector ? [element] : s==='.mother-hangar-amount'
        ? [{dataset:{id:'hangar-a'},value:'3'}] : [],
      querySelector:()=>null
    };
    await UI[render](scope);
    assert.equal(typeof click,'function');
    const before=methodCalls();
    pending=true;
    await click();
    assert.equal(methodCalls(),before);
    pending=false;
    await click();
    assert.equal(methodCalls(),before+1);
    console.log('PASS',selector,'rifiutato durante la verifica, consentito al termine');
  }
  universe.galattiche=[{id:'orbiter',coords:planet.coords,resources:{metal:1000,crystal:1000,deuterium:1000},
    structures:{},orbitingFleet:{},defenses:{}}];
  UI.state.currentGalatticaManageId='orbiter';
  let upgrades=0;
  win.UniversumGalaxy.upgradeGalatticaStructure=()=>{upgrades++;};
  await guardedClick('renderGalatticaManageView','.btn-gal-upgrade',{gsid:'cantiereSpaziale'},()=>upgrades);

  planet.fleet.mothership=1;
  planet.mothershipHangars=[{id:'hangar-a',fighters:0}];
  let hangarChanges=0;
  win.UniversumMP.changeOnlineMothershipHangar=async()=>{hangarChanges++;};
  await guardedClick('renderFleet','.mother-hangar-load',{id:'hangar-a'},()=>hangarChanges);

  let recalls=0;
  win.UniversumMP.recallOnlineFleet=async()=>{recalls++;};
  await guardedClick('renderFleetMovements','.btn-recall-fleet',{fid:'fleet-a'},()=>recalls);

  universe.researches.combustionDrive=1;
  win.UniversumEngine.buildUnits(universe,0,'lightFighter',5);
  const target=planet.shipyardQueue[0];
  const initial=planet.shipyardQueue.length;
  pending=true;
  UI.changeWorkOrder(universe,planet,target.workId,'cancel');
  assert.equal(planet.shipyardQueue.length,initial);
  pending=false;
  UI.changeWorkOrder(universe,planet,target.workId,'cancel');
  assert.equal(planet.shipyardQueue.length,initial-1);
  console.log('PASS ordine di cantiere: annullamento bloccato e poi eseguito');
}

main().catch(error=>{console.error(error);process.exitCode=1;});
