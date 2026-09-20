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
  var flakes = null;

  /* Three layers, most specific first: the road tint picked on the start menu
   * beats the track's own palette, which beats the defaults in config.js. The
   * tint only ever carries road entries, so a track keeps its walls and its
   * weather whichever tarmac it is laid on. */
  function colorOf(name) {
    var tint = C.roadColors();
    return (tint && tint[name]) || (T.theme && T.theme[name]) || C.colors[name];
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
  /* Weather, for a track that asks for it. Each mote wraps round the board in
   * both directions, so a few dozen of them blow forever without anything
   * needing to be spawned or retired.
   *
   * Snow drifts down and sideways in fat soft flakes; dust tears across almost
   * flat, thin and faint, and is drawn smeared along its own direction of
   * travel because at that speed that is what it would look like. */
  var WEATHER = {
    snow: { per: 4200, color: '#eef5ff', r: [0.8, 2.4], vx: [-5, -21],
            vy: [16, 46], sway: 7, swayRate: 0.7, alpha: [0.30, 0.85], smear: 1 },
    dust: { per: 2600, color: '#e8cfa0', r: [0.5, 1.5], vx: [-60, -130],
            vy: [-4, 7], sway: 3, swayRate: 1.6, alpha: [0.10, 0.34], smear: 5 },
    leaves: { per: 9000, color: '#c08a3e', r: [1.0, 2.2], vx: [-9, -30],
              vy: [8, 26], sway: 16, swayRate: 1.1, alpha: [0.25, 0.62], smear: 2 }
  };

  function ensureMotes() {
    if (flakes && flakes.w === T.width && flakes.h === T.height &&
        flakes.kind === T.weather) return;
    var spec = WEATHER[T.weather];
    var pick = function (r) { return r[0] + Math.random() * (r[1] - r[0]); };
    var list = [];
    var n = Math.round(T.width * T.height / spec.per);
    for (var i = 0; i < n; i++) {
      list.push({
        x: Math.random() * T.width, y: Math.random() * T.height,
        r: pick(spec.r), vx: pick(spec.vx), vy: pick(spec.vy),
        sway: Math.random() * Math.PI * 2, alpha: pick(spec.alpha)
      });
    }
    flakes = { w: T.width, h: T.height, kind: T.weather, spec: spec, list: list };
  }

  Renderer.drawWeather = function (g, t) {
    if (!T.weather || !WEATHER[T.weather]) return;
    ensureMotes();
    var spec = flakes.spec;
    g.save();
    g.fillStyle = spec.color;
    flakes.list.forEach(function (f) {
      var y = (f.y + t * f.vy) % T.height;
      if (y < 0) y += T.height;
      var x = (f.x + t * f.vx + Math.sin(t * spec.swayRate + f.sway) * spec.sway) % T.width;
      if (x < 0) x += T.width;
      g.globalAlpha = f.alpha;
      g.fillRect(x - f.r * spec.smear, y - f.r, f.r * 2 * spec.smear, f.r * 2);
    });
    g.restore();
  };

  function eachWall(fn) {
    for (var cy = 0; cy < T.rows; cy++) {
      for (var cx = 0; cx < T.cols; cx++) {
        if (T.isWall(cx, cy)) fn(cx, cy, T.wallKind(cx, cy));
      }
    }
  }

  /* Emblems are flat livery painted onto the solids - club stripes, a flag,
   * a scatter of mosaic tiles. They are clipped to the cells that are
   * actually wall, so a rect declared loosely can never bleed onto tarmac,
   * and they are baked, so they cost nothing per frame. */
  function drawEmblems(g) {
    var list = T.emblems;
    if (!list || !list.length) return;

    var bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    list.forEach(function (e) {
      bx0 = Math.min(bx0, Math.floor(e.x0)); by0 = Math.min(by0, Math.floor(e.y0));
      bx1 = Math.max(bx1, Math.ceil(e.x1));  by1 = Math.max(by1, Math.ceil(e.y1));
    });

    g.save();
    g.beginPath();
    var any = false;
    for (var cy = by0; cy < by1; cy++) {
      for (var cx = bx0; cx < bx1; cx++) {
        if (!T.isWall(cx, cy)) continue;
        g.rect(cx * S, cy * S, S, S);
        any = true;
      }
    }
    if (!any) { g.restore(); return; }
    g.clip();
    list.forEach(function (e) { EMBLEM[e.kind] && EMBLEM[e.kind](g, e); });
    g.restore();
  }

  var EMBLEM = {
    /* Parallel bands marching along one axis, colours cycling. axis 'x' gives
     * vertical stripes, axis 'y' horizontal ones. */
    stripes: function (g, e) {
      var alongX = e.axis === 'x';
      var a0 = alongX ? e.x0 : e.y0;
      var a1 = alongX ? e.x1 : e.y1;
      var band = e.band || 1;
      g.globalAlpha = e.alpha === undefined ? 1 : e.alpha;
      for (var a = a0, i = 0; a < a1 - 1e-6; a += band, i++) {
        var w = Math.min(band, a1 - a);
        g.fillStyle = e.colors[i % e.colors.length];
        if (alongX) g.fillRect(a * S, e.y0 * S, w * S, (e.y1 - e.y0) * S);
        else        g.fillRect(e.x0 * S, a * S, (e.x1 - e.x0) * S, w * S);
      }
      g.globalAlpha = 1;
    },

    /* Trencadis: a sparse seeded scatter of small square tiles, so the flat
     * livery gets a little grain without anything glowing. */
    mosaic: function (g, e) {
      var seed = e.seed || 1;
      var rnd = function () {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      var tile = e.tile || 0.5;
      var gap = tile * 0.12;
      for (var y = e.y0; y < e.y1 - 1e-6; y += tile) {
        for (var x = e.x0; x < e.x1 - 1e-6; x += tile) {
          if (rnd() > e.density) continue;
          g.fillStyle = e.colors[(rnd() * e.colors.length) | 0];
          g.globalAlpha = (e.alpha === undefined ? 1 : e.alpha) * (0.35 + rnd() * 0.65);
          g.fillRect((x + gap) * S, (y + gap) * S, (tile - gap * 2) * S, (tile - gap * 2) * S);
        }
      }
      g.globalAlpha = 1;
    }
  };

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

    // Walls, in two passes: every solid is filled flat first, then the
    // emblems are painted over the flat fill, then the lit edges go on top -
    // so the faces that make the blocks read as raised survive the livery.
    eachWall(function (cx, cy, kind) {
      // Four kinds of solid: the islands inside the circuit, the ground
      // outside it, the chicane blocks, and lava - whose cooled crust is
      // baked here and whose molten middle is painted over it every frame.
      g.fillStyle = kind === 3 ? colorOf('jog')
                  : (kind === 2 || kind === 4) ? colorOf('wall') : colorOf('outer');
      g.fillRect(cx * S, cy * S, S, S);
    });

    drawEmblems(g);

    eachWall(function (cx, cy, kind) {
      g.fillStyle = kind === 3 ? colorOf('jogTop')
                  : (kind === 2 || kind === 4) ? colorOf('wallTop') : colorOf('outerTop');
      if (!T.isWall(cx, cy - 1)) g.fillRect(cx * S, cy * S, S, 3);
      if (!T.isWall(cx - 1, cy)) g.fillRect(cx * S, cy * S, 3, S);
      if (!T.isWall(cx + 1, cy)) g.fillRect(cx * S + S - 3, cy * S, 3, S);
      if (!T.isWall(cx, cy + 1)) {
        g.fillStyle = 'rgba(0,0,0,0.45)';
        g.fillRect(cx * S, cy * S + S - 3, S, 3);
      }
    });

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
  /* A card-sized picture of a track, painted straight from its entry in
   * js/tracks.js. It deliberately does NOT go through T.load and bakeTrack:
   * loading mutates the one live TRACK in place, and drawing a menu must not
   * disturb the track the game is holding. The cost of that is a second,
   * much simpler painter - road, solids, racing line - and the gain is that
   * a thumbnail can never be a stale picture of a track that has since been
   * edited, the way a shipped PNG would be. */
  Renderer.thumbnail = function (index, host) {
    var data = global.TRACKS[index];
    if (!data || !host) return;
    var tint = C.roadColors();
    var pick = function (name) {
      return (tint && tint[name]) || (data.theme && data.theme[name]) || C.colors[name];
    };

    var box = 4;                        // the border the card draws around it
    var cw = 240, ch = Math.round(cw * data.rows / data.cols);
    var cv = document.createElement('canvas');
    cv.width = cw;
    cv.height = ch;
    var g = cv.getContext('2d');
    var s = cw / data.cols;

    g.fillStyle = pick('road');
    g.fillRect(0, 0, cw, ch);

    data.walls.forEach(function (w) {
      var kind = w.kind;
      g.fillStyle = kind === 'jog' ? pick('jog')
                  : kind === 'lava' ? pick('wall')
                  : kind === 'infield' ? pick('wall') : pick('outer');
      g.fillRect(w.x0 * s, w.y0 * s, (w.x1 - w.x0 + 1) * s, (w.y1 - w.y0 + 1) * s);
    });

    g.strokeStyle = pick('startLine');
    g.globalAlpha = 0.5;
    g.lineWidth = Math.max(1, s * 0.5);
    g.lineJoin = 'round';
    g.beginPath();
    data.route.forEach(function (p, i) {
      if (i === 0) g.moveTo(p.x * s, p.y * s); else g.lineTo(p.x * s, p.y * s);
    });
    g.closePath();
    g.stroke();
    g.globalAlpha = 1;

    var f = data.finish;
    g.fillStyle = pick('startLine');
    g.fillRect(f.x0 * s, f.y0 * s, Math.max(2, (f.x1 - f.x0) * s), (f.y1 - f.y0) * s);

    host.innerHTML = '';
    host.style.setProperty('--art-ratio', (data.cols / data.rows).toFixed(3));
    cv.style.padding = box + 'px';
    host.appendChild(cv);
  };

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
    Renderer.drawWeather(g, (global.performance ? performance.now() : Date.now()) / 1000);

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
