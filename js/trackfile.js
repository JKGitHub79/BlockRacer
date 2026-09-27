/* Block Racer - the track file format.
 *
 * Every track is one JSON file under tracks/: tracks/<theme>/<id>.json for
 * the thirty that belong to a theme, tracks/adhoc/<id>.json for everything
 * else. tools/build-tracks.js reads the folder and writes js/tracks.data.js,
 * which is what the game actually loads - a folder cannot be listed from a
 * web page, and the game has to keep working opened straight off the disk.
 *
 * This file is shared by the game, the level editor and the build tool, so
 * the three can never disagree about what a file means:
 *
 *   toTrack(file)    a file -> the object js/track.js races
 *   check(file)      what is wrong with a file's SHAPE (not its driving -
 *                    that is js/trackcheck.js), as a list of sentences
 *   stringify(file)  a file -> the text written to disk, one wall per line
 *   signature(track) a short hash of the layout, so records set on an old
 *                    version of a track can be told from records on this one
 *
 * A file is the track as it is RACED. Its border is not listed as walls:
 * `border` names the kind of the four edge rectangles every track has, and
 * they are put back first, in the order they always were. A themed track
 * takes its colours from its theme; an adhoc track names a palette to start
 * from, or none, and overrides any colour in `colors`.
 */
(function (global) {
  'use strict';

  var FORMAT = 1;
  var KINDS = ['edge', 'infield', 'jog', 'lava', 'void'];
  var WEATHER = ['leaves', 'dust', 'snow', 'grit', 'rain', 'ash', 'motes', 'embers', 'drift', 'spores'];
  // The colours a palette can hold. `jog` is optional in a palette: without
  // it the blocks on the road are drawn in the game's default jog colour.
  var COLORS = ['bg', 'road', 'roadLine', 'wall', 'wallTop', 'outer', 'outerTop',
                'jog', 'jogTop', 'racingLine', 'check', 'checkNext', 'startLine'];
  // The look switches some palettes carry. A copy of a preset keeps them.
  var FLAGS = ['rock', 'windows', 'pipes', 'glyphs', 'crust', 'vacuum', 'hive'];
  var ADHOC = 'adhoc';
  var LIMITS = { minCols: 16, maxCols: 80, minRows: 12, maxRows: 60, maxWalls: 400,
                 maxRoute: 64, maxCheckpoints: 16, maxGrid: 12, name: 16, blurb: 90, grade: 16 };

  // Key order on disk. Anything not listed goes after, in the order it came.
  var ORDER = ['format', 'id', 'theme', 'name', 'grade', 'blurb', 'order', 'tutorial',
               'cols', 'rows', 'weather', 'palette', 'colors',
               'aiPace', 'aiOffsetScale', 'aiMistakeScale',
               'border', 'walls', 'route', 'startLeg', 'checkpoints', 'finish', 'startGrid',
               'emblems', 'notes'];

  function border(cols, rows, kind) {
    kind = kind || 'edge';
    return [
      { x0: 0, y0: 0, x1: cols - 1, y1: 0, kind: kind },
      { x0: 0, y0: rows - 1, x1: cols - 1, y1: rows - 1, kind: kind },
      { x0: 0, y0: 0, x1: 0, y1: rows - 1, kind: kind },
      { x0: cols - 1, y0: 0, x1: cols - 1, y1: rows - 1, kind: kind }
    ];
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* The colours a track is drawn in, or null for the game's defaults. */
  function paletteFor(file, palettes) {
    palettes = palettes || global.PALETTES || {};
    if (file.theme && file.theme !== ADHOC) return palettes[file.theme] || null;
    var base = file.palette ? palettes[file.palette] : null;
    if (!base && !file.colors) return null;
    var out = {};
    if (base) for (var k in base) out[k] = base[k];
    if (file.colors) for (var c in file.colors) out[c] = file.colors[c];
    return out;
  }

  var RUNTIME = ['id', 'name', 'blurb', 'grade', 'tutorial', 'cols', 'rows',
                 'aiPace', 'aiOffsetScale', 'aiMistakeScale', 'weather',
                 'route', 'startLeg', 'checkpoints', 'finish', 'startGrid', 'emblems'];

  function toTrack(file, palettes) {
    var t = {};
    RUNTIME.forEach(function (k) { if (file[k] !== undefined) t[k] = file[k]; });
    t.walls = border(file.cols, file.rows, file.border).concat(file.walls || []);
    var theme = paletteFor(file, palettes);
    if (theme) t.theme = theme;
    return t;
  }

  /* ---- shape checks ----------------------------------------------------- */

  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isInt(v) { return isNum(v) && Math.floor(v) === v; }
  function isColor(v) {
    return typeof v === 'string' &&
      (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v) || /^rgba?\([\d.,\s]+\)$/i.test(v));
  }

  /* Everything that would stop the game LOADING a file, or put a car
   * somewhere it cannot be. `opts.themes` (THEMES) and `opts.palettes`
   * widen it to the checks that need them. Returns [] for a good file. */
  function check(file, opts) {
    opts = opts || {};
    var errs = [];
    var bad = function (m) { errs.push(m); };
    if (!file || typeof file !== 'object' || Array.isArray(file)) return ['not a track file'];
    if (file.format !== FORMAT) bad('format must be ' + FORMAT);
    if (typeof file.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(file.id)) {
      bad('id must be 1-32 lower-case letters, digits or dashes');
    }
    if (typeof file.theme !== 'string') bad('theme is missing');
    ['name', 'grade', 'blurb'].forEach(function (k) {
      if (typeof file[k] !== 'string' || !file[k].trim()) bad(k + ' is missing');
      else if (file[k].length > LIMITS[k]) bad(k + ' is longer than ' + LIMITS[k] + ' characters');
    });
    if (!isInt(file.cols) || file.cols < LIMITS.minCols || file.cols > LIMITS.maxCols) {
      bad('cols must be a whole number from ' + LIMITS.minCols + ' to ' + LIMITS.maxCols);
    }
    if (!isInt(file.rows) || file.rows < LIMITS.minRows || file.rows > LIMITS.maxRows) {
      bad('rows must be a whole number from ' + LIMITS.minRows + ' to ' + LIMITS.maxRows);
    }
    if (errs.length) return errs;          // nothing below means anything without these
    var W = file.cols, H = file.rows;

    if (file.weather !== undefined && WEATHER.indexOf(file.weather) < 0) {
      bad('weather must be one of ' + WEATHER.join(', '));
    }
    ['aiPace', 'aiOffsetScale', 'aiMistakeScale'].forEach(function (k) {
      if (file[k] !== undefined && (!isNum(file[k]) || file[k] < 0 || file[k] > 3)) {
        bad(k + ' must be a number from 0 to 3');
      }
    });
    if (file.order !== undefined && !isNum(file.order)) bad('order must be a number');
    if (KINDS.indexOf(file.border) < 0) bad('border must be one of ' + KINDS.join(', '));

    if (file.theme !== ADHOC) {
      if (file.palette !== undefined) bad('a themed track takes its theme’s colours: remove palette');
      if (file.colors !== undefined) bad('a themed track takes its theme’s colours: remove colors');
    } else {
      if (file.palette !== undefined && opts.palettes && !opts.palettes[file.palette]) {
        bad('palette "' + file.palette + '" does not exist');
      }
      if (file.colors !== undefined) {
        if (!file.colors || typeof file.colors !== 'object' || Array.isArray(file.colors)) bad('colors must be an object');
        else Object.keys(file.colors).forEach(function (k) {
          if (COLORS.indexOf(k) >= 0) { if (!isColor(file.colors[k])) bad('colors.' + k + ' is not a colour'); }
          else if (FLAGS.indexOf(k) >= 0) { if (typeof file.colors[k] !== 'boolean') bad('colors.' + k + ' must be true or false'); }
          else bad('colors.' + k + ' is not a colour this game knows');
        });
      }
    }
    if (opts.themes) {
      var owner = null;
      opts.themes.forEach(function (th) {
        th.tracks.forEach(function (e) { if (e.id === file.id) owner = th.id; });
      });
      if (file.theme === ADHOC && owner) {
        bad('"' + file.id + '" is a ' + owner + ' track: its theme must be "' + owner + '"');
      } else if (file.theme !== ADHOC && owner !== file.theme) {
        var th = opts.themes.filter(function (x) { return x.id === file.theme; })[0];
        bad(th ? file.theme + ' has three tracks - ' + th.tracks.map(function (e) { return e.id; }).join(', ') +
                 ' - and "' + file.id + '" is not one of them. A new track goes in adhoc.'
               : 'theme "' + file.theme + '" does not exist (use one of ' +
                 opts.themes.map(function (x) { return x.id; }).concat([ADHOC]).join(', ') + ')');
      }
    }

    // Walls: inclusive cells, inside the grid.
    if (!Array.isArray(file.walls)) bad('walls must be a list');
    else {
      if (file.walls.length > LIMITS.maxWalls) bad('more than ' + LIMITS.maxWalls + ' walls');
      file.walls.forEach(function (w, i) {
        if (!w || !isInt(w.x0) || !isInt(w.y0) || !isInt(w.x1) || !isInt(w.y1)) {
          bad('wall ' + i + ' needs whole-number x0, y0, x1, y1'); return;
        }
        if (w.x0 > w.x1 || w.y0 > w.y1) bad('wall ' + i + ' is inside out (x0 > x1 or y0 > y1)');
        if (w.x0 < 0 || w.y0 < 0 || w.x1 >= W || w.y1 >= H) bad('wall ' + i + ' is outside the grid');
        if (KINDS.indexOf(w.kind) < 0) bad('wall ' + i + ' has kind "' + w.kind + '"');
      });
    }

    // The racing line: a closed loop of axis-aligned legs, inside the border.
    var R = file.route;
    if (!Array.isArray(R) || R.length < 4 || R.length > LIMITS.maxRoute) {
      bad('route needs 4 to ' + LIMITS.maxRoute + ' waypoints');
    } else {
      var ok = true;
      R.forEach(function (p, i) {
        if (!p || !isNum(p.x) || !isNum(p.y)) { bad('waypoint ' + i + ' needs x and y'); ok = false; return; }
        if (p.x <= 1 || p.y <= 1 || p.x >= W - 1 || p.y >= H - 1) bad('waypoint ' + i + ' is on or outside the border');
      });
      if (ok) R.forEach(function (p, i) {
        var n = R[(i + 1) % R.length];
        var dx = n.x - p.x, dy = n.y - p.y;
        if (dx !== 0 && dy !== 0) bad('leg ' + i + ' (waypoint ' + i + ' to ' + ((i + 1) % R.length) + ') is diagonal');
        if (dx === 0 && dy === 0) bad('waypoints ' + i + ' and ' + ((i + 1) % R.length) + ' are the same point');
      });
      if (!isInt(file.startLeg) || file.startLeg < 0 || file.startLeg >= R.length) bad('startLeg must be a leg of the route');
    }

    var span = function (z, what) {
      if (!z || !isNum(z.x0) || !isNum(z.y0) || !isNum(z.x1) || !isNum(z.y1)) { bad(what + ' needs x0, y0, x1, y1'); return false; }
      if (z.x0 >= z.x1 || z.y0 >= z.y1) { bad(what + ' has no area'); return false; }
      if (z.x0 < 0 || z.y0 < 0 || z.x1 > W || z.y1 > H) { bad(what + ' is outside the grid'); return false; }
      return true;
    };
    if (!Array.isArray(file.checkpoints) || !file.checkpoints.length || file.checkpoints.length > LIMITS.maxCheckpoints) {
      bad('checkpoints needs 1 to ' + LIMITS.maxCheckpoints + ' zones');
    } else {
      file.checkpoints.forEach(function (z, i) { span(z, 'checkpoint ' + i); });
    }
    if (span(file.finish, 'finish')) {
      var d = file.finish.dir;
      if (!d || !isNum(d.x) || !isNum(d.y) || Math.abs(d.x) + Math.abs(d.y) !== 1 || (d.x && d.y)) {
        bad('finish.dir must be one of {x:1,y:0}, {x:-1,y:0}, {x:0,y:1}, {x:0,y:-1}');
      }
    }
    if (!Array.isArray(file.startGrid) || !file.startGrid.length || file.startGrid.length > LIMITS.maxGrid) {
      bad('startGrid needs 1 to ' + LIMITS.maxGrid + ' slots');
    } else if (Array.isArray(R)) {
      file.startGrid.forEach(function (s, i) {
        if (!s || !isNum(s.x) || !isNum(s.y) || !isInt(s.wp) || s.wp < 0 || s.wp >= R.length) {
          bad('start slot ' + i + ' needs x, y and wp (a waypoint number)');
        } else if (s.x <= 1 || s.y <= 1 || s.x >= W - 1 || s.y >= H - 1) {
          bad('start slot ' + i + ' is on or outside the border');
        }
      });
    }
    if (file.emblems !== undefined && !Array.isArray(file.emblems)) bad('emblems must be a list');
    if (file.notes !== undefined && (!Array.isArray(file.notes) ||
        file.notes.some(function (s) { return typeof s !== 'string'; }))) bad('notes must be a list of strings');
    if (file.tutorial !== undefined && file.tutorial !== true) bad('tutorial can only be true');
    return errs;
  }

  /* ---- writing ---------------------------------------------------------- */

  function sorted(o) {
    var out = {};
    ORDER.forEach(function (k) { if (o[k] !== undefined) out[k] = o[k]; });
    Object.keys(o).forEach(function (k) { if (out[k] === undefined && o[k] !== undefined) out[k] = o[k]; });
    return out;
  }

  // One line for a small object: { "x0": 1, "y0": 2, "dir": { "x": 1, "y": 0 } }
  function line(o) {
    if (Array.isArray(o)) return '[' + o.map(line).join(', ') + ']';
    if (!o || typeof o !== 'object') return JSON.stringify(o);
    return '{ ' + Object.keys(o).map(function (k) {
      return JSON.stringify(k) + ': ' + line(o[k]);
    }).join(', ') + ' }';
  }

  /* Human-sized JSON: the scalars one per line, every wall, waypoint and
   * zone on a line of its own, so a file reads like the old source did and
   * a change to one wall is a one-line diff. Still plain JSON. */
  function stringify(file) {
    var o = sorted(file);
    var keys = Object.keys(o);
    var body = keys.map(function (k, i) {
      var v = o[k], s;
      if (Array.isArray(v) && v.length && v.every(function (x) { return x && typeof x === 'object'; })) {
        s = '[\n' + v.map(function (x) {
          // an emblem's colour list is short enough to stay on its line
          return '    ' + line(x);
        }).join(',\n') + '\n  ]';
      } else if (Array.isArray(v) && v.length && v.every(function (x) { return typeof x === 'string'; })) {
        s = '[\n' + v.map(function (x) { return '    ' + JSON.stringify(x); }).join(',\n') + '\n  ]';
      } else if (v && typeof v === 'object' && !Array.isArray(v) && k === 'colors') {
        s = '{\n' + Object.keys(v).map(function (c) {
          return '    ' + JSON.stringify(c) + ': ' + JSON.stringify(v[c]);
        }).join(',\n') + '\n  }';
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        s = line(v);
      } else {
        s = JSON.stringify(v);
      }
      return '  ' + JSON.stringify(k) + ': ' + s + (i < keys.length - 1 ? ',' : '');
    });
    return '{\n' + body.join('\n') + '\n}\n';
  }

  /* ---- a layout's fingerprint ------------------------------------------- *
   * Everything a lap time depends on and nothing it does not: the name, the
   * colours and the weather can change without making an old record wrong. */
  function signature(t) {
    var s = JSON.stringify([t.cols, t.rows, t.walls.map(function (w) { return [w.x0, w.y0, w.x1, w.y1]; }),
      t.route, t.startLeg, t.checkpoints, t.finish, t.startGrid]);
    var h = 2166136261;                  // FNV-1a, 32 bit
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  global.TrackFile = {
    FORMAT: FORMAT, KINDS: KINDS, WEATHER: WEATHER, COLORS: COLORS, FLAGS: FLAGS,
    ADHOC: ADHOC, LIMITS: LIMITS,
    border: border, clone: clone, paletteFor: paletteFor, toTrack: toTrack,
    check: check, stringify: stringify, signature: signature,
    path: function (file) { return 'tracks/' + file.theme + '/' + file.id + '.json'; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
