/** Pianificazione e controllo selettivo delle lavorazioni della Panoramica. */
(function () {
  'use strict';
  const UI = window.UniversumUI;
  const S = window.UniversumServices;
  const D = window.UniversumData;
  function lines(u,p) {
    return [
      {list:p.buildQueue || [], dict:D.BUILDINGS},
      {list:p.moon?.buildQueue || [], dict:D.MOON_BUILDINGS},
      {list:p.localResearchQueue ? [p.localResearchQueue] : [], dict:D.RESEARCHES, field:'localResearchQueue', owner:p},
      {list:u.researchQueue ? [u.researchQueue] : [], dict:D.RESEARCHES, field:'researchQueue', owner:u},
      {list:p.shipyardQueue || [], dict:D.SHIPS, lot:true},
      {list:p.defenseQueue || [], dict:D.DEFENSES, lot:true},
      ...S.ids.map(id=>({list:p.services?.[id]?.queue || [], dict:id===S.forge?D.BUILDINGS:D.RESEARCHES, service:id}))
    ];
  }
  function adjustLots(list,from,now) {
    let cursor = from ? list[from-1].endTime : now;
    for (const job of list.slice(from)) {
      const step = job.unitDurationSec * 1000;
      job.nextUnitEndTime = cursor + step;
      job.endTime = cursor + step * job.remaining;
      cursor = job.endTime;
    }
  }
  function change(u,p,workId,action,now=Date.now()) {
    const wasPending = S.ids.some(id=>p.services?.[id]?.queue?.some(j=>j.workId===workId));
    window.__UniversumEngineModules.advanceQueuesAtTimestamp(u,now);
    if (wasPending && !S.ids.some(id=>p.services?.[id]?.queue?.some(j=>j.workId===workId)))
      throw Error('La lavorazione ha cambiato stato. Verifica la riga e conferma di nuovo.');
    for (const line of lines(u,p)) {
      const i = line.list.findIndex(job=>job.workId===workId);
      if (i < 0) continue;
      if (action === 'up' || action === 'down') {
        const next = i + (action === 'up' ? -1 : 1);
        if (!line.service || next < 0 || next >= line.list.length) return;
        [line.list[i],line.list[next]] = [line.list[next],line.list[i]];
      } else if (action === 'cancel') {
        if (line.field) {
          line.owner[line.field] = null;
          window.UniversumEngine.refreshImperialETA(u,now);
        } else {
          const [removed] = line.list.splice(i,1);
          if (line.lot && S.ids.includes(removed.id)) S.releaseReservations(u,removed.id);
          if (line.lot) adjustLots(line.list,i,now);
        }
      }
      return;
    }
    throw Error('La lavorazione è già terminata o la lista è cambiata.');
  }
  function view(panel,u,p) {
    const controls = panel.querySelector('[data-controls]');
    const table = panel.querySelector('[data-orders]');
    const esc = UI.escapeHTML;
    const signature = S.ids.map(id=>[Boolean(p.fleet?.[id]),S.slots(id,u.researches?.computerTech || 0)].join(':')).join(',');
    if (controls.dataset.signature !== signature) {
      controls.dataset.signature = signature;
      controls.innerHTML = S.ids.filter(id=>p.fleet?.[id]>0).map(id=>{
        const dict = id===S.forge?D.BUILDINGS:D.RESEARCHES;
        return `<label>${esc(D.SHIPS[id].name)} · ${S.slots(id,u.researches?.computerTech || 0)} posti
          <select class="form-control" data-choice="${id}">${Object.values(dict).map(d=>`<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('')}</select></label>
          <button class="btn btn-blue btn-sm" data-add="${id}">Programma</button>`;
      }).join('');
    }
    const groups = lines(u,p);
    // Si ricostruiscono le sole righe quando cambia un dato visualizzato.
    const stateKey = [p.id, signature,
      ...S.ids.map(id=>[p.fleet?.[id], p.services?.[id]?.rate, p.services?.[id]?.suspended]),
      ...groups.flatMap(group=>group.list.map(job=>[job.workId ||= S.uid(),job.endTime,job.nextUnitEndTime,job.remaining,job.reason]))
    ].join('|');
    if (table._stateKey === stateKey) return;
    table._stateKey = stateKey;
    const rows = [];
    for (const id of S.ids) {
      if (!p.fleet?.[id]) continue;
      const s = p.services?.[id];
      const costs = D.SHIPS[id].upkeep;
      const totals = ['metal','crystal','deuterium'].map(k=>UI.formatNum(Math.round(costs[k]*(s?.rate || p.fleet[id]))));
      rows.push(`<p>${esc(D.SHIPS[id].name)} · ${s?.suspended?'Manutenzione non disponibile':'Operativa'} · ${totals.join(' / ')} M/C/D al giorno</p>`);
    }
    for (const line of groups) for (const [i,j] of line.list.entries()) {
      j.workId ||= S.uid();
      const label = esc(line.dict[j.id]?.name || j.id);
      const end = line.lot ? j.nextUnitEndTime + (j.remaining-1)*j.unitDurationSec*1000 : j.endTime;
      const status = line.service ? (p.services[line.service].suspended?'Sospesa': 'In attesa') :
        (line.lot && i ? 'In attesa' : !end ? 'Sospesa' : 'Attiva') + (j.serviceCost?' · automatica':' · manuale');
      const start = line.lot ? j.nextUnitEndTime - j.unitDurationSec*1000 : j.startTime;
      const timing = end ? ` · fine ${new Date(end).toLocaleString('it-IT')} <span class="live-timer" data-end="${end}"></span>` : ' · fine da determinare';
      rows.push(`<div class="glass-panel" style="padding:10px"><strong>${label}</strong> · ${status} ·
        ${line.lot?`${j.total-j.remaining}/${j.total} prodotte · ${j.remaining} residue`:`Lv.${Number(j.targetLevel)}`}
        ${line.service && j.reason ? ' · '+esc(j.reason):''}
        ${start && i && line.lot?' · inizio '+new Date(start).toLocaleString('it-IT'):''}${timing}
        <div>${line.service ? ['up','down'].map((dir,n)=>`<button class="btn btn-ghost btn-sm" data-job="${esc(j.workId)}" data-action="${dir}" ${(n?i===line.list.length-1:i===0)?'disabled':''}>${n?'Giù':'Su'}</button>`).join(''):''}
        <button class="btn btn-ghost btn-sm" data-job="${esc(j.workId)}" data-action="cancel" data-paid="${!line.service}">Annulla</button></div></div>`);
    }
    const html = rows.join('') || '<p class="text-muted">Nessuna lavorazione.</p>';
    if (table._ordersHTML !== html) {
      table._ordersHTML = html;
      table.innerHTML = html;
      for (const el of table.querySelectorAll('.live-timer')) el.textContent = UI.formatDuration(Math.ceil((el.dataset.end-Date.now())/1000));
    }
  }
  UI.bindWorkOrders = function(panel,u,p) {
    const refresh = () => view(panel,u,p);
    refresh();
    panel.addEventListener('click',async event=>{
      const button = event.target.closest('button');
      if (!button || button.disabled) return;
      try {
        if (button.dataset.add) {
          const id = button.dataset.add;
          S.queue(u,p,id,panel.querySelector(`[data-choice="${id}"]`).value);
        } else if (button.dataset.job) {
          const action = button.dataset.action;
          const question = action === 'cancel' ? (button.dataset.paid==='true'?
            'Annullare solo questa lavorazione? Nessun rimborso. Le unità già prodotte restano disponibili.' :
            'Eliminare questa programmazione? Nessuna risorsa è stata addebitata.') : 'Confermi il nuovo ordine?';
          if (!window.confirm(question)) return;
          change(u,p,button.dataset.job,action);
        } else return;
        S.advance(u,Date.now());
        refresh();
        await UI.persistUniverseState();
        UI.updateTopBarNumbers();
      } catch (e) { UI.toast(e.message,'error'); }
    });
  };
  UI.refreshWorkOrders = () => {
    const panel = document.getElementById('work-orders');
    if (panel) view(panel,UI.state.currentUniverse,UI.getActivePlanet());
  };
  UI.changeWorkOrder = change;
})();
