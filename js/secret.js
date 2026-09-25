/* Block Racer - something on Duneline. Deliberately undocumented anywhere
 * a player looks: no menu, no README section, no counter, no unlock.
 *
 * Duneline has a pocket in its far corner, past the point where the racing
 * line turns up the right-hand road: x 43.5-47, y 21.5-25 in track cells.
 * Nothing in a lap goes there. Keep YOUR car in it for ten seconds of race
 * time and the race is quietly put away and something else is shown.
 *
 * The zone is in track coordinates and read from the car's own position, so
 * the quarter turn the board gets on a phone held upright changes nothing.
 * It is checked from Game.step (race time: pausing pauses it, leaving
 * resets it), for the player's car only, and it is never drawn.
 *
 * Nothing about it is recorded: no result, medal, record, ghost, star,
 * unlock or flag. The race is reset and the player lands on the main menu.
 *
 * Everything it starts - timeouts, the animation frame, the resize listener,
 * the ambience - is held here and torn down in finish(), and while it runs
 * Game.command ignores everything but mute. */
(function (global) {
  'use strict';

  var ZONE = { track: 'duneline', x0: 43.5, y0: 21.5, x1: 47, y1: 25 };
  var HOLD = 10;                 // seconds in the zone

  var LINES = [
    ['So... you are the Traveller.'],
    ['I wondered when you would stop.'],
    ['You think these roads were built for racing?'],
    ['No.', 1],
    ['They were here before the first car.'],
    ['Forest. Desert. Snow. The ruins. The places beyond your world.', 0, 1.6],
    ['Different roads.'],
    ['Same destination.', 0, 0, 5.5],       // the long pause after it
    ['You have been following it this entire time.'],
    ['And now it knows you can see it.']
  ];

  var Secret = { active: false, speed: 1 };
  var held = 0;
  var timers = [], raf = 0, onResize = null;
  var el = {}, scene = null;

  function $(id) { return document.getElementById(id); }
  function now() { return global.performance ? performance.now() : Date.now(); }

  // Schedule in scene seconds (Secret.speed exists only to let a test run
  // the whole thing faster; the game never changes it).
  function after(sec, fn) {
    timers.push(setTimeout(fn, sec * 1000 / Secret.speed));
  }

  /* ---- the trigger -------------------------------------------------------- */

  Secret.reset = function () { held = 0; };

  /* Called by Game.step every step of a race. True when it has just begun. */
  Secret.watch = function (game, dt) {
    var T = global.TRACK, P = game.player;
    if (Secret.active || game.mode === 'tutorial' || !T.data || T.data.id !== ZONE.track ||
        !P || P.finished ||
        P.x < ZONE.x0 || P.x > ZONE.x1 || P.y < ZONE.y0 || P.y > ZONE.y1) {
      held = 0;
      return false;
    }
    held += dt;
    if (held < HOLD) return false;
    held = 0;
    begin(game);
    return true;
  };

  /* ---- the scene ------------------------------------------------------------ */

  function size() {
    var c = el.canvas, dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = global.innerWidth, h = global.innerHeight;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    scene.w = w; scene.h = h; scene.dpr = dpr;
  }

  function draw() {
    var g = el.canvas.getContext('2d'), w = scene.w, h = scene.h;
    var Cos = global.Cosmetics, C = global.CONFIG;
    g.setTransform(scene.dpr, 0, 0, scene.dpr, 0, 0);
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);

    var L = Math.max(34, Math.min(w * 0.12, h * 0.09, 110));
    var W = L * C.carWidth / C.carLength;
    var y = h * 0.56, band = W * 3.4;

    // the road, and nothing else
    g.fillStyle = '#0d0f13';
    g.fillRect(0, y - band / 2, w, band);
    g.fillStyle = '#1b1e25';
    g.fillRect(0, y - band / 2, w, 1);
    g.fillRect(0, y + band / 2 - 1, w, 1);
    g.fillStyle = 'rgba(255,255,255,0.07)';
    for (var x = -((L * 0.6) % (L * 1.2)); x < w; x += L * 1.2) g.fillRect(x, y - 1, L * 0.6, 2);

    var vehicle = Cos ? Cos.equippedVehicle() : null;

    // yours, on the left, facing along the road
    g.save();
    g.translate(w * 0.22, y);
    if (Cos) Cos.drawCar(g, L, W, Cos.equippedSkin(), vehicle, 0, null);
    else { g.fillStyle = '#5ef2ff'; g.fillRect(-L / 2, -W / 2, L, W); }
    g.restore();

    // the other one, far right, facing you: your shape, in nothing
    var a = otherAlpha();
    if (a > 0.004) {
      g.save();
      g.globalAlpha = a;
      g.translate(w * 0.82, y);
      g.rotate(Math.PI);
      if (Cos && Cos.fillSilhouette) {
        Cos.fillSilhouette(g, L, W, vehicle, 1.2, 'rgba(225,225,225,0.55)');
        Cos.fillSilhouette(g, L, W, vehicle, 0, '#000');
      } else {
        g.fillStyle = 'rgba(225,225,225,0.55)';
        g.fillRect(-L / 2 - 1.2, -W / 2 - 1.2, L + 2.4, W + 2.4);
        g.fillStyle = '#000';
        g.fillRect(-L / 2, -W / 2, L, W);
      }
      g.fillStyle = 'rgba(215,225,245,0.5)';
      g.fillRect(L / 2 - 3, -W * 0.34, 2, W * 0.16);
      g.fillRect(L / 2 - 3, W * 0.18, 2, W * 0.16);
      g.restore();
    }
  }

  // The other car's opacity now: eased between the last two values set.
  function otherAlpha() {
    var o = scene.other, t = Math.min(1, (now() - o.t0) / (o.dur * 1000 / Secret.speed));
    t = t * t * (3 - 2 * t);
    return o.from + (o.to - o.from) * t;
  }
  function fadeOther(to, dur) {
    scene.other = { from: otherAlpha(), to: to, t0: now(), dur: dur };
  }

  function loop() {
    draw();
    raf = global.requestAnimationFrame(loop);
  }

  // One line at a time: fade in, hold long enough to read, fade out.
  function say(text, fadeIn) {
    var b = el.say;
    b.style.transitionDuration = (fadeIn || 1.4) / Secret.speed + 's';
    b.textContent = text;
    void b.offsetHeight;
    b.classList.add('show');
  }
  function unsay() {
    el.say.style.transitionDuration = 1.4 / Secret.speed + 's';
    el.say.classList.remove('show');
  }
  function readFor(text) { return 2.6 + text.length * 0.055; }

  /* ---- the sequence --------------------------------------------------------- */

  function begin(game) {
    Secret.active = true;
    game.state = 'secret';               // Game.step does nothing from here
    global.Input.clear();
    global.Sound.music(null, 0, 2.2);    // the desert fades out

    el.root = $('secret');
    el.canvas = $('secret-view');
    el.say = $('secret-say');
    scene = { w: 0, h: 0, dpr: 1, other: { from: 0, to: 0, t0: now(), dur: 1 } };

    el.root.style.transitionDuration = 2.2 / Secret.speed + 's';
    el.root.classList.add('on');
    void el.root.offsetHeight;
    el.root.classList.add('show');       // to black, over the frozen race

    after(2.6, function () {
      // The race is over without ever having finished: reset, no results,
      // nothing written. The race screen stops drawing behind the black.
      game.reset();
      game.state = 'menu';
      global.Screens.current = 'secret';
      size();
      onResize = function () { size(); };
      global.addEventListener('resize', onResize);
      loop();
      global.Sound.music('stillness');
      el.canvas.style.transitionDuration = 2.5 / Secret.speed + 's';
      el.canvas.classList.add('show');
    });

    var t = 2.6 + 7;                     // alone on the road for a while
    after(t, function () { fadeOther(1, 5); });
    t += 5 + 2;

    LINES.forEach(function (ln) {
      var text = ln[0], pauseBefore = ln[1] || 0, extra = ln[2] || 0, gap = ln[3] || 1;
      t += pauseBefore;
      after(t, function () { say(text); });
      t += 1.4 + readFor(text) + extra;
      after(t, unsay);
      t += 1.4 + gap;
    });

    after(t, function () { fadeOther(0, 4.5); });
    t += 4.5 + 1.2;
    after(t, function () { say('Do not stop again.'); });
    t += 1.4 + readFor('Do not stop again.');
    after(t, unsay);
    t += 1.4 + 2.6;                      // alone again
    after(t, function () { say('It notices when you stop.', 0.35); });
    t += 0.35 + 3.8;

    after(t, function () {
      unsay();
      el.canvas.style.transitionDuration = 3 / Secret.speed + 's';
      el.canvas.classList.remove('show');
      global.Sound.music(null, 0, 3);
    });
    t += 3 + 1.8;                        // nothing at all, for a moment
    after(t, finish);
  }

  // Back to the front door as if nothing happened, and nothing left running.
  function finish() {
    timers.forEach(clearTimeout);
    timers = [];
    if (raf) global.cancelAnimationFrame(raf);
    raf = 0;
    if (onResize) global.removeEventListener('resize', onResize);
    onResize = null;
    held = 0;
    Secret.active = false;
    el.say.classList.remove('show');
    el.canvas.classList.remove('show');
    global.Game.state = 'menu';
    global.Screens.show('main');        // menu music, menu input, menu backdrop
    global.Input.clear();
    el.root.style.transitionDuration = 1.2 / Secret.speed + 's';
    el.root.classList.remove('show');
    timers.push(setTimeout(function () {
      if (!Secret.active) el.root.classList.remove('on');
    }, 1300 / Secret.speed));
    scene = null;
  }

  global.Secret = Secret;
})(typeof window !== 'undefined' ? window : globalThis);
