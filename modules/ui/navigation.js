/** UNIVERSUM / modules/ui/navigation.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';

  const UI = window.UniversumUI;


  UI.startChatListeners = function () {
    const st = UI.state;
    const uni = st.currentUniverse;
    if (!st.isMultiplayerMode || !uni) return;

    if (!st.unsubChatListener && window.UniversumMP?.listenChat) {
      st.unsubChatListener = window.UniversumMP.listenChat(uni.id, (msgs) => {
        st.chatMessagesCache = msgs;
        if (st.currentView === 'chat' && st.commTab === 'galactic' && UI.renderGalacticChatMessagesDOM) {
          UI.renderGalacticChatMessagesDOM();
        }
      });
    }

    if (!st.unsubPrivateConvsListener && window.UniversumMP?.listenPrivateConversations) {
      st.unsubPrivateConvsListener = window.UniversumMP.listenPrivateConversations(
        uni.id,
        (convs, unreadCount) => {
          const prevUnread = st.unreadPrivateCount;
          st.privateConversationsCache = convs;
          st.unreadPrivateCount = unreadCount;
          UI.updateCommBadges();
          if (unreadCount > prevUnread && st.currentView !== 'chat') {
            UI.playSound('click');
            UI.toast('Nuovo messaggio privato ricevuto!', 'info');
          }
        }
      );
    }
  };


  UI.stopChatListeners = function () {
    const st = UI.state;
    if (typeof st.unsubChatListener === 'function') {
      st.unsubChatListener();
      st.unsubChatListener = null;
    }
    if (typeof st.unsubPrivateConvsListener === 'function') {
      st.unsubPrivateConvsListener();
      st.unsubPrivateConvsListener = null;
    }
    UI.closePrivateMessageStream();
  };


  UI.switchView = function (viewName) {
    if (UI.state.currentView === 'chat' && viewName !== 'chat') {
      UI.stopChatListeners();
    }

    UI.state.currentView = viewName;
    window.UniversumTutorial?.onView(viewName);
    UI.playSound('click');

    document.querySelectorAll('.sidebar-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    document.querySelectorAll('.nav-tab-btn[data-view]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    document.getElementById('mobile-menu-drawer')?.classList.add('hidden');
    UI.renderCurrentView();
  };


  UI.renderCurrentView = async function () {
    const viewport = document.getElementById('game-viewport');
    const st = UI.state;
    if (!viewport || !st.currentUniverse) return;

    if (st.planetAnimId && st.currentView !== 'overview') {
      cancelAnimationFrame(st.planetAnimId);
      st.planetAnimId = null;
    }

    switch (st.currentView) {
      case 'overview': UI.renderOverview(viewport); break;
      case 'buildings': UI.renderBuildings(viewport); break;
      case 'research': UI.renderResearch(viewport); break;
      case 'shipyard':
      case 'defense':
        if (st.currentView === 'shipyard') st.shipyardTab = 'ships';
        if (st.currentView === 'defense') st.shipyardTab = 'defense';
        UI.renderShipyardAndDefense(viewport);
        break;
      case 'fleet': UI.renderFleet(viewport); break;
      case 'movements': UI.renderFleetMovements(viewport); break;
      case 'galaxy':
        await UI.renderGalaxy(viewport);
        if (st.isMultiplayerMode && st.currentView === 'galaxy') {
          const tradeButton = document.createElement('button');
          tradeButton.type = 'button';
          tradeButton.className = 'btn btn-blue btn-sm';
          tradeButton.style.margin = '10px 0';
          tradeButton.textContent = 'COMMERCIA CON UN BOT';
          tradeButton.addEventListener('click', UI.openOnlineBotTradeModal);
          viewport.prepend(tradeButton);
        }
        break;
      case 'espionage': UI.renderEspionageAndSim(viewport); break;
      case 'reports': await UI.renderReports(viewport); break;
      case 'moon': UI.renderMoon(viewport); break;
      case 'galattica-manage': UI.renderGalatticaManageView(viewport); break;
      case 'galattica-fleet': UI.renderGalatticaFleetView(viewport); break;
      case 'guide': UI.renderGuideView(viewport); break;
      case 'diplomacy': UI.renderDiplomacy(viewport); break;
      case 'empire': UI.renderEmpire(viewport); break;
      case 'highscore': await UI.renderHighscoreAndQuests(viewport); break;
      case 'chat': await UI.renderCommunications(viewport); break;
      case 'saves': UI.renderSavesMenu(viewport); break;
      default: UI.renderOverview(viewport);
    }
  };


  // Commercio online: solo BOT neutrali e pacifici, rapporto metallo/cristallo/deuterio 3:2:1.
  UI.openOnlineBotTradeModal = function () {
    const uni = UI.state.currentUniverse;
    if (!UI.state.isMultiplayerMode || !uni) return;
    const target = UI.state.fleetTarget || { g: UI.state.galaxyG, s: UI.state.galaxyS, p: 7 };
    UI.openModal('COMMERCIO CON BOT', `
      <form id="form-online-bot-trade">
        <p class="text-muted">Seleziona le coordinate del BOT neutrale o pacifico. Scambio dal tuo primo pianeta (3 metallo = 2 cristallo = 1 deuterio).</p>
        <div class="form-grid-3">
          <div class="form-group"><label for="trade-bot-g">Galassia</label><input id="trade-bot-g" type="number" class="form-control" min="1" max="9" value="${Number(target.g) || 1}" required></div>
          <div class="form-group"><label for="trade-bot-s">Sistema</label><input id="trade-bot-s" type="number" class="form-control" min="1" max="499" value="${Number(target.s) || 1}" required></div>
          <div class="form-group"><label for="trade-bot-p">Posizione</label><input id="trade-bot-p" type="number" class="form-control" min="1" max="15" value="${Number(target.p) || 7}" required></div>
        </div>
        <div class="form-group"><label for="trade-bot-give">Risorsa da offrire</label><select id="trade-bot-give" class="form-control"><option value="metal">Metallo</option><option value="crystal">Cristallo</option><option value="deuterium">Deuterio</option></select></div>
        <div class="form-group"><label for="trade-bot-amount">Quantità da offrire (min. 100)</label><input id="trade-bot-amount" type="number" class="form-control" min="100" step="1" value="300" required></div>
        <div class="form-group"><label for="trade-bot-get">Risorsa richiesta</label><select id="trade-bot-get" class="form-control"><option value="crystal">Cristallo</option><option value="metal">Metallo</option><option value="deuterium">Deuterio</option></select></div>
        <button type="submit" class="btn btn-green" style="width:100%;">CONFERMA SCAMBIO</button>
      </form>
    `);
    document.getElementById('form-online-bot-trade')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const button = e.target.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const coords = { g: Number(document.getElementById('trade-bot-g').value),
          s: Number(document.getElementById('trade-bot-s').value), p: Number(document.getElementById('trade-bot-p').value) };
        const result = await window.UniversumMP.tradeWithOnlineBot(uni, coords,
          document.getElementById('trade-bot-give').value,
          Number(document.getElementById('trade-bot-amount').value),
          document.getElementById('trade-bot-get').value);
        await window.UniversumMP.syncPlayerState(uni, { force: true });
        UI.closeModal();
        UI.updateTopBarNumbers();
        UI.renderCurrentView();
        UI.toast(`Scambio completato: ${UI.formatNum(result.given)} ceduti, ${UI.formatNum(result.received)} ricevuti.`, 'success');
      } catch (err) {
        UI.toast(err.message || 'Scambio non riuscito.', 'error');
      } finally { button.disabled = false; }
    });
  };


  UI.renderOverview = function (viewport) {
    const { escapeHTML, formatNum, formatDuration, svgIcon, resIconTag, artTag } = UI;
    const st = UI.state;
    const uni = st.currentUniverse;
    const Data = window.UniversumData;
    const Engine = window.UniversumEngine;
    const pIdx = UI.getActivePlanetIndex();
    const planet = UI.getActivePlanet();
    const prod = Engine.getPlanetProduction(planet, uni);
    const usedFields = Data.getUsedFields(planet);
    const maxFields = Data.getMaxFields(planet);

    const incoming = uni.incomingAttacks || [];
    const flights = uni.fleetsInFlight || [];
    const messages = (uni.messages || []).slice(0, 6);

    const queueRows = [];
    if (planet.buildQueue && planet.buildQueue.length > 0) {
      const b = planet.buildQueue[0];
      const name = Data.BUILDINGS[b.id]?.name || b.id;
      queueRows.push(`
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35); padding:10px; border-radius:8px;">
          <span style="display:inline-flex; align-items:center; gap:8px;">${artTag(b.id, 'unit-art-sm', name)} <strong>${escapeHTML(name)}</strong> → Lv.${b.targetLevel}</span>
          <span class="font-display text-metal live-timer" data-end="${b.endTime}">${formatDuration((b.endTime - Date.now()) / 1000)}</span>
        </div>
      `);
    }
    if (planet.localResearchQueue) {
      const r = planet.localResearchQueue;
      const name = Data.RESEARCHES[r.id]?.name || r.id;
      queueRows.push(`<div class="glass-panel" style="padding:10px"><strong>${escapeHTML(name)}</strong> · ricerca planetaria Lv.${r.targetLevel} · <span class="live-timer" data-end="${r.endTime}">${formatDuration((r.endTime - Date.now()) / 1000)}</span></div>`);
    }
    if (uni.researchQueue) {
      const r = uni.researchQueue;
      const name = Data.RESEARCHES[r.id]?.name || r.id;
      queueRows.push(`
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35); padding:10px; border-radius:8px;">
          <span style="display:inline-flex; align-items:center; gap:8px;">${artTag(r.id, 'unit-art-sm', name)} <strong>${escapeHTML(name)}</strong> → Lv.${r.targetLevel}</span>
          ${r.endTime ? `<span class="font-display text-crystal live-timer" data-end="${r.endTime}">${formatDuration((r.endTime - Date.now()) / 1000)}</span>` : '<span class="text-muted">In pausa: laboratori occupati</span>'}
        </div>
      `);
    }
    if (planet.shipyardQueue && planet.shipyardQueue.length > 0) {
      const sq = planet.shipyardQueue[0];
      const name = Data.SHIPS[sq.id]?.name || sq.id;
      queueRows.push(`
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35); padding:10px; border-radius:8px;">
          <span style="display:inline-flex; align-items:center; gap:8px;">${artTag(sq.id, 'unit-art-sm', name)} <strong>${escapeHTML(name)}</strong> (Rimanenti: ${sq.remaining})</span>
          <span class="font-display text-energy live-timer" data-end="${sq.endTime}">${formatDuration((sq.endTime - Date.now()) / 1000)}</span>
        </div>
      `);
    }
    if (planet.defenseQueue && planet.defenseQueue.length > 0) {
      const dq = planet.defenseQueue[0];
      const name = Data.DEFENSES[dq.id]?.name || dq.id;
      queueRows.push(`
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35); padding:10px; border-radius:8px;">
          <span style="display:inline-flex; align-items:center; gap:8px;">${artTag(dq.id, 'unit-art-sm', name)} <strong>${escapeHTML(name)}</strong> (Rimanenti: ${dq.remaining})</span>
          <span class="font-display text-energy live-timer" data-end="${dq.endTime}">${formatDuration((dq.endTime - Date.now()) / 1000)}</span>
        </div>
      `);
    }

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        ${incoming.length > 0 ? `
          <div class="glass-panel" style="padding:14px; border-color:var(--btn-red); background:rgba(255,23,68,0.18);">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
              <strong style="color:#ff5252; font-family:var(--font-display);">${svgIcon('alert')} ALLARME ATTACCO OSTILE IN ARRIVO (${incoming.length})</strong>
              <span class="badge badge-red live-timer" data-end="${incoming[0].arrivalTime}">--:--</span>
            </div>
            <p style="font-size:0.95rem; margin-top:6px;">${escapeHTML(incoming[0].attackerName)} diretto verso [${incoming[0].targetCoords.g}:${incoming[0].targetCoords.s}:${incoming[0].targetCoords.p}]</p>
          </div>
        ` : ''}

        <div class="glass-panel" style="padding:16px;">
          <div style="display:flex; flex-wrap:wrap; align-items:center; gap:16px;">
            <canvas id="overview-planet-canvas" width="170" height="170" style="flex-shrink:0; margin:0 auto;"></canvas>
            <div style="flex:1; min-width:220px;">
              <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:8px;">
                <h2 style="font-size:1.3rem; color:#fff;">${escapeHTML(planet.name)}</h2>
                <button type="button" id="btn-rename-active-planet" class="btn btn-blue btn-sm" style="min-width:44px; min-height:44px;">${svgIcon('edit')} Rinomina</button>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:0.95rem;">
                <div>Coordinate: <strong class="text-crystal">[${planet.coords.g}:${planet.coords.s}:${planet.coords.p}]</strong></div>
                <div>Campi: <strong>${usedFields} / ${maxFields}</strong></div>
                <div>Temperatura: <strong>${planet.minTemp}°C / ${planet.maxTemp}°C</strong></div>
                <div>Velocità: <strong class="text-metal">${Engine.getEffectiveSpeed(uni)}x</strong></div>
              </div>
              ${!st.isMultiplayerMode ? `
                <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;">
                  <button type="button" id="btn-overview-turbo" class="btn btn-creative btn-sm">${svgIcon('bolt')} TURBO (2x VELOCITÀ)</button>
                  <button type="button" id="btn-overview-event" class="btn btn-blue btn-sm">${svgIcon('radar')} SCANSIONE EVENTO</button>
                </div>
              ` : `
                <div style="margin-top:12px;">
                  <button type="button" id="btn-overview-open-chat" class="btn btn-blue btn-sm">${svgIcon('chat')} APRI COMUNICAZIONI</button>
                </div>
              `}
            </div>
          </div>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:0.95rem; color:var(--res-crystal); margin-bottom:10px;">PRODUZIONE ORARIA PIANETA</h3>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; text-align:center;">
            <div style="background:rgba(0,0,0,0.35); padding:8px; border-radius:8px;">
              <div class="text-muted" style="font-size:0.8rem; display:inline-flex; align-items:center;">${resIconTag('metal')} METALLO/H</div>
              <div class="font-display text-metal" style="font-size:0.95rem;">+${formatNum(prod.metalPerHour)}</div>
            </div>
            <div style="background:rgba(0,0,0,0.35); padding:8px; border-radius:8px;">
              <div class="text-muted" style="font-size:0.8rem; display:inline-flex; align-items:center;">${resIconTag('crystal')} CRISTALLO/H</div>
              <div class="font-display text-crystal" style="font-size:0.95rem;">+${formatNum(prod.crystalPerHour)}</div>
            </div>
            <div style="background:rgba(0,0,0,0.35); padding:8px; border-radius:8px;">
              <div class="text-muted" style="font-size:0.8rem; display:inline-flex; align-items:center;">${resIconTag('deuterium')} DEUTERIO/H</div>
              <div class="font-display text-deuterium" style="font-size:0.95rem;">${prod.deuteriumPerHour >= 0 ? '+' : ''}${formatNum(prod.deuteriumPerHour)}</div>
            </div>
          </div>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:0.95rem; color:var(--res-crystal); margin-bottom:10px;">CODE DI PRODUZIONE & RICERCA</h3>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${queueRows.length > 0 ? queueRows.join('') : '<p class="text-muted">Nessuna costruzione o ricerca in corso.</p>'}
          </div>
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:0.95rem; color:var(--res-crystal); margin-bottom:10px;">MOVIMENTI FLOTTA (${flights.length})</h3>
          ${flights.length === 0 ? '<p class="text-muted">Nessuna flotta in transito.</p>' : `
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${flights.map((f) => {
                const targetTs = f.status === 'outbound' ? f.arrivalTime : f.returnTime;
                return `
                  <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35); padding:10px; border-radius:8px;">
                    <div>
                      <strong style="text-transform:uppercase; color:var(--res-crystal);">${escapeHTML(f.mission)}</strong>
                      <span class="badge ${f.status === 'outbound' ? 'badge-green' : 'badge-blue'}">${f.status === 'outbound' ? 'ANDATA' : 'RIENTRO'}</span>
                      <div class="text-muted" style="font-size:0.85rem;">[${f.originCoords.g}:${f.originCoords.s}:${f.originCoords.p}] → [${f.targetCoords.g}:${f.targetCoords.s}:${f.targetCoords.p}]</div>
                    </div>
                    <span class="font-display text-energy live-timer" data-end="${targetTs}">--:--</span>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:0.95rem; color:var(--res-crystal); margin-bottom:10px;">DIARIO DI BORDO</h3>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${messages.map((m) => `
              <div style="border-left:3px solid ${m.type === 'combat' ? 'var(--btn-red)' : 'var(--btn-blue)'}; padding-left:10px;">
                <div style="font-weight:700; font-size:0.95rem;">${escapeHTML(m.title)}</div>
                ${m.time ? `<div class="text-muted" style="font-size:0.78rem;">${new Date(m.time).toLocaleString('it-IT')}${m.type ? ` • ${escapeHTML(String(m.type).toUpperCase())}` : ''}</div>` : ''}
                <div class="text-muted" style="font-size:0.88rem; white-space:pre-line;">${escapeHTML(m.body)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    UI.startPlanetCanvas(planet);

    document.getElementById('btn-rename-active-planet')?.addEventListener('click', () => UI.openRenamePlanetModal(pIdx));
    document.getElementById('btn-overview-open-chat')?.addEventListener('click', () => UI.switchView('chat'));

    document.getElementById('btn-overview-turbo')?.addEventListener('click', async () => {
      const res = Engine.activateTurbo(uni);
      await UI.persistUniverseState();
      UI.updateTopBarNumbers();
      UI.renderCurrentView();
      UI.playSound('success');
      UI.toast(`TURBO 2x attivo per ${formatDuration(res.remainingSec)}!`, 'creative');
    });

    document.getElementById('btn-overview-event')?.addEventListener('click', async () => {
      const bonusM = Math.floor((1500 + Math.random() * 4500) * Math.sqrt(uni.speed || 1));
      const bonusC = Math.floor((1000 + Math.random() * 3000) * Math.sqrt(uni.speed || 1));
      planet.resources.metal += bonusM;
      planet.resources.crystal += bonusC;
      await UI.persistUniverseState();
      UI.updateTopBarNumbers();
      UI.playSound('success');
      UI.toast(`Capsula cargo intercettata: +${formatNum(bonusM)} M, +${formatNum(bonusC)} C!`, 'success');
    });
  };


  UI.renderSavesMenu = function (viewport) {
    const st = UI.state;
    const uni = st.currentUniverse;
    viewport.innerHTML = `
      <div class="glass-panel" style="padding:18px; display:flex; flex-direction:column; gap:12px;">
        <h2 style="font-size:1.1rem; color:var(--res-crystal);">GESTIONE PARTITA & SISTEMA</h2>
        <p class="text-muted">Universo attivo: <strong style="color:#fff;">${UI.escapeHTML(uni.name)}</strong> (${st.isMultiplayerMode ? 'ONLINE PvP' : 'OFFLINE'})</p>

        <button type="button" id="btn-save-now" class="btn btn-green">${UI.svgIcon('save')} SINCRONIZZA / SALVA ORA</button>
        ${st.isMultiplayerMode && (uni.fleetsInFlight || []).some((f) => !f.resolved) ? `
          <div style="background:rgba(255,170,0,0.12); border:1px solid rgba(255,170,0,0.5); border-radius:8px; padding:10px; font-size:0.9rem;">
            <strong style="color:var(--btn-gold);">Avviso deploy:</strong> Ci sono missioni in corso, il deploy potrebbe bloccarle. Le missioni sono salvate su Firestore (partenza/arrivo/flotta/risorse) e verranno migrate/riprese dopo il deploy.
          </div>
        ` : ''}
        ${st.isMultiplayerMode ? `<button type="button" id="btn-repair-missions" class="btn btn-creative">Ripara missioni bloccate</button>` : ''}
        ${!st.isMultiplayerMode ? `
          <button type="button" id="btn-export-download" class="btn btn-blue">SCARICA BACKUP JSON</button>
          <button type="button" id="btn-export-copy" class="btn btn-ghost">COPIA JSON NEGLI APPUNTI</button>
        ` : ''}
        <button type="button" id="btn-toggle-sound" class="btn btn-ghost">${st.soundMuted ? 'SUONI: DISATTIVATI (ATTIVA)' : 'SUONI: ATTIVI (DISATTIVA)'}</button>
        ${st.isMultiplayerMode ? `
          <div style="border-top:1px solid rgba(255,82,82,0.35); padding-top:12px; display:flex; flex-direction:column; gap:8px;">
            <h3 style="font-size:0.95rem; color:#ff5252;">IMPOSTAZIONI SERVER</h3>
            <button type="button" id="btn-leave-server-view" class="btn btn-ghost">Abbandona Server (libera uno slot)</button>
            ${(uni.founderUid || uni.ownerUid) && window.fbAuth?.currentUser?.uid && (uni.founderUid === window.fbAuth.currentUser.uid || uni.ownerUid === window.fbAuth.currentUser.uid) ? `
              <button type="button" id="btn-delete-server-view" class="btn btn-red">Elimina Server (solo creatore)</button>
            ` : ''}
          </div>
        ` : ''}
        <button type="button" id="btn-return-lobby-view" class="btn btn-red">${UI.svgIcon('home')} TORNA ALLA LOBBY PRINCIPALE</button>
      </div>
    `;

    document.getElementById('btn-leave-server-view')?.addEventListener('click', async () => {
      try {
        await window.UniversumMP.leaveOnlineUniverse(uni.id);
        UI.playSound('success');
        UI.toast('Server abbandonato: slot liberato.', 'success');
        await UI.exitToLobbyAfterServerRemoval();
      } catch (err) {
        UI.playSound('error');
        UI.toast(err.message, 'error');
      }
    });

    document.getElementById('btn-delete-server-view')?.addEventListener('click', () => {
      UI.openModal('ELIMINA SERVER', `
        <p style="margin-bottom:10px; color:#ff5252;"><strong>Sei sicuro? Eliminerai il server per TUTTI i giocatori. Questa azione è irreversibile. Scrivi ELIMINA per confermare.</strong></p>
        <div class="form-group">
          <label for="input-delete-server-confirm">Conferma testuale (doppia conferma)</label>
          <input type="text" id="input-delete-server-confirm" class="form-control" placeholder="ELIMINA" autocomplete="off">
        </div>
        <div style="display:flex; gap:10px; margin-top:14px;">
          <button type="button" id="btn-confirm-delete-server" class="btn btn-red" style="flex:1;" disabled>ELIMINA DEFINITIVAMENTE</button>
          <button type="button" id="btn-cancel-delete-server" class="btn btn-ghost" style="flex:1;">ANNULLA</button>
        </div>
      `);
      const confirmInput = document.getElementById('input-delete-server-confirm');
      const confirmBtn = document.getElementById('btn-confirm-delete-server');
      confirmInput?.addEventListener('input', () => {
        if (confirmBtn) confirmBtn.disabled = confirmInput.value.trim() !== 'ELIMINA';
      });
      document.getElementById('btn-cancel-delete-server')?.addEventListener('click', UI.closeModal);
      confirmBtn?.addEventListener('click', async () => {
        if (confirmInput?.value.trim() !== 'ELIMINA') return;
        try {
          await window.UniversumMP.deleteOnlineUniverse(uni.id);
          UI.closeModal();
          UI.playSound('success');
          UI.toast('Server eliminato per tutti i giocatori. Slot liberati.', 'success');
          await UI.exitToLobbyAfterServerRemoval();
        } catch (err) {
          UI.playSound('error');
          UI.toast(err.message, 'error');
        }
      });
    });

    document.getElementById('btn-repair-missions')?.addEventListener('click', async () => {
      try {
        const repaired = window.UniversumMP?.repairStuckMissions
          ? await window.UniversumMP.repairStuckMissions(uni.id)
          : 0;
        UI.playSound('success');
        UI.toast(repaired > 0 ? `Missioni bloccate riparate: ${repaired}. Flotte restituite ai pianeti di partenza.` : 'Nessuna missione bloccata da riparare.', 'success');
        UI.renderCurrentView();
      } catch (err) {
        UI.playSound('error');
        UI.toast(err.message, 'error');
      }
    });

    document.getElementById('btn-save-now')?.addEventListener('click', async () => {
      await UI.persistUniverseState();
      UI.playSound('success');
      UI.toast(st.isMultiplayerMode ? 'Dati sincronizzati con Firestore!' : 'Partita salvata su IndexedDB!', 'success');
    });

    document.getElementById('btn-export-download')?.addEventListener('click', async () => {
      const json = await window.UniversumDB.exportJSON(uni.id);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `UNIVERSUM_${uni.name.replace(/[^a-z0-9]/gi, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      UI.toast('File JSON scaricato.', 'success');
    });

    document.getElementById('btn-export-copy')?.addEventListener('click', async () => {
      const json = await window.UniversumDB.exportJSON(uni.id);
      await navigator.clipboard.writeText(json);
      UI.toast('Salvataggio JSON copiato negli appunti!', 'success');
    });

    document.getElementById('btn-toggle-sound')?.addEventListener('click', () => {
      st.soundMuted = !st.soundMuted;
      localStorage.setItem('universum_muted', String(st.soundMuted));
      if (!st.soundMuted) UI.playSound('click');
      UI.renderCurrentView();
    });

    document.getElementById('btn-return-lobby-view')?.addEventListener('click', async () => {
      await UI.exitActiveGameToLobby();
    });
  };
})();
