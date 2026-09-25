# leaderboard-api

Block Racer's leaderboard: a Cloudflare Worker over the D1 database
`leaderboard` (binding `DB`). Built and deployed by Cloudflare from GitHub.

## Cloudflare build settings

- **Root directory:** `leaderboard-api`
- **Deploy command:** `npm run deploy` - applies any new migrations in
  `migrations/` to the remote database, then deploys. The default
  `npx wrangler deploy` does not apply migrations, so the `times` table
  would never be created.

## Endpoints

`POST /players` with `{ "player_id", "username" }` claims a name. Names are
unique ignoring case and each player holds one: `201` when it is yours (new,
already yours, or changed to - your times move to the new name and the old one
is free again), `409 { "error": "Username already in use", "code":
"username_taken" }` when another player holds it, `429` past 10 claims an hour
from one address. `migrations/0002_players.sql` gives every name already on the
board to whoever used it first.

`POST /times` with a JSON body:

```json
{ "track_id": "labyrinth", "time_ms": 17050, "username": "Jamie_1",
  "player_id": "3f2b8c1e-4d5a-4b6c-9e7f-0a1b2c3d4e5f", "game_version": "0.59.0" }
```

- `track_id`: one of the 37 racing tracks in `js/tracks.js` (not the tutorial)
- `time_ms`: integer, at least 1000 and at most 3600000
- `username`: 1-16 characters of `A-Z a-z 0-9 _`
- `player_id`: a UUID
- `game_version`: optional, 1-20 characters of `A-Z a-z 0-9 . + -`

A time is only stored under a name its player holds: a name nobody holds yet
is claimed by it, and one another player holds gets the same `409`.
Replies `201` when stored - with the player's `rank` on the track afterwards,
the `total` number of players there and their `best_ms`, ranked as the
leaderboard ranks them - `400` listing every problem, `415` without a JSON
content type, and `429` with `Retry-After` past 10 submissions an hour from
one address. The address is stored only as a SHA-256 hash.

`GET /leaderboard/:track?limit=20` - each player's best time on the track,
fastest first: `{ track_id, limit, total, entries: [{ rank, username,
time_ms, game_version, created_at, me }], you }`. `limit` is 1-1000, default
20; `total` is how many players have a time there. Pass your own `player_id`
to have your row marked `me: true` and to get `you` - your own entry with its
rank, even when it is outside the limit, or `null` if you have no time there.
Ids are only compared, never returned.

CORS allows only `https://jkgithub79.github.io`. `tools/leaderboard-test.html`
exercises all of it, and has to be opened from there.
