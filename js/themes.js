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
    },
    {
      id: 'city',
      name: 'CITY',
      tagline: 'Streets between buildings. Wet tarmac, and no room to be wrong.',
      scene: 'city',
      accent: '#ff79c6',
      tracks: [
        { id: 'gridlock',  name: 'GRIDLOCK',  grade: 'HARD' },
        { id: 'crosstown', name: 'CROSSTOWN', grade: 'HARD +' },
        { id: 'downtown',  name: 'DOWNTOWN',  grade: 'HARD ++' }
      ]
    },
    {
      id: 'industrial',
      name: 'INDUSTRIAL',
      tagline: 'A works at night. Pipe racks, barriers and nowhere to put a wheel.',
      scene: 'industrial',
      accent: '#f5a623',
      tracks: [
        { id: 'foundry',   name: 'FOUNDRY',   grade: 'EXTREME' },
        { id: 'pipeworks', name: 'PIPEWORKS', grade: 'EXTREME +' },
        { id: 'refinery',  name: 'REFINERY',  grade: 'EXTREME ++' }
      ]
    },
    {
      id: 'ruins',
      name: 'ANCIENT RUINS',
      tagline: 'Dressed stone and old shapes. A cross, a colonnade, a meander.',
      scene: 'ruins',
      accent: '#6ec9c4',
      tracks: [
        { id: 'sanctum',   name: 'SANCTUM',   grade: 'EXPERT' },
        { id: 'colonnade', name: 'COLONNADE', grade: 'EXPERT +' },
        { id: 'labyrinth', name: 'LABYRINTH', grade: 'EXPERT ++' }
      ]
    },
    {
      id: 'volcano',
      name: 'VOLCANO',
      tagline: 'Black rock and running lava. The gates here are the flows.',
      scene: 'volcano',
      accent: '#ff5a2b',
      tracks: [
        { id: 'basalt',  name: 'BASALT',  grade: 'INSANE' },
        { id: 'fissure', name: 'FISSURE', grade: 'INSANE +' },
        { id: 'crater',  name: 'CRATER',  grade: 'INSANE ++' }
      ]
    }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
