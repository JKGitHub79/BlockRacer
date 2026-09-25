/* Block Racer - Auto Turn: which way a tap turns.
 *
 * The third control style. A tap anywhere on the race is a turn, and this
 * decides whether it is a left or a right. It never decides WHEN - the tap
 * does that - and it never moves the car: it returns -1 or +1 and the turn
 * goes into the same queue and the same Car.turn as a key, a tap or a swipe.
 *
 * Everything here is in track space, so a board the renderer has turned a
 * quarter on a phone held upright makes no difference to it.
 *
 * Two cases:
 *
 *   Following the route. The car is running along a leg of it (onLeg - worked
 *   out here from where the car is, not taken from the standings), so the
 *   next turn is simply the next change of direction in the route - the
 *   corner, the lane change, whatever the line does next. Whichever of left
 *   and right points the car that way is the answer.
 *
 *   Anything else - stopped against a wall, pointing backwards, off the line
 *   after a spin through traffic, or turned early into the inside of a
 *   corner. Then the tap turns toward a point a few cells further along the
 *   racing line, and away from a wall that would stop it straight away. Two
 *   taps get a car that is facing the wrong way round; one gets a crashed
 *   car going again in the direction of the lap. */
(function (global) {
  'use strict';

  var T = global.TRACK;
  var C = global.CONFIG;

  var AHEAD = 4;      // cells along the line to aim for when recovering

  function same(a, b) { return a.x === b.x && a.y === b.y; }
  function mod(i, n) { return ((i % n) + n) % n; }

  // How far along leg j the point (x, y) is, clamped to the leg.
  function along(j, x, y) {
    var a = T.ROUTE[j], d = T.LEG_DIR[j];
    return Math.max(0, Math.min(T.LEG_LEN[j], (x - a.x) * d.x + (y - a.y) * d.y));
  }

  // The point `dist` cells further along the racing line than the car.
  function ahead(car, dist, leg) {
    var n = T.ROUTE.length, j = mod(leg, n);
    var s = along(j, car.x, car.y), rem = T.LEG_LEN[j] - s;
    var p = { x: T.ROUTE[j].x + T.LEG_DIR[j].x * s, y: T.ROUTE[j].y + T.LEG_DIR[j].y * s };
    var guard = n;
    while (dist > rem && guard-- > 0) {
      dist -= rem;
      j = mod(j + 1, n);
      p = T.ROUTE[j];
      rem = T.LEG_LEN[j];
    }
    return { x: p.x + T.LEG_DIR[j].x * dist, y: p.y + T.LEG_DIR[j].y * dist };
  }

  // The first leg after j that goes a different way from `d`.
  function nextChange(j, d) {
    var n = T.ROUTE.length;
    for (var q = 1; q < n; q++) {
      var nd = T.LEG_DIR[mod(j + q, n)];
      if (!same(nd, d)) return nd;
    }
    return null;
  }

  /* Which leg of the route the car is on, worked out here for itself.
   *
   * Not car.leg. That comes from the standings, which only ever look a leg
   * or two either side of the last answer and refuse to jump far - right for
   * a running order, wrong for this: once a car leaves the line (skips a lane
   * change, is shoved across by the field, spins, comes off a wall) it can go
   * on reporting a leg twenty cells away, and a tap then turned the car for
   * that leg's corner. The wrong way.
   *
   * The leg a car is ON is one that runs the way it is pointing, that it is
   * alongside - no more than a road's width off to the side, not behind where
   * the leg starts by more than a slide's worth of turning early, and not so
   * far past its end that it has clearly carried on somewhere else - and the
   * nearest of those. None, and it is not on the route. A hair of preference
   * for legs just ahead of the standings' answer settles ties between
   * parallel legs the right way round. */
  var SIDE = 5, OVERRUN = 4;                 // cells
  function onLeg(car) {
    var n = T.ROUTE.length, d = car.dir, hint = mod(car.leg || 0, n);
    var best = Infinity, leg = -1, early = Math.max(C.slide, 0) + 1.5;
    for (var i = 0; i < n; i++) {
      var ld = T.LEG_DIR[i];
      if (!same(ld, d)) continue;
      var a = T.ROUTE[i];
      var t = (car.x - a.x) * ld.x + (car.y - a.y) * ld.y;
      if (t < -early || t > T.LEG_LEN[i] + OVERRUN) continue;
      var side = Math.abs((car.x - a.x) * ld.y - (car.y - a.y) * ld.x);
      if (side > SIDE) continue;
      var off = t < 0 ? -t : t > T.LEG_LEN[i] ? t - T.LEG_LEN[i] : 0;
      var score = side * side + off * off + 0.01 * mod(i - hint, n);
      if (score < best) { best = score; leg = i; }
    }
    return leg;
  }

  function offLine(j, car) {
    var s = along(j, car.x, car.y), a = T.ROUTE[j], ld = T.LEG_DIR[j];
    return Math.hypot(a.x + ld.x * s - car.x, a.y + ld.y * s - car.y);
  }

  /* Where to aim a recovery. The standings' leg while the car is still beside
   * it - a car that has just hit a wall is nearly always where the standings
   * think - and otherwise the nearest leg of all, whichever way it runs. A
   * crashed car's heading says little, so only a car still moving pays extra
   * for a leg it would have to turn right round for. */
  var NEAR = 3;                              // cells
  function recoverLeg(car) {
    var n = T.ROUTE.length, best = Infinity, leg = mod(car.leg || 0, n);
    if (offLine(leg, car) <= NEAR) return leg;
    for (var i = 0; i < n; i++) {
      var s = along(i, car.x, car.y), a = T.ROUTE[i], ld = T.LEG_DIR[i];
      var px = a.x + ld.x * s - car.x, py = a.y + ld.y * s - car.y;
      var back = !car.crashed && car.dir.x * ld.x + car.dir.y * ld.y < 0;
      var score = px * px + py * py + (back ? 9 : 0) + 0.01 * mod(i - leg, n);
      if (score < best) { best = score; leg = i; }
    }
    return leg;
  }

  function turnToward(d, want) {
    var right = { x: -d.y, y: d.x }, left = { x: d.y, y: -d.x };
    if (same(want, right)) return 1;
    if (same(want, left)) return -1;
    return 0;
  }

  // Off the route: turn toward the line a little way on, away from walls.
  function recover(car, leg) {
    var d = car.dir;
    var right = { x: -d.y, y: d.x }, left = { x: d.y, y: -d.x };
    var t = ahead(car, AHEAD, leg);
    var vx = t.x - car.x, vy = t.y - car.y, len = Math.hypot(vx, vy) || 1;
    vx /= len; vy /= len;
    var score = function (c) {
      var s = c.x * vx + c.y * vy;
      if (!car.pathClear(c, 1.0)) s -= 2;     // straight into a wall
      return s;
    };
    return score(right) >= score(left) ? 1 : -1;
  }

  var AutoTurn = {};

  /* -1 or +1: the turn a tap should make for `car` right now. */
  AutoTurn.choose = function (car) {
    if (!car || !T.ROUTE) return 0;
    var d = car.dir, j = onLeg(car);
    // On a leg and moving: the tap is the route's next turn.
    if (j >= 0 && !car.crashed) {
      var want = nextChange(j, d);
      var s = want ? turnToward(d, want) : 0;
      if (s) return s;
    }
    return recover(car, recoverLeg(car));
  };

  global.AutoTurn = AutoTurn;
})(typeof window !== 'undefined' ? window : globalThis);
