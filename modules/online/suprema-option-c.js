/** Fase 4 — Opzione C, interfaccia e recupero solo per staging autorizzato. */
(function(){
  'use strict';
  const onlineCapacity=4000;
  const weights={lightFighter:1,heavyFighter:3,cruiser:8,battleship:18,bomber:22};
  const names={lightFighter:'Caccia Leggero',heavyFighter:'Caccia Pesante',
    cruiser:'Incrociatore',battleship:'Nave da Battaglia',bomber:'Bombardiere'};
  const materials=['metal','crystal','deuterium'];
  const pending=new Map();
  let timer=null, lastData=null;
  const UI=()=>window.UniversumUI;
  const esc=value=>UI().escapeHTML(String(value??''));
  const key=p=>p.coords.g+'_'+p.coords.s+'_'+p.coords.p;
  const id=()=>('c'+(window.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2))).replace(/-/g,'');
  const active=uni=>Boolean(uni?.supremaOptionCStaging&&UI()?.state?.isMultiplayerMode&&
    window.fbAuth?.currentUser&&window.fbDB?.app?.options?.projectId!=='universum-online');
  async function call(uni,payload) {
    if(!active(uni))throw Error('Suprema Opzione C disponibile soltanto nello staging autorizzato.');
    const user=window.fbAuth.currentUser, project=window.fbDB.app.options.projectId;
    if(!/^[a-z0-9-]+$/.test(project))throw Error('Progetto Firebase non valido.');
    const url='https://europe-west1-'+project+'.cloudfunctions.net/optionCSuprema';
    const token=await user.getIdToken();
    const resp=await fetch(url,{method:'POST',headers:{
      'Content-Type':'application/json',Authorization:'Bearer '+token
    },body:JSON.stringify({data:{universeId:uni.id,...payload}})});
    const body=await resp.json();
    if(!resp.ok||!body||!Object.prototype.hasOwnProperty.call(body,'result')){
      throw Error(body?.error?.message||'Servizio Suprema temporaneamente non disponibile.');
    }
    return body.result;
  }
  async function command(uni,action,params){
    const spec={action,...params};
    const fingerprint=JSON.stringify(spec);
    const requestId=pending.get(fingerprint)||id();
    pending.set(fingerprint,requestId);
    const result=await call(uni,{...spec,commandId:requestId});
    pending.delete(fingerprint);
    return result;
  }
  async function refresh(uni){
    const state=await call(uni,{action:'state'});
    if(UI().state.currentUniverse!==uni)return null;
    lastData=state;return state;
  }
  function occupied(s){
    return Object.values(s.hangar||{}).reduce((n,group)=>n+Object.entries(group||{})
      .reduce((v,[ship,count])=>v+(weights[ship]||0)*count,0),0);
  }
  function options(values,selected){
    return values.map(([value,label])=>'<option value="'+esc(value)+'"'+
      (value===selected?' selected':'')+'>'+esc(label)+'</option>').join('');
  }
  function form(action,fields,label){
    return '<form data-sup-action="'+esc(action)+'" class="form-group" style="margin:8px 0;">'+
      fields+'<button type="submit" class="btn btn-blue btn-sm" style="margin-top:6px;">'+esc(label)+'</button></form>';
  }
  function render(uni,data){
    const planets=uni.planets||[],ships=data.inventory.ships||[],orders=data.inventory.constructions||[];
    const chosen=planets.find(p=>p.id===uni.activePlanetId)||planets[0];
    const homeOpts=options(planets.map(p=>[key(p),p.name+' ['+key(p).replaceAll('_',':')+']']),chosen?key(chosen):'');
    const shipOpts=options(Object.entries(names).map(([code,label])=>[code,label]));
    const resourceOpts=options(materials.map(x=>[x,x]));
    const target=UI().state.fleetTarget||{g:1,s:1,p:1};
    const errors=[];
    let html='<p>ONLINE: <strong>4.000 slot</strong> per Suprema; assedio persistente disattivato. OFFLINE invariato.</p>'+
      '<p class="text-muted">Staging di prova, non pubblicato in produzione.</p>';
    html+=form('build','<label>Costruisci (40 rate giornaliere reali) sul pianeta</label>'+
      '<select class="form-control" name="originKey" required>'+homeOpts+'</select>','Avvia costruzione');
    for(const o of orders)html+='<div class="glass-panel" style="padding:9px;margin:7px 0;">'+
      '<strong>Suprema '+esc(o.id)+'</strong>: '+esc(o.paidDays)+'/40 rate, '+esc(o.status)+
      ' — prossimo controllo '+new Date(o.nextPaymentAt).toLocaleString('it-IT')+'</div>';
    for(const s of ships){
      const hangar=occupied(s);
      html+='<section class="glass-panel" style="padding:12px;margin:10px 0;">'+
        '<strong>Suprema '+esc(s.id)+'</strong> — '+esc(s.status)+
        '<p>Hangar: <strong>'+esc(hangar)+'/4000</strong> slot</p>'+
        '<p class="text-muted">Scorta: '+esc(JSON.stringify(s.hangar?.escort||{}))+
        ' | Invasione: '+esc(JSON.stringify(s.hangar?.invasion||{}))+
        ' | Riserva: '+esc(JSON.stringify(s.hangar?.reserve||{}))+'</p>';
      if(s.status==='docked'){
        const hidden='<input type="hidden" name="supremeId" value="'+esc(s.id)+'">';
        const location='<input type="hidden" name="originKey" value="'+esc(s.originKey)+'">';
        html+=form('load',hidden+location+
          '<label>Carica navi dal pianeta</label><select class="form-control" name="ship">'+shipOpts+'</select>'+
          '<input class="form-control" type="number" name="count" min="1" step="1" value="1" required>',
          'Carica nella riserva');
        html+=form('assign',hidden+
          '<label>Sposta navi fra ruoli</label><select class="form-control" name="ship">'+shipOpts+'</select>'+
          '<select class="form-control" name="from">'+options([['reserve','Riserva'],['escort','Scorta'],['invasion','Invasione']])+'</select>'+
          '<select class="form-control" name="to">'+options([['invasion','Invasione'],['escort','Scorta'],['reserve','Riserva']])+'</select>'+
          '<input class="form-control" type="number" name="count" min="1" value="1" required>','Assegna');
        html+=form('deposit',hidden+location+
          '<label>Rifornisci depositi dalla colonia</label><select class="form-control" name="resource">'+resourceOpts+'</select>'+
          '<input class="form-control" type="number" name="amount" min="1" value="1000" required>',
          'Trasferisci risorse');
        html+=form('launch',hidden+location+
          '<label>Attacco Suprema singolo — coordinate bersaglio</label>'+
          '<div class="form-grid-3">'+['g','s','p'].map(k=>'<input class="form-control" name="'+k+
          '" type="number" min="1" value="'+esc(target[k])+'" required>').join('')+'</div>',
          'Lancia attacco');
      }
      html+='</section>';
    }
    html+='<h4>Missioni</h4>';
    for(const m of data.missions||[]){
      const report=m.report?'<small>'+esc(JSON.stringify(m.report))+'</small>':'';
      html+='<div class="glass-panel" style="padding:8px;margin:6px 0;">'+
        esc(m.originKey)+' → '+esc(m.targetKey)+', '+esc(m.status)+
        ' — arrivo '+new Date(m.arrivalAt).toLocaleString('it-IT')+report+'</div>';
    }
    if(!data.missions?.length)html+='<p class="text-muted">Nessuna missione.</p>';
    UI().openModal('NAVE MADRE SUPREMA — ONLINE',html);
    const body=document.getElementById('modal-body');
    body?.querySelectorAll('form[data-sup-action]').forEach(el=>el.addEventListener('submit',async event=>{
      event.preventDefault();
      const formEl=event.currentTarget;
      const btn=formEl.querySelector('button[type=submit]');
      if(btn?.disabled)return;
      if(btn)btn.disabled=true;
      try{
        const formData=new FormData(formEl), params=Object.fromEntries(formData.entries());
        const action=formEl.dataset.supAction;
        for(const n of ['count','amount'])if(params[n]!==undefined)params[n]=Number(params[n]);
        if(action==='build')params.supremeId=id();
        if(action==='launch'){
          params.targetKey=[params.g,params.s,params.p].join('_');
          delete params.g;delete params.s;delete params.p;
        }
        const out=await command(uni,action,params);
        UI().toast('Suprema: operazione registrata.','success');
        const fresh=await refresh(uni);
        if(fresh)render(uni,fresh);
      }catch(err){
        UI().toast(err.message,'error');
        if(btn)btn.disabled=false;
      }
    }));
  }
  async function open(){
    const uni=UI()?.state?.currentUniverse;
    if(!active(uni))return UI().toast('Servizio Suprema solo nello staging autorizzato.','error');
    try{
      UI().openModal('NAVE MADRE SUPREMA — ONLINE','<p>Caricamento dati sicuri…</p>');
      const data=await refresh(uni);
      if(data)render(uni,data);
    }catch(err){UI().toast(err.message,'error');}
  }
  function schedule(uni,data){
    if(timer)clearTimeout(timer);
    const myUid=window.fbAuth?.currentUser?.uid;
    const upcoming=(data?.missions||[]).flatMap(m=>{
      if(m.status==='outbound')return [m.arrivalAt];
      if(m.status==='returning'&&m.attackerUid===myUid)return [m.returnAt];
      return [];
    }).filter(t=>Number.isFinite(t));
    if(!upcoming.length)return;
    const due=Math.min(...upcoming);
    timer=setTimeout(()=>{timer=null;if(UI().state.currentUniverse===uni)onJoin(uni).catch(()=>{});},
      Math.max(50,Math.min(2147483647,due-Date.now()+100)));
  }
  async function onJoin(uni){
    if(!active(uni))return;
    let data=await refresh(uni);
    if(!data)return;
    const now=Date.now();
    for(const mission of data.missions||[]){
      if(mission.status==='outbound'&&mission.arrivalAt<=now){
        try{await command(uni,'resolve',{missionId:mission.id});}catch(error){
          if(!/non ancora|non partecipi|Missione/.test(error.message))UI().toast(error.message,'error');
        }
      }
      if(mission.status==='returning'&&mission.attackerUid===window.fbAuth.currentUser.uid&&mission.returnAt<=now){
        const ship=data.inventory.ships.find(s=>s.missionId===mission.id);
        if(ship)try{await command(uni,'return',{missionId:mission.id,originKey:ship.originKey});}
        catch(error){UI().toast(error.message,'error');}
      }
    }
    data=await refresh(uni);
    if(data)schedule(uni,data);
  }
  window.UniversumOptionC=Object.freeze({open,onJoin,command});
})();
