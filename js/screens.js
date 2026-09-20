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

  var SCENE_FOR = { main: 'night', options: 'night' };

  Screens.show = function (name) {
    this.current = name;
    ['main', 'options', 'play'].forEach(function (s) {
      el[s].classList.toggle('on', s === name);
    });
    document.body.classList.toggle('in-race', name === 'race');
    Backdrop.set(name === 'play' ? THEMES[Screens.theme].scene : SCENE_FOR[name] || 'night');
    if (name === 'play') this.paintCards();
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

  Screens.paintCards = function () {
    var theme = THEMES[this.theme];
    el.themeName.textContent = theme.name;
    el.themeTag.textContent = theme.tagline;
    el.themeIndex.textContent = (this.theme + 1) + ' / ' + THEMES.length;
    el.play.style.setProperty('--theme', theme.accent);

    el.cards.innerHTML = '';
    theme.tracks.forEach(function (entry) {
      var found = trackData(entry.id);
      var card = document.createElement('button');
      card.className = 'card' + (found ? '' : ' soon');
      card.innerHTML =
        '<span class="card-art"></span>' +
        '<span class="card-name">' + entry.name + '</span>' +
        '<span class="card-grade">' + (found ? entry.grade : 'COMING SOON') + '</span>';
      if (found) {
        global.Renderer.thumbnail(found.index, card.querySelector('.card-art'));
        card.addEventListener('click', function () {
          Screens.from = 'play';
          global.Game.setTrack(found.index);
          Screens.show('race');
          global.Game.startRace();
        });
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
    global.TRACKS.forEach(function (t, i) {
      var b = document.createElement('button');
      b.innerHTML = '<b>' + t.name + '</b><span>' + t.grade + '</span>';
      b.addEventListener('click', function () {
        Screens.from = 'options';
        global.Game.setTrack(i);
        Screens.show('race');
        global.Game.startRace();
      });
      el.legacyList.appendChild(b);
    });
  };

  Screens.init = function () {
    el.main = document.getElementById('screen-main');
    el.options = document.getElementById('screen-options');
    el.play = document.getElementById('screen-play');
    el.cards = document.getElementById('theme-cards');
    el.themeName = document.getElementById('theme-name');
    el.themeTag = document.getElementById('theme-tagline');
    el.themeIndex = document.getElementById('theme-index');
    el.legacyList = document.getElementById('legacy-list');

    this.buildLegacy();

    document.getElementById('btn-play').addEventListener('click', function () {
      Screens.show('play');
    });
    document.getElementById('btn-options').addEventListener('click', function () {
      Screens.show('options');
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

    global.addEventListener('keydown', function (e) {
      if (Screens.current !== 'play') return;
      if (e.key === 'ArrowLeft') Screens.stepTheme(-1);
      else if (e.key === 'ArrowRight') Screens.stepTheme(1);
    });
  };

  global.Screens = Screens;
})(typeof window !== 'undefined' ? window : globalThis);
