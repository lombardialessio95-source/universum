/** UNIVERSUM / modules/ui/diplomacy.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const UI = window.UniversumUI;


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
    // Servizio indipendente dai BOT ordinari: disponibile anche con BOT pacifici
    // o senza BOT nel server. Selezione libera di tutti i pianeti posseduti.
    const moonMerchant = window.UniversumMoonMerchant;
    const ownedPlanets = (uni.planets || []).filter(p => p && p.coords);
    const initialIndex = ownedPlanets.indexOf(uni.planets[pIdx]);
    const merchantPanel = (!uni.creativeMode && moonMerchant) ? `
      <section id="moon-merchant-section" class="glass-panel moon-merchant-panel" style="padding:18px; border:1px solid rgba(124,195,255,.42);">
        <h2 style="font-size:1.12rem; color:var(--res-crystal); margin-bottom:10px;">${svgIcon('moon')} MERCANTE DI LUNE</h2>
        <p class="text-muted" style="margin-bottom:10px;">Il Mercante di Lune è un servizio speciale, sempre disponibile anche negli universi con <strong>BOT pacifici</strong> o senza BOT. Non è un attacco ostile automatico: parte <strong>solo dopo la tua conferma</strong>.</p>
        <p style="margin-bottom:10px;">Un attacco orbitale simulato, con forza schiacciante, distrugge <strong>tutte le navi stazionate</strong> sul pianeta selezionato. <strong>Difese, edifici e pianeta non subiscono danni</strong>. Le flotte in viaggio non vengono coinvolte.</p>
        <p style="margin-bottom:10px;">Il compenso è <strong>1.000.000 di Deuterio</strong> prelevato dal pianeta scelto, anche se la Luna non si forma. Ogni <strong>100.000 unità di detriti teorici</strong> (30% del metallo e del cristallo delle navi distrutte) forniscono <strong>1%</strong> di probabilità, fino al <strong>20%</strong>. Il Mercante recupera tutti i detriti: non compare nessun campo riciclabile.</p>
        <p class="text-muted" style="margin-bottom:12px;">La missione viene risolta immediatamente, senza generare un raid BOT PvP e senza dipendere dalla modalità pacifica.</p>
        <div class="form-group" style="margin-bottom:12px;">
          <label for="moon-merchant-planet">Pianeta sul quale tentare di creare la Luna</label>
          <select id="moon-merchant-planet" class="form-control">
            ${ownedPlanets.map((p, i) => `<option value="${i}" ${i === Math.max(0,initialIndex) ? 'selected' : ''}>${escapeHTML(p.name || 'Pianeta')} [${Number(p.coords.g)}:${Number(p.coords.s)}:${Number(p.coords.p)}]${p.moon ? ' — LUNA PRESENTE' : ''}</option>`).join('')}
          </select>
        </div>
        <div id="moon-merchant-status" aria-live="polite" style="margin-bottom:12px;"></div>
        <button type="button" id="btn-moon-merchant" class="btn btn-blue" style="width:100%;" disabled>${svgIcon('moon')} INGAGGIA IL MERCANTE · 1.000.000 D</button>
      </section>` : '';

    const activateMerchant = () => {
      const selector = viewport.querySelector('#moon-merchant-planet');
      const status = viewport.querySelector('#moon-merchant-status');
      const button = viewport.querySelector('#btn-moon-merchant');
      if (!selector || !status || !button || !moonMerchant) return;
      let busy = false;
      const selected = () => ownedPlanets[Number(selector.value)];
      const renderEstimate = () => {
        const planet = selected();
        const check = moonMerchant.inspect(planet);
        const canHire = Boolean(planet && check.available);
        button.disabled = busy || !canHire;
        status.innerHTML = `
          <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; margin-bottom:10px;">
            <div><small class="text-muted">Navi da sacrificare</small><br><strong>${formatNum(check.ships)}</strong></div>
            <div><small class="text-muted">Detriti teorici</small><br><strong>${formatNum(check.debris)}</strong></div>
            <div><small class="text-muted">Probabilità Luna</small><br><strong>${check.chance}%</strong></div>
            <div><small class="text-muted">Deuterio disponibile</small><br><strong>${formatNum(planet?.resources?.deuterium || 0)}</strong></div>
          </div>
          ${check.reason ? `<p style="color:var(--btn-gold);">${escapeHTML(check.reason)}</p>` : '<p style="color:var(--btn-green);">Missione pronta. Le difese resteranno intatte.</p>'}`;
        return check;
      };
      selector.addEventListener('change', renderEstimate);
      renderEstimate();
      button.addEventListener('click', async () => {
        if (UI.blockPendingMutation(uni)) return;
        if (busy) return;
        const planet = selected();
        if (!planet) return;
        // Rileggi il pianeta prima del pagamento, non affidarti al riepilogo mostrato.
        const check = moonMerchant.inspect(planet);
        if (!check.available) { renderEstimate(); UI.toast(check.reason, 'error'); return; }
        if (!window.confirm(`MERCANTE DI LUNE — ${planet.name} [${planet.coords.g}:${planet.coords.s}:${planet.coords.p}]\n\nPerderai ${formatNum(check.ships)} navi stazionate e 1.000.000 Deuterio, anche se il tentativo fallisce.\nProbabilità di Luna: ${check.chance}%.\nDifese ed edifici non saranno colpiti. Nessun detrito resterà sul pianeta.\n\nConfermi il lancio dell'attacco orbitale?`)) return;
        busy = true;
        button.disabled = true;
        selector.disabled = true;
        try {
          let result;
          if (st.isMultiplayerMode) {
            // Prima consolidiamo le risorse e la flotta locale. La transazione online
            // è poi l'unica a sottrarre tariffa e navi (anche se altri client sono attivi).
            await UI.persistUniverseState();
            if (UI.state.currentUniverse!==uni || UI.blockPendingMutation(uni)) return;
            result = await window.UniversumMP.hireOnlineMoonMerchant(uni, planet.coords);
            if (UI.state.currentUniverse!==uni || UI.blockPendingMutation(uni)) return;
            await window.UniversumMP.syncPlayerState(uni, { force: true });
            if (UI.state.currentUniverse!==uni || UI.blockPendingMutation(uni)) return;
            if (result.success) {
              planet.moon = moonMerchant.createMoonData();
              const key = `${planet.coords.g}:${planet.coords.s}:${planet.coords.p}`;
              uni.galaxyDeltas = uni.galaxyDeltas || {};
              uni.galaxyDeltas[key] = { ...(uni.galaxyDeltas[key] || {}), hasMoon: true, hasBacino: false, moonName: 'Luna' };
            }
          } else {
            result = moonMerchant.applyOffline(uni, uni.planets.indexOf(planet));
            await UI.persistUniverseState();
          }
          UI.refreshPlanetSelector();
          UI.updateTopBarNumbers();
          UI.renderCurrentView();
          UI.toast(result.success ? `Luna formata su ${planet.name}! Probabilità: ${result.chance}%.` : `Attacco su ${planet.name} concluso: nessuna Luna (${result.chance}%). Il Mercante ha raccolto i detriti.`, result.success ? 'success' : 'info');
        } catch (err) {
          UI.toast(err.message || 'Operazione Mercante non riuscita.', 'error');
          busy = false;
          selector.disabled = false;
          renderEstimate();
        }
      });
    };

    if (st.isMultiplayerMode) {
      viewport.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:14px;">
          ${merchantPanel}
          <div class="glass-panel" style="padding:14px;">
            <h2 style="font-size:1.05rem; color:var(--res-crystal); margin-bottom:8px;">TRASPORTO & SCAMBIO DIRETTO PvP</h2>
            <p class="text-muted" style="margin-bottom:12px;">In modalità Multiplayer PvP puoi inviare carichi di risorse direttamente ai pianeti di altri giocatori reali o agli Avamposti Neutrali utilizzando la missione <strong>Trasporta</strong> dalla sezione Flotta.</p>
            <button type="button" id="btn-mp-goto-transport" class="btn btn-blue" style="width:100%;">${svgIcon('cargo')} PREPARA CONVOGLIO MERCANTILE</button>
            <button type="button" id="btn-mp-bot-trade" class="btn btn-green" style="width:100%; margin-top:10px;">${svgIcon('cargo')} COMMERCIA CON UN BOT PACIFICO / NEUTRALE</button>
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

      activateMerchant();
      viewport.querySelector('#btn-mp-bot-trade')?.addEventListener('click', () => UI.openOnlineBotTradeModal());
      document.getElementById('btn-mp-goto-transport')?.addEventListener('click', () => {
        st.fleetMission = 'transport';
        UI.switchView('fleet');
      });

      document.getElementById('btn-exec-blackmarket')?.addEventListener('click', async () => {
        if (UI.blockPendingMutation(uni)) return;
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
        ${merchantPanel}
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

    activateMerchant();
    document.getElementById('btn-exec-bot-trade')?.addEventListener('click', async () => {
      if (UI.blockPendingMutation(uni)) return;
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
      if (UI.blockPendingMutation(uni)) return;
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
      if (UI.blockPendingMutation(uni)) return;
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
