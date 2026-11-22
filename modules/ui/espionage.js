/** UNIVERSUM / modules/ui/espionage.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const UI = window.UniversumUI;


  // =========================================================
  // SPIONAGGIO & CALCOLATORE BATTAGLIA
  // =========================================================
  UI.renderEspionageAndSim = function (viewport) {
    const { escapeHTML, formatNum, svgIcon, resIconTag, artTag } = UI;
    const st = UI.state;
    const uni = st.currentUniverse;
    const Data = window.UniversumData;
    const reports = uni.spyReports || [];
    const selectedReport = reports.find((r) => r.id === st.selectedSpyReportId) || null;
    const planet = UI.getActivePlanet();
    const combatShips = Object.values(Data.SHIPS).filter((s) => s.attack > 0 && s.id !== 'solarSatellite');

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        ${selectedReport ? `
          <div class="glass-panel" style="padding:14px; border-color:var(--btn-gold);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
              <h2 style="font-size:1.05rem; color:var(--btn-gold);">SIMULATORE TATTICO — ${escapeHTML(selectedReport.targetName)} [${selectedReport.key}]</h2>
              <button type="button" id="btn-close-sim" class="btn btn-ghost btn-sm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="vertical-align:middle"><path d="M5 5l14 14M19 5L5 19"/></svg> CHIUDI</button>
            </div>
            <div id="sim-results-panel" style="background:rgba(0,0,0,0.45); padding:12px; border-radius:10px; margin-bottom:12px;"></div>
            <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:14px;">
              ${combatShips.map((s) => {
                const maxOwned = Math.max(Number(planet.fleet[s.id] || 0), (uni.creativeMode && !st.isMultiplayerMode) ? 500 : 0);
                const curVal = Number(st.simFleet[s.id] || 0);
                return `
                  <div style="background:rgba(0,0,0,0.35); padding:8px 10px; border-radius:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                      <span style="display:inline-flex; align-items:center; gap:8px;">${artTag(s.id, 'unit-art-sm', s.name)} <strong>${escapeHTML(s.name)}</strong> (Disp: ${formatNum(planet.fleet[s.id] || 0)})</span>
                      <span class="font-display text-crystal" id="sim-lbl-${s.id}">${curVal}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <button type="button" class="btn btn-ghost btn-sm btn-sim-step" data-sid="${s.id}" data-delta="-10" style="min-width:44px;">-</button>
                      <input type="range" class="sim-range-slider" data-sid="${s.id}" min="0" max="${Math.max(100, maxOwned)}" value="${curVal}" style="flex:1; height:32px;">
                      <button type="button" class="btn btn-ghost btn-sm btn-sim-step" data-sid="${s.id}" data-delta="10" style="min-width:44px;">+</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
            <button type="button" id="btn-sim-real-attack" class="btn btn-red" style="width:100%;">${svgIcon('sword')} INVIA FLOTTA VERA CONTRO [${selectedReport.key}]</button>
          </div>
        ` : ''}

        <div class="glass-panel" style="padding:14px;">
          <h2 style="font-size:1.05rem; color:var(--res-crystal); margin-bottom:10px;">ARCHIVIO RAPPORTI DI SPIONAGGIO (${reports.length})</h2>
          ${reports.length === 0 ? '<p class="text-muted">Nessun rapporto disponibile. Invia Sonde Spia dalla Galassia.</p>' : `
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${reports.map((r) => `
                <div style="background:rgba(0,0,0,0.35); padding:12px; border-radius:8px; border:1px solid rgba(0,210,255,0.2);">
                  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:6px;">
                    <strong>${escapeHTML(r.targetName)} [${r.key}] — ${escapeHTML(r.emperor || r.ownerName || '')}</strong>
                    <span class="badge badge-blue">Scansioni: ${r.scanCount || 1}</span>
                  </div>
                  <div style="font-size:0.9rem; margin-bottom:8px; display:flex; flex-wrap:wrap; gap:10px;">
                    <span>Risorse:</span>
                    <span class="cost-item text-metal">${resIconTag('metal')} ${formatNum(r.resources?.metal || 0)}</span>
                    <span class="cost-item text-crystal">${resIconTag('crystal')} ${formatNum(r.resources?.crystal || 0)}</span>
                    <span class="cost-item text-deuterium">${resIconTag('deuterium')} ${formatNum(r.resources?.deuterium || 0)}</span>
                  </div>
                  <button type="button" class="btn btn-creative btn-sm btn-open-sim" data-rid="${r.id}">${svgIcon('radar')} SIMULA BATTAGLIA</button>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;

    if (selectedReport) {
      UI.runDebouncedSimulation(selectedReport);

      document.getElementById('btn-close-sim')?.addEventListener('click', () => {
        st.selectedSpyReportId = null;
        UI.renderCurrentView();
      });

      viewport.querySelectorAll('.sim-range-slider').forEach((slider) => {
        slider.addEventListener('input', () => {
          const sid = slider.dataset.sid;
          const val = Math.max(0, Math.floor(Number(slider.value) || 0));
          st.simFleet[sid] = val;
          const lbl = document.getElementById(`sim-lbl-${sid}`);
          if (lbl) lbl.textContent = val;
          UI.runDebouncedSimulation(selectedReport);
        });
      });

      viewport.querySelectorAll('.btn-sim-step').forEach((btn) => {
        btn.addEventListener('click', () => {
          const sid = btn.dataset.sid;
          const delta = Number(btn.dataset.delta);
          const slider = viewport.querySelector(`.sim-range-slider[data-sid="${sid}"]`);
          const next = Math.max(0, (st.simFleet[sid] || 0) + delta);
          st.simFleet[sid] = next;
          if (slider) {
            if (next > Number(slider.max)) slider.max = next;
            slider.value = next;
          }
          const lbl = document.getElementById(`sim-lbl-${sid}`);
          if (lbl) lbl.textContent = next;
          UI.runDebouncedSimulation(selectedReport);
        });
      });

      document.getElementById('btn-sim-real-attack')?.addEventListener('click', () => {
        st.fleetSelection = Object.assign({}, st.simFleet);
        st.fleetTarget = Object.assign({}, selectedReport.coords);
        st.fleetMission = 'attack';
        UI.switchView('fleet');
      });
    }

    viewport.querySelectorAll('.btn-open-sim').forEach((btn) => {
      btn.addEventListener('click', () => {
        st.selectedSpyReportId = btn.dataset.rid;
        st.simFleet = {};
        for (const s of combatShips) st.simFleet[s.id] = Number(planet.fleet[s.id] || 0);
        UI.renderCurrentView();
      });
    });
  };
})();
