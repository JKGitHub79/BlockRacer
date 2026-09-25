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
  var askingRank = null;        // and who wants to hear where it lands
  var claimId = null;           // a new player's id, kept across tries at a name
  var el = {};

  function $(id) { return document.getElementById(id); }

  /* ---- who you are -------------------------------------------------------- */

  function load() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(KEY);
      var d = raw ? JSON.parse(raw) : null;
      // A player whose name turned out to be someone else's keeps their id
      // and is asked for a new name, so their times stay theirs.
      if (d && UUID.test(d.player_id)) return { player_id: d.player_id, username: NAME.test(d.username) ? d.username : null };
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

  function ordinal(n) {
    var t = n % 100, u = n % 10;
    return n + (t >= 11 && t <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th');
  }
  Leaderboard.ordinal = ordinal;

  /* Where a stored lap has put you: the API says, in its reply. One from
   * before it did is asked instead, from the board. Silent on any failure. */
  function rankAfter(r, trackId, onRank) {
    if (!onRank || !r || !r.ok) return;
    if (r.body && typeof r.body.rank === 'number') { onRank(r.body.rank); return; }
    fetchBoard(trackId, 50).then(function (data) { if (data.you) onRank(data.you.rank); }, function () {});
  }

  function post(entry, onRank) {
    var p = api('/times', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    }).then(function (r) { return r; }, function () { return null; });   // silently
    pending = p;
    p.then(function (r) {
      if (pending === p) pending = null;
      cache = {};
      if (r && r.status === 409 && r.body && r.body.code === 'username_taken') return nameTaken(entry, onRank);
      rankAfter(r, entry.track_id, onRank);
    });
    return p;
  }

  /* Only laps at CONFIG.leaderboardSpeed go (null: any speed). */
  Leaderboard.counts = function (speedLevel) {
    var want = global.CONFIG.leaderboardSpeed;
    return want === null || want === undefined || speedLevel === want;
  };

  /* Called when a time trial has finished. `seconds` is the run's best lap.
   * Returns the submission's promise, or null when nothing is sent now. */
  Leaderboard.submitTrial = function (trackId, speedLevel, seconds, onRank) {
    if (!global.CONFIG.leaderboardUrl || !(seconds > 0) || !Leaderboard.counts(speedLevel)) return null;
    var entry = {
      track_id: trackId,
      time_ms: Math.round(seconds * 1000),
      game_version: global.BR ? String(global.BR.version) : undefined
    };
    if (!me || !me.username) { askName(entry, onRank); return null; }
    entry.username = me.username;
    entry.player_id = me.player_id;
    return post(entry, onRank);
  };

  /* ---- the name ----------------------------------------------------------------
   *
   * A name is one player's. SAVE asks the API for it first (POST /players),
   * and a name someone else has - in any mix of capitals - is refused in the
   * box, which stays open for another. Nothing is saved until the API has
   * said yes, so a name that could not be checked is not kept either. */

  var TAKEN = 'Username already in use';
  var RULE = '';                 // the box's own line, read from the page

  function ruleSays(text, bad) {
    el.nameRule.textContent = text || RULE;
    el.nameRule.classList.toggle('bad', !!bad);
  }

  function askName(entry, onRank, why) {
    asking = entry;
    askingRank = onRank || null;
    el.nameInput.value = '';
    nameChanged();
    if (why) ruleSays(why, true);
    el.name.classList.add('show');
    // A tap brings the keyboard up anyway; a desktop gets the cursor in the box.
    setTimeout(function () { try { el.nameInput.focus({ preventScroll: true }); } catch (e) { el.nameInput.focus(); } }, 30);
  }

  function nameChanged() {
    var v = el.nameInput.value, ok = NAME.test(v);
    el.nameSave.disabled = !ok || el.name.classList.contains('checking');
    ruleSays(RULE, v.length > 0 && !ok);
  }

  function closeName() {
    el.name.classList.remove('show', 'checking');
    asking = null;
    askingRank = null;
    if (document.activeElement === el.nameInput) el.nameInput.blur();
  }

  /* The lap that was sent under a name that turned out to be someone else's
   * (one saved before names were checked). The name goes; the id stays. If
   * its results are still up, the box asks for another now and sends the
   * lap under it; otherwise the next lap asks. */
  function nameTaken(entry, onRank) {
    save({ player_id: me.player_id, username: null });
    var S = global.Screens, G = global.Game;
    if (S && S.current === 'race' && G && G.state === 'finished' && !Leaderboard.busy()) {
      askName({ track_id: entry.track_id, time_ms: entry.time_ms, game_version: entry.game_version }, onRank, TAKEN);
    }
  }

  function saveName() {
    var name = el.nameInput.value;
    if (!NAME.test(name) || el.name.classList.contains('checking')) { nameChanged(); return; }
    var id = me ? me.player_id : (claimId = claimId || newId());
    el.name.classList.add('checking');
    el.nameSave.disabled = true;
    ruleSays('CHECKING\u2026', false);
    api('/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: id, username: name })
    }).then(function (r) { return r; }, function () { return null; }).then(function (r) {
      el.name.classList.remove('checking');
      if (!el.name.classList.contains('show')) return;          // closed meanwhile
      if (r && r.ok) {
        var entry = asking, onRank = askingRank;
        save({ player_id: id, username: name });
        claimId = null;
        closeName();
        if (entry) {
          entry.username = me.username;
          entry.player_id = me.player_id;
          post(entry, onRank);
        }
        return;
      }
      el.nameSave.disabled = !NAME.test(el.nameInput.value);
      if (r && r.status === 409) ruleSays(TAKEN, true);
      else if (r && r.status === 429) ruleSays('Too many names tried - try again later', true);
      else ruleSays('Could not check that name - try again', true);
      try { el.nameInput.focus({ preventScroll: true }); } catch (e) { /* fine */ }
    });
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

  function setHead(title, kind) {
    var C = global.CONFIG, want = C.leaderboardSpeed;
    el.speed.textContent = want === null || want === undefined ? 'ALL SPEEDS' : C.speedLevels[want].name;
    el.title.textContent = title;
    el.board.classList.toggle('lb-track-view', kind === 'track');
    el.prev.hidden = el.next.hidden = kind !== 'theme';
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
      sec.appendChild(head);
      var ol = make('ol', 'lb-list');
      ol.appendChild(make('li', 'lb-msg', 'LOADING…'));
      sec.appendChild(ol);
      // Under the list rather than beside the name: a narrow column keeps
      // the whole name, however long, and the count has the width it needs.
      var all = make('button', 'lb-all', 'SHOW ALL');
      all.type = 'button';
      all.hidden = true;
      all.addEventListener('click', function () { showTrack(tr.id, t); });
      sec.appendChild(all);
      grid.appendChild(sec);
      fetchBoard(tr.id, 50).then(function (data) {
        if (view !== token) return;
        fill(ol, data, FIVE);
        if (data.total > FIVE) { all.hidden = false; all.textContent = 'SHOW ALL ' + data.total + ' ›'; }
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
    setHead(trackName(id), 'track');
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

  /* One track, everyone on it: from a time trial's results, which BACK
   * returns to. Its theme gives it the theme's colour. */
  Leaderboard.openTrack = function (id) {
    var t = themeOf(id);
    showTrack(id, -1);
    if (t >= 0) el.board.style.setProperty('--lb-theme', global.THEMES[t].accent || '');
    open();
  };

  // BACK, and Escape: one step back the way you came - from SHOW ALL to its
  // theme, from anything else out.
  function back() {
    if (view && view.kind === 'track' && view.from >= 0) showTheme(view.from);
    else Leaderboard.hideBoard();
  }

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
    RULE = el.nameRule ? el.nameRule.textContent : '';
    el.board = $('lb-board');
    el.title = $('lb-title');
    el.speed = $('lb-speed');
    el.body = $('lb-body');
    el.prev = $('lb-prev');
    el.next = $('lb-next');
    if (!el.name || !el.board) return;

    el.nameInput.addEventListener('input', nameChanged);
    el.nameForm.addEventListener('submit', function (e) { e.preventDefault(); saveName(); });
    $('lb-name-skip').addEventListener('click', closeName);
    $('lb-close').addEventListener('click', back);
    el.prev.addEventListener('click', function () { if (view && view.kind === 'theme') showTheme(view.theme - 1); });
    el.next.addEventListener('click', function () { if (view && view.kind === 'theme') showTheme(view.theme + 1); });
    // A tap on the dimmed screen round the panel closes it, as a click would expect.
    el.board.addEventListener('click', function (e) { if (e.target === el.board) Leaderboard.hideBoard(); });
    document.addEventListener('keydown', function (e) {
      if (el.name.classList.contains('show')) { if (e.key === 'Escape') closeName(); return; }
      if (!el.board.classList.contains('show') || !view) return;
      if (e.key === 'Escape') {
        back();
      } else if (view.kind === 'theme' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        showTheme(view.theme + (e.key === 'ArrowLeft' ? -1 : 1));
        e.preventDefault();
      }
    });
    // LEADERBOARD in the corner of the main menu and the trial track screen:
    // the theme the carousel was last on.
    Array.prototype.forEach.call(document.querySelectorAll('[data-lb-open]'), function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        if (global.Sound) global.Sound.play('select');
        Leaderboard.openTheme(global.Screens ? global.Screens.theme : 0);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.Leaderboard = Leaderboard;
})(typeof window !== 'undefined' ? window : globalThis);
