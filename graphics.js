/**
 * UNIVERSUM — Motore Grafico Procedurale Sci-Fi (HTML5 Canvas 128x128)
 * Completo: Navi, Difese, Edifici Planetari, Strutture Lunari, Ricerche, Risorse e Icone SVG
 */
(function () {
  'use strict';

  const SIZE = 128;
  const cache = {};

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

  // =========================================================
  // RENDERERS: 14 NAVI
  // =========================================================
  const SHIP_RENDERERS = {
    smallCargo(c) {
      _drawCardBg(c, '#00d2ff');
      _drawEngineGlow(c, 26, 52, 11, '#00d2ff', Math.PI, 20);
      _drawEngineGlow(c, 26, 76, 11, '#00d2ff', Math.PI, 20);

      _drawMetallicHull(c, (p) => {
        p.moveTo(32, 48); p.lineTo(22, 34); p.lineTo(48, 44);
        p.moveTo(32, 80); p.lineTo(22, 94); p.lineTo(48, 84);
      }, '#263238', '#78909c', '#00d2ff');

      _drawMetallicHull(c, (p) => {
        p.moveTo(30, 46);
        p.lineTo(66, 42);
        p.lineTo(98, 48);
        p.lineTo(106, 64);
        p.lineTo(98, 80);
        p.lineTo(66, 86);
        p.lineTo(30, 82);
        p.lineTo(26, 64);
      }, '#455a64', '#eceff1', '#00d2ff');

      c.fillStyle = 'rgba(0, 210, 255, 0.22)';
      c.strokeStyle = '#00d2ff';
      c.lineWidth = 1.2;
      c.fillRect(64, 48, 28, 32);
      c.strokeRect(64, 48, 28, 32);

      c.fillStyle = '#00e5ff';
      c.beginPath();
      c.moveTo(94, 56); c.lineTo(103, 64); c.lineTo(94, 72);
      c.closePath();
      c.fill();

      _drawPanelLines(c, [[46, 45, 46, 83], [78, 48, 78, 80]]);
    },

    largeCargo(c) {
      _drawCardBg(c, '#ff9100');
      [42, 56, 72, 86].forEach((ey) => {
        _drawEngineGlow(c, 20, ey, 9, '#ff9100', Math.PI, 16);
      });

      _drawMetallicHull(c, (p) => {
        p.moveTo(22, 38);
        p.lineTo(94, 38);
        p.lineTo(112, 52);
        p.lineTo(112, 76);
        p.lineTo(94, 90);
        p.lineTo(22, 90);
      }, '#37474f', '#b0bec5', '#ff9100');

      const boxes = [
        [32, 43, 26, 18], [62, 43, 26, 18],
        [32, 67, 26, 18], [62, 67, 26, 18]
      ];
      for (const [bx, by, bw, bh] of boxes) {
        c.fillStyle = '#1c2638';
        c.strokeStyle = '#ffab40';
        c.lineWidth = 1.2;
        c.fillRect(bx, by, bw, bh);
        c.strokeRect(bx, by, bw, bh);
        _drawPanelLines(c, [[bx + 6, by, bx + 6, by + bh], [bx + 19, by, bx + 19, by + bh]], 'rgba(255,145,0,0.4)');
      }

      c.fillStyle = '#ff9100';
      c.fillRect(98, 54, 8, 20);
    },

    lightFighter(c) {
      _drawCardBg(c, '#00d2ff');
      _drawEngineGlow(c, 28, 64, 15, '#00d2ff', Math.PI, 24);

      _drawMetallicHull(c, (p) => {
        p.moveTo(32, 64);
        p.lineTo(24, 22);
        p.lineTo(68, 52);
        p.lineTo(112, 64);
        p.lineTo(68, 76);
        p.lineTo(24, 106);
      }, '#2c3e50', '#e0f7fa', '#00d2ff');

      _drawMetallicHull(c, (p) => {
        p.moveTo(30, 56);
        p.lineTo(114, 64);
        p.lineTo(30, 72);
      }, '#455a64', '#ffffff', '#00e5ff');

      c.fillStyle = '#00e5ff';
      c.beginPath();
      c.ellipse(66, 64, 12, 4, 0, 0, Math.PI * 2);
      c.fill();

      _drawPanelLines(c, [[44, 36, 78, 36], [44, 92, 78, 92]], '#00d2ff');
    },

    heavyFighter(c) {
      _drawCardBg(c, '#ff1744');
      _drawEngineGlow(c, 26, 46, 12, '#ff1744', Math.PI, 20);
      _drawEngineGlow(c, 26, 82, 12, '#ff1744', Math.PI, 20);

      _drawMetallicHull(c, (p) => {
        p.moveTo(34, 30);
        p.lineTo(58, 22);
        p.lineTo(84, 46);
        p.lineTo(84, 82);
        p.lineTo(58, 106);
        p.lineTo(34, 98);
      }, '#263238', '#90a4ae', '#ff5252');

      _drawMetallicHull(c, (p) => {
        p.moveTo(26, 40); p.lineTo(104, 48); p.lineTo(96, 56); p.lineTo(26, 54);
        p.moveTo(26, 74); p.lineTo(96, 72); p.lineTo(104, 80); p.lineTo(26, 88);
      }, '#37474f', '#eceff1', '#ff1744');

      _drawMetallicHull(c, (p) => {
        p.moveTo(42, 52); p.lineTo(82, 58); p.lineTo(82, 70); p.lineTo(42, 76);
      }, '#1c2536', '#cfd8dc', '#ff1744');

      c.fillStyle = '#ff1744';
      c.fillRect(62, 60, 14, 8);

      _drawEngineGlow(c, 105, 48, 5, '#ff1744');
      _drawEngineGlow(c, 105, 80, 5, '#ff1744');
    },

    cruiser(c) {
      _drawCardBg(c, '#00e5ff');
      _drawEngineGlow(c, 18, 56, 12, '#00e5ff', Math.PI, 16);
      _drawEngineGlow(c, 18, 72, 12, '#00e5ff', Math.PI, 16);

      _drawMetallicHull(c, (p) => {
        p.moveTo(18, 50);
        p.lineTo(54, 42);
        p.lineTo(116, 58);
        p.lineTo(116, 70);
        p.lineTo(54, 86);
        p.lineTo(18, 78);
      }, '#2c3e50', '#cfd8dc', '#00e5ff');

      _drawMetallicHull(c, (p) => {
        p.moveTo(32, 46); p.lineTo(22, 30); p.lineTo(62, 44);
        p.moveTo(32, 82); p.lineTo(22, 98); p.lineTo(62, 84);
      }, '#1c2833', '#90a4ae', '#00d2ff');

      [54, 74, 92].forEach((tx) => {
        c.fillStyle = '#eceff1';
        c.beginPath();
        c.arc(tx, 64, 4.2, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#00e5ff';
        c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(tx + 2, 62.5); c.lineTo(tx + 10, 62.5);
        c.moveTo(tx + 2, 65.5); c.lineTo(tx + 10, 65.5);
        c.stroke();
      });
    },

    battleship(c) {
      _drawCardBg(c, '#2979ff');
      [46, 64, 82].forEach((ey) => {
        _drawEngineGlow(c, 18, ey, 11, '#2979ff', Math.PI, 16);
      });

      _drawMetallicHull(c, (p) => {
        p.moveTo(20, 40);
        p.lineTo(74, 34);
        p.lineTo(112, 50);
        p.lineTo(112, 78);
        p.lineTo(74, 94);
        p.lineTo(20, 88);
      }, '#263238', '#b0bec5', '#448aff');

      _drawMetallicHull(c, (p) => {
        p.moveTo(42, 36); p.lineTo(48, 24); p.lineTo(82, 28); p.lineTo(86, 38);
        p.moveTo(42, 92); p.lineTo(48, 104); p.lineTo(82, 100); p.lineTo(86, 90);
      }, '#37474f', '#eceff1', '#00d2ff');

      c.fillStyle = '#102027';
      c.strokeStyle = '#448aff';
      c.lineWidth = 1.5;
      c.fillRect(46, 52, 26, 24);
      c.strokeRect(46, 52, 26, 24);

      c.fillStyle = '#00e5ff';
      c.fillRect(66, 56, 4, 16);

      _drawPanelLines(c, [[84, 42, 84, 86], [98, 48, 98, 80]]);
    },

    bomber(c) {
      _drawCardBg(c, '#d500f9');
      _drawEngineGlow(c, 24, 44, 11, '#d500f9', Math.PI, 16);
      _drawEngineGlow(c, 24, 84, 11, '#d500f9', Math.PI, 16);

      _drawMetallicHull(c, (p) => {
        p.moveTo(26, 36);
        p.quadraticCurveTo(75, 16, 108, 48);
        p.lineTo(94, 56);
        p.lineTo(94, 72);
        p.lineTo(108, 80);
        p.quadraticCurveTo(75, 112, 26, 92);
        p.quadraticCurveTo(44, 64, 26, 36);
      }, '#2c1e4a', '#cfd8dc', '#e040fb');

      [50, 64, 78].forEach((by) => {
        _drawEngineGlow(c, 74, by, 7, '#ff4081');
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(74, by, 2.2, 0, Math.PI * 2);
        c.fill();
      });
    },

    battlecruiser(c) {
      _drawCardBg(c, '#ffd700');
      [48, 59, 69, 80].forEach((ey) => {
        _drawEngineGlow(c, 18, ey, 9, '#00e5ff', Math.PI, 18);
      });

      _drawMetallicHull(c, (p) => {
        p.moveTo(20, 44);
        p.lineTo(56, 26);
        p.lineTo(116, 64);
        p.lineTo(56, 102);
        p.lineTo(20, 84);
        p.lineTo(30, 64);
      }, '#1a237e', '#eceff1', '#ffd700');

      c.strokeStyle = '#ffd700';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(36, 48); c.lineTo(96, 64); c.lineTo(36, 80);
      c.stroke();

      _drawEngineGlow(c, 64, 64, 9, '#00e5ff');
      c.fillStyle = '#ffd700';
      c.beginPath();
      c.arc(64, 64, 3.5, 0, Math.PI * 2);
      c.fill();
    },

    colonyShip(c) {
      _drawCardBg(c, '#00e676');
      _drawEngineGlow(c, 18, 52, 12, '#00e676', Math.PI, 16);
      _drawEngineGlow(c, 18, 76, 12, '#00e676', Math.PI, 16);

      _drawMetallicHull(c, (p) => {
        p.moveTo(20, 44);
        p.lineTo(44, 34);
        p.lineTo(94, 38);
        p.lineTo(112, 64);
        p.lineTo(94, 90);
        p.lineTo(44, 94);
        p.lineTo(20, 84);
      }, '#263238', '#cfd8dc', '#00e676');

      const bioGrad = c.createRadialGradient(62, 58, 4, 66, 64, 24);
      bioGrad.addColorStop(0, '#b9f6ca');
      bioGrad.addColorStop(0.5, '#00e676');
      bioGrad.addColorStop(0.85, '#0091ea');
      bioGrad.addColorStop(1, '#004d40');
      c.fillStyle = bioGrad;
      c.beginPath();
      c.arc(66, 64, 23, 0, Math.PI * 2);
      c.fill();

      c.strokeStyle = '#a7ffeb';
      c.lineWidth = 1.6;
      c.stroke();

      c.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(66, 64, 23, 9, 0, 0, Math.PI * 2);
      c.stroke();
    },

    recycler(c) {
      _drawCardBg(c, '#00e676');
      _drawEngineGlow(c, 20, 54, 10, '#ff9100', Math.PI, 14);
      _drawEngineGlow(c, 20, 74, 10, '#ff9100', Math.PI, 14);

      _drawMetallicHull(c, (p) => {
        p.moveTo(22, 44);
        p.lineTo(74, 40);
        p.lineTo(108, 34);
        p.lineTo(114, 46);
        p.lineTo(84, 52);
        p.lineTo(84, 76);
        p.lineTo(114, 82);
        p.lineTo(108, 94);
        p.lineTo(74, 88);
        p.lineTo(22, 84);
      }, '#37474f', '#b0bec5', '#00e676');

      const beam = c.createLinearGradient(84, 64, 116, 64);
      beam.addColorStop(0, 'rgba(0, 230, 118, 0.85)');
      beam.addColorStop(1, 'rgba(0, 230, 118, 0.05)');
      c.fillStyle = beam;
      c.beginPath();
      c.moveTo(84, 54);
      c.lineTo(116, 46);
      c.lineTo(116, 82);
      c.lineTo(84, 74);
      c.closePath();
      c.fill();

      c.fillStyle = '#cfd8dc';
      c.fillRect(98, 58, 5, 4);
      c.fillRect(105, 67, 4, 5);
    },

    espionageProbe(c) {
      _drawCardBg(c, '#ff1744');
      _drawEngineGlow(c, 26, 64, 10, '#00d2ff', Math.PI, 16);

      c.strokeStyle = '#90a4ae';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(64, 42); c.lineTo(94, 24);
      c.moveTo(64, 86); c.lineTo(94, 104);
      c.moveTo(84, 64); c.lineTo(114, 64);
      c.stroke();

      _drawMetallicHull(c, (p) => {
        const cx = 64, cy = 64, r = 24;
        for (let i = 0; i < 6; i++) {
          const ang = (Math.PI / 3) * i;
          const x = cx + Math.cos(ang) * r;
          const y = cy + Math.sin(ang) * r;
          if (i === 0) p.moveTo(x, y);
          else p.lineTo(x, y);
        }
      }, '#10141f', '#455a64', '#ff1744');

      _drawEngineGlow(c, 68, 64, 13, '#ff1744');
      c.fillStyle = '#ff5252';
      c.beginPath();
      c.arc(68, 64, 6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(66, 62, 2, 0, Math.PI * 2);
      c.fill();
    },

    solarSatellite(c) {
      _drawCardBg(c, '#ffea00');

      const drawSolarWing = (x, y, w, h) => {
        const pGrad = c.createLinearGradient(x, y, x + w, y + h);
        pGrad.addColorStop(0, '#0288d1');
        pGrad.addColorStop(0.5, '#01579b');
        pGrad.addColorStop(1, '#002f6c');
        c.fillStyle = pGrad;
        c.strokeStyle = '#40c4ff';
        c.lineWidth = 1.3;
        c.fillRect(x, y, w, h);
        c.strokeRect(x, y, w, h);

        _drawPanelLines(c, [
          [x + w * 0.33, y, x + w * 0.33, y + h],
          [x + w * 0.66, y, x + w * 0.66, y + h],
          [x, y + h * 0.5, x + w, y + h * 0.5]
        ], 'rgba(128, 216, 255, 0.45)');
      };

      drawSolarWing(12, 46, 38, 36);
      drawSolarWing(78, 46, 38, 36);

      c.fillStyle = '#90a4ae';
      c.fillRect(50, 61, 28, 6);

      _drawMetallicHull(c, (p) => {
        p.arc(64, 64, 14, 0, Math.PI * 2);
      }, '#37474f', '#eceff1', '#ffea00');

      _drawEngineGlow(c, 64, 64, 9, '#ffea00');
    },

    mothership(c) {
      _drawCardBg(c, '#ffd700');
      [38, 52, 76, 90].forEach((ey) => {
        _drawEngineGlow(c, 14, ey, 11, '#00d2ff', Math.PI, 14);
      });

      _drawMetallicHull(c, (p) => {
        p.moveTo(16, 32);
        p.lineTo(68, 22);
        p.lineTo(114, 42);
        p.lineTo(114, 86);
        p.lineTo(68, 106);
        p.lineTo(16, 96);
      }, '#263238', '#cfd8dc', '#ffd700');

      c.fillStyle = '#050914';
      c.strokeStyle = '#00e5ff';
      c.lineWidth = 1.5;
      c.fillRect(42, 52, 72, 24);
      c.strokeRect(42, 52, 72, 24);

      [50, 64, 78, 92, 104].forEach((lx) => {
        c.fillStyle = '#ffd700';
        c.fillRect(lx, 55, 4, 2.5);
        c.fillRect(lx, 70.5, 4, 2.5);
      });

      _drawEngineGlow(c, 46, 64, 10, '#00e5ff');
    },

    deathStar(c) {
      _drawCardBg(c, '#00e676');
      const cx = 56, cy = 66, r = 42;

      const dsGrad = c.createRadialGradient(cx - 15, cy - 15, 4, cx, cy, r);
      dsGrad.addColorStop(0, '#cfd8dc');
      dsGrad.addColorStop(0.55, '#546e7a');
      dsGrad.addColorStop(1, '#101820');

      c.fillStyle = dsGrad;
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#78909c';
      c.lineWidth = 1.5;
      c.stroke();

      c.strokeStyle = '#0b1016';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(cx - r, cy + 4);
      c.lineTo(cx + r, cy + 4);
      c.stroke();

      const dishX = cx + 14, dishY = cy - 16;
      c.fillStyle = '#263238';
      c.strokeStyle = '#00e676';
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(dishX, dishY, 13, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      c.save();
      c.shadowColor = '#00e676';
      c.shadowBlur = 12;
      c.strokeStyle = '#00e676';
      c.lineWidth = 3.5;
      c.beginPath();
      c.moveTo(dishX, dishY);
      c.lineTo(122, 16);
      c.stroke();

      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.3;
      c.beginPath();
      c.moveTo(dishX, dishY);
      c.lineTo(122, 16);
      c.stroke();
      c.restore();
    },

    destroyer(c) {
      _drawCardBg(c, '#ff1744');
      [44, 64, 84].forEach((ey) => {
        _drawEngineGlow(c, 16, ey, 11, '#ff1744', Math.PI, 18);
      });

      _drawMetallicHull(c, (p) => {
        p.moveTo(18, 36);
        p.lineTo(78, 30);
        p.lineTo(116, 52);
        p.lineTo(116, 76);
        p.lineTo(78, 98);
        p.lineTo(18, 92);
      }, '#1c2430', '#b0bec5', '#ff1744');

      c.fillStyle = '#ff1744';
      c.fillRect(62, 46, 36, 6);
      c.fillRect(62, 76, 36, 6);
    }
  };

  // =========================================================
  // RENDERERS: 10 DIFESE
  // =========================================================
  const DEFENSE_RENDERERS = {
    rocketLauncher(c) {
      _drawCardBg(c, '#ff9100');
      _drawMetallicHull(c, (p) => {
        p.moveTo(24, 106); p.lineTo(36, 86); p.lineTo(92, 86); p.lineTo(104, 106);
      }, '#263238', '#90a4ae', '#ff9100');

      c.save();
      c.translate(64, 62);
      c.rotate(-0.45);
      _drawMetallicHull(c, (p) => {
        p.rect(-24, -18, 48, 36);
      }, '#37474f', '#cfd8dc', '#ff9100');

      [-12, 0, 12].forEach((ty) => {
        c.fillStyle = '#101622';
        c.fillRect(-18, ty - 4, 36, 8);
        c.fillStyle = '#ff3d00';
        c.beginPath();
        c.arc(18, ty, 3.5, 0, Math.PI * 2);
        c.fill();
      });
      c.restore();
    },

    lightLaser(c) {
      _drawCardBg(c, '#00d2ff');
      _drawMetallicHull(c, (p) => {
        p.moveTo(34, 106); p.lineTo(48, 76); p.lineTo(80, 76); p.lineTo(94, 106);
      }, '#263238', '#90a4ae', '#00d2ff');

      _drawMetallicHull(c, (p) => {
        p.arc(64, 68, 18, Math.PI, 0);
        p.lineTo(82, 76); p.lineTo(46, 76);
      }, '#37474f', '#eceff1', '#00d2ff');

      c.strokeStyle = '#cfd8dc';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(72, 60); c.lineTo(108, 42);
      c.stroke();

      _drawEngineGlow(c, 109, 41, 8, '#00e5ff');
    },

    heavyLaser(c) {
      _drawCardBg(c, '#00e5ff');
      _drawMetallicHull(c, (p) => {
        p.moveTo(26, 106); p.lineTo(38, 76); p.lineTo(90, 76); p.lineTo(102, 106);
      }, '#263238', '#90a4ae', '#00e5ff');

      _drawMetallicHull(c, (p) => {
        p.moveTo(38, 76); p.lineTo(44, 52); p.lineTo(82, 52); p.lineTo(88, 76);
      }, '#37474f', '#eceff1', '#00e5ff');

      c.strokeStyle = '#eceff1';
      c.lineWidth = 4.5;
      c.beginPath();
      c.moveTo(76, 56); c.lineTo(112, 38);
      c.moveTo(80, 65); c.lineTo(115, 48);
      c.stroke();

      _drawEngineGlow(c, 60, 64, 9, '#00e5ff');
    },

    gaussCannon(c) {
      _drawCardBg(c, '#2979ff');
      _drawMetallicHull(c, (p) => {
        p.moveTo(22, 106); p.lineTo(34, 78); p.lineTo(88, 78); p.lineTo(98, 106);
      }, '#1c2636', '#78909c', '#448aff');

      c.save();
      c.translate(52, 68);
      c.rotate(-0.36);
      _drawMetallicHull(c, (p) => {
        p.rect(-14, -12, 78, 8);
        p.rect(-14, 4, 78, 8);
      }, '#37474f', '#eceff1', '#448aff');

      [6, 22, 38, 54].forEach((bx) => {
        c.fillStyle = '#00e5ff';
        c.fillRect(bx, -14, 5, 28);
      });
      _drawEngineGlow(c, 66, 0, 10, '#00e5ff');
      c.restore();
    },

    ionCannon(c) {
      _drawCardBg(c, '#00e5ff');
      _drawMetallicHull(c, (p) => {
        p.moveTo(32, 106); p.lineTo(44, 82); p.lineTo(84, 82); p.lineTo(96, 106);
      }, '#263238', '#90a4ae', '#00e5ff');

      c.save();
      c.translate(64, 56);
      c.rotate(-0.4);
      c.strokeStyle = '#cfd8dc';
      c.lineWidth = 3;
      c.beginPath();
      c.ellipse(0, 0, 32, 12, 0, 0, Math.PI * 2);
      c.stroke();

      c.rotate(0.8);
      c.strokeStyle = '#00e5ff';
      c.lineWidth = 2.2;
      c.beginPath();
      c.ellipse(0, 0, 32, 12, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();

      _drawEngineGlow(c, 64, 56, 20, '#00e5ff');
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(64, 56, 7, 0, Math.PI * 2);
      c.fill();
    },

    plasmaTurret(c) {
      _drawCardBg(c, '#d500f9');
      _drawMetallicHull(c, (p) => {
        p.moveTo(20, 106); p.lineTo(32, 74); p.lineTo(96, 74); p.lineTo(108, 106);
      }, '#211738', '#90a4ae', '#e040fb');

      _drawMetallicHull(c, (p) => {
        p.moveTo(46, 62); p.lineTo(98, 30); p.lineTo(108, 44); p.lineTo(58, 76);
      }, '#37474f', '#eceff1', '#ff9100');

      _drawEngineGlow(c, 58, 64, 18, '#d500f9');
      _drawEngineGlow(c, 104, 36, 12, '#ff9100');
    },

    smallShieldDome(c) {
      _drawCardBg(c, '#00d2ff');
      _drawMetallicHull(c, (p) => {
        p.moveTo(16, 98); p.lineTo(28, 86); p.lineTo(100, 86); p.lineTo(112, 98);
      }, '#263238', '#90a4ae', '#00d2ff');

      _drawEngineGlow(c, 64, 82, 12, '#00e5ff');

      const domeGrad = c.createRadialGradient(64, 62, 8, 64, 86, 48);
      domeGrad.addColorStop(0, 'rgba(0, 210, 255, 0.08)');
      domeGrad.addColorStop(0.75, 'rgba(0, 210, 255, 0.28)');
      domeGrad.addColorStop(1, 'rgba(0, 229, 255, 0.75)');

      c.fillStyle = domeGrad;
      c.strokeStyle = '#00e5ff';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(64, 86, 44, Math.PI, 0);
      c.closePath();
      c.fill();
      c.stroke();
    },

    largeShieldDome(c) {
      _drawCardBg(c, '#ffd700');
      _drawMetallicHull(c, (p) => {
        p.moveTo(12, 100); p.lineTo(24, 86); p.lineTo(104, 86); p.lineTo(116, 100);
      }, '#263238', '#cfd8dc', '#ffd700');

      c.fillStyle = 'rgba(0, 210, 255, 0.22)';
      c.strokeStyle = '#00e5ff';
      c.lineWidth = 1.6;
      c.beginPath();
      c.arc(64, 86, 36, Math.PI, 0);
      c.closePath();
      c.fill();
      c.stroke();

      const outerGrad = c.createRadialGradient(64, 58, 10, 64, 86, 50);
      outerGrad.addColorStop(0, 'rgba(255, 215, 0, 0.05)');
      outerGrad.addColorStop(0.8, 'rgba(255, 215, 0, 0.26)');
      outerGrad.addColorStop(1, 'rgba(255, 215, 0, 0.8)');

      c.fillStyle = outerGrad;
      c.strokeStyle = '#ffd700';
      c.lineWidth = 2.2;
      c.beginPath();
      c.arc(64, 86, 48, Math.PI, 0);
      c.closePath();
      c.fill();
      c.stroke();

      const hexCenters = [[64, 52], [44, 66], [84, 66]];
      c.strokeStyle = 'rgba(255, 215, 0, 0.65)';
      c.lineWidth = 1.1;
      for (const [hx, hy] of hexCenters) {
        c.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i;
          const px = hx + Math.cos(a) * 8;
          const py = hy + Math.sin(a) * 8;
          if (i === 0) c.moveTo(px, py);
          else c.lineTo(px, py);
        }
        c.closePath();
        c.stroke();
      }
    },

    antiBallisticMissile(c) {
      _drawCardBg(c, '#00e676');
      _drawMetallicHull(c, (p) => {
        p.moveTo(16, 96); p.lineTo(44, 96); p.lineTo(34, 80); p.lineTo(16, 86);
        p.moveTo(112, 96); p.lineTo(84, 96); p.lineTo(94, 80); p.lineTo(112, 86);
      }, '#263238', '#90a4ae', '#00e676');

      _drawEngineGlow(c, 64, 94, 16, '#ff9100');

      _drawMetallicHull(c, (p) => {
        p.moveTo(56, 88);
        p.lineTo(56, 42);
        p.lineTo(64, 22);
        p.lineTo(72, 42);
        p.lineTo(72, 88);
      }, '#37474f', '#ffffff', '#00e676');

      c.fillStyle = '#00e676';
      c.beginPath();
      c.moveTo(56, 42); c.lineTo(64, 22); c.lineTo(72, 42);
      c.closePath();
      c.fill();

      _drawMetallicHull(c, (p) => {
        p.moveTo(56, 74); p.lineTo(46, 88); p.lineTo(56, 86);
        p.moveTo(72, 74); p.lineTo(82, 88); p.lineTo(72, 86);
      }, '#263238', '#cfd8dc', '#00e676');
    },

    spaceTrap(c) {
      _drawCardBg(c, '#ff1744');
      const cx = 64, cy = 64;

      c.strokeStyle = '#cfd8dc';
      c.lineWidth = 3.2;
      for (let i = 0; i < 8; i++) {
        const ang = (Math.PI / 4) * i;
        c.beginPath();
        c.moveTo(cx + Math.cos(ang) * 20, cy + Math.sin(ang) * 20);
        c.lineTo(cx + Math.cos(ang) * 42, cy + Math.sin(ang) * 42);
        c.stroke();

        c.fillStyle = '#ff1744';
        c.beginPath();
        c.arc(cx + Math.cos(ang) * 43, cy + Math.sin(ang) * 43, 2.5, 0, Math.PI * 2);
        c.fill();
      }

      _drawMetallicHull(c, (p) => {
        p.arc(cx, cy, 24, 0, Math.PI * 2);
      }, '#1c2230', '#78909c', '#ff1744');

      _drawEngineGlow(c, cx, cy, 14, '#ff1744');
      c.fillStyle = '#ff5252';
      c.beginPath();
      c.arc(cx, cy, 6, 0, Math.PI * 2);
      c.fill();
    }
  };

  // =========================================================
  // RENDERERS: 14 EDIFICI PLANETARI
  // =========================================================
  const PLANETARY_BUILDINGS = {
    metalMine(c) {
      _drawCardBg(c, '#00e676');
      _drawPlanetarySurface(c, '#16241d', '#00e676');

      c.strokeStyle = '#90a4ae';
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(36, 94); c.lineTo(54, 24); c.lineTo(74, 24); c.lineTo(92, 94);
      c.moveTo(42, 72); c.lineTo(82, 50);
      c.moveTo(86, 72); c.lineTo(46, 50);
      c.moveTo(48, 46); c.lineTo(80, 46);
      c.stroke();

      _drawMetallicHull(c, (p) => {
        p.rect(48, 18, 32, 12);
      }, '#37474f', '#cfd8dc', '#00e676');

      _drawMetallicHull(c, (p) => {
        p.moveTo(57, 30); p.lineTo(71, 30); p.lineTo(64, 96);
      }, '#455a64', '#ffffff', '#ff9100');

      _drawPanelLines(c, [[58, 44, 70, 50], [59, 58, 69, 64], [60, 72, 68, 78]], '#ff9100');
      _drawEngineGlow(c, 64, 95, 13, '#ff9100');
      c.fillStyle = '#ffea00';
      [[52, 88], [76, 86], [48, 96], [80, 95]].forEach(([sx, sy]) => {
        c.fillRect(sx, sy, 2.5, 2.5);
      });
    },

    crystalMine(c) {
      _drawCardBg(c, '#00d2ff');
      _drawPlanetarySurface(c, '#102030', '#00d2ff');

      const drawCrystal = (x, y, w, h, tilt) => {
        c.save();
        c.translate(x, y);
        c.rotate(tilt);
        const cg = c.createLinearGradient(-w / 2, -h, w / 2, 0);
        cg.addColorStop(0, '#e0f7fa');
        cg.addColorStop(0.5, '#00e5ff');
        cg.addColorStop(1, '#01579b');
        c.fillStyle = cg;
        c.strokeStyle = '#84ffff';
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(0, -h);
        c.lineTo(w * 0.5, -h * 0.35);
        c.lineTo(w * 0.35, 0);
        c.lineTo(-w * 0.35, 0);
        c.lineTo(-w * 0.5, -h * 0.35);
        c.closePath();
        c.fill();
        c.stroke();
        c.restore();
      };

      drawCrystal(88, 95, 16, 42, -0.15);
      drawCrystal(102, 96, 14, 34, 0.2);
      drawCrystal(76, 96, 12, 26, -0.35);

      _drawMetallicHull(c, (p) => {
        p.moveTo(18, 94); p.lineTo(24, 48); p.lineTo(48, 48); p.lineTo(54, 94);
      }, '#263238', '#b0bec5', '#00d2ff');

      c.strokeStyle = '#00e5ff';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(46, 56);
      c.lineTo(86, 74);
      c.stroke();
      _drawEngineGlow(c, 86, 74, 10, '#00e5ff');
    },

    deuteriumSynth(c) {
      _drawCardBg(c, '#ff9100');
      _drawPlanetarySurface(c, '#241911', '#ff9100');

      [34, 62].forEach((tx) => {
        _drawMetallicHull(c, (p) => {
          p.roundRect(tx, 34, 22, 60, 8);
        }, '#37474f', '#cfd8dc', '#ff9100');
        c.fillStyle = '#ff9100';
        c.fillRect(tx + 8, 48, 6, 36);
      });

      _drawMetallicHull(c, (p) => {
        p.rect(90, 22, 16, 72);
      }, '#263238', '#90a4ae', '#ff9100');

      c.strokeStyle = '#ff9100';
      c.lineWidth = 2.6;
      c.beginPath();
      c.moveTo(56, 46); c.lineTo(62, 46);
      c.moveTo(84, 42); c.lineTo(90, 42);
      c.moveTo(84, 72); c.lineTo(90, 72);
      c.stroke();
    },

    solarPlant(c) {
      _drawCardBg(c, '#ffea00');
      _drawPlanetarySurface(c, '#1c1d12', '#ffea00');

      _drawMetallicHull(c, (p) => {
        p.moveTo(56, 94); p.lineTo(60, 44); p.lineTo(68, 44); p.lineTo(72, 94);
      }, '#37474f', '#eceff1', '#ffea00');

      const drawPanel = (x, y, w, h, skew) => {
        c.save();
        c.translate(x, y);
        c.transform(1, skew, 0, 1, 0, 0);
        const pg = c.createLinearGradient(0, 0, w, h);
        pg.addColorStop(0, '#ffd700');
        pg.addColorStop(0.45, '#ff8f00');
        pg.addColorStop(1, '#1a237e');
        c.fillStyle = pg;
        c.strokeStyle = '#ffea00';
        c.lineWidth = 1.4;
        c.fillRect(0, 0, w, h);
        c.strokeRect(0, 0, w, h);
        _drawPanelLines(c, [[w * 0.5, 0, w * 0.5, h], [0, h * 0.5, w, h * 0.5]], 'rgba(255,255,255,0.45)');
        c.restore();
      };

      drawPanel(14, 38, 42, 28, -0.18);
      drawPanel(72, 31, 42, 28, 0.18);
      _drawEngineGlow(c, 64, 42, 11, '#ffea00');
    },

    fusionReactor(c) {
      _drawCardBg(c, '#00e5ff');
      _drawPlanetarySurface(c, '#121d2b', '#00e5ff');

      _drawMetallicHull(c, (p) => {
        p.ellipse(64, 58, 44, 28, 0, 0, Math.PI * 2);
      }, '#263238', '#90a4ae', '#00e5ff');

      c.fillStyle = '#070b14';
      c.beginPath();
      c.ellipse(64, 58, 30, 17, 0, 0, Math.PI * 2);
      c.fill();

      c.save();
      c.shadowColor = '#00e5ff';
      c.shadowBlur = 14;
      c.strokeStyle = '#84ffff';
      c.lineWidth = 5;
      c.beginPath();
      c.ellipse(64, 58, 23, 12, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();

      _drawMetallicHull(c, (p) => {
        p.rect(57, 30, 14, 58);
      }, '#37474f', '#eceff1', '#00e5ff');
    },

    shipyard(c) {
      _drawCardBg(c, '#00d2ff');
      _drawPlanetarySurface(c, '#111827', '#00d2ff');

      _drawMetallicHull(c, (p) => {
        p.moveTo(20, 94); p.lineTo(20, 30); p.lineTo(108, 30); p.lineTo(108, 94);
        p.lineTo(94, 94); p.lineTo(94, 42); p.lineTo(34, 42); p.lineTo(34, 94);
      }, '#263238', '#b0bec5', '#00d2ff');

      _drawMetallicHull(c, (p) => {
        p.moveTo(42, 68); p.lineTo(66, 56); p.lineTo(88, 68); p.lineTo(66, 78);
      }, '#455a64', '#eceff1', '#ff9100');

      c.strokeStyle = '#ff9100';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(46, 42); c.lineTo(56, 62);
      c.moveTo(82, 42); c.lineTo(74, 62);
      c.stroke();
      _drawEngineGlow(c, 56, 62, 7, '#00e5ff');
      _drawEngineGlow(c, 74, 62, 7, '#ff9100');
    },

    roboticsFactory(c) {
      _drawCardBg(c, '#2979ff');
      _drawPlanetarySurface(c, '#121929', '#448aff');

      _drawMetallicHull(c, (p) => {
        p.rect(24, 82, 80, 14);
      }, '#263238', '#90a4ae', '#448aff');

      c.strokeStyle = '#cfd8dc';
      c.lineWidth = 5;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(36, 82); c.lineTo(30, 52); c.lineTo(54, 46);
      c.moveTo(92, 82); c.lineTo(98, 52); c.lineTo(74, 46);
      c.stroke();

      [[30, 52], [98, 52]].forEach(([jx, jy]) => {
        c.fillStyle = '#448aff';
        c.beginPath();
        c.arc(jx, jy, 4.5, 0, Math.PI * 2);
        c.fill();
      });

      _drawEngineGlow(c, 64, 52, 16, '#00e5ff');
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(64, 52, 3.5, 0, Math.PI * 2);
      c.fill();
    },

    naniteFactory(c) {
      _drawCardBg(c, '#d500f9');
      _drawPlanetarySurface(c, '#1b1129', '#e040fb');

      const nodes = [
        [64, 34], [46, 48], [82, 48], [64, 62],
        [46, 74], [82, 74], [64, 86]
      ];
      c.strokeStyle = 'rgba(224, 64, 251, 0.75)';
      c.lineWidth = 1.6;
      const edges = [[0,1],[0,2],[1,3],[2,3],[1,4],[2,5],[3,4],[3,5],[4,6],[5,6]];
      for (const [a, b] of edges) {
        c.beginPath();
        c.moveTo(nodes[a][0], nodes[a][1]);
        c.lineTo(nodes[b][0], nodes[b][1]);
        c.stroke();
      }
      for (const [nx, ny] of nodes) {
        _drawEngineGlow(c, nx, ny, 7, '#00e5ff');
      }

      const swarm = [[26, 40], [102, 38], [24, 68], [104, 70], [40, 26], [88, 26]];
      for (const [sx, sy] of swarm) {
        c.fillStyle = '#ffea00';
        c.fillRect(sx, sy, 3, 3);
      }
    },

    researchLab(c) {
      _drawCardBg(c, '#00e5ff');
      _drawPlanetarySurface(c, '#101d2e', '#00e5ff');

      _drawMetallicHull(c, (p) => {
        p.arc(64, 86, 34, Math.PI, 0);
        p.lineTo(98, 94); p.lineTo(30, 94);
      }, '#263238', '#eceff1', '#00e5ff');

      const ay = 34;
      _drawEngineGlow(c, 64, ay, 12, '#00e5ff');
      c.strokeStyle = '#84ffff';
      c.lineWidth = 1.3;
      [0, Math.PI / 3, -Math.PI / 3].forEach((rot) => {
        c.save();
        c.translate(64, ay);
        c.rotate(rot);
        c.beginPath();
        c.ellipse(0, 0, 22, 7, 0, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      });
    },

    metalStorage(c) {
      _drawCardBg(c, '#00e676');
      _drawPlanetarySurface(c, '#13211a', '#00e676');

      [28, 68].forEach((sx) => {
        _drawMetallicHull(c, (p) => {
          p.roundRect(sx, 36, 32, 58, 6);
        }, '#263238', '#b0bec5', '#00e676');
        c.fillStyle = '#09120e';
        c.fillRect(sx + 12, 44, 8, 42);
        c.fillStyle = '#00e676';
        c.fillRect(sx + 13, 54, 6, 31);
      });
    },

    crystalStorage(c) {
      _drawCardBg(c, '#00d2ff');
      _drawPlanetarySurface(c, '#101f2e', '#00d2ff');

      [28, 68].forEach((sx) => {
        _drawMetallicHull(c, (p) => {
          p.moveTo(sx + 8, 34); p.lineTo(sx + 24, 34);
          p.lineTo(sx + 32, 46); p.lineTo(sx + 32, 94);
          p.lineTo(sx, 94); p.lineTo(sx, 46);
        }, '#263238', '#cfd8dc', '#00d2ff');
        c.fillStyle = '#07111a';
        c.fillRect(sx + 12, 44, 8, 42);
        c.fillStyle = '#00d2ff';
        c.fillRect(sx + 13, 52, 6, 33);
      });
    },

    deuteriumTank(c) {
      _drawCardBg(c, '#ff9100');
      _drawPlanetarySurface(c, '#211810', '#ff9100');

      [42, 86].forEach((cx) => {
        _drawMetallicHull(c, (p) => {
          p.arc(cx, 62, 20, 0, Math.PI * 2);
        }, '#37474f', '#cfd8dc', '#ff9100');
        c.fillStyle = '#ff9100';
        c.fillRect(cx - 3, 49, 6, 26);
        c.fillRect(cx - 10, 82, 20, 12);
      });
    },

    terraformer(c) {
      _drawCardBg(c, '#00e676');
      _drawPlanetarySurface(c, '#004d40', '#00e676');

      c.fillStyle = '#00e676';
      c.beginPath();
      c.ellipse(64, 92, 48, 6, 0, 0, Math.PI * 2);
      c.fill();

      [36, 76].forEach((tx) => {
        _drawMetallicHull(c, (p) => {
          p.moveTo(tx, 90); p.lineTo(tx + 4, 42); p.lineTo(tx + 12, 42); p.lineTo(tx + 16, 90);
        }, '#37474f', '#eceff1', '#00e676');
        _drawEngineGlow(c, tx + 8, 36, 12, '#84ffff');
      });

      c.fillStyle = 'rgba(132, 255, 255, 0.25)';
      c.beginPath();
      c.arc(52, 26, 14, 0, Math.PI * 2);
      c.arc(68, 24, 16, 0, Math.PI * 2);
      c.arc(82, 28, 12, 0, Math.PI * 2);
      c.fill();
    },

    hiddenBunker(c) {
      _drawCardBg(c, '#ffea00');
      _drawPlanetarySurface(c, '#1a1a22', '#ffea00');

      _drawMetallicHull(c, (p) => {
        p.moveTo(24, 96); p.lineTo(32, 44); p.lineTo(96, 44); p.lineTo(104, 96);
      }, '#1c222d', '#78909c', '#ffea00');

      _drawPanelLines(c, [[64, 44, 64, 96]], '#ffea00');

      c.strokeStyle = '#ffea00';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(64, 54);
      c.lineTo(76, 60);
      c.lineTo(74, 76);
      c.lineTo(64, 84);
      c.lineTo(54, 76);
      c.lineTo(52, 60);
      c.closePath();
      c.stroke();
      _drawEngineGlow(c, 64, 68, 9, '#ffea00');
    }
  };

  // =========================================================
  // RENDERERS: 6 EDIFICI LUNARI
  // =========================================================
  const MOON_BUILDINGS = {
    lunarBase(c) {
      _drawCardBg(c, '#00d2ff');
      _drawLunarSurface(c, '#cfd8dc');

      _drawMetallicHull(c, (p) => {
        p.arc(36, 88, 16, Math.PI, 0);
      }, '#37474f', '#b0bec5', '#00d2ff');
      _drawMetallicHull(c, (p) => {
        p.arc(92, 88, 16, Math.PI, 0);
      }, '#37474f', '#b0bec5', '#00d2ff');

      _drawMetallicHull(c, (p) => {
        p.arc(64, 88, 28, Math.PI, 0);
      }, '#455a64', '#eceff1', '#00e5ff');

      [52, 64, 76].forEach((ox) => {
        c.fillStyle = '#00e5ff';
        c.fillRect(ox - 2, 74, 4, 4);
      });
    },

    lunarStorage(c) {
      _drawCardBg(c, '#b0bec5');
      _drawLunarSurface(c, '#eceff1');

      [32, 64, 96].forEach((mx, idx) => {
        _drawMetallicHull(c, (p) => {
          p.roundRect(mx - 12, 52 - (idx === 1 ? 8 : 0), 24, 38 + (idx === 1 ? 8 : 0), 10);
        }, '#263238', '#cfd8dc', '#00d2ff');
      });
    },

    lunarShield(c) {
      _drawCardBg(c, '#d500f9');
      _drawLunarSurface(c, '#e040fb');

      _drawMetallicHull(c, (p) => {
        p.moveTo(48, 88); p.lineTo(56, 68); p.lineTo(72, 68); p.lineTo(80, 88);
      }, '#263238', '#cfd8dc', '#e040fb');

      _drawEngineGlow(c, 64, 64, 14, '#d500f9');

      const sGrad = c.createRadialGradient(64, 62, 6, 64, 88, 46);
      sGrad.addColorStop(0, 'rgba(213, 0, 249, 0.08)');
      sGrad.addColorStop(0.75, 'rgba(0, 210, 255, 0.25)');
      sGrad.addColorStop(1, 'rgba(213, 0, 249, 0.78)');
      c.fillStyle = sGrad;
      c.strokeStyle = '#e040fb';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(64, 88, 44, Math.PI, 0);
      c.closePath();
      c.fill();
      c.stroke();
    },

    secretShipyard(c) {
      _drawCardBg(c, '#ff1744');
      _drawLunarSurface(c, '#ff5252');

      _drawMetallicHull(c, (p) => {
        p.moveTo(22, 92); p.lineTo(34, 58); p.lineTo(94, 58); p.lineTo(106, 92);
      }, '#181e28', '#78909c', '#ff1744');

      c.fillStyle = '#05070d';
      c.fillRect(40, 68, 48, 22);

      [34, 64, 94].forEach((lx) => {
        _drawEngineGlow(c, lx, 62, 6, '#ff1744');
      });
    },

    jumpGate(c) {
      _drawCardBg(c, '#d500f9');
      _drawLunarSurface(c, '#00d2ff');

      const cx = 64, cy = 54, r = 34;

      const vGrad = c.createRadialGradient(cx, cy, 2, cx, cy, r - 4);
      vGrad.addColorStop(0, '#ffffff');
      vGrad.addColorStop(0.3, '#00e5ff');
      vGrad.addColorStop(0.7, '#aa00ff');
      vGrad.addColorStop(1, 'rgba(10, 14, 32, 0.9)');
      c.fillStyle = vGrad;
      c.beginPath();
      c.arc(cx, cy, r - 4, 0, Math.PI * 2);
      c.fill();

      c.strokeStyle = '#cfd8dc';
      c.lineWidth = 6;
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.stroke();

      c.strokeStyle = '#00e5ff';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(cx, cy, r + 3, 0, Math.PI * 2);
      c.stroke();
    },

    sensorPhalanx(c) {
      _drawCardBg(c, '#00e676');
      _drawLunarSurface(c, '#00e676');

      _drawMetallicHull(c, (p) => {
        p.moveTo(36, 90); p.lineTo(46, 72); p.lineTo(66, 72); p.lineTo(74, 90);
      }, '#263238', '#90a4ae', '#00e676');

      c.save();
      c.translate(58, 62);
      c.rotate(-0.65);
      c.strokeStyle = '#eceff1';
      c.lineWidth = 4;
      c.beginPath();
      c.arc(0, 0, 26, 0.15 * Math.PI, 0.85 * Math.PI);
      c.stroke();

      c.strokeStyle = '#00e676';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, 26); c.lineTo(0, 4);
      c.stroke();
      c.restore();

      c.strokeStyle = '#00e676';
      c.lineWidth = 1.6;
      [16, 26, 36].forEach((rad, i) => {
        c.globalAlpha = 0.85 - i * 0.22;
        c.beginPath();
        c.arc(76, 44, rad, -Math.PI * 0.45, Math.PI * 0.05);
        c.stroke();
      });
      c.globalAlpha = 1;
    }
  };

  // =========================================================
  // RENDERERS: 18 RICERCHE (Stile Olografico Blueprint)
  // =========================================================
  const RESEARCH_TECHS = {
    energyTech(c) {
      _drawBlueprintBg(c, '#ffea00');
      _drawEngineGlow(c, 64, 64, 14, '#ffea00');
      c.strokeStyle = '#ffea00';
      c.lineWidth = 2;
      [0, Math.PI / 3, -Math.PI / 3].forEach((ang) => {
        c.save();
        c.translate(64, 64);
        c.rotate(ang);
        c.beginPath();
        c.ellipse(0, 0, 38, 13, 0, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      });
    },

    laserTech(c) {
      _drawBlueprintBg(c, '#00e5ff');
      c.strokeStyle = '#84ffff';
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(30, 84); c.lineTo(54, 42); c.lineTo(78, 84); c.closePath();
      c.stroke();

      c.save();
      c.shadowColor = '#00e5ff';
      c.shadowBlur = 12;
      c.strokeStyle = '#00e5ff';
      c.lineWidth = 3.5;
      c.beginPath();
      c.moveTo(14, 64); c.lineTo(114, 64);
      c.stroke();
      c.restore();
    },

    ionTech(c) {
      _drawBlueprintBg(c, '#00d2ff');
      c.strokeStyle = '#00e5ff';
      c.lineWidth = 2.5;
      c.beginPath();
      for (let x = 20; x <= 108; x += 2) {
        const y = 64 + Math.sin((x - 20) * 0.14) * 22;
        if (x === 20) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
      _drawEngineGlow(c, 64, 64, 12, '#00e5ff');
    },

    plasmaTech(c) {
      _drawBlueprintBg(c, '#d500f9');
      _drawEngineGlow(c, 64, 64, 24, '#d500f9');
      c.strokeStyle = '#ff9100';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(64, 64, 28, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = '#00e5ff';
      c.beginPath();
      c.arc(64, 64, 36, 0.2, Math.PI * 1.8);
      c.stroke();
    },

    hyperspaceTech(c) {
      _drawBlueprintBg(c, '#7c4dff');
      c.strokeStyle = '#b388ff';
      c.lineWidth = 1.8;
      [14, 24, 34, 44].forEach((r) => {
        c.beginPath();
        c.ellipse(64, 64, r, r * 0.62, 0.35, 0, Math.PI * 2);
        c.stroke();
      });
      _drawEngineGlow(c, 64, 64, 11, '#00e5ff');
    },

    combustionDrive(c) {
      _drawBlueprintBg(c, '#ff9100');
      c.strokeStyle = '#cfd8dc';
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(46, 30); c.lineTo(82, 30);
      c.lineTo(74, 52); c.lineTo(90, 74);
      c.lineTo(38, 74); c.lineTo(54, 52);
      c.closePath();
      c.stroke();
      _drawEngineGlow(c, 64, 88, 16, '#ff9100');
    },

    impulseDrive(c) {
      _drawBlueprintBg(c, '#00d2ff');
      c.strokeStyle = '#00e5ff';
      c.lineWidth = 2.2;
      c.beginPath();
      c.arc(64, 54, 22, 0, Math.PI * 2);
      c.stroke();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        c.beginPath();
        c.moveTo(64, 54);
        c.lineTo(64 + Math.cos(a) * 22, 54 + Math.sin(a) * 22);
        c.stroke();
      }
      _drawEngineGlow(c, 64, 88, 14, '#00e5ff');
    },

    hyperspaceDrive(c) {
      _drawBlueprintBg(c, '#00e5ff');
      c.strokeStyle = '#84ffff';
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(64, 22); c.lineTo(88, 78); c.lineTo(64, 66); c.lineTo(40, 78);
      c.closePath();
      c.stroke();
      _drawEngineGlow(c, 64, 86, 18, '#d500f9');
    },

    weaponsTech(c) {
      _drawBlueprintBg(c, '#ff1744');
      c.strokeStyle = '#ff5252';
      c.lineWidth = 2.2;
      c.beginPath();
      c.arc(64, 64, 30, 0, Math.PI * 2);
      c.moveTo(64, 24); c.lineTo(64, 104);
      c.moveTo(24, 64); c.lineTo(104, 64);
      c.stroke();
      _drawEngineGlow(c, 64, 64, 9, '#ff1744');
    },

    shieldingTech(c) {
      _drawBlueprintBg(c, '#00d2ff');
      [34, 22].forEach((r, idx) => {
        c.strokeStyle = idx === 0 ? '#00e5ff' : '#84ffff';
        c.lineWidth = 2.2;
        c.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 6;
          const x = 64 + Math.cos(a) * r;
          const y = 64 + Math.sin(a) * r;
          if (i === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.closePath();
        c.stroke();
      });
    },

    armourTech(c) {
      _drawBlueprintBg(c, '#00e676');
      c.strokeStyle = '#00e676';
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(64, 26); c.lineTo(96, 40); c.lineTo(90, 82); c.lineTo(64, 102);
      c.lineTo(38, 82); c.lineTo(32, 40);
      c.closePath();
      c.stroke();
      _drawPanelLines(c, [[44, 52, 84, 52], [46, 68, 82, 68]], '#00e676');
    },

    espionageTech(c) {
      _drawBlueprintBg(c, '#ff1744');
      c.strokeStyle = '#00e5ff';
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(22, 64);
      c.quadraticCurveTo(64, 30, 106, 64);
      c.quadraticCurveTo(64, 98, 22, 64);
      c.stroke();
      _drawEngineGlow(c, 64, 64, 14, '#ff1744');
    },

    computerTech(c) {
      _drawBlueprintBg(c, '#00e5ff');
      c.strokeStyle = '#00e5ff';
      c.lineWidth = 2.2;
      c.strokeRect(42, 42, 44, 44);
      c.strokeRect(52, 52, 24, 24);
      for (let i = 48; i <= 80; i += 8) {
        c.beginPath();
        c.moveTo(i, 32); c.lineTo(i, 42);
        c.moveTo(i, 86); c.lineTo(i, 96);
        c.moveTo(32, i); c.lineTo(42, i);
        c.moveTo(86, i); c.lineTo(96, i);
        c.stroke();
      }
    },

    astrophysics(c) {
      _drawBlueprintBg(c, '#00e676');
      _drawEngineGlow(c, 64, 64, 13, '#ffea00');
      c.strokeStyle = '#00e5ff';
      c.lineWidth = 1.6;
      c.beginPath();
      c.arc(64, 64, 24, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.arc(64, 64, 38, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#00e676';
      c.beginPath();
      c.arc(88, 64, 4.5, 0, Math.PI * 2);
      c.arc(38, 36, 5.5, 0, Math.PI * 2);
      c.fill();
    },

    intergalacticNetwork(c) {
      _drawBlueprintBg(c, '#00e5ff');
      const pts = [[64, 30], [32, 56], [96, 56], [42, 92], [86, 92], [64, 64]];
      c.strokeStyle = 'rgba(0, 229, 255, 0.7)';
      c.lineWidth = 1.6;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          c.beginPath();
          c.moveTo(pts[i][0], pts[i][1]);
          c.lineTo(pts[j][0], pts[j][1]);
          c.stroke();
        }
      }
      for (const [px, py] of pts) {
        _drawEngineGlow(c, px, py, 7, '#00e676');
      }
    },

    jumpGateTech(c) {
      _drawBlueprintBg(c, '#d500f9');
      c.strokeStyle = '#e040fb';
      c.lineWidth = 2.4;
      c.beginPath();
      c.arc(64, 64, 32, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = '#00e5ff';
      c.beginPath();
      c.arc(64, 64, 20, 0, Math.PI * 2);
      c.stroke();
      _drawEngineGlow(c, 64, 64, 12, '#d500f9');
    },

    lunarTech(c) {
      _drawBlueprintBg(c, '#cfd8dc');
      c.save();
      c.fillStyle = 'rgba(0, 229, 255, 0.25)';
      c.strokeStyle = '#eceff1';
      c.lineWidth = 2.2;
      c.beginPath();
      c.arc(60, 64, 30, 0.25 * Math.PI, 1.75 * Math.PI);
      c.arc(76, 64, 24, 1.65 * Math.PI, 0.35 * Math.PI, true);
      c.closePath();
      c.fill();
      c.stroke();
      c.restore();
    },

    deathStarTech(c) {
      _drawBlueprintBg(c, '#ff1744');
      c.strokeStyle = '#00e676';
      c.lineWidth = 2.2;
      c.beginPath();
      c.arc(60, 66, 32, 0, Math.PI * 2);
      c.moveTo(28, 66); c.lineTo(92, 66);
      c.stroke();

      c.beginPath();
      c.arc(72, 52, 9, 0, Math.PI * 2);
      c.stroke();

      c.strokeStyle = '#ff1744';
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(72, 52); c.lineTo(112, 22);
      c.stroke();
    }
  };

  // =========================================================
  // REGISTRAZIONE E ALIAS COMPLETI PER TUTTI GLI ID DI data.js
  // =========================================================
  const ALL_RENDERERS = Object.assign(
    {},
    SHIP_RENDERERS,
    DEFENSE_RENDERERS,
    PLANETARY_BUILDINGS,
    MOON_BUILDINGS,
    RESEARCH_TECHS,
    {
      // Alias maiuscole/minuscole e plurali usati in data.js
      deathstar: SHIP_RENDERERS.deathStar,
      antiBallisticMissiles: DEFENSE_RENDERERS.antiBallisticMissile,
      interplanetaryMissiles: DEFENSE_RENDERERS.antiBallisticMissile,
      intergalacticResearchNetwork: RESEARCH_TECHS.intergalacticNetwork,
      lunarEngineering: RESEARCH_TECHS.lunarTech,
      gravitonTech: RESEARCH_TECHS.deathStarTech,
      allianceDepot: RESEARCH_TECHS.jumpGateTech,
      missileSilo: PLANETARY_BUILDINGS.hiddenBunker,
      planetaryShield: DEFENSE_RENDERERS.largeShieldDome
    }
  );

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
      drawPanelLines: _drawPanelLines
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
