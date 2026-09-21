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
      tagline: 'Race beneath the trees where every journey begins.',
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
      tagline: 'Burn across endless sands under the scorching sun.',
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
      tagline: 'Keep your cool on frozen roads and icy turns.',
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
      tagline: 'Push higher where one wrong turn means a long way down.',
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
      tagline: 'Tear through the streets where precision meets speed.',
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
      tagline: 'Race through steel, smoke and relentless machinery.',
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
      tagline: 'Master forgotten roads carved through a lost civilisation.',
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
      tagline: 'Outrun the heat through a world of fire and molten rock.',
      scene: 'volcano',
      accent: '#ff5a2b',
      tracks: [
        { id: 'basalt',  name: 'BASALT',  grade: 'INSANE' },
        { id: 'fissure', name: 'FISSURE', grade: 'INSANE +' },
        { id: 'crater',  name: 'CRATER',  grade: 'INSANE ++' }
      ]
    },
    {
      id: 'space',
      name: 'SPACE',
      tagline: 'Leave the world behind and race among the stars.',
      scene: 'space',
      accent: '#5ef2ff',
      tracks: [
        { id: 'orbital',  name: 'ORBITAL',  grade: 'NIGHTMARE' },
        { id: 'driftfield', name: 'DRIFT FIELD', grade: 'NIGHTMARE +' },
        { id: 'horizon',  name: 'EVENT HORIZON', grade: 'NIGHTMARE ++' }
      ]
    },
    {
      id: 'alien',
      name: 'ALIEN',
      tagline: 'You’ve reached the unknown. Now survive the impossible.',
      scene: 'alien',
      accent: '#7cff5a',
      tracks: [
        { id: 'landfall',   name: 'LANDFALL',   grade: 'IMPOSSIBLE' },
        { id: 'hive',       name: 'HIVE',       grade: 'IMPOSSIBLE +' },
        { id: 'mothership', name: 'MOTHERSHIP', grade: 'IMPOSSIBLE ++' }
      ]
    }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
