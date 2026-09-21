/* Block Racer - screens.
 *
 * Everything in front of the race: the front screen, the options screen and
 * the track-select carousel. The race itself is Game's; this file decides
 * which of the four things is on the display and nothing else.
 *
 * Screens are full-bleed and opaque rather than panels floating over the
 * board, because a phone in landscape leaves the board barely 360px wide and
 * a settings screen will never fit inside that however hard it is squeezed.
 */
(function (global) {
  'use strict';

  var C = global.CONFIG;
  var THEMES = global.THEMES;
  var Backdrop = global.Backdrop;

  var Screens = {
    current: null,
    theme: 0,
    // Where a race was started from, so finishing it goes back there rather
    // than dumping you at the front door.
    from: 'play'
  };

  var el = {};

  var SCENE_FOR = { main: 'night', options: 'night', mode: 'night' };

  Screens.show = function (name) {
    this.current = name;
    ['main', 'options', 'play', 'mode'].forEach(function (s) {
      el[s].classList.toggle('on', s === name);
    });
    document.body.classList.toggle('in-race', name === 'race');
    Backdrop.set(name === 'play' ? THEMES[Screens.theme].scene : SCENE_FOR[name] || 'night');
    if (name === 'play') this.paintCards();
    if (name === 'options') this.buildLegacy();
    global.Input.clear();
  };

  /* ---- track select ----------------------------------------------------
   * One theme at a time, three cards across, arrows either side. The cards
   * are built from THEMES rather than from the markup, so a fourth theme is
   * a data entry and nothing here changes. */

  function trackData(id) {
    for (var i = 0; i < global.TRACKS.length; i++) {
      if (global.TRACKS[i].id === id) return { data: global.TRACKS[i], index: i };
    }
    return null;
  }

  var MEDALS = ['', 'gold', 'silver', 'bronze'];
  var MEDAL_NAME = ['', 'GOLD', 'SILVER', 'BRONZE'];

  /* m:ss.hh, the same shape the HUD uses, so a record on a card and the clock
   * in the race read as the same number. */
  function lapTime(t) {
    var m = Math.floor(t / 60);
    var sec = t - m * 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(2);
  }

  /* Which tracks exist, in the order the play screen offers them. Themed
   * entries with no track behind them yet are skipped, so NEXT TRACK never
   * lands on a placeholder. */
  function themeOrder() {
    var out = [];
    THEMES.forEach(function (theme) {
      theme.tracks.forEach(function (entry) {
        var found = trackData(entry.id);
        if (found) out.push(found.index);
      });
    });
    return out;
  }

  /* And the legacy list, in its own order. */
  function legacyOrder() {
    var claimed = {};
    THEMES.forEach(function (theme) {
      theme.tracks.forEach(function (t) { claimed[t.id] = true; });
    });
    var out = [];
    global.TRACKS.forEach(function (t, i) { if (!claimed[t.id]) out.push(i); });
    return out;
  }

  /* Keep the carousel on whichever theme a track belongs to, so backing out
   * of a race started by NEXT TRACK lands on the right page. */
  function followTheme(index) {
    var id = global.TRACKS[index] && global.TRACKS[index].id;
    THEMES.forEach(function (theme, t) {
      theme.tracks.forEach(function (entry) {
        if (entry.id === id) Screens.theme = t;
      });
    });
  }

  Screens.race = function (index, from) {
    Screens.from = from || Screens.from;
    if (Screens.from === 'play') followTheme(index);
    global.Game.setTrack(index);
    Screens.show('race');
    global.Game.startRace();
  };

  /* The track after this one: the next in the theme, then the first of the
   * next theme, wrapping round at the end so the button is never dead.
   * Returns null when there is nowhere else to go. */
  Screens.nextTrack = function () {
    var cur = global.Game.trackIndex;
    var themed = themeOrder(), legacy = legacyOrder();
    var order = this.from === 'options' ? legacy : themed;
    // A URL can start a themed track without the carousel being involved, so
    // where the race came from is a hint rather than an answer: if this track
    // is not in that list, it is in the other one.
    if (order.indexOf(cur) < 0) order = (order === legacy) ? themed : legacy;
    var here = order.indexOf(cur);
    if (here < 0 || order.length < 2) return null;
    return order[(here + 1) % order.length];
  };

  /* Which screen a given track belongs behind. */
  Screens.homeFor = function (index) {
    return themeOrder().indexOf(index) >= 0 ? 'play' : 'options';
  };

  Screens.paintCards = function () {
    var theme = THEMES[this.theme];
    el.themeName.textContent = theme.name;
    el.themeTag.textContent = theme.tagline;
    el.themeIndex.textContent = (this.theme + 1) + ' / ' + THEMES.length;
    el.play.style.setProperty('--theme', theme.accent);
    el.playMode.textContent = global.Game.mode === 'trial' ? 'TIME TRIAL' : 'RACE';

    // A race card carries the medal; a trial card carries the lap record. The
    // two are never shown together, because they are separate achievements
    // and a card that showed both would suggest one counts towards the other.
    var trial = global.Game.mode === 'trial';

    /* The theme's star: the worst medal across all three of its tracks, or
     * nothing at all until each of them has one. Worked out from the medals
     * every time this screen is painted rather than stored, so it is right
     * by construction and upgrades itself the moment a medal does.
     *
     * A time trial has no medals, so it has no star - and the row is kept,
     * empty, rather than removed, so the cards do not jump up the screen
     * when you switch modes. */
    var ids = theme.tracks.map(function (t) { return t.id; });
    var star = trial ? 0 : global.Progress.star(ids);
    var got = trial ? 0 : global.Progress.medalled(ids);
    if (trial) {
      el.themeStar.className = 'theme-star';
      el.themeStar.innerHTML = '&nbsp;';
    } else if (star) {
      el.themeStar.className = 'theme-star medal-' + MEDALS[star];
      el.themeStar.innerHTML = '<span class="star">&#9733;</span>' +
        MEDAL_NAME[star] + ' STAR';
    } else {
      el.themeStar.className = 'theme-star unearned';
      el.themeStar.innerHTML = '<span class="star">&#9734;</span>' +
        got + ' / ' + ids.length + ' MEDALLED';
    }

    el.cards.innerHTML = '';
    theme.tracks.forEach(function (entry) {
      var found = trackData(entry.id);
      var medal = trial ? 0 : global.Progress.medal(entry.id);
      var lap = trial ? global.Progress.lapRecord(entry.id, C.speedLevel) : 0;
      var card = document.createElement('button');
      card.className = 'card' + (found ? '' : ' soon') +
                       (medal ? ' medal medal-' + MEDALS[medal] : '') +
                       (lap ? ' recorded' : '');
      card.innerHTML =
        '<span class="card-art"></span>' +
        (medal ? '<span class="card-medal">' + medal + '<sup>' +
                 (medal === 1 ? 'st' : medal === 2 ? 'nd' : 'rd') + '</sup></span>' : '') +
        (lap ? '<span class="card-record">' + lapTime(lap) + '</span>' : '') +
        '<span class="card-name">' + entry.name + '</span>' +
        '<span class="card-grade">' + (found ? entry.grade : 'COMING SOON') + '</span>';
      if (found) {
        global.Renderer.thumbnail(found.index, card.querySelector('.card-art'));
        card.addEventListener('click', function () { Screens.race(found.index, 'play'); });
      } else {
        card.disabled = true;
      }
      el.cards.appendChild(card);
    });
  };

  Screens.stepTheme = function (dir) {
    this.theme = (this.theme + dir + THEMES.length) % THEMES.length;
    Backdrop.set(THEMES[this.theme].scene);
    this.paintCards();
  };

  /* ---- the legacy list -------------------------------------------------
   * The seven tracks built before the themes. They live on the options
   * screen rather than in the carousel: they are being replaced rather than
   * offered, and the carousel is for what the game is becoming. */
  Screens.buildLegacy = function () {
    // Legacy is whatever no theme has claimed, worked out rather than listed,
    // so a track promoted into a theme leaves this list by itself.
    var claimed = {};
    THEMES.forEach(function (theme) {
      theme.tracks.forEach(function (t) { claimed[t.id] = true; });
    });

    el.legacyList.innerHTML = '';
    global.TRACKS.forEach(function (t, i) {
      if (claimed[t.id]) return;
      var medal = global.Progress.medal(t.id);
      var b = document.createElement('button');
      b.className = medal ? 'medal medal-' + MEDALS[medal] : '';
      b.innerHTML = '<b>' + t.name + '</b><span>' + t.grade +
        (medal ? ' &middot; P' + medal : '') + '</span>';
      b.addEventListener('click', function () {
        global.Game.setMode('race');
        Screens.race(i, 'options');
      });
      el.legacyList.appendChild(b);
    });
  };

  Screens.init = function () {
    el.main = document.getElementById('screen-main');
    el.options = document.getElementById('screen-options');
    el.play = document.getElementById('screen-play');
    el.mode = document.getElementById('screen-mode');
    el.cards = document.getElementById('theme-cards');
    el.themeName = document.getElementById('theme-name');
    el.themeTag = document.getElementById('theme-tagline');
    el.themeStar = document.getElementById('theme-star');
    el.themeIndex = document.getElementById('theme-index');
    el.playMode = document.getElementById('play-mode');
    el.legacyList = document.getElementById('legacy-list');

    this.buildLegacy();

    // PLAY asks how you want to drive before it asks what you want to drive
    // on, because the answer changes what the track cards have to say.
    document.getElementById('btn-play').addEventListener('click', function () {
      Screens.show('mode');
    });
    document.getElementById('btn-mode-race').addEventListener('click', function () {
      global.Game.setMode('race');
      Screens.show('play');
    });
    document.getElementById('btn-mode-trial').addEventListener('click', function () {
      global.Game.setMode('trial');
      Screens.show('play');
    });
    document.getElementById('btn-options').addEventListener('click', function () {
      Screens.show('options');   // which rebuilds the legacy rows
    });
    document.getElementById('theme-prev').addEventListener('click', function () {
      Screens.stepTheme(-1);
    });
    document.getElementById('theme-next').addEventListener('click', function () {
      Screens.stepTheme(1);
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-back]'), function (b) {
      b.addEventListener('click', function () { Screens.show(b.dataset.back); });
    });
    document.getElementById('legacy-open').addEventListener('click', function () {
      el.options.classList.toggle('show-legacy');
    });

    /* Wiping the medals is not undoable, so it takes two presses. The armed
     * state times out rather than sticking, so a stray press left on the
     * screen cannot be finished off by an accidental second one later. */
    var reset = document.getElementById('btn-reset');
    var armed = 0;
    var disarm = function () {
      armed = 0;
      reset.textContent = 'RESET DATA';
      reset.classList.remove('danger');
    };
    reset.addEventListener('click', function () {
      if (!armed) {
        armed = setTimeout(disarm, 5000);
        reset.textContent = 'PRESS AGAIN TO WIPE';
        reset.classList.add('danger');
        return;
      }
      clearTimeout(armed);
      global.Progress.clear();
      Screens.buildLegacy();       // and the cards, next time they are painted
      reset.textContent = 'DATA RESET';
      reset.classList.remove('danger');
      armed = 0;
      setTimeout(disarm, 1800);
    });

    global.addEventListener('keydown', function (e) {
      if (Screens.current !== 'play') return;
      if (e.key === 'ArrowLeft') Screens.stepTheme(-1);
      else if (e.key === 'ArrowRight') Screens.stepTheme(1);
    });
  };

  global.Screens = Screens;
})(typeof window !== 'undefined' ? window : globalThis);
