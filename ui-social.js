(function () {
  'use strict';

  const UI = window.UniversumUI;

  // =========================================================
  // PAGINA RAPPORTI (persistente: Firestore online / salvataggio locale offline)
  // =========================================================
  UI.renderReports = async function (viewport) {
    const { escapeHTML, formatNum, svgIcon } = UI;
    const st = UI.state;
    const uni = st.currentUniverse;
    if (!uni) return;

    let reports = [];
    if (st.isMultiplayerMode && window.UniversumMP?.getReports) {
      viewport.innerHTML = `<div class="glass-panel" style="padding:20px; text-align:center;"><p class="text-muted">Caricamento rapporti...</p></div>`;
      try {
        reports = await window.UniversumMP.getReports(uni.id);
      } catch (e) {
        reports = [...(uni.messages || [])];
      }
    } else {
      reports = [...(uni.messages || [])];
      for (const r of uni.spyReports || []) {
        reports.push({
          id: r.id,
          type: 'spy',
          title: `Rapporto Spionaggio: ${r.targetName} [${r.key}]`,
          body: `Risorse: ${formatNum(r.resources?.metal || 0)} M, ${formatNum(r.resources?.crystal || 0)} C, ${formatNum(r.resources?.deuterium || 0)} D. Flotta: ${r.fleet ? 'rilevata' : 'nascosta'}. Difese: ${r.defenses ? 'rilevate' : 'nascoste'}.`,
          timestamp: r.time || r.timestamp || 0,
          _spy: true
        });
      }
      reports.sort((a, b) => Number(b.timestamp || b.time || 0) - Number(a.timestamp || a.time || 0));
    }

    const categoryOf = (r) => {
      const t = `${r.type || ''} ${r.title || ''}`.toLowerCase();
      if (t.includes('spion') || t.includes('spy')) return { label: 'SPIONAGGIO', badge: 'badge-blue' };
      if (t.includes('occup')) return { label: 'OCCUPAZIONE', badge: 'badge-red' };
      if (t.includes('embargo') || t.includes('blocco')) return { label: 'EMBARGO', badge: 'badge-red' };
      if (t.includes('battaglia') || t.includes('difesa') || t.includes('combat') || t.includes('attacco')) return { label: 'BATTAGLIA', badge: 'badge-red' };
      if (t.includes('trasport') || t.includes('consegna') || t.includes('schiera')) return { label: 'TRASPORTO', badge: 'badge-green' };
      if (t.includes('esplor') || t.includes('expedition') || t.includes('relitto')) return { label: 'ESPLORAZIONE', badge: 'badge-creative' };
      if (t.includes('colon')) return { label: 'COLONIZZAZIONE', badge: 'badge-green' };
      return { label: 'RAPPORTO', badge: 'badge-neutral' };
    };

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div class="glass-panel" style="padding:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <h2 style="font-size:1.1rem; color:var(--btn-gold);">${svgIcon('mail')} PAGINA RAPPORTI (${reports.length})</h2>
            <button type="button" id="btn-reports-delete-all" class="btn btn-red btn-sm" ${reports.length === 0 ? 'disabled' : ''}>Elimina tutti</button>
          </div>
          ${reports.length === 0 ? '<p class="text-muted">Nessun rapporto salvato. I rapporti di battaglie, spionaggio, trasporti, esplorazioni, embargo e occupazione appariranno qui e restano salvati finche\' non li elimini.</p>' : `
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${reports.map((r) => {
                const cat = categoryOf(r);
                const when = r.timestamp || r.time;
                return `
                  <article style="background:rgba(0,0,0,0.38); border:1px solid rgba(0,210,255,0.22); border-left:4px solid ${cat.badge === 'badge-red' ? 'var(--btn-red)' : 'var(--btn-blue)'}; border-radius:8px; padding:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
                      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span class="badge ${cat.badge}">${cat.label}</span>
                        <strong style="font-size:0.98rem;">${escapeHTML(r.title || 'Rapporto')}</strong>
                      </div>
                      <button type="button" class="btn btn-ghost btn-sm btn-report-delete" data-rid="${escapeHTML(String(r.id || ''))}" data-spy="${r._spy ? '1' : '0'}">Elimina</button>
                    </div>
                    ${when ? `<div class="text-muted" style="font-size:0.8rem; margin-bottom:6px;">${new Date(when).toLocaleString('it-IT')}</div>` : ''}
                    <p style="font-size:0.92rem; line-height:1.45; white-space:pre-line;">${escapeHTML(r.body || '')}</p>
                  </article>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    `;

    viewport.querySelectorAll('.btn-report-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          if (st.isMultiplayerMode && window.UniversumMP?.deleteReport) {
            await window.UniversumMP.deleteReport(uni.id, btn.dataset.rid);
          } else if (btn.dataset.spy === '1') {
            uni.spyReports = (uni.spyReports || []).filter((r) => String(r.id) !== btn.dataset.rid);
            await UI.persistUniverseState();
          } else {
            uni.messages = (uni.messages || []).filter((m) => String(m.id) !== btn.dataset.rid);
            await UI.persistUniverseState();
          }
          UI.playSound('click');
          UI.toast('Rapporto eliminato.', 'success');
          UI.renderCurrentView();
        } catch (err) {
          UI.playSound('error');
          UI.toast(err.message, 'error');
        }
      });
    });

    document.getElementById('btn-reports-delete-all')?.addEventListener('click', async () => {
      try {
        if (st.isMultiplayerMode && window.UniversumMP?.deleteAllReports) {
          await window.UniversumMP.deleteAllReports(uni.id);
        } else {
          uni.messages = [];
          uni.spyReports = [];
          await UI.persistUniverseState();
        }
        UI.playSound('success');
        UI.toast('Tutti i rapporti sono stati eliminati.', 'success');
        UI.renderCurrentView();
      } catch (err) {
        UI.playSound('error');
        UI.toast(err.message, 'error');
      }
    });
  };

  // =========================================================
  // CLASSIFICA (CON PULSANTE MESSAGGI PRIVATI)
  // =========================================================
  UI.renderHighscoreAndQuests = async function (viewport) {
    const { escapeHTML, formatNum, svgIcon } = UI;
    const st = UI.state;
    const uni = st.currentUniverse;

    if (st.isMultiplayerMode && window.UniversumMP?.getLeaderboard) {
      viewport.innerHTML = `<div class="glass-panel" style="padding:20px; text-align:center;"><p class="text-muted">Calcolo classifica imperatori reali...</p></div>`;
      try {
        const players = await window.UniversumMP.getLeaderboard(uni.id);
        const myUid = window.fbAuth?.currentUser?.uid;

        viewport.innerHTML = `
          <div class="glass-panel" style="padding:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
              <h2 style="font-size:1.1rem; color:var(--btn-gold);">CLASSIFICA PvP GIOCATORI REALI</h2>
              <span class="badge badge-red">ZERO BOT</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${players.map((p, idx) => {
                const isMe = p.uid === myUid;
                const nick = p.nickname || 'Comandante';
                return `
                  <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:10px 12px; border-radius:8px; background:${isMe ? 'rgba(0,210,255,0.2)' : 'rgba(0,0,0,0.35)'}; border:1px solid ${isMe ? 'var(--btn-blue)' : 'transparent'};">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                      <strong class="font-display">#${idx + 1}</strong>
                      <strong>${escapeHTML(nick)}</strong>
                      ${isMe ? '<span class="badge badge-green">TU</span>' : `
                        <button type="button" class="btn btn-blue btn-sm btn-hs-pm" data-uid="${escapeHTML(p.uid)}" data-nick="${escapeHTML(nick)}" style="min-width:44px; min-height:44px; padding:4px 10px;" title="Messaggio Privato">${svgIcon('mail')}</button>
                      `}
                      <span class="text-muted" style="font-size:0.82rem;">(${p.planetCount || 1} pianeti)</span>
                    </div>
                    <strong class="font-display text-crystal">${formatNum(p.points || 0)} pt</strong>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;

        viewport.querySelectorAll('.btn-hs-pm').forEach((btn) => {
          btn.addEventListener('click', () => {
            UI.openPrivateChatWith(btn.dataset.uid, btn.dataset.nick);
          });
        });
      } catch (err) {
        viewport.innerHTML = `<div class="glass-panel" style="padding:16px;"><p style="color:#ff5252;">Errore classifica: ${escapeHTML(err.message)}</p></div>`;
      }
      return;
    }

    const Data = window.UniversumData;
    let buildingPts = 0;
    let fleetPts = 0;
    for (const p of uni.planets) {
      for (const lv of Object.values(p.buildings || {})) buildingPts += (Number(lv) || 0) * 150;
      for (const [sId, cnt] of Object.entries(p.fleet || {})) {
        const spec = Data.SHIPS[sId];
        if (spec) fleetPts += Math.floor(((spec.cost.metal + spec.cost.crystal + spec.cost.deuterium) / 1000) * cnt);
      }
    }
    let researchPts = 0;
    for (const lv of Object.values(uni.researches || {})) {
      researchPts += (Number(lv) || 0) * 350;
    }
    const playerTotal = buildingPts + researchPts + fleetPts;

    const rivals = [
      { name: 'Egemonia Valkor', pts: Math.floor(playerTotal * 1.45 + 12000), tag: 'BOT Elite' },
      { name: 'Dominio Krell', pts: Math.floor(playerTotal * 0.95 + 6500), tag: 'BOT Forte' },
      { name: `${uni.emperor} (Tu)`, pts: playerTotal, tag: 'IMPERATORE', isPlayer: true },
      { name: 'Alleanza Orion', pts: Math.floor(playerTotal * 0.6 + 2200), tag: 'BOT Medio' },
      { name: 'Avanguardia Sirius', pts: Math.floor(playerTotal * 0.3 + 800), tag: 'BOT Debole' }
    ].sort((a, b) => b.pts - a.pts);

    viewport.innerHTML = `
      <div class="glass-panel" style="padding:14px;">
        <h2 style="font-size:1.1rem; color:var(--btn-gold); margin-bottom:10px;">CLASSIFICA GALATTICA</h2>
        <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:12px; font-size:0.9rem;">
          <span>Edifici: <strong>${formatNum(buildingPts)}</strong></span>
          <span>Ricerche: <strong>${formatNum(researchPts)}</strong></span>
          <span>Flotta: <strong>${formatNum(fleetPts)}</strong></span>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${rivals.map((r, i) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-radius:8px; background:${r.isPlayer ? 'rgba(0,210,255,0.18)' : 'rgba(0,0,0,0.35)'}; border:1px solid ${r.isPlayer ? 'var(--btn-blue)' : 'transparent'};">
              <div>
                <strong class="font-display">#${i + 1}</strong>
                <strong style="margin-left:8px;">${escapeHTML(r.name)}</strong>
                <span class="badge ${r.isPlayer ? 'badge-green' : 'badge-blue'}" style="margin-left:6px;">${r.tag}</span>
              </div>
              <strong class="font-display text-crystal">${formatNum(r.pts)} pt</strong>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  };

  // =========================================================
  // COMUNICAZIONI (CHAT GALATTICA 20 | MESSAGGI PRIVATI 15)
  // =========================================================
  UI.renderCommunications = async function (viewport) {
    const st = UI.state;
    if (!st.isMultiplayerMode) {
      viewport.innerHTML = `<div class="glass-panel" style="padding:18px;"><p class="text-muted">Le Comunicazioni sono disponibili esclusivamente negli Universi Online Multiplayer.</p></div>`;
      return;
    }

    // Listener chat attivi solo con chat aperta; chiusura vista = unsubscribe (switchView)
    UI.startChatListeners?.();

    const isGalactic = st.commTab === 'galactic';

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div class="comm-tabs-bar">
          <button type="button" id="comm-tab-galactic" class="comm-tab-btn ${isGalactic ? 'active' : ''}">
            ${UI.svgIcon('globe')} Chat Galattica (20)
          </button>
          <button type="button" id="comm-tab-private" class="comm-tab-btn ${!isGalactic ? 'active' : ''}">
            ${UI.svgIcon('mail')} Messaggi Privati (15)
            <span id="tab-private-unread-badge" class="badge badge-red ${st.unreadPrivateCount > 0 ? '' : 'hidden'}">${st.unreadPrivateCount}</span>
          </button>
        </div>

        <div id="comm-tab-body"></div>
      </div>
    `;

    document.getElementById('comm-tab-galactic')?.addEventListener('click', async () => {
      UI.closePrivateMessageStream();
      st.commTab = 'galactic';
      UI.playSound('click');
      await UI.renderCommunications(viewport);
    });

    document.getElementById('comm-tab-private')?.addEventListener('click', async () => {
      st.commTab = 'private';
      UI.playSound('click');
      await UI.renderCommunications(viewport);
    });

    const bodyEl = document.getElementById('comm-tab-body');
    if (isGalactic) {
      UI.renderGalacticChatTab(bodyEl);
    } else {
      await UI.renderPrivateMessagesTab(bodyEl);
    }
  };

  UI.renderGalacticChatTab = function (container) {
    if (!container) return;
    const uni = UI.state.currentUniverse;
    container.innerHTML = `
      <div class="glass-panel chat-panel-wrapper">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="text-muted" style="font-size:0.88rem;">Tocca il nickname di un imperatore per aprire una chat privata</span>
          <span class="badge badge-green">ULTIMI 20</span>
        </div>
        <div id="chat-messages-box" class="chat-messages-box"></div>
        <form id="form-send-chat" class="chat-input-bar">
          <input type="text" id="input-chat-msg" class="form-control" placeholder="Trasmetti nel canale galattico..." maxlength="240" autocomplete="off" required>
          <button type="submit" class="btn btn-blue">INVIA</button>
        </form>
      </div>
    `;

    UI.renderGalacticChatMessagesDOM();

    document.getElementById('form-send-chat')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const inp = document.getElementById('input-chat-msg');
      const text = (inp?.value || '').trim();
      if (!text || !window.UniversumMP?.sendChatMessage) return;

      inp.value = '';
      try {
        await window.UniversumMP.sendChatMessage(uni.id, text);
        UI.playSound('click');
      } catch (err) {
        UI.playSound('error');
        UI.toast(err.message, 'error');
      }
    });
  };

  UI.renderGalacticChatMessagesDOM = function () {
    const box = document.getElementById('chat-messages-box');
    if (!box) return;
    const myUid = window.fbAuth?.currentUser?.uid;
    const msgs = UI.state.chatMessagesCache;

    if (msgs.length === 0) {
      box.innerHTML = `<p class="text-muted" style="text-align:center; margin:auto;">Nessuna trasmissione nel canale galattico.</p>`;
      return;
    }

    box.innerHTML = msgs.map((m) => {
      const isMine = m.uid === myUid;
      const dateObj = m.createdAt?.toDate ? m.createdAt.toDate() : new Date(m.timestamp || Date.now());
      const timeStr = dateObj.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      const nick = m.nickname || 'Comandante';

      return `
        <div class="chat-msg-item ${isMine ? 'mine' : ''}">
          <div class="chat-msg-header">
            ${isMine
              ? `<span class="chat-msg-sender">${UI.escapeHTML(nick)} (Tu)</span>`
              : `<button type="button" class="chat-sender-link" data-uid="${UI.escapeHTML(m.uid)}" data-nick="${UI.escapeHTML(nick)}" title="Apri chat privata">${UI.escapeHTML(nick)} [PM]</button>`
            }
            <span class="chat-msg-time">${timeStr}</span>
          </div>
          <div class="chat-msg-text">${UI.escapeHTML(m.text)}</div>
        </div>
      `;
    }).join('');

    box.querySelectorAll('.chat-sender-link').forEach((btn) => {
      btn.addEventListener('click', () => {
        UI.openPrivateChatWith(btn.dataset.uid, btn.dataset.nick);
      });
    });

    box.scrollTop = box.scrollHeight;
  };

  UI.renderPrivateMessagesTab = async function (container) {
    if (!container || !window.UniversumMP) return;
    const st = UI.state;
    const uni = st.currentUniverse;

    UI.closePrivateMessageStream();

    let playersList = [];
    try {
      playersList = await window.UniversumMP.getUniversePlayers(uni.id);
    } catch (e) {
      playersList = [];
    }

    const activeTarget = st.activePrivateTarget;

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div class="glass-panel" style="padding:12px;">
          <label for="select-new-private-chat" style="display:block; font-size:0.82rem; color:var(--res-crystal); font-weight:700; margin-bottom:6px; text-transform:uppercase;">
            Chat privata con...
          </label>
          <select id="select-new-private-chat" class="form-control">
            <option value="">-- Seleziona un Imperatore --</option>
            ${playersList.map((p) => {
              const conv = st.privateConversationsCache.find((c) => c.otherUid === p.uid);
              const unreadTag = conv?.isUnread ? ' [NUOVO]' : '';
              return `
                <option value="${UI.escapeHTML(p.uid)}" data-nick="${UI.escapeHTML(p.nickname)}" ${activeTarget?.uid === p.uid ? 'selected' : ''}>
                  ${UI.escapeHTML(p.nickname)}${unreadTag}
                </option>
              `;
            }).join('')}
          </select>
        </div>

        ${activeTarget ? `
          <div class="glass-panel chat-panel-wrapper" style="height:440px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(0,210,255,0.2); padding-bottom:8px;">
              <div>
                <span class="text-muted" style="font-size:0.82rem;">Canale criptato con</span>
                <strong class="font-display text-crystal" style="margin-left:6px;">${UI.escapeHTML(activeTarget.nickname)}</strong>
              </div>
              <button type="button" id="btn-close-private-thread" class="btn btn-ghost btn-sm">✕ CHIUDI</button>
            </div>

            <div id="private-messages-box" class="private-messages-box">
              <p class="text-muted" style="text-align:center; margin:auto;">Caricamento ultimi 15 messaggi...</p>
            </div>

            <form id="form-send-private" class="chat-input-bar">
              <input type="text" id="input-private-msg" class="form-control" placeholder="Scrivi messaggio privato (max 300 car.)..." maxlength="300" autocomplete="off" required>
              <button type="submit" class="btn btn-green">INVIA</button>
            </form>
          </div>
        ` : `
          <div class="glass-panel" style="padding:20px; text-align:center;">
            <p class="text-muted">Seleziona un imperatore dal menu qui sopra per leggere o inviare messaggi privati (ultimi 15).</p>
          </div>
        `}
      </div>
    `;

    document.getElementById('select-new-private-chat')?.addEventListener('change', async (e) => {
      const sel = e.target;
      const uid = sel.value;
      if (!uid) return;
      const opt = sel.options[sel.selectedIndex];
      const nick = opt?.dataset?.nick || opt?.textContent?.replace(' [NUOVO]', '') || 'Comandante';
      st.activePrivateTarget = { uid, nickname: nick };
      UI.playSound('click');
      await UI.renderPrivateMessagesTab(container);
    });

    if (activeTarget) {
      st.unsubPrivateMsgsListener = window.UniversumMP.listenPrivateMessages(
        uni.id,
        activeTarget.uid,
        (msgs) => {
          st.privateMessagesCache = msgs;
          UI.renderPrivateMessagesDOM();
        }
      );

      document.getElementById('btn-close-private-thread')?.addEventListener('click', async () => {
        UI.closePrivateMessageStream();
        st.activePrivateTarget = null;
        await UI.renderPrivateMessagesTab(container);
      });

      document.getElementById('form-send-private')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inp = document.getElementById('input-private-msg');
        const text = (inp?.value || '').trim();
        if (!text) return;

        inp.value = '';
        try {
          await window.UniversumMP.sendPrivateMessage(
            uni.id,
            activeTarget.uid,
            activeTarget.nickname,
            text
          );
          UI.playSound('click');
        } catch (err) {
          UI.playSound('error');
          UI.toast(err.message, 'error');
        }
      });
    }
  };

  UI.renderPrivateMessagesDOM = function () {
    const box = document.getElementById('private-messages-box');
    if (!box) return;
    const myUid = window.fbAuth?.currentUser?.uid;
    const msgs = UI.state.privateMessagesCache;

    if (msgs.length === 0) {
      box.innerHTML = `<p class="text-muted" style="text-align:center; margin:auto;">Nessun messaggio in questa conversazione. Invia il primo!</p>`;
      return;
    }

    box.innerHTML = msgs.map((m) => {
      const isMine = m.senderUid === myUid;
      const timeStr = m.timestamp
        ? new Date(m.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
        : '';

      return `
        <div class="pm-bubble-row ${isMine ? 'sent' : 'received'}">
          <div class="pm-bubble ${isMine ? 'sent' : 'received'}">
            <div class="pm-bubble-meta">
              <span>${UI.escapeHTML(isMine ? 'Tu' : (m.senderName || 'Imperatore'))}</span>
              <span>${timeStr}</span>
            </div>
            <div class="pm-bubble-text">${UI.escapeHTML(m.text)}</div>
          </div>
        </div>
      `;
    }).join('');

    box.scrollTop = box.scrollHeight;
  };
})();
