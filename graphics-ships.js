/**
 * UNIVERSUM — Renderers Procedurale: 14 Navi & 10 Difese
 */
(function () {
  'use strict';

  const G = window.UniversumGraphics;
  if (!G) return;

  const SIZE = 128;
  const {
    drawCardBg: _drawCardBg,
    drawMetallicHull: _drawMetallicHull,
    drawEngineGlow: _drawEngineGlow,
    drawPanelLines: _drawPanelLines
  } = G.helpers;

  const preRenderedOffscreens = {};

  function _createOffscreen() {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    return { canvas, c: canvas.getContext('2d') };
  }

  function _wrapPreRendered(key, drawFn) {
    return function (targetCtx, mode) {
      const cacheKey = mode ? `${key}:${mode}` : key;
      if (!preRenderedOffscreens[cacheKey]) {
        const { canvas, c } = _createOffscreen();
        drawFn(c, mode);
        preRenderedOffscreens[cacheKey] = canvas;
      }
      targetCtx.drawImage(preRenderedOffscreens[cacheKey], 0, 0);
    };
  }

  // =========================================================
  // RENDERERS: 14 NAVI
  // =========================================================
  const RAW_SHIP_RENDERERS = {
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

      // Pre-render del raggio in canvas offscreen dedicato (senza shadowBlur/trasformazioni ripetute)
      const { canvas: beamCanvas, c: bCtx } = _createOffscreen();
      bCtx.strokeStyle = 'rgba(0, 230, 118, 0.28)';
      bCtx.lineWidth = 11;
      bCtx.beginPath();
      bCtx.moveTo(dishX, dishY);
      bCtx.lineTo(122, 16);
      bCtx.stroke();

      bCtx.strokeStyle = '#00e676';
      bCtx.lineWidth = 3.5;
      bCtx.beginPath();
      bCtx.moveTo(dishX, dishY);
      bCtx.lineTo(122, 16);
      bCtx.stroke();

      bCtx.strokeStyle = '#ffffff';
      bCtx.lineWidth = 1.3;
      bCtx.beginPath();
      bCtx.moveTo(dishX, dishY);
      bCtx.lineTo(122, 16);
      bCtx.stroke();

      c.drawImage(beamCanvas, 0, 0);
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
    },

    // Invictus: ammiraglia-lancia legata al Bacino, profilo a punta dorata.
    invictus(c) {
      _drawCardBg(c, '#ffc400');
      _drawEngineGlow(c, 20, 64, 13, '#00d2ff', Math.PI, 26);
      _drawMetallicHull(c, (p) => {
        p.moveTo(18, 52); p.lineTo(58, 40); p.lineTo(104, 56); p.lineTo(122, 64);
        p.lineTo(104, 72); p.lineTo(58, 88); p.lineTo(18, 76); p.lineTo(28, 64);
      }, '#37474f', '#ffe082', '#ffc400');
      _drawPanelLines(c, [[40, 52, 96, 60], [40, 76, 96, 68], [58, 40, 58, 88]], 'rgba(255,196,0,0.4)');

      const { canvas: lanceCanvas, c: lCtx } = _createOffscreen();
      lCtx.strokeStyle = 'rgba(255, 196, 0, 0.32)';
      lCtx.lineWidth = 9;
      lCtx.beginPath();
      lCtx.moveTo(84, 64);
      lCtx.lineTo(124, 64);
      lCtx.stroke();

      lCtx.strokeStyle = '#ffe082';
      lCtx.lineWidth = 3;
      lCtx.beginPath();
      lCtx.moveTo(84, 64);
      lCtx.lineTo(124, 64);
      lCtx.stroke();
      c.drawImage(lanceCanvas, 0, 0);

      _drawEngineGlow(c, 84, 64, 7, '#ffc400');
      [48, 64, 80].forEach((lx) => _drawEngineGlow(c, lx, 58, 4, '#00d2ff'));
    },

    // Crepuscolo degli Dei: sole nero corazzato, corona dorata e spire dorsali.
    crepuscolo(c) { _drawCrepuscolo(c, 'active'); },
    crepuscoloDamaged(c) { _drawCrepuscolo(c, 'damaged'); },
    crepuscoloRepair(c) { _drawCrepuscolo(c, 'repair'); },
    crepuscoloLimbo(c) { _drawCrepuscolo(c, 'limbo'); }
  };

  function _drawCrepuscolo(c, mode) {
    const accent = mode === 'limbo' ? '#78909c' : '#ff1744';
    _drawCardBg(c, accent);
    const cx = 64, cy = 62, r = 36;
    // Corona di spire
    c.strokeStyle = mode === 'limbo' ? '#546e7a' : '#ffc400';
    c.lineWidth = 3;
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i + 0.2;
      c.moveTo(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2));
      c.lineTo(cx + Math.cos(a) * (r + 13), cy + Math.sin(a) * (r + 13));
    }
    c.stroke();

    // Scafo eclisse
    const g = c.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, r);
    g.addColorStop(0, mode === 'limbo' ? '#37474f' : '#4a1020');
    g.addColorStop(0.6, '#131a26');
    g.addColorStop(1, '#05070d');
    c.fillStyle = g;
    c.strokeStyle = mode === 'limbo' ? '#78909c' : '#ffc400';
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    _drawPanelLines(c, [[cx - r, cy, cx + r, cy], [cx - 24, cy - 20, cx + 24, cy - 20], [cx - 24, cy + 20, cx + 24, cy + 20]], 'rgba(255,196,0,0.3)');
    _drawEngineGlow(c, cx, cy, mode === 'limbo' ? 8 : 13, mode === 'limbo' ? '#78909c' : '#ff1744');

    if (mode === 'damaged' || mode === 'repair') {
      // Fessure di danno e fasce di riparazione
      c.strokeStyle = '#ff5252';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(38, 44); c.lineTo(54, 60); c.lineTo(46, 74);
      c.moveTo(78, 38); c.lineTo(70, 54);
      c.stroke();

      c.strokeStyle = '#ffc400';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(28, 96); c.lineTo(100, 96);
      c.stroke();

      if (mode === 'repair') {
        c.fillStyle = '#ffc400';
        c.fillRect(44, 90, 8, 12);
        c.fillRect(76, 90, 8, 12);
      }
    }

    if (mode === 'limbo') {
      // Alone spento e deriva: sagoma pre-calcolata in dissolvenza verso il basso
      const { canvas: limboCanvas, c: lCtx } = _createOffscreen();
      lCtx.fillStyle = 'rgba(120, 144, 156, 0.35)';
      lCtx.beginPath();
      lCtx.ellipse(64, 108, 30, 6, 0, 0, Math.PI * 2);
      lCtx.fill();
      c.drawImage(limboCanvas, 0, 0);
    }
  }

  // =========================================================
  // RENDERERS: 10 DIFESE
  // =========================================================
  const RAW_DEFENSE_RENDERERS = {
    rocketLauncher(c) {
      _drawCardBg(c, '#ff9100');
      _drawMetallicHull(c, (p) => {
        p.moveTo(24, 106); p.lineTo(36, 86); p.lineTo(92, 86); p.lineTo(104, 106);
      }, '#263238', '#90a4ae', '#ff9100');

      const { canvas: podCanvas, c: pCtx } = _createOffscreen();
      pCtx.save();
      pCtx.translate(64, 62);
      pCtx.rotate(-0.45);
      _drawMetallicHull(pCtx, (p) => {
        p.rect(-24, -18, 48, 36);
      }, '#37474f', '#cfd8dc', '#ff9100');

      [-12, 0, 12].forEach((ty) => {
        pCtx.fillStyle = '#101622';
        pCtx.fillRect(-18, ty - 4, 36, 8);
        pCtx.fillStyle = '#ff3d00';
        pCtx.beginPath();
        pCtx.arc(18, ty, 3.5, 0, Math.PI * 2);
        pCtx.fill();
      });
      pCtx.restore();
      c.drawImage(podCanvas, 0, 0);
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

      const { canvas: railCanvas, c: rCtx } = _createOffscreen();
      rCtx.save();
      rCtx.translate(52, 68);
      rCtx.rotate(-0.36);
      _drawMetallicHull(rCtx, (p) => {
        p.rect(-14, -12, 78, 8);
        p.rect(-14, 4, 78, 8);
      }, '#37474f', '#eceff1', '#448aff');

      [6, 22, 38, 54].forEach((bx) => {
        rCtx.fillStyle = '#00e5ff';
        rCtx.fillRect(bx, -14, 5, 28);
      });
      _drawEngineGlow(rCtx, 66, 0, 10, '#00e5ff');
      rCtx.restore();
      c.drawImage(railCanvas, 0, 0);
    },

    ionCannon(c) {
      _drawCardBg(c, '#00e5ff');
      _drawMetallicHull(c, (p) => {
        p.moveTo(32, 106); p.lineTo(44, 82); p.lineTo(84, 82); p.lineTo(96, 106);
      }, '#263238', '#90a4ae', '#00e5ff');

      const { canvas: ringCanvas, c: iCtx } = _createOffscreen();
      iCtx.save();
      iCtx.translate(64, 56);
      iCtx.rotate(-0.4);
      iCtx.strokeStyle = '#cfd8dc';
      iCtx.lineWidth = 3;
      iCtx.beginPath();
      iCtx.ellipse(0, 0, 32, 12, 0, 0, Math.PI * 2);
      iCtx.stroke();

      iCtx.rotate(0.8);
      iCtx.strokeStyle = '#00e5ff';
      iCtx.lineWidth = 2.2;
      iCtx.beginPath();
      iCtx.ellipse(0, 0, 32, 12, 0, 0, Math.PI * 2);
      iCtx.stroke();
      iCtx.restore();
      c.drawImage(ringCanvas, 0, 0);

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

  const SHIP_RENDERERS = {};
  for (const [key, fn] of Object.entries(RAW_SHIP_RENDERERS)) {
    SHIP_RENDERERS[key] = _wrapPreRendered(key, fn);
  }

  const DEFENSE_RENDERERS = {};
  for (const [key, fn] of Object.entries(RAW_DEFENSE_RENDERERS)) {
    DEFENSE_RENDERERS[key] = _wrapPreRendered(key, fn);
  }

  G.registerRenderers(
    Object.assign({}, SHIP_RENDERERS, DEFENSE_RENDERERS, {
      deathstar: SHIP_RENDERERS.deathStar,
      antiBallisticMissiles: DEFENSE_RENDERERS.antiBallisticMissile,
      interplanetaryMissiles: DEFENSE_RENDERERS.antiBallisticMissile,
      planetaryShield: DEFENSE_RENDERERS.largeShieldDome
    })
  );
})();