/** UNIVERSUM / modules/ui/ui-empire.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';

  const UI = window.UniversumUI;


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
