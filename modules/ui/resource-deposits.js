/** UNIVERSUM — dettagli depositi nella barra risorse (solo interfaccia).
 * Riusa le statistiche gia' calcolate da UniversumEngine.getPlanetProduction().
 * Nessun nuovo timer, chiamata remota o modifica allo stato di gioco.
 */
(function () {
  'use strict';

  const UI = window.UniversumUI;
  const TYPES = Object.freeze({
    metal: { name: 'Metallo', rate: 'metalPerHour' },
    crystal: { name: 'Cristallo', rate: 'crystalPerHour' },
    deuterium: { name: 'Deuterio', rate: 'deuteriumPerHour' }
  });

  let initialized = false;
  let selected = null;
  let cached = null;
  let triggerByType = null;
  let panel = null;
  let positionScheduled = false;

  const fmt = (num) => UI.formatNum(num);
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el && el.textContent !== String(value)) el.textContent = String(value);
  };

  function formatPercent(percent) {
    if (!Number.isFinite(percent)) return '—';
    let value = Math.round(percent * 10) / 10;
    // Non mostrare 80% o 100% per arrotondamento prima della soglia reale.
    if (percent < 80 && value >= 80) value = 79.9;
    if (percent < 100 && value >= 100) value = 99.9;
    return `${value.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`;
  }

  function formatFillTime(hours) {
    if (!Number.isFinite(hours) || hours < 0) return '—';
    // Arrotonda al minuto successivo per non annunciare un deposito pieno troppo presto.
    const minutes = Math.ceil(hours * 60);
    if (!Number.isSafeInteger(minutes)) return '—';
    const days = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = minutes % 60;
    if (days > 0) return `${days}g ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  // Funzione pura: utile anche ai test senza DOM e indipendente dal motore economico.
  function getDepositMetrics(planet, prod, universe, type, creativeMode = false) {
    if (!TYPES[type] || !planet || !prod || !universe) return { fill: 'unknown' };
    if (creativeMode) return { fill: 'unlimited' };

    const rawAmount = planet.resources?.[type];
    const rawCapacity = prod.caps?.[type];
    const rawRate = prod[TYPES[type].rate];
    const amount = Number(rawAmount);
    const capacity = Number(rawCapacity);
    const rate = Number(rawRate);

    if (rawAmount == null || rawCapacity == null || !Number.isFinite(amount) ||
        !Number.isFinite(capacity) || capacity <= 0 || amount < 0) {
      return { fill: 'unknown' };
    }

    const percent = (amount / capacity) * 100;
    const fill = percent >= 100 ? 'full' : (percent >= 80 ? 'near' : 'normal');
    const remaining = Math.max(0, capacity - amount);
    let time = '—';
    if (fill === 'full') time = 'Deposito pieno';
    else if (rawRate != null && Number.isFinite(rate)) {
      time = rate <= 0 ? 'Riempimento non previsto' : formatFillTime(remaining / rate);
    }

    return {
      fill, amount, capacity, percent, remaining,
      rate: rawRate != null && Number.isFinite(rate) ? rate : null,
      time
    };
  }

  function updatePosition() {
    if (!selected || !panel || panel.classList.contains('hidden')) return;
    const anchor = triggerByType?.[selected];
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const windowWidth = document.documentElement.clientWidth || window.innerWidth;
    const windowHeight = window.innerHeight;
    const x = Math.max(10, Math.min(rect.left, windowWidth - width - 10));
    let y = rect.bottom + 9;
    if (y + height > windowHeight - 10) {
      const above = rect.top - height - 9;
      y = above >= 10 ? above : Math.max(10, windowHeight - height - 10);
    }
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
  }

  function updatePanel() {
    if (!selected || !panel || !cached) return;
    const { planet, uni, info } = cached;
    const metrics = info[selected] || { fill: 'unknown' };
    panel.dataset.fill = metrics.fill;
    setText('deposit-panel-title', `Deposito di ${TYPES[selected].name}`);
    setText('deposit-panel-planet', planet.name || 'Pianeta selezionato');
    const meter = document.getElementById('deposit-panel-meter');
    const fill = document.getElementById('deposit-panel-meter-fill');
    const note = document.getElementById('deposit-panel-note');

    if (metrics.fill === 'unlimited') {
      setText('deposit-panel-quantity', '∞ / ∞');
      setText('deposit-panel-percent', 'Illimitato');
      setText('deposit-panel-space', 'Illimitato');
      setText('deposit-panel-production', 'Illimitata');
      setText('deposit-panel-time', 'Non applicabile');
      if (note) note.textContent = 'In modalità Creativa le risorse non sono soggette ai normali limiti dei depositi.';
      note?.classList.remove('hidden');
    } else if (metrics.fill === 'unknown') {
      setText('deposit-panel-quantity', 'Dati non disponibili');
      setText('deposit-panel-percent', '—');
      setText('deposit-panel-space', '—');
      setText('deposit-panel-production', '—');
      setText('deposit-panel-time', '—');
      note?.classList.add('hidden');
    } else {
      setText('deposit-panel-quantity', `${fmt(metrics.amount)} / ${fmt(metrics.capacity)}`);
      setText('deposit-panel-percent', formatPercent(metrics.percent));
      setText('deposit-panel-space', fmt(metrics.remaining));
      setText('deposit-panel-production', metrics.rate == null ? '—' :
        `${metrics.rate >= 0 ? '+' : '−'}${fmt(Math.abs(metrics.rate))}/h`);
      setText('deposit-panel-time', metrics.time);
      note?.classList.add('hidden');
    }

    const valid = !['unknown', 'unlimited'].includes(metrics.fill);
    if (meter) {
      if (valid) meter.setAttribute('aria-valuenow', String(Math.min(100, Math.max(0, Math.round(metrics.percent)))));
      else meter.removeAttribute('aria-valuenow');
      meter.setAttribute('aria-valuetext', valid ? formatPercent(metrics.percent) : 'Non applicabile');
    }
    if (fill) {
      const pct = valid ? Math.min(100, Math.max(0, metrics.percent)) : 0;
      const width = `${pct}%`;
      if (fill.style.width !== width) fill.style.width = width;
    }
  }

  function schedulePosition() {
    if (!selected || positionScheduled) return;
    positionScheduled = true;
    window.requestAnimationFrame(() => {
      positionScheduled = false;
      updatePosition();
    });
  }

  function close() {
    if (selected && triggerByType?.[selected]) {
      triggerByType[selected].setAttribute('aria-expanded', 'false');
    }
    selected = null;
    panel?.classList.add('hidden');
  }

  function open(type) {
    if (!TYPES[type] || !cached || !UI.state?.currentUniverse) return;
    if (selected === type) { close(); return; }
    close();
    selected = type;
    triggerByType[type].setAttribute('aria-expanded', 'true');
    panel.classList.remove('hidden');
    updatePanel();
    updatePosition();
  }

  function initialize() {
    if (initialized) return true;
    panel = document.getElementById('resource-deposit-panel');
    triggerByType = {};
    for (const type of Object.keys(TYPES)) {
      triggerByType[type] = document.querySelector(`.res-deposit-trigger[data-deposit="${type}"]`);
    }
    if (!panel || Object.values(triggerByType).some((el) => !el)) return false;
    initialized = true;
    for (const [type, btn] of Object.entries(triggerByType)) {
      btn.addEventListener('click', () => open(type));
    }
    document.getElementById('deposit-panel-close')?.addEventListener('click', () => close());
    document.addEventListener('pointerdown', (event) => {
      if (selected && !panel.contains(event.target) &&
          !triggerByType[selected].contains(event.target)) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && selected) {
        const btn = triggerByType[selected];
        close();
        btn.focus();
      }
    });
    window.addEventListener('resize', schedulePosition, { passive: true });
    window.addEventListener('scroll', schedulePosition, { passive: true, capture: true });
    return true;
  }

  UI.closeResourceDeposit = close;
  UI.getDepositMetrics = getDepositMetrics;
  UI.formatDepositFillTime = formatFillTime;
  UI.updateResourceDeposits = function (planet, prod, uni) {
    if (!initialize() || !planet || !prod || !uni) return;
    const creative = Boolean(uni.creativeMode && !UI.state.isMultiplayerMode);
    const info = {};
    for (const [type, def] of Object.entries(TYPES)) {
      const metrics = getDepositMetrics(planet, prod, uni, type, creative);
      info[type] = metrics;
      const btn = triggerByType[type];
      if (btn.dataset.fill !== metrics.fill) btn.dataset.fill = metrics.fill;
      const status = metrics.fill === 'full' ? 'deposito pieno' :
        metrics.fill === 'near' ? 'deposito quasi pieno' :
        metrics.fill === 'normal' ? `riempimento ${formatPercent(metrics.percent)}` :
        metrics.fill === 'unlimited' ? 'risorse illimitate' : 'stato non disponibile';
      const description = `Deposito di ${def.name}: ${status}. Apri i dettagli.`;
      if (btn.getAttribute('aria-label') !== description) btn.setAttribute('aria-label', description);
    }
    const changedPlanet = cached?.planet?.id !== planet.id || cached?.uni !== uni;
    cached = { planet, uni, info };
    if (selected) {
      updatePanel();
      // Evita layout/reflow ogni secondo. Riposiziona solo al cambio pianeta.
      if (changedPlanet) updatePosition();
    }
  };
})();
