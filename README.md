# Block Racer

A one-screen, top-down arcade racer where everything is square. One speed, no
brakes, and the only control you have is a 90 degree turn.

**Play it:** open `index.html` in any browser. No build step, no dependencies,
no server required.

The version is stamped next to the title in the top left. It lives in one place
- `window.BR` at the top of `index.html` - and is appended to every script and
stylesheet URL, so a deploy is never served from a stale cache. Bump it when
you push, and the number on screen tells you whether what you are playing is
what you pushed.

## Controls

| Key | Action |
| --- | --- |
| `←` / `A` | rotate 90° left |
| `→` / `D` | rotate 90° right |
| `R` | restart the race |
| `Esc` | back to the settings menu |
| `P` | pause |
| `M` | mute |
| `Enter` / `Space` | start |

On a touchscreen, tap the left or right half of the screen.

The board scales to whatever screen it is on, in both dimensions, keeping the
track's shape - so a phone held sideways gets the whole circuit rather than a
cropped desktop layout. The canvas is drawn in logical track pixels whatever
the size; only its transform and backing-store resolution change, so it stays
sharp and none of the game code has to care. The panel moves below the board on
narrow screens and thins out on short ones, and the menus size to the viewport
rather than to the board, which on a phone in portrait is too small to hold
them.

## The rules

- The car runs at a single fixed speed. There is no throttle and no brake.
- A press rotates the car exactly 90°, instantly, about its own centre. It does
  **not** snap to a lane - the car keeps the exact position it had. *Where* you
  turn is the whole game.
- Its momentum does not turn with it. The car slides through the corner on a
  fixed radius, sitting at 45° to the way it is still travelling, so **you have
  to turn early**. See [Slide](#slide) below.
- Driving into a wall stops you dead. You stay there until you turn, and then
  you go again in the new direction.
- **Clipping** one does not. If most of your speed is running along the wall
  rather than into it - which is what happens when you graze an edge part way
  through a slide - the car scrubs along it instead of stopping, losing
  whatever speed the wall takes. It only stops once it is pointing into the
  wall, because then nothing is running along it any more. `graze` in
  `js/config.js` is the fraction of speed that has to be tangential for this;
  `0` makes every touch a full stop.
- Four cars start: you and three AI drivers, which have exactly the same
  controls and the same single speed. They turn late and crash sometimes.
- Cars do not stop each other. They shove each other sideways, so you can barge
  an opponent off the racing line and get barged in return.
- A lap only counts if you collect all four checkpoints in order and then cross
  the start/finish line heading the right way. Reversing over the line does
  nothing.

## The tracks

Pick one from the start menu, listed in order of difficulty. On all of them the
faint dashed line is the racing line the AI drives, and solid blocks are walls:
hitting one stops you dead wherever it is.

A track can carry a `theme`, which overrides any of the palette entries in
`js/config.js` for that track alone - that is what makes Caldera black rock and
orange rather than the usual blue.

### 1 · Crossover — beginner

A figure of eight, 40 x 28 cells. An upper-right rectangle and a lower-left
rectangle meet at a single corner in the middle of the map, so the racing line
runs straight through itself once a lap. The roads are **six cells wide - half
again as wide as Staircase** - there are no chicanes, and there are only six
turns a lap. The one hazard is the crossing in the middle, where the north-south
road and the east-west road share the same tarmac and you can meet somebody
coming the other way. The opposition also runs a few percent slower here.

A figure of eight has to *cross* itself, which is why the two rectangles share a
corner rather than an edge. Sharing an edge would give two loops joined along a
shared straight - a theta, not an eight.

### 2 · Snowdrift — beginner

Crossover's roads on a completely different plan: six cells wide, long open
legs, six turns a lap, 40 x 28 cells. The circuit is an **L** - the top right of
the map is off the map - so half way round the lap the road steps down and back
out again in an S instead of running straight on. No crossing, no chicanes; the
corner sequence is the whole of it. The island in the middle is an L as well.

It races like Crossover: 58 crashes across 25 simulated races against
Crossover's 80, and a median lap of 10.8s against 11.2s.

The snow falls live, and the drifts banked up round the circuit are the walls -
they stop you like any other wall does.

### 3 · Caldera — moderate

A ring road around a lava lake, 40 x 28 cells. The roads are six cells wide,
same as Crossover, and a flow of lava crosses each of the long straights -
blocking one half, so you have to step across to the other and back. Eight
turns a lap against Crossover's six, and the flows leave a three-cell gap where
Staircase's chicanes leave two, two of them rather than eight.

Measured over 25 simulated races: the field crashes 236 times here against 122
on Crossover and 2140 on Staircase. A little harder than the first, a long way
short of the third.

Every solid on this track is molten - the rim, the lake and the flows - so a
mistake is always the same mistake, and it stops you the same way a wall does.
The lava is animated: two sheets of glow scroll across each other under a
cooled crust, painted at a third resolution and stretched back up, which is a
ninth of the pixels and indistinguishable on something this soft.

### 4 · Staircase — hard

A four-cell corridor around a solid infield, 40 x 25 cells. Each of the four
straights carries two blocks on **alternating halves** of the corridor, so no
straight can be driven in a single lane - you have to staircase your way round
with 90° turns. The amber-edged blocks are the ones that will stop you if you
miss a turn.

## Slide

Turning swings the car's heading round instantly, but its *velocity* only
catches up at a fixed rate. At a constant speed that traces a quarter circle, so
a corner is an arc rather than a right angle and you have to commit to it early.
While the velocity is catching up the body is drawn leading it by 45° - the car
is pointing into the corner and still travelling the old way, which is what
oversteer looks like - and it lays rubber until it hooks up.

`slide` is the **turn radius in cells**, and it is a slider on the start menu
because it is the number worth prototyping with. `[` and `]` nudge it by 0.05
mid-race, so you can feel the difference without restarting - and they are the
way to hit an exact value, since the slider now spans a range far wider than
the useful part of it. It reaches every car, player and AI alike, the moment it
changes. `0` switches the whole thing off and the game behaves exactly as it did
before: instant turns, no arc, no lean. It starts at one car width (`0.8`);
`js/config.js` sets that default and `maxSlide` the top of the slider, and
`?slide=1.2` sets it from the URL.

The slider runs to `20`, which is deliberately far past anything drivable - the
point of a prototyping range is to be able to see where it stops working. What
happens as you wind it up, measured:

| Radius | What the field does |
| --- | --- |
| up to ~2 | races normally on all three tracks |
| ~3 | still fine on Crossover and Caldera; Staircase is a mess |
| ~6 | Crossover still completes laps, visibly scrappy |
| 20 | nobody can get round a corner at all; cars shuffle at the start |

Nothing breaks at the top of the range - no runaway positions, no cars ending up
inside walls - it just stops being a game.

Slide and the graze rule are two halves of one thing. Sliding makes a car travel
diagonally through a corner, so it starts grazing edges it would never have
touched when turns were instant - and before the graze rule those clips were
punished exactly as hard as driving head-on into a wall. Measured over 25 races
a track at slide 0.8, the rule cuts full stops by a third on Crossover, a
quarter on Caldera and more than half on Staircase, and turns them into scrapes:

| | Crossover | Caldera | Staircase |
| --- | --- | --- | --- |
| stops, before | 122 | 236 | 2140 |
| stops, after | 80 | 168 | 914 |

At slide 0 it changes nothing at all, by construction: a car's velocity is then
always exactly on an axis, so no contact ever has a tangential component.

It is a distance and not a duration deliberately, so the lead you have to give a
corner is the same at every game speed. Were it a duration, Hard would widen
every arc by 40% and Staircase's two-cell chicane legs would stop fitting.

Staircase's chicanes only clear up to `0.47`, so at anything above that the arc
cuts those corners far enough to clip the block it is stepping around, on the
slightly off-centre lines the AI cars drive - cars will trade paint with the
chicanes on track 2. Crossover, with its six-cell roads, is happy at `2.0`.
`node tools/validate-track.js 1.2` drives every corner of every track at a given
radius with the real physics and names the corners that do not fit, which is the
quick way to find out what a prototype value costs.

`slideOversteer` sets how far the body leads its direction of travel (`0.5` is
the 45° pose). `slideSettle` is how long the body takes to straighten up again;
it is cosmetic only, and exists because a radius small enough for Staircase
would otherwise put the drift on screen for about three frames.

## Race length, track and speed

Five laps on Crossover at Easy by default. All three are set the same way:

1. the buttons on the start menu,
2. URL parameters - `index.html?track=2&laps=7&speed=3&slide=0.4`
   (tracks and speeds are 1-based, laps 1-20),
3. `track`, `laps`, `speedLevel` and `slide` in `js/config.js`.

Game speed scales every car, player and AI alike:

| Level | Speed | Crossover lap |
| --- | --- | --- |
| Beginner | the base speed | ~11.2s |
| Intermediate | +20% | ~9.3s |
| Expert | +40% | ~8.0s |
| Sweat | double | ~5.6s |

`js/config.js` also holds base car speed, car size, the countdown, the palette,
and the per-driver AI settings (pace, how often they turn too late, how quickly
they recover). Per-track overrides - grid size, how much the AI spreads across the
road, how hard it tries - live with the track in `js/tracks.js`.

## Adding a track

Add an entry to `TRACKS` in `js/tracks.js`: a grid size, the solid rectangles,
a racing line whose consecutive waypoints are axis aligned, checkpoints, a
finish line and a starting grid. Add a button for it in `index.html`. Then run
`npm run check`, which will tell you whether a car can actually drive it.

Optional per-track settings: `theme` for the palette, `aiPace` for how hard the
opposition tries, `aiOffsetScale` for how far they spread across the road, and
`aiMistakeScale` for how often they turn in late - worth turning down on a track
whose legs are short enough that a late turn means a wall rather than a wide
line. Marking a wall rectangle `kind: 'lava'` makes it molten and animated, and
`snow: true` makes it snow.

The grid faces whichever way the leg it sits on runs, worked out from
`startLeg`, so a circuit finishing westward grids up east of its line without
having to say so.

## Layout

| File | What it holds |
| --- | --- |
| `js/tracks.js` | the two tracks, as pure data |
| `js/config.js` | every tunable number |
| `js/track.js` | loads a track: wall grid, racing line, lap rule, race positions |
| `js/car.js` | movement, swept wall collision, car-to-car shoving |
| `js/ai.js` | opponent drivers |
| `js/input.js` | keyboard and touch |
| `js/render.js` | canvas drawing |
| `js/game.js` | race loop, rules, HUD |
| `js/audio.js` | WebAudio blips, no asset files |

Scripts are plain `<script>` tags in order, deliberately: ES modules do not load
over `file://`, and the point is that you can double-click the HTML file.

## Checking a change

The two tools under `tools/` run headless in Node and need no browser:

```sh
npm run check                    # both of the below, on every track
node tools/validate-track.js     # geometry: can a car actually drive the line?
node tools/simulate.js 5 40      # 40 full races of real physics and real AI
node tools/simulate.js 5 40 1    # ...on track 1 only
node tools/simulate.js 5 40 "" 3 0.4   # ...at Hard, slide 0.4
```

`validate-track.js` sweeps a car along each track's racing line at every lateral
offset the AI uses, and fails if it ever touches a wall or cannot rotate at a
corner - so a track cannot be edited into something undriveable without
noticing. It then *drives* every corner with the real car physics at the
configured slide radius, and fails if the arc clips anything or comes out off
line. Pass a radius to try one out: `node tools/validate-track.js 0.6`. `simulate.js` runs complete races with the real car, AI and lap code
and fails if any car does not finish; it is how the AI's deadlocks and dithering
loops were found. Both are worth running after touching `config.js` or
`tracks.js`.
