/* Block Racer - something over the Alien tracks. Deliberately undocumented
 * anywhere a player looks: no menu, no README section, no counter, no unlock.
 *
 * The saucer that crosses the three Alien tracks is scenery, and stays
 * scenery - it is drawn exactly as it always was and nothing about it looks
 * pressable. But a press that lands on it (Renderer.ufoHit, which works out
 * where it was from the same clock it is drawn from, through the board's
 * quarter turn when it has one) starts this.
 *
 * One press is enough with a mouse, or with a finger in Swipe mode, where a
 * tap does not steer. In Tap and Auto Turn a tap on the board IS a turn and
 * players make dozens of them a race, some of which would land on a saucer
 * that crosses the board every few seconds; there it takes two presses on
 * the same pass, which nobody does by accident.
 *
 * The listeners exist only while an Alien race is on the screen (sync(),
 * called by Game.reset and Screens.show) and are taken off otherwise.
 *
 * It shares the black layer, canvas and dialogue box with js/secret.js and
 * nothing else: its own trigger, pictures, words, sounds and timeline, and
 * the two can never run at once. Nothing is recorded, and every timer, frame
 * loop and listener it starts is torn down before it hands back to the menu. */
(function (global) {
  'use strict';

  var Abduct = { active: false, speed: 1 };
  var armed = false, pending = null, firstHit = null;
  var timers = [], raf = 0, onResize = null;
  var el = {}, st = null;
  var STILL = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function $(id) { return document.getElementById(id); }
  function now() { return global.performance ? performance.now() : Date.now(); }
  function after(sec, fn) { timers.push(setTimeout(fn, sec * 1000 / Abduct.speed)); }

  /* ---- the trigger ------------------------------------------------------- */

  function racing() {
    var G = global.Game;
    return G && (G.state === 'racing' || G.state === 'countdown');
  }

  function onDown(e) {
    if (Abduct.active || (global.Secret && global.Secret.active) || !racing()) return;
    var pass = global.Renderer.ufoHit(e.clientX, e.clientY);
    if (pass < 0) return;
    if (e.pointerType === 'mouse') return begin();
    var control = global.Input.control;
    if (control === 'swipe') {
      // Confirmed on the way up, so the start of a swipe is not a press.
      pending = { id: e.pointerId, x: e.clientX, y: e.clientY, t: now() };
      return;
    }
    if (firstHit && firstHit.pass === pass && now() - firstHit.t < 1500) return begin();
    firstHit = { pass: pass, t: now() };
  }

  function onUp(e) {
    var p = pending;
    pending = null;
    if (!p || p.id !== e.pointerId || Abduct.active || !racing()) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 14 && now() - p.t < 450) begin();
  }

  /* Listen only while an Alien race is actually on the screen. */
  Abduct.sync = function () {
    var T = global.TRACK, C = global.CONFIG, S = global.Screens, G = global.Game;
    var want = !Abduct.active && S && S.current === 'race' && G && G.mode !== 'tutorial' &&
               T && T.theme && T.theme.hive && !C.contrastColors();
    var c = global.Renderer && global.Renderer.canvas;
    if (!c) return;
    if (want && !armed) {
      c.addEventListener('pointerdown', onDown);
      c.addEventListener('pointerup', onUp);
      armed = true;
    } else if (!want && armed) {
      c.removeEventListener('pointerdown', onDown);
      c.removeEventListener('pointerup', onUp);
      armed = false;
    }
    pending = null;
    firstHit = null;
  };

  /* ---- drawing ------------------------------------------------------------ */

  function size() {
    var c = el.canvas, dpr = Math.min(global.devicePixelRatio || 1, 2);
    st.w = global.innerWidth; st.h = global.innerHeight; st.dpr = dpr;
    c.width = Math.round(st.w * dpr);
    c.height = Math.round(st.h * dpr);
    c.style.width = st.w + 'px';
    c.style.height = st.h + 'px';
  }

  function snapshot(src) {
    var c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }

  // The world being pulled away beneath you.
  function drawRise(g, s) {
    var w = st.w, h = st.h, b = st.board;
    var k = Math.min(1, s / 4.2);
    // the panel, the HUD, everything round the board goes to black first
    g.fillStyle = 'rgba(0,0,0,' + Math.min(1, s / 1.1) + ')';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#000';
    g.fillRect(b.left, b.top, b.width, b.height);

    // how far the ground has dropped: slow, then very fast
    var fall = b.height * (0.18 * s * s * s + 0.1 * s);
    var stretch = 1 + k * k * 2.5;
    var fade = s < 2 ? 1 : Math.max(0, 1 - (s - 2) / 2.2);
    var tileH = b.height * stretch;
    var img = s < 0.9 ? st.withCars : st.alone;
    g.save();
    g.beginPath();
    g.rect(b.left, 0, b.width, h);
    g.clip();
    for (var copy = 0; copy < 3; copy++) {           // smeared as it goes
      var y0 = b.top + ((fall - copy * b.height * 0.06 * k) % tileH);
      g.globalAlpha = fade * (copy === 0 ? 1 : 0.35 * k);
      for (var y = y0 - tileH; y < h; y += tileH) g.drawImage(img, b.left, y, b.width, tileH);
    }
    // the AI fading from the picture before it goes altogether
    if (s < 0.9) {
      g.globalAlpha = fade * Math.min(1, s / 0.9);
      g.drawImage(st.alone, b.left, b.top + (fall % tileH), b.width, tileH);
    }
    g.restore();
    g.globalAlpha = 1;

    // the beam, over wherever your car was
    var bx = st.carX, bw = b.width * (0.08 + 0.12 * k);
    var beam = g.createLinearGradient(bx - bw, 0, bx + bw, 0);
    var ba = 0.12 + 0.38 * k;
    beam.addColorStop(0, 'rgba(124,255,90,0)');
    beam.addColorStop(0.5, 'rgba(160,255,130,' + ba + ')');
    beam.addColorStop(1, 'rgba(124,255,90,0)');
    g.fillStyle = beam;
    g.fillRect(bx - bw, 0, bw * 2, h);

    // green pulses, quicker and stronger - never past 3 a second
    var hz = 0.8 + 2.1 * k;
    st.phase += hz * st.dt;
    var pulse = 0.5 - 0.5 * Math.cos(st.phase * Math.PI * 2);
    g.fillStyle = 'rgba(90,255,110,' + (pulse * (STILL ? 0.1 : 0.08 + 0.27 * k)) + ')';
    g.fillRect(0, 0, w, h);
  }

  // The thing itself, side on, large, alone.
  function drawShip(g, a, t) {
    var w = st.w, h = st.h;
    var W = Math.min(w * 0.7, h * 0.9, 560), cx = w / 2;
    var cy = h * 0.56 + (STILL ? 0 : Math.sin(t * 0.7) * W * 0.008);
    g.save();
    g.globalAlpha = a;
    var under = g.createRadialGradient(cx, cy + W * 0.1, 0, cx, cy + W * 0.1, W * 0.6);
    under.addColorStop(0, 'rgba(124,255,90,0.18)');
    under.addColorStop(1, 'rgba(124,255,90,0)');
    g.fillStyle = under;
    g.fillRect(cx - W * 0.6, cy - W * 0.5, W * 1.2, W * 1.2);
    // lower hull, rim, dome
    g.fillStyle = '#07120c';
    g.beginPath(); g.ellipse(cx, cy + W * 0.05, W * 0.3, W * 0.07, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0d1f15';
    g.beginPath(); g.ellipse(cx, cy, W * 0.5, W * 0.1, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(124,255,90,0.35)';
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = 'rgba(40,100,65,0.75)';
    g.beginPath(); g.ellipse(cx, cy - W * 0.05, W * 0.17, W * 0.13, 0, Math.PI, 0); g.fill();
    g.fillStyle = 'rgba(190,255,170,0.18)';
    g.beginPath(); g.ellipse(cx - W * 0.05, cy - W * 0.11, W * 0.05, W * 0.03, -0.4, 0, Math.PI * 2); g.fill();
    // lights round the rim, turning slowly
    for (var i = 0; i < 11; i++) {
      var ang = (i / 11) * Math.PI * 2 + t * 0.5;
      var lx = cx + Math.cos(ang) * W * 0.44, ly = cy + Math.sin(ang) * W * 0.06;
      if (Math.sin(ang) < -0.2) continue;              // the far side is hidden
      g.fillStyle = i % 3 ? 'rgba(124,255,90,0.85)' : 'rgba(255,90,90,0.8)';
      g.fillRect(lx - 2, ly - 2, 4, 4);
    }
    g.restore();
  }

  function frame() {
    var t = now(), g = el.canvas.getContext('2d');
    st.dt = Math.min(0.05, (t - st.last) / 1000) * Abduct.speed;
    st.last = t;
    g.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    g.clearRect(0, 0, st.w, st.h);
    var s = (t - st.t0) / 1000 * Abduct.speed;
    if (st.mode === 'rise') drawRise(g, s);
    else {
      g.fillStyle = '#000';
      g.fillRect(0, 0, st.w, st.h);
      if (st.mode === 'ship') {
        var o = st.ship, u = Math.min(1, (t - o.t0) / (o.dur * 1000 / Abduct.speed));
        drawShip(g, o.from + (o.to - o.from) * u * u * (3 - 2 * u), t / 1000);
      } else if (st.mode === 'red' && st.red) {
        g.fillStyle = 'rgba(210,0,0,' + (STILL ? 0.45 : 0.92) + ')';
        g.fillRect(0, 0, st.w, st.h);
      }
    }
    raf = global.requestAnimationFrame(frame);
  }

  function say(text, fade) {
    el.say.style.transitionDuration = (fade || 1.6) / Abduct.speed + 's';
    el.say.textContent = text;
    void el.say.offsetHeight;
    el.say.classList.add('show');
  }
  function unsay(fade) {
    el.say.style.transitionDuration = (fade || 1.4) / Abduct.speed + 's';
    el.say.classList.remove('show');
  }

  /* ---- the sequence --------------------------------------------------------- */

  function begin() {
    var game = global.Game, R = global.Renderer, Sound = global.Sound;
    Abduct.active = true;
    Abduct.sync();                                     // the saucer is scenery again

    // What was on the board this instant, with and without the other cars.
    var cars = game.cars, parts = game.particles;
    var withCars = snapshot(R.canvas);
    game.cars = [game.player];
    game.particles = [];
    R.draw(game);
    var alone = snapshot(R.canvas);
    game.cars = cars;
    game.particles = parts;

    var rc = R.canvas.getBoundingClientRect();
    var P = game.player, carX;
    carX = R.rotated ? rc.left + P.y / global.TRACK.rows * rc.width
                     : rc.left + P.x / global.TRACK.cols * rc.width;

    game.state = 'secret';                             // Game.step does nothing now
    global.Input.clear();
    global.Screens.current = 'secret';                 // and the race stops drawing
    Sound.music(null, 0, 0.35);                        // the Alien music, cut short
    Sound.play('rise');

    el.root = $('secret'); el.canvas = $('secret-view'); el.say = $('secret-say');
    st = { w: 0, h: 0, dpr: 1, t0: now(), last: now(), dt: 0, phase: 0, mode: 'rise',
           board: { left: rc.left, top: rc.top, width: rc.width, height: rc.height },
           withCars: withCars, alone: alone, carX: carX, red: false,
           ship: { from: 0, to: 0, t0: now(), dur: 1 } };
    size();
    onResize = function () { size(); };
    global.addEventListener('resize', onResize);

    // The layer goes up see-through, so the race is still there under it.
    el.root.style.transitionDuration = '0s';
    el.root.style.background = 'transparent';
    el.canvas.style.transitionDuration = '0s';
    el.root.classList.add('on', 'show');
    el.canvas.classList.add('show');
    frame();

    after(4.2, function () {                           // cut to black
      st.mode = 'black';
      st.withCars = st.alone = null;
      el.root.style.background = '';
      game.reset();
      game.state = 'menu';
      global.Screens.current = 'secret';
    });
    after(5.8, function () {
      Sound.music('drift');
      st.ship = { from: 0, to: 1, t0: now(), dur: 5 };
      st.mode = 'ship';
    });

    var t = 5.8 + 5 + 1.8;
    after(t, function () { say('You are not meant to be here.'); });
    t += 1.6 + 3.2;
    after(t, function () { unsay(); });
    t += 1.4 + 2.2;
    after(t, function () { say('Go back to your world, Traveller.'); });
    t += 1.6 + 3.6;
    after(t, function () { unsay(); });
    t += 1.4 + 4.6;                                    // the longer silence
    after(t, function () { say('It has already seen you.'); });
    t += 1.6 + 3.6;
    after(t, function () { unsay(1.2); });
    t += 1.3;
    after(t, function () {                             // gone, all at once
      st.ship = { from: 0, to: 0, t0: now(), dur: 1 };
      st.mode = 'black';
    });
    t += 1.3;
    after(t, function () {                             // red, and it is angry
      Sound.music(null, 0, 0.05);
      Sound.play('hostile');
      st.mode = 'red';
    });
    for (var p = 0; p < 4; p++) {                      // 2.5 a second
      (function (on) {
        after(t + on, function () { st.red = true; });
        after(t + on + 0.2, function () { st.red = false; });
      })(p * 0.4);
    }
    t += 1.6;
    after(t, function () { st.mode = 'black'; st.red = false; });   // hard black, silent
    t += 1.6;
    after(t, finish);
  }

  function finish() {
    timers.forEach(clearTimeout);
    timers = [];
    if (raf) global.cancelAnimationFrame(raf);
    raf = 0;
    if (onResize) global.removeEventListener('resize', onResize);
    onResize = null;
    global.Sound.music(null, 0, 0.05);
    st = null;
    Abduct.active = false;
    el.say.classList.remove('show');
    el.say.style.transitionDuration = '';
    el.canvas.classList.remove('show');
    el.canvas.style.transitionDuration = '';
    el.root.style.background = '';
    global.Game.state = 'menu';
    global.Screens.show('main');                       // menu music, menu input
    global.Input.clear();
    el.root.style.transitionDuration = '0.5s';
    el.root.classList.remove('show');
    timers.push(setTimeout(function () {
      timers = [];
      if (!Abduct.active && !(global.Secret && global.Secret.active)) {
        el.root.classList.remove('on');
        el.root.style.transitionDuration = '';
      }
    }, 550));
  }

  global.Abduct = Abduct;
})(typeof window !== 'undefined' ? window : globalThis);
