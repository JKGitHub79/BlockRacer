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

Five of them, and the race is only one.

**Front door.** Three doors across: OPTIONS, PLAY, SHOP. The shop is not built,
so it is shown as what it is - dimmed and marked - rather than as a live button
that opens nothing.

**Mode.** PLAY asks how you want to drive before it asks what you want to drive
on: RACE or TIME TRIAL. It comes first because the answer changes what the
track cards have to say - a medal in a race, a lap record in a trial.

**Play.** One theme at a time, three tracks across, arrows either side and the
left/right keys doing the same. The theme's landscape is behind it. Themes come
from `js/themes.js` and the screen is built entirely from that list, so a fourth
theme is a data entry and no screen code changes. A pill above the theme name
says which mode you are picking for, because the carousel is otherwise
identical either way and the only way to find out would be to start a race and
count the cars.

**Options.** Everything that configures a race - slide, field size, AI level,
game speed, race length, road colour - plus the legacy tracks.

**Race.** A HOME button sits at the top left. It pauses and offers HOME or
CONTINUE, and `ESC` does the same. Leaving a race used to be one keystroke with
no way back.

`Screens.show(name)` is the whole router. Screens are full-bleed and opaque
rather than panels over the board, because a phone in landscape leaves the board
barely 360px wide and a settings screen will never fit inside that however hard
it is squeezed. The race view is never taken out of the layout to hide it - the
painted backdrop covers it instead - because `Renderer.fit` measures that
container, and a container measured while it is `display:none` comes back
zero-sized.

## Themes and tracks

Three themes, ascending in difficulty, three tracks each:

| Theme | Tracks | | |
| --- | --- | --- | --- |
| Forest | Pinefall, Hollow, Canopy | easiest | **built** |
| Desert | Duneline, Salt Flats, Canyon Run | harder | **built** |
| Snow | Frostline, Glacier, Whiteout | moderate | **built** |

All nine are built. A theme's track is matched to `js/tracks.js` by id, and a
name with no track behind it renders as a placeholder rather than being hidden,
so a fourth theme can be sketched in `js/themes.js` and filled in later.

### The forest three

All nine cells wide - wider than anything built before - and all three below
the previous easiest track in the game. They share a palette and a shape
language: a rectangular ring with pine stands set into the straights, and every
stand three cells thick, which leaves a **six-cell gate with the racing line
down the middle**. That is 3.0 cells of margin once the turn arc and the car's
own width are paid for, against Catalunya's 2.0 and Staircase's 0.4.

| | Corners | Lane changes | Crashes |
| --- | --- | --- | --- |
| Pinefall | 6 | 1 | 58 |
| Hollow | 10 | 3 | 88 |
| Canopy | 12 | 4 | 125 |
| *Snowdrift, the easiest before these* | *6* | *0* | *135* |

They differ only in how often the road asks you to move and how much straight
there is in between. Nothing is narrowed and no gate is tightened.

Getting there took three goes, and the third one is the lesson.

| | Pinefall | Hollow | Canopy |
| --- | --- | --- | --- |
| four-cell stands, five cells between each pair | 124 | 396 | 530 |
| eight cells between each pair | 113 | 333 | 352 |
| **three-cell stands** | **58** | **88** | **125** |

The first cut put two of the three supposedly easy tracks in the same band as
Wildwood and Caldera. Giving a late turn-in somewhere to go - eight cells
between paired stands instead of five - helped, but not nearly enough.

**Taking one cell off the thickness of every stand did it**, better than
halving the count. A cell off the stand is a cell onto the gate *and* a cell
off the lane change, and the two compound. When a lane change is expensive, the
thickness of the thing forcing it is the first place to look, ahead of how far
apart things are.

One thing deliberately *not* done: the AI's late-turn mistake rate was left
alone. Turning it down halves the crash count on any track, but it makes the
opposition tidier rather than the track kinder, and the count is only useful as
a measure of the geometry while the drivers stay the same.

### The desert three

One step up from the forest, and a deliberately small one. The roads stay
**nine cells wide** and the stands stay three thick, so the gate a car threads
is the same six cells with the same 3.0 cells of margin. Two things change:
each track asks for **one more change of lane** than its forest counterpart,
and the runoff past a turn-in comes down from eight cells to six.

| | Corners | Lane changes | Crashes | vs forest |
| --- | --- | --- | --- | --- |
| Duneline | 8 | 2 | 69 | Pinefall 58 |
| Salt Flats | 12 | 4 | 144 | Hollow 88 |
| Canyon Run | 14 | 5 | 190 | Canopy 124 |

Three footprints rather than one, so they do not read as the forest
recoloured: Duneline is long and low (48 x 26) with two twenty-cell straights,
Salt Flats is tall and square (40 x 32) and asks for a change on every side,
Canyon Run is the big one (46 x 30) with a double-S down the main straight -
out, back, out again - before the first corner.

**Narrowing the road to eight cells was tried first, and it is not a small
step at all.** A five-cell gate leaves 2.5 cells of margin against the
forest's 3.0, which sounds like nothing; it more than doubled the cost of
every lane change and put two of the three in the same band as Wildwood and
Caldera:

| | Duneline | Salt Flats | Canyon Run |
| --- | --- | --- | --- |
| eight-cell roads, five-cell gates | 156 | 373 | 417 |
| **nine-cell roads, six-cell gates** | **69** | **144** | **190** |

Same layouts, same lane counts, one cell of road. The gate margin dominates
every other term, which is why it is now the one thing held still across a
theme and the difficulty step comes from how *often* the road asks, not from
how tight the ask is.

### The snow three

Moderate, and - unlike the forest and the desert, which are the same
rectangular ring three times each - **three different shapes**. The first cut
of this theme was the desert layouts one cell narrower, which is a palette
swap rather than a theme, and it was rightly rejected.

| | Shape | Corners | Lane changes | Crashes |
| --- | --- | --- | --- | --- |
| Frostline | switchback | 12 | 3 | 294 |
| Glacier | figure of eight | 12 | 3 | 318 |
| Whiteout | L-shaped | 16 | 5 | 450 |

**Frostline has no island.** The middle of the map is a corridor walled on
both sides with exactly one way in and one way out, so the lap is a
switchback: down the right, west along the bottom, up a link at the far left,
east along the middle, up a climb, east along the top, back into the right.
The walls force the lap rather than the racing line describing it.

**Glacier crosses itself.** Two lobes meet at an eight-by-eight junction in
the middle of the map and the route goes through it twice a lap - once
northbound out of the main straight, once westbound along the middle. That
changes the racing rather than the geometry: the field arrives at one square
from two directions.

**Whiteout is an L.** The top right of the map is solid ground, so the lap
runs round a corner the circuit does not have, and the elbow is a wide open
sweep instead of a corner. It carries the longest straight in the game with a
double-S in it.

The roads are eight cells rather than the desert's nine, worth roughly double
on its own, but the shapes are the point.

**Frostline and Glacier are within eight per cent of each other** and are not
meaningfully orderable, the same way the three legacy moderates are not. They
are different shapes rather than different difficulties, and four passes at
moving stands around Frostline did not separate them - twice the change went
the wrong way, because on a switchback moving a stand changes its distance to
a *corner*, and that matters more than the runoff either side of it. That is a
fourth lever, and one that behaves differently per shape rather than
uniformly, which is why it is not in the list below.

### The ladder

Nine tracks, one continuous curve:

| | 1 | 2 | 3 |
| --- | --- | --- | --- |
| Forest | 58 | 88 | 124 |
| Desert | 69 | 144 | 190 |
| Snow | 294 | 318 | 450 |

In order: 58, 69, 88, 124, 144, 190, 294, 318, 450. Forest and Desert
interleave, so the first track of the desert is easier than the last of the
forest and a new theme reads as a new theme rather than a wall. Snow does not
interleave - it steps clear of the desert and stays there, because it is the
moderate band.

Three levers, in order of how much they are worth:

1. **Gate margin** - the road width minus the stand. 3.0 cells to 2.5 is worth
   roughly double the crash count. Held still within a theme, changed only
   between them.
2. **How often the road asks** - one more lane change per track is worth
   somewhere around a fifth to a third.
3. **Runoff past a turn-in** - eight cells to five is worth around 10-20 per
   cent. The fine adjustment, and how each theme's three tracks were levelled
   against one another.

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

## Finishing a race

The result panel offers **BACK**, **RACE AGAIN** and **NEXT TRACK**. Next track
means the next one in the theme, then the first of the theme after it, wrapping
round at the end so the button is never dead; a legacy race walks the legacy
list instead. Themed entries with no track behind them yet are skipped, so it
never lands on a placeholder.

Where a race was started from is a hint rather than an answer - a URL can start
a themed track without the carousel being involved - so if the current track is
not in the list that hint points at, the other list is used.

## Race and time trial

**RACE** is the game as it was: a field of cars, a finishing position, medals.

**TIME TRIAL** takes the field away. One car, yours, on an empty track. There
are no opponents, so there is no position and no running order - those two HUD
rows are removed rather than filled with a meaningless `1 / 1` - and there is
no podium, so no medal is written. What replaces them is the clock: LAST LAP,
BEST LAP, and RECORD, the fastest lap you have ever driven there.

The result panel lists your laps instead of a finishing order, marks the
quickest one, and says whether it was a record.

A record is banked the moment it is set rather than at the end of the run, so
quitting a trial half way through does not throw away the fastest lap you have
ever driven on the track.

`Game.mode` is `'race'` or `'trial'` and is the only thing that branches:
`reset` builds one car instead of a field, `drawHud` swaps two rows,
`showResults` hands off to `showTrialResults`. Nothing in the physics, the
track code or the renderer knows which mode it is in.

## The starting grid

**You start at the back.** `T.gridFor` hands its slots back front-to-back, so
the field is the opponents in their usual order with YOU appended - last index,
last slot, last row - whether that is a field of two or of sixteen, and on
every track, because nothing in `fieldFor` knows what shape the grid it is
being poured into has.

Starting third of four was a hangover from the field being a fixed list with
YOU sitting in the middle of it. Racing from the back means the race has
somewhere to go.

On the grid the running order is taken from the grid itself rather than from
`progressAlong`. That projects a car onto the racing line; on most tracks the
back rows sit where the line is arcing through a corner, and the projection of
a row of cars sitting perfectly level then differs by up to a couple of cells
from lane to lane. Taken literally it showed you seventh of eight while you sat
on the last slot of the grid. Nothing has moved during the countdown, so there
is nothing to measure.

## AI level

A slider on the options screen, 1 to 10, remembered between sessions under its
own `localStorage` key. **It changes how well the opponents drive, not how fast
they can go.**

Level 5 is exactly the hand-tuned field: every multiplier is 1, so a default
race is the race it has always been and every crash count in the table above
still means what it says. Level 1 turns too late for roughly a corner in three.
Level 10 hardly ever does.

`CONFIG.aiLevels` is the table and `CONFIG.aiSpec` applies it, scaling a
profile rather than replacing it so the shape of the field - who runs wide, who
is slowest - survives every level. It multiplies three things:

| | mistake rate | recovery time | pace |
| --- | --- | --- | --- |
| 1 | x2.80 | x2.20 | x0.880 |
| 5 | x1.00 | x1.00 | x1.000 |
| 10 | x0.10 | x0.45 | x1.020 |

Pace moves with the level, but `aiSpec` clamps `speedMul` to 1 and every
track's `aiPace` is at or below 1, so **an opponent never has a higher top
speed than yours at any level.** Measured over 40 races on Pinefall, the median
AI lap goes 12.41s at level 1, 10.24s at level 5, 9.78s at level 10 - but the
*slowest* lap falls much further, 16.59s to 13.54s to 11.63s. That is the right
shape: a high level does not out-run you, it stops throwing laps away. A
flawless player still beats level 10, which is what "extremely well" should
mean in a game with one speed and no brakes.

The level is a preference rather than a result, so RESET DATA leaves it alone.
Time trials ignore it entirely - there is nobody to set a level for.

## Medals and lap records

Two records, kept apart on purpose: different storage keys, different API,
different code paths, and never shown on the same card. A medal is a race
result and a lap record is a time-trial result; neither counts towards the
other.

### Medals

Finish a track on the podium and the track-select card keeps a border for good:
bronze for a third, silver for a second, gold for a win. Only an improvement is
written, so finishing fourth after a win does not take the win away, and
neither does finishing second.

**The medal colour goes on the border and on a corner badge, and nowhere else.**
The track name stays the same near-white on the same dark card whether the card
is unmedalled, bronze or gold. Tinting the name to match the medal is the
obvious thing to do and the first thing to become unreadable - a gold name on a
gold-lit card is the worst of the three, and silver on a light card is not much
better.

**RESET DATA** on the options screen wipes both the medals and the lap records.
It takes two presses, because it cannot be undone, and the armed state times
out after five seconds rather than sticking - a stray press left on screen
should not be finishable by an accidental second one later.

Stored in `localStorage` under one key, which is allowed to be missing, full,
or to throw on read in a private window or with site data blocked. Every access
is wrapped; a failure means the medals do not persist, never that the game
stops, and the in-memory copy still shows what was won in the session. What
comes back out of storage is filtered to values that are still a podium place,
because it was put there by an older version of the file or by hand.

A medal is recorded for any podium finish at whatever settings the race ran
at. With the field set to two cars you are first or second by definition, so
silver is free - left as it is deliberately, because the options screen is a
set of testing controls rather than a difficulty dial.

### Lap records

A time trial's card carries your fastest lap where a race's card carries a
medal, as a time in a square chip rather than a round badge: a record is a
number to beat, not a trophy, and one that looked like a medal would read as
one. The card border is left alone.

**Records are keyed by track AND game speed**, because they are not comparable
across speeds. A lap at SWEAT is twice as quick as the same driving at
BEGINNER, and a single stored number would mean one run at the top speed
permanently retires the track. A record belongs to the setting it was set at,
and the card shows the one for the speed you are about to drive at. Slide is
deliberately *not* part of the key - it is a live prototyping control that `[`
and `]` change mid-lap, and a key that moved under you every time you pressed a
bracket would be worse than no key at all.

Stored under `blockracer.laps.v1`, wrapped exactly as the medals are, and
filtered on read to positive times under an hour - an hour is not a lap, it is
a corrupt or hand-edited entry.

## The landscapes

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
- **Every checkpoint spans the whole road**, not the lane the racing line
  happens to take, so any way round counts. Six tracks shipped with checkpoints
  sized to the line instead - and Caldera's finish line too - which meant a
  player driving a wider line silently lost the lap. Nothing in the AI ever
  found it, because the AI drives the line the checkpoints were drawn around.
  `npm run check` now fails any zone narrower than the road it crosses.

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
| Pinefall | 58 | 623 |
| Duneline | 69 | 1067 |
| Hollow | 88 | 1416 |
| Canopy | 124 | 1927 |
| Snowdrift | 135 | 1673 |
| Salt Flats | 144 | 2256 |
| Crossover | 150 | 1576 |
| Canyon Run | 190 | 2632 |
| Mesa | 196 | 1990 |
| Frostline | 294 | 2048 |
| Glacier | 318 | 2559 |
| Catalunya | 407 | 2564 |
| Wildwood | 417 | 1995 |
| Caldera | 433 | 1547 |
| Whiteout | 450 | 4340 |
| Staircase | 2408 | 11962 |

The nine themed tracks and the six that came before them interleave into one
run from 58 to 464 with no gap in it, and Staircase on its own at five times
the top of that. Catalunya's high scrape
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
2. URL parameters - `index.html?track=2&laps=7&speed=3&slide=0.4&road=3&cars=8&ai=9`
   (tracks and speeds are 1-based, laps 1-20, road 0-5, cars 2-16, ai 1-10).
   Naming a
   track **starts that race straight away**: before the menus were screens the
   parameter only preselected it, because the one menu was a click from
   starting, and now it would be three clicks through a legacy list,
3. `track`, `laps`, `speedLevel`, `slide`, `roadTint`, `cars` and `aiLevel` in
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
| `js/screens.js` | which screen is up, and what NEXT TRACK means from here |
| `js/progress.js` | the medals, and the one localStorage key they live in |
| `js/backdrop.js` | the painted landscapes behind the menus |
| `js/render.js` | canvas drawing, including the track thumbnails |
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
node tools/simulate.js 5 40 "" "" "" "" 10   # ...against level 10 opponents
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
