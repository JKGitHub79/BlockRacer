/* Block Racer - themes.
 *
 * A theme is a band of difficulty with a look attached: a name, a backdrop for
 * the track-select screen, and three tracks. The play screen is built entirely
 * from this list, so adding a fourth theme is adding an entry here - no screen
 * code knows how many there are.
 *
 * A theme's tracks are named up front and matched to js/tracks.js by id. A
 * track named here that does not exist there yet shows on the card as still to
 * come, rather than being hidden: the shape of what is being built stays
 * visible while it is being built.
 */
(function (global) {
  'use strict';

  global.THEMES = [
    {
      id: 'forest',
      name: 'FOREST',
      tagline: 'Wide lanes under the canopy. Where you learn the car.',
      scene: 'forest',
      accent: '#5fd08a',
      tracks: [
        { id: 'pinefall', name: 'PINEFALL', grade: 'BEGINNER' },
        { id: 'hollow',   name: 'HOLLOW',   grade: 'BEGINNER +' },
        { id: 'canopy',   name: 'CANOPY',   grade: 'BEGINNER ++' }
      ]
    },
    {
      id: 'desert',
      name: 'DESERT',
      tagline: 'Wide open and still forgiving, but it asks more of you.',
      scene: 'desert',
      accent: '#e8a23c',
      tracks: [
        { id: 'duneline',  name: 'DUNELINE',   grade: 'EASY' },
        { id: 'saltflats', name: 'SALT FLATS', grade: 'EASY +' },
        { id: 'canyonrun', name: 'CANYON RUN', grade: 'EASY ++' }
      ]
    },
    {
      id: 'snow',
      name: 'SNOW',
      tagline: 'Three shapes no other theme has. A switchback, a crossing, an L.',
      scene: 'snow',
      accent: '#8fd3ff',
      tracks: [
        { id: 'frostline', name: 'FROSTLINE', grade: 'MODERATE' },
        { id: 'glacier',   name: 'GLACIER',   grade: 'MODERATE +' },
        { id: 'whiteout',  name: 'WHITEOUT',  grade: 'MODERATE ++' }
      ]
    },
    {
      id: 'cliffs',
      name: 'CLIFFS',
      tagline: 'Rock, and not much room. A serpentine, a pit and a ledge.',
      scene: 'cliffs',
      accent: '#d9884a',
      tracks: [
        { id: 'scree',    name: 'SCREE',    grade: 'CHALLENGING' },
        { id: 'overhang', name: 'OVERHANG', grade: 'CHALLENGING +' },
        { id: 'quarry',   name: 'QUARRY',   grade: 'CHALLENGING ++' }
      ]
    }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
