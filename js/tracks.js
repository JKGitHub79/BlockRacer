/* Block Racer - the tracks.
 *
 * Pure data. Each entry describes a grid of cells, the solid rectangles in it,
 * the racing line, and where the checkpoints and the start are. js/track.js
 * turns one of these into the live track.
 *
 * Rectangles are inclusive cell ranges. `kind` is cosmetic: 'edge' and
 * 'infield' are plain barriers, 'jog' marks the blocks that force a turn and
 * are drawn with a warning edge.
 *
 * A route's consecutive waypoints must always be axis aligned, and the last
 * leg wraps to the first. tools/validate-track.js checks that a car can
 * actually drive the whole line, so edit freely and then run it.
 */
(function (global) {
  'use strict';

  function border(cols, rows, kind) {
    kind = kind || 'edge';
    return [
      { x0: 0, y0: 0, x1: cols - 1, y1: 0, kind: kind },
      { x0: 0, y0: rows - 1, x1: cols - 1, y1: rows - 1, kind: kind },
      { x0: 0, y0: 0, x1: 0, y1: rows - 1, kind: kind },
      { x0: cols - 1, y0: 0, x1: cols - 1, y1: rows - 1, kind: kind }
    ];
  }

  /* ------------------------------------------------------------------ *
   * 1. CROSSOVER - beginner
   *
   * A figure of eight: an upper-right rectangle and a lower-left rectangle
   * that meet at a single corner in the middle of the map, so the racing
   * line runs straight through itself once a lap. Six-cell roads - half
   * again as wide as Staircase - no chicanes, and only six turns.
   *
   *            17  23        33  39
   *        0 +----+===========+===+     rows 1-6   top road
   *          |####|   top     |   |
   *        7 |####|===+---+===|   |     rows 7-10  upper-right infield
   *       11 +====+===========+===+     rows 11-16 middle road, full width
   *       17 |    |===+---+===|###|     rows 17-20 lower-left infield
   *       21 |    |   bottom  |###|     rows 21-26 bottom road
   *       27 +----+-----------+---+
   *
   * The vertical road (cols 17-22) and the middle road (rows 11-16) cross at
   * the centre. That crossing is the only hazard on the track.
   * ------------------------------------------------------------------ */
  var CROSSOVER = {
    id: 'crossover',
    name: 'CROSSOVER',
    blurb: 'Figure of eight. Wide roads, six turns, one crossing.',
    grade: 'BEGINNER',
    cols: 40,
    rows: 28,
    aiPace: 0.94,        // gentler opposition on the beginner track
    aiOffsetScale: 3,    // the road is wide, so let them spread out on it
    walls: border(40, 28).concat([
      { x0: 1,  y0: 1,  x1: 16, y1: 10, kind: 'edge' },     // outside the top-left
      { x0: 23, y0: 17, x1: 38, y1: 26, kind: 'edge' },     // outside the bottom-right
      { x0: 23, y0: 7,  x1: 32, y1: 10, kind: 'infield' },  // upper-right infield
      { x0: 7,  y0: 17, x1: 16, y1: 20, kind: 'infield' }   // lower-left infield
    ]),
    route: [
      { x: 20, y: 24 },   // 0  bottom of the long climb, heading north
      { x: 20, y: 4  },   // 1  top, turn east
      { x: 36, y: 4  },   // 2  turn south
      { x: 36, y: 14 },   // 3  turn west into the middle road
      { x: 4,  y: 14 },   // 4  straight through the crossing, then turn south
      { x: 4,  y: 24 }    // 5  turn east along the bottom, back to 0
    ],
    startLeg: 5,
    checkpoints: [
      { x0: 17, y0: 8,  x1: 23,   y1: 9.5 },   // climbing, above the crossing
      { x0: 29, y0: 1,  x1: 30.5, y1: 7   },   // top road
      { x0: 9,  y0: 11, x1: 10.5, y1: 17  },   // middle road, past the crossing
      { x0: 1,  y0: 19, x1: 7,    y1: 20.5 }   // left road
    ],
    finish: { x0: 11.5, y0: 21, x1: 12.5, y1: 27, dir: { x: 1, y: 0 } },
    startGrid: [
      { x: 9.5, y: 22.8, wp: 0 },
      { x: 9.5, y: 25.2, wp: 0 },
      { x: 7.6, y: 22.8, wp: 0 },
      { x: 7.6, y: 25.2, wp: 0 }
    ]
  };

  /* ------------------------------------------------------------------ *
   * 2. SNOWDRIFT - beginner
   *
   * Crossover's roads - six cells wide, long open legs, six turns - on a
   * completely different plan. The circuit is an L: the top right corner of
   * the map is out of bounds, so half way round the lap the road steps down
   * and back out again in an S rather than running straight on. No crossing,
   * no chicanes; the corner sequence is the whole of it.
   *
   *          1   7    15  21           33  39
   *      0 +---+------+---+=============+---+
   *      1 |   |      |   |   off the   |   |   rows 1-6   top road
   *      7 |   +------+   |    map      |   |   cols 15-20 the step down
   *     11 |   |      |   +---+---------+---+   rows 11-16 the road east
   *     17 |   |      +-------------+   |   |   rows 17-20 lower infield
   *     21 |   +------------------------+   |   rows 21-26 bottom road
   *     27 +--------------------------------+
   *
   * cols 1-6 is the left road, 33-38 the right. The two infield blocks meet
   * along row 17, so the island in the middle is an L as well.
   * ------------------------------------------------------------------ */
  var SNOWDRIFT = {
    id: 'snowdrift',
    mirror: true,        // drawn clockwise; see DIRECTION below
    name: 'SNOWDRIFT',
    blurb: 'An L-shaped circuit. Wide open, with an S-bend half way round.',
    grade: 'BEGINNER',
    cols: 40,
    rows: 28,
    aiPace: 0.95,
    aiOffsetScale: 3,
    weather: 'snow',
    theme: {
      bg:         '#070b12',
      road:       '#1a2433',   // ploughed, packed down, faintly blue
      roadLine:   '#243143',
      wall:       '#dfe9f5',   // the drifts banked up round the circuit
      wallTop:    '#ffffff',
      outer:      '#b7c7dc',   // deeper snow, off the map
      outerTop:   '#e4edf8',
      racingLine: 'rgba(176,216,255,0.30)',
      check:      'rgba(150,220,255,0.08)',
      checkNext:  'rgba(150,220,255,0.30)',
      startLine:  '#f2f8ff'
    },
    walls: border(40, 28).concat([
      { x0: 21, y0: 1,  x1: 38, y1: 10, kind: 'edge' },     // off the map
      { x0: 7,  y0: 7,  x1: 14, y1: 20, kind: 'infield' },  // the island, upper half
      { x0: 15, y0: 17, x1: 32, y1: 20, kind: 'infield' }   // and its lower arm
    ]),
    route: [
      { x: 4,  y: 4  },   // 0  out of the left road, heading east
      { x: 18, y: 4  },   // 1  the map runs out; step down
      { x: 18, y: 14 },   // 2  and back out east
      { x: 36, y: 14 },   // 3  turn down the right road
      { x: 36, y: 24 },   // 4  turn along the bottom
      { x: 4,  y: 24 }    // 5  turn up the left road, back to 0
    ],
    startLeg: 4,
    checkpoints: [
      { x0: 1,  y0: 16, x1: 7,    y1: 17 },   // left road
      { x0: 10, y0: 1,  x1: 11,   y1: 7  },   // top road
      { x0: 27, y0: 11, x1: 28,   y1: 17 },   // the road east, after the step
      { x0: 33, y0: 19, x1: 39,   y1: 20 }    // right road
    ],
    finish: { x0: 27.6, y0: 21, x1: 28.4, y1: 27, dir: { x: -1, y: 0 } },
    startGrid: [
      { x: 30.5, y: 22.8, wp: 5 },
      { x: 30.5, y: 25.2, wp: 5 },
      { x: 32.4, y: 22.8, wp: 5 },
      { x: 32.4, y: 25.2, wp: 5 }
    ]
  };

  /* ------------------------------------------------------------------ *
   * 3. MESA - beginner
   *
   * Six-cell roads like Snowdrift, laid out as a Z. Two corners of the map
   * are off it - the north east and the south west - so the circuit runs
   * diagonally across the board, stepping down once on the way out and up
   * once on the way back. Eight turns, all of them wide open, and the shape
   * is the same either way up: the second half of the lap is the first half
   * rotated half a turn.
   *
   *          1   7      13 19 21 27      33  39
   *      0 +---+---------+--+--+=========+---+
   *      1 |   |  mesa   |  |  | off the |   |  rows 1-6   top road
   *      7 |   +---------+  |  |   map   |   |  cols 21-26 the step down
   *      9 |   |         |  |  +---------+---+  rows 9-14  the road east
   *     15 |   |   +--------+            |   |  cols 33-38 right road
   *     19 +===+---+        +------------+   |  rows 13-18 the road west
   *     21 |off the map     |            |   |  cols 13-18 the step up
   *     27 +----------------+------------+---+  rows 21-26 bottom road
   * ------------------------------------------------------------------ */
  var MESA = {
    id: 'mesa',
    mirror: true,        // drawn clockwise; see DIRECTION below
    name: 'MESA',
    blurb: 'A Z across the desert. Eight wide turns, two step-overs.',
    grade: 'BEGINNER',
    cols: 40,
    rows: 28,
    aiPace: 0.96,
    aiOffsetScale: 3,
    weather: 'dust',
    theme: {
      bg:         '#0d0903',
      road:       '#2b2015',   // shaded canyon floor, packed hard
      roadLine:   '#3b2d1e',
      wall:       '#9c5a32',   // the mesa in the middle
      wallTop:    '#d98b52',
      outer:      '#c9a86e',   // open dune, off the map
      outerTop:   '#e7cd99',
      racingLine: 'rgba(255,214,150,0.28)',
      check:      'rgba(255,200,120,0.08)',
      checkNext:  'rgba(255,200,120,0.30)',
      startLine:  '#fff3e0'
    },
    walls: border(40, 28).concat([
      { x0: 27, y0: 1,  x1: 38, y1: 8,  kind: 'edge' },     // off the map, north east
      { x0: 1,  y0: 19, x1: 12, y1: 26, kind: 'edge' },     // off the map, south west
      { x0: 7,  y0: 7,  x1: 20, y1: 12, kind: 'infield' },  // the mesa, three steps
      { x0: 19, y0: 13, x1: 20, y1: 14, kind: 'infield' },
      { x0: 19, y0: 15, x1: 32, y1: 20, kind: 'infield' }
    ]),
    route: [
      { x: 4,  y: 4  },   // 0  along the top
      { x: 24, y: 4  },   // 1  step down past the north east corner
      { x: 24, y: 12 },   // 2
      { x: 36, y: 12 },   // 3  turn down the right road
      { x: 36, y: 24 },   // 4  turn back along the bottom
      { x: 16, y: 24 },   // 5  step up past the south west corner
      { x: 16, y: 16 },   // 6
      { x: 4,  y: 16 }    // 7  turn up the left road, back to 0
    ],
    startLeg: 0,
    checkpoints: [
      { x0: 21, y0: 7,  x1: 27, y1: 8  },   // the step down
      { x0: 33, y0: 17, x1: 39, y1: 18 },   // right road
      { x0: 25, y0: 21, x1: 26, y1: 27 },   // bottom road
      { x0: 8,  y0: 13, x1: 9,  y1: 19 }    // the road west
    ],
    finish: { x0: 9.6, y0: 1, x1: 10.4, y1: 7, dir: { x: 1, y: 0 } },
    startGrid: [
      { x: 8.0, y: 2.8, wp: 1 },
      { x: 8.0, y: 5.2, wp: 1 },
      { x: 6.1, y: 2.8, wp: 1 },
      { x: 6.1, y: 5.2, wp: 1 }
    ]
  };

  /* ------------------------------------------------------------------ *
   * 4. WILDWOOD - moderate
   *
   * The point of this one is rhythm rather than shape. Single stands of trees
   * close in from alternating sides of the bottom straight, spaced four cells
   * apart, which at the default slide is close enough that a car is still
   * coming out of one arc as it has to be thrown into the next - five corners
   * running into one another with barely two cells of straight between them.
   * The rest of the lap is deliberately plain: one long fast straight along
   * the top to arrive from, and nothing else to think about.
   *
   * The road through the trees is eight cells rather than six, and the wood is
   * cut back to row 18 to make the room. Three-cell lanes left barely half a
   * cell of margin past each turn-in, which is not flowing, it is Staircase.
   *
   *          1   7    13 14  18  22  26    33  39
   *      1 |   |                           |   |  rows 1-6   top straight
   *      7 |   +-----+---------------------+   |
   *        |   |     |      the wood       |   |  rows 7-18  wood, cut back
   *     19 |   |     +--+--+---+--+---+----+   |  rows 19-22 inner lane
   *     23 |   +--------+-----+--------+   |   |  rows 23-26 outer lane
   *     27 +--------------------------------+
   * ------------------------------------------------------------------ */
  var WILDWOOD = {
    id: 'wildwood',
    mirror: true,        // drawn clockwise; see DIRECTION below
    name: 'WILDWOOD',
    blurb: 'Five corners through the trees, each running into the next.',
    grade: 'MODERATE',
    cols: 40,
    rows: 28,
    aiPace: 0.95,
    aiOffsetScale: 2,
    aiMistakeScale: 0.6,
    weather: 'leaves',
    theme: {
      bg:         '#050a06',
      road:       '#241d14',   // forest floor, beaten down to dirt
      roadLine:   '#302619',
      wall:       '#1f4429',   // the wood
      wallTop:    '#3f7a48',
      jog:        '#2a5733',   // the stands out on their own
      jogTop:     '#63ad68',
      outer:      '#16301d',
      outerTop:   '#2f5c39',
      racingLine: 'rgba(190,232,170,0.26)',
      check:      'rgba(150,240,170,0.08)',
      checkNext:  'rgba(150,240,170,0.30)',
      startLine:  '#f0f7ea'
    },
    walls: border(40, 28).concat([
      { x0: 7,  y0: 7, x1: 12, y1: 20, kind: 'infield' },   // the wood
      { x0: 13, y0: 7, x1: 32, y1: 18, kind: 'infield' },   // cut back for the esses
      /* Single stands, alternating. A wider stand would need a wider gap to
       * turn into, and the gap is what sets the rhythm. */
      { x0: 26, y0: 23, x1: 26, y1: 26, kind: 'jog' },
      { x0: 22, y0: 19, x1: 22, y1: 22, kind: 'jog' },
      { x0: 18, y0: 23, x1: 18, y1: 26, kind: 'jog' },
      { x0: 14, y0: 19, x1: 14, y1: 22, kind: 'jog' }
    ]),
    route: [
      { x: 4,    y: 4  },   // 0  the long straight along the top
      { x: 36,   y: 4  },   // 1  turn down the right road
      { x: 36,   y: 21 },   // 2  turn along the bottom on the inside lane
      { x: 24.5, y: 21 },   // 3  and now the esses, four cells apart all the way
      { x: 24.5, y: 25 },   // 4
      { x: 20.5, y: 25 },   // 5
      { x: 20.5, y: 21 },   // 6
      { x: 16.5, y: 21 },   // 7
      { x: 16.5, y: 25 },   // 8
      { x: 4,    y: 25 }    // 9  out of the trees, turn up the left road
    ],
    startLeg: 9,
    checkpoints: [
      { x0: 14, y0: 1,  x1: 15, y1: 7  },   // top straight
      { x0: 33, y0: 12, x1: 39, y1: 13 },   // right road
      { x0: 29, y0: 19, x1: 30, y1: 27 },   // into the trees
      { x0: 8,  y0: 21, x1: 9,  y1: 27 }    // out of them
    ],
    finish: { x0: 1, y0: 15.6, x1: 7, y1: 16.4, dir: { x: 0, y: -1 } },
    startGrid: [
      { x: 2.8, y: 18.5, wp: 0 },
      { x: 5.2, y: 18.5, wp: 0 },
      { x: 2.8, y: 20.4, wp: 0 },
      { x: 5.2, y: 20.4, wp: 0 }
    ]
  };

  /* ------------------------------------------------------------------ *
   * 5. CATALUNYA - moderate
   *
   * Eight-cell roads the whole way round - the widest of the lot - and two
   * flowing complexes rather than one. A long main straight down the bottom
   * to arrive from, then a quick chicane up the right, then a longer sequence
   * along the top. Both are spaced four cells apart, which at the default
   * slide leaves 2.4 cells of straight between arcs: six linked corners, in
   * two bursts, with a thirty-cell straight and two long sweeps to breathe in
   * between.
   *
   *          1     9              31    39
   *      1 |       |    #    #    |      |  rows 1-4  top outer lane
   *      5 |       |  #     #     |      |  rows 5-8  top inner lane
   *      9 |       +--------------+   #  |  rows 9-18 the infield
   *     19 |                      |      |  rows 19-26 main straight
   *     27 +-----------------------------+
   * ------------------------------------------------------------------ */
  var CATALUNYA = {
    id: 'catalunya',
    name: 'CATALUNYA',
    blurb: 'Two flowing complexes off a long main straight. Blaugrana.',
    grade: 'MODERATE',
    cols: 40,
    rows: 28,
    aiPace: 0.96,
    aiOffsetScale: 2,
    aiMistakeScale: 0.6,
    theme: {
      bg:         '#070810',
      road:       '#1b1d23',   // asphalt, kept dark
      roadLine:   '#25282f',
      wall:       '#122540',   // blue half of the shirt, well down in tone
      wallTop:    '#24405f',
      jog:        '#4a1022',   // garnet, for the blocks out on the road
      jogTop:     '#77203c',
      outer:      '#0d1523',
      outerTop:   '#1b2c46',
      racingLine: 'rgba(186,160,96,0.20)',
      check:      'rgba(186,160,96,0.06)',
      checkNext:  'rgba(186,160,96,0.20)',
      startLine:  '#d8d2c2'
    },
    /* Painted onto the infield at bake time - no per-frame cost. The cars have
     * to stay the brightest things on screen, so the livery is kept a couple of
     * stops under the tarmac it sits next to. */
    emblems: [
      { kind: 'stripes', x0: 9, y0: 9, x1: 30, y1: 18, axis: 'x', band: 2,
        colors: ['#142944', '#3b0e1f'], alpha: 0.9 },           // blaugrana
      { kind: 'stripes', x0: 9, y0: 12.5, x1: 30, y1: 14.5, axis: 'y', band: 0.5,
        colors: ['#55421c', '#3a0d18'], alpha: 0.55 },          // the senyera
      { kind: 'mosaic', x0: 9, y0: 9, x1: 30, y1: 18, tile: 0.5, density: 0.10,
        seed: 2026, alpha: 0.3,
        colors: ['#24405f', '#5c1730', '#55421c', '#1f4a44'] }  // trencadis
    ],
    walls: border(40, 28).concat([
      { x0: 9,  y0: 9,  x1: 30, y1: 18, kind: 'infield' },
      { x0: 35, y0: 18, x1: 38, y1: 18, kind: 'jog' },   // the chicane up the right
      { x0: 31, y0: 13, x1: 34, y1: 13, kind: 'jog' },
      { x0: 35, y0: 8,  x1: 38, y1: 8,  kind: 'jog' },
      { x0: 27, y0: 1,  x1: 27, y1: 4,  kind: 'jog' },   // the sequence along the top
      { x0: 22, y0: 5,  x1: 22, y1: 8,  kind: 'jog' },
      { x0: 17, y0: 1,  x1: 17, y1: 4,  kind: 'jog' }
    ]),
    route: [
      { x: 5,    y: 23   },   // 0  onto the main straight
      { x: 33,   y: 23   },   // 1  turn up the right, inside lane
      { x: 33,   y: 16.5 },   // 2  the chicane
      { x: 37,   y: 16.5 },   // 3
      { x: 37,   y: 11.5 },   // 4
      { x: 33,   y: 11.5 },   // 5
      { x: 33,   y: 7    },   // 6  turn along the top, inside lane
      { x: 25,   y: 7    },   // 7  the sequence
      { x: 25,   y: 3    },   // 8
      { x: 20,   y: 3    },   // 9
      { x: 20,   y: 7    },   // 10
      { x: 5,    y: 7    }    // 11 turn down the left, back to 0
    ],
    startLeg: 0,
    checkpoints: [
      { x0: 20, y0: 19, x1: 21, y1: 27 },   // main straight
      { x0: 31, y0: 9,  x1: 39, y1: 10 },   // out of the chicane
      { x0: 12, y0: 1,  x1: 13, y1: 9  },   // out of the top sequence
      { x0: 1,  y0: 15, x1: 9,  y1: 16 }    // down the left
    ],
    finish: { x0: 9.6, y0: 19, x1: 10.4, y1: 27, dir: { x: 1, y: 0 } },
    startGrid: [
      { x: 8.0, y: 21.5, wp: 1 },
      { x: 8.0, y: 24.5, wp: 1 },
      { x: 6.1, y: 21.5, wp: 1 },
      { x: 6.1, y: 24.5, wp: 1 }
    ]
  };

  /* ------------------------------------------------------------------ *
   * 6. CALDERA - moderate
   *
   * A ring road around a lava lake, six cells wide like Crossover, with one
   * lava flow across each of the long straights. Eight turns a lap against
   * Crossover's six, and the flows leave a three-cell gap rather than
   * Staircase's two - half again the room, and two of them instead of eight.
   *
   *          1   7          13      20   24    31   33  39
   *      0 +---+------------+=======+----+=====+-----+---+
   *      1 |   |            | flow  |    |     |     |   |  rows 1-6   top road
   *      4 |   |            +-------+    +=====+     |   |  (flow blocks a half)
   *      7 |   +-------------------------------------+   |
   *        |   |           lava lake                 |   |  rows 7-20 infield
   *     21 |   +-------------------------------------+   |
   *     24 |   |    +=====+       +=======+          |   |  rows 21-26 bottom
   *     27 +---+----+-----+-------+-------+----------+---+
   *
   * Every solid on this track is molten, so a mistake is always the same
   * mistake. cols 1-6 and 33-38 are the side roads.
   * ------------------------------------------------------------------ */
  var CALDERA = {
    id: 'caldera',
    mirror: true,        // drawn clockwise; see DIRECTION below
    name: 'CALDERA',
    blurb: 'Ring road round a lava lake. Two flows to thread.',
    grade: 'MODERATE',
    cols: 40,
    rows: 28,
    aiPace: 0.97,
    aiOffsetScale: 1.5,   // the gaps through the flows are three cells, not six
    /* A step across a flow is a three-cell leg with a wall just beyond it, so
     * a driver who turns in late here pays for it in a way Crossover's long
     * open legs never charge. Dialled back so the field is not constantly
     * picking itself out of the lava. */
    aiMistakeScale: 0.5,
    theme: {
      bg:         '#0a0705',
      road:       '#17120f',
      roadLine:   '#241b16',
      wall:       '#2c1410',   // cooled crust; the glow is drawn over it live
      wallTop:    '#8a3a18',
      outer:      '#210f0b',
      outerTop:   '#632611',
      racingLine: 'rgba(255,196,130,0.22)',
      check:      'rgba(255,170,80,0.07)',
      checkNext:  'rgba(255,170,80,0.26)',
      startLine:  '#ffeada'
    },
    walls: border(40, 28, 'lava').concat([
      { x0: 7,  y0: 7,  x1: 32, y1: 20, kind: 'lava' },   // the lake
      { x0: 13, y0: 1,  x1: 19, y1: 3,  kind: 'lava' },   // top straight flows
      { x0: 24, y0: 4,  x1: 30, y1: 6,  kind: 'lava' },
      { x0: 20, y0: 21, x1: 26, y1: 23, kind: 'lava' },   // bottom straight flows
      { x0: 10, y0: 24, x1: 16, y1: 26, kind: 'lava' }
    ]),
    route: [
      { x: 4,    y: 5.5  },   // 0  out of the left road onto the inside line
      { x: 21.5, y: 5.5  },   // 1  step outward, round the first flow
      { x: 21.5, y: 2.5  },   // 2
      { x: 36,   y: 2.5  },   // 3  turn down the right road
      { x: 36,   y: 25.5 },   // 4  turn along the bottom, on the outside
      { x: 18.5, y: 25.5 },   // 5  step inward, round the second flow
      { x: 18.5, y: 22.5 },   // 6
      { x: 4,    y: 22.5 }    // 7  turn up the left road, back to 0
    ],
    startLeg: 0,
    checkpoints: [
      { x0: 31.5, y0: 1,  x1: 32.5, y1: 7  },   // end of the top straight
      { x0: 33,   y0: 13, x1: 39,   y1: 14 },   // right road
      { x0: 8,    y0: 21, x1: 9,    y1: 27 },   // bottom straight
      { x0: 1,    y0: 12, x1: 7,    y1: 13 }    // left road
    ],
    finish: { x0: 8.6, y0: 1, x1: 9.4, y1: 7, dir: { x: 1, y: 0 } },
    startGrid: [
      { x: 6.9, y: 4.8, wp: 1 },
      { x: 6.9, y: 6.2, wp: 1 },
      { x: 5.0, y: 4.8, wp: 1 },
      { x: 5.0, y: 6.2, wp: 1 }
    ]
  };

  /* ------------------------------------------------------------------ *
   * 7. STAIRCASE
   *
   * A four-cell corridor around a solid infield. Every straight carries two
   * blocks on alternating halves of the road, so no straight can be taken in
   * one lane: you have to staircase the whole way round.
   *
   *   top road    rows 1-4     outer = rows 1-2    inner = rows 3-4
   *   bottom road rows 20-23   inner = rows 20-21  outer = rows 22-23
   *   left road   cols 1-4     outer = cols 1-2    inner = cols 3-4
   *   right road  cols 35-38   inner = cols 35-36  outer = cols 37-38
   *
   * Raced clockwise: top, right, bottom, left.
   * ------------------------------------------------------------------ */
  var STAIRCASE = {
    id: 'staircase',
    mirror: true,        // drawn clockwise; see DIRECTION below
    name: 'STAIRCASE',
    blurb: 'Eight chicanes. No straight can be driven in one lane.',
    grade: 'HARD',
    cols: 40,
    rows: 25,
    aiPace: 1,
    aiOffsetScale: 1,
    walls: border(40, 25).concat([
      { x0: 5,  y0: 5,  x1: 34, y1: 19, kind: 'infield' },
      { x0: 14, y0: 1,  x1: 20, y1: 2,  kind: 'jog' },   // top straight
      { x0: 24, y0: 3,  x1: 30, y1: 4,  kind: 'jog' },
      { x0: 37, y0: 8,  x1: 38, y1: 12, kind: 'jog' },   // right straight
      { x0: 35, y0: 15, x1: 36, y1: 18, kind: 'jog' },
      { x0: 22, y0: 22, x1: 28, y1: 23, kind: 'jog' },   // bottom straight
      { x0: 12, y0: 20, x1: 17, y1: 21, kind: 'jog' },
      { x0: 1,  y0: 14, x1: 2,  y1: 18, kind: 'jog' },   // left straight
      { x0: 3,  y0: 7,  x1: 4,  y1: 10, kind: 'jog' }
    ]),
    route: [
      { x: 2,  y: 2  },   // 0  top-left, heading east on the outer lane
      { x: 8,  y: 2  },   // 1  drop to the inner lane before the first block
      { x: 8,  y: 4  },   // 2
      { x: 22, y: 4  },   // 3  climb back out before the second
      { x: 22, y: 2  },   // 4
      { x: 36, y: 2  },   // 5  turn down the right-hand inner lane
      { x: 36, y: 14 },   // 6  step out before the inner block
      { x: 38, y: 14 },   // 7
      { x: 38, y: 21 },   // 8  turn along the bottom inner lane
      { x: 20, y: 21 },   // 9  step out before the inner block
      { x: 20, y: 23 },   // 10
      { x: 4,  y: 23 },   // 11 turn up the left inner lane
      { x: 4,  y: 12 },   // 12 step out before the inner block
      { x: 2,  y: 12 }    // 13 back up the outer lane to waypoint 0
    ],
    startLeg: 0,
    checkpoints: [
      { x0: 32.5, y0: 1,    x1: 33.5, y1: 5    },
      { x0: 35,   y0: 16.5, x1: 39,   y1: 17.5 },
      { x0: 7.5,  y0: 20,   x1: 8.5,  y1: 24   },
      { x0: 1,    y0: 7.5,  x1: 5,    y1: 8.5  }
    ],
    finish: { x0: 5.6, y0: 1, x1: 6.4, y1: 5, dir: { x: 1, y: 0 } },
    startGrid: [
      { x: 4.9, y: 2, wp: 1 },
      { x: 4.9, y: 4, wp: 2 },
      { x: 3.0, y: 2, wp: 1 },
      { x: 3.0, y: 4, wp: 2 }
    ]
  };


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

  /* ---- Forest 1: PINEFALL ---------------------------------------------
   *
   *        0        10        20        30       39
   *      0 +--------------------------------------+
   *        |            top road, rows 1-9        |   9 cells
   *     10 |        +--------------------+        |
   *        |  left  |      infield       | right  |   both 9 cells
   *     18 |        +--------------------+        |
   *        |  ##A###         ###B###              |   bottom road, rows 18-26
   *     27 +--------------------------------------+
   *
   * One S, on the main straight, and nothing else: six corners a lap. The
   * easiest thing in the game.
   * -------------------------------------------------------------------- */
  var PINEFALL = {
    id: 'pinefall',
    name: 'PINEFALL',
    blurb: 'A wide ring through the pines, with one lane change on the straight.',
    grade: 'BEGINNER',
    cols: 40,
    rows: 28,
    aiPace: 0.95,
    aiOffsetScale: 3,
    aiMistakeScale: 1,
    weather: 'leaves',
    theme: FOREST,
    walls: border(40, 28).concat([
      { x0: 10, y0: 10, x1: 29, y1: 17, kind: 'infield' },
      { x0: 11, y0: 18, x1: 16, y1: 20, kind: 'jog' },   // stand A, pushes you low
      { x0: 25, y0: 24, x1: 30, y1: 26, kind: 'jog' }    // stand B, pushes you back up
    ]),
    route: [
      { x: 5.5,  y: 24   },   // 0  onto the main straight, low lane
      { x: 21,   y: 24   },   // 1  clear of stand A
      { x: 21,   y: 21   },   // 2  the lane change
      { x: 34.5, y: 21   },   // 3  over stand B and into the right road
      { x: 34.5, y: 5.5  },   // 4  up the right side
      { x: 5.5,  y: 5.5  }    // 5  along the top, then down the left to 0
    ],
    startLeg: 0,
    checkpoints: [
      { x0: 28, y0: 18, x1: 29, y1: 27 },   // out of the S
      { x0: 30, y0: 13, x1: 39, y1: 14 },   // up the right
      { x0: 20, y0: 1,  x1: 21, y1: 10 },   // along the top
      { x0: 1,  y0: 16, x1: 10, y1: 17 }    // down the left
    ],
    finish: { x0: 9.6, y0: 18, x1: 10.4, y1: 27, dir: { x: 1, y: 0 } },
    startGrid: [
      { x: 8.0, y: 22.8, wp: 1 },
      { x: 8.0, y: 25.2, wp: 1 },
      { x: 6.1, y: 22.8, wp: 1 },
      { x: 6.1, y: 25.2, wp: 1 }
    ]
  };

  /* ---- Forest 2: HOLLOW ------------------------------------------------
   * A longer map, so the main straight runs twenty-one cells, and three lane
   * changes rather than one: the S on the bottom, another climbing the
   * right-hand side, a third along the top. Ten corners a lap.
   * -------------------------------------------------------------------- */
  var HOLLOW = {
    id: 'hollow',
    name: 'HOLLOW',
    blurb: 'A long main straight, then three changes of lane on the way back.',
    grade: 'BEGINNER',
    cols: 46,
    rows: 28,
    aiPace: 0.95,
    aiOffsetScale: 2,
    aiMistakeScale: 1,
    weather: 'leaves',
    theme: FOREST,
    walls: border(46, 28).concat([
      { x0: 10, y0: 10, x1: 35, y1: 17, kind: 'infield' },
      { x0: 12, y0: 18, x1: 17, y1: 20, kind: 'jog' },   // the bottom S
      { x0: 26, y0: 24, x1: 31, y1: 26, kind: 'jog' },
      { x0: 36, y0: 14, x1: 38, y1: 17, kind: 'jog' },   // climbing the right
      { x0: 42, y0: 3,  x1: 44, y1: 6,  kind: 'jog' },
      { x0: 30, y0: 1,  x1: 35, y1: 3,  kind: 'jog' },   // along the top
      { x0: 14, y0: 7,  x1: 19, y1: 9,  kind: 'jog' }
    ]),
    route: [
      { x: 5.5,  y: 24   },   // 0  the main straight, low lane
      { x: 22,   y: 24   },   // 1
      { x: 22,   y: 21   },   // 2  lane change
      { x: 42,   y: 21   },   // 3  into the right road, outside lane
      { x: 42,   y: 10.5 },   // 4
      { x: 39,   y: 10.5 },   // 5  lane change
      { x: 39,   y: 7    },   // 6  into the top road, low lane
      { x: 25,   y: 7    },   // 7
      { x: 25,   y: 4    },   // 8  lane change
      { x: 5.5,  y: 4    }    // 9  along the top, then down the left to 0
    ],
    startLeg: 0,
    checkpoints: [
      { x0: 34, y0: 18, x1: 35, y1: 27 },   // out of the bottom S
      { x0: 36, y0: 15, x1: 45, y1: 16 },   // climbing the right
      { x0: 12, y0: 1,  x1: 13, y1: 10 },   // out of the top S
      { x0: 1,  y0: 16, x1: 10, y1: 17 }    // down the left
    ],
    finish: { x0: 9.6, y0: 18, x1: 10.4, y1: 27, dir: { x: 1, y: 0 } },
    startGrid: [
      { x: 8.0, y: 22.8, wp: 1 },
      { x: 8.0, y: 25.2, wp: 1 },
      { x: 6.1, y: 22.8, wp: 1 },
      { x: 6.1, y: 25.2, wp: 1 }
    ]
  };

  /* ---- Forest 3: CANOPY ------------------------------------------------
   * Back to the compact map, so the straights are shorter, and stands on all
   * four sides: every straight asks you to move. Twelve corners a lap with
   * five of them running into the next. Still nine cells wide and still
   * long runoffs - the forest never punishes, it only asks more often.
   * -------------------------------------------------------------------- */
  var CANOPY = {
    id: 'canopy',
    name: 'CANOPY',
    blurb: 'Every straight asks you to move. Five corners run into the next.',
    grade: 'BEGINNER',
    cols: 40,
    rows: 28,
    aiPace: 0.95,
    aiOffsetScale: 2,
    aiMistakeScale: 1,
    weather: 'leaves',
    theme: FOREST,
    walls: border(40, 28).concat([
      { x0: 10, y0: 10, x1: 29, y1: 17, kind: 'infield' },
      { x0: 11, y0: 18, x1: 16, y1: 20, kind: 'jog' },   // the bottom S
      { x0: 25, y0: 24, x1: 30, y1: 26, kind: 'jog' },
      { x0: 30, y0: 14, x1: 32, y1: 17, kind: 'jog' },   // up the right
      { x0: 36, y0: 3,  x1: 38, y1: 6,  kind: 'jog' },
      { x0: 23, y0: 1,  x1: 28, y1: 3,  kind: 'jog' },   // along the top
      { x0: 10, y0: 7,  x1: 15, y1: 9,  kind: 'jog' },
      { x0: 1,  y0: 2,  x1: 3,  y1: 5,  kind: 'jog' },   // down the left
      { x0: 7,  y0: 13, x1: 9,  y1: 17, kind: 'jog' }
    ]),
    route: [
      { x: 4,    y: 24   },   // 0  the main straight, low lane
      { x: 21,   y: 24   },   // 1
      { x: 21,   y: 21   },   // 2  lane change
      { x: 36,   y: 21   },   // 3  into the right road, outside lane
      { x: 36,   y: 10.5 },   // 4
      { x: 33,   y: 10.5 },   // 5  lane change
      { x: 33,   y: 7    },   // 6  into the top road, low lane
      { x: 19.5, y: 7    },   // 7
      { x: 19.5, y: 4    },   // 8  lane change
      { x: 7,    y: 4    },   // 9  into the left road, inside lane
      { x: 7,    y: 9.5  },   // 10
      { x: 4,    y: 9.5  }    // 11 lane change, then down the left to 0
    ],
    startLeg: 0,
    checkpoints: [
      { x0: 28, y0: 18, x1: 29, y1: 27 },   // out of the bottom S
      { x0: 30, y0: 16, x1: 39, y1: 17 },   // up the right-hand straight
      { x0: 11, y0: 1,  x1: 12, y1: 10 },   // out of the top S
      { x0: 1,  y0: 20, x1: 11, y1: 21 }    // down the left
    ],
    finish: { x0: 8.6, y0: 18, x1: 9.4, y1: 27, dir: { x: 1, y: 0 } },
    startGrid: [
      { x: 7.4, y: 22.8, wp: 1 },
      { x: 7.4, y: 25.2, wp: 1 },
      { x: 5.5, y: 22.8, wp: 1 },
      { x: 5.5, y: 25.2, wp: 1 }
    ]
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

  /* ---- Desert 1: DUNELINE ----------------------------------------------
   * Long and low: a 48 x 26 ring with two twenty-cell straights and one
   * change of lane on each. Eight corners a lap.
   * -------------------------------------------------------------------- */
  var DUNELINE = {
    id: 'duneline',
    name: 'DUNELINE',
    blurb: 'Two long straights across the sand, one change of lane on each.',
    grade: 'EASY',
    cols: 48,
    rows: 26,
    aiPace: 0.95,
    aiOffsetScale: 2,
    aiMistakeScale: 1,
    weather: 'dust',
    theme: DESERT,
    walls: border(48, 26).concat([
      { x0: 10, y0: 10, x1: 37, y1: 15, kind: 'infield' },
      { x0: 12, y0: 16, x1: 17, y1: 18, kind: 'jog' },   // the bottom straight
      { x0: 24, y0: 22, x1: 29, y1: 24, kind: 'jog' },
      { x0: 30, y0: 1,  x1: 35, y1: 3,  kind: 'jog' },   // the top straight
      { x0: 17, y0: 7,  x1: 22, y1: 9,  kind: 'jog' }
    ]),
    route: [
      { x: 5.5,  y: 22   },   // 0  the main straight, low lane
      { x: 21,   y: 22   },   // 1
      { x: 21,   y: 19   },   // 2  lane change
      { x: 42.5, y: 19   },   // 3  into the right road
      { x: 42.5, y: 7    },   // 4  along the top, low lane
      { x: 26.5, y: 7    },   // 5
      { x: 26.5, y: 4    },   // 6  lane change
      { x: 5.5,  y: 4    }    // 7  into the left road, then down to 0
    ],
    startLeg: 0,
    checkpoints: [
      { x0: 35, y0: 16, x1: 36, y1: 25 },   // out of the bottom change
      { x0: 38, y0: 12, x1: 47, y1: 13 },   // up the right
      { x0: 11, y0: 1,  x1: 12, y1: 10 },   // out of the top change
      { x0: 1,  y0: 13, x1: 10, y1: 14 }    // down the left
    ],
    finish: { x0: 9.6, y0: 16, x1: 10.4, y1: 25, dir: { x: 1, y: 0 } },
    startGrid: [
      { x: 8.0, y: 20.8, wp: 1 },
      { x: 8.0, y: 23.2, wp: 1 },
      { x: 6.1, y: 20.8, wp: 1 },
      { x: 6.1, y: 23.2, wp: 1 }
    ]
  };

  /* ---- Desert 2: SALT FLATS --------------------------------------------
   * Tall and square, and every side of it asks you to move: four changes of
   * lane, twelve corners a lap.
   * -------------------------------------------------------------------- */
  var SALTFLATS = {
    id: 'saltflats',
    name: 'SALT FLATS',
    blurb: 'Four changes of lane, one on every side of the circuit.',
    grade: 'EASY +',
    cols: 40,
    rows: 32,
    aiPace: 0.95,
    aiOffsetScale: 2,
    aiMistakeScale: 1,
    weather: 'dust',
    theme: DESERT,
    walls: border(40, 32).concat([
      { x0: 10, y0: 10, x1: 29, y1: 21, kind: 'infield' },
      { x0: 12, y0: 22, x1: 17, y1: 24, kind: 'jog' },   // the bottom
      { x0: 24, y0: 28, x1: 29, y1: 30, kind: 'jog' },
      { x0: 30, y0: 17, x1: 32, y1: 21, kind: 'jog' },   // up the right
      { x0: 36, y0: 6,  x1: 38, y1: 10, kind: 'jog' },
      { x0: 22, y0: 1,  x1: 27, y1: 3,  kind: 'jog' },   // along the top
      { x0: 10, y0: 7,  x1: 15, y1: 9,  kind: 'jog' },
      { x0: 1,  y0: 8,  x1: 3,  y1: 12, kind: 'jog' },   // down the left
      { x0: 7,  y0: 19, x1: 9,  y1: 23, kind: 'jog' }
    ]),
    route: [
      { x: 4,  y: 28 },   // 0  the main straight, low lane
      { x: 21, y: 28 },   // 1
      { x: 21, y: 25 },   // 2  lane change
      { x: 36, y: 25 },   // 3  into the right road, outside lane
      { x: 36, y: 14 },   // 4
      { x: 33, y: 14 },   // 5  lane change
      { x: 33, y: 7  },   // 6  into the top road, low lane
      { x: 19, y: 7  },   // 7
      { x: 19, y: 4  },   // 8  lane change
      { x: 7,  y: 4  },   // 9  into the left road, inside lane
      { x: 7,  y: 16 },   // 10
      { x: 4,  y: 16 }    // 11 lane change, then down the left to 0
    ],
    startLeg: 0,
    checkpoints: [
      { x0: 32, y0: 22, x1: 33, y1: 31 },   // out of the bottom change
      { x0: 30, y0: 10, x1: 36, y1: 11 },   // out of the right-hand change
      { x0: 12, y0: 1,  x1: 13, y1: 7  },   // out of the top change
      { x0: 1,  y0: 19, x1: 7,  y1: 20 }    // down the left
    ],
    finish: { x0: 8.6, y0: 22, x1: 9.4, y1: 31, dir: { x: 1, y: 0 } },
    startGrid: [
      { x: 7.4, y: 26.8, wp: 1 },
      { x: 7.4, y: 29.2, wp: 1 },
      { x: 5.5, y: 26.8, wp: 1 },
      { x: 5.5, y: 29.2, wp: 1 }
    ]
  };

  /* ---- Desert 3: CANYON RUN --------------------------------------------
   * The big one. A double-S on the main straight - out, back, out again
   * before the first corner - then one change on each of the other three
   * sides. Five changes and fourteen corners a lap.
   * -------------------------------------------------------------------- */
  var CANYONRUN = {
    id: 'canyonrun',
    name: 'CANYON RUN',
    blurb: 'A double-S down the main straight, then a change on every side.',
    grade: 'EASY ++',
    cols: 46,
    rows: 30,
    aiPace: 0.95,
    aiOffsetScale: 2,
    aiMistakeScale: 1,
    weather: 'dust',
    theme: DESERT,
    walls: border(46, 30).concat([
      { x0: 10, y0: 10, x1: 35, y1: 19, kind: 'infield' },
      { x0: 10, y0: 20, x1: 15, y1: 22, kind: 'jog' },   // the double-S
      { x0: 22, y0: 26, x1: 27, y1: 28, kind: 'jog' },
      { x0: 34, y0: 20, x1: 39, y1: 22, kind: 'jog' },
      { x0: 36, y0: 15, x1: 38, y1: 19, kind: 'jog' },   // up the right
      { x0: 42, y0: 4,  x1: 44, y1: 8,  kind: 'jog' },
      { x0: 27, y0: 1,  x1: 32, y1: 3,  kind: 'jog' },   // along the top
      { x0: 15, y0: 7,  x1: 20, y1: 9,  kind: 'jog' },
      { x0: 1,  y0: 7,  x1: 3,  y1: 11, kind: 'jog' },   // down the left
      // This one has to finish clear of the start/finish line: a stand beside
      // it narrows the road exactly where the grid is measured, and a
      // sixteen-car field lost four places to it.
      { x0: 7,  y0: 18, x1: 9,  y1: 20, kind: 'jog' }
    ]),
    route: [
      { x: 4,  y: 26 },   // 0  the main straight, low lane
      { x: 19, y: 26 },   // 1
      { x: 19, y: 23 },   // 2  out
      { x: 31, y: 23 },   // 3
      { x: 31, y: 26 },   // 4  and back
      { x: 42, y: 26 },   // 5  into the right road, outside lane
      { x: 42, y: 12 },   // 6
      { x: 39, y: 12 },   // 7  lane change
      { x: 39, y: 7  },   // 8  into the top road, low lane
      { x: 24, y: 7  },   // 9
      { x: 24, y: 4  },   // 10 lane change
      { x: 7,  y: 4  },   // 11 into the left road, inside lane
      { x: 7,  y: 15 },   // 12
      { x: 4,  y: 15 }    // 13 lane change, then down the left to 0
    ],
    startLeg: 0,
    checkpoints: [
      { x0: 32, y0: 20, x1: 33, y1: 29 },   // out of the double-S
      { x0: 36, y0: 10, x1: 45, y1: 11 },   // out of the right-hand change
      { x0: 11, y0: 1,  x1: 12, y1: 10 },   // out of the top change
      { x0: 1,  y0: 17, x1: 10, y1: 18 }    // down the left
    ],
    finish: { x0: 7.6, y0: 20, x1: 8.4, y1: 29, dir: { x: 1, y: 0 } },
    startGrid: [
      { x: 6.4, y: 24.8, wp: 1 },
      { x: 6.4, y: 27.2, wp: 1 },
      { x: 4.5, y: 24.8, wp: 1 },
      { x: 4.5, y: 27.2, wp: 1 }
    ]
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

  /* ---- Snow 1: FROSTLINE -----------------------------------------------
   * NOT a ring. There is no central island: the middle of the map is a
   * corridor walled on both sides that you enter at one end and leave at the
   * other, and the lap is a switchback -
   *
   *      +----------------------------+------+
   *      |########################| ^  |      |   top corridor, eastbound
   *      |########################| climb     |
   *      |  <-------------------- middle #####|   walled both sides
   *      |####################################|
   *      |  ------------------------------->  |   main straight, westbound
   *      +------------------------------------+     (right side, southbound)
   *
   * Down the right, west along the bottom, up the left link, east along the
   * middle, up the climb, east along the top, and back into the right. The
   * middle corridor has exactly one way in and one way out, so the lap is
   * forced by the walls rather than by the racing line.
   * -------------------------------------------------------------------- */
  var FROSTLINE = {
    id: 'frostline',
    mirror: true,        // drawn clockwise; see DIRECTION below
    name: 'FROSTLINE',
    blurb: 'A switchback. The middle of the map is a corridor, not an island.',
    grade: 'MODERATE',
    cols: 44,
    rows: 34,
    aiPace: 0.95,
    aiOffsetScale: 2,
    aiMistakeScale: 1,
    weather: 'snow',
    theme: SNOW,
    walls: border(44, 34).concat([
      // the three masses that make the switchback
      { x0: 1,  y0: 1,  x1: 25, y1: 12, kind: 'infield' },   // above the middle
      { x0: 33, y0: 10, x1: 34, y1: 20, kind: 'infield' },   // its east end
      { x0: 10, y0: 21, x1: 34, y1: 24, kind: 'infield' },   // below it
      // ice out on the road
      { x0: 26, y0: 25, x1: 31, y1: 27, kind: 'jog' },       // main straight
      { x0: 13, y0: 30, x1: 18, y1: 32, kind: 'jog' },
      { x0: 9,  y0: 13, x1: 14, y1: 15, kind: 'jog' },       // middle corridor
      { x0: 22, y0: 18, x1: 27, y1: 20, kind: 'jog' },
      { x0: 40, y0: 9,  x1: 42, y1: 13, kind: 'jog' },       // down the right
      { x0: 35, y0: 21, x1: 37, y1: 25, kind: 'jog' }
    ]),
    route: [
      { x: 40.5, y: 30.5 },   // 0  the main straight, westbound
      { x: 22.5, y: 30.5 },   // 1
      { x: 22.5, y: 27.5 },   // 2  lane change
      { x: 5.5,  y: 27.5 },   // 3  into the left link
      { x: 5.5,  y: 18.5 },   // 4  up into the middle corridor, eastbound
      { x: 18.5, y: 18.5 },   // 5
      { x: 18.5, y: 15.5 },   // 6  lane change
      { x: 29.5, y: 15.5 },   // 7  to the climb
      { x: 29.5, y: 5.5  },   // 8  up into the top corridor
      { x: 37.5, y: 5.5  },   // 9  east into the right-hand side
      { x: 37.5, y: 17.5 },   // 10
      { x: 40.5, y: 17.5 }    // 11 lane change, then south back to 0
    ],
    startLeg: 0,
    checkpoints: [
      { x0: 10, y0: 25, x1: 11, y1: 33 },   // out of the main-straight change
      { x0: 22, y0: 13, x1: 23, y1: 21 },   // out of the middle corridor
      { x0: 33, y0: 1,  x1: 34, y1: 10 },   // along the top
      { x0: 38, y0: 21, x1: 43, y1: 22 }    // down the right
    ],
    finish: { x0: 32.6, y0: 25, x1: 33.4, y1: 33, dir: { x: -1, y: 0 } },
    startGrid: [
      { x: 34.5, y: 29.3, wp: 1 },
      { x: 34.5, y: 31.7, wp: 1 },
      { x: 36.4, y: 29.3, wp: 1 },
      { x: 36.4, y: 31.7, wp: 1 }
    ]
  };

  /* ---- Snow 2: GLACIER -------------------------------------------------
   * The racing line crosses itself. Two lobes meet at an eight-by-eight
   * junction in the middle of the map, and you go through it twice a lap -
   * once heading north out of the main straight, once heading west along the
   * middle. Nothing else in the themed set has a crossing, and it changes
   * the racing rather than the geometry: the field arrives at that square
   * from two directions at once.
   * -------------------------------------------------------------------- */
  var GLACIER = {
    id: 'glacier',
    name: 'GLACIER',
    blurb: 'A figure of eight. You cross your own line twice a lap.',
    grade: 'MODERATE +',
    cols: 48,
    rows: 39,
    aiPace: 0.95,
    aiOffsetScale: 2,
    aiMistakeScale: 1,
    weather: 'snow',
    theme: SNOW,
    walls: border(48, 39).concat([
      { x0: 1,  y0: 1,  x1: 19, y1: 15, kind: 'infield' },   // outside the eight
      { x0: 28, y0: 24, x1: 46, y1: 37, kind: 'infield' },
      { x0: 9,  y0: 24, x1: 19, y1: 29, kind: 'infield' },   // the lower-left lobe
      { x0: 28, y0: 9,  x1: 38, y1: 15, kind: 'infield' },   // the upper-right lobe
      { x0: 13, y0: 30, x1: 18, y1: 32, kind: 'jog' },       // ice on the straight
      { x0: 25, y0: 35, x1: 27, y1: 37, kind: 'jog' },
      { x0: 26, y0: 6,  x1: 31, y1: 8,  kind: 'jog' },       // ice along the top
      { x0: 38, y0: 1,  x1: 42, y1: 3,  kind: 'jog' },
      { x0: 30, y0: 16, x1: 35, y1: 18, kind: 'jog' },       // ice in the middle
      { x0: 8,  y0: 21, x1: 13, y1: 23, kind: 'jog' }
    ]),
    route: [
      { x: 5,    y: 35.5 },   // 0  the main straight, eastbound
      { x: 22,   y: 35.5 },   // 1
      { x: 22,   y: 32.5 },   // 2  lane change
      { x: 24,   y: 32.5 },   // 3
      { x: 24,   y: 3.5  },   // 4  north up the spine, THROUGH the crossing
      { x: 35,   y: 3.5  },   // 5  east along the top
      { x: 35,   y: 6.5  },   // 6  lane change
      { x: 43,   y: 6.5  },   // 7  into the right-hand side
      { x: 43,   y: 21.5 },   // 8  south, then west along the middle
      { x: 18,   y: 21.5 },   // 9  back through the crossing
      { x: 18,   y: 18.5 },   // 10 lane change
      { x: 5,    y: 18.5 }    // 11 into the left-hand side, then down to 0
    ],
    startLeg: 0,
    checkpoints: [
      { x0: 20, y0: 27, x1: 28, y1: 28 },   // up the spine
      { x0: 35, y0: 1,  x1: 36, y1: 9  },   // along the top
      { x0: 28, y0: 16, x1: 29, y1: 24 },   // west along the middle
      { x0: 1,  y0: 26, x1: 9,  y1: 27 }    // down the left
    ],
    finish: { x0: 10.1, y0: 30, x1: 10.9, y1: 38, dir: { x: 1, y: 0 } },
    startGrid: [
      { x: 8.9, y: 34.3, wp: 1 },
      { x: 8.9, y: 36.7, wp: 1 },
      { x: 7.0, y: 34.3, wp: 1 },
      { x: 7.0, y: 36.7, wp: 1 }
    ]
  };

  /* ---- Snow 3: WHITEOUT ------------------------------------------------
   * An L-shaped circuit: the top right of the map is solid ground, so the
   * lap runs round an L rather than a rectangle and the elbow is a wide
   * open sweep rather than a corner. A thirty-seven cell main straight with
   * a double-S in it, then a change of lane on each of the other three
   * sides. Five changes and sixteen corners a lap.
   * -------------------------------------------------------------------- */
  var WHITEOUT = {
    id: 'whiteout',
    name: 'WHITEOUT',
    blurb: 'An L, not a rectangle. Longest straight in the game, with a double-S.',
    grade: 'MODERATE ++',
    cols: 48,
    rows: 36,
    aiPace: 0.95,
    aiOffsetScale: 2,
    aiMistakeScale: 1,
    weather: 'snow',
    theme: SNOW,
    walls: border(48, 36).concat([
      { x0: 29, y0: 1,  x1: 46, y1: 14, kind: 'infield' },   // the missing corner
      { x0: 9,  y0: 9,  x1: 20, y1: 26, kind: 'infield' },   // the L-shaped island
      { x0: 21, y0: 23, x1: 38, y1: 26, kind: 'infield' },
      { x0: 6,  y0: 20, x1: 8,  y1: 26, kind: 'infield' },   // its foot
      { x0: 10, y0: 27, x1: 15, y1: 29, kind: 'jog' },       // the double-S
      { x0: 22, y0: 32, x1: 27, y1: 34, kind: 'jog' },
      { x0: 34, y0: 27, x1: 39, y1: 29, kind: 'jog' },
      { x0: 35, y0: 15, x1: 39, y1: 17, kind: 'jog' },       // round the elbow
      { x0: 23, y0: 20, x1: 28, y1: 22, kind: 'jog' },
      { x0: 15, y0: 6,  x1: 20, y1: 8,  kind: 'jog' },       // along the top
      { x0: 3,  y0: 1,  x1: 8,  y1: 3,  kind: 'jog' },
      { x0: 1,  y0: 9,  x1: 3,  y1: 13, kind: 'jog' }        // down the left
    ]),
    route: [
      { x: 3.5,  y: 32.5 },   // 0  the main straight, eastbound
      { x: 19,   y: 32.5 },   // 1
      { x: 19,   y: 29.5 },   // 2  out
      { x: 31,   y: 29.5 },   // 3
      { x: 31,   y: 32.5 },   // 4  and back
      { x: 42.5, y: 32.5 },   // 5  into the right-hand side
      { x: 42.5, y: 20.5 },   // 6  north into the elbow, westbound
      { x: 32,   y: 20.5 },   // 7
      { x: 32,   y: 17.5 },   // 8  lane change
      { x: 24.5, y: 17.5 },   // 9  into the corridor beside the island
      { x: 24.5, y: 3.5  },   // 10 north into the top road
      { x: 12,   y: 3.5  },   // 11
      { x: 12,   y: 6.5  },   // 12 lane change
      { x: 6.5,  y: 6.5  },   // 13 into the left-hand side
      { x: 6.5,  y: 17   },   // 14
      { x: 3.5,  y: 17   }    // 15 lane change, then down the left to 0
    ],
    startLeg: 0,
    checkpoints: [
      { x0: 32, y0: 27, x1: 33, y1: 35 },   // out of the double-S
      { x0: 29, y0: 15, x1: 30, y1: 23 },   // round the elbow
      { x0: 12, y0: 1,  x1: 13, y1: 9  },   // out of the top change
      { x0: 1,  y0: 15, x1: 9,  y1: 16 }    // down the left
    ],
    finish: { x0: 7.6, y0: 27, x1: 8.4, y1: 35, dir: { x: 1, y: 0 } },
    startGrid: [
      { x: 6.4, y: 31.3, wp: 1 },
      { x: 6.4, y: 33.7, wp: 1 },
      { x: 4.5, y: 31.3, wp: 1 },
      { x: 4.5, y: 33.7, wp: 1 }
    ]
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

  /* ---- Cliffs 1: SCREE -------------------------------------------------
   * A serpentine. There is no island anywhere on this map: four vertical
   * lanes, folded into one another end to end, and a main straight along the
   * bottom that returns you to the first of them.
   *
   *      +-----------------+##+--------------+
   *      |  A --> top --> B|##|C --> top --> D|   folds at the top...
   *      |  ^           |  |##|  ^          | |
   *      |  ^           v  |##|  ^          | |
   *      |  ^   +----- link ---+  ^         | |   ...and at the bottom
   *      |  ^   +#################+         | |
   *      |  <---------- main straight ------- |
   *      +------------------------------------+
   *
   * Up A, across the top, down B, across the middle link, up C, across the
   * top again, down D, and west along the bottom. Eight corners of structure
   * and eight lane changes on top of them: the lap is a chain of direction
   * changes with two long straights to breathe on.
   * -------------------------------------------------------------------- */
  var SCREE = {
    id: 'scree',
    mirror: true,        // drawn clockwise; see DIRECTION below
    name: 'SCREE',
    blurb: 'A serpentine. Four lanes folded end to end, and no island at all.',
    grade: 'CHALLENGING',
    cols: 46,
    rows: 38,
    aiPace: 0.95,
    aiOffsetScale: 1.5,
    aiMistakeScale: 1,
    weather: 'grit',
    theme: CLIFF,
    walls: border(46, 38).concat([
      // the four masses that fold the lanes into one another
      { x0: 9,  y0: 9,  x1: 12, y1: 28, kind: 'edge' },     // between A and B
      { x0: 21, y0: 1,  x1: 24, y1: 16, kind: 'edge' },     // between B and C
      { x0: 13, y0: 25, x1: 32, y1: 28, kind: 'edge' },     // the floor under both
      { x0: 33, y0: 9,  x1: 36, y1: 28, kind: 'edge' },     // between C and D
      /* Three boulders, and only three. The first cut had one in every lane
       * and ran to 742 crashes a thousand laps - two and a half times the
       * snow three, where the brief was a little above them. Each lane change
       * on this track is worth about a third of the crash count on its own,
       * because the folds already are the difficulty: B, C and the middle
       * link are left clean on purpose, so what you are driving is the
       * serpentine rather than furniture standing in it.
       *
       * Each stand also sits well down its lane. Put one at the mouth and
       * the corner out of the fold, the lane change and the corner into the
       * next fold arrive within five cells of each other, which is a chicane,
       * and the AI cannot string three of those together at any speed. */
      { x0: 1,  y0: 8,  x1: 4,  y1: 14, kind: 'jog' },      // lane A
      { x0: 41, y0: 21, x1: 44, y1: 26, kind: 'jog' },      // lane D
      { x0: 18, y0: 33, x1: 23, y1: 36, kind: 'jog' }       // the main straight
    ]),
    route: [
      { x: 39,   y: 33   },   // 0  onto the main straight, westbound
      { x: 27,   y: 33   },   // 1
      { x: 27,   y: 31   },   // 2  up over the stand
      { x: 3,    y: 31   },   // 3  turn north into lane A
      { x: 3,    y: 18   },   // 4
      { x: 6.5,  y: 18   },   // 5  round the stand in A
      { x: 6.5,  y: 4.5  },   // 6  into the top corridor, eastbound
      { x: 16.5, y: 4.5  },   // 7  turn south into lane B
      { x: 16.5, y: 20.5 },   // 8  into the middle link, eastbound
      { x: 28.5, y: 20.5 },   // 9  turn north into lane C
      { x: 28.5, y: 4.5  },   // 10 back into the top corridor
      { x: 42.5, y: 4.5  },   // 11 turn south into lane D
      { x: 42.5, y: 18   },   // 12
      { x: 39,   y: 18   }    // 13 round the stand in D, then south back to 0
    ],
    startLeg: 0,
    checkpoints: [
      { x0: 1,  y0: 16, x1: 9,  y1: 17 },   // up lane A
      { x0: 13, y0: 12, x1: 21, y1: 13 },   // down lane B
      { x0: 25, y0: 9,  x1: 33, y1: 10 },   // up lane C
      { x0: 37, y0: 12, x1: 45, y1: 13 }    // down lane D
    ],
    finish: { x0: 33.6, y0: 29, x1: 34.4, y1: 37, dir: { x: -1, y: 0 } },
    startGrid: [
      { x: 35.5, y: 31.8, wp: 1 },
      { x: 35.5, y: 34.2, wp: 1 },
      { x: 37.4, y: 31.8, wp: 1 },
      { x: 37.4, y: 34.2, wp: 1 }
    ]
  };


  /* ---- Cliffs 2: QUARRY ------------------------------------------------
   * The map is a plus, not a rectangle, and that is the whole idea.
   *
   *              +----------+
   *              |  top arm |
   *      +-------+    ##    +-------+
   *      | left    ########   right |
   *      +-------+    ##    +-------+
   *              | bottom   |
   *              +----------+
   *
   * The road is the gap between a plus-shaped map and a smaller plus-shaped
   * island, so the lap runs out along one side of each arm, round its tip
   * and back down the other side. Twelve corners, and four of them are
   * re-entrant - you turn around the OUTSIDE of an armpit rather than the
   * inside of an island. Nothing else in the game asks for that corner, and
   * it is the one that catches people: the wall you are turning away from is
   * behind you, so there is nothing to aim at.
   * -------------------------------------------------------------------- */
  var QUARRY = {
    id: 'quarry',
    mirror: true,        // drawn clockwise; see DIRECTION below
    name: 'QUARRY',
    blurb: 'A plus-shaped pit. Four arms, and four corners that turn outward.',
    grade: 'CHALLENGING ++',
    cols: 44,
    rows: 40,
    aiPace: 0.95,
    aiOffsetScale: 2,
    aiMistakeScale: 1,
    weather: 'grit',
    theme: CLIFF,
    walls: border(44, 40).concat([
      // the four corners the plus cuts away
      { x0: 1,  y0: 1,  x1: 10, y1: 9,  kind: 'edge' },
      { x0: 33, y0: 1,  x1: 42, y1: 9,  kind: 'edge' },
      { x0: 1,  y0: 32, x1: 10, y1: 38, kind: 'edge' },
      { x0: 33, y0: 32, x1: 42, y1: 38, kind: 'edge' },
      // and the island, which is the same plus one size down
      { x0: 9,  y0: 18, x1: 34, y1: 23, kind: 'infield' },
      { x0: 19, y0: 9,  x1: 24, y1: 30, kind: 'infield' },
      /* A stand part way along each arm and each corridor, three cells
       * thick against one wall, leaving a five-cell gate with the racing
       * line down the middle of it. Five cells is exactly what the snow
       * three use, and that is deliberate: what makes this track harder is
       * that it has SEVEN of them and twelve corners, not that any one of
       * them is tighter.
       *
       * The first cut used four- and three-cell gates and measured 1208
       * crashes a thousand laps at the shipped settings - three times the
       * hardest snow track. A three-cell gate and a three-cell turn radius
       * cannot both exist on the same corner: the car is still arcing when
       * it arrives. Margin is the sharpest lever there is, which is exactly
       * why it is the wrong one to lean on.
       *
       * The bottom arm is left open. It is the main straight, the grid lines
       * up on it, and a lap needs somewhere to breathe. */
      /* Each arm gets a PAIR of stands, one against each wall and offset
       * along the arm, so the lane they leave clear swaps half way down it.
       * That is a lane change rather than a gate, and it is the right lever
       * here: this track ships at a three-cell turn radius, where a tight
       * gate is not hard, it is impossible - the car is still arcing when it
       * arrives - while a corner costs the same at every radius.
       *
       * An earlier cut leaned on margin instead, with four- and three-cell
       * gates. It measured 1208 crashes a thousand laps at the shipped
       * settings, three times the hardest snow track, and every one of them
       * was the same crash. Margin is the sharpest lever there is, which is
       * exactly why it is the wrong one to lean on.
       *
       * The corridors between the arms keep a plain five-cell gate, which is
       * what the snow three use. The bottom arm is left open: it is the main
       * straight, the grid lines up on it, and a lap needs somewhere to
       * breathe. */
      { x0: 1,  y0: 23, x1: 4,  y1: 27, kind: 'jog' },   // the left arm
      { x0: 5,  y0: 15, x1: 8,  y1: 18, kind: 'jog' },
      { x0: 18, y0: 1,  x1: 25, y1: 3,  kind: 'jog' },   // the top arm
      { x0: 40, y0: 18, x1: 42, y1: 23, kind: 'jog' },   // the right arm
      { x0: 9,  y0: 15, x1: 12, y1: 17, kind: 'jog' },   // the four corridors
      { x0: 31, y0: 15, x1: 34, y1: 17, kind: 'jog' },
      { x0: 9,  y0: 24, x1: 12, y1: 26, kind: 'jog' },
      { x0: 31, y0: 24, x1: 34, y1: 26, kind: 'jog' }
    ]),
    route: [
      { x: 29,   y: 35   },   // 0  across the bottom tip, westbound
      { x: 15,   y: 35   },   // 1  turn north up the bottom arm
      { x: 15,   y: 29.5 },   // 2  through the lower left corridor
      { x: 7,    y: 29.5 },   // 3  turn north into the left arm
      { x: 7,    y: 21   },   // 4
      { x: 3,    y: 21   },   // 5  the lane change round its tip
      { x: 3,    y: 12.5 },   // 6  turn east
      { x: 15,   y: 12.5 },   // 7  through the upper left corridor
      { x: 15,   y: 6.5  },   // 8  turn east across the top arm
      { x: 29,   y: 6.5  },   // 9  turn south
      { x: 29,   y: 12.5 },   // 10 through the upper right corridor
      { x: 37.5, y: 12.5 },   // 11 turn south into the right arm
      { x: 37.5, y: 29.5 },   // 12 round its tip, into the lower corridor
      { x: 29,   y: 29.5 }    // 13 turn south down the bottom arm, back to 0
    ],
    startLeg: 0,
    checkpoints: [
      { x0: 1,  y0: 19, x1: 9,  y1: 20 },   // round the left tip
      { x0: 20, y0: 1,  x1: 21, y1: 9  },   // across the top tip
      { x0: 35, y0: 19, x1: 43, y1: 20 },   // round the right tip
      { x0: 11, y0: 32, x1: 33, y1: 33 }    // down into the bottom arm
    ],
    finish: { x0: 21.6, y0: 31, x1: 22.4, y1: 39, dir: { x: -1, y: 0 } },
    startGrid: [
      { x: 23.5, y: 33.8, wp: 1 },
      { x: 23.5, y: 36.2, wp: 1 },
      { x: 25.4, y: 33.8, wp: 1 },
      { x: 25.4, y: 36.2, wp: 1 }
    ]
  };


  /* ---- Cliffs 3: OVERHANG ----------------------------------------------
   * Two tracks in one lap.
   *
   *      +-----------------------------------+
   *      | <------------- top -------------- |
   *      | v  ####shelf#####+#############+ ^|
   *      | v  --- band 1 -->|#  island   #| ^|   the tight end
   *      | v  ####+---------+#############| ^|
   *      | v  <-- band 2 ---+#############| ^|
   *      | v  ####shelf#####+#############+ ^|
   *      | ------------- main straight ----->|
   *      +-----------------------------------+
   *
   * The right two thirds is the fastest thing in the game: a thirty-nine
   * cell straight, a long climb and a thirty-nine cell run back. The left
   * third folds back on itself twice between six- and seven-cell ledges.
   * You arrive at the tight end carrying everything the straight gave you,
   * which is the whole joke of the track and the reason the roads there are
   * narrower than anything else in the themed set.
   * -------------------------------------------------------------------- */
  var OVERHANG = {
    id: 'overhang',
    name: 'OVERHANG',
    blurb: 'A long fast ledge, then a double-back under the rock.',
    grade: 'CHALLENGING +',
    cols: 49,
    rows: 36,
    aiPace: 0.95,
    aiOffsetScale: 1.5,
    aiMistakeScale: 1,
    weather: 'grit',
    theme: CLIFF,
    walls: border(49, 36).concat([
      { x0: 18, y0: 8,  x1: 39, y1: 28, kind: 'infield' },  // the massif
      { x0: 8,  y0: 8,  x1: 17, y1: 9,  kind: 'infield' },  // the shelf over
      { x0: 8,  y0: 27, x1: 17, y1: 28, kind: 'infield' },  // and under
      { x0: 1,  y0: 17, x1: 11, y1: 19, kind: 'infield' },  // the fold
      /* Three lane changes, all of them out on the fast side. A pair of
       * boulders each, offset along the road so the lane one leaves clear
       * is the lane the other blocks - there is no threading them, you have
       * to move. The climb keeps a plain five-cell gate instead, and the
       * tight end is left alone: it is already the tight end. */
      { x0: 16, y0: 29, x1: 21, y1: 31, kind: 'jog' },      // the main straight
      { x0: 28, y0: 32, x1: 33, y1: 34, kind: 'jog' },
      { x0: 45, y0: 18, x1: 47, y1: 23, kind: 'jog' },      // the climb
      { x0: 30, y0: 1,  x1: 35, y1: 3,  kind: 'jog' },      // the run back
      { x0: 18, y0: 4,  x1: 23, y1: 7,  kind: 'jog' }
    ]),
    route: [
      { x: 4.5, y: 33.5 },   // 0  the main straight, eastbound
      { x: 25,  y: 33.5 },   // 1
      { x: 25,  y: 30.5 },   // 2  up over the first boulder
      { x: 42.5, y: 30.5 },  // 3  turn north up the long climb
      { x: 42.5, y: 6   },   // 4  turn west along the top
      { x: 27,  y: 6    },   // 5
      { x: 27,  y: 2.5  },   // 6  up over the second boulder
      { x: 4.5, y: 2.5  },   // 7  turn south into the tight end
      { x: 4.5, y: 13.5 },   // 8  east along the upper ledge
      { x: 15,  y: 13.5 },   // 9  turn south through the fold
      { x: 15,  y: 23.5 },   // 10 west along the lower ledge
      { x: 4.5, y: 23.5 }    // 11 turn south, back down to 0
    ],
    startLeg: 0,
    checkpoints: [
      { x0: 40, y0: 24, x1: 48, y1: 25 },   // up the climb
      { x0: 24, y0: 1,  x1: 25, y1: 8  },   // along the top
      { x0: 9,  y0: 10, x1: 10, y1: 17 },   // the upper ledge
      { x0: 9,  y0: 20, x1: 10, y1: 27 }    // the lower ledge
    ],
    finish: { x0: 11.6, y0: 29, x1: 12.4, y1: 35, dir: { x: 1, y: 0 } },
    startGrid: [
      { x: 10.5, y: 30.8, wp: 1 },
      { x: 10.5, y: 33.2, wp: 1 },
      { x: 8.6,  y: 30.8, wp: 1 },
      { x: 8.6,  y: 33.2, wp: 1 }
    ]
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

  /* ---- City 1: GRIDLOCK ------------------------------------------------
   * A block grid. Four streets north to south, three east to west, six
   * buildings between them, and a lap that weaves through the grid instead
   * of running round the outside of it:
   *
   *        +--+-----+--+-----+--+---+--+
   *        |  |     |  |#####|  |   |  |   the route turns at junctions,
   *        |  +--+  |  +--+  |  |   |  |   and drives straight through the
   *        |  |##|  |  |##|  |  |   |  |   ones it does not need
   *        |  |##+--+--+##|  |  +---+  |
   *        |  |#############|  |####|  |
   *        +--+-------------+--+----+--+
   *
   * Nothing else in the game has more than four solid masses. The streets
   * this lap does not use are built over rather than left open, so the map
   * is a corridor maze and not a ring with decoration - a street you can
   * see down but not drive is a city, and a street you can accidentally
   * drive down is runoff.
   * -------------------------------------------------------------------- */
  var GRIDLOCK = {
    id: 'gridlock',
    mirror: true,        // drawn clockwise; see DIRECTION below
    name: 'GRIDLOCK',
    blurb: 'A block grid. Weave the junctions; the streets you skip are built over.',
    grade: 'HARD',
    cols: 48,
    rows: 37,
    aiPace: 0.95,
    aiOffsetScale: 1.5,
    aiMistakeScale: 1,
    weather: 'rain',
    theme: CITY,
    walls: border(48, 37).concat([
      /* Four blocks, and they are the streets' walls rather than islands in
       * a circuit. Every street this lap does not use is built over: a
       * street you can see down but not drive is a city, and a street you
       * can accidentally drive down is runoff. */
      { x0: 8,  y0: 8,  x1: 14, y1: 28, kind: 'infield' },  // the west block
      { x0: 22, y0: 1,  x1: 28, y1: 14, kind: 'infield' },  // the tower on the top street
      { x0: 15, y0: 22, x1: 35, y1: 28, kind: 'infield' },  // the long block
      { x0: 36, y0: 8,  x1: 39, y1: 28, kind: 'infield' },  // the east block
      /* Roadworks. A pair per street, against opposite kerbs and offset
       * along it, so the lane one leaves clear is the lane the other
       * blocks - there is no threading them, you have to move over. */
      { x0: 44, y0: 9,  x1: 46, y1: 14, kind: 'jog' },      // the east street
      { x0: 40, y0: 20, x1: 42, y1: 25, kind: 'jog' },
      { x0: 26, y0: 29, x1: 33, y1: 31, kind: 'jog' },      // the south street
      { x0: 12, y0: 33, x1: 19, y1: 35, kind: 'jog' },
      { x0: 1,  y0: 22, x1: 3,  y1: 27, kind: 'jog' },      // the west street
      { x0: 5,  y0: 12, x1: 7,  y1: 17, kind: 'jog' }
    ]),
    route: [
      { x: 3,    y: 4.5  },   // 0  the top street, eastbound
      { x: 18.5, y: 4.5  },   // 1  turn south at the second junction
      { x: 18.5, y: 18.5 },   // 2  turn east along the middle
      { x: 32.5, y: 18.5 },   // 3  turn north
      { x: 32.5, y: 4.5  },   // 4  back onto the top street
      { x: 42,   y: 4.5  },   // 5  turn south down the east street
      { x: 42,   y: 18   },   // 6
      { x: 45,   y: 18   },   // 7  over to the far kerb
      { x: 45,   y: 34   },   // 8  turn west along the south street
      { x: 23,   y: 34   },   // 9
      { x: 23,   y: 31   },   // 10 round the works
      { x: 6,    y: 31   },   // 11 turn north up the west street
      { x: 6,    y: 20   },   // 12
      { x: 3,    y: 20   }    // 13 over again, then north back to 0
    ],
    startLeg: 0,
    checkpoints: [
      { x0: 15, y0: 10, x1: 22, y1: 11 },   // down the second street
      { x0: 40, y0: 27, x1: 47, y1: 28 },   // down the east street
      { x0: 10, y0: 29, x1: 11, y1: 36 },   // along the south street
      { x0: 1,  y0: 9,  x1: 8,  y1: 10 }    // up the west street
    ],
    finish: { x0: 10.6, y0: 1, x1: 11.4, y1: 8, dir: { x: 1, y: 0 } },
    startGrid: [
      { x: 9.5, y: 3.3, wp: 1 },
      { x: 9.5, y: 5.7, wp: 1 },
      { x: 7.6, y: 3.3, wp: 1 },
      { x: 7.6, y: 5.7, wp: 1 }
    ]
  };


  /* ---- City 2: CROSSTOWN ----------------------------------------------
   * A pinwheel. Four corner blocks and one cross-shaped block in the
   * middle, and the street between them turns twelve times a lap:
   *
   *        +-----+   #   +-----+   A B C D are the corner blocks and
   *        |  A  |   #   |  B  |   # is the cross in the middle; the
   *        +-----+   #   +-----+   road is the gap between all five
   *              #########
   *        +-----+   #   +-----+   the lap swirls - west, south, west,
   *        |  C  |   #   |  D  |   south, east, south, east, north,
   *        +-----+   #   +-----+   east, north, west, north - and closes
   *
   * There is not one junction on it. Every wall is solid, the road is a
   * single corridor, and at no point is there a second way to go - which
   * is the whole point. The version this replaces drove the same street
   * twice a lap in two different lanes, and the clever part of that was
   * exactly the part you could not read at speed.
   * -------------------------------------------------------------------- */
  var CROSSTOWN = {
    id: 'crosstown',
    name: 'CROSSTOWN',
    blurb: 'A pinwheel through the blocks. Twelve corners and not one junction.',
    grade: 'HARD +',
    cols: 47,
    rows: 41,
    aiPace: 0.95,
    aiOffsetScale: 1.5,
    aiMistakeScale: 1,
    weather: 'rain',
    theme: CITY,
    walls: border(47, 41).concat([
      { x0:  1, y0:  1, x1: 13, y1: 11, kind: 'edge' },     // the four corner blocks
      { x0: 33, y0:  1, x1: 45, y1: 11, kind: 'edge' },
      { x0:  1, y0: 29, x1: 13, y1: 39, kind: 'edge' },
      { x0: 33, y0: 29, x1: 45, y1: 39, kind: 'edge' },
      { x0: 20, y0:  7, x1: 26, y1: 33, kind: 'infield' },  // the cross in the middle
      { x0:  7, y0: 18, x1: 19, y1: 22, kind: 'infield' },
      { x0: 27, y0: 18, x1: 39, y1: 22, kind: 'infield' },
      /* Roadworks. One per north-south street, two cells against a kerb,
       * and the lap takes every one of them on the far side - so the line
       * runs down the middle of the east-west streets and hard up one
       * lane of the north-south ones, alternating, all the way round. */
      { x0: 14, y0:  6, x1: 15, y1: 12, kind: 'jog' },
      { x0:  5, y0: 16, x1:  6, y1: 24, kind: 'jog' },
      { x0: 14, y0: 28, x1: 15, y1: 34, kind: 'jog' },
      { x0: 31, y0: 27, x1: 32, y1: 35, kind: 'jog' },
      { x0: 44, y0: 17, x1: 45, y1: 23, kind: 'jog' },
      { x0: 27, y0:  5, x1: 28, y1: 13, kind: 'jog' }
    ]),
    route: [
      { x: 31, y:  4 },   // 0  the top street, westbound
      { x: 18, y:  4 },   // 1  south, in the east lane past the works
      { x: 18, y: 15 },   // 2  west
      { x:  3, y: 15 },   // 3  south, in the west lane
      { x:  3, y: 26 },   // 4  east
      { x: 18, y: 26 },   // 5  south, east lane again
      { x: 18, y: 37 },   // 6  east along the bottom
      { x: 29, y: 37 },   // 7  north, west lane
      { x: 29, y: 26 },   // 8  east
      { x: 42, y: 26 },   // 9  north up the east street, west lane
      { x: 42, y: 15 },   // 10 west
      { x: 31, y: 15 }    // 11 north, east lane, back over the line
    ],
    startLeg: 0,
    checkpoints: [
      { x0: 10, y0: 12, x1: 11, y1: 18 },   // west, under the north-west block
      { x0: 24, y0: 34, x1: 25, y1: 40 },   // east along the bottom
      { x0: 36, y0: 23, x1: 37, y1: 29 },   // east, under the cross
      { x0: 29, y0:  9, x1: 33, y1: 10 }    // north, back to the top street
    ],
    finish: { x0: 23.6, y0: 1, x1: 24.4, y1: 7, dir: { x: -1, y: 0 } },
    startGrid: [
      { x: 25.5, y: 2.2, wp: 1 },
      { x: 25.5, y: 4.4, wp: 1 },
      { x: 27.4, y: 2.2, wp: 1 },
      { x: 27.4, y: 4.4, wp: 1 }
    ]
  };


  /* ---- City 3: DOWNTOWN ------------------------------------------------
   * Two long streets and two teeth. The west and east streets run the
   * whole height of the map, and between them the lap bites once up from
   * the bottom and once down from the top:
   *
   *        +---------+    +----+
   *        |         |    |    |    the top street dives round the north
   *        |   +-----+----+    |    block and comes back up; the bottom
   *        |   |               |    street does the same round the south
   *        |   +----+-----+    |
   *        |         |    |    |
   *        +---------+    +----+
   *
   * Same rule as Crosstown: one corridor, no junctions, nowhere wrong to
   * go. The difficulty is the two thirty-three cell straights - the
   * longest in the theme - arriving at a corner with no let-up, and the
   * roadworks strung along them.
   * -------------------------------------------------------------------- */
  var DOWNTOWN = {
    id: 'downtown',
    name: 'DOWNTOWN',
    blurb: 'Two long streets, two teeth and roadworks the whole way down both.',
    grade: 'HARD ++',
    cols: 52,
    rows: 41,
    aiPace: 0.95,
    aiOffsetScale: 1.5,
    aiMistakeScale: 1,
    weather: 'rain',
    theme: CITY,
    walls: border(52, 41).concat([
      { x0: 22, y0:  1, x1: 30, y1: 11, kind: 'edge' },     // the north block
      { x0: 22, y0: 29, x1: 30, y1: 39, kind: 'edge' },     // the south block
      { x0:  7, y0:  7, x1: 15, y1: 33, kind: 'infield' },  // the middle, an H
      { x0: 37, y0:  7, x1: 44, y1: 33, kind: 'infield' },
      { x0: 16, y0: 18, x1: 36, y1: 22, kind: 'infield' },
      /* The two long streets get a PAIR each, against opposite kerbs and
       * eighteen cells apart, so the lane the first one leaves clear is the
       * lane the second one blocks: there is no threading them, the car
       * has to change lanes in the middle of the fastest road on the
       * track. The six short streets get one apiece. */
      { x0:  1, y0: 11, x1:  2, y1: 16, kind: 'jog' },      // the west street
      { x0:  5, y0: 22, x1:  6, y1: 27, kind: 'jog' },
      { x0: 49, y0: 22, x1: 50, y1: 27, kind: 'jog' },      // the east street
      { x0: 45, y0: 11, x1: 46, y1: 16, kind: 'jog' },
      { x0: 20, y0: 27, x1: 21, y1: 35, kind: 'jog' },      // the south tooth
      { x0: 31, y0: 28, x1: 32, y1: 34, kind: 'jog' },
      { x0: 35, y0:  5, x1: 36, y1: 13, kind: 'jog' },      // the north tooth
      { x0: 16, y0:  6, x1: 17, y1: 12, kind: 'jog' }
    ]),
    route: [
      { x:  5, y:  4 },   // 0  the west street, southbound, in the east lane
      { x:  5, y: 19 },   // 1  change lanes between the two sets of works
      { x:  3, y: 19 },   // 2
      { x:  3, y: 37 },   // 3  east along the bottom
      { x: 18, y: 37 },   // 4  north into the south tooth
      { x: 18, y: 26 },   // 5  east
      { x: 35, y: 26 },   // 6  south, back out
      { x: 35, y: 37 },   // 7  east
      { x: 47, y: 37 },   // 8  north up the east street, west lane
      { x: 47, y: 19 },   // 9  and change again
      { x: 49, y: 19 },   // 10
      { x: 49, y:  4 },   // 11 west along the top
      { x: 33, y:  4 },   // 12 south into the north tooth
      { x: 33, y: 15 },   // 13 west
      { x: 20, y: 15 },   // 14 north, back out
      { x: 20, y:  4 }    // 15 west, back to the west street
    ],
    startLeg: 8,
    checkpoints: [
      { x0: 39, y0:  1, x1: 40, y1:  7 },   // west along the top
      { x0: 18, y0:  9, x1: 22, y1: 10 },   // north out of the tooth
      { x0:  1, y0: 26, x1:  5, y1: 27 },   // south down the west street
      { x0: 21, y0: 23, x1: 22, y1: 29 }    // east through the south tooth
    ],
    finish: { x0: 45, y0: 30.6, x1: 51, y1: 31.4, dir: { x: 0, y: -1 } },
    startGrid: [
      { x: 46.2, y: 32.5, wp: 9 },
      { x: 48.4, y: 32.5, wp: 9 },
      { x: 46.2, y: 34.4, wp: 9 },
      { x: 48.4, y: 34.4, wp: 9 }
    ]
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

  /* ---- Industrial 1: FOUNDRY -------------------------------------------
   * A zigzag ring with four teeth - two biting down from the top of the
   * map and two biting up from the bottom - round one plant block that
   * fills most of the middle:
   *
   *        +--+  +--+--------+       fourteen corners, and only two legs
   *        |  |  |  |        |       longer than twelve cells: the west
   *        |  +--+  |   ##   |       street and the east. Everything in
   *        |   ##   |   ##   |       between is corner, gate, corner.
   *        |  +--+--+--+  +--+
   *        +--+        +--+
   *
   * Pure corridor: every wall is solid and there is nowhere wrong to go.
   * The two long streets carry a PAIR of barriers each against opposite
   * kerbs, so the lane one leaves clear is the lane the other blocks; the
   * five short verticals get one apiece and the lap takes every one of them
   * on the far side.
   * -------------------------------------------------------------------- */
  var FOUNDRY = {
    id: 'foundry',
    name: 'FOUNDRY',
    blurb: 'Fourteen corners round one plant block. Barriers on every street.',
    grade: 'EXTREME',
    cols: 48,
    rows: 41,
    aiPace: 0.95,
    aiOffsetScale: 1.5,
    aiMistakeScale: 1,
    weather: 'ash',
    theme: INDUSTRIAL,
    walls: border(48, 41).concat([
      { x0: 17, y0:  1, x1: 20, y1: 11, kind: 'edge' },     // the two teeth from the top
      { x0: 27, y0: 29, x1: 30, y1: 39, kind: 'edge' },     // and the two from the bottom
      { x0:  1, y0: 29, x1: 10, y1: 39, kind: 'edge' },
      { x0:  7, y0:  7, x1: 10, y1: 22, kind: 'infield' },  // the plant, one mass
      { x0: 27, y0:  7, x1: 40, y1: 22, kind: 'infield' },
      { x0: 11, y0: 18, x1: 26, y1: 22, kind: 'infield' },
      { x0: 17, y0: 23, x1: 20, y1: 33, kind: 'infield' },
      { x0: 37, y0: 23, x1: 40, y1: 33, kind: 'infield' },
      // the west street: a pair, against opposite kerbs, ten cells apart
      { x0:  1, y0:  7, x1:  2, y1: 12, kind: 'jog' },
      { x0:  5, y0: 17, x1:  6, y1: 22, kind: 'jog' },
      // the east street: the same, and the lap changes lanes between them
      { x0: 41, y0: 24, x1: 42, y1: 29, kind: 'jog' },
      { x0: 45, y0: 12, x1: 46, y1: 17, kind: 'jog' },
      // one on each short vertical
      { x0: 11, y0: 28, x1: 12, y1: 33, kind: 'jog' },
      { x0: 25, y0: 29, x1: 26, y1: 34, kind: 'jog' },
      { x0: 31, y0: 28, x1: 32, y1: 33, kind: 'jog' },
      { x0: 21, y0:  7, x1: 22, y1: 12, kind: 'jog' },
      { x0: 15, y0:  7, x1: 16, y1: 12, kind: 'jog' }
    ]),
    route: [
      { x:  5, y:  4 },   // 0  the west street, southbound, east lane
      { x:  5, y: 15 },   // 1  change lanes between the two barriers
      { x:  3, y: 15 },   // 2
      { x:  3, y: 26 },   // 3  east, under the plant
      { x: 15, y: 26 },   // 4  south into the first tooth
      { x: 15, y: 37 },   // 5  east along the bottom
      { x: 23, y: 37 },   // 6  north, back out
      { x: 23, y: 26 },   // 7  east
      { x: 35, y: 26 },   // 8  south into the second tooth
      { x: 35, y: 37 },   // 9  east
      { x: 45, y: 37 },   // 10 north up the east street, over the line
      { x: 45, y: 20 },   // 11 change lanes again
      { x: 43, y: 20 },   // 12
      { x: 43, y:  4 },   // 13 west along the top
      { x: 25, y:  4 },   // 14 south into the third tooth
      { x: 25, y: 15 },   // 15 west
      { x: 13, y: 15 },   // 16 north, back out
      { x: 13, y:  4 }    // 17 west, back to the west street
    ],
    startLeg: 10,
    checkpoints: [
      { x0: 35, y0:  1, x1: 36, y1:  7 },   // west along the top
      { x0: 11, y0:  9, x1: 15, y1: 10 },   // north out of the last tooth
      { x0:  9, y0: 23, x1: 10, y1: 29 },   // east under the plant
      { x0: 21, y0: 30, x1: 25, y1: 31 }    // north out of the first tooth
    ],
    finish: { x0: 41, y0: 32.6, x1: 47, y1: 33.4, dir: { x: 0, y: -1 } },
    startGrid: [
      { x: 43.8, y: 34.5, wp: 11 },
      { x: 46.1, y: 34.5, wp: 11 },
      { x: 43.8, y: 36.4, wp: 11 },
      { x: 46.1, y: 36.4, wp: 11 }
    ]
  };

  /* ---- Industrial 2: PIPEWORKS ----------------------------------------
   * Five cells of road, the narrowest in the game, and a rack that hooks
   * round most of the map:
   *
   *        +--------------------------+     one long street down the west
   *        |  ####################    |     side, one longer along the top,
   *        |  ############   +--+     |     and a staircase of nine-cell
   *        |  ####  +---+ ## +--+     |     legs filling everything else
   *        |  ####  | ## |  ######    |
   *        +--------+----+------------+
   *
   * Pure corridor again. The barriers are a single cell thick rather than
   * two, because on a five-cell road two would leave three - and a three
   * cell gate is the one thing the cliffs proved is a trap rather than a
   * difficulty. One cell leaves four, which is the same gate the city runs,
   * on a road a cell narrower.
   * -------------------------------------------------------------------- */
  var PIPEWORKS = {
    id: 'pipeworks',
    name: 'PIPEWORKS',
    blurb: 'Five cells of road and a rack that hooks round most of the map.',
    grade: 'EXTREME +',
    cols: 43,
    rows: 34,
    aiPace: 0.95,
    aiOffsetScale: 1.5,
    aiMistakeScale: 1,
    weather: 'ash',
    theme: INDUSTRIAL,
    walls: border(43, 34).concat([
      { x0:  7, y0:  7, x1: 36, y1:  9, kind: 'infield' },  // the rack
      { x0:  7, y0: 10, x1: 27, y1: 18, kind: 'infield' },
      { x0:  7, y0: 19, x1:  9, y1: 27, kind: 'infield' },
      { x0: 24, y0: 19, x1: 27, y1: 27, kind: 'infield' },
      { x0: 28, y0: 24, x1: 36, y1: 27, kind: 'infield' },
      { x0: 33, y0: 15, x1: 41, y1: 18, kind: 'edge' },
      { x0: 15, y0: 24, x1: 18, y1: 32, kind: 'edge' },
      /* One barrier per leg, a single cell thick, and the lap takes every
       * one of them on the far side - so the line never sits in the middle
       * of a street on this track.
       *
       * They are singles rather than the pairs the city and Foundry use,
       * and that is geometry rather than taste: a lane change needs two
       * turn radii of room to complete, 1.6 cells at the default slide, and
       * a pair on a five-cell road can only ever offer one. The first cut
       * had pairs here and the validator caught all six corners overshooting
       * by 0.31 of a cell. A five-cell road cannot be a lane-change road. */
      { x0:  1, y0:  9, x1:  2, y1: 14, kind: 'jog' },      // the west street
      { x0:  7, y0: 32, x1:  9, y1: 32, kind: 'jog' },
      { x0: 10, y0: 24, x1: 10, y1: 27, kind: 'jog' },
      { x0: 16, y0: 19, x1: 18, y1: 19, kind: 'jog' },
      { x0: 23, y0: 24, x1: 23, y1: 27, kind: 'jog' },
      { x0: 26, y0: 28, x1: 34, y1: 28, kind: 'jog' },      // the long bottom leg
      { x0: 41, y0: 23, x1: 41, y1: 28, kind: 'jog' },
      { x0: 34, y0: 23, x1: 36, y1: 23, kind: 'jog' },
      { x0: 28, y0: 14, x1: 28, y1: 19, kind: 'jog' },
      { x0: 34, y0: 14, x1: 36, y1: 14, kind: 'jog' },
      { x0: 37, y0:  7, x1: 37, y1: 10, kind: 'jog' },
      { x0: 26, y0:  1, x1: 33, y1:  2, kind: 'jog' }       // the top street
    ]),
    route: [
      { x:  5, y:  3 },   // 0  the west street, southbound, east lane
      { x:  5, y: 17 },   // 1  change lanes between the pair
      { x:  3, y: 17 },   // 2
      { x:  3, y: 30 },   // 3  east along the bottom
      { x: 13, y: 30 },   // 4  north
      { x: 13, y: 22 },   // 5  east
      { x: 21, y: 22 },   // 6  south, back down
      { x: 21, y: 31 },   // 7  east along the long bottom leg
      { x: 39, y: 31 },   // 8  north up the east street
      { x: 39, y: 21 },   // 9  west
      { x: 31, y: 21 },   // 10 north
      { x: 31, y: 12 },   // 11 east
      { x: 40, y: 12 },   // 12 north to the top street
      { x: 40, y:  5 },   // 13 west along the top, over the line
      { x: 22, y:  5 },   // 14 and change lanes again
      { x: 22, y:  3 }    // 15
    ],
    startLeg: 13,
    checkpoints: [
      { x0:  1, y0: 18, x1:  7, y1: 19 },   // south down the west street
      { x0: 16, y0: 20, x1: 17, y1: 24 },   // east through the staircase
      { x0: 37, y0: 25, x1: 41, y1: 26 },   // north up the east street
      { x0: 33, y0: 10, x1: 34, y1: 15 }    // east, under the rack
    ],
    finish: { x0: 35.6, y0: 1, x1: 36.4, y1: 7, dir: { x: -1, y: 0 } },
    startGrid: [
      { x: 37.5, y: 3.9, wp: 14 },
      { x: 37.5, y: 6.1, wp: 14 },
      { x: 39.4, y: 3.9, wp: 14 },
      { x: 39.4, y: 6.1, wp: 14 }
    ]
  };

  /* ---- Industrial 3: REFINERY -----------------------------------------
   * Sixteen corners, and five LOADING BAYS cut into the plant three cells
   * wide and three deep, opening straight off the road: driving into one is
   * a wrong turn you can actually make.
   *
   *        +--+  +--+--+  +-----+       the lap threads three teeth down
   *        |  |  |()|  |  |     |       from the top and two up from the
   *        |  +--+  +--+  |  +--+       bottom; () are the bays
   *        | ()  ##  ()   |  |
   *        +--+  +--+--+  +--+  |
   *        |  |  |()|  |  |  |  |
   *        +--+  +--+--+--+--+--+
   *
   * A bay is a dead end and is walled on the other three sides, so the cost
   * of taking one is a second and a reverse rather than a lost lap. The lap
   * itself visits every piece of road exactly once and never crosses.
   * -------------------------------------------------------------------- */
  var REFINERY = {
    id: 'refinery',
    name: 'REFINERY',
    blurb: 'Sixteen corners and five loading bays cut into the plant.',
    grade: 'EXTREME ++',
    cols: 52,
    rows: 41,
    aiPace: 0.95,
    aiOffsetScale: 1.5,
    aiMistakeScale: 1,
    weather: 'ash',
    theme: INDUSTRIAL,
    walls: border(52, 41).concat([
      { x0: 18, y0:  1, x1: 22, y1:  8, kind: 'edge' },
      { x0: 40, y0:  1, x1: 50, y1: 11, kind: 'edge' },
      { x0:  7, y0:  7, x1: 11, y1: 19, kind: 'infield' },
      { x0: 29, y0:  7, x1: 33, y1: 22, kind: 'infield' },
      { x0: 18, y0:  9, x1: 18, y1: 11, kind: 'edge' },     // the jambs of bay 2
      { x0: 22, y0:  9, x1: 22, y1: 11, kind: 'edge' },
      { x0: 12, y0: 18, x1: 23, y1: 22, kind: 'infield' },
      { x0: 27, y0: 18, x1: 28, y1: 22, kind: 'infield' },
      { x0: 34, y0: 18, x1: 44, y1: 19, kind: 'infield' },
      { x0:  7, y0: 20, x1:  7, y1: 22, kind: 'infield' },  // and of bay 1
      { x0: 11, y0: 20, x1: 11, y1: 22, kind: 'infield' },
      { x0: 34, y0: 20, x1: 35, y1: 22, kind: 'infield' },  // and of bay 4
      { x0: 39, y0: 20, x1: 44, y1: 22, kind: 'infield' },
      { x0: 24, y0: 21, x1: 26, y1: 22, kind: 'infield' },  // the back of bay 3
      { x0: 18, y0: 23, x1: 22, y1: 30, kind: 'infield' },
      { x0: 40, y0: 23, x1: 44, y1: 33, kind: 'infield' },
      { x0:  1, y0: 29, x1: 11, y1: 39, kind: 'edge' },
      { x0: 29, y0: 29, x1: 33, y1: 39, kind: 'edge' },
      { x0: 18, y0: 31, x1: 18, y1: 33, kind: 'infield' },  // and of bay 5
      { x0: 22, y0: 31, x1: 22, y1: 33, kind: 'infield' },
      // the two long streets: a pair each, against opposite kerbs
      { x0:  1, y0:  8, x1:  2, y1: 13, kind: 'jog' },
      { x0:  5, y0: 18, x1:  6, y1: 23, kind: 'jog' },
      { x0: 45, y0: 25, x1: 46, y1: 32, kind: 'jog' },
      { x0: 49, y0: 15, x1: 50, y1: 20, kind: 'jog' },
      // one on each of the six short verticals
      { x0: 12, y0: 28, x1: 13, y1: 35, kind: 'jog' },
      { x0: 27, y0: 28, x1: 28, y1: 35, kind: 'jog' },
      { x0: 34, y0: 28, x1: 35, y1: 35, kind: 'jog' },
      { x0: 38, y0:  5, x1: 39, y1: 13, kind: 'jog' },
      { x0: 23, y0:  5, x1: 24, y1: 13, kind: 'jog' },
      { x0: 16, y0:  5, x1: 17, y1: 13, kind: 'jog' }
    ]),
    route: [
      { x:  5, y:  4 },   // 0  the west street, southbound, east lane
      { x:  5, y: 16 },   // 1  change lanes between the barriers
      { x:  3, y: 16 },   // 2
      { x:  3, y: 26 },   // 3  east, past the first bay
      { x: 16, y: 26 },   // 4  south into the first tooth
      { x: 16, y: 37 },   // 5  east along the bottom
      { x: 25, y: 37 },   // 6  north
      { x: 25, y: 26 },   // 7  east
      { x: 38, y: 26 },   // 8  south into the second tooth
      { x: 38, y: 37 },   // 9  east
      { x: 49, y: 37 },   // 10 north up the east street, over the line
      { x: 49, y: 23 },   // 11 change lanes again
      { x: 47, y: 23 },   // 12
      { x: 47, y: 15 },   // 13 west
      { x: 36, y: 15 },   // 14 north
      { x: 36, y:  4 },   // 15 west along the top
      { x: 27, y:  4 },   // 16 south into the third tooth
      { x: 27, y: 15 },   // 17 west
      { x: 14, y: 15 },   // 18 north, back out
      { x: 14, y:  4 }    // 19 west, back to the west street
    ],
    startLeg: 10,
    checkpoints: [
      { x0: 41, y0: 12, x1: 42, y1: 18 },   // west, off the east street
      { x0:  1, y0: 15, x1:  7, y1: 16 },   // south down the west street
      { x0: 14, y0: 31, x1: 18, y1: 32 },   // south into the first tooth
      { x0: 42, y0: 34, x1: 43, y1: 40 }    // east along the bottom
    ],
    finish: { x0: 45, y0: 31.6, x1: 51, y1: 32.4, dir: { x: 0, y: -1 } },
    startGrid: [
      { x: 47.8, y: 33.5, wp: 11 },
      { x: 50.1, y: 33.5, wp: 11 },
      { x: 47.8, y: 35.4, wp: 11 },
      { x: 50.1, y: 35.4, wp: 11 }
    ]
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

  /* ---- Ruins 1: SANCTUM ------------------------------------------------
   * A temple on a cross plan, and the lap is the processional walk round
   * it. The road is a band of constant width following a PLUS, so it has
   * outside corners and inside ones alternating - four of the twelve are
   * the armpits of the cross, where the wall you are leaning on becomes
   * the wall you are turning into:
   *
   *              +-----+
   *              |     |          twelve corners in a hundred and twenty
   *        +-----+  #  +-----+    cells, which is the tightest corner
   *        |        ###       |   rhythm in the game - no straight on it
   *        +-----+  #  +-----+    is longer than sixteen
   *              |     |
   *              +-----+
   * -------------------------------------------------------------------- */
  var SANCTUM = {
    id: 'sanctum',
    name: 'SANCTUM',
    blurb: 'The walk round a cross-plan temple. Twelve corners, no straights.',
    grade: 'EXPERT',
    cols: 48,
    rows: 37,
    aiPace: 0.95,
    aiOffsetScale: 1.5,
    aiMistakeScale: 1,
    weather: 'motes',
    theme: RUINS,
    walls: border(48, 37).concat([
      { x0:  1, y0:  1, x1: 46, y1:  4, kind: 'edge' },     // the precinct wall
      { x0:  1, y0:  5, x1: 15, y1: 11, kind: 'edge' },
      { x0: 36, y0:  5, x1: 46, y1: 11, kind: 'edge' },
      { x0:  1, y0: 12, x1:  4, y1: 35, kind: 'edge' },
      { x0:  5, y0: 29, x1: 15, y1: 35, kind: 'edge' },
      { x0: 36, y0: 29, x1: 46, y1: 35, kind: 'edge' },
      { x0: 21, y0: 10, x1: 30, y1: 30, kind: 'infield' },  // the cross itself
      { x0: 10, y0: 17, x1: 20, y1: 23, kind: 'infield' },
      { x0: 31, y0: 17, x1: 41, y1: 23, kind: 'infield' },
      /* Fallen masonry, one piece per straight, always on the far side.
       * One cell thick: the road here is five, and two would leave three -
       * which the cliffs proved is a trap rather than a difficulty. */
      { x0: 10, y0: 12, x1: 16, y1: 12, kind: 'jog' },
      { x0:  5, y0: 16, x1:  5, y1: 25, kind: 'jog' },
      { x0: 10, y0: 28, x1: 16, y1: 28, kind: 'jog' },
      { x0: 22, y0: 35, x1: 30, y1: 35, kind: 'jog' },
      { x0: 37, y0: 24, x1: 41, y1: 24, kind: 'jog' },
      { x0: 46, y0: 16, x1: 46, y1: 25, kind: 'jog' },
      { x0: 36, y0: 16, x1: 42, y1: 16, kind: 'jog' },
      { x0: 22, y0:  5, x1: 30, y1:  5, kind: 'jog' }
    ]),
    route: [
      { x: 18.5, y:  8 },   // 0  south into the north arm
      { x: 18.5, y: 15 },   // 1  west over the west arm
      { x:  8,   y: 15 },   // 2  south round the end of it
      { x:  8,   y: 26 },   // 3  east
      { x: 18.5, y: 26 },   // 4  south into the armpit
      { x: 18.5, y: 33 },   // 5  east along the bottom
      { x: 33.5, y: 33 },   // 6  north
      { x: 33.5, y: 27 },   // 7  east under the east arm
      { x: 44,   y: 27 },   // 8  north round its end, over the line
      { x: 44,   y: 14 },   // 9  west
      { x: 33.5, y: 14 },   // 10 north
      { x: 33.5, y:  8 }    // 11 west along the top, back to the north arm
    ],
    startLeg: 8,
    checkpoints: [
      { x0: 26, y0:  6, x1: 27, y1: 10 },   // west along the top
      { x0: 13, y0: 13, x1: 14, y1: 17 },   // west over the west arm
      { x0: 13, y0: 24, x1: 14, y1: 28 },   // east under it
      { x0: 21, y0: 31, x1: 22, y1: 36 }    // east along the bottom
    ],
    finish: { x0: 42, y0: 20.6, x1: 46, y1: 21.4, dir: { x: 0, y: -1 } },
    startGrid: [
      { x: 43.2, y: 22.5, wp: 9 },
      { x: 45.2, y: 22.5, wp: 9 },
      { x: 43.2, y: 24.4, wp: 9 },
      { x: 45.2, y: 24.4, wp: 9 }
    ]
  };


  /* ---- Ruins 2: COLONNADE ----------------------------------------------
   * Three columns of stone hanging into the middle of the map from the
   * top, and the lap threads between them: up one side, down the next, up
   * the third. A comb rather than a ring.
   *
   *        +--+  +--+  +--+  +----+
   *        |  |  |  |  |  |  |    |   the two long streets - the bottom
   *        |  +--+  +--+  |  |    |   and the west - carry a PAIR each and
   *        |              |  +----+   the lap changes lanes between them
   *        +--------------+--------+
   * -------------------------------------------------------------------- */
  var COLONNADE = {
    id: 'colonnade',
    name: 'COLONNADE',
    blurb: 'Three stone columns into the middle, and the lap threads between.',
    grade: 'EXPERT +',
    cols: 51,
    rows: 40,
    aiPace: 0.95,
    aiOffsetScale: 1.5,
    aiMistakeScale: 1,
    weather: 'motes',
    theme: RUINS,
    walls: border(51, 40).concat([
      { x0: 17, y0:  1, x1: 22, y1: 22, kind: 'edge' },     // the middle column
      { x0: 39, y0:  1, x1: 49, y1: 22, kind: 'edge' },     // and the east one
      { x0:  6, y0:  6, x1: 11, y1: 33, kind: 'infield' },
      { x0: 28, y0:  6, x1: 33, y1: 33, kind: 'infield' },
      { x0: 12, y0: 28, x1: 27, y1: 33, kind: 'infield' },
      { x0: 34, y0: 28, x1: 44, y1: 33, kind: 'infield' },
      // one fallen course per straight, always taken on the far side
      { x0:  8, y0: 34, x1: 24, y1: 34, kind: 'jog' },
      { x0: 49, y0: 27, x1: 49, y1: 35, kind: 'jog' },
      { x0: 38, y0: 23, x1: 46, y1: 23, kind: 'jog' },
      { x0: 34, y0:  8, x1: 34, y1: 21, kind: 'jog' },
      { x0: 27, y0:  1, x1: 35, y1:  1, kind: 'jog' },
      { x0: 27, y0:  8, x1: 27, y1: 21, kind: 'jog' },
      { x0: 16, y0: 27, x1: 24, y1: 27, kind: 'jog' },
      { x0: 12, y0:  8, x1: 12, y1: 21, kind: 'jog' },
      { x0:  5, y0:  5, x1: 13, y1:  5, kind: 'jog' },
      { x0:  1, y0: 10, x1:  1, y1: 28, kind: 'jog' }
    ]),
    route: [
      { x:  4, y: 37 },   // 0  east along the bottom, over the line
      { x: 47, y: 37 },   // 1  north up the east street
      { x: 47, y: 26 },   // 2  west
      { x: 37, y: 26 },   // 3  north up the first column
      { x: 37, y:  4 },   // 4  west along the top
      { x: 25, y:  4 },   // 5  south down the second
      { x: 25, y: 25 },   // 6  west
      { x: 15, y: 25 },   // 7  north up the third
      { x: 15, y:  3 },   // 8  west along the top again
      { x:  4, y:  3 }    // 9  south down the west street
    ],
    startLeg: 0,
    checkpoints: [
      { x0: 42, y0: 24, x1: 43, y1: 28 },   // west off the east street
      { x0: 23, y0: 12, x1: 27, y1: 13 },   // south down the second column
      { x0: 13, y0: 12, x1: 17, y1: 13 },   // north up the third
      { x0:  2, y0: 21, x1:  6, y1: 22 }    // south down the west street
    ],
    finish: { x0: 27.6, y0: 34, x1: 28.4, y1: 39, dir: { x: 1, y: 0 } },
    startGrid: [
      { x: 26.5, y: 36.0, wp: 1 },
      { x: 26.5, y: 38.0, wp: 1 },
      { x: 24.6, y: 36.0, wp: 1 },
      { x: 24.6, y: 38.0, wp: 1 }
    ]
  };


  /* ---- Ruins 3: LABYRINTH ----------------------------------------------
   * A meander - the border pattern cut into every frieze in the theme,
   * driven rather than looked at. Five walls of stone standing in from
   * alternate sides and the road folding back between them:
   *
   *        +-------------------------+   five cells of road, twelve
   *        |  +--+  +--+  +--+  +--+ |   corners, and eighteen-cell
   *        |  |  |  |  |  |  |  |  | |   folds - the only track in the
   *        |  |  +--+  +--+  +--+  | |   game where every corner is the
   *        +--+                    +-+   same corner, taken twelve times
   * -------------------------------------------------------------------- */
  var LABYRINTH = {
    id: 'labyrinth',
    name: 'LABYRINTH',
    blurb: 'A meander in stone. Five folds, five cells of road, no let-up.',
    grade: 'EXPERT ++',
    cols: 52,
    rows: 34,
    aiPace: 0.95,
    aiOffsetScale: 1.5,
    aiMistakeScale: 1,
    weather: 'motes',
    theme: RUINS,
    walls: border(52, 34).concat([
      { x0:  6, y0:  6, x1: 45, y1:  9, kind: 'infield' },
      { x0:  6, y0: 10, x1:  9, y1: 27, kind: 'infield' },
      { x0: 24, y0: 10, x1: 27, y1: 27, kind: 'infield' },
      { x0: 42, y0: 10, x1: 45, y1: 27, kind: 'infield' },
      { x0: 15, y0: 15, x1: 18, y1: 32, kind: 'edge' },
      { x0: 33, y0: 15, x1: 36, y1: 32, kind: 'edge' },
      /* One cell thick, not two: on a five-cell road two would leave three,
       * and a three-cell gate is a trap rather than a difficulty. One
       * leaves four, the same gate the city runs, on a narrower road. */
      { x0:  1, y0:  9, x1:  1, y1: 23, kind: 'jog' },
      { x0:  5, y0: 32, x1: 10, y1: 32, kind: 'jog' },
      { x0: 14, y0: 16, x1: 14, y1: 27, kind: 'jog' },
      { x0: 14, y0: 10, x1: 19, y1: 10, kind: 'jog' },
      { x0: 19, y0: 16, x1: 19, y1: 27, kind: 'jog' },
      { x0: 23, y0: 28, x1: 28, y1: 28, kind: 'jog' },
      { x0: 32, y0: 16, x1: 32, y1: 27, kind: 'jog' },
      { x0: 32, y0: 14, x1: 37, y1: 14, kind: 'jog' },
      { x0: 37, y0: 16, x1: 37, y1: 27, kind: 'jog' },
      { x0: 41, y0: 32, x1: 46, y1: 32, kind: 'jog' },
      { x0: 50, y0:  9, x1: 50, y1: 23, kind: 'jog' },
      { x0: 19, y0:  1, x1: 31, y1:  1, kind: 'jog' }
    ]),
    route: [
      { x:  4, y:  4 },   // 0  south down the west street
      { x:  4, y: 30 },   // 1  east along the bottom
      { x: 12, y: 30 },   // 2  north, the first fold
      { x: 12, y: 13 },   // 3  east
      { x: 22, y: 13 },   // 4  south, the second
      { x: 22, y: 31 },   // 5  east
      { x: 30, y: 31 },   // 6  north, the third
      { x: 30, y: 12 },   // 7  east
      { x: 40, y: 12 },   // 8  south, the fourth
      { x: 40, y: 30 },   // 9  east
      { x: 48, y: 30 },   // 10 north up the east street
      { x: 48, y:  4 }    // 11 west along the top, over the line
    ],
    startLeg: 11,
    checkpoints: [
      { x0:  2, y0: 12, x1:  6, y1: 13 },   // south down the west street
      { x0: 10, y0: 20, x1: 14, y1: 21 },   // north out of the first fold
      { x0: 28, y0: 24, x1: 32, y1: 25 },   // north out of the third
      { x0: 44, y0: 28, x1: 45, y1: 32 }    // east towards the east street
    ],
    finish: { x0: 37.6, y0: 1, x1: 38.4, y1: 6, dir: { x: -1, y: 0 } },
    startGrid: [
      { x: 39.5, y: 3.0, wp: 0 },
      { x: 39.5, y: 5.0, wp: 0 },
      { x: 41.4, y: 3.0, wp: 0 },
      { x: 41.4, y: 5.0, wp: 0 }
    ]
  };

  /* ------------------------------------------------------------------ *
   * DIRECTION
   *
   * Every circuit runs anticlockwise. Nine of them were drawn clockwise,
   * and a set of tracks where some go one way and some the other is not a
   * set of tracks, it is a set of surprises: you learn to read a corner and
   * then the next track reads it back at you mirrored.
   *
   * They are turned round by REFLECTING them left to right, not by driving
   * the same layout backwards. A reflection is exact - the gate margins, the
   * run-ins, the runoff past every turn-in and therefore every crash count
   * measured against the ladder survive it untouched, because the geometry
   * is the same geometry seen in a mirror. Driving a track backwards is a
   * different track: a stand that pushed you out of a corner now pushes you
   * into one, and every number would have to be measured again.
   *
   * The flip is applied here, at the point the data leaves this file, so the
   * layouts above stay as they were drawn and the diagrams in their comments
   * still describe them. Everything downstream - the game, the thumbnails,
   * the validator, tools/map.js - sees only the turned-round version.
   *
   * Crossover and Glacier are NOT flipped and cannot be: they are figures of
   * eight, which run one way round one lobe and the other way round the
   * other. Their left and right turns come out exactly even, which is what a
   * figure of eight is.
   * ------------------------------------------------------------------ */
  function flipX(t) {
    var C = t.cols;
    var copy = function (o) {
      var q = {};
      for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) q[k] = o[k];
      return q;
    };
    // A point is a position on the continuous grid.
    var point = function (p) { var q = copy(p); q.x = C - p.x; return q; };
    // A wall is INCLUSIVE CELL INDICES, so cell c maps to cell C-1-c and the
    // two ends of the range swap.
    var cells = function (r) {
      var q = copy(r);
      q.x0 = C - 1 - r.x1;
      q.x1 = C - 1 - r.x0;
      return q;
    };
    // A checkpoint, a finish line and an emblem are continuous spans, where
    // cell c runs from c to c+1 - a different transform by exactly one.
    var span = function (r) {
      var q = copy(r);
      q.x0 = C - r.x1;
      q.x1 = C - r.x0;
      return q;
    };

    var out = copy(t);
    out.walls = t.walls.map(cells);
    out.route = t.route.map(point);
    out.checkpoints = t.checkpoints.map(span);
    out.startGrid = t.startGrid.map(point);
    out.finish = span(t.finish);
    out.finish.dir = { x: -t.finish.dir.x, y: t.finish.dir.y };
    if (t.emblems) out.emblems = t.emblems.map(span);
    /* startLeg, and the order of the checkpoints, and each grid slot's
     * waypoint are all untouched: reflecting a lap does not renumber it. */
    return out;
  }

  global.TRACKS = [
    // the themed circuits, in the order the play screen offers them
    PINEFALL, HOLLOW, CANOPY,
    DUNELINE, SALTFLATS, CANYONRUN,
    FROSTLINE, GLACIER, WHITEOUT,
    SCREE, OVERHANG, QUARRY,
    GRIDLOCK, CROSSTOWN, DOWNTOWN,
    FOUNDRY, PIPEWORKS, REFINERY,
    SANCTUM, COLONNADE, LABYRINTH,
    // and the seven built before the themes, kept raceable under LEGACY
    CROSSOVER, SNOWDRIFT, MESA, WILDWOOD, CATALUNYA, CALDERA, STAIRCASE
  ].map(function (t) { return t.mirror ? flipX(t) : t; });
})(typeof window !== 'undefined' ? window : globalThis);
