/* Block Racer - tunable settings.
 * Everything a designer would want to change lives here. */
(function (global) {
  'use strict';

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
    carWidth: 0.8,
    speed: 10.4,          // cells / second. One speed, no acceleration.

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

  global.CONFIG = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
