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
| `P` / `Esc` | pause |
| `M` | mute |
| `Enter` / `Space` | start |

On a touchscreen, tap the left or right half of the screen.

## The rules

- The car runs at a single fixed speed. There is no throttle and no brake.
- A press rotates the car exactly 90°, instantly, about its own centre. It does
  **not** snap to a lane - the car keeps the exact position it had. *Where* you
  turn is the whole game.
- Its momentum does not turn with it. The car slides through the corner on a
  fixed radius, sitting at 45° to the way it is still travelling, so **you have
  to turn early**. See [Slide](#slide) below.
- Hitting a wall stops you dead. You stay there until you turn, and then you go
  again in the new direction.
- Four cars start: you and three AI drivers, which have exactly the same
  controls and the same single speed. They turn late and crash sometimes.
- Cars do not stop each other. They shove each other sideways, so you can barge
  an opponent off the racing line and get barged in return.
- A lap only counts if you collect all four checkpoints in order and then cross
  the start/finish line heading the right way. Reversing over the line does
  nothing.

## The tracks

Pick one from the start menu. On both, the faint dashed line is the racing line
the AI drives, the light blocks are islands inside the circuit, and the darker
blue is outside it.

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

### 2 · Staircase — hard

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

`slide` in `js/config.js` is the **turn radius in cells**. `0` switches the whole
thing off and the game behaves exactly as it did before: instant turns, no arc,
no lean. The default is one car width (`0.8`), so the car slides its own width
across before it is pointing the new way.

It is a distance and not a duration deliberately, so the lead you have to give a
corner is the same at every game speed. Were it a duration, Hard would widen
every arc by 40% and Staircase's two-cell chicane legs would stop fitting.

Staircase's chicanes only clear up to `0.47`, so at the default radius the arc
cuts those corners far enough to clip the block it is stepping around, on the
slightly off-centre lines the AI cars drive - cars will trade paint with the
chicanes on track 2. Crossover, with its six-cell roads, is happy at `2.0`.
`npm run check` drives every corner of every track at the configured radius with
the real physics and names the corners that do not fit.

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
| Easy | as it has always been | ~11.2s |
| Medium | +20% | ~9.4s |
| Hard | +40% | ~8.0s |

`js/config.js` also holds base car speed, car size, the countdown, the palette,
and the per-driver AI settings (pace, how often they turn too late, how quickly
they recover). Per-track overrides - grid size, how much the AI spreads across the
road, how hard it tries - live with the track in `js/tracks.js`.

## Adding a track

Add an entry to `TRACKS` in `js/tracks.js`: a grid size, the solid rectangles,
a racing line whose consecutive waypoints are axis aligned, checkpoints, a
finish line and a starting grid. Add a button for it in `index.html`. Then run
`npm run check`, which will tell you whether a car can actually drive it.

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
