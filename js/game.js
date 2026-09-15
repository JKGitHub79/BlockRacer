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

  var FIELD = [
    { name: 'VECTOR', color: '#ff5470' },
    { name: 'PIXEL',  color: '#ffd166' },
    { name: 'YOU',    color: '#5ef2ff', player: true },
    { name: 'GRID',   color: '#b47cff' }
  ];

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

    var aiIndex = 0;
    for (var i = 0; i < FIELD.length; i++) {
      var slot = T.START_GRID[i];
      var spec = FIELD[i];
      var cfg = spec.player ? null : C.ai[aiIndex++ % C.ai.length];
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
    var stamp = document.getElementById('version');
    if (stamp && global.BR) {
      stamp.textContent = 'v' + global.BR.version;
      stamp.title = 'built ' + global.BR.built;
    }
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
    el.menu = document.getElementById('menu');
    el.results = document.getElementById('results');
    el.resultsBody = document.getElementById('results-body');
    el.resultsTitle = document.getElementById('results-title');
    el.pause = document.getElementById('pause');
    el.lapButtons = document.getElementById('lap-buttons');
    el.trackButtons = document.getElementById('track-buttons');
    el.speedButtons = document.getElementById('speed-buttons');
    el.slideRange = document.getElementById('slide-range');
    el.slideRange.max = C.maxSlide;   // one place decides how far it goes
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

    el.resultsTitle.textContent =
      placeOfPlayer === 1 ? 'YOU WIN' : 'P' + placeOfPlayer + ' OF ' + all.length;

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
    el.results.classList.add('show');
  };

  Game.setTrack = function (index) {
    this.trackIndex = index;
    T.load(index);
    Renderer.setTrack();
    Array.prototype.forEach.call(el.trackButtons.children, function (b) {
      b.classList.toggle('on', parseInt(b.dataset.track, 10) === index);
    });
    document.getElementById('menu-track').textContent = T.name;
    document.getElementById('menu-grade').textContent = T.data.grade;
    document.getElementById('menu-blurb').textContent = T.data.blurb;
    this.reset();
    this.state = 'menu';
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
    el.slideRange.addEventListener('input', function (e) {
      e.stopPropagation();
      Game.setSlide(parseFloat(el.slideRange.value));
    });
    Array.prototype.forEach.call(el.speedButtons.children, function (b) {
      b.classList.toggle('on', parseInt(b.dataset.speed, 10) === level);
    });
    document.getElementById('menu-speed').textContent = C.speedName();
    this.reset();
    this.state = 'menu';
  };

  Game.setLaps = function (n) {
    this.laps = Math.max(C.minLaps, Math.min(C.maxLaps, n));
    Array.prototype.forEach.call(el.lapButtons.children, function (b) {
      b.classList.toggle('on', parseInt(b.dataset.laps, 10) === Game.laps);
    });
    document.getElementById('menu-laps').textContent = this.laps;
  };

  /* Back to the start menu. Without this the only way out of the results
   * screen is another race at the same settings, so changing track, speed or
   * race length meant reloading the page. */
  Game.openMenu = function () {
    el.results.classList.remove('show');
    el.pause.classList.remove('show');
    this.reset();
    this.state = 'menu';
    el.menu.classList.add('show');
    Input.clear();
  };

  Game.startRace = function () {
    el.menu.classList.remove('show');
    el.results.classList.remove('show');
    el.pause.classList.remove('show');
    Sound.unlock();
    this.reset();
  };

  Game.command = function (name) {
    if (name === 'start') {
      if (this.state === 'menu' || this.state === 'finished') this.startRace();
      else if (this.state === 'paused') this.command('pause');
    } else if (name === 'restart') {
      if (this.state !== 'menu') this.startRace();
    } else if (name === 'menu') {
      if (this.state !== 'menu') this.openMenu();
    } else if (name === 'pause') {
      if (this.state === 'racing') {
        this.state = 'paused';
        el.pause.classList.add('show');
      } else if (this.state === 'paused') {
        this.state = 'racing';
        el.pause.classList.remove('show');
        Input.clear();
      }
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
    this.buildHud();
    this.setLaps(C.laps);
    this.setSlide(C.slide);
    this.setSpeed(C.speedLevel);
    this.setTrack(C.track);
    el.menu.classList.add('show');

    Input.onCommand = function (n) { Game.command(n); };

    Array.prototype.forEach.call(el.lapButtons.children, function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        Game.setLaps(parseInt(b.dataset.laps, 10));
      });
    });
    Array.prototype.forEach.call(el.trackButtons.children, function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        Game.setTrack(parseInt(b.dataset.track, 10));
      });
    });
    el.slideRange.addEventListener('input', function (e) {
      e.stopPropagation();
      Game.setSlide(parseFloat(el.slideRange.value));
    });
    Array.prototype.forEach.call(el.speedButtons.children, function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        Game.setSpeed(parseInt(b.dataset.speed, 10));
      });
    });
    document.getElementById('btn-start').addEventListener('click', function (e) {
      e.stopPropagation();
      Game.startRace();
    });
    document.getElementById('btn-again').addEventListener('click', function (e) {
      e.stopPropagation();
      Game.startRace();
    });
    document.getElementById('btn-menu').addEventListener('click', function (e) {
      e.stopPropagation();
      Game.openMenu();
    });

    var acc = 0, last = performance.now();
    function frame(now) {
      var delta = Math.min((now - last) / 1000, C.maxFrame);
      last = now;
      acc += delta;
      while (acc >= C.dt) { Game.step(C.dt); acc -= C.dt; }
      Renderer.draw(Game);
      Game.drawHud();
      requestAnimationFrame(frame);
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
