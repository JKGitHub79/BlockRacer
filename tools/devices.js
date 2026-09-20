/* The screens this game has to fit, in CSS pixels.
 *
 * Gathered from device-viewport references rather than guessed: the widths
 * cluster hard at 360 and 390-430, the long tail below is old and small
 * Androids and the original iPhone SE, and the foldables' cover screens are
 * narrower than any phone.
 *
 * Two things here are not in any device table, and both of them are why the
 * game "fitted on one phone and not another":
 *
 * 1. VISIBLE HEIGHT IS NOT LAYOUT HEIGHT. On iOS Safari `100vh`, and a
 *    `position: fixed; inset: 0` box, resolve against the viewport with the
 *    toolbars HIDDEN. They are not hidden. So the page is laid out 60-90px
 *    taller than the part of it anyone can see and the bottom of every
 *    full-screen menu - which is where the buttons are - sits under the
 *    browser's chrome. Shrinking the test window does NOT reproduce that:
 *    the window has to stay tall while the visible height is told to be
 *    short, which is what `visible` below does.
 *
 * 2. THE NOTCH. index.html asks for viewport-fit=cover, so on a notched
 *    iPhone the page runs edge to edge and the safe-area insets are the only
 *    thing keeping content out from under the notch, the rounded corners and
 *    the home indicator. In landscape the side inset is 47pt - enough to
 *    swallow the BACK button whole. A desktop browser reports every inset as
 *    zero, so the audit sets them itself.
 */
'use strict';

/* insets are [top, right, bottom, left] in portrait; landscape is derived.
 * A notched iPhone pads BOTH sides in landscape, not just the notch side. */
const PHONES = [
  { name: 'iPhone SE (1st gen)',      w: 320, h: 568 },
  { name: 'Galaxy Z Fold (cover)',    w: 344, h: 882 },
  { name: 'Android, legacy',          w: 360, h: 640 },
  { name: 'Galaxy S23 / S24 / A54',   w: 360, h: 780, notch: 'android' },
  { name: 'Galaxy S20 / S21',         w: 360, h: 800, notch: 'android' },
  { name: 'iPhone SE 2/3, iPhone 8',  w: 375, h: 667 },
  { name: 'iPhone X / XS / 13 mini',  w: 375, h: 812, notch: 'iphone' },
  { name: 'Galaxy Z Flip',            w: 384, h: 824, notch: 'android' },
  { name: 'iPhone 12/13/14/16',       w: 390, h: 844, notch: 'iphone' },
  { name: 'iPhone 15 / 16 Pro',       w: 393, h: 852, notch: 'iphone' },
  { name: 'Pixel 5 / 6a',             w: 412, h: 892, notch: 'android' },
  { name: 'Pixel 6 / 7 / 8',          w: 412, h: 915, notch: 'android' },
  { name: 'iPhone XR / 11',           w: 414, h: 896, notch: 'iphone' },
  { name: 'iPhone 12-14 Pro Max',     w: 428, h: 926, notch: 'iphone' },
  { name: 'iPhone 15/16 Plus',        w: 430, h: 932, notch: 'iphone' },
  { name: 'iPhone 16 Pro Max',        w: 440, h: 956, notch: 'iphone' }
];

const TABLETS = [
  { name: 'iPad mini / 9.7',          w: 768, h: 1024 },
  { name: 'iPad Air',                 w: 820, h: 1180, notch: 'ipad' },
  { name: 'iPad Pro 11',              w: 834, h: 1194, notch: 'ipad' },
  { name: 'iPad Pro 12.9',            w: 1024, h: 1366, notch: 'ipad' }
];

/* {portrait: [t,r,b,l], landscape: [t,r,b,l]} */
const INSETS = {
  iphone:  { portrait: [47, 0, 34, 0], landscape: [0, 47, 21, 47] },
  android: { portrait: [24, 0, 24, 0], landscape: [0, 24, 16, 24] },
  ipad:    { portrait: [24, 0, 20, 0], landscape: [24, 0, 20, 0] },
  none:    { portrait: [0, 0, 0, 0],   landscape: [0, 0, 0, 0] }
};

/* How much of the height the browser's own chrome takes. 0 is a home-screen
 * web app or a scrolled-away toolbar; 46 is the usual visible toolbar; 90 is
 * Chrome for Android with the toolbar AND the tab strip. */
const CHROME = [0, 46, 90];

function cases(opts) {
  opts = opts || {};
  const out = [];
  const devices = PHONES.concat(opts.tablets === false ? [] : TABLETS);
  devices.forEach((d) => {
    const ins = INSETS[d.notch || 'none'];
    out.push({
      label: d.name + ' portrait', w: d.w, h: d.h, visible: d.h,
      insets: ins.portrait, kind: 'portrait'
    });
    CHROME.forEach((c) => {
      if (d.w >= 700 && c !== 46) return;   // a tablet's toolbar matters less
      out.push({
        label: d.name + ' landscape' + (c ? ' -' + c : ''),
        // The WINDOW stays the full swapped size, as iOS reports it...
        w: d.h, h: d.w,
        // ...and only the VISIBLE height shrinks. That is the whole point.
        visible: d.w - c,
        insets: ins.landscape, kind: 'landscape'
      });
    });
  });
  return out;
}

module.exports = { PHONES, TABLETS, INSETS, CHROME, cases };
