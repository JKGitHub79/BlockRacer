/* Block Racer - the car.
 *
 * A car is always axis aligned (headings are multiples of 90 degrees), so its
 * bounding box is exact and collision is a swept box against the wall grid.
 * Length always runs along the direction of travel.
 *
 * There is no acceleration: a car is either doing full speed or it is stopped
 * against something. Hitting a wall stops it dead; turning sets it off again.
 */
(function (global) {
  'use strict';

  var C = global.CONFIG;
  var T = global.TRACK;
  var EPS = 1e-4;

  function Car(opts) {
    this.id = opts.id;
    this.name = opts.name;
    this.color = opts.color;
    this.isPlayer = !!opts.isPlayer;
    this.speed = C.speed * (opts.speedMul || 1);

    this.x = opts.x;
    this.y = opts.y;
    this.dir = { x: opts.dir ? opts.dir.x : 1, y: opts.dir ? opts.dir.y : 0 };

    this.crashed = false;     // stopped by a wall, waiting for a turn
    this.crashFlash = 0;

    this.lap = 0;
    this.nextCp = 0;          // index into TRACK.CHECKPOINTS
    this.finished = false;
    this.finishTime = 0;
    this.lapTime = 0;
    this.bestLap = 0;
    this.lastLap = 0;

    this.leg = 0;
    this.arc = 0;
    this.progress = 0;        // laps + fraction, used for race position
    this.place = opts.id + 1;
  }

  Car.prototype.halfX = function () {
    return this.dir.x !== 0 ? C.carLength / 2 : C.carWidth / 2;
  };
  Car.prototype.halfY = function () {
    return this.dir.x !== 0 ? C.carWidth / 2 : C.carLength / 2;
  };

  Car.prototype.box = function (x, y) {
    var hx = this.halfX(), hy = this.halfY();
    if (x === undefined) { x = this.x; y = this.y; }
    return { x0: x - hx, y0: y - hy, x1: x + hx, y1: y + hy };
  };

  /* Right turn is clockwise on screen: (x,y) -> (-y,x). */
  Car.prototype.turn = function (sign) {
    var d = this.dir;
    this.dir = sign > 0 ? { x: -d.y, y: d.x } : { x: d.y, y: -d.x };
    // Rotating about the centre can poke the corners into a wall when the car
    // is hugging one; shove it back onto the tarmac rather than refusing.
    this.unstick();
    this.crashed = false;
  };

  /* Push the car out of any wall it overlaps, along the shallowest axis. */
  Car.prototype.unstick = function () {
    for (var pass = 0; pass < 8; pass++) {
      var b = this.box();
      var cx0 = Math.floor(b.x0), cx1 = Math.ceil(b.x1) - 1;
      var cy0 = Math.floor(b.y0), cy1 = Math.ceil(b.y1) - 1;
      var pushX = 0, pushY = 0, worst = 0;
      for (var cy = cy0; cy <= cy1; cy++) {
        for (var cx = cx0; cx <= cx1; cx++) {
          if (!T.isWall(cx, cy)) continue;
          var ox = Math.min(b.x1, cx + 1) - Math.max(b.x0, cx);
          var oy = Math.min(b.y1, cy + 1) - Math.max(b.y0, cy);
          if (ox <= 0 || oy <= 0) continue;
          var depth = Math.min(ox, oy);
          if (depth <= worst) continue;
          worst = depth;
          if (ox < oy) {
            pushX = (this.x < cx + 0.5) ? -(ox + EPS) : (ox + EPS);
            pushY = 0;
          } else {
            pushY = (this.y < cy + 0.5) ? -(oy + EPS) : (oy + EPS);
            pushX = 0;
          }
        }
      }
      if (worst === 0) return true;
      this.x += pushX;
      this.y += pushY;
    }
    return false;
  };

  /* Can this car move `dist` cells along `dir` from where it stands? */
  Car.prototype.pathClear = function (dir, dist) {
    var hx = dir.x !== 0 ? C.carLength / 2 : C.carWidth / 2;
    var hy = dir.x !== 0 ? C.carWidth / 2 : C.carLength / 2;
    var x = this.x + dir.x * dist, y = this.y + dir.y * dist;
    var x0 = Math.min(this.x, x) - hx, x1 = Math.max(this.x, x) + hx;
    var y0 = Math.min(this.y, y) - hy, y1 = Math.max(this.y, y) + hy;
    return !T.boxHitsWall(x0, y0, x1, y1);
  };

  /* One physics step. Returns a crash point when it hits a wall this step.
   * Only walls stop a car - other cars are dealt with by the separation pass
   * below, so the pack shoves instead of gridlocking. */
  Car.prototype.step = function (dt) {
    this.crashFlash = Math.max(0, this.crashFlash - dt * 4);
    if (this.crashed || this.finished) return null;

    var horizontal = this.dir.x !== 0;
    var sign = horizontal ? this.dir.x : this.dir.y;
    var along = this.speed * dt;

    var halfAlong = C.carLength / 2;
    var halfPerp = C.carWidth / 2;
    var pos = horizontal ? this.x : this.y;
    var perp = horizontal ? this.y : this.x;

    var lead = pos + sign * halfAlong;
    var target = lead + sign * along;

    // Cells the car spans across the corridor.
    var p0 = Math.floor(perp - halfPerp + EPS);
    var p1 = Math.ceil(perp + halfPerp - EPS) - 1;

    var from = sign > 0 ? Math.floor(lead) : Math.ceil(lead) - 1;
    var to = sign > 0 ? Math.ceil(target) - 1 : Math.floor(target);
    var hitCell = null;

    for (var c = from; sign > 0 ? c <= to : c >= to; c += sign) {
      for (var p = p0; p <= p1; p++) {
        var wall = horizontal ? T.isWall(c, p) : T.isWall(p, c);
        if (wall) { hitCell = c; break; }
      }
      if (hitCell !== null) break;
    }

    if (hitCell === null) {
      if (horizontal) this.x = pos + sign * along; else this.y = pos + sign * along;
      return null;
    }

    var newPos = (sign > 0 ? hitCell : hitCell + 1) - sign * (halfAlong + EPS);
    // Never let a wall shove us backwards when we are already flush with it.
    if (sign > 0 ? newPos < pos : newPos > pos) newPos = pos;
    if (horizontal) this.x = newPos; else this.y = newPos;

    this.crashed = true;
    this.crashFlash = 1;
    return {
      x: this.x + this.dir.x * halfAlong,
      y: this.y + this.dir.y * halfAlong
    };
  };

  /* Move by `amount` on one axis, but only if it stays out of the walls. */
  Car.prototype.nudge = function (axis, amount) {
    var was = this[axis];
    this[axis] = was + amount;
    var b = this.box();
    if (T.boxHitsWall(b.x0, b.y0, b.x1, b.y1)) { this[axis] = was; return false; }
    return true;
  };

  function sideSign(car, other, axis) {
    if (car[axis] < other[axis]) return -1;
    if (car[axis] > other[axis]) return 1;
    return car.id < other.id ? -1 : 1;   // dead heat: break it consistently
  }

  /* A shove always goes *sideways* relative to the car being shoved, never
   * backwards along its direction of travel. That matters: a backward shove
   * cancels the car's own motion exactly, and a car pinned against a wall
   * then runs on the spot forever. Sideways, the car behind slides out of the
   * tow and drives on; if the near side is walled it goes the other way, and
   * if both are walled the pair simply overlaps for a few frames, which is
   * ugly for an instant and never fatal. */
  function shove(car, other, ox, oy, maxPush) {
    var horizontal = car.dir.x !== 0;
    var perp = horizontal ? 'y' : 'x';
    var amt = Math.min((horizontal ? oy : ox) / 2 + EPS, maxPush);
    var away = sideSign(car, other, perp);
    if (car.nudge(perp, away * amt)) return;
    car.nudge(perp, -away * amt);
  }

  /* Bumper cars: nothing ever blocks anything, overlapping pairs are simply
   * eased apart a little each step. Capped by dt so a hit reads as a shove
   * rather than a teleport. */
  Car.separate = function (cars, dt) {
    var maxPush = 6 * dt;
    for (var pass = 0; pass < 3; pass++) {
      var touched = false;
      for (var i = 0; i < cars.length; i++) {
        for (var j = i + 1; j < cars.length; j++) {
          var a = cars[i], b = cars[j];
          if (a.finished || b.finished) continue;
          var ba = a.box(), bb = b.box();
          var ox = Math.min(ba.x1, bb.x1) - Math.max(ba.x0, bb.x0);
          var oy = Math.min(ba.y1, bb.y1) - Math.max(ba.y0, bb.y0);
          if (ox <= 0 || oy <= 0) continue;
          touched = true;
          shove(a, b, ox, oy, maxPush);
          shove(b, a, ox, oy, maxPush);
        }
      }
      if (!touched) return;
    }
  };

  global.Car = Car;
})(typeof window !== 'undefined' ? window : globalThis);
