/** Versione del bilanciamento fissata sulla missione al lancio. */
(function (root) {
  'use strict';
  const keys = ['metal','crystal','deuterium'];
  const empty = () => ({metal:0,crystal:0,deuterium:0});
  const names = {asteroids:'Giacimento di asteroidi',abandoned:'Flotta abbandonata',wreck:'Relitto antico',
    pirates:'Imboscata pirata',quiet:'Nessun ritrovamento',singularity:'Singolarità superata',
    anomaly:'Anomalia gravitazionale',corona:'Corona del Buco Nero',crepuscolo:'Relitto della Crepuscolo'};

  // Lo stesso ID persistito produce lo stesso flusso casuale anche dopo un retry.
  function randomFor(id) {
    let state=2166136261;
    for (const ch of String(id)) state=Math.imul(state^ch.charCodeAt(0),16777619);
    return ()=>{
      state=(state+0x6d2b79f5)|0;
      let n=Math.imul(state^(state>>>15),1|state);
      n=(n+Math.imul(n^(n>>>7),61|n))^n;
      return ((n^(n>>>14))>>>0)/4294967296;
    };
  }

  function resolve({version,id,ships,cargo,tech={},hours=1,blackHole,canRecoverWreck=false,
    originResources={},catalog,combat,random=randomFor(id)}) {
    if (version!==2 || !id) throw Error('Versione o identificatore esplorazione non supportato.');
    const result={version,eventId:String(id),event:'quiet',found:empty(),loaded:empty(),cost:empty(),
      recovered:{},lost:{},survivors:{...ships},effects:{},message:''};
    let detail='';
    const mult=(1+0.25*(tech.expeditionTech || 0))*(1+0.22*(hours-1));
    if (!blackHole && hours>=24 && ships.deathStar>=4 && canRecoverWreck && random()<0.005) {
      result.event='crepuscolo';
      result.effects.repairDays=30;
      detail='Relitto destinato al Bacino. Riparazione di 30 giorni.';
    } else {
      const roll=random();
      if (blackHole) {
        if (roll<0.05) {
          result.event='singularity';
          result.found={metal:500000,crystal:300000,deuterium:200000};
        } else if (roll<0.35) {
          result.event='anomaly';
          for (const [key,q] of Object.entries(ships)) result.survivors[key]=Math.floor(q*0.7);
        } else {result.event='corona';result.found.deuterium=25000;}
      } else if (roll<0.35) {
        result.event='asteroids';
        result.found.metal=Math.floor(Math.floor(15000+random()*45000)*mult);
        result.found.crystal=Math.floor(Math.floor(10000+random()*30000)*mult);
      } else if (roll<0.55) {
        result.event='abandoned'; result.recovered={lightFighter:5,cruiser:1};
        detail='Recuperati 5 Caccia Leggeri e 1 Incrociatore.';
      } else if (roll<0.62) {
        result.event='wreck';
        if (originResources.metal>=250000 && originResources.crystal>=125000) {
          result.cost.metal=250000;result.cost.crystal=125000;result.recovered.deathStar=1;
          detail='Riparata 1 Morte Nera pagando 250.000 M e 125.000 C.';
        } else {result.found.metal=Math.floor(80000*mult);detail='Relitto smantellato.';}
      } else if (roll<0.80) {
        result.event='pirates';
        const fight=combat({...ships},tech,{fleet:{lightFighter:12,cruiser:3},defenses:{},
          tech:{weaponsTech:3,shieldingTech:3,armourTech:3},resources:{metal:12000,crystal:8000,deuterium:2000}},{random});
        result.survivors={...fight.attackerSurvivors};
        result.found={...empty(),...fight.loot};
        if (fight.attackerCrepuscoloDamaged && result.survivors.crepuscolo) result.effects.crepuscoloDamaged=true;
        detail='Esito '+fight.result+', round '+fight.roundsPlayed+'.';
      }
    }
    for (const [key,q] of Object.entries(ships)) {
      const lost=q-(result.survivors[key] || 0);
      if (lost>0) result.lost[key]=lost;
    }
    for (const [key,q] of Object.entries(result.recovered)) result.survivors[key]=(result.survivors[key] || 0)+q;
    const capacity=Object.entries(result.survivors).reduce((n,[key,q])=>n+q*(catalog[key]?.cargo || 0),0);
    let free=Math.max(0,Math.floor(capacity-keys.reduce((n,k)=>n+(cargo[k] || 0),0)));
    for (const key of keys) {
      result.loaded[key]=Math.min(free,result.found[key]);free-=result.loaded[key];
    }
    const format=map=>keys.map(k=>map[k]).join(' / ');
    result.message=[names[result.event],detail,'Risorse M / C / D trovate: '+format(result.found)+'. Caricate: '+format(result.loaded)+'.',
      ...Object.entries(result.lost).map(([k,n])=>'Perdite: '+n+' '+(catalog[k]?.name || k)+'.')].filter(Boolean).join(' ');
    return result;
  }
  root.UniversumExplorationRewards=Object.freeze({resolve,randomFor});
})(typeof window==='undefined'?globalThis:window);
