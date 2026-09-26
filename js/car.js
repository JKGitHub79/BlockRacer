/* Block Racer - the car.
 *
 * A car's heading is always a multiple of 90 degrees, so its bounding box is
 * axis aligned and collision is an exact swept box against the wall grid.
 *
 * Its momentum is not. `velAngle` is the direction the car is actually
 * travelling, and it swings round to the heading at a fixed rate rather than
 * snapping - so at CONFIG.slide > 0 a turn arcs through the corner at constant
 * speed, and you have to turn early. With slide at 0 the velocity snaps and
 * the car behaves exactly as it did before.
 *
 * There is still no acceleration: a car is either doing full speed or it is
 * stopped against something. Hitting a wall stops it dead; turning sets it off
 * again - from a standstill there is no momentum, so no slide.
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
    this.velAngle = Math.atan2(this.dir.y, this.dir.x);
    this.lean = 0;            // cosmetic body lean, see updatePose

    this.crashed = false;     // stopped by a wall, waiting for a turn
    this.crashFlash = 0;

    // Pro controls - the player's car only (see CONFIG.pro).
    this.drift = null;        // a held slide: { t } seconds of it so far
    this.boostT = 0;          // seconds of boost left
    this.boostMul = 1;        // speed while it lasts
    this.boostLevel = 0;      // which level earned it, 1-4: the flame's colour
    this.spin = null;         // a spin-out: { t, v0 }
    this.spinAngle = 0;       // the body's extra turn while spinning

    this.lap = 0;
    this.nextCp = 0;          // index into TRACK.CHECKPOINTS
    this.finished = false;
    this.finishTime = 0;
    this.lapTime = 0;
    this.bestLap = 0;
    this.lastLap = 0;
    this.lapTimes = [];       // every completed lap, in order

    this.leg = 0;
    this.arc = 0;
    this.progress = 0;        // laps + fraction, used for race position
    this.place = opts.id + 1;
  }

  function wrapPi(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  /* How fast the car is going now: its speed, plus a boost while one lasts. */
  Car.prototype.speedNow = function () {
    return this.boostT > 0 ? this.speed * this.boostMul : this.speed;
  };

  Car.prototype.headingAngle = function () {
    return Math.atan2(this.dir.y, this.dir.x);
  };

  /* Angle between where the car points and where it is going. Zero unless it
   * is mid-slide; up to a quarter turn just after a corner is thrown in. */
  Car.prototype.slip = function () {
    return wrapPi(this.headingAngle() - this.velAngle);
  };

  Car.prototype.sliding = function () {
    return Math.abs(this.slip()) > 0.02 || Math.abs(this.lean) > 0.02;
  };

  /* Body lean, which is what makes a slide read as oversteer rather than as a
   * car simply pointing the wrong way. It flicks out to meet the slip at once
   * and then unwinds no faster than CONFIG.slideSettle, so the car is drawn
   * catching the slide rather than snapping straight. Cosmetic only - the lean
   * never feeds back into position, collision or the racing line. */
  Car.prototype.updatePose = function (dt) {
    /* A held slide: the body swings round - quickly, not in one frame - until
     * it faces the way the car points, square to the way it is still going. */
    if (this.drift || this.spin) {
      var want = this.slip(), rate = C.pro.rotateRate * dt, gap = want - this.lean;
      this.lean += Math.abs(gap) <= rate ? gap : (gap > 0 ? rate : -rate);
      return;
    }
    var frac = C.oversteerFrac();
    var full = (Math.PI / 2) * frac;          // the lean a fresh corner throws
    var target = this.slip() * frac;
    if (Math.abs(target) >= Math.abs(this.lean) && target * this.lean >= 0) {
      this.lean = target;
      return;
    }
    // Unwinding takes CONFIG.slideSettle seconds from FULL lean, whatever
    // full happens to be, so the settle reads the same at every angle. With
    // no lean to unwind - oversteer turned down to nothing mid-slide - there
    // is nothing to animate and the pose goes straight to square.
    var step = (C.slideSettle > 0 && full > 0) ? full / C.slideSettle * dt : Infinity;
    var d = target - this.lean;
    this.lean += Math.abs(d) <= step ? d : (d > 0 ? step : -step);
  };

  Car.prototype.bodyAngle = function () {
    return this.velAngle + this.lean + this.spinAngle;
  };

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
  Car.prototype.turn = function (sign, hold) {
    var d = this.dir;
    var standing = this.crashed;
    this.dir = sign > 0 ? { x: -d.y, y: d.x } : { x: d.y, y: -d.x };
    // A held turn (Pro controls): the car keeps going the way it was and the
    // body swings round in updatePose - whatever the slide setting.
    if (hold && !standing) {
      this.unstick();
      this.crashed = false;
      return;
    }
    // A car pulling away from a wall has no momentum to fight, so it just goes
    // the new way. A moving car keeps its velocity and slides into line, and
    // its body flicks straight to the full oversteer pose - CONFIG.oversteer
    // degrees of the right angle it has just turned through, so at the
    // default it is drawn at 45 degrees to the way it is still travelling.
    if (standing || C.slide <= 0) {
      this.velAngle = this.headingAngle();
      this.lean = 0;
    } else {
      this.lean = sign * (Math.PI / 2) * C.oversteerFrac();
    }
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

  /* Slide one axis by `delta`, stopping flush against the first wall in the
   * way. Motion is no longer confined to one axis per step, so this runs once
   * per axis; the box it sweeps is whatever the car's heading makes it. */
  function sweepAxis(car, horizontal, delta) {
    if (delta === 0) return null;

    var b = car.box();
    var halfAlong = (horizontal ? b.x1 - b.x0 : b.y1 - b.y0) / 2;
    var halfPerp = (horizontal ? b.y1 - b.y0 : b.x1 - b.x0) / 2;
    var sign = delta > 0 ? 1 : -1;
    var pos = horizontal ? car.x : car.y;
    var perp = horizontal ? car.y : car.x;

    var lead = pos + sign * halfAlong;
    var target = lead + delta;

    // Cells the car spans across the direction of travel.
    var p0 = Math.floor(perp - halfPerp + EPS);
    var p1 = Math.ceil(perp + halfPerp - EPS) - 1;

    var from = sign > 0 ? Math.floor(lead) : Math.ceil(lead) - 1;
    var to = sign > 0 ? Math.ceil(target) - 1 : Math.floor(target);
    var hitCell = null;

    for (var c = from; sign > 0 ? c <= to : c >= to; c += sign) {
      for (var p = p0; p <= p1; p++) {
        if (horizontal ? T.isWall(c, p) : T.isWall(p, c)) { hitCell = c; break; }
      }
      if (hitCell !== null) break;
    }

    if (hitCell === null) {
      if (horizontal) car.x = pos + delta; else car.y = pos + delta;
      return null;
    }

    var newPos = (sign > 0 ? hitCell : hitCell + 1) - sign * (halfAlong + EPS);
    // Never let a wall shove us backwards when we are already flush with it.
    if (sign > 0 ? newPos < pos : newPos > pos) newPos = pos;
    if (horizontal) car.x = newPos; else car.y = newPos;

    return {
      x: car.x + (horizontal ? sign * halfAlong : 0),
      y: car.y + (horizontal ? 0 : sign * halfAlong)
    };
  }

  /* One physics step. Returns a crash point when it hits a wall this step.
   * Only walls stop a car - other cars are dealt with by the separation pass
   * below, so the pack shoves instead of gridlocking. */
  Car.prototype.step = function (dt) {
    this.crashFlash = Math.max(0, this.crashFlash - dt * 4);
    if (this.boostT > 0) this.boostT = Math.max(0, this.boostT - dt);
    if (this.spin) return this.stepSpin(dt);
    this.updatePose(dt);
    if (this.crashed || this.finished) return null;

    // A held slide goes on the way the car was going. Only time spent
    // actually sliding counts towards the boost, and too much of it spins
    // the car out.
    if (this.drift) {
      if (Math.abs(this.slip()) > 0.05) this.drift.t += dt;
      if (this.drift.t >= C.pro.spinAfter) { this.spinOut(); return null; }
    }

    // Swing the velocity round towards the heading. Constant speed at a
    // constant angular rate is a circular arc, and speed / radius is the rate
    // that gives the radius asked for. Not while a slide is being held.
    var speed = this.speedNow();
    var slip = this.slip();
    if (slip !== 0 && !this.drift) {
      if (C.slide <= 0) {
        this.velAngle = this.headingAngle();
      } else {
        var swing = (speed / C.slide) * dt;
        this.velAngle = wrapPi(this.velAngle +
          (Math.abs(slip) <= swing ? slip : (slip > 0 ? swing : -swing)));
      }
    }

    var dist = speed * dt;
    var dx = Math.cos(this.velAngle) * dist;
    var dy = Math.sin(this.velAngle) * dist;
    // Trigonometric dust: a car going due north must not creep sideways.
    if (Math.abs(dx) < 1e-9) dx = 0;
    if (Math.abs(dy) < 1e-9) dy = 0;

    // Both axes are tried: being stopped on one is not the same as being
    // stopped altogether.
    var hitX = sweepAxis(this, true, dx);
    var hitY = sweepAxis(this, false, dy);
    if (!hitX && !hitY) return null;
    var at = hitX || hitY;

    // How much of the car's speed was running along the wall it met rather
    // than into it. Both axes blocked is a corner, with nowhere to run.
    var along = (hitX && hitY) ? 0
              : (hitX ? Math.abs(dy) : Math.abs(dx)) / dist;

    if (along >= C.graze) {
      // A scrape. The blocked axis made no progress this step and the car
      // carries on down the wall on the other one, which costs it the speed
      // the wall just absorbed. It stops properly once it is pointing into
      // the wall, because then nothing is running along it any more.
      return { x: at.x, y: at.y, crashed: false };
    }

    this.crashed = true;
    this.crashFlash = 1;
    this.velAngle = this.headingAngle();
    this.lean = 0;
    this.boostT = 0;
    return { x: at.x, y: at.y, crashed: true };
  };

  /* ---- Pro controls: letting go, and holding on too long ---------------- */

  /* The slide is let go: the car goes the way it faces - swinging into line
   * as any turn does, or, stopped against a wall, straight off that way.
   * The level the slide reached sets the boost; returns that level, 0 for
   * none. */
  Car.prototype.releaseDrift = function () {
    var d = this.drift;
    if (!d) return false;
    this.drift = null;
    if (this.crashed) {
      this.crashed = false;
      this.velAngle = this.headingAngle();
      this.lean = 0;
      this.unstick();
      return 0;
    }
    var lv = C.proLevelFor(d.t), L = lv ? C.pro.levels[lv - 1] : null;
    if (L && L.pct > 0 && L.time > 0) {
      this.boostT = L.time;
      this.boostMul = 1 + L.pct / 100;
      this.boostLevel = lv;
      return lv;
    }
    return 0;
  };

  // Held too long: a full turn, slowing to a stop.
  Car.prototype.spinOut = function () {
    this.spin = { t: 0, v0: this.speedNow() };
    this.drift = null;
    this.boostT = 0;
  };

  Car.prototype.stepSpin = function (dt) {
    var sp = this.spin, P = C.pro;
    sp.t += dt;
    var k = Math.min(1, sp.t / P.spinTime);
    // round once, fast then slowing, as the speed bleeds away
    this.spinAngle = Math.PI * 2 * (1 - (1 - k) * (1 - k));
    this.updatePose(dt);
    if (k < 1) {
      var v = sp.v0 * (1 - k), dist = v * dt;
      var dx = Math.cos(this.velAngle) * dist, dy = Math.sin(this.velAngle) * dist;
      if (Math.abs(dx) < 1e-9) dx = 0;
      if (Math.abs(dy) < 1e-9) dy = 0;
      sweepAxis(this, true, dx);          // a wall stops it; nothing more
      sweepAxis(this, false, dy);
      return null;
    }
    this.spinAngle = 0;
    if (sp.t >= P.spinTime + P.restartDelay) {
      // off again, the way it faces
      this.spin = null;
      this.velAngle = this.headingAngle();
      this.lean = 0;
      this.unstick();
    }
    return null;
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
