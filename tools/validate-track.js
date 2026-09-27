/* Geometry check for the track. Run with: node tools/validate-track.js
 *
 * Proves that a car of the configured size can drive the whole racing line -
 * including the sideways offsets the AI cars use - without ever touching a
 * wall, that it can rotate at every waypoint, and that the start grid and
 * every checkpoint sit on clear tarmac. The tracks are read from the bundle
 * tools/build-tracks.js writes, so run that first after editing a file. */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {}, location: { search: '' }, console };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['js/trackfile.js', 'js/tracks.data.js', 'js/tracks.js', 'js/config.js',
                 'js/track.js', 'js/car.js', 'js/trackcheck.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f });
}
const { CONFIG, TRACKS, TRACK, TrackCheck } = sandbox;

// the slide radius to prove the corners against; the CLI can override it
if (process.argv[2]) CONFIG.slide = parseFloat(process.argv[2]);

/* The checks themselves live in js/trackcheck.js, so the level editor's
 * CHECK button runs exactly these and nothing looser. */
let errors = 0;
for (let ti = 0; ti < TRACKS.length; ti++) {
  TRACK.load(ti);
  console.log(`\nTrack ${ti + 1}: ${TRACK.name} (${TRACK.data.grade})`);
  const r = TrackCheck.run();
  for (const sec of r.sections) {
    console.log('  ' + sec.name);
    sec.problems.forEach((m) => console.error('  FAIL ' + m));
    if (!sec.problems.length) console.log('    ok');
    errors += sec.problems.length;
  }
  console.log('  ' + r.summary);
}

if (errors) { console.error(`\n${errors} problem(s).`); process.exit(1); }
console.log(`\nAll ${TRACKS.length} tracks OK.`);
