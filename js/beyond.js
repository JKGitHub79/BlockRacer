/* Block Racer - something past the end of a road. Deliberately undocumented
 * anywhere a player looks: no menu, no README section, no counter, no unlock.
 *
 * Labyrinth's east street runs north into the outer wall at the top right
 * of the track, where the lap turns west for the line. That wall is a wall,
 * and stays one - for every car, at every speed, from every angle - except
 * in one case: YOUR car, at the top speed there is, running squarely north
 * with a couple of cells of straight road behind it, meeting the five cells
 * of wall at the end of the street (x 46-51, face y = 1, in track cells)
 * with all of itself inside them. Then this step's move is not stopped by
 * it, and the car is somewhere else.
 *
 * Nothing about that wall is drawn differently, and nothing in the track's
 * geometry or collision changes: the check runs in Game.step, before the
 * cars move, on the player's own position in track coordinates - so the
 * quarter turn the board gets on a phone held upright changes nothing - and
 * when it does not fire, the move goes ahead into the wall as it always did.
 *
 * Nothing about it is recorded: no result, medal, record, ghost, star,
 * unlock or flag. The race is reset the moment it starts and the player
 * lands on the main menu at the end.
 *
 * It borrows the black layer and canvas from js/secret.js and a line of
 * text of its own, and it can never run with any of the others: it only
 * starts from a race that is running, and they only start from a race that
 * is running or from a menu. Every style it touches is written back as it
 * found it, and every frame loop, listener and sound it starts is gone
 * before it hands back. While it runs Game.command ignores all but mute. */
(function (global) {
  'use strict';

  var ENTRANCE = { track: 'labyrinth', x0: 46, x1: 51, face: 1 };
  var RUNUP = 2;              // cells of straight road north before it

  var CRUISE = 5.5;           // cells a second, once the road has the car
  var SETTLE = 2.5;           // seconds to come down to it from race speed
  var ROAD_W = 2.4;           // cells: half a Labyrinth street
  var REACH = 13;             // cells the headlights light, driving
  var LOW_REACH = 2.6;        // and once they have given up
  var SPAWN = 24;             // cells ahead a word is laid, out in the dark
  var WORDS = [[5, 'TURN BACK'], [13, 'THIS ROAD IS NOT YOURS'], [21, 'TRAVELLER']];
  var BRAKE = 3.6;            // seconds from giving up to standing still
  var PAN = 3.2;              // seconds for the view to settle behind the car
  var FALL = 0.55;            // seconds for the Labyrinth to fall away
  var APPROACH = 26;          // seconds for the lights to come
  var NEAR = 3.2;             // cells ahead they come to
  var LAMP_GAP = 0.36;        // cells either side of the road's middle

  var Beyond = { active: false, speed: 1, phase: null };
  var runFrom = null;
  var raf = 0, onResize = null, place = null;
  var el = {}, st = null, saved = [];
  var STILL = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function $(id) { return document.getElementById(id); }
  function now() { return global.performance ? performance.now() : Date.now(); }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ---- the way in ---------------------------------------------------------- */

  Beyond.reset = function () { runFrom = null; };

  /* Called by Game.step every step of a race, after the player's turns and
   * before anything moves. True when it has just begun. */
  Beyond.gate = function (game, dt) {
    var T = global.TRACK, C = global.CONFIG, P = game.player;
    if (Beyond.active || !P || game.mode === 'tutorial' || !T.data || T.data.id !== ENTRANCE.track) {
      runFrom = null;
      return false;
    }
    // Squarely north, not sliding, not stopped: otherwise the run starts over.
    if (P.crashed || P.finished || P.dir.x !== 0 || P.dir.y !== -1 || Math.abs(P.slip()) > 1e-6) {
      runFrom = null;
      return false;
    }
    if (runFrom === null) runFrom = P.y;
    if (C.speedLevel !== C.speedLevels.length - 1) return false;       // flat out or not at all
    var b = P.box();
    if (b.x0 < ENTRANCE.x0 || b.x1 > ENTRANCE.x1) return false;
    if (b.y0 - P.speed * dt >= ENTRANCE.face) return false;            // not there this step
    if (runFrom - P.y < RUNUP) return false;
    begin(game);
    return true;
  };

  /* ---- where things are ------------------------------------------------------ */

  function size() {
    var c = el.canvas, dpr = Math.min(global.devicePixelRatio || 1, 2);
    st.w = global.innerWidth; st.h = global.innerHeight; st.dpr = dpr;
    c.width = Math.round(st.w * dpr);
    c.height = Math.round(st.h * dpr);
    c.style.width = st.w + 'px';
    c.style.height = st.h + 'px';
    st.lit.width = c.width;
    st.lit.height = c.height;
  }

  /* Where the car is on the screen and how big a cell is. It starts exactly
   * where it went through the wall, the size it was on the board, and eases
   * back to a place with the road in front of it - the view catching up. */
  function camera() {
    var f = st.f, w = st.w, h = st.h;
    var ext = Math.abs(f.x) * w + Math.abs(f.y) * h;
    var ax = w / 2 - f.x * ext * 0.3, ay = h / 2 - f.y * ext * 0.3;
    var e = smooth(st.t / PAN);
    var kT = Math.max(st.k0, Math.min(Math.min(w, h) / 24, st.k0 * 1.8));
    return { x: lerp(st.p0.x, ax, e), y: lerp(st.p0.y, ay, e), k: lerp(st.k0, kT, e) };
  }

  // How many cells of road there are between the car and the screen's edge,
  // ahead (dir 1) or behind (dir -1).
  function room(cam, dir) {
    var fx = st.f.x * dir, fy = st.f.y * dir, best = Infinity;
    if (fx > 1e-6) best = Math.min(best, (st.w - cam.x) / fx);
    if (fx < -1e-6) best = Math.min(best, cam.x / -fx);
    if (fy > 1e-6) best = Math.min(best, (st.h - cam.y) / fy);
    if (fy < -1e-6) best = Math.min(best, cam.y / -fy);
    return Math.max(0, best) / cam.k;
  }

  // Road space: x cells ahead of the car along the road, y cells across it.
  function toRoad(g, cam) {
    var f = st.f, k = cam.k * st.dpr;
    g.setTransform(k * f.x, k * f.y, -k * f.y, k * f.x, cam.x * st.dpr, cam.y * st.dpr);
  }

  /* The car's own lights: how far they reach and how bright, now. Driving,
   * all of them. Stopped, they stutter and sink to a pool at its nose. */
  function lamps() {
    if (st.stillT === null) return { reach: REACH, bright: 1 };
    var u = st.t - st.stillT;
    var off = (u > 1.2 && u < 1.29) || (u > 1.45 && u < 1.59) || (u > 1.9 && u < 1.96);
    var e = smooth((u - 2) / 1.5);
    return { reach: lerp(REACH, LOW_REACH, e), bright: off ? 0.08 : lerp(1, 0.55, e) };
  }

  // What the car's lights leave of a thing `d` cells ahead of it: 0 to 1.
  function lightAt(d, lamp) {
    if (d < 0) return 0.55 * clamp01(1 + d / 4.5) * lamp.bright;
    if (d < lamp.reach * 0.35) return lamp.bright;
    return lamp.bright * (1 - smooth((d - lamp.reach * 0.35) / (lamp.reach * 0.65)));
  }

  /* ---- drawing -------------------------------------------------------------- */

  // The road under the lights: drawn whole, then cut by how far they reach.
  // Past that it does not end. It just stops being lit.
  function drawRoad(g, cam, lamp, fade) {
    var lit = st.lit, q = lit.getContext('2d');
    var back = room(cam, -1) + 2, ahead = room(cam, 1) + 2;
    q.setTransform(1, 0, 0, 1, 0, 0);
    q.globalCompositeOperation = 'source-over';
    q.globalAlpha = 1;
    q.clearRect(0, 0, lit.width, lit.height);
    toRoad(q, cam);
    var half = ROAD_W / 2, s = st.s;
    q.fillStyle = st.colors.road;
    q.fillRect(-back, -half, back + ahead, ROAD_W);
    // the flagstones carry on from the Labyrinth: a cell grid, fixed to the road
    q.fillStyle = st.colors.grid;
    var lw = 1 / cam.k;
    for (var c = Math.floor(s - back); c <= s + ahead; c++) q.fillRect(c - s, -half, lw, ROAD_W);
    for (var r = -1; r <= 1; r++) q.fillRect(-back, r * 0.8 - lw / 2, back + ahead, lw);
    // and so does the racing line, straight down the middle of it
    q.fillStyle = st.colors.line;
    for (var m = Math.floor((s - back) / 1.1) * 1.1; m <= s + ahead; m += 1.1) q.fillRect(m - s, -0.06, 0.55, 0.12);
    q.fillStyle = st.colors.edge;
    q.fillRect(-back, -half, back + ahead, 0.07);
    q.fillRect(-back, half - 0.07, back + ahead, 0.07);

    // how much of it the lights leave
    var d0 = -6, d1 = Math.max(ahead, lamp.reach + 1), span = d1 - d0;
    var grad = q.createLinearGradient(d0, 0, d1, 0);
    var stop = function (d, a) { grad.addColorStop(clamp01((d - d0) / span), 'rgba(0,0,0,' + clamp01(a) + ')'); };
    stop(d0, 0);
    stop(-1, 0.4 * lamp.bright);
    stop(0.6, lamp.bright);
    stop(lamp.reach * 0.35, lamp.bright);
    stop(lamp.reach, 0.06);
    stop(d1, 0.04);
    q.globalCompositeOperation = 'destination-in';
    q.fillStyle = grad;
    q.fillRect(d0, -40, span, 80);
    q.globalCompositeOperation = 'source-over';

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = fade;
    g.drawImage(lit, 0, 0);
    g.globalAlpha = 1;
  }

  /* A word painted on the road, the right way up for whoever is looking at
   * the screen: along a road that runs across the screen, across one that
   * runs up it. The lights find it and leave it behind like the road. */
  function wordSize(cam) {
    var across = Math.abs(st.f.x) > Math.abs(st.f.y);
    return Math.max(12, Math.min(30, cam.k * (across ? 0.95 : 0.72)));
  }
  function wordLength(text, px) { return text.length * px * 0.86; }

  function drawWords(g, cam, lamp) {
    if (!st.words.length) return;
    var px = wordSize(cam), step = px * 0.86;
    g.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    g.font = '600 ' + px + 'px ' + st.font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    st.words.forEach(function (w) {
      var d = w.s - st.s, a = lightAt(d, lamp) * 0.88 * w.fade;
      if (a < 0.004) return;
      var x = cam.x + st.f.x * cam.k * d, y = cam.y + st.f.y * cam.k * d;
      var x0 = x - (w.text.length - 1) * step / 2;
      for (var i = 0; i < w.text.length; i++) {
        var ch = w.text.charAt(i);
        if (ch === ' ') continue;
        g.globalAlpha = a;
        g.fillStyle = '#ddd6c6';
        g.fillText(ch, x0 + i * step, y);
        g.globalAlpha = a * 0.3;                 // worn paint: a second, rougher coat
        g.fillText(ch, x0 + i * step + 0.7, y + 0.5);
      }
    });
    g.globalAlpha = 1;
  }

  // The beam in front of the car, laid over the road.
  function drawBeam(g, cam, lamp) {
    if (lamp.bright < 0.05) return;
    var C = global.CONFIG, nose = C.carLength / 2, far = lamp.reach * 0.8;
    toRoad(g, cam);
    var grad = g.createLinearGradient(nose, 0, far, 0);
    grad.addColorStop(0, 'rgba(255,244,214,' + 0.1 * lamp.bright + ')');
    grad.addColorStop(1, 'rgba(255,244,214,0)');
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(nose, -0.3);
    g.lineTo(far, -1.5);
    g.lineTo(far, 1.5);
    g.lineTo(nose, 0.3);
    g.closePath();
    g.fill();
    g.globalCompositeOperation = 'source-over';
  }

  function drawCar(g, cam, lamp) {
    var C = global.CONFIG, Cos = global.Cosmetics;
    var L = C.carLength * cam.k, W = C.carWidth * cam.k;
    g.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    g.save();
    g.translate(cam.x, cam.y);
    g.rotate(Math.atan2(st.f.y, st.f.x));
    if (Cos) Cos.drawCar(g, L, W, st.car.skin, st.car.vehicle, 0, st.car.plain);
    else { g.fillStyle = st.car.color; g.fillRect(-L / 2, -W / 2, L, W); }
    var r = Math.max(1, W * 0.1);
    g.fillStyle = 'rgba(255,248,225,' + 0.9 * lamp.bright + ')';
    g.fillRect(L / 2 - r, -W * 0.34 - r / 2, r, r);
    g.fillRect(L / 2 - r, W * 0.34 - r / 2, r, r);
    g.fillStyle = 'rgba(255,40,40,0.55)';
    g.fillRect(-L / 2, -W * 0.34 - r / 2, r, r);
    g.fillRect(-L / 2, W * 0.34 - r / 2, r, r);
    g.restore();
  }

  /* Two lights, and nothing else. Whatever carries them is never drawn:
   * there is nothing there to draw. Far off they are two points; close,
   * they are glare. */
  function drawLights(g, cam) {
    var o = st.other;
    if (!o) return;
    var a = smooth((st.t - o.t0) / 3);
    if (a <= 0) return;
    var p = o.p, k = cam.k;
    var D = lerp(o.D0, NEAR, p);
    var shimmer = 0.97 + 0.03 * Math.sin(st.t * 23.7) * Math.sin(st.t * 7.1);
    var alpha = a * lerp(0.42, 1, p) * shimmer;
    var core = lerp(0.6, 0.2 * k, Math.pow(p, 1.5));
    var glow = lerp(2.6, 1.9 * k, Math.pow(p, 2.2));
    g.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    g.globalCompositeOperation = 'lighter';
    [-LAMP_GAP, LAMP_GAP].forEach(function (lat) {
      var x = cam.x + st.f.x * k * D - st.f.y * k * lat;
      var y = cam.y + st.f.y * k * D + st.f.x * k * lat;
      var halo = g.createRadialGradient(x, y, 0, x, y, glow);
      halo.addColorStop(0, 'rgba(255,255,255,' + 0.55 * alpha + ')');
      halo.addColorStop(0.3, 'rgba(235,240,255,' + 0.16 * alpha + ')');
      halo.addColorStop(1, 'rgba(235,240,255,0)');
      g.fillStyle = halo;
      g.fillRect(x - glow, y - glow, glow * 2, glow * 2);
      g.fillStyle = 'rgba(255,255,255,' + alpha + ')';
      g.beginPath();
      g.arc(x, y, core, 0, Math.PI * 2);
      g.fill();
    });
    g.globalCompositeOperation = 'source-over';
  }

  function draw() {
    var g = el.canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    if (st.phase === 'black') {
      g.fillStyle = st.flash ? (STILL ? '#6a6a6a' : '#fff') : '#000';
      g.fillRect(0, 0, el.canvas.width, el.canvas.height);
      return;
    }
    g.fillStyle = '#000';
    g.fillRect(0, 0, el.canvas.width, el.canvas.height);

    // the Labyrinth, falling away behind - no one else on it any more
    var gone = smooth(st.t / FALL);
    if (gone < 1 && st.board) {
      var b = st.boardRect;
      g.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      g.globalAlpha = 1 - gone;
      g.drawImage(st.board, b.left, b.top, b.width, b.height);
      g.globalAlpha = 1;
    } else st.board = null;

    var cam = camera(), lamp = lamps();
    drawRoad(g, cam, lamp, smooth(st.t / (FALL * 0.8)));
    drawWords(g, cam, lamp);
    drawBeam(g, cam, lamp);
    drawCar(g, cam, lamp);
    drawLights(g, cam);
  }

  /* ---- time -------------------------------------------------------------------- */

  // A layer of the place to `v` over `over` scene seconds.
  function hear(layer, v, over) { if (place) place.set(layer, v, over / Beyond.speed); }

  // Scene time: frames, capped, so a tab in the background holds it still.
  function loop() {
    var n = now(), dt = Math.min(0.1, (n - st.last) / 1000) * Beyond.speed;
    st.last = n;
    advance(dt);
    if (!st) return;                            // it has just finished
    draw();
    raf = global.requestAnimationFrame(loop);
  }

  function once(key, fn) {
    if (st.done[key]) return;
    st.done[key] = true;
    fn();
  }

  function advance(dt) {
    st.t += dt;
    var t = st.t;

    if (st.phase === 'road') {
      // how fast: down from race speed to a crawl the road allows, and then
      // - past the last word - to nothing at all
      if (st.brakeT === null) {
        st.v = lerp(st.v0, CRUISE, smooth(t / SETTLE));
      } else {
        var u = clamp01((t - st.brakeT) / BRAKE);
        st.v = st.vb * (1 - u) * (1 - u);
        if (u >= 1) { st.v = 0; st.stillT = t; st.phase = 'still'; Beyond.phase = 'still'; stopped(); }
      }
      st.s += st.v * dt;

      WORDS.forEach(function (wd, i) {
        if (t >= wd[0]) once('word' + i, function () {
          st.words.push({ text: wd[1], s: st.s + SPAWN, fade: 1 });
        });
      });

      // Past the last word, the car stops answering and slows to a stand -
      // the word a little way in front of it.
      var last = st.words.length === WORDS.length ? st.words[WORDS.length - 1] : null;
      if (last && st.brakeT === null) {
        var cam = camera(), across = Math.abs(st.f.x) > Math.abs(st.f.y);
        var halfLen = across ? wordLength(last.text, wordSize(cam)) / 2 / cam.k : 0.4;
        var brakeRun = st.v * BRAKE / 3;
        if (last.s - st.s <= brakeRun + 2.2 + halfLen) { st.brakeT = t; st.vb = st.v; }
      }

      if (t >= 6) once('deeper', function () {
        hear('rumble', 0.1, 10); hear('drone', 0.04, 10); hear('air', 0.02, 10);
        hear('far', 0.5, 10); hear('cries', 0.15, 8);
      });
      if (t >= 15) once('deeper still', function () {
        hear('rumble', 0.16, 10); hear('drone', 0.065, 10); hear('air', 0.03, 10);
        hear('far', 0.7, 10); hear('cries', 0.28, 10);
      });
      return;
    }

    if (st.phase === 'still') {
      var u2 = t - st.stillT;
      if (u2 >= 6) once('lights', function () {
        var cam2 = camera();
        st.other = { t0: t, p: 0, D0: Math.max(10, room(cam2, 1) - 1.2) };
      });
      if (u2 >= 12) once('approach', function () {
        hear('rumble', 0.15, APPROACH); hear('drone', 0.085, APPROACH);
        hear('far', 0.45, APPROACH); hear('cries', 0.26, APPROACH); hear('whine', 0.011, APPROACH);
      });
      if (st.other && u2 >= 12) {
        // slowly, and then not at all for a moment, and then again
        var e = u2 - 12;
        st.other.p = e < 11 ? 0.38 * smooth(e / 11)
                   : e < 14 ? 0.38
                   : 0.38 + 0.62 * smooth((e - 14) / (APPROACH - 14));
      }
      if (u2 >= 12 + APPROACH + 0.4) {         // close enough. Not closer.
        st.phase = 'black';
        Beyond.phase = 'black';
        st.cutT = t;
        st.other = null;
        if (place) { place.stop(0); place = null; }
      }
      return;
    }

    if (st.phase === 'black') {
      var c = t - st.cutT;
      if (c >= 1.4) once('scream', function () { st.flash = true; global.Sound.play('scream'); });
      if (c >= 1.54) st.flash = false;
      if (c >= 3.95) once('word', function () {
        el.word.textContent = 'It’s…';
        el.word.style.transitionDuration = 1.8 / Beyond.speed + 's';
        void el.word.offsetHeight;
        el.word.classList.add('show');
      });
      if (c >= 3.95 + 1.8 + 2.6) once('unword', function () {
        el.word.style.transitionDuration = 1.6 / Beyond.speed + 's';
        el.word.classList.remove('show');
      });
      if (c >= 3.95 + 1.8 + 2.6 + 1.6 + 1.6) finish();
    }
  }

  // Stopped: quieter, and worse.
  function stopped() {
    hear('rumble', 0.035, 3); hear('air', 0.004, 3); hear('drone', 0.03, 3);
    hear('far', 0.2, 3); hear('cries', 0.1, 4); hear('whine', 0.0045, 6);
  }

  /* ---- the sequence --------------------------------------------------------- */

  function touch(node, prop) {
    for (var i = 0; i < saved.length; i++) if (saved[i].node === node && saved[i].prop === prop) return;
    saved.push({ node: node, prop: prop, value: node.style[prop] });
  }
  function restoreAll() {
    for (var i = saved.length - 1; i >= 0; i--) saved[i].node.style[saved[i].prop] = saved[i].value;
    saved = [];
  }

  // The empty circuit as it was a moment ago: every car and spark left off.
  function emptyBoard(game) {
    var R = global.Renderer, c = R.canvas;
    var cars = game.cars, parts = game.particles, ghost = game.ghostPose;
    var copy = document.createElement('canvas');
    copy.width = c.width;
    copy.height = c.height;
    try {
      game.cars = []; game.particles = []; game.ghostPose = null;
      R.draw(game);
      copy.getContext('2d').drawImage(c, 0, 0);
    } catch (e) {
      copy = null;
    } finally {
      game.cars = cars; game.particles = parts; game.ghostPose = ghost;
    }
    return copy;
  }

  function begin(game) {
    var P = game.player, R = global.Renderer, T = global.TRACK, C = global.CONFIG;
    var Cos = global.Cosmetics, Sound = global.Sound;
    Beyond.active = true;
    Beyond.phase = 'road';
    runFrom = null;

    // Where it went through, on the screen, which way is on from there, and
    // how big a cell was: the road starts exactly there.
    var p0 = R.trackToClient(P.x, P.y), p1 = R.trackToClient(P.x, P.y - 1);
    var fx = p1.x - p0.x, fy = p1.y - p0.y, k0 = Math.hypot(fx, fy) || 16;
    var th = T.theme || {};
    st = {
      t: 0, last: now(), phase: 'road', done: {},
      p0: p0, f: { x: fx / k0, y: fy / k0 }, k0: k0,
      board: emptyBoard(game), boardRect: R.canvas.getBoundingClientRect(),
      v0: P.speed, v: P.speed, vb: 0, s: 0, brakeT: null, stillT: null, cutT: 0,
      words: [], other: null, flash: false,
      car: {
        skin: Cos ? Cos.equippedSkin() : null, vehicle: Cos ? Cos.equippedVehicle() : null,
        plain: C.contrastColors() ? P.color : null, color: P.color
      },
      colors: {
        road: th.road ? shade(th.road, 1.9) : '#2a241e',
        grid: th.roadLine ? shade(th.roadLine, 1.7) : '#3a3129',
        edge: 'rgba(214,190,150,0.35)',
        line: th.racingLine || 'rgba(255,214,150,0.26)'
      },
      font: (global.getComputedStyle(document.body).fontFamily) || 'monospace',
      lit: document.createElement('canvas'),
      w: 0, h: 0, dpr: 1
    };

    // The race is over without ever having finished: reset, no results,
    // nothing written. The race screen stops drawing behind the black.
    global.Screens.current = 'secret';
    game.state = 'secret';
    game.reset();
    game.state = 'menu';
    global.Input.clear();

    el.root = $('secret');
    el.canvas = $('secret-view');
    el.word = $('beyond-word');
    touch(el.root, 'transitionDuration');
    touch(el.canvas, 'transitionDuration');
    el.root.style.transitionDuration = '0s';
    el.canvas.style.transitionDuration = '0s';
    size();
    draw();                                   // the first frame before the layer shows
    el.root.classList.add('on', 'show');
    el.canvas.classList.add('show');
    onResize = function () { size(); };
    global.addEventListener('resize', onResize);
    raf = global.requestAnimationFrame(loop);

    // The Labyrinth's music goes behind a wall and away; the place comes up.
    Sound.muffle(330, 3 / Beyond.speed);
    Sound.music(null, 0, 7 / Beyond.speed);
    place = Sound.place('beyond');
    hear('rumble', 0.05, 6); hear('drone', 0.02, 8); hear('air', 0.01, 6); hear('far', 0.25, 10);
  }

  // A colour, lit: each channel times `k`.
  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16);
    var ch = function (v) { return Math.min(255, Math.round(v * k)); };
    return 'rgb(' + ch((n >> 16) & 255) + ',' + ch((n >> 8) & 255) + ',' + ch(n & 255) + ')';
  }

  // Back to the front door as if nothing happened, and nothing left running.
  function finish() {
    if (raf) global.cancelAnimationFrame(raf);
    raf = 0;
    if (onResize) global.removeEventListener('resize', onResize);
    onResize = null;
    if (place) { place.stop(0); place = null; }
    global.Sound.muffle(0);
    el.word.classList.remove('show');
    el.word.textContent = '';
    var g = el.canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, el.canvas.width, el.canvas.height);
    el.canvas.classList.remove('show');
    el.root.classList.remove('show', 'on');   // at once: nothing happened
    restoreAll();
    el.word.style.transitionDuration = '';
    st = null;
    runFrom = null;
    Beyond.active = false;
    Beyond.phase = null;
    global.Game.state = 'menu';
    global.Screens.show('main');               // menu music, menu input, menu backdrop
    global.Input.clear();
  }

  // Scene seconds so far, or null. For the tests.
  Beyond._now = function () { return st ? st.t : null; };

  global.Beyond = Beyond;
})(typeof window !== 'undefined' ? window : globalThis);
