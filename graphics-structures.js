/**
 * UNIVERSUM — Renderers Procedurale: Edifici Planetari, Strutture Lunari & Ricerche
 */
(function () {
  'use strict';

  const G = window.UniversumGraphics;
  if (!G) return;

  const {
    drawCardBg: _drawCardBg,
    drawMetallicHull: _drawMetallicHull,
    drawEngineGlow: _drawEngineGlow,
    drawPanelLines: _drawPanelLines,
    drawPlanetarySurface: _drawPlanetarySurface,
    drawLunarSurface: _drawLunarSurface,
    drawBlueprintBg: _drawBlueprintBg
  } = G.helpers;

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
  // RENDERERS: 19 RICERCHE (Stile Olografico Blueprint)
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

    expeditionTech(c) {
      _drawBlueprintBg(c, '#ffd700');
      // Anello esterno bussola astronomica
      c.strokeStyle = '#ffd700';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(64, 64, 36, 0, Math.PI * 2);
      c.stroke();

      // Orbita inclinata sonda profonda
      c.save();
      c.translate(64, 64);
      c.rotate(-0.45);
      c.strokeStyle = '#00e5ff';
      c.lineWidth = 1.6;
      c.beginPath();
      c.ellipse(0, 0, 44, 15, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();

      // Rosa dei venti a 4 punte
      c.strokeStyle = '#84ffff';
      c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(64, 24); c.lineTo(70, 58); c.lineTo(104, 64);
      c.lineTo(70, 70); c.lineTo(64, 104); c.lineTo(58, 70);
      c.lineTo(24, 64); c.lineTo(58, 58);
      c.closePath();
      c.stroke();

      _drawEngineGlow(c, 64, 64, 12, '#ffd700');
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

  G.registerRenderers(
    Object.assign({}, PLANETARY_BUILDINGS, MOON_BUILDINGS, RESEARCH_TECHS, {
      intergalacticResearchNetwork: RESEARCH_TECHS.intergalacticNetwork,
      lunarEngineering: RESEARCH_TECHS.lunarTech,
      gravitonTech: RESEARCH_TECHS.deathStarTech,
      allianceDepot: RESEARCH_TECHS.jumpGateTech,
      missileSilo: PLANETARY_BUILDINGS.hiddenBunker
    })
  );
})();
