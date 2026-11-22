/** UNIVERSUM — Accademia Imperiale, esclusivamente offline.
 * Stato serializzato in universe.tutorial tramite IndexedDB esistente.
 */
(function () {
  'use strict';
  const UI = () => window.UniversumUI;
  const game = () => {
    const st = UI()?.state;
    return st && !st.isMultiplayerMode ? st.currentUniverse : null;
  };
  const tutorial = () => game()?.tutorial;
  const planet = u => u?.planets?.[0];
  const lv = (p, id) => Number(p?.buildings?.[id] || 0);
  const tech = (u, id) => Number(u?.researches?.[id] || 0);
  const steps = [
    { title: 'Il tuo primo pianeta', chapter: 'La nascita dell’Impero', view: 'overview', text: 'Apri la Panoramica e osserva le risorse e le coordinate del Pianeta Madre.', done: (u,t) => !!t.visited.overview },
    { title: 'La prima miniera', chapter: 'La nascita dell’Impero', view: 'buildings', text: 'Costruisci la Miniera di Metallo di livello 1. Aspetta la fine della costruzione.', done: u => lv(planet(u),'metalMine') >= 1 },
    { title: 'Energia per crescere', chapter: 'La nascita dell’Impero', view: 'buildings', text: 'Costruisci una Centrale Solare. Le miniere consumano energia: controlla il bilancio nel gioco.', done: u => lv(planet(u),'solarPlant') >= 1 },
    { title: 'Un’economia completa', chapter: 'La nascita dell’Impero', view: 'buildings', text: 'Costruisci una Miniera di Cristallo e un Sintetizzatore di Deuterio, entrambi di livello 1.', done: u => lv(planet(u),'crystalMine') >= 1 && lv(planet(u),'deuteriumSynth') >= 1 },
    { title: 'La scienza', chapter: 'Tecnologia e industria', view: 'buildings', text: 'Costruisci il Laboratorio di Ricerca di livello 1.', done: u => lv(planet(u),'researchLab') >= 1 },
    { title: 'La prima tecnologia', chapter: 'Tecnologia e industria', view: 'research', text: 'Ricerca Tecnologia della Combustione al livello 1: servirà per i Caccia Leggeri.', done: u => tech(u,'combustionDrive') >= 1 },
    { title: 'Automazione', chapter: 'Tecnologia e industria', view: 'buildings', text: 'Porta la Fabbrica dei Robot al livello 2 per sbloccare il Cantiere Navale.', done: u => lv(planet(u),'roboticsFactory') >= 2 },
    { title: 'Il primo cantiere', chapter: 'Tecnologia e industria', view: 'buildings', text: 'Costruisci il Cantiere Navale di livello 1.', done: u => lv(planet(u),'shipyard') >= 1 },
    { title: 'La prima flotta', chapter: 'Tecnologia e industria', view: 'shipyard', text: 'Produci almeno un Caccia Leggero nel Cantiere Navale.', done: u => Number(planet(u)?.fleet?.lightFighter || 0) >= 1 },
    { title: 'Esplora la galassia', chapter: 'Esplorazione spaziale', view: 'galaxy', text: 'Apri la schermata Galassia e osserva i pianeti e i BOT intorno a te.', done: (u,t) => !!t.visited.galaxy },
    { title: 'Intelligence', chapter: 'Esplorazione spaziale', view: 'espionage', text: 'Costruisci Sonde Spia (vedi i requisiti nel Cantiere), inviale contro un pianeta BOT e attendi un rapporto di spionaggio.', done: (u,t) => (u.spyReports || []).some(r => Number(r.time || 0) > Number(t.baseline.spy || 0)) },
    { title: 'La prima operazione', chapter: 'Comando Imperiale', view: 'fleet', text: 'Consulta il simulatore nella sezione Spionaggio, prepara la flotta e invia un attacco contro un BOT accessibile. La missione si completa all’invio; l’esito dipende dalla battaglia.', done: (u,t) => !!t.visited.attackSent }
  ];
  // I sotto-obiettivi descrivono il percorso reale, senza cambiare le 12 missioni.
  // Sono ricalcolati sullo stato di gioco, quindi funzionano anche sui salvataggi esistenti.
  const task = (text, done, view, kind, id, target) => ({ text, done: !!done, view, kind, id, target });
  const building = (u, id, target, name) => task(`${name} al livello ${target}`, lv(planet(u),id) >= target, 'buildings', 'building', id, target);
  const research = (u, id, target, name) => task(`${name} al livello ${target}`, tech(u,id) >= target, 'research', 'research', id, target);
  function energyFor(u,id) {
    if (u.creativeMode) return true;
    const p=planet(u), data=window.UniversumData, engine=window.UniversumEngine;
    if (!p || !data?.getBuildingEnergyDelta || !engine?.getPlanetProduction) return false;
    try {
      const now=lv(p,id), delta=data.getBuildingEnergyDelta(id,now+1,p.maxTemp)-data.getBuildingEnergyDelta(id,now,p.maxTemp);
      return engine.getPlanetProduction(p,u).energyBalance + delta >= 0;
    } catch { return false; }
  }
  const power = (u,id,name) => task(`Energia sufficiente per potenziare ${name}`, energyFor(u,id), 'buildings', 'energy', id);
  function subgoals(u,t) {
    const p=planet(u), i=t.step;
    switch (i) {
      case 0: return [task('Apri Panoramica e individua le risorse del Pianeta Madre',t.visited?.overview,'overview')];
      case 1: return [
        building(u,'solarPlant',1,'Centrale Solare'),
        ...(lv(p,'metalMine') < 1 ? [power(u,'metalMine','la Miniera di Metallo')] : []),
        building(u,'metalMine',1,'Miniera di Metallo')
      ];
      case 2: return [building(u,'solarPlant',1,'Centrale Solare'),task('Controlla il saldo di energia negli Edifici',lv(p,'solarPlant')>=1,'buildings')];
      case 3: return [
        ...(lv(p,'crystalMine') < 1 ? [power(u,'crystalMine','la Miniera di Cristallo')] : []),
        building(u,'crystalMine',1,'Miniera di Cristallo'),
        ...(lv(p,'deuteriumSynth') < 1 ? [power(u,'deuteriumSynth','il Sintetizzatore di Deuterio')] : []),
        building(u,'deuteriumSynth',1,'Sintetizzatore di Deuterio')
      ];
      case 4: return [building(u,'researchLab',1,'Laboratorio di Ricerca')];
      case 5: return [
        building(u,'researchLab',1,'Laboratorio di Ricerca'),
        research(u,'energyTech',1,'Tecnologia Energetica'),
        research(u,'combustionDrive',1,'Propulsore a Combustione')
      ];
      case 6: return [building(u,'roboticsFactory',1,'Fabbrica dei Robot'),building(u,'roboticsFactory',2,'Fabbrica dei Robot')];
      case 7: return [building(u,'roboticsFactory',2,'Fabbrica dei Robot'),building(u,'shipyard',1,'Cantiere Navale')];
      case 8: return [
        building(u,'shipyard',1,'Cantiere Navale'),
        research(u,'combustionDrive',1,'Propulsore a Combustione'),
        task('Costruisci almeno un Caccia Leggero nel Cantiere Navale',Number(p?.fleet?.lightFighter||0)>=1,'shipyard')
      ];
      case 9: return [task('Apri Galassia e osserva i sistemi vicini',t.visited?.galaxy,'galaxy')];
      case 10: return [
        building(u,'researchLab',3,'Laboratorio di Ricerca'),
        research(u,'espionageTech',2,'Tecnologia dello Spionaggio'),
        research(u,'combustionDrive',3,'Propulsore a Combustione'),
        building(u,'shipyard',3,'Cantiere Navale'),
        task('Produci almeno una Sonda Spia',Number(p?.fleet?.espionageProbe||0)>=1,'shipyard'),
        task('Invia una Sonda Spia verso un BOT e attendi il rapporto',steps[10].done(u,t),'espionage')
      ];
      case 11: return [
        task('Disponi di almeno un Caccia Leggero sul Pianeta Madre',Number(p?.fleet?.lightFighter||0)>=1,'shipyard'),
        task('Consulta lo Spionaggio per valutare il bersaglio e il simulatore',true,'espionage'),
        task('Invia una missione di attacco contro un BOT',t.visited?.attackSent,'fleet')
      ];
      default: return [];
    }
  }
  const guidance = [
    'La Panoramica mostra il tuo pianeta, le risorse disponibili e la posizione nell’universo.',
    'Prima della miniera serve energia: negli Edifici avvia la Centrale Solare, attendi il completamento e poi costruisci la Miniera di Metallo. Senza energia sufficiente, il gioco blocca gli upgrade di miniere e sintetizzatori.',
    'Controlla il riquadro Energia negli Edifici: energia prodotta meno energia utilizzata = saldo. La Centrale Solare serve ad aumentarlo. Se è già stata costruita, questo obiettivo è soddisfatto.',
    'Anche Cristallo e Deuterio consumano energia. Se appare «Energia insufficiente», potenzia la Centrale Solare PRIMA di avviare la miniera o il sintetizzatore; la costruzione deve poi terminare.',
    'Per costruire il Laboratorio servono Metallo, Cristallo e Deuterio. Se mancano risorse, attendi che le miniere le producano; negli Edifici controlla costi e coda di costruzione.',
    'Nel pannello Ricerche sviluppa PRIMA Tecnologia Energetica livello 1: è un requisito obbligatorio del Propulsore a Combustione. Solo dopo potrai ricercare il Propulsore livello 1.',
    'Negli Edifici costruisci la Fabbrica dei Robot di livello 1, attendi il termine e ripeti per il livello 2. Servirà a sbloccare il Cantiere Navale.',
    'Il Cantiere Navale si sblocca con Fabbrica dei Robot livello 2. Se il pulsante è disabilitato, controlla risorse e coda degli edifici.',
    'Dopo il Cantiere Navale livello 1 e Propulsore a Combustione livello 1, apri Cantiere, seleziona Caccia Leggero, avvia la produzione e attendi che la nave sia disponibile.',
    'Nella Galassia puoi vedere i sistemi, i pianeti vicini e gli avversari BOT. Aprila prima di pianificare una missione.',
    'Le Sonde Spia richiedono Cantiere Navale 3, Propulsore a Combustione 3 e Tecnologia dello Spionaggio 2 (che richiede Laboratorio 3). Costruisci la sonda e inviala a un BOT: aspetta il rapporto.',
    'Prima di attaccare consulta il simulatore dalla sezione Spionaggio e valuta il bersaglio. Prepara una flotta reale, apri Flotta e invia un attacco a un BOT. Il risultato dello scontro non è garantito.'
  ];
  function activeHint(u,item) {
    if (!item || item.done) return '';
    const p=planet(u);
    if (item.kind==='energy') return '⚡ Energia insufficiente: vai in Edifici e aumenta la Centrale Solare. Solo con il saldo necessario potrai avviare questa miniera o il sintetizzatore.';
    if (item.kind !== 'building' && item.kind !== 'research') return 'Segui il sotto-obiettivo evidenziato e completa l’azione nel gioco.';
    const data=window.UniversumData;
    const isBuilding=item.kind==='building';
    const id=item.id, next=(isBuilding?lv(p,id):tech(u,id))+1;
    const cost= isBuilding ? data?.getBuildingCost?.(id,next,false) : data?.getResearchCost?.(id,next,false);
    const res=p?.resources || {};
    if (cost && !u.creativeMode) {
      const lacking=['metal','crystal','deuterium'].filter(k => (res[k]||0) < (cost[k]||0));
      if (lacking.length) return `Risorse mancanti: ${lacking.map(k=>({metal:'Metallo',crystal:'Cristallo',deuterium:'Deuterio'})[k]).join(', ')}. Attendi la produzione o migliora l’economia.`;
    }
    if (isBuilding && p?.buildQueue?.length) return 'Coda edifici occupata: attendi che la costruzione in corso termini prima di avviarne un’altra.';
    if (!isBuilding && u.researchQueue) return 'Ricerca in corso: attendi il completamento prima di iniziare la prossima.';
    return `Apri ${label(item.view)} e avvia il livello richiesto. L’obiettivo sarà verificato a completamento avvenuto.`;
  }
  let changing = false;
  let lastRender = '';
  const getNode = () => document.getElementById('academy-panel');
  function save(u) { window.UniversumDB?.save(u).catch(e => console.warn('[Accademia] Salvataggio:', e)); }
  function ensureUI() {
    if (getNode()) return;
    const el = document.createElement('aside');
    el.id = 'academy-panel';
    el.setAttribute('aria-label','Accademia Imperiale');
    document.body.append(el);
    el.addEventListener('click', e => {
      const btn = e.target.closest('button[data-academy]');
      if (!btn) return;
      const u=game(), t=tutorial();
      if (!u || !t) return;
      if (btn.dataset.academy === 'go') { const todo=subgoals(u,t).find(x=>!x.done); UI()?.switchView(todo?.view || steps[t.step]?.view || 'overview'); }
      if (btn.dataset.academy === 'hide') { t.hidden = true; save(u); render(true); }
      if (btn.dataset.academy === 'show') { t.hidden = false; save(u); render(true); }
      if (btn.dataset.academy === 'skip' && !t.done) {
        if (!window.confirm('Saltare questa missione? Non riceverai ricompense (il tutorial non modifica le risorse).')) return;
        advance(u,t);
      }
      if (btn.dataset.academy === 'stop') {
        if (!window.confirm('Disattivare il tutorial? Potrai riavviarlo dal menu Partite.')) return;
        t.enabled = false; save(u); clear();
      }
    });
  }
  function render(force = false) {
    const u=game(), t=tutorial();
    if (!u || !t?.enabled) { clear(); return; }
    ensureUI();
    const el = getNode();
    const curr = steps[t.step];
    const done = t.done || !curr;
    const tasks=done ? [] : subgoals(u,t);
    const focus=tasks.find(x=>!x.done);
    const html = t.hidden
      ? `<button type="button" data-academy="show" class="academy-minimized">🎓 Accademia Imperiale ${done ? '✓' : `${Math.min(t.step+1,steps.length)}/${steps.length}`} · Mostra</button>`
      : `<div class="academy-heading"><strong>🎓 ACCADEMIA IMPERIALE</strong><button data-academy="hide" title="Riduci il tutorial" aria-label="Riduci">−</button></div>
       <div class="academy-progress-caption">${done ? 'Percorso completato' : `${curr.chapter} · Missione ${t.step+1}/${steps.length}`}</div>
       <div class="academy-track"><div style="width:${done ? 100 : Math.round(t.step/steps.length*100)}%"></div></div>
       <h3>${done ? 'Diploma di Comandante! 🏅' : curr.title}</h3>
       <p>${done ? 'Hai completato l’Accademia Imperiale. L’universo è tuo: continua a espandere l’Impero!' : guidance[t.step]}</p>
       ${done ? '' : `<div class="academy-subtitle">PASSAGGI DA SEGUIRE · ${tasks.filter(x=>x.done).length}/${tasks.length}</div><ol class="academy-subgoals">${tasks.map(x=>`<li class="${x.done ? 'academy-done' : x===focus ? 'academy-active' : ''}"><span>${x.done ? '✓' : x===focus ? '➜' : '○'}</span><span>${x.text}</span></li>`).join('')}</ol><p class="academy-hint">${activeHint(u,focus)}</p>`}
       <div class="academy-actions">${done ? '' : `<button data-academy="go" class="academy-primary">Apri ${label(focus?.view || curr.view)}</button><button data-academy="skip" class="academy-secondary">Salta</button>`}<button data-academy="stop" class="academy-secondary">Chiudi</button></div>`;
    if (force || html !== lastRender) { el.innerHTML=html; lastRender=html; }
    el.classList.toggle('academy-compact',!!t.hidden);
  }
  function label(view) {return ({overview:'Panoramica',buildings:'Edifici',research:'Ricerche',shipyard:'Cantiere',galaxy:'Galassia',espionage:'Spionaggio',fleet:'Flotta'})[view] || view;}
  function setBaseline(u,t) {
    const s=steps[t.step];
    if (s && t.step===10 && !t.baseline.spy) t.baseline.spy = Date.now();
  }
  function advance(u,t) {
    t.step = Math.min(steps.length,t.step+1);
    t.done = t.step >= steps.length;
    t.hidden = false;
    if (!t.done) { t.visited = {}; setBaseline(u,t); }
    save(u); render(true);
    UI()?.toast?.(t.done ? '🎓 Accademia Imperiale completata!' : '🎓 Missione completata! Nuovo obiettivo disponibile.', 'success');
  }
  function check() {
    if (changing) return;
    const u=game(),t=tutorial();
    if (!u || !t?.enabled) return;
    changing = true;
    try {
      if (!t.done) {
        t.visited ||= {}; t.baseline ||= {};
        setBaseline(u,t);
        const s=steps[t.step];
        if (s && s.done(u,t)) advance(u,t);
      }
      render();
    } finally { changing=false; }
  }
  function onView(view) {
    const u=game(), t=tutorial();
    if (!u || !t?.enabled || t.done) return;
    const s=steps[t.step];
    if (s?.view===view && (view==='overview' || view==='galaxy')) {
      t.visited ||= {}; t.visited[view]=true;
      check();
    }
  }
  function onStart() {
    const u=game();
    if (!u?.tutorial?.enabled) { clear(); return; }
    ensureUI();
    check();
    render(true);
  }
  function clear() { getNode()?.remove(); lastRender=''; }
  // Hook sulle azioni realmente completate: non vengono mai simulate o alterate.
  function interceptLaunch(api, method) {
    if (!api || typeof api[method] !== 'function' || api[method].__academyWrapped) return;
    const original=api[method];
    const wrapped=function (...args) {
      const result=original.apply(this,args);
      const mark= r => {
        const u=game(),t=tutorial();
        if (u===args[0] && t?.enabled && t.step===11 && args[3]==='attack' && r) {
          t.visited ||= {}; t.visited.attackSent=true; check();
        }
        return r;
      };
      return result && typeof result.then==='function' ? result.then(mark) : mark(result);
    };
    wrapped.__academyWrapped=true;
    api[method]=wrapped;
  }
  interceptLaunch(window.UniversumGalaxy,'launchFleet');
  interceptLaunch(window.UniversumSiege,'launchEnhancedFleet');
  window.UniversumTutorial={check,onView,onStart,clear,steps};
})();
