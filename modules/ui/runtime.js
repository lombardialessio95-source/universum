/** UNIVERSUM / modules/ui/runtime.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';

  const UI = window.UniversumUI;


  UI.exitActiveGameToLobby = async function () {
    UI.closeResourceDeposit?.();
    const st = UI.state;
    if (st.currentUniverse) {
      await UI.persistUniverseState();
    }
    UI.stopGameLoop();
    UI.cleanupMultiplayerListeners();
    st.isMultiplayerMode = false;
    st.currentUniverse = null;
    window.UniversumTutorial?.clear();

    document.getElementById('screen-game')?.classList.add('hidden');
    document.getElementById('screen-lobby')?.classList.remove('hidden');
    document.body.classList.add('lobby-black');
    await window.UniversumDB.renderLobbyList();
    window.UniversumUpdater?.onSafeLobby();
  };


  UI.exitToLobbyAfterServerRemoval = async function () {
    UI.closeResourceDeposit?.();
    const st = UI.state;
    UI.stopGameLoop();
    UI.cleanupMultiplayerListeners();
    st.isMultiplayerMode = false;
    st.currentUniverse = null;
    document.getElementById('screen-game')?.classList.add('hidden');
    document.getElementById('screen-lobby')?.classList.remove('hidden');
    document.body.classList.add('lobby-black');
    await window.UniversumDB.renderLobbyList();
    await UI.refreshOnlineLobbyState();
    window.UniversumUpdater?.onSafeLobby();
  };


  UI.cleanupMultiplayerListeners = function () {
    const st = UI.state;
    UI.stopChatListeners();
    if (typeof st.unsubServerListener === 'function') {
      st.unsubServerListener();
      st.unsubServerListener = null;
    }
    if (typeof st.unsubFleetsListener === 'function') {
      st.unsubFleetsListener();
      st.unsubFleetsListener = null;
    }
    if (typeof st.unsubOwnFleetsListener === 'function') {
      st.unsubOwnFleetsListener();
      st.unsubOwnFleetsListener = null;
    }
    if (typeof st.unsubOwnPlanetsListener === 'function') {
      st.unsubOwnPlanetsListener();
      st.unsubOwnPlanetsListener = null;
    }
    if (UI._reconcileTimer) {
      clearTimeout(UI._reconcileTimer);
      UI._reconcileTimer = null;
    }
    UI._resetSyncRetry?.();

    st.chatMessagesCache = [];
    st.privateConversationsCache = [];
    st.unreadPrivateCount = 0;
    st.activePrivateTarget = null;
    UI.updateCommBadges();
  };


  UI.stopGameLoop = function () {
    const st = UI.state;
    if (st.gameLoopTimer) {
      clearInterval(st.gameLoopTimer);
      st.gameLoopTimer = null;
    }
    UI.stopPlanetCanvas?.();
  };


  UI.startGameLoop = function () {
    UI.stopGameLoop();
    const st = UI.state;
    let mpTickCounter = 0;
    let pendingCompletionRender = false;

    st.gameLoopTimer = setInterval(async () => {
      const uni = st.currentUniverse;
      if (!uni) return;

      const activeP = UI.getActivePlanet();
      const prevQueueCount = (activeP?.buildQueue?.length || 0) +
        (activeP?.shipyardQueue?.length || 0) +
        (activeP?.defenseQueue?.length || 0) +
        (uni.researchQueue ? 1 : 0) +
        ((uni.planets || []).filter(p => p.localResearchQueue).length);

      const queueCompleted = window.UniversumEngine.tick(uni, 1);

      if (st.isMultiplayerMode) {
        mpTickCounter++;
        if (queueCompleted) UI.persistUniverseState().catch(() => {});
        if (mpTickCounter % 3 === 0 && window.UniversumMP?.resolveArrivedOnlineFleets) {
          window.UniversumMP.resolveArrivedOnlineFleets(uni.id, uni.speed).catch(() => {});
        }
        if (mpTickCounter % 30 === 0 && window.UniversumMP?.processOnlineOccupations) {
          window.UniversumMP.processOnlineOccupations(uni.id).catch(() => {});
        }
        if (mpTickCounter % 60 === 0) {
          // Solo checkpoint periodico: le azioni volontarie usano force:true.
          if (!queueCompleted) UI.persistUniverseState({ force: false }).catch(() => {});
          if (uni.botConfig?.raids && uni.botConfig.personality?.hostile > 0 && window.UniversumMP?.maybeLaunchBotRaid) {
            window.UniversumMP.maybeLaunchBotRaid(uni.id, uni.botConfig).catch((e) => console.warn('[MP Bot] Raid:', e));
          }
        }
      } else {
        window.UniversumGalaxy.processFleetsAndBots(uni);
      }

      // In assenza di completamenti tick() non modifica le lunghezze delle code:
      // evita la seconda scansione di tutti i pianeti nel tick ordinario.
      const newQueueCount = queueCompleted ?
        (activeP?.buildQueue?.length || 0) +
        (activeP?.shipyardQueue?.length || 0) +
        (activeP?.defenseQueue?.length || 0) +
        (uni.researchQueue ? 1 : 0) +
        ((uni.planets || []).filter(p => p.localResearchQueue).length) : prevQueueCount;

      if (newQueueCount < prevQueueCount) {
        UI.playSound('complete');
        if (['overview', 'buildings', 'research', 'shipyard'].includes(st.currentView)) {
          if (document.hidden) pendingCompletionRender = true;
          else UI.renderCurrentView();
        }
      }

      const atkCount = (uni.incomingAttacks || []).length;
      if (atkCount > st.lastAlertCount) {
        UI.playSound('alarm');
        UI.toast('ALLARME RADAR: Flotta ostile in arrivo sul tuo pianeta!', 'error');
      }
      st.lastAlertCount = atkCount;

      if (document.hidden) return; // Mantieni la simulazione, evita soltanto il lavoro DOM.
      if (pendingCompletionRender) {
        pendingCompletionRender = false;
        if (['overview', 'buildings', 'research', 'shipyard'].includes(st.currentView)) UI.renderCurrentView();
      }
      UI.updateTopBarNumbers();
      if (!st.isMultiplayerMode) window.UniversumTutorial?.check();
      UI.refreshAffordabilityButtons?.();
      document.querySelectorAll('.live-timer').forEach((el) => {
        const endTs = Number(el.dataset.end || 0);
        const remSec = Math.max(0, Math.ceil((endTs - Date.now()) / 1000));
        const value = UI.formatDuration(remSec);
        if (el.textContent !== value) el.textContent = value;
      });
    }, 1000);
  };


  UI.configureGameShellUI = function () {
    const st = UI.state;
    const uni = st.currentUniverse;
    document.getElementById('screen-lobby')?.classList.add('hidden');
    document.body.classList.remove('lobby-black');
    document.getElementById('screen-game')?.classList.remove('hidden');

    const mpBadge = document.getElementById('mp-live-badge');
    if (mpBadge) mpBadge.classList.toggle('hidden', !st.isMultiplayerMode);

    const creativeBar = document.getElementById('creative-quick-bar');
    if (creativeBar) {
      creativeBar.classList.toggle('hidden', st.isMultiplayerMode || !uni.creativeMode);
    }

    const sbComm = document.querySelector('.sidebar-btn[data-view="chat"]');
    if (sbComm) {
      sbComm.classList.toggle('hidden', !st.isMultiplayerMode);
      sbComm.innerHTML = `${UI.svgIcon('chat')}<span class="sidebar-comm-label">Comunicazioni</span><span id="sidebar-chat-badge" class="badge badge-red ${st.unreadPrivateCount > 0 ? '' : 'hidden'}">${st.unreadPrivateCount}</span>`;
    }

    const drComm = document.querySelector('.drawer-item[data-view="chat"]');
    if (drComm) {
      drComm.classList.toggle('hidden', !st.isMultiplayerMode);
      drComm.innerHTML = `<span class="icon">${UI.svgIcon('chat')}</span><span>Comunicazioni</span> <span id="drawer-chat-badge" class="badge badge-red ${st.unreadPrivateCount > 0 ? '' : 'hidden'}" style="position:absolute; top:6px; right:6px;">${st.unreadPrivateCount}</span>`;
    }
  };


  UI.startGame = function (universe) {
    UI.cleanupMultiplayerListeners();
    const st = UI.state;
    st.isMultiplayerMode = false;
    st.currentUniverse = universe;

    const offlineReport = window.UniversumEngine.processOfflineProgress(universe);
    window.UniversumGalaxy.processFleetsAndBots(universe);

    const home = universe.planets[0];
    if (home) {
      st.galaxyG = home.coords.g;
      st.galaxyS = home.coords.s;
      st.fleetTarget = { g: home.coords.g, s: home.coords.s, p: home.coords.p };
    }
    st.lastAlertCount = (universe.incomingAttacks || []).length;

    UI.configureGameShellUI();
    UI.refreshPlanetSelector();
    UI.updateTopBarNumbers();
    UI.switchView('overview');
    UI.startGameLoop();
    window.UniversumTutorial?.onStart();

    if (!universe.creativeMode && offlineReport.offlineSeconds >= 30) {
      const unitNames = Object.entries(offlineReport.completedUnits)
        .map(([k, v]) => `${v}× ${k}`)
        .join(', ');

      UI.openModal('RAPPORTO DI ASSENZA OFFLINE', `
        <p style="margin-bottom:10px;">Bentornato Imperatore! Tempo trascorso offline: <strong>${UI.formatDuration(offlineReport.offlineSeconds)}</strong>.</p>
        <div style="background:rgba(0,0,0,0.4); padding:12px; border-radius:8px; margin-bottom:12px;">
          <div>Metallo estratto: <strong class="text-metal">+${UI.formatNum(offlineReport.gained.metal)}</strong></div>
          <div>Cristallo estratto: <strong class="text-crystal">+${UI.formatNum(offlineReport.gained.crystal)}</strong></div>
          <div>Deuterio estratto: <strong class="text-deuterium">+${UI.formatNum(offlineReport.gained.deuterium)}</strong></div>
        </div>
        ${offlineReport.completedBuildings.length > 0 ? `<p style="font-size:0.9rem; margin-bottom:6px;">Edifici completati: <strong>${UI.escapeHTML(offlineReport.completedBuildings.join(', '))}</strong></p>` : ''}
        ${offlineReport.completedResearches.length > 0 ? `<p style="font-size:0.9rem; margin-bottom:6px;">Ricerche completate: <strong>${UI.escapeHTML(offlineReport.completedResearches.join(', '))}</strong></p>` : ''}
        ${unitNames ? `<p style="font-size:0.9rem;">Unità costruite: <strong>${UI.escapeHTML(unitNames)}</strong></p>` : ''}
      `);
    }
  };


  UI.startOnlineGame = function (universe) {
    UI.cleanupMultiplayerListeners();
    const st = UI.state;
    st.isMultiplayerMode = true;
    st.currentUniverse = universe;
    universe.creativeMode = false;

    const home = universe.planets[0];
    if (home) {
      st.galaxyG = home.coords.g;
      st.galaxyS = home.coords.s;
      st.fleetTarget = { g: home.coords.g, s: home.coords.s, p: home.coords.p };
    }

    if (window.UniversumMP?.listenUniverseDeleted) {
      st.unsubServerListener = window.UniversumMP.listenUniverseDeleted(universe.id, async () => {
        if (UI.state.currentUniverse?.id !== universe.id) return;
        UI.toast('Il server e stato eliminato dal creatore.', 'error');
        await UI.exitToLobbyAfterServerRemoval();
      });
    }

    if (window.UniversumMP?.listenIncomingFleets) {
      st.unsubFleetsListener = window.UniversumMP.listenIncomingFleets(universe, (incomingList) => {
        universe.incomingAttacks = incomingList;
        if (incomingList.length > st.lastAlertCount) {
          UI.playSound('alarm');
          const hasBot = incomingList.some((f) => String(f.attackerUid || '').startsWith('npc_raid_'));
          UI.toast(hasBot ? 'RADAR: Raid BOT in arrivo sul tuo pianeta!' : 'RADAR PvP: Un giocatore ha lanciato una flotta verso di te!', 'error');
        }
        st.lastAlertCount = incomingList.length;
        if (st.currentView === 'overview') UI.renderCurrentView();
      });
    }

    // FIX 4.2 — Le flotte proprie si aggiornano da sole (partenza, ritorno, rientro assedi)
    if (window.UniversumMP?.listenOwnFleets) {
      st.unsubOwnFleetsListener = window.UniversumMP.listenOwnFleets(universe, (ownList) => {
        if (UI.state.currentUniverse !== universe) return;
        universe.fleetsInFlight = ownList;
        if (['overview', 'movements'].includes(st.currentView)) UI.renderCurrentView();
      });
    }

    // FIX 2.9 — Pianeti propri: variazioni in arrivo, pianeti persi (conquista) o acquisiti
    if (window.UniversumMP?.listenOwnPlanets) {
      st.unsubOwnPlanetsListener = window.UniversumMP.listenOwnPlanets(universe, ({ gained, needSync }) => {
        if (UI.state.currentUniverse !== universe) return;
        if (gained.length > 0) {
          gained.forEach((p) => UI.toast(`Nuovo pianeta nel tuo impero: ${p.name}`, 'success'));
          UI.refreshPlanetSelector?.();
        }
        if (needSync) UI._requestReconcileSync();
        else if (gained.length > 0 && st.currentView === 'overview') UI.renderCurrentView();
      });
    }

    UI.configureGameShellUI();
    UI.refreshPlanetSelector();
    UI.updateTopBarNumbers();
    UI.switchView('overview');
    UI.startGameLoop();
  };


  UI.bindGlobalUIEvents = function () {
    const st = UI.state;
    document.getElementById('active-planet-select')?.addEventListener('change', (e) => {
      if (!st.currentUniverse) return;
      st.currentUniverse.activePlanetId = e.target.value;
      UI.updateTopBarNumbers();
      UI.renderCurrentView();
      UI.playSound('click');
    });

    document.getElementById('btn-turbo-toggle')?.addEventListener('click', async () => {
      if (!st.currentUniverse || st.isMultiplayerMode) return;
      const res = window.UniversumEngine.activateTurbo(st.currentUniverse);
      await UI.persistUniverseState();
      UI.updateTopBarNumbers();
      UI.playSound('success');
      UI.toast(`TURBO 2x attivo (${UI.formatDuration(res.remainingSec)})!`, 'creative');
    });

    document.querySelectorAll('#creative-quick-bar [data-creative]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!st.currentUniverse || st.isMultiplayerMode) return;
        try {
          const msg = window.UniversumEngine.applyCreativeCheat(
            st.currentUniverse,
            UI.getActivePlanetIndex(),
            btn.dataset.creative
          );
          await UI.persistUniverseState();
          UI.updateTopBarNumbers();
          UI.renderCurrentView();
          UI.playSound('complete');
          UI.toast(msg, 'creative');
        } catch (err) {
          UI.toast(err.message, 'error');
        }
      });
    });

    document.querySelectorAll('.sidebar-btn[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => UI.switchView(btn.dataset.view));
    });

    document.querySelectorAll('.nav-tab-btn[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => UI.switchView(btn.dataset.view));
    });

    const drawer = document.getElementById('mobile-menu-drawer');
    document.getElementById('btn-mobile-menu')?.addEventListener('click', () => {
      UI.playSound('click');
      drawer?.classList.remove('hidden');
    });
    document.getElementById('btn-close-drawer')?.addEventListener('click', () => {
      drawer?.classList.add('hidden');
    });
    drawer?.addEventListener('click', (e) => {
      if (e.target === drawer) drawer.classList.add('hidden');
    });

    document.querySelectorAll('.drawer-item[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => UI.switchView(btn.dataset.view));
    });

    document.getElementById('drawer-btn-lobby')?.addEventListener('click', () => {
      drawer?.classList.add('hidden');
      UI.switchView('saves');
    });

    document.getElementById('btn-back-lobby')?.addEventListener('click', async () => {
      await UI.exitActiveGameToLobby();
    });

    if (window.UniversumEngine && typeof window.UniversumEngine.bindAutoSave === 'function') {
      window.UniversumEngine.bindAutoSave(() => (st.isMultiplayerMode ? null : st.currentUniverse));
    }
  };


  UI.init = function () {
    UI.generateDynamicPWAIcon();
    UI.setupLobbyTabs();
    UI.bindGlobalUIEvents();
  };


  document.addEventListener('DOMContentLoaded', UI.init);
})();
