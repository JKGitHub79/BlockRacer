/* Block Racer - music and sound effects. WebAudio only: no asset files, no
 * dependencies, nothing fetched.
 *
 * The graph is built once, the first time the player touches the page:
 *
 *   song voices -> song gain -> muffle -\
 *   (each song fades itself)             > music bus -> duck -\
 *   a place (see PLACES) ---------------/                     > master -> limiter -> out
 *   effect voices ------------------------------> sfx bus ------/
 *
 * The two buses are the two volume sliders. `duck` pulls the music down
 * under the countdown, the pause menu and the finishing fanfare. `master` is
 * the M key.
 *
 * Browsers only let audio start from a user gesture, and Safari is the
 * strictest about which ones: see unlock() below. Until the first gesture
 * nothing is created at all - so nothing is logged about blocked autoplay -
 * and whatever the game asked for in the meantime (the menu song, usually) is
 * remembered and starts then.
 *
 * Songs live in music.js as data. Every sound here is written against a
 * context and an output passed in, rather than the live ones, so the tests
 * can render any of it offline and measure it. */
(function (global) {
  'use strict';

  var Ctor = global.AudioContext || global.webkitAudioContext;
  var SONGS = global.MUSIC ? global.MUSIC.songs : {};
  var SCALES = global.MUSIC ? global.MUSIC.scales : {};

  var MUSIC_LEVEL = 0.5;      // the music bus at 100%
  var SFX_LEVEL = 0.9;        // the effects bus at 100%
  var LOOKAHEAD = 0.25;       // seconds of music scheduled ahead of the clock
  var PUMP_MS = 50;           // how often the scheduler tops that up
  var FADE_IN = 1.0, FADE_OUT = 0.8;
  var SILENT = 0.0001;        // exponential ramps cannot reach zero

  var ctx = null, master = null, musicBus = null, sfxBus = null, duck = null, muffler = null;
  var Sound = { muted: false, musicVolume: 60, sfxVolume: 80 };

  /* ---- building blocks ----------------------------------------------- */

  function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  // An overtone above what the context can represent would only alias.
  function audible(a, f) { return f < a.sampleRate * 0.45; }

  // A slider position to a gain. Squared, because loudness is heard on a
  // curve: a linear slider does nearly everything in its bottom quarter.
  function level(v) { var x = Math.max(0, Math.min(100, v)) / 100; return x * x; }

  // One second of white noise per context, shared by every drum and effect.
  function noiseBuffer(a) {
    if (a.__brNoise) return a.__brNoise;
    var len = Math.floor(a.sampleRate);
    var b = a.createBuffer(1, len, a.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    a.__brNoise = b;
    return b;
  }

  // Attack to `peak`, decay to `peak * sustain`, hold until `dur`, release.
  // A sustain of 0 makes it percussive: attack then decay and done. Returns
  // the time the sound is over.
  function envelope(p, t, peak, at, dec, sus, dur, rel) {
    p.setValueAtTime(SILENT, t);
    p.linearRampToValueAtTime(peak, t + at);
    if (!(sus > 0)) {
      p.exponentialRampToValueAtTime(SILENT, t + at + dec);
      return t + at + dec;
    }
    var held = Math.max(t + at + dec, t + dur);
    p.exponentialRampToValueAtTime(peak * sus, t + at + dec);
    p.setValueAtTime(peak * sus, held);
    p.exponentialRampToValueAtTime(SILENT, held + rel);
    return held + rel;
  }

  // A soft clip, made once per context.
  function tanhCurve(a) {
    if (!a.__brShaper) {
      var n = 1024, curve = new Float32Array(n);
      for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(x * 6); }
      a.__brShaper = curve;
    }
    return a.__brShaper;
  }

  // Take the voice's nodes out of the graph once its last source has ended.
  function tidy(src, nodes) {
    src.onended = function () {
      for (var i = 0; i < nodes.length; i++) {
        try { nodes[i].disconnect(); } catch (e) { /* already gone */ }
      }
    };
  }

  /* A tone: one oscillator, optionally gliding from f to f2, through its own
   * envelope. The basic unit of nearly every effect. */
  function blip(a, out, t, o) {
    var osc = a.createOscillator();
    var g = a.createGain();
    var dur = o.dur;
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide || dur));
    envelope(g.gain, t, o.gain, o.at || 0.004, dur, 0, dur, 0);
    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.03);
    tidy(osc, [osc, g]);
  }

  /* Filtered noise: hats, snares, tyres, impacts. */
  function hiss(a, out, t, o) {
    var src = a.createBufferSource();
    var f = a.createBiquadFilter();
    var g = a.createGain();
    src.buffer = noiseBuffer(a);
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.f, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
    f.Q.setValueAtTime(o.q || 1, t);
    envelope(g.gain, t, o.gain, o.at || 0.002, o.dur, 0, o.dur, 0);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + o.dur + 0.03);
    tidy(src, [src, f, g]);
  }

  // A struck bell: a sine with two inharmonic partials, long decay.
  function bell(a, out, t, f, gain, dur) {
    blip(a, out, t, { type: 'sine', f: f, dur: dur, gain: gain });
    [[2.76, 0.5, 0.3], [5.4, 0.25, 0.1]].forEach(function (p) {
      if (audible(a, f * p[0])) blip(a, out, t, { type: 'sine', f: f * p[0], dur: dur * p[1], gain: gain * p[2] });
    });
  }

  /* ---- instruments ----------------------------------------------------
   *
   * waves: [oscillator type, relative gain, detune in cents, frequency ratio]
   * filter: lowpass { f cutoff, env extra cutoff at the attack, q, decay }
   * vib: [rate Hz, depth cents]
   * a d s r: the envelope; level: the instrument's loudness. */
  var INST = {
    sub:     { waves: [['sine', 1], ['triangle', 0.35]],
               a: 0.005, d: 0.2, s: 0.7, r: 0.06, level: 0.42 },
    bass:    { waves: [['sawtooth', 1]], filter: { f: 380, env: 900, q: 5, decay: 0.12 },
               a: 0.004, d: 0.12, s: 0.6, r: 0.05, level: 0.3 },
    sqbass:  { waves: [['square', 1]], filter: { f: 300, env: 1300, q: 8, decay: 0.09 },
               a: 0.003, d: 0.1, s: 0.5, r: 0.04, level: 0.24 },
    pluck:   { waves: [['triangle', 1]], a: 0.002, d: 0.28, s: 0, level: 0.22 },
    marimba: { waves: [['sine', 1], ['sine', 0.25, 0, 4]], a: 0.002, d: 0.3, s: 0, level: 0.3 },
    bell:    { waves: [['sine', 1], ['sine', 0.3, 0, 2.76], ['sine', 0.12, 0, 5.4]],
               a: 0.003, d: 1.3, s: 0, level: 0.16 },
    oud:     { waves: [['sawtooth', 1]], filter: { f: 1400, env: 1200, q: 2, decay: 0.1 },
               a: 0.002, d: 0.3, s: 0, level: 0.16 },
    flute:   { waves: [['triangle', 1], ['sine', 0.4, 0, 2]], vib: [5, 6],
               a: 0.03, d: 0.1, s: 0.8, r: 0.12, level: 0.2 },
    reed:    { waves: [['square', 1]], filter: { f: 1300, q: 1 }, vib: [5.5, 10],
               a: 0.02, d: 0.1, s: 0.8, r: 0.1, level: 0.13 },
    lead:    { waves: [['square', 1]], filter: { f: 2600, q: 1 },
               a: 0.008, d: 0.12, s: 0.6, r: 0.08, level: 0.11 },
    saw:     { waves: [['sawtooth', 1, -7], ['sawtooth', 1, 7]], filter: { f: 2200, q: 1 },
               a: 0.01, d: 0.15, s: 0.7, r: 0.1, level: 0.08 },
    chip:    { waves: [['square', 1]], a: 0.002, d: 0.1, s: 0.5, r: 0.03, level: 0.08 },
    wobble:  { waves: [['square', 1]], filter: { f: 1500, q: 6 }, vib: [7, 35],
               a: 0.01, d: 0.1, s: 0.7, r: 0.08, level: 0.1 },
    sine:    { waves: [['sine', 1], ['triangle', 0.2]], vib: [4.5, 5],
               a: 0.04, d: 0.2, s: 0.8, r: 0.25, level: 0.24 },
    pad:     { waves: [['sawtooth', 1, -8], ['sawtooth', 1, 8]], filter: { f: 800, q: 0.7 },
               a: 0.35, d: 0.4, s: 0.8, r: 0.5, level: 0.035 },
    // Slow and low: a held tone that swells in and hangs on.
    drone:   { waves: [['sine', 1], ['triangle', 0.3, -6], ['sine', 0.15, 5, 2]],
               filter: { f: 480, q: 0.5 }, a: 2.5, d: 0.5, s: 0.9, r: 3, level: 0.16 },
    // A wide, slow wobble, like a theremin a long way off.
    theremin: { waves: [['sine', 1], ['sine', 0.15, 0, 2]], vib: [2.6, 40],
               a: 0.8, d: 0.4, s: 0.8, r: 1.8, level: 0.08 },
    // A short electronic ping with a quick flutter, into the echo.
    ping:    { waves: [['sine', 1], ['sine', 0.25, 0, 3.01]], vib: [9, 8],
               a: 0.004, d: 1.1, s: 0, level: 0.05 },
    // A struck glass: a single high tone with one inharmonic partial.
    glass:   { waves: [['sine', 1], ['sine', 0.22, 0, 2.76]],
               a: 0.02, d: 3.2, s: 0, level: 0.07 },
    stab:    { waves: [['sawtooth', 1], ['square', 0.5, 5]],
               filter: { f: 1800, env: 1500, q: 3, decay: 0.1 },
               a: 0.003, d: 0.15, s: 0, level: 0.06 }
  };

  function note(a, out, name, midi, t, dur, vel) {
    var I = INST[name];
    if (!I) return;
    var f = hz(midi);
    var g = a.createGain();
    var end = envelope(g.gain, t, I.level * (vel || 1), I.a, I.d, I.s, dur, I.r || 0.05);
    var nodes = [g], input = g;
    g.connect(out);
    if (I.filter) {
      var fl = a.createBiquadFilter();
      fl.type = 'lowpass';
      fl.Q.setValueAtTime(I.filter.q || 1, t);
      if (I.filter.env) {
        fl.frequency.setValueAtTime(I.filter.f + I.filter.env, t);
        fl.frequency.exponentialRampToValueAtTime(I.filter.f, t + I.filter.decay);
      } else {
        fl.frequency.setValueAtTime(I.filter.f, t);
      }
      fl.connect(g);
      nodes.push(fl);
      input = fl;
    }
    var depth = null, lfo = null;
    if (I.vib) {
      lfo = a.createOscillator();
      depth = a.createGain();
      lfo.frequency.setValueAtTime(I.vib[0], t);
      depth.gain.setValueAtTime(f * (Math.pow(2, I.vib[1] / 1200) - 1), t);
      lfo.connect(depth);
      lfo.start(t);
      lfo.stop(end + 0.02);
      nodes.push(lfo, depth);
    }
    var last = null;
    for (var i = 0; i < I.waves.length; i++) {
      var w = I.waves[i];
      if (i > 0 && !audible(a, f * (w[3] || 1))) continue;
      var o = a.createOscillator();
      var wg = a.createGain();
      o.type = w[0];
      o.frequency.setValueAtTime(f * (w[3] || 1), t);
      if (w[2]) o.detune.setValueAtTime(w[2], t);
      wg.gain.setValueAtTime(w[1], t);
      if (depth) depth.connect(o.frequency);
      o.connect(wg);
      wg.connect(input);
      o.start(t);
      o.stop(end + 0.02);
      nodes.push(o, wg);
      last = o;
    }
    tidy(last, nodes);
  }

  /* ---- drums ---------------------------------------------------------- */

  var DRUM = {
    kick: function (a, out, t, v) {
      blip(a, out, t, { type: 'sine', f: 150, f2: 45, glide: 0.12, dur: 0.3, gain: 0.8 * v, at: 0.002 });
    },
    snare: function (a, out, t, v) {
      hiss(a, out, t, { filter: 'highpass', f: 1200, dur: 0.16, gain: 0.32 * v });
      blip(a, out, t, { type: 'triangle', f: 185, dur: 0.08, gain: 0.25 * v });
    },
    hat: function (a, out, t, v, open) {
      hiss(a, out, t, { filter: 'highpass', f: 7000, dur: open ? 0.25 : 0.045, gain: 0.1 * v });
    },
    clap: function (a, out, t, v) {
      for (var i = 0; i < 3; i++) {
        hiss(a, out, t + i * 0.012, { f: 1400, q: 1.5, dur: i === 2 ? 0.15 : 0.02, gain: 0.3 * v });
      }
    },
    tom: function (a, out, t, v) {
      blip(a, out, t, { type: 'sine', f: 210, f2: 110, dur: 0.22, gain: 0.45 * v });
    },
    shaker: function (a, out, t, v) {
      hiss(a, out, t, { f: 6500, q: 1, dur: 0.06, gain: 0.1 * v, at: 0.01 });
    },
    metal: function (a, out, t, v) {
      blip(a, out, t, { type: 'square', f: 540, dur: 0.1, gain: 0.05 * v });
      blip(a, out, t, { type: 'square', f: 813, dur: 0.12, gain: 0.04 * v });
      hiss(a, out, t, { filter: 'highpass', f: 5000, dur: 0.05, gain: 0.08 * v });
    }
  };

  /* ---- songs ---------------------------------------------------------- */

  var STEPS = 256;            // 16 bars of sixteenths: one pass of any song

  function phrase(str) {
    var tok = str.trim().split(/\s+/), out = [];
    for (var i = 0; i < tok.length; i++) {
      out.push(null);
      if (tok[i] === '.' || tok[i] === '_') continue;
      var len = 1;
      while (tok[i + len] === '_') len++;
      out[i] = { deg: parseInt(tok[i], 10), len: len };
    }
    return out;
  }

  function line(pat) {
    var out = [];
    for (var i = 0; i < 16; i++) {
      var ch = pat.charAt(i);
      if ('xo53'.indexOf(ch) < 0) { out.push(null); continue; }
      var len = 1;
      while (pat.charAt(i + len) === '-') len++;
      out.push({ ch: ch, len: len });
    }
    return out;
  }

  // Parsed once per song, the first time it plays.
  function compile(song) {
    if (song._c) return song._c;
    var c = { scale: SCALES[song.scale], step: 60 / song.bpm / 4, lead: {},
              tones: song.sevenths ? 4 : 3, arpAt: [], arpN: 0 };
    if (song.lead) {
      ['A', 'B'].forEach(function (k) { if (song.lead[k]) c.lead[k] = phrase(song.lead[k]); });
    }
    c.bass = song.bass ? line(song.bass.pat) : null;
    if (song.arp) {
      for (var i = 0; i < 16; i++) {
        c.arpAt.push(c.arpN);
        if (song.arp.pat.charAt(i) === 'x') c.arpN++;
      }
    }
    song._c = c;
    return c;
  }

  function pitch(song, c, deg, oct) {
    var n = c.scale.length, o = Math.floor(deg / n);
    return song.root + 12 * ((oct || 0) + o) + c.scale[deg - o * n];
  }

  // The k-th note of the chord on degree `cd`: 0 root, 1 third, 2 fifth, and
  // on up through the octaves.
  function tone(c, cd, k) {
    return cd + 2 * (k % c.tones) + 7 * Math.floor(k / c.tones);
  }

  var BASS_OFF = { x: 0, o: 7, '5': 4, '3': 2 };

  /* Everything that sounds on step `s` of `song`, at time `t`. Drums and
   * bass go to `dry`; everything with a tune goes to `wet`, which also feeds
   * the song's echo. */
  function scheduleStep(a, dry, wet, song, s, t) {
    var c = compile(song), st = c.step;
    var bar = s >> 4, pos = s & 15, inBar = bar & 3;
    var cd = song.prog[inBar];
    var fill = inBar === 3 && song.drums.fill;
    var accent = pos % 4 === 0 ? 1 : 0.75;

    ['k', 's', 'h', 'p'].forEach(function (key) {
      var ln = fill && fill[key] !== undefined ? fill[key] : song.drums[key];
      var ch = ln ? ln.charAt(pos) : '';
      if (ch !== 'x' && ch !== 'o') return;
      var kind = key === 'k' ? 'kick' : key === 's' ? 'snare' : key === 'h' ? 'hat' : song.perc;
      if (DRUM[kind]) DRUM[kind](a, dry, t, accent, ch === 'o');
    });

    var b = c.bass && c.bass[pos];
    if (b) {
      note(a, dry, song.bass.inst, pitch(song, c, cd + BASS_OFF[b.ch], song.bass.oct),
           t, b.len * st * 0.92, 1);
    }

    if (song.arp && song.arp.pat.charAt(pos) === 'x') {
      var arp = song.arp;
      if (arp.chord) {
        for (var k = 0; k < c.tones; k++) {
          note(a, wet, arp.inst, pitch(song, c, tone(c, cd, k), arp.oct), t, st * 1.5, 0.8);
        }
      } else {
        var i = bar * c.arpN + c.arpAt[pos];
        note(a, wet, arp.inst, pitch(song, c, tone(c, cd, arp.seq[i % arp.seq.length]), arp.oct),
             t, st * 1.5, 0.8);
      }
    }

    if (song.pad && pos === 0) {
      for (var p = 0; p < 3; p++) {
        note(a, wet, song.pad.inst, pitch(song, c, tone(c, cd, p), song.pad.oct), t, st * 16, 1);
      }
    }

    var ph = c.lead[song.form.charAt(bar >> 2)];
    if (ph && pos % 2 === 0) {
      var n = ph[inBar * 8 + pos / 2];
      if (n) {
        note(a, wet, song.lead.inst, pitch(song, c, n.deg, song.lead.oct),
             t, n.len * 2 * st * 0.95, 1);
      }
    }
  }

  /* A song playing: its own fade, its own echo, its own place in the score.
   * Switching songs builds a new one of these and fades the old one out, so
   * the two cross briefly rather than one cutting the other off. */
  function Player(a, dest, id) {
    this.id = id;
    this.song = SONGS[id];
    this.a = a;
    this.step = 0;
    this.next = 0;
    this.out = a.createGain();
    this.out.gain.setValueAtTime(SILENT, a.currentTime);
    this.out.connect(dest);
    this.wet = a.createGain();
    this.wet.connect(this.out);
    this.nodes = [this.out, this.wet];
    if (this.song.delay > 0) {
      var send = a.createGain(), d = a.createDelay(1), fb = a.createGain(), lp = a.createBiquadFilter();
      send.gain.setValueAtTime(this.song.delay, a.currentTime);
      d.delayTime.setValueAtTime(Math.min(0.9, compile(this.song).step * 3), a.currentTime);
      fb.gain.setValueAtTime(0.35, a.currentTime);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2500, a.currentTime);
      this.wet.connect(send);
      send.connect(d);
      d.connect(lp);
      lp.connect(fb);
      fb.connect(d);
      lp.connect(this.out);
      this.nodes.push(send, d, fb, lp);
    }
  }
  Player.prototype.start = function (t) {
    this.next = t;
    this.out.gain.setValueAtTime(SILENT, t);
    this.out.gain.exponentialRampToValueAtTime(this.song.gain || 1, t + (this.song.fadeIn || FADE_IN));
  };
  Player.prototype.pump = function () {
    var now = this.a.currentTime;
    // Behind the clock means the context was suspended, or the page stalled.
    // Carry on from the same place in the score rather than catching up with
    // a burst of every note that was missed.
    if (this.next < now) this.next = now + 0.05;
    var st = compile(this.song).step;
    while (this.next < now + LOOKAHEAD) {
      scheduleStep(this.a, this.out, this.wet, this.song, this.step, this.next);
      this.next += st;
      this.step = (this.step + 1) % STEPS;
    }
  };
  // `fade` seconds to silence: the song's own, or the default crossfade.
  Player.prototype.stop = function (fade) {
    var g = this.out.gain, now = this.a.currentTime, nodes = this.nodes;
    var f = fade || this.song.fadeOut || FADE_OUT;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(SILENT, g.value), now);
    g.exponentialRampToValueAtTime(SILENT, now + f);
    setTimeout(function () {
      nodes.forEach(function (n) { try { n.disconnect(); } catch (e) { /* gone */ } });
    }, (f + LOOKAHEAD + 3) * 1000);
  };

  /* ---- sound effects ---------------------------------------------------
   *
   * `gap` is the least time between two of the same effect: the ones the
   * race can fire every frame - tyres, walls, other cars - would otherwise
   * turn into a buzz. */
  function chord(a, out, t, freqs, o) {
    freqs.forEach(function (f) {
      blip(a, out, t, { type: o.type || 'square', f: f, dur: o.dur, gain: o.gain });
    });
  }
  function run(a, out, t, freqs, gapS, o) {
    freqs.forEach(function (f, i) {
      blip(a, out, t + i * gapS, { type: o.type || 'square', f: f, dur: o.dur, gain: o.gain });
    });
  }

  var SFX = {
    select: { gap: 0.04, play: function (a, o, t) {
      run(a, o, t, [660, 990], 0.045, { dur: 0.07, gain: 0.07 });
    } },
    back: { gap: 0.04, play: function (a, o, t) {
      run(a, o, t, [620, 440], 0.045, { dur: 0.08, gain: 0.065 });
    } },
    step: { gap: 0.03, play: function (a, o, t, dir) {
      blip(a, o, t, { type: 'triangle', f: dir < 0 ? 700 : 880, dur: 0.06, gain: 0.16 });
    } },
    tick: { gap: 0.045, play: function (a, o, t, frac) {
      blip(a, o, t, { type: 'sine', f: 500 + 900 * (frac || 0), dur: 0.035, gain: 0.1 });
    } },
    pause: { gap: 0.1, play: function (a, o, t) {
      run(a, o, t, [700, 470], 0.06, { dur: 0.1, gain: 0.07 });
    } },
    resume: { gap: 0.1, play: function (a, o, t) {
      run(a, o, t, [470, 700], 0.06, { dur: 0.1, gain: 0.07 });
    } },
    count: { gap: 0.2, play: function (a, o, t) {
      blip(a, o, t, { f: 440, dur: 0.16, gain: 0.09 });
      blip(a, o, t, { type: 'sine', f: 440, dur: 0.2, gain: 0.1 });
    } },
    go: { gap: 0.2, play: function (a, o, t) {
      blip(a, o, t, { f: 880, dur: 0.45, gain: 0.09 });
      blip(a, o, t, { type: 'sine', f: 880, dur: 0.5, gain: 0.1 });
      blip(a, o, t, { f: 1320, dur: 0.35, gain: 0.04 });
    } },
    // The tyres biting as a corner is thrown in: short, and quieter than
    // anything else in the race, because it happens at every corner.
    turn: { gap: 0.06, play: function (a, o, t) {
      hiss(a, o, t, { f: 2600, f2: 1500, q: 1.5, dur: 0.14, gain: 0.16 });
    } },
    rev: { gap: 0.2, play: function (a, o, t) {
      blip(a, o, t, { type: 'sawtooth', f: 70, f2: 150, dur: 0.28, gain: 0.1, at: 0.02 });
    } },
    crash: { gap: 0.1, play: function (a, o, t) {
      blip(a, o, t, { type: 'sine', f: 150, f2: 40, dur: 0.3, gain: 0.35 });
      hiss(a, o, t, { filter: 'lowpass', f: 1200, f2: 300, dur: 0.2, gain: 0.25 });
    } },
    scrape: { gap: 0.11, play: function (a, o, t) {
      hiss(a, o, t, { filter: 'highpass', f: 3000, dur: 0.09, gain: 0.1 });
    } },
    bump: { gap: 0.25, play: function (a, o, t) {
      blip(a, o, t, { type: 'triangle', f: 200, f2: 90, dur: 0.12, gain: 0.25 });
      hiss(a, o, t, { f: 900, q: 0.8, dur: 0.07, gain: 0.12 });
    } },
    lap: { gap: 0.2, play: function (a, o, t) {
      run(a, o, t, [660, 990], 0.09, { dur: 0.14, gain: 0.1 });
    } },
    lastlap: { gap: 0.2, play: function (a, o, t) {
      run(a, o, t, [660, 880, 1320], 0.08, { dur: 0.2, gain: 0.1 });
    } },
    // How the race ended: 1 won, 2-3 the podium, anything else just the line.
    finish: { gap: 0.5, play: function (a, o, t, place) {
      if (place === 1) {
        run(a, o, t, [523, 659, 784], 0.1, { dur: 0.14, gain: 0.1 });
        chord(a, o, t + 0.3, [1047, 1319, 1568], { dur: 0.8, gain: 0.065 });
      } else if (place === 2 || place === 3) {
        run(a, o, t, [523, 659], 0.1, { dur: 0.14, gain: 0.1 });
        chord(a, o, t + 0.2, [784, 988], { dur: 0.55, gain: 0.075 });
      } else {
        run(a, o, t, [392, 523], 0.12, { type: 'triangle', dur: 0.3, gain: 0.14 });
      }
    } },
    medal: { gap: 0.5, play: function (a, o, t, medal) {
      var base = medal === 1 ? 1568 : medal === 2 ? 1319 : 1047;
      [1, 1.26, 1.5].forEach(function (r, i) { bell(a, o, t + i * 0.07, base * r, 0.09, 0.7); });
    } },
    star: { gap: 0.5, play: function (a, o, t) {
      [1047, 1319, 1568, 2093, 2637, 3136].forEach(function (f, i) {
        bell(a, o, t + i * 0.06, f, 0.07, 0.8);
      });
      hiss(a, o, t + 0.1, { filter: 'highpass', f: 8000, dur: 0.6, gain: 0.025, at: 0.2 });
    } },
    unlock: { gap: 0.5, play: function (a, o, t) {
      chord(a, o, t, [784, 988, 1175], { type: 'triangle', dur: 0.2, gain: 0.08 });
      chord(a, o, t + 0.16, [1047, 1319, 1568], { type: 'triangle', dur: 0.6, gain: 0.08 });
      bell(a, o, t + 0.3, 2093, 0.07, 0.8);
    } },
    pb: { gap: 0.5, play: function (a, o, t) {
      run(a, o, t, [880, 1109, 1319, 1760], 0.06, { dur: 0.12, gain: 0.08 });
      bell(a, o, t + 0.26, 2637, 0.08, 0.7);
    } },
    // Pulled up and out: a chord gliding up three and a half octaves over
    // 4.2 seconds, trembling faster as it goes, under a rising hiss - and
    // then nothing, at once.
    rise: { gap: 3, play: function (a, o, t) {
      var dur = 4.2;
      [0, 7, 12.1].forEach(function (semi, i) {
        var f0 = 70 * Math.pow(2, semi / 12);
        var osc = a.createOscillator(), g = a.createGain();
        var lfo = a.createOscillator(), depth = a.createGain();
        osc.type = i === 2 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(f0, t);
        osc.frequency.exponentialRampToValueAtTime(f0 * 11, t + dur);
        lfo.frequency.setValueAtTime(3, t);
        lfo.frequency.linearRampToValueAtTime(17, t + dur);
        depth.gain.setValueAtTime(0.05, t);
        lfo.connect(depth);
        depth.connect(g.gain);
        g.gain.setValueAtTime(SILENT, t);
        g.gain.linearRampToValueAtTime(0.06, t + 1.2);
        g.gain.linearRampToValueAtTime(0.11, t + dur - 0.04);
        g.gain.linearRampToValueAtTime(0, t + dur);
        osc.connect(g);
        g.connect(o);
        osc.start(t); lfo.start(t);
        osc.stop(t + dur + 0.02); lfo.stop(t + dur + 0.02);
        tidy(osc, [osc, g, lfo, depth]);
      });
      var src = a.createBufferSource(), f = a.createBiquadFilter(), ng = a.createGain();
      src.buffer = noiseBuffer(a);
      src.loop = true;
      f.type = 'bandpass';
      f.Q.setValueAtTime(2, t);
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(5000, t + dur);
      ng.gain.setValueAtTime(SILENT, t);
      ng.gain.linearRampToValueAtTime(0.1, t + dur - 0.04);
      ng.gain.linearRampToValueAtTime(0, t + dur);
      src.connect(f); f.connect(ng); ng.connect(o);
      src.start(t);
      src.stop(t + dur + 0.02);
      tidy(src, [src, f, ng]);
    } },
    // Hostile: a distorted low cluster and a burst of noise, hammering four
    // times in time with the red - 2.5 a second, no faster.
    hostile: { gap: 3, play: function (a, o, t) {
      if (!a.__brShaper) {
        var n = 1024, curve = new Float32Array(n);
        for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(x * 6); }
        a.__brShaper = curve;
      }
      var shaper = a.createWaveShaper(), g = a.createGain();
      shaper.curve = a.__brShaper;
      shaper.connect(g);
      g.connect(o);
      g.gain.setValueAtTime(SILENT, t);
      for (var p = 0; p < 4; p++) {
        g.gain.setValueAtTime(0.16, t + p * 0.4);
        g.gain.setValueAtTime(0.05, t + p * 0.4 + 0.2);
      }
      g.gain.setValueAtTime(0, t + 1.6);
      var last = null;
      [55, 58.27, 77.78].forEach(function (f) {
        var osc = a.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, t);
        osc.frequency.linearRampToValueAtTime(f * 0.94, t + 1.6);
        osc.connect(shaper);
        osc.start(t);
        osc.stop(t + 1.62);
        last = osc;
      });
      tidy(last, [shaper, g]);
      for (var q = 0; q < 4; q++) {
        hiss(a, o, t + q * 0.4, { filter: 'highpass', f: 900, dur: 0.2, gain: 0.09, at: 0.004 });
      }
    } },
    // Something wrong with the machine: seven seconds that start as a low,
    // barely-there hum and come apart - the drone driven into distortion,
    // its pitch sliding, a rumble underneath, interference chattering
    // faster on top - and then stop dead, exactly at the end.
    unravel: { gap: 5, play: function (a, o, t) {
      var dur = 7, end = t + dur;
      if (!a.__brShaper) {
        var n = 1024, curve = new Float32Array(n);
        for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(x * 6); }
        a.__brShaper = curve;
      }
      var nodes = [];
      var keep = function (x) { nodes.push(x); return x; };
      // the drone: two detuned saws, driven harder and harder
      var drive = keep(a.createGain()), shaper = keep(a.createWaveShaper());
      var lp = keep(a.createBiquadFilter()), dg = keep(a.createGain());
      shaper.curve = a.__brShaper;
      drive.gain.setValueAtTime(0.15, t);
      drive.gain.exponentialRampToValueAtTime(3.5, end);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(140, t);
      lp.frequency.exponentialRampToValueAtTime(1600, end);
      dg.gain.setValueAtTime(SILENT, t);
      dg.gain.linearRampToValueAtTime(0.05, t + 1.5);
      dg.gain.linearRampToValueAtTime(0.12, end - 0.015);
      dg.gain.linearRampToValueAtTime(0, end);
      drive.connect(shaper); shaper.connect(lp); lp.connect(dg); dg.connect(o);
      var wobble = keep(a.createOscillator()), wdepth = keep(a.createGain());
      wobble.frequency.setValueAtTime(0.7, t);
      wobble.frequency.linearRampToValueAtTime(6, end);
      wdepth.gain.setValueAtTime(4, t);
      wdepth.gain.linearRampToValueAtTime(90, end);          // cents
      wobble.connect(wdepth);
      [41, 41.8].forEach(function (f) {
        var osc = keep(a.createOscillator());
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, t);
        osc.frequency.linearRampToValueAtTime(f * 0.82, end);
        wdepth.connect(osc.detune);
        osc.connect(drive);
        osc.start(t); osc.stop(end + 0.02);
      });
      wobble.start(t); wobble.stop(end + 0.02);
      // the rumble under it
      var rum = keep(a.createBufferSource()), rlp = keep(a.createBiquadFilter()), rg = keep(a.createGain());
      rum.buffer = noiseBuffer(a); rum.loop = true;
      rlp.type = 'lowpass'; rlp.frequency.setValueAtTime(90, t);
      rg.gain.setValueAtTime(SILENT, t);
      rg.gain.linearRampToValueAtTime(0.18, end - 0.015);
      rg.gain.linearRampToValueAtTime(0, end);
      rum.connect(rlp); rlp.connect(rg); rg.connect(o);
      rum.start(t); rum.stop(end + 0.02);
      // interference: a narrow band of noise chopped on and off, faster
      var hz = keep(a.createBufferSource()), bp = keep(a.createBiquadFilter());
      var chop = keep(a.createGain()), ig = keep(a.createGain());
      var gate = keep(a.createOscillator()), gdepth = keep(a.createGain());
      hz.buffer = noiseBuffer(a); hz.loop = true;
      bp.type = 'bandpass'; bp.Q.setValueAtTime(7, t);
      bp.frequency.setValueAtTime(900, t);
      bp.frequency.exponentialRampToValueAtTime(3200, end);
      gate.type = 'square';
      gate.frequency.setValueAtTime(3, t);
      gate.frequency.exponentialRampToValueAtTime(23, end);
      gdepth.gain.setValueAtTime(0.5, t);
      chop.gain.setValueAtTime(0.5, t);
      gate.connect(gdepth); gdepth.connect(chop.gain);
      ig.gain.setValueAtTime(SILENT, t);
      ig.gain.linearRampToValueAtTime(0.015, t + 2);
      ig.gain.linearRampToValueAtTime(0.08, end - 0.015);
      ig.gain.linearRampToValueAtTime(0, end);
      hz.connect(bp); bp.connect(chop); chop.connect(ig); ig.connect(o);
      hz.start(t); hz.stop(end + 0.02); gate.start(t); gate.stop(end + 0.02);
      tidy(rum, nodes);
    } },
    // Pro controls. A boost: a rush of air rising, and a bright upward chirp.
    boost: { gap: 0.3, play: function (a, o, t) {
      hiss(a, o, t, { filter: 'bandpass', f: 500, f2: 2600, dur: 0.45, gain: 0.16, q: 1.2, at: 0.02 });
      blip(a, o, t, { type: 'sawtooth', f: 220, f2: 660, glide: 0.25, dur: 0.3, gain: 0.05 });
      blip(a, o, t + 0.04, { type: 'square', f: 880, f2: 1320, glide: 0.12, dur: 0.14, gain: 0.03 });
    } },
    // A spin-out: tyres howling round a full turn, and dying away.
    spin: { gap: 1, play: function (a, o, t) {
      for (var i = 0; i < 4; i++) {
        hiss(a, o, t + i * 0.18, { filter: 'bandpass', f: 1500 - i * 180, f2: 900 - i * 100, dur: 0.24, gain: 0.1 - i * 0.018, q: 6, at: 0.01 });
      }
      blip(a, o, t, { type: 'triangle', f: 330, f2: 140, glide: 0.8, dur: 0.8, gain: 0.05 });
    } },
    // A broken moment: a crackle and a wrong little tone.
    glitch: { gap: 0.08, play: function (a, o, t) {
      hiss(a, o, t, { filter: 'highpass', f: 2500, dur: 0.06, gain: 0.07 });
      blip(a, o, t, { type: 'square', f: 180 + Math.random() * 1400, dur: 0.05, gain: 0.03 });
    } },
    // Once, close, and cut off: a crowd of torn voices through one throat,
    // a burst of air and a blow underneath - all of it gone in the same
    // hundredth of a second it ends on.
    scream: { gap: 2, play: function (a, o, t) {
      var dur = 0.62, end = t + dur, nodes = [];
      var keep = function (x) { nodes.push(x); return x; };
      var drive = keep(a.createGain()), shaper = keep(a.createWaveShaper());
      var lp = keep(a.createBiquadFilter()), g = keep(a.createGain());
      shaper.curve = tanhCurve(a);
      drive.gain.setValueAtTime(2.2, t);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(5200, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.3, t + 0.012);
      g.gain.setValueAtTime(0.3, t + 0.26);
      g.gain.linearRampToValueAtTime(0.22, end - 0.01);
      g.gain.linearRampToValueAtTime(0, end);
      drive.connect(shaper); shaper.connect(lp); lp.connect(g); g.connect(o);
      var forms = [[850, 5, 1], [1350, 6, 0.8], [2700, 7, 0.45]].map(function (fm) {
        var bp = keep(a.createBiquadFilter()), fg = keep(a.createGain());
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(fm[0], t);
        bp.frequency.linearRampToValueAtTime(fm[0] * 0.8, end);
        bp.Q.setValueAtTime(fm[1], t);
        fg.gain.setValueAtTime(fm[2], t);
        bp.connect(fg); fg.connect(drive);
        return bp;
      });
      var last = null;
      [310, 415, 560, 745, 990].forEach(function (f, i) {
        var osc = keep(a.createOscillator()), vib = keep(a.createOscillator()), vd = keep(a.createGain());
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f * 0.85, t);
        osc.frequency.linearRampToValueAtTime(f * 1.3, t + 0.07);
        osc.frequency.linearRampToValueAtTime(f * 0.78, end);
        vib.frequency.setValueAtTime(9 + i * 1.3, t);
        vd.gain.setValueAtTime(70 + i * 12, t);
        vib.connect(vd); vd.connect(osc.detune);
        forms.forEach(function (bp) { osc.connect(bp); });
        osc.start(t); osc.stop(end + 0.01);
        vib.start(t); vib.stop(end + 0.01);
        last = osc;
      });
      var air = keep(a.createBufferSource()), hp = keep(a.createBiquadFilter()), ag = keep(a.createGain());
      air.buffer = noiseBuffer(a);
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(1300, t);
      ag.gain.setValueAtTime(0, t);
      ag.gain.linearRampToValueAtTime(0.16, t + 0.01);
      ag.gain.linearRampToValueAtTime(0.07, end - 0.01);
      ag.gain.linearRampToValueAtTime(0, end);
      air.connect(hp); hp.connect(ag); ag.connect(o);
      air.start(t); air.stop(end + 0.01);
      var boom = keep(a.createOscillator()), bg = keep(a.createGain());
      boom.type = 'sine';
      boom.frequency.setValueAtTime(72, t);
      boom.frequency.exponentialRampToValueAtTime(27, end);
      bg.gain.setValueAtTime(0, t);
      bg.gain.linearRampToValueAtTime(0.55, t + 0.008);
      bg.gain.linearRampToValueAtTime(0.3, end - 0.01);
      bg.gain.linearRampToValueAtTime(0, end);
      boom.connect(bg); bg.connect(o);
      boom.start(t); boom.stop(end + 0.01);
      tidy(last, nodes);
    } }
  };

  /* ---- places --------------------------------------------------------------
   *
   * Not songs and not effects: somewhere, running for as long as the game
   * keeps it, in layers the game turns up and down while it plays. Each is
   * built against a context and an output like everything else here and
   * hands back its layers (gains, all starting at silence) and `events`,
   * which scatters whatever happens there now and then over a stretch of
   * time. Sound.place runs one live; the tests render one offline. */

  // A room nobody has measured: noise dying away over `sec`, a little
  // different in each ear.
  function hall(a, sec) {
    var key = '__brHall' + sec;
    if (a[key]) return a[key];
    var len = Math.floor(a.sampleRate * sec), b = a.createBuffer(2, len, a.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = b.getChannelData(ch);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.4);
    }
    a[key] = b;
    return b;
  }

  function pan(a, out, x, t) {
    if (!a.createStereoPanner) return out;
    var p = a.createStereoPanner();
    p.pan.setValueAtTime(x, t);
    p.connect(out);
    return p;
  }

  /* A voice a very long way off: a sawtooth pushed through two vowel bands
   * with breath in it, a wide slow shake, a rise and a long fall. What makes
   * it far is not here - it is the filter and the room it is sent through. */
  function cry(a, out, t, o) {
    var dur = o.dur, f = o.f, end = t + dur, nodes = [];
    var keep = function (x) { nodes.push(x); return x; };
    var dest = pan(a, out, o.pan || 0, t);
    if (dest !== out) nodes.push(dest);
    var g = keep(a.createGain());
    g.gain.setValueAtTime(SILENT, t);
    g.gain.exponentialRampToValueAtTime(o.gain, t + dur * 0.3);
    g.gain.setValueAtTime(o.gain, t + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(SILENT, end);
    g.connect(dest);
    var bands = [[o.v1 || 780, 5], [o.v2 || 1180, 6]].map(function (v) {
      var bp = keep(a.createBiquadFilter());
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(v[0], t);
      bp.Q.setValueAtTime(v[1], t);
      bp.connect(g);
      return bp;
    });
    var osc = keep(a.createOscillator()), vib = keep(a.createOscillator()), vd = keep(a.createGain());
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f * 0.7, t);
    osc.frequency.linearRampToValueAtTime(f * 1.22, t + dur * 0.25);
    osc.frequency.linearRampToValueAtTime(f * 1.05, t + dur * 0.6);
    osc.frequency.linearRampToValueAtTime(f * 0.5, end);
    vib.frequency.setValueAtTime(o.rate, t);
    vd.gain.setValueAtTime(o.depth, t);
    vib.connect(vd); vd.connect(osc.detune);
    var br = keep(a.createBufferSource()), bg = keep(a.createGain());
    br.buffer = noiseBuffer(a); br.loop = true;
    bg.gain.setValueAtTime(0.3, t);
    br.connect(bg);
    bands.forEach(function (bp) { osc.connect(bp); bg.connect(bp); });
    osc.start(t); osc.stop(end + 0.02);
    vib.start(t); vib.stop(end + 0.02);
    br.start(t, Math.random() * 0.5); br.stop(end + 0.02);
    tidy(osc, nodes);
  }

  var PLACES = {
    /* Somewhere past the end of a road. A floor of rumble that breathes, a
     * low drone a tritone wide, air moving through something big, a thin
     * whine for when everything else goes quiet - and, sent through a long
     * dark room, things far off: blows, groans, and voices. */
    beyond: function (a, out) {
      var t0 = a.currentTime, nodes = [], sources = [];
      var keep = function (x) { nodes.push(x); return x; };
      var layers = {};
      function layer(name, dest) {
        var g = keep(a.createGain());
        g.gain.setValueAtTime(0, t0);
        g.connect(dest || out);
        layers[name] = g;
        return g;
      }
      function loopNoise() {
        var n = keep(a.createBufferSource());
        n.buffer = noiseBuffer(a); n.loop = true;
        sources.push(n);
        return n;
      }
      function osc(type, f) {
        var o = keep(a.createOscillator());
        o.type = type; o.frequency.setValueAtTime(f, t0);
        sources.push(o);
        return o;
      }

      // the floor, breathing about once every twelve seconds
      var rn = loopNoise(), rlp = keep(a.createBiquadFilter()), breath = keep(a.createGain());
      var blfo = osc('sine', 0.083), bdepth = keep(a.createGain());
      rlp.type = 'lowpass'; rlp.frequency.setValueAtTime(75, t0); rlp.Q.setValueAtTime(0.8, t0);
      breath.gain.setValueAtTime(0.7, t0);
      bdepth.gain.setValueAtTime(0.3, t0);
      blfo.connect(bdepth); bdepth.connect(breath.gain);
      rn.connect(rlp); rlp.connect(breath); breath.connect(layer('rumble'));
      // and a grind above it, low enough to feel and high enough that a
      // phone's speaker, which has no bass at all, still gives it back
      var gbp = keep(a.createBiquadFilter()), gg = keep(a.createGain());
      gbp.type = 'bandpass'; gbp.frequency.setValueAtTime(165, t0); gbp.Q.setValueAtTime(0.9, t0);
      gg.gain.setValueAtTime(0.4, t0);
      rn.connect(gbp); gbp.connect(gg); gg.connect(breath);

      // the drone
      var dlp = keep(a.createBiquadFilter());
      dlp.type = 'lowpass'; dlp.frequency.setValueAtTime(190, t0);
      dlp.connect(layer('drone'));
      osc('sine', 36.7).connect(dlp);
      osc('triangle', 51.9).connect(dlp);
      osc('sine', 37.1).connect(dlp);
      var dhi = keep(a.createBiquadFilter()), dhg = keep(a.createGain());
      dhi.type = 'lowpass'; dhi.frequency.setValueAtTime(280, t0);
      dhg.gain.setValueAtTime(0.35, t0);
      osc('sawtooth', 73.4).connect(dhi); dhi.connect(dhg); dhg.connect(layers.drone);

      // air
      var an = loopNoise(), abp = keep(a.createBiquadFilter());
      var alfo = osc('sine', 0.047), adepth = keep(a.createGain());
      abp.type = 'bandpass'; abp.frequency.setValueAtTime(420, t0); abp.Q.setValueAtTime(1.3, t0);
      adepth.gain.setValueAtTime(170, t0);
      alfo.connect(adepth); adepth.connect(abp.frequency);
      an.connect(abp); abp.connect(layer('air'));

      // the whine
      var wg = layer('whine');
      osc('sine', 3150).connect(wg);
      osc('sine', 3167).connect(wg);

      // the long room everything far away is heard through
      var room = keep(a.createConvolver()), roomOut = keep(a.createBiquadFilter());
      room.buffer = hall(a, 4.5);
      roomOut.type = 'lowpass'; roomOut.frequency.setValueAtTime(1400, t0);
      room.connect(roomOut); roomOut.connect(out);
      function distant(name, cutoff, dry) {
        var lp = keep(a.createBiquadFilter()), d = keep(a.createGain());
        lp.type = 'lowpass'; lp.frequency.setValueAtTime(cutoff, t0); lp.Q.setValueAtTime(0.5, t0);
        d.gain.setValueAtTime(dry, t0);
        layer(name, lp);
        lp.connect(room); lp.connect(d); d.connect(out);
        return layers[name];
      }
      var far = distant('far', 520, 0.3);
      var cries = distant('cries', 640, 0.12);

      sources.forEach(function (s) { s.start(t0); });

      // Something now and then, over [from, to): a blow or a groan, and
      // further off still, a few voices at once.
      var nextFar = t0 + 2 + Math.random() * 3, nextCry = t0 + 4 + Math.random() * 3;
      function events(from, to) {
        while (nextFar < to) {
          var tf = Math.max(nextFar, from);
          if (Math.random() < 0.55) {
            hiss(a, far, tf, { filter: 'lowpass', f: 120, dur: 1.4, gain: 0.9, at: 0.03 });
          } else {
            blip(a, far, tf, { type: 'sawtooth', f: 58 + Math.random() * 14, f2: 38, glide: 2.8, dur: 3, gain: 0.5, at: 1.1 });
          }
          nextFar = tf + 3.5 + Math.random() * 5.5;
        }
        while (nextCry < to) {
          var tc = Math.max(nextCry, from), n = 2 + Math.floor(Math.random() * 2);
          var side = Math.random() * 1.4 - 0.7;
          for (var i = 0; i < n; i++) {
            cry(a, cries, tc + i * (0.2 + Math.random() * 0.5), {
              f: 380 + Math.random() * 380, dur: 1.8 + Math.random() * 1.6,
              gain: 0.6 - i * 0.12, rate: 4.5 + Math.random() * 3, depth: 30 + Math.random() * 50,
              v1: 700 + Math.random() * 200, v2: 1050 + Math.random() * 300,
              pan: Math.max(-1, Math.min(1, side + Math.random() * 0.4 - 0.2))
            });
          }
          nextCry = tc + 5 + Math.random() * 7;
        }
      }

      return {
        layers: layers,
        events: events,
        stop: function (t) { sources.forEach(function (s) { try { s.stop(t); } catch (e) { /* done */ } }); },
        nodes: nodes
      };
    }
  };

  /* ---- the live context -------------------------------------------------- */

  var player = null;          // the song playing now
  var want = null;            // the song the game wants, audible or not
  var pending = 0;            // a delayed Sound.music
  var pumping = 0;
  var duckLevel = 1;
  var lastAt = {};

  function build() {
    if (ctx || !Ctor) return ctx;
    try { ctx = new Ctor({ latencyHint: 'interactive' }); } catch (e) {
      try { ctx = new Ctor(); } catch (e2) { return null; }
    }
    // A gentle limiter after everything, so a fanfare over a full chorus
    // never clips.
    var limit = ctx.createDynamicsCompressor();
    limit.threshold.setValueAtTime(-10, 0);
    limit.knee.setValueAtTime(8, 0);
    limit.ratio.setValueAtTime(6, 0);
    limit.attack.setValueAtTime(0.003, 0);
    limit.release.setValueAtTime(0.2, 0);
    limit.connect(ctx.destination);
    master = ctx.createGain();
    master.connect(limit);
    duck = ctx.createGain();
    duck.connect(master);
    musicBus = ctx.createGain();
    musicBus.connect(duck);
    // Songs reach the music bus through a lowpass that is normally wide open
    // (Sound.muffle); anything else on the music bus goes round it.
    muffler = ctx.createBiquadFilter();
    muffler.type = 'lowpass';
    muffler.frequency.setValueAtTime(20000, 0);
    muffler.Q.setValueAtTime(0.5, 0);
    muffler.connect(musicBus);
    sfxBus = ctx.createGain();
    sfxBus.connect(master);
    master.gain.setValueAtTime(Sound.muted ? 0 : 1, 0);
    duck.gain.setValueAtTime(duckLevel, 0);
    musicBus.gain.setValueAtTime(level(Sound.musicVolume) * MUSIC_LEVEL, 0);
    sfxBus.gain.setValueAtTime(level(Sound.sfxVolume) * SFX_LEVEL, 0);
    noiseBuffer(ctx);
    return ctx;
  }

  function pumpAll() {
    if (player) player.pump();
    else { clearInterval(pumping); pumping = 0; }
  }

  // Bring what is playing into line with what is wanted.
  function applyMusic(fade) {
    if (!ctx) return;
    var target = Sound.musicVolume > 0 && want && SONGS[want] ? want : null;
    if (player && player.id === target) return;
    if (player) { player.stop(fade); player = null; }
    if (!target) return;
    player = new Player(ctx, muffler, target);
    player.start(ctx.currentTime + 0.05);
    player.pump();
    if (!pumping) pumping = setInterval(pumpAll, PUMP_MS);
  }

  function ramp(param, to, over) {
    var now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(to, now + over);
  }

  /* Browsers start a context suspended unless it is made or resumed inside a
   * user gesture, and they disagree on what counts as one. Chrome counts a
   * key press, a mouse press, or the END of a touch (touchend / pointerup),
   * but not the start of one. iOS Safari has at times honoured only touchend
   * and click, and before iOS 14.5 also needed a sound actually started
   * within the gesture - hence the one-sample silent buffer. Every one of
   * them is listened for, for the life of the page: Safari can also suspend
   * a running context by itself ("interrupted", after a phone call or a trip
   * to the lock screen) and the next touch has to bring it back. */
  function unlock() {
    if (!Ctor || document.hidden) return;
    // Where the browser says whether this event counts as a gesture, wait
    // for one that does - otherwise Chrome makes a context it will not start
    // on the first touch of a finger, and says so in the console.
    var ua = global.navigator && global.navigator.userActivation;
    if (!ctx && ua && !ua.isActive) return;
    var a = build();
    if (!a) return;
    if (a.state !== 'running') {
      try {
        var p = a.resume();
        if (p && p.catch) p.catch(function () { /* retried on the next gesture */ });
      } catch (e) { /* retried on the next gesture */ }
      try {
        var src = a.createBufferSource();
        src.buffer = a.createBuffer(1, 1, 22050);
        src.connect(a.destination);
        src.start(0);
      } catch (e) { /* only ever needed by old iOS */ }
    }
    applyMusic();
  }

  if (typeof document !== 'undefined') {
    ['pointerdown', 'pointerup', 'mousedown', 'touchend', 'keydown', 'click'].forEach(function (ev) {
      global.addEventListener(ev, unlock, { capture: true, passive: true });
    });
    // Nothing plays in a background tab: suspend on the way out and resume on
    // the way back. The song carries on from where it was.
    document.addEventListener('visibilitychange', function () {
      if (!ctx) return;
      try {
        if (document.hidden) { if (ctx.state === 'running') ctx.suspend(); }
        else if (ctx.state !== 'running') {
          var p = ctx.resume();
          if (p && p.catch) p.catch(function () { /* the next gesture will */ });
        }
      } catch (e) { /* the next gesture will */ }
    });
  }

  /* ---- the API -------------------------------------------------------- */

  /* Start the context from a gesture. Every gesture already does this; the
   * call is kept for Game.startRace, which is always reached from one. */
  Sound.unlock = unlock;

  /* Play the named song, crossfading from whatever is on. The same song again
   * carries straight on. `delayMs` waits before switching, and a newer call
   * in the meantime cancels it - for a carousel flicked through quickly. */
  Sound.music = function (id, delayMs, fade) {
    clearTimeout(pending);
    pending = 0;
    if (delayMs > 0 && id !== want) {
      pending = setTimeout(function () { pending = 0; Sound.music(id, 0, fade); }, delayMs);
      return;
    }
    want = id || null;
    applyMusic(fade);   // `fade`: seconds for what is playing to fade out
  };

  /* A sound effect, now or `delay` seconds from now. */
  Sound.play = function (name, arg, delay) {
    var S = SFX[name];
    if (!S || !ctx || Sound.muted || Sound.sfxVolume <= 0) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    var now = ctx.currentTime;
    if (S.gap && lastAt[name] !== undefined && now - lastAt[name] < S.gap &&
        now >= lastAt[name]) return;
    lastAt[name] = now;
    S.play(ctx, sfxBus, now + 0.005 + (delay || 0), arg);
  };

  /* Hold the music at `lvl` (1 is full) until told otherwise. */
  Sound.duck = function (lvl) {
    duckLevel = lvl;
    if (ctx) ramp(duck.gain, lvl, 0.25);
  };

  /* Pull the music down to `lvl` for `hold` seconds, then back to where the
   * duck has it - room for a fanfare. */
  Sound.dip = function (lvl, hold) {
    if (!ctx) return;
    var p = duck.gain, now = ctx.currentTime, low = Math.min(lvl, duckLevel);
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.linearRampToValueAtTime(low, now + 0.08);
    p.setValueAtTime(low, now + hold);
    p.linearRampToValueAtTime(duckLevel, now + hold + 0.8);
  };

  Sound.setVolumes = function (music, sfx) {
    Sound.musicVolume = music;
    Sound.sfxVolume = sfx;
    if (ctx) {
      ramp(musicBus.gain, level(music) * MUSIC_LEVEL, 0.05);
      ramp(sfxBus.gain, level(sfx) * SFX_LEVEL, 0.05);
    }
    // At 0 the song is stopped rather than played into silence, and raising
    // the slider again starts it.
    applyMusic();
  };

  Sound.setMuted = function (m) {
    Sound.muted = !!m;
    if (ctx) ramp(master.gain, m ? 0 : 1, 0.05);
  };

  /* Muffle the song - as if heard through a wall, then from further off -
   * down to `hz` over `over` seconds. Nothing, or 0, opens it again at once. */
  Sound.muffle = function (hz, over) {
    if (!ctx) return;
    var f = muffler.frequency, now = ctx.currentTime;
    f.cancelScheduledValues(now);
    if (!(hz > 0)) { f.setValueAtTime(20000, now); return; }
    f.setValueAtTime(Math.max(20, f.value), now);
    f.exponentialRampToValueAtTime(hz, now + (over || 0.05));
  };

  /* Somewhere to be, in place of a song: see PLACES. It plays on the music
   * bus, so the music slider and mute are its volume, and it keeps going
   * until stopped. The handle turns its layers up and down and stops it -
   * at once, or over `fade` seconds. Without a context there is nothing to
   * hear and the handle does nothing. */
  var placeOn = null;
  Sound.place = function (name) {
    if (placeOn) placeOn.stop(0);
    var none = { set: function () {}, stop: function () {} };
    if (!ctx || !PLACES[name]) return none;
    var out = ctx.createGain();
    out.gain.setValueAtTime(1, ctx.currentTime);
    out.connect(musicBus);
    var p = PLACES[name](ctx, out), live = true;
    var pump = function () { if (live) p.events(ctx.currentTime, ctx.currentTime + 1.5); };
    pump();
    var timer = setInterval(pump, 500);
    var handle = {
      // layer to `value` (a gain) over `over` seconds
      set: function (layer, value, over) {
        var g = p.layers[layer];
        if (!live || !g) return;
        var now = ctx.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.linearRampToValueAtTime(value, now + Math.max(0.01, over || 0));
      },
      stop: function (fade) {
        if (!live) return;
        live = false;
        clearInterval(timer);
        if (placeOn === handle) placeOn = null;
        var now = ctx.currentTime, f = Math.max(0.005, fade || 0);
        out.gain.cancelScheduledValues(now);
        out.gain.setValueAtTime(out.gain.value, now);
        out.gain.linearRampToValueAtTime(0, now + f);
        p.stop(now + f + 0.02);
        setTimeout(function () {
          try { out.disconnect(); } catch (e) { /* gone */ }
          p.nodes.forEach(function (n) { try { n.disconnect(); } catch (e) { /* gone */ } });
        }, (f + 6) * 1000);
      }
    };
    placeOn = handle;
    return handle;
  };

  // What is playing, for the tests and for anyone curious in the console.
  Sound.state = function () {
    return { context: ctx ? ctx.state : 'none', song: player ? player.id : null, want: want,
             duck: duckLevel, music: Sound.musicVolume, sfx: Sound.sfxVolume, muted: Sound.muted,
             place: !!placeOn, muffle: muffler ? Math.round(muffler.frequency.value) : null };
  };

  // The offline renderers the tests measure. The live game never calls them.
  Sound._renderSong = function (a, out, id, bars) {
    var song = SONGS[id], st = compile(song).step, t = 0;
    for (var s = 0; s < bars * 16; s++, t += st) scheduleStep(a, out, out, song, s % STEPS, t);
    return t;
  };
  Sound._renderSfx = function (a, out, name, arg) { SFX[name].play(a, out, 0.01, arg); };
  // A place for `sec` seconds with its layers held at `levels`.
  Sound._renderPlace = function (a, out, name, sec, levels) {
    var p = PLACES[name](a, out);
    Object.keys(levels).forEach(function (k) { p.layers[k].gain.setValueAtTime(levels[k], 0); });
    p.events(0, sec);
    p.stop(sec);
    return p;
  };
  Sound._names = { songs: Object.keys(SONGS), sfx: Object.keys(SFX), inst: Object.keys(INST), places: Object.keys(PLACES) };

  // The old names, which game.js has always called.
  Sound.beep = function () { Sound.play('count'); };
  Sound.go = function () { Sound.play('go'); };
  Sound.crash = function () { Sound.play('crash'); };
  Sound.lap = function () { Sound.play('lap'); };
  Sound.finish = function (place) { Sound.play('finish', place); };

  global.Sound = Sound;
})(typeof window !== 'undefined' ? window : globalThis);
