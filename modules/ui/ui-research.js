/** UNIVERSUM / modules/ui/ui-research.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';

  const UI = window.UniversumUI;


  // =========================================================
  // RICERCHE
  // =========================================================
  UI.renderResearch = function (viewport) {
    const { escapeHTML, formatNum, formatDuration, svgIcon, resIconTag, artTag } = UI;
    const st = UI.state;
    const uni = st.currentUniverse;
    const Data = window.UniversumData;
    const Engine = window.UniversumEngine;
    const pIdx = UI.getActivePlanetIndex();
    const planet = UI.getActivePlanet();
    const isCreative = uni.creativeMode && !st.isMultiplayerMode;

    const cards = Object.values(Data.RESEARCHES).map((r) => {
      const curLv = Number(uni.researches[r.id] || 0);
      const nextLv = curLv + 1;
      const cost = Data.getResearchCost(r.id, nextLv);
      const req = Data.checkRequirements(r.requirements, planet, uni, false);
      const resSec = Engine.getResearchTime(uni, r.id, nextLv);

      const hasM = isCreative || planet.resources.metal >= cost.metal;
      const hasC = isCreative || planet.resources.crystal >= cost.crystal;
      const hasD = isCreative || planet.resources.deuterium >= cost.deuterium;
      const canResearch = isCreative || (req.met && hasM && hasC && hasD && !uni.researchQueue);

      return `
        <div class="glass-panel" style="padding:14px; display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; gap:12px; align-items:flex-start;">
            ${artTag(r.id, 'unit-art', r.name)}
            <div style="flex:1; min-width:0;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px; margin-bottom:4px;">
                <strong style="font-size:1.05rem;">${escapeHTML(r.name)}</strong>
                <span class="badge badge-blue">Lv.${curLv}</span>
              </div>
              <p class="text-muted" style="font-size:0.88rem;">${escapeHTML(r.description)}</p>
            </div>
          </div>
          ${!req.met && !isCreative ? `<div style="color:#ff5252; font-size:0.85rem;">${svgIcon('lock')} Richiede: ${escapeHTML(req.missing.join(', '))}</div>` : ''}
          <div style="display:flex; flex-wrap:wrap; gap:10px; font-size:0.9rem; font-weight:700;">
            ${cost.metal > 0 ? `<span class="cost-item" style="color:${hasM ? 'var(--res-metal)' : 'var(--btn-red)'};">${resIconTag('metal')} ${formatNum(cost.metal)}</span>` : ''}
            ${cost.crystal > 0 ? `<span class="cost-item" style="color:${hasC ? 'var(--res-crystal)' : 'var(--btn-red)'};">${resIconTag('crystal')} ${formatNum(cost.crystal)}</span>` : ''}
            ${cost.deuterium > 0 ? `<span class="cost-item" style="color:${hasD ? 'var(--res-deuterium)' : 'var(--btn-red)'};">${resIconTag('deuterium')} ${formatNum(cost.deuterium)}</span>` : ''}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:auto;">
            <span style="font-size:0.88rem; display:inline-flex; align-items:center;">${svgIcon('clock')} ${isCreative ? '<strong class="text-metal">ISTANTANEO (0s)</strong>' : formatDuration(resSec)}</span>
            <button type="button" class="btn btn-blue btn-sm btn-start-research" data-rid="${r.id}" ${canResearch ? '' : 'disabled'}>
              RICERCA LV.${nextLv}
            </button>
          </div>
        </div>
      `;
    }).join('');

    viewport.innerHTML = `
      <h2 style="font-size:1.1rem; color:var(--res-crystal); margin-bottom:12px;">LABORATORIO DI RICERCA GALATTICO</h2>
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(305px, 1fr)); gap:12px;">
        ${cards}
      </div>
    `;

    viewport.querySelectorAll('.btn-start-research').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const res = Engine.startResearch(uni, btn.dataset.rid, pIdx);
          await UI.persistUniverseState();
          UI.updateTopBarNumbers();
          UI.renderCurrentView();
          UI.playSound(res.instant ? 'complete' : 'click');
          UI.toast(res.instant ? `Ricerca completata al Lv.${res.targetLevel}!` : `Ricerca Lv.${res.targetLevel} avviata.`, 'success');
        } catch (err) {
          UI.playSound('error');
          UI.toast(err.message, 'error');
        }
      });
    });
  };
})();
