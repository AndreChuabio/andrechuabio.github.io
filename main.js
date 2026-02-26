'use strict';

/* ===================================================
   UTILITY
=================================================== */

/**
 * Fit a canvas to its CSS size with devicePixelRatio scaling.
 * @param {HTMLCanvasElement} canvas
 */
function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = Math.round(rect.width  * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}

/** Logical width of canvas in CSS pixels. */
function cw(canvas) {
  return canvas.getBoundingClientRect().width;
}

/** Logical height of canvas in CSS pixels. */
function ch(canvas) {
  return canvas.getBoundingClientRect().height;
}

/** Box-Muller normal sample. */
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ===================================================
   1. GEOMETRIC BROWNIAN MOTION
=================================================== */

(function gbmAnimation() {
  const canvas = document.getElementById('gbm');
  if (!canvas) return;

  const PATHS      = 8;
  const STEPS      = 120;
  const MU         = 0.0003;
  const SIGMA      = 0.018;
  const PAUSE_F    = 30;

  const COLORS = [
    '#2d6a4f', '#40916c', '#52b788', '#74c69d',
    '#95d5b2', '#b7e4c7', '#1b4332', '#081c15',
  ];

  let ctx, W, H;
  let paths   = [];
  let step    = 0;
  let pause   = 0;
  let raf     = null;

  function buildPaths() {
    paths = [];
    for (let p = 0; p < PATHS; p++) {
      const arr = [1.0];
      for (let i = 1; i <= STEPS; i++) {
        const prev = arr[i - 1];
        arr.push(prev * Math.exp((MU - 0.5 * SIGMA * SIGMA) + SIGMA * randn()));
      }
      paths.push(arr);
    }
  }

  function yScale(val, minV, maxV) {
    return H - ((val - minV) / (maxV - minV)) * H * 0.85 - H * 0.075;
  }

  function init() {
    ctx = fitCanvas(canvas);
    W   = cw(canvas);
    H   = ch(canvas);
    buildPaths();
    step  = 0;
    pause = 0;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // compute global min/max across all paths up to current step
    let minV = Infinity, maxV = -Infinity;
    for (const p of paths) {
      for (let i = 0; i <= Math.min(step, STEPS); i++) {
        if (p[i] < minV) minV = p[i];
        if (p[i] > maxV) maxV = p[i];
      }
    }
    if (maxV === minV) maxV = minV + 0.01;

    const xStep = W / STEPS;

    for (let pi = 0; pi < PATHS; pi++) {
      const path = paths[pi];
      const col  = COLORS[pi % COLORS.length];
      const len  = Math.min(step + 1, STEPS + 1);

      ctx.beginPath();
      ctx.strokeStyle = col;
      ctx.lineWidth   = 1.5;
      ctx.globalAlpha = 0.8;

      for (let i = 0; i < len; i++) {
        const x = i * xStep;
        const y = yScale(path[i], minV, maxV);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  function tick() {
    if (step < STEPS) {
      step++;
      draw();
    } else if (pause < PAUSE_F) {
      pause++;
    } else {
      init();
    }
    raf = requestAnimationFrame(tick);
  }

  init();
  raf = requestAnimationFrame(tick);

  // expose reset for resize
  window._gbmReset = function () {
    if (raf) cancelAnimationFrame(raf);
    init();
    raf = requestAnimationFrame(tick);
  };
}());

/* ===================================================
   2. ORNSTEIN-UHLENBECK MEAN REVERSION
=================================================== */

(function ouAnimation() {
  const canvas = document.getElementById('ou');
  if (!canvas) return;

  const STEPS   = 200;
  const THETA   = 0.08;
  const SIGMA   = 0.3;
  const MU      = 0;          // long-run mean
  const DT      = 1;
  const PAUSE_F = 30;

  let ctx, W, H;
  let series = [];
  let step   = 0;
  let pause  = 0;
  let raf    = null;

  function buildSeries() {
    series = [0.5 * (Math.random() - 0.5) * 4];
    for (let i = 1; i <= STEPS; i++) {
      const prev = series[i - 1];
      series.push(
        prev + THETA * (MU - prev) * DT + SIGMA * Math.sqrt(DT) * randn()
      );
    }
  }

  function init() {
    ctx = fitCanvas(canvas);
    W   = cw(canvas);
    H   = ch(canvas);
    buildSeries();
    step  = 0;
    pause = 0;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    const len  = Math.min(step + 1, STEPS + 1);
    const sub  = series.slice(0, len);
    const minV = Math.min(...sub) - 0.1;
    const maxV = Math.max(...sub) + 0.1;

    const xStep = W / STEPS;

    // mean line
    const meanY = H - ((MU - minV) / (maxV - minV)) * H * 0.85 - H * 0.075;
    ctx.beginPath();
    ctx.strokeStyle = '#e5e5e5';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);
    ctx.moveTo(0, meanY);
    ctx.lineTo(W, meanY);
    ctx.stroke();
    ctx.setLineDash([]);

    // path
    ctx.beginPath();
    ctx.strokeStyle = '#2d6a4f';
    ctx.lineWidth   = 2;
    for (let i = 0; i < len; i++) {
      const x = i * xStep;
      const y = H - ((series[i] - minV) / (maxV - minV)) * H * 0.85 - H * 0.075;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // fill under
    ctx.beginPath();
    for (let i = 0; i < len; i++) {
      const x = i * xStep;
      const y = H - ((series[i] - minV) / (maxV - minV)) * H * 0.85 - H * 0.075;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.lineTo((len - 1) * xStep, meanY);
    ctx.lineTo(0, meanY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(45,106,79,0.06)';
    ctx.fill();
  }

  function tick() {
    if (step < STEPS) {
      step++;
      draw();
    } else if (pause < PAUSE_F) {
      pause++;
    } else {
      init();
    }
    raf = requestAnimationFrame(tick);
  }

  init();
  raf = requestAnimationFrame(tick);

  window._ouReset = function () {
    if (raf) cancelAnimationFrame(raf);
    init();
    raf = requestAnimationFrame(tick);
  };
}());

/* ===================================================
   3. NEURAL NETWORK FORWARD PASS
=================================================== */

(function nnAnimation() {
  const canvas = document.getElementById('nn');
  if (!canvas) return;

  const LAYERS    = [3, 4, 4, 2];
  const TICKS_PER = 28;   // ticks to animate each layer activation
  const PAUSE_F   = 40;

  let ctx, W, H;
  let activations = [];   // per-layer activation strengths [0..1]
  let layerTick   = 0;    // which layer is animating
  let tickInLayer = 0;
  let pause       = 0;
  let raf         = null;

  function randActivations() {
    activations = LAYERS.map(n => Array.from({ length: n }, () => Math.random()));
  }

  function init() {
    ctx = fitCanvas(canvas);
    W   = cw(canvas);
    H   = ch(canvas);
    randActivations();
    layerTick   = 0;
    tickInLayer = 0;
    pause       = 0;
  }

  /** Map layer/node indices to canvas coordinates. */
  function nodePos(li, ni) {
    const totalLayers = LAYERS.length;
    const xPad = W * 0.12;
    const x = xPad + (li / (totalLayers - 1)) * (W - 2 * xPad);

    const n   = LAYERS[li];
    const yPad = H * 0.12;
    const gap  = (H - 2 * yPad) / (n - 1 || 1);
    const y    = n === 1 ? H / 2 : yPad + ni * gap;
    return { x, y };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    const progress = Math.min(tickInLayer / TICKS_PER, 1);

    // edges
    for (let li = 0; li < LAYERS.length - 1; li++) {
      for (let ni = 0; ni < LAYERS[li]; ni++) {
        for (let nj = 0; nj < LAYERS[li + 1]; nj++) {
          const from = nodePos(li, ni);
          const to   = nodePos(li + 1, nj);

          let alpha = 0.08;
          if (li < layerTick) {
            alpha = 0.3;
          } else if (li === layerTick) {
            alpha = 0.08 + 0.22 * progress;
          }

          ctx.beginPath();
          ctx.strokeStyle = `rgba(45,106,79,${alpha})`;
          ctx.lineWidth   = 1;
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.stroke();
        }
      }
    }

    // nodes
    for (let li = 0; li < LAYERS.length; li++) {
      for (let ni = 0; ni < LAYERS[li]; ni++) {
        const { x, y } = nodePos(li, ni);
        const act      = activations[li][ni];

        let fillAlpha = 0.15;
        if (li < layerTick) {
          fillAlpha = act;
        } else if (li === layerTick) {
          fillAlpha = 0.15 + (act - 0.15) * progress;
        }

        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fillStyle   = `rgba(45,106,79,${fillAlpha})`;
        ctx.fill();
        ctx.strokeStyle = '#2d6a4f';
        ctx.lineWidth   = 1.5;
        ctx.stroke();
      }
    }
  }

  function tick() {
    if (layerTick < LAYERS.length) {
      tickInLayer++;
      if (tickInLayer >= TICKS_PER) {
        tickInLayer = 0;
        layerTick++;
      }
      draw();
    } else if (pause < PAUSE_F) {
      pause++;
    } else {
      init();
    }
    raf = requestAnimationFrame(tick);
  }

  init();
  raf = requestAnimationFrame(tick);

  window._nnReset = function () {
    if (raf) cancelAnimationFrame(raf);
    init();
    raf = requestAnimationFrame(tick);
  };
}());

/* ===================================================
   4. EFFICIENT FRONTIER
=================================================== */

(function efAnimation() {
  const canvas = document.getElementById('ef');
  if (!canvas) return;

  const N_PORT      = 300;
  const PORT_RATE   = 4;    // portfolios drawn per frame
  const CURVE_RATE  = 0.025; // fraction of curve drawn per frame
  const PAUSE_F     = 90;

  let ctx, W, H;
  let portfolios = [];
  let portIdx    = 0;
  let curveT     = 0;
  let phase      = 'scatter';  // 'scatter' | 'curve' | 'pause'
  let pause      = 0;
  let raf        = null;

  function genPortfolios() {
    portfolios = [];
    for (let i = 0; i < N_PORT; i++) {
      // simulate random portfolio: risk in [0.06, 0.25], return in [0.04, 0.18]
      const risk = 0.06 + Math.random() * 0.19;
      const ret  = 0.04 + Math.random() * 0.14 - (risk - 0.155) * 0.3 + randn() * 0.018;
      portfolios.push({ risk, ret });
    }
    // sort by risk for frontier curve
    portfolios.sort((a, b) => a.risk - b.risk);
  }

  /** Map (risk, ret) to canvas pixel. */
  function toXY(risk, ret, minR, maxR, minRet, maxRet) {
    const xPad = W * 0.1;
    const yPad = H * 0.1;
    const x = xPad + ((risk - minR)   / (maxR   - minR))   * (W - 2 * xPad);
    const y = H - yPad - ((ret  - minRet) / (maxRet - minRet)) * (H - 2 * yPad);
    return { x, y };
  }

  /** Efficient frontier: for each risk bucket take max return. */
  function buildFrontier(minR, maxR, minRet, maxRet) {
    const BUCKETS = 60;
    const step    = (maxR - minR) / BUCKETS;
    const pts     = [];
    for (let b = 0; b <= BUCKETS; b++) {
      const r = minR + b * step;
      let best = -Infinity;
      for (const p of portfolios) {
        if (Math.abs(p.risk - r) < step * 1.5 && p.ret > best) best = p.ret;
      }
      if (best > -Infinity) pts.push({ risk: r, ret: best });
    }
    return pts;
  }

  let minR, maxR, minRet, maxRet, frontier;

  function init() {
    ctx = fitCanvas(canvas);
    W   = cw(canvas);
    H   = ch(canvas);
    genPortfolios();

    minR   = Math.min(...portfolios.map(p => p.risk));
    maxR   = Math.max(...portfolios.map(p => p.risk));
    minRet = Math.min(...portfolios.map(p => p.ret));
    maxRet = Math.max(...portfolios.map(p => p.ret));

    frontier = buildFrontier(minR, maxR, minRet, maxRet);

    portIdx = 0;
    curveT  = 0;
    phase   = 'scatter';
    pause   = 0;
  }

  function drawAxes() {
    const xPad = W * 0.1;
    const yPad = H * 0.1;
    ctx.strokeStyle = '#e5e5e5';
    ctx.lineWidth   = 1;

    ctx.beginPath();
    ctx.moveTo(xPad, yPad);
    ctx.lineTo(xPad, H - yPad);
    ctx.lineTo(W - xPad, H - yPad);
    ctx.stroke();

    ctx.fillStyle = '#aaa';
    ctx.font      = '9px Inter, sans-serif';
    ctx.fillText('Risk', W - xPad + 4, H - yPad + 3);
    ctx.save();
    ctx.translate(xPad - 6, yPad);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Return', 0, 0);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawAxes();

    // scatter dots
    const limit = Math.min(portIdx, portfolios.length);
    for (let i = 0; i < limit; i++) {
      const { x, y } = toXY(portfolios[i].risk, portfolios[i].ret, minR, maxR, minRet, maxRet);
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(45,106,79,0.25)';
      ctx.fill();
    }

    // frontier curve
    if (phase === 'curve' || phase === 'pause') {
      const len = Math.round(frontier.length * Math.min(curveT, 1));
      if (len >= 2) {
        ctx.beginPath();
        ctx.strokeStyle = '#2d6a4f';
        ctx.lineWidth   = 2.5;
        for (let i = 0; i < len; i++) {
          const { x, y } = toXY(frontier[i].risk, frontier[i].ret, minR, maxR, minRet, maxRet);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  }

  function tick() {
    if (phase === 'scatter') {
      portIdx += PORT_RATE;
      draw();
      if (portIdx >= N_PORT) phase = 'curve';
    } else if (phase === 'curve') {
      curveT += CURVE_RATE;
      draw();
      if (curveT >= 1) phase = 'pause';
    } else if (phase === 'pause') {
      draw();
      pause++;
      if (pause >= PAUSE_F) init();
    }
    raf = requestAnimationFrame(tick);
  }

  init();
  raf = requestAnimationFrame(tick);

  window._efReset = function () {
    if (raf) cancelAnimationFrame(raf);
    init();
    raf = requestAnimationFrame(tick);
  };
}());

/* ===================================================
   RIPPLE EFFECT
=================================================== */

document.querySelectorAll('[data-ripple]').forEach(function (el) {
  el.addEventListener('click', function (e) {
    const rect   = el.getBoundingClientRect();
    const size   = Math.max(rect.width, rect.height);
    const x      = e.clientX - rect.left - size / 2;
    const y      = e.clientY - rect.top  - size / 2;

    const ripple = document.createElement('span');
    ripple.className = 'ripple-circle';
    ripple.style.cssText =
      `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
    el.appendChild(ripple);

    ripple.addEventListener('animationend', function () {
      ripple.remove();
    });
  });
});

/* ===================================================
   RESIZE HANDLING (debounced 200ms)
=================================================== */

let resizeTimer = null;

window.addEventListener('resize', function () {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function () {
    if (window._gbmReset) window._gbmReset();
    if (window._ouReset)  window._ouReset();
    if (window._nnReset)  window._nnReset();
    if (window._efReset)  window._efReset();
  }, 200);
});
