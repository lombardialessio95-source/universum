/** UNIVERSUM / modules/ui/galaxy.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const UI = window.UniversumUI;


  // =========================================================
  // GALASSIA (CON CHAT PRIVATA PvP, EMBARGO & OCCUPAZIONE)
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
                <button type="button" id="gal-prev-g" class="btn btn-blue btn-sm gal-nav-btn" aria-label="Precedente"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg></button>
                <input type="number" id="gal-inp-g" class="form-control" value="${sysData.galaxy}" min="1" max="${uni.galaxies}" style="text-align:center;">
                <button type="button" id="gal-next-g" class="btn btn-blue btn-sm gal-nav-btn" aria-label="Successivo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 5 7 7-7 7"/></svg></button>
              </div>
            </div>
            <div>
              <label style="font-size:0.8rem; color:var(--res-crystal);">SISTEMA (1-${uni.systemsPerGalaxy})</label>
              <div style="display:flex; gap:6px; margin-top:4px;">
                <button type="button" id="gal-prev-s" class="btn btn-blue btn-sm gal-nav-btn" aria-label="Precedente"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg></button>
                <input type="number" id="gal-inp-s" class="form-control" value="${sysData.system}" min="1" max="${uni.systemsPerGalaxy}" style="text-align:center;">
                <button type="button" id="gal-next-s" class="btn btn-blue btn-sm gal-nav-btn" aria-label="Successivo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 5 7 7-7 7"/></svg></button>
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
            const slotSiege = (() => {
              const inc = (uni.incomingSieges || []).find((s) => Number(s.targetCoords?.g) === Number(slot.coords.g) && Number(s.targetCoords?.s) === Number(slot.coords.s) && Number(s.targetCoords?.p) === Number(slot.coords.p));
              if (inc) return inc;
              if (isMine && slot.embargo && slot.embargo.attackerUid !== myUid) return { type: 'embargo' };
              if (isMine && slot.occupation && slot.occupation.occupierUid !== myUid) return { type: 'occupy' };
              return null;
            })();

            return `
              <div class="glass-panel ${cardClass}" style="padding:12px; display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                  <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <strong class="font-display text-crystal">[${slot.coords.p}]</strong>
                    <strong style="font-size:1.05rem;">${escapeHTML(slot.planetName || slot.name || 'Slot Colonizzabile')}</strong>
                    ${slot.moon ? `<span class="badge badge-blue" title="${escapeHTML(slot.moon.name || 'Luna')}">${svgIcon('moon')} LUNA</span>` : ''}
                    ${slot.bacinoSpaziale ? '<span class="badge badge-creative">BACINO</span>' : ''}
                    ${slot.galattica ? `<button type="button" class="badge badge-creative btn-gal-open-viewer" data-gal-id="${escapeHTML(slot.galattica.id)}" data-gal-own="${slot.ownerType === 'player' ? '1' : '0'}" data-gal-planet-id="${escapeHTML(slot.planetId || '')}" style="cursor:pointer; border:none;">GALATTICA</button>` : ''}
                    ${slotSiege ? `<span class="badge badge-red">${slotSiege.type === 'embargo' ? 'SOTTO EMBARGO' : 'SOTTO OCCUPAZIONE'}</span><button type="button" class="btn btn-red btn-sm btn-gal-expel" data-p="${slot.coords.p}">${svgIcon('sword')} Scaccia Flotta</button>` : ''}
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
                    <button type="button" class="btn btn-creative btn-sm btn-gal-action" data-act="prep-embargo" data-p="${slot.coords.p}">Embargo</button>
                    <button type="button" class="btn btn-creative btn-sm btn-gal-action" data-act="prep-occupy" data-p="${slot.coords.p}">Occupa</button>
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

    // Bug 2: badge Galattica apre la pagina intera (galattica-manage)
    viewport.querySelectorAll('.btn-gal-open-viewer').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        UI.renderGalatticaManage(btn.dataset.galId);
      });
    });

    viewport.querySelectorAll('.btn-gal-pm').forEach((btn) => {
      btn.addEventListener('click', () => {
        UI.openPrivateChatWith(btn.dataset.uid, btn.dataset.nick);
      });
    });

    viewport.querySelectorAll('.btn-gal-expel').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pos = Number(btn.dataset.p);
        const target = { g: sysData.galaxy, s: sysData.system, p: pos };
        try {
          if (st.isMultiplayerMode) {
            st.fleetTarget = target;
            st.fleetMission = 'attack';
            UI.switchView('fleet');
            return;
          }
          const Data = window.UniversumData;
          const planet = UI.getActivePlanet();
          const selection = {};
          for (const [sid, qty] of Object.entries(planet?.fleet || {})) {
            if (Number(qty) > 0 && sid !== 'solarSatellite' && (Data.SHIPS[sid]?.attack || 0) > 0) {
              selection[sid] = Number(qty);
            }
          }
          if (Object.keys(selection).length === 0) {
            st.fleetTarget = target;
            st.fleetMission = 'attack';
            UI.playSound('error');
            UI.toast('Nessuna nave da combattimento sul pianeta attivo: seleziona la flotta di liberazione.', 'error');
            UI.switchView('fleet');
            return;
          }
          if (!window.UniversumSiege?.launchEnhancedFleet) throw new Error('Motore assedi non disponibile.');
          window.UniversumSiege.launchEnhancedFleet(uni, pIdx, target, 'attack', selection, { metal: 0, crystal: 0, deuterium: 0 }, {});
          await UI.persistUniverseState();
          UI.playSound('success');
          UI.toast(`Flotta di liberazione lanciata verso [${target.g}:${target.s}:${target.p}]: se vince, Embargo/Occupazione finisce!`, 'success');
          UI.renderCurrentView();
        } catch (err) {
          UI.playSound('error');
          UI.toast(err.message, 'error');
        }
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
            } else if (window.UniversumSiege?.launchEnhancedFleet) {
              window.UniversumSiege.launchEnhancedFleet(uni, pIdx, { g: sysData.galaxy, s: sysData.system, p: pos }, 'spy', { espionageProbe: 2 });
              await window.UniversumDB.save(uni);
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
        } else if (act === 'prep-embargo') {
          st.fleetTarget = { g: sysData.galaxy, s: sysData.system, p: pos };
          st.fleetMission = 'embargo';
          UI.switchView('fleet');
        } else if (act === 'prep-occupy') {
          st.fleetTarget = { g: sysData.galaxy, s: sysData.system, p: pos };
          st.fleetMission = 'occupy';
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
})();
