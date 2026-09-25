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
    if (global.Leaderboard) global.Leaderboard.hide();
    // Out of the tutorial, whichever way: put back what it displaced.
    if (name !== 'race' && global.Game && global.Game.mode === 'tutorial') global.Game.endTutorial();
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
    if (global.Sound) {
      global.Sound.music(songFor(name));
      if (name !== 'race') global.Sound.duck(1);   // a race sets its own
    }
    if (name === 'play') this.paintCards();
    if (name === 'options') this.buildLegacy();
    if (name === 'shop') this.paintShop();
    global.Input.clear();
    if (global.Abduct) global.Abduct.sync();
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
    global.TRACKS.forEach(function (t, i) { if (!claimed[t.id] && !t.tutorial) out.push(i); });
    return out;
  }

  /* The index in THEMES of the theme a track belongs to, or -1 for the
   * legacy tracks, which belong to none. */
  Screens.themeOfTrack = function (id) {
    for (var t = 0; t < THEMES.length; t++) {
      for (var k = 0; k < THEMES[t].tracks.length; k++) {
        if (THEMES[t].tracks[k].id === id) return t;
      }
    }
    return -1;
  };

  /* Which song a screen plays. A theme's song belongs to its page of the
   * carousel and to all three of its tracks, so going from the page into a
   * race - and back out again - carries on with the same tune. Everything
   * else is the menu song, bar the legacy tracks, which have their own. */
  function songFor(name) {
    if (name === 'race') {
      var track = global.TRACKS[global.Game.trackIndex];
      var t = track ? Screens.themeOfTrack(track.id) : -1;
      return t >= 0 ? THEMES[t].id : 'classic';
    }
    if (name === 'play' && !Screens.progress) return THEMES[Screens.theme].id;
    return 'menu';
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
    el.play.classList.remove('progress-page', 'help-open');
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

    // thumbnails being thrown away give their pixels back (Viewport.releaseCanvas)
    global.Viewport.releaseCanvases(el.cards);
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
    global.Viewport.releaseCanvases(grid);
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
    if (global.Sound) {
      global.Sound.play('step', dir);
      // Flicking through several themes should not start several songs:
      // the one you stop on plays.
      global.Sound.music(songFor('play'), 350);
    }
  };

  /* ---- progress ---------------------------------------------------------
   *
   * Everything on this page is READ from the medals every time it is shown -
   * Progress.medal per track, Progress.star per theme - and nothing about it
   * is stored. So it cannot drift from the cards it summarises, an old save
   * shows its true totals the first time the page opens, and a medal won a
   * minute ago is already counted when you come back to it.
   *
   * A track counts as completed once you have WON it - gold, first place.
   * Silver and bronze are still counted in the medal totals, but a track you
   * have only placed on is not finished. Only the themed tracks are counted:
   * the legacy seven are not part of the ladder. */
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
        if (m === 1) { out.gold++; out.done++; }
        else if (m === 2) out.silver++;
        else out.bronze++;
      });
      out.stars.push({ name: theme.name, star: P.star(ids) });
    });
    out.goldStars = out.stars.filter(function (s) { return s.star === 1; }).length;
    return out;
  };

  Screens.paintProgress = function () {
    var p = this.progressTotals();
    el.play.classList.add('progress-page');
    el.play.classList.remove('help-open');
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

    var stars = p.stars.map(function (s) {
      var cls = s.star ? 'earned medal-' + MEDALS[s.star] : 'unearned';
      var what = s.star ? MEDAL_NAME[s.star] + ' star' : 'no star yet';
      return '<svg class="pg-star theme-star ' + cls + '" viewBox="0 0 24 24" role="img" ' +
        'aria-label="' + s.name + ': ' + what + '"><title>' + s.name + ': ' + what + '</title>' +
        '<path d="' + STAR_PATH + '"/></svg>';
    }).join('');

    global.Viewport.releaseCanvases(el.cards);
    el.cards.innerHTML =
      '<div class="progress-board">' +
        // The visible circle is small; the button round it is thumb-sized.
        '<button class="pg-info" type="button" aria-expanded="false" aria-controls="pg-help" ' +
          'aria-label="How progress works"><span aria-hidden="true">i</span></button>' +
        '<div class="pg-help" id="pg-help" hidden>' +
          '<h3>HOW THIS WORKS</h3>' +
          '<p>A track counts as <b>completed</b> once you&rsquo;ve won it &ndash; ' +
            'first place, gold medal. Silver and bronze still add to your medal ' +
            'totals.</p>' +
          '<p>A theme&rsquo;s <b>star</b> appears once you have a medal on all three ' +
            'of its tracks, in the colour of your lowest one &ndash; so it&rsquo;s ' +
            'only gold when you&rsquo;ve won all three.</p>' +
          '<p>Wins unlock skins in the Shop, and gold stars unlock cars.</p>' +
          '<p class="pg-help-foot">Only races count here. Time trials keep their ' +
            'own lap records.</p>' +
        '</div>' +
        '<div class="pg-medals">' +
          medal('gold', 'GOLD', p.gold) + medal('silver', 'SILVER', p.silver) +
          medal('bronze', 'BRONZE', p.bronze) +
        '</div>' +
        '<div class="pg-stat">' +
          '<div class="pg-line"><span>TRACKS COMPLETED</span>' +
            '<b>' + p.done + '<i> / ' + p.tracks + '</i></b></div>' +
          '<div class="pg-bar" role="img" aria-label="' + p.done + ' of ' + p.tracks + ' tracks completed">' +
            (p.done ? '<span class="pg-seg medal-gold" style="flex-grow:' + p.done + '"></span>' : '') +
            '<span class="pg-seg pg-rest" style="flex-grow:' + (p.tracks - p.done) + '"></span>' +
          '</div>' +
        '</div>' +
        '<div class="pg-stat">' +
          '<div class="pg-line"><span>GOLD STARS</span>' +
            '<b>' + p.goldStars + '<i> / ' + THEMES.length + '</i></b></div>' +
          '<div class="pg-stars">' + stars + '</div>' +
        '</div>' +
      '</div>';

    /* The explanation opens over the panel it explains and closes on a
     * second press of the button or a press anywhere else. It is built fresh
     * with the page, so leaving the page is enough to close it. */
    var board = el.cards.querySelector('.progress-board');
    var info = el.cards.querySelector('.pg-info');
    var help = el.cards.querySelector('.pg-help');
    /* It takes the stats' place inside the panel rather than floating over
     * them: an overlay is only as big as what it covers, and on a phone lying
     * down the words did not fit in it. The panel keeps at least its current
     * height, so opening it never makes the page jump. */
    function setHelp(open) {
      // On the very shortest screens the panel holds its height outright and
      // the words scroll inside it, rather than the whole page scrolling.
      var tight = global.matchMedia && global.matchMedia('(max-height: 340px)').matches;
      var h = open ? board.offsetHeight + 'px' : '';
      board.style.minHeight = tight ? '' : h;
      board.style.height = tight ? h : '';
      board.classList.toggle('help-open', open);
      el.play.classList.toggle('help-open', open);
      help.hidden = !open;
      info.setAttribute('aria-expanded', open ? 'true' : 'false');
      info.classList.toggle('on', open);
    }
    info.addEventListener('click', function (e) {
      e.stopPropagation();
      setHelp(help.hidden);
    });
    help.addEventListener('click', function () { setHelp(false); });
    if (!Screens._helpCloser) {
      Screens._helpCloser = true;
      document.addEventListener('click', function (e) {
        var h = document.getElementById('pg-help');
        if (!h || h.hidden || e.target.closest('.pg-info')) return;
        document.querySelector('.pg-info').click();   // the one way it closes
      });
    }
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
      if (claimed[t.id] || t.tutorial) return;
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

    /* The menu sounds, for every button at once rather than one handler
     * each. A disabled button - a locked skin, a track still to come - gets
     * no click, so it makes no sound. The carousel arrows and the in-race
     * pause controls make their own (Screens.stepTheme, Game.pauseRace). */
    var OWN_SOUND = { 'theme-prev': 1, 'theme-next': 1, 'btn-home': 1, 'btn-pause-go': 1 };
    var BACK = { 'btn-quit': 1, 'btn-pause-home': 1 };
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!b || !global.Sound || OWN_SOUND[b.id]) return;
      global.Sound.play(b.hasAttribute('data-back') || BACK[b.id] ? 'back' : 'select');
    }, true);   // capture: the option buttons stop their clicks propagating
    // Sliders tick as they move, higher toward the top of their range.
    document.addEventListener('input', function (e) {
      var r = e.target;
      if (!global.Sound || !r || r.type !== 'range') return;
      var lo = parseFloat(r.min) || 0, hi = parseFloat(r.max) || 100;
      global.Sound.play('tick', hi > lo ? (parseFloat(r.value) - lo) / (hi - lo) : 0);
    }, true);

    global.addEventListener('keydown', function (e) {
      if (Screens.current !== 'play') return;
      if (e.key === 'ArrowLeft') Screens.stepTheme(-1);
      else if (e.key === 'ArrowRight') Screens.stepTheme(1);
    });
  };

  global.Screens = Screens;
})(typeof window !== 'undefined' ? window : globalThis);
