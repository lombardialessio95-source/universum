/** UNIVERSUM / modules/ui/lobby-online.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';

  const UI = window.UniversumUI;


  UI.setupLobbyTabs = function () {
    const { playSound, toast, openModal, closeModal, svgIcon, startOnlineGame } = UI;
    const tabOffline = document.getElementById('tab-mode-offline');
    const tabOnline = document.getElementById('tab-mode-online');
    const panelOffline = document.getElementById('lobby-panel-offline');
    const panelOnline = document.getElementById('lobby-panel-online');

    tabOffline?.addEventListener('click', () => {
      playSound('click');
      tabOffline.classList.add('active');
      tabOffline.setAttribute('aria-selected', 'true');
      tabOnline?.classList.remove('active');
      tabOnline?.setAttribute('aria-selected', 'false');
      panelOffline?.classList.remove('hidden');
      panelOnline?.classList.add('hidden');
    });

    tabOnline?.addEventListener('click', async () => {
      playSound('click');
      tabOnline.classList.add('active');
      tabOnline.setAttribute('aria-selected', 'true');
      tabOffline?.classList.remove('active');
      tabOffline?.setAttribute('aria-selected', 'false');
      panelOnline?.classList.remove('hidden');
      panelOffline?.classList.add('hidden');
      await UI.refreshOnlineLobbyState();
    });

    const authForm = document.getElementById('form-mp-auth');
    authForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!window.UniversumMP) {
        toast('Modulo Multiplayer non disponibile.', 'error');
        return;
      }
      const submitter = e.submitter;
      const isRegister = submitter && submitter.dataset.authMode === 'register';
      const nick = document.getElementById('mp-nickname').value;
      const pass = document.getElementById('mp-password').value;

      try {
        await window.UniversumMP.registerOrLogin(nick, pass, isRegister);
        playSound('success');
        toast(isRegister ? 'Account Imperatore registrato!' : 'Accesso effettuato!', 'success');
        await UI.refreshOnlineLobbyState();
      } catch (err) {
        playSound('error');
        toast(err.message || 'Errore autenticazione Firebase.', 'error');
      }
    });

    document.getElementById('btn-mp-logout')?.addEventListener('click', async () => {
      if (window.fbAuth) await window.fbAuth.signOut();
      await UI.refreshOnlineLobbyState();
      toast('Disconnesso dal server online.', 'info');
    });

    document.getElementById('btn-mp-refresh')?.addEventListener('click', async () => {
      playSound('click');
      await UI.renderOnlineUniversesList(true);
    });

    document.getElementById('btn-mp-create-uni')?.addEventListener('click', () => {
      playSound('click');
      openModal('CREA NUOVO UNIVERSO ONLINE PvP', `
        <form id="form-mp-create-uni-modal">
          <div class="form-group">
            <label for="mp-uni-name">Nome Universo Online</label>
            <input type="text" id="mp-uni-name" class="form-control" placeholder="Es. Andromeda PvP" maxlength="32" required>
          </div>
          <div class="form-grid-3">
            <div class="form-group">
              <label for="mp-uni-speed">Velocità</label>
              <select id="mp-uni-speed" class="form-control">
                <option value="1">1x</option>
                <option value="5">5x</option>
                <option value="10" selected>10x</option>
                <option value="25">25x</option>
                <option value="50">50x</option>
                <option value="100">100x</option>
              </select>
            </div>
            <div class="form-group">
              <label for="mp-uni-galaxies">Galassie</label>
              <input type="number" id="mp-uni-galaxies" class="form-control" value="3" min="1" max="9">
            </div>
            <div class="form-group">
              <label for="mp-uni-systems">Sistemi</label>
              <input type="number" id="mp-uni-systems" class="form-control" value="100" min="20" max="499">
            </div>
          </div>
          <div class="form-group">
            <label for="mp-uni-passcode">Codice Stanza (Opzionale per partita privata)</label>
            <input type="text" id="mp-uni-passcode" class="form-control" placeholder="Lascia vuoto per universo pubblico" maxlength="20">
          </div>
          <div class="glass-panel" style="padding:12px; margin-top:12px;">
            <h4 style="color:var(--res-crystal); margin-bottom:8px;">CONFIGURAZIONE BOT</h4>
            <div class="form-group"><label for="mp-bot-density">Densità BOT: <span id="mp-bot-density-val">20%</span></label>
              <input type="range" id="mp-bot-density" min="0" max="100" value="20" class="form-control"></div>
            <div class="form-grid-3">
              <div class="form-group"><label for="mp-bot-hostile">Ostili %</label><input type="number" id="mp-bot-hostile" class="form-control" min="0" max="100" value="30"></div>
              <div class="form-group"><label for="mp-bot-neutral">Neutrali %</label><input type="number" id="mp-bot-neutral" class="form-control" min="0" max="100" value="40"></div>
              <div class="form-group"><label for="mp-bot-peaceful">Pacifici %</label><input type="number" id="mp-bot-peaceful" class="form-control" min="0" max="100" value="30"></div>
            </div>
            <div class="form-group"><label for="mp-bot-level">Livello BOT</label><select id="mp-bot-level" class="form-control">
              <option value="1">1 — Debole</option><option value="2" selected>2 — Medio</option>
              <option value="3">3 — Forte</option><option value="4">4 — Elite</option></select></div>
            <label style="display:block; margin-top:6px;"><input type="checkbox" id="mp-bot-growth" checked> I BOT crescono nel tempo</label>
            <label style="display:block; margin-top:6px;"><input type="checkbox" id="mp-bot-raids" checked> Raid dei BOT ostili</label>
          </div>
          <button type="submit" class="btn btn-green" style="width:100%; margin-top:8px;">${svgIcon('globe')} FONDA E ENTRA NELL'UNIVERSO</button>
        </form>
      `);

      document.getElementById('mp-bot-density')?.addEventListener('input', (e) => {
        document.getElementById('mp-bot-density-val').textContent = `${e.target.value}%`;
      });
      document.getElementById('mp-bot-hostile')?.addEventListener('input', (e) => {
        document.getElementById('mp-bot-raids').disabled = Number(e.target.value) === 0;
      });
      document.getElementById('form-mp-create-uni-modal')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!window.UniversumMP) return;
        try {
          const h = Number(document.getElementById('mp-bot-hostile').value);
          const n = Number(document.getElementById('mp-bot-neutral').value);
          const p = Number(document.getElementById('mp-bot-peaceful').value);
          if (![h, n, p].every((v) => Number.isInteger(v) && v >= 0 && v <= 100) || h + n + p !== 100) {
            toast('Ostili + Neutrali + Pacifici devono totalizzare il 100%.', 'error');
            return;
          }
          const cfg = {
            name: document.getElementById('mp-uni-name').value,
            botConfig: {
              density: Number(document.getElementById('mp-bot-density').value),
              personality: { hostile: h, neutral: n, peaceful: p },
              level: Number(document.getElementById('mp-bot-level').value),
              growth: document.getElementById('mp-bot-growth').checked,
              raids: h > 0 && document.getElementById('mp-bot-raids').checked
            },
            speed: Number(document.getElementById('mp-uni-speed').value),
            galaxies: Number(document.getElementById('mp-uni-galaxies').value),
            systemsPerGalaxy: Number(document.getElementById('mp-uni-systems').value),
            passcode: document.getElementById('mp-uni-passcode').value.trim()
          };
          const uni = await window.UniversumMP.createOnlineUniverse(cfg);
          closeModal();
          playSound('complete');
          toast(`Universo Online "${uni.name}" fondato!`, 'success');
          startOnlineGame(uni);
        } catch (err) {
          playSound('error');
          toast(err.message, 'error');
        }
      });
    });
  };


  UI.refreshOnlineLobbyState = async function () {
    const authBox = document.getElementById('mp-auth-box');
    const serversBox = document.getElementById('mp-servers-box');
    const user = window.fbAuth ? window.fbAuth.currentUser : null;

    if (!user) {
      authBox?.classList.remove('hidden');
      serversBox?.classList.add('hidden');
      return;
    }

    authBox?.classList.add('hidden');
    serversBox?.classList.remove('hidden');

    const nickEl = document.getElementById('mp-logged-user');
    if (nickEl) {
      nickEl.textContent = user.displayName || (user.email ? user.email.split('@')[0] : 'Comandante');
    }

    await UI.renderOnlineUniversesList();
  };


  UI.renderOnlineUniversesList = async function (force = false) {
    const { escapeHTML, svgIcon, openModal, closeModal, playSound, toast, startOnlineGame } = UI;
    const listEl = document.getElementById('mp-universe-list');
    if (!listEl || !window.UniversumMP) return;

    listEl.innerHTML = `<div class="glass-panel" style="padding:16px; text-align:center;"><p class="text-muted">Scansione universi online in corso...</p></div>`;

    try {
      const universes = await window.UniversumMP.getOnlineUniverses({ force });
      const membership = window.UniversumMP.getMyServerMembership
        ? await window.UniversumMP.getMyServerMembership().catch(() => ({ serverIds: [], serverCount: 0, limit: 3 }))
        : { serverIds: [], serverCount: 0, limit: 3 };
      const myUid = window.fbAuth?.currentUser?.uid;
      const atLimit = membership.serverCount >= (membership.limit || 3);

      const createBtn = document.getElementById('btn-mp-create-uni');
      if (createBtn) {
        createBtn.disabled = atLimit;
        createBtn.textContent = atLimit ? 'LIMITE SERVER RAGGIUNTO (3/3)' : '+ CREA UNIVERSO ONLINE';
      }

      const limitHeader = `
        <div class="glass-panel" style="padding:12px 14px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <strong>Server ${membership.serverCount}/${membership.limit || 3}</strong>
          ${atLimit ? '<span class="badge badge-red">Limite raggiunto: abbandona un server per entrarne in un altro</span>' : '<span class="badge badge-green">Puoi ancora entrare in un nuovo server</span>'}
        </div>
      `;

      if (!universes || universes.length === 0) {
        listEl.innerHTML = `${limitHeader}<div class="glass-panel" style="padding:20px; text-align:center;"><p class="text-muted">Nessun universo online attivo. Clicca su "+ CREA UNIVERSO ONLINE" qui sopra!</p></div>`;
        return;
      }

      listEl.innerHTML = limitHeader + universes.map((u) => {
        const isMember = membership.serverIds.includes(u.id);
        const isFounder = myUid && (u.founderUid === myUid || u.ownerUid === myUid);
        let pending=null;
        try { pending=window.__UniversumMPModules?.ordinaryDepartureStatus?.({id:u.id},myUid); }
        catch (error) { pending={storageUnavailable:true}; }
        const joinDisabled = !pending && !isMember && atLimit;
        const cancellable=pending?.protocol===2 && pending.armed && Number.isSafeInteger(pending.expectedRevision) && pending.profileJoinedAt!=null;
        const npcBadge = u.npcMode === 'limited'
          ? '<span class="badge badge-neutral">MAX 10 AVAMPOSTI NEUTRALI</span>'
          : '<span class="badge badge-red">100% PvP • ZERO BOT</span>';
        return `
          <article class="universe-card glass-panel">
            <div class="universe-card-header">
              <div>
                <div class="universe-name">${escapeHTML(u.name)}</div>
                <div class="text-muted" style="font-size:0.9rem;">Fondatore: <strong style="color:#fff;">${escapeHTML(u.founderName || 'Imperatore')}</strong></div>
              </div>
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                ${npcBadge}
                <span class="badge badge-green">${u.speed}x</span>
                ${u.hasPasscode ? `<span class="badge badge-blue">${svgIcon('lock')} PRIVATO</span>` : ''}
              </div>
            </div>
            <div class="universe-meta">
              <span>Giocatori iscritti: <strong>${u.playerCount || 1}</strong></span>
              <span>Mappa: <strong>${u.galaxies}G × ${u.systemsPerGalaxy}S</strong></span>
            </div>
            ${isMember ? '<span class="badge badge-green">SEI IN QUESTO SERVER</span>' : ''}
            ${isFounder ? '<span class="badge badge-blue">CREATORE</span>' : ''}
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
              <button type="button" class="btn btn-green btn-sm btn-join-online-uni" data-uid="${u.id}" data-locked="${u.hasPasscode ? '1' : '0'}" ${joinDisabled ? 'disabled' : ''}>
                ${svgIcon('globe')} ${pending ? 'VERIFICA PARTENZA' : joinDisabled ? 'LIMITE 3 SERVER RAGGIUNTO' : (isMember ? "RIENTRA NELL'UNIVERSO" : "ENTRA NELL'UNIVERSO")}
              </button>
              ${cancellable ? `<button type="button" class="btn btn-red btn-sm btn-join-online-uni" data-uid="${u.id}" data-locked="${u.hasPasscode?'1':'0'}" data-cancel="1">ANNULLA SE DIMOSTRABILE</button>` : ''}
              ${isMember && !pending ? `<button type="button" class="btn btn-red btn-sm btn-leave-online-uni" data-uid="${u.id}">Abbandona Server</button>` : ''}
            </div>
          </article>
        `;
      }).join('');

      listEl.querySelectorAll('.btn-join-online-uni').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const uniId = btn.dataset.uid;
          const isLocked = btn.dataset.locked === '1';

          const proceedJoin = async (passcode = '') => {
            const G=window.__UniversumMPModules,u={id:uniId};
            try {
              if (!myUid || window.fbAuth?.currentUser?.uid!==myUid || UI.state.currentUniverse) throw Error('Selezione non più attiva.');
              if (G?.ordinaryDepartureBusy?.(u,myUid)) throw Error('Verifica già in corso.');
              const cancel=btn.dataset.cancel==='1';
              if (cancel && !window.confirm('Annullare soltanto se il server può impedire definitivamente il commit?')) return;
              const token=++UI._ordinaryEntryGeneration;
              const isCurrent=()=>UI._ordinaryEntryGeneration===token && window.fbAuth?.currentUser?.uid===myUid && !UI.state.currentUniverse;
              if (G?.ordinaryDepartureStatus?.(u,myUid)) {
                const result=await G.verifyOrdinaryDeparture(u,{passcode,cancel,isCurrent});
                playSound('complete');toast(result.status==='committed'?'Partenza confermata.':'Partenza annullata definitivamente.','success');
                return;
              }
              if (cancel) throw Error('Nessuna richiesta da annullare.');
              const joinedUni = await window.UniversumMP.joinOnlineUniverse(uniId, passcode);
              if (!isCurrent()) return;
              playSound('complete');
              startOnlineGame(joinedUni);
            } catch (err) {
              playSound('error');
              toast(err.message, 'error');
              if (!UI.state.currentUniverse && err.code==='ordinary-departure-pending') await UI.renderOnlineUniversesList(true);
            }
          };

          if (isLocked) {
            openModal('CODICE STANZA RICHIESTO', `
              <form id="form-mp-passcode">
                <div class="form-group">
                  <label for="inp-room-code">Inserisci Codice Universo</label>
                  <input type="text" id="inp-room-code" class="form-control" required>
                </div>
                <button type="submit" class="btn btn-green" style="width:100%;">ACCEDI</button>
              </form>
            `);
            document.getElementById('form-mp-passcode')?.addEventListener('submit', async (ev) => {
              ev.preventDefault();
              const code = document.getElementById('inp-room-code').value;
              closeModal();
              await proceedJoin(code);
            });
          } else {
            await proceedJoin('');
          }
        });
      });

      listEl.querySelectorAll('.btn-leave-online-uni').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const uniId = btn.dataset.uid;
          openModal('ABBANDONA SERVER', `
            <p style="margin-bottom:12px;">Abbandonando questo server perderai pianeti e progressi su di esso e liberi uno slot (Server ${membership.serverCount}/${membership.limit || 3}).</p>
            <div style="display:flex; gap:10px;">
              <button type="button" id="btn-confirm-leave-server" class="btn btn-red" style="flex:1;">ABBANDONA</button>
              <button type="button" id="btn-cancel-leave-server" class="btn btn-ghost" style="flex:1;">ANNULLA</button>
            </div>
          `);
          document.getElementById('btn-cancel-leave-server')?.addEventListener('click', closeModal);
          document.getElementById('btn-confirm-leave-server')?.addEventListener('click', async () => {
            if (!myUid || window.fbAuth?.currentUser?.uid !== myUid) {
              toast('Account cambiato: riapri la conferma.', 'info');
              return;
            }
            // La lobby non ha un universo multiplayer attivo: consulta la stessa mappa pendente per ID.
            if (window.__UniversumMPModules?.ordinaryCheckpointBlocked?.({id:uniId},null,myUid)) {
              toast('Partenza in verifica: rientra nell’universo per verificarla.', 'info');
              return;
            }
            try {
              await window.UniversumMP.leaveOnlineUniverse(uniId);
              closeModal();
              playSound('success');
              toast('Server abbandonato: slot liberato.', 'success');
              await UI.renderOnlineUniversesList(true);
            } catch (err) {
              playSound('error');
              toast(err.message, 'error');
            }
          });
        });
      });
    } catch (err) {
      listEl.innerHTML = `<div class="glass-panel" style="padding:16px;"><p style="color:#ff5252;">Errore caricamento universi: ${escapeHTML(err.message)}</p></div>`;
    }
  };


  UI.openRenamePlanetModal = function (planetIndex) {
    const uni = UI.state.currentUniverse;
    const planet = uni.planets[planetIndex];
    if (!planet) return;
    UI.openModal('RINOMINA PIANETA', `
      <form id="form-rename-planet">
        <div class="form-group">
          <label for="input-planet-name">Nuovo nome per [${planet.coords.g}:${planet.coords.s}:${planet.coords.p}]</label>
          <input type="text" id="input-planet-name" class="form-control" maxlength="24" value="${UI.escapeHTML(planet.name)}" required>
        </div>
        <div style="display:flex; gap:10px; margin-top:16px;">
          <button type="submit" class="btn btn-green" style="flex:1;">CONFERMA</button>
          <button type="button" id="cancel-rename-planet" class="btn btn-ghost">ANNULLA</button>
        </div>
      </form>
    `);

    const inp = document.getElementById('input-planet-name');
    inp?.focus();
    inp?.select();

    document.getElementById('cancel-rename-planet')?.addEventListener('click', UI.closeModal);
    document.getElementById('form-rename-planet')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (UI.blockPendingMutation(uni)) return;
      if (UI.state.currentUniverse !== uni) {
        UI.toast('Partita cambiata: riapri la schermata.', 'info');
        return;
      }
      try {
        const newName = window.UniversumEngine.renamePlanet(uni, planetIndex, inp.value);
        if (UI.state.isMultiplayerMode && window.UniversumMP?.renameOnlinePlanet) {
          await window.UniversumMP.renameOnlinePlanet(uni.id, planet.coords, newName);
        } else {
          await window.UniversumDB.save(uni);
        }
        UI.closeModal();
        UI.refreshPlanetSelector();
        UI.renderCurrentView();
        UI.playSound('success');
        UI.toast(`Pianeta rinominato in "${newName}"`, 'success');
      } catch (err) {
        UI.playSound('error');
        UI.toast(err.message, 'error');
      }
    });
  };


  UI.openRenameMoonModal = function (planetIndex) {
    const uni = UI.state.currentUniverse;
    const planet = uni.planets[planetIndex];
    if (!planet || !planet.moon) return;
    UI.openModal('RINOMINA LUNA', `
      <form id="form-rename-moon">
        <div class="form-group">
          <label for="input-moon-name">Nuovo nome Luna di ${UI.escapeHTML(planet.name)}</label>
          <input type="text" id="input-moon-name" class="form-control" maxlength="24" value="${UI.escapeHTML(planet.moon.name || 'Luna')}" required>
        </div>
        <div style="display:flex; gap:10px; margin-top:16px;">
          <button type="submit" class="btn btn-green" style="flex:1;">CONFERMA</button>
          <button type="button" id="cancel-rename-moon" class="btn btn-ghost">ANNULLA</button>
        </div>
      </form>
    `);

    const inp = document.getElementById('input-moon-name');
    inp?.focus();
    inp?.select();

    document.getElementById('cancel-rename-moon')?.addEventListener('click', UI.closeModal);
    document.getElementById('form-rename-moon')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (UI.blockPendingMutation(uni)) return;
      if (UI.state.currentUniverse !== uni) {
        UI.toast('Partita cambiata: riapri la schermata.', 'info');
        return;
      }
      try {
        const newName = window.UniversumEngine.renameMoon(uni, planetIndex, inp.value);
        if (UI.state.isMultiplayerMode && window.UniversumMP?.renameOnlineMoon) {
          await window.UniversumMP.renameOnlineMoon(uni.id, planet.coords, newName);
        } else {
          await window.UniversumDB.save(uni);
        }
        UI.closeModal();
        UI.renderCurrentView();
        UI.playSound('success');
        UI.toast(`Luna rinominata in "${newName}"`, 'success');
      } catch (err) {
        UI.playSound('error');
        UI.toast(err.message, 'error');
      }
    });
  };
})();
