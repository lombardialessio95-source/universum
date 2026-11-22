/** UNIVERSUM / modules/ui/planet-canvas.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';

  const UI = window.UniversumUI;


  // =========================================================
  // CANVAS PANORAMICA — Luna + Bacino Spaziale orbitante
  // =========================================================
  UI.startPlanetCanvas = function (planet) {
    const st = UI.state;
    if (st.planetAnimId) {
      cancelAnimationFrame(st.planetAnimId);
      st.planetAnimId = null;
    }
    const canvas = document.getElementById('overview-planet-canvas');
    if (!canvas || !planet) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = 56;

    const temp = Number(planet.maxTemp ?? 25);
    let palette = { core: '#00c853', mid: '#0277bd', dark: '#011627', atmo: 'rgba(0, 210, 255, 0.35)', rings: false };
    if (temp < -20) {
      palette = { core: '#e0f7fa', mid: '#00b0ff', dark: '#051937', atmo: 'rgba(128, 216, 255, 0.45)', rings: true };
    } else if (temp > 50) {
      palette = { core: '#ffab00', mid: '#dd2c00', dark: '#1a0500', atmo: 'rgba(255, 110, 64, 0.4)', rings: false };
    }

    let lastPlanetFrame = 0;
    function drawFrame(timestamp = 0) {
      if (!document.getElementById('overview-planet-canvas')) return;
      st.planetAnimId = requestAnimationFrame(drawFrame);
      if (document.hidden || timestamp - lastPlanetFrame < 1000 / 24) return;
      lastPlanetFrame = timestamp;
      st.planetAnimAngle += 0.02;
      ctx.clearRect(0, 0, w, h);

      const halo = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, radius * 1.45);
      halo.addColorStop(0, palette.atmo);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.45, 0, Math.PI * 2);
      ctx.fill();

      if (palette.rings || planet.fieldsMax >= 250) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.32);
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.35)';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 1.65, radius * 0.42, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const grad = ctx.createRadialGradient(cx - radius * 0.38, cy - radius * 0.35, radius * 0.1, cx, cy, radius);
      grad.addColorStop(0, palette.core);
      grad.addColorStop(0.55, palette.mid);
      grad.addColorStop(1, palette.dark);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = grad;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

      const drift = Math.sin(st.planetAnimAngle) * 18;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.ellipse(cx + drift, cy - 18, 44, 8, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - drift * 0.8, cy + 16, 38, 6, -0.1, 0, Math.PI * 2);
      ctx.fill();

      const shadowGrad = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy + radius * 0.4);
      shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
      shadowGrad.addColorStop(0.65, 'rgba(2,2,10,0.35)');
      shadowGrad.addColorStop(1, 'rgba(2,2,10,0.88)');
      ctx.fillStyle = shadowGrad;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      ctx.restore();

      if (palette.rings || planet.fieldsMax >= 250) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.32);
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.55)';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 1.65, radius * 0.42, 0, 0, Math.PI);
        ctx.stroke();
        ctx.restore();
      }

      // === M1: Satellite orbitante — Luna oppure Bacino Spaziale attivo ===
      if (planet.moon) {
        const mx = cx + Math.cos(st.planetAnimAngle * 1.8) * (radius + 26);
        const my = cy + Math.sin(st.planetAnimAngle * 1.8) * 18;
        const mGrad = ctx.createRadialGradient(mx - 3, my - 3, 2, mx, my, 11);
        mGrad.addColorStop(0, '#eceff1');
        mGrad.addColorStop(1, '#37474f');
        ctx.fillStyle = mGrad;
        ctx.beginPath();
        ctx.arc(mx, my, 11, 0, Math.PI * 2);
        ctx.fill();
      } else if (planet.bacinoSpaziale && planet.bacinoSpaziale.status === 'active') {
        // Bacino Spaziale orbitante: orbita più lenta e più ampia della luna
        const bx = cx + Math.cos(st.planetAnimAngle * 1.2) * (radius + 32);
        const by = cy + Math.sin(st.planetAnimAngle * 1.2) * 20;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(-0.32);

        // Anello orbitale del bacino
        ctx.strokeStyle = 'rgba(0, 230, 118, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 4.8, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Bracci di attracco
        ctx.strokeStyle = '#90a4ae';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-10, 0); ctx.lineTo(-3, 0);
        ctx.moveTo(3, 0); ctx.lineTo(10, 0);
        ctx.stroke();

        // Hub centrale
        const hubGrad = ctx.createRadialGradient(-1, -1, 0.5, 0, 0, 5);
        hubGrad.addColorStop(0, '#b9f6ca');
        hubGrad.addColorStop(0.6, '#00e676');
        hubGrad.addColorStop(1, '#004d40');
        ctx.fillStyle = hubGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Alone verde del bacino attivo
        ctx.shadowColor = '#00e676';
        ctx.shadowBlur = 9;
        ctx.strokeStyle = 'rgba(0, 230, 118, 0.75)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

    }

    st.planetAnimId = requestAnimationFrame(drawFrame);
  };


  UI.refreshPlanetSelector = function () {
    const select = document.getElementById('active-planet-select');
    const uni = UI.state.currentUniverse;
    if (!select || !uni) return;
    const activeIdx = UI.getActivePlanetIndex();
    select.innerHTML = uni.planets.map((p, idx) =>
      `<option value="${p.id}" ${idx === activeIdx ? 'selected' : ''}>${UI.escapeHTML(p.name)} [${p.coords.g}:${p.coords.s}:${p.coords.p}]${p.moon ? ' [LUNA]' : ''}</option>`
    ).join('');
  };


  UI.updateTopBarNumbers = function () {
    const st = UI.state;
    const uni = st.currentUniverse;
    if (!uni) return;
    const planet = UI.getActivePlanet();
    if (!planet) return;

    const prod = window.UniversumEngine.getPlanetProduction(planet, uni);
    const mEl = document.getElementById('res-metal-val');
    const cEl = document.getElementById('res-crystal-val');
    const dEl = document.getElementById('res-deuterium-val');
    const eEl = document.getElementById('res-energy-val');

    if (uni.creativeMode && !st.isMultiplayerMode) {
      if (mEl) mEl.textContent = '∞';
      if (cEl) cEl.textContent = '∞';
      if (dEl) dEl.textContent = '∞';
      if (eEl) eEl.textContent = '∞';
    } else {
      if (mEl) mEl.textContent = UI.formatNum(planet.resources.metal);
      if (cEl) cEl.textContent = UI.formatNum(planet.resources.crystal);
      if (dEl) dEl.textContent = UI.formatNum(planet.resources.deuterium);
      if (eEl) {
        eEl.textContent = `${UI.formatNum(prod.energyBalance)} / ${UI.formatNum(prod.energyProduced)}`;
        eEl.style.color = prod.energyBalance < 0 ? 'var(--btn-red)' : 'var(--res-energy)';
      }
    }

    const turboBtn = document.getElementById('btn-turbo-toggle');
    if (turboBtn) {
      turboBtn.classList.toggle('hidden', st.isMultiplayerMode);
      const remTurbo = Math.max(0, Math.ceil(((uni.turboUntil || 0) - Date.now()) / 1000));
      if (remTurbo > 0) {
        turboBtn.classList.add('active');
        turboBtn.innerHTML = `${UI.svgIcon('bolt')} ${UI.formatDuration(remTurbo)}`;
      } else {
        turboBtn.classList.remove('active');
        turboBtn.innerHTML = `${UI.svgIcon('bolt')} TURBO`;
      }
    }
  };
})();
