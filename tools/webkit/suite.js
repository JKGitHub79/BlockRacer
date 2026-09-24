/* The cross-engine functional suite. The BODY of an async function, run
 * unchanged in Chromium (Playwright) and in WebKit (tools/webkit/wk.py) by
 * tools/cross-engine.js, which then compares the two field by field. It
 * returns facts rather than verdicts, so a difference between the engines
 * shows up as a difference rather than as two passes. */
const R = {};
const canStore = (() => { try { localStorage.clear(); return true; } catch (e) { return false; } })();
Progress.best = {}; Progress.laps = {}; Ghost.clearAll();
R.storage = canStore ? 'normal' : 'blocked';
const wait = ms => new Promise(r => setTimeout(r, ms));
const idx = id => TRACKS.findIndex(t => t.id === id);
const winRace = (id, place) => {
  Game.setMode('race'); Game.setCars(4); Screens.race(idx(id), 'play');
  const o = Game.cars.filter(c => !c.isPlayer);
  const order = o.slice(0, place - 1).concat([Game.player]).concat(o.slice(place - 1));
  order.forEach((c, k) => { c.finished = true; c.finishTime = 60 + k; });
  Game.results = order; Game.state = 'finished'; Game.showResults();
};
// ---- race mode, medals, unlock notifications
winRace('pinefall', 1);
R.raceTitle = document.getElementById('results-title').textContent;
R.racePrimary = document.querySelector('#results .row .primary').id;
R.toast1 = [...document.querySelectorAll('#unlock-toast .unlock-line')].map(x => x.textContent);
winRace('pinefall', 1);
R.toastRewin = Unlocks.visible();
winRace('hollow', 1); winRace('canopy', 1);
R.toastCombined = [...document.querySelectorAll('#unlock-toast .unlock-line')].map(x => x.textContent);
document.getElementById('btn-next').click();
R.toastDismissed = !Unlocks.visible();
// ---- shop
Screens.show('shop');
R.shopCount = document.getElementById('shop-count').textContent;
Cosmetics.equipSkin('cow'); Cosmetics.equipVehicle('hatch');
R.equipped = Cosmetics.equippedSkin().id + '/' + Cosmetics.equippedVehicle().id;
R.chipsPainted = [...document.querySelectorAll('#shop-grid canvas')].filter(c => {
  const d = c.getContext('2d').getImageData(c.width / 2, c.height / 2, 1, 1).data; return d[3] > 0; }).length;
// ---- progress page
Game.setMode('race'); Screens.progress = true; Screens.show('play');
R.progress = [...document.querySelectorAll('.pg-line b')].map(x => x.textContent).join(' | ');
document.querySelector('.pg-info').click();
R.helpOpens = !document.getElementById('pg-help').hidden;
document.body.click();
R.helpCloses = document.getElementById('pg-help').hidden;
// ---- time trial: ghost, delta, NEW BEST, replacement, TRY AGAIN, results
const trial = (id, laps, speeds) => {
  Game.setMode('trial'); Game.setLaps(laps); Screens.race(idx(id), 'play');
  const pl = Game.player, info = { ghostAtStart: !!Game.ghost };
  Game.drivers.push(new AIDriver(pl, { mistake: 0, reaction: 0.05, offset: 0 }, TRACK.gridFor(1)[0].wp));
  Game.countdown = -1; Game.state = 'racing';
  const base = pl.speed; let lap = -1, seen = {}, flashes = 0, last = null, deltaAt = {};
  for (let s = 0; s < 120 * 60 * 12 && Game.state === 'racing'; s++) {
    if (pl.lap !== lap) { lap = pl.lap; if (speeds[lap] !== undefined) pl.speed = base * speeds[lap]; }
    Game.step(CONFIG.dt);
    if (Game.ghostPose) seen[pl.lap] = 1;
    if (Game.delta !== null) deltaAt[pl.lap] = +Game.delta.toFixed(3);
    if (Game.pbFlash && Game.pbFlash !== last) { flashes++; last = Game.pbFlash; }
  }
  info.laps = pl.lapTimes.map(x => +x.toFixed(4)); info.ghostOnLaps = Object.keys(seen).join(',');
  info.flashes = flashes; info.deltaAtEndOfLap = deltaAt;
  return info;
};
R.trial1 = trial('duneline', 4, [1.00, 1.04, 0.97, 1.08]);
R.trialTitle = document.getElementById('results-title').textContent;
R.trialNote = document.getElementById('results-note').textContent;
R.trialPrimary = document.querySelector('#results .row .primary').id;
document.getElementById('btn-again').click();
R.ghostAfterTryAgain = !!Game.ghost;
Game.state = 'menu';
R.trial2 = trial('duneline', 2, [0.95, 0.95]);
R.recordKept = +Progress.lapRecord('duneline', CONFIG.speedLevel).toFixed(4);
// ---- pause RESTART
Game.setMode('race'); Game.setCars(4); Screens.race(idx('pinefall'), 'play');
Game.countdown = -1; Game.state = 'racing'; for (let s = 0; s < 300; s++) Game.step(CONFIG.dt);
Game.pauseRace(); document.getElementById('btn-pause-restart').click();
R.restart = Game.state + ' t=' + Game.time + ' lap=' + Game.player.lap;
// ---- render: board and ghost reach the canvas
Game.setMode('trial'); Game.setLaps(2); Screens.race(idx('duneline'), 'play');
Game.countdown = -1; Game.state = 'racing'; Game.player.speed *= 0.8;
for (let s = 0; s < 120 * 2; s++) Game.step(CONFIG.dt);
if (Game.ghostPose) {
  const cv = document.getElementById('game'), g = cv.getContext('2d'), k = cv.width / TRACK.width;
  const px = Math.round(Game.ghostPose.x * CONFIG.cell * k), py = Math.round(Game.ghostPose.y * CONFIG.cell * k);
  const sum = () => { const d = g.getImageData(px - 5, py - 5, 10, 10).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i+1] + d[i+2]; return s; };
  Game.state = 'paused'; Renderer.draw(Game); const a = sum();
  const keep = Game.ghostPose; Game.ghostPose = null; Renderer.draw(Game); const b = sum(); Game.ghostPose = keep;
  R.ghostOnCanvas = a > b;
} else R.ghostOnCanvas = 'no pose';
return R;
