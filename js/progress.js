/* Block Racer - what you have won.
 *
 * Two records, kept apart from each other on purpose.
 *
 * MEDALS are a race result: one number per track, the best finishing position
 * you have ever managed on it, and only if that was a podium. The
 * track-select screen turns it into a bronze, silver or gold border.
 *
 * LAP RECORDS are a time trial result: your fastest single lap, in seconds.
 * They share nothing with the medals - not the storage key, not the API, not
 * the reading code - because they are not the same achievement and a time
 * trial has no positions to be a podium in.
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
  var LAP_KEY = 'blockracer.laps.v1';
  var PODIUM = 3;

  var Progress = { best: {}, laps: {} };

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

  /* ---- theme stars ----------------------------------------------------
   *
   * One per theme, from the medals on its three tracks. The star is the
   * WORST of the three, and there is no star at all until every track has a
   * medal: gold, gold, silver is a silver star, and gold, gold, nothing is
   * no star.
   *
   * It is DERIVED, not stored, and that is the whole design. A star is a
   * pure function of medals that are already saved, so it cannot drift out
   * of step with them, it upgrades itself the instant a medal improves, and
   * RESET DATA clears it by clearing what it is made of. Writing a second
   * number to storage would be a second thing to keep in sync and a second
   * thing to get wrong - the medals ARE the save file.
   */
  Progress.star = function (trackIds) {
    if (!trackIds || !trackIds.length) return 0;
    var worst = 0;
    for (var i = 0; i < trackIds.length; i++) {
      var m = this.medal(trackIds[i]);
      if (!m) return 0;            // one track short and the theme has no star
      if (m > worst) worst = m;    // 1 gold, 2 silver, 3 bronze: higher is worse
    }
    return worst;
  };

  /* ---- lap records ----------------------------------------------------
   *
   * Keyed by track AND game speed, because they are not comparable across
   * speeds: a lap set at SWEAT is twice as quick as the same driving at
   * BEGINNER, and a single stored number would mean one run at the top speed
   * permanently retires the track. A record therefore belongs to the setting
   * it was set at, and the card shows the one for the speed you are about to
   * drive at. */
  function lapKey(trackId, speedLevel) {
    return trackId + '@' + speedLevel;
  }

  function loadLaps() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(LAP_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      var clean = {};
      Object.keys(parsed).forEach(function (k) {
        var t = parseFloat(parsed[k]);
        // A lap is a positive number of seconds. An hour is not a lap time;
        // it is a corrupt or hand-edited entry.
        if (t > 0 && t < 3600) clean[k] = t;
      });
      return clean;
    } catch (e) {
      return {};
    }
  }

  function saveLaps() {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(LAP_KEY, JSON.stringify(Progress.laps));
      }
    } catch (e) {
      /* out of quota, or storage blocked: the session keeps its records anyway */
    }
  }

  /* Seconds, or 0 for no record yet. */
  Progress.lapRecord = function (trackId, speedLevel) {
    return this.laps[lapKey(trackId, speedLevel)] || 0;
  };

  /* True when this lap was quicker than anything before it. */
  Progress.recordLap = function (trackId, speedLevel, seconds) {
    if (!trackId || !(seconds > 0)) return false;
    var k = lapKey(trackId, speedLevel);
    var had = this.laps[k];
    if (had && had <= seconds) return false;
    this.laps[k] = seconds;
    saveLaps();
    return true;
  };

  /* Both records go, because RESET DATA on the options screen says it wipes
   * your data and leaving half of it behind would be a lie. */
  Progress.clear = function () {
    this.best = {};
    this.laps = {};
    save();
    saveLaps();
    // A ghost is a record's own lap; with the record gone it belongs to
    // nothing, and would be refused on load anyway - but RESET DATA says it
    // wipes your data, so it goes rather than lingering unreadable.
    if (global.Ghost) global.Ghost.clearAll();
  };

  Progress.best = load();
  Progress.laps = loadLaps();
  global.Progress = Progress;
})(typeof window !== 'undefined' ? window : globalThis);
