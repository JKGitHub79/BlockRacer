/* Block Racer - how big the screen actually is.
 *
 * Not how big the browser says it is. On iOS Safari those are different
 * numbers and the difference is most of a toolbar:
 *
 *   - `100vh`, and a `position: fixed; inset: 0` box, both resolve against
 *     the LARGE viewport - the size the page would be if the address bar and
 *     the bottom toolbar were hidden. They are not hidden. So a full-screen
 *     fixed menu is laid out sixty to ninety pixels taller than the part of
 *     it you can see, and the bottom of it - which is where the buttons are -
 *     sits underneath the browser's own chrome.
 *   - `100dvh` was meant to fix exactly this and does, on iOS 15.4 and up.
 *     Below that it is not supported at all and falls back to nothing.
 *
 * So the size is measured instead. `visualViewport` is the part of the page
 * the user can actually see, it is reported correctly on every iOS that has
 * it, and it updates as the toolbar comes and goes. The number goes onto
 * <html> as --app-h, and the stylesheet sizes everything full-screen from
 * that, with 100dvh left as the fallback for anything with no script.
 *
 * The safe-area insets are published the same way. index.html asks for
 * `viewport-fit=cover` so the painted landscape can run under the notch, and
 * the price of asking for that is that the CONTENT will run under it too
 * unless something pads it back. env() does the padding; the custom
 * properties exist so that tools/audit-layout.js can set a notch of its own
 * and check the layout still holds, which is not something a desktop browser
 * will ever hand it.
 */
(function (global) {
  'use strict';

  var root = document.documentElement;
  var vv = global.visualViewport;
  var pending = false;

  function measure() {
    pending = false;
    // Round DOWN. visualViewport.height is fractional on a scaled display and
    // rounding up puts the last pixel row under the toolbar again.
    var h = Math.floor(vv ? vv.height : global.innerHeight);
    var w = Math.floor(vv ? vv.width : global.innerWidth);
    if (h > 0) root.style.setProperty('--app-h', h + 'px');
    if (w > 0) root.style.setProperty('--app-w', w + 'px');
  }

  function schedule() {
    if (pending) return;
    pending = true;
    global.requestAnimationFrame(measure);
  }

  measure();
  global.addEventListener('resize', schedule);
  global.addEventListener('orientationchange', schedule);
  if (vv) {
    vv.addEventListener('resize', schedule);
    // The toolbar slides away as you scroll, which changes the visible height
    // without firing a resize on the window.
    vv.addEventListener('scroll', schedule);
  }
  // Safari settles the viewport a beat after an orientation change, and the
  // number read during the turn is the old one.
  global.addEventListener('orientationchange', function () {
    setTimeout(measure, 120);
    setTimeout(measure, 400);
  });

  global.Viewport = { measure: measure };
})(typeof window !== 'undefined' ? window : globalThis);
