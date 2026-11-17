/**
 * UNIVERSUM — Motore Grafico Procedurale Sci-Fi (Core, Helper, Risorse & SVG)
 */
(function () {
  'use strict';

  const SIZE = 128;
  const cache = {};
  const ALL_RENDERERS = {};

  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = SIZE;
  offscreenCanvas.height = SIZE;
  const ctx = offscreenCanvas.getContext('2d');

  // =========================================================
  // HELPER DI RENDERING SCI-FI
  // =========================================================

  function _hexToRgba(hex, alpha) {
    if (!hex || !hex.startsWith('#')) return `rgba(0, 210, 255, ${alpha})`;
    const clean = hex.replace('#', '');
    const full = clean.length === 3
      ? clean.split('').map((ch) => ch + ch).join('')
      : clean;
    const num = parseInt(full, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function _drawCardBg(c, accentColor = '#00d2ff') {
    c.save();
    c.clearRect(0, 0, SIZE, SIZE);

    c.fillStyle = '#050814';
    c.fillRect(0, 0, SIZE, SIZE);

    const neb = c.createRadialGradient(SIZE * 0.5, SIZE * 0.5, 6, SIZE * 0.5, SIZE * 0.5, SIZE * 0.65);
    neb.addColorStop(0, _hexToRgba(accentColor, 0.24));
    neb.addColorStop(0.6, _hexToRgba(accentColor, 0.06));
    neb.addColorStop(1, 'rgba(5, 8, 20, 0)');
    c.fillStyle = neb;
    c.fillRect(0, 0, SIZE, SIZE);

    c.fillStyle = '#ffffff';
    const stars = [
      [14, 18, 0.7, 0.5], [110, 22, 0.9, 0.7], [24, 106, 0.8, 0.4],
      [104, 98, 0.6, 0.6], [64, 12, 0.7, 0.35], [18, 62, 0.5, 0.45],
      [114, 58, 0.7, 0.5], [48, 114, 0.6, 0.4], [88, 16, 0.5, 0.5]
    ];
    for (const [sx, sy, sr, sa] of stars) {
      c.globalAlpha = sa;
      c.beginPath();
      c.arc(sx, sy, sr, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    c.strokeStyle = _hexToRgba(accentColor, 0.12);
    c.lineWidth = 0.75;
    c.beginPath();
    c.moveTo(0, 32); c.lineTo(SIZE, 32);
    c.moveTo(0, 96); c.lineTo(SIZE, 96);
    c.moveTo(32, 0); c.lineTo(32, SIZE);
    c.moveTo(96, 0); c.lineTo(96, SIZE);
    c.stroke();

    c.strokeStyle = _hexToRgba(accentColor, 0.42);
    c.lineWidth = 1.2;
    const m = 6;
    const len = 10;
    c.beginPath();
    c.moveTo(m, m + len); c.lineTo(m, m); c.lineTo(m + len, m);
    c.moveTo(SIZE - m - len, m); c.lineTo(SIZE - m, m); c.lineTo(SIZE - m, m + len);
    c.moveTo(m, SIZE - m - len); c.lineTo(m, SIZE - m); c.lineTo(m + len, SIZE - m);
    c.moveTo(SIZE - m - len, SIZE - m); c.lineTo(SIZE - m, SIZE - m); c.lineTo(SIZE - m, SIZE - m - len);
    c.stroke();

    c.restore();
  }

  function _drawMetallicHull(c, pathFn, baseColor = '#37474f', lightColor = '#cfd8dc', strokeColor = '#00d2ff') {
    c.save();
    c.beginPath();
    pathFn(c);
    c.closePath();

    const grad = c.createLinearGradient(20, 18, 108, 110);
    grad.addColorStop(0, lightColor);
    grad.addColorStop(0.45, baseColor);
    grad.addColorStop(1, '#0d1322');

    c.fillStyle = grad;
    c.fill();

    c.lineWidth = 1.4;
    c.strokeStyle = strokeColor;
    c.stroke();
    c.restore();
  }

  function _drawEngineGlow(c, x, y, radius, color = '#00d2ff', trailAngle = null, trailLength = 0) {
    c.save();
    if (trailAngle !== null && trailLength > 0) {
      c.translate(x, y);
      c.rotate(trailAngle);
      const tGrad = c.createLinearGradient(0, 0, trailLength, 0);
      tGrad.addColorStop(0, '#ffffff');
      tGrad.addColorStop(0.25, color);
      tGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      c.fillStyle = tGrad;
      c.beginPath();
      c.moveTo(0, -radius * 0.7);
      c.lineTo(trailLength, 0);
      c.lineTo(0, radius * 0.7);
      c.closePath();
      c.fill();
      c.setTransform(1, 0, 0, 1, 0, 0);
    }

    const glow = c.createRadialGradient(x, y, 0.5, x, y, radius);
    glow.addColorStop(0, '#ffffff');
    glow.addColorStop(0.35, color);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = glow;
    c.beginPath();
    c.arc(x, y, radius, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function _drawPanelLines(c, lines, color = 'rgba(255,255,255,0.18)') {
    c.save();
    c.strokeStyle = color;
    c.lineWidth = 1;
    c.beginPath();
    for (const [x1, y1, x2, y2] of lines) {
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
    }
    c.stroke();
    c.restore();
  }

  function _drawPlanetarySurface(c, groundColor = '#141d2e', horizonColor = '#00d2ff') {
    c.save();
    const gGrad = c.createLinearGradient(0, 88, 0, 128);
    gGrad.addColorStop(0, groundColor);
    gGrad.addColorStop(1, '#04060d');
    c.fillStyle = gGrad;
    c.beginPath();
    c.moveTo(0, 94);
    c.quadraticCurveTo(64, 86, 128, 94);
    c.lineTo(128, 128);
    c.lineTo(0, 128);
    c.closePath();
    c.fill();

    c.strokeStyle = horizonColor;
    c.globalAlpha = 0.45;
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(0, 94);
    c.quadraticCurveTo(64, 86, 128, 94);
    c.stroke();
    c.restore();
  }

  function _drawLunarSurface(c, accent = '#b0bec5') {
    c.save();
    const lGrad = c.createLinearGradient(0, 86, 0, 128);
    lGrad.addColorStop(0, '#37474f');
    lGrad.addColorStop(1, '#10161c');
    c.fillStyle = lGrad;
    c.beginPath();
    c.moveTo(0, 92);
    c.quadraticCurveTo(64, 84, 128, 92);
    c.lineTo(128, 128);
    c.lineTo(0, 128);
    c.closePath();
    c.fill();

    const craters = [[26, 106, 12, 4], [96, 108, 15, 5], [64, 115, 10, 3]];
    for (const [cx, cy, rx, ry] of craters) {
      c.fillStyle = '#182026';
      c.strokeStyle = 'rgba(207, 216, 220, 0.25)';
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }

    c.strokeStyle = accent;
    c.globalAlpha = 0.4;
    c.lineWidth = 1.1;
    c.beginPath();
    c.moveTo(0, 92);
    c.quadraticCurveTo(64, 84, 128, 92);
    c.stroke();
    c.restore();
  }

  function _drawBlueprintBg(c, lineColor = '#00d2ff') {
    c.save();
    c.clearRect(0, 0, 128, 128);

    const bg = c.createRadialGradient(64, 64, 8, 64, 64, 88);
    bg.addColorStop(0, '#071d3d');
    bg.addColorStop(1, '#020917');
    c.fillStyle = bg;
    c.fillRect(0, 0, 128, 128);

    c.strokeStyle = 'rgba(0, 210, 255, 0.13)';
    c.lineWidth = 0.7;
    for (let i = 16; i < 128; i += 16) {
      c.beginPath();
      c.moveTo(i, 0); c.lineTo(i, 128);
      c.moveTo(0, i); c.lineTo(128, i);
      c.stroke();
    }

    c.strokeStyle = 'rgba(0, 229, 255, 0.28)';
    c.setLineDash([4, 4]);
    c.lineWidth = 1;
    c.beginPath();
    c.arc(64, 64, 46, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);

    c.strokeStyle = lineColor;
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(6, 16); c.lineTo(6, 6); c.lineTo(16, 6);
    c.moveTo(112, 6); c.lineTo(122, 6); c.lineTo(122, 16);
    c.moveTo(6, 112); c.lineTo(6, 122); c.lineTo(16, 122);
    c.moveTo(112, 122); c.lineTo(122, 122); c.lineTo(122, 112);
    c.stroke();
    c.restore();
  }

  function _renderFallbackEmblem(c) {
    _drawCardBg(c, '#00d2ff');
    _drawMetallicHull(c, (p) => {
      const cx = 64, cy = 64, r = 34;
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) p.moveTo(x, y);
        else p.lineTo(x, y);
      }
    }, '#1c283d', '#90a4ae', '#00d2ff');
    _drawEngineGlow(c, 64, 64, 14, '#00d2ff');
  }

  // =========================================================
  // ICONE RISORSE 32x32 PX & ICONE VETTORIALI HUD
  // =========================================================
  const resourceCache = {};
  const resCanvas = document.createElement('canvas');
  resCanvas.width = 32;
  resCanvas.height = 32;
  const rCtx = resCanvas.getContext('2d');

  function _renderResource32(type) {
    rCtx.clearRect(0, 0, 32, 32);

    if (type === 'metal') {
      const g = rCtx.createLinearGradient(4, 6, 28, 26);
      g.addColorStop(0, '#b9f6ca');
      g.addColorStop(0.5, '#00e676');
      g.addColorStop(1, '#004d40');
      rCtx.fillStyle = g;
      rCtx.strokeStyle = '#00e676';
      rCtx.lineWidth = 1.5;
      rCtx.beginPath();
      rCtx.moveTo(8, 9);
      rCtx.lineTo(24, 9);
      rCtx.lineTo(28, 23);
      rCtx.lineTo(4, 23);
      rCtx.closePath();
      rCtx.fill();
      rCtx.stroke();

      rCtx.strokeStyle = 'rgba(255,255,255,0.65)';
      rCtx.lineWidth = 1;
      rCtx.beginPath();
      rCtx.moveTo(10, 13);
      rCtx.lineTo(22, 13);
      rCtx.stroke();
    } else if (type === 'crystal') {
      const g = rCtx.createLinearGradient(8, 3, 24, 29);
      g.addColorStop(0, '#e0f7fa');
      g.addColorStop(0.5, '#00d2ff');
      g.addColorStop(1, '#01579b');
      rCtx.fillStyle = g;
      rCtx.strokeStyle = '#84ffff';
      rCtx.lineWidth = 1.4;
      rCtx.beginPath();
      rCtx.moveTo(16, 3);
      rCtx.lineTo(26, 12);
      rCtx.lineTo(22, 28);
      rCtx.lineTo(10, 28);
      rCtx.lineTo(6, 12);
      rCtx.closePath();
      rCtx.fill();
      rCtx.stroke();

      rCtx.strokeStyle = 'rgba(255,255,255,0.5)';
      rCtx.lineWidth = 1;
      rCtx.beginPath();
      rCtx.moveTo(16, 3); rCtx.lineTo(16, 28);
      rCtx.moveTo(6, 12); rCtx.lineTo(26, 12);
      rCtx.stroke();
    } else if (type === 'deuterium') {
      const g = rCtx.createRadialGradient(14, 14, 2, 16, 16, 13);
      g.addColorStop(0, '#ffe0b2');
      g.addColorStop(0.55, '#ff9100');
      g.addColorStop(1, '#bf360c');
      rCtx.fillStyle = g;
      rCtx.strokeStyle = '#ffab40';
      rCtx.lineWidth = 1.5;
      rCtx.beginPath();
      rCtx.roundRect(9, 4, 14, 24, 7);
      rCtx.fill();
      rCtx.stroke();

      rCtx.strokeStyle = '#ffffff';
      rCtx.lineWidth = 1.2;
      rCtx.beginPath();
      rCtx.moveTo(9, 11); rCtx.lineTo(23, 11);
      rCtx.moveTo(9, 21); rCtx.lineTo(23, 21);
      rCtx.stroke();
    } else {
      rCtx.save();
      rCtx.shadowColor = '#ffea00';
      rCtx.shadowBlur = 6;
      rCtx.fillStyle = '#ffea00';
      rCtx.strokeStyle = '#ffffff';
      rCtx.lineWidth = 1;
      rCtx.beginPath();
      rCtx.moveTo(18, 3);
      rCtx.lineTo(8, 17);
      rCtx.lineTo(15, 17);
      rCtx.lineTo(13, 29);
      rCtx.lineTo(24, 14);
      rCtx.lineTo(17, 14);
      rCtx.closePath();
      rCtx.fill();
      rCtx.stroke();
      rCtx.restore();
    }

    return resCanvas.toDataURL('image/png');
  }

  const SVG_ICONS = {
    bolt: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z"/></svg>',
    radar: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 12l6-6"/></svg>',
    edit: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    alert: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;margin-right:4px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>',
    rocket: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    sword: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/></svg>',
    hull: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><polygon points="12 2 21 7 21 17 12 22 3 17 3 7 12 2"/></svg>',
    cargo: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    eye: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    globe: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    moon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    recycle: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
    handshake: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M17 11l-5-5-5 5"/><path d="M17 18l-5-5-5 5"/></svg>',
    chat: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg>',
    save: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>',
    home: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>'
  };

  // =========================================================
  // API PUBBLICA UNIFICATA: window.UniversumGraphics
  // =========================================================
  window.UniversumGraphics = {
    registerRenderers(map) {
      Object.assign(ALL_RENDERERS, map);
    },

    helpers: {
      drawCardBg: _drawCardBg,
      drawMetallicHull: _drawMetallicHull,
      drawEngineGlow: _drawEngineGlow,
      drawPanelLines: _drawPanelLines,
      drawPlanetarySurface: _drawPlanetarySurface,
      drawLunarSurface: _drawLunarSurface,
      drawBlueprintBg: _drawBlueprintBg
    },

    getIconDataURL(id) {
      if (cache[id]) return cache[id];
      const renderer = ALL_RENDERERS[id];
      if (typeof renderer === 'function') {
        renderer(ctx);
      } else {
        _renderFallbackEmblem(ctx);
      }
      const dataURL = offscreenCanvas.toDataURL('image/png');
      cache[id] = dataURL;
      return dataURL;
    },

    // Alias compatibile con ui.js
    getArt(id) {
      return this.getIconDataURL(id);
    },

    getImgTag(id, alt = '', cssClass = 'unit-art') {
      const safeAlt = String(alt || id)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<img src="${this.getIconDataURL(id)}" alt="${safeAlt}" class="${cssClass}" loading="lazy">`;
    },

    // Restituisce il dataURL 32x32
    getResourceDataURL(type) {
      const key = String(type || 'metal').toLowerCase();
      if (!resourceCache[key]) {
        resourceCache[key] = _renderResource32(key);
      }
      return resourceCache[key];
    },

    // Restituisce il tag <img> 32x32 completo (usato da ui.js)
    getResourceIcon(type, cssClass = 'res-icon') {
      const key = String(type || 'metal').toLowerCase();
      const url = this.getResourceDataURL(key);
      return `<img src="${url}" alt="${key}" class="${cssClass}" width="18" height="18">`;
    },

    svg(name) {
      return SVG_ICONS[name] || '';
    },

    clearCache() {
      for (const key of Object.keys(cache)) {
        delete cache[key];
      }
    }
  };
})();
