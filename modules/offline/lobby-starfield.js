/** UNIVERSUM / offline/lobby-starfield.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';


  // =========================================================
  // MOTORE GRAFICO STARFIELD (SFONDO SPAZIALE NOTTURNO)
  // =========================================================
  function initStarfield() {
    const canvas = document.getElementById('starfield');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let lastFrame = 0;
    const frameInterval = 1000 / 24;
    let nebulaLayer = document.createElement('canvas');
    let nebulaCtx = nebulaLayer.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const starColors = ['#ffffff', '#cce8ff', '#70c4ff', '#b388ff', '#e1f5fe'];
    const numStars = Math.min(220, Math.floor((width * height) / 6500));
    const stars = [];

    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.5 + 0.3,
        color: starColors[Math.floor(Math.random() * starColors.length)],
        alpha: Math.random() * 0.8 + 0.2,
        speed: (Math.random() * 0.015 + 0.004) * (Math.random() < 0.5 ? 1 : -1)
      });
    }

    // Le nebulose sono statiche: disegnate solo all'avvio e dopo resize.
    function rebuildNebulaLayer() {
      nebulaLayer.width = width;
      nebulaLayer.height = height;
      nebulaCtx.fillStyle = '#02020a';
      nebulaCtx.fillRect(0, 0, width, height);
      const neb1 = nebulaCtx.createRadialGradient(width * 0.2, height * 0.3, 10, width * 0.2, height * 0.3, width * 0.55);
      neb1.addColorStop(0, 'rgba(14, 28, 72, 0.28)');
      neb1.addColorStop(1, 'rgba(2, 2, 10, 0)');
      nebulaCtx.fillStyle = neb1;
      nebulaCtx.fillRect(0, 0, width, height);
      const neb2 = nebulaCtx.createRadialGradient(width * 0.8, height * 0.75, 10, width * 0.8, height * 0.75, width * 0.5);
      neb2.addColorStop(0, 'rgba(42, 12, 68, 0.22)');
      neb2.addColorStop(1, 'rgba(2, 2, 10, 0)');
      nebulaCtx.fillStyle = neb2;
      nebulaCtx.fillRect(0, 0, width, height);
    }
    rebuildNebulaLayer();
    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      rebuildNebulaLayer();
    });

    function render(timestamp = 0) {
      requestAnimationFrame(render);
      if (document.hidden || timestamp - lastFrame < frameInterval) return;
      lastFrame = timestamp;
      ctx.drawImage(nebulaLayer, 0, 0);
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.alpha += s.speed;
        if (s.alpha >= 1) {
          s.alpha = 1;
          s.speed = -Math.abs(s.speed);
        } else if (s.alpha <= 0.18) {
          s.alpha = 0.18;
          s.speed = Math.abs(s.speed);
        }

        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    requestAnimationFrame(render);
  }
  window.UniversumLobbyStarfield = { start: initStarfield };

})();
