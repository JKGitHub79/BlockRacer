/* ASCII picture of a track, for designing one. Run with:
 *   node tools/map.js <1-based track number>
 *
 * '#' is scenery, '=' a jog block, '.' road, and digits mark the route's
 * waypoints. 'S' is a start-grid slot and 'F' the finish line. It is a design
 * aid rather than a check - tools/validate-track.js is the check - but a
 * layout that looks wrong here is wrong, and seeing it costs nothing.
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const sandbox = { window: {}, location: { search: '' }, console };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['js/tracks.js', 'js/config.js', 'js/track.js', 'js/car.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f });
}
const { TRACKS, TRACK } = sandbox;
const idx = parseInt(process.argv[2] || '1', 10) - 1;
TRACK.load(idx);
const d = TRACK.data;

const g = [];
for (let y = 0; y < TRACK.rows; y++) {
  const row = [];
  for (let x = 0; x < TRACK.cols; x++) {
    row.push(TRACK.isWall(x, y) ? (TRACK.wallKind(x, y) === 3 ? '=' : '#') : '.');
  }
  g.push(row);
}
const put = (x, y, ch) => {
  const cx = Math.round(x), cy = Math.round(y);
  if (g[cy] && g[cy][cx] !== undefined) g[cy][cx] = ch;
};
// the racing line itself
for (let i = 0; i < d.route.length; i++) {
  const a = d.route[i], b = d.route[(i + 1) % d.route.length];
  const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
  const n = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
  for (let t = 0; t <= n; t += 0.5) put(a.x + dx * t, a.y + dy * t, g[Math.round(a.y + dy * t)] &&
    g[Math.round(a.y + dy * t)][Math.round(a.x + dx * t)] === '.' ? '-' : '!');
}
d.checkpoints.forEach((c, i) => {
  for (let y = c.y0; y <= c.y1; y += 0.5) for (let x = c.x0; x <= c.x1; x += 0.5) put(x, y, 'c');
});
const f = d.finish;
for (let y = f.y0; y <= f.y1; y += 0.5) for (let x = f.x0; x <= f.x1; x += 0.5) put(x, y, 'F');
d.route.forEach((p, i) => put(p.x, p.y, String(i % 36 < 10 ? i % 36 : String.fromCharCode(87 + (i % 36)))));
d.startGrid.forEach((s) => put(s.x, s.y, 'S'));

console.log(`${idx + 1}. ${d.name} (${d.grade})  ${TRACK.cols}x${TRACK.rows}`);
const tens = [' ', ' ', ' '].map(() => '');
let head = '    ';
for (let x = 0; x < TRACK.cols; x++) head += (x % 10 === 0 ? String((x / 10) % 10) : ' ');
console.log(head);
let head2 = '    ';
for (let x = 0; x < TRACK.cols; x++) head2 += String(x % 10);
console.log(head2);
g.forEach((row, y) => console.log(String(y).padStart(3, ' ') + ' ' + row.join('')));
console.log('  # scenery   = jog   - racing line   digits waypoints   c checkpoint   F finish   S grid');
