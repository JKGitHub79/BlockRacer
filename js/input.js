/* Block Racer - input. Two controls: turn left, turn right.
 * Turns are queued on key down so a press between frames is never eaten. */
(function (global) {
  'use strict';

  var LEFT = ['ArrowLeft', 'a', 'A', 'KeyA'];
  var RIGHT = ['ArrowRight', 'd', 'D', 'KeyD'];

  var Input = {
    turns: [],          // pending -1 / +1
    onCommand: null,    // (name) => void  for restart / pause / mute / start
    take: function () { return this.turns.length ? this.turns.shift() : 0; },
    clear: function () { this.turns.length = 0; }
  };

  function matches(list, e) {
    return list.indexOf(e.key) !== -1 || list.indexOf(e.code) !== -1;
  }

  global.addEventListener('keydown', function (e) {
    if (e.repeat) return;
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

  // Touch / mouse: tap the left or right half of the screen.
  global.addEventListener('pointerdown', function (e) {
    // menus, screens and buttons are not the track
    if (e.target && e.target.closest &&
        e.target.closest('button, input, .overlay, .screen')) return;
    if (global.Screens && global.Screens.current !== 'race') return;
    Input.turns.push(e.clientX < global.innerWidth / 2 ? -1 : 1);
  });

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
