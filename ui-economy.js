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

      // Energia e produzione oraria del livello successivo
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

    const cards = Object.values(dict).map((u) => {
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

  // Ricontrolla in tempo reale requisiti/risorse e riabilita i bottoni senza re-render
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

  // =========================================================
  // LUNA
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

    if (!planet.moon) {
      const cost = Galaxy.getMoonCreationCost(uni);
      viewport.innerHTML = `
        <div class="glass-panel" style="padding:20px; text-align:center;">
          <div style="margin-bottom:12px; display:flex; justify-content:center;">${artTag('lunarBase', 'unit-art', 'Base Lunare')}</div>
          <h2 style="font-size:1.15rem; color:var(--res-crystal); margin-bottom:8px;">NESSUNA LUNA IN ORBITA SU ${escapeHTML(planet.name)}</h2>
          <p class="text-muted" style="margin-bottom:14px;">Richiede Ingegneria Lunare Lv.1.</p>
          <div style="margin-bottom:16px; font-weight:700; display:flex; justify-content:center; flex-wrap:wrap; gap:12px;">
            <span class="cost-item text-metal">${resIconTag('metal')} ${formatNum(cost.metal)}</span>
            <span class="cost-item text-crystal">${resIconTag('crystal')} ${formatNum(cost.crystal)}</span>
            <span class="cost-item text-deuterium">${resIconTag('deuterium')} ${formatNum(cost.deuterium)}</span>
          </div>
          <button type="button" id="btn-create-moon" class="btn btn-green">${svgIcon('moon')} CREA LUNA ORA</button>
        </div>
      `;

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

  // =========================================================
  // VISTA IMPERIALE
  // =========================================================
  UI.renderEmpire = function (viewport) {
    const { escapeHTML, formatNum, svgIcon } = UI;
    const uni = UI.state.currentUniverse;
    const Engine = window.UniversumEngine;
    let totM = 0;
    let totC = 0;
    let totD = 0;

    const rows = uni.planets.map((p, idx) => {
      const prod = Engine.getPlanetProduction(p, uni);
      totM += prod.metalPerHour;
      totC += prod.crystalPerHour;
      totD += prod.deuteriumPerHour;

      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:6px;">
              <button type="button" class="btn btn-ghost btn-sm btn-emp-rename" data-idx="${idx}" style="min-width:40px; min-height:40px; padding:4px 8px;" title="Rinomina">${svgIcon('edit')}</button>
              <button type="button" class="btn btn-blue btn-sm btn-emp-select" data-pid="${p.id}">${escapeHTML(p.name)}</button>
            </div>
          </td>
          <td class="font-display">[${p.coords.g}:${p.coords.s}:${p.coords.p}]${p.moon ? ' <span class="badge badge-blue">LUNA</span>' : ''}</td>
          <td class="text-metal">${formatNum(p.resources.metal)} (+${formatNum(prod.metalPerHour)}/h)</td>
          <td class="text-crystal">${formatNum(p.resources.crystal)} (+${formatNum(prod.crystalPerHour)}/h)</td>
          <td class="text-deuterium">${formatNum(p.resources.deuterium)} (+${formatNum(prod.deuteriumPerHour)}/h)</td>
          <td>M:${p.buildings.metalMine || 0} C:${p.buildings.crystalMine || 0} D:${p.buildings.deuteriumSynth || 0}</td>
        </tr>
      `;
    }).join('');

    viewport.innerHTML = `
      <div class="glass-panel" style="padding:14px;">
        <h2 style="font-size:1.1rem; color:var(--res-crystal); margin-bottom:8px;">RIEPILOGO IMPERIALE (${uni.planets.length} PIANETI)</h2>
        <p style="margin-bottom:12px; font-size:0.95rem;">
          Produzione Totale Impero:
          <strong class="text-metal">+${formatNum(totM)} M/h</strong> •
          <strong class="text-crystal">+${formatNum(totC)} C/h</strong> •
          <strong class="text-deuterium">+${formatNum(totD)} D/h</strong>
        </p>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Pianeta</th>
                <th>Coord.</th>
                <th>Metallo</th>
                <th>Cristallo</th>
                <th>Deuterio</th>
                <th>Miniere</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;

    viewport.querySelectorAll('.btn-emp-rename').forEach((btn) => {
      btn.addEventListener('click', () => UI.openRenamePlanetModal(Number(btn.dataset.idx)));
    });

    viewport.querySelectorAll('.btn-emp-select').forEach((btn) => {
      btn.addEventListener('click', () => {
        uni.activePlanetId = btn.dataset.pid;
        UI.refreshPlanetSelector();
        UI.updateTopBarNumbers();
        UI.switchView('overview');
      });
    });
  };
})();
