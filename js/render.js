/* Block Racer - drawing. Everything is squares, so everything is cheap:
 * the track is baked once into an offscreen canvas and blitted each frame. */
(function (global) {
  'use strict';

  var C = global.CONFIG;
  var T = global.TRACK;
  var S = C.cell;

  var Renderer = {};
  var trackCanvas = null;

  function bakeTrack() {
    var cv = document.createElement('canvas');
    cv.width = T.width;
    cv.height = T.height;
    var g = cv.getContext('2d');

    g.fillStyle = C.colors.road;
    g.fillRect(0, 0, T.width, T.height);

    // faint tile grid on the tarmac so speed reads at a glance
    g.strokeStyle = C.colors.roadLine;
    g.lineWidth = 1;
    g.beginPath();
    for (var x = 0; x <= T.cols; x++) { g.moveTo(x * S + 0.5, 0); g.lineTo(x * S + 0.5, T.height); }
    for (var y = 0; y <= T.rows; y++) { g.moveTo(0, y * S + 0.5); g.lineTo(T.width, y * S + 0.5); }
    g.stroke();

    // racing line: the track is all right angles, so show the staircase
    g.save();
    g.strokeStyle = C.colors.racingLine;
    g.lineWidth = 2;
    g.setLineDash([6, 10]);
    g.beginPath();
    var pts = T.ROUTE, n = pts.length;
    var midOf = function (a, b) { return { x: (a.x + b.x) / 2 * S, y: (a.y + b.y) / 2 * S }; };
    if (C.slide > 0) {
      // Round the corners by the turn radius: this is the line a sliding car
      // actually takes, and it shows where you have to throw it in.
      var r = C.slide * S;
      var start = midOf(pts[n - 1], pts[0]);
      g.moveTo(start.x, start.y);
      for (var i = 0; i < n; i++) {
        var m = midOf(pts[i], pts[(i + 1) % n]);
        g.arcTo(pts[i].x * S, pts[i].y * S, m.x, m.y, r);
        g.lineTo(m.x, m.y);
      }
    } else {
      pts.forEach(function (p, i) {
        if (i === 0) g.moveTo(p.x * S, p.y * S); else g.lineTo(p.x * S, p.y * S);
      });
    }
    g.closePath();
    g.stroke();
    g.restore();

    // walls
    for (var cy = 0; cy < T.rows; cy++) {
      for (var cx = 0; cx < T.cols; cx++) {
        if (!T.isWall(cx, cy)) continue;
        // Three kinds of solid, each with its own face colour: the islands
        // inside the circuit, the ground outside it, and the chicane blocks.
        var kind = T.wallKind(cx, cy);
        var fill = kind === 3 ? C.colors.jog : kind === 2 ? C.colors.wall : C.colors.outer;
        var face = kind === 3 ? C.colors.jogTop : kind === 2 ? C.colors.wallTop : C.colors.outerTop;
        g.fillStyle = fill;
        g.fillRect(cx * S, cy * S, S, S);
        g.fillStyle = face;
        if (!T.isWall(cx, cy - 1)) g.fillRect(cx * S, cy * S, S, 3);
        if (!T.isWall(cx - 1, cy)) g.fillRect(cx * S, cy * S, 3, S);
        if (!T.isWall(cx + 1, cy)) g.fillRect(cx * S + S - 3, cy * S, 3, S);
        if (!T.isWall(cx, cy + 1)) {
          g.fillStyle = 'rgba(0,0,0,0.45)';
          g.fillRect(cx * S, cy * S + S - 3, S, 3);
        }
      }
    }

    // start / finish chequer
    var f = T.FINISH;
    var fx = f.x0 * S, fw = (f.x1 - f.x0) * S;
    g.fillStyle = '#0b0f18';
    g.fillRect(fx, f.y0 * S, fw, (f.y1 - f.y0) * S);
    for (var r = f.y0; r < f.y1; r += 0.4) {
      for (var col = 0; col < 2; col++) {
        g.fillStyle = (((r / 0.4) | 0) + col) % 2 ? C.colors.startLine : '#1b2131';
        g.fillRect(fx + col * fw / 2, r * S, fw / 2, 0.4 * S);
      }
    }
    trackCanvas = cv;
  }

  Renderer.init = function (canvas) {
    this.canvas = canvas;
    this.setTrack();
  };

  /* Resize to the current track and bake its scenery. Called on boot and
   * whenever the track changes - tracks are not all the same shape. */
  Renderer.setTrack = function () {
    var canvas = this.canvas;
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    canvas.width = T.width * dpr;
    canvas.height = T.height * dpr;
    canvas.style.width = T.width + 'px';
    canvas.style.height = T.height + 'px';
    this.ctx = canvas.getContext('2d');
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bakeTrack();
  };

  function drawCheckpoints(g, player) {
    T.CHECKPOINTS.forEach(function (z, i) {
      var next = player && !player.finished && player.nextCp === i;
      g.fillStyle = next ? C.colors.checkNext : C.colors.check;
      g.fillRect(z.x0 * S, z.y0 * S, (z.x1 - z.x0) * S, (z.y1 - z.y0) * S);
    });
  }

  function drawCar(g, car) {
    var L = C.carLength * S, W = C.carWidth * S;
    var a = car.bodyAngle();
    var cos = Math.cos(a), sin = Math.sin(a);

    g.save();
    g.translate(car.x * S, car.y * S);
    g.rotate(a);

    // shadow, offset down-right in world space whatever way the car points
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(-L / 2 + (2 * cos + 3 * sin), -W / 2 + (3 * cos - 2 * sin), L, W);

    g.fillStyle = car.crashFlash > 0.05
      ? 'rgba(255,255,255,' + (0.35 + 0.65 * car.crashFlash) + ')'
      : car.color;
    g.fillRect(-L / 2, -W / 2, L, W);

    // cabin, set back from the nose so the front end is obvious
    g.fillStyle = 'rgba(10,14,22,0.55)';
    g.fillRect(-L * 0.34, -W * 0.3, L * 0.4, W * 0.6);

    // nose stripe
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillRect(L / 2 - 3, -W / 2, 3, W);

    if (car.isPlayer) {
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 1.5;
      g.strokeRect(-L / 2 - 1.5, -W / 2 - 1.5, L + 3, W + 3);
      if (car.crashed) {
        g.globalAlpha = 0.55 + 0.45 * Math.sin(Date.now() / 90);
        g.strokeStyle = '#ff5470';
        g.lineWidth = 2;
        g.strokeRect(-L / 2 - 5, -W / 2 - 5, L + 10, W + 10);
      }
    }
    g.restore();
  }

  Renderer.draw = function (game) {
    var g = this.ctx;
    g.fillStyle = C.colors.bg;
    g.fillRect(0, 0, T.width, T.height);
    g.drawImage(trackCanvas, 0, 0, T.width, T.height);

    drawCheckpoints(g, game.player);

    // tyre marks first so they sit under the sparks and the cars
    game.particles.forEach(function (p) {
      if (!p.mark) return;
      g.globalAlpha = Math.max(0, p.life) * 0.5;
      g.fillStyle = p.color;
      g.fillRect(p.x * S - 1.5, p.y * S - 1.5, 3, 3);
    });
    game.particles.forEach(function (p) {
      if (p.mark) return;
      g.globalAlpha = Math.max(0, p.life);
      g.fillStyle = p.color;
      g.fillRect(p.x * S - 2, p.y * S - 2, 4, 4);
    });
    g.globalAlpha = 1;

    game.cars.forEach(function (car) { drawCar(g, car); });

    if (game.state === 'countdown') {
      var n = Math.ceil(game.countdown);
      var label = n > 0 ? String(n) : 'GO!';
      g.save();
      g.fillStyle = 'rgba(8,11,18,0.55)';
      g.fillRect(0, 0, T.width, T.height);
      g.font = '700 96px ui-monospace, Menlo, Consolas, monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = n > 0 ? '#ffd166' : '#5ef2a0';
      g.fillText(label, T.width / 2, T.height / 2);
      g.restore();
    }
  };

  global.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : globalThis);
