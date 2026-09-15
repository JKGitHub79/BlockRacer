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
    // menus and buttons are not the track
    if (e.target && e.target.closest && e.target.closest('button, .overlay')) return;
    Input.turns.push(e.clientX < global.innerWidth / 2 ? -1 : 1);
  });

  global.Input = Input;
})(typeof window !== 'undefined' ? window : globalThis);
