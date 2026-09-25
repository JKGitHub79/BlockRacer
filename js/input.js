/* Block Racer - input. Two controls: turn left, turn right.
 * Turns are queued on key down so a press between frames is never eaten.
 *
 * A touchscreen can instead be set to swipe (Options, CONTROL STYLE). A
 * swipe is queued as a DIRECTION on the screen rather than as a turn, and
 * becomes a turn only when the race takes it - by then the car may have
 * turned since, and it is where the car points at that moment that decides
 * whether up is a left or a right. Either way what comes out is the same
 * -1 / +1 the keys and taps give, into the same Car.turn. */
(function (global) {
  'use strict';

  var LEFT = ['ArrowLeft', 'a', 'A', 'KeyA'];
  var RIGHT = ['ArrowRight', 'd', 'D', 'KeyD'];

  var Input = {
    turns: [],          // pending -1 / +1, a swiped direction {x, y}, or {auto}
    control: 'swipe',   // how a touchscreen steers: 'swipe', 'tap' or 'auto'
    onCommand: null,    // (name) => void  for restart / pause / mute / start
    /* The next turn, given where the car points now. A swiped direction is
     * the one 90-degree turn that points it that way: the sign of the cross
     * product, with screen y running down, is +1 for a right turn exactly as
     * Car.turn has it. Straight on, or straight back - which no single
     * quarter turn reaches - is dropped rather than guessed at. */
    take: function (heading, car) {
      while (this.turns.length) {
        var s = this.resolve(this.turns.shift(), heading, car);
        if (s) return s;
      }
      return 0;
    },
    /* One queued entry as a turn: -1, +1, or 0 for a swipe no turn reaches.
     * An Auto Turn tap is decided here too, as late as a swipe is, from
     * where the car is and which way it points when the race takes it. */
    resolve: function (t, heading, car) {
      if (typeof t === 'number') return t;
      if (t.auto) return global.AutoTurn && car ? global.AutoTurn.choose(car) : 0;
      var s = heading ? heading.x * t.y - heading.y * t.x : 0;
      return s > 0 ? 1 : s < 0 ? -1 : 0;
    },
    /* How this player steers, for anything that has to tell them what to
     * press: 'keys', 'swipe', 'tap' or 'auto'. Whatever they last steered with;
     * before that, a touchscreen is assumed to be a finger and anything else
     * a keyboard. */
    how: function () {
      var kind = lastKind;
      if (!kind) {
        var coarse = global.matchMedia && global.matchMedia('(pointer: coarse)').matches;
        kind = coarse ? 'touch' : 'keys';
      }
      return kind === 'touch' ? this.control : 'keys';
    },
    clear: function () { this.turns.length = 0; swipes = {}; }
  };

  var lastKind = null;   // 'keys' | 'touch' | null, for Input.how

  function matches(list, e) {
    return list.indexOf(e.key) !== -1 || list.indexOf(e.code) !== -1;
  }

  global.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    if (matches(LEFT, e) || matches(RIGHT, e)) lastKind = 'keys';
    if (matches(LEFT, e)) {
      Input.turns.push(-1);
      e.preventDefault();
    } else if (matches(RIGHT, e)) {
      Input.turns.push(1);
      e.preventDefault();
    } else if (e.key === 'r' || e.key === 'R') {
      if (Input.onCommand) Input.onCommand('restart');
    } else if (e.key === 'Escape') {
      if (Input.onCommand) Input.onCommand('menu');
    } else if (e.key === 'p' || e.key === 'P') {
      if (Input.onCommand) Input.onCommand('pause');
    } else if (e.key === '[') {
      if (Input.onCommand) Input.onCommand('slide-');
    } else if (e.key === ']') {
      if (Input.onCommand) Input.onCommand('slide+');
    } else if (e.key === 'm' || e.key === 'M') {
      if (Input.onCommand) Input.onCommand('mute');
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (Input.onCommand) Input.onCommand('start');
      e.preventDefault();
    }
  });

  // Menus, screens and buttons are not the track.
  function onTrack(e) {
    if (e.target && e.target.closest &&
        e.target.closest('button, input, .overlay, .screen')) return false;
    return !global.Screens || global.Screens.current === 'race';
  }

  // A finger in swipe mode. The mouse always taps: swipe is a touchscreen
  // setting, and a desktop keeps exactly the controls it had.
  function swiping(e) {
    return Input.control === 'swipe' && e.pointerType !== 'mouse';
  }

  // Touch / mouse: tap the left or right half of the screen.
  global.addEventListener('pointerdown', function (e) {
    if (!onTrack(e)) return;
    // A mouse click is a tap, but somebody with a mouse has keys: the
    // instructions stay in keys for them.
    lastKind = e.pointerType === 'mouse' ? 'keys' : 'touch';
    if (swiping(e)) {
      swipes[e.pointerId] = { x: e.clientX, y: e.clientY, done: false };
      return;
    }
    // Auto Turn: anywhere is a turn, and AutoTurn picks which way when the
    // race takes it. A finger only - a mouse still taps a side, like Swipe.
    if (Input.control === 'auto' && e.pointerType !== 'mouse') {
      Input.turns.push({ auto: true });
      return;
    }
    Input.turns.push(e.clientX < global.innerWidth / 2 ? -1 : 1);
  });

  /* Swipes. A finger has to travel SWIPE_MIN CSS pixels - about 4mm on a
   * phone, where a tap wanders 1 or 2 - before it is a swipe, so a tap never
   * steers. It fires the moment it gets there rather than on lifting, which
   * is what makes it feel immediate, and then that finger is spent: one
   * swipe, one turn, however far it carries on. Mid-swipe it also has to be
   * clearly one way (DOMINANCE times further along one axis than the
   * other); a diagonal waits to see which way it goes, and one that is
   * still diagonal when lifted goes whichever way it went further. */
  var SWIPE_MIN = 24;
  var DOMINANCE = 1.5;
  var swipes = {};

  function swipeDir(s, x, y, lifting) {
    var dx = x - s.x, dy = y - s.y;
    var ax = Math.abs(dx), ay = Math.abs(dy);
    var major = Math.max(ax, ay), minor = Math.min(ax, ay);
    if (major < SWIPE_MIN || ax === ay) return null;
    if (!lifting && major < DOMINANCE * minor) return null;
    return ax > ay ? { x: dx > 0 ? 1 : -1, y: 0 } : { x: 0, y: dy > 0 ? 1 : -1 };
  }

  function track(e, lifting) {
    var s = swipes[e.pointerId];
    if (!s) return;
    if (lifting) delete swipes[e.pointerId];
    if (s.done) return;
    var d = swipeDir(s, e.clientX, e.clientY, lifting);
    if (!d) return;
    s.done = true;
    // A swipe is on the screen; the board may be turned a quarter on it.
    if (global.Renderer && global.Renderer.toTrack) d = global.Renderer.toTrack(d);
    if (!global.Screens || global.Screens.current === 'race') Input.turns.push(d);
  }
  global.addEventListener('pointermove', function (e) { track(e, false); });
  global.addEventListener('pointerup', function (e) { track(e, true); });
  global.addEventListener('pointercancel', function (e) { delete swipes[e.pointerId]; });

  /* While swiping, a finger moving on the race must never move the page.
   * The stylesheet does most of it (touch-action: none on the race, no
   * overscroll at the root, so no pull-to-refresh); this is for iOS Safari,
   * whose rubber-band and edge behaviour only a cancelled touchmove stops.
   * Buttons and overlays are left alone - the results still scroll. */
  global.addEventListener('touchmove', function (e) {
    if (Input.control !== 'swipe' || !onTrack(e)) return;
    if (e.cancelable) e.preventDefault();
  }, { passive: false });

  /* Zoom, off.
   *
   * A racing game's controls are taps, and two quick taps - which is exactly
   * what taking a corner looks like - were being read as double-tap-to-zoom,
   * leaving the board blown up and off centre with no way back on a device
   * that has no keyboard.
   *
   * `touch-action` in the stylesheet is what actually stops it in every
   * current browser. These two are for iOS Safari, which fires its own
   * pinch-gesture events on top of the touch model and honours neither
   * user-scalable=no nor maximum-scale; without them a two-finger pinch
   * still zooms the page even though the double tap no longer does.
   *
   * Only zoom is taken away. Scrolling still works, and every screen that is
   * taller than the window still scrolls, because touch-action allows the
   * pan and refuses the scale. */
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (name) {
    global.addEventListener(name, function (e) { e.preventDefault(); }, { passive: false });
  });
  global.addEventListener('dblclick', function (e) { e.preventDefault(); }, { passive: false });

  global.Input = Input;
})(typeof window !== 'undefined' ? window : globalThis);
