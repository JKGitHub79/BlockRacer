/* Block Racer - the one track.
 *
 * The circuit is a 4-cell-wide rectangular corridor around a solid infield.
 * Every straight carries two "jog" blocks on alternating halves of the
 * corridor, so no straight can be driven in a single lane: you are forced to
 * staircase with 90 degree turns the whole way round. That is the game.
 *
 * Grid is 40 x 25 cells.
 *   top corridor    rows 1..4     outer lane = rows 1-2   inner lane = rows 3-4
 *   bottom corridor rows 20..23   inner lane = rows 20-21 outer lane = rows 22-23
 *   left corridor   cols 1..4     outer lane = cols 1-2   inner lane = cols 3-4
 *   right corridor  cols 35..38   inner lane = cols 35-36 outer lane = cols 37-38
 *
 * Racing direction is clockwise: top -> right -> bottom -> left.
 */
(function (global) {
  'use strict';

  var C = global.CONFIG;

  // Inclusive cell rectangles that are solid.  kind is cosmetic only.
  var WALL_RECTS = [
    // outer boundary
    { x0: 0, y0: 0,  x1: C.cols - 1, y1: 0,           kind: 'edge' },
    { x0: 0, y0: C.rows - 1, x1: C.cols - 1, y1: C.rows - 1, kind: 'edge' },
    { x0: 0, y0: 0,  x1: 0,  y1: C.rows - 1,          kind: 'edge' },
    { x0: C.cols - 1, y0: 0, x1: C.cols - 1, y1: C.rows - 1, kind: 'edge' },

    // infield
    { x0: 5, y0: 5, x1: 34, y1: 19, kind: 'infield' },

    // top straight: outer half blocked, then inner half blocked
    { x0: 14, y0: 1,  x1: 20, y1: 2,  kind: 'jog' },
    { x0: 24, y0: 3,  x1: 30, y1: 4,  kind: 'jog' },
    // right straight
    { x0: 37, y0: 8,  x1: 38, y1: 12, kind: 'jog' },
    { x0: 35, y0: 15, x1: 36, y1: 18, kind: 'jog' },
    // bottom straight
    { x0: 22, y0: 22, x1: 28, y1: 23, kind: 'jog' },
    { x0: 12, y0: 20, x1: 17, y1: 21, kind: 'jog' },
    // left straight
    { x0: 1,  y0: 14, x1: 2,  y1: 18, kind: 'jog' },
    { x0: 3,  y0: 7,  x1: 4,  y1: 10, kind: 'jog' }
  ];

  var grid = new Uint8Array(C.cols * C.rows);   // 0 road, 1 wall
  var kinds = new Uint8Array(C.cols * C.rows);  // 1 edge, 2 infield, 3 jog
  var KIND_ID = { edge: 1, infield: 2, jog: 3 };

  WALL_RECTS.forEach(function (r) {
    for (var y = r.y0; y <= r.y1; y++) {
      for (var x = r.x0; x <= r.x1; x++) {
        grid[y * C.cols + x] = 1;
        kinds[y * C.cols + x] = KIND_ID[r.kind];
      }
    }
  });

  function isWall(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= C.cols || cy >= C.rows) return true;
    return grid[cy * C.cols + cx] === 1;
  }

  function wallKind(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= C.cols || cy >= C.rows) return 1;
    return kinds[cy * C.cols + cx];
  }

  /* Does the axis-aligned box [x0,x1]x[y0,y1] (cell units) touch a wall? */
  function boxHitsWall(x0, y0, x1, y1) {
    var cx0 = Math.floor(x0), cx1 = Math.ceil(x1) - 1;
    var cy0 = Math.floor(y0), cy1 = Math.ceil(y1) - 1;
    for (var cy = cy0; cy <= cy1; cy++) {
      for (var cx = cx0; cx <= cx1; cx++) {
        if (isWall(cx, cy)) return true;
      }
    }
    return false;
  }

  /* The racing line. Consecutive waypoints are always axis aligned; the line
   * threads every jog. AI cars follow it, and it doubles as the progress
   * measure used for race positions. */
  var ROUTE = [
    { x: 2,  y: 2  },   // 0  top-left corner, now heading right on the outer lane
    { x: 8,  y: 2  },   // 1  drop to the inner lane before the first jog
    { x: 8,  y: 4  },   // 2
    { x: 22, y: 4  },   // 3  climb back to the outer lane before the second jog
    { x: 22, y: 2  },   // 4
    { x: 36, y: 2  },   // 5  turn down into the right-hand inner lane
    { x: 36, y: 14 },   // 6  step out before the inner jog
    { x: 38, y: 14 },   // 7
    { x: 38, y: 21 },   // 8  turn left into the bottom inner lane
    { x: 20, y: 21 },   // 9  step out before the inner jog
    { x: 20, y: 23 },   // 10
    { x: 4,  y: 23 },   // 11 turn up into the left inner lane
    { x: 4,  y: 12 },   // 12 step out before the inner jog
    { x: 2,  y: 12 }    // 13 back up the outer lane to waypoint 0
  ];

  // Direction of the leg that *leaves* waypoint i.
  var LEG_DIR = ROUTE.map(function (p, i) {
    var n = ROUTE[(i + 1) % ROUTE.length];
    var dx = n.x - p.x, dy = n.y - p.y;
    var len = Math.abs(dx) + Math.abs(dy);
    return { x: dx / len, y: dy / len };
  });

  var LEG_LEN = ROUTE.map(function (p, i) {
    var n = ROUTE[(i + 1) % ROUTE.length];
    return Math.abs(n.x - p.x) + Math.abs(n.y - p.y);
  });

  var LEG_START = [];
  var ROUTE_LENGTH = 0;
  for (var li = 0; li < LEG_LEN.length; li++) {
    LEG_START[li] = ROUTE_LENGTH;
    ROUTE_LENGTH += LEG_LEN[li];
  }

  /* A per-car copy of the racing line, shifted sideways so the AI cars do not
   * all drive the same millimetre of tarmac. For a corner the offset of the
   * incoming leg supplies one coordinate and the outgoing leg the other. */
  function offsetRoute(offset) {
    if (!offset) return ROUTE.map(function (p) { return { x: p.x, y: p.y }; });
    return ROUTE.map(function (p, i) {
      var dIn = LEG_DIR[(i - 1 + ROUTE.length) % ROUTE.length];
      var dOut = LEG_DIR[i];
      // right-hand normal of (x,y) is (-y,x)
      var nIn = { x: -dIn.y, y: dIn.x };
      var nOut = { x: -dOut.y, y: dOut.x };
      var x = p.x + (nOut.x !== 0 ? nOut.x * offset : nIn.x * offset);
      var y = p.y + (nOut.y !== 0 ? nOut.y * offset : nIn.y * offset);
      return { x: x, y: y };
    });
  }

  /* Ordered checkpoints. All of them must be collected, in order, before the
   * start/finish line will count a lap - no reversing over the line. */
  var CHECKPOINTS = [
    { x0: 32.5, y0: 1,    x1: 33.5, y1: 5    },  // end of the top straight
    { x0: 35,   y0: 16.5, x1: 39,   y1: 17.5 },  // right straight
    { x0: 7.5,  y0: 20,   x1: 8.5,  y1: 24   },  // bottom straight
    { x0: 1,    y0: 7.5,  x1: 5,    y1: 8.5  }   // left straight
  ];

  var FINISH = { x0: 5.6, y0: 1, x1: 6.4, y1: 5 };

  /* Starting grid: two by two, all pointing right, all behind the line. */
  var START_GRID = [
    { x: 4.9, y: 2, wp: 1 },
    { x: 4.9, y: 4, wp: 2 },
    { x: 3.0, y: 2, wp: 1 },
    { x: 3.0, y: 4, wp: 2 }
  ];

  function inZone(z, x, y) {
    return x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1;
  }

  /* Advance a car's checkpoint state. Returns true on the step where it
   * completes a lap: every checkpoint collected in order, then the finish
   * line crossed while actually heading the right way. */
  function lapCheck(car) {
    var cp = CHECKPOINTS[car.nextCp];
    if (cp && inZone(cp, car.x, car.y)) car.nextCp++;
    if (car.nextCp >= CHECKPOINTS.length && car.dir.x > 0 &&
        inZone(FINISH, car.x, car.y)) {
      car.nextCp = 0;
      return true;
    }
    return false;
  }

  /* Distance travelled along the racing line, used to rank the field.
   *
   * Nearest-point-on-the-polyline alone is not enough: at the start line a car
   * sitting in the inner lane of the top straight is physically closer to the
   * left-hand straight than to the one it is actually driving, and would be
   * scored most of a lap ahead. So candidates are limited to legs around the
   * car's last known one, and any that implies an impossible jump in distance
   * is thrown away. */
  var MAX_ARC_JUMP = 6;
  var START_LEG = 0;

  function seedProgress(car) {
    var a = ROUTE[START_LEG], d = LEG_DIR[START_LEG];
    var t = (car.x - a.x) * d.x + (car.y - a.y) * d.y;
    car.leg = START_LEG;
    car.arc = LEG_START[START_LEG] + Math.max(0, Math.min(LEG_LEN[START_LEG], t));
  }

  function cyclicDelta(a, b) {
    var half = ROUTE_LENGTH / 2;
    return ((a - b + half + ROUTE_LENGTH * 2) % ROUTE_LENGTH) - half;
  }

  var WRONG_WAY_COST = 6;

  function progressAlong(x, y, dir, hintLeg, lastArc) {
    var best = Infinity, bestArc = lastArc, bestLeg = hintLeg;
    for (var k = -1; k <= 2; k++) {
      var i = (hintLeg + k + ROUTE.length * 2) % ROUTE.length;
      var a = ROUTE[i], d = LEG_DIR[i], len = LEG_LEN[i];
      var t = (x - a.x) * d.x + (y - a.y) * d.y;
      if (t < 0) t = 0; else if (t > len) t = len;
      var px = a.x + d.x * t, py = a.y + d.y * t;
      var arc = LEG_START[i] + t;
      if (Math.abs(cyclicDelta(arc, lastArc)) > MAX_ARC_JUMP) continue;
      var score = (px - x) * (px - x) + (py - y) * (py - y);
      // Distance alone is ambiguous - a car on the starting grid is nearer the
      // left-hand straight than the one it is about to drive down. Which way it
      // is pointing settles it.
      if (dir && dir.x * d.x + dir.y * d.y <= 0) score += WRONG_WAY_COST;
      if (score < best) { best = score; bestArc = arc; bestLeg = i; }
    }
    return { arc: bestArc, leg: bestLeg };
  }

  global.TRACK = {
    grid: grid,
    isWall: isWall,
    wallKind: wallKind,
    boxHitsWall: boxHitsWall,
    ROUTE: ROUTE,
    LEG_DIR: LEG_DIR,
    LEG_LEN: LEG_LEN,
    LEG_START: LEG_START,
    length: ROUTE_LENGTH,
    offsetRoute: offsetRoute,
    CHECKPOINTS: CHECKPOINTS,
    FINISH: FINISH,
    START_GRID: START_GRID,
    inZone: inZone,
    lapCheck: lapCheck,
    progressAlong: progressAlong,
    seedProgress: seedProgress,
    WALL_RECTS: WALL_RECTS
  };
})(typeof window !== 'undefined' ? window : globalThis);
