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

  /* The first four are the field as it has always been, in the order it has
   * always been, so a default race is unchanged. The rest are only drawn on
   * when the start menu asks for a bigger one. Every colour has to read on
   * black tarmac and on white, which rules out anything too dark or too pale
   * at either end. */
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

  /* The player keeps third on the grid, as in the default four, unless the
   * field is smaller than that. */
  function fieldFor(n) {
    var spec = FIELD.slice(0, n).map(function (car) {
      return { name: car.name, color: car.color, player: false };
    });
    spec[Math.min(2, n - 1)].player = true;
    return spec;
  }

  var Game = {
    state: 'menu',
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
    // fewer than the menu asked for; the field is cut to whatever fit.
    var grid = T.gridFor(C.cars);
    var field = fieldFor(grid.length);
    this.gridSize = grid.length;

    var aiIndex = 0;
    for (var i = 0; i < field.length; i++) {
      var slot = grid[i];
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
    if (T.lapCheck(car)) {
      car.lap++;
      car.lastLap = car.lapTime;
      if (!car.bestLap || car.lapTime < car.bestLap) car.bestLap = car.lapTime;
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
  }

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
    var order = this.cars.slice().sort(function (a, b) { return b.progress - a.progress; });
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
  };

  Game.drawHud = function () {
    var p = this.player;
    el.track.textContent = T.name;
    el.speed.textContent = C.speedName();
    el.slide.textContent = C.slide.toFixed(2);
    el.lap.textContent = Math.min(p.lap + 1, this.laps) + ' / ' + this.laps;
    el.pos.textContent = p.place + ' / ' + this.cars.length;
    el.time.textContent = fmt(this.time);
    el.best.textContent = p.bestLap ? fmt(p.bestLap) : '--:--.--';
    el.last.textContent = p.lastLap ? fmt(p.lastLap) : '--:--.--';

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
  };

  Game.showResults = function () {
    var finished = this.results.slice();
    var rest = this.order.filter(function (c) { return !c.finished; });
    var all = finished.concat(rest);
    var placeOfPlayer = all.indexOf(this.player) + 1;

    // A podium is kept for good. Progress.record only writes an improvement,
    // so finishing fourth after a win does not take the win away.
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
    var next = global.Screens.nextTrack();
    el.btnNext.style.display = next === null ? 'none' : '';
    if (next !== null) el.btnNext.textContent = global.TRACKS[next].name + ' \u2192';
    el.results.classList.add('show');
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
    this.setSpeed(C.speedLevel);
    this.setRoad(C.roadTint);
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
    el.carsRange.addEventListener('input', function (e) {
      e.stopPropagation();
      Game.setCars(parseInt(el.carsRange.value, 10));
    });
    Array.prototype.forEach.call(el.speedButtons.children, function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        Game.setSpeed(parseInt(b.dataset.speed, 10));
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
