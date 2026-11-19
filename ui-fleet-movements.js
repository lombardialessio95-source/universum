/**
 * UNIVERSUM — Schermata UI: Movimento Flotta, Slot & Stato Assedi (Offline + Online PvP)
 */
(function () {
  'use strict';

  const UI = window.UniversumUI;

  const MISSION_LABELS = {
    attack: { label: 'Attacco', badge: 'badge-red' },
    spy: { label: 'Spionaggio', badge: 'badge-blue' },
    colonize: { label: 'Colonizzazione', badge: 'badge-green' },
    transport: { label: 'Trasporto', badge: 'badge-blue' },
    deploy: { label: 'Schieramento', badge: 'badge-green' },
    explore: { label: 'Esplorazione', badge: 'badge-creative' },
    expedition: { label: 'Esplorazione', badge: 'badge-creative' },
    recycle: { label: 'Riciclaggio', badge: 'badge-creative' },
    destroyMoon: { label: 'Distruzione Luna', badge: 'badge-red' },
    embargo: { label: 'Embargo Planetario', badge: 'badge-red' },
    blockade: { label: 'Embargo Planetario', badge: 'badge-red' },
    occupy: { label: 'Occupazione Planetaria', badge: 'badge-red' },
    recall: { label: 'Richiamo Flotta', badge: 'badge-blue' }
  };

  UI.renderFleetMovements = async function (viewport) {
    const { escapeHTML, formatNum, formatDuration, svgIcon, artTag } = UI;
    const st = UI.state;
    const uni = st.currentUniverse;
    const Data = window.UniversumData;
    const MCore = window.UniversumMissionsCore;

    const maxSlots = MCore ? MCore.getMaxFleetSlots(uni) : (5 + Number(uni.researches?.computerTech || 0));
    const flights = (uni.fleetsInFlight || []).filter((f) => !f.resolved);
    const usedSlots = MCore ? MCore.getUsedFleetSlots(uni) : flights.length;
    const maxExpHours = MCore ? MCore.getMaxExploreHours(uni) : (1 + Number(uni.researches?.expeditionTech || 0));

    let activeSieges = uni.activeSieges || [];
    let incomingSieges = uni.incomingSieges || [];

    // In modalitÃ  Online carica anche gli embarghi/occupazioni reali da Firestore
    if (st.isMultiplayerMode && window.fbDB && window.fbAuth?.currentUser) {
      const myUid = window.fbAuth.currentUser.uid;
      const uniRef = window.fbDB.collection('online_universes').doc(uni.id);

      const onlineIncoming = [];
      for (const pl of uni.planets || []) {
        if (pl.embargo && pl.embargo.attackerUid !== myUid) {
          onlineIncoming.push({
            id: `mp_emb_${pl.coords.g}_${pl.coords.s}_${pl.coords.p}`,
            type: 'embargo',
            targetCoords: pl.coords,
            attackerName: pl.embargo.attackerName,
            fuelRemaining: Number(pl.embargo.deuterium || 0),
            deuteriumInitial: Number(pl.embargo.deuterium || 0),
            ransom: pl.embargo.ransom
          });
        }
        if (pl.occupation && pl.occupation.occupierUid !== myUid) {
          onlineIncoming.push({
            id: `mp_occ_${pl.coords.g}_${pl.coords.s}_${pl.coords.p}`,
            type: 'occupy',
            targetCoords: pl.coords,
            attackerName: pl.occupation.occupierName,
            prelievoAccumulato: pl.occupation.prelievoAccumulato || { metal: 0, crystal: 0, deuterium: 0 },
            ransom: pl.occupation.ransom
          });
        }
      }
      incomingSieges = onlineIncoming;

      try {
        const [embSnap, occSnap] = await Promise.all([
          uniRef.collection('planets').where('embargo.attackerUid', '==', myUid).get(),
          uniRef.collection('planets').where('occupation.occupierUid', '==', myUid).get()
        ]);
        const onlineActive = [];
        embSnap.docs.forEach((d) => {
          const p = d.data();
          onlineActive.push({
            id: `mp_my_emb_${p.coords.g}_${p.coords.s}_${p.coords.p}`,
            type: 'embargo',
            targetCoords: p.coords,
            fuelRemaining: Number(p.embargo?.deuterium || 0),
            deuteriumInitial: Number(p.embargo?.deuterium || 0),
            ransom: p.embargo?.ransom
          });
        });
        occSnap.docs.forEach((d) => {
          const p = d.data();
          onlineActive.push({
            id: `mp_my_occ_${p.coords.g}_${p.coords.s}_${p.coords.p}`,
            type: 'occupy',
            targetCoords: p.coords,
            prelievoAccumulato: p.occupation?.prelievoAccumulato || { metal: 0, crystal: 0, deuterium: 0 },
            ransom: p.occupation?.ransom
          });
        });
        activeSieges = onlineActive;
      } catch (e) {}
    }

    const now = Date.now();

    const withDeuterium = (s) => {
      const Siege = window.UniversumSiege;
      let rem;
      if (Siege?.getSiegeDeuteriumRemaining) {
        rem = Siege.getSiegeDeuteriumRemaining(uni, s);
      } else if (s.type === 'occupy') {
        const tp = (uni.planets || []).find((p) => Number(p.coords?.g) === Number(s.targetCoords?.g) && Number(p.coords?.s) === Number(s.targetCoords?.s) && Number(p.coords?.p) === Number(s.targetCoords?.p));
        rem = Number(tp?.resources?.deuterium ?? s.targetDeuterium ?? 0);
      } else {
        rem = Number(s.fuelRemaining ?? s.cargo?.deuterium ?? 0);
      }
      const init = Siege?.getSiegeDeuteriumInitial ? Siege.getSiegeDeuteriumInitial(s) : Number(s.deuteriumInitial || rem || 0);
      return { ...s, deutRemain: Math.floor(rem), deutInit: Math.floor(init), deutPct: init > 0 ? Math.max(0, Math.min(100, (rem / init) * 100)) : 0 };
    };
    activeSieges = activeSieges.map(withDeuterium);
    incomingSieges = incomingSieges.map(withDeuterium);

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <!-- INTESTAZIONE SLOT FLOTTA -->
        <div class="glass-panel" style="padding:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
            <div>
              <h2 style="font-size:1.1rem; color:var(--res-crystal);">${svgIcon('radar')} MOVIMENTO FLOTTA &amp; CONTROLLO MISSIONI</h2>
              <p class="text-muted" style="font-size:0.88rem; margin-top:2px;">
                Tecnologia Informatica Lv.${Number(uni.researches?.computerTech || 0)} • Esplorazione Max: <strong class="text-crystal">${maxExpHours}h</strong>
              </p>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge ${usedSlots >= maxSlots ? 'badge-red' : 'badge-green'}" style="font-size:0.95rem; padding:6px 12px;">
                SLOT FLOTTA: ${usedSlots} / ${maxSlots}
              </span>
              <button type="button" id="btn-mov-new-fleet" class="btn btn-green btn-sm" ${usedSlots >= maxSlots ? 'disabled' : ''}>
                + NUOVA MISSIONE
              </button>
            </div>
          </div>

          <div style="height:8px; background:rgba(0,0,0,0.45); border-radius:6px; overflow:hidden;">
            <div style="height:100%; width:${Math.min(100, (usedSlots / Math.max(1, maxSlots)) * 100)}%; background:${usedSlots >= maxSlots ? 'var(--btn-red)' : 'var(--btn-green)'}; transition:width 0.3s;"></div>
          </div>
        </div>

        <!-- SEZIONE: FLOTTE IN VOLO -->
        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:0.98rem; color:var(--res-crystal); margin-bottom:10px;">SQUADRONI IN TRANSITO (${flights.length})</h3>
          ${flights.length === 0 ? `
            <p class="text-muted">Nessuna flotta attualmente in volo. Tutti gli slot operativi sono disponibili.</p>
          ` : `
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${flights.map((f) => {
                const mInfo = MISSION_LABELS[f.mission] || { label: f.mission, badge: 'badge-blue' };
                const isOutbound = f.status === 'outbound';
                const startTs = Number(f.departureTime || f.returnStartTime || (now - 5000));
                const endTs = Number(isOutbound ? f.arrivalTime : f.returnTime);
                const totalMs = Math.max(1000, endTs - startTs);
                const progressPct = Math.min(100, Math.max(4, Math.round(((now - startTs) / totalMs) * 100)));
                const fuelPct = Number(f.fuelPercent || f.speedPct || 100);
                const expH = f.exploreHours || f.expeditionHours;
                const ransomObj = f.ransomDemand || f.ransom;

                const shipBadges = Object.entries(f.ships || {})
                  .filter(([, q]) => Number(q) > 0)
                  .map(([sid, q]) => {
                    const sName = Data.SHIPS[sid]?.name || sid;
                    return `<span style="display:inline-flex; align-items:center; gap:4px; background:rgba(255,255,255,0.06); padding:3px 8px; border-radius:6px; font-size:0.84rem;">${artTag(sid, 'unit-art-sm', sName)} ${escapeHTML(sName)}: <strong>${formatNum(q)}</strong></span>`;
                  }).join('');

                const hasCargo = (f.cargo?.metal || 0) + (f.cargo?.crystal || 0) + (f.cargo?.deuterium || 0) > 0;

                return `
                  <div style="background:rgba(0,0,0,0.4); border:1px solid rgba(0,210,255,0.22); border-radius:10px; padding:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
                      <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <span class="badge ${mInfo.badge}">${escapeHTML(mInfo.label)}</span>
                        <span class="badge ${isOutbound ? 'badge-green' : 'badge-blue'}">${isOutbound ? 'ANDATA' : (f.recalled || f.mission === 'recall' ? 'RICHIAMATA • RIENTRO' : 'RIENTRO')}</span>
                        <span class="badge badge-neutral">Spinta: ${fuelPct}%</span>
                        ${expH ? `<span class="badge badge-creative">Esplorazione: ${expH}h</span>` : ''}
                      </div>
                      <span class="font-display text-energy live-timer" data-end="${endTs}" style="font-size:1.05rem;">${formatDuration((endTs - now) / 1000)}</span>
                    </div>

                    <div style="font-size:0.92rem; margin-bottom:8px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px;">
                      <span>Rotta: <strong class="text-crystal">[${f.originCoords.g}:${f.originCoords.s}:${f.originCoords.p}]</strong> → <strong class="text-metal">[${f.targetCoords.g}:${f.targetCoords.s}:${f.targetCoords.p}]</strong></span>
                      ${ransomObj ? `<span class="text-energy">Riscatto impostato: <strong>${formatNum((ransomObj.metal || 0) + (ransomObj.crystal || 0) + (ransomObj.deuterium || 0))}</strong> ris.</span>` : ''}
                    </div>

                    <!-- Barra avanzamento rotta -->
                    <div style="height:6px; background:rgba(255,255,255,0.08); border-radius:4px; overflow:hidden; margin-bottom:10px;">
                      <div style="height:100%; width:${progressPct}%; background:${isOutbound ? 'var(--res-crystal)' : 'var(--btn-blue)'};"></div>
                    </div>

                    <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;">
                      ${shipBadges}
                    </div>

                    ${hasCargo ? `
                      <div class="text-muted" style="font-size:0.84rem; margin-bottom:8px;">
                        Stiva: <strong class="text-metal">${formatNum(f.cargo.metal || 0)} M</strong> •
                        <strong class="text-crystal">${formatNum(f.cargo.crystal || 0)} C</strong> •
                        <strong class="text-deuterium">${formatNum(f.cargo.deuterium || 0)} D</strong>
                      </div>
                    ` : ''}

                    ${isOutbound ? `
                      <div style="display:flex; justify-content:flex-end;">
                        <button type="button" class="btn btn-red btn-sm btn-recall-fleet" data-fid="${escapeHTML(f.id)}">
                          ↩ RICHIAMA FLOTTA
                        </button>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- SEZIONE: EMBARGHI & OCCUPAZIONI ORBITALI ATTIVI -->
        <div class="glass-panel" style="padding:14px;">
          <h3 style="font-size:0.98rem; color:var(--btn-gold); margin-bottom:10px;">OPERAZIONI ORBITALI (EMBARGHI &amp; OCCUPAZIONI)</h3>

          ${activeSieges.length === 0 && incomingSieges.length === 0 ? `
            <p class="text-muted">Nessun embargo planetario o occupazione orbitale attiva al momento.</p>
          ` : `
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${activeSieges.map((s) => `
                <div style="background:rgba(0,230,118,0.08); border:1px solid var(--btn-green); border-radius:10px; padding:12px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:6px;">
                    <strong>${s.type === 'embargo' ? 'EMBARGO IMPOSTO' : 'OCCUPAZIONE ATTIVA'} su [${s.targetCoords.g}:${s.targetCoords.s}:${s.targetCoords.p}]</strong>
                    <span class="badge badge-green">TUO CONTROLLO</span>
                  </div>
                  <p class="text-muted" style="font-size:0.88rem; margin-bottom:8px;">
                    ${s.type === 'embargo'
                      ? `Blocco rotte attivo • Riscatto richiesto: <strong>${formatNum((s.ransom?.metal || 0) + (s.ransom?.crystal || 0) + (s.ransom?.deuterium || 0))}</strong>`
                      : `Prelievo automatico: <strong>5% risorse/giorno</strong> • Prelievo accumulato: <strong>${formatNum((s.prelievoAccumulato?.metal || 0) + (s.prelievoAccumulato?.crystal || 0) + (s.prelievoAccumulato?.deuterium || 0))}</strong> • Riscatto richiesto: <strong>${formatNum((s.ransom?.metal || 0) + (s.ransom?.crystal || 0) + (s.ransom?.deuterium || 0))}</strong>`}
                  </p>
                  <div style="margin-bottom:8px;">
                    <div style="display:flex; justify-content:space-between; font-size:0.84rem; margin-bottom:4px;">
                      <span class="text-deuterium">${s.type === 'embargo' ? 'Deuterio in stiva (Embargo)' : 'Deuterio pianeta occupato (Occupazione)'}</span>
                      <strong class="text-deuterium">${formatNum(s.deutRemain)} D${s.deutInit > 0 ? ` / ${formatNum(s.deutInit)} D` : ''}</strong>
                    </div>
                    <div style="height:8px; background:rgba(0,0,0,0.45); border-radius:6px; overflow:hidden;">
                      <div style="height:100%; width:${s.deutPct}%; background:var(--res-deuterium); transition:width 0.3s;"></div>
                    </div>
                  </div>
                  <button type="button" class="btn btn-blue btn-sm btn-withdraw-siege"
                    data-sid="${escapeHTML(s.id)}"
                    data-g="${s.targetCoords.g}" data-s="${s.targetCoords.s}" data-p="${s.targetCoords.p}">
                    RITIRA FLOTTA ALLA BASE
                  </button>
                </div>
              `).join('')}

              ${incomingSieges.map((s) => `
                <div style="background:rgba(255,23,68,0.14); border:1px solid var(--btn-red); border-radius:10px; padding:12px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:6px;">
                    <strong style="color:#ff5252;">${s.type === 'embargo' ? 'PIANETA SOTTO EMBARGO' : 'PIANETA OCCUPATO'} [${s.targetCoords.g}:${s.targetCoords.s}:${s.targetCoords.p}]</strong>
                    <span class="badge badge-red">OSTILE: ${escapeHTML(s.attackerName || 'Nemico')}</span>
                  </div>
                  <p style="font-size:0.88rem; margin-bottom:10px;">
                    ${s.type === 'embargo'
                      ? `Partenze e arrivi su questo pianeta sono bloccati. Riscatto: <strong>${formatNum(s.ransom?.metal || 0)} M / ${formatNum(s.ransom?.crystal || 0)} C / ${formatNum(s.ransom?.deuterium || 0)} D</strong>`
                      : `La flotta nemica preleva il 5% giornaliero delle tue risorse. Riscatto: <strong>${formatNum(s.ransom?.metal || 0)} M / ${formatNum(s.ransom?.crystal || 0)} C / ${formatNum(s.ransom?.deuterium || 0)} D</strong>`}
                  </p>
                  <div style="margin-bottom:8px;">
                    <div style="display:flex; justify-content:space-between; font-size:0.84rem; margin-bottom:4px;">
                      <span class="text-deuterium">${s.type === 'embargo' ? 'Deuterio in stiva nemica (Embargo)' : 'Deuterio tuo pianeta (Occupazione)'}</span>
                      <strong class="text-deuterium">${formatNum(s.deutRemain)} D${s.deutInit > 0 ? ` / ${formatNum(s.deutInit)} D` : ''}</strong>
                    </div>
                    <div style="height:8px; background:rgba(0,0,0,0.45); border-radius:6px; overflow:hidden;">
                      <div style="height:100%; width:${s.deutPct}%; background:var(--res-deuterium); transition:width 0.3s;"></div>
                    </div>
                  </div>
                  <div style="display:flex; flex-wrap:wrap; gap:8px;">
                    ${!st.isMultiplayerMode ? `
                      <button type="button" class="btn btn-red btn-sm btn-break-siege-fight" data-sid="${escapeHTML(s.id)}">${svgIcon('sword')} ATTACCA FLOTTA ORBITALE</button>
                    ` : ''}
                    <button type="button" class="btn btn-creative btn-sm btn-pay-siege-ransom"
                      data-sid="${escapeHTML(s.id)}"
                      data-g="${s.targetCoords.g}" data-s="${s.targetCoords.s}" data-p="${s.targetCoords.p}">
                      PAGA RISCATTO
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;

    document.getElementById('btn-mov-new-fleet')?.addEventListener('click', () => {
      UI.switchView('fleet');
    });

    viewport.querySelectorAll('.btn-recall-fleet').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          if (st.isMultiplayerMode && window.UniversumMP?.recallOnlineFleet) {
            await window.UniversumMP.recallOnlineFleet(uni, btn.dataset.fid);
          } else {
            MCore.recallFleet(uni, btn.dataset.fid);
            await window.UniversumDB.save(uni);
          }
          UI.playSound('click');
          UI.toast('Ordine di rientro trasmesso allo squadrone!', 'info');
          UI.renderCurrentView();
        } catch (err) {
          UI.playSound('error');
          UI.toast(err.message, 'error');
        }
      });
    });

    viewport.querySelectorAll('.btn-withdraw-siege').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          if (st.isMultiplayerMode && window.UniversumMP?.liftOnlineSiege) {
            const coords = { g: Number(btn.dataset.g), s: Number(btn.dataset.s), p: Number(btn.dataset.p) };
            await window.UniversumMP.liftOnlineSiege(uni.id, coords);
          } else if (window.UniversumSiege?.withdrawSiege) {
            await window.UniversumSiege.withdrawSiege(uni, btn.dataset.sid);
            await UI.persistUniverseState();
          }
          UI.playSound('click');
          UI.toast('Flotta orbitale richiamata verso il pianeta madre.', 'info');
          UI.renderCurrentView();
        } catch (err) {
          UI.playSound('error');
          UI.toast(err.message, 'error');
        }
      });
    });

    viewport.querySelectorAll('.btn-break-siege-fight').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (window.UniversumSiege?.attackOrbitingSiege) {
          await window.UniversumSiege.attackOrbitingSiege(uni, btn.dataset.sid);
          await UI.persistUniverseState();
          UI.updateTopBarNumbers();
          UI.renderCurrentView();
        }
      });
    });

    viewport.querySelectorAll('.btn-pay-siege-ransom').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          if (st.isMultiplayerMode && window.UniversumMP?.payOnlineSiegeRansom) {
            const coords = { g: Number(btn.dataset.g), s: Number(btn.dataset.s), p: Number(btn.dataset.p) };
            await window.UniversumMP.payOnlineSiegeRansom(uni.id, coords);
            const pl = uni.planets.find((p) => p.coords.g === coords.g && p.coords.s === coords.s && p.coords.p === coords.p);
            if (pl) {
              const siege = pl.occupation || pl.embargo;
              if (siege?.ransom) {
                pl.resources.metal = Math.max(0, pl.resources.metal - (siege.ransom.metal || 0));
                pl.resources.crystal = Math.max(0, pl.resources.crystal - (siege.ransom.crystal || 0));
                pl.resources.deuterium = Math.max(0, pl.resources.deuterium - (siege.ransom.deuterium || 0));
              }
              pl.embargo = null;
              pl.occupation = null;
            }
          } else if (window.UniversumSiege?.payOccupationRansom) {
            await window.UniversumSiege.payOccupationRansom(uni, btn.dataset.sid);
            await UI.persistUniverseState();
          }
          UI.playSound('success');
          UI.toast('Riscatto pagato! Blocco orbitale rimosso.', 'success');
          UI.updateTopBarNumbers();
          UI.renderCurrentView();
        } catch (err) {
          UI.playSound('error');
          UI.toast(err.message, 'error');
        }
      });
    });
  };
})();
