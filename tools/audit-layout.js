/* Walk every screen at every device size and report anything that does not
 * fit. Run with: node tools/audit-layout.js [--all]
 *
 * Needs Playwright, which is why this is not part of `npm run check` - the
 * two tools under tools/ that are run everywhere need nothing but Node. This
 * one is for when the layout changes.
 */
'use strict';
const path = require('path');
const { cases } = require('./devices.js');

let chromium;
try {
  chromium = require('playwright').chromium;
} catch (e) {
  try { chromium = require('/opt/node22/lib/node_modules/playwright').chromium; }
  catch (e2) {
    console.error('Playwright not found. npm i -D playwright, then re-run.');
    process.exit(2);
  }
}

const FILE = 'file://' + path.join(__dirname, '..', 'index.html');
const VERBOSE = process.argv.includes('--all');

/* What each screen has to be able to show. A screen is allowed to SCROLL
 * vertically - they all do, and a phone user knows how - but it is never
 * allowed to run off the side, and the thing you came to the screen to press
 * has to be reachable. */
/* `fits: true` means the screen has to be wholly visible without scrolling.
 * The options screen is exempt - it is a long list of settings and scrolling
 * it is normal - and the results panel scrolls its table inside itself. */
const SCREENS = [
  { name: 'main',    go: 'Screens.show("main")', fits: true, box: '#screen-main',
    must: ['#btn-play', '#btn-options'] },
  { name: 'mode',    go: 'Screens.show("mode")', fits: true, box: '#screen-mode',
    must: ['#btn-mode-race', '#btn-mode-trial'] },
  { name: 'play',    go: 'Game.setMode("race"); Screens.theme = 3; Screens.show("play")',
    fits: true, box: '#screen-play',
    must: ['#theme-cards .card', '#theme-prev', '#theme-next'] },
  { name: 'options', go: 'Screens.show("options")', box: '#screen-options',
    must: ['#slide-range', '#cars-range', '#ai-range', '#btn-reset'] },
  { name: 'race',    go: 'Game.setCars(8); Screens.race(11, "play")', fits: true,
    must: ['#game', '.hud', '#btn-home'] },
  { name: 'results', go: 'Game.state = "racing"; Game.showResults()',
    must: ['#btn-quit', '#btn-again', '#results-body tr'] }
];

(async () => {
  const browser = await chromium.launch();
  const list = cases();
  const problems = [];
  const boards = [];
  let checks = 0;

  for (const c of list) {
    const page = await browser.newPage({
      viewport: { width: c.w, height: c.h }, deviceScaleFactor: 2,
      isMobile: c.w < 900, hasTouch: true
    });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(FILE);
    await page.waitForFunction(() => window.Game && window.Screens);

    /* Be the phone, not the desktop browser pretending to be one: hold the
     * visible height below the window the way a browser toolbar does, and
     * put a notch on it. Both go through the same custom properties the
     * stylesheet reads, so this exercises the real code path. */
    await page.evaluate(({ visible, insets }) => {
      const r = document.documentElement;
      r.style.setProperty('--app-h', visible + 'px');
      r.style.setProperty('--sa-t', insets[0] + 'px');
      r.style.setProperty('--sa-r', insets[1] + 'px');
      r.style.setProperty('--sa-b', insets[2] + 'px');
      r.style.setProperty('--sa-l', insets[3] + 'px');
      // and stop js/viewport.js putting the window's height back
      window.Viewport.measure = function () {};
    }, { visible: c.visible, insets: c.insets });
    await page.waitForTimeout(60);

    /* The fix itself, asserted directly: every full-screen layer has to be
     * as tall as the VISIBLE viewport, not as tall as the window. This is
     * the check that would have caught `inset: 0` and `100vh` - both of
     * which look perfect in a desktop browser, where the two are the same
     * number, and hide the bottom of the page on every iPhone. */
    const layers = await page.evaluate(() => {
      const out = {};
      [['html', document.documentElement], ['body', document.body],
       ['#backdrop', document.getElementById('backdrop')],
       ['.screen', document.getElementById('screen-main')],
       ['.overlay', document.getElementById('results')]].forEach(([n, el]) => {
        if (!el) return;
        const prev = el.style.display;
        if (getComputedStyle(el).display === 'none') el.style.display = 'flex';
        out[n] = Math.round(el.getBoundingClientRect().height);
        el.style.display = prev;
      });
      return out;
    });
    Object.entries(layers).forEach(([n, h]) => {
      if (Math.abs(h - c.visible) > 1) {
        problems.push(`${c.label} (${c.w}x${c.h}, ${c.visible} visible): ` +
          `${n} is ${h}px tall, should be ${c.visible} - it will run under ` +
          `the browser's own toolbar on iOS`);
      }
    });
    checks += Object.keys(layers).length;

    for (const sc of SCREENS) {
      await page.evaluate(sc.go);
      await page.waitForTimeout(60);
      const r = await page.evaluate(({ must, box, visible, insets }) => {
        // What the user can actually see, not what the window claims.
        const VH = visible;
        const SAFE = { t: insets[0], r: insets[1], b: insets[2], l: insets[3] };
        const doc = document.documentElement;
        const out = {
          hScroll: doc.scrollWidth - window.innerWidth,
          missing: [], offRight: [], offBottom: [], tiny: []
        };
        const b = box && document.querySelector(box);
        /* documentElement.scrollHeight is never reported as less than the
         * viewport, so it cannot answer "does the content fit" at document
         * level. For the race view, which is not a .screen, measure what the
         * content actually reaches instead. */
        if (b) {
          out.vScroll = b.scrollHeight - b.clientHeight;
        } else {
          const shell = document.querySelector('.shell');
          out.vScroll = shell
            ? Math.max(0, Math.round(shell.getBoundingClientRect().bottom - (VH - SAFE.b)))
            : 0;
        }
        must.forEach((sel) => {
          const els = document.querySelectorAll(sel);
          if (!els.length) { out.missing.push(sel); return; }
          els.forEach((el) => {
            const b = el.getBoundingClientRect();
            if (b.width < 1 || b.height < 1) { out.tiny.push(sel); return; }
            // Off the SIDE is a bug. Off the bottom is a scroll.
            if (b.right > window.innerWidth - SAFE.r + 1 || b.left < SAFE.l - 1) {
              out.offRight.push(sel);
            }
            if (b.bottom > VH - SAFE.b + 1 || b.top < SAFE.t - 1) out.offBottom.push(sel);
          });
        });
        // the carousel must keep its three cards in one row
        const cards = document.querySelectorAll('#theme-cards .card');
        if (cards.length === 3) {
          const tops = Array.prototype.map.call(cards, (c) => Math.round(c.getBoundingClientRect().top));
          out.stacked = !(tops[0] === tops[1] && tops[1] === tops[2]);
        }
        const board = document.getElementById('game').getBoundingClientRect();
        out.board = { w: Math.round(board.width), h: Math.round(board.height),
                      pct: Math.round(100 * board.width * board.height /
                                      (window.innerWidth * VH)) };
        /* Anything you are meant to press has to be big enough to press.
         * 44px is Apple's number and 48 is Google's; 40 is the floor here,
         * because the arrows and the back button are secondary. */
        out.small = [];
        must.forEach(function (sel) {
          document.querySelectorAll(sel).forEach(function (el) {
            if (el.tagName !== 'BUTTON' && el.type !== 'range') return;
            var r = el.getBoundingClientRect();
            if (r.height < 40 || r.width < 40) {
              out.small.push(sel + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
            }
          });
        });
        return out;
      }, { must: sc.must, box: sc.box, visible: c.visible, insets: c.insets });
      checks++;

      const bad = [];
      if (r.hScroll > 1) bad.push('runs ' + r.hScroll + 'px off the side');
      if (r.missing.length) bad.push('missing ' + r.missing.join(','));
      if (r.tiny.length) bad.push('zero-sized ' + [...new Set(r.tiny)].join(','));
      if (r.offRight.length) bad.push('off the side: ' + [...new Set(r.offRight)].join(','));
      if (sc.fits && r.vScroll > 1) bad.push('needs ' + r.vScroll + 'px of scroll');
      if (sc.fits && r.offBottom.length) {
        bad.push('under the browser chrome or the notch: ' +
                 [...new Set(r.offBottom)].join(','));
      }
      if (sc.name === 'play' && r.stacked) bad.push('cards stacked instead of side by side');
      if (sc.name === 'race' && r.board.w < 120) bad.push('board only ' + r.board.w + 'x' + r.board.h);
      if (r.small.length) bad.push('too small to press: ' + [...new Set(r.small)].join(', '));
      if (sc.name === 'race') boards.push({ label: c.label, w: c.w, h: c.h, b: r.board });
      if (bad.length) problems.push(`${c.label} (${c.w}x${c.h}) / ${sc.name}: ${bad.join('; ')}`);
      else if (VERBOSE) console.log(`  ok  ${c.label} ${c.w}x${c.h} ${sc.name}` +
        (sc.name === 'race' ? '  board ' + r.board.w + 'x' + r.board.h : ''));
    }
    if (errs.length) problems.push(`${c.label}: page error ${errs[0]}`);
    await page.close();
  }

  await browser.close();

  boards.sort((a, b) => a.b.pct - b.b.pct);
  console.log('\nboard size, worst first:');
  boards.slice(0, 6).concat(['...'], boards.slice(-3)).forEach((x) => {
    if (x === '...') { console.log('  ...'); return; }
    console.log('  ' + String(x.b.pct + '%').padStart(4) + '  ' +
      String(x.b.w + 'x' + x.b.h).padEnd(9) + '  ' + x.label + ' (' + x.w + 'x' + x.h + ')');
  });

  console.log('\n' + checks + ' checks across ' + list.length + ' screen sizes');
  if (!problems.length) { console.log('no layout problems.'); process.exit(0); }
  console.log('\n' + problems.length + ' problem(s):');
  problems.forEach((p) => console.log('  ' + p));
  process.exit(1);
})();
