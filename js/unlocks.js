/* Block Racer - the unlock notification.
 *
 * One panel that drops in from the top of the screen when a race has just
 * won you something from the shop, holds for a moment, and goes back up.
 *
 * What was unlocked is not worked out here. The results screen asks
 * Cosmetics for a snapshot before it records the result and for the
 * difference afterwards (see Cosmetics.snapshot), and hands whatever came
 * back to Unlocks.show. This file only draws it and times it.
 *
 * ONE panel, never a stack. The third win of a theme unlocks the track's
 * skin and the theme's vehicle in the same moment, and two toasts arriving
 * together would land on top of each other - so everything one race unlocks
 * goes into the same panel as rows.
 *
 * Every timer belongs to a generation. Showing or dismissing bumps it, and a
 * callback that wakes up to find the generation has moved on does nothing.
 * Without that, the hide timer from a toast you dismissed by pressing NEXT
 * TRACK would fire three seconds later and snatch away the toast for the
 * NEXT race's unlock - or worse, a late "show" would put an old notification
 * over a screen it has nothing to do with.
 *
 * It never takes a click. `pointer-events: none` in the stylesheet, so the
 * results buttons underneath it work exactly as they would without it.
 */
(function (global) {
  'use strict';

  var HOLD = 2800;     // on screen, after the slide in
  var OUT = 380;       // the slide out, which the stylesheet also times

  var el = null;
  var gen = 0;
  var timers = [];

  function build() {
    el = document.createElement('div');
    el.id = 'unlock-toast';
    el.className = 'unlock';
    el.hidden = true;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function hide() {
    el.hidden = true;
    el.className = 'unlock';
    el.innerHTML = '';
  }

  /* One reward: its preview, its name, and where to find it. The preview is
   * painted by the same functions the shop uses, so the chip here is the chip
   * you will find there - and a vehicle is shown wearing the skin you have
   * on, the way the shop's vehicle tab shows it. */
  function row(entry) {
    var Cos = global.Cosmetics;
    var skin = entry.kind === 'skin';
    var what = skin ? 'SKIN' : 'CAR';

    var r = document.createElement('div');
    r.className = 'unlock-row ' + entry.kind;

    var art = document.createElement('canvas');
    // drawn at twice the size it is shown, so it is sharp on a phone
    var w = skin ? 92 : 124, h = skin ? 92 : 72;
    art.width = w;
    art.height = h;
    art.style.width = (w / 2) + 'px';
    art.style.height = (h / 2) + 'px';
    art.className = 'unlock-art';
    if (skin) Cos.paintSkinChip(art, entry.item);
    else Cos.paintVehicleCard(art, entry.item, Cos.equippedSkin());
    r.appendChild(art);

    var text = document.createElement('div');
    text.className = 'unlock-text';
    var line = document.createElement('p');
    line.className = 'unlock-line';
    var name = document.createElement('b');
    name.className = 'unlock-name';
    name.textContent = entry.item.name;
    line.appendChild(name);
    line.appendChild(document.createTextNode(' '));
    // One unit, so a long name on a phone wraps it whole onto the next line
    // rather than leaving "CAR" behind and "UNLOCKED!" underneath.
    var tail = document.createElement('span');
    tail.className = 'unlock-what';
    tail.textContent = what + ' UNLOCKED!';
    line.appendChild(tail);
    var sub = document.createElement('p');
    sub.className = 'unlock-sub';
    sub.textContent = 'Available now in the Shop';
    text.appendChild(line);
    text.appendChild(sub);
    r.appendChild(text);
    return r;
  }

  var Unlocks = {};

  /* `entries` is what Cosmetics.unlockedSince returned: an empty list means
   * the race unlocked nothing, which is most races, and shows nothing. */
  Unlocks.show = function (entries) {
    if (!entries || !entries.length || !global.Cosmetics) return;
    if (!el) build();
    Unlocks.dismiss();
    var mine = ++gen;

    entries.forEach(function (e) { el.appendChild(row(e)); });
    var vehicle = entries.some(function (e) { return e.kind === 'vehicle'; });
    el.className = 'unlock' + (entries.length > 1 ? ' multi' : '') +
                   (vehicle ? ' has-vehicle' : '');
    el.hidden = false;

    // Read a layout property so the browser commits the off-screen position
    // before `in` is added; otherwise it starts where it ends and never moves.
    void el.offsetHeight;
    el.classList.add('in');

    timers.push(setTimeout(function () {
      if (mine !== gen) return;
      el.classList.remove('in');
      el.classList.add('out');
      timers.push(setTimeout(function () {
        if (mine !== gen) return;
        hide();
      }, OUT));
    }, HOLD));
  };

  /* Gone at once, no animation. Called on every change of screen - BACK,
   * RACE AGAIN, NEXT TRACK, restart - because a notification about the race
   * you have just left has no business on top of the one you are starting. */
  Unlocks.dismiss = function () {
    gen++;
    clearTimers();
    if (el && !el.hidden) hide();
  };

  Unlocks.visible = function () { return !!(el && !el.hidden); };

  global.Unlocks = Unlocks;
})(typeof window !== 'undefined' ? window : globalThis);
