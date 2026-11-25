/** UNIVERSUM / modules/ui/ui-moon.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';

  const UI = window.UniversumUI;


  // =========================================================
  // LUNA / BACINO / GALATTICA SUL PIANETA
  // =========================================================
  UI.renderMoon = function (viewport) {
    const { escapeHTML, formatNum, formatDuration, svgIcon, resIconTag, artTag } = UI;
    const st = UI.state;
    const uni = st.currentUniverse;
    const Data = window.UniversumData;
    const Engine = window.UniversumEngine;
    const Galaxy = window.UniversumGalaxy;
    const pIdx = UI.getActivePlanetIndex();
    const planet = UI.getActivePlanet();
    const isCreative = uni.creativeMode && !st.isMultiplayerMode;

    const galHere = Galaxy.findGalatticaAt ? Galaxy.findGalatticaAt(uni, planet.coords) : null;
    if (galHere) {
      viewport.innerHTML = _renderGalatticaPanelHTML(galHere, planet, null);
      _bindGalatticaPanelHandlers(viewport, galHere);
      return;
    }

    if (planet.galatticaOrigin && !planet.moon && !planet.bacinoSpaziale) {
      viewport.innerHTML = `
        <div class="glass-panel" style="padding:20px; text-align:center;">
          <div style="display:flex; justify-content:center; margin-bottom:10px;">${artTag('galattica', 'unit-art', 'Galattica')}</div>
          <h2 style="font-size:1.15rem; color:var(--res-crystal); margin-bottom:8px;">SLOT ORBITALE CONSUMATO SU ${escapeHTML(planet.name)}</h2>
          <p class="text-muted">Il Bacino è diventato una Galattica: questo pianeta non ha più uno slot orbitale (niente Luna né Bacino).</p>
        </div>
      `;
      return;
    }

    if (!planet.moon && planet.bacinoSpaziale) {
      const def = Data.BACINO_SPAZIALE;
      const b = planet.bacinoSpaziale;
      const missing = Engine.getBacinoMissingForDay(planet);
      const daysRemaining = Math.max(0, def.totalDays - (Number(b.daysPaid) || 0));
      const statusLabel = b.status === 'active' ? 'Attivo' : (b.status === 'stopped' ? 'Fermato' : 'In costruzione');
      const pct = Math.min(100, Math.floor(((Number(b.daysPaid) || 0) / def.totalDays) * 100));
      const invDef = Data.INVICTUS;
      const invCounts = Galaxy.getInvictusCount(planet, uni);
      const invMissing = Engine.getInvictusMissingForDay(planet);
      const invictusHtml = b.status === 'active' ? `
          <div style="margin-top:14px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.12);">
            <p style="margin-bottom:8px; display:flex; align-items:center; gap:8px;">${artTag('invictus', 'unit-art-sm', 'Invictus')}<span><strong>INVICTUS</strong> · Attive: <strong>${invCounts.active}</strong> · In costruzione: <strong>${invCounts.building}</strong> · Totale: <strong>${invCounts.total} / ${invDef.maxPerBacino}</strong></span></p>
            ${(b.invictusConstructions || []).map((c, i) => `<p class="text-muted" style="margin-bottom:6px;">Costruzione ${i + 1}: ${c.status === 'stopped' ? 'Fermato' : 'In costruzione'} · Giorni ${Number(c.daysPaid) || 0} / ${invDef.totalDays} · Mancanti oggi: ${formatNum(invMissing.metal)} M · ${formatNum(invMissing.crystal)} C · ${formatNum(invMissing.deuterium)} D</p>`).join('')}
            <p class="text-muted" style="margin-bottom:10px;">Costruzione: ${invDef.totalDays} giorni reali, rata ${formatNum(invDef.dailyCost.metal)} M / ${formatNum(invDef.dailyCost.crystal)} C / ${formatNum(invDef.dailyCost.deuterium)} D al giorno.</p>
            <button type="button" id="btn-start-invictus" class="btn btn-blue" ${invCounts.total >= invDef.maxPerBacino ? 'disabled' : ''}>COSTRUISCI INVICTUS</button>
          </div>` : '';

      const crepDef = Data.CREPUSCOLO;
      const crep = b.crepuscolo;
      const crepMissing = Engine.getCrepuscoloMissingForDay(planet);
      const isVuoto = b.status === 'active' && Galaxy.isBacinoVuoto(planet, uni);
      const limboHere = uni.crepuscoloLimbo && uni.planets[0] && uni.planets[0].id === planet.id;

      // === M2: immagine Crepuscolo dinamica in base allo stato ===
      const crepuscoloArtId = limboHere
        ? 'crepuscoloLimbo'
        : (crep && (crep.status === 'repairing' || crep.status === 'building'))
          ? 'crepuscoloRepair'
          : 'crepuscolo';

      const crepuscoloHtml = b.status === 'active' ? `
          <div style="margin-top:14px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.12);">
            <p style="margin-bottom:8px; display:flex; align-items:center; gap:8px;">${artTag(crepuscoloArtId, 'unit-art-sm', 'Crepuscolo degli Dei')}<span><strong>CREPUSCOLO DEGLI DEI</strong> · Bacino: <strong>${isVuoto ? 'VUOTO (attualmente libero)' : 'non vuoto'}</strong>${limboHere ? ' · <strong>LIMBO su questo pianeta madre</strong>' : ''}</span></p>
            ${crep ? `<p class="text-muted" style="margin-bottom:8px;">Stato: <strong>${escapeHTML(crep.status)}</strong>${crep.status !== 'active' ? ` · Giorni ${Number(crep.daysPaid) || 0} / ${Number(crep.daysTotal) || crepDef.buildDays} · Mancanti oggi: ${formatNum(crepMissing.metal)} M · ${formatNum(crepMissing.crystal)} C · ${formatNum(crepMissing.deuterium)} D` : ' · Operativa'}</p>` : '<p class="text-muted" style="margin-bottom:8px;">Nessuna Crepuscolo legata a questo Bacino.</p>'}
            ${!crep && isVuoto ? `<p class="text-muted" style="margin-bottom:10px;">Costruzione: ${crepDef.buildDays} giorni reali, rata ${formatNum(crepDef.dailyCost.metal)} M / ${formatNum(crepDef.dailyCost.crystal)} C / ${formatNum(crepDef.dailyCost.deuterium)} D al giorno. Max 1 per impero.</p><button type="button" id="btn-start-crepuscolo" class="btn btn-creative">COSTRUISCI CREPUSCOLO DEGLI DEI</button>` : ''}
            ${!crep && !isVuoto ? '<p class="text-muted">Costruzione Crepuscolo disponibile solo in un Bacino attualmente libero.</p>' : ''}
          </div>` : '';

      const galDef = Data.GALATTICA;
      const galReq = Data.checkRequirements(galDef.requirements, planet, uni, false);
      const galMissing = Engine.getGalatticaMissingForDay(planet);
      const galProject = b.galatticaConstruction;

      // === M3: immagine Galattica nel pannello Bacino ===
      const galatticaHtml = b.status === 'active' ? `
          <div style="margin-top:14px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.12);">
            <p style="margin-bottom:8px; display:flex; align-items:center; gap:8px;">${artTag('galattica', 'unit-art-sm', 'Galattica')}<span><strong>GALATTICA</strong> · Totali impero: <strong>${Galaxy.getGalatticaCount(uni)} / ${galDef.maxPerEmpire}</strong></span></p>
            ${galProject ? `<p class="text-muted">Costruzione Galattica: ${galProject.status === 'stopped' ? 'Fermato' : 'In costruzione'} · Giorni ${Number(galProject.daysPaid) || 0} / ${galDef.buildDays} · Mancanti oggi: ${formatNum(galMissing.metal)} M · ${formatNum(galMissing.crystal)} C · ${formatNum(galMissing.deuterium)} D</p>` : `
              ${!galReq.met ? `<p style="color:#ff5252; margin-bottom:8px;">Requisiti mancanti: ${escapeHTML(galReq.missing.join(', '))}</p>` : ''}
              <p class="text-muted" style="margin-bottom:10px;">Costruzione: ${galDef.buildDays} giorni reali, rata ${formatNum(galDef.dailyCost.metal)} M / ${formatNum(galDef.dailyCost.crystal)} C / ${formatNum(galDef.dailyCost.deuterium)} D. Al termine prende il posto del Bacino. Richiede Bacino senza navi legate.</p>
              <button type="button" id="btn-start-galattica" class="btn btn-creative" ${!galReq.met ? 'disabled' : ''}>COSTRUISCI GALATTICA</button>`}
          </div>` : '';

      const suprema = window.UniversumSuprema;
      const order = b.supremaConstruction;
      const showSuprema = suprema && !st.isMultiplayerMode && b.status === 'active';
      const ownedSupreme = (uni.supremes || []).filter(ship=>ship.planetId===planet.id);
      const missingSupreme = showSuprema && Object.entries(suprema.requirements)
        .filter(([id,level])=>!(planet.localResearches?.[id]>=level))
        .map(([id,level])=>`${Data.RESEARCHES[id].name} Lv.${level}`);
      const ownedDocked = ownedSupreme.filter(ship=>ship.status==='docked');
      const assault = window.UniversumSupremaSieges;
      const supremeOptions = suprema && Object.keys(suprema.slotsPerShip).map(
        id=>`<option value="${id}">${escapeHTML(Data.SHIPS[id].name)}</option>`).join('');
      const siegeRows = (uni.supremaSieges || []).filter(s=>s.originId===planet.id && !s.endedAt).map(s=>
        `<p>Assedio [${s.targetCoords.g}:${s.targetCoords.s}:${s.targetCoords.p}]
          · ${s.started?'Prossima ondata':'Arrivo'} <span class="live-timer" data-end="${s.nextAt}"></span>
          <input type="number" min="1" max="10" step="1" value="${s.waveHours}" aria-label="Frequenza futura in ore">
          <button type="button" class="btn btn-ghost" data-supreme-frequency="${escapeHTML(s.id)}">Imposta frequenza futura</button>
          <button type="button" class="btn btn-ghost" data-supreme-recall="${escapeHTML(s.id)}">Ritira assedio</button></p>`).join('');
      const supremeFleet = ownedDocked.length ? `
        <form id="supreme-controls">
          <label>Suprema <select name="ship" class="form-control">${ownedDocked.map((ship,i)=>
            `<option value="${escapeHTML(ship.id)}">Suprema ${i+1} · ${formatNum(ship.operatingFuel)} D</option>`).join('')}</select></label>
          <label>Nave <select name="unit" class="form-control">${supremeOptions}</select></label>
          <label>Quantità <input name="qty" type="number" min="1" step="1" value="1" class="form-control"></label>
          <label>Ruolo <select name="role" class="form-control"><option value="invasion">Invasione</option><option value="escort">Scorta</option><option value="reserve">Riserva</option></select></label>
          <label>Ruolo attuale <select name="source" class="form-control"><option value="reserve">Riserva</option><option value="invasion">Invasione</option><option value="escort">Scorta</option></select></label>
          <button type="submit" class="btn btn-ghost" value="assign">Cambia ruolo</button>
          <button type="submit" class="btn btn-ghost" value="load">Carica dal pianeta</button>
          <button type="submit" class="btn btn-ghost" value="build">Programma nel cantiere</button>
          <label>Risorsa <select name="resource" class="form-control"><option value="fuel">Serbatoio operativo</option><option value="metal">Metallo</option><option value="crystal">Cristallo</option><option value="deuterium">Deuterio del deposito</option></select></label>
          <button type="submit" class="btn btn-ghost" value="deposit">Trasferisci alla Suprema</button>
          <button type="submit" class="btn btn-ghost" value="withdraw">Trasferisci al pianeta</button>
        </form>
        <form id="supreme-invasion">
          ${ownedDocked.map((ship,i)=>`<label><input type="checkbox" name="selected" value="${escapeHTML(ship.id)}"> Suprema ${i+1}</label>
            <select class="form-control" name="when-full-${escapeHTML(ship.id)}" aria-label="A depositi pieni, Suprema ${i+1}"><option value="return">Rientra a depositi pieni</option><option value="support">Supporto a depositi pieni</option></select>`).join('')}
          <label>Galassia <input name="g" type="number" min="1" max="${uni.galaxies || 1}" required class="form-control"></label>
          <label>Sistema <input name="s" type="number" min="1" max="${uni.systemsPerGalaxy || 499}" required class="form-control"></label>
          <label>Posizione <input name="p" type="number" min="1" max="15" required class="form-control"></label>
          <label>Modalità <select name="mode" class="form-control"><option value="prudente">Prudente</option><option value="offensiva">Offensiva</option></select></label>
          <label>Intervallo ondate (ore) <input name="hours" type="number" min="1" max="10" value="1" required class="form-control"></label>
          <button class="btn btn-blue" type="submit">Lancia invasione</button>
        </form>`:'';
      const supremaHtml = showSuprema ? `
        <div class="glass-panel" style="margin-top:14px; padding:12px;">
          <strong>Nave Madre Suprema</strong>
          ${order ? `<p>${order.status==='stopped'?'Rata sospesa':'In costruzione'} · ${order.daysPaid} / ${suprema.installments} rate
            ${order.status==='building'? `· Prossima rata <span class="live-timer" data-end="${Number(order.nextPaymentAt)}"></span>`:''}</p>
            <button type="button" id="btn-cancel-suprema" class="btn btn-ghost">Annulla costruzione</button>` : `
            <p class="text-muted">40 rate giornaliere da 500.000 M, 300.000 C e 200.000 D.</p>
            ${missingSupreme.length ? `<p class="text-muted">Requisiti mancanti · ${escapeHTML(missingSupreme.join(', '))}</p>` : ''}
            <button type="button" id="btn-start-suprema" class="btn btn-blue"
              ${!Galaxy.isBacinoVuoto(planet,uni) || missingSupreme.length?'disabled':''}>Costruisci Suprema</button>`}
          ${ownedSupreme.map(ship=>`<p class="text-muted">Suprema · ${escapeHTML(ship.status)} · Hangar ${suprema.usedSlots(ship)} / ${suprema.hangarCapacity}
            · Depositi ${formatNum(ship.resources.metal)} M / ${formatNum(ship.resources.crystal)} C / ${formatNum(ship.resources.deuterium)} D
            · Riserva di ritorno ${formatNum(ship.returnReserve || 0)} D
            · Cantiere ${ship.shipyardQueue.length} lotti</p>`).join('')}
          ${ownedSupreme.flatMap(ship=>ship.shipyardQueue.map(order=>`<p>${escapeHTML(Data.SHIPS[order.ship].name)}
            · ${order.remaining} da produrre ${order.finishAt ? `<span class="live-timer" data-end="${order.finishAt}"></span>` : ''}
            <button type="button" class="btn btn-ghost" data-supreme-ship="${escapeHTML(ship.id)}" data-supreme-cancel="${escapeHTML(order.id)}">Annulla unità in attesa</button></p>`)).join('')}
          ${siegeRows}${supremeFleet}
        </div>`:'';

      const bacinoArtId = b.status === 'stopped' ? 'bacinoSpazialeStopped' : b.status === 'building' ? 'bacinoSpazialeBuilding' : 'bacinoSpaziale';
      viewport.innerHTML = `
        <div class="glass-panel" style="padding:20px;">
          <div style="display:flex; gap:12px; align-items:center; margin-bottom:10px;">${artTag(bacinoArtId, 'unit-art', 'Bacino Spaziale')}<h2 style="font-size:1.15rem; color:var(--res-crystal); margin-bottom:8px;">BACINO SPAZIALE SU ${escapeHTML(planet.name)}</h2></div>
          <p style="margin-bottom:10px;">Stato: <strong>${statusLabel}</strong> · Giorni: <strong>${Number(b.daysPaid) || 0} / ${def.totalDays}</strong> · Rimasti: <strong>${daysRemaining}</strong></p>
          <div style="height:10px; background:rgba(255,255,255,0.12); border-radius:6px; overflow:hidden; margin-bottom:12px;">
            <div style="height:100%; width:${pct}%; background:var(--res-crystal);"></div>
          </div>
          ${b.status === 'active'
            ? '<p class="text-muted">Bacino operativo: occupa lo slot orbitale al posto della Luna. Distruggibile solo con missione Distruzione Luna/Bacino (Morte Nera); se distrutto si forma una Luna.</p>'
            : `<p style="margin-bottom:8px;">Rata giornaliera: <span class="cost-item text-metal">${resIconTag('metal')} ${formatNum(def.dailyCost.metal)}</span> <span class="cost-item text-crystal">${resIconTag('crystal')} ${formatNum(def.dailyCost.crystal)}</span> <span class="cost-item text-deuterium">${resIconTag('deuterium')} ${formatNum(def.dailyCost.deuterium)}</span></p>
               <p class="text-muted">Risorse mancanti per il giorno corrente: ${formatNum(missing.metal)} M · ${formatNum(missing.crystal)} C · ${formatNum(missing.deuterium)} D${b.status === 'stopped' ? ' — cantiere fermato, il giorno non viene conteggiato finché la rata non è coperta.' : ''}</p>`}
          ${invictusHtml}
          ${crepuscoloHtml}
          ${galatticaHtml}
          ${supremaHtml}
        </div>
      `;
      async function persistSuprema() {
        await UI.persistUniverseState();
        UI.updateTopBarNumbers();
        UI.renderCurrentView();
      }
      viewport.querySelector('#supreme-controls')?.addEventListener('submit',async e=>{
        e.preventDefault();
        const form=new FormData(e.currentTarget);
        const ship=ownedDocked.find(s=>s.id===form.get('ship'));
        if (!ship) return;
        const count=Number(form.get('qty')), unit=form.get('unit'), role=form.get('role'), now=Date.now();
        try {
          assault.advanceOffline(uni,now);
          switch (e.submitter.value) {
            case 'load':
              suprema.load(uni,planet,ship,unit,count);
              if (role!=='reserve') suprema.assign(ship,unit,count,'reserve',role);
              break;
            case 'assign':
              suprema.assign(ship,unit,count,form.get('source'),role);
              break;
            case 'build':
              suprema.queueShips(ship,uni,Engine,Data.SHIPS,crypto.randomUUID(),unit,count,now);
              suprema.advanceShipyard(ship,now);
              break;
            case 'deposit':
            case 'withdraw':
              assault.transfer(planet,ship,form.get('resource'),e.submitter.value==='deposit'?count:-count,now);
              break;
          }
          await persistSuprema();
        } catch (error) { UI.toast(error.message,'error'); }
      });
      viewport.querySelector('#supreme-invasion')?.addEventListener('submit',async e=>{
        e.preventDefault();
        const form=new FormData(e.currentTarget);
        const coords=['g','s','p'].map(k=>Number(form.get(k)));
        try {
          const target=window.__UniversumGalaxyModules.generateProceduralSlot(uni,...coords);
          if (target.ownerType!=='bot') throw Error('Scegli un pianeta nemico occupato.');
          const selection=form.getAll('selected').map(id=>({id,whenFull:form.get('when-full-'+id)}));
          assault.start(uni,planet,target,crypto.randomUUID(),selection,form.get('mode'),Number(form.get('hours')),Date.now());
          await persistSuprema();
        } catch (error) { UI.toast(error.message,'error'); }
      });
      viewport.querySelectorAll('[data-supreme-frequency]').forEach(button=>button.addEventListener('click',async ()=>{
        const siege=(uni.supremaSieges || []).find(s=>s.id===button.dataset.supremeFrequency);
        if (!siege) return;
        try {
          const now=Date.now();
          assault.advanceOffline(uni,now);
          assault.changeFrequency(siege,Number(button.previousElementSibling.value),now);
          await persistSuprema();
        } catch (error) { UI.toast(error.message,'error'); }
      }));
      viewport.querySelectorAll('[data-supreme-cancel]').forEach(button=>button.addEventListener('click',async ()=>{
        if (!confirm('Annullare le unità ancora in attesa?')) return;
        const ship=ownedSupreme.find(s=>s.id===button.dataset.supremeShip);
        assault.advanceOffline(uni,Date.now());
        if (ship && suprema.cancelShipOrder(ship,button.dataset.supremeCancel)) await persistSuprema();
      }));
      viewport.querySelectorAll('[data-supreme-recall]').forEach(button=>button.addEventListener('click',async ()=>{
        const siege=(uni.supremaSieges || []).find(s=>s.id===button.dataset.supremeRecall);
        const now=Date.now();
        assault.advanceOffline(uni,now);
        if (siege && !siege.endedAt && siege.nextAt<=now) {
          UI.toast('Attendere il recupero delle ondate scadute.','error');
        } else if (siege && assault.recall(uni,siege,now)) await persistSuprema();
      }));
      document.getElementById('btn-start-suprema')?.addEventListener('click', async () => {
        try {
          suprema.start(uni,planet,crypto.randomUUID(),Date.now(),Galaxy.getInvictusCount(planet,uni).total);
          await UI.persistUniverseState();
          UI.renderCurrentView();
        } catch (error) { UI.toast(error.message,'error'); }
      });
      document.getElementById('btn-cancel-suprema')?.addEventListener('click', async () => {
        if (!confirm('Annullare la costruzione? Sarà rimborsato il 50% delle rate già pagate.')) return;
        try {
          if (!suprema.cancel(planet,order.id)) return;
          await UI.persistUniverseState();
          UI.updateTopBarNumbers();
          UI.renderCurrentView();
        } catch (error) { UI.toast(error.message,'error'); }
      });
      document.getElementById('btn-start-galattica')?.addEventListener('click', async () => {
        try {
          const res = Galaxy.startGalatticaConstruction(uni, pIdx);
          await UI.persistUniverseState();
          UI.updateTopBarNumbers();
          UI.renderCurrentView();
          UI.playSound('complete');
          UI.toast(res.instant ? 'Galattica completata: ha preso il posto del Bacino!' : 'Costruzione Galattica avviata: 100 giorni reali a rate giornaliere.', 'success');
        } catch (err) {
          UI.playSound('error');
          UI.toast(err.message, 'error');
        }
      });
      document.getElementById('btn-start-crepuscolo')?.addEventListener('click', async () => {
        try {
          const res = Galaxy.startCrepuscoloConstruction(uni, pIdx);
          await UI.persistUniverseState();
          UI.updateTopBarNumbers();
          UI.renderCurrentView();
          UI.playSound('complete');
          UI.toast(res.instant ? 'Crepuscolo degli Dei operativa!' : 'Costruzione Crepuscolo avviata: 100 giorni reali a rate giornaliere.', 'success');
        } catch (err) {
          UI.playSound('error');
          UI.toast(err.message, 'error');
        }
      });
      document.getElementById('btn-start-invictus')?.addEventListener('click', async () => {
        try {
          const res = Galaxy.startInvictusConstruction(uni, pIdx);
          await UI.persistUniverseState();
          UI.updateTopBarNumbers();
          UI.renderCurrentView();
          UI.playSound('complete');
          UI.toast(res.instant ? 'Invictus pronta al Bacino!' : 'Costruzione Invictus avviata: 20 giorni reali a rate giornaliere.', 'success');
        } catch (err) {
          UI.playSound('error');
          UI.toast(err.message, 'error');
        }
      });
      return;
    }

    if (!planet.moon) {
      const cost = Galaxy.getMoonCreationCost(uni);
      const bDef = Data.BACINO_SPAZIALE;
      const bacinoReq = Data.getBacinoStartRequirements(uni, planet);
      viewport.innerHTML = `
        <div class="glass-panel" style="padding:20px; text-align:center;">
          <div style="margin-bottom:12px; display:flex; justify-content:center;">${artTag('lunarBase', 'unit-art', 'Base Lunare')}</div>
          <h2 style="font-size:1.15rem; color:var(--res-crystal); margin-bottom:8px;">NESSUNA LUNA IN ORBITA SU ${escapeHTML(planet.name)}</h2>
          <p class="text-muted" style="margin-bottom:14px;">${uni.creativeMode && !st.isMultiplayerMode ? 'Modalità Creativa: creazione diretta della Luna.' : 'In modalità Normale la Luna può nascere da un grande scontro orbitale. Vai in Commercio e BOT e ingaggia il Mercante di Lune: consuma la flotta stazionata e 1.000.000 di Deuterio, senza toccare difese o pianeta.'}</p>
          ${uni.creativeMode && !st.isMultiplayerMode ? `<div style="margin-bottom:16px; font-weight:700; display:flex; justify-content:center; flex-wrap:wrap; gap:12px;">
            <span class="cost-item text-metal">${resIconTag('metal')} ${formatNum(cost.metal)}</span>
            <span class="cost-item text-crystal">${resIconTag('crystal')} ${formatNum(cost.crystal)}</span>
            <span class="cost-item text-deuterium">${resIconTag('deuterium')} ${formatNum(cost.deuterium)}</span>
          </div>
          <button type="button" id="btn-create-moon" class="btn btn-green">${svgIcon('moon')} CREA LUNA ORA</button>` : `<button type="button" id="btn-go-moon-merchant" class="btn btn-blue">${svgIcon('moon')} VAI AL MERCANTE DI LUNE</button>`}
          <div style="margin-top:18px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.12);">
            <p class="text-muted" style="margin-bottom:10px;">Oppure, al posto della Luna: Bacino Spaziale in ${bDef.totalDays} giorni reali, rate di ${formatNum(bDef.dailyCost.metal)} M / ${formatNum(bDef.dailyCost.crystal)} C / ${formatNum(bDef.dailyCost.deuterium)} D al giorno (totale ${formatNum(bDef.totalCost.metal)} M / ${formatNum(bDef.totalCost.crystal)} C / ${formatNum(bDef.totalCost.deuterium)} D).</p>
            ${!isCreative && !bacinoReq.met ? `<p style="color:var(--btn-red);font-size:0.87rem;margin-bottom:10px">${svgIcon('lock')} Requisiti mancanti: ${escapeHTML(bacinoReq.missing.join(', '))}</p>` : ''}
            <button type="button" id="btn-start-bacino" class="btn btn-blue" ${!isCreative && !bacinoReq.met ? 'disabled' : ''}>AVVIA BACINO SPAZIALE</button>
          </div>
        </div>
      `;

      document.getElementById('btn-go-moon-merchant')?.addEventListener('click', () => UI.switchView('diplomacy'));
      document.getElementById('btn-create-moon')?.addEventListener('click', async () => {
        try {
          Galaxy.createMoon(uni, pIdx);
          await UI.persistUniverseState();
          UI.refreshPlanetSelector();
          UI.updateTopBarNumbers();
          UI.renderCurrentView();
          UI.playSound('complete');
          UI.toast('Nuova Luna stabilizzata in orbita!', 'success');
        } catch (err) {
          UI.playSound('error');
          UI.toast(err.message, 'error');
        }
      });
      document.getElementById('btn-start-bacino')?.addEventListener('click', async () => {
        try {
          Galaxy.startBacinoSpaziale(uni, pIdx);
          await UI.persistUniverseState();
          UI.refreshPlanetSelector();
          UI.updateTopBarNumbers();
          UI.renderCurrentView();
          UI.playSound('complete');
          UI.toast('Cantiere Bacino Spaziale avviato: 20 giorni reali a rate giornaliere.', 'success');
        } catch (err) {
          UI.playSound('error');
          UI.toast(err.message, 'error');
        }
      });
      return;
    }

    const moon = planet.moon;
    const usedFields = Data.getMoonUsedFields(moon);
    const maxFields = Data.getMoonMaxFields(moon);
    const otherMoons = uni.planets
      .map((pl, i) => ({ pl, i }))
      .filter((item) => item.i !== pIdx && item.pl.moon);

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div class="glass-panel" style="padding:14px;">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <h2 style="font-size:1.2rem; color:#fff; display:inline-flex; align-items:center; gap:6px;">${svgIcon('moon')} ${escapeHTML(moon.name || 'Luna')}</h2>
              <button type="button" id="btn-rename-moon" class="btn btn-blue btn-sm" style="min-width:44px; min-height:44px;">${svgIcon('edit')} Rinomina Luna</button>
            </div>
            <span class="badge badge-blue">Campi Lunari: ${usedFields} / ${maxFields}</span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(305px, 1fr)); gap:12px;">
          ${Object.values(Data.MOON_BUILDINGS).map((mb) => {
            const curLv = Number(moon.buildings?.[mb.id] || 0);
            const nextLv = curLv + 1;
            const cost = Data.getBuildingCost(mb.id, nextLv, true);
            const buildSec = Engine.getBuildingBuildTime(uni, planet, mb.id, nextLv, true);
            return `
              <div class="glass-panel" style="padding:14px; display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; gap:12px; align-items:flex-start;">
                  ${artTag(mb.id, 'unit-art', mb.name)}
                  <div style="flex:1; min-width:0;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px; margin-bottom:4px;">
                      <strong>${escapeHTML(mb.name)}</strong>
                      <span class="badge badge-blue">Lv.${curLv}</span>
                    </div>
                    <p class="text-muted" style="font-size:0.86rem;">${escapeHTML(mb.description)}</p>
                  </div>
                </div>
                <div style="font-size:0.88rem; font-weight:700; display:flex; flex-wrap:wrap; gap:10px;">
                  <span class="cost-item text-metal">${resIconTag('metal')} ${formatNum(cost.metal)}</span>
                  <span class="cost-item text-crystal">${resIconTag('crystal')} ${formatNum(cost.crystal)}</span>
                  <span class="cost-item text-deuterium">${resIconTag('deuterium')} ${formatNum(cost.deuterium)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto;">
                  <span style="display:inline-flex; align-items:center;">${svgIcon('clock')} ${isCreative ? '<strong class="text-metal">ISTANTANEO (0s)</strong>' : formatDuration(buildSec)}</span>
                  <button type="button" class="btn btn-green btn-sm btn-build-moon" data-mbid="${mb.id}">COSTRUISCI</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:1rem; color:var(--btn-gold); margin-bottom:8px;">PORTALE IPERSPAZIALE</h3>
          ${otherMoons.length === 0 ? '<p class="text-muted">Crea almeno un’altra Luna su una colonia per attivare i salti tra Portali.</p>' : `
            <div class="form-group">
              <label>Luna di Destinazione</label>
              <select id="jumpgate-dest-select" class="form-control">
                ${otherMoons.map((m) => `<option value="${m.i}">${escapeHTML(m.pl.moon.name || 'Luna')} (${escapeHTML(m.pl.name)} [${m.pl.coords.g}:${m.pl.coords.s}:${m.pl.coords.p}])</option>`).join('')}
              </select>
            </div>
            <button type="button" id="btn-trigger-jumpgate" class="btn btn-creative" style="width:100%;">${svgIcon('bolt')} TELETRASPORTA TUTTA LA FLOTTA (10.000 D)</button>
          `}
        </div>
      </div>
    `;

    document.getElementById('btn-rename-moon')?.addEventListener('click', () => UI.openRenameMoonModal(pIdx));

    viewport.querySelectorAll('.btn-build-moon').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const res = Engine.startBuilding(uni, pIdx, btn.dataset.mbid, true);
          await UI.persistUniverseState();
          UI.updateTopBarNumbers();
          UI.renderCurrentView();
          UI.playSound(res.instant ? 'complete' : 'click');
          UI.toast(res.instant ? 'Struttura lunare completata!' : 'Costruzione lunare avviata.', 'success');
        } catch (err) {
          UI.playSound('error');
          UI.toast(err.message, 'error');
        }
      });
    });

    document.getElementById('btn-trigger-jumpgate')?.addEventListener('click', async () => {
      try {
        const destIdx = Number(document.getElementById('jumpgate-dest-select').value);
        const res = Galaxy.useJumpGate(uni, pIdx, destIdx, planet.fleet);
        await UI.persistUniverseState();
        UI.updateTopBarNumbers();
        UI.renderCurrentView();
        UI.playSound('complete');
        UI.toast(`Salto iperspaziale completato: ${res.movedCount} navi teletrasportate!`, 'creative');
      } catch (err) {
        UI.playSound('error');
        UI.toast(err.message, 'error');
      }
    });
  };
})();
