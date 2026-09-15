/* Block Racer - opponent drivers.
 *
 * An AI car has exactly the same controls as you: it can turn 90 degrees left
 * or right, and that is all. It follows a sideways-shifted copy of the racing
 * line, and every so often it turns too late, hits a wall, and has to pick
 * itself up again - which is what makes it beatable.
 */
(function (global) {
  'use strict';

  var C = global.CONFIG;
  var T = global.TRACK;

  function sameDir(a, b) { return a.x === b.x && a.y === b.y; }

  function AIDriver(car, cfg, startWp) {
    this.car = car;
    this.path = T.offsetRoute(cfg.offset);
    this.mistake = cfg.mistake;
    this.reaction = cfg.reaction;
    this.wpi = startWp;
    this.late = 0;            // how far past the turn this driver will sail
    this.mode = 'line';       // 'line' = on the racing line, 'recover' = lost
    this.recoverTimer = cfg.reaction;
    this.overrun = 0;
    this.watch = { t: 0, x: car.x, y: car.y, strikes: 0, fired: 0 };
    this.pending = null;      // heading we are part way through turning to
  }

  /* Traffic can leave a car shuffling on the spot at a corner. If it has not
   * covered any ground in a while, stop trying to be tidy and go find space. */
  AIDriver.prototype.watchdog = function (dt) {
    var w = this.watch, car = this.car;
    w.t += dt;
    if (w.t < 0.5) return false;
    var moved = Math.abs(car.x - w.x) + Math.abs(car.y - w.y);
    w.t = 0; w.x = car.x; w.y = car.y;
    if (moved > 0.25) { w.strikes = 0; w.fired = 0; return false; }
    if (++w.strikes < 2) return false;
    w.strikes = 0;
    this.pending = null;
    // Still going nowhere after a previous nudge? Write this waypoint off and
    // aim at the next one, so no single corner can hold a car forever.
    if (++w.fired >= 2) { w.fired = 0; this.advance(); }
    var right = { x: -car.dir.y, y: car.dir.x };
    var left = { x: car.dir.y, y: -car.dir.x };
    var first = Math.random() < 0.5 ? right : left;
    var second = first === right ? left : right;
    if (car.pathClear(first, 1.4)) car.turn(first === right ? 1 : -1);
    else if (car.pathClear(second, 1.4)) car.turn(second === right ? 1 : -1);
    else car.crashed = false;
    this.mode = 'recover';
    this.late = 0;
    return true;
  };

  AIDriver.prototype.update = function (dt) {
    var car = this.car;
    if (car.finished) return;

    if (this.watchdog(dt)) return;

    if (car.crashed) {
      // A beat of "oh no" before it sorts itself out.
      this.recoverTimer -= dt;
      if (this.recoverTimer <= 0) {
        this.mode = 'recover';
        this.late = 0;
        this.recoverTimer = this.reaction;
        this.steerToward(this.path[this.wpi]);
      }
      return;
    }
    this.recoverTimer = this.reaction;

    if (this.pending) {
      if (this.turnToward(this.pending)) this.pending = null;
      return;
    }

    if (this.mode === 'recover') this.navigate();
    else this.followLine();
  };

  /* Turn once toward `want`. A reverse needs two turns, same as it would for
   * you. The half-finished turn is remembered: without that the driver
   * re-decides on the next frame, starts another U-turn, and spins on the
   * spot in a neat little square for the rest of the race. */
  AIDriver.prototype.turnToward = function (want) {
    var car = this.car, d = car.dir;
    if (sameDir(d, want)) { this.pending = null; return true; }
    var right = { x: -d.y, y: d.x };
    if (sameDir(right, want)) { car.turn(1); this.pending = null; return true; }
    var left = { x: d.y, y: -d.x };
    if (sameDir(left, want)) { car.turn(-1); this.pending = null; return true; }
    this.pending = want;
    car.turn(car.pathClear(right, 1.0) ? 1 : -1);
    return false;
  };

  /* How far before the corner to start turning. A sliding car arcs through
   * the corner on a circle of radius CONFIG.slide, so turning exactly that far
   * early lands it on the next leg dead on line. Clamped to the legs either
   * side of the corner: on Staircase's two-cell chicane legs there is not room
   * for a full radius at both ends. */
  AIDriver.prototype.turnLead = function () {
    if (C.slide <= 0) return 0;
    var into = T.LEG_LEN[(this.wpi - 1 + this.path.length) % this.path.length];
    var away = T.LEG_LEN[this.wpi];
    return Math.min(C.slide, into * 0.45, away * 0.45);
  };

  AIDriver.prototype.followLine = function () {
    var car = this.car;
    var wp = this.path[this.wpi];
    var horizontal = car.dir.x !== 0;
    var s = horizontal ? car.dir.x : car.dir.y;
    var pos = horizontal ? car.x : car.y;
    var lead = this.turnLead();
    var goal = (horizontal ? wp.x : wp.y) - s * lead + this.late * s;

    if (s * (pos - goal) < 0) return;           // not there yet

    if (this.late > 0) {
      // Missed it on purpose. Keep going until something stops us, but do not
      // drive off into the sunset if the wall never arrives.
      this.overrun += Math.abs(pos - goal);
      if (this.overrun > 3) { this.mode = 'recover'; this.late = 0; this.overrun = 0; }
      return;
    }

    // Clean apex: sit exactly on the line, a turn radius short of the corner,
    // and throw it in. The arc does the rest.
    if (horizontal) {
      car.x = wp.x - s * lead;
      if (Math.abs(car.y - wp.y) < 0.35) car.y = wp.y;
    } else {
      car.y = wp.y - s * lead;
      if (Math.abs(car.x - wp.x) < 0.35) car.x = wp.x;
    }
    this.turnToward(T.LEG_DIR[this.wpi]);
    car.unstick();
    this.advance();
  };

  AIDriver.prototype.advance = function () {
    this.wpi = (this.wpi + 1) % this.path.length;
    this.overrun = 0;
    this.late = Math.random() < this.mistake ? 0.8 + Math.random() * 1.4 : 0;
  };

  /* Off the line: head for the waypoint one axis at a time.
   *
   * The important part is that a driver COMMITS to an axis and stays on it
   * until that axis is done. Turning costs nothing here, so a driver that
   * re-decides every frame will sit on the spot flipping between two headings
   * forever whenever the remaining error is roughly diagonal. */
  /* Close enough. Has to clear one step's travel, or a fast car steps over
   * the band and never registers as having arrived, and has to clear the turn
   * radius, or a sliding car arcs round the waypoint instead of reaching it. */
  function tolFor(car) {
    return Math.max(0.15, car.speed * C.dt * 2, C.slide * 0.6);
  }

  AIDriver.prototype.navigate = function () {
    var car = this.car;
    var wp = this.path[this.wpi];
    var TOL = tolFor(car);
    var dx = wp.x - car.x, dy = wp.y - car.y;
    var needX = Math.abs(dx) > TOL, needY = Math.abs(dy) > TOL;

    if (!needX && !needY) {
      if (this.turnToward(T.LEG_DIR[this.wpi])) {
        car.x = wp.x; car.y = wp.y;
        car.unstick();
        this.mode = 'line';
        this.advance();
      }
      return;
    }

    var d = car.dir;
    if (d.x !== 0 && needX && Math.sign(dx) === d.x && car.pathClear(d, probe(Math.abs(dx)))) return;
    if (d.y !== 0 && needY && Math.sign(dy) === d.y && car.pathClear(d, probe(Math.abs(dy)))) return;

    this.steerToward(wp);
  };

  /* Look ahead as far as we actually intend to travel - no further, or a wall
   * sitting just past the target makes a perfectly good heading look blocked. */
  function probe(gain) {
    return Math.max(0.3, Math.min(1.0, gain));
  }

  /* Pick the heading that closes the biggest remaining gap and has road in it. */
  AIDriver.prototype.steerToward = function (wp) {
    var car = this.car;
    var TOL = tolFor(car);
    var dx = wp.x - car.x, dy = wp.y - car.y;

    var options = [];
    if (Math.abs(dx) > TOL) options.push({ x: Math.sign(dx), y: 0, gain: Math.abs(dx) });
    if (Math.abs(dy) > TOL) options.push({ x: 0, y: Math.sign(dy), gain: Math.abs(dy) });
    options.sort(function (a, b) { return b.gain - a.gain; });
    // last resort: any direction at all that is not a wall
    options.push({ x: 1, y: 0, gain: 0 }, { x: -1, y: 0, gain: 0 },
                 { x: 0, y: 1, gain: 0 }, { x: 0, y: -1, gain: 0 });

    for (var i = 0; i < options.length; i++) {
      var o = options[i];
      if (!car.pathClear(o, o.gain ? probe(o.gain) : 0.8)) continue;
      if (sameDir(car.dir, o)) car.crashed = false;
      else this.turnToward(o);
      return;
    }
    car.turn(1);   // wedged in: spin and try again after the next beat
  };

  global.AIDriver = AIDriver;
})(typeof window !== 'undefined' ? window : globalThis);
