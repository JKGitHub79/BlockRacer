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
   * the mountain range uses because a skyline has the same shape.
   *
   * Each band is drawn as a solid mass DOWN TO THE FOOT OF THE CANVAS, the
   * way the cliff terraces are, rather than as towers standing on an
   * invisible line: a tower whose base is open sky is a tower floating in
   * mid air, and three bands of them floating at three different heights
   * read as bunting rather than as a city. Filling to the floor also means
   * a nearer band simply covers the one behind it, so the ground plane is
   * whatever band is closest to you - which is what ground is. */
  function skyline(g, y, height, color, lit, seed, step) {
    var rnd = rng(seed);
    g.fillStyle = color;
    g.fillRect(0, y, W, H - y);                   // the ground this band stands on
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

  /* The street the nearest band of towers stands on: a strip of wet tarmac
   * with a row of sodium lamps down it and their reflections smeared under
   * them, so the foot of the city is a surface and not an edge. */
  function street(g, y, seed) {
    var rnd = rng(seed);
    var d = H - y;
    g.fillStyle = '#080b12';
    g.fillRect(0, y, W, d);
    g.fillStyle = 'rgba(255,196,110,0.07)';               // the kerb catching the light
    g.fillRect(0, y, W, Math.max(1, d * 0.09));
    var step = W * 0.11;
    for (var x = step * 0.35; x < W; x += step) {
      var lx = x + rnd() * step * 0.18;
      var r = Math.max(1, H * 0.0026);
      var gy = y + d * 0.26;
      var glow = g.createRadialGradient(lx, gy, 0, lx, gy, d * 0.9);
      glow.addColorStop(0, 'rgba(255,206,126,0.30)');
      glow.addColorStop(1, 'rgba(255,206,126,0)');
      g.fillStyle = glow;
      g.fillRect(lx - d, y, d * 2, d);
      g.fillStyle = 'rgba(255,224,168,0.9)';
      g.fillRect(lx - r, gy - r, r * 2, r * 2);
    }
  }

  /* A works: a run of low sheds with saw-tooth roofs, a gasholder or two and
   * chimneys standing well above everything, filled DOWN TO THE FLOOR like
   * the skyline and the terraces are so a nearer band covers the one behind
   * it. The stacks are what make it read as a plant rather than as a town -
   * a town's tall things are wide, a works' tall things are thin. */
  function works(g, y, height, color, lit, seed, step) {
    var rnd = rng(seed);
    g.fillStyle = color;
    g.fillRect(0, y, W, H - y);
    for (var x = -step; x < W + step; x += step) {
      var bx = x + rnd() * step * 0.2;
      var kind = rnd();
      if (kind < 0.30) {
        // a chimney: thin, very tall, with a band near the top
        var ch = height * (0.85 + rnd() * 0.75);
        var cw = Math.max(3, step * (0.10 + rnd() * 0.07));
        g.fillStyle = color;
        g.fillRect(bx + step * 0.3, y - ch, cw, ch + 2);
        if (lit) {
          g.fillStyle = lit;
          g.fillRect(bx + step * 0.3, y - ch + ch * 0.10, cw, Math.max(1, ch * 0.025));
          g.fillRect(bx + step * 0.3, y - ch + ch * 0.19, cw, Math.max(1, ch * 0.025));
        }
        continue;
      }
      if (kind < 0.46) {
        // a gasholder: a squat drum with hoop rings
        var gh = height * (0.26 + rnd() * 0.22);
        var gw = step * (0.62 + rnd() * 0.3);
        g.fillStyle = color;
        g.fillRect(bx, y - gh, gw, gh + 2);
        if (lit) {
          g.fillStyle = lit;
          for (var r = 1; r <= 3; r++) {
            g.fillRect(bx, y - gh + gh * (r / 4), gw, Math.max(1, gh * 0.03));
          }
        }
        continue;
      }
      // a shed, with a saw-tooth roof and a strip of lit glazing under it
      var sh = height * (0.16 + rnd() * 0.30);
      var sw = step * (0.7 + rnd() * 0.5);
      g.fillStyle = color;
      g.fillRect(bx, y - sh, sw, sh + 2);
      var teeth = Math.max(2, Math.round(sw / (step * 0.28)));
      for (var i = 0; i < teeth; i++) {
        var tw = sw / teeth;
        g.beginPath();
        g.moveTo(bx + i * tw, y - sh);
        g.lineTo(bx + i * tw + tw, y - sh - height * 0.07);
        g.lineTo(bx + i * tw + tw, y - sh);
        g.closePath();
        g.fill();
      }
      if (lit) {
        g.fillStyle = lit;
        for (var k = 0; k < teeth; k++) {
          if (rnd() > 0.55) continue;
          g.fillRect(bx + k * (sw / teeth) + sw / teeth * 0.2,
                     y - sh + sh * 0.18, sw / teeth * 0.5, Math.max(1, sh * 0.10));
        }
      }
    }
  }

  /* Smoke standing off the stacks. Drawn as a column of overlapping discs
   * that widen and fade as they rise, seeded so a plume is the same plume on
   * every redraw - it is scenery, not weather, and weather is the only thing
   * in here allowed to move. */
  function plume(g, x, base, height, seed, tint) {
    var rnd = rng(seed);
    var n = 54;
    for (var i = 0; i < n; i++) {
      var f = i / (n - 1);
      var py = base - height * f - rnd() * height * 0.05;
      var px = x + (rnd() - 0.5) * height * (0.10 + f * 0.36) + height * 0.26 * f * f;
      var r = height * (0.020 + f * 0.075) * (0.6 + rnd() * 0.9);
      g.fillStyle = 'rgba(' + tint + ',' + (0.052 * (1 - f * 0.82)).toFixed(3) + ')';
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fill();
    }
  }

  /* A skyline of ruins, filled DOWN TO THE FLOOR like the works and the
   * skyline are. Four things stand in a band, picked per slot: a stepped
   * pyramid, a columned facade under a pediment, an obelisk, and a seated
   * figure on a plinth. The columns are the tell - nothing else in the
   * scenery has a repeated vertical rhythm, and a row of them reads as
   * built by somebody even at forty pixels tall. */
  function ruinband(g, y, height, color, lit, seed, step) {
    var rnd = rng(seed);
    g.fillStyle = color;
    g.fillRect(0, y, W, H - y);
    for (var x = -step; x < W + step; x += step) {
      var bx = x + rnd() * step * 0.22;
      var kind = rnd();

      if (kind < 0.30) {
        // a stepped pyramid: each tier narrower and shorter than the last
        var tiers = 3 + Math.floor(rnd() * 3);
        var pw = step * (0.95 + rnd() * 0.5);
        var ph = height * (0.45 + rnd() * 0.55);
        for (var t = 0; t < tiers; t++) {
          var f = t / tiers;
          g.fillStyle = color;
          g.fillRect(bx + pw * 0.5 * f, y - ph * (t + 1) / tiers,
                     pw * (1 - f), ph / tiers + 1);
          if (lit && t === tiers - 1) {
            g.fillStyle = lit;                      // a fire on the top step
            g.fillRect(bx + pw * 0.5 - Math.max(1, pw * 0.035), y - ph - height * 0.05,
                       Math.max(2, pw * 0.07), height * 0.05);
          }
        }
        continue;
      }

      if (kind < 0.62) {
        // a columned facade: a plinth, a rhythm of columns, an architrave
        var fw = step * (0.8 + rnd() * 0.55);
        var fh = height * (0.34 + rnd() * 0.34);
        var plinth = fh * 0.13, arch = fh * 0.17;
        g.fillStyle = color;
        g.fillRect(bx, y - plinth, fw, plinth + 2);
        g.fillRect(bx - fw * 0.05, y - fh, fw * 1.1, arch);
        var n = 4 + Math.floor(rnd() * 4);
        var cw = fw / (n * 2 - 1);
        for (var c = 0; c < n; c++) {
          // some of them have come down, which is the point of a ruin
          if (rnd() < 0.22) continue;
          g.fillRect(bx + c * cw * 2, y - fh + arch, cw, fh - arch - plinth + 1);
        }
        // and a pediment over about half of them
        if (rnd() < 0.5) {
          g.beginPath();
          g.moveTo(bx - fw * 0.05, y - fh);
          g.lineTo(bx + fw * 0.5, y - fh - height * 0.13);
          g.lineTo(bx + fw * 1.05, y - fh);
          g.closePath();
          g.fill();
        }
        continue;
      }

      if (kind < 0.80) {
        // an obelisk, tapering, with a cap
        var ow = Math.max(3, step * (0.09 + rnd() * 0.05));
        var oh = height * (0.7 + rnd() * 0.7);
        g.fillStyle = color;
        g.beginPath();
        g.moveTo(bx + step * 0.35, y + 2);
        g.lineTo(bx + step * 0.35 + ow, y + 2);
        g.lineTo(bx + step * 0.35 + ow * 0.62, y - oh);
        g.lineTo(bx + step * 0.35 + ow * 0.38, y - oh);
        g.closePath();
        g.fill();
        continue;
      }

      // a seated figure on a plinth: knees, torso, head
      var sw = step * (0.4 + rnd() * 0.2), sh = height * (0.34 + rnd() * 0.22);
      g.fillStyle = color;
      g.fillRect(bx + step * 0.2, y - sh * 0.22, sw, sh * 0.22 + 2);      // plinth
      g.fillRect(bx + step * 0.2, y - sh * 0.52, sw, sh * 0.30);          // knees
      g.fillRect(bx + step * 0.2 + sw * 0.18, y - sh * 0.88, sw * 0.5, sh * 0.38); // torso
      g.fillRect(bx + step * 0.2 + sw * 0.24, y - sh, sw * 0.36, sh * 0.16);       // head
    }
  }

  /* The sand the ruins stand in: a pale floor with a scatter of fallen
   * blocks half-buried in it, so the foot of the scene is a surface rather
   * than an edge - the same job `street` and `yard` do for their themes. */
  function sand(g, y, seed) {
    var rnd = rng(seed);
    var d = H - y;
    var grad = g.createLinearGradient(0, y, 0, H);
    grad.addColorStop(0, '#6b5233');
    grad.addColorStop(1, '#3b2c1b');
    g.fillStyle = grad;
    g.fillRect(0, y, W, d);
    g.fillStyle = 'rgba(255,224,168,0.10)';
    g.fillRect(0, y, W, Math.max(1, d * 0.12));
    for (var i = 0; i < 26; i++) {
      var bw = W * (0.008 + rnd() * 0.020);
      var bx = rnd() * W, by = y + d * (0.2 + rnd() * 0.7);
      g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,230,180,0.10)';
      g.fillRect(bx, by, bw, Math.max(2, bw * 0.5));
    }
  }

  /* The mountain itself: a broad cone with a bitten-out crater, lava running
   * down the flanks in channels that widen as they go, and a fountain of it
   * standing out of the top. Drawn once like everything else here - the
   * fountain is a shape, not an animation, because only weather is allowed
   * to move in a backdrop. */
  function volcano(g, cx, base, height, width, seed) {
    var rnd = rng(seed);
    var half = width / 2;
    var rimL = cx - half * 0.26, rimR = cx + half * 0.26, rim = base - height;

    // the cone, in three bands so the near flank reads as nearer
    [['#150b09', 0], ['#0e0605', 0.10], ['#070303', 0.20]].forEach(function (b, i) {
      g.fillStyle = b[0];
      g.beginPath();
      g.moveTo(cx - half * (1 - b[1] * 0.5), base + 2);
      g.lineTo(rimL + half * b[1] * 0.4, rim + height * b[1]);
      g.lineTo(rimR - half * b[1] * 0.4, rim + height * b[1]);
      g.lineTo(cx + half * (1 - b[1] * 0.5), base + 2);
      g.closePath();
      g.fill();
    });

    // lava sitting in the crater: inset from the rim and fading down into
    // it, so it reads as filling the bowl rather than lying on top of it
    var lw = (rimR - rimL) * 0.62, lx = cx - lw / 2;
    var cg = g.createLinearGradient(0, rim - height * 0.015, 0, rim + height * 0.03);
    cg.addColorStop(0, 'rgba(255,214,140,0.92)');
    cg.addColorStop(1, 'rgba(210,60,12,0)');
    g.fillStyle = cg;
    g.fillRect(lx, rim - height * 0.015, lw, height * 0.045);

    // and the fountain standing out of it: a column of hot blobs that
    // widen and cool as they rise, the same construction the city's smoke
    // uses, because a fountain of rock is a plume that happens to glow. A
    // smooth tapering wedge was tried first and read as a searchlight.
    var fh = height * 0.30;
    for (var i = 0; i < 70; i++) {
      var f = i / 69;
      var py = rim - fh * f - rnd() * fh * 0.04;
      var px = cx + (rnd() - 0.5) * width * (0.04 + f * 0.13);
      var r = fh * (0.030 + f * 0.070) * (0.5 + rnd() * 1.0);
      var heat = 1 - f * 0.8;
      g.fillStyle = 'rgba(255,' + (110 + Math.round(heat * 130)) + ',' +
                    (30 + Math.round(heat * 90)) + ',' + (0.30 * heat + 0.05).toFixed(3) + ')';
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fill();
    }

    // bombs thrown clear of the fountain, arcing out either side
    for (var b2 = 0; b2 < 26; b2++) {
      var side = rnd() < 0.5 ? -1 : 1;
      var f2 = rnd();
      var bx = cx + side * width * (0.03 + f2 * 0.26);
      var by = rim - fh * (1.05 - f2 * f2 * 1.5);
      var r2 = Math.max(1, height * (0.006 + rnd() * 0.014));
      g.fillStyle = 'rgba(255,' + (140 + Math.round(rnd() * 90)) + ',70,' +
                    (0.45 + rnd() * 0.45).toFixed(2) + ')';
      g.beginPath(); g.arc(bx, by, r2, 0, Math.PI * 2); g.fill();
    }

    // and the flows: channels down the flanks, widening as they fall
    for (var k = 0; k < 5; k++) {
      var t0 = (k - 2) * 0.14 + (rnd() - 0.5) * 0.06;
      var x0 = cx + half * t0 * 0.3, x1 = cx + half * t0 * 2.4;
      var w0 = Math.max(1.5, width * 0.010), w1 = width * (0.018 + rnd() * 0.030);
      var grad = g.createLinearGradient(0, rim, 0, base);
      grad.addColorStop(0, 'rgba(255,236,186,0.95)');
      grad.addColorStop(0.35, 'rgba(255,128,24,0.92)');
      grad.addColorStop(1, 'rgba(168,26,6,0.70)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x0 - w0, rim + height * 0.02);
      g.lineTo(x0 + w0, rim + height * 0.02);
      g.lineTo(x1 + w1, base + 2);
      g.lineTo(x1 - w1, base + 2);
      g.closePath();
      g.fill();
    }

    // the glow the whole thing throws into the sky
    var halo = g.createRadialGradient(cx, rim, 0, cx, rim, height * 1.1);
    halo.addColorStop(0, 'rgba(255,110,34,0.36)');
    halo.addColorStop(1, 'rgba(255,110,34,0)');
    g.fillStyle = halo;
    g.fillRect(cx - height * 1.1, rim - height * 1.1, height * 2.2, height * 2.2);
  }

  /* The floor: a cooled flow, black and cracked, with the cracks still lit.
   * Same job as `street`, `yard` and `sand` - the foot of the scene has to
   * be a surface rather than an edge. */
  function flowfloor(g, y, seed) {
    var rnd = rng(seed);
    var d = H - y;
    g.fillStyle = '#0b0605';
    g.fillRect(0, y, W, d);
    for (var i = 0; i < 46; i++) {
      var fx = rnd() * W, fy = y + rnd() * d;
      var fw = W * (0.01 + rnd() * 0.06), fh = Math.max(1, d * 0.04);
      var a = 0.10 + rnd() * 0.45;
      g.fillStyle = 'rgba(255,' + (80 + Math.round(rnd() * 120)) + ',30,' + a.toFixed(2) + ')';
      g.fillRect(fx, fy, fw, fh);
    }
    var lip = g.createLinearGradient(0, y, 0, y + d * 0.3);
    lip.addColorStop(0, 'rgba(255,140,50,0.22)');
    lip.addColorStop(1, 'rgba(255,140,50,0)');
    g.fillStyle = lip;
    g.fillRect(0, y, W, d * 0.3);
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

  /* The ground a works stands on: oil-dark hardstanding with a run of
   * floodlights down it. Same job as `street` in the city - the foot of the
   * scene has to be a surface rather than an edge - but a yard is lit from
   * masts rather than from lamp posts, so the pools are wider and colder. */
  function yard(g, y, seed) {
    var rnd = rng(seed);
    var d = H - y;
    g.fillStyle = '#0a0705';
    g.fillRect(0, y, W, d);
    g.fillStyle = 'rgba(255,186,96,0.06)';
    g.fillRect(0, y, W, Math.max(1, d * 0.10));
    var step = W * 0.16;
    for (var x = step * 0.3; x < W; x += step) {
      var lx = x + rnd() * step * 0.2;
      var gy = y + d * 0.22;
      var glow = g.createRadialGradient(lx, gy, 0, lx, gy, d * 1.3);
      glow.addColorStop(0, 'rgba(232,226,208,0.26)');
      glow.addColorStop(1, 'rgba(232,226,208,0)');
      g.fillStyle = glow;
      g.fillRect(lx - d * 1.3, y, d * 2.6, d);
      g.fillStyle = 'rgba(246,242,226,0.85)';
      g.fillRect(lx - Math.max(1, H * 0.003), gy - Math.max(1, H * 0.002),
                 Math.max(2, H * 0.006), Math.max(2, H * 0.004));
    }
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
        skyline(g, H * (HORIZON + 0.02), H * 0.36, '#161c32',
                'rgba(255,214,140,0.42)', 31, W * 0.042);
        skyline(g, H * (HORIZON + 0.11), H * 0.27, '#0c1020',
                'rgba(255,205,125,0.52)', 57, W * 0.034);
        skyline(g, H * (HORIZON + 0.19), H * 0.19, '#05070f',
                'rgba(255,196,110,0.42)', 83, W * 0.027);
        street(g, H * 0.955, 109);
        recede(g);
      }
    },

    /* Sodium haze rather than night: a works runs all night and the sky over
     * one is never actually dark. The plumes go on BEFORE the nearer bands
     * so smoke from a far stack passes behind the sheds in front of it, and
     * the flare is the one warm point in the scene. */
    industrial: {
      weather: 'ash',
      paint: function (g) {
        sky(g, [[0, '#0b0a12'], [0.34, '#1d1720'], [0.62, '#42291f'],
                [0.84, '#7d4620'], [1, '#b5702c']]);
        works(g, H * (HORIZON + 0.02), H * 0.30, '#231c1c',
              'rgba(255,196,110,0.34)', 41, W * 0.050);
        plume(g, W * 0.17, H * (HORIZON - 0.06), H * 0.40, 11, '196,186,178');
        plume(g, W * 0.63, H * (HORIZON - 0.10), H * 0.52, 23, '206,196,186');
        works(g, H * (HORIZON + 0.13), H * 0.24, '#150f10',
              'rgba(255,186,96,0.46)', 67, W * 0.040);
        plume(g, W * 0.40, H * (HORIZON + 0.04), H * 0.34, 37, '170,158,150');
        plume(g, W * 0.86, H * (HORIZON + 0.02), H * 0.30, 53, '180,168,158');
        works(g, H * (HORIZON + 0.24), H * 0.17, '#070506',
              'rgba(255,176,86,0.40)', 89, W * 0.031);
        // the flare, and the light it throws on the smoke above it
        var fx = W * 0.285, fy = H * (HORIZON + 0.235);
        var fl = g.createRadialGradient(fx, fy, 0, fx, fy, H * 0.16);
        fl.addColorStop(0, 'rgba(255,146,54,0.42)');
        fl.addColorStop(1, 'rgba(255,146,54,0)');
        g.fillStyle = fl;
        g.fillRect(fx - H * 0.16, fy - H * 0.16, H * 0.32, H * 0.32);
        g.fillStyle = 'rgba(255,214,150,0.92)';
        g.fillRect(fx - W * 0.004, fy - H * 0.035, W * 0.008, H * 0.035);
        yard(g, H * 0.955, 97);
        recede(g);
      }
    },

    /* Late light on old stone: the sun is low and behind the ruins, so every
     * band is a silhouette and the colour is all sky. Three bands of it,
     * each filled to the floor, and sand in front. */
    ruins: {
      weather: 'motes',
      paint: function (g) {
        sky(g, [[0, '#1a1030'], [0.26, '#43204a'], [0.52, '#8c3f45'],
                [0.74, '#c87a41'], [1, '#e9be76']]);
        sun(g, W * 0.70, H * 0.60, H * 0.075, '#ffe9b8', 'rgba(255,196,110,0.30)');
        ruinband(g, H * (HORIZON + 0.02), H * 0.30, '#7b5638',
                 'rgba(255,196,110,0.40)', 29, W * 0.066);
        ruinband(g, H * (HORIZON + 0.13), H * 0.25, '#4b3222',
                 'rgba(255,186,96,0.42)', 61, W * 0.052);
        ruinband(g, H * (HORIZON + 0.24), H * 0.19, '#241709',
                 null, 97, W * 0.041);
        sand(g, H * 0.95, 131);
        recede(g);
      }
    },

    /* Everything here is lit from one place, and it is not the sky. The
     * gradient runs from soot at the top to ember at the bottom, and the
     * mountain sits to one side of the cards so the fountain is not behind
     * the middle one. */
    volcano: {
      weather: 'embers',
      paint: function (g) {
        sky(g, [[0, '#080407'], [0.26, '#190810'], [0.54, '#3c0f0e'],
                [0.80, '#6d200c'], [1, '#9c3a12']]);
        crest(g, H * (HORIZON + 0.02), H * 0.030, '#2a1310', 19);
        volcano(g, W * 0.775, H * (HORIZON + 0.12), H * 0.58, W * 0.60, 23);
        crest(g, H * (HORIZON + 0.11), H * 0.042, '#190b09', 37);
        crest(g, H * (HORIZON + 0.22), H * 0.055, '#0c0505', 53);
        flowfloor(g, H * 0.945, 71);
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
              sway: 0, rate: 0.1, alpha: [0.10, 0.28], wide: 0.28 },
    // Ash hangs. Big, slow, and swaying further than anything else here,
    // because it is falling through its own smoke rather than through air.
    ash:    { n: 45, color: '#d8cdbc', r: [1.0, 2.6], vx: [-20, -60], vy: [12, 44],
              sway: 34, rate: 0.45, alpha: [0.06, 0.22], wide: 1.5 },
    // Dust hanging in still air: the slowest thing here, and it drifts up as
    // often as down because nothing is moving it.
    motes:  { n: 50, color: '#f2dcb0', r: [0.6, 1.8], vx: [-10, -30], vy: [-14, 18],
              sway: 18, rate: 0.32, alpha: [0.07, 0.26], wide: 1 },
    // Embers rise: the only weather here with the sign the other way round.
    embers: { n: 80, color: '#ffb066', r: [0.7, 2.0], vx: [-14, -44], vy: [-140, -40],
              sway: 14, rate: 1.1, alpha: [0.14, 0.60], wide: 0.8 }
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
