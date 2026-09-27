/* Block Racer - the level editor.
 *
 * Options, LEVEL EDITOR. It edits track FILES, never the game: every change
 * lands in a draft kept on this device, and the only way out of the editor
 * and into the game is a file - saved, shared or emailed, then uploaded to
 * tracks/ on GitHub, where .github/workflows/tracks.yml rebuilds the bundle
 * the game loads. js/trackfile.js is the format; js/trackcheck.js is the
 * same driving check tools/validate-track.js runs.
 *
 * A themed track keeps its slot and its theme's colours: it can be changed,
 * not moved or recoloured. Everything else - and every new track - is adhoc,
 * and chooses its own colours.
 *
 * Drawing is mouse, finger or pencil, one pointer at a time. Two fingers pan
 * and pinch; a mouse wheel zooms. Everything is in cells: a wall is a block
 * of whole cells, the racing line snaps to half cells.
 */
(function (global) {
  'use strict';

  var C = global.CONFIG;
  var TF = global.TrackFile;
  var STORE = 'blockracer.editor.v1';
  var TEST_ID = 'editor-test';
  var HISTORY = 120;

  var Editor = { tool: 'wall', kind: 'infield', tab: 'details' };
  var el = {};
  var drafts = {};          // id -> file, kept on this device
  var cur = null;           // the file being edited
  var undoStack = [], redoStack = [];
  var view = { s: 12, x: 0, y: 0, fitS: 12 };
  var dpr = 1;
  var op = null;            // what the pointer is doing
  var pointers = {};        // for two-finger pan and pinch
  var pinch = null;
  var hover = null;
  var redraw = null;        // the racing line being drawn afresh
  var marks = [];           // where the last CHECK found problems
  var storageOk = true;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  /* The same track, whatever order its keys were written in: the build puts
   * every file back in one order, and a draft identical to what was uploaded
   * has to read as identical once the game has it. */
  function sameFile(a, b) { return !!a && !!b && TF.stringify(a) === TF.stringify(b); }
  function snap(v, step) { return Math.round(v / step) * step; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function themes() { return global.THEMES || []; }
  function palettes() { return global.PALETTES || {}; }

  /* ---- drafts ------------------------------------------------------------ */

  function loadDrafts() {
    try {
      var raw = global.localStorage.getItem(STORE);
      var d = raw ? JSON.parse(raw) : null;
      drafts = d && d.v === 1 && d.drafts && typeof d.drafts === 'object' ? d.drafts : {};
    } catch (e) {
      drafts = {};
    }
    // A draft the game has caught up with - uploaded and built - is done.
    var done = Object.keys(drafts).filter(function (id) { return sameFile(drafts[id], liveFile(id)); });
    done.forEach(function (id) { delete drafts[id]; });
    if (done.length) saveDrafts();
  }

  function saveDrafts() {
    try {
      global.localStorage.setItem(STORE, JSON.stringify({ v: 1, drafts: drafts }));
      storageOk = true;
    } catch (e) {
      storageOk = false;
    }
  }

  function liveFile(id) {
    var list = global.TRACK_FILES || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function slotOf(id) {
    var out = null;
    themes().forEach(function (th) {
      th.tracks.forEach(function (e) { if (e.id === id) out = { theme: th, entry: e }; });
    });
    return out;
  }

  function takenIds() {
    var ids = {};
    (global.TRACK_FILES || []).forEach(function (f) { ids[f.id] = 1; });
    Object.keys(drafts).forEach(function (id) { ids[id] = 1; });
    themes().forEach(function (th) { th.tracks.forEach(function (e) { ids[e.id] = 1; }); });
    ids[TEST_ID] = 1;
    return ids;
  }

  // Remember the draft - or forget it, once it is the file again.
  function persist() {
    if (!cur) return;
    var live = liveFile(cur.id);
    if (sameFile(live, cur)) delete drafts[cur.id];
    else drafts[cur.id] = clone(cur);
    saveDrafts();
    paintStatus();
  }

  /* ---- geometry ----------------------------------------------------------- */

  function solidGrid(f) {
    var g = new Uint8Array(f.cols * f.rows);
    TF.border(f.cols, f.rows, f.border).concat(f.walls).forEach(function (w) {
      for (var y = Math.max(0, w.y0); y <= Math.min(f.rows - 1, w.y1); y++) {
        for (var x = Math.max(0, w.x0); x <= Math.min(f.cols - 1, w.x1); x++) g[y * f.cols + x] = 1;
      }
    });
    return g;
  }
  function solidAt(f, g, cx, cy) {
    if (cx < 0 || cy < 0 || cx >= f.cols || cy >= f.rows) return true;
    return g[cy * f.cols + cx] === 1;
  }
  // The car's box at (x, y) facing dir, against the walls - as js/track.js.
  function carClear(f, g, x, y, dir) {
    var hx = dir.x !== 0 ? C.carLength / 2 : C.carWidth / 2;
    var hy = dir.x !== 0 ? C.carWidth / 2 : C.carLength / 2;
    for (var cy = Math.floor(y - hy); cy <= Math.ceil(y + hy) - 1; cy++) {
      for (var cx = Math.floor(x - hx); cx <= Math.ceil(x + hx) - 1; cx++) {
        if (solidAt(f, g, cx, cy)) return false;
      }
    }
    return true;
  }

  function legsOf(route) {
    return route.map(function (a, i) {
      var b = route[(i + 1) % route.length];
      var len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
      return { a: a, b: b, len: len,
               dir: { x: len ? Math.sign(b.x - a.x) : 0, y: len ? Math.sign(b.y - a.y) : 0 } };
    });
  }

  function nearestLeg(route, p, wantDir) {
    var best = null;
    legsOf(route).forEach(function (L, i) {
      if (!L.len) return;
      if (wantDir && L.dir.x * wantDir.x + L.dir.y * wantDir.y <= 0) return;
      var t = clamp((p.x - L.a.x) * L.dir.x + (p.y - L.a.y) * L.dir.y, 0, L.len);
      var qx = L.a.x + L.dir.x * t, qy = L.a.y + L.dir.y * t;
      var d = Math.hypot(p.x - qx, p.y - qy);
      if (!best || d < best.d) best = { i: i, t: t, d: d, dir: L.dir };
    });
    return best;
  }

  function mid(z) { return { x: (z.x0 + z.x1) / 2, y: (z.y0 + z.y1) / 2 }; }

  /* The road across the point, as a zone one cell thick along the way the
   * racing line runs there and wall to wall across it - the shape the CHECK
   * insists on. `thick` is the finish line's 0.8 instead of a whole cell. */
  function zoneAcross(f, p, dir, thick) {
    var g = solidGrid(f);
    var cx = Math.floor(p.x), cy = Math.floor(p.y);
    if (solidAt(f, g, cx, cy)) return null;
    var z;
    if (dir.x !== 0) {
      var lo = cy, hi = cy;
      while (!solidAt(f, g, cx, lo - 1)) lo--;
      while (!solidAt(f, g, cx, hi + 1)) hi++;
      z = { x0: cx, y0: lo, x1: cx + 1, y1: hi + 1 };
      if (thick) { var c = Math.round(p.x); z.x0 = c - thick / 2; z.x1 = c + thick / 2; }
    } else {
      var l = cx, h = cx;
      while (!solidAt(f, g, l - 1, cy)) l--;
      while (!solidAt(f, g, h + 1, cy)) h++;
      z = { x0: l, y0: cy, x1: h + 1, y1: cy + 1 };
      if (thick) { var c2 = Math.round(p.y); z.y0 = c2 - thick / 2; z.y1 = c2 + thick / 2; }
    }
    ['x0', 'y0', 'x1', 'y1'].forEach(function (k) { z[k] = Math.round(z[k] * 100) / 100; });
    return z;
  }

  function inZone(z, x, y) { return x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1; }

  /* The order a lap actually meets the checkpoints in: walk the racing line
   * from the finish, exactly as the CHECK does, and note each zone the first
   * time the line enters it. A zone the line never enters keeps its place
   * at the back, and the CHECK says so. */
  function lapOrder(f) {
    var R = f.route, n = R.length, seen = [];
    if (n < 2 || !f.finish) return f.checkpoints.map(function (_, i) { return i; });
    var leg = f.startLeg, pos = mid(f.finish), a = R[leg], b = R[(leg + 1) % n], guard = 0;
    while (seen.length < f.checkpoints.length && guard++ < 200000) {
      var dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
      pos.x += dx * 0.05;
      pos.y += dy * 0.05;
      for (var i = 0; i < f.checkpoints.length; i++) {
        if (seen.indexOf(i) < 0 && inZone(f.checkpoints[i], pos.x, pos.y)) seen.push(i);
      }
      if ((dx > 0 && pos.x >= b.x) || (dx < 0 && pos.x <= b.x) ||
          (dy > 0 && pos.y >= b.y) || (dy < 0 && pos.y <= b.y) || (dx === 0 && dy === 0)) {
        leg = (leg + 1) % n;
        if (guard > 1 && leg === f.startLeg && seen.length === 0) break;
        a = R[leg]; b = R[(leg + 1) % n];
        pos = { x: a.x, y: a.y };
      }
    }
    for (var k = 0; k < f.checkpoints.length; k++) if (seen.indexOf(k) < 0) seen.push(k);
    return seen;
  }

  // Merge what a drag left behind: repeated points and straight-through ones.
  function tidyRoute(R) {
    var changed = true;
    R = R.map(function (p) { return { x: snap(p.x, 0.5), y: snap(p.y, 0.5) }; });
    while (changed && R.length > 2) {
      changed = false;
      for (var i = 0; i < R.length && R.length > 2; i++) {
        var p = R[(i - 1 + R.length) % R.length], q = R[i], r = R[(i + 1) % R.length];
        var dup = q.x === r.x && q.y === r.y;
        var straight = (p.x === q.x && q.x === r.x) || (p.y === q.y && q.y === r.y);
        if (dup || straight) { R.splice(i, 1); changed = true; break; }
      }
    }
    return R;
  }

  /* A grid of up to four behind the finish on the leg it is on - two lanes
   * either side of the racing line, the front row a car length and a bit
   * back, the next at the spacing every track uses. js/track.js adds rows
   * behind these for a bigger field, as it does on every track. */
  function makeGrid(f) {
    var n = f.route.length, L = legsOf(f.route)[f.startLeg];
    var d = f.finish.dir, g = solidGrid(f);
    var near = d.x > 0 ? f.finish.x0 : d.x < 0 ? f.finish.x1 : d.y > 0 ? f.finish.y0 : f.finish.y1;
    var lineLat = d.x !== 0 ? L.a.y : L.a.x;
    var legStart = d.x !== 0 ? L.a.x : L.a.y;
    var fwd = d.x !== 0 ? d.x : d.y;
    var wp = (f.startLeg + 1) % n;
    var slots = [];
    [1.6, 3.5].forEach(function (back) {
      var lon = near - fwd * back;
      if ((lon - legStart) * fwd < 0.3) return;          // off the start of the leg
      var lanes = [[-1.2, 1.2], [-0.7, 0.7], [0]];
      for (var k = 0; k < lanes.length; k++) {
        var row = lanes[k].map(function (o) {
          return d.x !== 0 ? { x: lon, y: lineLat + o } : { x: lineLat + o, y: lon };
        }).filter(function (s) { return carClear(f, g, s.x, s.y, d); });
        if (row.length === lanes[k].length) {
          row.forEach(function (s) {
            slots.push({ x: Math.round(s.x * 100) / 100, y: Math.round(s.y * 100) / 100, wp: wp });
          });
          return;
        }
      }
    });
    if (!slots.length) {
      var s = d.x !== 0 ? { x: near - fwd * 1.2, y: lineLat } : { x: lineLat, y: near - fwd * 1.2 };
      slots.push({ x: Math.round(s.x * 100) / 100, y: Math.round(s.y * 100) / 100, wp: wp });
    }
    return slots;
  }

  /* After anything that moves the line or the finish: which leg the finish
   * is on, the grid behind it, and the checkpoints in the order a lap meets
   * them. `grid` false keeps a hand-made grid when nothing it hangs off
   * has moved. */
  function settle(f, grid) {
    if (f.route.length >= 4 && f.finish) {
      var hit = nearestLeg(f.route, mid(f.finish), f.finish.dir);
      if (hit) {
        if (hit.i !== f.startLeg) grid = true;
        f.startLeg = hit.i;
      }
      if (grid) f.startGrid = makeGrid(f);
      var order = lapOrder(f);
      f.checkpoints = order.map(function (i) { return f.checkpoints[i]; });
    }
  }

  // An inclusive cell rectangle minus another: up to four pieces.
  function subtract(w, e) {
    if (e.x1 < w.x0 || e.x0 > w.x1 || e.y1 < w.y0 || e.y0 > w.y1) return [w];
    var out = [], y0 = Math.max(w.y0, e.y0), y1 = Math.min(w.y1, e.y1);
    var piece = function (x0, ya, x1, yb) { out.push({ x0: x0, y0: ya, x1: x1, y1: yb, kind: w.kind }); };
    if (w.y0 < e.y0) piece(w.x0, w.y0, w.x1, e.y0 - 1);
    if (w.y1 > e.y1) piece(w.x0, e.y1 + 1, w.x1, w.y1);
    if (w.x0 < e.x0) piece(w.x0, y0, e.x0 - 1, y1);
    if (w.x1 > e.x1) piece(e.x1 + 1, y0, w.x1, y1);
    return out;
  }

  /* ---- new tracks ----------------------------------------------------------- */

  /* A plain ring the size asked for, anticlockwise like every track, with the
   * finish, four checkpoints and a grid already in place - drivable before
   * anything is drawn on it, and every edit after that is a change to a
   * working track rather than a race to get one working. */
  function template(opts) {
    var cols = opts.cols, rows = opts.rows;
    var w = clamp(Math.floor((Math.min(cols, rows) - 2) / 3), 4, 9);
    var c = 1 + w / 2, bx = cols - 1 - w / 2, by = rows - 1 - w / 2;
    var f = {
      format: TF.FORMAT, id: opts.id, theme: opts.theme || TF.ADHOC,
      name: opts.name, grade: opts.grade || 'CUSTOM',
      blurb: opts.blurb || 'A track made in the level editor.',
      cols: cols, rows: rows,
      border: 'edge',
      walls: [{ x0: w + 1, y0: w + 1, x1: cols - w - 2, y1: rows - w - 2, kind: 'infield' }],
      route: [{ x: c, y: by }, { x: bx, y: by }, { x: bx, y: c }, { x: c, y: c }],
      startLeg: 0, checkpoints: [], startGrid: []
    };
    if (opts.palette) f.palette = opts.palette;
    if (opts.colors) f.colors = opts.colors;
    if (opts.weather) f.weather = opts.weather;
    f.finish = zoneAcross(f, { x: c + 6, y: by }, { x: 1, y: 0 }, 0.8);
    f.finish.dir = { x: 1, y: 0 };
    f.checkpoints = [
      zoneAcross(f, { x: bx - 6, y: by }, { x: 1, y: 0 }),
      zoneAcross(f, { x: bx, y: (by + c) / 2 }, { x: 0, y: -1 }),
      zoneAcross(f, { x: (bx + c) / 2, y: c }, { x: -1, y: 0 }),
      zoneAcross(f, { x: c, y: (by + c) / 2 }, { x: 0, y: 1 })
    ];
    settle(f, true);
    return f;
  }

  function slug(name) {
    var s = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
    return s || 'track';
  }
  function freeId(name) {
    var ids = takenIds(), base = slug(name), id = base, n = 2;
    while (ids[id]) id = base.slice(0, 20) + '-' + n++;
    return id;
  }

  /* ---- colours ---------------------------------------------------------------- */

  function rgb(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function hex(c) {
    return '#' + c.map(function (v) { return ('0' + Math.round(clamp(v, 0, 255)).toString(16)).slice(-2); }).join('');
  }
  function mix(a, b, t) {
    var x = rgb(a), y = rgb(b);
    return hex([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * t; }));
  }
  function light(h) { var c = rgb(h); return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255 > 0.5; }
  function asHex(v) { return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v || '') ? (v.length === 4 ? hex(rgb(v)) : v) : '#000000'; }

  function paletteOf(f) { return TF.paletteFor(f, palettes()) || {}; }
  function colorOf(f, name) { return paletteOf(f)[name] || C.colors[name]; }

  /* One picker, several colours: each is the base the rest of that surface is
   * worked out from, so a track needs four choices rather than thirteen. */
  var PICKERS = {
    landscape: { label: 'LANDSCAPE', key: 'outer', set: function (v) {
      return { outer: v, outerTop: mix(v, '#ffffff', 0.28), bg: mix(v, '#000000', 0.72) };
    } },
    track: { label: 'TRACK', key: 'road', set: function (v) {
      var lit = light(v);
      return lit ? {
        road: v, roadLine: mix(v, '#000000', 0.08),
        racingLine: 'rgba(28,38,58,0.30)', check: 'rgba(20,60,95,0.08)', checkNext: 'rgba(20,60,95,0.24)'
      } : {
        road: v, roadLine: mix(v, '#ffffff', 0.06),
        racingLine: C.colors.racingLine, check: C.colors.check, checkNext: C.colors.checkNext
      };
    } },
    walls: { label: 'WALLS', key: 'wall', set: function (v) {
      return { wall: v, wallTop: mix(v, '#ffffff', 0.35) };
    } },
    blocks: { label: 'ROAD BLOCKS', key: 'jog', set: function (v) {
      return { jog: v, jogTop: mix(v, '#ffffff', 0.45) };
    } }
  };

  /* ---- changes and history ------------------------------------------------------ */

  function change(fn, grid) {
    var before = JSON.stringify(cur);
    fn(cur);
    if (grid !== undefined) settle(cur, grid);
    if (JSON.stringify(cur) === before) { draw(); return; }
    undoStack.push(before);
    if (undoStack.length > HISTORY) undoStack.shift();
    redoStack = [];
    marks = [];
    persist();
    paintAll();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify(cur));
    cur = JSON.parse(undoStack.pop());
    marks = [];
    persist();
    paintAll();
  }
  function redoIt() {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(cur));
    cur = JSON.parse(redoStack.pop());
    marks = [];
    persist();
    paintAll();
  }

  /* ---- the canvas ------------------------------------------------------------- */

  function resize() {
    if (!el.canvas || !el.stage.clientWidth) return;
    dpr = Math.min(2, global.devicePixelRatio || 1);
    var w = el.stage.clientWidth, h = el.stage.clientHeight;
    el.canvas.style.width = w + 'px';
    el.canvas.style.height = h + 'px';
    el.canvas.width = Math.round(w * dpr);
    el.canvas.height = Math.round(h * dpr);
    draw();
  }

  function fit() {
    if (!cur || !el.stage.clientWidth) return;
    var w = el.stage.clientWidth, h = el.stage.clientHeight, pad = 14;
    view.s = view.fitS = Math.max(2, Math.min((w - pad * 2) / cur.cols, (h - pad * 2) / cur.rows));
    view.x = (w - cur.cols * view.s) / 2;
    view.y = (h - cur.rows * view.s) / 2;
    draw();
  }

  function zoomAt(px, py, factor) {
    var s = clamp(view.s * factor, view.fitS * 0.6, Math.max(view.fitS * 8, 60));
    var wx = (px - view.x) / view.s, wy = (py - view.y) / view.s;
    view.s = s;
    view.x = px - wx * s;
    view.y = py - wy * s;
    draw();
  }

  function local(e) {
    var r = el.canvas.getBoundingClientRect();
    return { px: e.clientX - r.left, py: e.clientY - r.top };
  }
  function toWorld(e) {
    var l = local(e);
    return { x: (l.px - view.x) / view.s, y: (l.py - view.y) / view.s };
  }
  function cellOf(p) {
    return { x: clamp(Math.floor(p.x), 0, cur.cols - 1), y: clamp(Math.floor(p.y), 0, cur.rows - 1) };
  }
  function rectOf(a, b) {
    return { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
  }
  // how near counts as "on it", in cells: a fingertip, whatever the zoom
  function reach(e) { return Math.max(0.55, (e && e.pointerType === 'mouse' ? 9 : 18) / view.s); }

  var KIND_LOOK = {
    edge: function (f) { return [colorOf(f, 'outer'), colorOf(f, 'outerTop')]; },
    infield: function (f) { return [colorOf(f, 'wall'), colorOf(f, 'wallTop')]; },
    jog: function (f) { return [colorOf(f, 'jog'), colorOf(f, 'jogTop')]; },
    lava: function () { return ['#7a2208', '#ff7a2a']; },
    void: function (f) { return [colorOf(f, 'bg'), 'rgba(160,190,255,0.5)']; }
  };

  function draw() {
    if (!el.canvas || !cur || Editor.screen !== 'work') return;
    var g = el.canvas.getContext('2d');
    var W = el.canvas.width / dpr, H = el.canvas.height / dpr, s = view.s;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = colorOf(cur, 'bg');
    g.fillRect(0, 0, W, H);
    g.save();
    g.translate(view.x, view.y);

    // road, and the cells on it
    g.fillStyle = colorOf(cur, 'road');
    g.fillRect(0, 0, cur.cols * s, cur.rows * s);
    if (s >= 6) {
      g.lineWidth = 1;
      for (var gx = 0; gx <= cur.cols; gx++) {
        g.strokeStyle = gx % 5 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)';
        g.beginPath(); g.moveTo(gx * s + 0.5, 0); g.lineTo(gx * s + 0.5, cur.rows * s); g.stroke();
      }
      for (var gy = 0; gy <= cur.rows; gy++) {
        g.strokeStyle = gy % 5 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)';
        g.beginPath(); g.moveTo(0, gy * s + 0.5); g.lineTo(cur.cols * s, gy * s + 0.5); g.stroke();
      }
    }

    // solids
    var walls = TF.border(cur.cols, cur.rows, cur.border).concat(cur.walls);
    walls.forEach(function (w) {
      var look = (KIND_LOOK[w.kind] || KIND_LOOK.infield)(cur);
      g.fillStyle = look[0];
      g.fillRect(w.x0 * s, w.y0 * s, (w.x1 - w.x0 + 1) * s, (w.y1 - w.y0 + 1) * s);
    });
    walls.forEach(function (w) {
      var look = (KIND_LOOK[w.kind] || KIND_LOOK.infield)(cur);
      g.strokeStyle = look[1];
      g.lineWidth = Math.max(1, s * 0.08);
      if (w.kind === 'void') g.setLineDash([Math.max(2, s * 0.3), Math.max(2, s * 0.2)]);
      g.strokeRect(w.x0 * s + 1, w.y0 * s + 1, (w.x1 - w.x0 + 1) * s - 2, (w.y1 - w.y0 + 1) * s - 2);
      g.setLineDash([]);
    });

    // checkpoints, numbered in lap order
    cur.checkpoints.forEach(function (z, i) {
      g.fillStyle = 'rgba(94,242,255,0.16)';
      g.strokeStyle = 'rgba(94,242,255,0.75)';
      g.lineWidth = 1.5;
      g.fillRect(z.x0 * s, z.y0 * s, (z.x1 - z.x0) * s, (z.y1 - z.y0) * s);
      g.strokeRect(z.x0 * s, z.y0 * s, (z.x1 - z.x0) * s, (z.y1 - z.y0) * s);
      label(g, String(i + 1), mid(z).x * s, mid(z).y * s, '#5ef2ff');
    });

    // the finish line, chequered, with the way it is crossed
    if (cur.finish) {
      var f = cur.finish, q = Math.max(3, s * 0.4);
      g.save();
      g.beginPath();
      g.rect(f.x0 * s, f.y0 * s, (f.x1 - f.x0) * s, (f.y1 - f.y0) * s);
      g.clip();
      for (var yy = f.y0 * s, r = 0; yy < f.y1 * s; yy += q, r++) {
        for (var xx = f.x0 * s, k = 0; xx < f.x1 * s; xx += q, k++) {
          g.fillStyle = (r + k) % 2 ? '#111' : '#f4f6ff';
          g.fillRect(xx, yy, q, q);
        }
      }
      g.restore();
      var fm = mid(f);
      arrow(g, fm.x * s, fm.y * s, f.dir, Math.max(10, s * 1.2), '#f4f6ff');
    }

    // the racing line
    var R = redraw ? redraw.pts : cur.route;
    if (R.length) {
      g.strokeStyle = '#ffd84a';
      g.lineWidth = Math.max(2, s * 0.14);
      g.lineJoin = 'round';
      g.beginPath();
      R.forEach(function (p, i) { if (i) g.lineTo(p.x * s, p.y * s); else g.moveTo(p.x * s, p.y * s); });
      if (!redraw) g.closePath();
      g.stroke();
      if (!redraw) legsOf(R).forEach(function (L, i) {
        if (L.len < 2) return;
        // a third of the way along, clear of a checkpoint's number mid-leg
        var m = { x: L.a.x + (L.b.x - L.a.x) * 0.3, y: L.a.y + (L.b.y - L.a.y) * 0.3 };
        arrow(g, m.x * s, m.y * s, L.dir, Math.max(8, s * 0.8), i === cur.startLeg ? '#fff4b8' : '#ffd84a');
      });
      R.forEach(function (p, i) {
        g.fillStyle = redraw && i === 0 ? '#ffffff' : '#ffd84a';
        g.beginPath();
        g.arc(p.x * s, p.y * s, Math.max(3.5, s * 0.22), 0, Math.PI * 2);
        g.fill();
      });
    }

    // the grid
    if (!redraw && cur.startGrid && cur.route.length >= 2) {
      var sd = legsOf(cur.route)[cur.startLeg] ? legsOf(cur.route)[cur.startLeg].dir : { x: 1, y: 0 };
      cur.startGrid.forEach(function (p) {
        var hx = (sd.x ? C.carLength : C.carWidth) / 2 * s, hy = (sd.x ? C.carWidth : C.carLength) / 2 * s;
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.fillRect(p.x * s - hx, p.y * s - hy, hx * 2, hy * 2);
      });
    }

    // what the pointer is doing
    if (op && op.rect) {
      var o = op.rect;
      var cp = op.kind === 'checkpoint';
      g.fillStyle = op.kind === 'erase' ? 'rgba(255,80,80,0.25)'
        : cp ? 'rgba(94,242,255,0.25)' : (KIND_LOOK[Editor.kind] || KIND_LOOK.infield)(cur)[0];
      g.globalAlpha = op.kind === 'wall' ? 0.8 : 1;
      g.fillRect(o.x0 * s, o.y0 * s, (o.x1 - o.x0 + 1) * s, (o.y1 - o.y0 + 1) * s);
      g.globalAlpha = 1;
      g.setLineDash([4, 3]);
      g.strokeStyle = op.kind === 'erase' ? '#ff6b6b' : '#ffffff';
      g.lineWidth = 1.5;
      g.strokeRect(o.x0 * s, o.y0 * s, (o.x1 - o.x0 + 1) * s, (o.y1 - o.y0 + 1) * s);
      g.setLineDash([]);
    }
    if (hover && !op) {
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = 1;
      g.strokeRect(hover.x * s + 0.5, hover.y * s + 0.5, s - 1, s - 1);
    }

    // where the CHECK found trouble
    marks.forEach(function (m) {
      var r0 = Math.max(4, s * 0.35);
      g.strokeStyle = '#ff4d5e';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(m.x * s - r0, m.y * s - r0); g.lineTo(m.x * s + r0, m.y * s + r0);
      g.moveTo(m.x * s + r0, m.y * s - r0); g.lineTo(m.x * s - r0, m.y * s + r0);
      g.stroke();
    });
    g.restore();
  }

  function label(g, text, x, y, color) {
    g.font = 'bold ' + Math.max(10, Math.min(18, view.s * 0.9)) + 'px ui-monospace, Menlo, Consolas, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(0,0,0,0.7)';
    g.strokeText(text, x, y);
    g.fillStyle = color;
    g.fillText(text, x, y);
  }

  function arrow(g, x, y, d, size, color) {
    var a = Math.atan2(d.y, d.x);
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.fillStyle = color;
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(size * 0.5, 0);
    g.lineTo(-size * 0.35, -size * 0.35);
    g.lineTo(-size * 0.35, size * 0.35);
    g.closePath();
    g.stroke();
    g.fill();
    g.restore();
  }

  /* ---- the tools ---------------------------------------------------------------- */

  var TIPS = {
    wall: 'Drag to draw a block of wall. Pick what it is below the tools.',
    erase: 'Drag across walls to clear them back to road.',
    route: 'Drag a corner or a straight of the yellow racing line to move it. REDRAW LINE starts it again.',
    checkpoint: 'Tap the road to put a checkpoint across it. Tap one to remove it. They number themselves in lap order.',
    finish: 'Tap the road to move the finish line there. The grid forms up behind it.'
  };

  function hitRoute(p, e) {
    var R = cur.route, r = reach(e), best = null;
    R.forEach(function (q, i) {
      var d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d <= r && (!best || d < best.d)) best = { point: i, d: d };
    });
    if (best) return best;
    var leg = nearestLeg(R, p);
    return leg && leg.d <= r ? { leg: leg.i, d: leg.d } : null;
  }

  function onDown(e) {
    if (!cur) return;
    pointers[e.pointerId] = local(e);
    // Keep a drag that leaves the map. WebKit throws for a pointer it does
    // not think is down, which must not cost the drawing.
    try { el.canvas.setPointerCapture(e.pointerId); } catch (err) { /* drawn anyway */ }
    var ids = Object.keys(pointers);
    if (ids.length === 2) {
      // a second finger: whatever the first one started is not a drawing
      if (op && op.before) { cur = JSON.parse(op.before); }
      op = null;
      var a = pointers[ids[0]], b = pointers[ids[1]];
      pinch = { d: Math.hypot(a.px - b.px, a.py - b.py) || 1, mx: (a.px + b.px) / 2, my: (a.py + b.py) / 2,
                s: view.s, x: view.x, y: view.y };
      draw();
      return;
    }
    if (ids.length > 2) return;
    e.preventDefault();
    var p = toWorld(e), c = cellOf(p), t = Editor.tool;
    if (redraw) { op = { kind: 'redraw', start: p }; return; }
    if (e.button === 1 || (e.pointerType === 'mouse' && (e.button === 2 || e.altKey))) {
      op = { kind: 'pan', px: local(e).px, py: local(e).py, x: view.x, y: view.y };
      return;
    }
    if (t === 'wall' || t === 'erase') {
      op = { kind: t, a: c, rect: rectOf(c, c) };
    } else if (t === 'checkpoint') {
      op = { kind: 'checkpoint', a: c, p: p, rect: null };
    } else if (t === 'finish') {
      op = { kind: 'finish', p: p };
    } else if (t === 'route') {
      var hit = hitRoute(p, e);
      if (hit) op = { kind: 'route', hit: hit, from: p, before: JSON.stringify(cur), base: clone(cur.route) };
      else op = { kind: 'pan', px: local(e).px, py: local(e).py, x: view.x, y: view.y };
    }
    draw();
  }

  function onMove(e) {
    if (!cur) return;
    if (pointers[e.pointerId]) pointers[e.pointerId] = local(e);
    if (pinch) {
      var ids = Object.keys(pointers);
      if (ids.length < 2) return;
      var a = pointers[ids[0]], b = pointers[ids[1]];
      var d = Math.hypot(a.px - b.px, a.py - b.py) || 1;
      var mx = (a.px + b.px) / 2, my = (a.py + b.py) / 2;
      var s = clamp(pinch.s * d / pinch.d, view.fitS * 0.6, Math.max(view.fitS * 8, 60));
      var wx = (pinch.mx - pinch.x) / pinch.s, wy = (pinch.my - pinch.y) / pinch.s;
      view.s = s;
      view.x = mx - wx * s;
      view.y = my - wy * s;
      draw();
      return;
    }
    var p = toWorld(e);
    if (!op) {
      if (e.pointerType === 'mouse') {
        var h = p.x >= 0 && p.y >= 0 && p.x < cur.cols && p.y < cur.rows ? cellOf(p) : null;
        if (!same(h, hover)) { hover = h; paintCoords(h); draw(); }
      }
      return;
    }
    if (op.kind === 'pan') {
      var l = local(e);
      view.x = op.x + l.px - op.px;
      view.y = op.y + l.py - op.py;
      draw();
    } else if (op.kind === 'wall' || op.kind === 'erase') {
      op.rect = rectOf(op.a, cellOf(p));
      paintCoords(cellOf(p));
      draw();
    } else if (op.kind === 'checkpoint') {
      var c = cellOf(p);
      if (op.rect || c.x !== op.a.x || c.y !== op.a.y) op.rect = rectOf(op.a, c);
      draw();
    } else if (op.kind === 'route') {
      dragRoute(p);
      draw();
    }
  }

  function dragRoute(p) {
    var dx = snap(p.x - op.from.x, 0.5), dy = snap(p.y - op.from.y, 0.5);
    var R = clone(op.base), n = R.length;
    var shift = function (i, along) {
      // move point i, and whichever neighbour shares the moved coordinate
      var q = R[i];
      [(i - 1 + n) % n, (i + 1) % n].forEach(function (j) {
        var o = op.base[j], b = op.base[i];
        if (o.y === b.y && along.y) R[j].y = o.y + along.y;   // a horizontal leg moves up or down
        if (o.x === b.x && along.x) R[j].x = o.x + along.x;   // a vertical one left or right
      });
      q.x = op.base[i].x + along.x;
      q.y = op.base[i].y + along.y;
    };
    if (op.hit.point !== undefined) {
      shift(op.hit.point, { x: dx, y: dy });
    } else {
      var i = op.hit.leg, j = (i + 1) % n;
      var horiz = op.base[i].y === op.base[j].y;
      var m = horiz ? { x: 0, y: dy } : { x: dx, y: 0 };
      shift(i, m);
      shift(j, m);
    }
    // keep the line off the border
    R.forEach(function (q) { q.x = clamp(q.x, 1.5, cur.cols - 1.5); q.y = clamp(q.y, 1.5, cur.rows - 1.5); });
    cur.route = R;
  }

  function onUp(e) {
    delete pointers[e.pointerId];
    if (pinch) {
      if (!Object.keys(pointers).length) pinch = null;
      return;
    }
    if (!op || !cur) return;
    var o = op, p = toWorld(e);
    op = null;
    if (o.kind === 'pan') { draw(); return; }
    if (o.kind === 'redraw') { addRedrawPoint(o.start); return; }
    if (o.kind === 'wall') {
      var r = o.rect;
      change(function (f) {
        f.walls.push({ x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, kind: Editor.kind });
      });
    } else if (o.kind === 'erase') {
      change(function (f) {
        var out = [];
        f.walls.forEach(function (w) { out = out.concat(subtract(w, o.rect)); });
        f.walls = out;
      });
    } else if (o.kind === 'checkpoint') {
      if (o.rect) {
        var z = { x0: o.rect.x0, y0: o.rect.y0, x1: o.rect.x1 + 1, y1: o.rect.y1 + 1 };
        change(function (f) { f.checkpoints.push(z); }, false);
        return;
      }
      var at = -1;
      cur.checkpoints.forEach(function (q, i) { if (inZone(q, o.p.x, o.p.y)) at = i; });
      if (at >= 0) { change(function (f) { f.checkpoints.splice(at, 1); }, false); return; }
      var leg = nearestLeg(cur.route, o.p);
      var zz = leg && zoneAcross(cur, o.p, leg.dir);
      if (!zz) { tip('Tap on the road, not a wall.'); return; }
      change(function (f) { f.checkpoints.push(zz); }, false);
    } else if (o.kind === 'finish') {
      var lg = nearestLeg(cur.route, o.p);
      var fz = lg && zoneAcross(cur, o.p, lg.dir, 0.8);
      if (!fz) { tip('Tap on the road, not a wall.'); return; }
      fz.dir = { x: lg.dir.x, y: lg.dir.y };
      change(function (f) { f.finish = fz; f.startLeg = lg.i; }, true);
    } else if (o.kind === 'route') {
      var moved = cur.route;
      cur = JSON.parse(o.before);
      if (same(moved, cur.route)) { draw(); return; }
      change(function (f) { f.route = tidyRoute(moved); }, true);
    }
    void p;
  }

  /* Drawing the line afresh: each tap is the next corner, squared up to the
   * one before it along whichever way it is further; a tap back on the
   * first corner closes the loop. */
  function addRedrawPoint(p) {
    var pts = redraw.pts;
    var q = { x: clamp(snap(p.x, 0.5), 1.5, cur.cols - 1.5), y: clamp(snap(p.y, 0.5), 1.5, cur.rows - 1.5) };
    if (pts.length) {
      var last = pts[pts.length - 1];
      if (Math.abs(q.x - last.x) >= Math.abs(q.y - last.y)) q.y = last.y; else q.x = last.x;
      if (q.x === last.x && q.y === last.y) return;
      var first = pts[0];
      if (pts.length >= 3 && Math.hypot(p.x - first.x, p.y - first.y) <= Math.max(1, reach())) {
        finishRedraw();
        return;
      }
    }
    pts.push(q);
    tip(pts.length < 3 ? 'Tap the next corner.' : 'Tap the next corner, or the white one to close the loop.');
    draw();
  }

  function finishRedraw() {
    var pts = redraw.pts.slice(), first = pts[0], last = pts[pts.length - 1];
    // square the closing leg off with one more corner if it needs one
    if (last.x !== first.x && last.y !== first.y) {
      var prev = pts[pts.length - 2];
      pts.push(prev.y === last.y ? { x: last.x, y: first.y } : { x: first.x, y: last.y });
    }
    pts = tidyRoute(pts);
    redraw = null;
    paintTools();
    if (pts.length < 4) { tip('A loop needs at least four corners - try again.'); draw(); return; }
    change(function (f) {
      f.route = pts;
      // the finish goes on the longest straight if it is not on the new line
      var hit = f.finish && nearestLeg(pts, mid(f.finish), f.finish.dir);
      if (!hit || hit.d > 0.75) {
        var legs = legsOf(pts), best = 0;
        legs.forEach(function (L, i) { if (L.len > legs[best].len) best = i; });
        var L = legs[best];
        var at = { x: L.a.x + L.dir.x * L.len * 0.4, y: L.a.y + L.dir.y * L.len * 0.4 };
        var fz = zoneAcross(f, at, L.dir, 0.8);
        if (fz) { fz.dir = { x: L.dir.x, y: L.dir.y }; f.finish = fz; f.startLeg = best; }
      }
    }, true);
    tip('New racing line in. Put the checkpoints across it, then CHECK.');
  }

  /* ---- the screen ---------------------------------------------------------------- */

  function tip(text) { if (el.tip) el.tip.textContent = text || TIPS[Editor.tool] || ''; }
  function paintCoords(c) {
    if (el.coords) el.coords.textContent = c ? 'x ' + c.x + '  y ' + c.y : '';
  }

  function paintTools() {
    Array.prototype.forEach.call(el.tools.querySelectorAll('[data-tool]'), function (b) {
      b.classList.toggle('on', b.dataset.tool === Editor.tool && !redraw);
    });
    Array.prototype.forEach.call(el.kinds.querySelectorAll('[data-kind]'), function (b) {
      b.classList.toggle('on', b.dataset.kind === Editor.kind);
    });
    el.kinds.hidden = Editor.tool !== 'wall' || !!redraw;
    el.routeRow.hidden = Editor.tool !== 'route' && !redraw;
    el.redraw.textContent = redraw ? 'CANCEL REDRAW' : 'REDRAW LINE';
    el.undo.disabled = !undoStack.length;
    el.redo.disabled = !redoStack.length;
    if (!redraw) tip();
  }

  function paintStatus() {
    if (!cur) return;
    var live = liveFile(cur.id);
    var changed = !sameFile(live, cur);
    el.name.textContent = cur.name;
    el.path.textContent = TF.path(cur);
    el.state.textContent = !live ? 'NEW - not in the game yet'
      : changed ? 'CHANGED - the game still has the uploaded version' : 'SAME AS THE GAME';
    el.state.className = 'ed-state' + (changed ? ' changed' : '');
    el.revert.hidden = !drafts[cur.id];
    el.revert.textContent = live ? 'DISCARD CHANGES' : 'DELETE THIS DRAFT';
    el.storage.hidden = storageOk;
  }

  function paintTabs() {
    Array.prototype.forEach.call(el.tabs.children, function (b) {
      b.classList.toggle('on', b.dataset.tab === Editor.tab);
    });
    Array.prototype.forEach.call(el.panes.children, function (p) {
      p.hidden = p.dataset.pane !== Editor.tab;
    });
  }

  function paintDetails() {
    var f = cur;
    el.fName.value = f.name;
    el.fGrade.value = f.grade;
    el.fBlurb.value = f.blurb;
    el.fCols.value = f.cols;
    el.fRows.value = f.rows;
    el.fPace.value = f.aiPace === undefined ? 1 : f.aiPace;
    el.fPaceOut.textContent = (+el.fPace.value).toFixed(2);
    el.fWeather.value = f.weather || '';
    el.tutorialNote.hidden = !f.tutorial;
  }

  function paintColours() {
    var f = cur, themed = f.theme !== TF.ADHOC;
    el.themedNote.hidden = !themed;
    el.adhocColours.hidden = themed;
    if (themed) {
      var th = themes().filter(function (t) { return t.id === f.theme; })[0];
      el.themedName.textContent = th ? th.name : f.theme.toUpperCase();
    } else {
      el.fPalette.value = f.palette || '';
      Object.keys(PICKERS).forEach(function (k) {
        el['pick_' + k].value = asHex(colorOf(f, PICKERS[k].key));
      });
    }
    el.swatches.innerHTML = ['bg', 'outer', 'road', 'wall', 'jog'].map(function (k) {
      return '<span style="background:' + esc(colorOf(f, k)) + '"></span>';
    }).join('');
    var tint = C.roadTints && C.roadTints[C.roadTint];
    el.tintNote.hidden = !(tint && tint.colors);
    if (tint) el.tintName.textContent = tint.name;
  }

  function paintExport() {
    var R = C.editor || {};
    var folder = 'tracks/' + cur.theme;
    var base = 'https://github.com/' + R.repo;
    el.xPath.textContent = TF.path(cur);
    el.xFolder.textContent = folder + '/';
    el.xUpload.href = base + '/upload/' + R.branch + '/' + folder;
    el.xActions.href = base + '/actions';
    var live = liveFile(cur.id);
    el.xEditRow.hidden = !live;
    el.xEdit.href = base + '/edit/' + R.branch + '/' + TF.path(cur);
    el.xFile.textContent = cur.id + '.json';
    el.xReplace.hidden = !live;
  }

  function paintAll() {
    paintStatus();
    paintTools();
    paintDetails();
    paintColours();
    paintExport();
    draw();
  }

  /* ---- the library ------------------------------------------------------------ */

  function row(id, file, extra) {
    var live = liveFile(id), d = drafts[id];
    var shown = d || file || live;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ed-track' + (d ? ' drafted' : '') + (!live ? ' new' : '');
    var tag = !live ? (d ? 'NEW' : 'EMPTY SLOT') : d ? 'CHANGED' : '';
    b.innerHTML = '<b>' + esc(shown ? shown.name : extra.name) + '</b>' +
      '<span>' + esc(shown ? shown.grade : extra.grade) + '</span>' +
      (tag ? '<em>' + tag + '</em>' : '');
    b.addEventListener('click', function () { open(id, extra && extra.theme); });
    return b;
  }

  function paintLibrary() {
    loadDrafts();
    var host = el.groups;
    host.innerHTML = '';
    var group = function (title, sub, rows) {
      var g = document.createElement('section');
      g.className = 'ed-group';
      g.innerHTML = '<h3>' + esc(title) + (sub ? ' <small>' + esc(sub) + '</small>' : '') + '</h3>';
      var list = document.createElement('div');
      list.className = 'ed-list';
      rows.forEach(function (r) { list.appendChild(r); });
      g.appendChild(list);
      host.appendChild(g);
    };
    themes().forEach(function (th) {
      group(th.name, 'tracks/' + th.id, th.tracks.map(function (e) {
        return row(e.id, liveFile(e.id), { name: e.name, grade: e.grade, theme: th.id });
      }));
    });
    var adhoc = (global.TRACK_FILES || []).filter(function (f) { return f.theme === TF.ADHOC; })
      .map(function (f) { return f.id; });
    Object.keys(drafts).forEach(function (id) {
      if (drafts[id].theme === TF.ADHOC && adhoc.indexOf(id) < 0) adhoc.push(id);
    });
    group('ADHOC', 'tracks/adhoc', adhoc.map(function (id) { return row(id, liveFile(id), { theme: TF.ADHOC }); }));
  }

  /* ---- opening, creating, importing ----------------------------------------------- */

  function open(id, themeId) {
    loadDrafts();
    var f = drafts[id] || liveFile(id);
    if (!f) {
      // a theme's slot with no file behind it: start one
      var slot = slotOf(id);
      if (!slot) return;
      f = template({ id: id, theme: slot.theme.id, name: slot.entry.name, grade: slot.entry.grade,
                     cols: 40, rows: 28 });
    }
    void themeId;
    cur = clone(f);
    undoStack = [];
    redoStack = [];
    marks = [];
    redraw = null;
    el.results.innerHTML = '';
    el.results.className = 'ed-results';
    show('work');
  }

  function show(which) {
    Editor.screen = which;
    el.library.hidden = which !== 'library';
    el.work.hidden = which !== 'work';
    el.screen.classList.toggle('working', which === 'work');
    if (which === 'library') {
      paintLibrary();
      el.newForm.hidden = true;
    } else {
      paintTabs();
      paintAll();
      resize();
      fit();
    }
  }

  function createNew() {
    var name = (el.nName.value || '').trim().toUpperCase().slice(0, TF.LIMITS.name);
    if (!name) { el.nName.focus(); return; }
    var size = el.nSize.value.split('x').map(Number);
    var preset = el.nPalette.value;
    var id = freeId(name);
    var f = template({ id: id, name: name, cols: size[0], rows: size[1],
                       palette: preset || undefined,
                       weather: preset && global.TRACK_FILES ? presetWeather(preset) : undefined });
    drafts[id] = f;
    saveDrafts();
    el.nName.value = '';
    open(id);
  }

  function presetWeather(themeId) {
    var f = (global.TRACK_FILES || []).filter(function (t) { return t.theme === themeId && t.weather; })[0];
    return f ? f.weather : undefined;
  }

  function importText(text) {
    var f;
    try {
      f = JSON.parse(String(text).replace(/^﻿/, ''));
    } catch (e) {
      alert('That is not a track file: it is not valid JSON.\n\n' + e.message);
      return;
    }
    var errs = TF.check(f, { themes: themes(), palettes: palettes() });
    if (errs.length) {
      alert('That file cannot be opened as a track:\n\n- ' + errs.slice(0, 8).join('\n- ') +
            (errs.length > 8 ? '\n- ...and ' + (errs.length - 8) + ' more' : ''));
      return;
    }
    loadDrafts();
    var live = liveFile(f.id);
    if (drafts[f.id] && !sameFile(drafts[f.id], f) &&
        !confirm('You already have unsent changes to ' + f.name + ' on this device. Replace them with this file?')) return;
    if (sameFile(live, f)) delete drafts[f.id]; else drafts[f.id] = f;
    saveDrafts();
    open(f.id);
  }

  /* ---- CHECK --------------------------------------------------------------------- */

  function runCheck() {
    var out = [], ok = true;
    var errs = TF.check(cur, { themes: themes(), palettes: palettes() });
    marks = [];
    if (errs.length) {
      ok = false;
      out.push('<p class="bad"><b>The game could not load this file.</b> Fix these first:</p><ul>' +
        errs.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>');
    } else {
      var T = global.TRACK, keep = T.index, r;
      try {
        T.load(TF.toTrack(clone(cur), palettes()));
        r = global.TrackCheck.run();
      } finally {
        T.load(keep >= 0 ? keep : (global.Game ? global.Game.trackIndex : 0));
      }
      if (r.problems) {
        ok = false;
        out.push('<p class="bad"><b>' + r.problems + ' driving problem' + (r.problems > 1 ? 's' : '') +
          '.</b> The file will still load, but a car - yours or the AI’s - will crash or miss a lap ' +
          'where these say. Red crosses on the map show where.</p>');
      } else {
        out.push('<p class="good"><b>Ready.</b> A car can drive every line, every corner and every ' +
          'checkpoint. ' + esc(r.summary) + '.</p>');
      }
      r.sections.forEach(function (sec) {
        out.push('<div class="ed-sec"><span class="' + (sec.problems.length ? 'bad' : 'good') + '">' +
          (sec.problems.length ? '✕' : '✓') + '</span> ' + esc(sec.name.replace(/:$/, '')) +
          (sec.problems.length ? '<ul>' + sec.problems.slice(0, 12).map(function (m) {
            return '<li>' + esc(m) + '</li>';
          }).join('') + (sec.problems.length > 12 ? '<li>...and ' + (sec.problems.length - 12) + ' more</li>' : '') +
          '</ul>' : '') + '</div>');
        // one cross per cell, however many lines are stopped in it
        sec.problems.forEach(function (m) {
          var at = /\((-?[\d.]+), (-?[\d.]+)\)/.exec(m);
          if (!at) return;
          var x = Math.floor(+at[1]) + 0.5, y = Math.floor(+at[2]) + 0.5;
          if (!marks.some(function (q) { return q.x === x && q.y === y; })) marks.push({ x: x, y: y });
        });
      });
    }
    el.results.innerHTML = out.join('');
    el.results.className = 'ed-results ' + (ok ? 'ok' : 'not');
    draw();
    return errs.length === 0;
  }

  /* ---- getting the file out ---------------------------------------------------------- */

  function shapeOk() {
    var errs = TF.check(cur, { themes: themes(), palettes: palettes() });
    if (!errs.length) return true;
    Editor.tab = 'check';
    paintTabs();
    runCheck();
    return false;
  }

  function fileName() { return cur.id + '.json'; }
  function fileText() { return TF.stringify(cur); }

  function download() {
    if (!shapeOk()) return;
    var blob = new Blob([fileText()], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName();
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    say('Saved ' + fileName() + ' - look in your Downloads (on iPad: the Files app, Downloads).');
  }

  function mailBody() {
    return 'A Block Racer track: ' + cur.name + ' (' + fileName() + ').\n\n' +
      'To put it in the game, upload the file to ' + 'tracks/' + cur.theme + '/ in ' +
      (C.editor && C.editor.repo) + ' on GitHub (branch ' + (C.editor && C.editor.branch) + ').';
  }

  function share() {
    if (!shapeOk()) return;
    var file = null;
    try { file = new File([fileText()], fileName(), { type: 'application/json' }); } catch (e) { file = null; }
    var data = file && { files: [file], title: fileName(), text: mailBody() };
    if (data && navigator.canShare && navigator.canShare(data)) {
      navigator.share(data).then(function () {
        say('Shared.');
      }, function (err) {
        if (err && err.name !== 'AbortError') emailFallback();
      });
      return;
    }
    emailFallback();
  }

  /* No browser can attach a file to an email by itself, and this one cannot
   * share files either - so the file goes to Downloads and the email opens
   * with the name of the file to attach. */
  function emailFallback() {
    download();
    var href = 'mailto:?subject=' + encodeURIComponent('Block Racer track: ' + cur.name) +
      '&body=' + encodeURIComponent(mailBody() + '\n\n(Attach ' + fileName() + ' from your Downloads.)');
    setTimeout(function () { global.location.href = href; }, 400);
    say('Saved ' + fileName() + ' to Downloads and opened an email - attach the file to it.');
  }

  function copyText() {
    if (!shapeOk()) return;
    var text = fileText();
    var done = function () { say('Copied. On GitHub, open the file, press the pencil, select all and paste.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text) ? done() : say('Could not copy.'); });
    } else if (legacyCopy(text)) done();
    else say('Could not copy.');
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  function say(text) {
    el.said.textContent = text;
    el.said.hidden = !text;
  }

  /* ---- driving it ------------------------------------------------------------------ */

  function testDrive(race) {
    if (!shapeOk()) return;
    var t = TF.toTrack(clone(cur), palettes());
    t.id = TEST_ID;
    global.Game.startTest(t, race);
  }

  /* ---- wiring --------------------------------------------------------------------- */

  function field(input, fn) {
    input.addEventListener('change', function () { if (cur) fn(input.value); });
  }

  Editor.init = function () {
    el.screen = $('screen-editor');
    if (!el.screen) return;
    ['library', 'work', 'groups', 'canvas', 'stage', 'tip', 'coords', 'tools', 'kinds', 'routeRow',
     'redraw', 'undo', 'redo', 'name', 'path', 'state', 'revert', 'storage', 'tabs', 'panes', 'results',
     'fName', 'fGrade', 'fBlurb', 'fCols', 'fRows', 'fPace', 'fPaceOut', 'fWeather', 'tutorialNote',
     'themedNote', 'themedName', 'adhocColours', 'fPalette', 'swatches', 'tintNote', 'tintName',
     'xPath', 'xFolder', 'xUpload', 'xActions', 'xEditRow', 'xEdit', 'xFile', 'xReplace', 'said',
     'newForm', 'nName', 'nSize', 'nPalette', 'file'].forEach(function (k) {
      el[k] = $('ed-' + k.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }));
    });
    Object.keys(PICKERS).forEach(function (k) { el['pick_' + k] = $('ed-pick-' + k); });

    // the lists that are built from data rather than typed into the page
    var presetOptions = '<option value="">GAME DEFAULT</option>' + themes().map(function (th) {
      return '<option value="' + th.id + '">' + esc(th.name) + '</option>';
    }).join('');
    el.fPalette.innerHTML = presetOptions;
    el.nPalette.innerHTML = presetOptions;
    el.fWeather.innerHTML = '<option value="">NONE</option>' + TF.WEATHER.map(function (w) {
      return '<option value="' + w + '">' + w.toUpperCase() + '</option>';
    }).join('');

    $('ed-back').addEventListener('click', function () {
      if (redraw) { redraw = null; paintTools(); draw(); return; }
      if (Editor.screen === 'work') show('library');
      else global.Screens.show('options');
    });
    $('ed-new').addEventListener('click', function () {
      el.newForm.hidden = !el.newForm.hidden;
      if (!el.newForm.hidden) el.nName.focus();
    });
    $('ed-create').addEventListener('click', createNew);
    el.nName.addEventListener('keydown', function (e) { if (e.key === 'Enter') createNew(); });
    $('ed-import').addEventListener('click', function () { el.file.value = ''; el.file.click(); });
    el.file.addEventListener('change', function () {
      var file = el.file.files && el.file.files[0];
      if (!file) return;
      var r = new FileReader();
      r.onload = function () { importText(r.result); };
      r.readAsText(file);
    });

    Array.prototype.forEach.call(el.tools.querySelectorAll('[data-tool]'), function (b) {
      b.addEventListener('click', function () {
        if (redraw) return;
        Editor.tool = b.dataset.tool;
        paintTools();
      });
    });
    Array.prototype.forEach.call(el.kinds.querySelectorAll('[data-kind]'), function (b) {
      b.addEventListener('click', function () { Editor.kind = b.dataset.kind; paintTools(); });
    });
    el.undo.addEventListener('click', undo);
    el.redo.addEventListener('click', redoIt);
    el.redraw.addEventListener('click', function () {
      redraw = redraw ? null : { pts: [] };
      paintTools();
      if (redraw) tip('Tap the first corner of the new racing line.');
      draw();
    });
    $('ed-reverse').addEventListener('click', function () {
      change(function (f) {
        f.route = f.route.slice().reverse();
        if (f.finish) f.finish.dir = { x: -f.finish.dir.x || 0, y: -f.finish.dir.y || 0 };
      }, true);
    });
    $('ed-zoom-in').addEventListener('click', function () { zoomAt(el.stage.clientWidth / 2, el.stage.clientHeight / 2, 1.3); });
    $('ed-zoom-out').addEventListener('click', function () { zoomAt(el.stage.clientWidth / 2, el.stage.clientHeight / 2, 1 / 1.3); });
    $('ed-zoom-fit').addEventListener('click', fit);

    Array.prototype.forEach.call(el.tabs.children, function (b) {
      b.addEventListener('click', function () {
        Editor.tab = b.dataset.tab;
        paintTabs();
        if (Editor.tab === 'check') runCheck();
        if (Editor.tab === 'export') say('');
      });
    });

    field(el.fName, function (v) {
      v = v.trim().toUpperCase().slice(0, TF.LIMITS.name);
      if (v) change(function (f) { f.name = v; }); else paintDetails();
    });
    field(el.fGrade, function (v) {
      v = v.trim().toUpperCase().slice(0, TF.LIMITS.grade);
      if (v) change(function (f) { f.grade = v; }); else paintDetails();
    });
    field(el.fBlurb, function (v) {
      v = v.trim().slice(0, TF.LIMITS.blurb);
      if (v) change(function (f) { f.blurb = v; }); else paintDetails();
    });
    var sizeTo = function () {
      var cols = clamp(parseInt(el.fCols.value, 10) || cur.cols, TF.LIMITS.minCols, TF.LIMITS.maxCols);
      var rows = clamp(parseInt(el.fRows.value, 10) || cur.rows, TF.LIMITS.minRows, TF.LIMITS.maxRows);
      var off = cur.route.some(function (p) { return p.x >= cols - 1.5 || p.y >= rows - 1.5; });
      if (off) {
        alert('The racing line runs outside ' + cols + ' x ' + rows + '. Move it in first.');
        paintDetails();
        return;
      }
      change(function (f) {
        f.cols = cols;
        f.rows = rows;
        f.walls = f.walls.map(function (w) {
          return { x0: w.x0, y0: w.y0, x1: Math.min(w.x1, cols - 1), y1: Math.min(w.y1, rows - 1), kind: w.kind };
        }).filter(function (w) { return w.x0 <= w.x1 && w.y0 <= w.y1; });
        var clip = function (z) {
          z.x1 = Math.min(z.x1, cols); z.y1 = Math.min(z.y1, rows);
          return z.x0 < z.x1 && z.y0 < z.y1;
        };
        f.checkpoints = f.checkpoints.filter(clip);
        if (f.finish) clip(f.finish);
      }, true);
      fit();
    };
    field(el.fCols, sizeTo);
    field(el.fRows, sizeTo);
    el.fPace.addEventListener('input', function () { el.fPaceOut.textContent = (+el.fPace.value).toFixed(2); });
    field(el.fPace, function (v) { change(function (f) { f.aiPace = Math.round(parseFloat(v) * 100) / 100; }); });
    field(el.fWeather, function (v) {
      change(function (f) { if (v) f.weather = v; else delete f.weather; });
    });
    field(el.fPalette, function (v) {
      change(function (f) {
        if (v) f.palette = v; else delete f.palette;
        delete f.colors;           // a new starting point, not a mixture
      });
    });
    Object.keys(PICKERS).forEach(function (k) {
      var input = el['pick_' + k];
      input.addEventListener('input', function () {
        // live on the map, one history step when the picker closes
        if (!cur) return;
        var tmp = clone(cur);
        tmp.colors = Object.assign({}, tmp.colors || {}, PICKERS[k].set(input.value));
        var keep = cur;
        cur = tmp; draw(); cur = keep;
      });
      input.addEventListener('change', function () {
        change(function (f) { f.colors = Object.assign({}, f.colors || {}, PICKERS[k].set(input.value)); });
      });
    });

    el.revert.addEventListener('click', function () {
      var live = liveFile(cur.id);
      if (!confirm(live ? 'Throw away your changes to ' + cur.name + ' and go back to the version in the game?'
                        : 'Delete ' + cur.name + '? It has not been uploaded, so this cannot be undone.')) return;
      delete drafts[cur.id];
      saveDrafts();
      if (live) open(cur.id); else show('library');
    });
    $('ed-run-check').addEventListener('click', runCheck);
    $('ed-test-drive').addEventListener('click', function () { testDrive(false); });
    $('ed-test-race').addEventListener('click', function () { testDrive(true); });
    $('ed-save').addEventListener('click', download);
    $('ed-share').addEventListener('click', share);
    $('ed-copy').addEventListener('click', copyText);

    var cv = el.canvas;
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', function (e) {
      delete pointers[e.pointerId];
      if (op && op.before) cur = JSON.parse(op.before);
      op = null;
      if (!Object.keys(pointers).length) pinch = null;
      draw();
    });
    cv.addEventListener('pointerleave', function () { if (hover) { hover = null; paintCoords(null); draw(); } });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      var l = local(e);
      var mouseWheel = e.deltaMode === 1 || (Math.abs(e.deltaY) >= 50 && !e.deltaX);
      if (e.ctrlKey || e.metaKey || mouseWheel) zoomAt(l.px, l.py, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)));
      else { view.x -= e.deltaX; view.y -= e.deltaY; draw(); }
    }, { passive: false });
    /* The map's box changes with more than the window: a tool's own row of
     * buttons comes and goes above it, and the panel beside it can wrap.
     * Whatever changed it, the canvas follows - and stays fitted, unless it
     * has been zoomed, when what is under your finger stays put. */
    var refit = function () {
      if (!global.Screens || global.Screens.current !== 'editor' || Editor.screen !== 'work') return;
      var fitted = Math.abs(view.s - view.fitS) < 1e-6;
      resize();
      if (fitted) fit();
    };
    if (global.ResizeObserver) new global.ResizeObserver(refit).observe(el.stage);
    global.addEventListener('resize', refit);

    // Keys: ours while the editor is up, and never the race's.
    document.addEventListener('keydown', function (e) {
      if (!global.Screens || global.Screens.current !== 'editor') return;
      var t = e.target, typing = t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' ||
        (t.tagName === 'INPUT' && !/^(range|button|color)$/i.test(t.type)));
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (typing) { t.blur(); return; }
        $('ed-back').click();
        return;
      }
      if (typing || Editor.screen !== 'work') return;
      var mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (mod && k === 'z') { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) redoIt(); else undo(); return; }
      if (mod && k === 'y') { e.preventDefault(); e.stopPropagation(); redoIt(); return; }
      if (mod) return;
      var TOOL_KEYS = { w: 'wall', e: 'erase', l: 'route', c: 'checkpoint', f: 'finish' };
      if (TOOL_KEYS[k] && !redraw) { Editor.tool = TOOL_KEYS[k]; paintTools(); e.stopPropagation(); }
      else if (e.key === 'Enter' || e.key === ' ' || k === 'r' || k === 'p' ||
               e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.stopPropagation();       // not a race command on this screen
      }
    }, true);

    loadDrafts();
  };

  /* Screens.show('editor') lands here: back where it was left, which after a
   * test drive is the track that was being driven. */
  Editor.shown = function () {
    if (Editor.screen === 'work' && cur) show('work');
    else show('library');
  };

  Editor.TEST_ID = TEST_ID;
  Editor._template = template;
  Editor._settle = settle;
  global.Editor = Editor;
})(typeof window !== 'undefined' ? window : globalThis);
