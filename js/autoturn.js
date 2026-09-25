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
 *   Following the route. The car is heading along the leg it is on (or has
 *   just turned onto the next one and the standings have not caught up), so
 *   the next turn is simply the next change of direction in the route - the
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
  function ahead(car, dist) {
    var n = T.ROUTE.length, j = mod(car.leg, n);
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

  /* Is the car genuinely round the corner at the end of leg j - or near
   * enough to it that it is taking it - rather than having turned early
   * into the inside of it? */
  function atCorner(car, j) {
    var slack = Math.max(C.slide, 0) + 2;
    return T.LEG_LEN[j] - along(j, car.x, car.y) <= slack;
  }

  function turnToward(d, want) {
    var right = { x: -d.y, y: d.x }, left = { x: d.y, y: -d.x };
    if (same(want, right)) return 1;
    if (same(want, left)) return -1;
    return 0;
  }

  // Off the route: turn toward the line a little way on, away from walls.
  function recover(car) {
    var d = car.dir;
    var right = { x: -d.y, y: d.x }, left = { x: d.y, y: -d.x };
    var t = ahead(car, AHEAD);
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
    var n = T.ROUTE.length, d = car.dir, j = mod(car.leg || 0, n);
    if (!car.crashed) {
      var on = null;
      if (same(T.LEG_DIR[j], d)) on = j;
      else if (same(T.LEG_DIR[mod(j + 1, n)], d) && atCorner(car, j)) on = mod(j + 1, n);
      if (on !== null) {
        var want = nextChange(on, d);
        var s = want ? turnToward(d, want) : 0;
        if (s) return s;
      }
    }
    return recover(car);
  };

  global.AutoTurn = AutoTurn;
})(typeof window !== 'undefined' ? window : globalThis);
