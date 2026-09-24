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
    deepLink: false,      // set when the URL named a track, which starts it
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
     * The default is one car width. It is past the 0.47 that Staircase's
     * chicanes clear - there the arc cuts the corner far enough to clip the
     * block it is stepping around - and well under the 2.0 Crossover has room
     * for. The whole ladder in the README is measured at this radius.
     *
     * It shipped at 3.0 for a while, which is near the top of what any track
     * can take. Every corner became a scrape and the difficulty spread
     * collapsed: at that radius the car is still arcing when it reaches the
     * next corner, so gate margin stops being a difficulty lever and becomes
     * a wall. `npm run check` drives every corner of every track at a given
     * radius and says which ones stop fitting:
     * `node tools/validate-track.js 1.2`. */
    slide: CAR_WIDTH,
    /* Top of the slider. Far past anything drivable - a radius wider than the
     * road means the car cannot get round a corner without meeting a wall -
     * but this is a prototyping control, and seeing where it stops working is
     * the point of having the range. */
    maxSlide: 20,

    /* How far the body leads its own direction of travel while sliding, in
     * DEGREES. A turn is a right angle, so this runs 0 to 90: 45 points the
     * car exactly half way, which is the pose a car that has just flicked
     * into a corner is drawn in.
     *
     * Cosmetic in the strict sense. The lean is added at the moment the car
     * is DRAWN and is never read back: where the car is, what it hits, what
     * the AI aims at and when a lap is scored all come from `velAngle` and
     * `dir`, and this touches neither. At 0 the car is drawn square to the
     * way it is travelling and at 90 fully sideways, and it goes to exactly
     * the same places, at the same speed, either way. Starts at 0 - the car
     * points where it is going - because that is what most people expect a
     * car to do; 45 is the pose the game drew before it was a setting. */
    oversteer: 0,
    minOversteer: 0,
    maxOversteer: 90,

    /* A halo under YOUR car, in your own colour. Six cars of six colours on
     * a dark track is a lot to pick yourself out of at speed, and the white
     * outline the player has always had is one pixel wide. Cosmetic, live,
     * and the player's car only - an AI with a halo would be a tell. */
    playerGlow: true,

    /* HIGH CONTRAST. Off by default; an option, not a theme. When it is on it
     * replaces the palette of whichever track you are driving, so it reaches
     * all thirty-seven of them rather than being a thirty-eighth.
     *
     * It is built on LUMINANCE and not on hue, which is the whole point: a
     * palette that separates by colour is exactly what fails for the people
     * who need this. Black road against a white solid is a contrast ratio of
     * about 20:1 and reads the same to every kind of colour vision, including
     * none at all. */
    contrast: false,

    /* Seconds for the body to straighten up again out of full lean. Purely
     * cosmetic: the car flicks to its full oversteer instantly and then
     * unwinds no faster than this, so the drift stays on screen long enough
     * to read at a
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
    speedLevel: 3,        // SWEAT
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

    /* ---- Field size ---------------------------------------------------
     * Six - you and five - unless the start menu says otherwise. A track
     * only grids as many as its road holds, so the number asked for here is
     * a ceiling rather than a promise: Staircase's four-cell corridor tops
     * out at nine, and js/track.js reports what actually fit. */
    cars: 6,
    minCars: 2,
    maxCars: 16,

    /* ---- AI (one entry per opponent) --------------------------------
     * Three hand-tuned opponents. A default race uses exactly these, in this
     * order, so it is the race it has always been; CONFIG.aiSpec fills in the
     * rest of a bigger field. */
    ai: [
      { speedMul: 0.985, mistake: 0.05, reaction: 0.18, offset:  0.00 },
      { speedMul: 0.960, mistake: 0.08, reaction: 0.26, offset:  0.30 },
      { speedMul: 0.930, mistake: 0.12, reaction: 0.34, offset: -0.30 }
    ],

    /* ---- AI level -----------------------------------------------------
     * How WELL the opponents drive - 1 to 10, set on the options screen and
     * remembered between sessions.
     *
     * It scales the two things that actually make an AI car beatable: how
     * often it turns too late for a corner, and how long it flounders before
     * it has sorted itself out again. Nothing else about them changes.
     *
     * Level 5 is exactly the hand-tuned field above - every multiplier is 1 -
     * so a default race is the race it has always been, and every crash count
     * in the README still means what it says.
     *
     * Pace moves with the level too, but `aiSpec` clamps speedMul to 1, so a
     * higher level never gives an opponent a higher top speed than yours.
     * Level 10 is a car that almost never makes a mistake and recovers fast
     * when it does, not a car with a faster engine - there are no engines
     * here, and a field that simply out-ran you would not be a harder race,
     * it would be an unwinnable one. */
    aiLevel: 5,
    minAiLevel: 1,
    maxAiLevel: 10,
    /* Index 0 is level 1. Read by CONFIG.aiSpec, which multiplies a profile
     * by this row. Monotone in all three columns, and exactly 1/1/1 at 5. */
    aiLevels: [
      { name: 'SUNDAY',    mistake: 2.80, reaction: 2.20, pace: 0.880 },
      { name: 'CLUB',      mistake: 2.30, reaction: 1.90, pace: 0.910 },
      { name: 'STEADY',    mistake: 1.80, reaction: 1.60, pace: 0.940 },
      { name: 'KEEN',      mistake: 1.40, reaction: 1.30, pace: 0.970 },
      { name: 'NORMAL',    mistake: 1.00, reaction: 1.00, pace: 1.000 },
      { name: 'SHARP',     mistake: 0.75, reaction: 0.88, pace: 1.005 },
      { name: 'QUICK',     mistake: 0.55, reaction: 0.76, pace: 1.010 },
      { name: 'HARD',      mistake: 0.38, reaction: 0.64, pace: 1.014 },
      { name: 'RUTHLESS',  mistake: 0.22, reaction: 0.54, pace: 1.017 },
      { name: 'FLAWLESS',  mistake: 0.10, reaction: 0.45, pace: 1.020 }
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
    // Naming a track in the URL means you want to race it. Before the menus
    // were screens this only preselected it, because the one menu was one
    // click from starting; now it would be three, through a legacy list.
    CONFIG.deepLink = true;
  }
  var road = /[?&]road=(\d+)/.exec(search);
  if (road) {
    CONFIG.roadTint = Math.max(0,
      Math.min(CONFIG.roadTints.length - 1, parseInt(road[1], 10)));
  }
  var cars = /[?&]cars=(\d+)/.exec(search);
  if (cars) {
    CONFIG.cars = Math.max(CONFIG.minCars,
      Math.min(CONFIG.maxCars, parseInt(cars[1], 10)));
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
  /* Opponent number i of total. The first three are the hand-tuned ones. Past
   * those the profiles are interpolated: the racing-line offset fans evenly
   * across the road so fifteen opponents drive fifteen lines rather than five
   * copies of three, and pace is dealt out in a different order so the slowest
   * car is not always the one on the outside. */
  CONFIG.aiSpec = function (i, total) {
    var base;
    if (i < CONFIG.ai.length) {
      base = CONFIG.ai[i];
    } else {
      var extras = total - CONFIG.ai.length;
      var k = i - CONFIG.ai.length;
      var fan = extras > 1 ? k / (extras - 1) : 0.5;
      var pace = extras > 1 ? ((k * 7) % extras) / (extras - 1) : 0.5;
      base = {
        speedMul: 0.985 - 0.085 * pace,
        mistake: 0.05 + 0.09 * pace,
        reaction: 0.18 + 0.18 * pace,
        offset: -0.3 + 0.6 * fan
      };
    }
    // The level scales the profile rather than replacing it, so the shape of
    // the field - who runs wide, who is slowest - survives every level.
    var L = CONFIG.aiLevelSpec();
    return {
      // Never above the player's own speed, whatever the level asks for.
      speedMul: Math.min(1, base.speedMul * L.pace),
      mistake: base.mistake * L.mistake,
      reaction: base.reaction * L.reaction,
      offset: base.offset
    };
  };

  CONFIG.clampAiLevel = function (n) {
    if (!(n >= CONFIG.minAiLevel)) return 5;
    return Math.max(CONFIG.minAiLevel, Math.min(CONFIG.maxAiLevel, Math.round(n)));
  };
  CONFIG.aiLevelSpec = function () {
    return CONFIG.aiLevels[CONFIG.clampAiLevel(CONFIG.aiLevel) - 1];
  };
  CONFIG.aiLevelName = function () {
    return CONFIG.aiLevelSpec().name;
  };

  /* The level is a preference rather than a result, so it lives under its own
   * key and RESET DATA - which wipes what you have WON - leaves it alone.
   * Storage is allowed to be missing or to throw; a failure means the level
   * does not survive the session, never that the game stops. */
  var AI_KEY = 'blockracer.ailevel.v1';
  CONFIG.saveAiLevel = function () {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(AI_KEY, String(CONFIG.aiLevel));
      }
    } catch (e) { /* storage blocked or full */ }
  };
  try {
    var savedAi = global.localStorage && global.localStorage.getItem(AI_KEY);
    if (savedAi) CONFIG.aiLevel = CONFIG.clampAiLevel(parseInt(savedAi, 10));
  } catch (e) { /* unreadable storage: keep the default */ }
  var aiParam = /[?&]ai=(\d+)/.exec(search);
  if (aiParam) CONFIG.aiLevel = CONFIG.clampAiLevel(parseInt(aiParam[1], 10));

  /* The halo is a preference like the rest, so it has its own key and
   * RESET DATA leaves it alone. */
  var GLOW_KEY = 'blockracer.glow.v1';
  CONFIG.savePlayerGlow = function () {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(GLOW_KEY, CONFIG.playerGlow ? '1' : '0');
      }
    } catch (e) { /* storage blocked or full */ }
  };
  try {
    var savedGlow = global.localStorage && global.localStorage.getItem(GLOW_KEY);
    if (savedGlow === '0' || savedGlow === '1') CONFIG.playerGlow = savedGlow === '1';
  } catch (e) { /* unreadable storage: keep the default */ }
  var glowParam = /[?&]glow=([01])/.exec(search);
  if (glowParam) CONFIG.playerGlow = glowParam[1] === '1';

  /* Its own key, like every other preference, so RESET DATA leaves it alone.
   * Somebody who needs this does not want it wiped with their medals. */
  var CONTRAST_KEY = 'blockracer.contrast.v1';
  CONFIG.saveContrast = function () {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(CONTRAST_KEY, CONFIG.contrast ? '1' : '0');
      }
    } catch (e) { /* storage blocked or full */ }
  };
  try {
    var savedContrast = global.localStorage && global.localStorage.getItem(CONTRAST_KEY);
    if (savedContrast === '0' || savedContrast === '1') {
      CONFIG.contrast = savedContrast === '1';
    }
  } catch (e) { /* unreadable storage: keep the default */ }
  var contrastParam = /[?&]contrast=([01])/.exec(search);
  if (contrastParam) CONFIG.contrast = contrastParam[1] === '1';

  /* A turn is a right angle, so the lean the pose asks for is a fraction of
   * one. Everything that draws a car works in radians; the slider works in
   * degrees because that is what the pose is called. */
  CONFIG.oversteerFrac = function () {
    return CONFIG.oversteer / 90;
  };
  CONFIG.clampOversteer = function (deg) {
    var n = Math.round(deg);
    if (!(n >= CONFIG.minOversteer)) return 0;
    return Math.max(CONFIG.minOversteer, Math.min(CONFIG.maxOversteer, n));
  };

  /* Same rule as the AI level: a look you chose is a preference, not a
   * result, so it has its own key and RESET DATA leaves it alone. */
  var STEER_KEY = 'blockracer.oversteer.v1';
  CONFIG.saveOversteer = function () {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STEER_KEY, String(CONFIG.oversteer));
      }
    } catch (e) { /* storage blocked or full */ }
  };
  try {
    var savedSteer = global.localStorage && global.localStorage.getItem(STEER_KEY);
    if (savedSteer !== null && savedSteer !== undefined && savedSteer !== '') {
      CONFIG.oversteer = CONFIG.clampOversteer(parseInt(savedSteer, 10));
    }
  } catch (e) { /* unreadable storage: keep the default */ }
  var steerParam = /[?&]steer=(\d+)/.exec(search);
  if (steerParam) CONFIG.oversteer = CONFIG.clampOversteer(parseInt(steerParam[1], 10));

  /* Music and sound effects, 0-100 each, 0 being off. Preferences, so each
   * has its own key and RESET DATA leaves them alone. */
  /* How a touchscreen steers: 'swipe' (the way you want to go, the default)
   * or 'tap' (the left or right half of the screen). A mouse or keyboard
   * ignores it. Its own key, so RESET DATA leaves it alone.
   *
   * v2 because v1 was written by every page load, not only by a choice, so
   * it cannot tell somebody who picked TAP from somebody who never looked:
   * reading it would keep every earlier player off the new default. Only a
   * choice made in Options is written now (Game.setControl). */
  CONFIG.control = 'swipe';
  var CONTROL_KEY = 'blockracer.control.v2';
  CONFIG.saveControl = function () {
    try {
      if (global.localStorage) global.localStorage.setItem(CONTROL_KEY, CONFIG.control);
    } catch (e) { /* storage blocked or full */ }
  };
  try {
    var savedControl = global.localStorage && global.localStorage.getItem(CONTROL_KEY);
    if (savedControl === 'tap' || savedControl === 'swipe') CONFIG.control = savedControl;
  } catch (e) { /* unreadable storage: keep the default */ }
  var controlParam = /[?&]control=(tap|swipe)/.exec(search);
  if (controlParam) CONFIG.control = controlParam[1];

  CONFIG.musicVolume = 60;
  CONFIG.sfxVolume = 80;
  CONFIG.clampVolume = function (v) {
    v = Math.round(Number(v) / 5) * 5;
    return isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
  };
  var VOLUME_KEYS = { musicVolume: 'blockracer.musicvol.v1', sfxVolume: 'blockracer.sfxvol.v1' };
  CONFIG.saveVolumes = function () {
    try {
      if (global.localStorage) {
        Object.keys(VOLUME_KEYS).forEach(function (k) {
          global.localStorage.setItem(VOLUME_KEYS[k], String(CONFIG[k]));
        });
      }
    } catch (e) { /* storage blocked or full */ }
  };
  Object.keys(VOLUME_KEYS).forEach(function (k) {
    try {
      var saved = global.localStorage && global.localStorage.getItem(VOLUME_KEYS[k]);
      var n = saved ? parseInt(saved, 10) : NaN;
      if (isFinite(n)) CONFIG[k] = CONFIG.clampVolume(n);
    } catch (e) { /* unreadable storage: keep the default */ }
  });

  /* The one palette that outranks a theme's own. Everything not listed here
   * falls through to the theme, which is deliberate: the car colours and the
   * start line are already high contrast and do not need replacing. */
  CONFIG.contrastPalette = {
    bg:         '#000000',
    road:       '#000000',   // the only thing you may drive on, and it is
    roadLine:   '#26262a',   // the only black thing on the board
    wall:       '#f4f6fa',
    wallTop:    '#ffffff',
    outer:      '#f4f6fa',
    outerTop:   '#ffffff',
    jog:        '#f4f6fa',   // gates are walls, and are told apart from the
    jogTop:     '#ffffff',   // rest by a hatch rather than by a colour
    racingLine: 'rgba(255,255,255,0.28)',
    check:      'rgba(255,255,255,0.07)',
    checkNext:  'rgba(255,255,255,0.24)',
    startLine:  '#ffffff'
  };
  CONFIG.contrastColors = function () {
    return CONFIG.contrast ? CONFIG.contrastPalette : null;
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
