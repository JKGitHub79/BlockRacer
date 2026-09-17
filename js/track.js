/* Block Racer - the live track.
 *
 * Holds whichever entry from js/tracks.js is currently being raced, plus
 * everything derived from it: the wall grid, the legs of the racing line, and
 * the queries the rest of the game asks. TRACK is mutated in place by load()
 * rather than replaced, so every module can hold on to a single reference.
 */
(function (global) {
  'use strict';

  var C = global.CONFIG;
  var KIND_ID = { edge: 1, infield: 2, jog: 3, lava: 4 };

  var T = {};

  // --- rebuilt by load() ---------------------------------------------------
  var grid, kinds, cols, rows;
  var ROUTE, LEG_DIR, LEG_LEN, LEG_START, ROUTE_LENGTH;
  var CHECKPOINTS, FINISH, START_LEG, FINISH_ARC;

  function isWall(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return true;
    return grid[cy * cols + cx] === 1;
  }

  function wallKind(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return 1;
    return kinds[cy * cols + cx];
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

  /* A per-car copy of the racing line, shifted sideways so cars do not all
   * drive the same millimetre of tarmac. At a corner the offset of the
   * incoming leg supplies one coordinate and the outgoing leg the other. */
  function offsetRoute(offset) {
    if (!offset) return ROUTE.map(function (p) { return { x: p.x, y: p.y }; });
    return ROUTE.map(function (p, i) {
      var dIn = LEG_DIR[(i - 1 + ROUTE.length) % ROUTE.length];
      var dOut = LEG_DIR[i];
      var nIn = { x: -dIn.y, y: dIn.x };     // right-hand normal
      var nOut = { x: -dOut.y, y: dOut.x };
      return {
        x: p.x + (nOut.x !== 0 ? nOut.x : nIn.x) * offset,
        y: p.y + (nOut.y !== 0 ? nOut.y : nIn.y) * offset
      };
    });
  }

  function inZone(z, x, y) {
    return x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1;
  }

  /* Advance a car's checkpoint state. Returns true on the step where it
   * completes a lap: every checkpoint collected in order, then the finish
   * line crossed while actually heading the right way. */
  function lapCheck(car) {
    var cp = CHECKPOINTS[car.nextCp];
    if (cp && inZone(cp, car.x, car.y)) car.nextCp++;
    if (car.nextCp >= CHECKPOINTS.length &&
        car.dir.x * FINISH.dir.x + car.dir.y * FINISH.dir.y > 0 &&
        inZone(FINISH, car.x, car.y)) {
      car.nextCp = 0;
      return true;
    }
    return false;
  }

  /* Distance travelled along the racing line, used to rank the field.
   *
   * Nearest-point-on-the-polyline alone is not enough. On the starting grid a
   * car is often closer to some other part of the circuit than to the leg it
   * is actually driving, and on Crossover the line runs through itself, so at
   * the crossing two legs are exactly as near. Candidates are therefore
   * limited to legs around the car's last known one, anything implying an
   * impossible jump in distance is dropped, and heading breaks the rest. */
  var MAX_ARC_JUMP = 6;
  var WRONG_WAY_COST = 6;

  function cyclicDelta(a, b) {
    var half = ROUTE_LENGTH / 2;
    return ((a - b + half + ROUTE_LENGTH * 2) % ROUTE_LENGTH) - half;
  }

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
      if (dir && dir.x * d.x + dir.y * d.y <= 0) score += WRONG_WAY_COST;
      if (score < best) { best = score; bestArc = arc; bestLeg = i; }
    }
    return { arc: bestArc, leg: bestLeg };
  }

  /* Fraction of a lap completed, measured from the finish line so that it
   * wraps at exactly the point where the lap counter ticks over. Measuring
   * from waypoint 0 instead makes the running order flicker every lap. */
  function lapFraction(arc) {
    return ((arc - FINISH_ARC) % ROUTE_LENGTH + ROUTE_LENGTH) % ROUTE_LENGTH / ROUTE_LENGTH;
  }

  function seedProgress(car) {
    var a = ROUTE[START_LEG], d = LEG_DIR[START_LEG];
    var t = (car.x - a.x) * d.x + (car.y - a.y) * d.y;
    car.leg = START_LEG;
    car.arc = LEG_START[START_LEG] + Math.max(0, Math.min(LEG_LEN[START_LEG], t));
  }

  /* Where on the racing line the finish line sits. Found rather than declared
   * so a track only has to say where its finish line is once. */
  function findFinishArc() {
    var fx = (FINISH.x0 + FINISH.x1) / 2, fy = (FINISH.y0 + FINISH.y1) / 2;
    var best = Infinity, arc = 0;
    for (var i = 0; i < ROUTE.length; i++) {
      var a = ROUTE[i], d = LEG_DIR[i];
      if (d.x * FINISH.dir.x + d.y * FINISH.dir.y <= 0) continue;
      var t = Math.max(0, Math.min(LEG_LEN[i], (fx - a.x) * d.x + (fy - a.y) * d.y));
      var px = a.x + d.x * t, py = a.y + d.y * t;
      var dist = (px - fx) * (px - fx) + (py - fy) * (py - fy);
      if (dist < best) { best = dist; arc = LEG_START[i] + t; }
    }
    return arc;
  }

  T.load = function (index) {
    var data = global.TRACKS[index];
    if (!data) throw new Error('no track ' + index);

    cols = data.cols;
    rows = data.rows;
    grid = new Uint8Array(cols * rows);
    kinds = new Uint8Array(cols * rows);
    data.walls.forEach(function (r) {
      for (var y = r.y0; y <= r.y1; y++) {
        for (var x = r.x0; x <= r.x1; x++) {
          grid[y * cols + x] = 1;
          kinds[y * cols + x] = KIND_ID[r.kind] || 1;
        }
      }
    });

    ROUTE = data.route;
    LEG_DIR = ROUTE.map(function (p, i) {
      var n = ROUTE[(i + 1) % ROUTE.length];
      var dx = n.x - p.x, dy = n.y - p.y;
      var len = Math.abs(dx) + Math.abs(dy);
      return { x: dx / len, y: dy / len };
    });
    LEG_LEN = ROUTE.map(function (p, i) {
      var n = ROUTE[(i + 1) % ROUTE.length];
      return Math.abs(n.x - p.x) + Math.abs(n.y - p.y);
    });
    LEG_START = [];
    ROUTE_LENGTH = 0;
    for (var i = 0; i < LEG_LEN.length; i++) {
      LEG_START[i] = ROUTE_LENGTH;
      ROUTE_LENGTH += LEG_LEN[i];
    }

    CHECKPOINTS = data.checkpoints;
    FINISH = data.finish;
    START_LEG = data.startLeg;
    FINISH_ARC = findFinishArc();

    T.index = index;
    T.data = data;
    T.theme = data.theme || null;
    T.weather = data.weather || null;
    T.emblems = data.emblems || null;
    // Rectangles the renderer animates. Empty on a track with no lava.
    T.lavaRects = data.walls.filter(function (r) { return r.kind === 'lava'; });
    T.name = data.name;
    T.cols = cols;
    T.rows = rows;
    T.width = cols * C.cell;
    T.height = rows * C.cell;
    T.aiPace = data.aiPace === undefined ? 1 : data.aiPace;
    T.aiOffsetScale = data.aiOffsetScale === undefined ? 1 : data.aiOffsetScale;
    T.aiMistakeScale = data.aiMistakeScale === undefined ? 1 : data.aiMistakeScale;
    T.ROUTE = ROUTE;
    T.LEG_DIR = LEG_DIR;
    T.LEG_LEN = LEG_LEN;
    T.LEG_START = LEG_START;
    T.length = ROUTE_LENGTH;
    T.CHECKPOINTS = CHECKPOINTS;
    T.FINISH = FINISH;
    T.START_GRID = data.startGrid;
    // Which way the grid faces, taken from the leg it sits on rather than
    // stated separately, so the two can never disagree.
    T.startDir = LEG_DIR[START_LEG];
    return T;
  };

  /* ---- Start grid ------------------------------------------------------
   * A track declares four slots, and at four cars or fewer those are used
   * exactly as declared, so a default race lines up where it always has.
   *
   * A bigger field is laid out from scratch on the same piece of road. The
   * road's width and the run back up it are measured by walking a car-sized
   * box outward until it meets scenery, rather than read off numbers in the
   * track file: a four-cell corridor and an eight-cell straight then grid up
   * correctly without either of them having to say how wide they are, and a
   * slot is never placed inside a wall however tight the track is.
   *
   * The whole field will not fit on every track. The grid comes back as long
   * as the road allows and the caller races whoever fits. */
  var LANE_PITCH = 1.4;   // car width plus enough room to get off the line
  var ROW_PITCHES = [1.9, 1.7, 1.55];   // roomy first; tighter only if needed
  var GRID_PROBE = 0.05;
  var GRID_EDGE = 0.2;    // never grid a car hard against a wall

  function carFits(lat, lon, latKey) {
    var halfW = C.carWidth / 2, halfL = C.carLength / 2;
    var x = latKey === 'x' ? lat : lon;
    var y = latKey === 'x' ? lon : lat;
    var ax = latKey === 'x' ? halfW : halfL;
    var ay = latKey === 'x' ? halfL : halfW;
    return !boxHitsWall(x - ax, y - ay, x + ax, y + ay);
  }

  function nearestWp(lat, latKey) {
    var declared = T.START_GRID, best = declared[0].wp, bd = Infinity;
    for (var i = 0; i < declared.length; i++) {
      var d = Math.abs(declared[i][latKey] - lat);
      if (d < bd) { bd = d; best = declared[i].wp; }
    }
    return best;
  }

  function rowsFrom(lo, step, lanes, front, fwd, latKey, lonKey, pitch, n) {
    var slots = [], lon = front;
    // A row with nothing in it ends the grid; a single blocked lane in an
    // otherwise clear row - a chicane block reaching back into the start
    // straight - is just left empty.
    while (slots.length < n) {
      var placed = 0;
      for (var i = 0; i < lanes && slots.length < n; i++) {
        var lat = lo + i * step;
        if (!carFits(lat, lon, latKey)) continue;
        var slot = { wp: nearestWp(lat, latKey) };
        slot[latKey] = lat;
        slot[lonKey] = lon;
        slots.push(slot);
        placed++;
      }
      if (!placed) break;
      lon -= pitch * fwd;
    }
    return slots;
  }

  function gridFor(n) {
    var declared = T.START_GRID;
    if (n <= declared.length) return declared.slice(0, n);

    var vertical = T.startDir.y !== 0;
    var latKey = vertical ? 'x' : 'y';
    var lonKey = vertical ? 'y' : 'x';
    var fwd = vertical ? T.startDir.y : T.startDir.x;

    var front = declared[0][lonKey], mid = 0, i;
    for (i = 0; i < declared.length; i++) {
      if (declared[i][lonKey] * fwd > front * fwd) front = declared[i][lonKey];
      mid += declared[i][latKey];
    }
    mid /= declared.length;

    /* How wide the road is, measured by walking a car-sized box sideways
     * until it meets scenery. The measurement is taken at the finish line
     * rather than at the grid: the line is across the straight by definition,
     * where the grid is often tucked into the corner before it, and a probe
     * started there escapes up the road the circuit arrives on and reports a
     * width the straight has not got. */
    var lonProbe = (FINISH[lonKey + '0'] + FINISH[lonKey + '1']) / 2;
    var lo = mid, hi = mid;
    while (carFits(lo - GRID_PROBE, lonProbe, latKey)) lo -= GRID_PROBE;
    while (carFits(hi + GRID_PROBE, lonProbe, latKey)) hi += GRID_PROBE;
    lo += GRID_EDGE;
    hi -= GRID_EDGE;
    if (hi < lo) { lo = hi = mid; }

    var span = hi - lo;
    // The epsilon is not cosmetic: a four-cell corridor works out to exactly
    // two pitches, and 2.8 / 1.4 is 1.9999999999999998 in binary.
    var lanes = Math.max(1, Math.min(n, Math.floor(span / LANE_PITCH + 1e-9) + 1));
    var step = lanes > 1 ? span / (lanes - 1) : 0;

    // Rows go back up the straight at the spacing every declared grid uses.
    // Only if that runs out of road before the field runs out of cars is the
    // grid closed up, and never past a car length and a bit.
    var best = [];
    for (i = 0; i < ROW_PITCHES.length; i++) {
      best = rowsFrom(lo, step, lanes, front, fwd, latKey, lonKey, ROW_PITCHES[i], n);
      if (best.length >= n) break;
    }
    return best;
  }

  T.gridFor = gridFor;
  T.isWall = isWall;
  T.wallKind = wallKind;
  T.boxHitsWall = boxHitsWall;
  T.offsetRoute = offsetRoute;
  T.inZone = inZone;
  T.lapCheck = lapCheck;
  T.progressAlong = progressAlong;
  T.lapFraction = lapFraction;
  T.seedProgress = seedProgress;

  T.load(C.track);
  global.TRACK = T;
})(typeof window !== 'undefined' ? window : globalThis);
