/* Block Racer - the tutorial.
 *
 * Two laps of the TRAINING track (js/tracks.js), driven with the real car, the
 * real physics and the real controls. Nothing here moves a car. What the
 * lesson does is decide when the race may move on - Game.step asks it first,
 * every step - and what the card over the board says.
 *
 *   1. The first corner, a left, up into the other lane. The car is held
 *      exactly where a sliding car should turn - the same point the AI turns
 *      at - until you give the input that takes it round. The wrong one is
 *      refused, and says so.
 *   2. The second, a RIGHT, straight again, the same way: every turn is a
 *      quarter turn, either way.
 *   3. The third corner is yours: a marker on the road shows where to turn,
 *      because the car slides and has to be turned early. Crash, and the card
 *      says how to get going again.
 *   4. The rest of the lap on your own, with the markers, then the line.
 *   5. NOW FOR A REAL LAP: held at the line for a count of three, then one
 *      lap at race speed - SWEAT, unless the game speed says otherwise - with
 *      no markers and no help. Finishing that is finishing the tutorial.
 *
 * Until the car reaches the first two corners, turns are ignored, so a
 * nervous first tap cannot put a new player into a wall before the lesson
 * has said a word. After that, every input is live.
 *
 * It is never a race: no opponents, one lap, no results, and Progress,
 * Ghost and the shop are never told about it (Game.showResults hands a
 * finished tutorial here instead). The teaching lap runs at BEGINNER speed;
 * the point a car should turn at is the same at every speed, because the
 * slide radius is, so what it teaches holds on the real lap. */
(function (global) {
  'use strict';

  var C = global.CONFIG;
  var T = global.TRACK;
  var Input = global.Input;

  var TAUGHT = 2;            // corners held for the right input
  var REAL_TITLE = 1.6;      // seconds of NOW FOR A REAL LAP before the count
  var REAL_BEAT = 0.8;       // each of 3, 2, 1
  var SEEN_KEY = 'blockracer.tutorial.v1';
  var seenThisSession = false;

  var Tutorial = {};

  /* ---- the first-launch prompt ------------------------------------------ */

  Tutorial.seen = function () {
    if (seenThisSession) return true;
    try { return !!(global.localStorage && global.localStorage.getItem(SEEN_KEY)); } catch (e) { return false; }
  };
  Tutorial.markSeen = function () {
    seenThisSession = true;
    try { if (global.localStorage) global.localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* blocked */ }
  };
  /* Only on a first ever launch: never seen, and nothing saved at all - so
   * the people already playing when the tutorial arrived are not asked. A
   * link straight into a race is not a launch into the menus. ?welcome=1
   * shows it regardless. */
  Tutorial.shouldWelcome = function () {
    if (C.welcome) return true;
    return !C.deepLink && !C.returning && !Tutorial.seen();
  };

  Tutorial.trackIndex = function () {
    for (var i = 0; i < global.TRACKS.length; i++) if (global.TRACKS[i].tutorial) return i;
    return -1;
  };

  /* ---- words --------------------------------------------------------- */

  var NAME = { '0,-1': 'UP', '0,1': 'DOWN', '-1,0': 'LEFT', '1,0': 'RIGHT' };
  var ARROW = { '0,-1': '↑', '0,1': '↓', '-1,0': '←', '1,0': '→' };
  function key(d) { return d.x + ',' + d.y; }

  // A track direction as the screen shows it: the board can be turned.
  function screen(d) { return global.Renderer ? global.Renderer.toScreen(d) : d; }

  // The input that makes turn `sign`, which faces the car along `dir`.
  function prompt(sign, dir) {
    var how = Input.how();
    dir = screen(dir);
    if (how === 'swipe') return 'SWIPE ' + NAME[key(dir)] + ' ' + ARROW[key(dir)];
    if (how === 'auto') return 'TAP TO TURN';
    if (how === 'tap') return sign > 0 ? 'TAP RIGHT' : 'TAP LEFT';
    return sign > 0 ? 'PRESS →' : 'PRESS ←';
  }

  // Any input that turns a car stopped facing `dir`.
  function anyTurn(dir) {
    var how = Input.how();
    dir = screen(dir);
    if (how === 'swipe') return dir.x !== 0 ? 'Swipe up or down' : 'Swipe left or right';
    if (how === 'auto') return 'Tap';
    if (how === 'tap') return 'Tap either side';
    return 'Press ← or →';
  }

  // The second line under a held corner.
  function holdHint(k, sign) {
    var how = Input.how();
    var side = sign > 0 ? 'right' : 'left';
    if (how === 'auto') {
      return k === 0 ? 'Tap anywhere - it picks the way'
                     : 'You choose when, it chooses which way';
    }
    if (k === 0) {
      return how === 'swipe' ? 'Swipe the way you want to go'
           : how === 'tap' ? 'Tap the ' + side + ' side of the screen'
           : 'Turn ' + side + ' to take the corner';
    }
    return how === 'swipe' ? 'Every turn is a quarter turn'
         : how === 'tap' ? 'Each side turns its own way'
         : '← turns left, → turns right';
  }

  /* ---- the lesson -------------------------------------------------------- */

  function Lesson(game) {
    var n = T.ROUTE.length, start = T.data.startLeg;
    this.game = game;
    this.corners = [];                 // waypoint indices, in the order met
    for (var i = 1; i <= n; i++) this.corners.push((start + i) % n);
    this.k = 0;                        // corners behind you
    this.hold = false;
    this.need = 0;                     // the turn a held corner is waiting for
    this.released = [];                // held corners already let go
    this.crashedAt = [];               // corners you crashed on the way round
    this.flash = null;                 // { big, small, until }
    this.wrongUntil = 0;
    this.shown = '';
    this.real = false;                 // on the full-speed lap
    this.waited = -1;                  // seconds held at the line before it
  }

  function now() { return global.performance ? performance.now() : Date.now(); }

  // How far before the corner a sliding car turns: AIDriver.turnLead, for
  // the line itself.
  function lead(wp) {
    if (C.slide <= 0) return 0;
    var n = T.ROUTE.length;
    return Math.min(C.slide, T.LEG_LEN[(wp - 1 + n) % n] * 0.45, T.LEG_LEN[wp] * 0.45);
  }

  // Where the turn for corner `wp` goes, along the leg into it.
  function turnPoint(wp) {
    var n = T.ROUTE.length;
    var d = T.LEG_DIR[(wp - 1 + n) % n], p = T.ROUTE[wp];
    var horiz = d.x !== 0, s = horiz ? d.x : d.y;
    return { d: d, horiz: horiz, s: s, at: (horiz ? p.x : p.y) - s * lead(wp) };
  }

  function sameDir(a, b) { return a.x === b.x && a.y === b.y; }

  Lesson.prototype.say = function (big, small, ms) {
    this.flash = { big: big, small: small, until: now() + (ms || 800) };
  };

  // Count the corners the car has got round, from the leg it is on.
  Lesson.prototype.progress = function () {
    var P = this.game.player, n = this.corners.length;
    if (P.crashed && this.k < n) this.crashedAt[this.k] = true;
    if (this.k >= n) return;
    // Legs from the start one: leg ord leaves corner ord - 1. Off the racing
    // line - after a crash, say - the leg can be read a corner late, so any
    // step forward counts, not just the next one; only the last corner wraps
    // round to 0.
    var ord = (P.leg - T.data.startLeg + n) % n;
    var reached = ord === 0 ? (this.k === n - 1 ? n : 0) : ord;
    if (reached <= this.k) return;
    if (!this.real && this.k <= TAUGHT && reached > TAUGHT) {
      global.Sound.play('select');
      this.say(this.crashedAt[TAUGHT] ? 'GOT IT' : 'PERFECT!', 'That is the whole trick');
    }
    this.k = reached;
  };

  /* Called by Game.step before anything moves. True means this step is
   * held: nothing moves and the clock does not run. */
  Lesson.prototype.gate = function (dt) {
    var game = this.game, P = game.player;

    /* Over the line after the teaching lap: hold, say what is next, count
     * it in, and let it go at race speed. Timed in steps, not by the clock,
     * so pausing in the middle of it pauses the count too. */
    if (!this.real && P.lap >= 1) {
      Input.turns.length = 0;
      if (this.waited < 0) this.waited = 0;
      var before = this.count();
      this.waited += dt;
      var n = this.count();
      if (n !== before && n > 0) global.Sound.play('count');
      if (n > 0) return true;
      this.real = true;
      this.k = 0;
      P.speed = C.speed * C.speedMul();   // what the car would be built with
      global.Sound.play('go');
      this.say('GO!', 'One lap. Full speed.', 800);
      return false;
    }

    this.progress();
    if (this.real) return false;

    if (this.hold) {
      while (Input.turns.length) {
        var s = Input.resolve(Input.turns.shift(), P.dir, P);
        if (s === this.need) {
          this.hold = false;
          this.wrongUntil = 0;           // not carried to the next corner
          this.released[this.k] = true;
          game.playerTurn(s);
          this.say('NICE!', '', 700);
          return false;
        }
        this.wrongUntil = now() + 900;   // wrong way, straight on, or back
      }
      return true;
    }

    if (this.k >= TAUGHT) return false;

    // On the way to a taught corner, input waits for the lesson.
    Input.turns.length = 0;
    if (this.released[this.k]) return false;
    var wp = this.corners[this.k], tp = turnPoint(wp);
    if (P.crashed || !sameDir(P.dir, tp.d)) return false;
    var pos = tp.horiz ? P.x : P.y;
    if (tp.s * (pos - tp.at) < 0) return false;
    // There: put the car exactly on the point - it is at most one step past
    // it - and wait for the turn that takes it round.
    if (tp.horiz) P.x = tp.at; else P.y = tp.at;
    P.unstick();
    this.hold = true;
    this.need = tp.d.x * T.LEG_DIR[wp].y - tp.d.y * T.LEG_DIR[wp].x;
    global.Sound.play('step', 1);
    return true;
  };

  // 3, 2, 1 once the title has been up long enough; 4 before that.
  Lesson.prototype.count = function () {
    if (this.waited < REAL_TITLE) return 4;
    return Math.max(0, 3 - Math.floor((this.waited - REAL_TITLE) / REAL_BEAT));
  };

  // The speed the car is on, for the panel.
  Lesson.prototype.speedName = function () {
    return this.real ? C.speedName() : C.speedLevels[0].name;
  };

  // The card over the board, for this frame. Written only when it changes.
  Lesson.prototype.text = function () {
    var game = this.game, P = game.player, n = this.corners.length, k = this.k;
    var t = now();
    if (game.state === 'countdown') return ['TRAINING', 'Your car drives itself. You steer.', ''];
    if (this.waited >= 0 && !this.real) {
      var c = this.count();
      return ['NOW FOR A REAL LAP', c > 3 ? 'Full speed. No markers.' : 'Starting in ' + c, 'go'];
    }
    if (this.hold) {
      var wp = this.corners[k];
      return [prompt(this.need, T.LEG_DIR[wp]),
              t < this.wrongUntil ? 'Not that way!' : holdHint(k, this.need),
              t < this.wrongUntil ? 'wrong' : 'go'];
    }
    if (this.flash && t < this.flash.until) return [this.flash.big, this.flash.small, 'good'];
    if (P.crashed) return ['CRASHED', anyTurn(P.dir) + ' to get going', 'wrong'];
    if (this.real) {
      return k < n ? ['REAL LAP', 'Get round and cross the line', ''] : ['CROSS THE LINE', 'Finish it', ''];
    }
    if (k < TAUGHT) return ['TRAINING', 'Your car drives itself. You steer.', ''];
    if (k === TAUGHT) return ['TURN AT THE MARKER', 'The car slides, so turn early', ''];
    if (k < n) return ['FINISH THE LAP', 'Turn at each marker', ''];
    return ['CROSS THE LINE', 'That is a lap', ''];
  };

  /* What the renderer draws on the road: a band across it at the turn point
   * of the next corner you take yourself. */
  Lesson.prototype.marks = function () {
    if (this.real || this.k < TAUGHT || this.k >= this.corners.length) return null;
    var wp = this.corners[this.k], tp = turnPoint(wp), p = T.ROUTE[wp];
    // Across the whole road, wall to wall, however wide it is and wherever
    // in it the racing line runs. Measured half way along the straight in,
    // not at the turn point: that is in the corner, where the road being
    // turned into is open and there is no wall to stop at.
    var n = T.ROUTE.length, q = T.ROUTE[(wp - 1 + n) % n];
    var at = Math.floor(tp.horiz ? (p.x + q.x) / 2 : (p.y + q.y) / 2);
    var from = tp.horiz ? p.y : p.x;
    var wall = function (c) { return tp.horiz ? T.isWall(at, c) : T.isWall(c, at); };
    var lo = Math.floor(from), hi = lo;
    while (!wall(lo - 1)) lo--;
    while (!wall(hi + 1)) hi++;
    return tp.horiz
      ? { x0: tp.at - 0.3, x1: tp.at + 0.3, y0: lo, y1: hi + 1, d: T.LEG_DIR[wp] }
      : { x0: lo, x1: hi + 1, y0: tp.at - 0.3, y1: tp.at + 0.3, d: T.LEG_DIR[wp] };
  };

  /* ---- the page ---------------------------------------------------------- */

  var el = {};
  function $(id) { return document.getElementById(id); }

  Tutorial.init = function () {
    el.card = $('tutor');
    el.big = $('tutor-big');
    el.small = $('tutor-small');
    el.done = $('tutor-done');
    el.welcome = $('welcome');
    $('btn-welcome-play').addEventListener('click', function (e) {
      e.stopPropagation();
      Tutorial.markSeen();
      el.welcome.classList.remove('show');
      Tutorial.start();
    });
    $('btn-welcome-skip').addEventListener('click', function (e) {
      e.stopPropagation();
      Tutorial.markSeen();
      el.welcome.classList.remove('show');
    });
    $('btn-tutor-done').addEventListener('click', function (e) {
      e.stopPropagation();
      Tutorial.startRacing();
    });
    $('btn-tutorial').addEventListener('click', function (e) {
      e.stopPropagation();
      Tutorial.start();
    });
  };

  Tutorial.welcome = function () { el.welcome.classList.add('show'); };

  Tutorial.start = function () { global.Game.startTutorial(); };

  /* START RACING: straight to the tracks, in RACE mode - the tutorial's
   * last word is that you are ready, so the button goes where racing is. */
  Tutorial.startRacing = function () {
    el.done.classList.remove('show');
    var game = global.Game;
    game.endTutorial();
    game.setMode('race');
    global.Screens.progress = false;
    global.Screens.show('play');
  };

  // A new lesson for a race that is about to start.
  Tutorial.begin = function (game) {
    el.done.classList.remove('show');
    el.card.hidden = false;
    return new Lesson(game);
  };

  Tutorial.draw = function (lesson) {
    var tx = lesson.text(), sig = tx.join('|');
    if (sig === lesson.shown) return;
    lesson.shown = sig;
    el.big.textContent = tx[0];
    el.small.textContent = tx[1];
    el.card.className = 'tutor' + (tx[2] ? ' ' + tx[2] : '');
  };

  Tutorial.complete = function () {
    el.card.hidden = true;
    el.done.classList.add('show');
  };

  Tutorial.hide = function () {
    if (!el.card) return;
    el.card.hidden = true;
    el.done.classList.remove('show');
  };

  Tutorial.doneShowing = function () { return !!el.done && el.done.classList.contains('show'); };

  global.Tutorial = Tutorial;
})(typeof window !== 'undefined' ? window : globalThis);
