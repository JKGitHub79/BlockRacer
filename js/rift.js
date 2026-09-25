/* Block Racer - something on the Space page. Deliberately undocumented
 * anywhere a player looks: no menu, no README section, no counter, no unlock.
 *
 * Typed on the keyboard while the track picker is showing the SPACE theme,
 * four letters start it. Nothing shows the letters, nothing shows that keys
 * are being read, and no key does anything other than it always did: the
 * listener only watches. Anything else - a wrong letter, another key, a
 * pause of more than two seconds, another screen, another theme - puts the
 * count back to nothing. Keyboard only, on purpose: there is no touch way in.
 *
 * Then the menu appears to break - it shakes, harder and harder, parts of it
 * jump and vanish, the screen blinks black and white - for seven seconds,
 * over a sound coming apart, and everything stops at once. Black, silence,
 * two words, black, and the main menu as if nothing had happened.
 *
 * It borrows the black layer from js/secret.js (see-through until the cut,
 * so it also swallows every press) and a line of text of its own. Every
 * style it touches is written back exactly as it found it, and every timer,
 * frame loop and listener it starts is gone before it hands back. */
(function (global) {
  'use strict';

  var WORD = 'VOID';
  var GAP_MS = 2000;                   // longest pause between letters
  var LEAD = 1, SPAN = 7;              // quiet second, then the unravelling

  var Rift = { active: false, speed: 1 };
  var typed = 0, lastKey = 0;
  var timers = [], raf = 0, saved = [], el = {}, st = null;
  var STILL = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function $(id) { return document.getElementById(id); }
  function now() { return global.performance ? performance.now() : Date.now(); }
  function after(sec, fn) { timers.push(setTimeout(fn, sec * 1000 / Rift.speed)); }

  /* ---- the trigger ------------------------------------------------------- */

  function onSpacePage() {
    var S = global.Screens;
    return S && S.current === 'play' && !S.progress && global.THEMES &&
           global.THEMES[S.theme] && global.THEMES[S.theme].id === 'space';
  }

  function onKey(e) {
    if (Rift.active || (global.Secret && global.Secret.active) ||
        (global.Abduct && global.Abduct.active)) { typed = 0; return; }
    if (!onSpacePage()) { typed = 0; return; }
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Shift' || e.key === 'CapsLock') return;
    var k = (e.key || '').toUpperCase(), t = now();
    if (typed && t - lastKey > GAP_MS) typed = 0;
    lastKey = t;
    if (k === WORD.charAt(typed)) typed++;
    else typed = k === WORD.charAt(0) ? 1 : 0;
    if (typed === WORD.length) { typed = 0; begin(); }
  }
  global.addEventListener('keydown', onKey);

  /* ---- the unravelling ------------------------------------------------------ */

  // Remember a style exactly as it was, so it can be put back exactly.
  function touch(node, prop) {
    for (var i = 0; i < saved.length; i++) if (saved[i].node === node && saved[i].prop === prop) return;
    saved.push({ node: node, prop: prop, value: node.style[prop] });
  }
  function restoreAll() {
    for (var i = saved.length - 1; i >= 0; i--) saved[i].node.style[saved[i].prop] = saved[i].value;
    saved = [];
  }

  function shake() {
    var s = (now() - st.t0) / 1000 * Rift.speed;       // seconds into the unravelling
    var k = Math.max(0, Math.min(1, s / SPAN));
    var amp = (0.6 + 30 * k * k) * (STILL ? 0.25 : 1);
    var rot = (k * k * 1.6) * (STILL ? 0.25 : 1);
    var dx = (Math.random() * 2 - 1) * amp, dy = (Math.random() * 2 - 1) * amp;
    var dr = (Math.random() * 2 - 1) * rot;
    st.shaken.forEach(function (n) { n.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + dr + 'deg)'; });
    raf = global.requestAnimationFrame(shake);
  }

  // A part of the page jumps, or is simply gone, for a moment.
  function glitch(k) {
    var parts = st.parts, n = 1 + Math.floor(Math.random() * (1 + k * 3));
    var hits = [];
    for (var i = 0; i < n; i++) hits.push(parts[Math.floor(Math.random() * parts.length)]);
    hits.forEach(function (p) {
      touch(p, 'translate');
      touch(p, 'visibility');
      if (Math.random() < 0.35 + k * 0.3) p.style.visibility = 'hidden';
      else p.style.translate = ((Math.random() * 2 - 1) * (15 + 60 * k)) + 'px ' + ((Math.random() * 2 - 1) * (8 + 30 * k)) + 'px';
    });
    global.Sound.play('glitch');
    timers.push(setTimeout(function () {
      hits.forEach(function (p) { p.style.translate = ''; p.style.visibility = ''; });
    }, (60 + Math.random() * 110) / Rift.speed));
  }

  function flash(colour, ms) {
    el.root.style.background = colour;
    timers.push(setTimeout(function () {
      if (st && st.phase === 'unravel') el.root.style.background = 'transparent';
    }, ms / Rift.speed));
  }

  function begin() {
    Rift.active = true;
    var Sound = global.Sound;
    var play = $('screen-play');
    el.root = $('secret');
    el.word = $('secret-word');
    st = {
      t0: 0, phase: 'lead',
      shaken: [play, $('backdrop')].filter(Boolean),
      parts: Array.prototype.slice.call(play.querySelectorAll(
        '.back, .mode-tag, .theme-title, #theme-tagline, .arrow, .card, .screen-foot'))
    };
    st.shaken.forEach(function (n) { touch(n, 'transform'); });
    st.parts.forEach(function (n) { touch(n, 'translate'); touch(n, 'visibility'); });

    // Nothing on the page answers from here: the layer takes every press,
    // the menus' keys see another screen, the game's commands are held.
    global.Screens.current = 'secret';
    global.Input.clear();
    touch(el.root, 'background');
    touch(el.root, 'transitionDuration');
    el.root.style.transitionDuration = '0s';
    el.root.style.background = 'transparent';
    el.root.classList.add('on', 'show');

    Sound.music(null, 0, 0.25);                        // the Space music, gone

    after(LEAD, function () {                          // a normal second, then not
      st.phase = 'unravel';
      st.t0 = now();
      Sound.play('unravel');
      shake();
    });
    // Glitches, sparse and small at first, then often and large.
    var g = LEAD + 1.6;
    while (g < LEAD + SPAN - 0.2) {
      (function (at) { after(at, function () { glitch((at - LEAD) / SPAN); }); })(g);
      var k = (g - LEAD) / SPAN;
      g += 0.9 - 0.65 * k + Math.random() * 0.25;
    }
    // Black and white, never more than two a second.
    [[2.3, '#000', 90], [3.6, '#fff', 70], [4.5, '#000', 110], [5.2, '#fff', 80],
     [5.8, '#000', 120], [6.3, '#fff', 90], [6.75, '#000', 130]].forEach(function (f) {
      if (STILL && f[1] === '#fff') return;
      after(LEAD + f[0], function () { flash(f[1], f[2]); });
    });

    // Everything, at once: black, still, silent.
    var t = LEAD + SPAN;
    after(t, function () {
      st.phase = 'black';
      if (raf) global.cancelAnimationFrame(raf);
      raf = 0;
      el.root.style.background = '#000';
      restoreAll();                                    // the page, exactly as it was
      touch(el.root, 'background');
      el.root.style.background = '#000';
    });
    t += 2;
    after(t, function () {
      el.word.style.transitionDuration = 1.6 / Rift.speed + 's';
      el.word.classList.add('show');
    });
    t += 1.6 + 3;
    after(t, function () { el.word.classList.remove('show'); });
    t += 1.6 + 1.2;
    after(t, finish);
  }

  function finish() {
    timers.forEach(clearTimeout);
    timers = [];
    if (raf) global.cancelAnimationFrame(raf);
    raf = 0;
    el.word.classList.remove('show');
    el.word.style.transitionDuration = '';
    restoreAll();
    el.root.classList.remove('show', 'on');           // at once: nothing happened
    Rift.active = false;
    st = null;
    typed = 0;
    global.Screens.show('main');                       // menu music, menu input
    global.Input.clear();
  }

  global.Rift = Rift;
})(typeof window !== 'undefined' ? window : globalThis);
