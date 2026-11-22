/** UNIVERSUM / modules/ui/ui-shipyard.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';

  const UI = window.UniversumUI;


  // =========================================================
  // CANTIERE NAVALE & DIFESA
  // =========================================================
  UI.renderShipyardAndDefense = function (viewport) {
    const { escapeHTML, formatNum, formatDuration, svgIcon, resIconTag, artTag } = UI;
    const st = UI.state;
    const uni = st.currentUniverse;
    const Data = window.UniversumData;
    const Engine = window.UniversumEngine;
    const pIdx = UI.getActivePlanetIndex();
    const planet = UI.getActivePlanet();
    const isCreative = uni.creativeMode && !st.isMultiplayerMode;
    const isDef = st.shipyardTab === 'defense';

    const dict = isDef ? Data.DEFENSES : Data.SHIPS;
    const ownedMap = isDef ? planet.defenses : planet.fleet;

    const cards = Object.values(dict).filter((u) => isDef || (u.id !== 'invictus' && u.id !== 'crepuscolo')).map((u) => {
      const owned = Number(ownedMap[u.id] || 0);
      const cost = Engine.getUnitCostAdjusted(planet, u.id, isDef);
      const req = Data.checkRequirements(u.requirements, planet, uni, false);
      const unitSec = Engine.getSingleUnitTime(uni, planet, u.id, isDef);

      const maxByM = cost.metal > 0 ? Math.floor(planet.resources.metal / cost.metal) : 999999;
      const maxByC = cost.crystal > 0 ? Math.floor(planet.resources.crystal / cost.crystal) : 999999;
      const maxByD = cost.deuterium > 0 ? Math.floor(planet.resources.deuterium / cost.deuterium) : 999999;
      const maxAffordable = isCreative ? 100 : Math.max(0, Math.min(maxByM, maxByC, maxByD, u.maxCount ? 1 : 99999));

      return `
        <div class="glass-panel" style="padding:14px; display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; gap:12px; align-items:flex-start;">
            ${artTag(u.id, 'unit-art', u.name)}
            <div style="flex:1; min-width:0;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px; margin-bottom:4px;">
                <strong style="font-size:1.05rem;">${escapeHTML(u.name)}</strong>
                <span class="badge badge-green">In orbita: ${formatNum(owned)}</span>
              </div>
              <p class="text-muted" style="font-size:0.86rem;">${escapeHTML(u.description)}</p>
            </div>
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:10px; font-size:0.84rem; color:var(--res-crystal);">
            <span style="display:inline-flex; align-items:center;">${svgIcon('sword')} ${formatNum(u.attack)}</span>
            <span style="display:inline-flex; align-items:center;">${svgIcon('shield')} ${formatNum(u.shield)}</span>
            <span style="display:inline-flex; align-items:center;">${svgIcon('hull')} ${formatNum(u.hull)}</span>
            ${u.cargo > 0 ? `<span style="display:inline-flex; align-items:center;">${svgIcon('cargo')} ${formatNum(u.cargo)}</span>` : ''}
          </div>
          ${!req.met && !isCreative ? `<div style="color:#ff5252; font-size:0.85rem;">${svgIcon('lock')} Richiede: ${escapeHTML(req.missing.join(', '))}</div>` : ''}
          <div style="display:flex; flex-wrap:wrap; gap:10px; font-size:0.88rem; font-weight:700;">
            ${cost.metal > 0 ? `<span class="cost-item text-metal">${resIconTag('metal')} ${formatNum(cost.metal)}</span>` : ''}
            ${cost.crystal > 0 ? `<span class="cost-item text-crystal">${resIconTag('crystal')} ${formatNum(cost.crystal)}</span>` : ''}
            ${cost.deuterium > 0 ? `<span class="cost-item text-deuterium">${resIconTag('deuterium')} ${formatNum(cost.deuterium)}</span>` : ''}
            <span style="display:inline-flex; align-items:center;">${svgIcon('clock')} ${isCreative ? '<strong class="text-metal">ISTANTANEO (0s)</strong>' : formatDuration(unitSec)}</span>
          </div>

          <div style="display:flex; gap:6px; align-items:center; margin-top:auto;">
            <input type="number" class="form-control unit-qty-input" data-uid="${u.id}" min="1" max="${u.maxCount || 99999}" value="1" style="width:84px; text-align:center;">
            <button type="button" class="btn btn-ghost btn-sm btn-qty-preset" data-uid="${u.id}" data-add="1">+1</button>
            <button type="button" class="btn btn-ghost btn-sm btn-qty-preset" data-uid="${u.id}" data-add="10">+10</button>
            <button type="button" class="btn btn-ghost btn-sm btn-qty-preset" data-uid="${u.id}" data-add="100">+100</button>
            <button type="button" class="btn btn-blue btn-sm btn-qty-max" data-uid="${u.id}" data-max="${maxAffordable}">MAX</button>
          </div>
          <button type="button" class="btn btn-green btn-produce-unit" data-uid="${u.id}" ${(!req.met && !isCreative) ? 'disabled' : ''}>
            PRODUCI UNITÀ
          </button>
        </div>
      `;
    }).join('');

    viewport.innerHTML = `
      <div style="display:flex; gap:10px; margin-bottom:14px;">
        <button type="button" id="tab-btn-ships" class="btn ${!isDef ? 'btn-blue' : 'btn-ghost'}" style="flex:1;">${svgIcon('rocket')} CANTIERE NAVALE</button>
        <button type="button" id="tab-btn-defense" class="btn ${isDef ? 'btn-blue' : 'btn-ghost'}" style="flex:1;">${svgIcon('shield')} DIFESA PLANETARIA</button>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(310px, 1fr)); gap:12px;">
        ${cards}
      </div>
    `;

    document.getElementById('tab-btn-ships')?.addEventListener('click', () => {
      st.shipyardTab = 'ships';
      UI.switchView('shipyard');
    });
    document.getElementById('tab-btn-defense')?.addEventListener('click', () => {
      st.shipyardTab = 'defense';
      UI.switchView('defense');
    });

    viewport.querySelectorAll('.btn-qty-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        const inp = viewport.querySelector(`.unit-qty-input[data-uid="${btn.dataset.uid}"]`);
        if (!inp) return;
        inp.value = Math.max(1, (Number(inp.value) || 0) + Number(btn.dataset.add));
      });
    });

    viewport.querySelectorAll('.btn-qty-max').forEach((btn) => {
      btn.addEventListener('click', () => {
        const inp = viewport.querySelector(`.unit-qty-input[data-uid="${btn.dataset.uid}"]`);
        if (!inp) return;
        inp.value = Math.max(1, Number(btn.dataset.max) || 1);
      });
    });

    viewport.querySelectorAll('.btn-produce-unit').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const uid = btn.dataset.uid;
        const inp = viewport.querySelector(`.unit-qty-input[data-uid="${uid}"]`);
        const qty = Math.max(1, Math.floor(Number(inp?.value) || 1));
        try {
          const res = Engine.buildUnits(uni, pIdx, uid, qty, isDef);
          await UI.persistUniverseState();
          UI.updateTopBarNumbers();
          UI.renderCurrentView();
          UI.playSound(res.instant ? 'complete' : 'click');
          UI.toast(res.instant ? `${qty} unità pronte in orbita!` : `Produzione di ${qty} unità avviata.`, 'success');
        } catch (err) {
          UI.playSound('error');
          UI.toast(err.message, 'error');
        }
      });
    });
  };


  UI.refreshAffordabilityButtons = function () {
    const st = UI.state;
    const uni = st.currentUniverse;
    if (!uni || !['buildings', 'research', 'shipyard', 'defense'].includes(st.currentView)) return;
    const planet = UI.getActivePlanet();
    if (!planet) return;
    const Data = window.UniversumData;
    const Engine = window.UniversumEngine;
    const isCreative = uni.creativeMode && !st.isMultiplayerMode;
    const res = planet.resources || {};

    const prodNow = Engine.getPlanetProduction(planet, uni);
    document.querySelectorAll('.btn-build-structure').forEach((btn) => {
      const b = Data.BUILDINGS[btn.dataset.bid];
      if (!b) return;
      const curLv = Number(planet.buildings?.[b.id] || 0);
      const cost = Data.getBuildingCost(b.id, curLv + 1, false);
      const req = Data.checkRequirements(b.requirements, planet, uni, false);
      const energyDelta = Data.getBuildingEnergyDelta(b.id, curLv + 1, planet.maxTemp) - Data.getBuildingEnergyDelta(b.id, curLv, planet.maxTemp);
      const energyOk = isCreative || energyDelta >= 0 || (prodNow.energyBalance + energyDelta) >= 0;
      const canBuild = isCreative || (req.met && energyOk && res.metal >= cost.metal && res.crystal >= cost.crystal && res.deuterium >= cost.deuterium && (planet.buildQueue || []).length === 0 && (!b.maxLevel || curLv < b.maxLevel));
      btn.disabled = !canBuild;
    });

    document.querySelectorAll('.btn-start-research').forEach((btn) => {
      const r = Data.RESEARCHES[btn.dataset.rid];
      if (!r) return;
      const curLv = Number(uni.researches?.[r.id] || 0);
      const cost = Data.getResearchCost(r.id, curLv + 1);
      const req = Data.checkRequirements(r.requirements, planet, uni, false);
      const canResearch = isCreative || (req.met && res.metal >= cost.metal && res.crystal >= cost.crystal && res.deuterium >= cost.deuterium && !uni.researchQueue);
      btn.disabled = !canResearch;
    });

    const isDef = st.shipyardTab === 'defense';
    const dict = isDef ? Data.DEFENSES : Data.SHIPS;
    document.querySelectorAll('.btn-produce-unit').forEach((btn) => {
      const u = dict[btn.dataset.uid];
      if (!u) return;
      const req = Data.checkRequirements(u.requirements, planet, uni, false);
      btn.disabled = !isCreative && !req.met;
    });
    document.querySelectorAll('.btn-qty-max').forEach((btn) => {
      const u = dict[btn.dataset.uid];
      if (!u) return;
      const cost = Engine.getUnitCostAdjusted(planet, u.id, isDef);
      const maxBy = (v, c) => (c > 0 ? Math.floor(v / c) : 999999);
      btn.dataset.max = isCreative ? 100 : Math.max(0, Math.min(maxBy(res.metal, cost.metal), maxBy(res.crystal, cost.crystal), maxBy(res.deuterium, cost.deuterium), u.maxCount ? 1 : 99999));
    });
  };
})();
