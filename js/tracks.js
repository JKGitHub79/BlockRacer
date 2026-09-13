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

  function border(cols, rows) {
    return [
      { x0: 0, y0: 0, x1: cols - 1, y1: 0, kind: 'edge' },
      { x0: 0, y0: rows - 1, x1: cols - 1, y1: rows - 1, kind: 'edge' },
      { x0: 0, y0: 0, x1: 0, y1: rows - 1, kind: 'edge' },
      { x0: cols - 1, y0: 0, x1: cols - 1, y1: rows - 1, kind: 'edge' }
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
   * 2. STAIRCASE
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

  global.TRACKS = [CROSSOVER, STAIRCASE];
})(typeof window !== 'undefined' ? window : globalThis);
