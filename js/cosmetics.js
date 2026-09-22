/* Block Racer - skins and vehicles.
 *
 * Pure data and painters. Nothing here knows about the shop screen, and
 * nothing here touches the physics: a vehicle is a SHAPE and a skin is a
 * FILL, and the car that carries them is the same 1.25 x 0.8 cell box it has
 * always been. That is not a convention, it is enforced by where the drawing
 * happens - every vehicle draws inside the footprint js/config.js declares,
 * and the collision box is built from those numbers and never from anything
 * in this file. Drawing INSIDE the box is also the safe direction to be
 * wrong in: a car can never clip something its painted body did not touch.
 *
 * Unlocks are DERIVED from the medals, the way theme stars are, so finishing
 * a track before any of this existed unlocks its skin the moment the file
 * loads. There is no second save file to drift out of step. What IS stored is
 * the two ids you have equipped, which is a preference rather than an
 * achievement - and it is validated on the way out, so a skin that stops
 * being unlocked (RESET DATA) falls back to the default instead of leaving
 * you invisible.
 *
 * Every painter fills a rectangle it is handed. The car body and the shop
 * preview call the same one, so the circle in the shop is the paint you will
 * actually be driving, not an artist's impression of it.
 */
(function (global) {
  'use strict';

  var Cos = {};

  /* Patterns are drawn in the car's own space and rotate with it, so they
   * have to be stable frame to frame - a seeded stream rather than
   * Math.random, exactly as the wall painters do it. */
  function rng(seed) {
    return function () {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
  }

  function clipRect(g, x, y, w, h) {
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
  }

  /* ---- painter factories ----------------------------------------------
   * Most skins are one of five shapes with different colours in them, so
   * they are data. Only the ones that really are their own idea - the ones
   * at the end of the ladder, mostly - get their own function. */

  function solid(c) {
    return function (g, x, y, w, h) { g.fillStyle = c; g.fillRect(x, y, w, h); };
  }

  /* Blotches. Cow, leopard, camo and the mottled stones are all this with
   * different numbers: big and few reads at thirty pixels, small and many
   * turns to mush. */
  function spots(base, cols, n, rad, seed, ring) {
    return function (g, x, y, w, h) {
      var rnd = rng(seed), i;
      g.fillStyle = base;
      g.fillRect(x, y, w, h);
      for (i = 0; i < n; i++) {
        var cx = x + rnd() * w, cy = y + rnd() * h;
        var r = h * rad * (0.6 + rnd() * 0.8);
        g.fillStyle = cols[(rnd() * cols.length) | 0];
        if (ring) {
          g.lineWidth = Math.max(1, r * 0.55);
          g.strokeStyle = g.fillStyle;
          g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
        } else {
          g.beginPath();
          g.ellipse(cx, cy, r, r * (0.7 + rnd() * 0.6), rnd() * 3, 0, Math.PI * 2);
          g.fill();
        }
      }
    };
  }

  /* Bars across the body. `lean` shears them, which is the difference
   * between a zebra and a hazard placard. */
  function bars(base, stripe, n, lean, thick) {
    return function (g, x, y, w, h) {
      var i;
      g.fillStyle = base;
      g.fillRect(x, y, w, h);
      g.fillStyle = stripe;
      var step = w / n;
      for (i = 0; i < n; i++) {
        var sx = x + i * step;
        g.beginPath();
        g.moveTo(sx, y);
        g.lineTo(sx + step * thick, y);
        g.lineTo(sx + step * thick + lean * h, y + h);
        g.lineTo(sx + lean * h, y + h);
        g.closePath();
        g.fill();
      }
    };
  }

  function grad(stops, vertical) {
    return function (g, x, y, w, h) {
      var lg = vertical ? g.createLinearGradient(x, y, x, y + h)
                        : g.createLinearGradient(x, y, x + w, y);
      stops.forEach(function (s) { lg.addColorStop(s[0], s[1]); });
      g.fillStyle = lg;
      g.fillRect(x, y, w, h);
    };
  }

  /* ---- the ones that are their own idea -------------------------------- */

  function police(g, x, y, w, h) {
    g.fillStyle = '#f2f5fa'; g.fillRect(x, y, w, h);
    g.fillStyle = '#12141c'; g.fillRect(x, y, w * 0.42, h);
    g.fillStyle = '#12141c'; g.fillRect(x + w * 0.62, y, w * 0.18, h);
    // the light bar, across the roof rather than along it
    g.fillStyle = '#ff3b4d'; g.fillRect(x + w * 0.44, y, w * 0.08, h * 0.5);
    g.fillStyle = '#3b7dff'; g.fillRect(x + w * 0.44, y + h * 0.5, w * 0.08, h * 0.5);
  }

  function neon(g, x, y, w, h) {
    g.fillStyle = '#0b0d16'; g.fillRect(x, y, w, h);
    var lg = g.createLinearGradient(x, y, x + w, y + h);
    lg.addColorStop(0, '#ff2bd6');
    lg.addColorStop(0.5, '#7b5cff');
    lg.addColorStop(1, '#2bf0ff');
    g.strokeStyle = lg;
    g.lineWidth = Math.max(1.5, h * 0.16);
    g.strokeRect(x + h * 0.10, y + h * 0.10, w - h * 0.20, h - h * 0.20);
    g.fillStyle = lg;
    g.fillRect(x + w * 0.30, y + h * 0.42, w * 0.40, h * 0.16);
  }

  function carbon(g, x, y, w, h) {
    g.fillStyle = '#2b313d'; g.fillRect(x, y, w, h);
    var cell = Math.max(2, h * 0.26), i, j;
    for (j = 0; y + j * cell < y + h; j++) {
      for (i = 0; x + i * cell < x + w; i++) {
        g.fillStyle = (i + j) % 2 ? 'rgba(214,226,244,0.34)' : 'rgba(0,0,0,0.55)';
        g.fillRect(x + i * cell, y + j * cell, cell * 0.9, cell * 0.9);
      }
    }
    // the sheen that says woven rather than tiled
    var lg = g.createLinearGradient(x, y, x, y + h);
    lg.addColorStop(0, 'rgba(255,255,255,0.20)');
    lg.addColorStop(0.5, 'rgba(255,255,255,0)');
    lg.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = lg; g.fillRect(x, y, w, h);
  }

  /* A penguin from above: black back, white front, orange bill. The white
   * runs right up to the nose so the bill has something to sit against -
   * a beak floating on black reads as a scratch. */
  function penguin(g, x, y, w, h) {
    g.fillStyle = '#14171f'; g.fillRect(x, y, w, h);
    g.fillStyle = '#f6f8ff';
    g.beginPath();
    g.moveTo(x + w * 0.12, y + h * 0.5);
    g.bezierCurveTo(x + w * 0.30, y + h * 0.04, x + w * 0.82, y + h * 0.10,
                    x + w * 0.98, y + h * 0.5);
    g.bezierCurveTo(x + w * 0.82, y + h * 0.90, x + w * 0.30, y + h * 0.96,
                    x + w * 0.12, y + h * 0.5);
    g.fill();
    // The eyes sit well inside the middle half of the body, because the shop
    // chip is a circle cut out of the centre of the car and anything near the
    // nose - the bill included - is cropped away.
    g.fillStyle = '#14171f';
    g.beginPath(); g.arc(x + w * 0.58, y + h * 0.22, h * 0.10, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(x + w * 0.58, y + h * 0.78, h * 0.10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffa52b';
    g.beginPath();
    g.moveTo(x + w, y + h * 0.5);
    g.lineTo(x + w * 0.80, y + h * 0.36);
    g.lineTo(x + w * 0.80, y + h * 0.64);
    g.closePath(); g.fill();
  }

  function marble(g, x, y, w, h) {
    g.fillStyle = '#eef0f4'; g.fillRect(x, y, w, h);
    var rnd = rng(6101), i;
    g.lineWidth = Math.max(1, h * 0.07);
    for (i = 0; i < 5; i++) {
      g.strokeStyle = i % 2 ? 'rgba(120,130,150,0.55)' : 'rgba(60,70,90,0.40)';
      g.beginPath();
      var sy = y + rnd() * h;
      g.moveTo(x, sy);
      g.bezierCurveTo(x + w * 0.35, sy + (rnd() - 0.5) * h,
                      x + w * 0.65, sy + (rnd() - 0.5) * h, x + w, y + rnd() * h);
      g.stroke();
    }
  }

  /* Cooled crust with the heat still showing through the joins. Drawn as
   * glowing seams first and dark plates laid over them, which is how the
   * real thing looks and also why the cracks come out continuous instead of
   * as loose scratches. */
  function magma(g, x, y, w, h) {
    var lg = g.createLinearGradient(x, y, x + w, y + h);
    lg.addColorStop(0, '#ffe07a');
    lg.addColorStop(0.45, '#ff7a1f');
    lg.addColorStop(1, '#c42d06');
    g.fillStyle = lg; g.fillRect(x, y, w, h);
    var rnd = rng(919), i, j;
    g.fillStyle = '#1b1310';
    var cols = 4, rows = 3, cw = w / cols, ch = h / rows, gap = Math.max(1, h * 0.05);
    for (j = 0; j < rows; j++) {
      for (i = 0; i < cols; i++) {
        var jx = (rnd() - 0.5) * cw * 0.18, jy = (rnd() - 0.5) * ch * 0.18;
        g.beginPath();
        g.moveTo(x + i * cw + gap + jx, y + j * ch + gap + jy);
        g.lineTo(x + (i + 1) * cw - gap + jx * 0.5, y + j * ch + gap - jy);
        g.lineTo(x + (i + 1) * cw - gap - jx, y + (j + 1) * ch - gap + jy);
        g.lineTo(x + i * cw + gap - jx * 0.5, y + (j + 1) * ch - gap - jy * 0.5);
        g.closePath();
        g.fill();
      }
    }
  }

  function starfield(g, x, y, w, h) {
    g.fillStyle = '#070b1c'; g.fillRect(x, y, w, h);
    var rnd = rng(4242), i;
    for (i = 0; i < 26; i++) {
      // sized off the body rather than in pixels, so the shop chip shows the
      // same sky the car wears instead of a handful of dots
      var r = Math.max(0.8, h * (rnd() < 0.18 ? 0.11 : 0.06));
      g.fillStyle = 'rgba(236,244,255,' + (0.4 + rnd() * 0.6).toFixed(2) + ')';
      g.fillRect(x + rnd() * w, y + rnd() * h, r, r);
    }
  }

  function galaxy(g, x, y, w, h) {
    var rg = g.createRadialGradient(x + w * 0.5, y + h * 0.5, 0,
                                    x + w * 0.5, y + h * 0.5, w * 0.6);
    rg.addColorStop(0, '#ffe9b8');
    rg.addColorStop(0.28, '#c86bff');
    rg.addColorStop(0.62, '#4430a8');
    rg.addColorStop(1, '#070a1c');
    g.fillStyle = rg;
    g.fillRect(x, y, w, h);
    var rnd = rng(31337), i, sr = Math.max(0.8, h * 0.07);
    for (i = 0; i < 18; i++) {
      g.fillStyle = 'rgba(255,255,255,' + (0.35 + rnd() * 0.55).toFixed(2) + ')';
      g.fillRect(x + rnd() * w, y + rnd() * h, sr, sr);
    }
  }

  function blackhole(g, x, y, w, h) {
    g.fillStyle = '#04060f'; g.fillRect(x, y, w, h);
    var cx = x + w * 0.5, cy = y + h * 0.5;
    var rg = g.createRadialGradient(cx, cy, h * 0.10, cx, cy, w * 0.52);
    rg.addColorStop(0, 'rgba(0,0,0,1)');
    rg.addColorStop(0.42, '#ffb648');
    rg.addColorStop(0.62, '#ff5a2b');
    rg.addColorStop(1, 'rgba(4,6,15,0)');
    g.fillStyle = rg;
    g.fillRect(x, y, w, h);
    g.fillStyle = '#000000';
    g.beginPath(); g.ellipse(cx, cy, w * 0.17, h * 0.30, 0, 0, Math.PI * 2); g.fill();
  }

  function toxic(g, x, y, w, h) {
    g.fillStyle = '#123a16'; g.fillRect(x, y, w, h);
    var rnd = rng(777), i;
    for (i = 0; i < 9; i++) {
      var r = h * (0.14 + rnd() * 0.22);
      g.fillStyle = i % 3 ? '#7cff5a' : '#c6ff3d';
      g.beginPath();
      g.arc(x + rnd() * w, y + rnd() * h, r, 0, Math.PI * 2);
      g.fill();
    }
  }

  function ufo(g, x, y, w, h) {
    var lg = g.createLinearGradient(x, y, x, y + h);
    lg.addColorStop(0, '#8fe8a8');
    lg.addColorStop(0.5, '#2f8f52');
    lg.addColorStop(1, '#14452a');
    g.fillStyle = lg; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(8,24,14,0.55)';   // the hull band
    g.fillRect(x, y + h * 0.40, w, h * 0.20);
    g.fillStyle = 'rgba(190,255,205,0.85)';   // the dome
    g.beginPath();
    g.ellipse(x + w * 0.52, y + h * 0.5, w * 0.20, h * 0.30, 0, 0, Math.PI * 2);
    g.fill();
    var i;
    for (i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? '#d9ff5a' : '#5affc8';
      g.fillRect(x + w * (0.10 + i * 0.24), y + h * 0.43, Math.max(1.5, w * 0.05), h * 0.14);
    }
  }

  function rainbow(g, x, y, w, h) {
    var lg = g.createLinearGradient(x, y, x + w, y + h);
    ['#ff3b3b', '#ff9a1f', '#ffe14d', '#4ade80', '#38bdf8', '#7b5cff', '#ff5cd6']
      .forEach(function (c, i, a) { lg.addColorStop(i / (a.length - 1), c); });
    g.fillStyle = lg;
    g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.fillRect(x, y, w, h * 0.22);
  }

  function chrome(g, x, y, w, h) {
    var lg = g.createLinearGradient(x, y, x, y + h);
    lg.addColorStop(0, '#f6f9ff');
    lg.addColorStop(0.32, '#9fb0c8');
    lg.addColorStop(0.5, '#5d6c85');
    lg.addColorStop(0.68, '#c8d6ea');
    lg.addColorStop(1, '#78879e');
    g.fillStyle = lg;
    g.fillRect(x, y, w, h);
  }

  function gold(g, x, y, w, h) {
    var lg = g.createLinearGradient(x, y, x, y + h);
    lg.addColorStop(0, '#fff3c0');
    lg.addColorStop(0.30, '#ffd24a');
    lg.addColorStop(0.52, '#b8801a');
    lg.addColorStop(0.74, '#ffe08a');
    lg.addColorStop(1, '#8a5e12');
    g.fillStyle = lg;
    g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(x + w * 0.08, y + h * 0.14, w * 0.84, h * 0.08);
  }

  function lava(g, x, y, w, h) {
    var lg = g.createLinearGradient(x, y, x + w, y);
    lg.addColorStop(0, '#fff2b0');
    lg.addColorStop(0.35, '#ff9a1f');
    lg.addColorStop(0.7, '#ff3b12');
    lg.addColorStop(1, '#7a1405');
    g.fillStyle = lg;
    g.fillRect(x, y, w, h);
    var rnd = rng(1213), i;
    for (i = 0; i < 6; i++) {
      g.fillStyle = 'rgba(255,240,190,' + (0.25 + rnd() * 0.5).toFixed(2) + ')';
      g.beginPath();
      g.arc(x + rnd() * w, y + rnd() * h, h * (0.08 + rnd() * 0.13), 0, Math.PI * 2);
      g.fill();
    }
  }

  function flame(g, x, y, w, h) {
    g.fillStyle = '#a21212'; g.fillRect(x, y, w, h);
    var i;
    for (i = 0; i < 4; i++) {
      var fx = x + w * (0.02 + i * 0.24);
      g.fillStyle = i % 2 ? '#ffb02e' : '#ff5a1f';
      g.beginPath();
      g.moveTo(fx, y + h);
      g.lineTo(fx + w * 0.16, y + h * 0.15);
      g.lineTo(fx + w * 0.24, y + h);
      g.closePath();
      g.fill();
    }
  }

  /* ---- the skins -------------------------------------------------------
   * `track` is the track whose FIRST PLACE unlocks it, and null for the one
   * that is always yours. The order is the order of the ladder, which is the
   * order the shop shows them in. */
  Cos.SKINS = [
    { id: 'stock',   name: 'STOCK',        track: null,       color: '#5ef2ff', paint: solid('#5ef2ff') },

    { id: 'green',   name: 'GREEN',        track: 'pinefall', color: '#3fbf5f', paint: solid('#3fbf5f') },
    { id: 'camo',    name: 'CAMO',         track: 'hollow',   color: '#5d7a3a', paint: spots('#5d7a3a', ['#3c5426', '#8ea65c', '#2b3a1c'], 7, 0.34, 11) },
    { id: 'cow',     name: 'COW',          track: 'canopy',   color: '#f2f4f8', paint: spots('#f2f4f8', ['#15171d'], 4, 0.21, 23) },

    { id: 'yellow',  name: 'YELLOW',       track: 'duneline',  color: '#ffd23f', paint: solid('#ffd23f') },
    { id: 'tiger',   name: 'TIGER',        track: 'saltflats', color: '#ff9a1f', paint: bars('#ff9a1f', '#1a1206', 6, 0.5, 0.42) },
    { id: 'leopard', name: 'LEOPARD',      track: 'canyonrun', color: '#e8b860', paint: spots('#e8b860', ['#4a3312'], 8, 0.22, 37, true) },

    { id: 'white',   name: 'WHITE',        track: 'frostline', color: '#eef3ff', paint: solid('#eef3ff') },
    { id: 'arctic',  name: 'ARCTIC CAMO',  track: 'glacier',   color: '#dbe6f5', paint: spots('#dbe6f5', ['#9fb2cc', '#f7fbff', '#7f93b0'], 7, 0.34, 53) },
    { id: 'penguin', name: 'PENGUIN',      track: 'whiteout',  color: '#20242e', paint: penguin },

    { id: 'stone',   name: 'STONE',        track: 'scree',     color: '#8b8f98', paint: spots('#8b8f98', ['#43474f', '#cfd6e2', '#5d636d'], 8, 0.27, 67) },
    { id: 'zebra',   name: 'ZEBRA',        track: 'overhang',  color: '#f4f6fa', paint: bars('#f4f6fa', '#14161c', 6, 0.35, 0.40) },
    { id: 'carbon',  name: 'CARBON FIBRE', track: 'quarry',    color: '#2a2f3a', paint: carbon },

    { id: 'taxi',    name: 'TAXI',         track: 'gridlock',  color: '#ffc21a', paint: function (g, x, y, w, h) {
        g.fillStyle = '#ffc21a'; g.fillRect(x, y, w, h);
        var c = Math.max(2, h * 0.24), i;
        for (i = 0; x + i * c < x + w; i++) {
          g.fillStyle = i % 2 ? '#14161c' : '#f4f6fa';
          g.fillRect(x + i * c, y + h * 0.38, c, h * 0.24);
        }
      } },
    { id: 'police',  name: 'POLICE',       track: 'crosstown', color: '#e8edf6', paint: police },
    { id: 'neon',    name: 'NEON',         track: 'downtown',  color: '#ff2bd6', paint: neon },

    { id: 'hazard',  name: 'HAZARD STRIPES', track: 'foundry',  color: '#ffc21a', paint: bars('#ffc21a', '#14161c', 5, 0.85, 0.46) },
    { id: 'rust',    name: 'RUST',           track: 'pipeworks', color: '#9a5a2c', paint: spots('#9a5a2c', ['#6b3a17', '#c98c4a', '#4a2a10'], 9, 0.28, 83) },
    { id: 'chrome',  name: 'CHROME',         track: 'refinery',  color: '#c3d1e4', paint: chrome },

    { id: 'bronze',  name: 'BRONZE',       track: 'sanctum',   color: '#c07a3a', paint: grad([[0, '#f0c088'], [0.4, '#c07a3a'], [0.7, '#7a4818'], [1, '#d99a56']], true) },
    { id: 'marble',  name: 'MARBLE',       track: 'colonnade', color: '#e6e9ef', paint: marble },
    { id: 'gold',    name: 'GOLD',         track: 'labyrinth', color: '#ffd24a', paint: gold },

    { id: 'flame',   name: 'FLAME',        track: 'basalt',    color: '#ff5a1f', paint: flame },
    { id: 'magma',   name: 'MAGMA',        track: 'fissure',   color: '#ff7a1f', paint: magma },
    { id: 'lava',    name: 'LAVA',         track: 'crater',    color: '#ff9a1f', paint: lava },

    { id: 'stars',   name: 'STARS',        track: 'orbital',    color: '#aebfe8', paint: starfield },
    { id: 'galaxy',  name: 'GALAXY',       track: 'driftfield', color: '#c86bff', paint: galaxy },
    { id: 'void',    name: 'BLACK HOLE',   track: 'horizon',    color: '#ffb648', paint: blackhole },

    { id: 'toxic',   name: 'TOXIC',        track: 'landfall',   color: '#7cff5a', paint: toxic },
    { id: 'alien',   name: 'ALIEN',        track: 'hive',       color: '#9fb0c4', paint: ufo },
    { id: 'rainbow', name: 'RAINBOW',      track: 'mothership', color: '#ff9a1f', paint: rainbow }
  ];

  /* ---- the vehicles ----------------------------------------------------
   *
   * Every one of these draws INSIDE the footprint config.js declares, and
   * that is the rule the whole feature rests on. A wing wider than the box,
   * or a nose longer than it, would be a car that looks like it should have
   * hit something it did not - or worse, one that looks like it cleared
   * something it did not. Inside the box the drawing can only ever be more
   * cautious than the collision, which is the safe direction to be wrong in.
   *
   * A vehicle is four numbers and two functions:
   *
   *   body    how much of the WIDTH the painted shell takes. The rest is
   *           tyre. This is the single thing that makes these read as cars
   *           from above rather than as slabs - an off-roader is a narrow
   *           body on fat wheels, an open-wheeler is a cigar with the wheels
   *           hanging off it, and neither is any bigger than a hatchback.
   *   wheels  where the axles sit along the length, or null for the ones
   *           that do not have any.
   *   path    the shell outline, in the inset box.
   *   detail  glass, lamps, wings and vents. It is handed the FULL width as
   *           a sixth argument, because a rear wing is allowed to reach the
   *           edge of the box even though the body does not.
   *
   * Detail is laid on in translucent black and white rather than in colours,
   * so a bonnet scoop reads the same over Gold as it does over Carbon. */

  var BODY = 0.84;          // the default share of the width that is shell
  var TYRE = '#0a0d13';

  function drawWheels(g, L, W, v) {
    var wl = L * (v.wheelLen || 0.21);
    var ww = W * (v.wheelW || 0.15);
    var i, wx;
    g.fillStyle = TYRE;
    for (i = 0; i < v.wheels.length; i++) {
      wx = -L / 2 + L * v.wheels[i] - wl / 2;
      g.fillRect(wx, -W / 2, wl, ww);
      g.fillRect(wx, W / 2 - ww, wl, ww);
    }
  }

  function shell(g, L, W, v, fill, flash) {
    var bw = (v.body === undefined ? BODY : v.body) * W;
    var x = -L / 2, y = -bw / 2;
    if (v.wheels && !flash) drawWheels(g, L, W, v);
    g.save();
    g.beginPath();
    v.path(g, x, y, L, bw);
    g.save();
    g.clip();
    fill(g, x, y, L, bw);
    // The outline, which is what keeps a pale skin off a pale road. It is
    // stroked INSIDE the clip at double width, so only the inner half of the
    // line lands: a centred stroke would put half a line-width of ink outside
    // the body on every side, and the one rule here is that nothing paints
    // outside the box the car collides with.
    g.strokeStyle = 'rgba(0,0,0,0.78)';
    g.lineWidth = Math.max(1, L * 0.022) * 2;
    g.stroke();
    g.restore();
    g.restore();
    if (v.detail && !flash) v.detail(g, x, y, L, bw, W);
  }

  function boxPath(g, x, y, w, h) { g.rect(x, y, w, h); }

  function poly(pts) {
    return function (g, x, y, w, h) {
      pts.forEach(function (p, i) {
        var px = x + p[0] * w, py = y + p[1] * h;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      });
      g.closePath();
    };
  }

  function ovalPath(g, x, y, w, h) {
    g.ellipse(x + w * 0.5, y + h * 0.5, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
  }

  var INK = 'rgba(8,10,16,0.62)';
  var INK_HARD = 'rgba(8,10,16,0.82)';
  var SHEEN = 'rgba(255,255,255,0.28)';
  var LAMP = 'rgba(255,248,214,0.95)';
  var TAIL = 'rgba(255,86,72,0.88)';

  /* Run several detail passes as one. */
  function det() {
    var fns = Array.prototype.slice.call(arguments);
    return function (g, x, y, w, h, W) {
      for (var i = 0; i < fns.length; i++) if (fns[i]) fns[i](g, x, y, w, h, W);
    };
  }

  /* Glass, as a trapezoid narrowing towards the nose. A rectangle would be a
   * sunroof; the taper is most of what says which end is the front. */
  function glass(xr, xf, hr, hf, tint) {
    return function (g, x, y, w, h) {
      var cy = y + h / 2;
      g.fillStyle = tint || INK;
      g.beginPath();
      g.moveTo(x + w * xr, cy - h * hr * 0.5);
      g.lineTo(x + w * xf, cy - h * hf * 0.5);
      g.lineTo(x + w * xf, cy + h * hf * 0.5);
      g.lineTo(x + w * xr, cy + h * hr * 0.5);
      g.closePath();
      g.fill();
    };
  }

  /* Headlights. `hf` is how tall each one is and `inset` how far in from the
   * flank, which is what keeps them on the body when the nose is tapered. */
  function lamps(xf, hf, inset) {
    return function (g, x, y, w, h) {
      var lw = Math.max(0.8, w * 0.05), lh = h * (hf || 0.22);
      var lx = x + w * xf - lw, off = h * (inset || 0.10);
      g.fillStyle = LAMP;
      g.fillRect(lx, y + off, lw, lh);
      g.fillRect(lx, y + h - off - lh, lw, lh);
    };
  }

  function tail(g, x, y, w, h) {
    var lw = Math.max(0.8, w * 0.035);
    g.fillStyle = TAIL;
    g.fillRect(x, y + h * 0.12, lw, h * 0.22);
    g.fillRect(x, y + h * 0.66, lw, h * 0.22);
  }

  /* A wing may reach the full width of the box even though the body does
   * not, which is the whole look of a rally car or a single-seater. */
  function wing(xf, wf, ink) {
    return function (g, x, y, w, h, W) {
      var t = Math.max(0.7, W * 0.07);
      g.fillStyle = ink || INK_HARD;
      g.fillRect(x + w * xf, -W / 2, w * wf, W);
      // lit along BOTH long edges. A dark wing on a dark road is a wing you
      // cannot see, and the wings are most of what these two cars are.
      g.fillStyle = 'rgba(214,228,248,0.55)';
      g.fillRect(x + w * xf, -W / 2, w * wf, t);
      g.fillRect(x + w * xf, W / 2 - t, w * wf, t);
    };
  }

  Cos.VEHICLES = [
    /* The one you start with: a plain saloon shape, so every other silhouette
     * has something obvious to differ from. */
    { id: 'stock', name: 'STOCK', theme: null,
      body: 0.84, wheels: [0.22, 0.80],
      path: poly([[0, 0.14], [0.08, 0], [0.93, 0], [1, 0.16], [1, 0.84], [0.93, 1], [0.08, 1], [0, 0.86]]),
      detail: det(glass(0.14, 0.30, 0.76, 0.82, INK), glass(0.36, 0.62, 0.86, 0.64),
                  lamps(1, 0.24), tail) },

    /* Short, upright and nearly all glass: the shape you can see is small. */
    { id: 'hatch', name: 'HATCHBACK', theme: 'forest',
      body: 0.86, wheels: [0.19, 0.81], wheelLen: 0.19,
      path: poly([[0.02, 0.12], [0.12, 0], [0.90, 0.02], [1, 0.18], [1, 0.82], [0.90, 0.98], [0.12, 1], [0.02, 0.88]]),
      detail: det(glass(0.06, 0.24, 0.66, 0.88, INK_HARD), glass(0.36, 0.64, 0.90, 0.62),
                  function (g, x, y, w, h) {   // roof rails
                    g.fillStyle = SHEEN;
                    g.fillRect(x + w * 0.26, y + h * 0.16, w * 0.10, h * 0.68);
                  },
                  lamps(1, 0.26), tail) },

    /* Cab forward, open bed behind. The recess is the entire read, so it is
     * the biggest thing on the shape. */
    { id: 'pickup', name: 'PICKUP', theme: 'desert',
      body: 0.88, wheels: [0.17, 0.83], wheelLen: 0.20, wheelW: 0.17,
      path: poly([[0, 0.06], [0.90, 0], [1, 0.14], [1, 0.86], [0.90, 1], [0, 0.94]]),
      detail: det(function (g, x, y, w, h) {
                    g.fillStyle = INK_HARD;
                    g.fillRect(x + w * 0.04, y + h * 0.10, w * 0.38, h * 0.80);
                    g.fillStyle = 'rgba(255,255,255,0.16)';   // the bed floor
                    g.fillRect(x + w * 0.07, y + h * 0.16, w * 0.32, h * 0.68);
                  },
                  glass(0.48, 0.74, 0.88, 0.66),
                  lamps(1, 0.24), tail) },

    /* A narrow body on fat tyres, plus a roof rack. Widest-looking car in
     * the game and not one pixel wider than the rest. */
    { id: 'offroad', name: 'OFF-ROADER', theme: 'snow',
      body: 0.66, wheels: [0.21, 0.79], wheelLen: 0.25, wheelW: 0.17,
      path: boxPath,
      detail: det(glass(0.16, 0.34, 0.70, 0.86, INK_HARD), glass(0.44, 0.72, 0.90, 0.70),
                  function (g, x, y, w, h, W) {
                    g.fillStyle = 'rgba(255,255,255,0.40)';   // roof rack
                    g.fillRect(x + w * 0.20, y + h * 0.18, w * 0.52, Math.max(0.8, h * 0.07));
                    g.fillRect(x + w * 0.20, y + h * 0.75, w * 0.52, Math.max(0.8, h * 0.07));
                    g.fillStyle = INK_HARD;                   // bull bar, full width
                    g.fillRect(x + w * 0.94, -W / 2, w * 0.06, W);
                  },
                  lamps(0.94, 0.26), tail) },

    /* A hatchback that has been got at: wing across the full box, a vent in
     * the bonnet, and four spot lamps in a row. */
    { id: 'rally', name: 'RALLY', theme: 'cliffs',
      body: 0.82, wheels: [0.20, 0.80], wheelLen: 0.20, wheelW: 0.16,
      path: poly([[0.06, 0.04], [1, 0.14], [1, 0.86], [0.06, 0.96], [0, 0.72], [0, 0.28]]),
      detail: det(wing(0, 0.07),
                  glass(0.16, 0.34, 0.70, 0.86, INK_HARD), glass(0.42, 0.66, 0.90, 0.66),
                  function (g, x, y, w, h) {
                    g.fillStyle = INK_HARD;                   // bonnet vent
                    g.fillRect(x + w * 0.72, y + h * 0.36, w * 0.14, h * 0.28);
                    g.fillStyle = LAMP;                       // the four spot lamps
                    for (var i = 0; i < 4; i++) {
                      g.beginPath();
                      g.arc(x + w * 0.95, y + h * (0.22 + i * 0.187),
                            Math.max(0.7, h * 0.09), 0, Math.PI * 2);
                      g.fill();
                    }
                  },
                  tail) },

    /* Long, smooth and four-doored, with a pillar between the windows. */
    { id: 'saloon', name: 'SALOON', theme: 'city',
      body: 0.86, wheels: [0.18, 0.82],
      path: poly([[0, 0.22], [0.06, 0.02], [0.90, 0], [1, 0.18], [1, 0.82], [0.90, 1], [0.06, 0.98], [0, 0.78]]),
      detail: det(glass(0.10, 0.28, 0.70, 0.86, INK_HARD), glass(0.34, 0.40, 0.88, 0.86),
                  glass(0.46, 0.70, 0.86, 0.62),
                  function (g, x, y, w, h) {
                    g.fillStyle = SHEEN;                      // the waistline
                    g.fillRect(x + w * 0.08, y + h * 0.04, w * 0.84, Math.max(0.6, h * 0.05));
                    g.fillRect(x + w * 0.08, y + h * 0.91, w * 0.84, Math.max(0.6, h * 0.05));
                  },
                  lamps(1, 0.22), tail) },

    /* Long bonnet, cabin pushed right to the back, a scoop and two stripes. */
    { id: 'muscle', name: 'MUSCLE', theme: 'industrial',
      body: 0.88, wheels: [0.17, 0.83], wheelLen: 0.22, wheelW: 0.16,
      path: poly([[0.02, 0.02], [0.66, 0.08], [1, 0.22], [1, 0.78], [0.66, 0.92], [0.02, 0.98]]),
      detail: det(glass(0.10, 0.34, 0.72, 0.84, INK_HARD),
                  function (g, x, y, w, h) {
                    g.fillStyle = 'rgba(255,255,255,0.32)';   // the two stripes
                    g.fillRect(x + w * 0.04, y + h * 0.34, w * 0.90, Math.max(0.7, h * 0.09));
                    g.fillRect(x + w * 0.04, y + h * 0.57, w * 0.90, Math.max(0.7, h * 0.09));
                    g.fillStyle = INK_HARD;                   // bonnet scoop
                    g.fillRect(x + w * 0.50, y + h * 0.30, w * 0.24, h * 0.40);
                    g.fillStyle = SHEEN;
                    g.fillRect(x + w * 0.52, y + h * 0.34, w * 0.20, h * 0.09);
                  },
                  lamps(0.98, 0.20, 0.24), tail) },

    /* A vintage single-seater: a cigar with the wheels out in the open. */
    { id: 'classic', name: 'CLASSIC RACER', theme: 'ruins',
      body: 0.48, wheels: [0.20, 0.80], wheelLen: 0.26, wheelW: 0.18,
      path: poly([[0, 0.34], [0.14, 0.02], [0.74, 0], [0.96, 0.32], [1, 0.5],
                  [0.96, 0.68], [0.74, 1], [0.14, 0.98], [0, 0.66]]),
      detail: det(function (g, x, y, w, h) {
                    g.fillStyle = INK_HARD;                   // open cockpit
                    g.beginPath();
                    g.ellipse(x + w * 0.32, y + h * 0.5, w * 0.11, h * 0.34, 0, 0, Math.PI * 2);
                    g.fill();
                    g.strokeStyle = 'rgba(255,255,255,0.70)'; // the roundel
                    g.lineWidth = Math.max(0.8, w * 0.012);
                    g.beginPath();
                    g.arc(x + w * 0.60, y + h * 0.5, h * 0.34, 0, Math.PI * 2);
                    g.stroke();
                    g.fillStyle = 'rgba(255,255,255,0.45)';   // exhaust down the flank
                    g.fillRect(x + w * 0.20, y - h * 0.06, w * 0.34, Math.max(0.6, h * 0.08));
                  }) },

    /* A wedge: pointed at the nose, widest over the back wheels. */
    { id: 'sports', name: 'SPORTS', theme: 'volcano',
      body: 0.86, wheels: [0.21, 0.79], wheelLen: 0.20,
      path: poly([[0.03, 0.12], [0.58, 0.02], [0.92, 0.22], [1, 0.42], [1, 0.58],
                  [0.92, 0.78], [0.58, 0.98], [0.03, 0.88]]),
      detail: det(glass(0.22, 0.50, 0.74, 0.54),
                  function (g, x, y, w, h) {
                    g.fillStyle = INK_HARD;                   // side intakes
                    g.fillRect(x + w * 0.30, y + h * 0.02, w * 0.20, h * 0.12);
                    g.fillRect(x + w * 0.30, y + h * 0.86, w * 0.20, h * 0.12);
                    g.fillStyle = TAIL;                       // full-width tail bar
                    g.fillRect(x + w * 0.02, y + h * 0.40, w * 0.05, h * 0.20);
                  },
                  lamps(0.99, 0.16, 0.30)) },

    /* A single-seater: needle nose, wings at both ends, wheels in the open.
     * The wings reach the edge of the box and stop there. */
    { id: 'racer', name: 'SPACE RACER', theme: 'space',
      body: 0.52, wheels: [0.26, 0.76], wheelLen: 0.22, wheelW: 0.17,
      path: poly([[0, 0.04], [0.30, 0.08], [0.62, 0.26], [1, 0.40], [1, 0.60],
                  [0.62, 0.74], [0.30, 0.92], [0, 0.96]]),
      detail: det(wing(0, 0.07), wing(0.92, 0.08),
                  function (g, x, y, w, h) {
                    g.fillStyle = INK_HARD;                   // cockpit
                    g.beginPath();
                    g.ellipse(x + w * 0.34, y + h * 0.5, w * 0.10, h * 0.36, 0, 0, Math.PI * 2);
                    g.fill();
                    g.fillStyle = 'rgba(94,242,255,0.85)';    // the engine, lit
                    g.fillRect(x + w * 0.07, y + h * 0.22, w * 0.05, h * 0.56);
                  }) },

    /* No wheels, no nose: it is a saucer, and it is meant to be the odd one
     * out at the end of the ladder. */
    { id: 'saucer', name: 'SAUCER', theme: 'alien',
      body: 1, wheels: null,
      path: ovalPath,
      detail: function (g, x, y, w, h) {
        g.fillStyle = 'rgba(8,10,16,0.30)';   // the hull ring
        g.beginPath();
        g.ellipse(x + w * 0.5, y + h * 0.5, w * 0.36, h * 0.36, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.34)';   // the dome
        g.beginPath();
        g.ellipse(x + w * 0.52, y + h * 0.5, w * 0.20, h * 0.30, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(8,10,16,0.62)';
        g.beginPath();
        g.ellipse(x + w * 0.52, y + h * 0.5, w * 0.11, h * 0.17, 0, 0, Math.PI * 2);
        g.fill();
        var i;   // running lights instead of headlamps
        for (i = 0; i < 5; i++) {
          var a = -Math.PI * 0.5 + i * Math.PI * 0.25;
          g.fillStyle = i % 2 ? '#7cff5a' : '#ff5470';
          g.beginPath();
          g.arc(x + w * 0.5 + Math.cos(a) * w * 0.42,
                y + h * 0.5 + Math.sin(a) * h * 0.42,
                Math.max(0.7, h * 0.07), 0, Math.PI * 2);
          g.fill();
        }
      } }
  ];

  /* ---- unlocks ---------------------------------------------------------
   *
   * Derived, never stored. A skin is yours once you have WON its track; a
   * vehicle is yours once its theme's star is gold, which means first on all
   * three. Both read the medals that were already being saved, so a track
   * you won before any of this existed counts the moment the file loads and
   * there is nothing to migrate.
   */
  function themeTracks(themeId) {
    var themes = global.THEMES || [], i;
    for (i = 0; i < themes.length; i++) {
      if (themes[i].id === themeId) {
        return themes[i].tracks.map(function (t) { return t.id; });
      }
    }
    return [];
  }

  function themeName(themeId) {
    var themes = global.THEMES || [], i;
    for (i = 0; i < themes.length; i++) if (themes[i].id === themeId) return themes[i].name;
    return themeId;
  }

  function trackName(trackId) {
    var tracks = global.TRACKS || [], i;
    for (i = 0; i < tracks.length; i++) if (tracks[i].id === trackId) return tracks[i].name;
    return trackId;
  }

  Cos.skinUnlocked = function (skin) {
    if (!skin.track) return true;
    return global.Progress.medal(skin.track) === 1;
  };

  Cos.vehicleUnlocked = function (v) {
    if (!v.theme) return true;
    return global.Progress.star(themeTracks(v.theme)) === 1;
  };

  Cos.skinRequirement = function (skin) {
    return skin.track ? 'Win 1st place on ' + trackName(skin.track) : '';
  };

  Cos.vehicleRequirement = function (v) {
    return v.theme ? 'Earn the ' + themeName(v.theme) + ' Gold Star' : '';
  };

  function findSkin(id) {
    for (var i = 0; i < Cos.SKINS.length; i++) if (Cos.SKINS[i].id === id) return Cos.SKINS[i];
    return null;
  }
  function findVehicle(id) {
    for (var i = 0; i < Cos.VEHICLES.length; i++) if (Cos.VEHICLES[i].id === id) return Cos.VEHICLES[i];
    return null;
  }
  Cos.skin = findSkin;
  Cos.vehicle = findVehicle;

  /* ---- what you have equipped -----------------------------------------
   *
   * The two ids, in their own key. This is a preference and not an
   * achievement, so it is kept apart from the medals - but it is checked
   * against them on the way out: RESET DATA can take an unlock away, and
   * the answer to that is to fall back to the default rather than to hand
   * back something you no longer own. */
  var KEY = 'blockracer.cosmetics.v1';
  var picked = { skin: 'stock', vehicle: 'stock' };

  try {
    var raw = global.localStorage && global.localStorage.getItem(KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (findSkin(parsed.skin)) picked.skin = parsed.skin;
        if (findVehicle(parsed.vehicle)) picked.vehicle = parsed.vehicle;
      }
    }
  } catch (e) { /* unreadable storage: the defaults stand */ }

  function save() {
    try {
      if (global.localStorage) global.localStorage.setItem(KEY, JSON.stringify(picked));
    } catch (e) { /* blocked or full: the session keeps the choice anyway */ }
  }

  Cos.equippedSkin = function () {
    var s = findSkin(picked.skin);
    return (s && Cos.skinUnlocked(s)) ? s : Cos.SKINS[0];
  };
  Cos.equippedVehicle = function () {
    var v = findVehicle(picked.vehicle);
    return (v && Cos.vehicleUnlocked(v)) ? v : Cos.VEHICLES[0];
  };
  Cos.equipSkin = function (id) {
    var s = findSkin(id);
    if (!s || !Cos.skinUnlocked(s)) return false;
    picked.skin = id;
    save();
    return true;
  };
  Cos.equipVehicle = function (id) {
    var v = findVehicle(id);
    if (!v || !Cos.vehicleUnlocked(v)) return false;
    picked.vehicle = id;
    save();
    return true;
  };

  /* ---- drawing ---------------------------------------------------------
   *
   * One entry point, used by the car in the race and by both previews in the
   * shop. The preview is therefore the paint you will be driving rather than
   * a picture of it.
   *
   * `flash` is the white crash flash, and it wins over the skin outright -
   * the flash exists to be read instantly and a patterned car would swallow
   * it. In high contrast the skin is replaced by the car's own colour for
   * the same reason the rest of that mode drops texture. */
  Cos.paintBody = function (g, skin, x, y, w, h, flash, plainColor) {
    if (flash > 0.05) {
      g.fillStyle = 'rgba(255,255,255,' + (0.35 + 0.65 * flash) + ')';
      g.fillRect(x, y, w, h);
      return;
    }
    if (plainColor) {
      g.fillStyle = plainColor;
      g.fillRect(x, y, w, h);
      return;
    }
    skin.paint(g, x, y, w, h);
  };

  /* The player's identification ring, as a PATH rather than as a rectangle.
   *
   * There has been a white outline round your car since long before any of
   * this, and while every car was a rectangle a rectangle fitted it exactly.
   * It does not fit a saucer, a wedge or an open-wheeler: a box drawn round
   * a round car is a box you notice instead of a car you find. So the ring
   * traces the silhouette - body and tyres both - and the car goes on looking
   * like a car with an edge on it rather than a car in a crate.
   *
   * `grow` pushes it out from the body. Canvas stores a path in device space,
   * so the scale used to build it is gone by the time anything is stroked and
   * the line width is unaffected by it. */
  function silhouette(g, L, W, v, grow) {
    var bw = (v.body === undefined ? BODY : v.body) * W;
    g.save();
    g.scale((L + grow * 2) / L, (W + grow * 2) / W);
    g.beginPath();
    /* The BODY only. Taking the wheels in as well put a white margin round
     * each tyre, which at thirty pixels reads as four corner brackets - a
     * car in a clamp rather than a car with an edge on it. The tyres are
     * dark and sit against the body, so they read as part of the car with
     * no help; it is the painted shell that needs separating from the road. */
    v.path(g, -L / 2, -bw / 2, L, bw);
    g.restore();
  }

  /* The ring is FILLED, not stroked, and it goes on BEFORE the car.
   *
   * Stroking it traces every sub-path, so each tyre came out in its own white
   * bracket and the car looked clamped rather than outlined. Filling the same
   * path merges the body and the four wheels into one shape - that is what
   * the nonzero winding rule is for - and then the car, drawn on top, covers
   * everything except the margin. What is left is the outline of the whole
   * silhouette and nothing else. */
  Cos.fillSilhouette = function (g, L, W, vehicle, grow, style) {
    silhouette(g, L, W, vehicle, grow);
    g.fillStyle = style;
    g.fill();
  };

  /* The car, in its own space: nose at +x, centred on the origin. */
  Cos.drawCar = function (g, L, W, skin, vehicle, flash, plainColor) {
    var hot = flash > 0.05;
    // A crash flash has to be read in one frame, so when it is on the car
    // goes back to being a plain lit box: no wheels, no glass, no wing. The
    // shape reappears the moment the flash fades.
    if (hot) {
      Cos.paintBody(g, skin, -L / 2, -W / 2, L, W, flash, plainColor);
      return;
    }
    shell(g, L, W, vehicle, function (gg, x, y, w, h) {
      Cos.paintBody(gg, skin, x, y, w, h, 0, plainColor);
    }, false);
  };

  /* A round chip for the skins grid.
   *
   * The paint goes in at the CAR'S aspect and is then cropped by the circle,
   * rather than being stretched to fill a square. That matters more than it
   * sounds: every painter sizes its spots and stripes off the height it is
   * given, so painting a 1.25 x 0.67 pattern into a square makes the blobs
   * half again too big and the chip stops being a preview of anything. Cow
   * in particular came out as a black car with a white bite in it. */
  Cos.paintSkinChip = function (canvas, skin) {
    var d = canvas.width;
    var g = canvas.getContext('2d');
    var pw = d * (1.25 / (0.8 * BODY));          // car aspect, cropped by the circle
    g.clearRect(0, 0, d, d);
    g.save();
    g.beginPath();
    g.arc(d / 2, d / 2, d / 2 - 1, 0, Math.PI * 2);
    g.clip();
    // NOTE: the rectangle is in PIXELS and the context is NOT scaled. Several
    // painters floor a size at a pixel or two - a carbon weave cell, a star -
    // and scaling the context turns those floors into slabs the size of the
    // whole chip. Handing the painter a bigger box in real pixels is the only
    // version of this that survives them.
    skin.paint(g, (d - pw) / 2, 0, pw, d);
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(d / 2, d / 2, d / 2 - 1, 0, Math.PI * 2);
    g.stroke();
  };

  /* And the wide one for the vehicles grid: the whole silhouette, wearing
   * whatever skin is equipped, so the two tabs answer each other. */
  Cos.paintVehicleCard = function (canvas, vehicle, skin) {
    var w = canvas.width, h = canvas.height;
    var g = canvas.getContext('2d');
    g.clearRect(0, 0, w, h);
    var L = w * 0.78, W = L * (0.8 / 1.25);
    if (W > h * 0.72) { W = h * 0.72; L = W * (1.25 / 0.8); }
    g.save();
    g.translate(w / 2, h / 2);
    g.scale(1, 1);
    Cos.drawCar(g, L, W, skin, vehicle, 0, null);
    g.restore();
  };

  global.Cosmetics = Cos;
})(typeof window !== 'undefined' ? window : globalThis);
