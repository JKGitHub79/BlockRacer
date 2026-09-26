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
    var hc = C.contrastColors();
    if (hc && hc[name]) return hc[name];
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
              vy: [8, 26], sway: 16, swayRate: 1.1, alpha: [0.25, 0.62], smear: 2 },
    // Rock dust off the faces: finer and faster than snow, and it falls
    // rather than drifts, because there is nothing up there to hold it.
    grit:   { per: 3000, color: '#c8b9a4', r: [0.6, 1.6], vx: [-18, -55],
              vy: [14, 42], sway: 3, swayRate: 1.3, alpha: [0.14, 0.42], smear: 2 },
    // Rain falls, it does not drift: no sway, and smeared the other way from
    // the dust - tall and thin rather than long and flat.
    rain:   { per: 1700, color: '#a8c8ea', r: [2.0, 4.6], vx: [-22, -48],
              vy: [190, 330], sway: 0, swayRate: 0.1, alpha: [0.14, 0.36], smear: 0.26 },
    // Ash off the stacks: big, slow and almost weightless, so it hangs and
    // wanders rather than falling. The opposite of grit in every number.
    ash:    { per: 5200, color: '#d8cdbc', r: [1.2, 3.2], vx: [-12, -34],
              vy: [6, 22], sway: 20, swayRate: 0.45, alpha: [0.10, 0.34], smear: 1.4 },
    // Dust hanging in the light of a ruin. Slower than anything else here
    // and it drifts UP as often as down, because nothing is moving the air.
    motes:  { per: 4000, color: '#f2dcb0', r: [0.7, 2.0], vx: [-6, -18],
              vy: [-9, 11], sway: 11, swayRate: 0.32, alpha: [0.12, 0.40], smear: 1 },
    // Embers RISE. The only weather in the game with negative vy, because
    // everything else is falling and this is coming off something hot.
    embers: { per: 2800, color: '#ffb066', r: [0.8, 2.2], vx: [-8, -26],
              vy: [-70, -22], sway: 9, swayRate: 1.1, alpha: [0.22, 0.70], smear: 0.7 },
    // Nothing falls in vacuum and nothing is blowing, so this is the only
    // weather in the game with no sway at all and a vy that is as likely to
    // be up as down: each speck holds the course it was already on.
    drift:  { per: 3400, color: '#cfe4ff', r: [0.5, 1.7], vx: [-16, -60],
              vy: [-26, 26], sway: 0, swayRate: 0.1, alpha: [0.14, 0.52], smear: 1 },
    // Spores come off the growth rather than out of the sky: they RISE, like
    // the volcano's embers, but slowly and with a long lazy sway, because
    // nothing is pushing them but the thing that let them go.
    spores: { per: 3000, color: '#a6ff86', r: [0.9, 2.4], vx: [-7, -22],
              vy: [-30, -8], sway: 17, swayRate: 0.5, alpha: [0.14, 0.46], smear: 1 }
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
    var box = upright(g);
    g.fillStyle = spec.color;
    flakes.list.forEach(function (f) {
      var y = (f.y + t * f.vy) % box.h;
      if (y < 0) y += box.h;
      var x = (f.x + t * f.vx + Math.sin(t * spec.swayRate + f.sway) * spec.sway) % box.w;
      if (x < 0) x += box.w;
      g.globalAlpha = f.alpha;
      g.fillRect(x - f.r * spec.smear, y - f.r, f.r * 2 * spec.smear, f.r * 2);
    });
    g.restore();
  };

  /* ---- stone ----------------------------------------------------------
   *
   * A cliffs solid is a single flat colour otherwise, and Overhang's massif
   * is twenty-two cells by twenty-one of it: at that size a flat fill stops
   * reading as rock and starts reading as a hole cut in the picture.
   *
   * Everything here is rectangles on the cell grid, in the same blocky idiom
   * as the rest of the game - no gradients, no noise texture, nothing that
   * would look borrowed from a different renderer. Per cell: a whole-cell
   * tone so no two cells sit at quite the same value, sometimes a bed line
   * where one course of stone meets the next, and two chips.
   *
   * The values come from the cell's OWN coordinates rather than from a
   * random stream, so the same cell is the same stone every time the track
   * is baked. Moving the slide slider rebakes the scenery, and a texture
   * seeded from Math.random would crawl every time you pressed a bracket. */
  function cellNoise(cx, cy, salt) {
    var h = Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ Math.imul(salt, 83492791);
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function drawStone(g, cx, cy) {
    var x = cx * S, y = cy * S;

    // the bed: the whole cell a step lighter or darker than its neighbours
    var t = cellNoise(cx, cy, 1);
    g.fillStyle = t < 0.55
      ? 'rgba(0,0,0,' + (0.04 + t * 0.30).toFixed(3) + ')'
      : 'rgba(255,238,212,' + ((t - 0.55) * 0.30).toFixed(3) + ')';
    g.fillRect(x, y, S, S);

    // a seam across it, on roughly a third of cells
    if (cellNoise(cx, cy, 2) < 0.34) {
      g.fillStyle = 'rgba(0,0,0,0.26)';
      g.fillRect(x, y + Math.floor(cellNoise(cx, cy, 3) * (S - 5)) + 2, S, 2);
    }

    // and two chips, one catching the light and one not
    var w = Math.max(2, Math.round(S * 0.16));
    g.fillStyle = 'rgba(255,240,216,0.14)';
    g.fillRect(x + Math.floor(cellNoise(cx, cy, 4) * (S - w - 3)) + 2,
               y + Math.floor(cellNoise(cx, cy, 5) * (S - w - 3)) + 2, w, w - 1);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(x + Math.floor(cellNoise(cx, cy, 6) * (S - w - 3)) + 2,
               y + Math.floor(cellNoise(cx, cy, 7) * (S - w - 3)) + 2, w - 1, w - 1);
  }

  /* ---- windows --------------------------------------------------------
   *
   * A city block is the one solid in the game meant to read as a BUILDING
   * rather than as terrain, so its cells get windows: nine per cell, each
   * lit warm, lit cold, or dark. Seeded from the cell's own coordinates
   * like the stone is, so a tower is the same tower every time the track is
   * baked and does not reshuffle when the slide slider moves.
   *
   * Roadworks get a single lamp instead. A hoarding is not a tower. */
  function drawWindows(g, cx, cy, kind) {
    var x = cx * S, y = cy * S;
    if (kind === 3) {
      if (cellNoise(cx, cy, 31) > 0.32) return;
      g.fillStyle = 'rgba(255,186,86,0.85)';
      g.fillRect(x + Math.floor(cellNoise(cx, cy, 32) * (S - 8)) + 3,
                 y + Math.floor(cellNoise(cx, cy, 33) * (S - 8)) + 3, 4, 4);
      return;
    }
    var n = 3, pad = 3, gap = 2;
    var w = Math.max(2, Math.floor((S - pad * 2 - gap * (n - 1)) / n));
    for (var iy = 0; iy < n; iy++) {
      for (var ix = 0; ix < n; ix++) {
        var t = cellNoise(cx * 3 + ix, cy * 3 + iy, 41);
        if (t < 0.28) {
          g.fillStyle = 'rgba(255,214,140,' + (0.34 + t).toFixed(2) + ')';
        } else if (t < 0.38) {
          g.fillStyle = 'rgba(150,215,255,0.40)';
        } else {
          g.fillStyle = 'rgba(8,11,18,0.52)';
        }
        g.fillRect(x + pad + ix * (w + gap), y + pad + iy * (w + gap), w, w);
      }
    }
  }

  /* ---- pipes ----------------------------------------------------------
   *
   * A plant block is neither terrain nor a building: it is machinery. Every
   * cell gets a soot-stained bed and a pipe run straight across it, edge to
   * edge, so the runs join up between neighbours into lines that cross the
   * whole block - which is what a pipe rack looks like from above. The axis
   * and the offset are seeded from the ROW for a horizontal run and from the
   * COLUMN for a vertical one rather than from the cell, which is the whole
   * trick: a per-cell seed would break every run at every cell edge.
   *
   * On top of that, per cell: a flange on some, a pair of bolts, and the
   * occasional drum. Seeded like the stone and the windows, so a rack is the
   * same rack every time the track is baked and does not reshuffle when the
   * slide slider moves.
   *
   * Barriers get hazard chevrons instead. A crash barrier is not a pipe. */
  function drawPipes(g, cx, cy, kind) {
    var x = cx * S, y = cy * S;

    if (kind === 3) {
      g.save();
      g.beginPath(); g.rect(x, y, S, S); g.clip();
      g.fillStyle = 'rgba(16,12,8,0.82)';
      var w = S * 0.34;
      for (var i = -2; i < 3; i++) {
        var o = i * w * 2 + ((cx + cy) % 2) * w;
        g.beginPath();
        g.moveTo(x + o, y + S);
        g.lineTo(x + o + w, y + S);
        g.lineTo(x + o + w + S, y);
        g.lineTo(x + o + S, y);
        g.closePath();
        g.fill();
      }
      g.restore();
      return;
    }

    // soot and scale: the whole cell a step darker or lighter
    var t = cellNoise(cx, cy, 11);
    g.fillStyle = t < 0.56
      ? 'rgba(0,0,0,' + (0.05 + t * 0.34).toFixed(3) + ')'
      : 'rgba(226,206,172,' + ((t - 0.56) * 0.26).toFixed(3) + ')';
    g.fillRect(x, y, S, S);

    // the run itself, seeded off the line it runs along so it joins up
    var horiz = cellNoise(0, cy, 12) < 0.55;
    var lane = horiz ? cellNoise(0, cy, 13) : cellNoise(cx, 0, 14);
    var thick = Math.max(3, Math.round(S * (0.15 + lane * 0.10)));
    var off = Math.round((0.16 + lane * 0.52) * S);
    g.fillStyle = 'rgba(20,17,14,0.55)';
    if (horiz) g.fillRect(x, y + off, S, thick);
    else g.fillRect(x + off, y, thick, S);
    // the lit top of the pipe, which is what makes it read as round
    g.fillStyle = 'rgba(232,214,180,0.16)';
    if (horiz) g.fillRect(x, y + off, S, Math.max(1, thick * 0.34));
    else g.fillRect(x + off, y, Math.max(1, thick * 0.34), S);

    // a flange across the run on about a quarter of cells
    if (cellNoise(cx, cy, 15) < 0.26) {
      g.fillStyle = 'rgba(238,222,190,0.22)';
      var fw = Math.max(2, Math.round(S * 0.12));
      var fp = Math.round(cellNoise(cx, cy, 16) * (S - fw));
      if (horiz) g.fillRect(x + fp, y + off - 2, fw, thick + 4);
      else g.fillRect(x + off - 2, y + fp, thick + 4, fw);
    }

    // a drum standing on the deck, now and then
    if (cellNoise(cx, cy, 17) < 0.11) {
      var r = S * 0.24;
      var dx = x + S * 0.5, dy = y + S * 0.5;
      g.fillStyle = 'rgba(10,9,8,0.55)';
      g.beginPath(); g.arc(dx, dy, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(236,220,188,0.24)';
      g.lineWidth = 1;
      g.beginPath(); g.arc(dx, dy, r - 1, 0, Math.PI * 2); g.stroke();
    }

    // two bolts, so the deck is plate rather than paint
    var b = Math.max(1, Math.round(S * 0.07));
    g.fillStyle = 'rgba(240,226,196,0.13)';
    g.fillRect(x + Math.round(cellNoise(cx, cy, 18) * (S - b - 3)) + 2,
               y + Math.round(cellNoise(cx, cy, 19) * (S - b - 3)) + 2, b, b);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(x + Math.round(cellNoise(cx, cy, 20) * (S - b - 3)) + 2,
               y + Math.round(cellNoise(cx, cy, 21) * (S - b - 3)) + 2, b, b);
  }

  /* ---- ruins ----------------------------------------------------------
   *
   * Dressed stone rather than the cliffs' raw rock: courses of ashlar with
   * the joints staggered from one course to the next, which is what makes
   * masonry read as built rather than as geology. On top of that, per cell
   * and seeded from its own coordinates: a carved glyph panel on some, a
   * column drum on others, a crack on a few, and a wash of lichen.
   *
   * Fallen blocks - the jog kind - get toppled column drums lying in a row
   * and more lichen. A barrier here is masonry that came down, not a thing
   * anyone put there. */
  function drawRuins(g, cx, cy, kind) {
    var x = cx * S, y = cy * S;

    // the bed: sun-bleached or shadowed, a step either way per cell
    var t = cellNoise(cx, cy, 51);
    g.fillStyle = t < 0.52
      ? 'rgba(0,0,0,' + (0.04 + t * 0.30).toFixed(3) + ')'
      : 'rgba(255,236,198,' + ((t - 0.52) * 0.34).toFixed(3) + ')';
    g.fillRect(x, y, S, S);

    if (kind === 3) {
      // toppled drums, lying where they fell
      var n = 2 + (cellNoise(cx, cy, 52) < 0.5 ? 0 : 1);
      var flat = cellNoise(cx, cy, 53) < 0.5;
      for (var i = 0; i < n; i++) {
        var f = (i + 0.5) / n;
        var dx = flat ? x + S * f : x + S * (0.32 + cellNoise(cx, cy, 54 + i) * 0.36);
        var dy = flat ? y + S * (0.32 + cellNoise(cx, cy, 57 + i) * 0.36) : y + S * f;
        var r = S * 0.19;
        g.fillStyle = 'rgba(28,32,16,0.45)';
        g.beginPath(); g.arc(dx, dy, r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(232,240,196,0.26)';
        g.lineWidth = 1;
        g.beginPath(); g.arc(dx, dy, r - 1, 0, Math.PI * 2); g.stroke();
      }
      return;
    }

    // three courses of ashlar, joints staggered course to course
    var courses = 3, ch = S / courses;
    for (var c = 0; c < courses; c++) {
      var cy2 = y + c * ch;
      g.fillStyle = 'rgba(0,0,0,0.26)';
      if (c) g.fillRect(x, cy2, S, 1);                 // the bed joint
      var off = ((cx * courses + c) % 2) * 0.5;        // stagger
      for (var j = 0; j <= 1; j++) {
        var jx = x + ((j + off) % 1.5) * S;
        if (jx >= x && jx < x + S) g.fillRect(jx, cy2, 1, ch);
      }
    }

    // a carved panel on about a fifth of the blocks
    if (cellNoise(cx, cy, 58) < 0.20) {
      var pad = Math.max(2, Math.round(S * 0.16));
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(x + pad, y + pad, S - pad * 2, S - pad * 2);
      g.fillStyle = 'rgba(255,232,186,0.20)';
      for (var r2 = 0; r2 < 3; r2++) {
        for (var c2 = 0; c2 < 3; c2++) {
          if (cellNoise(cx * 3 + c2, cy * 3 + r2, 59) > 0.45) continue;
          g.fillRect(x + pad + 1 + c2 * ((S - pad * 2 - 2) / 3),
                     y + pad + 1 + r2 * ((S - pad * 2 - 2) / 3),
                     Math.max(1, (S - pad * 2 - 2) / 3 - 1),
                     Math.max(1, (S - pad * 2 - 2) / 3 - 1));
        }
      }
    } else if (cellNoise(cx, cy, 60) < 0.13) {
      // or a column drum standing on the course
      var r3 = S * 0.27, mx = x + S * 0.5, my = y + S * 0.5;
      g.fillStyle = 'rgba(255,238,204,0.14)';
      g.beginPath(); g.arc(mx, my, r3, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.32)';
      g.lineWidth = 1;
      g.beginPath(); g.arc(mx, my, r3, 0, Math.PI * 2); g.stroke();
    }

    // a crack, and a wash of lichen in the shade
    if (cellNoise(cx, cy, 61) < 0.22) {
      g.strokeStyle = 'rgba(0,0,0,0.30)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + cellNoise(cx, cy, 62) * S, y);
      g.lineTo(x + cellNoise(cx, cy, 63) * S, y + S);
      g.stroke();
    }
    if (cellNoise(cx, cy, 64) < 0.22) {
      g.fillStyle = 'rgba(122,150,74,0.16)';
      g.fillRect(x, y + S * 0.62, S, S * 0.38);
    }
  }

  /* ---- crust ----------------------------------------------------------
   *
   * Cooled basalt: near black, cracked into plates, and glowing along the
   * cracks where it has not finished cooling. The glow is baked rather than
   * animated - the live lava painter handles the rects that are actually
   * molten, and a whole map of pulsing cracks would fight it.
   *
   * Lava cells (kind 4) get nothing here: their crust is the flat fill and
   * the molten middle is painted over it every frame. */
  function drawCrust(g, cx, cy, kind) {
    if (kind === 4) return;
    var x = cx * S, y = cy * S;

    var t = cellNoise(cx, cy, 71);
    g.fillStyle = t < 0.5
      ? 'rgba(0,0,0,' + (0.10 + t * 0.44).toFixed(3) + ')'
      : 'rgba(150,104,80,' + ((t - 0.5) * 0.24).toFixed(3) + ')';
    g.fillRect(x, y, S, S);

    // the plates: two cracks across the cell, one each way, offset per cell
    var gap = Math.max(2, Math.round(S * 0.10));
    var hx = Math.round(cellNoise(cx, cy, 72) * (S - gap * 2)) + gap;
    var hy = Math.round(cellNoise(cx, cy, 73) * (S - gap * 2)) + gap;
    var hot = cellNoise(cx, cy, 74);
    g.fillStyle = 'rgba(0,0,0,0.42)';
    g.fillRect(x + hx, y, 1, S);
    g.fillRect(x, y + hy, S, 1);
    if (hot < 0.42) {
      // still cooling: the crack glows, hotter the nearer it is to fresh
      var a = (0.20 + (0.42 - hot) * 1.1).toFixed(2);
      g.fillStyle = 'rgba(255,' + (90 + Math.round(hot * 240)).toString() + ',40,' + a + ')';
      if (cellNoise(cx, cy, 75) < 0.5) g.fillRect(x + hx, y, 1, S);
      else g.fillRect(x, y + hy, S, 1);
    }

    if (kind === 3) {
      // a barrier here is a spatter cone: a ring of cooled spray
      g.strokeStyle = 'rgba(255,150,60,0.30)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(x + S * 0.5, y + S * 0.5, S * 0.30, 0, Math.PI * 2);
      g.stroke();
      return;
    }

    // a scatter of bombs thrown out and frozen where they landed
    if (cellNoise(cx, cy, 76) < 0.18) {
      var r = S * (0.10 + cellNoise(cx, cy, 77) * 0.10);
      var bx = x + gap + cellNoise(cx, cy, 78) * (S - gap * 2);
      var by = y + gap + cellNoise(cx, cy, 79) * (S - gap * 2);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(190,120,86,0.22)';
      g.beginPath(); g.arc(bx - r * 0.25, by - r * 0.25, r * 0.55, 0, Math.PI * 2); g.fill();
    }
  }

  /* ---- the void -------------------------------------------------------
   *
   * On a vacuum theme every solid IS open space. There is nothing built out
   * there to draw, so the wall texture is the sky itself: a scatter of stars
   * per cell over near-black, with the occasional bright one.
   *
   * It is BAKED, like every other wall painter, rather than scrolled live.
   * A drifting starfield was built first - two star layers at different
   * speeds, masked to the shape of the walls and composited every frame -
   * and it looked better standing still than it was worth: full-resolution
   * masking cost half the frame rate, 18fps against the volcano's 36 on the
   * same machine. A station in orbit is not moving relative to the stars
   * anyway, and the drifting weather over the top already says the scene is
   * alive.
   *
   * The values invert here against the rest of the game. Everywhere else the
   * walls are the lit thing and the road is dark; out here the walls are
   * nothing at all, so the deck is the only lit surface on the board and the
   * lip along its edge is what tells you where it stops. */
  function drawStars(g, cx, cy) {
    var x = cx * S, y = cy * S, i;

    /* A wash of far-off gas. Seeded from a smooth function of the cell rather
     * than from the cell's own noise: noise per cell reads as a grid, and
     * noise per block of cells reads as a checkerboard, but a couple of sine
     * terms give a field that drifts across the whole map and still resolves
     * to one flat tone per cell, which is the idiom the game is drawn in. */
    var f = Math.sin(cx * 0.19 + cy * 0.07) * Math.cos(cy * 0.13 - cx * 0.05);
    if (f > 0.05) {
      g.fillStyle = 'rgba(90,150,255,' + (f * 0.075).toFixed(3) + ')';
      g.fillRect(x, y, S, S);
    } else if (f < -0.05) {
      g.fillStyle = 'rgba(150,110,235,' + (-f * 0.085).toFixed(3) + ')';
      g.fillRect(x, y, S, S);
    }

    var n = 2 + Math.floor(cellNoise(cx, cy, 202) * 3);
    for (i = 0; i < n; i++) {
      var sx = x + Math.floor(cellNoise(cx, cy, 210 + i * 3) * S);
      var sy = y + Math.floor(cellNoise(cx, cy, 211 + i * 3) * S);
      var b = cellNoise(cx, cy, 212 + i * 3);
      // most stars are white, a few are blue, fewer are old and orange
      var col = b < 0.12 ? '255,214,170' : b < 0.28 ? '190,214,255' : '236,244,255';
      g.fillStyle = 'rgba(' + col + ',' + (0.20 + b * 0.58).toFixed(2) + ')';
      g.fillRect(sx, sy, 1, 1);
    }

    // one cell in forty carries something bright enough to have a cross
    if (cellNoise(cx, cy, 230) < 0.025) {
      var px = x + S * 0.5, py = y + S * 0.5;
      var r = Math.max(2, S * 0.085);
      var halo = g.createRadialGradient(px, py, 0, px, py, r * 5);
      halo.addColorStop(0, 'rgba(200,226,255,0.28)');
      halo.addColorStop(1, 'rgba(200,226,255,0)');
      g.fillStyle = halo;
      g.fillRect(px - r * 5, py - r * 5, r * 10, r * 10);
      g.fillStyle = 'rgba(248,252,255,0.95)';
      g.fillRect(px - r / 2, py - r / 2, r, r);
      g.fillStyle = 'rgba(248,252,255,0.42)';
      g.fillRect(px - r * 2.6, py - 0.5, r * 5.2, 1);
      g.fillRect(px - 0.5, py - r * 2.6, 1, r * 5.2);
    }
  }

  /* ---- hive -----------------------------------------------------------
   *
   * Growth, not building and not geology. The idiom is still rectangles on
   * the cell grid, so the organic reading has to come from what the shapes
   * DO rather than from their outlines: a vein that runs edge to edge so it
   * joins up with its neighbours into a run across the whole block, a
   * thickening where two veins cross, and pods that glow.
   *
   * The gate cells - the jog kind - are an egg cluster in a colour nothing
   * else on the track uses. On a green map the one thing you must not drive
   * into should not also be green. */
  function drawHive(g, cx, cy, kind) {
    var x = cx * S, y = cy * S;

    var t = cellNoise(cx, cy, 301);
    g.fillStyle = t < 0.5
      ? 'rgba(0,0,0,' + (0.06 + t * 0.34).toFixed(3) + ')'
      : 'rgba(150,255,140,' + ((t - 0.5) * 0.20).toFixed(3) + ')';
    g.fillRect(x, y, S, S);

    if (kind === 3) {
      // an egg cluster: three pods, lit from inside
      for (var e = 0; e < 3; e++) {
        var ex = x + S * (0.26 + (e % 2) * 0.42);
        var ey = y + S * (0.24 + e * 0.22);
        var er = S * 0.15;
        var eg = g.createRadialGradient(ex, ey, 0, ex, ey, er * 2.4);
        eg.addColorStop(0, 'rgba(226,150,255,0.55)');
        eg.addColorStop(1, 'rgba(226,150,255,0)');
        g.fillStyle = eg;
        g.fillRect(ex - er * 2.4, ey - er * 2.4, er * 4.8, er * 4.8);
        g.fillStyle = 'rgba(247,214,255,0.85)';
        g.beginPath(); g.arc(ex, ey, er, 0, Math.PI * 2); g.fill();
      }
      return;
    }

    /* The veins. Each cell carries one straight through it, edge to edge, so
     * a cell whose neighbour drew the same axis continues the same line and
     * a solid ends up threaded rather than speckled. */
    var vert = cellNoise(cx, cy, 302) < 0.5;
    var off = Math.round(cellNoise(cx, cy, 303) * (S - 8)) + 4;
    var th = Math.max(2, Math.round(S * 0.09));
    g.fillStyle = 'rgba(0,0,0,0.34)';
    if (vert) g.fillRect(x + off, y, th, S); else g.fillRect(x, y + off, S, th);
    g.fillStyle = 'rgba(138,255,122,0.16)';
    if (vert) g.fillRect(x + off, y, 1, S); else g.fillRect(x, y + off, S, 1);

    // a node where the vein swells, and sometimes a pod lit from inside it
    var nd = cellNoise(cx, cy, 304);
    if (nd < 0.34) {
      var px = vert ? x + off + th / 2 : x + S * (0.2 + nd);
      var py = vert ? y + S * (0.2 + nd) : y + off + th / 2;
      var pr = S * (0.09 + nd * 0.14);
      g.fillStyle = 'rgba(0,0,0,0.30)';
      g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill();
      if (nd < 0.14) {
        var pg = g.createRadialGradient(px, py, 0, px, py, pr * 2.6);
        pg.addColorStop(0, 'rgba(150,255,110,0.50)');
        pg.addColorStop(1, 'rgba(150,255,110,0)');
        g.fillStyle = pg;
        g.fillRect(px - pr * 2.6, py - pr * 2.6, pr * 5.2, pr * 5.2);
        g.fillStyle = 'rgba(214,255,190,0.80)';
        g.beginPath(); g.arc(px, py, pr * 0.5, 0, Math.PI * 2); g.fill();
      }
    }

    // spore specks, so the surface is never quite flat
    if (cellNoise(cx, cy, 305) < 0.30) {
      g.fillStyle = 'rgba(180,255,160,0.22)';
      g.fillRect(x + Math.floor(cellNoise(cx, cy, 306) * S),
                 y + Math.floor(cellNoise(cx, cy, 307) * S), 2, 2);
    }
  }

  /* ---- high contrast ---------------------------------------------------
   *
   * The gate blocks have to be tellable from the rest of the scenery, and in
   * a mode built for people who cannot rely on hue they cannot be tellable
   * BY hue. So they are the same white as every other solid and carry a
   * black hatch instead: a difference in pattern, which survives every kind
   * of colour vision and also survives a black and white photograph, which
   * is the quickest test there is. */
  function drawHatch(g, cx, cy, kind) {
    if (kind !== 3) return;
    var x = cx * S, y = cy * S, i;
    g.save();
    g.beginPath();
    g.rect(x, y, S, S);
    g.clip();
    g.strokeStyle = '#000000';
    g.lineWidth = Math.max(2, S * 0.10);
    for (i = -1; i < 3; i++) {
      g.beginPath();
      g.moveTo(x + i * S * 0.5, y);
      g.lineTo(x + i * S * 0.5 + S, y + S);
      g.stroke();
    }
    g.restore();
  }

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
    /* Every wall painter is turned off here. They are all texture, and
     * texture on a solid that is meant to read as a single flat "not road"
     * is noise competing with the one distinction that matters. */
    var flat = !!C.contrastColors();
    var stone = !flat && !!(T.theme && T.theme.rock);
    var lit = !flat && !!(T.theme && T.theme.windows);
    var plant = !flat && !!(T.theme && T.theme.pipes);
    var dressed = !flat && !!(T.theme && T.theme.glyphs);
    var basalt  = !flat && !!(T.theme && T.theme.crust);
    var sky     = !flat && !!(T.theme && T.theme.vacuum);
    var grown   = !flat && !!(T.theme && T.theme.hive);
    eachWall(function (cx, cy, kind) {
      // Four kinds of solid: the islands inside the circuit, the ground
      // outside it, the chicane blocks, and lava - whose cooled crust is
      // baked here and whose molten middle is painted over it every frame.
      g.fillStyle = kind === 3 ? colorOf('jog')
                  : (kind === 2 || kind === 4 || kind === 5) ? colorOf('wall')
                  : colorOf('outer');
      g.fillRect(cx * S, cy * S, S, S);
      if (stone) drawStone(g, cx, cy);
      if (lit) drawWindows(g, cx, cy, kind);
      if (plant) drawPipes(g, cx, cy, kind);
      if (dressed) drawRuins(g, cx, cy, kind);
      if (basalt) drawCrust(g, cx, cy, kind);
      if (sky) drawStars(g, cx, cy);
      if (grown) drawHive(g, cx, cy, kind);
      if (flat) drawHatch(g, cx, cy, kind);
    });

    if (!flat) drawEmblems(g);

    /* The lit edges. Everywhere but space these make a solid read as a block
     * standing up off the road: three sides catch the light and the fourth,
     * the one facing you, is in shadow.
     *
     * A hole is not a block. It has no top face to catch the light and no
     * underside to cast a shadow, so on a vacuum theme the shadow is wrong
     * three ways at once: it is the only unlit edge on the board, it is black
     * against a starfield that is already black, and it makes the same hole
     * look outlined along one edge and open along the other. Every side of a
     * hole is the same cut edge of the same deck, so every side gets the same
     * line. */
    eachWall(function (cx, cy, kind) {
      g.fillStyle = sky ? colorOf('wallTop')
                  : kind === 3 ? colorOf('jogTop')
                  : (kind === 2 || kind === 4 || kind === 5) ? colorOf('wallTop')
                  : colorOf('outerTop');
      if (!T.isWall(cx, cy - 1)) g.fillRect(cx * S, cy * S, S, 3);
      if (!T.isWall(cx - 1, cy)) g.fillRect(cx * S, cy * S, 3, S);
      if (!T.isWall(cx + 1, cy)) g.fillRect(cx * S + S - 3, cy * S, 3, S);
      if (!T.isWall(cx, cy + 1)) {
        if (!sky) g.fillStyle = 'rgba(0,0,0,0.45)';
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
    // the track it replaces is released at once (Viewport.releaseCanvas)
    if (trackCanvas && trackCanvas !== cv && global.Viewport) global.Viewport.releaseCanvas(trackCanvas);
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

  /* ---- the thing overhead ---------------------------------------------
   *
   * Every few seconds a saucer crosses the board, fast, strafing as it goes.
   * It is scenery: it flies OVER the track, it is drawn after the cars, and
   * nothing in the physics or the collision grid has ever heard of it. The
   * lasers cannot hurt you either - if they could, a race would be decided
   * by something the player has no way to read or avoid, which is the one
   * thing this game has never done to anyone.
   *
   * It carries no state. Everything is a function of the clock: which pass
   * this is, how far through it, where the saucer was when each bolt left
   * it. A pass takes PERIOD seconds and the crossing itself takes a fifth of
   * that, so the sky is empty most of the time and the thing arrives, is
   * gone, and leaves you wondering whether it was there.
   */
  var UFO_PERIOD = 3.4;     // seconds between passes
  var UFO_CROSS = 0.22;     // fraction of the period it is actually on screen
  var UFO_BOLTS = 14;       // bolts kept alive behind it
  var UFO_GAP = 0.06;       // seconds between shots

  function ufoHash(k, salt) {
    var h = Math.imul(k | 0, 2654435761) ^ Math.imul(salt, 40503);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /* Where the saucer is at local time `u` seconds into its pass, or null if
   * it has not arrived or has already gone. */
  function ufoAt(k, u, w, h, r) {
    var span = UFO_PERIOD * UFO_CROSS;
    if (u < 0 || u > span) return null;
    var f = u / span;
    var dir = (k & 1) ? -1 : 1;
    var x = dir > 0 ? -r * 2 + (w + r * 4) * f : w + r * 2 - (w + r * 4) * f;
    var y = h * (0.12 + ufoHash(k, 7) * 0.7);
    // a shallow rise and fall across the pass, so it is flying rather than sliding
    y += Math.sin(f * Math.PI) * h * 0.04 * (ufoHash(k, 11) < 0.5 ? 1 : -1);
    return { x: x, y: y, dir: dir };
  }

  /* Seen from above: a disc, a brighter dome, and a ring of lights. */
  function drawSaucer(g, x, y, r, t) {
    g.save();
    // the shadow it throws on whatever is underneath it
    g.fillStyle = 'rgba(0,0,0,0.30)';
    g.beginPath();
    g.ellipse(x + r * 0.22, y + r * 0.30, r * 0.95, r * 0.42, 0, 0, Math.PI * 2);
    g.fill();

    var glow = g.createRadialGradient(x, y, 0, x, y, r * 2.1);
    glow.addColorStop(0, 'rgba(124,255,90,0.30)');
    glow.addColorStop(1, 'rgba(124,255,90,0)');
    g.fillStyle = glow;
    g.fillRect(x - r * 2.1, y - r * 2.1, r * 4.2, r * 4.2);

    g.fillStyle = '#10241a';
    g.beginPath();
    g.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#25543a';
    g.beginPath();
    g.ellipse(x, y - r * 0.06, r * 0.48, r * 0.30, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(190,255,170,0.85)';
    g.beginPath();
    g.ellipse(x, y - r * 0.10, r * 0.22, r * 0.14, 0, 0, Math.PI * 2);
    g.fill();

    // running lights round the rim, chasing
    for (var i = 0; i < 7; i++) {
      var a = (i / 7) * Math.PI * 2 + t * 3.4;
      var lx = x + Math.cos(a) * r * 0.82;
      var ly = y + Math.sin(a) * r * 0.34;
      g.fillStyle = i % 2 ? 'rgba(124,255,90,0.90)' : 'rgba(255,90,90,0.85)';
      g.fillRect(lx - 1.5, ly - 1.5, 3, 3);
    }
    g.restore();
  }

  /* One pass of the saucer, plus the bolts it has fired so far this pass.
   * `w`/`h` are the surface it is crossing and `r` its radius on it. */
  function drawFlyby(g, t, w, h, r) {
    var k = Math.floor(t / UFO_PERIOD);
    var u = t - k * UFO_PERIOD;
    var here = ufoAt(k, u, w, h, r);
    if (!here) return;

    g.save();
    for (var i = UFO_BOLTS; i >= 1; i--) {
      var fired = u - i * UFO_GAP;
      var from = ufoAt(k, fired, w, h, r);
      if (!from) continue;
      var age = i * UFO_GAP;
      var bx = from.x + from.dir * r * 3.2 * age;
      var by = from.y + h * 0.62 * age;
      if (by > h + r) continue;
      g.globalAlpha = Math.max(0, 1 - age / (UFO_BOLTS * UFO_GAP)) * 0.95;
      g.fillStyle = '#ff2a2a';
      g.fillRect(bx - 1.5, by - r * 0.22, 3, r * 0.44);
      g.fillStyle = 'rgba(255,170,170,0.9)';
      g.fillRect(bx - 0.5, by - r * 0.18, 1, r * 0.36);
    }
    g.globalAlpha = 1;
    drawSaucer(g, here.x, here.y, r, t);
    g.restore();
  }

  Renderer.drawFlyby = function (g, t) {
    if (!(T.theme && T.theme.hive)) return;
    drawFlyby(g, t, T.width, T.height, S * 1.7);
  };

  /* A point on the screen, in the track pixels the board is drawn in -
   * through the quarter turn when the board has one - with how many CSS
   * pixels one track pixel is. Null when it is off the board. */
  function screenToTrack(cx, cy) {
    var rc = Renderer.canvas.getBoundingClientRect();
    var lx = cx - rc.left, ly = cy - rc.top;
    if (!(rc.width > 0) || lx < 0 || ly < 0 || lx > rc.width || ly > rc.height) return null;
    return Renderer.rotated
      ? { x: T.width - ly / rc.height * T.width, y: lx / rc.width * T.height, px: rc.width / T.height }
      : { x: lx / rc.width * T.width, y: ly / rc.height * T.height, px: rc.width / T.width };
  }

  /* Did a press at (cx, cy) land on the saucer? It is drawn from the same
   * clock this reads, so this is where it was, not a guess. It moves a
   * board's width in three quarters of a second, so the press is checked
   * against the last 150ms of its path (a finger lands where the thing WAS)
   * with a disc a little bigger than the saucer, and never less than 22 CSS
   * pixels across the radius, which is about a fingertip. Returns which pass
   * it was (-1 for a miss), so two presses can be matched to one pass. The
   * saucer itself is untouched: nothing here draws, and nothing about it
   * looks or behaves any differently for being pressable. */
  Renderer.ufoHit = function (cx, cy) {
    if (!(T.theme && T.theme.hive) || C.contrastColors()) return -1;
    var p = screenToTrack(cx, cy);
    if (!p) return -1;
    var r = S * 1.7, reach = Math.max(r * 1.25, 22 / p.px);
    var now = (global.performance ? performance.now() : Date.now()) / 1000;
    for (var back = 0; back <= 0.15; back += 0.015) {
      var t = now - back, k = Math.floor(t / UFO_PERIOD);
      var at = ufoAt(k, t - k * UFO_PERIOD, T.width, T.height, r);
      if (at && Math.hypot(at.x - p.x, at.y - p.y) <= reach) return k;
    }
    return -1;
  };

  /* A point on the track, in cells, to where it is on the screen now, in
   * CSS pixels - through the quarter turn when the board has one. */
  Renderer.trackToClient = function (x, y) {
    var rc = this.canvas.getBoundingClientRect(), px = x * S, py = y * S;
    return this.rotated
      ? { x: rc.left + py / T.height * rc.width, y: rc.top + (T.width - px) / T.width * rc.height }
      : { x: rc.left + px / T.width * rc.width, y: rc.top + py / T.height * rc.height };
  };

  // Where the saucer is on the screen right now, or null. For the tests.
  Renderer._ufoScreen = function () {
    var t = (global.performance ? performance.now() : Date.now()) / 1000, k = Math.floor(t / UFO_PERIOD);
    var at = ufoAt(k, t - k * UFO_PERIOD, T.width, T.height, S * 1.7);
    if (!at) return null;
    var rc = this.canvas.getBoundingClientRect();
    return this.rotated
      ? { x: rc.left + at.y / T.height * rc.width, y: rc.top + (T.width - at.x) / T.width * rc.height }
      : { x: rc.left + at.x / T.width * rc.width, y: rc.top + at.y / T.height * rc.height };
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
  /* Directions between the screen and the track, for a board that may be
   * turned: a swipe is on the screen and the car turns on the track, and an
   * instruction that names a direction names it on the screen. */
  Renderer.rotated = false;
  Renderer.toTrack = function (d) { return this.rotated ? { x: -d.y, y: d.x } : d; };
  Renderer.toScreen = function (d) { return this.rotated ? { x: d.y, y: -d.x } : d; };

  /* Draw the next thing the right way up on the screen rather than on the
   * track: text, and weather, which falls DOWN whichever way the track is
   * turned. Returns the size of the box that is then drawn into, in track
   * pixels, and must be paired with g.restore(). */
  function upright(g) {
    g.save();
    if (!Renderer.rotated) return { w: T.width, h: T.height };
    var c = Renderer.canvas;
    g.setTransform(c.width / T.height, 0, 0, c.height / T.width, 0, 0);
    return { w: T.height, h: T.width };
  }

  Renderer.fit = function () {
    var canvas = this.canvas;
    var board = canvas.parentNode;                         // .board
    var stage = board.parentNode.parentNode;               // .canvas-wrap > .stage
    var hud = stage.querySelector('.hud');
    var css = global.getComputedStyle(stage);
    var column = css.flexDirection === 'column';
    var gap = parseFloat(css.gap) || 0;

    /* Anything this function wrote last time goes back to the stylesheet's
     * value BEFORE anything is measured. Everything below reads the layout,
     * and reading back your own previous answer is how a fit turns into a
     * loop. With this reset, fitting twice gives the same board as fitting
     * once, whatever order things happen in. */
    if (hud) { hud.style.flexBasis = ''; }

    // Measure the stage and subtract the panel, rather than measuring the box
    // the board sits in. The board's own size must never be an input here or
    // sizing it changes the space it is being sized to fit.
    var availW = stage.clientWidth - (column || !hud ? 0 : hud.offsetWidth + gap);
    var availH = stage.clientHeight - (!column || !hud ? 0 : hud.offsetHeight + gap);

    /* Lying down, HOME floats in the gutter beside the board rather than in
     * a bar of its own, so the board must leave it that strip - on a track
     * wide enough to use the whole width, it otherwise ran under the button. */
    var reserve = 0;
    var bar = document.querySelector('.topbar');
    var home = document.getElementById('btn-home');
    if (!column && bar && home && global.getComputedStyle(bar).position === 'absolute') {
      reserve = home.offsetWidth + 18;
    }
    availW -= reserve;

    /* The board's own border, measured rather than assumed. It used to be a
     * hardcoded 2, which is right when the frame has a side on it and wrong
     * upright, where the board runs off both edges of the screen and the left
     * and right borders are taken off - two pixels of screen width, which is
     * the one direction upright has none to spare in. */
    var bs = global.getComputedStyle(board);
    var bx = (parseFloat(bs.borderLeftWidth) || 0) + (parseFloat(bs.borderRightWidth) || 0);
    var by = (parseFloat(bs.borderTopWidth) || 0) + (parseFloat(bs.borderBottomWidth) || 0);

    var scale = Math.min((availW - bx) / T.width, (availH - by) / T.height);
    /* Upright, a track - every one of them is wider than it is tall - is
     * limited by the width of the screen and leaves the height to spare. A
     * quarter turn puts its long side along the long side of the screen and
     * the board comes out bigger. Only where it does: lying down, or on a
     * track the shape of the space it has, it stays as it is. The turn is
     * a picture of the track and nothing else - the physics, the lap, every
     * coordinate in the game is untouched; only what is drawn and which way
     * a swipe points are turned (Renderer.toTrack / toScreen). */
    var turned = Math.min((availW - bx) / T.height, (availH - by) / T.width);
    this.rotated = turned > scale * 1.02;
    if (this.rotated) scale = turned;
    if (!(scale > 0)) scale = 1;

    var cssW = Math.max(1, Math.floor((this.rotated ? T.height : T.width) * scale));
    var cssH = Math.max(1, Math.floor((this.rotated ? T.width : T.height) * scale));
    var dpr = Math.min(global.devicePixelRatio || 1, 2);

    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    // Resizing the backing store clears the context, so the transform that
    // maps track pixels onto it has to be set again here.
    this.ctx = canvas.getContext('2d');
    if (this.rotated) {
      // A quarter turn anticlockwise: the track's top is the screen's left,
      // so a start straight along the bottom runs up the screen.
      this.ctx.setTransform(0, -canvas.height / T.width, canvas.width / T.height, 0, 0, canvas.height);
    } else {
      this.ctx.setTransform(canvas.width / T.width, 0, 0, canvas.height / T.height, 0, 0);
    }

    /* ---- and the panel takes up the slack ----------------------------
     *
     * The board keeps the track's shape, and no track is anywhere near the
     * shape of a phone: they run from 1.10 to 1.85 wide and a phone lying
     * down is 2.2. So the board always runs out of one dimension with the
     * other to spare - lying down it fills the height with a third of the
     * width left over, standing up it fills the width with half the height
     * left over - and that leftover was simply empty.
     *
     * It goes to the panel now. The panel is written to AFTER the board has
     * been sized and is reset above before anything is measured, which is
     * what makes this safe. Doing it in CSS with `flex: 1 1 auto` looks like
     * the same idea and is not: the panel's size is an INPUT to the board's
     * size, so every pass would hand the board a border's width less than
     * the last and the board would walk down to nothing. That was tried.
     *
     * Lying down the panel also leaves a strip for the HOME button, which is
     * floating in that gutter rather than sitting in a bar of its own.
     *
     * LYING DOWN ONLY. Upright there is half a screen of slack, and a panel
     * stretched over it is eight readouts spread across five hundred pixels
     * with holes between them - which looks worse than the empty band did,
     * and makes the board look smaller into the bargain. Upright the slack
     * goes round the board instead (see the stylesheet). */
    if (hud && !column) {
      var slack = stage.clientWidth - cssW - bx - gap - hud.offsetWidth - reserve;
      /* flex-basis, not width or height. The panel is a flex item with a
       * basis of its own in the stylesheet, and a basis beats a width - the
       * first version of this set the width, the panel ignored it, and the
       * gutter stayed exactly as empty as before. Basis is the main-axis
       * size either way round: the stage is a row lying down and a column
       * standing up, so one property covers both. */
      if (slack > 1) hud.style.flexBasis = (hud.offsetWidth + slack) + 'px';
    }
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
    var hc = C.contrastColors();
    var pick = function (name) {
      return (hc && hc[name]) || (tint && tint[name]) ||
             (data.theme && data.theme[name]) || C.colors[name];
    };

    /* Every thumbnail is the same shape, whatever shape the track is, and the
     * track is letterboxed inside it. Cards sized to their own map put a
     * 46-cell circuit next to a 40-cell one and left the row uneven. */
    var cw = 260, ch = 168, pad = 8;
    var cv = document.createElement('canvas');
    cv.width = cw;
    cv.height = ch;
    var g = cv.getContext('2d');
    var s = Math.min((cw - pad * 2) / data.cols, (ch - pad * 2) / data.rows);
    var ox = (cw - data.cols * s) / 2;
    var oy = (ch - data.rows * s) / 2;

    g.fillStyle = '#05070c';
    g.fillRect(0, 0, cw, ch);
    g.translate(ox, oy);
    g.fillStyle = pick('road');
    g.fillRect(0, 0, data.cols * s, data.rows * s);

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

    if (global.Viewport) global.Viewport.releaseCanvases(host);
    host.innerHTML = '';
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

  /* '#5ef2ff' -> '94,242,255', so a car's own colour can be used at an
   * alpha. The livery is stored as hex because that is what CSS wants. */
  function hexRgb(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
  }

  /* Your record lap: your own car, in your own paint, at a third of its
   * strength. No shadow, no halo and no crash flash - everything that says
   * "this is a solid thing you are driving" is left off, so it reads as a
   * trace of a lap rather than a second car. In high contrast it is a plain
   * white shape, for the same reason every other texture goes.
   *
   * It does wear the same edge as your car, though, so the two are the same
   * size on the road: without it the ghost was a bare body beside a car with
   * a ring round it, and read as a smaller car. The edge and the body are
   * put together at full strength on a canvas of their own and only then
   * laid down faded - faded one over the other, the ring would show through
   * the body and wash its paint out. */
  var ghostBuf = null;
  function drawGhost(g, pose) {
    var L = C.carLength * S, W = C.carWidth * S;
    var hc = !!C.contrastColors();
    var Cos = global.Cosmetics;
    var m = g.getTransform ? g.getTransform() : null;
    var k = m ? Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d)) || 1 : 1;
    var pad = 9;                                    // room for the widest edge
    var bw = Math.ceil((L + pad * 2) * k), bh = Math.ceil((W + pad * 2) * k);
    if (!ghostBuf) ghostBuf = document.createElement('canvas');
    if (ghostBuf.width !== bw || ghostBuf.height !== bh) { ghostBuf.width = bw; ghostBuf.height = bh; }
    var b = ghostBuf.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, bw, bh);
    b.setTransform(k, 0, 0, k, bw / 2, bh / 2);

    var ring = (Cos && Cos.fillSilhouette) ? function (grow, style) {
      Cos.fillSilhouette(b, L, W, Cos.equippedVehicle(), grow, style);
    } : function (grow, style) {
      b.fillStyle = style;
      b.fillRect(-L / 2 - grow, -W / 2 - grow, L + grow * 2, W + grow * 2);
    };
    // the player's edges, in the ghost's colours: see drawCar
    if (hc) { ring(7, '#ffffff'); ring(3.5, '#000000'); }
    else ring(2, 'rgba(255,255,255,0.9)');
    if (Cos) {
      Cos.drawCar(b, L, W, Cos.equippedSkin(), Cos.equippedVehicle(), 0, hc ? '#ffffff' : null);
    } else {
      b.fillStyle = '#ffffff';
      b.fillRect(-L / 2, -W / 2, L, W);
    }

    g.save();
    g.globalAlpha = hc ? 0.5 : 0.42;
    g.translate(pose.x * S, pose.y * S);
    g.rotate(pose.a);
    g.drawImage(ghostBuf, -bw / k / 2, -bh / k / 2, bw / k, bh / k);
    g.restore();
  }

  var HC_MARK = '#ffd400';   // your car, in high contrast
  var STILL = !!(global.matchMedia &&
                 global.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* The boost's flame, in the car's own space (nose at +x): a flickering
   * cone off the tail in the colours of the level that earned it
   * (CONFIG.proFlames) - level 4 twice as long as level 3. Glowing on the
   * dark ground; laid on flat in high contrast, where additive glow would
   * vanish into the white. It shrinks away over the boost's last tenth of a
   * second. */
  function drawFlame(g, L, W, car, hc) {
    var now = (global.performance ? performance.now() : Date.now()) / 1000;
    var f = 0.78 + 0.22 * Math.sin(now * 53) * Math.sin(now * 29);
    var fade = Math.min(1, car.boostT / 0.12);
    var F = C.proFlames[Math.max(0, Math.min(C.proFlames.length - 1, (car.boostLevel || 3) - 1))];
    var len = L * (0.6 + 0.35 * f) * fade * F.long, half = W * 0.34, tail = -L / 2 + 1;
    g.save();
    if (!hc) g.globalCompositeOperation = 'lighter';
    g.fillStyle = F.outer;
    g.beginPath();
    g.moveTo(tail, -half); g.lineTo(-L / 2 - len, 0); g.lineTo(tail, half);
    g.closePath(); g.fill();
    g.fillStyle = F.inner;
    g.beginPath();
    g.moveTo(tail, -half * 0.5); g.lineTo(-L / 2 - len * 0.55, 0); g.lineTo(tail, half * 0.5);
    g.closePath(); g.fill();
    g.restore();
  }

  function drawCar(g, car) {
    var L = C.carLength * S, W = C.carWidth * S;
    var a = car.bodyAngle();
    var cos = Math.cos(a), sin = Math.sin(a);

    /* The halo goes on BEFORE the body and outside the rotation, so it is a
     * circle under the car rather than an oval that swings with it. The
     * player's car only: the point of it is telling yours from theirs. */
    if (car.isPlayer && C.playerGlow) {
      var rgb = hexRgb(car.color);
      var rr = Math.max(L, W) * 1.7;
      var halo = g.createRadialGradient(car.x * S, car.y * S, 0,
                                        car.x * S, car.y * S, rr);
      halo.addColorStop(0, 'rgba(' + rgb + ',0.50)');
      halo.addColorStop(0.42, 'rgba(' + rgb + ',0.20)');
      halo.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = halo;
      g.fillRect(car.x * S - rr, car.y * S - rr, rr * 2, rr * 2);
    }

    /* High contrast marks your car with a circle: yellow on black, so it
     * reads against the black road and the white scenery alike, and the only
     * round thing on a board made of rectangles - it stands out by its shape
     * as much as by its brightness, which is what this mode is for. It
     * breathes slowly, unless the device asks for less motion. */
    if (car.isPlayer && C.contrastColors()) {
      var rc = Math.max(L, W) * (1.15 + (STILL ? 0 : 0.07 * Math.sin(Date.now() / 260)));
      g.beginPath();
      g.arc(car.x * S, car.y * S, rc, 0, Math.PI * 2);
      g.lineWidth = 7;
      g.strokeStyle = '#000000';
      g.stroke();
      g.lineWidth = 3.5;
      g.strokeStyle = HC_MARK;
      g.stroke();
    }

    g.save();
    g.translate(car.x * S, car.y * S);
    g.rotate(a);

    // shadow, offset down-right in world space whatever way the car points
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(-L / 2 + (2 * cos + 3 * sin), -W / 2 + (3 * cos - 2 * sin), L, W);

    var hc = !!C.contrastColors();

    /* The player's car is the only one that wears cosmetics, which is what
     * the shop is for: an opponent in your skin would make the one car you
     * need to find harder to find. Everything else - the shadow, the rings,
     * the halo, the crash flash - is unchanged and runs over the top of it.
     *
     * In high contrast the skin is dropped for the car's flat colour, for
     * the same reason every other texture is: a patterned body competing
     * with a hard black-and-white board is noise where the mode wants none. */
    var Cos = global.Cosmetics;

    /* The rings that say which car is yours go UNDER the body, as filled
     * shapes in the car's own outline, biggest first. The body then covers
     * all but the margin, which is what leaves an outline that follows a
     * saucer round instead of boxing it in. */
    if (car.isPlayer) {
      var ring = (Cos && Cos.fillSilhouette) ? function (grow, style) {
        Cos.fillSilhouette(g, L, W, Cos.equippedVehicle(), grow, style);
      } : function (grow, style) {
        g.fillStyle = style;
        g.fillRect(-L / 2 - grow, -W / 2 - grow, L + grow * 2, W + grow * 2);
      };
      if (car.crashed) {
        g.globalAlpha = 0.55 + 0.45 * Math.sin(Date.now() / 90);
        ring(5.5, '#ff5470');
        g.globalAlpha = 1;
      }
      /* In high contrast the edge is yellow outside black, the colours of the
       * circle round it: a white edge made your car look like one more white
       * block, and every opponent has one. */
      if (hc) { ring(7, HC_MARK); ring(3.5, '#000000'); }
      else ring(2, 'rgba(255,255,255,0.9)');
    }

    // A boost (Pro controls): a flame off the tail, under the body.
    if (car.boostT > 0) drawFlame(g, L, W, car, hc);

    if (car.isPlayer && Cos) {
      Cos.drawCar(g, L, W, Cos.equippedSkin(), Cos.equippedVehicle(),
                  car.crashFlash, hc ? car.color : null);
    } else {
      g.fillStyle = car.crashFlash > 0.05
        ? 'rgba(255,255,255,' + (0.35 + 0.65 * car.crashFlash) + ')'
        : car.color;
      g.fillRect(-L / 2, -W / 2, L, W);
    }

    /* In high contrast every car gets a hard white edge. The road under it is
     * black and the scenery beside it is white, so a car needs an outline
     * that works against both: white reads against the road, and the body
     * colour inside it reads against the outline. Without one, a dark car on
     * a black road is a hole. */
    /* An opponent's hard edge in high contrast. The player already has one
     * from the rings under the body, in the shape of whatever they drive. */
    if (hc && !car.isPlayer) {
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2;
      g.strokeRect(-L / 2 - 1, -W / 2 - 1, L + 2, W + 2);
      g.strokeStyle = '#000000';
      g.lineWidth = 1.5;
      g.strokeRect(-L / 2 - 2.5, -W / 2 - 2.5, L + 5, W + 5);
    }

    // An opponent's cabin and nose stripe. The player's vehicle draws its
    // own, because where they go depends on what shape it is.
    if (!(car.isPlayer && Cos)) {
      g.fillStyle = hc ? 'rgba(0,0,0,0.80)' : 'rgba(10,14,22,0.55)';
      g.fillRect(-L * 0.34, -W * 0.3, L * 0.4, W * 0.6);
      g.fillStyle = hc ? '#ffffff' : 'rgba(255,255,255,0.85)';
      g.fillRect(L / 2 - (hc ? 4 : 3), -W / 2, hc ? 4 : 3, W);
    }


    g.restore();
  }

  /* The tutorial's marker: a bright band across the road where to turn,
   * with chevrons pointing the way the corner goes. It pulses, unless the
   * device asks for less motion. */
  function drawTutorMark(g, m, now) {
    if (!m) return;
    var hc = !!C.contrastColors();
    var pulse = STILL ? 1 : 0.65 + 0.35 * Math.sin(now * 6);
    g.save();
    g.globalAlpha = pulse;
    g.fillStyle = hc ? HC_MARK : '#ffd166';
    g.shadowColor = hc ? 'transparent' : 'rgba(255,209,102,0.8)';
    g.shadowBlur = hc ? 0 : 12;
    var w = (m.x1 - m.x0) * S, h = (m.y1 - m.y0) * S;
    var bw = Math.max(w, 5), bh = Math.max(h, 5);
    g.fillRect((m.x0 + m.x1) / 2 * S - bw / 2, (m.y0 + m.y1) / 2 * S - bh / 2, bw, bh);
    g.shadowBlur = 0;
    // three chevrons along the band, pointing where the corner goes
    var cx = (m.x0 + m.x1) / 2 * S, cy = (m.y0 + m.y1) / 2 * S;
    var along = m.x1 - m.x0 > m.y1 - m.y0 ? { x: 1, y: 0 } : { x: 0, y: 1 };
    var span = Math.max(w, h) / 2, c = Math.min(w, h) * 0.42;
    g.strokeStyle = hc ? '#000000' : '#1a1206';
    g.lineWidth = 2.5;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    [-0.55, 0, 0.55].forEach(function (f) {
      var px = cx + along.x * span * f, py = cy + along.y * span * f;
      var tipX = px + m.d.x * c, tipY = py + m.d.y * c;
      var bx = px - m.d.x * c * 0.2, by = py - m.d.y * c * 0.2;
      var ox = -m.d.y * c * 0.8, oy = m.d.x * c * 0.8;
      g.beginPath();
      g.moveTo(bx + ox, by + oy);
      g.lineTo(tipX, tipY);
      g.lineTo(bx - ox, by - oy);
      g.stroke();
    });
    g.restore();
  }

  Renderer.draw = function (game) {
    var g = this.ctx;
    g.fillStyle = colorOf('bg');
    g.fillRect(0, 0, T.width, T.height);
    g.drawImage(trackCanvas, 0, 0, T.width, T.height);

    var now = (global.performance ? performance.now() : Date.now()) / 1000;
    var plain = !!C.contrastColors();
    if (!plain) Renderer.drawLava(g, now);
    drawCheckpoints(g, game.player);
    if (game.tutorial) drawTutorMark(g, game.tutorial.marks(), now);

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

    // the ghost under every real car, so it can never hide the one you drive
    if (game.ghostPose) drawGhost(g, game.ghostPose);
    game.cars.forEach(function (car) { drawCar(g, car); });
    // over the cars, because it is over the cars
    if (!plain) {
      Renderer.drawFlyby(g, now);
      Renderer.drawWeather(g, now);
    }

    if (game.state === 'countdown') {
      var n = Math.ceil(game.countdown);
      var label = n > 0 ? String(n) : 'GO!';
      g.save();
      g.fillStyle = 'rgba(8,11,18,0.55)';
      g.fillRect(0, 0, T.width, T.height);
      var box = upright(g);
      g.font = '700 96px ui-monospace, Menlo, Consolas, monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = n > 0 ? '#ffd166' : '#5ef2a0';
      g.fillText(label, box.w / 2, box.h / 2);
      g.restore();
      g.restore();
    }
  };

  global.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : globalThis);
