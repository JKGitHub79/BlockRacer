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
    // On the PROGRESS page rather than a theme. `theme` is left pointing at
    // the last theme shown, so anything that reads THEMES[theme] stays safe.
    progress: false,
    // Where a race was started from, so finishing it goes back there rather
    // than dumping you at the front door.
    from: 'play'
  };

  var el = {};

  var SCENE_FOR = { main: 'night', options: 'night', mode: 'night', shop: 'garage' };

  Screens.show = function (name) {
    // Every way out of a result - BACK, RACE AGAIN, NEXT TRACK, restart -
    // comes through here, so this is the one place an unlock notification
    // is taken down early.
    if (global.Unlocks) global.Unlocks.dismiss();
    this.current = name;
    ['main', 'options', 'play', 'mode', 'shop'].forEach(function (s) {
      el[s].classList.toggle('on', s === name);
    });
    /* The board is sized to the space the stage has, and `in-race` is one of
     * the things that decides how much space that is - upright it takes the
     * body's side padding away so the board can reach the edge of the screen.
     * The class therefore has to be on BEFORE anything measures, and it goes
     * on after Game.setTrack has already fitted once. Fit again, here, where
     * the layout is the one the race will actually be played in. */
    document.body.classList.toggle('in-race', name === 'race');
    if (name === 'race' && global.Renderer) global.Renderer.fit();
    Backdrop.set(name === 'play' ? playScene() : SCENE_FOR[name] || 'night');
    if (name === 'play') this.paintCards();
    if (name === 'options') this.buildLegacy();
    if (name === 'shop') this.paintShop();
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
        if (entry.id === id) { Screens.theme = t; Screens.progress = false; }
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

  // The progress page stands on the plain night sky of the menus rather than
  // a landscape: it belongs to no theme, and should not look like one.
  function playScene() {
    return Screens.progress ? 'night' : THEMES[Screens.theme].scene;
  }

  Screens.paintCards = function () {
    if (this.progress) return this.paintProgress();
    el.play.classList.remove('progress-page');
    el.themeIndexLabel.textContent = 'THEME';
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
    /* Filled and coloured once every track in the theme has a medal, hollow
     * until then. The colour is the whole message - the word "GOLD" next to
     * a gold star is the star saying its own name - so the label is only
     * there for a screen reader, which cannot see the colour.
     *
     * setAttribute rather than .className: on an SVG element className is an
     * SVGAnimatedString and assigning a string to it silently does nothing. */
    el.themeStar.setAttribute('class',
      'theme-star' + (star ? ' earned medal-' + MEDALS[star] : ' unearned'));
    el.themeStar.setAttribute('aria-label', star
      ? MEDAL_NAME[star] + ' star for ' + theme.name
      : 'no star for ' + theme.name + ' yet');
    // A time trial has no medals, so it has no star at all.
    el.themeStar.style.display = trial ? 'none' : '';

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

  /* ---- shop ------------------------------------------------------------
   *
   * Built from Cosmetics every time it is shown rather than once at boot,
   * because what is unlocked is a function of the medals and the medals
   * change while you are playing. Coming back from a race you have just won
   * therefore shows the skin already unlocked, with no event to wire up and
   * nothing to invalidate.
   */
  Screens.shopTab = 'skins';

  // The last item of each theme's run, which is the one worth crossing the
  // screen for. Purely a look: they unlock the same way as the rest.
  var PRESTIGE = { gold: 1, lava: 1, void: 1, rainbow: 1, galaxy: 1, alien: 1,
                   chrome: 1, neon: 1, saucer: 1, racer: 1, classic: 1 };

  function shopTile(opts) {
    var b = document.createElement('button');
    b.className = 'shop-item' +
      (opts.locked ? ' locked' : '') +
      (opts.equipped ? ' on' : '') +
      (PRESTIGE[opts.id] ? ' prestige' : '');
    var art = document.createElement('canvas');
    art.width = opts.w;
    art.height = opts.h;
    art.style.width = (opts.w / 2) + 'px';
    art.style.height = (opts.h / 2) + 'px';
    b.appendChild(art);
    var name = document.createElement('span');
    name.className = 'shop-name';
    name.textContent = opts.name;
    b.appendChild(name);
    if (opts.caption) {
      var cap = document.createElement('span');
      cap.className = 'shop-cap';
      if (opts.accent) cap.style.setProperty('--theme', opts.accent);
      cap.textContent = opts.caption;
      b.appendChild(cap);
    }
    var line = document.createElement('span');
    line.className = opts.locked ? 'shop-need' : 'shop-state';
    line.textContent = opts.locked ? opts.need : (opts.equipped ? 'EQUIPPED' : 'EQUIP');
    b.appendChild(line);
    if (opts.locked) {
      b.disabled = true;
      b.setAttribute('aria-label', opts.name + ' - locked. ' + opts.need);
    } else {
      b.addEventListener('click', opts.onPick);
    }
    return { button: b, art: art };
  }

  function themeHeading(text, accent) {
    var h = document.createElement('p');
    h.className = 'shop-head';
    h.textContent = text;
    if (accent) h.style.setProperty('--theme', accent);
    return h;
  }

  Screens.paintShop = function () {
    var Cos = global.Cosmetics;
    var grid = el.shopGrid;
    var skins = this.shopTab === 'skins';
    grid.innerHTML = '';
    grid.className = 'shop-grid' + (skins ? '' : ' vehicles');
    Array.prototype.forEach.call(el.shopTabs.children, function (b) {
      b.classList.toggle('on', (b.dataset.tab === 'skins') === skins);
    });

    var list = skins ? Cos.SKINS : Cos.VEHICLES;
    var equippedId = (skins ? Cos.equippedSkin() : Cos.equippedVehicle()).id;
    var unlocked = 0;

    /* The runs are labelled by theme, so the grid reads as the ladder it is
     * rather than as thirty unrelated circles. The default sits under its
     * own heading because it belongs to no theme and is never locked. */
    var heads = {}, i;
    THEMES.forEach(function (t) {
      (skins ? t.tracks.map(function (x) { return x.id; }) : [t.id])
        .forEach(function (key) { heads[key] = t; });
    });

    /* Both tabs carry the theme as a caption on the tile.
     *
     * Skins had a full-width heading per theme, which reads well but costs a
     * row break every three tiles: on anything wider than three columns -
     * which is every screen but a phone held upright - that left most of
     * each row empty while the vehicles tab beside it filled the width. The
     * caption says the same thing, in the same place the vehicle tab already
     * said it, and the grid fills. The order is still the ladder's. */
    list.forEach(function (item) {
      var locked = !(skins ? Cos.skinUnlocked(item) : Cos.vehicleUnlocked(item));
      if (!locked) unlocked++;
      var key = skins ? item.track : item.theme;
      var head = key ? heads[key] : null;
      var label = head ? head.name : 'ALWAYS YOURS';
      var tile = shopTile({
        id: item.id,
        name: item.name,
        locked: locked,
        equipped: item.id === equippedId,
        caption: label,
        accent: head && head.accent,
        need: skins ? Cos.skinRequirement(item) : Cos.vehicleRequirement(item),
        w: skins ? 112 : 228,
        h: skins ? 112 : 124,
        onPick: function () {
          if (skins) Cos.equipSkin(item.id); else Cos.equipVehicle(item.id);
          Screens.paintShop();
        }
      });
      grid.appendChild(tile.button);
      if (skins) Cos.paintSkinChip(tile.art, item);
      else Cos.paintVehicleCard(tile.art, item, Cos.equippedSkin());
    });

    el.shopCount.textContent = unlocked + ' OF ' + list.length + ' UNLOCKED';
  };

  /* The carousel is the ten themes plus one more stop, PROGRESS, at the
   * position after the last theme. Because the carousel wraps, that one slot
   * is exactly "between Alien and Forest": right from Alien lands on it, and
   * right again lands on Forest. */
  Screens.stepTheme = function (dir) {
    var stops = THEMES.length + 1;
    var at = this.progress ? THEMES.length : this.theme;
    at = (at + dir + stops) % stops;
    this.progress = at === THEMES.length;
    if (!this.progress) this.theme = at;
    Backdrop.set(playScene());
    this.paintCards();
  };

  /* ---- progress ---------------------------------------------------------
   *
   * Everything on this page is READ from the medals every time it is shown -
   * Progress.medal per track, Progress.star per theme - and nothing about it
   * is stored. So it cannot drift from the cards it summarises, an old save
   * shows its true totals the first time the page opens, and a medal won a
   * minute ago is already counted when you come back to it.
   *
   * A track counts as completed once it has a medal on it: a podium is the
   * only result the game keeps, so it is the only one this page can count.
   * Only the themed tracks are counted - the legacy seven are not part of
   * the ladder. */
  var STAR_PATH = 'M12 2.2 15.1 8.5 22 9.5l-5 4.9 1.2 6.9L12 18l-6.2 3.3L7 14.4l-5-4.9 6.9-1z';

  Screens.progressTotals = function () {
    var P = global.Progress;
    var out = { gold: 0, silver: 0, bronze: 0, done: 0, tracks: 0, stars: [] };
    THEMES.forEach(function (theme) {
      var ids = theme.tracks.map(function (t) { return t.id; })
        .filter(function (id) { return !!trackData(id); });
      ids.forEach(function (id) {
        var m = P.medal(id);
        out.tracks++;
        if (!m) return;
        out.done++;
        if (m === 1) out.gold++; else if (m === 2) out.silver++; else out.bronze++;
      });
      out.stars.push({ name: theme.name, star: P.star(ids) });
    });
    out.goldStars = out.stars.filter(function (s) { return s.star === 1; }).length;
    return out;
  };

  Screens.paintProgress = function () {
    var p = this.progressTotals();
    el.play.classList.add('progress-page');
    el.play.style.setProperty('--theme', '#dfe7f7');
    el.playMode.textContent = 'OVERALL';
    el.themeName.textContent = 'PROGRESS';
    el.themeTag.textContent = 'Every podium and every star, across all ten themes';
    el.themeStar.style.display = 'none';
    el.themeIndexLabel.textContent = '';
    el.themeIndex.textContent = 'PROGRESS';

    function medal(kind, label, n) {
      return '<div class="pg-medal medal-' + kind + '">' +
        '<span class="pg-disc" aria-hidden="true"></span>' +
        '<b>' + n + '</b><span class="pg-label">' + label + '</span></div>';
    }
    // The completion bar is split by medal, so the three totals above it can
    // be read off it at a glance as well.
    function seg(kind, n) {
      return n ? '<span class="pg-seg medal-' + kind + '" style="flex-grow:' + n + '"></span>' : '';
    }
    var stars = p.stars.map(function (s) {
      var cls = s.star ? 'earned medal-' + MEDALS[s.star] : 'unearned';
      var what = s.star ? MEDAL_NAME[s.star] + ' star' : 'no star yet';
      return '<svg class="pg-star theme-star ' + cls + '" viewBox="0 0 24 24" role="img" ' +
        'aria-label="' + s.name + ': ' + what + '"><title>' + s.name + ': ' + what + '</title>' +
        '<path d="' + STAR_PATH + '"/></svg>';
    }).join('');

    el.cards.innerHTML =
      '<div class="progress-board">' +
        '<div class="pg-medals">' +
          medal('gold', 'GOLD', p.gold) + medal('silver', 'SILVER', p.silver) +
          medal('bronze', 'BRONZE', p.bronze) +
        '</div>' +
        '<div class="pg-stat">' +
          '<div class="pg-line"><span>TRACKS COMPLETED</span>' +
            '<b>' + p.done + '<i> / ' + p.tracks + '</i></b></div>' +
          '<div class="pg-bar" role="img" aria-label="' + p.done + ' of ' + p.tracks + ' tracks completed">' +
            seg('gold', p.gold) + seg('silver', p.silver) + seg('bronze', p.bronze) +
            '<span class="pg-seg pg-rest" style="flex-grow:' + (p.tracks - p.done) + '"></span>' +
          '</div>' +
        '</div>' +
        '<div class="pg-stat">' +
          '<div class="pg-line"><span>GOLD STARS</span>' +
            '<b>' + p.goldStars + '<i> / ' + THEMES.length + '</i></b></div>' +
          '<div class="pg-stars">' + stars + '</div>' +
        '</div>' +
      '</div>';
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
    el.shop = document.getElementById('screen-shop');
    el.shopGrid = document.getElementById('shop-grid');
    el.shopTabs = document.getElementById('shop-tabs');
    el.shopCount = document.getElementById('shop-count');
    el.cards = document.getElementById('theme-cards');
    el.themeName = document.getElementById('theme-name');
    el.themeTag = document.getElementById('theme-tagline');
    el.themeStar = document.getElementById('theme-star');
    el.themeIndex = document.getElementById('theme-index');
    el.themeIndexLabel = document.getElementById('theme-index-label');
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
    document.getElementById('btn-shop').addEventListener('click', function () {
      Screens.show('shop');      // which repaints from the medals
    });
    Array.prototype.forEach.call(el.shopTabs.children, function (b) {
      b.addEventListener('click', function () {
        Screens.shopTab = b.dataset.tab;
        Screens.paintShop();
      });
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
