/* Block Racer - the online leaderboard.
 *
 * After a completed time trial the run's best lap goes to the leaderboard
 * API (CONFIG.leaderboardUrl, source in leaderboard-api/). The record kept
 * on this device is still Progress.recordLap's: this is on top of it, and
 * nothing about a race waits for it or changes because of it. Offline,
 * blocked, rejected or slow, a submission simply does not happen and
 * nothing is said about it.
 *
 * The first lap worth sending asks for a name - the API's rules, 1-16 of
 * A-Z a-z 0-9 _ - and makes a player id with crypto.randomUUID(). Both are
 * kept in localStorage, so every later lap from this browser is the same
 * player. NOT NOW sends nothing and asks again next time.
 *
 * The board is one track's top 20, your own row picked out: by the API,
 * which marks the row that belongs to the player id it is given, or - from
 * an API that does not know how - by your name. */
(function (global) {
  'use strict';

  var KEY = 'blockracer.leaderboard.v1';   // { player_id, username }
  var NAME = /^[A-Za-z0-9_]{1,16}$/;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var TOP = 20;
  var TIMEOUT_MS = 8000;

  var Leaderboard = {};
  var me = load();              // this session's copy, even if nothing can be saved
  var pending = null;           // the submission in flight, if any
  var asking = null;            // what to send once a name is given
  var el = {};

  function $(id) { return document.getElementById(id); }

  /* ---- who you are -------------------------------------------------------- */

  function load() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(KEY);
      var d = raw ? JSON.parse(raw) : null;
      if (d && UUID.test(d.player_id) && NAME.test(d.username)) return d;
    } catch (e) { /* unreadable: ask again */ }
    return null;
  }

  function save(d) {
    me = d;
    try { if (global.localStorage) global.localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* session only */ }
  }

  function newId() {
    var c = global.crypto;
    if (c && c.randomUUID) return c.randomUUID();
    // Older browsers, and pages that are not a secure context: the same
    // version-4 UUID from the same generator.
    var b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  Leaderboard.validName = function (s) { return NAME.test(s); };
  Leaderboard.identity = function () { return me; };

  /* ---- talking to the API --------------------------------------------------- */

  function api(path, opts) {
    var base = String(global.CONFIG.leaderboardUrl || '').replace(/\/+$/, '');
    if (!base || !global.fetch) return Promise.reject(new Error('no leaderboard'));
    opts = opts || {};
    var ctl = global.AbortController ? new AbortController() : null;
    if (ctl) opts.signal = ctl.signal;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, TIMEOUT_MS);
    return global.fetch(base + path, opts).then(function (res) {
      clearTimeout(timer);
      return res.json().catch(function () { return null; }).then(function (body) {
        return { status: res.status, ok: res.ok, body: body };
      });
    }, function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  function post(entry) {
    var p = api('/times', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    }).then(function (r) { return r; }, function () { return null; });   // silently
    pending = p;
    p.then(function () { if (pending === p) pending = null; });
    return p;
  }

  /* Only laps at CONFIG.leaderboardSpeed go (null: any speed). */
  Leaderboard.counts = function (speedLevel) {
    var want = global.CONFIG.leaderboardSpeed;
    return want === null || want === undefined || speedLevel === want;
  };

  /* Called when a time trial has finished. `seconds` is the run's best lap.
   * Returns the submission's promise, or null when nothing is sent now. */
  Leaderboard.submitTrial = function (trackId, speedLevel, seconds) {
    if (!global.CONFIG.leaderboardUrl || !(seconds > 0) || !Leaderboard.counts(speedLevel)) return null;
    var entry = {
      track_id: trackId,
      time_ms: Math.round(seconds * 1000),
      game_version: global.BR ? String(global.BR.version) : undefined
    };
    if (!me) { askName(entry); return null; }
    entry.username = me.username;
    entry.player_id = me.player_id;
    return post(entry);
  };

  /* ---- the name ---------------------------------------------------------------- */

  function askName(entry) {
    asking = entry;
    el.nameInput.value = '';
    nameChanged();
    el.name.classList.add('show');
    // A tap brings the keyboard up anyway; a desktop gets the cursor in the box.
    setTimeout(function () { try { el.nameInput.focus({ preventScroll: true }); } catch (e) { el.nameInput.focus(); } }, 30);
  }

  function nameChanged() {
    var ok = NAME.test(el.nameInput.value);
    el.nameSave.disabled = !ok;
    el.nameRule.classList.toggle('bad', el.nameInput.value.length > 0 && !ok);
  }

  function closeName() {
    el.name.classList.remove('show');
    asking = null;
    if (document.activeElement === el.nameInput) el.nameInput.blur();
  }

  function saveName() {
    var name = el.nameInput.value;
    if (!NAME.test(name)) { nameChanged(); return; }
    var entry = asking;
    save({ player_id: me ? me.player_id : newId(), username: name });
    closeName();
    if (entry) {
      entry.username = me.username;
      entry.player_id = me.player_id;
      post(entry);
    }
  }

  /* ---- the board ------------------------------------------------------------------ */

  function fmt(ms) {
    var t = ms / 1000;
    if (t < 60) return t.toFixed(3) + 's';
    var m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3);
  }

  function row(cells, mine) {
    var tr = document.createElement('tr');
    if (mine) tr.className = 'me';
    cells.forEach(function (c) {
      var td = document.createElement('td');
      td.textContent = c;             // names are the API's, and never markup
      tr.appendChild(td);
    });
    return tr;
  }

  function message(text) {
    el.boardBody.textContent = '';
    var tr = document.createElement('tr'), td = document.createElement('td');
    td.colSpan = 3;
    td.className = 'lb-msg';
    td.textContent = text;
    tr.appendChild(td);
    el.boardBody.appendChild(tr);
  }

  /* One track's top 20. Waits for a lap still on its way, so a time you
   * have just set is on the board you open straight after. */
  Leaderboard.show = function (trackId, trackName) {
    var C = global.CONFIG, want = C.leaderboardSpeed;
    var speed = want === null || want === undefined ? 'ALL SPEEDS' : C.speedLevels[want].name;
    el.boardSub.textContent = (trackName || trackId) + ' · ' + speed + ' · BEST LAP';
    el.boardNote.textContent = '';
    message('LOADING…');
    el.board.classList.add('show');
    var token = el.board.token = {};
    var q = '/leaderboard/' + encodeURIComponent(trackId) + '?limit=' + TOP +
            (me ? '&player_id=' + encodeURIComponent(me.player_id) : '');
    Promise.resolve(pending).then(function () { return api(q); }).then(function (r) {
      if (el.board.token !== token) return;
      if (!r.ok || !r.body || !Array.isArray(r.body.entries)) { message('LEADERBOARD UNAVAILABLE'); return; }
      var list = r.body.entries;
      if (!list.length) { message('NO TIMES YET'); return; }
      // An API that marks rows says so on every row; one that does not, on none.
      var marked = list.some(function (e) { return typeof e.me === 'boolean'; });
      var found = false;
      el.boardBody.textContent = '';
      list.forEach(function (e, i) {
        var mine = marked ? e.me === true : !!(me && e.username === me.username);
        if (mine) found = true;
        el.boardBody.appendChild(row([String(e.rank || i + 1), e.username, fmt(e.time_ms)], mine));
      });
      if (!found && me && want !== null && want !== undefined) {
        var rec = global.Progress ? global.Progress.lapRecord(trackId, want) : 0;
        el.boardNote.textContent = rec
          ? 'Not in the top ' + TOP + ' yet · your record ' + fmt(Math.round(rec * 1000))
          : 'Not in the top ' + TOP + ' yet';
      }
    }, function () {
      if (el.board.token === token) message('LEADERBOARD UNAVAILABLE');
    });
  };

  Leaderboard.hideBoard = function () {
    el.board.token = null;
    el.board.classList.remove('show');
  };

  /* Anything of ours on the screen: the game holds its keys while it is. */
  Leaderboard.busy = function () {
    return !!(el.name && (el.name.classList.contains('show') || el.board.classList.contains('show')));
  };

  // Leaving the screen takes both with it. A lap waiting on a name is not sent.
  Leaderboard.hide = function () {
    if (!el.name) return;
    closeName();
    Leaderboard.hideBoard();
  };

  /* ---- wiring ---------------------------------------------------------------------- */

  function init() {
    el.name = $('lb-name');
    el.nameForm = $('lb-name-form');
    el.nameInput = $('lb-name-input');
    el.nameRule = $('lb-name-rule');
    el.nameSave = $('lb-name-save');
    el.board = $('lb-board');
    el.boardSub = $('lb-board-sub');
    el.boardBody = $('lb-board-body');
    el.boardNote = $('lb-board-note');
    if (!el.name || !el.board) return;

    el.nameInput.addEventListener('input', nameChanged);
    el.nameForm.addEventListener('submit', function (e) { e.preventDefault(); saveName(); });
    $('lb-name-skip').addEventListener('click', closeName);
    $('lb-board-close').addEventListener('click', Leaderboard.hideBoard);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (el.name.classList.contains('show')) closeName();
      else if (el.board.classList.contains('show')) Leaderboard.hideBoard();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.Leaderboard = Leaderboard;
})(typeof window !== 'undefined' ? window : globalThis);
