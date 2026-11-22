/** UNIVERSUM / modules/ui/fleet.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const UI = window.UniversumUI;


  // =========================================================
  // FLOTTA & MISSIONI (SPINTA 10-100%, ESPLORAZIONE, EMBARGO, OCCUPAZIONE)
  // =========================================================
  UI.renderFleet = function (viewport) {
    const { escapeHTML, formatNum, formatDuration, svgIcon, artTag } = UI;
    const st = UI.state;
    const uni = st.currentUniverse;
    const Data = window.UniversumData;
    const Galaxy = window.UniversumGalaxy;
    const MCore = window.UniversumMissionsCore;
    const Siege = window.UniversumSiege;
    const pIdx = UI.getActivePlanetIndex();
    const planet = UI.getActivePlanet();

    if (!st.fleetFuelPercent) st.fleetFuelPercent = 100;
    if (!st.fleetExploreHours) st.fleetExploreHours = 1;
    if (!st.fleetRansom) st.fleetRansom = { metal: 10000, crystal: 5000, deuterium: 2500 };

    const maxSlots = MCore ? MCore.getMaxFleetSlots(uni) : (5 + Number(uni.researches?.computerTech || 0));
    const usedSlots = MCore ? MCore.getUsedFleetSlots(uni) : (uni.fleetsInFlight || []).length;
    const maxExpHours = MCore ? MCore.getMaxExploreHours(uni) : 1;
    if (st.fleetExploreHours > maxExpHours) st.fleetExploreHours = maxExpHours;

    const availableShips = Object.values(Data.SHIPS).filter((s) => s.id !== 'solarSatellite');
    const getShipAvail = (shipId) => shipId === 'invictus'
      ? Number(planet.bacinoSpaziale?.invictusActive || 0)
      : shipId === 'crepuscolo'
        ? (planet.bacinoSpaziale?.crepuscolo?.status === 'active' ? 1 : 0)
        : Number(planet.fleet[shipId] || 0);
    const dist = Galaxy.calculateDistance(planet.coords, st.fleetTarget);
    // La capacità si calcola dalle navi selezionate, come nei motori offline/online.
    const cargoCapacity = Object.entries(st.fleetSelection).reduce((sum, [sid, quantity]) => {
      const validQty = Math.min(getShipAvail(sid), Math.max(0, Math.floor(Number(quantity) || 0)));
      return sum + validQty * Number(Data.SHIPS[sid]?.cargo || 0);
    }, 0);
    const flightStats = MCore
      ? MCore.getAdjustedFlightStats(uni, st.fleetSelection, dist, st.fleetFuelPercent, st.fleetExploreHours, st.fleetMission)
      : Galaxy.getFleetSpeedAndFuel(uni, st.fleetSelection, dist);

    // Il carburante occupa spazio in Galaxy.launchFleet: riservarlo anche
    // nel caricamento assistito evita di suggerire spedizioni non valide.
    const fuelReserved = Math.max(0, Math.ceil(Number(flightStats.fuelCost) || 0));
    const cargoUsable = Math.max(0, Math.floor(cargoCapacity - fuelReserved));
    const cargoLoaded = ['metal', 'crystal', 'deuterium'].reduce((n, key) =>
      n + Math.max(0, Math.floor(Number(st.fleetCargo[key]) || 0)), 0);
    const embargoHours = (st.fleetMission === 'embargo' && MCore)
      ? MCore.calculateEmbargoHours(st.fleetSelection, st.fleetCargo.deuterium)
      : 0;

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div class="glass-panel" style="padding:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <h2 style="font-size:1.05rem; color:var(--res-crystal);">1. SELEZIONE SQUADRONE</h2>
              <span class="badge ${usedSlots >= maxSlots ? 'badge-red' : 'badge-green'}">Slot: ${usedSlots}/${maxSlots}</span>
            </div>
            <div style="display:flex; gap:8px;">
              <button type="button" id="btn-fleet-all" class="btn btn-blue btn-sm">TUTTI</button>
              <button type="button" id="btn-fleet-zero" class="btn btn-ghost btn-sm">AZZERA</button>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px;">
            ${availableShips.map((s) => {
              const avail = getShipAvail(s.id);
              const sel = Number(st.fleetSelection[s.id] || 0);
              return `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; background:rgba(0,0,0,0.35); padding:8px 10px; border-radius:8px;">
                  <div style="min-width:0; flex:1; display:flex; align-items:center; gap:10px;">
                    ${artTag(s.id, 'unit-art-sm', s.name)}
                    <div style="min-width:0;">
                      <strong>${escapeHTML(s.name)}</strong>
                      <div class="text-muted" style="font-size:0.85rem;">Disp: ${formatNum(avail)}</div>
                    </div>
                  </div>
                  <div style="display:flex; gap:6px; align-items:center;">
                    <input type="number" class="form-control fleet-ship-input" data-sid="${s.id}" min="0" max="${avail}" value="${sel}" style="width:82px; text-align:center;" ${avail === 0 ? 'disabled' : ''}>
                    <button type="button" class="btn btn-ghost btn-sm btn-fleet-plus10" data-sid="${s.id}" ${avail === 0 ? 'disabled' : ''}>+10</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h2 style="font-size:1.05rem; color:var(--res-crystal); margin-bottom:10px;">2. COORDINATE, SPINTA &amp; MISSIONE</h2>
          <div class="form-grid-3">
            <div class="form-group">
              <label>Galassia</label>
              <input type="number" id="flt-target-g" class="form-control" min="1" max="${uni.galaxies}" value="${st.fleetTarget.g}">
            </div>
            <div class="form-group">
              <label>Sistema</label>
              <input type="number" id="flt-target-s" class="form-control" min="1" max="${uni.systemsPerGalaxy}" value="${st.fleetTarget.s}">
            </div>
            <div class="form-group">
              <label>Posizione</label>
              <input type="number" id="flt-target-p" class="form-control" min="1" max="16" value="${st.fleetTarget.p}">
            </div>
          </div>

          <div style="background:rgba(0,0,0,0.35); padding:10px 12px; border-radius:8px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <label style="margin:0; font-size:0.88rem; color:var(--res-crystal);">POTENZA MOTORI &amp; CARBURANTE</label>
              <strong id="flt-fuel-pct-label" class="font-display text-deuterium">${st.fleetFuelPercent}%</strong>
            </div>
            <input type="range" id="flt-fuel-slider" min="10" max="100" step="10" value="${st.fleetFuelPercent}" style="width:100%; height:28px;">
            <div class="text-muted" style="font-size:0.8rem;">Riduci la spinta per risparmiare fino all'80% di Deuterio (aumenta il tempo di volo).</div>
          </div>

          <div class="form-group">
            <label>Tipo Missione</label>
            <select id="flt-mission-select" class="form-control">
              <option value="attack" ${st.fleetMission === 'attack' ? 'selected' : ''}>Attacca Bersaglio</option>
              <option value="spy" ${st.fleetMission === 'spy' ? 'selected' : ''}>Spionaggio</option>
              <option value="embargo" ${st.fleetMission === 'embargo' ? 'selected' : ''}>Embargo Planetario (Blocca Rotte)</option>
              <option value="occupy" ${st.fleetMission === 'occupy' ? 'selected' : ''}>Occupazione Planetaria (Prelievo 5%/g + Riscatto)</option>
              <option value="colonize" ${st.fleetMission === 'colonize' ? 'selected' : ''}>Colonizza Pianeta Vuoto</option>
              <option value="transport" ${st.fleetMission === 'transport' ? 'selected' : ''}>Trasporta Risorse</option>
              <option value="deploy" ${st.fleetMission === 'deploy' ? 'selected' : ''}>Schiera Flotta su Tuo Pianeta</option>
              <option value="explore" ${st.fleetMission === 'explore' ? 'selected' : ''}>Esplora Spazio Profondo (Pos. 16)</option>
              <option value="recycle" ${st.fleetMission === 'recycle' ? 'selected' : ''}>Ricicla Campo Detriti</option>
              <option value="destroyMoon" ${st.fleetMission === 'destroyMoon' ? 'selected' : ''}>Distruggi Luna/Bacino (Morte Nera)</option>
            </select>
          </div>

          <div id="explore-options-box" class="${st.fleetMission === 'explore' ? '' : 'hidden'}" style="background:rgba(0,210,255,0.08); border:1px solid rgba(0,210,255,0.25); padding:10px; border-radius:8px; margin-bottom:12px;">
            <div class="form-group" style="margin-bottom:8px;">
              <label>Durata Stazionamento Esplorativo (Max ${maxExpHours}h con Esplorazione Profonda Lv.${Number(uni.researches?.expeditionTech || 0)})</label>
              <p class="text-muted" style="font-size:0.85rem; margin-bottom:8px;">Esplorazione Spaziale Profonda — Livello attuale: <strong class="text-crystal">${Number(uni.researches?.expeditionTech || 0)}</strong> • Max attuale: <strong class="text-crystal">${maxExpHours}h</strong> • Ogni livello aggiunge <strong>+1h</strong> di durata massima (1h base + 1h per livello).</p>
              <select id="flt-explore-hours" class="form-control">
                ${Array.from({ length: maxExpHours }, (_, idx) => idx + 1).map((h) => `
                  <option value="${h}" ${st.fleetExploreHours === h ? 'selected' : ''}>${h} ${h === 1 ? 'Ora' : 'Ore'} di Esplorazione</option>
                `).join('')}
              </select>
            </div>
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="flt-blackhole-chk" ${st.fleetBlackHole ? 'checked' : ''} style="width:20px; height:20px;">
              <span>Spedizione Segreta nel Buco Nero (+50.000 Deuterio)</span>
            </label>
          </div>

          <div class="${st.fleetMission === 'embargo' ? '' : 'hidden'}" style="background:rgba(255,23,68,0.1); border:1px solid rgba(255,23,68,0.35); padding:10px; border-radius:8px; margin-bottom:12px; font-size:0.88rem;">
            <strong>Blocca completamente partenze e arrivi del pianeta bersaglio.</strong><br>
            Carica <strong>Deuterio</strong> nelle stive per alimentare l'orbita • Autonomia stimata: <strong class="text-deuterium">${embargoHours} ore</strong>.
          </div>

          <div class="${st.fleetMission === 'occupy' ? '' : 'hidden'}" style="background:rgba(255,215,0,0.08); border:1px solid rgba(255,215,0,0.35); padding:10px; border-radius:8px; margin-bottom:12px;">
            <div style="font-size:0.88rem; margin-bottom:8px;">
              <strong>Prelievo automatico del 5% al giorno</strong> finché c'è deuterio disponibile. Imposta il <strong>Riscatto</strong> che il nemico può pagare per liberare il pianeta:
            </div>
            <div class="form-grid-3">
              <div class="form-group" style="margin-bottom:0;">
                <label>Riscatto Metallo</label>
                <input type="number" id="flt-ransom-m" class="form-control" min="0" value="${st.fleetRansom.metal}">
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label>Riscatto Cristallo</label>
                <input type="number" id="flt-ransom-c" class="form-control" min="0" value="${st.fleetRansom.crystal}">
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label>Riscatto Deuterio</label>
                <input type="number" id="flt-ransom-d" class="form-control" min="0" value="${st.fleetRansom.deuterium}">
              </div>
            </div>
          </div>

          <div class="fleet-cargo-panel">
            <div class="fleet-cargo-heading">
              <strong>${svgIcon('cargo')} GESTIONE STIVA</strong>
              <button type="button" id="flt-cargo-thirds" class="btn btn-blue btn-sm" title="Distribuisci un terzo della stiva per ciascuna risorsa disponibile">SMEZZA · ⅓ PER RISORSA</button>
            </div>
            <div class="fleet-cargo-meter" role="progressbar" aria-label="Occupazione stiva" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${cargoUsable ? Math.min(100, Math.round(cargoLoaded * 100 / cargoUsable)) : 0}">
              <div id="flt-cargo-meter-fill" style="width:${cargoUsable ? Math.min(100, Math.round(cargoLoaded * 100 / cargoUsable)) : 0}%"></div>
            </div>
            <p class="text-muted fleet-cargo-status" id="flt-cargo-status" aria-live="polite">Carico ${formatNum(cargoLoaded)} / ${formatNum(cargoUsable)} · Carburante riservato ${formatNum(fuelReserved)} D</p>
            <div class="fleet-cargo-grid">
              ${[
                { key: 'metal', label: 'Metallo', short: 'm' },
                { key: 'crystal', label: 'Cristallo', short: 'c' },
                { key: 'deuterium', label: st.fleetMission === 'embargo' ? 'Deuterio Embargo' : 'Deuterio', short: 'd' }
              ].map((r) => `<div class="fleet-cargo-resource">
                <label for="flt-cargo-${r.short}">${UI.resIconTag(r.key)} ${r.label}</label>
                <input type="number" inputmode="numeric" id="flt-cargo-${r.short}" class="form-control fleet-cargo-input" min="0" value="${Math.max(0, Math.floor(Number(st.fleetCargo[r.key]) || 0))}">
                <div class="fleet-cargo-actions">
                  <button type="button" class="btn btn-ghost btn-sm fleet-cargo-fill" data-resource="${r.key}" title="Carica al massimo lo spazio rimasto">RIEMPI</button>
                  <button type="button" class="btn btn-ghost btn-sm fleet-cargo-half" data-resource="${r.key}" title="Carica metà dello spazio ancora libero">METÀ</button>
                </div>
              </div>`).join('')}
            </div>
          </div>

          <div style="background:rgba(0,0,0,0.4); padding:12px; border-radius:8px; margin-bottom:14px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <span>Distanza: <strong>${formatNum(dist)}</strong></span>
            <span>Viaggio: <strong class="text-crystal">${formatDuration(flightStats.durationSec)}</strong></span>
            <span>Carburante: <strong class="text-deuterium">${formatNum(flightStats.fuelCost)} D</strong></span>
          </div>

          <button type="button" id="btn-launch-fleet" class="btn btn-green" style="width:100%;" ${usedSlots >= maxSlots ? 'disabled' : ''}>
            ${svgIcon('rocket')} ${usedSlots >= maxSlots ? `SLOT FLOTTA PIENI (${usedSlots}/${maxSlots})` : 'INVIA FLOTTA IN MISSIONE'}
          </button>
        </div>
      </div>
    `;

    const cargoFields = { metal: 'flt-cargo-m', crystal: 'flt-cargo-c', deuterium: 'flt-cargo-d' };
    const cargoKeys = Object.keys(cargoFields);
    const cargoInt = (value) => Math.max(0, Math.floor(Number(value) || 0));
    const cargoRead = () => Object.fromEntries(cargoKeys.map(key =>
      [key, cargoInt(document.getElementById(cargoFields[key])?.value)]));
    const cargoAvailable = (key) => uni.creativeMode
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, cargoInt(planet.resources?.[key]) - (key === 'deuterium' ? fuelReserved +
          (st.fleetMission === 'explore' && st.fleetBlackHole ? 50000 : 0) : 0));
    const cargoWrite = (values) => {
      for (const key of cargoKeys) {
        document.getElementById(cargoFields[key]).value = String(cargoInt(values[key]));
        st.fleetCargo[key] = cargoInt(values[key]);
      }
      cargoUpdateDisplay();
    };
    const cargoUpdateDisplay = () => {
      const current = cargoRead();
      for (const key of cargoKeys) st.fleetCargo[key] = current[key];
      const load = Object.values(current).reduce((a,b) => a + b, 0);
      const percent = cargoUsable ? Math.round(load / cargoUsable * 100) : 0;
      const fill = document.getElementById('flt-cargo-meter-fill');
      if (fill) fill.style.width = `${Math.min(100, percent)}%`;
      const meter = viewport.querySelector('.fleet-cargo-meter');
      if (meter) meter.setAttribute('aria-valuenow', String(Math.min(100, percent)));
      const status = document.getElementById('flt-cargo-status');
      if (status) {
        status.textContent = `Carico ${formatNum(load)} / ${formatNum(cargoUsable)} · Carburante riservato ${formatNum(fuelReserved)} D`;
        status.classList.toggle('fleet-cargo-overload', load > cargoUsable || cargoKeys.some(k => current[k] > cargoAvailable(k)));
      }
    };
    const cargoSetOne = (key, part) => {
      const values = cargoRead();
      const other = cargoKeys.filter(k => k !== key).reduce((a,k) => a + values[k], 0);
      const free = Math.max(0, cargoUsable - other);
      const target = part === 1 ? free : Math.floor(free / 2);
      values[key] = Math.min(target, cargoAvailable(key));
      cargoWrite(values);
    };
    viewport.querySelectorAll('.fleet-cargo-fill').forEach(btn =>
      btn.addEventListener('click', () => cargoSetOne(btn.dataset.resource, 1)));
    viewport.querySelectorAll('.fleet-cargo-half').forEach(btn =>
      btn.addEventListener('click', () => cargoSetOne(btn.dataset.resource, 2)));
    document.getElementById('flt-cargo-thirds')?.addEventListener('click', () => {
      // Ogni risorsa riceve al massimo 1/3 della capienza utile. Non si
      // spostano arbitrariamente le quote mancanti su altre risorse.
      const third = Math.floor(cargoUsable / 3);
      const values = Object.fromEntries(cargoKeys.map(k => [k, Math.min(third, cargoAvailable(k))]));
      cargoWrite(values);
    });
    viewport.querySelectorAll('.fleet-cargo-input').forEach(input =>
      input.addEventListener('input', cargoUpdateDisplay));

    const syncTarget = () => {
      st.fleetTarget.g = Math.max(1, Number(document.getElementById('flt-target-g').value) || 1);
      st.fleetTarget.s = Math.max(1, Number(document.getElementById('flt-target-s').value) || 1);
      st.fleetTarget.p = Math.max(1, Number(document.getElementById('flt-target-p').value) || 1);
      st.fleetMission = document.getElementById('flt-mission-select').value;
      st.fleetFuelPercent = Math.min(100, Math.max(10, Number(document.getElementById('flt-fuel-slider')?.value) || 100));
      st.fleetExploreHours = Math.max(1, Number(document.getElementById('flt-explore-hours')?.value) || 1);
      st.fleetBlackHole = Boolean(document.getElementById('flt-blackhole-chk')?.checked);
      st.fleetCargo.metal = Math.max(0, Number(document.getElementById('flt-cargo-m').value) || 0);
      st.fleetCargo.crystal = Math.max(0, Number(document.getElementById('flt-cargo-c').value) || 0);
      st.fleetCargo.deuterium = Math.max(0, Number(document.getElementById('flt-cargo-d').value) || 0);
      st.fleetRansom = {
        metal: Math.max(0, Number(document.getElementById('flt-ransom-m')?.value) || 0),
        crystal: Math.max(0, Number(document.getElementById('flt-ransom-c')?.value) || 0),
        deuterium: Math.max(0, Number(document.getElementById('flt-ransom-d')?.value) || 0)
      };
    };

    viewport.querySelectorAll('.fleet-ship-input').forEach((inp) => {
      inp.addEventListener('change', () => {
        st.fleetSelection[inp.dataset.sid] = Math.max(0, Math.floor(Number(inp.value) || 0));
        UI.renderCurrentView();
      });
    });

    viewport.querySelectorAll('.btn-fleet-plus10').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sid = btn.dataset.sid;
        const avail = getShipAvail(sid);
        st.fleetSelection[sid] = Math.min(avail, (st.fleetSelection[sid] || 0) + 10);
        UI.renderCurrentView();
      });
    });

    document.getElementById('btn-fleet-all')?.addEventListener('click', () => {
      for (const s of availableShips) st.fleetSelection[s.id] = getShipAvail(s.id);
      UI.renderCurrentView();
    });

    document.getElementById('btn-fleet-zero')?.addEventListener('click', () => {
      st.fleetSelection = {};
      UI.renderCurrentView();
    });

    document.getElementById('flt-fuel-slider')?.addEventListener('input', (e) => {
      const lbl = document.getElementById('flt-fuel-pct-label');
      if (lbl) lbl.textContent = `${e.target.value}%`;
    });
    document.getElementById('flt-fuel-slider')?.addEventListener('change', () => {
      syncTarget();
      UI.renderCurrentView();
    });

    document.getElementById('flt-mission-select')?.addEventListener('change', (e) => {
      syncTarget();
      if (e.target.value === 'explore') st.fleetTarget.p = 16;
      UI.renderCurrentView();
    });

    ['flt-target-g', 'flt-target-s', 'flt-target-p', 'flt-explore-hours'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', () => {
        syncTarget();
        UI.renderCurrentView();
      });
    });

    document.getElementById('btn-launch-fleet')?.addEventListener('click', async () => {
      syncTarget();
      try {
        let missionObj;
        const opts = {
          blackHole: st.fleetBlackHole,
          fuelPercent: st.fleetFuelPercent,
          exploreHours: st.fleetExploreHours,
          ransom: st.fleetRansom
        };

        if (st.isMultiplayerMode && window.UniversumMP?.launchOnlineFleet) {
          missionObj = await window.UniversumMP.launchOnlineFleet(
            uni,
            pIdx,
            st.fleetTarget,
            st.fleetMission,
            st.fleetSelection,
            st.fleetCargo,
            opts
          );
        } else if (Siege && typeof Siege.launchEnhancedFleet === 'function') {
          missionObj = Siege.launchEnhancedFleet(
            uni,
            pIdx,
            st.fleetTarget,
            st.fleetMission,
            st.fleetSelection,
            st.fleetCargo,
            opts
          );
          await window.UniversumDB.save(uni);
        } else {
          missionObj = Galaxy.launchFleet(
            uni,
            pIdx,
            st.fleetTarget,
            st.fleetMission,
            st.fleetSelection,
            st.fleetCargo,
            opts
          );
          await window.UniversumDB.save(uni);
        }

        st.fleetSelection = {};
        st.fleetCargo = { metal: 0, crystal: 0, deuterium: 0 };
        UI.updateTopBarNumbers();
        UI.playSound('success');
        UI.toast(`Flotta inviata verso [${missionObj.targetCoords.g}:${missionObj.targetCoords.s}:${missionObj.targetCoords.p}]!`, 'success');
        UI.switchView('movements');
      } catch (err) {
        UI.playSound('error');
        UI.toast(err.message, 'error');
      }
    });
  };
})();
