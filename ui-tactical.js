(function () {
  'use strict';

  const UI = window.UniversumUI;

  // =========================================================
  // FLOTTA & MISSIONI
  // =========================================================
  UI.renderFleet = function (viewport) {
    const { escapeHTML, formatNum, formatDuration, svgIcon, artTag } = UI;
    const st = UI.state;
    const uni = st.currentUniverse;
    const Data = window.UniversumData;
    const Galaxy = window.UniversumGalaxy;
    const pIdx = UI.getActivePlanetIndex();
    const planet = UI.getActivePlanet();

    const availableShips = Object.values(Data.SHIPS).filter((s) => s.id !== 'solarSatellite');
    const dist = Galaxy.calculateDistance(planet.coords, st.fleetTarget);
    const flightStats = Galaxy.getFleetSpeedAndFuel(uni, st.fleetSelection, dist);

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div class="glass-panel" style="padding:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
            <h2 style="font-size:1.05rem; color:var(--res-crystal);">1. SELEZIONE SQUADRONE</h2>
            <div style="display:flex; gap:8px;">
              <button type="button" id="btn-fleet-all" class="btn btn-blue btn-sm">TUTTI</button>
              <button type="button" id="btn-fleet-zero" class="btn btn-ghost btn-sm">AZZERA</button>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px;">
            ${availableShips.map((s) => {
              const avail = Number(planet.fleet[s.id] || 0);
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
          <h2 style="font-size:1.05rem; color:var(--res-crystal); margin-bottom:10px;">2. COORDINATE & MISSIONE</h2>
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

          <div class="form-group">
            <label>Tipo Missione</label>
            <select id="flt-mission-select" class="form-control">
              <option value="attack" ${st.fleetMission === 'attack' ? 'selected' : ''}>Attacca Bersaglio</option>
              <option value="spy" ${st.fleetMission === 'spy' ? 'selected' : ''}>Spionaggio</option>
              <option value="colonize" ${st.fleetMission === 'colonize' ? 'selected' : ''}>Colonizza Pianeta Vuoto</option>
              <option value="transport" ${st.fleetMission === 'transport' ? 'selected' : ''}>Trasporta Risorse</option>
              <option value="deploy" ${st.fleetMission === 'deploy' ? 'selected' : ''}>Schiera Flotta su Tuo Pianeta</option>
              <option value="explore" ${st.fleetMission === 'explore' ? 'selected' : ''}>Esplora Spazio Profondo (Pos. 16)</option>
              <option value="recycle" ${st.fleetMission === 'recycle' ? 'selected' : ''}>Ricicla Campo Detriti</option>
              <option value="destroyMoon" ${st.fleetMission === 'destroyMoon' ? 'selected' : ''}>Distruggi Luna (Morte Nera)</option>
            </select>
          </div>

          <div id="blackhole-option-box" class="${st.fleetMission === 'explore' ? '' : 'hidden'}" style="margin-bottom:12px;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="flt-blackhole-chk" ${st.fleetBlackHole ? 'checked' : ''} style="width:20px; height:20px;">
              <span>Spedizione Segreta nel Buco Nero (+50.000 Deuterio)</span>
            </label>
          </div>

          <div class="form-grid-3">
            <div class="form-group">
              <label>Carico Metallo</label>
              <input type="number" id="flt-cargo-m" class="form-control" min="0" value="${st.fleetCargo.metal}">
            </div>
            <div class="form-group">
              <label>Carico Cristallo</label>
              <input type="number" id="flt-cargo-c" class="form-control" min="0" value="${st.fleetCargo.crystal}">
            </div>
            <div class="form-group">
              <label>Carico Deuterio</label>
              <input type="number" id="flt-cargo-d" class="form-control" min="0" value="${st.fleetCargo.deuterium}">
            </div>
          </div>

          <div style="background:rgba(0,0,0,0.4); padding:12px; border-radius:8px; margin-bottom:14px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <span>Distanza: <strong>${formatNum(dist)}</strong></span>
            <span>Durata Viaggio: <strong class="text-crystal">${formatDuration(flightStats.durationSec)}</strong></span>
            <span>Consumo Carburante: <strong class="text-deuterium">${formatNum(flightStats.fuelCost)} D</strong></span>
          </div>

          <button type="button" id="btn-launch-fleet" class="btn btn-green" style="width:100%;">${svgIcon('rocket')} INVIA FLOTTA IN MISSIONE</button>
        </div>
      </div>
    `;

    viewport.querySelectorAll('.fleet-ship-input').forEach((inp) => {
      inp.addEventListener('input', () => {
        st.fleetSelection[inp.dataset.sid] = Math.max(0, Math.floor(Number(inp.value) || 0));
      });
    });

    viewport.querySelectorAll('.btn-fleet-plus10').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sid = btn.dataset.sid;
        const avail = Number(planet.fleet[sid] || 0);
        st.fleetSelection[sid] = Math.min(avail, (st.fleetSelection[sid] || 0) + 10);
        UI.renderCurrentView();
      });
    });

    document.getElementById('btn-fleet-all')?.addEventListener('click', () => {
      for (const s of availableShips) st.fleetSelection[s.id] = Number(planet.fleet[s.id] || 0);
      UI.renderCurrentView();
    });

    document.getElementById('btn-fleet-zero')?.addEventListener('click', () => {
      st.fleetSelection = {};
      UI.renderCurrentView();
    });

    const syncTarget = () => {
      st.fleetTarget.g = Math.max(1, Number(document.getElementById('flt-target-g').value) || 1);
      st.fleetTarget.s = Math.max(1, Number(document.getElementById('flt-target-s').value) || 1);
      st.fleetTarget.p = Math.max(1, Number(document.getElementById('flt-target-p').value) || 1);
      st.fleetMission = document.getElementById('flt-mission-select').value;
      st.fleetBlackHole = Boolean(document.getElementById('flt-blackhole-chk')?.checked);
      st.fleetCargo.metal = Math.max(0, Number(document.getElementById('flt-cargo-m').value) || 0);
      st.fleetCargo.crystal = Math.max(0, Number(document.getElementById('flt-cargo-c').value) || 0);
      st.fleetCargo.deuterium = Math.max(0, Number(document.getElementById('flt-cargo-d').value) || 0);
    };

    document.getElementById('flt-mission-select')?.addEventListener('change', (e) => {
      syncTarget();
      if (e.target.value === 'explore') st.fleetTarget.p = 16;
      UI.renderCurrentView();
    });

    ['flt-target-g', 'flt-target-s', 'flt-target-p'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', () => {
        syncTarget();
        UI.renderCurrentView();
      });
    });

    document.getElementById('btn-launch-fleet')?.addEventListener('click', async () => {
      syncTarget();
      try {
        let missionObj;
        if (st.isMultiplayerMode && window.UniversumMP?.launchOnlineFleet) {
          missionObj = await window.UniversumMP.launchOnlineFleet(
            uni,
            pIdx,
            st.fleetTarget,
            st.fleetMission,
            st.fleetSelection,
            st.fleetCargo,
            { blackHole: st.fleetBlackHole }
          );
        } else {
          missionObj = Galaxy.launchFleet(
            uni,
            pIdx,
            st.fleetTarget,
            st.fleetMission,
            st.fleetSelection,
            st.fleetCargo,
            { blackHole: st.fleetBlackHole }
          );
          await window.UniversumDB.save(uni);
        }
        st.fleetSelection = {};
        st.fleetCargo = { metal: 0, crystal: 0, deuterium: 0 };
        UI.updateTopBarNumbers();
        UI.playSound('success');
        UI.toast(`Flotta inviata verso [${missionObj.targetCoords.g}:${missionObj.targetCoords.s}:${missionObj.targetCoords.p}]!`, 'success');
        UI.switchView('overview');
      } catch (err) {
        UI.playSound('error');
        UI.toast(err.message, 'error');
      }
    });
  };

  // =========================================================
  // GALASSIA (CON PULSANTE CHAT PRIVATA PvP)
  // =========================================================
  UI.renderGalaxy = async function (viewport) {
    const { escapeHTML, svgIcon } = UI;
    const st = UI.state;
    const uni = st.currentUniverse;
    const Galaxy = window.UniversumGalaxy;
    const pIdx = UI.getActivePlanetIndex();

    let sysData;
    if (st.isMultiplayerMode && window.UniversumMP?.getOnlineSystem) {
      viewport.innerHTML = `<div class="glass-panel" style="padding:20px; text-align:center;"><p class="text-muted">Sincronizzazione quadrante galattico online...</p></div>`;
      sysData = await window.UniversumMP.getOnlineSystem(uni.id, st.galaxyG, st.galaxyS);
    } else {
      sysData = Galaxy.getSystemData(uni, st.galaxyG, st.galaxyS);
    }

    const myUid = window.fbAuth?.currentUser?.uid;

    const filteredSlots = sysData.slots.filter((slot) => {
      const isMine = st.isMultiplayerMode
        ? (slot.ownerUid && slot.ownerUid === myUid)
        : (slot.ownerType === 'player');
      const isHostileTarget = st.isMultiplayerMode
        ? (slot.ownerUid && slot.ownerUid !== myUid && !slot.isNpc)
        : (slot.ownerType === 'bot');
      const isOutpost = st.isMultiplayerMode && Boolean(slot.isNpc);
      const isEmpty = !slot.ownerUid && slot.ownerType !== 'player' && slot.ownerType !== 'bot' && !slot.isNpc;

      if (st.galaxyFilter === 'mine') return isMine;
      if (st.galaxyFilter === 'bot') return isHostileTarget || isOutpost;
      if (st.galaxyFilter === 'empty') return isEmpty;
      if (st.galaxyFilter === 'moon') return Boolean(slot.moon);
      return true;
    });

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div class="glass-panel" style="padding:14px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
            <div>
              <label style="font-size:0.8rem; color:var(--res-crystal);">GALASSIA (1-${uni.galaxies})</label>
              <div style="display:flex; gap:6px; margin-top:4px;">
                <button type="button" id="gal-prev-g" class="btn btn-blue btn-sm">&lt;</button>
                <input type="number" id="gal-inp-g" class="form-control" value="${sysData.galaxy}" min="1" max="${uni.galaxies}" style="text-align:center;">
                <button type="button" id="gal-next-g" class="btn btn-blue btn-sm">&gt;</button>
              </div>
            </div>
            <div>
              <label style="font-size:0.8rem; color:var(--res-crystal);">SISTEMA (1-${uni.systemsPerGalaxy})</label>
              <div style="display:flex; gap:6px; margin-top:4px;">
                <button type="button" id="gal-prev-s" class="btn btn-blue btn-sm">&lt;</button>
                <input type="number" id="gal-inp-s" class="form-control" value="${sysData.system}" min="1" max="${uni.systemsPerGalaxy}" style="text-align:center;">
                <button type="button" id="gal-next-s" class="btn btn-blue btn-sm">&gt;</button>
              </div>
            </div>
          </div>

          <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:4px;">
            ${[
              { id: 'all', label: 'Tutti' },
              { id: 'mine', label: 'Miei' },
              { id: 'bot', label: st.isMultiplayerMode ? 'Giocatori / Avamposti' : 'BOT' },
              { id: 'empty', label: 'Vuoti' },
              { id: 'moon', label: 'Lune' }
            ].map((f) => `
              <button type="button" class="btn btn-sm ${st.galaxyFilter === f.id ? 'btn-blue' : 'btn-ghost'} btn-gal-filter" data-filter="${f.id}">${f.label}</button>
            `).join('')}
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px;">
          ${filteredSlots.map((slot) => {
            const hasDebris = (slot.debris?.metal || 0) + (slot.debris?.crystal || 0) > 0;
            const isMine = st.isMultiplayerMode
              ? (slot.ownerUid && slot.ownerUid === myUid)
              : (slot.ownerType === 'player');
            const isRealEnemy = st.isMultiplayerMode && slot.ownerUid && slot.ownerUid !== myUid && !slot.isNpc;
            const isNeutralOutpost = st.isMultiplayerMode && Boolean(slot.isNpc);
            const isOfflineBot = !st.isMultiplayerMode && slot.ownerType === 'bot';
            const isEmpty = !isMine && !isRealEnemy && !isNeutralOutpost && !isOfflineBot;

            let cardClass = 'galaxy-slot-empty';
            let badgeHTML = '<span class="badge badge-blue">VUOTO</span>';

            if (isMine) {
              cardClass = 'galaxy-slot-player';
              badgeHTML = '<span class="badge badge-green">TUO PIANETA</span>';
            } else if (isRealEnemy) {
              cardClass = 'galaxy-slot-enemy-pvp';
              badgeHTML = `<span class="badge badge-red">${svgIcon('sword')} GIOCATORE REALE</span>`;
            } else if (isNeutralOutpost) {
              cardClass = 'galaxy-slot-outpost';
              badgeHTML = `<span class="badge badge-neutral">${svgIcon('radar')} AVAMPOSTO NEUTRALE</span>`;
            } else if (isOfflineBot) {
              cardClass = 'galaxy-slot-enemy-pvp';
              badgeHTML = `<span class="badge badge-red">${escapeHTML(slot.tier)} • ${escapeHTML(slot.personality)}</span>`;
            }

            const ownerLabel = slot.ownerName || slot.emperor;

            return `
              <div class="glass-panel ${cardClass}" style="padding:12px; display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                  <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <strong class="font-display text-crystal">[${slot.coords.p}]</strong>
                    <strong style="font-size:1.05rem;">${escapeHTML(slot.planetName || slot.name || 'Slot Colonizzabile')}</strong>
                    ${slot.moon ? `<span class="badge badge-blue" title="${escapeHTML(slot.moon.name || 'Luna')}">${svgIcon('moon')} LUNA</span>` : ''}
                    ${hasDebris ? `<span class="badge badge-creative">${svgIcon('recycle')} Detriti</span>` : ''}
                  </div>
                  ${badgeHTML}
                </div>

                <div class="text-muted" style="font-size:0.88rem; display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
                  ${ownerLabel ? `<span>Comandante: <strong style="color:#fff;">${escapeHTML(ownerLabel)}</strong></span>` : ''}
                  ${isRealEnemy ? `
                    <button type="button" class="btn btn-blue btn-sm btn-gal-pm" data-uid="${escapeHTML(slot.ownerUid)}" data-nick="${escapeHTML(ownerLabel)}" style="min-width:44px; min-height:44px; padding:4px 10px;" title="Messaggio Privato">${svgIcon('mail')}</button>
                  ` : ''}
                  <span>• Temp: ${slot.minTemp ?? -10}°/${slot.maxTemp ?? 35}°C • Campi: ${slot.fieldsMax || 200}</span>
                </div>

                <div style="display:flex; flex-wrap:wrap; gap:6px;">
                  ${isMine ? `
                    <button type="button" class="btn btn-green btn-sm btn-gal-action" data-act="manage" data-pid="${slot.planetId || slot.id}">${svgIcon('radar')} Gestisci</button>
                    <button type="button" class="btn btn-blue btn-sm btn-gal-action" data-act="rename-player" data-p="${slot.coords.p}">${svgIcon('edit')} Rinomina</button>
                  ` : ''}
                  ${(isRealEnemy || isNeutralOutpost || isOfflineBot) ? `
                    <button type="button" class="btn btn-blue btn-sm btn-gal-action" data-act="quick-spy" data-p="${slot.coords.p}">${svgIcon('eye')} Spia</button>
                    <button type="button" class="btn btn-red btn-sm btn-gal-action" data-act="prep-attack" data-p="${slot.coords.p}">${svgIcon('sword')} Attacca</button>
                    <button type="button" class="btn btn-ghost btn-sm btn-gal-action" data-act="trade" data-p="${slot.coords.p}">${svgIcon('handshake')} Commercia</button>
                  ` : ''}
                  ${isEmpty ? `
                    <button type="button" class="btn btn-green btn-sm btn-gal-action" data-act="prep-colonize" data-p="${slot.coords.p}">${svgIcon('globe')} Colonizza</button>
                  ` : ''}
                  ${hasDebris ? `
                    <button type="button" class="btn btn-creative btn-sm btn-gal-action" data-act="prep-recycle" data-p="${slot.coords.p}">${svgIcon('recycle')} Ricicla</button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}

          <div class="glass-panel" style="padding:12px; border-color:var(--btn-creative); display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div>
              <strong class="font-display" style="color:var(--btn-gold);">[16] SPAZIO PROFONDO & BUCO NERO</strong>
              <div class="text-muted" style="font-size:0.88rem;">Invia flotte esplorative alla ricerca di relitti e anomalie.</div>
            </div>
            <button type="button" class="btn btn-creative btn-sm btn-gal-action" data-act="prep-explore" data-p="16">${svgIcon('globe')} Esplora</button>
          </div>
        </div>
      </div>
    `;

    const setCoords = async (g, s) => {
      st.galaxyG = Math.min(uni.galaxies, Math.max(1, g));
      st.galaxyS = Math.min(uni.systemsPerGalaxy, Math.max(1, s));
      await UI.renderCurrentView();
    };

    document.getElementById('gal-prev-g')?.addEventListener('click', () => setCoords(sysData.galaxy - 1, sysData.system));
    document.getElementById('gal-next-g')?.addEventListener('click', () => setCoords(sysData.galaxy + 1, sysData.system));
    document.getElementById('gal-prev-s')?.addEventListener('click', () => setCoords(sysData.galaxy, sysData.system - 1));
    document.getElementById('gal-next-s')?.addEventListener('click', () => setCoords(sysData.galaxy, sysData.system + 1));

    document.getElementById('gal-inp-g')?.addEventListener('change', (e) => setCoords(Number(e.target.value), sysData.system));
    document.getElementById('gal-inp-s')?.addEventListener('change', (e) => setCoords(sysData.galaxy, Number(e.target.value)));

    viewport.querySelectorAll('.btn-gal-filter').forEach((btn) => {
      btn.addEventListener('click', () => {
        st.galaxyFilter = btn.dataset.filter;
        UI.renderCurrentView();
      });
    });

    viewport.querySelectorAll('.btn-gal-pm').forEach((btn) => {
      btn.addEventListener('click', () => {
        UI.openPrivateChatWith(btn.dataset.uid, btn.dataset.nick);
      });
    });

    viewport.querySelectorAll('.btn-gal-action').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const act = btn.dataset.act;
        const pos = Number(btn.dataset.p);

        if (act === 'manage') {
          uni.activePlanetId = btn.dataset.pid;
          UI.refreshPlanetSelector();
          UI.updateTopBarNumbers();
          UI.switchView('overview');
        } else if (act === 'rename-player') {
          const idx = uni.planets.findIndex(
            (pl) => pl.coords.g === sysData.galaxy && pl.coords.s === sysData.system && pl.coords.p === pos
          );
          if (idx >= 0) UI.openRenamePlanetModal(idx);
        } else if (act === 'quick-spy') {
          try {
            if (st.isMultiplayerMode && window.UniversumMP?.launchOnlineFleet) {
              await window.UniversumMP.launchOnlineFleet(uni, pIdx, { g: sysData.galaxy, s: sysData.system, p: pos }, 'spy', { espionageProbe: 2 });
            } else {
              Galaxy.launchFleet(uni, pIdx, { g: sysData.galaxy, s: sysData.system, p: pos }, 'spy', { espionageProbe: 2 });
              await window.UniversumDB.save(uni);
            }
            UI.playSound('success');
            UI.toast(`2 Sonde Spia lanciate verso [${sysData.galaxy}:${sysData.system}:${pos}]!`, 'success');
          } catch (err) {
            UI.playSound('error');
            UI.toast(err.message, 'error');
          }
        } else if (act === 'prep-attack') {
          st.fleetTarget = { g: sysData.galaxy, s: sysData.system, p: pos };
          st.fleetMission = 'attack';
          UI.switchView('fleet');
        } else if (act === 'prep-colonize') {
          st.fleetTarget = { g: sysData.galaxy, s: sysData.system, p: pos };
          st.fleetMission = 'colonize';
          UI.switchView('fleet');
        } else if (act === 'prep-recycle') {
          st.fleetTarget = { g: sysData.galaxy, s: sysData.system, p: pos };
          st.fleetMission = 'recycle';
          UI.switchView('fleet');
        } else if (act === 'prep-explore') {
          st.fleetTarget = { g: sysData.galaxy, s: sysData.system, p: 16 };
          st.fleetMission = 'explore';
          UI.switchView('fleet');
        } else if (act === 'trade') {
          st.fleetTarget = { g: sysData.galaxy, s: sysData.system, p: pos };
          UI.switchView('diplomacy');
        }
      });
    });
  };

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
              <button type="button" id="btn-close-sim" class="btn btn-ghost btn-sm">✕ CHIUDI</button>
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

  // =========================================================
  // COMMERCIO & MERCATO NERO
  // =========================================================
  UI.renderDiplomacy = function (viewport) {
    const { escapeHTML, formatNum, svgIcon } = UI;
    const st = UI.state;
    const uni = st.currentUniverse;
    const Galaxy = window.UniversumGalaxy;
    const pIdx = UI.getActivePlanetIndex();
    const contracts = uni.contracts || [];

    if (st.isMultiplayerMode) {
      viewport.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:14px;">
          <div class="glass-panel" style="padding:14px;">
            <h2 style="font-size:1.05rem; color:var(--res-crystal); margin-bottom:8px;">TRASPORTO & SCAMBIO DIRETTO PvP</h2>
            <p class="text-muted" style="margin-bottom:12px;">In modalità Multiplayer PvP puoi inviare carichi di risorse direttamente ai pianeti di altri giocatori reali o agli Avamposti Neutrali utilizzando la missione <strong>Trasporta</strong> dalla sezione Flotta.</p>
            <button type="button" id="btn-mp-goto-transport" class="btn btn-blue" style="width:100%;">${svgIcon('cargo')} PREPARA CONVOGLIO MERCANTILE</button>
          </div>

          <div class="glass-panel" style="padding:14px;">
            <h3 style="font-size:1rem; color:var(--btn-gold); margin-bottom:10px;">MERCATO NERO GALATTICO (TASSO 3:2:1 -15%)</h3>
            <div class="form-grid-3">
              <div class="form-group">
                <label>Offri</label>
                <select id="bm-give" class="form-control">
                  <option value="metal">Metallo</option>
                  <option value="crystal">Cristallo</option>
                  <option value="deuterium">Deuterio</option>
                </select>
              </div>
              <div class="form-group">
                <label>Quantità</label>
                <input type="number" id="bm-amount" class="form-control" value="15000" min="500">
              </div>
              <div class="form-group">
                <label>Ottieni</label>
                <select id="bm-get" class="form-control">
                  <option value="deuterium">Deuterio</option>
                  <option value="crystal">Cristallo</option>
                  <option value="metal">Metallo</option>
                </select>
              </div>
            </div>
            <button type="button" id="btn-exec-blackmarket" class="btn btn-creative" style="width:100%;">ESEGUI TRANSAZIONE ISTANTANEA</button>
          </div>
        </div>
      `;

      document.getElementById('btn-mp-goto-transport')?.addEventListener('click', () => {
        st.fleetMission = 'transport';
        UI.switchView('fleet');
      });

      document.getElementById('btn-exec-blackmarket')?.addEventListener('click', async () => {
        try {
          const res = Galaxy.blackMarketTrade(
            uni,
            pIdx,
            document.getElementById('bm-give').value,
            Number(document.getElementById('bm-amount').value),
            document.getElementById('bm-get').value
          );
          await UI.persistUniverseState();
          UI.updateTopBarNumbers();
          UI.playSound('success');
          UI.toast(`Mercato Nero: ottenuti ${formatNum(res.received)}!`, 'creative');
        } catch (err) {
          UI.playSound('error');
          UI.toast(err.message, 'error');
        }
      });
      return;
    }

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div class="glass-panel" style="padding:14px;">
          <h2 style="font-size:1.05rem; color:var(--res-crystal); margin-bottom:10px;">SCAMBIO COMMERCIALE CON BOT</h2>
          <div class="form-grid-3">
            <div class="form-group">
              <label>Galassia BOT</label>
              <input type="number" id="trd-g" class="form-control" value="${st.fleetTarget.g}" min="1" max="${uni.galaxies}">
            </div>
            <div class="form-group">
              <label>Sistema BOT</label>
              <input type="number" id="trd-s" class="form-control" value="${st.fleetTarget.s}" min="1" max="${uni.systemsPerGalaxy}">
            </div>
            <div class="form-group">
              <label>Posizione BOT</label>
              <input type="number" id="trd-p" class="form-control" value="${st.fleetTarget.p}" min="1" max="15">
            </div>
          </div>
          <div class="form-grid-3">
            <div class="form-group">
              <label>Cedi</label>
              <select id="trd-give-res" class="form-control">
                <option value="metal">Metallo</option>
                <option value="crystal">Cristallo</option>
                <option value="deuterium">Deuterio</option>
              </select>
            </div>
            <div class="form-group">
              <label>Quantità</label>
              <input type="number" id="trd-amount" class="form-control" value="10000" min="100">
            </div>
            <div class="form-group">
              <label>Ricevi</label>
              <select id="trd-get-res" class="form-control">
                <option value="crystal">Cristallo</option>
                <option value="deuterium">Deuterio</option>
                <option value="metal">Metallo</option>
              </select>
            </div>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:10px;">
            <button type="button" id="btn-exec-bot-trade" class="btn btn-green" style="flex:1;">SCAMBIA CON BOT</button>
            <button type="button" id="btn-sign-bot-contract" class="btn btn-blue" style="flex:1;">${svgIcon('shield')} PATTO DIFESA (10k M)</button>
          </div>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:1rem; color:var(--btn-gold); margin-bottom:10px;">MERCATO NERO GALATTICO (TASSO 3:2:1 -15%)</h3>
          <div class="form-grid-3">
            <div class="form-group">
              <label>Offri</label>
              <select id="bm-give" class="form-control">
                <option value="metal">Metallo</option>
                <option value="crystal">Cristallo</option>
                <option value="deuterium">Deuterio</option>
              </select>
            </div>
            <div class="form-group">
              <label>Quantità</label>
              <input type="number" id="bm-amount" class="form-control" value="15000" min="500">
            </div>
            <div class="form-group">
              <label>Ottieni</label>
              <select id="bm-get" class="form-control">
                <option value="deuterium">Deuterio</option>
                <option value="crystal">Cristallo</option>
                <option value="metal">Metallo</option>
              </select>
            </div>
          </div>
          <button type="button" id="btn-exec-blackmarket" class="btn btn-creative" style="width:100%;">ESEGUI TRANSAZIONE ISTANTANEA</button>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:1rem; color:var(--res-crystal); margin-bottom:8px;">CONTRATTI ATTIVI (${contracts.length})</h3>
          ${contracts.length === 0 ? '<p class="text-muted">Nessun patto siglato.</p>' : contracts.map((c) => `
            <div style="padding:8px; background:rgba(0,0,0,0.35); border-radius:8px; margin-bottom:6px;">
              <strong>${escapeHTML(c.botName)} [${c.key}]</strong> — Protezione attiva (${formatNum(c.dailyCostMetal)} M/giorno)
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('btn-exec-bot-trade')?.addEventListener('click', async () => {
      try {
        const coords = {
          g: Number(document.getElementById('trd-g').value),
          s: Number(document.getElementById('trd-s').value),
          p: Number(document.getElementById('trd-p').value)
        };
        const res = Galaxy.tradeWithBot(
          uni,
          pIdx,
          coords,
          document.getElementById('trd-give-res').value,
          Number(document.getElementById('trd-amount').value),
          document.getElementById('trd-get-res').value
        );
        await UI.persistUniverseState();
        UI.updateTopBarNumbers();
        UI.playSound('success');
        UI.toast(`Scambio con ${res.botName}: ricevuti ${formatNum(res.received)}!`, 'success');
      } catch (err) {
        UI.playSound('error');
        UI.toast(err.message, 'error');
      }
    });

    document.getElementById('btn-sign-bot-contract')?.addEventListener('click', async () => {
      try {
        const coords = {
          g: Number(document.getElementById('trd-g').value),
          s: Number(document.getElementById('trd-s').value),
          p: Number(document.getElementById('trd-p').value)
        };
        const ctr = Galaxy.signBotContract(uni, pIdx, coords);
        await UI.persistUniverseState();
        UI.updateTopBarNumbers();
        UI.renderCurrentView();
        UI.playSound('complete');
        UI.toast(`Patto siglato con ${ctr.botName}!`, 'success');
      } catch (err) {
        UI.playSound('error');
        UI.toast(err.message, 'error');
      }
    });

    document.getElementById('btn-exec-blackmarket')?.addEventListener('click', async () => {
      try {
        const res = Galaxy.blackMarketTrade(
          uni,
          pIdx,
          document.getElementById('bm-give').value,
          Number(document.getElementById('bm-amount').value),
          document.getElementById('bm-get').value
        );
        await UI.persistUniverseState();
        UI.updateTopBarNumbers();
        UI.playSound('success');
        UI.toast(`Mercato Nero: ottenuti ${formatNum(res.received)}!`, 'creative');
      } catch (err) {
        UI.playSound('error');
        UI.toast(err.message, 'error');
      }
    });
  };
})();
