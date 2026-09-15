/* Block Racer - drawing. Everything is squares, so everything is cheap:
 * the track is baked once into an offscreen canvas and blitted each frame. */
(function (global) {
  'use strict';

  var C = global.CONFIG;
  var T = global.TRACK;
  var S = C.cell;

  var Renderer = {};
  var trackCanvas = null;
  var lavaLayers = null;
  var lavaCanvas = null, lavaCtx = null;
  // Lava is soft enough that painting it at a third of the size and stretching
  // it back up is indistinguishable, and a ninth of the pixels.
  var LAVA_SCALE = 1 / 3;
  var LAVA_RIM = 3;

  /* Track palettes override the defaults one entry at a time. */
  function colorOf(name) {
    return (T.theme && T.theme[name]) || C.colors[name];
  }

  /* A seamless tile of soft molten blobs. Drawn nine times over so a blob that
   * runs off one edge comes back on the other and the tile can scroll forever
   * without a visible seam. Built once, at load. */
  function buildLavaTile(size, count, seed, minR, maxR) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = size;
    var g = cv.getContext('2d');
    var rnd = function () {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    var hues = ['255,88,12', '255,150,36', '255,214,110'];
    for (var i = 0; i < count; i++) {
      var bx = rnd() * size, by = rnd() * size;
      var r = size * (minR + rnd() * (maxR - minR));
      var hue = hues[(rnd() * hues.length) | 0];
      var a = 0.25 + rnd() * 0.45;
      for (var ox = -1; ox <= 1; ox++) {
        for (var oy = -1; oy <= 1; oy++) {
          var cx = bx + ox * size, cy = by + oy * size;
          if (cx + r < 0 || cx - r > size || cy + r < 0 || cy - r > size) continue;
          var grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
          grad.addColorStop(0, 'rgba(' + hue + ',' + a.toFixed(3) + ')');
          grad.addColorStop(0.5, 'rgba(' + hue + ',' + (a * 0.32).toFixed(3) + ')');
          grad.addColorStop(1, 'rgba(' + hue + ',0)');
          g.fillStyle = grad;
          g.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
      }
    }
    return cv;
  }

  /* Two sheets of glow crossing each other at different speeds. One sheet
   * scrolling on its own reads as a moving picture; two at an angle read as
   * something churning. */
  function buildLavaLayers(g) {
    return [
      { size: 64, tile: buildLavaTile(64, 24, 1337, 0.07, 0.20),
        vx: 1.9, vy: -1.0, alpha: 0.62, pulse: 1.6, phase: 0 },
      { size: 48, tile: buildLavaTile(48, 18, 90210, 0.11, 0.30),
        vx: -1.2, vy: 1.6, alpha: 0.46, pulse: 1.05, phase: 1.9 }
    ].map(function (L) { L.pattern = g.createPattern(L.tile, 'repeat'); return L; });
  }

  function ensureLavaCanvas() {
    var w = Math.ceil(T.width * LAVA_SCALE), h = Math.ceil(T.height * LAVA_SCALE);
    if (!lavaCanvas) lavaCanvas = document.createElement('canvas');
    if (lavaCanvas.width !== w || lavaCanvas.height !== h) {
      lavaCanvas.width = w;
      lavaCanvas.height = h;
      lavaCtx = lavaCanvas.getContext('2d');
      lavaLayers = null;          // patterns belong to the context that made them
    }
  }

  /* Molten rock, drawn live over the baked crust. Only the rectangles the
   * track marked as lava, which on every other track is none of them. */
  function bakeTrack() {
    var cv = document.createElement('canvas');
    cv.width = T.width;
    cv.height = T.height;
    var g = cv.getContext('2d');

    g.fillStyle = colorOf('road');
    g.fillRect(0, 0, T.width, T.height);

    // faint tile grid on the tarmac so speed reads at a glance
    g.strokeStyle = colorOf('roadLine');
    g.lineWidth = 1;
    g.beginPath();
    for (var x = 0; x <= T.cols; x++) { g.moveTo(x * S + 0.5, 0); g.lineTo(x * S + 0.5, T.height); }
    for (var y = 0; y <= T.rows; y++) { g.moveTo(0, y * S + 0.5); g.lineTo(T.width, y * S + 0.5); }
    g.stroke();

    // racing line: the track is all right angles, so show the staircase
    g.save();
    g.strokeStyle = colorOf('racingLine');
    g.lineWidth = 2;
    g.setLineDash([6, 10]);
    g.beginPath();
    var pts = T.ROUTE, n = pts.length;
    var midOf = function (a, b) { return { x: (a.x + b.x) / 2 * S, y: (a.y + b.y) / 2 * S }; };
    if (C.slide > 0) {
      // Round the corners by the turn radius: this is the line a sliding car
      // actually takes, and it shows where you have to throw it in.
      var r = C.slide * S;
      var start = midOf(pts[n - 1], pts[0]);
      g.moveTo(start.x, start.y);
      for (var i = 0; i < n; i++) {
        var m = midOf(pts[i], pts[(i + 1) % n]);
        g.arcTo(pts[i].x * S, pts[i].y * S, m.x, m.y, r);
        g.lineTo(m.x, m.y);
      }
    } else {
      pts.forEach(function (p, i) {
        if (i === 0) g.moveTo(p.x * S, p.y * S); else g.lineTo(p.x * S, p.y * S);
      });
    }
    g.closePath();
    g.stroke();
    g.restore();

    // walls
    for (var cy = 0; cy < T.rows; cy++) {
      for (var cx = 0; cx < T.cols; cx++) {
        if (!T.isWall(cx, cy)) continue;
        // Four kinds of solid: the islands inside the circuit, the ground
        // outside it, the chicane blocks, and lava - whose cooled crust is
        // baked here and whose molten middle is painted over it every frame.
        var kind = T.wallKind(cx, cy);
        var fill = kind === 3 ? colorOf('jog')
                 : (kind === 2 || kind === 4) ? colorOf('wall') : colorOf('outer');
        var face = kind === 3 ? colorOf('jogTop')
                 : (kind === 2 || kind === 4) ? colorOf('wallTop') : colorOf('outerTop');
        g.fillStyle = fill;
        g.fillRect(cx * S, cy * S, S, S);
        g.fillStyle = face;
        if (!T.isWall(cx, cy - 1)) g.fillRect(cx * S, cy * S, S, 3);
        if (!T.isWall(cx - 1, cy)) g.fillRect(cx * S, cy * S, 3, S);
        if (!T.isWall(cx + 1, cy)) g.fillRect(cx * S + S - 3, cy * S, 3, S);
        if (!T.isWall(cx, cy + 1)) {
          g.fillStyle = 'rgba(0,0,0,0.45)';
          g.fillRect(cx * S, cy * S + S - 3, S, 3);
        }
      }
    }

    // start / finish chequer
    var f = T.FINISH;
    var fx = f.x0 * S, fw = (f.x1 - f.x0) * S;
    g.fillStyle = '#0b0f18';
    g.fillRect(fx, f.y0 * S, fw, (f.y1 - f.y0) * S);
    for (var r = f.y0; r < f.y1; r += 0.4) {
      for (var col = 0; col < 2; col++) {
        g.fillStyle = (((r / 0.4) | 0) + col) % 2 ? colorOf('startLine') : '#1b2131';
        g.fillRect(fx + col * fw / 2, r * S, fw / 2, 0.4 * S);
      }
    }
    trackCanvas = cv;
  }

  Renderer.drawLava = function (g, t) {
    var rects = T.lavaRects;
    if (!rects || !rects.length) return;
    ensureLavaCanvas();
    var lg = lavaCtx;
    if (!lavaLayers) lavaLayers = buildLavaLayers(lg);

    // Paint the whole molten sheet once, small: cooled crust, then the glow
    // sheets crossing over it.
    lg.globalCompositeOperation = 'source-over';
    lg.globalAlpha = 1;
    lg.fillStyle = colorOf('wall');
    lg.fillRect(0, 0, lavaCanvas.width, lavaCanvas.height);
    lg.globalCompositeOperation = 'lighter';
    lavaLayers.forEach(function (L) {
      var ox = (t * L.vx % L.size + L.size) % L.size;
      var oy = (t * L.vy % L.size + L.size) % L.size;
      lg.globalAlpha = L.alpha * (0.82 + 0.18 * Math.sin(t * L.pulse + L.phase));
      lg.fillStyle = L.pattern;
      // The pattern is anchored to the origin, so shifting the origin and
      // drawing back the same amount scrolls the sheet under a fixed rectangle.
      lg.translate(ox, oy);
      lg.fillRect(-ox, -oy, lavaCanvas.width, lavaCanvas.height);
      lg.translate(-ox, -oy);
    });
    lg.globalCompositeOperation = 'source-over';
    lg.globalAlpha = 1;

    // Stamp each molten rectangle out of it, sampling the same place it is
    // being drawn so the flows line up with the lake they run out of. Inset so
    // the baked crust rim survives as a cooled edge. Smoothing off: the
    // interpolation is what costs at this size, and on a game built out of
    // squares the coarser molten pixels are no loss at all.
    var smooth = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = false;
    rects.forEach(function (r) {
      var x = r.x0 * S + LAVA_RIM, y = r.y0 * S + LAVA_RIM;
      var w = (r.x1 - r.x0 + 1) * S - LAVA_RIM * 2;
      var h = (r.y1 - r.y0 + 1) * S - LAVA_RIM * 2;
      if (w <= 0 || h <= 0) return;
      g.drawImage(lavaCanvas,
        x * LAVA_SCALE, y * LAVA_SCALE, w * LAVA_SCALE, h * LAVA_SCALE,
        x, y, w, h);
    });
    g.imageSmoothingEnabled = smooth;
  };

  Renderer.init = function (canvas) {
    this.canvas = canvas;
    this.setTrack();

    // Refit on anything that can change the space available. Coalesced into
    // one animation frame because orientation changes fire several at once and
    // resizing the backing store is not free.
    var pending = false;
    var refit = function () {
      if (pending) return;
      pending = true;
      global.requestAnimationFrame(function () {
        pending = false;
        Renderer.fit();
      });
    };
    global.addEventListener('resize', refit);
    global.addEventListener('orientationchange', refit);
    if (global.visualViewport) global.visualViewport.addEventListener('resize', refit);
  };

  /* Scale the board to whatever box is left over, keeping the track's shape.
   *
   * The game is drawn in logical track pixels whatever the screen is; only the
   * transform changes. The backing store is sized to what is actually shown,
   * so a phone renders a phone's worth of pixels rather than a desktop's
   * scaled down, and the drawing stays sharp at any size. */
  Renderer.fit = function () {
    var canvas = this.canvas;
    var stage = canvas.parentNode.parentNode.parentNode;   // .board > .canvas-wrap > .stage
    var hud = stage.querySelector('.hud');
    var css = global.getComputedStyle(stage);
    var column = css.flexDirection === 'column';
    var gap = parseFloat(css.gap) || 0;

    // Measure the stage and subtract the panel, rather than measuring the box
    // the board sits in. The board's own size must never be an input here or
    // sizing it changes the space it is being sized to fit.
    var availW = stage.clientWidth - (column || !hud ? 0 : hud.offsetWidth + gap);
    var availH = stage.clientHeight - (!column || !hud ? 0 : hud.offsetHeight + gap);

    // 2px for the board's border, so the frame is never clipped
    var scale = Math.min((availW - 2) / T.width, (availH - 2) / T.height);
    if (!(scale > 0)) scale = 1;

    var cssW = Math.max(1, Math.floor(T.width * scale));
    var cssH = Math.max(1, Math.floor(T.height * scale));
    var dpr = Math.min(global.devicePixelRatio || 1, 2);

    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    // Resizing the backing store clears the context, so the transform that
    // maps track pixels onto it has to be set again here.
    this.ctx = canvas.getContext('2d');
    this.ctx.setTransform(canvas.width / T.width, 0, 0, canvas.height / T.height, 0, 0);
  };

  /* Bake the current track's scenery and size the board to it. Called on boot
   * and whenever the track changes - tracks are not all the same shape. */
  Renderer.setTrack = function () {
    bakeTrack();
    this.fit();
  };

  function drawCheckpoints(g, player) {
    T.CHECKPOINTS.forEach(function (z, i) {
      var next = player && !player.finished && player.nextCp === i;
      g.fillStyle = next ? colorOf('checkNext') : colorOf('check');
      g.fillRect(z.x0 * S, z.y0 * S, (z.x1 - z.x0) * S, (z.y1 - z.y0) * S);
    });
  }

  function drawCar(g, car) {
    var L = C.carLength * S, W = C.carWidth * S;
    var a = car.bodyAngle();
    var cos = Math.cos(a), sin = Math.sin(a);

    g.save();
    g.translate(car.x * S, car.y * S);
    g.rotate(a);

    // shadow, offset down-right in world space whatever way the car points
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(-L / 2 + (2 * cos + 3 * sin), -W / 2 + (3 * cos - 2 * sin), L, W);

    g.fillStyle = car.crashFlash > 0.05
      ? 'rgba(255,255,255,' + (0.35 + 0.65 * car.crashFlash) + ')'
      : car.color;
    g.fillRect(-L / 2, -W / 2, L, W);

    // cabin, set back from the nose so the front end is obvious
    g.fillStyle = 'rgba(10,14,22,0.55)';
    g.fillRect(-L * 0.34, -W * 0.3, L * 0.4, W * 0.6);

    // nose stripe
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillRect(L / 2 - 3, -W / 2, 3, W);

    if (car.isPlayer) {
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 1.5;
      g.strokeRect(-L / 2 - 1.5, -W / 2 - 1.5, L + 3, W + 3);
      if (car.crashed) {
        g.globalAlpha = 0.55 + 0.45 * Math.sin(Date.now() / 90);
        g.strokeStyle = '#ff5470';
        g.lineWidth = 2;
        g.strokeRect(-L / 2 - 5, -W / 2 - 5, L + 10, W + 10);
      }
    }
    g.restore();
  }

  Renderer.draw = function (game) {
    var g = this.ctx;
    g.fillStyle = colorOf('bg');
    g.fillRect(0, 0, T.width, T.height);
    g.drawImage(trackCanvas, 0, 0, T.width, T.height);

    Renderer.drawLava(g, (global.performance ? performance.now() : Date.now()) / 1000);
    drawCheckpoints(g, game.player);

    // tyre marks first so they sit under the sparks and the cars
    game.particles.forEach(function (p) {
      if (!p.mark) return;
      g.globalAlpha = Math.max(0, p.life) * 0.5;
      g.fillStyle = p.color;
      g.fillRect(p.x * S - 1.5, p.y * S - 1.5, 3, 3);
    });
    game.particles.forEach(function (p) {
      if (p.mark) return;
      g.globalAlpha = Math.max(0, p.life);
      g.fillStyle = p.color;
      g.fillRect(p.x * S - 2, p.y * S - 2, 4, 4);
    });
    g.globalAlpha = 1;

    game.cars.forEach(function (car) { drawCar(g, car); });

    if (game.state === 'countdown') {
      var n = Math.ceil(game.countdown);
      var label = n > 0 ? String(n) : 'GO!';
      g.save();
      g.fillStyle = 'rgba(8,11,18,0.55)';
      g.fillRect(0, 0, T.width, T.height);
      g.font = '700 96px ui-monospace, Menlo, Consolas, monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = n > 0 ? '#ffd166' : '#5ef2a0';
      g.fillText(label, T.width / 2, T.height / 2);
      g.restore();
    }
  };

  global.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : globalThis);
