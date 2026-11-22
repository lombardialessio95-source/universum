/** UNIVERSUM / modules/ui/simulator.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const UI = window.UniversumUI;


  UI.runDebouncedSimulation = function (report) {
    const st = UI.state;
    const uni = st.currentUniverse;
    if (st.simDebounceTimer) clearTimeout(st.simDebounceTimer);
    st.simDebounceTimer = setTimeout(() => {
      const box = document.getElementById('sim-results-panel');
      if (!box) return;
      try {
        let res;
        if (st.isMultiplayerMode) {
          const combat = window.UniversumGalaxy.resolveCombat(st.simFleet, uni.researches, {
            fleet: report.fleet || {},
            defenses: report.defenses || {},
            tech: report.tech || { weaponsTech: 0, shieldingTech: 0, armourTech: 0 },
            resources: report.resources || { metal: 0, crystal: 0, deuterium: 0 },
            buildings: report.buildings || {},
            moon: report.hasMoon ? { name: 'Luna' } : null
          });
          const winPct = combat.result === 'attacker_win' ? 95 : combat.result === 'draw' ? 50 : 5;
          res = {
            uncertaintyPct: 5,
            winPct,
            drawPct: combat.result === 'draw' ? 50 : 0,
            losePct: 100 - winPct,
            avgLosses: 0,
            estimatedLoot: combat.loot.metal + combat.loot.crystal + combat.loot.deuterium,
            debrisCreated: combat.debris.metal + combat.debris.crystal,
            advice: winPct >= 80 ? 'ATTACCO CONSIGLIATO' : winPct < 45 ? 'NON ATTACCARE - SEI TROPPO DEBOLE' : 'ATTACCO RISCHIOSO'
          };
        } else {
          res = window.UniversumGalaxy.simulateBattle(
            st.simFleet,
            uni.researches,
            report.coords,
            uni,
            30
          );
        }

        let adviceColor = 'var(--res-energy)';
        if (res.advice === 'ATTACCO CONSIGLIATO') adviceColor = 'var(--btn-green)';
        else if (res.advice.startsWith('NON ATTACCARE')) adviceColor = 'var(--btn-red)';

        box.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
            <strong class="font-display" style="color:${adviceColor};">${res.advice}</strong>
            <span class="badge badge-blue">Incertezza: ±${res.uncertaintyPct}%</span>
          </div>
          <div style="display:flex; height:14px; border-radius:7px; overflow:hidden; background:#111; margin-bottom:8px;">
            <div style="width:${res.winPct}%; background:var(--btn-green);"></div>
            <div style="width:${res.drawPct}%; background:var(--res-energy);"></div>
            <div style="width:${res.losePct}%; background:var(--btn-red);"></div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.88rem; margin-bottom:8px;">
            <span class="text-metal">Vittoria: ${res.winPct}%</span>
            <span class="text-energy">Pareggio: ${res.drawPct}%</span>
            <span style="color:var(--btn-red);">Sconfitta: ${res.losePct}%</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:0.86rem;">
            <div>Bottino Stimato: <strong class="text-metal">${UI.formatNum(res.estimatedLoot)}</strong></div>
            <div>Detriti Generati: <strong class="text-crystal">${UI.formatNum(res.debrisCreated)}</strong></div>
          </div>
        `;
      } catch (e) {
        box.innerHTML = `<p class="text-muted">${UI.escapeHTML(e.message)}</p>`;
      }
    }, 100);
  };
})();
