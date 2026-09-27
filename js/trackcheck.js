/* Block Racer - can a car drive this track?
 *
 * The geometry proof that tools/validate-track.js has always run, moved here
 * so the level editor's CHECK button and the track build run exactly the same
 * code: a car of the configured size, driven by the real physics, down the
 * racing line at every lateral offset the AI uses, through every corner, over
 * every checkpoint in order.
 *
 * run() works on whatever js/track.js currently has loaded and returns the
 * sections in the order they ran, each with the problems it found (none is a
 * pass). It reads CONFIG.slide as it finds it: the validator's command line
 * can change it first.
 */
(function (global) {
  'use strict';

  function run() {
    var C = global.CONFIG, TRACK = global.TRACK, Car = global.Car;
    var L = C.carLength / 2, W = C.carWidth / 2;
    var sections = [], cur = null;
    var section = function (name) { cur = { name: name, problems: [] }; sections.push(cur); };
    var fail = function (msg) { cur.problems.push(msg); };

    function box(x, y, dir) {
      var hx = dir.x !== 0 ? L : W;
      var hy = dir.x !== 0 ? W : L;
      return [x - hx, y - hy, x + hx, y + hy];
    }
    var clear = function (x, y, dir) { return !TRACK.boxHitsWall.apply(null, box(x, y, dir)); };

    var OFFSETS = [0].concat(C.ai.map(function (a) { return a.offset * TRACK.aiOffsetScale; }));

    section('racing line, ' + OFFSETS.length + ' lateral offsets:');
    OFFSETS.forEach(function (off) {
      var route = TRACK.offsetRoute(off);
      for (var i = 0; i < route.length; i++) {
        var a = route[i], b = route[(i + 1) % route.length];
        var d = TRACK.LEG_DIR[i];
        var len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
        if (Math.abs(b.x - a.x) > 1e-9 && Math.abs(b.y - a.y) > 1e-9) {
          fail('leg ' + i + ' at offset ' + off + ' is not axis aligned');
        }
        for (var t = 0; t <= len; t += 0.05) {
          var x = a.x + d.x * t, y = a.y + d.y * t;
          if (!clear(x, y, d)) fail('offset ' + off + ' leg ' + i + ' blocked at (' + x.toFixed(2) + ', ' + y.toFixed(2) + ')');
        }
        // the car must also survive the rotation at the end of the leg
        var dOut = TRACK.LEG_DIR[(i + 1) % route.length];
        if (!clear(b.x, b.y, dOut)) fail('offset ' + off + ' cannot rotate at waypoint ' + ((i + 1) % route.length));
      }
    });

    section('start grid:');
    {
      // "Behind the line" depends on which way the line is crossed - a circuit
      // finishing westward grids up to the east of it.
      var fd = TRACK.FINISH.dir;
      var nearEdge = fd.x > 0 ? fd.x * TRACK.FINISH.x0
                   : fd.x < 0 ? fd.x * TRACK.FINISH.x1
                   : fd.y > 0 ? fd.y * TRACK.FINISH.y0
                   : fd.y * TRACK.FINISH.y1;
      TRACK.START_GRID.forEach(function (s) {
        if (!clear(s.x, s.y, TRACK.startDir)) fail('start slot (' + s.x + ', ' + s.y + ') is inside a wall');
        if (TRACK.inZone(TRACK.FINISH, s.x, s.y)) fail('start slot (' + s.x + ', ' + s.y + ') is on the finish line');
        if (fd.x * s.x + fd.y * s.y > nearEdge) fail('start slot (' + s.x + ', ' + s.y + ') is past the finish line');
      });
    }

    section('cornering at slide ' + C.slide + ':');
    OFFSETS.forEach(function (off) {
      var route = TRACK.offsetRoute(off);
      for (var i = 0; i < route.length; i++) {
        var dIn = TRACK.LEG_DIR[(i - 1 + route.length) % route.length];
        var dOut = TRACK.LEG_DIR[i];
        if (dIn.x === dOut.x && dIn.y === dOut.y) continue;   // not a corner
        // start where a driver would throw it in, and let the real physics drive
        var lead = C.slide <= 0 ? 0 : Math.min(
          C.slide,
          TRACK.LEG_LEN[(i - 1 + route.length) % route.length] * 0.45,
          TRACK.LEG_LEN[i] * 0.45);
        var car = new Car({
          id: 0, name: 'probe', color: '#fff',
          x: route[i].x - dIn.x * lead, y: route[i].y - dIn.y * lead,
          dir: { x: dIn.x, y: dIn.y }
        });
        car.turn((-dIn.y === dOut.x && dIn.x === dOut.y) ? 1 : -1);
        if (car.dir.x !== dOut.x || car.dir.y !== dOut.y) {
          fail('waypoint ' + i + ' at offset ' + off + ' is not a 90 degree turn');
          continue;
        }
        var guard = 0;
        while (car.sliding() && guard++ < 2000) {
          if (car.step(C.dt)) {
            fail('offset ' + off + ' crashes mid-corner at waypoint ' + i + ' ' +
                 '(' + car.x.toFixed(2) + ', ' + car.y.toFixed(2) + ')');
            break;
          }
        }
        // and it must come out of the corner sitting on the next leg
        var err = Math.abs((car.x - route[i].x) * dOut.y) +
                  Math.abs((car.y - route[i].y) * dOut.x);
        if (err > 0.1) {
          fail('offset ' + off + ' leaves waypoint ' + i + ' ' + err.toFixed(2) + ' cells off line');
        }
      }
    });

    /* EVERY line has to cross EVERY zone, not just one of them.
     *
     * This check used to pass as soon as a single offset found the zone, and
     * that is not the same thing at all: TRACK.inZone tests a car's CENTRE
     * against the raw rectangle, so a checkpoint laid out thin ACROSS the road
     * instead of thin ALONG it is a band the offset lines drive past on either
     * side. Quarry shipped past this check with a checkpoint like that and
     * two of its four cars could not complete a single lap - they drove the
     * circuit perfectly, forever, stuck on checkpoint two.
     *
     * The rule the shape has to follow: a checkpoint is thin in the direction
     * the car is TRAVELLING and spans the full width of the road across it. */
    section('checkpoints on the racing line:');
    TRACK.CHECKPOINTS.concat([TRACK.FINISH]).forEach(function (z, zi) {
      OFFSETS.forEach(function (off) {
        var hit = false;
        var route = TRACK.offsetRoute(off);
        for (var i = 0; i < route.length && !hit; i++) {
          var a = route[i], d = TRACK.LEG_DIR[i];
          var len = TRACK.LEG_LEN[i];
          for (var t = 0; t <= len; t += 0.02) {
            if (TRACK.inZone(z, a.x + d.x * t, a.y + d.y * t)) { hit = true; break; }
          }
        }
        if (!hit) {
          fail('zone ' + zi + ' is never crossed at offset ' + off.toFixed(2) + ' - a car ' +
               'on that line can never complete a lap');
        }
      });
    });

    /* A checkpoint has to span the WHOLE road it crosses, not just the lane the
     * racing line happens to take. Six tracks shipped with checkpoints sized to
     * the line instead, and a player driving a wider line through one of them
     * simply lost the lap - the checkpoint was never collected and the finish
     * did nothing. Nothing in the AI ever found it, because the AI drives the
     * line the checkpoint was drawn around. */
    section('checkpoints span the road:');
    TRACK.CHECKPOINTS.concat([TRACK.FINISH]).forEach(function (z, zi) {
      var w = z.x1 - z.x0, h = z.y1 - z.y0;
      var acrossX = w > h;                  // the long axis lies across the road
      var mid = acrossX ? (z.y0 + z.y1) / 2 : (z.x0 + z.x1) / 2;
      var lo0 = acrossX ? z.x0 : z.y0;
      var hi0 = acrossX ? z.x1 : z.y1;
      var free = function (v) {
        var x = acrossX ? v : mid, y = acrossX ? mid : v;
        return !TRACK.isWall(Math.floor(x), Math.floor(y));
      };
      var lo = (lo0 + hi0) / 2, hi = lo;
      if (!free(lo)) return;                // centred on scenery: nothing to span
      while (free(lo - 0.25)) lo -= 0.25;
      while (free(hi + 0.25)) hi += 0.25;
      if (lo0 > lo + 0.01 || hi0 < hi - 0.26) {
        fail('zone ' + zi + ' covers ' + lo0 + '..' + hi0 + ' of a road running ' +
          lo.toFixed(2) + '..' + (hi + 0.25).toFixed(2) + ' - a car outside that misses it');
      }
    });

    /* The checkpoints have to be DECLARED in the order they are driven, because
     * that is the order the game collects them in: a car holds a `nextCp` index
     * and only the zone at that index counts. Declared out of order they still
     * all get crossed, so every other check here passes, and the only symptom is
     * that the tint marking the next one points somewhere behind you and a lap
     * takes two laps to complete. Quarry shipped like that, and so did two of
     * the three space tracks - all three were rotated by exactly one, which is
     * what you get from writing the list in map order rather than lap order.
     *
     * So: walk the racing line from the finish, note the order the zones are
     * actually entered, and insist it is 0, 1, 2, 3. */
    section('checkpoints in lap order:');
    {
      var seenOrder = [];
      var R = TRACK.ROUTE, n = R.length;
      var leg = TRACK.data.startLeg;
      var f = TRACK.FINISH;
      var pos = { x: (f.x0 + f.x1) / 2, y: (f.y0 + f.y1) / 2 };
      var a = R[leg], b = R[(leg + 1) % n], guard = 0;
      var enter = function (z, i) {
        if (seenOrder.indexOf(i) < 0 && TRACK.inZone(z, pos.x, pos.y)) seenOrder.push(i);
      };
      while (seenOrder.length < TRACK.CHECKPOINTS.length && guard++ < 200000) {
        var dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
        pos.x += dx * 0.05;
        pos.y += dy * 0.05;
        TRACK.CHECKPOINTS.forEach(enter);
        if ((dx > 0 && pos.x >= b.x) || (dx < 0 && pos.x <= b.x) ||
            (dy > 0 && pos.y >= b.y) || (dy < 0 && pos.y <= b.y) || (dx === 0 && dy === 0)) {
          leg = (leg + 1) % n;
          a = R[leg];
          b = R[(leg + 1) % n];
          pos = { x: a.x, y: a.y };
        }
      }
      var want = TRACK.CHECKPOINTS.map(function (_, i) { return i; }).join(',');
      if (seenOrder.join(',') !== want) {
        fail('declared ' + want + ' but crossed in the order ' + seenOrder.join(',') + ' - ' +
             'the game only ever looks for the next one by index');
      }
      var last = R[R.length - 1], first = R[0];
      if (last.x !== first.x && last.y !== first.y) fail('closing leg is not axis aligned');
    }

    return {
      sections: sections,
      problems: sections.reduce(function (s, x) { return s + x.problems.length; }, 0),
      summary: TRACK.length.toFixed(0) + ' cells per lap, ' +
        TRACK.cols + 'x' + TRACK.rows + ' cells, ' + TRACK.CHECKPOINTS.length + ' checkpoints'
    };
  }

  global.TrackCheck = { run: run };
})(typeof window !== 'undefined' ? window : globalThis);
