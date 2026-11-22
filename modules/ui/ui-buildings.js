/** UNIVERSUM / modules/ui/ui-buildings.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';

  const UI = window.UniversumUI;


  // =========================================================
  // EDIFICI & RISORSE
  // =========================================================
  UI.renderBuildings = function (viewport) {
    const { escapeHTML, formatNum, formatDuration, svgIcon, resIconTag, artTag } = UI;
    const st = UI.state;
    const uni = st.currentUniverse;
    const Data = window.UniversumData;
    const Engine = window.UniversumEngine;
    const pIdx = UI.getActivePlanetIndex();
    const planet = UI.getActivePlanet();
    const isCreative = uni.creativeMode && !st.isMultiplayerMode;
    const prod = Engine.getPlanetProduction(planet, uni);
    const effSpeed = Engine.getEffectiveSpeed ? Engine.getEffectiveSpeed(uni) : Math.max(1, Number(uni.speed) || 1);

    const cards = Object.values(Data.BUILDINGS).map((b) => {
      const curLv = Number(planet.buildings[b.id] || 0);
      const nextLv = curLv + 1;
      const cost = Data.getBuildingCost(b.id, nextLv, false);
      const req = Data.checkRequirements(b.requirements, planet, uni, false);
      const buildSec = Engine.getBuildingBuildTime(uni, planet, b.id, nextLv, false);

      const energyCur = Data.getBuildingEnergyDelta(b.id, curLv, planet.maxTemp);
      const energyNext = Data.getBuildingEnergyDelta(b.id, nextLv, planet.maxTemp);
      const energyDelta = energyNext - energyCur;
      const energyAfter = prod.energyBalance + energyDelta;
      const energyInsufficient = !isCreative && energyDelta < 0 && energyAfter < 0;
      const prodGain = (resId) => {
        if (!['metalMine', 'crystalMine', 'deuteriumSynth'].includes(b.id)) return 0;
        const key = b.id === 'metalMine' ? 'metal' : b.id === 'crystalMine' ? 'crystal' : 'deuterium';
        if (key !== resId) return 0;
        return Math.floor((Data.getBaseHourlyProduction(b.id, nextLv, planet.maxTemp) - Data.getBaseHourlyProduction(b.id, curLv, planet.maxTemp)) * effSpeed * (prod.efficiency || 1));
      };

      const hasM = isCreative || planet.resources.metal >= cost.metal;
      const hasC = isCreative || planet.resources.crystal >= cost.crystal;
      const hasD = isCreative || planet.resources.deuterium >= cost.deuterium;
      const canBuild = isCreative || (req.met && hasM && hasC && hasD && !energyInsufficient && planet.buildQueue.length === 0 && (!b.maxLevel || curLv < b.maxLevel));

      return `
        <div class="glass-panel" style="padding:14px; display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; gap:12px; align-items:flex-start;">
            ${artTag(b.id, 'unit-art', b.name)}
            <div style="flex:1; min-width:0;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px; margin-bottom:4px;">
                <strong style="font-size:1.05rem;">${escapeHTML(b.name)}</strong>
                <span class="badge badge-blue">Lv.${curLv}</span>
              </div>
              <p class="text-muted" style="font-size:0.88rem;">${escapeHTML(b.description)}</p>
            </div>
          </div>
          ${!req.met && !isCreative ? `<div style="color:#ff5252; font-size:0.85rem;">${svgIcon('lock')} Richiede: ${escapeHTML(req.missing.join(', '))}</div>` : ''}
          <div style="display:flex; flex-wrap:wrap; gap:10px; font-size:0.9rem; font-weight:700;">
            ${cost.metal > 0 ? `<span class="cost-item" style="color:${hasM ? 'var(--res-metal)' : 'var(--btn-red)'};">${resIconTag('metal')} ${formatNum(cost.metal)}</span>` : ''}
            ${cost.crystal > 0 ? `<span class="cost-item" style="color:${hasC ? 'var(--res-crystal)' : 'var(--btn-red)'};">${resIconTag('crystal')} ${formatNum(cost.crystal)}</span>` : ''}
            ${cost.deuterium > 0 ? `<span class="cost-item" style="color:${hasD ? 'var(--res-deuterium)' : 'var(--btn-red)'};">${resIconTag('deuterium')} ${formatNum(cost.deuterium)}</span>` : ''}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:auto;">
            <span style="font-size:0.88rem; display:inline-flex; align-items:center;">${svgIcon('clock')} ${isCreative ? '<strong class="text-metal">ISTANTANEO (0s)</strong>' : formatDuration(buildSec)}</span>
            <span style="font-size:0.82rem; color:${energyNext >= 0 ? 'var(--res-energy)' : '#ffab40'};">${svgIcon('bolt')} Energia: ${energyNext >= 0 ? '+' : ''}${formatNum(energyNext)}${prodGain('metal') > 0 ? ` • +${formatNum(prodGain('metal'))}/h Metallo` : ''}${prodGain('crystal') > 0 ? ` • +${formatNum(prodGain('crystal'))}/h Cristallo` : ''}${prodGain('deuterium') > 0 ? ` • +${formatNum(prodGain('deuterium'))}/h Deuterio` : ''}${energyInsufficient ? ' • <strong style="color:#ff5252;">Energia insufficiente</strong>' : ''}</span>
            <button type="button" class="btn btn-green btn-sm btn-build-structure" data-bid="${b.id}" ${canBuild ? '' : 'disabled'}>
              ${b.maxLevel && curLv >= b.maxLevel ? 'MAX' : `COSTRUISCI LV.${nextLv}`}
            </button>
          </div>
        </div>
      `;
    }).join('');

    viewport.innerHTML = `
      <h2 style="font-size:1.1rem; color:var(--res-crystal); margin-bottom:12px;">EDIFICI PLANETARI — ${escapeHTML(planet.name)}</h2>
      <div class="glass-panel" style="padding:12px; margin-bottom:12px; display:flex; flex-wrap:wrap; gap:14px; font-size:0.92rem;">
        <span>Energia totale: <strong class="text-energy">${formatNum(prod.energyProduced)}</strong> disponibile / <strong style="color:#ffab40;">${formatNum(prod.energyConsumed)}</strong> usata</span>
        <span>Saldo: <strong style="color:${prod.energyBalance >= 0 ? 'var(--btn-green)' : '#ff5252'};">${prod.energyBalance >= 0 ? '+' : ''}${formatNum(prod.energyBalance)}</strong></span>
        <span class="text-metal">+${formatNum(prod.metalPerHour)}/h Metallo</span>
        <span class="text-crystal">+${formatNum(prod.crystalPerHour)}/h Cristallo</span>
        <span class="text-deuterium">${prod.deuteriumPerHour >= 0 ? '+' : ''}${formatNum(prod.deuteriumPerHour)}/h Deuterio</span>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(305px, 1fr)); gap:12px;">
        ${cards}
      </div>
    `;

    viewport.querySelectorAll('.btn-build-structure').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const res = Engine.startBuilding(uni, pIdx, btn.dataset.bid, false);
          await UI.persistUniverseState();
          UI.updateTopBarNumbers();
          UI.renderCurrentView();
          UI.playSound(res.instant ? 'complete' : 'click');
          UI.toast(res.instant ? `Edificio potenziato al Lv.${res.targetLevel}!` : `Costruzione Lv.${res.targetLevel} avviata.`, 'success');
        } catch (err) {
          UI.playSound('error');
          UI.toast(err.message, 'error');
        }
      });
    });
  };
})();
