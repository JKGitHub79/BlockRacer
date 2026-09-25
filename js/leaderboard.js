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
 * The boards: a theme's three tracks, top five each, from the time-trial
 * track screen; and one track, everyone on it, from a trial's results or
 * SHOW ALL. Your own row is a blue bar - picked out by the API, which marks
 * the player id it is given and ranks it wherever it is, or, by an API from
 * before that, by your name. */
(function (global) {
  'use strict';

  var KEY = 'blockracer.leaderboard.v1';   // { player_id, username }
  var NAME = /^[A-Za-z0-9_]{1,16}$/;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
    p.then(function () { if (pending === p) pending = null; cache = {}; });
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

  /* ---- the boards ------------------------------------------------------------
   *
   * One layer, two views. A THEME: its three tracks side by side (stacked on
   * a narrow screen), the top five of each, arrows to the next theme. And a
   * TRACK: everyone who has a time there, as far down as it goes, scrolling.
   * You are a blue bar wherever you are - in the list if you made it, under
   * it with your real position if you did not. */

  var FIVE = 5;
  var ALL = 1000;             // the API's own ceiling
  var FRESH_MS = 30000;       // a board this recent is shown again without asking
  var cache = {};             // track id -> { at, limit, data }
  var view = null;            // { kind: 'theme', theme } | { kind: 'track', id, theme, from }

  function fmt(ms) {
    var t = ms / 1000;
    if (t < 60) return t.toFixed(3) + 's';
    var m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3);
  }

  function make(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;   // names are the API's, never markup
    return n;
  }

  function trackName(id) {
    var t = (global.TRACKS || []).filter(function (x) { return x.id === id; })[0];
    return t ? t.name : id.toUpperCase();
  }

  function themeOf(id) {
    return global.Screens && global.Screens.themeOfTrack ? global.Screens.themeOfTrack(id) : -1;
  }

  /* One track's board, as { entries, total, you }. An API from before `you`
   * and `total` existed is read too: `you` is then whichever listed row is
   * yours, and `total` is what came back. */
  function fetchBoard(id, limit) {
    var c = cache[id];
    if (c && c.limit >= limit && Date.now() - c.at < FRESH_MS) return Promise.resolve(c.data);
    var q = '/leaderboard/' + encodeURIComponent(id) + '?limit=' + limit +
            (me ? '&player_id=' + encodeURIComponent(me.player_id) : '');
    return Promise.resolve(pending).then(function () { return api(q); }).then(function (r) {
      if (!r.ok || !r.body || !Array.isArray(r.body.entries)) throw new Error('unavailable');
      var list = r.body.entries;
      var marked = list.some(function (e) { return typeof e.me === 'boolean'; });
      var isMe = function (e) { return marked ? e.me === true : !!(me && e.username === me.username); };
      list.forEach(function (e, i) { e.rank = e.rank || i + 1; e.mine = isMe(e); });
      var you = r.body.you;
      if (you === undefined) you = list.filter(function (e) { return e.mine; })[0] || null;
      if (you) you.mine = true;
      var data = { entries: list, total: typeof r.body.total === 'number' ? r.body.total : list.length, you: you };
      cache[id] = { at: Date.now(), limit: limit, data: data };
      return data;
    });
  }

  function row(e) {
    var li = make('li', 'lb-row' + (e.mine ? ' me' : ''));
    li.appendChild(make('span', 'lb-rank', String(e.rank)));
    li.appendChild(make('span', 'lb-who', e.username));
    li.appendChild(make('span', 'lb-time', fmt(e.time_ms)));
    if (e.mine) li.setAttribute('aria-label', 'You, position ' + e.rank + ', ' + e.username + ', ' + fmt(e.time_ms));
    return li;
  }

  /* The list: the first `upTo` rows, then - if you are further down - a gap
   * and your own row with its real position. */
  function fill(ol, data, upTo) {
    ol.textContent = '';
    if (!data.entries.length) { ol.appendChild(make('li', 'lb-msg', 'NO TIMES YET')); return; }
    var shown = data.entries.slice(0, upTo);
    shown.forEach(function (e) { ol.appendChild(row(e)); });
    var you = data.you;
    if (you && !shown.some(function (e) { return e.mine; })) {
      ol.appendChild(make('li', 'lb-gap', '⋯'));
      ol.appendChild(row(you));
    }
  }

  function setHead(title, kind, backTo) {
    var C = global.CONFIG, want = C.leaderboardSpeed;
    el.speed.textContent = want === null || want === undefined ? 'ALL SPEEDS' : C.speedLevels[want].name;
    el.title.textContent = title;
    el.board.classList.toggle('lb-track-view', kind === 'track');
    el.prev.hidden = el.next.hidden = kind !== 'theme';
    el.back.hidden = !(kind === 'track' && backTo >= 0);
    if (!el.back.hidden) el.back.textContent = '‹ ' + global.THEMES[backTo].name;
    el.body.scrollTop = 0;
  }

  function showTheme(t) {
    var THEMES = global.THEMES, n = THEMES.length;
    t = ((t % n) + n) % n;
    view = { kind: 'theme', theme: t };
    var token = view;
    setHead(THEMES[t].name, 'theme');
    el.board.style.setProperty('--lb-theme', THEMES[t].accent || '');
    el.body.textContent = '';
    var grid = make('div', 'lb-grid');
    THEMES[t].tracks.forEach(function (tr) {
      var sec = make('section', 'lb-track');
      var head = make('div', 'lb-track-head');
      head.appendChild(make('h3', 'lb-track-name', tr.name));
      var all = make('button', 'lb-all', 'SHOW ALL');
      all.type = 'button';
      all.hidden = true;
      all.addEventListener('click', function () { showTrack(tr.id, t); });
      head.appendChild(all);
      sec.appendChild(head);
      var ol = make('ol', 'lb-list');
      ol.appendChild(make('li', 'lb-msg', 'LOADING…'));
      sec.appendChild(ol);
      grid.appendChild(sec);
      fetchBoard(tr.id, 50).then(function (data) {
        if (view !== token) return;
        fill(ol, data, FIVE);
        if (data.total > FIVE) { all.hidden = false; all.textContent = 'SHOW ALL · ' + data.total; }
      }, function () {
        if (view !== token) return;
        ol.textContent = '';
        ol.appendChild(make('li', 'lb-msg', 'UNAVAILABLE'));
      });
    });
    el.body.appendChild(grid);
  }

  // `from`: the theme to go back to, or -1 to close instead.
  function showTrack(id, from) {
    view = { kind: 'track', id: id, from: from };
    var token = view;
    setHead(trackName(id), 'track', from);
    if (from >= 0) el.board.style.setProperty('--lb-theme', global.THEMES[from].accent || '');
    el.body.textContent = '';
    var ol = make('ol', 'lb-list lb-full');
    ol.appendChild(make('li', 'lb-msg', 'LOADING…'));
    var note = make('p', 'lb-foot');
    el.body.appendChild(ol);
    el.body.appendChild(note);
    fetchBoard(id, ALL).then(function (data) {
      if (view !== token) return;
      fill(ol, data, ALL);
      note.textContent = data.total ? data.total + (data.total === 1 ? ' DRIVER' : ' DRIVERS') : '';
      if (!data.you && me) {
        var want = global.CONFIG.leaderboardSpeed;
        var rec = global.Progress && want !== null && want !== undefined ? global.Progress.lapRecord(id, want) : 0;
        if (rec) note.textContent += (note.textContent ? ' · ' : '') + 'your record ' + fmt(Math.round(rec * 1000)) + ' is not on it yet';
      }
    }, function () {
      if (view !== token) return;
      ol.textContent = '';
      ol.appendChild(make('li', 'lb-msg', 'LEADERBOARD UNAVAILABLE'));
    });
  }

  function open() {
    el.board.classList.add('show');
  }

  /* A theme's three tracks: from the time-trial track screen. */
  Leaderboard.openTheme = function (t) { showTheme(t || 0); open(); };

  /* One track, everyone on it: from a time trial's results. Back goes to
   * its theme, where it has one. */
  Leaderboard.openTrack = function (id) { showTrack(id, themeOf(id)); open(); };

  Leaderboard.hideBoard = function () {
    view = null;
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
    el.title = $('lb-title');
    el.speed = $('lb-speed');
    el.body = $('lb-body');
    el.prev = $('lb-prev');
    el.next = $('lb-next');
    el.back = $('lb-back');
    if (!el.name || !el.board) return;

    el.nameInput.addEventListener('input', nameChanged);
    el.nameForm.addEventListener('submit', function (e) { e.preventDefault(); saveName(); });
    $('lb-name-skip').addEventListener('click', closeName);
    $('lb-close').addEventListener('click', Leaderboard.hideBoard);
    el.prev.addEventListener('click', function () { if (view && view.kind === 'theme') showTheme(view.theme - 1); });
    el.next.addEventListener('click', function () { if (view && view.kind === 'theme') showTheme(view.theme + 1); });
    el.back.addEventListener('click', function () { if (view && view.from >= 0) showTheme(view.from); });
    // A tap on the dimmed screen round the panel closes it, as a click would expect.
    el.board.addEventListener('click', function (e) { if (e.target === el.board) Leaderboard.hideBoard(); });
    document.addEventListener('keydown', function (e) {
      if (el.name.classList.contains('show')) { if (e.key === 'Escape') closeName(); return; }
      if (!el.board.classList.contains('show') || !view) return;
      if (e.key === 'Escape') {
        if (view.kind === 'track' && view.from >= 0) showTheme(view.from);
        else Leaderboard.hideBoard();
      } else if (view.kind === 'theme' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        showTheme(view.theme + (e.key === 'ArrowLeft' ? -1 : 1));
        e.preventDefault();
      }
    });
    var corner = $('btn-lb-corner');
    if (corner) corner.addEventListener('click', function (e) {
      e.stopPropagation();
      Leaderboard.openTheme(global.Screens ? global.Screens.theme : 0);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.Leaderboard = Leaderboard;
})(typeof window !== 'undefined' ? window : globalThis);
