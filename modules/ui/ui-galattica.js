/** UNIVERSUM / modules/ui/ui-galattica.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';

  const UI = window.UniversumUI;


  // =========================================================
  // MAPPING ARTE STRUTTURE GALATTICA → RENDERER ESISTENTI
  // =========================================================
  const GAL_STRUCT_ART = {
    cantiereSpaziale: 'shipyard',
    generatoreMetallo: 'metalMine',
    generatoreCristallo: 'crystalMine',
    sintetizzatoreDeuterio: 'deuteriumSynth',
    reattoreFusione: 'fusionReactor'
  };


  // =========================================================
  // RENDERER CONDIVISO PANNELLO GALATTICA
  // =========================================================
  function _renderGalatticaPanelHTML(galHere, planet, options) {
    const { escapeHTML, formatNum, svgIcon, resIconTag, artTag } = UI;
    const uni = UI.state.currentUniverse;
    const Data = window.UniversumData;
    const Engine = window.UniversumEngine;
    const Galaxy = window.UniversumGalaxy;
    const gDef = Data.GALATTICA;
    const prod = Engine.getGalatticaProduction(galHere, uni);

    const galShips = Object.values(Data.SHIPS).filter((sh) => sh.id !== 'solarSatellite' && !sh.specialConstruction && !sh.normalShipyardOnly);
    const galDefenses = Object.values(Data.DEFENSES);

    const headerPlanetLabel = options && options.headerLabel ? options.headerLabel : `GALATTICA su ${escapeHTML(planet.name)}`;

    const orbitShipsCount = Object.values(galHere.orbitingFleet || {})
      .reduce((acc, q) => acc + Math.max(0, Math.floor(Number(q) || 0)), 0);

    return `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div class="glass-panel" style="padding:16px;">
          <div style="display:flex; gap:12px; align-items:center;">${artTag('galattica', 'unit-art', 'Galattica')}<h2 style="font-size:1.2rem; color:var(--res-crystal); margin-bottom:8px;">${headerPlanetLabel} [${galHere.coords.g}:${galHere.coords.s}:${galHere.coords.p}]</h2></div>
          <p style="margin-bottom:6px;">Stiva: <span class="text-metal">${formatNum(galHere.resources.metal)} M</span> · <span class="text-crystal">${formatNum(galHere.resources.crystal)} C</span> · <span class="text-deuterium">${formatNum(galHere.resources.deuterium)} D</span></p>
          <p class="text-muted">Produzione/ora: ${formatNum(prod.metalPerHour)} M · ${formatNum(prod.crystalPerHour)} C · ${formatNum(prod.deuteriumPerHour)} D · Energia: ${formatNum(prod.energyProduced - prod.energyConsumed)} (${formatNum(prod.energyProduced)} prodotta, solo Reattore a Fusione)</p>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="margin-bottom:10px;">STRUTTURE INTERNE</h3>
          ${Object.values(Data.GALATTICA_STRUCTURES).map((sd) => {
            const lv = Number(galHere.structures[sd.id] || 0);
            const cost = Engine.getGalatticaStructureCost(sd.id, lv + 1);
            const artId = GAL_STRUCT_ART[sd.id] || sd.id;
            return `
              <div style="background:rgba(0,0,0,0.35); border:1px solid rgba(0,210,255,0.22); border-radius:10px; padding:10px 12px; margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
                  <span style="display:inline-flex; align-items:center; gap:8px; min-width:0; flex:1;">
                    ${artTag(artId, 'unit-art-sm', sd.name)}
                    <span><strong>${escapeHTML(sd.name)}</strong> <span class="badge badge-blue" style="margin-left:4px;">Lv.${lv}</span></span>
                  </span>
                  <button type="button" class="btn btn-blue btn-sm btn-gal-upgrade" data-gsid="${sd.id}" style="flex-shrink:0;">POTENZIA</button>
                </div>
                <div class="text-muted" style="font-size:0.85rem;">
                  ${formatNum(cost.metal)} M · ${formatNum(cost.crystal)} C · ${formatNum(cost.deuterium)} D
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="margin-bottom:10px;">CANTIERE SPAZIALE GALATTICO</h3>
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:10px;">
            ${galShips.map((sh) => {
              const cost = sh.cost;
              return `
                <div style="background:rgba(0,0,0,0.35); border:1px solid rgba(0,210,255,0.22); border-radius:10px; padding:10px 12px; display:flex; flex-direction:column; gap:8px;">
                  <div style="display:flex; gap:10px; align-items:flex-start;">
                    ${artTag(sh.id, 'unit-art', sh.name)}
                    <div style="flex:1; min-width:0;">
                      <strong style="font-size:1rem;">${escapeHTML(sh.name)}</strong>
                      <p class="text-muted" style="font-size:0.82rem; margin-top:2px;">${escapeHTML(sh.description || '')}</p>
                    </div>
                  </div>
                  <div style="display:flex; flex-wrap:wrap; gap:8px; font-size:0.82rem; color:var(--res-crystal);">
                    <span style="display:inline-flex; align-items:center;">${svgIcon('sword')} ${formatNum(sh.attack)}</span>
                    <span style="display:inline-flex; align-items:center;">${svgIcon('shield')} ${formatNum(sh.shield)}</span>
                    <span style="display:inline-flex; align-items:center;">${svgIcon('hull')} ${formatNum(sh.hull)}</span>
                    ${sh.cargo > 0 ? `<span style="display:inline-flex; align-items:center;">${svgIcon('cargo')} ${formatNum(sh.cargo)}</span>` : ''}
                  </div>
                  <div style="display:flex; flex-wrap:wrap; gap:8px; font-size:0.82rem; font-weight:700;">
                    ${cost.metal > 0 ? `<span class="cost-item text-metal">${resIconTag('metal')} ${formatNum(cost.metal)}</span>` : ''}
                    ${cost.crystal > 0 ? `<span class="cost-item text-crystal">${resIconTag('crystal')} ${formatNum(cost.crystal)}</span>` : ''}
                    ${cost.deuterium > 0 ? `<span class="cost-item text-deuterium">${resIconTag('deuterium')} ${formatNum(cost.deuterium)}</span>` : ''}
                  </div>
                  <button type="button" class="btn btn-green btn-sm btn-gal-ship" data-gship="${sh.id}" style="margin-top:auto;">COSTRUISCI x1</button>
                </div>
              `;
            }).join('')}
          </div>
          <p class="text-muted" style="margin-top:10px;">Navi in orbita: ${Object.entries(galHere.orbitingFleet || {}).filter(([, q]) => q > 0).map(([id, q]) => `${escapeHTML(Data.SHIPS[id]?.name || id)} x${q}`).join(', ') || 'nessuna'}</p>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="margin-bottom:10px;">DIFESE GALATTICHE (PREZZO DOPPIO ×${gDef.defenseCostMultiplier})</h3>
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:10px;">
            ${galDefenses.map((dd) => {
              const costM = dd.cost.metal * gDef.defenseCostMultiplier;
              const costC = dd.cost.crystal * gDef.defenseCostMultiplier;
              const costD = dd.cost.deuterium * gDef.defenseCostMultiplier;
              const owned = Number(galHere.defenses?.[dd.id] || 0);
              return `
                <div style="background:rgba(0,0,0,0.35); border:1px solid rgba(0,210,255,0.22); border-radius:10px; padding:10px 12px; display:flex; flex-direction:column; gap:8px;">
                  <div style="display:flex; gap:10px; align-items:flex-start;">
                    ${artTag(dd.id, 'unit-art', dd.name)}
                    <div style="flex:1; min-width:0;">
                      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">
                        <strong style="font-size:1rem;">${escapeHTML(dd.name)}</strong>
                        <span class="badge badge-green">x${formatNum(owned)}</span>
                      </div>
                      <p class="text-muted" style="font-size:0.82rem; margin-top:2px;">${escapeHTML(dd.description || '')}</p>
                    </div>
                  </div>
                  <div style="display:flex; flex-wrap:wrap; gap:8px; font-size:0.82rem; color:var(--res-crystal);">
                    <span style="display:inline-flex; align-items:center;">${svgIcon('sword')} ${formatNum(dd.attack)}</span>
                    <span style="display:inline-flex; align-items:center;">${svgIcon('shield')} ${formatNum(dd.shield)}</span>
                    <span style="display:inline-flex; align-items:center;">${svgIcon('hull')} ${formatNum(dd.hull)}</span>
                  </div>
                  <div style="display:flex; flex-wrap:wrap; gap:8px; font-size:0.82rem; font-weight:700;">
                    ${costM > 0 ? `<span class="cost-item text-metal">${resIconTag('metal')} ${formatNum(costM)}</span>` : ''}
                    ${costC > 0 ? `<span class="cost-item text-crystal">${resIconTag('crystal')} ${formatNum(costC)}</span>` : ''}
                    ${costD > 0 ? `<span class="cost-item text-deuterium">${resIconTag('deuterium')} ${formatNum(costD)}</span>` : ''}
                  </div>
                  <button type="button" class="btn btn-green btn-sm btn-gal-defense" data-gdid="${dd.id}" style="margin-top:auto;">COSTRUISCI x1</button>
                </div>
              `;
            }).join('')}
          </div>
          <p class="text-muted" style="margin-top:10px;">Difese installate: ${Object.entries(galHere.defenses || {}).filter(([, q]) => q > 0).map(([id, q]) => `${escapeHTML(Data.DEFENSES[id]?.name || id)} x${q}`).join(', ') || 'nessuna'}</p>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:rgba(0,210,255,0.06); border:1px solid rgba(0,210,255,0.25); border-radius:10px;">
          <span><strong>FLOTTE GALATTICA</strong> · Navi in orbita: ${formatNum(orbitShipsCount)}</span>
          <button type="button" class="btn btn-blue btn-sm btn-gal-fleet-manage" data-gal-id="${escapeHTML(galHere.id)}">GESTISCI FLOTTE</button>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="margin-bottom:10px;">SALTO QUANTICO (istantaneo)</h3>
          <div class="form-grid-3">
            <div class="form-group"><label>Galassia</label><input type="number" id="gal-jump-g" class="form-control" value="${galHere.coords.g}" min="1" max="9"></div>
            <div class="form-group"><label>Sistema</label><input type="number" id="gal-jump-s" class="form-control" value="${galHere.coords.s}" min="1" max="499"></div>
            <div class="form-group"><label>Posizione</label><input type="number" id="gal-jump-p" class="form-control" value="${galHere.coords.p}" min="1" max="15"></div>
          </div>
          <p class="text-muted" style="margin-bottom:10px;">Costo: 25.000 D ogni 3 sistemi + 100.000 D per galassia di differenza, dalla stiva. Bloccato se a destinazione c'è Luna o Bacino.</p>
          <button type="button" id="btn-gal-jump" class="btn btn-creative" style="width:100%;">ESEGUI SALTO QUANTICO</button>
        </div>
      </div>
    `;
  }


  function _bindGalatticaPanelHandlers(viewport, galHere) {
    const UI = window.UniversumUI;
    const uni = UI.state.currentUniverse;
    const Galaxy = window.UniversumGalaxy;

    viewport.querySelectorAll('.btn-gal-upgrade').forEach((btn) => btn.addEventListener('click', async () => {
      if (UI.blockPendingMutation(uni)) return;
      try {
        Galaxy.upgradeGalatticaStructure(uni, galHere.id, btn.dataset.gsid);
        await UI.persistUniverseState();
        UI.renderCurrentView();
        UI.toast('Struttura Galattica potenziata.', 'success');
      } catch (err) { UI.playSound('error'); UI.toast(err.message, 'error'); }
    }));
    viewport.querySelectorAll('.btn-gal-defense').forEach((btn) => btn.addEventListener('click', async () => {
      if (UI.blockPendingMutation(uni)) return;
      try {
        Galaxy.buildGalatticaDefense(uni, galHere.id, btn.dataset.gdid, 1);
        await UI.persistUniverseState();
        UI.renderCurrentView();
        UI.toast('Difesa Galattica costruita (prezzo doppio).', 'success');
      } catch (err) { UI.playSound('error'); UI.toast(err.message, 'error'); }
    }));
    viewport.querySelectorAll('.btn-gal-ship').forEach((btn) => btn.addEventListener('click', async () => {
      if (UI.blockPendingMutation(uni)) return;
      try {
        Galaxy.buildGalatticaShip(uni, galHere.id, btn.dataset.gship, 1);
        await UI.persistUniverseState();
        UI.renderCurrentView();
        UI.toast('Nave in orbita alla Galattica.', 'success');
      } catch (err) { UI.playSound('error'); UI.toast(err.message, 'error'); }
    }));
    viewport.querySelectorAll('.btn-gal-fleet-manage').forEach((btn) => btn.addEventListener('click', () => {
      UI.renderGalatticaFleet(btn.dataset.galId);
    }));
    document.getElementById('btn-gal-jump')?.addEventListener('click', async () => {
      if (UI.blockPendingMutation(uni)) return;
      try {
        const target = {
          g: Number(document.getElementById('gal-jump-g').value),
          s: Number(document.getElementById('gal-jump-s').value),
          p: Number(document.getElementById('gal-jump-p').value)
        };
        const online=UI.state.isMultiplayerMode;
        const res=online ? await window.__UniversumMPModules.jumpOnlineGalattica(uni,galHere.id,target) : Galaxy.jumpGalattica(uni,galHere.id,target);
        if (!online) await UI.persistUniverseState();
        UI.refreshPlanetSelector();
        UI.renderCurrentView();
        UI.playSound('complete');
        UI.toast(`Salto quantico completato (${UI.formatNum(res.cost)} D).`, 'success');
      } catch (err) { UI.playSound('error'); UI.toast(err.message, 'error'); }
    });
  }


  // =========================================================
  // VISTA 'galattica-manage'
  // =========================================================
  UI.renderGalatticaManage = function (galatticaId) {
    const uni = UI.state.currentUniverse;
    if (!uni) return;
    const Galaxy = window.UniversumGalaxy;
    const g = Galaxy.findGalattica ? Galaxy.findGalattica(uni, galatticaId) : null;
    if (!g) { UI.toast('Galattica non trovata.', 'error'); return; }
    UI.state.currentGalatticaManageId = galatticaId;
    UI.state.currentGalatticaManagePrevView = UI.state.currentView || 'galaxy';
    UI.switchView('galattica-manage');
  };


  UI.renderGalatticaManageView = function (viewport) {
    const { escapeHTML, formatNum, svgIcon } = UI;
    const uni = UI.state.currentUniverse;
    const Galaxy = window.UniversumGalaxy;
    const galId = UI.state.currentGalatticaManageId;
    const g = galId && Galaxy.findGalattica ? Galaxy.findGalattica(uni, galId) : null;
    const backView = UI.state.currentGalatticaManagePrevView || 'galaxy';

    if (!g) {
      viewport.innerHTML = `
        <div class="glass-panel" style="padding:20px; text-align:center;">
          <p class="text-muted" style="margin-bottom:12px;">Galattica non più disponibile (forse distrutta o spostata).</p>
          <button type="button" id="btn-gal-manage-back-missing" class="btn btn-blue">${svgIcon('radar')} TORNA INDIETRO</button>
        </div>
      `;
      document.getElementById('btn-gal-manage-back-missing')?.addEventListener('click', () => UI.switchView(backView));
      return;
    }

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div style="display:flex; justify-content:flex-end;">
          <button type="button" id="btn-gal-manage-back" class="btn btn-blue btn-sm">${svgIcon('radar')} &larr; INDIETRO</button>
        </div>
        ${_renderGalatticaPanelHTML(g, null, { headerLabel: 'GALATTICA' })}
      </div>
    `;

    document.getElementById('btn-gal-manage-back')?.addEventListener('click', () => {
      UI.switchView(backView);
    });
    _bindGalatticaPanelHandlers(viewport, g);
  };


  // =========================================================
  // VISTA 'galattica-fleet' — lancio flotte dalla Galattica
  // =========================================================
  UI.renderGalatticaFleet = function (galatticaId) {
    const uni = UI.state.currentUniverse;
    if (!uni) return;
    const Galaxy = window.UniversumGalaxy;
    const g = Galaxy.findGalattica ? Galaxy.findGalattica(uni, galatticaId) : null;
    if (!g) { UI.toast('Galattica non trovata.', 'error'); return; }

    UI.state.currentGalatticaFleetId = galatticaId;
    UI.state.currentGalatticaFleetPrevView = UI.state.currentView || 'galaxy';
    UI.state.fleetSelection = {};
    UI.state.fleetCargo = { metal: 0, crystal: 0, deuterium: 0 };
    UI.state.fleetMission = 'attack';
    UI.state.fleetFuelPercent = 100;
    UI.switchView('galattica-fleet');
  };


  UI.renderGalatticaFleetView = function (viewport) {
    const { escapeHTML, formatNum, svgIcon, resIconTag, artTag } = UI;
    const st = UI.state;
    const uni = st.currentUniverse;
    const Data = window.UniversumData;
    const Galaxy = window.UniversumGalaxy;

    const galId = st.currentGalatticaFleetId;
    const gal = galId && Galaxy.findGalattica ? Galaxy.findGalattica(uni, galId) : null;
    const backView = st.currentGalatticaFleetPrevView || 'galaxy';

    if (!gal) {
      viewport.innerHTML = `
        <div class="glass-panel" style="padding:20px; text-align:center;">
          <p class="text-muted" style="margin-bottom:12px;">Galattica non più disponibile (forse distrutta o spostata).</p>
          <button type="button" id="btn-gal-fleet-back-missing" class="btn btn-blue">${svgIcon('radar')} TORNA INDIETRO</button>
        </div>
      `;
      document.getElementById('btn-gal-fleet-back-missing')?.addEventListener('click', () => UI.switchView(backView));
      return;
    }

    const shipEntries = Object.entries(gal.orbitingFleet || {})
      .filter(([id, q]) => Number(q) > 0 && id !== 'solarSatellite')
      .filter(([id]) => {
        const spec = Data.SHIPS[id];
        return spec && !spec.specialConstruction && !spec.normalShipyardOnly;
      });

    const missions = [
      { id: 'attack', label: 'Attacco' },
      { id: 'spy', label: 'Spionaggio' },
      { id: 'transport', label: 'Trasporto' },
      { id: 'recycle', label: 'Riciclaggio' },
      { id: 'explore', label: 'Esplorazione' },
      { id: 'destroyMoon', label: 'Distruzione Luna/Bacino' },
      { id: 'embargo', label: 'Embargo Planetario' },
      { id: 'blockade', label: 'Embargo Planetario' },
      { id: 'occupy', label: 'Occupazione Planetaria' }
    ];

    const selMission = st.fleetMission || 'attack';
    if (selMission === 'colonize' || selMission === 'deploy') {
      st.fleetMission = 'attack';
    }

    const target = st.fleetTarget || { g: gal.coords.g, s: gal.coords.s, p: gal.coords.p };
    const cargo = st.fleetCargo || { metal: 0, crystal: 0, deuterium: 0 };
    const fuelPercent = Number(st.fleetFuelPercent) || 100;
    const MCore = window.UniversumMissionsCore;
    const maxExploreHours = MCore?.getMaxExploreHours(uni) || 1;
    st.fleetExploreHours = Math.min(maxExploreHours, Math.max(1, Math.floor(Number(st.fleetExploreHours) || 1)));
    const isCreative = Boolean(uni.creativeMode && !st.isMultiplayerMode);

    const totalShipsSelected = Object.values(st.fleetSelection || {}).reduce((a, q) => a + Math.max(0, Math.floor(Number(q) || 0)), 0);

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div class="glass-panel" style="padding:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
              ${artTag('galattica', 'unit-art-sm', 'Galattica')}
              <h2 style="font-size:1.1rem; color:var(--res-crystal); margin:0;">FLOTTE GALATTICA [${gal.coords.g}:${gal.coords.s}:${gal.coords.p}]</h2>
            </div>
            <button type="button" id="btn-gal-fleet-back" class="btn btn-blue btn-sm">${svgIcon('radar')} &larr; INDIETRO</button>
          </div>
          <p class="text-muted" style="margin-top:8px; font-size:0.9rem;">
            Stiva Galattica: <strong class="text-metal">${formatNum(gal.resources.metal)} M</strong> ·
            <strong class="text-crystal">${formatNum(gal.resources.crystal)} C</strong> ·
            <strong class="text-deuterium">${formatNum(gal.resources.deuterium)} D</strong>
          </p>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:0.98rem; color:var(--res-crystal); margin-bottom:10px;">DESTINAZIONE</h3>
          <div class="form-grid-3">
            <div class="form-group"><label>Galassia</label><input type="number" id="gal-fleet-target-g" class="form-control" value="${target.g}" min="1" max="9"></div>
            <div class="form-group"><label>Sistema</label><input type="number" id="gal-fleet-target-s" class="form-control" value="${target.s}" min="1" max="499"></div>
            <div class="form-group"><label>Posizione</label><input type="number" id="gal-fleet-target-p" class="form-control" value="${target.p}" min="1" max="16"></div>
          </div>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:0.98rem; color:var(--res-crystal); margin-bottom:10px;">MISSIONE</h3>
          <div class="form-group">
            <select id="gal-fleet-mission" class="form-control">
              ${missions.map((m) => `<option value="${m.id}" ${m.id === st.fleetMission ? 'selected' : ''}>${escapeHTML(m.label)}</option>`).join('')}
            </select>
          </div>
          <div id="gal-fleet-explore-options" class="${st.fleetMission === 'explore' ? '' : 'hidden'}" style="margin-top:12px;">
            <label>Durata esplorazione (massimo ${maxExploreHours}h — Ricerca Esplorazione Profonda Lv.${Number(uni.researches?.expeditionTech || 0)})</label>
            <select id="gal-fleet-explore-hours" class="form-control">
              ${Array.from({ length:maxExploreHours }, (_, i) => i + 1).map(h =>
                `<option value="${h}" ${h === st.fleetExploreHours ? 'selected' : ''}>${h} ${h === 1 ? 'ora' : 'ore'}</option>`).join('')}
            </select>
          </div>
          <p class="text-muted" style="font-size:0.82rem; margin-top:6px;">Colonizzazione e Schieramento non sono disponibili dalla Galattica.</p>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:0.98rem; color:var(--res-crystal); margin-bottom:10px;">NAVI IN ORBITA (${shipEntries.length})</h3>
          ${shipEntries.length === 0 ? `
            <p class="text-muted">Nessuna nave in orbita alla Galattica. Costruiscine nel Cantiere Spaziale Galattico.</p>
          ` : `
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:10px;">
              ${shipEntries.map(([sid, qty]) => {
                const spec = Data.SHIPS[sid];
                const name = spec.name || sid;
                const selQ = Number((st.fleetSelection || {})[sid] || 0);
                return `
                  <div style="background:rgba(0,0,0,0.35); border:1px solid rgba(0,210,255,0.22); border-radius:10px; padding:10px 12px; display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; gap:10px; align-items:flex-start;">
                      ${artTag(sid, 'unit-art', name)}
                      <div style="flex:1; min-width:0;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">
                          <strong style="font-size:1rem;">${escapeHTML(name)}</strong>
                          <span class="badge badge-green">In orbita: ${formatNum(qty)}</span>
                        </div>
                      </div>
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:8px; font-size:0.82rem; color:var(--res-crystal);">
                      <span style="display:inline-flex; align-items:center;">${svgIcon('sword')} ${formatNum(spec.attack)}</span>
                      <span style="display:inline-flex; align-items:center;">${svgIcon('shield')} ${formatNum(spec.shield)}</span>
                      <span style="display:inline-flex; align-items:center;">${svgIcon('hull')} ${formatNum(spec.hull)}</span>
                      ${spec.cargo > 0 ? `<span style="display:inline-flex; align-items:center;">${svgIcon('cargo')} ${formatNum(spec.cargo)}</span>` : ''}
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                      <input type="number" class="form-control gal-fleet-qty" data-sid="${sid}" min="0" max="${qty}" value="${selQ}" style="width:100px; text-align:center;">
                      <button type="button" class="btn btn-ghost btn-sm gal-fleet-qty-set" data-sid="${sid}" data-val="0">0</button>
                      <button type="button" class="btn btn-ghost btn-sm gal-fleet-qty-set" data-sid="${sid}" data-val="max">MAX</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:0.98rem; color:var(--res-crystal); margin-bottom:10px;">STIVA / CARBURANTE</h3>
          <div class="form-grid-3">
            <div class="form-group"><label>Metallo</label><input type="number" id="gal-fleet-cargo-m" class="form-control" value="${Number(cargo.metal) || 0}" min="0" max="${Math.floor(gal.resources.metal)}"></div>
            <div class="form-group"><label>Cristallo</label><input type="number" id="gal-fleet-cargo-c" class="form-control" value="${Number(cargo.crystal) || 0}" min="0" max="${Math.floor(gal.resources.crystal)}"></div>
            <div class="form-group"><label>Deuterio</label><input type="number" id="gal-fleet-cargo-d" class="form-control" value="${Number(cargo.deuterium) || 0}" min="0" max="${Math.floor(gal.resources.deuterium)}"></div>
          </div>
          <div class="form-group" style="margin-top:10px;">
            <label>Potenza motori / Carburante: ${fuelPercent}%</label>
            <input type="range" id="gal-fleet-fuel-pct" class="form-control" min="10" max="100" step="10" value="${fuelPercent}">
          </div>
          <p class="text-muted" style="margin-top:8px;">
            Navi selezionate: <strong>${formatNum(totalShipsSelected)}</strong> · Il carburante viene scalato dalla stiva della Galattica all'invio.
          </p>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" id="btn-gal-fleet-send" class="btn btn-green" ${totalShipsSelected <= 0 ? 'disabled' : ''}>${svgIcon('rocket')} INVIA FLOTTA</button>
        </div>
      </div>
    `;

    document.getElementById('btn-gal-fleet-back')?.addEventListener('click', () => {
      UI.switchView(backView);
    });

    const updateSendState = () => {
      const btn = document.getElementById('btn-gal-fleet-send');
      const total = Object.values(st.fleetSelection || {}).reduce((a, q) => a + Math.max(0, Math.floor(Number(q) || 0)), 0);
      if (btn) btn.disabled = total <= 0;
      const span = viewport.querySelector('p.text-muted:last-of-type strong');
      if (span) span.textContent = formatNum(total);
    };

    viewport.querySelectorAll('.gal-fleet-qty').forEach((inp) => {
      inp.addEventListener('input', () => {
        const sid = inp.dataset.sid;
        const max = Number(inp.max) || 0;
        const val = Math.max(0, Math.min(max, Math.floor(Number(inp.value) || 0)));
        inp.value = val;
        if (!st.fleetSelection) st.fleetSelection = {};
        if (val > 0) st.fleetSelection[sid] = val;
        else delete st.fleetSelection[sid];
        updateSendState();
      });
    });

    viewport.querySelectorAll('.gal-fleet-qty-set').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sid = btn.dataset.sid;
        const inp = viewport.querySelector(`.gal-fleet-qty[data-sid="${sid}"]`);
        if (!inp) return;
        const max = Number(inp.max) || 0;
        const val = btn.dataset.val === 'max' ? max : 0;
        inp.value = val;
        inp.dispatchEvent(new Event('input'));
      });
    });

    document.getElementById('gal-fleet-mission')?.addEventListener('change', (e) => {
      st.fleetMission = e.target.value;
      document.getElementById('gal-fleet-explore-options')?.classList.toggle('hidden', e.target.value !== 'explore');
      if (e.target.value === 'explore') {
        st.fleetTarget ||= { g:gal.coords.g, s:gal.coords.s, p:16 };
        st.fleetTarget.p = 16;
        const pos = document.getElementById('gal-fleet-target-p');
        if (pos) pos.value = '16';
      }
    });

    document.getElementById('gal-fleet-explore-hours')?.addEventListener('change', (e) => {
      st.fleetExploreHours = Math.min(maxExploreHours, Math.max(1, Math.floor(Number(e.target.value) || 1)));
    });

    ['g', 's', 'p'].forEach((k) => {
      document.getElementById(`gal-fleet-target-${k}`)?.addEventListener('change', (e) => {
        const v = Math.max(1, Math.floor(Number(e.target.value) || 1));
        if (!st.fleetTarget) st.fleetTarget = { g: 1, s: 1, p: 1 };
        st.fleetTarget[k] = v;
      });
    });

    ['m', 'c', 'd'].forEach((k) => {
      const map = { m: 'metal', c: 'crystal', d: 'deuterium' };
      document.getElementById(`gal-fleet-cargo-${k}`)?.addEventListener('change', (e) => {
        if (!st.fleetCargo) st.fleetCargo = { metal: 0, crystal: 0, deuterium: 0 };
        st.fleetCargo[map[k]] = Math.max(0, Math.floor(Number(e.target.value) || 0));
      });
    });

    document.getElementById('gal-fleet-fuel-pct')?.addEventListener('input', (e) => {
      st.fleetFuelPercent = Number(e.target.value) || 100;
      const label = e.target.previousElementSibling;
      if (label && label.tagName === 'LABEL') {
        label.textContent = `Potenza motori / Carburante: ${st.fleetFuelPercent}%`;
      }
    });

    document.getElementById('btn-gal-fleet-send')?.addEventListener('click', async () => {
      if (UI.blockPendingMutation(uni)) return;
      try {
        const target = st.fleetTarget;
        const mission = st.fleetMission;
        const selection = Object.assign({}, st.fleetSelection || {});
        const cargo = Object.assign({ metal: 0, crystal: 0, deuterium: 0 }, st.fleetCargo || {});
        const fuelPercent = Number(st.fleetFuelPercent) || 100;

        if (!target) throw new Error('Coordinate di destinazione non valide.');
        if (!mission) throw new Error('Seleziona una missione.');
        if (Object.values(selection).every((q) => !q)) throw new Error('Seleziona almeno una nave.');

        const options = {
          originType: 'galattica',
          originGalatticaId: galId,
          fuelPercent,
          ...(mission === 'explore' ? {
            exploreHours: Math.min(maxExploreHours, Math.max(1,
              Math.floor(Number(document.getElementById('gal-fleet-explore-hours')?.value) || st.fleetExploreHours || 1)))
          } : {})
        };
        if (st.isMultiplayerMode) await window.__UniversumMPModules.launchGalattica(uni,galId,target,mission,selection,cargo,options);
        else {
          Galaxy.launchFleet(uni,0,target,mission,selection,cargo,options);
          await UI.persistUniverseState();
        }
        UI.playSound('success');
        UI.toast('Flotta lanciata dalla Galattica!', 'success');

        st.fleetSelection = {};
        st.fleetCargo = { metal: 0, crystal: 0, deuterium: 0 };

        UI.switchView('movements');
      } catch (err) {
        UI.playSound('error');
        UI.toast(err.message, 'error');
      }
    });
  };
})();
