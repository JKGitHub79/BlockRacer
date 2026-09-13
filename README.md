# Block Racer

A one-screen, top-down arcade racer where everything is square. One speed, no
brakes, and the only control you have is a 90 degree turn.

**Play it:** open `index.html` in any browser. No build step, no dependencies,
no server required.

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
  **not** snap to a lane - the car keeps the exact position it had and sets off
  perpendicular to where it was going. *Where* you turn is the whole game.
- Hitting a wall stops you dead. You stay there until you turn, and then you go
  again in the new direction.
- Four cars start: you and three AI drivers, which have exactly the same
  controls and the same single speed. They turn late and crash sometimes.
- Cars do not stop each other. They shove each other sideways, so you can barge
  an opponent off the racing line and get barged in return.
- A lap only counts if you collect all four checkpoints in order and then cross
  the start/finish line heading the right way. Reversing over the line does
  nothing.

## The track

A 40 x 25 grid: a four-cell-wide corridor around a solid infield. Each of the
four straights carries two blocks on **alternating halves** of the corridor, so
no straight can be driven in a single lane - you have to staircase your way
round with 90° turns. The faint dashed line shows the racing line the AI uses;
the amber-edged blocks are the ones that will stop you if you miss a turn.

## Race length

Five laps by default, and configurable three ways:

1. the buttons on the start menu (1 / 3 / 5 / 10),
2. a URL parameter - `index.html?laps=7` (1 to 20),
3. `laps` in `js/config.js`, which sets the default.

`js/config.js` also holds car speed, car size, the countdown, and the per-driver
AI settings (pace, how often they turn too late, how quickly they recover).

## Layout

| File | What it holds |
| --- | --- |
| `js/config.js` | every tunable number |
| `js/track.js` | the wall grid, the racing line, checkpoints, lap rule |
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
npm run check            # both of the below
node tools/validate-track.js   # geometry: can a car actually drive the line?
node tools/simulate.js 5 40    # 40 full races of real physics and real AI
```

`validate-track.js` sweeps a car along the racing line at every lateral offset
the AI uses and fails if it ever touches a wall or cannot rotate at a corner -
so the track cannot be edited into something undriveable without noticing.
`simulate.js` runs complete races with the real car, AI and lap code and fails
if any car does not finish; it is how the AI's deadlocks and dithering loops
were found. Both are worth running after touching `config.js` or `track.js`.
