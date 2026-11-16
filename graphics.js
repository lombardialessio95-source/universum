/**
 * UNIVERSUM — Motore Grafico Procedurale Sci-Fi (HTML5 Canvas 128x128)
 * Parte 1: Core Engine, Cache, Helper Metallici/Neon, 14 Navi, 10 Difese
 */
(function () {
  'use strict';

  const SIZE = 128;
  const cache = {};

  // Canvas offscreen riutilizzato per tutte le renderizzazioni
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = SIZE;
  offscreenCanvas.height = SIZE;
  const ctx = offscreenCanvas.getContext('2d');

  // =========================================================
  // HELPER DI RENDERING SCI-FI
  // =========================================================

  function _drawCardBg(c, accentColor = '#00d2ff') {
    c.save();
    c.clearRect(0, 0, SIZE, SIZE);

    // Sfondo base spazio profondo
    c.fillStyle = '#050814';
    c.fillRect(0, 0, SIZE, SIZE);

    // Nebulosa radiale soffusa
    const neb = c.createRadialGradient(SIZE * 0.5, SIZE * 0.5, 6, SIZE * 0.5, SIZE * 0.5, SIZE * 0.65);
    neb.addColorStop(0, _hexToRgba(accentColor, 0.24));
    neb.addColorStop(0.6, _hexToRgba(accentColor, 0.06));
    neb.addColorStop(1, 'rgba(5, 8, 20, 0)');
    c.fillStyle = neb;
    c.fillRect(0, 0, SIZE, SIZE);

    // Micro-stelle deterministiche
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

    // Reticolo tattico sottile
    c.strokeStyle = _hexToRgba(accentColor, 0.12);
    c.lineWidth = 0.75;
    c.beginPath();
    c.moveTo(0, 32); c.lineTo(SIZE, 32);
    c.moveTo(0, 96); c.lineTo(SIZE, 96);
    c.moveTo(32, 0); c.lineTo(32, SIZE);
    c.moveTo(96, 0); c.lineTo(96, SIZE);
    c.stroke();

    // Mirino angolare HUD
    c.strokeStyle = _hexToRgba(accentColor, 0.42);
    c.lineWidth = 1.2;
    const m = 6;
    const len = 10;
    c.beginPath();
    // Top-Left
    c.moveTo(m, m + len); c.lineTo(m, m); c.lineTo(m + len, m);
    // Top-Right
    c.moveTo(SIZE - m - len, m); c.lineTo(SIZE - m, m); c.lineTo(SIZE - m, m + len);
    // Bottom-Left
    c.moveTo(m, SIZE - m - len); c.lineTo(m, SIZE - m); c.lineTo(m + len, SIZE - m);
    // Bottom-Right
    c.moveTo(SIZE - m - len, SIZE - m); c.lineTo(SIZE - m, SIZE - m); c.lineTo(SIZE - m, SIZE - m - len);
    c.stroke();

    c.restore();
  }

  function _drawMetallicHull(c, pathFn, baseColor = '#37474f', lightColor = '#cfd8dc', strokeColor = '#00d2ff') {
    c.save();
    c.beginPath();
    pathFn(c);
    c.closePath();

    // Gradiente metallico direzionale (luce dall'alto a sinistra)
    const grad = c.createLinearGradient(20, 18, 108, 110);
    grad.addColorStop(0, lightColor);
    grad.addColorStop(0.45, baseColor);
    grad.addColorStop(1, '#0d1322');

    c.fillStyle = grad;
    c.fill();

    // Riflesso speculare interno
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

  // =========================================================
  // RENDERERS: 14 NAVI
  // =========================================================
  const SHIP_RENDERERS = {
    // 1. Cargo Leggero: navetta agile con stiva anteriore compatta e due propulsori azzurri
    smallCargo(c) {
      _drawCardBg(c, '#00d2ff');
      // Scia e propulsori posteriori (sinistra)
      _drawEngineGlow(c, 26, 52, 11, '#00d2ff', Math.PI, 20);
      _drawEngineGlow(c, 26, 76, 11, '#00d2ff', Math.PI, 20);

      // Alette stabilizzatrici
      _drawMetallicHull(c, (p) => {
        p.moveTo(32, 48); p.lineTo(22, 34); p.lineTo(48, 44);
        p.moveTo(32, 80); p.lineTo(22, 94); p.lineTo(48, 84);
      }, '#263238', '#78909c', '#00d2ff');

      // Scafo centrale e stiva anteriore compatta
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

      // Container stiva anteriore
      c.fillStyle = 'rgba(0, 210, 255, 0.22)';
      c.strokeStyle = '#00d2ff';
      c.lineWidth = 1.2;
      c.fillRect(64, 48, 28, 32);
      c.strokeRect(64, 48, 28, 32);

      // Cabina di pilotaggio
      c.fillStyle = '#00e5ff';
      c.beginPath();
      c.moveTo(94, 56); c.lineTo(103, 64); c.lineTo(94, 72);
      c.closePath();
      c.fill();

      _drawPanelLines(c, [[46, 45, 46, 83], [78, 48, 78, 80]]);
    },

    // 2. Cargo Pesante: grande cargo corazzato con container modulari e 4 motori arancioni
    largeCargo(c) {
      _drawCardBg(c, '#ff9100');
      // 4 propulsori arancioni posteriori
      [42, 56, 72, 86].forEach((ey) => {
        _drawEngineGlow(c, 20, ey, 9, '#ff9100', Math.PI, 16);
      });

      // Telaio strutturale pesante
      _drawMetallicHull(c, (p) => {
        p.moveTo(22, 38);
        p.lineTo(94, 38);
        p.lineTo(112, 52);
        p.lineTo(112, 76);
        p.lineTo(94, 90);
        p.lineTo(22, 90);
      }, '#37474f', '#b0bec5', '#ff9100');

      // 4 Container modulari corazzati (2x2)
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

      // Ponte corazzato anteriore
      c.fillStyle = '#ff9100';
      c.fillRect(98, 54, 8, 20);
    },

    // 3. Caccia Leggero: intercettore affilato ad ali a delta con propulsore blu neon
    lightFighter(c) {
      _drawCardBg(c, '#00d2ff');
      _drawEngineGlow(c, 28, 64, 15, '#00d2ff', Math.PI, 24);

      // Ali a delta affilate
      _drawMetallicHull(c, (p) => {
        p.moveTo(32, 64);
        p.lineTo(24, 22);
        p.lineTo(68, 52);
        p.lineTo(112, 64);
        p.lineTo(68, 76);
        p.lineTo(24, 106);
      }, '#2c3e50', '#e0f7fa', '#00d2ff');

      // Fusoliera centrale + muso a ago
      _drawMetallicHull(c, (p) => {
        p.moveTo(30, 56);
        p.lineTo(114, 64);
        p.lineTo(30, 72);
      }, '#455a64', '#ffffff', '#00e5ff');

      // Cockpit blu neon
      c.fillStyle = '#00e5ff';
      c.beginPath();
      c.ellipse(66, 64, 12, 4, 0, 0, Math.PI * 2);
      c.fill();

      // Cannoni laser alari
      _drawPanelLines(c, [[44, 36, 78, 36], [44, 92, 78, 92]], '#00d2ff');
    },

    // 4. Caccia Pesante: doppia fusoliera e cannoni alari rossi
    heavyFighter(c) {
      _drawCardBg(c, '#ff1744');
      _drawEngineGlow(c, 26, 46, 12, '#ff1744', Math.PI, 20);
      _drawEngineGlow(c, 26, 82, 12, '#ff1744', Math.PI, 20);

      // Ali angolate rinforzate
      _drawMetallicHull(c, (p) => {
        p.moveTo(34, 30);
        p.lineTo(58, 22);
        p.lineTo(84, 46);
        p.lineTo(84, 82);
        p.lineTo(58, 106);
        p.lineTo(34, 98);
      }, '#263238', '#90a4ae', '#ff5252');

      // Doppia fusoliera d'assalto
      _drawMetallicHull(c, (p) => {
        p.moveTo(26, 40); p.lineTo(104, 48); p.lineTo(96, 56); p.lineTo(26, 54);
        p.moveTo(26, 74); p.lineTo(96, 72); p.lineTo(104, 80); p.lineTo(26, 88);
      }, '#37474f', '#eceff1', '#ff1744');

      // Ponte centrale e cockpit rosso
      _drawMetallicHull(c, (p) => {
        p.moveTo(42, 52); p.lineTo(82, 58); p.lineTo(82, 70); p.lineTo(42, 76);
      }, '#1c2536', '#cfd8dc', '#ff1744');

      c.fillStyle = '#ff1744';
      c.fillRect(62, 60, 14, 8);

      // Bocche di fuoco rosse sulle punte
      _drawEngineGlow(c, 105, 48, 5, '#ff1744');
      _drawEngineGlow(c, 105, 80, 5, '#ff1744');
    },

    // 5. Incrociatore: lungo e slanciato con torrette dorsali e scia ionica
    cruiser(c) {
      _drawCardBg(c, '#00e5ff');
      _drawEngineGlow(c, 18, 56, 12, '#00e5ff', Math.PI, 16);
      _drawEngineGlow(c, 18, 72, 12, '#00e5ff', Math.PI, 16);

      // Scafo lungo e slanciato
      _drawMetallicHull(c, (p) => {
        p.moveTo(18, 50);
        p.lineTo(54, 42);
        p.lineTo(116, 58);
        p.lineTo(116, 70);
        p.lineTo(54, 86);
        p.lineTo(18, 78);
      }, '#2c3e50', '#cfd8dc', '#00e5ff');

      // Alette laterali a freccia
      _drawMetallicHull(c, (p) => {
        p.moveTo(32, 46); p.lineTo(22, 30); p.lineTo(62, 44);
        p.moveTo(32, 82); p.lineTo(22, 98); p.lineTo(62, 84);
      }, '#1c2833', '#90a4ae', '#00d2ff');

      // Torrette dorsali binate
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

    // 6. Nave da Battaglia: corazzata pesante con ponte centrale e batterie laterali
    battleship(c) {
      _drawCardBg(c, '#2979ff');
      [46, 64, 82].forEach((ey) => {
        _drawEngineGlow(c, 18, ey, 11, '#2979ff', Math.PI, 16);
      });

      // Corpo principale massiccio
      _drawMetallicHull(c, (p) => {
        p.moveTo(20, 40);
        p.lineTo(74, 34);
        p.lineTo(112, 50);
        p.lineTo(112, 78);
        p.lineTo(74, 94);
        p.lineTo(20, 88);
      }, '#263238', '#b0bec5', '#448aff');

      // Batterie laterali sporgenti
      _drawMetallicHull(c, (p) => {
        p.moveTo(42, 36); p.lineTo(48, 24); p.lineTo(82, 28); p.lineTo(86, 38);
        p.moveTo(42, 92); p.lineTo(48, 104); p.lineTo(82, 100); p.lineTo(86, 90);
      }, '#37474f', '#eceff1', '#00d2ff');

      // Ponte di comando centrale corazzato
      c.fillStyle = '#102027';
      c.strokeStyle = '#448aff';
      c.lineWidth = 1.5;
      c.fillRect(46, 52, 26, 24);
      c.strokeRect(46, 52, 26, 24);

      c.fillStyle = '#00e5ff';
      c.fillRect(66, 56, 4, 16);

      _drawPanelLines(c, [[84, 42, 84, 86], [98, 48, 98, 80]]);
    },

    // 7. Bombardiere: doppio scafo curvo largo con vani bombe al plasma luminosi
    bomber(c) {
      _drawCardBg(c, '#d500f9');
      _drawEngineGlow(c, 24, 44, 11, '#d500f9', Math.PI, 16);
      _drawEngineGlow(c, 24, 84, 11, '#d500f9', Math.PI, 16);

      // Doppio scafo curvo a mezzaluna
      _drawMetallicHull(c, (p) => {
        p.moveTo(26, 36);
        p.quadraticCurveTo(75, 16, 108, 48);
        p.lineTo(94, 56);
        p.lineTo(94, 72);
        p.lineTo(108, 80);
        p.quadraticCurveTo(75, 112, 26, 92);
        p.quadraticCurveTo(44, 64, 26, 36);
      }, '#2c1e4a', '#cfd8dc', '#e040fb');

      // Vani bombe al plasma luminosi
      [50, 64, 78].forEach((by) => {
        _drawEngineGlow(c, 74, by, 7, '#ff4081');
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(74, by, 2.2, 0, Math.PI * 2);
        c.fill();
      });
    },

    // 8. Incrociatore da Battaglia: design a punta di lancia, finiture oro/blu e reattori multipli
    battlecruiser(c) {
      _drawCardBg(c, '#ffd700');
      [48, 59, 69, 80].forEach((ey) => {
        _drawEngineGlow(c, 18, ey, 9, '#00e5ff', Math.PI, 18);
      });

      // Scafo d'élite a punta di lancia
      _drawMetallicHull(c, (p) => {
        p.moveTo(20, 44);
        p.lineTo(56, 26);
        p.lineTo(116, 64);
        p.lineTo(56, 102);
        p.lineTo(20, 84);
        p.lineTo(30, 64);
      }, '#1a237e', '#eceff1', '#ffd700');

      // Finiture dorate interne a freccia
      c.strokeStyle = '#ffd700';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(36, 48); c.lineTo(96, 64); c.lineTo(36, 80);
      c.stroke();

      // Nucleo energetico blu/oro
      _drawEngineGlow(c, 64, 64, 9, '#00e5ff');
      c.fillStyle = '#ffd700';
      c.beginPath();
      c.arc(64, 64, 3.5, 0, Math.PI * 2);
      c.fill();
    },

    // 9. Colonizzatrice: enorme vascello con cupola biosfera illuminata verde/azzurro al centro
    colonyShip(c) {
      _drawCardBg(c, '#00e676');
      _drawEngineGlow(c, 18, 52, 12, '#00e676', Math.PI, 16);
      _drawEngineGlow(c, 18, 76, 12, '#00e676', Math.PI, 16);

      // Struttura anello/vascello coloniale
      _drawMetallicHull(c, (p) => {
        p.moveTo(20, 44);
        p.lineTo(44, 34);
        p.lineTo(94, 38);
        p.lineTo(112, 64);
        p.lineTo(94, 90);
        p.lineTo(44, 94);
        p.lineTo(20, 84);
      }, '#263238', '#cfd8dc', '#00e676');

      // Grande cupola biosfera centrale
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

      // Nervature strutturali sulla cupola
      c.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(66, 64, 23, 9, 0, 0, Math.PI * 2);
      c.stroke();
    },

    // 10. Riciclatrice: nave industriale con chele/mandibole anteriori e raggio traente verde
    recycler(c) {
      _drawCardBg(c, '#00e676');
      _drawEngineGlow(c, 20, 54, 10, '#ff9100', Math.PI, 14);
      _drawEngineGlow(c, 20, 74, 10, '#ff9100', Math.PI, 14);

      // Corpo industriale + chele anteriori
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

      // Raggio traente verde tra le mandibole
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

      // Frammenti detriti catturati
      c.fillStyle = '#cfd8dc';
      c.fillRect(98, 58, 5, 4);
      c.fillRect(105, 67, 4, 5);
    },

    // 11. Sonda Spia: piccolo drone esagonale nero con lente sensore rossa luminosa
    espionageProbe(c) {
      _drawCardBg(c, '#ff1744');
      _drawEngineGlow(c, 26, 64, 10, '#00d2ff', Math.PI, 16);

      // Antenne telemetriche sottili
      c.strokeStyle = '#90a4ae';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(64, 42); c.lineTo(94, 24);
      c.moveTo(64, 86); c.lineTo(94, 104);
      c.moveTo(84, 64); c.lineTo(114, 64);
      c.stroke();

      // Corpo drone esagonale stealth scuro
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

      // Lente sensore ottico rosso luminoso
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

    // 12. Satellite Solare: nucleo centrale con due grandi pannelli fotovoltaici blu riflettenti
    solarSatellite(c) {
      _drawCardBg(c, '#ffea00');

      // Pannello fotovoltaico sinistro e destro
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

        // Griglia celle fotovoltaiche
        _drawPanelLines(c, [
          [x + w * 0.33, y, x + w * 0.33, y + h],
          [x + w * 0.66, y, x + w * 0.66, y + h],
          [x, y + h * 0.5, x + w, y + h * 0.5]
        ], 'rgba(128, 216, 255, 0.45)');
      };

      drawSolarWing(12, 46, 38, 36);
      drawSolarWing(78, 46, 38, 36);

      // Bracci di collegamento
      c.fillStyle = '#90a4ae';
      c.fillRect(50, 61, 28, 6);

      // Nucleo sferico energetico centrale
      _drawMetallicHull(c, (p) => {
        p.arc(64, 64, 14, 0, Math.PI * 2);
      }, '#37474f', '#eceff1', '#ffea00');

      _drawEngineGlow(c, 64, 64, 9, '#ffea00');
    },

    // 13. Nave Madre: colossale portaerei spaziale con hangar centrale aperto e luci di atterraggio
    mothership(c) {
      _drawCardBg(c, '#ffd700');
      [38, 52, 76, 90].forEach((ey) => {
        _drawEngineGlow(c, 14, ey, 11, '#00d2ff', Math.PI, 14);
      });

      // Scafo colossale portaerei
      _drawMetallicHull(c, (p) => {
        p.moveTo(16, 32);
        p.lineTo(68, 22);
        p.lineTo(114, 42);
        p.lineTo(114, 86);
        p.lineTo(68, 106);
        p.lineTo(16, 96);
      }, '#263238', '#cfd8dc', '#ffd700');

      // Hangar centrale aperto con ponte di volo illuminato
      c.fillStyle = '#050914';
      c.strokeStyle = '#00e5ff';
      c.lineWidth = 1.5;
      c.fillRect(42, 52, 72, 24);
      c.strokeRect(42, 52, 72, 24);

      // Luci pista di atterraggio
      [50, 64, 78, 92, 104].forEach((lx) => {
        c.fillStyle = '#ffd700';
        c.fillRect(lx, 55, 4, 2.5);
        c.fillRect(lx, 70.5, 4, 2.5);
      });

      _drawEngineGlow(c, 46, 64, 10, '#00e5ff');
    },

    // 14. Morte Nera: grande sfera corazzata con trincea equatoriale, paraboloide e superlaser
    deathStar(c) {
      _drawCardBg(c, '#00e676');
      const cx = 56, cy = 66, r = 42;

      // Sfera corazzata 3D
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

      // Trincea equatoriale
      c.strokeStyle = '#0b1016';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(cx - r, cy + 4);
      c.lineTo(cx + r, cy + 4);
      c.stroke();

      // Paraboloide concavo superlaser
      const dishX = cx + 14, dishY = cy - 16;
      c.fillStyle = '#263238';
      c.strokeStyle = '#00e676';
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(dishX, dishY, 13, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      // Raggio superlaser verde/rosso
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
    }
  };

  // =========================================================
  // RENDERERS: 10 DIFESE
  // =========================================================
  const DEFENSE_RENDERERS = {
    // 1. Lanciamissili: batteria lanciamissili multipla su base corazzata
    rocketLauncher(c) {
      _drawCardBg(c, '#ff9100');
      // Base corazzata planetaria
      _drawMetallicHull(c, (p) => {
        p.moveTo(24, 106); p.lineTo(36, 86); p.lineTo(92, 86); p.lineTo(104, 106);
      }, '#263238', '#90a4ae', '#ff9100');

      // Pod lanciamissili inclinato
      c.save();
      c.translate(64, 62);
      c.rotate(-0.45);
      _drawMetallicHull(c, (p) => {
        p.rect(-24, -18, 48, 36);
      }, '#37474f', '#cfd8dc', '#ff9100');

      // Tubi di lancio e testate
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

    // 2. Laser Leggero: torretta snella con singolo emettitore laser azzurro
    lightLaser(c) {
      _drawCardBg(c, '#00d2ff');
      // Piedistallo snello
      _drawMetallicHull(c, (p) => {
        p.moveTo(34, 106); p.lineTo(48, 76); p.lineTo(80, 76); p.lineTo(94, 106);
      }, '#263238', '#90a4ae', '#00d2ff');

      // Cupola torretta
      _drawMetallicHull(c, (p) => {
        p.arc(64, 68, 18, Math.PI, 0);
        p.lineTo(82, 76); p.lineTo(46, 76);
      }, '#37474f', '#eceff1', '#00d2ff');

      // Singola canna emitter
      c.strokeStyle = '#cfd8dc';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(72, 60); c.lineTo(108, 42);
      c.stroke();

      _drawEngineGlow(c, 109, 41, 8, '#00e5ff');
    },

    // 3. Laser Pesante: torretta rinforzata a doppia canna con condensatore luminoso
    heavyLaser(c) {
      _drawCardBg(c, '#00e5ff');
      // Base pesante
      _drawMetallicHull(c, (p) => {
        p.moveTo(26, 106); p.lineTo(38, 76); p.lineTo(90, 76); p.lineTo(102, 106);
      }, '#263238', '#90a4ae', '#00e5ff');

      // Torretta corazzata
      _drawMetallicHull(c, (p) => {
        p.moveTo(38, 76); p.lineTo(44, 52); p.lineTo(82, 52); p.lineTo(88, 76);
      }, '#37474f', '#eceff1', '#00e5ff');

      // Doppia canna rinforzata
      c.strokeStyle = '#eceff1';
      c.lineWidth = 4.5;
      c.beginPath();
      c.moveTo(76, 56); c.lineTo(112, 38);
      c.moveTo(80, 65); c.lineTo(115, 48);
      c.stroke();

      // Condensatore energetico centrale
      _drawEngineGlow(c, 60, 64, 9, '#00e5ff');
    },

    // 4. Cannone Gauss: lungo cannone elettromagnetico a rotaia con bobine blu elettrico
    gaussCannon(c) {
      _drawCardBg(c, '#2979ff');
      // Base torretta pesante
      _drawMetallicHull(c, (p) => {
        p.moveTo(22, 106); p.lineTo(34, 78); p.lineTo(88, 78); p.lineTo(98, 106);
      }, '#1c2636', '#78909c', '#448aff');

      // Rotaie parallele del railgun
      c.save();
      c.translate(52, 68);
      c.rotate(-0.36);
      _drawMetallicHull(c, (p) => {
        p.rect(-14, -12, 78, 8);
        p.rect(-14, 4, 78, 8);
      }, '#37474f', '#eceff1', '#448aff');

      // Bobine elettromagnetiche blu elettrico lungo le rotaie
      [6, 22, 38, 54].forEach((bx) => {
        c.fillStyle = '#00e5ff';
        c.fillRect(bx, -14, 5, 28);
      });
      _drawEngineGlow(c, 66, 0, 10, '#00e5ff');
      c.restore();
    },

    // 5. Cannone Ionico: torretta sferica con anelli magnetici e sfera di energia ciano
    ionCannon(c) {
      _drawCardBg(c, '#00e5ff');
      // Base
      _drawMetallicHull(c, (p) => {
        p.moveTo(32, 106); p.lineTo(44, 82); p.lineTo(84, 82); p.lineTo(96, 106);
      }, '#263238', '#90a4ae', '#00e5ff');

      // Anelli magnetici inclinati
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

      // Sfera di plasma ionico ciano al centro
      _drawEngineGlow(c, 64, 56, 20, '#00e5ff');
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(64, 56, 7, 0, Math.PI * 2);
      c.fill();
    },

    // 6. Torretta al Plasma: pesante torretta con nucleo al plasma viola/arancio incandescente
    plasmaTurret(c) {
      _drawCardBg(c, '#d500f9');
      // Base d'artiglieria massiccia
      _drawMetallicHull(c, (p) => {
        p.moveTo(20, 106); p.lineTo(32, 74); p.lineTo(96, 74); p.lineTo(108, 106);
      }, '#211738', '#90a4ae', '#e040fb');

      // Bocca da fuoco pesante
      _drawMetallicHull(c, (p) => {
        p.moveTo(46, 62); p.lineTo(98, 30); p.lineTo(108, 44); p.lineTo(58, 76);
      }, '#37474f', '#eceff1', '#ff9100');

      // Nucleo incandescente viola / arancio
      _drawEngineGlow(c, 58, 64, 18, '#d500f9');
      _drawEngineGlow(c, 104, 36, 12, '#ff9100');
    },

    // 7. Cupola Scudo Piccola: cupola semisferica traslucida azzurra su base planetaria
    smallShieldDome(c) {
      _drawCardBg(c, '#00d2ff');
      // Base planetaria
      _drawMetallicHull(c, (p) => {
        p.moveTo(16, 98); p.lineTo(28, 86); p.lineTo(100, 86); p.lineTo(112, 98);
      }, '#263238', '#90a4ae', '#00d2ff');

      // Generatore centrale
      _drawEngineGlow(c, 64, 82, 12, '#00e5ff');

      // Cupola semisferica traslucida azzurra
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

    // 8. Cupola Scudo Grande: doppia cupola di forza rinforzata con esagoni energetici dorati/azzurri
    largeShieldDome(c) {
      _drawCardBg(c, '#ffd700');
      // Base corazzata
      _drawMetallicHull(c, (p) => {
        p.moveTo(12, 100); p.lineTo(24, 86); p.lineTo(104, 86); p.lineTo(116, 100);
      }, '#263238', '#cfd8dc', '#ffd700');

      // Cupola interna azzurra
      c.fillStyle = 'rgba(0, 210, 255, 0.22)';
      c.strokeStyle = '#00e5ff';
      c.lineWidth = 1.6;
      c.beginPath();
      c.arc(64, 86, 36, Math.PI, 0);
      c.closePath();
      c.fill();
      c.stroke();

      // Cupola esterna dorata rinforzata
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

      // Esagoni energetici sulla cupola
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

    // 9. Missile Anti-Balistico: silo sotterraneo aperto con missile intercettore pronto al lancio
    antiBallisticMissile(c) {
      _drawCardBg(c, '#00e676');
      // Portelli del silo sotterraneo aperti
      _drawMetallicHull(c, (p) => {
        p.moveTo(16, 96); p.lineTo(44, 96); p.lineTo(34, 80); p.lineTo(16, 86);
        p.moveTo(112, 96); p.lineTo(84, 96); p.lineTo(94, 80); p.lineTo(112, 86);
      }, '#263238', '#90a4ae', '#00e676');

      // Bagliore accensione nel pozzo del silo
      _drawEngineGlow(c, 64, 94, 16, '#ff9100');

      // Missile intercettore verticale
      _drawMetallicHull(c, (p) => {
        p.moveTo(56, 88);
        p.lineTo(56, 42);
        p.lineTo(64, 22);
        p.lineTo(72, 42);
        p.lineTo(72, 88);
      }, '#37474f', '#ffffff', '#00e676');

      // Ogiva rossa/verde e alette
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

    // 10. Trappola Spaziale: mina spaziale galleggiante con aculei e nucleo pulsante rosso
    spaceTrap(c) {
      _drawCardBg(c, '#ff1744');
      const cx = 64, cy = 64;

      // 8 Aculei radiali metallici
      c.strokeStyle = '#cfd8dc';
      c.lineWidth = 3.2;
      for (let i = 0; i < 8; i++) {
        const ang = (Math.PI / 4) * i;
        c.beginPath();
        c.moveTo(cx + Math.cos(ang) * 20, cy + Math.sin(ang) * 20);
        c.lineTo(cx + Math.cos(ang) * 42, cy + Math.sin(ang) * 42);
        c.stroke();

        // Punta sensore rossa sull'aculeo
        c.fillStyle = '#ff1744';
        c.beginPath();
        c.arc(cx + Math.cos(ang) * 43, cy + Math.sin(ang) * 43, 2.5, 0, Math.PI * 2);
        c.fill();
      }

      // Sfera centrale corazzata
      _drawMetallicHull(c, (p) => {
        p.arc(cx, cy, 24, 0, Math.PI * 2);
      }, '#1c2230', '#78909c', '#ff1744');

      // Nucleo pulsante rosso
      _drawEngineGlow(c, cx, cy, 14, '#ff1744');
      c.fillStyle = '#ff5252';
      c.beginPath();
      c.arc(cx, cy, 6, 0, Math.PI * 2);
      c.fill();
    }
  };

  // =========================================================
  // RENDERERS: EDIFICI, LUNE, RICERCHE E RISORSE (STEP 2)
  // =========================================================
  const BUILDING_RENDERERS = {
    // [STEP 2: Qui inseriremo i 15 Edifici Planetari e le 4 Strutture Lunari]
  };

  const RESEARCH_RENDERERS = {
    // [STEP 2: Qui inseriremo le 13 Tecnologie / Ricerche]
  };

  const RESOURCE_AND_UI_RENDERERS = {
    // [STEP 2: Qui inseriremo Metallo, Cristallo, Deuterio, Energia, Pianeti e Icone HUD]
  };

  // =========================================================
  // FALLBACK GENERICO (solo per ID non ancora definiti in Step 2)
  // =========================================================
  function _renderFallbackEmblem(c, id) {
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
  // API PUBBLICA: window.UniversumGraphics
  // =========================================================
  const ALL_RENDERERS = Object.assign(
    {},
    SHIP_RENDERERS,
    DEFENSE_RENDERERS,
    BUILDING_RENDERERS,
    RESEARCH_RENDERERS,
    RESOURCE_AND_UI_RENDERERS
  );

  window.UniversumGraphics = {
    /**
     * Registra nuovi renderer modulari (usato nello Step 2)
     */
    registerRenderers(map) {
      Object.assign(ALL_RENDERERS, map);
    },

    /**
     * Espone gli helper interni per lo Step 2
     */
    helpers: {
      drawCardBg: _drawCardBg,
      drawMetallicHull: _drawMetallicHull,
      drawEngineGlow: _drawEngineGlow,
      drawPanelLines: _drawPanelLines
    },

    /**
     * Restituisce il DataURL PNG 128x128 (con cache istantanea in memoria)
     */
    getIconDataURL(id) {
      if (cache[id]) {
        return cache[id];
      }

      const renderer = ALL_RENDERERS[id];
      if (typeof renderer === 'function') {
        renderer(ctx);
      } else {
        _renderFallbackEmblem(ctx, id);
      }

      const dataURL = offscreenCanvas.toDataURL('image/png');
      cache[id] = dataURL;
      return dataURL;
    },

    /**
     * Restituisce il tag <img> pronto da inserire nell'HTML
     */
    getImgTag(id, alt = '', cssClass = 'unit-art') {
      const safeAlt = String(alt || id)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<img src="${this.getIconDataURL(id)}" alt="${safeAlt}" class="${cssClass}" loading="lazy">`;
    },

    /**
     * Svuota la cache (utile solo in fase di sviluppo)
     */
    clearCache() {
      for (const key of Object.keys(cache)) {
        delete cache[key];
      }
    }
  };
// =========================================================
  // STEP 2: 14 EDIFICI PLANETARI, 6 EDIFICI LUNARI, 18 RICERCHE E RISORSE
  // =========================================================
  (function extendUniversumGraphicsStep2() {
    const G = window.UniversumGraphics;
    if (!G || !G.helpers) return;

    const { drawCardBg, drawMetallicHull, drawEngineGlow, drawPanelLines } = G.helpers;

    // --- Helper specifici Step 2 ---

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

      // Crateri lunari
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

      // Sfondo blu profondo olografico
      const bg = c.createRadialGradient(64, 64, 8, 64, 64, 88);
      bg.addColorStop(0, '#071d3d');
      bg.addColorStop(1, '#020917');
      c.fillStyle = bg;
      c.fillRect(0, 0, 128, 128);

      // Griglia CAD blueprint fitta
      c.strokeStyle = 'rgba(0, 210, 255, 0.13)';
      c.lineWidth = 0.7;
      for (let i = 16; i < 128; i += 16) {
        c.beginPath();
        c.moveTo(i, 0); c.lineTo(i, 128);
        c.moveTo(0, i); c.lineTo(128, i);
        c.stroke();
      }

      // Cerchio olografico di riferimento
      c.strokeStyle = 'rgba(0, 229, 255, 0.28)';
      c.setLineDash([4, 4]);
      c.lineWidth = 1;
      c.beginPath();
      c.arc(64, 64, 46, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);

      // Angolari HUD
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
    // 1. TUTTI I 14 EDIFICI PLANETARI
    // =========================================================
    const PLANETARY_BUILDINGS = {
      // 1. Miniera di Metallo: grande trivella industriale con struttura a traliccio e scintille arancioni
      metalMine(c) {
        drawCardBg(c, '#00e676');
        _drawPlanetarySurface(c, '#16241d', '#00e676');

        // Torre a traliccio
        c.strokeStyle = '#90a4ae';
        c.lineWidth = 2.2;
        c.beginPath();
        c.moveTo(36, 94); c.lineTo(54, 24); c.lineTo(74, 24); c.lineTo(92, 94);
        c.moveTo(42, 72); c.lineTo(82, 50);
        c.moveTo(86, 72); c.lineTo(46, 50);
        c.moveTo(48, 46); c.lineTo(80, 46);
        c.stroke();

        // Testa motore superiore
        drawMetallicHull(c, (p) => {
          p.rect(48, 18, 32, 12);
        }, '#37474f', '#cfd8dc', '#00e676');

        // Grande punta trivella centrale
        drawMetallicHull(c, (p) => {
          p.moveTo(57, 30); p.lineTo(71, 30); p.lineTo(64, 96);
        }, '#455a64', '#ffffff', '#ff9100');

        // Filettatura trivella + scintille arancioni
        drawPanelLines(c, [[58, 44, 70, 50], [59, 58, 69, 64], [60, 72, 68, 78]], '#ff9100');
        drawEngineGlow(c, 64, 95, 13, '#ff9100');
        c.fillStyle = '#ffea00';
        [[52, 88], [76, 86], [48, 96], [80, 95]].forEach(([sx, sy]) => {
          c.fillRect(sx, sy, 2.5, 2.5);
        });
      },

      // 2. Miniera di Cristallo: estrattore laser puntato su formazioni cristalline azzurro brillante
      crystalMine(c) {
        drawCardBg(c, '#00d2ff');
        _drawPlanetarySurface(c, '#102030', '#00d2ff');

        // Formazioni cristalline azzurro brillante a destra
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

        // Estrattore laser a sinistra
        drawMetallicHull(c, (p) => {
          p.moveTo(18, 94); p.lineTo(24, 48); p.lineTo(48, 48); p.lineTo(54, 94);
        }, '#263238', '#b0bec5', '#00d2ff');

        // Emettitore laser puntato sui cristalli
        c.strokeStyle = '#00e5ff';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(46, 56);
        c.lineTo(86, 74);
        c.stroke();
        drawEngineGlow(c, 86, 74, 10, '#00e5ff');
      },

      // 3. Sintetizzatore di Deuterio: complesso di raffinazione con serbatoi cilindrici e condotti arancio neon
      deuteriumSynth(c) {
        drawCardBg(c, '#ff9100');
        _drawPlanetarySurface(c, '#241911', '#ff9100');

        // Due grandi serbatoi cilindrici
        [34, 62].forEach((tx) => {
          drawMetallicHull(c, (p) => {
            p.roundRect(tx, 34, 22, 60, 8);
          }, '#37474f', '#cfd8dc', '#ff9100');
          // Finestra livello deuterio
          c.fillStyle = '#ff9100';
          c.fillRect(tx + 8, 48, 6, 36);
        });

        // Torre di frazionamento alta a destra
        drawMetallicHull(c, (p) => {
          p.rect(90, 22, 16, 72);
        }, '#263238', '#90a4ae', '#ff9100');

        // Condotti arancio neon di collegamento
        c.strokeStyle = '#ff9100';
        c.lineWidth = 2.6;
        c.beginPath();
        c.moveTo(56, 46); c.lineTo(62, 46);
        c.moveTo(84, 42); c.lineTo(90, 42);
        c.moveTo(84, 72); c.lineTo(90, 72);
        c.stroke();
      },

      // 4. Centrale Solare: schiera di grandi pannelli solari con riflessi dorati
      solarPlant(c) {
        drawCardBg(c, '#ffea00');
        _drawPlanetarySurface(c, '#1c1d12', '#ffea00');

        // Torre centrale
        drawMetallicHull(c, (p) => {
          p.moveTo(56, 94); p.lineTo(60, 44); p.lineTo(68, 44); p.lineTo(72, 94);
        }, '#37474f', '#eceff1', '#ffea00');

        // Due grandi ali fotovoltaiche inclinate con riflessi dorati
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
          drawPanelLines(c, [[w * 0.5, 0, w * 0.5, h], [0, h * 0.5, w, h * 0.5]], 'rgba(255,255,255,0.45)');
          c.restore();
        };

        drawPanel(14, 38, 42, 28, -0.18);
        drawPanel(72, 31, 42, 28, 0.18);
        drawEngineGlow(c, 64, 42, 11, '#ffea00');
      },

      // 5. Reattore a Fusione: reattore toroidale (tokamak) con anello di plasma incandescente al centro
      fusionReactor(c) {
        drawCardBg(c, '#00e5ff');
        _drawPlanetarySurface(c, '#121d2b', '#00e5ff');

        // Struttura esterna tokamak
        drawMetallicHull(c, (p) => {
          p.ellipse(64, 58, 44, 28, 0, 0, Math.PI * 2);
        }, '#263238', '#90a4ae', '#00e5ff');

        // Cavità centrale e anello di plasma incandescente
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

        // Colonna centrale del tokamak
        drawMetallicHull(c, (p) => {
          p.rect(57, 30, 14, 58);
        }, '#37474f', '#eceff1', '#00e5ff');
      },

      // 6. Cantiere Navale: grande bacino di costruzione orbitale con gru meccaniche e scafo in assemblaggio
      shipyard(c) {
        drawCardBg(c, '#00d2ff');
        _drawPlanetarySurface(c, '#111827', '#00d2ff');

        // Portale/bacino di assemblaggio ad arco
        drawMetallicHull(c, (p) => {
          p.moveTo(20, 94); p.lineTo(20, 30); p.lineTo(108, 30); p.lineTo(108, 94);
          p.lineTo(94, 94); p.lineTo(94, 42); p.lineTo(34, 42); p.lineTo(34, 94);
        }, '#263238', '#b0bec5', '#00d2ff');

        // Scafo di nave sospeso in assemblaggio al centro
        drawMetallicHull(c, (p) => {
          p.moveTo(42, 68); p.lineTo(66, 56); p.lineTo(88, 68); p.lineTo(66, 78);
        }, '#455a64', '#eceff1', '#ff9100');

        // Bracci gru e scintille di saldatura
        c.strokeStyle = '#ff9100';
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(46, 42); c.lineTo(56, 62);
        c.moveTo(82, 42); c.lineTo(74, 62);
        c.stroke();
        drawEngineGlow(c, 56, 62, 7, '#00e5ff');
        drawEngineGlow(c, 74, 62, 7, '#ff9100');
      },

      // 7. Fabbrica dei Robot: bracci robotici automatizzati con saldatura laser blu
      roboticsFactory(c) {
        drawCardBg(c, '#2979ff');
        _drawPlanetarySurface(c, '#121929', '#448aff');

        // Base officina
        drawMetallicHull(c, (p) => {
          p.rect(24, 82, 80, 14);
        }, '#263238', '#90a4ae', '#448aff');

        // Due bracci robotici articolati
        c.strokeStyle = '#cfd8dc';
        c.lineWidth = 5;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(36, 82); c.lineTo(30, 52); c.lineTo(54, 46);
        c.moveTo(92, 82); c.lineTo(98, 52); c.lineTo(74, 46);
        c.stroke();

        // Giunti meccanici
        [[30, 52], [98, 52]].forEach(([jx, jy]) => {
          c.fillStyle = '#448aff';
          c.beginPath();
          c.arc(jx, jy, 4.5, 0, Math.PI * 2);
          c.fill();
        });

        // Punto di saldatura laser blu al centro
        drawEngineGlow(c, 64, 52, 16, '#00e5ff');
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(64, 52, 3.5, 0, Math.PI * 2);
        c.fill();
      },

      // 8. Fabbrica di Naniti: sciame di nanobot luminosi che assemblano una struttura molecolare
      naniteFactory(c) {
        drawCardBg(c, '#d500f9');
        _drawPlanetarySurface(c, '#1b1129', '#e040fb');

        // Reticolo molecolare/cubico in costruzione al centro
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
          drawEngineGlow(c, nx, ny, 7, '#00e5ff');
        }

        // Sciame di nanobot luminosi attorno
        const swarm = [[26, 40], [102, 38], [24, 68], [104, 70], [40, 26], [88, 26]];
        for (const [sx, sy] of swarm) {
          c.fillStyle = '#ffea00';
          c.fillRect(sx, sy, 3, 3);
        }
      },

      // 9. Laboratorio di Ricerca: cupola scientifica con antenna e ologramma atomico fluttuante
      researchLab(c) {
        drawCardBg(c, '#00e5ff');
        _drawPlanetarySurface(c, '#101d2e', '#00e5ff');

        // Cupola scientifica principale
        drawMetallicHull(c, (p) => {
          p.arc(64, 86, 34, Math.PI, 0);
          p.lineTo(98, 94); p.lineTo(30, 94);
        }, '#263238', '#eceff1', '#00e5ff');

        // Ologramma atomico fluttuante sopra la cupola
        const ay = 34;
        drawEngineGlow(c, 64, ay, 12, '#00e5ff');
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

      // 10. Deposito di Metallo: silos cilindrici con barra livello verde #00e676
      metalStorage(c) {
        drawCardBg(c, '#00e676');
        _drawPlanetarySurface(c, '#13211a', '#00e676');

        [28, 68].forEach((sx) => {
          drawMetallicHull(c, (p) => {
            p.roundRect(sx, 36, 32, 58, 6);
          }, '#263238', '#b0bec5', '#00e676');
          // Barra livello verde neon
          c.fillStyle = '#09120e';
          c.fillRect(sx + 12, 44, 8, 42);
          c.fillStyle = '#00e676';
          c.fillRect(sx + 13, 54, 6, 31);
        });
      },

      // 11. Deposito di Cristallo: serbatoi sfaccettati con barra livello azzurra #00d2ff
      crystalStorage(c) {
        drawCardBg(c, '#00d2ff');
        _drawPlanetarySurface(c, '#101f2e', '#00d2ff');

        [28, 68].forEach((sx) => {
          drawMetallicHull(c, (p) => {
            p.moveTo(sx + 8, 34); p.lineTo(sx + 24, 34);
            p.lineTo(sx + 32, 46); p.lineTo(sx + 32, 94);
            p.lineTo(sx, 94); p.lineTo(sx, 46);
          }, '#263238', '#cfd8dc', '#00d2ff');
          // Barra livello azzurra
          c.fillStyle = '#07111a';
          c.fillRect(sx + 12, 44, 8, 42);
          c.fillStyle = '#00d2ff';
          c.fillRect(sx + 13, 52, 6, 33);
        });
      },

      // 12. Cisterna di Deuterio: serbatoi sferici pressurizzati con barra livello arancione #ff9100
      deuteriumTank(c) {
        drawCardBg(c, '#ff9100');
        _drawPlanetarySurface(c, '#211810', '#ff9100');

        [42, 86].forEach((cx) => {
          drawMetallicHull(c, (p) => {
            p.arc(cx, 62, 20, 0, Math.PI * 2);
          }, '#37474f', '#cfd8dc', '#ff9100');
          // Supporti + barra livello arancione
          c.fillStyle = '#ff9100';
          c.fillRect(cx - 3, 49, 6, 26);
          c.fillRect(cx - 10, 82, 20, 12);
        });
      },

      // 13. Terraformer: macchina atmosferica gigante con torri che generano nubi e terra verde
      terraformer(c) {
        drawCardBg(c, '#00e676');
        _drawPlanetarySurface(c, '#004d40', '#00e676');

        // Vegetazione/terra verde sulla superficie
        c.fillStyle = '#00e676';
        c.beginPath();
        c.ellipse(64, 92, 48, 6, 0, 0, Math.PI * 2);
        c.fill();

        // Due grandi torri atmosferiche
        [36, 76].forEach((tx) => {
          drawMetallicHull(c, (p) => {
            p.moveTo(tx, 90); p.lineTo(tx + 4, 42); p.lineTo(tx + 12, 42); p.lineTo(tx + 16, 90);
          }, '#37474f', '#eceff1', '#00e676');
          drawEngineGlow(c, tx + 8, 36, 12, '#84ffff');
        });

        // Nubi atmosferiche generate
        c.fillStyle = 'rgba(132, 255, 255, 0.25)';
        c.beginPath();
        c.arc(52, 26, 14, 0, Math.PI * 2);
        c.arc(68, 24, 16, 0, Math.PI * 2);
        c.arc(82, 28, 12, 0, Math.PI * 2);
        c.fill();
      },

      // 14. Bunker Sotterraneo Nascosto: portellone corazzato con simbolo scudo/lucchetto neon
      hiddenBunker(c) {
        drawCardBg(c, '#ffea00');
        _drawPlanetarySurface(c, '#1a1a22', '#ffea00');

        // Portellone corazzato incassato
        drawMetallicHull(c, (p) => {
          p.moveTo(24, 96); p.lineTo(32, 44); p.lineTo(96, 44); p.lineTo(104, 96);
        }, '#1c222d', '#78909c', '#ffea00');

        // Linea chiusura centrale
        drawPanelLines(c, [[64, 44, 64, 96]], '#ffea00');

        // Simbolo scudo/lucchetto neon al centro
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
        drawEngineGlow(c, 64, 68, 9, '#ffea00');
      }
    };

    // =========================================================
    // 2. TUTTI I 6 EDIFICI LUNARI (su superficie grigia craterizzata)
    // =========================================================
    const MOON_BUILDINGS = {
      // 1. Base Lunare: cupola pressurizzata multipla su cratere lunare
      lunarBase(c) {
        drawCardBg(c, '#00d2ff');
        _drawLunarSurface(c, '#cfd8dc');

        // Cupola laterale sinistra e destra
        drawMetallicHull(c, (p) => {
          p.arc(36, 88, 16, Math.PI, 0);
        }, '#37474f', '#b0bec5', '#00d2ff');
        drawMetallicHull(c, (p) => {
          p.arc(92, 88, 16, Math.PI, 0);
        }, '#37474f', '#b0bec5', '#00d2ff');

        // Cupola pressurizzata centrale principale
        drawMetallicHull(c, (p) => {
          p.arc(64, 88, 28, Math.PI, 0);
        }, '#455a64', '#eceff1', '#00e5ff');

        // Oblò luminosi
        [52, 64, 76].forEach((ox) => {
          c.fillStyle = '#00e5ff';
          c.fillRect(ox - 2, 74, 4, 4);
        });
      },

      // 2. Deposito Lunare: serbatoi blindati a bassa gravità su suolo lunare
      lunarStorage(c) {
        drawCardBg(c, '#b0bec5');
        _drawLunarSurface(c, '#eceff1');

        // Tre moduli blindati sferico-cilindrici
        [32, 64, 96].forEach((mx, idx) => {
          drawMetallicHull(c, (p) => {
            p.roundRect(mx - 12, 52 - (idx === 1 ? 8 : 0), 24, 38 + (idx === 1 ? 8 : 0), 10);
          }, '#263238', '#cfd8dc', '#00d2ff');
        });
      },

      // 3. Generatore Scudo Lunare: generatore di campo di forza lunare viola/azzurro
      lunarShield(c) {
        drawCardBg(c, '#d500f9');
        _drawLunarSurface(c, '#e040fb');

        // Nucleo emettitore
        drawMetallicHull(c, (p) => {
          p.moveTo(48, 88); p.lineTo(56, 68); p.lineTo(72, 68); p.lineTo(80, 88);
        }, '#263238', '#cfd8dc', '#e040fb');

        drawEngineGlow(c, 64, 64, 14, '#d500f9');

        // Cupola energetica viola/azzurro
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

      // 4. Cantiere Segreto Lunare: hangar nascosto dentro un cratere con luci tattiche rosse
      secretShipyard(c) {
        drawCardBg(c, '#ff1744');
        _drawLunarSurface(c, '#ff5252');

        // Bocca hangar corazzata incassata nel cratere
        drawMetallicHull(c, (p) => {
          p.moveTo(22, 92); p.lineTo(34, 58); p.lineTo(94, 58); p.lineTo(106, 92);
        }, '#181e28', '#78909c', '#ff1744');

        c.fillStyle = '#05070d';
        c.fillRect(40, 68, 48, 22);

        // Luci tattiche rosse di segnalazione
        [34, 64, 94].forEach((lx) => {
          drawEngineGlow(c, lx, 62, 6, '#ff1744');
        });
      },

      // 5. Portale Iperspaziale: grande anello portale con vortice energetico viola/blu al centro
      jumpGate(c) {
        drawCardBg(c, '#d500f9');
        _drawLunarSurface(c, '#00d2ff');

        const cx = 64, cy = 54, r = 34;

        // Vortice energetico viola/blu interno
        const vGrad = c.createRadialGradient(cx, cy, 2, cx, cy, r - 4);
        vGrad.addColorStop(0, '#ffffff');
        vGrad.addColorStop(0.3, '#00e5ff');
        vGrad.addColorStop(0.7, '#aa00ff');
        vGrad.addColorStop(1, 'rgba(10, 14, 32, 0.9)');
        c.fillStyle = vGrad;
        c.beginPath();
        c.arc(cx, cy, r - 4, 0, Math.PI * 2);
        c.fill();

        // Grande anello metallico del portale
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

      // 6. Falange Sensoriale: grande radiotelescopio parabolico che emette onde radar verdi
      sensorPhalanx(c) {
        drawCardBg(c, '#00e676');
        _drawLunarSurface(c, '#00e676');

        // Base radiotelescopio
        drawMetallicHull(c, (p) => {
          p.moveTo(36, 90); p.lineTo(46, 72); p.lineTo(66, 72); p.lineTo(74, 90);
        }, '#263238', '#90a4ae', '#00e676');

        // Parabola orientata in alto a destra
        c.save();
        c.translate(58, 62);
        c.rotate(-0.65);
        c.strokeStyle = '#eceff1';
        c.lineWidth = 4;
        c.beginPath();
        c.arc(0, 0, 26, 0.15 * Math.PI, 0.85 * Math.PI);
        c.stroke();

        // Ricevitore centrale parabola
        c.strokeStyle = '#00e676';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(0, 26); c.lineTo(0, 4);
        c.stroke();
        c.restore();

        // Onde radar verdi emesse
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
    // 3. TUTTE LE 18 RICERCHE (Stile Olografico Blueprint)
    // =========================================================
    const RESEARCH_TECHS = {
      // 1. Tecnologia Energetica: atomo olografico
      energyTech(c) {
        _drawBlueprintBg(c, '#ffea00');
        drawEngineGlow(c, 64, 64, 14, '#ffea00');
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

      // 2. Tecnologia Laser: prisma ottico e fascio laser concentrato
      laserTech(c) {
        _drawBlueprintBg(c, '#00e5ff');
        c.strokeStyle = '#84ffff';
        c.lineWidth = 2.2;
        c.beginPath();
        c.moveTo(30, 84); c.lineTo(54, 42); c.lineTo(78, 84); c.closePath();
        c.stroke();

        // Fascio laser
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

      // 3. Tecnologia Ionica: onda sinusoidale ionica ad alta frequenza
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
        drawEngineGlow(c, 64, 64, 12, '#00e5ff');
      },

      // 4. Tecnologia al Plasma: sfera di plasma contenuta da anelli magnetici
      plasmaTech(c) {
        _drawBlueprintBg(c, '#d500f9');
        drawEngineGlow(c, 64, 64, 24, '#d500f9');
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

      // 5. Tecnologia Iperspaziale: griglia spaziotemporale piegata (wormhole)
      hyperspaceTech(c) {
        _drawBlueprintBg(c, '#7c4dff');
        c.strokeStyle = '#b388ff';
        c.lineWidth = 1.8;
        [14, 24, 34, 44].forEach((r) => {
          c.beginPath();
          c.ellipse(64, 64, r, r * 0.62, 0.35, 0, Math.PI * 2);
          c.stroke();
        });
        drawEngineGlow(c, 64, 64, 11, '#00e5ff');
      },

      // 6. Propulsore a Combustione: ugello reattore chimico con fiamma vettrice
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
        drawEngineGlow(c, 64, 88, 16, '#ff9100');
      },

      // 7. Propulsore a Impulso: turbina ionica con scia azzurra ad impulsi
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
        drawEngineGlow(c, 64, 88, 14, '#00e5ff');
      },

      // 8. Propulsore Iperspaziale: vettore stella/iperspazio ad altissima velocità
      hyperspaceDrive(c) {
        _drawBlueprintBg(c, '#00e5ff');
        c.strokeStyle = '#84ffff';
        c.lineWidth = 2.2;
        c.beginPath();
        c.moveTo(64, 22); c.lineTo(88, 78); c.lineTo(64, 66); c.lineTo(40, 78);
        c.closePath();
        c.stroke();
        drawEngineGlow(c, 64, 86, 18, '#d500f9');
      },

      // 9. Tecnologia delle Armi: mirino balistico di precisione
      weaponsTech(c) {
        _drawBlueprintBg(c, '#ff1744');
        c.strokeStyle = '#ff5252';
        c.lineWidth = 2.2;
        c.beginPath();
        c.arc(64, 64, 30, 0, Math.PI * 2);
        c.moveTo(64, 24); c.lineTo(64, 104);
        c.moveTo(24, 64); c.lineTo(104, 64);
        c.stroke();
        drawEngineGlow(c, 64, 64, 9, '#ff1744');
      },

      // 10. Tecnologia degli Scudi: esagono deflettore multistrato
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

      // 11. Tecnologia delle Corazze: piastra corazzata stratificata
      armourTech(c) {
        _drawBlueprintBg(c, '#00e676');
        c.strokeStyle = '#00e676';
        c.lineWidth = 2.2;
        c.beginPath();
        c.moveTo(64, 26); c.lineTo(96, 40); c.lineTo(90, 82); c.lineTo(64, 102);
        c.lineTo(38, 82); c.lineTo(32, 40);
        c.closePath();
        c.stroke();
        drawPanelLines(c, [[44, 52, 84, 52], [46, 68, 82, 68]], '#00e676');
      },

      // 12. Tecnologia dello Spionaggio: occhio radar cibernetico
      espionageTech(c) {
        _drawBlueprintBg(c, '#ff1744');
        c.strokeStyle = '#00e5ff';
        c.lineWidth = 2.2;
        c.beginPath();
        c.moveTo(22, 64);
        c.quadraticCurveTo(64, 30, 106, 64);
        c.quadraticCurveTo(64, 98, 22, 64);
        c.stroke();
        drawEngineGlow(c, 64, 64, 14, '#ff1744');
      },

      // 13. Tecnologia Informatica: microchip quantico con pin
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

      // 14. Astrofisica: sistema solare con orbite planetarie
      astrophysics(c) {
        _drawBlueprintBg(c, '#00e676');
        drawEngineGlow(c, 64, 64, 13, '#ffea00');
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

      // 15. Rete Intergalattica di Ricerca: grafo di nodi connessi
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
          drawEngineGlow(c, px, py, 7, '#00e676');
        }
      },

      // 16. Tecnologia Portale Iperspaziale: doppio anello vettoriale con asse di salto
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
        drawEngineGlow(c, 64, 64, 12, '#d500f9');
      },

      // 17. Ingegneria Lunare: falce di luna olografica con reticolo gravitazionale
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

      // 18. Progetto Morte Nera (Gravitone): schema blueprint della sfera e del superlaser
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

        // Raggio superlaser blueprint
        c.strokeStyle = '#ff1744';
        c.lineWidth = 2.5;
        c.beginPath();
        c.moveTo(72, 52); c.lineTo(112, 22);
        c.stroke();
      }
    };

    // Registra tutte le nuove illustrazioni 128x128 nel motore centrale
    G.registerRenderers(
      Object.assign({}, PLANETARY_BUILDINGS, MOON_BUILDINGS, RESEARCH_TECHS)
    );

    // =========================================================
    // 4. ICONE RISORSE 32x32 PX (getResourceIcon)
    // =========================================================
    const resourceCache = {};
    const resCanvas = document.createElement('canvas');
    resCanvas.width = 32;
    resCanvas.height = 32;
    const rCtx = resCanvas.getContext('2d');

    function _renderResource32(type) {
      rCtx.clearRect(0, 0, 32, 32);

      if (type === 'metal') {
        // Lingotto / piastra metallica verde neon #00e676
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
        // Gemma sfaccettata azzurra #00d2ff
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
        // Capsula / isotopo energetico arancione #ff9100
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

        // Anelli di contenimento
        rCtx.strokeStyle = '#ffffff';
        rCtx.lineWidth = 1.2;
        rCtx.beginPath();
        rCtx.moveTo(9, 11); rCtx.lineTo(23, 11);
        rCtx.moveTo(9, 21); rCtx.lineTo(23, 21);
        rCtx.stroke();
      } else {
        // 'energy': fulmine / nucleo energetico giallo #ffea00
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

    /**
     * Restituisce un tag <img> nitido 32x32 px (con cache) per 'metal', 'crystal', 'deuterium', 'energy'
     */
    G.getResourceIcon = function (type, cssClass = 'res-icon') {
      const key = String(type || 'metal').toLowerCase();
      if (!resourceCache[key]) {
        resourceCache[key] = _renderResource32(key);
      }
      return `<img src="${resourceCache[key]}" alt="${key}" class="${cssClass}" width="18" height="18">`;
    };
  })();
})();
