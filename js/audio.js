/* Block Racer - a few WebAudio blips. No asset files, no dependencies. */
(function (global) {
  'use strict';

  var ctx = null;
  var Sound = { muted: false };

  function ac() {
    if (!ctx) {
      var Ctor = global.AudioContext || global.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gain) {
    if (Sound.muted) return;
    var a = ac();
    if (!a) return;
    var osc = a.createOscillator();
    var g = a.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, a.currentTime);
    g.gain.setValueAtTime(gain || 0.06, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    osc.connect(g).connect(a.destination);
    osc.start();
    osc.stop(a.currentTime + dur);
  }

  Sound.unlock = function () { ac(); };
  Sound.beep = function () { tone(440, 0.12); };
  Sound.go = function () { tone(880, 0.35); };
  Sound.crash = function () { tone(70 + Math.random() * 30, 0.18, 'sawtooth', 0.10); };
  Sound.lap = function () { tone(660, 0.10); setTimeout(function () { tone(990, 0.14); }, 90); };
  Sound.finish = function () {
    [523, 659, 784, 1047].forEach(function (f, i) {
      setTimeout(function () { tone(f, 0.18, 'square', 0.07); }, i * 110);
    });
  };

  global.Sound = Sound;
})(typeof window !== 'undefined' ? window : globalThis);
