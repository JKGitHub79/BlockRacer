/* Bundle the track files. Run with: node tools/build-tracks.js
 *
 * Reads every tracks/<theme>/<id>.json, checks it, and writes
 * js/tracks.data.js - the one file the game loads its tracks from. The game
 * cannot list a folder (not from GitHub Pages, and not opened straight off
 * the disk), so a track that is not in the bundle does not exist.
 *
 * .github/workflows/tracks.yml runs this whenever something under tracks/
 * is pushed - which is what makes uploading a file on github.com enough to
 * change the game - and commits what it changed.
 *
 * A file's own `theme` and `id` say where it belongs, not its name or its
 * folder. An upload that landed somewhere else - `pinefall (1).json`, which
 * is what a browser calls a second download of the same file, or a file
 * dropped in tracks/ itself - is moved to tracks/<theme>/<id>.json, and
 * REPLACES the file that was there: the newcomer is the one somebody meant
 * to upload.
 *
 *   node tools/build-tracks.js          check, move, and write the bundle
 *   node tools/build-tracks.js --check  change nothing; fail if the bundle
 *                                       is out of date or a file is misplaced
 *
 * It fails - and writes nothing - on a file the game could not load. A track
 * a car cannot drive cleanly is only a warning here (the editor's CHECK and
 * tools/validate-track.js say exactly where): that is a design problem, and
 * one the game has shipped before, not a broken build.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'tracks');
const OUT = path.join(ROOT, 'js', 'tracks.data.js');
const CHECK_ONLY = process.argv.includes('--check');
const GH = !!process.env.GITHUB_ACTIONS;

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const errors = [], warnings = [];
const error = (file, msg) => {
  errors.push(`${file}: ${msg}`);
  if (GH) console.log(`::error file=${file}::${msg}`);
};
const warn = (file, msg) => {
  warnings.push(`${file}: ${msg}`);
  if (GH) console.log(`::warning file=${file}::${msg}`);
};

function load(files, extra) {
  const sandbox = Object.assign({ location: { search: '' }, console }, extra || {});
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of files) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
  }
  return sandbox;
}

const base = load(['js/trackfile.js', 'js/tracks.js', 'js/themes.js']);
const { TrackFile, PALETTES, THEMES } = base;

/* ---- find and read ------------------------------------------------------ */

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return walk(p);
    return /\.json$/i.test(d.name) ? [p] : [];
  });
}

const found = [];
for (const p of walk(DIR)) {
  const name = rel(p);
  let file;
  try {
    // A byte-order mark is what some editors put at the top of a file.
    file = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    error(name, 'is not valid JSON - ' + e.message);
    continue;
  }
  if (!file || typeof file !== 'object' || typeof file.id !== 'string' || typeof file.theme !== 'string') {
    error(name, 'is not a track file (it needs an "id" and a "theme")');
    continue;
  }
  found.push({ path: p, name, file, want: TrackFile.path(file) });
}

/* ---- where each one belongs ---------------------------------------------- */

const byTarget = new Map();
for (const f of found) {
  if (!byTarget.has(f.want)) byTarget.set(f.want, []);
  byTarget.get(f.want).push(f);
}
const moves = [], removes = [], chosen = [];
for (const [want, list] of byTarget) {
  const home = list.filter((f) => f.name === want);
  const away = list.filter((f) => f.name !== want);
  if (away.length > 1) {
    error(want, 'is claimed by ' + away.map((f) => f.name).join(' and ') +
      ' - keep one of them');
    continue;
  }
  if (away.length) {
    moves.push({ from: away[0], to: want });
    if (home.length) removes.push(home[0]);
    chosen.push(away[0]);
  } else {
    chosen.push(home[0]);
  }
}

/* ---- is each one a track the game can load? -------------------------------- */

const ids = new Map();
for (const f of chosen) {
  for (const msg of TrackFile.check(f.file, { themes: THEMES, palettes: PALETTES })) error(f.name, msg);
  const other = ids.get(f.file.id);
  if (other) error(f.name, `has the same id as ${other.name}`);
  ids.set(f.file.id, f);
}

if (errors.length) {
  console.error(`\n${errors.length} problem(s) - nothing was written:\n`);
  errors.forEach((e) => console.error('  ' + e));
  process.exit(1);
}

/* ---- order: the play screen's, then adhoc, then the tutorial's ----------- */

const slot = {};
THEMES.forEach((th, t) => th.tracks.forEach((e, k) => { slot[e.id] = t * 100 + k; }));
const rank = (f) => f.tutorial ? [2, 0, f.id]
  : f.theme !== TrackFile.ADHOC ? [0, slot[f.id], f.id]
  : [1, f.order === undefined ? Infinity : f.order, f.id];
const files = chosen.map((c) => c.file).sort((a, b) => {
  const x = rank(a), y = rank(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
});

/* ---- can a car drive each one? ---------------------------------------------
 * The same proof tools/validate-track.js runs, on the tracks as bundled.
 * Reported, not enforced - see the top of this file. */

const game = load(['js/trackfile.js', 'js/tracks.js', 'js/config.js', 'js/track.js',
                   'js/car.js', 'js/trackcheck.js'], { TRACK_FILES: files });
game.TRACKS.forEach((t, i) => {
  game.TRACK.load(i);
  const r = game.TrackCheck.run();
  if (r.problems) {
    const first = r.sections.find((s) => s.problems.length).problems[0];
    warn(TrackFile.path(files[i]), `${r.problems} driving problem(s), first: ${first}`);
  }
});

/* ---- write ----------------------------------------------------------------- */

const text =
  '/* GENERATED by tools/build-tracks.js from the files in tracks/ - do not edit.\n' +
  ' * Edit a track file (or use the level editor) and run the build again;\n' +
  ' * on GitHub that happens by itself when anything under tracks/ is pushed. */\n' +
  '(function (global) {\n' +
  '  global.TRACK_FILES = [\n' +
  files.map((f) => '    ' + JSON.stringify(f)).join(',\n') + '\n' +
  '  ];\n' +
  "})(typeof window !== 'undefined' ? window : globalThis);\n";

const stale = !fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== text;

/* index.html loads the bundle as tracks.data.js?v=<version>.<stamp>, so a
 * browser holding the last build cannot keep serving it once the page has
 * been reloaded: the stamp is a hash of the bundle, and changes with it. */
const HTML = path.join(ROOT, 'index.html');
let stamp = 0x811c9dc5;
for (let i = 0; i < text.length; i++) stamp = Math.imul(stamp ^ text.charCodeAt(i), 16777619) >>> 0;
stamp = ('0000000' + stamp.toString(16)).slice(-8);
const html = fs.readFileSync(HTML, 'utf8');
const STAMP = /(\btracks: ')[0-9a-f]*(')/;
if (!STAMP.test(html)) error('index.html', "has no tracks: '...' stamp in window.BR");
const htmlOut = html.replace(STAMP, '$1' + stamp + '$2');
const staleHtml = htmlOut !== html;

if (errors.length && !CHECK_ONLY) {
  errors.forEach((e) => console.error('  ' + e));
  process.exit(1);
}

if (CHECK_ONLY) {
  moves.forEach((m) => error(m.from.name, `belongs at ${m.to} - run node tools/build-tracks.js`));
  if (stale) error(rel(OUT), 'is out of date with tracks/ - run node tools/build-tracks.js');
  if (staleHtml) error('index.html', 'has the wrong tracks stamp - run node tools/build-tracks.js');
  if (errors.length) {
    errors.forEach((e) => console.error('  ' + e));
    process.exit(1);
  }
  console.log(`${files.length} track files, bundle up to date` +
    (warnings.length ? `, ${warnings.length} with driving problems` : '') + '.');
  process.exit(0);
}

for (const r of removes) {
  fs.unlinkSync(r.path);
  console.log(`replaced ${r.name}`);
}
for (const m of moves) {
  const to = path.join(ROOT, m.to);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(m.from.path, to);
  console.log(`moved ${m.from.name} -> ${m.to}`);
}
// Tidy what a move left behind, and keep the canonical file canonical: the
// same text the editor exports, so a hand edit and an export diff alike.
for (const f of files) {
  const p = path.join(ROOT, TrackFile.path(f));
  const want = TrackFile.stringify(f);
  if (fs.readFileSync(p, 'utf8') !== want) {
    fs.writeFileSync(p, want);
    console.log(`reformatted ${TrackFile.path(f)}`);
  }
}
if (stale) fs.writeFileSync(OUT, text);
if (staleHtml) fs.writeFileSync(HTML, htmlOut);
warnings.forEach((w) => console.log('  warning: ' + w));
console.log(`${files.length} tracks ${stale ? 'written to' : 'already in'} ${rel(OUT)}.`);
