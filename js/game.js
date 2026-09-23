/* Block Racer - race loop, rules and HUD. */
(function (global) {
  'use strict';

  var C = global.CONFIG;
  var T = global.TRACK;
  var Car = global.Car;
  var AIDriver = global.AIDriver;
  var Input = global.Input;
  var Sound = global.Sound;
  var Renderer = global.Renderer;

  /* The opponents, in the order they are drawn on, and you. Every colour has
   * to read on black tarmac and on white, which rules out anything too dark
   * or too pale at either end. */
  var FIELD = [
    { name: 'VECTOR', color: '#ff5470' },
    { name: 'PIXEL',  color: '#ffd166' },
    { name: 'YOU',    color: '#5ef2ff', player: true },
    { name: 'GRID',   color: '#b47cff' },
    { name: 'RASTER', color: '#4ade80' },
    { name: 'SPRITE', color: '#f97316' },
    { name: 'VERTEX', color: '#38bdf8' },
    { name: 'SHADER', color: '#e879f9' },
    { name: 'KERNEL', color: '#a3e635' },
    { name: 'BUFFER', color: '#fb7185' },
    { name: 'SCALAR', color: '#2dd4bf' },
    { name: 'CIPHER', color: '#c084fc' },
    { name: 'PHOTON', color: '#facc15' },
    { name: 'LATTICE', color: '#60a5fa' },
    { name: 'QUANTUM', color: '#fb923c' },
    { name: 'NEUTRON', color: '#34d399' }
  ];

  /* You start at the back. T.gridFor hands its slots back front-to-back, so
   * the field is the opponents in their usual order with YOU appended: last
   * index, last slot, last row - whether that is a field of two or of
   * sixteen, and on every track, because nothing here knows or cares what
   * shape the grid it is being poured into has.
   *
   * Starting third of four was a hangover from the field being a fixed list
   * with YOU sitting in the middle of it. Racing from the back means the
   * race has somewhere to go. */
  var PLAYER_CAR = FIELD.filter(function (c) { return c.player; })[0];
  var OPPONENTS = FIELD.filter(function (c) { return !c.player; });

  /* ---- keeping your colour yours --------------------------------------
   *
   * A skin you picked is no use if an opponent is wearing it, or wearing
   * something you cannot tell from it at thirty pixels while both of you are
   * moving. So the field is recoloured around whatever you have equipped.
   *
   * The distance is CIE Lab rather than RGB, because RGB thinks #4ade80 and
   * #34d399 are a long way apart and your eye does not - it puts them at 19,
   * which is about the gap between two greens you would mix up in a corner.
   * Measured against the shipped field: its own closest pair is 7 (GRID and
   * CIPHER, which really are near-identical purples) and the median gap to a
   * nearest neighbour is 19.
   *
   * SELF is therefore well above that at 32: nothing may sit inside "same
   * sort of colour" of you. PEER is lower, at 15, and applies only to the
   * cars that had to move - an opponent the player's colour does not touch
   * keeps exactly the colour it shipped with, so a stock skin leaves most of
   * the grid alone and the one thing that changes is the thing that had to.
   */
  var SELF_GAP = 32;
  var PEER_GAP = 15;

  function srgbLin(c) {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function toLab(hex) {
    var h = hex.charAt(0) === '#' ? hex.slice(1) : hex;
    var r = srgbLin(parseInt(h.substr(0, 2), 16) / 255);
    var g = srgbLin(parseInt(h.substr(2, 2), 16) / 255);
    var b = srgbLin(parseInt(h.substr(4, 2), 16) / 255);
    var x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    var y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    var z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    function f(t) { return t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116; }
    x = f(x); y = f(y); z = f(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }

  function gap(a, b) {
    var p = toLab(a), q = toLab(b);
    return Math.sqrt((p[0] - q[0]) * (p[0] - q[0]) +
                     (p[1] - q[1]) * (p[1] - q[1]) +
                     (p[2] - q[2]) * (p[2] - q[2]));
  }

  /* Rotate a colour round the hue wheel, keeping how bright and how saturated
   * it is. That is what makes a moved car still look like it belongs to this
   * field rather than like a colour from somewhere else. */
  function spin(hex, deg) {
    var h = hex.charAt(0) === '#' ? hex.slice(1) : hex;
    var r = parseInt(h.substr(0, 2), 16) / 255;
    var g = parseInt(h.substr(2, 2), 16) / 255;
    var b = parseInt(h.substr(4, 2), 16) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    var l = (mx + mn) / 2;
    var sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    var hue = 0;
    if (d !== 0) {
      if (mx === r) hue = ((g - b) / d) % 6;
      else if (mx === g) hue = (b - r) / d + 2;
      else hue = (r - g) / d + 4;
      hue *= 60;
    }
    hue = ((hue + deg) % 360 + 360) % 360;
    var c = (1 - Math.abs(2 * l - 1)) * sat, x2 = c * (1 - Math.abs((hue / 60) % 2 - 1));
    var m = l - c / 2, rr, gg, bb;
    if (hue < 60) { rr = c; gg = x2; bb = 0; }
    else if (hue < 120) { rr = x2; gg = c; bb = 0; }
    else if (hue < 180) { rr = 0; gg = c; bb = x2; }
    else if (hue < 240) { rr = 0; gg = x2; bb = c; }
    else if (hue < 300) { rr = x2; gg = 0; bb = c; }
    else { rr = c; gg = 0; bb = x2; }
    function hx(v) {
      var n = Math.round((v + m) * 255);
      n = n < 0 ? 0 : n > 255 ? 255 : n;
      return (n < 16 ? '0' : '') + n.toString(16);
    }
    return '#' + hx(rr) + hx(gg) + hx(bb);
  }

  /* The opponents' colours for a field of `n`, given the colour you are
   * wearing. Anything already clear of you is left exactly as it shipped;
   * anything too close is spun round the wheel to the first angle that clears
   * both you and every car already placed. If nothing in a half-turn works -
   * which takes a very crowded field - the best of the candidates is used, so
   * this always returns a full grid and never fails to start a race. */
  function paletteFor(n, mine) {
    var count = Math.min(n, OPPONENTS.length);
    var out = new Array(count), taken = [], move = [], i, j, k;

    /* Pass one places everything that does NOT have to move, and it has to
     * come first: a car spun away from you must clear the whole rest of the
     * grid, not just the part of it that happened to be placed already.
     * Checking only what came before let two greens land 3 apart. */
    for (i = 0; i < count; i++) {
      var base = OPPONENTS[i].color;
      if (gap(base, mine) >= SELF_GAP) { out[i] = base; taken.push(base); }
      else move.push(i);
    }

    for (k = 0; k < move.length; k++) {
      i = move[k];
      var from = OPPONENTS[i].color, pick = from, best = null, bestScore = -1;
      for (var step = 1; step <= 12 && !best; step++) {
        var tries = [spin(from, step * 15), spin(from, -step * 15)];
        for (var t = 0; t < tries.length; t++) {
          var cand = tries[t], mineGap = gap(cand, mine), peer = 1e9;
          for (j = 0; j < taken.length; j++) peer = Math.min(peer, gap(cand, taken[j]));
          var score = Math.min(mineGap / SELF_GAP, peer / PEER_GAP);
          if (score > bestScore) { bestScore = score; pick = cand; }
          if (mineGap >= SELF_GAP && peer >= PEER_GAP) { best = cand; break; }
        }
      }
      if (best) pick = best;
      out[i] = pick;
      taken.push(pick);
    }
    return out;
  }

  /* Which grid slot the player takes: the back row, and the middle of it.
   * Starting last is the point of the rule; starting last AND hard against
   * a kerb is a second penalty nobody asked for, and on a six-lane grid the
   * outside lane is measurably the worst place to be.
   *
   * The field is still built with the player LAST, so everything that reads
   * `cars` in order - the countdown standings especially - still has them
   * at the back. Only which piece of tarmac they get is permuted. */
  /* How much clear road a slot has straight in front of it.
   *
   * The player is the one car on the grid that nobody is steering at lights
   * out: the opponents are already aiming at the racing line, but the player
   * holds whatever heading the grid gave them until they press something. So
   * a slot with a chicane block four cells in front of it is a slot that
   * crashes them before they have done anything wrong. */
  function clearRun(slot) {
    var d = T.startDir;
    var hx = d.x !== 0 ? C.carLength / 2 : C.carWidth / 2;
    var hy = d.x !== 0 ? C.carWidth / 2 : C.carLength / 2;
    var run = 0;
    while (run < 24) {
      var x = slot.x + d.x * (run + 0.25), y = slot.y + d.y * (run + 0.25);
      if (T.boxHitsWall(x - hx, y - hy, x + hx, y + hy)) break;
      run += 0.25;
    }
    return run;
  }

  /* Which of the grid's slots the player gets: the back row, then the most
   * road ahead, then the middle.
   *
   * Order matters. Asking for the middle first is what produced the bug this
   * replaces - on Pipeworks the central back-row slot had 4.7 cells in front
   * of it and the one beside it had 37.7, so "the middle" meant driving into
   * a gate at lights out. Slots within a car length of the best are treated
   * as tied, so on a clear straight - which is most of them - this still
   * comes out as the middle of the road. */
  function playerSlot(grid) {
    var d = T.startDir;
    var lon = function (s) { return s.x * d.x + s.y * d.y; };
    var lat = function (s) { return s.x * -d.y + s.y * d.x; };
    var back = Infinity, lo = Infinity, hi = -Infinity, i, L;
    for (i = 0; i < grid.length; i++) {
      if (lon(grid[i]) < back) back = lon(grid[i]);
      L = lat(grid[i]);
      if (L < lo) lo = L;
      if (L > hi) hi = L;
    }
    // the middle of the whole grid's WIDTH, not of the back row alone: a
    // back row holding one car would otherwise call that car central
    var mid = (lo + hi) / 2;

    var row = [], runs = [], most = 0;
    for (i = 0; i < grid.length; i++) {
      if (lon(grid[i]) > back + 0.01) continue;
      var r = clearRun(grid[i]);
      row.push(i);
      runs.push(r);
      if (r > most) most = r;
    }
    if (!row.length) return grid.length - 1;

    var best = row[0], bd = Infinity;
    for (i = 0; i < row.length; i++) {
      if (runs[i] < most - C.carLength) continue;
      var dd = Math.abs(lat(grid[row[i]]) - mid);
      if (dd < bd) { bd = dd; best = row[i]; }
    }
    return best;
  }


  function fieldFor(n) {
    var Cos = global.Cosmetics;
    var mine = Cos ? Cos.equippedSkin().color : PLAYER_CAR.color;
    /* The opponents keep their NAMES whatever happens - VECTOR is VECTOR and
     * the results table has to go on saying so. Only the paint moves. */
    var palette = paletteFor(n - 1, mine);
    var spec = [];
    for (var i = 0; i < n - 1 && i < OPPONENTS.length; i++) {
      spec.push({ name: OPPONENTS[i].name, color: palette[i], player: false });
    }
    /* The player's colour comes from the equipped skin, so the halo, the
     * running-order chip and the results all follow the skin without any of
     * them having to know that skins exist. The default skin is the colour
     * the car has always been. */
    spec.push({ name: PLAYER_CAR.name, color: mine, player: true });
    return spec;
  }

  var Game = {
    state: 'menu',
    /* 'race' or 'trial'. Picked between PLAY and the track carousel. A trial
     * is the same car on the same track with the field taken away: no
     * opponents, so no positions, so no medals - only the clock. */
    mode: 'race',
    cars: [],
    drivers: [],
    player: null,
    particles: [],
    time: 0,
    countdown: 0,
    laps: C.laps,
    trackIndex: C.track,
    results: []
  };

  var el = {};

  /* Signed, with a real minus sign: -0.38 ahead, +0.52 behind. */
  function fmtDelta(d, places) {
    var s = Math.abs(d).toFixed(places) + 's';
    if (Math.abs(d) < 0.5 * Math.pow(10, -places)) return s;
    return (d < 0 ? '\u2212' : '+') + s;
  }

  /* A lap to the thousandth, which at 120 physics steps a second is real
   * precision rather than noise: 23.481s, or 1:03.481 past a minute. */
  function fmt3(t) {
    if (t < 60) return t.toFixed(3) + 's';
    var m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3);
  }

  function fmt(t) {
    if (!t && t !== 0) return '--:--.--';
    var m = Math.floor(t / 60);
    var s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  }

  Game.reset = function () {
    this.cars = [];
    this.drivers = [];
    this.particles = [];
    this.time = 0;
    this.results = [];
    this.countdown = C.countdown;

    // The track grids as many as its road holds, which on a tight circuit is
    // fewer than the menu asked for; the field is cut to whatever fit. A
    // trial ignores the number entirely and takes the front slot.
    var trial = this.mode === 'trial';
    this.lapRecord = trial ? global.Progress.lapRecord(T.data.id, C.speedLevel) : 0;
    this.newRecord = false;
    var grid = T.gridFor(trial ? 1 : C.cars);
    var field = fieldFor(trial ? 1 : grid.length);
    this.gridSize = field.length;

    /* Slot order: the AI take theirs as laid out, and the player - last in
     * the field - takes the middle of the back row rather than whatever was
     * left over at the end of it. */
    var slots = [], pSlot = field.length > 1 ? playerSlot(grid.slice(0, field.length)) : 0;
    for (var k = 0; k < field.length; k++) if (k !== pSlot) slots.push(k);
    slots.push(pSlot);

    var aiIndex = 0;
    for (var i = 0; i < field.length; i++) {
      var slot = grid[slots[i]];
      var spec = field[i];
      var cfg = spec.player ? null : C.aiSpec(aiIndex++, field.length - 1);
      var car = new Car({
        id: i,
        name: spec.name,
        color: spec.color,
        isPlayer: !!spec.player,
        speedMul: (cfg ? cfg.speedMul * T.aiPace : 1) * C.speedMul(),
        x: slot.x,
        y: slot.y,
        dir: { x: T.startDir.x, y: T.startDir.y }
      });
      T.seedProgress(car);
      this.cars.push(car);
      if (spec.player) this.player = car;
      else this.drivers.push(new AIDriver(car, {
        mistake: cfg.mistake * T.aiMistakeScale,
        reaction: cfg.reaction,
        offset: cfg.offset * T.aiOffsetScale
      }, slot.wp));
    }
    Input.clear();
    this.state = 'countdown';
    this.updateStandings();

    /* A trial's ghost: the record lap for this track and speed, if one was
     * driven since ghosts existed, and a recorder for the lap you are about
     * to drive in case it turns out to be the next one. Loaded after the
     * grid, so the recorder's first sample is the car on its slot. */
    this.ghost = null;
    this.ghostPose = null;
    this.ghostRec = null;
    this.delta = null;
    this.pbFlash = null;
    this.beaten = 0;
    if (trial && global.Ghost) {
      this.ghost = global.Ghost.load(T.data, C.speedLevel, this.lapRecord);
      this.ghostRec = new global.Ghost.Recorder();
      this.ghostRec.start(this.player);
      if (this.ghost) this.ghostPose = global.Ghost.poseAt(this.ghost, 0);
    }
  };

  function spawnSparks(game, at, color, count) {
    for (var i = 0; i < (count || 12); i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 1.5 + Math.random() * 4;
      game.particles.push({
        x: at.x, y: at.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.4,
        color: Math.random() < 0.5 ? '#ffd166' : color
      });
    }
  }

  /* Tyre marks under a sliding car, dropped at its back corners and left on
   * the road to fade. They are what makes the slide readable at a glance. */
  function layRubber(game, car) {
    if (!car.sliding() || car.crashed || Math.random() > 0.3) return;
    var a = car.bodyAngle();
    var cos = Math.cos(a), sin = Math.sin(a);
    var back = -C.carLength * 0.45;
    for (var side = -1; side <= 1; side += 2) {
      var off = side * C.carWidth * 0.4;
      game.particles.push({
        x: car.x + back * cos - off * sin,
        y: car.y + back * sin + off * cos,
        vx: 0, vy: 0, life: 0.8, color: '#000', mark: true
      });
    }
  }

  function updateCarRace(game, car) {
    var lapped = false, newBest = false;
    if (T.lapCheck(car)) {
      car.lap++;
      car.lastLap = car.lapTime;
      if (!car.bestLap || car.lapTime < car.bestLap) car.bestLap = car.lapTime;
      // Kept for the time-trial result, which lists the laps rather than the
      // finishing order there is none of.
      car.lapTimes.push(car.lapTime);
      // A trial banks a record the moment it is set, rather than at the end:
      // quitting a trial half way through should not throw away the fastest
      // lap you have ever driven on the track.
      if (game.mode === 'trial' && car.isPlayer) {
        var was = game.lapRecord;
        if (global.Progress.recordLap(T.data.id, C.speedLevel, car.lastLap)) {
          game.lapRecord = car.lastLap;
          game.newRecord = true;
          // the gain is against the record this lap BEAT - which, two records
          // into one session, is the one set a few laps ago, not this morning's
          game.pbFlash = { time: car.lastLap, gain: was ? car.lastLap - was : null,
                           until: game.time + 2.6 };
          game.beaten = was || 0;
          newBest = true;
        }
      }
      lapped = true;
      car.lapTime = 0;
      if (car.lap >= game.laps) {
        car.finished = true;
        car.finishTime = game.time;
        game.results.push(car);
        if (car.isPlayer) Sound.finish();
      } else if (car.isPlayer) {
        Sound.lap();
      }
    }
    if (car.isPlayer && game.ghostRec) traceLap(game, car, lapped, newBest);
  }

  /* Feed the recorder, and when a lap closes decide what it was.
   *
   * The lap's last sample is the car at the moment it crossed, stamped with
   * the lap's own time, so the ghost crosses the line at exactly the time the
   * record says. If that lap set a record it becomes the ghost - saved over
   * the old one and swapped in straight away, so the very next lap is chased
   * by it. Whatever it was, the next lap starts recording from the same spot. */
  function traceLap(game, car, lapped, newBest) {
    var rec = game.ghostRec;
    if (!lapped) {
      if (!car.finished) rec.push(car, car.lapTime);
      return;
    }
    rec.push(car, car.lastLap);
    if (newBest) {
      var stored = rec.finish(car.lastLap, T.data);
      if (stored) {
        global.Ghost.save(T.data, C.speedLevel, stored);
        game.ghost = global.Ghost.decode(stored);
      }
    }
    if (!car.finished) rec.start(car);
  }

  /* Where the ghost is and how far ahead or behind you are, for this step.
   *
   * The ghost runs on YOUR lap clock - it starts when your lap starts, so a
   * lap you begin two seconds late is still raced side by side from the line.
   * The delta is taken at equal distance round the lap, not at equal time:
   * how long the record lap took to get as far as you have got, against how
   * long you took. Comparing your clock with the record's final time instead
   * says nothing until the line, and comparing positions at equal times
   * cannot be turned into seconds at all. */
  Game.updateGhost = function () {
    var p = this.player, g = this.ghost;
    if (!g || p.finished) { this.ghostPose = null; this.delta = null; return; }
    this.ghostPose = global.Ghost.poseAt(g, p.lapTime);
    var tg = global.Ghost.timeAtProgress(g, this.ghostRec.progress);
    this.delta = tg === null ? null : p.lapTime - tg;
  };

  Game.updateStandings = function () {
    var laps = this.laps;
    this.cars.forEach(function (car) {
      var p = T.progressAlong(car.x, car.y, car.dir, car.leg, car.arc);
      car.leg = p.leg;
      car.arc = p.arc;
      car.progress = car.finished
        ? laps + 1000 - car.finishTime / 100000
        : car.lap + T.lapFraction(p.arc);
    });
    /* On the grid the running order IS the grid order. It cannot be read off
     * progressAlong there: that projects a car onto the racing line, the line
     * is arcing through a corner where the back rows sit on most tracks, and
     * the projection of a row of cars sitting perfectly level then differs by
     * up to a couple of cells from lane to lane. Taken literally it puts you
     * seventh of eight while you are sitting on the last slot of the grid.
     * Nothing has moved yet, so there is nothing to measure. */
    var order = this.state === 'countdown'
      ? this.cars.slice()            // pushed in grid order, front to back
      : this.cars.slice().sort(function (a, b) { return b.progress - a.progress; });
    order.forEach(function (car, i) { car.place = i + 1; });
    this.order = order;
  };

  Game.step = function (dt) {
    if (this.state === 'countdown') {
      this.countdown -= dt;
      var n = Math.ceil(this.countdown);
      if (n !== this._lastBeep) {
        this._lastBeep = n;
        if (n > 0) Sound.beep(); else Sound.go();
      }
      if (this.countdown <= -0.6) { this.state = 'racing'; Input.clear(); }
      return;
    }
    if (this.state !== 'racing') return;

    this.time += dt;

    // Player controls: a turn is the only input, and it also restarts a car
    // that is sitting against a wall.
    var turn;
    while ((turn = Input.take()) !== 0) {
      if (!this.player.finished) this.player.turn(turn);
    }

    for (var i = 0; i < this.drivers.length; i++) this.drivers[i].update(dt);

    for (var j = 0; j < this.cars.length; j++) {
      var car = this.cars[j];
      if (!car.finished) car.lapTime += dt;
      var hit = car.step(dt);
      if (hit && hit.crashed) {
        spawnSparks(this, hit, car.color);
        if (car.isPlayer) Sound.crash();
      } else if (hit && Math.random() < 0.3) {
        // A scrape throws a few sparks every so often rather than a shower,
        // otherwise a car running down a wall fountains.
        spawnSparks(this, hit, car.color, 2);
      }
      layRubber(this, car);
    }
    Car.separate(this.cars, dt);
    for (var n = 0; n < this.cars.length; n++) updateCarRace(this, this.cars[n]);

    for (var k = this.particles.length - 1; k >= 0; k--) {
      var p = this.particles[k];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.90; p.vy *= 0.90;
      p.life -= dt * 1.6;
      if (p.life <= 0) this.particles.splice(k, 1);
    }

    this.updateStandings();
    if (this.ghostRec) this.updateGhost();

    var allDone = this.cars.every(function (c) { return c.finished; });
    if (this.player.finished || allDone) {
      this.state = 'finished';
      this.showResults();
    }
  };

  /* ---- UI ----------------------------------------------------------- */

  Game.buildHud = function () {
    var stamps = document.querySelectorAll('.version-stamp');
    Array.prototype.forEach.call(stamps, function (stamp) {
      if (!global.BR) return;
      stamp.textContent = 'v' + global.BR.version;
      stamp.title = 'built ' + global.BR.built;
    });
    el.track = document.getElementById('hud-track');
    el.speed = document.getElementById('hud-speed');
    el.slide = document.getElementById('hud-slide');
    el.lap = document.getElementById('hud-lap');
    el.pos = document.getElementById('hud-pos');
    el.time = document.getElementById('hud-time');
    el.best = document.getElementById('hud-best');
    el.last = document.getElementById('hud-last');
    el.standings = document.getElementById('standings');
    el.msg = document.getElementById('message');
    el.board = document.getElementById('board');
    el.results = document.getElementById('results');
    el.resultsBody = document.getElementById('results-body');
    el.resultsTitle = document.getElementById('results-title');
    el.resultsNote = document.getElementById('results-note');
    el.btnNext = document.getElementById('btn-next');
    el.pause = document.getElementById('pause');
    el.lapButtons = document.getElementById('lap-buttons');
    el.speedButtons = document.getElementById('speed-buttons');
    el.roadButtons = document.getElementById('road-buttons');
    el.slideRange = document.getElementById('slide-range');
    el.slideRange.max = C.maxSlide;   // one place decides how far it goes
    el.carsRange = document.getElementById('cars-range');
    el.carsRange.min = C.minCars;
    el.carsRange.max = C.maxCars;
    el.aiRange = document.getElementById('ai-range');
    el.aiRange.min = C.minAiLevel;
    el.aiRange.max = C.maxAiLevel;
    el.glowButtons = document.getElementById('glow-buttons');
    el.contrastButtons = document.getElementById('contrast-buttons');
    el.steerRange = document.getElementById('oversteer-range');
    el.steerRange.min = C.minOversteer;   // one place decides how far it goes
    el.steerRange.max = C.maxOversteer;
    el.record = document.getElementById('hud-record');
    el.delta = document.getElementById('hud-delta');
    el.pbFlash = document.getElementById('pb-flash');
    el.resultsRow = el.btnNext ? el.btnNext.parentNode : null;
    el.resultsHead = document.getElementById('results-head');
    el.btnAgain = document.getElementById('btn-again');
    el.timeLabel = document.getElementById('hud-time-label');
  };

  Game.drawHud = function () {
    var p = this.player;
    el.track.textContent = T.name;
    el.speed.textContent = C.speedName();
    el.slide.textContent = C.slide.toFixed(2);
    el.lap.textContent = Math.min(p.lap + 1, this.laps) + ' / ' + this.laps;
    el.time.textContent = fmt(this.time);
    el.best.textContent = p.bestLap ? fmt(p.bestLap) : '--:--.--';
    el.last.textContent = p.lastLap ? fmt(p.lastLap) : '--:--.--';

    if (this.state === 'racing' && p.crashed) {
      // The long form does not fit across a phone-sized board, and on a phone
      // you are tapping rather than pressing anything anyway.
      el.msg.textContent = el.board.clientWidth < 430
        ? 'CRASHED - TAP LEFT OR RIGHT'
        : 'CRASHED - press LEFT or RIGHT to turn and go';
      el.msg.classList.add('show');
    } else {
      el.msg.classList.remove('show');
    }

    // A trial has no opponents, so it has no position and no running order.
    // Those two rows are hidden by the body class rather than filled with a
    // meaningless '1 / 1'; the standing record takes their place.
    if (this.mode === 'trial') {
      el.record.textContent = this.lapRecord ? fmt(this.lapRecord) : '--:--.--';
      el.standings.innerHTML = '';

      // A dash when there is nothing honest to say: no ghost, the countdown,
      // or a stretch of lap the record lap never covered.
      var d = this.state === 'racing' ? this.delta : null;
      el.delta.textContent = d === null ? '--' : fmtDelta(d, 2);
      el.delta.className = d === null ? '' : d <= -0.005 ? 'ahead' : d >= 0.005 ? 'behind' : '';

      var f = this.pbFlash;
      var on = !!(f && this.state === 'racing' && this.time < f.until);
      if (on && el.pbFlash._for !== f) {
        el.pbFlash._for = f;
        el.pbFlash.innerHTML = '<b>NEW BEST!</b><span class="pb-time">' + fmt3(f.time) + '</span>' +
          (f.gain !== null ? '<span class="pb-gain">' + fmtDelta(f.gain, 3) + '</span>' : '');
      }
      el.pbFlash.classList.toggle('show', on);
      return;
    }

    el.pos.textContent = p.place + ' / ' + this.cars.length;

    var rows = '';
    this.order.forEach(function (car, i) {
      rows += '<li' + (car.isPlayer ? ' class="me"' : '') + '>' +
        '<span class="pos">' + (i + 1) + '</span>' +
        '<span class="chip" style="background:' + car.color + '"></span>' +
        '<span class="nm">' + car.name + '</span>' +
        '<span class="lp">' + (car.finished ? 'FIN' : 'L' + Math.min(car.lap + 1, Game.laps)) + '</span>' +
        '</li>';
    });
    el.standings.innerHTML = rows;
    // Past eight the leaderboard is taller than the HUD and starts to scroll,
    // which is no use mid-race; the rows close up instead.
    el.standings.classList.toggle('dense', this.cars.length > 8);

  };

  /* Which button is the big one. A race is a ladder, so the next rung is
   * the natural thing to press; a trial is the same track again, chasing the
   * same ghost, so RACE AGAIN is. NEXT TRACK stays - just not highlighted -
   * and the highlighted one always sits at the end of the row. */
  Game.setResultsPrimary = function (trial) {
    var main = trial ? el.btnAgain : el.btnNext;
    var other = trial ? el.btnNext : el.btnAgain;
    main.classList.add('primary'); main.classList.remove('secondary');
    other.classList.add('secondary'); other.classList.remove('primary');
    if (el.resultsRow) el.resultsRow.appendChild(main);
  };

  Game.showResults = function () {
    if (this.mode === 'trial') return this.showTrialResults();
    this.setResultsPrimary(false);

    el.resultsHead.innerHTML =
      '<tr><th>#</th><th>Driver</th><th>Time</th><th>Best lap</th></tr>';

    var finished = this.results.slice();
    var rest = this.order.filter(function (c) { return !c.finished; });
    var all = finished.concat(rest);
    var placeOfPlayer = all.indexOf(this.player) + 1;

    // A podium is kept for good. Progress.record only writes an improvement,
    // so finishing fourth after a win does not take the win away.
    //
    // What the shop had unlocked is read either side of it: the difference is
    // what THIS race unlocked, and nothing else can produce one.
    var Cos = global.Cosmetics;
    var before = Cos ? Cos.snapshot() : null;
    var won = global.Progress.record(T.data.id, placeOfPlayer);

    el.resultsTitle.textContent =
      placeOfPlayer === 1 ? 'YOU WIN' : 'P' + placeOfPlayer + ' OF ' + all.length;
    el.resultsTitle.className = placeOfPlayer <= 3 ? 'podium p' + placeOfPlayer : '';
    el.resultsNote.textContent = won
      ? (placeOfPlayer === 1 ? 'GOLD' : placeOfPlayer === 2 ? 'SILVER' : 'BRONZE') +
        ' \u2013 a new best on ' + T.name
      : '';

    var rows = '';
    all.forEach(function (car, i) {
      rows += '<tr' + (car.isPlayer ? ' class="me"' : '') + '>' +
        '<td>' + (i + 1) + '</td>' +
        '<td><span class="chip" style="background:' + car.color + '"></span>' + car.name + '</td>' +
        '<td>' + (car.finished ? fmt(car.finishTime) : 'L' + (car.lap + 1)) + '</td>' +
        '<td>' + (car.bestLap ? fmt(car.bestLap) : '-') + '</td>' +
        '</tr>';
    });
    el.resultsBody.innerHTML = rows;
    el.resultsBody.parentNode.classList.toggle('dense', all.length > 8);
    this.showNextButton();
    el.results.classList.add('show');
    if (before && global.Unlocks) global.Unlocks.show(Cos.unlockedSince(before));
  };

  /* A trial has no finishing order to show, so the table lists the laps
   * instead - which is the thing you actually drove for. No medal is written
   * and Progress.record is never called: a medal is a race result, and one
   * car finishing first out of one is not one. */
  Game.showTrialResults = function () {
    var p = this.player;
    var record = this.lapRecord;

    el.resultsTitle.textContent = this.newRecord ? 'NEW BEST!' : 'TIME TRIAL';
    el.resultsTitle.className = this.newRecord ? 'podium p1' : '';
    /* A new best shows the time and what it took off the PREVIOUS best - the
     * record it actually replaced. Two records in one run means lap 4 is
     * measured against lap 2, which is the gap you just closed; a first ever
     * record has nothing to improve on and says so instead of showing a gain. */
    if (p.bestLap && this.newRecord) {
      var before = this.beaten;
      el.resultsNote.innerHTML =
        '<span class="pb-time">' + fmt3(p.bestLap) + '</span>' +
        (before
          ? '<span class="pb-gain">' + fmtDelta(p.bestLap - before, 3) + '</span>' +
            '<span class="pb-was">was ' + fmt3(before) + '</span>'
          : '<span class="pb-was">first record on ' + T.name + '</span>');
    } else {
      el.resultsNote.textContent = p.bestLap
        ? 'BEST THIS RUN ' + fmt(p.bestLap) + (record ? '  \u00b7  RECORD ' + fmt(record) : '')
        : 'No lap completed';
    }

    el.resultsHead.innerHTML = '<tr><th>Lap</th><th>Time</th><th></th></tr>';

    // Only the FIRST lap at the best time is marked, or two identical laps
    // both claim it and the row stops meaning "this is the one".
    var bestAt = p.lapTimes.indexOf(p.bestLap);
    var rows = '';
    var newBest = this.newRecord;
    p.lapTimes.forEach(function (t, i) {
      var isBest = i === bestAt;
      rows += '<tr' + (isBest ? ' class="me"' : '') + '>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + fmt(t) + '</td>' +
        '<td>' + (isBest ? (newBest ? 'NEW BEST' : 'BEST') : '') + '</td>' +
        '</tr>';
    });
    if (!rows) rows = '<tr><td colspan="3">\u2013</td></tr>';
    el.resultsBody.innerHTML = rows;
    el.resultsBody.parentNode.classList.toggle('dense', p.lapTimes.length > 8);

    this.showNextButton();
    this.setResultsPrimary(true);
    el.results.classList.add('show');
  };

  Game.showNextButton = function () {
    var next = global.Screens.nextTrack();
    el.btnNext.style.display = next === null ? 'none' : '';
    if (next !== null) el.btnNext.textContent = global.TRACKS[next].name + ' \u2192';
  };

  /* Race or time trial. Chosen between PLAY and the track carousel, and read
   * by reset, the HUD and the results; nothing else in here branches on it.
   * The body class is what hides the position row and the running order, so
   * the HUD does not have to rebuild itself every frame to stay honest. */
  Game.setMode = function (mode) {
    this.mode = mode === 'trial' ? 'trial' : 'race';
    document.body.classList.toggle('mode-trial', this.mode === 'trial');
    el.btnAgain.textContent = this.mode === 'trial' ? 'TRY AGAIN' : 'RACE AGAIN';
    el.timeLabel.textContent = this.mode === 'trial' ? 'TOTAL TIME' : 'RACE TIME';
    this.reset();
    this.state = 'menu';
  };

  /* How well the opponents drive. Takes effect on the next race, because a
   * driver's profile is fixed when the field is built - which reset does. */
  Game.setAiLevel = function (n) {
    C.aiLevel = C.clampAiLevel(n);
    C.saveAiLevel();
    document.getElementById('menu-ai').textContent = C.aiLevel;
    document.getElementById('menu-ai-name').textContent = C.aiLevelName();
    if (parseInt(el.aiRange.value, 10) !== C.aiLevel) el.aiRange.value = C.aiLevel;
    this.reset();
    this.state = 'menu';
  };

  Game.setTrack = function (index) {
    this.trackIndex = index;
    T.load(index);
    Renderer.setTrack();
    // A different track grids a different number, so the field label is stale
    // the moment the track changes. setCars resets and re-enters the menu.
    this.setCars(C.cars);
  };

  /* The turn radius, live. Every car reads CONFIG.slide each step - player and
   * AI alike - so this takes effect immediately, mid-race included. The only
   * thing that needs redoing is the baked scenery, because the racing line is
   * drawn with the corners rounded off by exactly this radius. */
  Game.setSlide = function (cells) {
    var v = Math.max(0, Math.min(C.maxSlide, cells));
    C.slide = v;

    document.getElementById('menu-slide').textContent = v.toFixed(2);
    document.getElementById('menu-slide-cw').textContent =
      v === 0 ? '(instant turns)' : '(' + (v / C.carWidth).toFixed(2) + ' car widths)';
    if (parseFloat(el.slideRange.value) !== v) el.slideRange.value = v;

    Renderer.setTrack();
  };

  /* The oversteer pose, live and cosmetic. Every car reads CONFIG the next
   * time its pose is updated, so dragging this mid-race turns the whole field
   * as you drag. Nothing is rebaked and nothing is reset, because the lean is
   * added when a car is drawn and never written back: this cannot move a car,
   * change what it hits or change a lap time. */
  Game.setOversteer = function (deg) {
    C.oversteer = C.clampOversteer(deg);
    C.saveOversteer();
    document.getElementById('menu-oversteer').textContent = C.oversteer;
    document.getElementById('menu-oversteer-note').textContent =
      C.oversteer === 0 ? '(body follows its travel)'
      : C.oversteer === 90 ? '(fully sideways)' : '';
    if (parseInt(el.steerRange.value, 10) !== C.oversteer) {
      el.steerRange.value = C.oversteer;
    }
  };

  /* The halo under your own car. Cosmetic and live: nothing reads it but
   * the car painter, so it takes effect on the very next frame and there is
   * nothing to rebake and nothing to reset. */
  /* Turning this on changes what every solid is painted, so the track has to
   * be baked again - the same thing the road swatches do, for the same
   * reason. The thumbnails are rebuilt when the play screen is next shown. */
  Game.setContrast = function (on) {
    C.contrast = !!on;
    C.saveContrast();
    Array.prototype.forEach.call(el.contrastButtons.children, function (b) {
      b.classList.toggle('on', (b.dataset.contrast === '1') === C.contrast);
    });
    document.getElementById('menu-contrast').textContent = C.contrast ? 'ON' : 'OFF';
    global.Renderer.setTrack();
  };

  Game.setPlayerGlow = function (on) {
    C.playerGlow = !!on;
    C.savePlayerGlow();
    Array.prototype.forEach.call(el.glowButtons.children, function (b) {
      b.classList.toggle('on', (b.dataset.glow === '1') === C.playerGlow);
    });
    document.getElementById('menu-glow').textContent = C.playerGlow ? 'ON' : 'OFF';
  };

  Game.setSpeed = function (level) {
    C.speedLevel = level;
    Array.prototype.forEach.call(el.speedButtons.children, function (b) {
      b.classList.toggle('on', parseInt(b.dataset.speed, 10) === level);
    });
    document.getElementById('menu-speed').textContent = C.speedName();
    this.reset();
    this.state = 'menu';
  };

  /* How many cars line up, you included. The number is a ceiling: a track
   * grids as many as its road holds and the label says so when it holds
   * fewer, rather than quietly racing a smaller field than was asked for. */
  Game.setCars = function (n) {
    C.cars = Math.max(C.minCars, Math.min(C.maxCars, n));
    var fits = T.gridFor(C.cars).length;
    document.getElementById('menu-cars').textContent = fits;
    document.getElementById('menu-cars-note').textContent =
      fits < C.cars ? '(all ' + T.name + ' will grid)' : '';
    if (parseInt(el.carsRange.value, 10) !== C.cars) el.carsRange.value = C.cars;
    this.reset();
    this.state = 'menu';
  };

  /* Cosmetic only - nothing here is read by the physics, the AI or the
   * collision grid. The baked scenery has to be redone because the road and
   * its grid are painted into it, and that is the whole of the work. */
  Game.setRoad = function (index) {
    C.roadTint = Math.max(0, Math.min(C.roadTints.length - 1, index));
    Array.prototype.forEach.call(el.roadButtons.children, function (b) {
      b.classList.toggle('on', parseInt(b.dataset.road, 10) === C.roadTint);
    });
    document.getElementById('menu-road').textContent = C.roadName();
    Renderer.setTrack();
  };

  Game.setLaps = function (n) {
    this.laps = Math.max(C.minLaps, Math.min(C.maxLaps, n));
    Array.prototype.forEach.call(el.lapButtons.children, function (b) {
      b.classList.toggle('on', parseInt(b.dataset.laps, 10) === Game.laps);
    });
    document.getElementById('menu-laps').textContent = this.laps;
  };

  /* Out of the race and back to wherever it was started from - the track
   * carousel, or the legacy list on the options screen. Without this the only
   * way out of the results screen is another race at the same settings. */
  Game.leaveRace = function () {
    el.results.classList.remove('show');
    el.pause.classList.remove('show');
    this.reset();
    this.state = 'menu';
    global.Screens.show(global.Screens.from);
  };

  Game.pauseRace = function () {
    if (this.state !== 'racing') return;
    this.state = 'paused';
    el.pause.classList.add('show');
  };

  Game.resumeRace = function () {
    if (this.state !== 'paused') return;
    this.state = 'racing';
    el.pause.classList.remove('show');
    Input.clear();
  };

  Game.startRace = function () {
    el.results.classList.remove('show');
    el.pause.classList.remove('show');
    global.Screens.show('race');
    Sound.unlock();
    this.reset();
  };

  Game.command = function (name) {
    // Everything here is a race control. On a menu screen the keys belong to
    // the screen, not to a race that is not running.
    var racing = global.Screens.current === 'race';
    if (name === 'start') {
      if (racing && this.state === 'finished') this.startRace();
      else if (racing && this.state === 'paused') this.command('pause');
    } else if (name === 'restart') {
      if (racing) this.startRace();
    } else if (name === 'menu') {
      if (racing) { if (this.state === 'racing') this.pauseRace(); }
      else if (global.Screens.current !== 'main') global.Screens.show('main');
    } else if (name === 'pause') {
      if (!racing) return;
      if (this.state === 'racing') this.pauseRace();
      else if (this.state === 'paused') this.resumeRace();
    } else if (name === 'slide+' || name === 'slide-') {
      this.setSlide(C.slide + (name === 'slide+' ? 0.05 : -0.05));
    } else if (name === 'mute') {
      Sound.muted = !Sound.muted;
      document.getElementById('mute-state').textContent = Sound.muted ? 'OFF' : 'ON';
    }
  };

  /* ---- boot ---------------------------------------------------------- */

  Game.boot = function () {
    Renderer.init(document.getElementById('game'));
    global.Backdrop.init(document.getElementById('backdrop'));
    this.buildHud();
    global.Screens.init();
    this.setLaps(C.laps);
    this.setSlide(C.slide);
    this.setOversteer(C.oversteer);
    this.setPlayerGlow(C.playerGlow);
    this.setContrast(C.contrast);
    this.setSpeed(C.speedLevel);
    this.setRoad(C.roadTint);
    this.setAiLevel(C.aiLevel);
    this.setMode('race');
    this.setTrack(C.track);   // also sets the field, which depends on the track
    if (C.deepLink) {
      global.Screens.from = global.Screens.homeFor(C.track);
      this.startRace();
    } else {
      global.Screens.show('main');
    }

    Input.onCommand = function (n) { Game.command(n); };

    Array.prototype.forEach.call(el.lapButtons.children, function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        Game.setLaps(parseInt(b.dataset.laps, 10));
      });
    });
    el.slideRange.addEventListener('input', function (e) {
      e.stopPropagation();
      Game.setSlide(parseFloat(el.slideRange.value));
    });
    el.steerRange.addEventListener('input', function (e) {
      e.stopPropagation();
      Game.setOversteer(parseInt(el.steerRange.value, 10));
    });
    el.carsRange.addEventListener('input', function (e) {
      e.stopPropagation();
      Game.setCars(parseInt(el.carsRange.value, 10));
    });
    el.aiRange.addEventListener('input', function (e) {
      e.stopPropagation();
      Game.setAiLevel(parseInt(el.aiRange.value, 10));
    });
    Array.prototype.forEach.call(el.speedButtons.children, function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        Game.setSpeed(parseInt(b.dataset.speed, 10));
      });
    });
    Array.prototype.forEach.call(el.glowButtons.children, function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        Game.setPlayerGlow(b.dataset.glow === '1');
      });
    });
    Array.prototype.forEach.call(el.contrastButtons.children, function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        Game.setContrast(b.dataset.contrast === '1');
      });
    });
    Array.prototype.forEach.call(el.roadButtons.children, function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        Game.setRoad(parseInt(b.dataset.road, 10));
      });
    });
    document.getElementById('btn-again').addEventListener('click', function (e) {
      e.stopPropagation();
      Game.startRace();
    });
    document.getElementById('btn-quit').addEventListener('click', function (e) {
      e.stopPropagation();
      Game.leaveRace();
    });
    document.getElementById('btn-next').addEventListener('click', function (e) {
      e.stopPropagation();
      var next = global.Screens.nextTrack();
      if (next !== null) global.Screens.race(next);
    });
    document.getElementById('btn-home').addEventListener('click', function (e) {
      e.stopPropagation();
      Game.pauseRace();
    });
    document.getElementById('btn-pause-go').addEventListener('click', function (e) {
      e.stopPropagation();
      Game.resumeRace();
    });
    document.getElementById('btn-pause-home').addEventListener('click', function (e) {
      e.stopPropagation();
      el.pause.classList.remove('show');
      Game.reset();
      Game.state = 'menu';
      global.Screens.show('main');
    });

    var acc = 0, last = performance.now(), clock = 0;
    function frame(now) {
      var delta = Math.min((now - last) / 1000, C.maxFrame);
      last = now;
      clock += delta;
      requestAnimationFrame(frame);

      // On a menu screen the board is hidden behind the scenery, so neither
      // the physics nor the track is worth a frame: paint the landscape and
      // stop there.
      if (global.Screens.current !== 'race') {
        acc = 0;
        global.Backdrop.draw(clock);
        return;
      }
      acc += delta;
      while (acc >= C.dt) { Game.step(C.dt); acc -= C.dt; }
      Renderer.draw(Game);
      Game.drawHud();
    }
    requestAnimationFrame(frame);
  };

  global.Game = Game;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { Game.boot(); });
  } else {
    Game.boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
