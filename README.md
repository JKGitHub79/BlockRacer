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

Nine themes, ascending in difficulty, three tracks each:

| Theme | Tracks | | |
| --- | --- | --- | --- |
| Forest | Pinefall, Hollow, Canopy | easiest | **built** |
| Desert | Duneline, Salt Flats, Canyon Run | harder | **built** |
| Snow | Frostline, Glacier, Whiteout | moderate | **built** |
| Cliffs | Scree, Overhang, Quarry | challenging | **built** |
| City | Gridlock, Crosstown, Downtown | hard | **built** |
| Industrial | Foundry, Pipeworks, Refinery | extreme | **built** |
| Ancient Ruins | Sanctum, Colonnade, Labyrinth | expert | **built** |
| Volcano | Basalt, Fissure, Crater | insane | **built** |
| Space | Orbital, Drift Field, Event Horizon | nightmare | **built** |

All twenty-seven are built. A theme's track is matched to `js/tracks.js` by id,
and a name with no track behind it renders as a placeholder rather than being
hidden, so a tenth theme can be sketched in `js/themes.js` and filled in later.

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

### The cliffs three

Rock, and three silhouettes that share nothing with each other or with
anything earlier. The roads stay eight cells wide - the snow three's width -
everywhere except Overhang's tight end. What makes them harder is how often
the road asks a question, not how little room it leaves: the sharpest lever
in the game is gate margin, and that is exactly why none of these leans on it.

**Scree** is a serpentine. There is no island anywhere on the map: four
vertical lanes folded into one another end to end, with a main straight along
the bottom returning you to the first. It is the longest lap in the game at
168 cells, and three stands - one each in lane A, lane D and the straight.

The first cut had a stand in every lane and measured 742 crashes a thousand
laps, two and a half times the snow three. Each lane change on this track is
worth about a third of the crash count on its own, because the folds already
are the difficulty. Lanes B and C and the middle link are clean on purpose.

**Overhang** is two tracks in one lap. One end is the fastest thing in the
game - a thirty-nine cell straight, a long climb, a thirty-nine cell run
back. The other folds back on itself twice between six- and seven-cell
ledges. You arrive at the tight end carrying everything the straight gave
you.

**Overhang is graded below Quarry although it measures above it**, and that
is deliberate. See **Where the numbers and the driving disagree** below.

**Quarry** is a plus, not a rectangle. The road is the gap between a
plus-shaped map and a smaller plus-shaped island, so the lap runs out along
one side of each arm, round its tip and back down the other. Twelve corners,
and **four of them are re-entrant**: you turn around the outside of an armpit
rather than the inside of an island, which nothing else in the game asks for.
It is the corner that catches people, because the wall you are turning away
from is behind you and there is nothing to aim at - and it is why this is the
hardest track in the theme to drive even though it is not the hardest to
simulate.

### The city three

Streets between buildings, and the solids stop being scenery you drive
around. A city track is a grid of blocks with the tarmac left over, which is
the opposite way round from every theme before it, where a circuit was drawn
and an island dropped in the middle of it.

Two of the three are **pure corridor**: every wall on them is solid, the road
is one continuous street, and at no point on a lap is there a second way to
go. That is deliberate, and it is a correction. The first cut of Crosstown
drove the same street twice a lap in two different lanes, and Downtown's lap
crossed itself at a junction it arrived at twice from two directions. Both
ideas are good on paper and both are illegible at speed, because a city gives
you nothing to navigate by - every street is a grey gap between two identical
blocks. A track whose difficulty is *not knowing where the road goes* is not a
hard track, it is a badly drawn one.

**Gridlock** is a block grid: four streets one way, three the other, six
buildings between them, and a lap that weaves through the junctions rather
than running round the outside. Nothing else in the game has more than four
solid masses. Every street the lap does not use is **built over** - a street
you can see down but not drive is a city, and a street you can accidentally
drive down is runoff.

**Crosstown** is a pinwheel. Four corner blocks, one cross-shaped block in the
middle, and a street that turns twelve times in a hundred and forty-four
cells: west, south, west, south, east, south, east, north, east, north, west,
north, and back to where it started. Its legs are eleven and thirteen cells
against a six-cell street, which is the whole reason it is hard - there is no
straight to speak of, so the car is always either in a corner or lining one
up. The six roadworks sit one per north-south street, and the lap takes every
one of them on the far side, so the line runs down the middle of the east-west
streets and hard up one lane of the north-south ones, alternating, the whole
way round.

**Downtown** is two long streets and two teeth. The west and east streets run
the full height of the map - thirty-three cells, the longest in the theme -
and between them the lap bites once up from the bottom and once down from the
top around a block. Both long streets carry a **pair** of roadworks against
opposite kerbs eighteen cells apart, so the lane the first one leaves clear is
the lane the second one blocks: there is no threading them, the car has to
change lanes in the middle of the fastest road on the track. The six short
streets get one apiece.

### The industrial three

A works rather than a town: pipe racks, sheds, gasholders and the
hardstanding between them. The city took the road down to six cells; this
theme keeps six on two tracks and takes it to five on the third, and puts a
crash barrier on nearly every straight.

**Foundry** is a zigzag ring with four teeth - two biting down from the top
of the map and two up from the bottom - round one plant block that fills most
of the middle. Fourteen corners in a hundred and ninety-four cells, and only
two legs longer than twelve: the west street and the east. Both of those
carry a **pair** of barriers against opposite kerbs, so the lane one leaves
clear is the lane the other blocks and the car has to change lanes in the
middle of the fastest road on the track.

**Pipeworks** is five cells of road, the narrowest in the game, hooked round
a rack that covers most of the map. Its barriers are a single cell thick
rather than two, because two would leave three - and a three-cell gate is the
one thing the cliffs proved is a trap rather than a difficulty.

Its two haul roads are six cells rather than five, and that is a fix rather
than a flourish. The first cut had five-cell pairs on them and the validator
caught all six corners overshooting by 0.31 of a cell: **a lane change needs
two turn radii of room to complete**, 1.6 cells at the default slide, and a
five-cell road with a pair on it can only ever offer one. A five-cell road
cannot be a lane-change road. Widening the two long streets by a cell each
gave them the 2-cell change and cost nothing anywhere else.

**Refinery** is sixteen corners with five **loading bays** cut into the plant,
three cells wide and three deep, opening straight off the road. Driving into
one is a wrong turn you can actually make. A bay is a dead end walled on its
other three sides, so the cost is a second and a reverse rather than a lost
lap, and the lap itself visits every piece of road exactly once and never
crosses.

### The ruins three

Dressed stone, and shapes that are BUILT rather than laid out. Every theme
before this took its shapes from what a road does - a ring, a weave, a grid.
These three take them from what a building does.

**Sanctum** is a temple on a cross plan and the lap is the processional walk
round it: a band of constant width following a PLUS, so outside corners and
inside ones alternate and four of the twelve are the armpits of the cross,
where the wall you are leaning on becomes the wall you are turning into.
Twelve corners in a hundred and twenty-two cells is the tightest corner
rhythm in the game - no straight on it is longer than sixteen.

**Colonnade** is three columns of stone hanging into the middle of the map
from the top, and the lap threads between them: up one side, down the next,
up the third. A comb rather than a ring.

**Labyrinth** is a meander - the border pattern cut into every frieze in the
theme, driven rather than looked at. Five walls standing in from alternate
sides and the road folding back between them, with eighteen-cell folds and
the same corner taken twelve times.

All three are five cells wide, and their barriers are a single cell thick for
the reason Pipeworks established: on a five-cell road two would leave three,
and a three-cell gate is a trap rather than a difficulty.

### The volcano three

The gates here are **lava**. `kind: 'lava'` has been in the engine since
Caldera: it collides exactly like a wall and the renderer paints molten rock
over it every frame, so a flow across the road is a gate that looks like what
it is.

These three are back on **six-cell roads** after the ruins, and that is the
whole reason they are harder. A lane change needs two turn radii of room -
1.6 cells at the default slide - which a five-cell road cannot offer, so the
ruins could only ever have a gate on one side of a straight. Six cells buys
back the PAIR: two flows against opposite kerbs, far enough apart that the
lane one leaves clear is the lane the other blocks, and the car has to get
across in the middle of the fastest road on the track. Measured on Fissure,
each pair is worth about a hundred and seventy-five crashes a thousand laps -
taking two of its five out dropped it from 1131 to 783, and putting one back
brought it to 878. Nothing else in the toolkit moves a number that far
without turning a gate into a wall.

**Basalt** is a staircase down the mountain and the long way back up it: five
flights of eleven cells stepping south-east, then a twenty-two, a thirty-three
and a forty-four, with a pair on each of the three.

**Fissure** is two cracks across the middle of the map, run down one and up
the other, with a pair on each of the four long runs and one inside the first
fissure.

**Crater** is two hooks into the crater, one from each side, with a
forty-four cell run past each of them. The crater itself is a lava lake -
twenty-two cells by sixteen, the largest single hazard in the game.

### The space three

**Every solid on these three is open space.** There is nothing built out
there, so there is nothing to draw on a wall: `drawStars` gives each wall cell
a scatter of stars over near-black and the deck is the only lit surface on the
board. That inverts the values against every other theme in the game - walls
light, road dark, everywhere else - and it is the right way round here,
because out here the walls really are nothing at all. The lit lip along the
edge of the deck is then the whole of what tells you where the road stops.

The gate is a **hole**, and now it looks like one: `kind: 'void'` collides
exactly like a wall and reads as a bite taken out of the deck. Driving into
one is the same crash as driving into a spar; it just looks like a much worse
idea.

**The lever here is not the hole, it is the change of lane the hole forces.**
Orbital, taken apart: the bare ring with no holes and the racing line down the
middle of the road the whole way scores **71** crashes a thousand laps. Put the
three lane-change doglegs back in and it scores **582**. Put the eleven holes
back as well and it scores **1010**. So a change of lane costs about **170**
and a hole about **39**, and the volcano's "175 a pair" was never really the
gates at all - it was the weave they force, counted once for the pair that
caused it.

That is also the answer to an arithmetic question the volcano never had to
ask. On a six-cell deck with a car 0.8 wide, a hole two cells deep leaves a
four-cell slot whose middle sits 1.6 clear of the hole and 1.6 clear of the
plating - comfortable, and a car can hold one lane past a whole pair of them
without ever moving. A hole **three** cells deep leaves three cells and 1.1
either side, which is tight enough that the opponents' 1.5 cells of wander
costs them and wide enough that a driven line still goes through. So the pairs
on all three tracks are three cells deep and the single holes that only ask
for a lane are two, and the weave is the ladder: three changes on Orbital,
three on Drift Field, three on Event Horizon, over eight corners, twelve and
twelve-plus-four-steps respectively.

**These numbers are the second set.** The first were measured against tracks
whose checkpoints were declared in map order rather than lap order, on Orbital
and Event Horizon both. Every zone still got crossed, so every check in
`npm run check` passed and the racing looked right; but the game collects
checkpoints by index, so a lap that starts on the zone declared last needs two
laps of driving to register. The simulator counts laps, not distance, and
quietly measured those two tracks over twice the road. It reported 1027 and
1422 for layouts that were really doing 526 and 665, and the lane-change
figure came out at 350 rather than 170 for the same reason. `npm run check`
now walks the line from the finish and insists the zones come up 0, 1, 2, 3 -
see **Checking a change**.

**Orbital** is the ring round the station with one docking arm hanging into it
off the top deck - eight corners, and a forty-three cell bottom straight that
the lap starts on.

**Drift Field** is two arms, one off each deck, pointing opposite ways, so the
lap turns into the middle twice and comes out on the far side both times.
Twelve corners and fifteen holes, more than any other track in the game.

**Event Horizon** steps sideways by a full road width halfway along every one
of its four sides, so it turns twelve times without ever doubling back and
winds round a core with a hole cut clean through it. That core is the one
place on the map you can see out of, and nothing drives near it.

### The ladder

Twenty-seven tracks, one continuous curve. Crashes per thousand laps of AI
racing, measured the way the whole ladder has always been measured - beginner
speed, slide 0.8, four cars (see **A note on the numbers** below):

| | 1 | 2 | 3 |
| --- | --- | --- | --- |
| Forest | 58 | 88 | 124 |
| Desert | 69 | 144 | 190 |
| Snow | 197 | 318 | 450 |
| Cliffs | 430 | 617 | 467 |
| City | 588 | 623 | 684 |
| Industrial | 816 | 970 | 968 |
| Ancient Ruins | 734 | 755 | 729 |
| Volcano | 803 | 878 | 1020 |
| Space | 1010 | 1196 | 1481 |

In order: 58, 69, 88, 124, 144, 190, 197, 318, 430, 450, 467, 588, 617, 623,
684, 729, 734, 755, 803, 816, 878, 968, 970, 1010, 1020, 1196, 1481. Forest and Desert
interleave, so the first track of the
desert is easier than the last of the forest and a new theme reads as a new
theme rather than a wall. Snow, Cliffs and City interleave the same way, so
arriving at a harder theme is a step rather than a cliff. Industrial does not
interleave with City and is not meant to: EXTREME starts above where HARD
finished. Ancient Ruins interleaves with Industrial, which is not what was
asked for - see above. Volcano climbs cleanly. Space climbs cleanly on top of
it and ends the ladder on the highest number in the themed set. Its first
track and the volcano's last are ten crashes apart in twelve hundred laps,
which is a handover rather than a step - the one place in the top half of the
ladder where two themes touch, and the right place for it, because arriving at
the last theme should not be a wall. At the settings the game actually ships
with - sweat, six cars - the order holds: 688, 805, 1075 against the volcano's
689, 646, 764.

Pipeworks and Refinery measure the same: 970 and 968 is two crashes in twelve
hundred laps, well inside this metric's noise, so on the ladder they are tied.
They separate the right way at the settings the game ships with, and
Refinery's extra difficulty is structural rather than numerical - sixteen
corners against twelve, and five openings in the walls that Pipeworks has not
got.

The two numbers out of order are Snow's first and Cliffs' last, and both are
explained under **Where the numbers and the driving disagree**.

**Foundry and Pipeworks swap places between the two metrics**, and the reason
is worth keeping. Foundry is easier at beginner speed and harder at sweat;
Pipeworks barely moves. What scales with speed is the lane change: Foundry's
long streets each carry a pair of barriers that has to be threaded in the
middle of the fastest road on the track, and the faster the car arrives the
less room it has to get across. Pipeworks' barriers are singles on a fixed
lane - nothing to thread, so nothing that gets worse when the car is quicker.
Gate margin is a difficulty at any speed; a manoeuvre is a difficulty that
grows with it.

Three levers, in order of how much they are worth:

1. **Gate margin** - the road width minus the stand. 3.0 cells to 2.5 is worth
   roughly double the crash count. Held still within a theme, changed only
   between them.
2. **How often the road asks** - one more lane change per track is worth
   somewhere around a fifth to a third, and considerably more than that on a
   track with a lot of corners already.
3. **Runoff past a turn-in** - eight cells to five is worth around 10-20 per
   cent. The fine adjustment, and how each theme's three tracks were levelled
   against one another.

### Where the numbers and the driving disagree

Every figure in the table is **crashes per thousand laps of AI racing**, and
it is a proxy. Two things about it are worth knowing before leaning on it:

**It is not mirror-symmetric, and it should be.** Turning the eight clockwise
circuits round (below) reflects them left to right, which cannot change how
hard a track is to drive - it is the same geometry seen in a mirror, and a
driver is symmetric. The measured numbers moved anyway, by up to a third:
Frostline 294 to 197, Caldera 413 to 331, Scree 375 to 430. The cause is that
the AI field is not symmetric even though its racing-line offsets are: the
fastest opponent always runs the `+0.3` line, so a mirror puts the quick car
on the other side of the road, and on a circuit where one side is tighter
than the other that is worth real crashes. **Treat these numbers as good to
about a quarter, not to the digit.** Averaging each track over a run with the
offsets negated would fix it and has not been done.

**It measures an AI, and an AI follows a line.** Quarry is graded above
Overhang on the strength of actually playing them, against a metric that puts
Overhang 150 crashes higher. That is believable rather than embarrassing:
Quarry's difficulty is its four re-entrant corners, where you turn around the
outside of an armpit and the wall you are turning away from is behind you. A
human has to find that corner. A waypoint-follower is already pointed at the
next waypoint and the corner costs it nothing. The grade follows the driving.

### A note on the slide radius

Every figure above is measured at **slide 0.8**, which is what the whole
ladder was built against and is what the game ships at again.

It shipped at 3.0 for a few versions, and that is worth recording because of
what it did rather than what it was. At a three-cell turn radius the car is
still arcing when it reaches the next corner, so **margin stops being a
difficulty lever and becomes a wall**, and the spread between tracks
collapses - every corner is a scrape on every circuit. A cut of Quarry with
three- and four-cell gates measured 1208 crashes at those settings, three
times the hardest snow track, and every one of them was the same crash.

Corner count costs the same at any radius, which is why the cliffs three are
built on it rather than on margin. That decision was right for the wrong
reason and is still right.

The seven circuits that came first - Crossover, Snowdrift, Mesa, Wildwood,
Catalunya, Caldera, Staircase - are the **legacy tracks**, on the options
screen. They are being replaced rather than removed, and they stay raceable.

### Direction

**Every circuit runs anticlockwise.** Nine were drawn clockwise, and a set
where some go one way and some the other is not a set of tracks, it is a set
of surprises: you learn to read a corner and the next track reads it back at
you mirrored.

They are turned round by **reflecting them left to right**, not by driving the
same layout backwards. A reflection is exact - the gate margins, the run-ins,
the runoff past every turn-in survive untouched, because it is the same
geometry seen in a mirror. Driving a track backwards is a different track: a
stand that pushed you out of a corner now pushes you into one, and every
number would have to be measured again.

The flip lives at the bottom of `js/tracks.js` and is applied as the data
leaves the file, so the layouts stay as they were drawn and the diagrams in
their comments still describe them. Everything downstream - the game, the
thumbnails, the validator, `tools/map.js` - sees only the turned-round
version. A track opts in with `mirror: true`.

**Two tracks are not flipped and cannot be.** Crossover and Glacier are
figures of eight: one way round one lobe and the other way round the other.
Their left and right turns come out exactly even, which is what a figure of
eight is. Everything else, the city three included, is a simple loop and runs
anticlockwise.

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

**You start in the middle of the back row.** Being last is the point; being
last *and* on the outside kerb is a second handicap nobody asked for, and which
lane you got depended on how the track happened to declare its slots. `startRace`
now picks the slot whose lateral offset is closest to the middle of the back row
- longitudinal and lateral are measured along and across `T.startDir`, so it
works on a grid pointing any of the four ways - and hands that one to you. The
opponents fill the rest in their usual order, so the grid is the same shape it
was; only which car sits where has changed. At two cars there is nothing to
choose and you take the one remaining slot.

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

### Theme stars

A star per theme, on the same line as its name and at the same size, worked
out from the medals on its three tracks:

| | |
| --- | --- |
| Gold star | gold on all three |
| Silver star | silver or better on all three |
| Bronze star | bronze or better on all three |
| no star | any track without a medal |

**The star is the worst of the three.** Gold, gold, silver is a silver star.
One track unmedalled and there is no star at all, however good the other two
are - which is the point of it: a medal rewards a good race, a star rewards
finishing the theme.

It is **derived, never stored**. A star is a pure function of medals that are
already saved, so it cannot drift out of step with them, it upgrades itself
the instant a medal improves, and RESET DATA clears it by clearing what it is
made of. Writing a second number to `localStorage` would be a second thing to
keep in sync and a second thing to get wrong: the medals *are* the save file.

**The colour is the whole message.** It does not also say the word "GOLD"
next to a gold star; the star is the same gold as a gold card's border, and
the two read as one thing. The only place the medal is named is the star's
`aria-label`, for a screen reader, which cannot see the colour.

An unearned theme shows the same star hollow rather than nothing at all, so
the name does not shift sideways the first time you earn one, and so a theme
you have not finished says so. A time trial hides it entirely - medals are a
race result and a trial has no positions to earn one in - and hiding it moves
nothing, because it rides on the name rather than having a row of its own.

Two details it took a screenshot to get right:

- It is an **SVG path, not the character U+2605**. A star glyph in a
  monospace stack gets picked up by the emoji font on iOS, which renders it
  in the font's own colours and ignores the medal colour completely. A path
  takes `fill: currentColor` on every platform.
- It is centred on the **capitals, not the line box**. `align-items: center`
  centres it on the line, and a line box reserves room under the baseline for
  descenders that a row of capitals never uses - so centred on the line sits
  a tenth of an em low against the letters. The test measures the offset
  against a baseline probe and holds it inside 0.06em.

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
- **A skyline is a mountain range with the lights on.** The city scene uses
  `skyline`: flat-topped towers whose heights are squared, so most of the run
  is low and the occasional one stands right up out of it - the same trick
  `peaks` uses, because the shape is the same shape. The windows are what
  makes it a city rather than a bar chart.
- **Cooled rock is cracked, and the cracks are still lit.** `drawCrust` gives
  the volcano solids black plates with a crack each way, and about two in five
  of those cracks glow - hotter the fresher they are. The glow is baked rather
  than animated: the live lava painter already handles the rects that are
  actually molten, and a whole map of pulsing cracks would fight it. Lava
  cells get none of it, because their crust is the flat fill and the molten
  middle goes on every frame.
- **A planet is a disc plus a ring, and the ring is the whole job.** `planet`
  draws latitude bands clipped to a circle, a terminator gradient that puts
  the light on one side, and a hot limb on that side. Without a ring that
  reads as a coloured circle; with one it reads as a planet immediately, so
  the ring is drawn in two passes - the far half before the disc and the near
  half after it, with the planet's own shadow cut out of the near half. A ring
  drawn in one pass sits in front of the planet like a hoop on a stick.
- **Stars are three passes, and the passes are the distance.** `starfield`
  lays a dust of faint single pixels, a scatter of middling ones, and a dozen
  bright ones with a cross and a halo. One uniform scatter reads as noise on
  the screen rather than as depth. The first cut had fourteen bright ones with
  a halo seven radii wide and they bloomed over the track cards, so the count
  and the halo both came down: the scenery loses every argument it has with
  the text in front of it.
- **Space still needs a floor.** There is no horizon out here, which makes it
  the one scene where the rule the others follow - keep the landmarks out of
  the middle band, sky behind the cards and land below them - is the only
  thing holding the picture together. `hullfloor` runs the plating of whatever
  the camera is standing on across the bottom with a lit leading edge and a
  row of deck lights, for the same reason `street`, `yard`, `sand` and
  `flowfloor` exist: without a surface at the foot, everything above it
  floats.
- **The sky is a wall painter, and it is baked.** A space solid gets
  `drawStars`: two to four stars per cell, mostly white with a few blue and
  fewer old and orange, one cell in forty carrying something bright enough to
  have a cross, over a wash of far-off gas. The wash is seeded from a couple
  of sine terms in the cell's coordinates rather than from its own noise -
  noise per cell reads as a grid and noise per block of cells reads as a
  checkerboard, but two sines give a field that drifts across the whole map
  and still resolves to one flat tone per cell, which is the idiom everything
  else here is drawn in.

  It was built the other way first: two star layers scrolling at different
  speeds, masked to the shape of the wall grid and composited every frame. It
  looked no better than the baked version and cost **half the frame rate** -
  18fps against the volcano's 36 on the same machine, because a full-
  resolution mask is four passes over the whole board every frame. A station
  in orbit is not moving relative to the stars anyway, and the drifting
  weather over the top already says the scene is alive. Baked, space is the
  cheapest theme in the game rather than the dearest: 48fps where the volcano
  gets 36.
- **A fountain is a plume that glows.** The volcano's eruption is a column of
  seventy hot blobs that widen and cool as they rise, the same construction
  the city's smoke uses. A smooth tapering wedge was tried first and read as
  a searchlight rather than as rock being thrown.
- **Old stone is dressed, not raw.** The cliffs' `drawStone` is geology - a
  bed, a seam and two chips. `drawRuins` is masonry: three courses of ashlar
  per cell with the joints staggered course to course, which is what makes
  stone read as built rather than as landscape, plus a carved panel on a
  fifth of the blocks, a column drum on some, cracks and lichen. Fallen
  masonry - the jog kind - is drums lying where they came down, because a
  barrier in a ruin is not something anyone put there.
- **A ruin needs columns to read as one.** The `ruinband` primitive picks per
  slot between a stepped pyramid, a columned facade under a pediment, an
  obelisk and a seated figure on a plinth. The columns are the tell: nothing
  else in the scenery has a repeated vertical rhythm, and a row of them reads
  as built by somebody at forty pixels tall. A fifth of the columns are
  missing, which is the other half of reading as a ruin.
- **A works is not a skyline.** The industrial scene uses `works`: saw-tooth
  sheds, gasholders with hoop rings, and chimneys standing well clear of
  everything else. A town's tall things are wide and a works' tall things are
  thin, and that one difference is most of what separates the two scenes.
  `plume` stands smoke off the stacks as fifty-odd soft discs that widen and
  fade as they rise, drawn between the bands so smoke from a far stack passes
  behind the sheds in front of it. The first cut used sixteen big discs and
  read as bubbles.
- **Towers need a floor.** Each skyline band is filled as a solid mass **down
  to the foot of the canvas**, the way `terrace` is, rather than as towers
  standing on an invisible baseline. Towers with open sky under them float,
  and three bands of them floating at three different heights read as bunting
  rather than as a city. Filling to the floor also means a nearer band simply
  covers the one behind it, so the ground plane is whatever band is closest -
  which is what ground is. In front of all three, `street` lays a strip of wet
  tarmac with a row of sodium lamps and their glow on it, so the foot of the
  city is a surface and not an edge.
- **A plant block is machinery.** `drawPipes` gives the industrial solids a
  pipe run straight across every cell, edge to edge, so runs join up between
  neighbours into lines that cross the whole block. The axis and the offset
  are seeded from the ROW for a horizontal run and the COLUMN for a vertical
  one rather than from the cell, which is the whole trick - a per-cell seed
  would break every run at every cell edge. Flanges, bolts and the occasional
  drum go on per cell. Barriers get hazard chevrons: a crash barrier is not a
  pipe.
- **Rock is not a mountain.** The cliffs scene uses `terrace` rather than
  `peaks`: a run of flat-topped blocks that each step up or down from the one
  before. Triangles read as alpine whatever colour they are, and the point of
  the theme is quarried stone.

The solids on a cliffs track get the same treatment in `js/render.js`. A theme
with `rock: true` in its palette has every wall cell painted with a whole-cell
tone, sometimes a bed line where one course of stone meets the next, and two
chips - all rectangles on the cell grid, in the same blocky idiom as the rest
of the game. Overhang's massif is twenty-two cells by twenty-one, and at that
size a flat fill stops reading as rock and starts reading as a hole cut in the
picture.

The city does the same thing with `windows: true`: nine windows per wall cell,
each lit warm, lit cold or dark, because a city block is the one solid in the
game meant to read as a **building** rather than as terrain. Roadworks get a
single amber lamp instead - a hoarding is not a tower.

The values come from each cell's own coordinates rather than from a random
stream, so a cell is the same stone, and a tower the same tower, every time
the track is baked. Moving the slide slider rebakes the scenery, and a texture
seeded from `Math.random` would crawl every time you pressed a bracket.

## On a phone

**No zoom, anywhere.** A racing game's controls are taps, and two quick taps -
which is exactly what taking a corner looks like - were being read as
double-tap-to-zoom, leaving the board blown up and off centre with no way back
on a device with no keyboard. Three things turn it off, because no one of them
covers every browser:

- `touch-action: pan-y` on `<body>`, which refuses every scaling gesture while
  still allowing a vertical drag. Not `none`: that refuses the zoom too, but it
  also meant the options screen, which is taller than a phone, could not be
  scrolled at all. The board itself takes `none`, because there nothing is a
  scroll and everything is a turn.
- `user-scalable=no, maximum-scale=1` in the viewport meta, for Android.
- `gesturestart`/`gesturechange`/`gestureend` handlers in `js/input.js`, for
  iOS Safari, which fires its own pinch events on top of the touch model and
  has ignored both of the above since iOS 10.

**Landscape is a question about height, not width.** The responsive rules used
to key off width alone, and a phone in landscape is 844x390, or 852x393, or
926x428 - *wider* than the 820px cutoff. They were getting the desktop layout:
a 200px side panel eating a quarter of the screen and a running order that ran
off the bottom of it. There is now a block keyed on `max-height: 560px` that
narrows the panel to about 135px and sizes the order to fit eight rows, and it
sits last in the stylesheet so it wins wherever the two overlap.

**Short screens shrink text; they no longer delete it.** The `max-height` blocks
used to reach for `display: none` on anything secondary - the hint under each
option, the grade under each track card, the strapline on the theme screen, the
key legend. The effect was that a phone held sideways lost the words that explain
what a button does, and turning it upright brought them back, which reads as a
bug rather than as a layout. Twelve of those rules are now small type instead:
the text is always there, at a size that fits. Anything genuinely redundant would
be better deleted from the markup for every screen size than hidden on some of
them.

**Portrait cannot make the board bigger, so it stops wasting the height.**
Every track is wider than it is tall, so upright the board is limited by the
width of the screen and nothing short of turning the track sideways changes
that. What did change:

- The chrome shrinks and the board goes to the top at the full width the
  screen has, with the panel directly under it. The leftover is one band at the
  bottom rather than two bands of nothing with the game floating between them -
  and that band is where your thumbs are, where a tap is a turn.
- The panel stays `flex: 0 0 auto`. `Renderer.fit` sizes the board to the stage
  minus the panel, so a panel that grows to fill takes the space from the board,
  and then the board shrinks and the panel grows again. An attempt at letting it
  fill left the board at **nine per cent** of a phone screen.
- The running order goes to two columns, which fits a sixteen-car field at a
  size you can read.

**The track cards stay three across, at every width.** They were stacked for a
while and that was wrong: the picture of the track is the thing you are
choosing between, and three of them side by side is the comparison. Three
across 320px is 76 pixels each once the arrows and gaps have taken their
share, which is not a card - so below 480px the arrows drop to their own row
underneath, as a pair, and the cards get the whole width: 97px each at 320,
120 at 390, 138 at 430. The arrows are an easier thumb target there than a
38px sliver at the edge of the screen, too.

### iOS Safari answers two questions wrong

This is what "fits on one phone and not another" actually was, and none of it
shows up in a desktop browser, because in a desktop browser the wrong answer
and the right answer are the same number.

**`100vh`, `100%` and `inset: 0` all resolve against the viewport with the
toolbars HIDDEN.** They are not hidden. So the page was laid out 46 to 90
pixels taller than the part of it anyone could see, every full-screen menu
had its bottom - which is where the buttons are - underneath Safari's own
chrome, and the whole game could be dragged up off the top of the screen,
which made Safari hide its toolbar, which changed the height again. `100dvh`
was meant to fix exactly this and does, on iOS 15.4 and up; below that it is
not supported at all.

So the height is **measured** instead. `js/viewport.js` reads
`visualViewport.height` - which is the part of the page you can actually see,
reported correctly on every iOS that has it, and updated as the toolbar comes
and goes - and writes it to `--app-h` on `<html>`. `html`, `body`, `#backdrop`,
`.screen` and `.overlay` are all sized from that, with `100dvh` and then
`100vh` left as fallbacks for anything with no script. Every `vh` in the
stylesheet is now a share of `--app-h` for the same reason.

**The notch.** `index.html` asks for `viewport-fit=cover` so the painted
landscape can run under the notch and the rounded corners, which is right -
a band of black at the top of a painted sky looks like a fault. The price of
asking for it is that the *content* runs under them too unless something pads
it back, and nothing was: that was a regression introduced with the zoom fix.
On an iPhone in landscape the side inset is 47pt, which is enough to swallow
the BACK button whole. `--sa-t/r/b/l` carry `env(safe-area-inset-*)` and every
full-bleed layer and corner-pinned button adds them to its padding.

`-webkit-backdrop-filter` is now beside every `backdrop-filter`, too; without
it the blur behind the cards and arrows silently does nothing on iOS.

### The check that finds this class of bug

`npm run layout` drives every screen at **72 viewport sizes** - the device
list is `tools/devices.js` - and the two things it does that a device preset
does not are the whole point:

- **It holds the visible height below the window.** Shrinking the test window
  does not reproduce the iOS bug, because then `100vh` is *correct*. The
  window has to stay tall while the visible height is told to be short, which
  is what the `visible` field does. Every landscape size is tested three
  times: at the clean swap, and with 46px and 90px of browser chrome taken
  off.
- **It puts a notch on it.** A desktop browser reports every safe-area inset
  as zero. The audit sets real ones - 47/0/34/0 upright and 0/47/21/47 on its
  side for a notched iPhone - through the same custom properties the
  stylesheet reads, so it exercises the real code path.

It then fails on anything that runs off the side, anything under the chrome or
the notch on a screen that is supposed to fit without scrolling, any control
smaller than 40px, any card that has stopped being level with the other two,
and - directly - any full-screen layer whose height is the window's rather
than the visible viewport's. 792 checks. Putting `html { height: 100% }` back
fails 36 of them immediately, which is the test earning its keep.

It needs Playwright, which is why it is not part of `npm run check`. It runs
Chromium, so it cannot catch a bug that is purely a WebKit rendering
difference - what it can do is make the two things iOS does differently
*explicit*, and hold the layout to them.

### Things you press

`@media (hover: none)` is the honest test for "this is a finger, not a mouse".
Apple's guidance is 44px and Google's is 48; nothing here was close. The
sliders were the worst: the element IS the 6px track, so the whole hit area was
six pixels tall. They are 40px now, with the visible track painted by
`::-webkit-slider-runnable-track` so they look exactly the same.

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
While the velocity is catching up the body can be drawn leading it - the car
pointing into the corner while it is still travelling the old way, which is what
oversteer looks like - and it lays rubber until it hooks up. How far it leads is
the **OVERSTEER** slider, which now starts at 0 and is the one setting in the
game that changes nothing at all about the race; see below.

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

### Oversteer

`oversteer` sets how far the body leads its own direction of travel while
sliding, **in degrees** of the right angle the car has just turned through. It
runs 0 to 90 and **starts at 0**: the body points where the car is going, which
is the honest read of the track and the easier one to drive off. 45 was the
default for one version and is still one drag away - it is a good-looking pose
and a slightly misleading one, because the nose is aimed a half-corner ahead of
where the car will actually be.

It is cosmetic in the strict sense, not the loose one. The lean is added at the
moment a car is **drawn** and is never read back: position, collision, the AI's
aim and lap timing all come from `velAngle` and `dir`, and the lean touches
neither. The proof is mechanical rather than argued - the same deterministic
race run at 0°, 15°, 30°, 45°, 60° and 90° across five tracks and three seeds
produces byte-identical results: every car ends at the same position to ten
decimal places, with the same velocity angle, the same crash and scrape counts
and the same lap times, ninety comparisons out of ninety. Nothing else on the
options screen can say that: slide, cars, AI level, speed and laps all change
the racing, and the road tint at least forces a rebake.

Because nothing depends on it, it is live and nothing resets: drag it mid-race
and the whole field changes pose as you drag. It has its own storage key and
survives RESET DATA, which wipes what you have won rather than what you have
chosen. `&steer=60` sets it from the URL.

`slideSettle` is how long the body takes to straighten up again out of *full*
lean, whatever full happens to be, so the settle reads the same at every angle.
It exists because a radius small enough for Staircase would otherwise put the
drift on screen for about three frames.

## Race length, track and speed

Five laps on Pinefall at Sweat by default, six cars, slide 0.8, AI level 5. All three are set the same way:

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
The number includes you, and you start from the middle of the back row whatever
the field size.

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

## Finding your own car

Sixteen cars on a six-cell road, all the same shape, is a lot of paint to read at
a glance - and the colour that is yours is only yours for as long as you can
remember it. **YOUR CAR / GLOW** on the options screen puts a soft halo under the
player's car *in the player's own colour*, so the thing you are looking for is
brighter than everything around it without becoming a different object. It is on
by default, `NO GLOW` turns it off, it has its own `localStorage` key, and
`?glow=0` sets it from the URL.

It is drawn before the car and before the body's rotation - a radial gradient
painted straight onto the road, fading to nothing at 1.7 car lengths - so it does
not rotate, does not move with the oversteer lean, and never covers the car's own
outline. `car.isPlayer` gates it, so an AI car can never pick it up, and no
opponent's colour is dimmed to make room: the halo adds light rather than taking
it away. Nothing in the physics, the AI or the collision grid reads it.

The alternative was a marker floating above the car - an arrow or a ring. That
reads instantly but it also sits on top of the track, hides the car it is meant
to point at when the field bunches, and looks like a HUD element in a game that
has deliberately kept everything on the board.

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
line. Marking a wall rectangle `kind: 'lava'` makes it molten and animated, and it
collides exactly like any other wall; it is painted live over the baked track
rather than into it. `kind: 'void'` says a solid is a hole in the deck rather
than a spar, which on a `vacuum` theme - where every solid is open space
already - is documentation of intent rather than a change of appearance. `weather`
blows motes across the board - `'snow'`, `'dust'`, `'leaves'`, `'grit'`,
`'rain'`, `'ash'`, `'motes'`, `'embers'` or `'drift'`: flakes that fall soft and
fat, grit that tears across almost flat and is smeared along its own direction
of travel, embers that rise, or the vacuum's drift, which is the only one with
no sway at all and as much chance of going up as down. They all wrap round the
board in both directions, so nothing is ever spawned or retired.

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
| `js/viewport.js` | measures the visible viewport, because iOS will not |
| `tools/devices.js` | the 72 viewport sizes the layout has to survive |

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
node tools/map.js 10               # an ASCII picture of track 10
npm run layout                     # every screen at 72 viewport sizes
```

`simulate.js` reads the defaults in `js/config.js` for anything it is not
given, so **pass the settings explicitly when comparing against the ladder**:
`node tools/simulate.js 5 60 10 1 0.8 4` is beginner, slide 0.8, four cars.
The numbers in the table above are meaningless against a run at the shipped
defaults, and that mistake cost an hour of tuning against the wrong baseline.

`map.js` prints a track as characters - scenery, stands, the racing line, the
waypoints, the checkpoints, the start grid. It is a design aid rather than a
check, but a layout that looks wrong there is wrong, and seeing it costs
nothing.

`validate-track.js` sweeps a car along each track's racing line at **every**
lateral offset the AI uses - every one, not one of them. `TRACK.inZone` tests a
car's CENTRE against the raw rectangle, so a checkpoint laid out thin ACROSS
the road instead of thin ALONG it is a band the offset lines drive past on
either side. Quarry shipped past the old version of this check with a
checkpoint like that, and two of its four cars drove the circuit perfectly,
forever, stuck on checkpoint two. **A checkpoint is thin in the direction the
car is travelling and spans the full width of the road across it.**

**It also insists the checkpoints are declared in the order they are driven.**
The game collects them by index: a car holds a `nextCp` and only the zone at
that index counts. Declared out of order they all still get crossed, so every
other check here passes and the racing looks right - the only symptoms are
that the tint marking the next one points at something behind you, and that a
lap needs more than a lap of driving to register. Quarry shipped like that,
and so did two of the three space tracks; all three were rotated by exactly
one, which is what you get from writing the list in map order instead of lap
order. It cost more than a wrong tint: `simulate.js` counts laps rather than
distance, so it measured those two space tracks over twice the road and
reported them almost twice as hard as they were, and a whole page of this
README was written from those numbers. The check walks the line from the
finish and insists the zones come up 0, 1, 2, 3.

It fails if a car ever touches a wall or cannot rotate at a
corner - so a track cannot be edited into something undriveable without
noticing. It then *drives* every corner with the real car physics at the
configured slide radius, and fails if the arc clips anything or comes out off
line. Pass a radius to try one out: `node tools/validate-track.js 0.6`. `simulate.js` runs complete races with the real car, AI and lap code
and fails if any car does not finish; it is how the AI's deadlocks and dithering
loops were found. Both are worth running after touching `config.js` or
`tracks.js`.
