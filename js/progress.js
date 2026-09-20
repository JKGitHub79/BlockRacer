/* Block Racer - what you have won.
 *
 * One number per track: the best finishing position you have ever managed on
 * it, and only if that was a podium. The track-select screen turns it into a
 * bronze, silver or gold border.
 *
 * Only improvements are written. Finishing fourth after a win does not take
 * the gold away, and neither does finishing second - a medal is the high-water
 * mark, not the last result.
 *
 * Storage is localStorage, which is allowed to be missing, full, or to throw
 * on read in a private window or with site data blocked. Every access is
 * wrapped, and a failure means the medals do not persist - never that the game
 * stops. The in-memory copy is the one the screen reads, so a session still
 * shows what you won in it even when nothing can be saved.
 */
(function (global) {
  'use strict';

  var KEY = 'blockracer.medals.v1';
  var PODIUM = 3;

  var Progress = { best: {} };

  function load() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      // Whatever is in storage was put there by an older version of this file
      // or by hand; take only what still makes sense as a podium place.
      var clean = {};
      Object.keys(parsed).forEach(function (id) {
        var place = parseInt(parsed[id], 10);
        if (place >= 1 && place <= PODIUM) clean[id] = place;
      });
      return clean;
    } catch (e) {
      return {};
    }
  }

  function save() {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(KEY, JSON.stringify(Progress.best));
      }
    } catch (e) {
      /* out of quota, or storage blocked: the session keeps its medals anyway */
    }
  }

  /* 1, 2 or 3 for a medal, 0 for nothing yet. */
  Progress.medal = function (trackId) {
    return this.best[trackId] || 0;
  };

  /* Returns true when this result was an improvement, so the caller can say
   * so rather than having to work it out. */
  Progress.record = function (trackId, place) {
    if (!trackId || !(place >= 1) || place > PODIUM) return false;
    var had = this.best[trackId];
    if (had && had <= place) return false;
    this.best[trackId] = place;
    save();
    return true;
  };

  Progress.clear = function () {
    this.best = {};
    save();
  };

  Progress.best = load();
  global.Progress = Progress;
})(typeof window !== 'undefined' ? window : globalThis);
