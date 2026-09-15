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
    snow: true,
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
   * 3. CALDERA - moderate
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
      { x0: 31.5, y0: 1,  x1: 32.5, y1: 4  },   // end of the top straight
      { x0: 33,   y0: 13, x1: 39,   y1: 14 },   // right road
      { x0: 8,    y0: 21, x1: 9,    y1: 24 },   // bottom straight
      { x0: 1,    y0: 12, x1: 7,    y1: 13 }    // left road
    ],
    finish: { x0: 8.6, y0: 4, x1: 9.4, y1: 7, dir: { x: 1, y: 0 } },
    startGrid: [
      { x: 6.9, y: 4.8, wp: 1 },
      { x: 6.9, y: 6.2, wp: 1 },
      { x: 5.0, y: 4.8, wp: 1 },
      { x: 5.0, y: 6.2, wp: 1 }
    ]
  };

  /* ------------------------------------------------------------------ *
   * 4. STAIRCASE
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

  global.TRACKS = [CROSSOVER, SNOWDRIFT, CALDERA, STAIRCASE];
})(typeof window !== 'undefined' ? window : globalThis);
