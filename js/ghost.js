/* Block Racer - the time trial ghost.
 *
 * Your record lap, driven again beside you. Four jobs, all here:
 *
 *   RECORD   every physics step of the lap you are driving, in memory.
 *   KEEP     when that lap turns out to be a record, simplify it down to the
 *            points that matter and save it, replacing the last one.
 *   REPLAY   where the record lap was at any given moment of a lap.
 *   COMPARE  how long the record lap took to get as far round as you are now,
 *            which is what the live delta is.
 *
 * The ghost is pictures and nothing else. It is not a Car, it is not in the
 * field, nothing in the physics, the collision grid, the AI or the input ever
 * sees it. The renderer is handed a pose and draws it; that is the whole of
 * its contact with the game.
 *
 * ---- what a sample is -----------------------------------------------------
 *
 *   t  seconds into the lap
 *   x, y  where the car was, in cells
 *   a  the angle its BODY was drawn at, so the oversteer lean replays too.
 *      Unwrapped as it is recorded - 3.1 followed by -3.1 becomes 3.1 then
 *      3.18 - so a plain linear blend between two samples is the right angle
 *      and never the long way round.
 *   p  how far round the lap it was, measured from the finish line and
 *      unwrapped the same way, so it climbs from about 0 to about 1.
 *
 * ---- why p is measured from the LINE ---------------------------------------
 *
 * A trial's first lap starts from the grid, standing, behind the line; every
 * other lap starts flying, on it. If each lap measured progress from wherever
 * it happened to start, a record set from the grid and a flying lap chasing
 * it would be on different rulers and the delta would be nonsense. Measured
 * from the line, both are on the same one: the grid lap simply starts a few
 * hundredths below zero. Chase a grid-start record with a flying lap and the
 * delta says you are ahead from the first metre - which you are.
 *
 * ---- storage ---------------------------------------------------------------
 *
 * One key per track and speed, beside the lap record it belongs to. A lap at
 * 120 steps a second is thousands of samples, and nearly all of them are a
 * car going in a straight line at a constant speed - which a straight line
 * between two samples reproduces exactly. So the lap is simplified before it
 * is kept: a sample is dropped when the samples either side of it, blended
 * AT ITS TIME, already put the car within a fiftieth of a cell of where it
 * really was. Measuring the error at the same moment rather than as the
 * nearest point on the path is what keeps the TIMING right as well as the
 * line - a ghost on the right road half a second late is no use to anyone.
 * Numbers are then stored as whole units, each as its difference from the
 * one before, which is what makes a lap a few kilobytes rather than a few
 * hundred.
 *
 * A ghost is only ever shown when it belongs to the record: same time, to
 * the microsecond, and a track whose walls and line still match the ones it
 * was driven on. A record from before ghosts existed simply has none - it is
 * never made up - and gets one the first time it is beaten.
 */
(function (global) {
  'use strict';

  var KEY = 'blockracer.ghost.v1.';
  var VERSION = 1;

  // how close the kept samples must reproduce the real lap
  var TOL_POS = 0.02;    // cells: half a pixel at the default cell size
  var TOL_ANG = 0.04;    // radians: a little over two degrees
  var TOL_P = 0.0005;    // of a lap

  // stored as integers in these units
  var Q_T = 1000;        // milliseconds
  var Q_XY = 100;        // hundredths of a cell
  var Q_A = 1000;        // milliradians
  var Q_P = 10000;       // ten-thousandths of a lap

  // A lap longer than this is not a record anyone is chasing; stop keeping
  // samples rather than let a car parked against a wall fill the memory.
  var MAX_LAP = 600;

  var T = null;
  function track() { return T || (T = global.TRACK); }

  /* ---- progress round the lap ----------------------------------------- */

  function fraction(car) {
    var tr = track();
    return tr.lapFraction(tr.progressAlong(car.x, car.y, car.dir, car.leg, car.arc).arc);
  }

  /* ---- recording ------------------------------------------------------- */

  function Recorder() { this.reset(); }

  Recorder.prototype.reset = function () {
    this.t = []; this.x = []; this.y = []; this.a = []; this.p = [];
    this.progress = 0;
    this.valid = false;
  };

  /* The first sample of a lap. Anything past half way round is taken to be
   * BEHIND the line rather than nearly home - a grid slot, or a finish zone
   * that starts a hair before the line itself. */
  Recorder.prototype.start = function (car) {
    this.reset();
    var f = fraction(car);
    this.base = f > 0.5 ? -1 : 0;
    this.off = 0;
    this.lastF = f;
    this.lastA = null;
    this.valid = true;
    this.push(car, 0, f);
  };

  Recorder.prototype.push = function (car, t, f) {
    if (!this.valid) return;
    if (t > MAX_LAP) { this.valid = false; return; }
    if (f === undefined) f = fraction(car);
    var d = f - this.lastF;
    if (d < -0.5) this.off++;          // crossed the line going forwards
    else if (d > 0.5) this.off--;      // ...or backwards
    this.lastF = f;
    this.progress = f + this.base + this.off;

    var a = car.bodyAngle();
    if (this.lastA !== null) {
      while (a - this.lastA > Math.PI) a -= Math.PI * 2;
      while (a - this.lastA < -Math.PI) a += Math.PI * 2;
    }
    this.lastA = a;

    this.t.push(t); this.x.push(car.x); this.y.push(car.y);
    this.a.push(a); this.p.push(this.progress);
  };

  /* The lap as it would be stored, or null when it cannot be one - fewer
   * than two samples, or a lap that ran past MAX_LAP. */
  Recorder.prototype.finish = function (lapTime, data) {
    if (!this.valid || this.t.length < 2) return null;
    return encode(this, simplify(this), lapTime, signature(data));
  };

  /* ---- simplifying ----------------------------------------------------- */

  /* Ramer-Douglas-Peucker, measured at matching TIMES. Every sample between
   * two kept ones is checked against the blend of those two at its own
   * moment; the worst offender is kept and each half checked again, until
   * nothing is further out than the tolerances. Iterative, so a long lap is
   * not a deep recursion. */
  function simplify(r) {
    var n = r.t.length;
    var keep = new Uint8Array(n);
    keep[0] = keep[n - 1] = 1;
    var stack = [0, n - 1];
    while (stack.length) {
      var i1 = stack.pop(), i0 = stack.pop();
      if (i1 - i0 < 2) continue;
      var span = r.t[i1] - r.t[i0], worst = 1, at = -1;
      for (var i = i0 + 1; i < i1; i++) {
        var u = span > 0 ? (r.t[i] - r.t[i0]) / span : 0;
        var ex = r.x[i0] + (r.x[i1] - r.x[i0]) * u - r.x[i];
        var ey = r.y[i0] + (r.y[i1] - r.y[i0]) * u - r.y[i];
        var ea = r.a[i0] + (r.a[i1] - r.a[i0]) * u - r.a[i];
        var ep = r.p[i0] + (r.p[i1] - r.p[i0]) * u - r.p[i];
        var e = Math.max(Math.sqrt(ex * ex + ey * ey) / TOL_POS,
                         Math.abs(ea) / TOL_ANG, Math.abs(ep) / TOL_P);
        if (e > worst) { worst = e; at = i; }
      }
      if (at >= 0) {
        keep[at] = 1;
        stack.push(i0, at, at, i1);
      }
    }
    var idx = [];
    for (var k = 0; k < n; k++) if (keep[k]) idx.push(k);
    return idx;
  }

  function deltas(values, q) {
    var out = [], last = 0;
    for (var i = 0; i < values.length; i++) {
      var v = Math.round(values[i] * q);
      out.push(v - last);
      last = v;
    }
    return out;
  }

  function undelta(list, q) {
    var out = new Float64Array(list.length), v = 0;
    for (var i = 0; i < list.length; i++) { v += list[i]; out[i] = v / q; }
    return out;
  }

  function encode(r, idx, lapTime, sig) {
    function pick(arr) { return idx.map(function (i) { return arr[i]; }); }
    return {
      v: VERSION,
      sig: sig,
      time: lapTime,
      t: deltas(pick(r.t), Q_T),
      x: deltas(pick(r.x), Q_XY),
      y: deltas(pick(r.y), Q_XY),
      a: deltas(pick(r.a), Q_A),
      p: deltas(pick(r.p), Q_P)
    };
  }

  /* Stored form to the arrays playback reads, plus the running maximum of p.
   * Progress can go BACKWARDS - turn round, or slide back off a wall - and
   * "when did the record lap first get this far" has to be answered on the
   * furthest it had got, not wherever it was at that moment. */
  function decode(d) {
    var g = {
      time: d.time,
      t: undelta(d.t, Q_T), x: undelta(d.x, Q_XY), y: undelta(d.y, Q_XY),
      a: undelta(d.a, Q_A), p: undelta(d.p, Q_P)
    };
    var n = g.t.length, pm = new Float64Array(n), hi = -Infinity;
    // Times are kept to the millisecond, which is plenty for the samples in
    // between but not for the ends: rounded, the last one can fall a hair
    // short of the record, and the ghost would vanish a frame before it got
    // to the line. The ends are the lap's own start and the record's exact
    // time, so they are put back exactly.
    g.t[0] = 0;
    g.t[n - 1] = Math.max(g.t[n - 1], d.time);
    for (var i = 0; i < n; i++) { if (g.p[i] > hi) hi = g.p[i]; pm[i] = hi; }
    g.pm = pm;
    return g;
  }

  /* ---- which track a ghost was driven on ---------------------------------
   *
   * A hash of everything that decides where a car can go and when a lap
   * counts. Edit a track and its old ghosts would drive through the new
   * walls; with this they are simply not shown, and the next record makes a
   * new one. */
  var sigCache = {};
  function signature(data) {
    if (!data) return '';
    if (sigCache[data.id]) return sigCache[data.id];
    var s = JSON.stringify([data.cols, data.rows, data.walls, data.route,
                            data.finish, data.checkpoints, data.startGrid]);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return (sigCache[data.id] = h.toString(36) + ':' + s.length.toString(36));
  }

  /* ---- keeping --------------------------------------------------------- */

  function keyFor(trackId, speedLevel) { return KEY + trackId + '@' + speedLevel; }

  /* The session's own copy of every ghost saved in it, keyed like storage.
   *
   * Progress has always kept its records in memory and treated storage as a
   * backup, so a record set while storage is refusing writes still stands for
   * the rest of the session. Ghosts did not, and on Safari that matters:
   * "Block All Cookies" and Lockdown Mode make every localStorage access
   * throw, and some private configurations refuse writes. There, the ghost
   * was used for the lap straight after the record and then lost at the next
   * reset - TRY AGAIN, RESTART, NEXT TRACK - because reset reloads it from a
   * storage that never received it. Chrome never refuses a page its own
   * storage, which is why it only ever showed up in Safari.
   *
   * Memory is written first and read first. It only ever holds ghosts saved
   * in this session, which are always newer than anything in storage. */
  var mem = {};

  /* Written only when the lap is a new record, over the top of the last one.
   * If storage is full or blocked the ghost is still used for the rest of the
   * session - it just does not survive a reload - and the record itself is
   * untouched either way, because it lives under its own key. */
  function save(data, speedLevel, stored) {
    mem[keyFor(data.id, speedLevel)] = stored;
    try {
      global.localStorage.setItem(keyFor(data.id, speedLevel), JSON.stringify(stored));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* The ghost for this track and speed, or null. Null when there is none,
   * when it cannot be read, when it was driven on a different version of the
   * track, or when it is not the lap the record says it is - a ghost is only
   * ever the record's own lap. */
  function load(data, speedLevel, record) {
    if (!data || !(record > 0)) return null;
    var key = keyFor(data.id, speedLevel), d = mem[key], raw = null;
    if (!d) {
      try { raw = global.localStorage.getItem(key); } catch (e) { raw = null; }
      if (!raw) return null;
    }
    try {
      if (!d) d = JSON.parse(raw);
      if (!d || d.v !== VERSION || d.sig !== signature(data)) return null;
      if (!(Math.abs(d.time - record) < 1e-6)) return null;
      var n = d.t && d.t.length;
      if (!(n >= 2) || d.x.length !== n || d.y.length !== n ||
          d.a.length !== n || d.p.length !== n) return null;
      return decode(d);
    } catch (e) {
      return null;
    }
  }

  function clearAll() {
    mem = {};
    try {
      var ls = global.localStorage, doomed = [];
      for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i);
        if (k && k.indexOf(KEY) === 0) doomed.push(k);
      }
      doomed.forEach(function (k) { ls.removeItem(k); });
    } catch (e) { /* nothing to clear, or nothing we are allowed to */ }
  }

  /* ---- replaying ------------------------------------------------------- */

  // first index whose value is >= v, in a non-decreasing array
  function lowerBound(arr, v) {
    var lo = 0, hi = arr.length;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (arr[mid] < v) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  /* Where the record lap was `t` seconds in, or null once it has crossed the
   * line - the ghost finishes its lap and is gone until yours starts again. */
  function poseAt(g, t) {
    var n = g.t.length;
    if (t > g.t[n - 1]) return null;
    if (t <= g.t[0]) return { x: g.x[0], y: g.y[0], a: g.a[0] };
    var i = lowerBound(g.t, t);
    var t0 = g.t[i - 1], t1 = g.t[i];
    var u = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
    return {
      x: g.x[i - 1] + (g.x[i] - g.x[i - 1]) * u,
      y: g.y[i - 1] + (g.y[i] - g.y[i - 1]) * u,
      a: g.a[i - 1] + (g.a[i] - g.a[i - 1]) * u
    };
  }

  /* How long into its lap the record lap first got as far round as `p`, or
   * null when `p` is outside the stretch it covered - before it started, or
   * past where it finished. Null means "no delta", not zero: a number there
   * would be made up. */
  function timeAtProgress(g, p) {
    var pm = g.pm, n = pm.length;
    if (!(p >= pm[0]) || p > pm[n - 1]) return null;
    var i = lowerBound(pm, p);
    if (i === 0) return g.t[0];
    var p0 = pm[i - 1], p1 = pm[i];
    var u = p1 > p0 ? (p - p0) / (p1 - p0) : 1;
    return g.t[i - 1] + (g.t[i] - g.t[i - 1]) * u;
  }

  global.Ghost = {
    Recorder: Recorder,
    load: load,
    save: save,
    decode: decode,
    clearAll: clearAll,
    poseAt: poseAt,
    timeAtProgress: timeAtProgress,
    signature: signature,
    keyFor: keyFor
  };
})(typeof window !== 'undefined' ? window : globalThis);
