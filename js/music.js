/* Block Racer - the music, as data.
 *
 * There are no audio files. Every song is a short score that audio.js plays
 * on WebAudio oscillators and noise, so the whole soundtrack is a few
 * kilobytes and loops without a seam: a song is a grid of sixteenth notes and
 * the last step of the loop is followed by the first on the same grid.
 *
 * One song for the menus, one per theme (all three of a theme's tracks share
 * it), and one for the seven legacy tracks, which belong to no theme.
 *
 * `gain` evens the songs out: it is measured, not chosen - each is trimmed
 * so the whole loop plays at the same loudness as every other, and moving
 * between themes never jumps in volume.
 *
 * A song is 16 bars of 16 steps: four sections of four bars. The chords are
 * the four entries of `prog`, one per bar, repeated in every section. `form`
 * says which lead phrase each section plays - '-' leaves the lead out, which
 * is what stops a loop you hear for three minutes from wearing thin.
 *
 * Notes are SCALE DEGREES, 0 being the root: 7 is the octave, -1 the note
 * below the root. Chords are the triads built on a degree of the scale.
 *
 *   drums  one character per sixteenth, per bar. k kick, s snare, h hat
 *          (x closed, o open), p the song's own percussion (`perc`). `fill`
 *          replaces any of them on the last bar of each section.
 *   bass   per sixteenth: x root of the chord, o its octave, 5 its fifth,
 *          3 its third, - holds the previous note, . is silence.
 *   arp    per sixteenth: x plays the next chord tone from `seq` (0 root,
 *          1 third, 2 fifth, 3 the root an octave up, ...). `chord: true`
 *          plays the whole chord instead.
 *   pad    the chord, held for the bar.
 *   lead   per EIGHTH: a degree, _ holds the note before, . is silence.
 */
(function (global) {
  'use strict';

  var SCALES = {
    major:      [0, 2, 4, 5, 7, 9, 11],
    minor:      [0, 2, 3, 5, 7, 8, 10],
    dorian:     [0, 2, 3, 5, 7, 9, 10],
    phrygian:   [0, 1, 3, 5, 7, 8, 10],
    hijaz:      [0, 1, 4, 5, 7, 8, 10],   // phrygian dominant
    harmonic:   [0, 2, 3, 5, 7, 8, 11],   // harmonic minor
    lydian:     [0, 2, 4, 6, 7, 9, 11],
    hungarian:  [0, 2, 3, 6, 7, 8, 11]
  };

  var SONGS = {
    // Menus: an easy night-drive pulse, calm enough to sit on for a while.
    menu: {
      bpm: 108, gain: 1.08, root: 57, scale: 'minor', prog: [0, 5, 2, 6], form: '-A-B',
      delay: 0.22,
      drums: { k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.' },
      bass: { inst: 'bass', oct: -1, pat: 'x.x.x.x.x.x.x.o.' },
      arp:  { inst: 'pluck', oct: 1, pat: 'x.x.x.x.x.x.x.x.', seq: [0, 1, 2, 1] },
      pad:  { inst: 'pad' },
      lead: { inst: 'flute', oct: 1,
        A: '4 _ 2 _ 0 _ 2 3  5 _ _ 4 5 _ 7 _  6 _ _ _ 4 _ 2 _  8 _ _ _ 6 _ _ _',
        B: '7 _ 6 _ 4 _ 2 _  5 _ 4 5 7 _ 9 _  9 _ _ 8 7 _ 6 _  8 _ 6 _ 5 _ 4 _' }
    },

    // Forest: bright, bouncy, woody. The easy end of the game.
    forest: {
      bpm: 124, gain: 0.54, root: 55, scale: 'major', prog: [0, 5, 3, 4], form: '-ABA',
      delay: 0.12, perc: 'shaker',
      drums: { k: 'x.....x.x.......', s: '....x.......x...', p: '..x...x...x...x.',
               fill: { s: '....x.......x.xx' } },
      bass: { inst: 'sub', oct: -1, pat: 'x..o..x.x..o.5..' },
      arp:  { inst: 'marimba', oct: 1, pat: '..x...x...x...x.', seq: [0, 1, 2, 1] },
      lead: { inst: 'flute', oct: 1,
        A: '4 _ 2 4 7 _ 4 _  9 _ 7 _ 5 _ 4 _  3 _ 5 7 9 _ 7 _  8 _ 6 _ 4 _ _ _',
        B: '7 _ _ 9 _ 7 4 _  5 _ 7 _ 9 _ 11 _  10 _ 9 _ 7 _ 5 _  6 _ 8 _ 11 _ _ _' }
    },

    // Desert: phrygian dominant, hand drums and a reedy lead.
    desert: {
      bpm: 100, gain: 0.74, root: 50, scale: 'hijaz', prog: [0, 1, 6, 0], form: '-ABA',
      delay: 0.18, perc: 'tom',
      drums: { k: 'x..x..x...x.....', p: '....x..x....x.x.', h: '..x...x...x...x.' },
      bass: { inst: 'sub', oct: -1, pat: 'x.....x.x.......' },
      arp:  { inst: 'oud', oct: 0, pat: 'x..x..x.x..x..x.', seq: [0, 1, 2, 1] },
      lead: { inst: 'reed', oct: 1,
        A: '4 _ 5 4 2 1 0 _  1 _ 3 _ 5 _ 3 1  6 _ 5 4 5 _ 6 _  4 _ _ 2 1 _ 0 _',
        B: '7 _ 8 7 5 _ 4 _  8 _ _ 7 5 _ 3 _  6 _ 5 _ 6 8 7 _  4 5 4 2 1 _ 0 _' }
    },

    // Snow: slow and glassy - bells, a long echo, hardly any drums.
    snow: {
      bpm: 92, gain: 0.57, root: 53, scale: 'lydian', prog: [0, 1, 5, 4], form: '-ABA',
      delay: 0.35,
      drums: { k: 'x.......x.......', h: '....x.......x...' },
      bass: { inst: 'sub', oct: -1, pat: 'x-------o-------' },
      arp:  { inst: 'bell', oct: 2, pat: 'x...x...x...x...', seq: [0, 1, 2, 3] },
      pad:  { inst: 'pad' },
      lead: { inst: 'bell', oct: 1,
        A: '7 _ _ _ 4 _ _ _  8 _ _ 6 _ _ 4 _  5 _ _ _ 7 _ _ _  4 _ _ _ _ _ . .',
        B: '7 _ 9 _ 11 _ 10 _  8 _ _ 10 _ _ 12 _  12 _ 11 _ 9 _ 7 _  8 _ _ _ 6 _ _ _' }
    },

    // Cliffs: open and heroic, a rock beat under a driving bass.
    cliffs: {
      bpm: 132, gain: 1.13, root: 52, scale: 'dorian', prog: [0, 2, 6, 3], form: '-ABA',
      delay: 0.1,
      drums: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.',
               fill: { s: '....x.......xxxx' } },
      bass: { inst: 'bass', oct: -1, pat: 'x.x.o.x.x.x.o.x.' },
      arp:  { inst: 'chip', oct: 1, pat: 'x..x..x...x..x..', seq: [0, 1, 2] },
      lead: { inst: 'saw', oct: 1,
        A: '4 _ _ 2 4 _ 7 _  6 _ 4 _ 2 _ 4 _  8 _ _ 6 8 _ 10 _  7 _ 5 _ 3 _ _ _',
        B: '7 _ 9 _ 11 _ 9 7  9 _ 11 _ 13 _ 11 _  13 _ 12 10 _ _ 8 _  10 _ 12 _ 10 _ 7 _' }
    },

    // City: four-on-the-floor disco with a syncopated bass and chord stabs.
    city: {
      bpm: 116, gain: 1.08, root: 53, scale: 'dorian', prog: [0, 3, 6, 4], form: '-ABA',
      delay: 0.12, sevenths: true, perc: 'clap',
      drums: { k: 'x...x...x...x...', p: '....x.......x...', h: 'x.o.x.o.x.o.x.o.' },
      bass: { inst: 'bass', oct: -1, pat: 'x..x..o.x.x..o.x' },
      arp:  { inst: 'stab', oct: 0, pat: '..x...x...x..x..', chord: true },
      lead: { inst: 'lead', oct: 1,
        A: '4 _ 6 7 _ 6 4 _  5 _ 4 _ 3 _ 2 _  6 _ _ 8 _ 10 _ 8  7 _ 6 _ 4 _ _ _',
        B: '7 _ 9 _ 11 _ 10 9  10 _ _ 9 _ 7 _ _  8 _ 10 _ 13 _ 12 10  11 _ _ 9 _ 7 _ _' }
    },

    // Industrial: hard and mechanical - metal hits and a sixteenth bass.
    industrial: {
      bpm: 136, gain: 0.88, root: 48, scale: 'minor', prog: [0, 0, 5, 6], form: '-ABA',
      delay: 0.08, perc: 'metal',
      drums: { k: 'x...x...x...x...', s: '....x.......x..x', h: 'xxxxxxxxxxxxxxxx',
               p: '..x....x..x...x.' },
      bass: { inst: 'sqbass', oct: -1, pat: 'x.xx.xx.x.xx.xo.' },
      lead: { inst: 'lead', oct: 1,
        A: '4 _ 4 _ 3 2 _ 0  2 _ _ 3 4 _ 7 _  5 _ _ 4 5 _ 7 _  8 _ 6 _ 5 4 _ _',
        B: '7 _ 9 _ 7 _ 6 _  4 _ _ _ 7 6 4 _  9 _ 7 _ 5 _ 7 _  10 _ 8 _ 6 _ _ _' }
    },

    // Ancient ruins: harmonic minor, harp and toms, a little mysterious.
    ruins: {
      bpm: 98, gain: 0.79, root: 50, scale: 'harmonic', prog: [0, 5, 3, 4], form: '-ABA',
      delay: 0.25, perc: 'tom',
      drums: { k: 'x.....x.........', p: '....x.....x..x..', h: '..x...x...x...x.' },
      bass: { inst: 'sub', oct: -1, pat: 'x.......x...5...' },
      arp:  { inst: 'pluck', oct: 1, pat: 'x.x.x.x.x.x.x.x.', seq: [0, 1, 2, 3, 2, 1] },
      lead: { inst: 'flute', oct: 1,
        A: '4 _ _ 5 4 _ 2 _  7 _ _ 5 4 _ 5 _  3 _ 5 _ 7 _ 5 _  6 _ _ _ 4 _ _ _',
        B: '7 _ 8 _ 9 _ 8 7  12 _ _ 11 9 _ 7 _  10 _ 12 _ 11 _ 10 _  13 _ 11 _ 8 _ _ _' }
    },

    // Volcano: fast, low and tense, phrygian over a pounding kick.
    volcano: {
      bpm: 148, gain: 0.89, root: 52, scale: 'phrygian', prog: [0, 1, 0, 6], form: '-ABA',
      delay: 0.06,
      drums: { k: 'x.x...x.x.x...x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.',
               fill: { s: '....x...x.x.xxxx' } },
      bass: { inst: 'bass', oct: -1, pat: 'x.xxx.xxx.xxx.xx' },
      lead: { inst: 'saw', oct: 1,
        A: '0 _ 1 _ 0 _ 4 _  5 _ _ 3 1 _ _ _  4 _ 5 4 2 _ 1 _  6 _ _ _ 8 _ 10 _',
        B: '7 _ 8 7 4 _ 7 _  8 _ 10 _ 12 _ 10 8  7 _ _ 5 4 _ 2 _  1 _ _ _ 0 _ _ _' }
    },

    // Space: floating - shimmering bells through a long echo, soft pulse.
    space: {
      bpm: 104, gain: 0.49, root: 52, scale: 'lydian', prog: [0, 1, 5, 4], form: '-ABA',
      delay: 0.4,
      drums: { k: 'x.........x.....', h: '....x.......x...' },
      bass: { inst: 'sub', oct: -1, pat: 'x-----x-----x---' },
      arp:  { inst: 'bell', oct: 2, pat: 'x.x.x.x.x.x.x.x.', seq: [0, 1, 2, 3, 2, 1] },
      pad:  { inst: 'pad' },
      lead: { inst: 'sine', oct: 1,
        A: '7 _ _ _ 6 _ 4 _  3 _ _ _ 5 _ 8 _  9 _ _ 7 _ _ 5 _  6 _ _ _ _ _ 4 _',
        B: '11 _ 10 _ 9 _ 7 _  8 _ _ 10 _ _ 12 _  12 _ 11 _ 9 _ 7 _  11 _ _ _ 8 _ _ _' }
    },

    // Alien: an unfamiliar scale, a wobbling lead and glitchy percussion.
    alien: {
      bpm: 140, gain: 0.93, root: 49, scale: 'hungarian', prog: [0, 3, 0, 4], form: '-ABA',
      delay: 0.2, perc: 'metal',
      drums: { k: 'x..x..x...x..x..', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.',
               p: '.x....x..x....x.' },
      bass: { inst: 'sqbass', oct: -1, pat: 'x..x..x.x..x..x.' },
      arp:  { inst: 'wobble', oct: 1, pat: 'x.xx.xx.x.xx.xx.', seq: [0, 2, 1, 2] },
      lead: { inst: 'wobble', oct: 1,
        A: '4 _ 3 _ 2 _ 3 _  6 _ _ 5 _ _ 3 _  4 _ 7 _ 6 _ 4 _  5 _ _ _ 4 _ _ _',
        B: '7 _ 9 _ 8 _ 7 _  10 _ _ 9 7 _ 6 _  7 _ 11 _ 10 _ 9 _  8 _ _ _ 11 _ _ _' }
    },

    // The legacy tracks: plain chiptune, from before there were themes.
    classic: {
      bpm: 128, gain: 1.4, root: 60, scale: 'major', prog: [0, 5, 3, 4], form: '-ABA',
      delay: 0.08,
      drums: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
      bass: { inst: 'chip', oct: -2, pat: 'x.o.x.o.x.o.x.o.' },
      arp:  { inst: 'chip', oct: 1, pat: 'xxxxxxxxxxxxxxxx', seq: [0, 1, 2] },
      lead: { inst: 'chip', oct: 1,
        A: '4 _ 4 _ 5 4 2 _  7 _ 5 _ 4 _ 2 _  3 _ 5 _ 7 _ 9 _  8 _ 7 _ 6 _ 4 _',
        B: '7 _ 9 _ 11 _ 9 7  12 _ 11 _ 9 _ 7 _  10 _ 9 _ 7 _ 5 _  6 _ 8 _ 11 _ _ _' }
    }
  };

  /* Not a song anyone is meant to hear. No drums and no tune: a low drone
   * that swells in over seconds, a chord that shifts up a semitone and back,
   * and now and then one high glass note into a long echo, with a lot of
   * nothing between them. Faded in and out slowly (`fadeIn`/`fadeOut`) and
   * played through the same engine and volume as everything else - trimmed
   * to sit about 5 dB under the other songs rather than level with them. */
  SONGS.stillness = {
    bpm: 40, gain: 0.43, root: 38, scale: 'phrygian', prog: [0, 0, 1, 0], form: 'ABAB',
    delay: 0.45, fadeIn: 4, fadeOut: 3,
    drums: {},
    bass: { inst: 'drone', oct: 0, pat: 'x---------------' },
    pad:  { inst: 'drone', oct: 1 },
    lead: { inst: 'glass', oct: 2,
      A: '. . . . . . . .  . . 8 _ _ _ . .  . . . . . . . .  . . . . 11 _ _ _',
      B: '. . . . 12 _ _ _  . . . . . . . .  . . . . . . 9 _  . . . . . . . .' }
  };

  global.MUSIC = { scales: SCALES, songs: SONGS };
})(typeof window !== 'undefined' ? window : globalThis);
