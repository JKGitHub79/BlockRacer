/* Block Racer - menu scenery.
 *
 * The screens in front of the race sit on a painted landscape rather than a
 * flat panel, and it is painted rather than shipped: everything here is
 * rectangles, triangles and gradients on a canvas, in the same flat blocky
 * idiom as the track itself, so the menus and the game look like one thing.
 *
 * The shapes are laid out from a seeded generator, so a scene is identical
 * every time it is drawn and across a resize - a ridge line that reshuffled
 * itself when you turned your phone would read as a glitch. Only the weather
 * moves, and it moves on the clock rather than on a stored position, so
 * nothing accumulates and nothing has to be reset.
 */
(function (global) {
  'use strict';

  var Backdrop = { scene: null };
  var canvas = null, ctx = null, W = 0, H = 0, dpr = 1;
  var baked = null, bakedFor = '';
  var motes = [], motesFor = '';

  function rng(seed) {
    return function () {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
  }

  function sky(g, stops) {
    var grad = g.createLinearGradient(0, 0, 0, H);
    stops.forEach(function (s) { grad.addColorStop(s[0], s[1]); });
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
  }

  /* A band of conifers: a run of triangles of varying height along one
   * baseline, drawn back to front so the near bands read as closer. */
  function trees(g, y, color, size, gap, seed) {
    var rnd = rng(seed);
    g.fillStyle = color;
    for (var x = -size; x < W + size; x += gap) {
      var h = size * (1.3 + rnd() * 1.5);
      var w = size * (0.5 + rnd() * 0.35);
      var bx = x + rnd() * gap * 0.5;
      g.beginPath();
      g.moveTo(bx, y - h);
      g.lineTo(bx + w, y);
      g.lineTo(bx - w, y);
      g.closePath();
      g.fill();
      g.fillRect(bx - size * 0.06, y - size * 0.1, size * 0.12, size * 0.25);
    }
  }

  /* A dune or drift: one smooth crest across the screen, filled to the floor.
   * Three sine terms at different rates is enough to stop it reading as a
   * sine wave without needing real noise. */
  function crest(g, y, amp, color, seed) {
    var rnd = rng(seed);
    var a = rnd() * 6.3, b = rnd() * 6.3, c = rnd() * 6.3;
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, H);
    for (var x = 0; x <= W; x += 8) {
      var t = x / W;
      var yy = y - amp * (Math.sin(t * 5 + a) * 0.5 +
                          Math.sin(t * 11 + b) * 0.3 +
                          Math.sin(t * 2 + c) * 0.6);
      g.lineTo(x, yy);
    }
    g.lineTo(W, H);
    g.closePath();
    g.fill();
  }

  /* A range of peaks. The step has to be small - a handful of points across
   * the screen gives slabs, not mountains - and the heights skewed, so most
   * of the range is low and the occasional one stands up out of it. The caps
   * are clipped to the range and cut by one level line, because a snow line
   * follows the altitude, not the shape of each peak. */
  function peaks(g, y, height, color, cap, seed, step) {
    var rnd = rng(seed);
    var pts = [];
    for (var x = -step; x < W + step * 2; x += step) {
      var t = rnd();
      pts.push({ x: x + (rnd() - 0.5) * step * 0.7,
                 y: y - height * (0.22 + t * t * 0.9) });
    }
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(-step, H);
    pts.forEach(function (p) { g.lineTo(p.x, p.y); });
    g.lineTo(W + step * 2, H);
    g.closePath();
    g.fill();

    g.save();
    g.clip();
    g.fillStyle = cap;
    g.fillRect(0, 0, W, y - height * 0.72);
    g.restore();
  }

  /* A light source low in the sky: a small hard disc inside a wide soft
   * falloff. A flat-alpha circle reads as a pale sticker, not as glow. */
  function sun(g, x, y, r, core, halo) {
    var glow = g.createRadialGradient(x, y, 0, x, y, r * 6);
    glow.addColorStop(0, halo);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    g.fillStyle = core;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  /* A scene is scenery, not the picture: everything in front of it is text
   * and cards, and a landscape competing with them for attention is a worse
   * landscape. One flat darkening pass plus a floor vignette pushes the whole
   * thing back a step without washing the colour out of it. */
  /* Flat-topped buttes along the horizon, a handful of them, to give the
   * dunes something to be flat next to. */
  function mesas(g, y, color, seed) {
    var rnd = rng(seed);
    g.fillStyle = color;
    for (var i = 0; i < 5; i++) {
      var w = W * (0.06 + rnd() * 0.10);
      var h = H * (0.05 + rnd() * 0.09);
      var x = rnd() * W;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + w * 0.12, y - h);
      g.lineTo(x + w * 0.88, y - h);
      g.lineTo(x + w, y);
      g.closePath();
      g.fill();
    }
  }

  /* A stepped rock rim. Not peaks and not dunes: a run of flat-topped blocks
   * that each step up or down from the one before, which is what a quarried
   * cliff actually looks like from a distance and what the tracks in that
   * theme are made of. Drawn as rectangles down to the floor, so a nearer
   * band simply covers the one behind it. */
  function terrace(g, y, height, color, seed, step) {
    var rnd = rng(seed);
    var lvl = y - height * (0.35 + rnd() * 0.45);
    g.fillStyle = color;
    for (var x = -step; x < W + step; x += step) {
      lvl += (rnd() - 0.5) * height * 0.55;
      lvl = Math.max(y - height, Math.min(y - height * 0.12, lvl));
      g.fillRect(x, lvl, step + 1, H - lvl);
    }
  }

  /* A city at night. Flat-topped towers of wildly varying height with lit
   * windows in them - the height is squared so most of the run is low and
   * the occasional tower stands right up out of it, which is the same trick
   * the mountain range uses because a skyline has the same shape. */
  function skyline(g, y, height, color, lit, seed, step) {
    var rnd = rng(seed);
    for (var x = -step; x < W + step; x += step) {
      var t = rnd();
      var h = height * (0.16 + t * t * 1.3);
      var w = step * (0.55 + rnd() * 0.6);
      var bx = x + rnd() * step * 0.28;
      g.fillStyle = color;
      g.fillRect(bx, y - h, w, h + 2);
      if (!lit) continue;
      g.fillStyle = lit;
      var cw = 3, ch = 4, pad = 3;
      var cols = Math.floor((w - pad) / (cw + 3));
      var rows = Math.floor((h - pad) / (ch + 4));
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          if (rnd() > 0.33) continue;
          g.fillRect(bx + pad + c * (cw + 3), y - h + pad + r * (ch + 4), cw, ch);
        }
      }
    }
  }

  function recede(g) {
    g.fillStyle = 'rgba(4,8,14,0.18)';
    g.fillRect(0, 0, W, H);
    var v = g.createLinearGradient(0, H * 0.58, 0, H);
    v.addColorStop(0, 'rgba(3,6,11,0)');
    v.addColorStop(1, 'rgba(3,6,11,0.5)');
    g.fillStyle = v;
    g.fillRect(0, H * 0.58, W, H * 0.42);
  }

  /* The cards sit in a band across the middle of the screen, roughly the
   * third of it either side of centre. Every scene therefore keeps its
   * horizon and its landmarks out of that band - sky behind the cards, land
   * below them - so the scenery is seen rather than half-hidden. */
  var HORIZON = 0.76;

  var SCENES = {
    /* Depth is value, not size: the far band is hazed almost to the colour of
     * the sky behind it and the near band is nearly black. Three bands of the
     * same green would read as one flat wall of trees. */
    forest: {
      weather: 'leaves',
      paint: function (g) {
        sky(g, [[0, '#06130f'], [0.38, '#0d2620'], [0.68, '#1c4a35'], [1, '#367049']]);
        sun(g, W * 0.84, H * 0.17, H * 0.035, '#dff3d6', 'rgba(190,240,195,0.22)');
        trees(g, H * (HORIZON + 0.01), '#2f6147', H * 0.052, H * 0.034, 91);
        trees(g, H * (HORIZON + 0.10), '#16402f', H * 0.082, H * 0.052, 137);
        trees(g, H * (HORIZON + 0.23), '#081f18', H * 0.130, H * 0.078, 211);
        g.fillStyle = '#05130f';
        g.fillRect(0, H * 0.975, W, H);
        recede(g);
      }
    },

    desert: {
      weather: 'dust',
      paint: function (g) {
        sky(g, [[0, '#1e0e2c'], [0.28, '#552630'], [0.54, '#9d4e2b'], [0.76, '#d5873f'],
                [1, '#efc07a']]);
        sun(g, W * 0.83, H * 0.20, H * 0.062, '#ffe6a8', 'rgba(255,190,110,0.30)');
        mesas(g, H * (HORIZON + 0.01), '#7a4128', 53);
        crest(g, H * (HORIZON + 0.02), H * 0.030, '#a85c32', 17);
        crest(g, H * (HORIZON + 0.10), H * 0.045, '#7c4024', 29);
        crest(g, H * (HORIZON + 0.24), H * 0.060, '#4a2415', 43);
        recede(g);
      }
    },

    snow: {
      weather: 'snow',
      paint: function (g) {
        sky(g, [[0, '#07112a'], [0.36, '#16294a'], [0.68, '#3a5c84'], [1, '#7d9ab8']]);
        sun(g, W * 0.18, H * 0.18, H * 0.042, '#eaf4ff', 'rgba(205,232,255,0.30)');
        peaks(g, H * (HORIZON + 0.02), H * 0.30, '#4a6b93', '#e6f1fb', 61, W * 0.045);
        peaks(g, H * (HORIZON + 0.13), H * 0.22, '#1e3558', '#9db8d4', 83, W * 0.035);
        crest(g, H * (HORIZON + 0.28), H * 0.035, '#bed3e6', 101);
        recede(g);
      }
    },

    cliffs: {
      weather: 'grit',
      paint: function (g) {
        sky(g, [[0, '#150d10'], [0.30, '#3b2420'], [0.60, '#7a4a33'],
                [0.82, '#b07a4e'], [1, '#d9a874']]);
        sun(g, W * 0.21, H * 0.21, H * 0.048, '#ffe9c4', 'rgba(255,198,138,0.26)');
        terrace(g, H * (HORIZON + 0.02), H * 0.32, '#6d4c3a', 37, W * 0.055);
        terrace(g, H * (HORIZON + 0.15), H * 0.24, '#3f2b23', 59, W * 0.042);
        terrace(g, H * (HORIZON + 0.32), H * 0.18, '#1c1311', 73, W * 0.033);
        recede(g);
      }
    },

    city: {
      weather: 'rain',
      paint: function (g) {
        sky(g, [[0, '#04060f'], [0.34, '#0b1226'], [0.60, '#1b1f45'],
                [0.82, '#3d2a54'], [1, '#77445c']]);
        // the moon, and the sodium glow the streets throw back up at it
        sun(g, W * 0.76, H * 0.15, H * 0.026, '#e6ecff', 'rgba(150,180,255,0.16)');
        skyline(g, H * (HORIZON + 0.03), H * 0.36, '#161c32',
                'rgba(255,214,140,0.42)', 31, W * 0.042);
        skyline(g, H * (HORIZON + 0.17), H * 0.27, '#0c1020',
                'rgba(255,205,125,0.52)', 57, W * 0.034);
        skyline(g, H * (HORIZON + 0.34), H * 0.19, '#05070f',
                'rgba(255,196,110,0.42)', 83, W * 0.027);
        recede(g);
      }
    },

    /* The front screen sits on its own night sky rather than borrowing a
     * theme's, so arriving at the game does not imply a theme. */
    night: {
      weather: null,
      paint: function (g) {
        sky(g, [[0, '#04070f'], [0.55, '#0a1222'], [1, '#132038']]);
        var rnd = rng(7);
        for (var i = 0; i < 90; i++) {
          var r = rnd() * 1.4 + 0.3;
          g.fillStyle = 'rgba(190,220,255,' + (0.15 + rnd() * 0.5).toFixed(2) + ')';
          g.fillRect(rnd() * W, rnd() * H * 0.8, r, r);
        }
        var glow = g.createRadialGradient(W / 2, H * 0.95, 0, W / 2, H * 0.95, H * 0.7);
        glow.addColorStop(0, 'rgba(94,242,255,0.10)');
        glow.addColorStop(1, 'rgba(94,242,255,0)');
        g.fillStyle = glow;
        g.fillRect(0, 0, W, H);
      }
    }
  };

  /* Drifting weather. The same three kinds the tracks use. They have to stay
   * small: at menu scale a mote big enough to see the shape of stops being
   * weather and starts being litter on the screen. */
  var WEATHER = {
    leaves: { n: 30, color: '#b8913f', r: [0.8, 2.0], vx: [-16, -52], vy: [14, 46],
              sway: 30, rate: 1.0, alpha: [0.14, 0.42], wide: 1.6 },
    dust:   { n: 55, color: '#e8cfa0', r: [0.5, 1.3], vx: [-110, -260], vy: [-5, 9],
              sway: 6, rate: 1.7, alpha: [0.05, 0.16], wide: 6 },
    snow:   { n: 70, color: '#eef5ff', r: [0.7, 2.0], vx: [-8, -34], vy: [26, 78],
              sway: 13, rate: 0.7, alpha: [0.18, 0.62], wide: 1 },
    grit:   { n: 60, color: '#c8b9a4', r: [0.5, 1.5], vx: [-30, -80], vy: [20, 60],
              sway: 5, rate: 1.3, alpha: [0.08, 0.30], wide: 2 },
    // Rain falls; it does not drift. No sway, and `wide` under one so the
    // mote comes out tall and thin instead of long and flat.
    rain:   { n: 110, color: '#a8c8ea', r: [1.6, 3.4], vx: [-40, -95], vy: [320, 540],
              sway: 0, rate: 0.1, alpha: [0.10, 0.28], wide: 0.28 }
  };

  function ensureMotes(kind) {
    if (motesFor === kind + W + 'x' + H) return;
    motesFor = kind + W + 'x' + H;
    motes = [];
    var spec = WEATHER[kind];
    if (!spec) return;
    var pick = function (r) { return r[0] + Math.random() * (r[1] - r[0]); };
    var n = Math.round(spec.n * (W * H) / (1280 * 720));
    for (var i = 0; i < n; i++) {
      motes.push({
        x: Math.random() * W, y: Math.random() * H,
        r: pick(spec.r), vx: pick(spec.vx), vy: pick(spec.vy),
        phase: Math.random() * Math.PI * 2, alpha: pick(spec.alpha)
      });
    }
  }

  function measure() {
    dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return false;
    if (canvas.width === Math.round(w * dpr) && canvas.height === Math.round(h * dpr) &&
        W === w) return true;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    W = w; H = h;
    baked = null;
    return true;
  }

  Backdrop.init = function (cv) {
    canvas = cv;
    ctx = cv.getContext('2d');
  };

  Backdrop.set = function (name) {
    if (!SCENES[name]) name = 'night';
    if (this.scene === name) return;
    this.scene = name;
    baked = null;
  };

  /* The landscape is baked once per size and blitted; only the weather is
   * repainted, which is a few dozen rectangles. */
  Backdrop.draw = function (t) {
    if (!ctx || !this.scene || !measure()) return;
    var spec = SCENES[this.scene];

    if (!baked || bakedFor !== this.scene + W + 'x' + H) {
      baked = document.createElement('canvas');
      baked.width = canvas.width;
      baked.height = canvas.height;
      var bg = baked.getContext('2d');
      bg.scale(dpr, dpr);
      spec.paint(bg);
      bakedFor = this.scene + W + 'x' + H;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(baked, 0, 0);
    if (!spec.weather) return;

    ctx.scale(dpr, dpr);
    ensureMotes(spec.weather);
    var w = WEATHER[spec.weather];
    ctx.fillStyle = w.color;
    motes.forEach(function (m) {
      var y = (m.y + t * m.vy) % H;
      if (y < 0) y += H;
      var x = (m.x + t * m.vx + Math.sin(t * w.rate + m.phase) * w.sway) % W;
      if (x < 0) x += W;
      ctx.globalAlpha = m.alpha;
      ctx.fillRect(x - m.r * w.wide, y - m.r, m.r * 2 * w.wide, m.r * 2);
    });
    ctx.globalAlpha = 1;
  };

  global.Backdrop = Backdrop;
})(typeof window !== 'undefined' ? window : globalThis);
