/* Geometry check for the track. Run with: node tools/validate-track.js
 *
 * Proves that a car of the configured size can drive the whole racing line -
 * including the sideways offsets the AI cars use - without ever touching a
 * wall, that it can rotate at every waypoint, and that the start grid and
 * every checkpoint sit on clear tarmac. */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {}, location: { search: '' }, console };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['js/tracks.js', 'js/config.js', 'js/track.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f });
}
const { CONFIG, TRACKS, TRACK } = sandbox;

const L = CONFIG.carLength / 2, W = CONFIG.carWidth / 2;
let errors = 0;
const fail = (msg) => { errors++; console.error('  FAIL ' + msg); };

function box(x, y, dir) {
  const hx = dir.x !== 0 ? L : W;
  const hy = dir.x !== 0 ? W : L;
  return [x - hx, y - hy, x + hx, y + hy];
}
const clear = (x, y, dir) => !TRACK.boxHitsWall(...box(x, y, dir));
const right = { x: 1, y: 0 };

let seen = 0;
function report() {
  if (errors === seen) console.log('    ok');
  seen = errors;
}

for (let ti = 0; ti < TRACKS.length; ti++) {
  TRACK.load(ti);
  console.log(`\nTrack ${ti + 1}: ${TRACK.name} (${TRACK.data.grade})`);


  const OFFSETS = [0, ...CONFIG.ai.map(a => a.offset * TRACK.aiOffsetScale)];

  console.log('  racing line, ' + OFFSETS.length + ' lateral offsets:');
  for (const off of OFFSETS) {
    const route = TRACK.offsetRoute(off);
    for (let i = 0; i < route.length; i++) {
      const a = route[i], b = route[(i + 1) % route.length];
      const d = TRACK.LEG_DIR[i];
      const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
      if (Math.abs(b.x - a.x) > 1e-9 && Math.abs(b.y - a.y) > 1e-9) {
        fail(`leg ${i} at offset ${off} is not axis aligned`);
      }
      for (let t = 0; t <= len; t += 0.05) {
        const x = a.x + d.x * t, y = a.y + d.y * t;
        if (!clear(x, y, d)) fail(`offset ${off} leg ${i} blocked at (${x.toFixed(2)}, ${y.toFixed(2)})`);
      }
      // the car must also survive the rotation at the end of the leg
      const dOut = TRACK.LEG_DIR[(i + 1) % route.length];
      if (!clear(b.x, b.y, dOut)) fail(`offset ${off} cannot rotate at waypoint ${(i + 1) % route.length}`);
    }
  }
  report();

  console.log('  start grid:');
  for (const s of TRACK.START_GRID) {
    if (!clear(s.x, s.y, right)) fail(`start slot (${s.x}, ${s.y}) is inside a wall`);
    if (TRACK.inZone(TRACK.FINISH, s.x, s.y)) fail(`start slot (${s.x}, ${s.y}) is on the finish line`);
    if (s.x > TRACK.FINISH.x0) fail(`start slot (${s.x}, ${s.y}) is past the finish line`);
  }
  report();

  console.log('  checkpoints on the racing line:');
  const zones = [...TRACK.CHECKPOINTS, TRACK.FINISH];
  zones.forEach((z, zi) => {
    let hit = false;
    for (const off of OFFSETS) {
      const route = TRACK.offsetRoute(off);
      for (let i = 0; i < route.length && !hit; i++) {
        const a = route[i], d = TRACK.LEG_DIR[i];
        const len = TRACK.LEG_LEN[i];
        for (let t = 0; t <= len; t += 0.02) {
          if (TRACK.inZone(z, a.x + d.x * t, a.y + d.y * t)) { hit = true; break; }
        }
      }
    }
    if (!hit) fail(`zone ${zi} is never crossed by the racing line`);
  });
  report();

    const last = TRACK.ROUTE[TRACK.ROUTE.length - 1], first = TRACK.ROUTE[0];
    if (last.x !== first.x && last.y !== first.y) fail('closing leg is not axis aligned');
    console.log('  ' + TRACK.length.toFixed(0) + ' cells per lap, ' +
      TRACK.cols + 'x' + TRACK.rows + ' cells, ' + TRACK.CHECKPOINTS.length + ' checkpoints');

}

if (errors) { console.error(`\n${errors} problem(s).`); process.exit(1); }
console.log(`\nAll ${TRACKS.length} tracks OK.`);
