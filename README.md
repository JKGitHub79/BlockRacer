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

## Screens

Four of them, and the race is only one.

**Front door.** Three doors across: OPTIONS, PLAY, SHOP. The shop is not built,
so it is shown as what it is - dimmed and marked - rather than as a live button
that opens nothing.

**Play.** One theme at a time, three tracks across, arrows either side and the
left/right keys doing the same. The theme's landscape is behind it. Themes come
from `js/themes.js` and the screen is built entirely from that list, so a fourth
theme is a data entry and no screen code changes.

**Options.** Everything that configures a race - slide, field size, game speed,
race length, road colour - plus the legacy tracks.

**Race.** Unchanged.

`Screens.show(name)` is the whole router. Screens are full-bleed and opaque
rather than panels over the board, because a phone in landscape leaves the board
barely 360px wide and a settings screen will never fit inside that however hard
it is squeezed. The race view is never taken out of the layout to hide it - the
painted backdrop covers it instead - because `Renderer.fit` measures that
container, and a container measured while it is `display:none` comes back
zero-sized.

## Themes and tracks

Three themes, ascending in difficulty, three tracks each:

| Theme | Tracks | |
| --- | --- | --- |
| Forest | Pinefall, Hollow, Canopy | easiest |
| Desert | Duneline, Salt Flats, Canyon Run | harder |
| Snow | Frostline, Glacier, Whiteout | harder again |

**These nine tracks are not built yet.** They are named in `js/themes.js` and
show on the cards as still to come. A theme's track is matched to `js/tracks.js`
by id; a name with no track behind it renders as a placeholder rather than being
hidden, so the shape of what is being built stays visible while it is built.

The seven circuits that came first - Crossover, Snowdrift, Mesa, Wildwood,
Catalunya, Caldera, Staircase - are the **legacy tracks**, on the options
screen. They are being replaced rather than removed, and they stay raceable.

### The card pictures

Rendered from track data at the moment the card is drawn, not shipped as
images. `Renderer.thumbnail` deliberately does not go through `T.load` and
`bakeTrack`: loading mutates the one live TRACK in place, and drawing a menu
must not disturb the track the game is holding. The cost is a second, much
simpler painter - road, solids, racing line, finish. The gain is that a
thumbnail can never be a stale picture of a track that has since been edited,
the way a folder of PNGs would be within a week.

### The landscapes

Painted in code - `js/backdrop.js` - from rectangles, triangles and gradients,
in the same flat idiom as the track itself, so the menus and the game look like
one thing. Shapes are laid out from a seeded generator, so a scene is identical
every time it is drawn and across a resize; a ridge line that reshuffled itself
when you turned your phone would read as a glitch. Only the weather moves, and
it moves on the clock rather than on a stored position, so nothing accumulates
and nothing has to be reset.

Three things learned the hard way getting them to read:

- **Depth is value, not size.** Three bands of the same green is one flat wall
  of trees. The far band has to be hazed almost to the colour of the sky behind
  it and the near band nearly black.
- **A light source is a gradient, not a circle.** A flat-alpha disc reads as a
  pale sticker stuck on the sky.
- **A mountain range needs many more peaks than you think.** Seven points across
  the screen gives slabs. The step is 4.5% of the width, and the heights are
  skewed so most of the range is low and the occasional one stands out of it.

Scenes also keep their horizon and their landmarks out of the middle third of
the screen, where the cards are, so the scenery is seen rather than half-hidden
behind them.

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

### 3 · Mesa — beginner

Snowdrift's roads laid out as a **Z**, 40 x 28 cells. Two corners of the map
are off it - the north east and the south west - so the circuit runs diagonally
across the board, stepping down once on the way out and up once on the way
back. Eight turns, all of them wide open. The shape is the same either way up:
the second half of the lap is the first half rotated half a turn.

It sits with Crossover at the easy end - 81 crashes over 25 simulated races
against Crossover's 80 - with a slightly quicker lap at 10.9s.

The dust blows live, and the mesa in the middle is the wall.

### 4 · Wildwood — moderate

The point of this one is rhythm rather than shape. Single stands of trees close
in from alternating sides of the bottom straight, spaced four cells apart -
which at the default slide is close enough that a car is still coming out of
one arc as it has to be thrown into the next. **Five corners running into one
another**, with 2.4 cells of straight between each and the same gap every time,
arrived at off a thirty-cell straight along the top. The rest of the lap is
deliberately plain, so the trees are the only thing to think about.

The road through the trees is eight cells rather than six, and the wood is cut
back to make the room. Three-cell lanes were tried first and left barely half a
cell of margin past each turn-in, and nearly every crash in the race happened in
there. That is not flowing, that is Staircase. At eight cells wide it sits with
the other two moderates, which is where it belongs - see the table below.

Leaves fall as you drive.

### 5 · Catalunya — moderate

Blaugrana. A 28-cell main straight along the bottom, then two corner complexes
with a breather between them: a four-turn chicane up the right-hand road, and a
four-turn sequence back along the top. **Eight-cell roads, the widest on any
track**, because the corners here are meant to be taken quickly rather than
threaded.

It reads 5 linked corners, the same count as Wildwood, but in two bursts rather
than one run: 2.4, 3.4, 2.4 and 2.9 cells of straight through the right-hand
chicane, then 2.4, 3.4, 2.4 along the top. A car is still unwinding out of one
arc as the next one arrives, twice a lap, with the long straight to reset in
between.

The first version put every gate between the chicane blocks at three cells with
the racing line down the middle. At the default slide that leaves 0.3 cells of
margin once the arc and the car's own width are paid for, and it showed: in the
first layout a sixth of every crash in the race happened in one cell, under the
first chicane block after the main straight, and the track came out harder than
Caldera - which is not what a track this wide should be. Widening every gate to
four cells fixed most of it, and biasing the line half a cell toward the entry
side did the rest: the overshoot is always late, never early, so the runoff
wants to be past the apex rather than before it. It now sits with the other two
moderates.

The infield carries the livery: blaugrana stripes, a senyera band across the
middle and a scatter of trencadis tiles over the top, all of it painted a
couple of stops under the tarmac. The cars have to stay the brightest things on
screen, and a big flat panel in the middle of the board is exactly where that
is easiest to lose.

### 6 · Caldera — moderate

A ring road around a lava lake, 40 x 28 cells. The roads are six cells wide,
same as Crossover, and a flow of lava crosses each of the long straights -
blocking one half, so you have to step across to the other and back. Eight
turns a lap against Crossover's six, and the flows leave a three-cell gap where
Staircase's chicanes leave two, two of them rather than eight.

Every solid on this track is molten - the rim, the lake and the flows - so a
mistake is always the same mistake, and it stops you the same way a wall does.
The lava is animated: two sheets of glow scroll across each other under a
cooled crust, painted at a third resolution and stretched back up, which is a
ninth of the pixels and indistinguishable on something this soft.

### 7 · Staircase — hard

A four-cell corridor around a solid infield, 40 x 25 cells. Each of the four
straights carries two blocks on **alternating halves** of the corridor, so no
straight can be driven in a single lane - you have to staircase your way round
with 90° turns. The amber-edged blocks are the ones that will stop you if you
miss a turn.

### How hard each one actually is

Crashes are what a track costs you, so that is what is counted: 60 headless
races of 5 laps on each, four cars, beginner speed, the default slide. A crash
is a contact square enough to stop a car dead; a scrape is one it carries speed
through.

| Track | Crashes | Scrapes |
| --- | --- | --- |
| Snowdrift | 135 | 1673 |
| Crossover | 150 | 1576 |
| Mesa | 196 | 1990 |
| Catalunya | 407 | 2564 |
| Wildwood | 417 | 1995 |
| Caldera | 433 | 1547 |
| Staircase | 2408 | 11962 |

Three clear bands: an easy three, three moderates that are within six per cent
of one another and are not meaningfully orderable between themselves, and
Staircase on its own at nearly six times the moderates. Catalunya's high scrape
count against its crash count is the eight-cell roads doing their job - you pay
for a mistake there by losing a tenth down a wall rather than by stopping.

These figures replaced an earlier set that ran lower. The simulator used to fill
its fourth seat with a straight copy of the first opponent, so a quarter of
every simulated field drove a line another car was already on; it now gets its
own driver, like the fourth car in a real four-car race, and the moderates in
particular moved by about a fifth. Nothing about the tracks changed. Do not
compare these numbers with any quoted in an earlier commit.

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

1. the options screen,
2. URL parameters - `index.html?track=2&laps=7&speed=3&slide=0.4&road=3&cars=8`
   (tracks and speeds are 1-based, laps 1-20, road 0-5, cars 2-16). Naming a
   track **starts that race straight away**: before the menus were screens the
   parameter only preselected it, because the one menu was a click from
   starting, and now it would be three clicks through a legacy list,
3. `track`, `laps`, `speedLevel`, `slide`, `roadTint` and `cars` in
   `js/config.js`.

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

## How many cars

Four by default - you and three - and anything from 2 to 16 on the options screen.
The number includes you, and you keep third on the grid whatever the field size.

A track declares four grid slots, and at four or fewer those four are used
exactly as declared, so a default race lines up where it always has. Past four
the grid is built from scratch on the same piece of road: lanes across it, rows
back up it, each slot tested against a car-sized box so nothing is ever gridded
inside scenery.

Neither the width nor the run-up is read from the track file - both are
measured, by walking that box outward until it meets something. The width is
measured at the finish line rather than at the grid, which matters: on several
tracks the grid sits in the corner before the straight, and a probe started
there escapes up the road the circuit arrives on and reports a width the
straight has not got.

**The number is a ceiling, not a promise.** Six of the seven tracks grid a full
sixteen. Staircase tops out at nine - a four-cell corridor takes three abreast
and there are only three rows of road behind the line before the corner - and
the menu says so rather than quietly racing a smaller field:

| Track | Grid | Layout |
| --- | --- | --- |
| Crossover, Snowdrift, Mesa, Wildwood, Caldera | 16 | 4 abreast, 4 rows |
| Catalunya | 16 | 5 abreast, 4 rows |
| Staircase | 9 | 3 abreast, 3 rows |

Rows are spaced 1.9 cells apart, as every hand-written grid already was, and
close up to 1.55 only if the road runs out before the field does.

The three hand-tuned opponents in `js/config.js` are used as they are, in order,
so a default race is the race it always was. Past the third, profiles are
interpolated: the racing-line offset fans evenly across the road so fifteen
opponents drive fifteen lines rather than five copies of three, and pace is
dealt out in a different order so the slowest car is not always the one on the
outside.

Past eight cars the in-race leaderboard and the results table close their rows
up, and the results table scrolls inside a panel capped at the window height, so
the finishing position and both buttons stay on screen with a full field.

## Road colour

Six swatches on the start menu, next to the slide slider, for trying a colour
scheme against a real track: **black, dark grey, light grey, white, light brown
and brown**. `?road=0` to `?road=5` sets it from the URL, or `roadTint` in
`js/config.js`.

It is a look and nothing else. Nothing in the physics, the AI or the collision
grid reads it; the only work it causes is rebaking the scenery, because the road
and its grid are painted into that. Black overrides nothing at all, so each
track keeps the near-black tarmac its own theme asks for - Snowdrift's faintly
blue, Mesa's canyon brown - and the other five replace both the road and the
grid on top of it outright. Walls, weather and emblems are left alone, so a
track still looks like itself on grey.

The three light tarmacs carry their own dark set of markings. The racing line
and the checkpoint tints are pale by default, which is invisible on white, so
those two flip to dark ink; the same numbers in reverse. The cars are read
against the road rather than the background, and yellow on white is the weakest
of the twenty-four combinations - still legible thanks to the dark outline
every car carries, but it is the one to look at first if the palette changes.

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
`weather: 'snow'`, `'dust'` or `'leaves'` blows weather across the board - flakes that fall
soft and fat, or grit that tears across almost flat and is smeared along its own
direction of travel. Both wrap round the board in both directions, so nothing is
ever spawned or retired.

`emblems` paints flat livery onto the solids. Each entry is a rectangle in cell
coordinates plus a kind: `stripes` takes an `axis`, a `band` width in cells and
a list of `colors` to cycle, and `mosaic` takes a `tile` size, a `density`, a
`seed` and a palette to scatter from. Both take an `alpha`. They are clipped to
the cells that are actually wall, so a rectangle declared loosely can never
bleed onto the tarmac, and they are drawn between the flat wall fill and the lit
edges, so the faces that make a block read as raised survive the livery. All of
it is baked into the track canvas once, so it costs nothing per frame.

The grid faces whichever way the leg it sits on runs, worked out from
`startLeg`, so a circuit finishing westward grids up east of its line without
having to say so. Declare four slots as two lanes by two rows: those four are
used as declared, and a bigger field is built from them and from the road the
finish line crosses. Two things are worth getting right for that - the finish
rectangle should sit squarely on the straight rather than in the corner before
it, and the four slots should be roughly centred across the road, because their
midpoint is where the width probe starts.

## Layout

| File | What it holds |
| --- | --- |
| `js/tracks.js` | every track, as pure data |
| `js/themes.js` | the themes, and which tracks belong to each |
| `js/config.js` | every tunable number |
| `js/track.js` | loads a track: wall grid, racing line, lap rule, start grid, positions |
| `js/car.js` | movement, swept wall collision, car-to-car shoving |
| `js/ai.js` | opponent drivers |
| `js/input.js` | keyboard and touch |
| `js/backdrop.js` | the painted landscapes behind the menus |
| `js/render.js` | canvas drawing, including the track thumbnails |
| `js/screens.js` | which screen is up: front door, play, options |
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
