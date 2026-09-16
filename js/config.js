/* Block Racer - tunable settings.
 * Everything a designer would want to change lives here. */
(function (global) {
  'use strict';

  // One car width across the back axle. Named here so `slide` can be stated in
  // terms of it rather than repeating the number.
  var CAR_WIDTH = 0.8;

  var CONFIG = {
    /* ---- Race rules ------------------------------------------------- */
    track: 0,             // which entry of js/tracks.js. ?track=N or the menu.
    laps: 5,              // race length. Override with ?laps=N or the menu.
    minLaps: 1,
    maxLaps: 20,
    countdown: 3,         // seconds of 3..2..1..GO before the lights drop

    /* ---- World ------------------------------------------------------ */
    cell: 24,             // pixels per grid cell. Shared by every track, so
                          // that a track with wider roads really is wider.

    /* ---- Car -------------------------------------------------------- */
    carLength: 1.25,      // in cells, measured along the direction of travel
    carWidth: CAR_WIDTH,
    speed: 10.4,          // cells / second. One speed, no acceleration.

    /* Slide. The car still only ever does 90 degree turns, but its momentum
     * no longer turns with it instantly: the velocity swings round to the new
     * heading at a fixed rate, so the car arcs through the corner and you have
     * to turn this far EARLY to come out on line.
     *
     * The number is the turn radius in cells. 0 turns slide off completely and
     * the game behaves exactly as it did before. It is a distance rather than
     * a time so that the lead you need stays the same at every game speed -
     * Staircase has two-cell legs between its chicanes and a radius that grew
     * with speed would stop fitting through them.
     *
     * This is the starting value only - it is a slider on the start menu and
     * [ and ] adjust it mid-race, because it is the number worth prototyping
     * with. Every car reads it live, player and AI alike.
     *
     * The default is one car width. Note that is past the 0.47 that
     * Staircase's chicanes clear: there the arc cuts the corner far enough to
     * clip the block it is stepping around, on the lines the AI cars drive
     * slightly off-centre. Crossover has room for 2.0. `npm run check` drives
     * every corner of every track at a given radius and says which ones stop
     * fitting: `node tools/validate-track.js 1.2`. */
    slide: CAR_WIDTH,
    /* Top of the slider. Far past anything drivable - a radius wider than the
     * road means the car cannot get round a corner without meeting a wall -
     * but this is a prototyping control, and seeing where it stops working is
     * the point of having the range. */
    maxSlide: 20,

    /* How far the body leads its own direction of travel while sliding.
     * 0.5 points it exactly half way, so a car that has just flicked into a
     * corner sits at 45 degrees to the way it is actually going. */
    slideOversteer: 0.5,

    /* Seconds for the body to straighten up again out of full lean. Purely
     * cosmetic: the car flicks to its 45 degrees instantly and then unwinds no
     * faster than this, so the drift stays on screen long enough to read at a
     * radius small enough for Staircase's chicanes. Nothing about where the
     * car actually is or what it collides with depends on it. */
    slideSettle: 0.14,

    /* How much of a car's speed has to be running ALONG a wall, rather than
     * into it, for the contact to count as a scrape rather than a crash.
     *
     * A car that drives squarely into a wall still stops dead and still waits
     * for a turn, as it always has. But sliding through a corner makes a car
     * travel diagonally, and clipping an edge on the way round used to be
     * punished exactly as hard as driving head-on into it. Now it scrubs along
     * the wall instead, losing whatever speed the wall takes off it.
     *
     * At slide 0 a car's velocity is always exactly on an axis, so nothing is
     * ever running along the wall, every contact is head-on, and this changes
     * nothing whatsoever. Set it to 0 to get the same everywhere; 1 would make
     * a car unstoppable. */
    graze: 0.3,

    /* ---- Game speed --------------------------------------------------- */
    /* Picked on the start menu. Scales every car, player and AI alike. */
    speedLevel: 0,
    speedLevels: [
      { name: 'BEGINNER',     mul: 1.0 },
      { name: 'INTERMEDIATE', mul: 1.2 },
      { name: 'EXPERT',       mul: 1.4 },
      { name: 'SWEAT',        mul: 2.0 }
    ],

    /* ---- Road colour -------------------------------------------------
     * Purely a look. Picked on the start menu so colour schemes can be tried
     * against a real track without editing anything, and it changes nothing
     * about where a wall is or how a car drives.
     *
     * Entry 0 overrides nothing, so each track keeps the near-black tarmac its
     * own theme asks for. The rest replace the road and its grid outright. The
     * light ones also have to flip the markings painted ON the road - the
     * racing line and the checkpoint tints are pale by default and vanish on
     * anything lighter than they are - so they carry their own dark set. */
    roadTint: 0,
    roadTints: [
      { name: 'BLACK' },
      { name: 'DARK GREY', colors: {
        road: '#2b2e34', roadLine: '#363a42' } },
      { name: 'LIGHT GREY', colors: {
        road: '#b6bac1', roadLine: '#a4a9b2',
        racingLine: 'rgba(28,38,58,0.30)',
        check: 'rgba(20,60,95,0.08)', checkNext: 'rgba(20,60,95,0.24)' } },
      { name: 'WHITE', colors: {
        road: '#eceef2', roadLine: '#d6d9df',
        racingLine: 'rgba(28,38,58,0.30)',
        check: 'rgba(20,60,95,0.08)', checkNext: 'rgba(20,60,95,0.24)' } },
      { name: 'LIGHT BROWN', colors: {
        road: '#c0a079', roadLine: '#ae8f6a',
        racingLine: 'rgba(44,28,12,0.32)',
        check: 'rgba(70,40,10,0.09)', checkNext: 'rgba(70,40,10,0.26)' } },
      { name: 'BROWN', colors: {
        road: '#6a4d33', roadLine: '#5a402a' } }
    ],

    /* ---- AI (one entry per opponent) -------------------------------- */
    ai: [
      { speedMul: 0.985, mistake: 0.05, reaction: 0.18, offset:  0.00 },
      { speedMul: 0.960, mistake: 0.08, reaction: 0.26, offset:  0.30 },
      { speedMul: 0.930, mistake: 0.12, reaction: 0.34, offset: -0.30 }
    ],

    /* ---- Simulation ------------------------------------------------- */
    dt: 1 / 120,          // fixed physics step
    maxFrame: 0.25,       // clamp huge frame gaps (tab was backgrounded)

    /* ---- Look ------------------------------------------------------- */
    colors: {
      bg:        '#070a11',
      road:      '#10151f',
      roadLine:  '#171f2e',
      wall:      '#38456a',   // infield islands
      wallTop:   '#6076b0',
      outer:     '#28314d',   // ground outside the circuit, and the border
      outerTop:  '#44537f',
      jog:       '#5a4270',   // the blocks that force the staircase
      jogTop:    '#c88a3c',
      startLine: '#f2f5ff',
      racingLine:'rgba(120,180,255,0.22)',
      check:     'rgba(90,220,255,0.07)',
      checkNext: 'rgba(90,220,255,0.26)'
    }
  };

  // URL parameters win over the defaults.
  var search = global.location ? global.location.search : '';
  var laps = /[?&]laps=(\d+)/.exec(search);
  if (laps) {
    CONFIG.laps = Math.max(CONFIG.minLaps, Math.min(CONFIG.maxLaps, parseInt(laps[1], 10)));
  }
  var track = /[?&]track=(\d+)/.exec(search);
  if (track) {
    CONFIG.track = Math.max(0, Math.min(global.TRACKS.length - 1, parseInt(track[1], 10) - 1));
  }
  var road = /[?&]road=(\d+)/.exec(search);
  if (road) {
    CONFIG.roadTint = Math.max(0,
      Math.min(CONFIG.roadTints.length - 1, parseInt(road[1], 10)));
  }
  var speed = /[?&]speed=(\d+)/.exec(search);
  if (speed) {
    CONFIG.speedLevel = Math.max(0, Math.min(CONFIG.speedLevels.length - 1, parseInt(speed[1], 10) - 1));
  }
  var slide = /[?&]slide=([\d.]+)/.exec(search);
  if (slide) CONFIG.slide = Math.max(0, Math.min(CONFIG.maxSlide, parseFloat(slide[1])));
  var graze = /[?&]graze=([\d.]+)/.exec(search);
  if (graze) CONFIG.graze = Math.max(0, Math.min(1, parseFloat(graze[1])));

  CONFIG.speedMul = function () {
    return CONFIG.speedLevels[CONFIG.speedLevel].mul;
  };
  CONFIG.roadColors = function () {
    return CONFIG.roadTints[CONFIG.roadTint].colors || null;
  };
  CONFIG.roadName = function () {
    return CONFIG.roadTints[CONFIG.roadTint].name;
  };
  CONFIG.speedName = function () {
    return CONFIG.speedLevels[CONFIG.speedLevel].name;
  };

  global.CONFIG = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
