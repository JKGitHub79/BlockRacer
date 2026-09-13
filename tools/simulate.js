/* Headless race: runs the real physics, AI and lap rules with no browser.
 * Proves the opponents can actually get round, and reports pace and crashes.
 *   node tools/simulate.js [laps] [races]
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { location: { search: '' }, console, Math, Date };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['js/config.js', 'js/track.js', 'js/car.js', 'js/ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f });
}
const { CONFIG, TRACK, Car, AIDriver } = sandbox;

const LAPS = parseInt(process.argv[2] || '5', 10);
const RACES = parseInt(process.argv[3] || '5', 10);

function race(seed) {
  // deterministic per-race randomness, so a bad race can be reproduced
  let rng = seed * 7919 + 1;
  sandbox.Math = Object.create(Math);
  sandbox.Math.random = () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  };
  const cars = [], drivers = [];
  TRACK.START_GRID.forEach((slot, i) => {
    const cfg = CONFIG.ai[i % CONFIG.ai.length];
    const car = new Car({
      id: i, name: 'AI' + i, color: '#fff',
      speedMul: cfg.speedMul, x: slot.x, y: slot.y, dir: { x: 1, y: 0 }
    });
    car.crashes = 0;
    car.lapTimes = [];
    TRACK.seedProgress(car);
    cars.push(car);
    drivers.push(new AIDriver(car, cfg, slot.wp));
  });

  const dt = CONFIG.dt;
  let t = 0;
  const LIMIT = 60 * 12;
  while (t < LIMIT && cars.some((c) => !c.finished)) {
    t += dt;
    drivers.forEach((d) => d.update(dt));
    for (const car of cars) {
      if (car.finished) continue;
      car.lapTime += dt;
      if (car.step(dt)) car.crashes++;
    }
    Car.separate(cars, dt);
    for (const car of cars) {
      if (car.finished) continue;
      if (TRACK.lapCheck(car)) {
        car.lap++;
        car.lapTimes.push(car.lapTime);
        car.lapTime = 0;
        if (car.lap >= LAPS) { car.finished = true; car.finishTime = t; }
      }
    }
  }
  return { cars, t };
}

let allOk = true;
const paces = [];
for (let r = 0; r < RACES; r++) {
  const { cars, t } = race(r);
  const line = cars.map((c) => {
    const best = c.lapTimes.length ? Math.min(...c.lapTimes).toFixed(2) : '-';
    const status = c.finished ? c.finishTime.toFixed(1) + 's' : 'DNF(lap ' + (c.lap + 1) + ')';
    if (!c.finished) allOk = false;
    c.lapTimes.forEach((x) => paces.push(x));
    return `${c.name} ${status} best=${best} crashes=${c.crashes}`;
  }).join('  |  ');
  console.log(`race ${r + 1}: ${line}`);
}

if (paces.length) {
  paces.sort((a, b) => a - b);
  console.log(`\nlap times over ${paces.length} laps: ` +
    `fastest ${paces[0].toFixed(2)}s  median ${paces[Math.floor(paces.length / 2)].toFixed(2)}s  ` +
    `slowest ${paces[paces.length - 1].toFixed(2)}s`);
}
if (!allOk) { console.error('\nAt least one AI car failed to finish.'); process.exit(1); }
console.log('\nAll AI cars finished ' + LAPS + ' laps in every race.');
