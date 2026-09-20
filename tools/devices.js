/* The screens this game has to fit, in CSS pixels, portrait.
 *
 * Gathered from device-viewport references rather than guessed: the widths
 * cluster hard at 360 and 390-430, the long tail below that is old and small
 * Androids and the original iPhone SE, and the foldables' outer screens are
 * narrower than any phone.
 *
 * LANDSCAPE IS NOT JUST THE SWAP. A phone in landscape hands the page the
 * swapped width but a SHORTER height than the swap implies, because the
 * browser's own toolbar is still there - roughly 40-50px of it on iOS Safari
 * and Chrome for Android, and it comes and goes as you scroll. So every
 * landscape case is tested twice: once at the clean swap, and once with the
 * toolbar taking its cut. That second one is the case that was breaking, and
 * it is the one no "iPhone 14" device preset will show you.
 */
'use strict';

const PHONES = [
  { name: 'iPhone SE (1st gen)',      w: 320, h: 568 },
  { name: 'Galaxy Z Fold (cover)',    w: 344, h: 882 },
  { name: 'Android, legacy',          w: 360, h: 640 },
  { name: 'Galaxy S23 / S24 / A54',   w: 360, h: 780 },
  { name: 'Galaxy S20 / S21',         w: 360, h: 800 },
  { name: 'iPhone SE 2/3, iPhone 8',  w: 375, h: 667 },
  { name: 'iPhone X / XS / 13 mini',  w: 375, h: 812 },
  { name: 'Galaxy Z Flip',            w: 384, h: 824 },
  { name: 'iPhone 12/13/14/16',       w: 390, h: 844 },
  { name: 'iPhone 15 / 16 Pro',       w: 393, h: 852 },
  { name: 'Pixel 5 / 6a',             w: 412, h: 892 },
  { name: 'Pixel 6 / 7 / 8',          w: 412, h: 915 },
  { name: 'iPhone XR / 11',           w: 414, h: 896 },
  { name: 'iPhone 12-14 Pro Max',     w: 428, h: 926 },
  { name: 'iPhone 15/16 Plus',        w: 430, h: 932 },
  { name: 'iPhone 16 Pro Max',        w: 440, h: 956 }
];

const TABLETS = [
  { name: 'iPad mini / 9.7',          w: 768, h: 1024 },
  { name: 'iPad Air',                 w: 820, h: 1180 },
  { name: 'iPad Pro 11',              w: 834, h: 1194 },
  { name: 'iPad Pro 12.9',            w: 1024, h: 1366 }
];

/* How much of the height a browser's own chrome takes in landscape. 0 is a
 * home-screen web app or a scrolled-away toolbar; 46 is the usual visible
 * toolbar; 90 is Chrome for Android with the toolbar AND the tab strip, which
 * on a 375-tall landscape leaves 285px for the whole game. */
const CHROME = [0, 46, 90];

/* Every case the layout has to survive, as {label, width, height}. */
function cases(opts) {
  opts = opts || {};
  const out = [];
  const devices = PHONES.concat(opts.tablets === false ? [] : TABLETS);
  devices.forEach((d) => {
    out.push({ label: d.name + ' portrait', w: d.w, h: d.h, kind: 'portrait' });
    CHROME.forEach((c) => {
      // A tablet's toolbar matters far less; one case is enough there.
      if (d.w >= 700 && c !== 46) return;
      out.push({
        label: d.name + ' landscape' + (c ? ' -' + c : ''),
        w: d.h, h: d.w - c, kind: 'landscape'
      });
    });
  });
  return out;
}

module.exports = { PHONES, TABLETS, CHROME, cases };
