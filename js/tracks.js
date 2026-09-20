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

  global.TRACKS = [
    // the themed circuits, in the order the play screen offers them
    PINEFALL, HOLLOW, CANOPY,
    // and the seven built before the themes, kept raceable under LEGACY
    CROSSOVER, SNOWDRIFT, MESA, WILDWOOD, CATALUNYA, CALDERA, STAIRCASE
  ];
})(typeof window !== 'undefined' ? window : globalThis);
