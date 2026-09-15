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
    maxSlide: 2,

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

    /* ---- Game speed --------------------------------------------------- */
    /* Picked on the start menu. Scales every car, player and AI alike. */
    speedLevel: 0,
    speedLevels: [
      { name: 'BEGINNER',     mul: 1.0 },
      { name: 'INTERMEDIATE', mul: 1.2 },
      { name: 'EXPERT',       mul: 1.4 },
      { name: 'SWEAT',        mul: 2.0 }
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
  var speed = /[?&]speed=(\d+)/.exec(search);
  if (speed) {
    CONFIG.speedLevel = Math.max(0, Math.min(CONFIG.speedLevels.length - 1, parseInt(speed[1], 10) - 1));
  }
  var slide = /[?&]slide=([\d.]+)/.exec(search);
  if (slide) CONFIG.slide = Math.max(0, Math.min(CONFIG.maxSlide, parseFloat(slide[1])));

  CONFIG.speedMul = function () {
    return CONFIG.speedLevels[CONFIG.speedLevel].mul;
  };
  CONFIG.speedName = function () {
    return CONFIG.speedLevels[CONFIG.speedLevel].name;
  };

  global.CONFIG = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
