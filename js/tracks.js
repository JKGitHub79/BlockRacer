/* Block Racer - the tracks.
 *
 * The tracks themselves are no longer here. Each one is a JSON file of its
 * own under tracks/ - tracks/<theme>/<id>.json for the thirty that belong to
 * a theme, tracks/adhoc/<id>.json for the rest - which the level editor
 * (Options, LEVEL EDITOR) reads and writes, and which can be edited by hand.
 * tools/build-tracks.js checks them and bundles them into js/tracks.data.js,
 * which is what is loaded here. js/trackfile.js says what a file means.
 *
 * What stays in this file is what the files point at: the palettes, one per
 * theme, and the notes on why each theme looks and drives the way it does.
 * A themed track is drawn in its theme's palette and cannot say otherwise;
 * an adhoc track can start from one by name and colour over the top of it.
 *
 * Rectangles are inclusive cell ranges. `kind` is cosmetic: 'edge' and
 * 'infield' are plain barriers, 'jog' marks the blocks that force a turn and
 * are drawn with a warning edge, 'lava' glows and 'void' is open space.
 * A route's consecutive waypoints must always be axis aligned, and the last
 * leg wraps to the first. tools/validate-track.js checks that a car can
 * actually drive the whole line, so edit freely and then run it.
 */
(function (global) {
  'use strict';

  /* ---- The forest theme ------------------------------------------------
   * Three tracks that share a palette and a shape language: a rectangular
   * ring with nine-cell roads - wider than anything built before - and pine
   * stands set into the straights to make the car change lane.
   *
   * Every gate between a stand and the far side of the road is five cells
   * with the racing line down the middle, which leaves 2.5 cells of margin
   * once the turn arc and the car's own width are paid for. Catalunya's
   * chicanes leave 2.0 and Staircase's leave 0.4. This is the most forgiving
   * geometry in the game, deliberately: the forest is where the car is
   * learned.
   *
   * The three differ only in how many times the road asks you to move and
   * how long the straights between are. Pinefall asks once, Hollow four
   * times, Canopy five, and the straights shorten as they go.
   * -------------------------------------------------------------------- */
  var FOREST = {
    bg:         '#040b08',
    /* The road has to be near black, as it is on every other track. The first
     * cut had it a dark green and the trees a mid green, four steps apart:
     * on screen the circuit disappeared into the wood and you could not see
     * where the road went. Tarmac is the dark thing; everything else is
     * lighter than it. */
    road:       '#0b120e',   // packed needles, in deep shade
    roadLine:   '#141e17',
    wall:       '#245c37',   // the standing wood
    wallTop:    '#3f9058',
    outer:      '#18401f',   // deeper forest, off the map
    outerTop:   '#2c7040',
    jog:        '#4d3319',   // the pine stands out on the road
    jogTop:     '#8a6530',
    racingLine: 'rgba(190,235,180,0.24)',
    check:      'rgba(150,230,160,0.06)',
    checkNext:  'rgba(150,230,160,0.24)',
    startLine:  '#e8f2e0'
  };

  /* ---- The desert theme ------------------------------------------------
   * One step up from the forest, and a small one. The roads stay nine cells
   * wide and the stands stay three thick, so the gate a car threads is the
   * same six cells with the same 3.0 cells of margin. Two things change:
   * each track asks for one more change of lane than its forest counterpart,
   * and the runoff past a turn-in comes down from eight cells to six.
   *
   * Narrowing the road to eight was tried first and is not a small step at
   * all: a five-cell gate more than doubled the cost of every lane change
   * and put two of the three in the same band as Wildwood and Caldera. The
   * gate margin dominates everything else, so it is the one thing held
   * still.
   *
   * The three footprints differ so they do not read as the forest recoloured:
   * Duneline is long and low, Salt Flats tall and square, Canyon Run the big
   * one with a double-S on the main straight.
   * -------------------------------------------------------------------- */
  var DESERT = {
    bg:         '#120b07',
    road:       '#0f0b07',   // baked hardpan, in shadow
    roadLine:   '#1b1410',
    wall:       '#a8703c',   // sandstone, bright against the road
    wallTop:    '#d69c5e',
    outer:      '#7d4f2a',   // open desert, off the map
    outerTop:   '#ab7644',
    jog:        '#6b3a20',   // the outcrops out on the road
    jogTop:     '#a86a3c',
    racingLine: 'rgba(255,226,172,0.24)',
    check:      'rgba(255,200,120,0.06)',
    checkNext:  'rgba(255,200,120,0.26)',
    startLine:  '#f6e8cf'
  };

  /* ---- The snow theme --------------------------------------------------
   * Moderate, and - unlike the forest and the desert, which are the same
   * rectangular ring three times each - three different SHAPES.
   *
   *   Frostline  a switchback. No island: the middle of the map is a
   *              corridor walled on both sides with one way in and one out.
   *   Glacier    a figure of eight. The racing line crosses itself, and the
   *              field meets at that junction from two directions.
   *   Whiteout   an L. The top right of the map is solid ground, so the lap
   *              runs round a corner the circuit does not have.
   *
   * The roads are eight cells rather than the desert's nine, which is worth
   * roughly double the crash count on its own, but the shapes are the point:
   * a theme should not be the last one recoloured.
   * -------------------------------------------------------------------- */
  var SNOW = {
    bg:         '#060a12',
    road:       '#0f1721',   // packed ice, dark under a grey sky
    roadLine:   '#17212d',
    wall:       '#dbe7f4',   // the banks either side
    wallTop:    '#ffffff',
    outer:      '#b0c4da',   // deeper drifts, off the map
    outerTop:   '#dde9f6',
    jog:        '#7d94ae',   // ice blocks out on the road
    jogTop:     '#b6cae0',
    racingLine: 'rgba(180,220,255,0.30)',
    check:      'rgba(150,220,255,0.07)',
    checkNext:  'rgba(150,220,255,0.28)',
    startLine:  '#f4f9ff'
  };

  /* ==================================================================== *
   * CLIFFS - the fourth theme, and the hardest built so far.
   *
   * Rock rather than weather: grey stone, rust-stained ledges, grit in the
   * air. The three shapes are a serpentine, a spiral and a circuit with a
   * tight inner loop bolted onto it - none of which any earlier theme uses,
   * because a theme that is the previous one recoloured is not a theme.
   *
   * They are a step above the snow three rather than a leap. The roads stay
   * eight cells wide, as the snow's are: what makes them harder is the number
   * of direction changes per lap, not a narrower gate. Narrowing the gate is
   * the biggest single difficulty lever there is and it is also the one that
   * stops a track being fun, because it turns every corner into the same
   * problem. More corners, and corners of more kinds, is the better trade.
   * ==================================================================== */
  var CLIFF = {
    /* `rock` turns on the per-cell stone texture in js/render.js. Without it
     * these solids are flat fills, and at the size of Overhang's massif a
     * flat fill reads as a hole in the picture rather than as rock. */
    rock:       true,
    bg:         '#07070a',
    road:       '#121317',   // dark stone, kept near black like every road
    roadLine:   '#1b1d23',
    wall:       '#6e6154',   // warm grey-brown, not grey
    wallTop:    '#a89684',
    outer:      '#473c31',   // the massif, off the map, browner and darker
    outerTop:   '#736250',
    jog:        '#8a4a2a',   // rust-stained boulders out on the road
    jogTop:     '#d08040',
    racingLine: 'rgba(235,205,170,0.26)',
    check:      'rgba(255,190,120,0.07)',
    checkNext:  'rgba(255,190,120,0.28)',
    startLine:  '#f4efe6'
  };

  /* ==================================================================== *
   * CITY - the fifth theme, and the hardest.
   *
   * Streets between buildings. The solids stop being scenery you drive
   * around and become the thing that defines the road: a city track is a
   * grid of blocks with the tarmac left over, which is the opposite way
   * round from every theme so far, where a circuit was drawn and then an
   * island dropped in the middle of it.
   *
   * The streets are seven cells rather than the cliffs' eight, and the lanes
   * on Downtown are six. That is most of why these are a step up - but only
   * most: the shapes carry the rest, and none of the three is a ring.
   * ==================================================================== */
  var CITY = {
    /* `windows` turns on the lit-window texture in js/render.js, the way
     * `rock` turns on stone for the cliffs. A city block is the one solid in
     * the game that is meant to read as a BUILDING rather than as terrain. */
    windows:    true,
    bg:         '#05060c',
    road:       '#121419',   // asphalt, kept near black like every road
    roadLine:   '#1b1f27',
    wall:       '#2b3142',   // the blocks
    wallTop:    '#4d5978',
    outer:      '#1c2233',   // the city beyond the circuit
    outerTop:   '#374162',
    jog:        '#96570f',   // roadworks: hoardings and lamps
    jogTop:     '#ffb134',
    racingLine: 'rgba(130,205,255,0.26)',
    check:      'rgba(90,200,255,0.07)',
    checkNext:  'rgba(90,200,255,0.30)',
    startLine:  '#eef4ff'
  };

  /* ==================================================================== *
   * INDUSTRIAL - the sixth theme, and the last word in the ladder so far.
   *
   * A works rather than a town: pipe racks, sheds, gasholders and the
   * hardstanding between them. The city was the first theme where the
   * solids defined the road instead of decorating it; this one keeps that
   * and takes the road down to six cells and five.
   *
   * Two of the three are pure corridor, like the city two that were rebuilt.
   * The third, REFINERY, is the one track in the game with open junctions on
   * purpose - and it is the one track that paints ARROWS on the floor, which
   * is the only reason it is allowed to have them.
   * ==================================================================== */
  var INDUSTRIAL = {
    /* `pipes` turns on the plant texture in js/render.js, the way `rock`
     * turns on stone and `windows` turns on lit glass. A plant block is
     * neither terrain nor a building: it is machinery, and it gets pipe
     * runs, flanges, drums and bolts. Barriers get hazard chevrons. */
    pipes:      true,
    bg:         '#0a0806',
    road:       '#141312',   // oil-stained concrete, still near black
    roadLine:   '#1e1c19',
    wall:       '#3a342c',   // the plant: racks, sheds, tanks
    wallTop:    '#6f6452',
    outer:      '#241e19',   // the works beyond the circuit
    outerTop:   '#42382c',
    jog:        '#8d3312',   // crash barriers, rusted and chevroned
    jogTop:     '#ff7a33',
    racingLine: 'rgba(255,196,110,0.24)',
    check:      'rgba(255,176,70,0.07)',
    checkNext:  'rgba(255,176,70,0.30)',
    startLine:  '#f6efe2'
  };

  /* ==================================================================== *
   * ANCIENT RUINS - the seventh theme.
   *
   * Dressed stone, and shapes that are BUILT rather than laid out: a plan
   * on a cross, a colonnade, a meander. Every theme so far took its shapes
   * from what a road does - a ring, a weave, a grid. These three take them
   * from what a building does, which is the whole idea.
   * ==================================================================== */
  var RUINS = {
    /* `glyphs` turns on the dressed-stone texture in js/render.js: courses
     * of ashlar with staggered joints, carved panels, column drums, cracks
     * and lichen. The cliffs' `rock` is geology; this is masonry. */
    glyphs:     true,
    bg:         '#0d0a07',
    road:       '#171310',   // worn flagstone, still near black
    roadLine:   '#231c15',
    wall:       '#6b533a',   // sandstone, lit warm
    wallTop:    '#c9a06a',
    outer:      '#3e2f20',   // the precinct beyond the circuit
    outerTop:   '#7a5c3c',
    jog:        '#5f6b3a',   // fallen masonry, gone over with lichen
    jogTop:     '#a8bf62',
    racingLine: 'rgba(255,214,150,0.26)',
    check:      'rgba(255,200,110,0.07)',
    checkNext:  'rgba(255,200,110,0.30)',
    startLine:  '#f3e6cf'
  };

  /* ==================================================================== *
   * VOLCANO - the eighth theme, and the hardest.
   *
   * The gates here are LAVA rather than barriers. `kind: 'lava'` has been in
   * the engine since Caldera: it collides exactly like a wall and the
   * renderer paints molten rock over it every frame, so a flow across the
   * road is a gate that looks like what it is.
   *
   * These three are back on SIX-cell roads after the ruins, and that is the
   * whole reason they are harder. A lane change needs two turn radii of room
   * - 1.6 cells at the default slide - which a five-cell road cannot offer,
   * so the ruins could only ever have gates on one side of a straight. Six
   * cells buys back the PAIR: two flows against opposite kerbs, far enough
   * apart that the lane one leaves clear is the lane the other blocks, and
   * the car has to get across in the middle of the fastest road on the
   * track. It is worth more than a cell of margin, and by some distance.
   * ==================================================================== */
  var VOLCANO = {
    /* `crust` turns on the basalt texture in js/render.js: black plates,
     * cracks that still glow where the rock has not finished cooling, and
     * frozen bombs. Lava cells get none of it - their crust is the flat fill
     * and the molten middle goes on live. */
    crust:      true,
    bg:         '#0a0503',
    road:       '#16100d',   // ash over old basalt
    roadLine:   '#241812',
    wall:       '#2b1711',   // cooled crust
    wallTop:    '#8f3d18',
    outer:      '#1d0d09',
    outerTop:   '#5c220e',
    jog:        '#8a2f0c',
    jogTop:     '#ff7a1f',
    racingLine: 'rgba(255,190,120,0.26)',
    check:      'rgba(255,150,60,0.07)',
    checkNext:  'rgba(255,150,60,0.30)',
    startLine:  '#ffeeda'
  };

  /* ==================================================================== *
   * SPACE - the ninth theme, and the hardest.
   *
   * The gate here is a HOLE. `kind: 'void'` is new: it collides exactly like
   * a wall, and the renderer paints the sky the station is flying over
   * through it, two star layers deep so it reads as somewhere rather than as
   * a black rectangle. Driving into one is the same crash as driving into a
   * spar; it just looks like a much worse idea.
   *
   * Volcano's flows NARROW the road - a pair of them leaves two cells down
   * the middle that clear both, and the crashes come from the cars that were
   * not on that line. These holes CLOSE it. A pair here is three cells deep
   * on each side of a six-cell deck, so there is no lane that clears both and
   * the lane change is compulsory rather than merely wise. That is the whole
   * step up from the volcano: same width of road, same radius of turn, and
   * one fewer way through.
   * ==================================================================== */
  var SPACE = {
    /* `vacuum` means EVERY solid on this track is open space rather than
     * scenery: js/render.js masks a live starfield to the shape of the walls
     * and paints it over the lot. So the values invert against every other
     * theme - the road is the lit thing and the walls are the dark thing,
     * because out here the walls are nothing at all. */
    vacuum:     true,
    bg:         '#01020a',
    road:       '#1e2941',   // the deck: the only solid surface out here
    roadLine:   '#2d3b59',
    wall:       '#01020a',   // painted over with sky every frame
    wallTop:    '#7fb4e4',   // the lit lip where the deck stops, and it is
    outer:      '#01020a',   // the same lip whichever solid it runs round:
    outerTop:   '#7fb4e4',   // out here they are all the same hole
    jog:        '#1f4a5c',
    jogTop:     '#5ef2ff',
    racingLine: 'rgba(150,215,255,0.24)',
    check:      'rgba(94,242,255,0.07)',
    checkNext:  'rgba(94,242,255,0.30)',
    startLine:  '#e8f6ff'
  };

  /* ==================================================================== *
   * ALIEN - the tenth theme, and the last.
   *
   * The gate here is an EGG CLUSTER: `kind: 'jog'`, which has meant "the
   * block that forces a turn" since Staircase and collides like any other
   * solid. It needed no new engine at all, only a painter - and it is the
   * one thing on these tracks that is not green, because on a map this green
   * the thing you must not hit should not be the colour of everything else.
   *
   * The ladder here is the WEAVE and nothing else. Measured on Orbital: the
   * bare ring costs 71 crashes a thousand laps, each hole about 39, and each
   * change of lane about 170. So these three are built to carry as many
   * changes as their straights will hold - five, six and eight - and the
   * shapes get SIMPLER as they get harder, which is the opposite of every
   * other theme and is the honest consequence of that measurement. A weave
   * needs road to happen on.
   * ==================================================================== */
  var ALIEN = {
    /* `hive` turns on the growth in js/render.js: veins that join up between
     * neighbouring cells, nodes where they cross, and pods lit from inside.
     * `flyby` is scenery and nothing else - see the note in js/render.js. */
    hive:       true,
    bg:         '#03110a',
    road:       '#0a1a12',   // ground, with the growth held off it
    roadLine:   '#16301f',
    wall:       '#1d4a2c',   // growth
    wallTop:    '#7cff5a',
    outer:      '#15361f',
    outerTop:   '#4fbf46',
    jog:        '#3a1f4d',   // the egg clusters, and the one colour out here
    jogTop:     '#d36bff',   // that nothing else uses
    racingLine: 'rgba(160,255,150,0.24)',
    check:      'rgba(124,255,90,0.07)',
    checkNext:  'rgba(124,255,90,0.30)',
    startLine:  '#dfffd0'
  };

  global.PALETTES = {
    forest: FOREST, desert: DESERT, snow: SNOW, cliffs: CLIFF, city: CITY,
    industrial: INDUSTRIAL, ruins: RUINS, volcano: VOLCANO, space: SPACE, alien: ALIEN
  };

  /* The list the game races, in the order tools/build-tracks.js put it: the
   * themed circuits in the order the play screen offers them, then the adhoc
   * tracks (the seven built before the themes first), then the tutorial's,
   * which is always last. Every track is a copy made from its file, so the
   * level editor can hold the files without the game's list moving under it. */
  global.TRACKS = (global.TRACK_FILES || []).map(function (f) {
    return global.TrackFile.toTrack(f, global.PALETTES);
  });
})(typeof window !== 'undefined' ? window : globalThis);
