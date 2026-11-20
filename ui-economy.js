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

    const galShips = Object.values(Data.SHIPS).filter((sh) => sh.id !== 'solarSatellite' && !sh.specialConstruction);
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
      try {
        Galaxy.upgradeGalatticaStructure(uni, galHere.id, btn.dataset.gsid);
        await UI.persistUniverseState();
        UI.renderCurrentView();
        UI.toast('Struttura Galattica potenziata.', 'success');
      } catch (err) { UI.playSound('error'); UI.toast(err.message, 'error'); }
    }));
    viewport.querySelectorAll('.btn-gal-defense').forEach((btn) => btn.addEventListener('click', async () => {
      try {
        Galaxy.buildGalatticaDefense(uni, galHere.id, btn.dataset.gdid, 1);
        await UI.persistUniverseState();
        UI.renderCurrentView();
        UI.toast('Difesa Galattica costruita (prezzo doppio).', 'success');
      } catch (err) { UI.playSound('error'); UI.toast(err.message, 'error'); }
    }));
    viewport.querySelectorAll('.btn-gal-ship').forEach((btn) => btn.addEventListener('click', async () => {
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
      try {
        const res = Galaxy.jumpGalattica(uni, galHere.id, {
          g: Number(document.getElementById('gal-jump-g').value),
          s: Number(document.getElementById('gal-jump-s').value),
          p: Number(document.getElementById('gal-jump-p').value)
        });
        await UI.persistUniverseState();
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
        return spec && !spec.specialConstruction;
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
      try {
        const target = st.fleetTarget;
        const mission = st.fleetMission;
        const selection = Object.assign({}, st.fleetSelection || {});
        const cargo = Object.assign({ metal: 0, crystal: 0, deuterium: 0 }, st.fleetCargo || {});
        const fuelPercent = Number(st.fleetFuelPercent) || 100;

        if (!target) throw new Error('Coordinate di destinazione non valide.');
        if (!mission) throw new Error('Seleziona una missione.');
        if (Object.values(selection).every((q) => !q)) throw new Error('Seleziona almeno una nave.');

        Galaxy.launchFleet(uni, 0, target, mission, selection, cargo, {
          originType: 'galattica',
          originGalatticaId: galId,
          fuelPercent
        });

        await UI.persistUniverseState();
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
      const invCounts = Galaxy.getInvictusCount(planet);
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
      const isVuoto = b.status === 'active' && Galaxy.isBacinoVuoto(planet);
      const limboHere = uni.crepuscoloLimbo && uni.planets[0] && uni.planets[0].id === planet.id;

      // === M2: immagine Crepuscolo dinamica in base allo stato ===
      const crepuscoloArtId = limboHere
        ? 'crepuscoloLimbo'
        : (crep && (crep.status === 'repairing' || crep.status === 'building'))
          ? 'crepuscoloRepair'
          : 'crepuscolo';

      const crepuscoloHtml = b.status === 'active' ? `
          <div style="margin-top:14px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.12);">
            <p style="margin-bottom:8px; display:flex; align-items:center; gap:8px;">${artTag(crepuscoloArtId, 'unit-art-sm', 'Crepuscolo degli Dei')}<span><strong>CREPUSCOLO DEGLI DEI</strong> · Bacino: <strong>${isVuoto ? 'VUOTO (mai usato)' : 'non vuoto'}</strong>${limboHere ? ' · <strong>LIMBO su questo pianeta madre</strong>' : ''}</span></p>
            ${crep ? `<p class="text-muted" style="margin-bottom:8px;">Stato: <strong>${escapeHTML(crep.status)}</strong>${crep.status !== 'active' ? ` · Giorni ${Number(crep.daysPaid) || 0} / ${Number(crep.daysTotal) || crepDef.buildDays} · Mancanti oggi: ${formatNum(crepMissing.metal)} M · ${formatNum(crepMissing.crystal)} C · ${formatNum(crepMissing.deuterium)} D` : ' · Operativa'}</p>` : '<p class="text-muted" style="margin-bottom:8px;">Nessuna Crepuscolo legata a questo Bacino.</p>'}
            ${!crep && isVuoto ? `<p class="text-muted" style="margin-bottom:10px;">Costruzione: ${crepDef.buildDays} giorni reali, rata ${formatNum(crepDef.dailyCost.metal)} M / ${formatNum(crepDef.dailyCost.crystal)} C / ${formatNum(crepDef.dailyCost.deuterium)} D al giorno. Max 1 per impero.</p><button type="button" id="btn-start-crepuscolo" class="btn btn-creative">COSTRUISCI CREPUSCOLO DEGLI DEI</button>` : ''}
            ${!crep && !isVuoto ? '<p class="text-muted">Costruzione Crepuscolo disponibile solo in un Bacino mai usato da nessuna nave.</p>' : ''}
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
        </div>
      `;
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
          <div style="margin-top:18px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.12);">
            <p class="text-muted" style="margin-bottom:10px;">Oppure, al posto della Luna: Bacino Spaziale in ${bDef.totalDays} giorni reali, rate di ${formatNum(bDef.dailyCost.metal)} M / ${formatNum(bDef.dailyCost.crystal)} C / ${formatNum(bDef.dailyCost.deuterium)} D al giorno (totale ${formatNum(bDef.totalCost.metal)} M / ${formatNum(bDef.totalCost.crystal)} C / ${formatNum(bDef.totalCost.deuterium)} D).</p>
            <button type="button" id="btn-start-bacino" class="btn btn-blue">AVVIA BACINO SPAZIALE</button>
          </div>
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