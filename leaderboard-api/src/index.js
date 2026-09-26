/* Block Racer leaderboard API - a Cloudflare Worker over D1 (binding DB).
 *
 *   POST /players                   claim a username for a player id
 *   POST /times                     submit a time
 *   GET  /leaderboard/:track?limit  best time per player, fastest first
 *
 * Only the game's own origin gets CORS headers. Nothing here stores an IP
 * address: the rate limit keys on a SHA-256 of it. */

const ALLOWED_ORIGIN = 'https://jkgithub79.github.io';

// Which build this is. GET / says, so a deploy can be checked from a browser.
// Bump it with every change to this Worker.
const API_VERSION = '2026-09-26.1';
const ENDPOINTS = ['POST /players', 'POST /times', 'GET /leaderboard/:track'];

// Every racing track in js/tracks.js, and the least time (ms) accepted on it.
// The tutorial's TRAINING track is not a leaderboard track.
const MIN_TIME_MS = 1000;
const TRACKS = new Map([
  'crossover', 'snowdrift', 'mesa', 'wildwood', 'catalunya', 'caldera', 'staircase',
  'pinefall', 'hollow', 'canopy',
  'duneline', 'saltflats', 'canyonrun',
  'frostline', 'glacier', 'whiteout',
  'scree', 'quarry', 'overhang',
  'gridlock', 'crosstown', 'downtown',
  'foundry', 'pipeworks', 'refinery',
  'sanctum', 'colonnade', 'labyrinth',
  'basalt', 'fissure', 'crater',
  'orbital', 'driftfield', 'horizon',
  'landfall', 'hive', 'mothership'
].map((id) => [id, MIN_TIME_MS]));

const RATE_LIMIT = 10;                  // submissions
const RATE_WINDOW_MS = 60 * 60 * 1000;  // per hour, per hashed IP
const MAX_TIME_MS = 60 * 60 * 1000;     // an hour: anything longer is not a lap
const MAX_BODY_BYTES = 2048;
const NAME_LIMIT = 10;                  // names claimed or changed, per hashed IP per hour
const TAKEN = 'Username already in use';
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 1000;                // "show all": every player there is, within reason

const USERNAME = /^[A-Za-z0-9_]{1,16}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION = /^[0-9A-Za-z.+-]{1,20}$/;

/* ---- responses ------------------------------------------------------------ */

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const h = { 'Vary': 'Origin' };
  if (origin === ALLOWED_ORIGIN) {
    h['Access-Control-Allow-Origin'] = ALLOWED_ORIGIN;
    h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}

function json(request, status, body, extra) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(request),
      ...(extra || {})
    }
  });
}

function fail(request, status, error, details) {
  return json(request, status, details ? { error, details } : { error });
}

/* ---- helpers ------------------------------------------------------------- */

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Every problem with a submission at once, so a client can fix them together.
function validate(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) return ['body must be a JSON object'];
  const { track_id, time_ms, username, player_id, game_version } = body;

  if (typeof track_id !== 'string' || !TRACKS.has(track_id)) {
    errors.push('track_id must be one of the game\'s tracks');
  }
  if (!Number.isInteger(time_ms)) {
    errors.push('time_ms must be an integer number of milliseconds');
  } else if (time_ms < (TRACKS.get(track_id) ?? MIN_TIME_MS)) {
    errors.push(`time_ms is faster than possible (minimum ${TRACKS.get(track_id) ?? MIN_TIME_MS})`);
  } else if (time_ms > MAX_TIME_MS) {
    errors.push(`time_ms must be at most ${MAX_TIME_MS}`);
  }
  if (typeof username !== 'string' || !USERNAME.test(username)) {
    errors.push('username must be 1-16 characters of A-Z, a-z, 0-9 or _');
  }
  if (typeof player_id !== 'string' || !UUID.test(player_id)) {
    errors.push('player_id must be a UUID');
  }
  if (game_version !== undefined && game_version !== null &&
      (typeof game_version !== 'string' || !VERSION.test(game_version))) {
    errors.push('game_version, if given, must be 1-20 characters of A-Z, a-z, 0-9, . + -');
  }
  return errors;
}

/* ---- POST /times ------------------------------------------------------------ */

// A JSON body, or the Response that says why there is not one.
async function readJson(request) {
  const type = request.headers.get('Content-Type') || '';
  if (!type.toLowerCase().startsWith('application/json')) {
    return { error: fail(request, 415, 'Content-Type must be application/json') };
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { error: fail(request, 413, 'body too large') };
  try { return { body: JSON.parse(text) }; } catch { return { error: fail(request, 400, 'body is not valid JSON') }; }
}

function taken(request) {
  return json(request, 409, { error: TAKEN, code: 'username_taken' });
}

/* ---- names ------------------------------------------------------------------ */

/* Give `username` to `playerId`, or say whose it is. 'ok' when the player
 * has it now (already had it, took a free one, or changed to a free one);
 * 'taken' when another player holds it. Unique ignoring case. A player who
 * changes name takes their times with them, so the board shows one name per
 * player and the old one is free again. The UNIQUE index is the referee
 * when two players reach for one name at the same moment. */
async function claimName(env, playerId, username, ipHash, now) {
  const key = username.toLowerCase();
  const holder = await env.DB.prepare(
    'SELECT player_id, username FROM players WHERE username_key = ?1'
  ).bind(key).first();
  if (holder && holder.player_id !== playerId) return 'taken';
  if (holder && holder.username === username) return 'ok';
  try {
    await env.DB.prepare(
      `INSERT INTO players (player_id, username, username_key, ip_hash, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?5)
       ON CONFLICT (player_id) DO UPDATE SET
         username = excluded.username, username_key = excluded.username_key,
         ip_hash = excluded.ip_hash, updated_at = excluded.updated_at`
    ).bind(playerId, username, key, ipHash, now).run();
  } catch (err) {
    if (/UNIQUE/i.test(String(err && err.message))) return 'taken';
    throw err;
  }
  await env.DB.prepare('UPDATE times SET username = ?2 WHERE player_id = ?1 AND username <> ?2')
    .bind(playerId, username).run();
  return 'ok';
}

/* POST /players { player_id, username }: claim a name before using it. */
async function registerPlayer(request, env) {
  const read = await readJson(request);
  if (read.error) return read.error;
  const body = read.body;
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) errors.push('body must be a JSON object');
  else {
    if (typeof body.username !== 'string' || !USERNAME.test(body.username)) {
      errors.push('username must be 1-16 characters of A-Z, a-z, 0-9 or _');
    }
    if (typeof body.player_id !== 'string' || !UUID.test(body.player_id)) errors.push('player_id must be a UUID');
  }
  if (errors.length) return fail(request, 400, 'invalid player', errors);

  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return fail(request, 400, 'could not identify the client');
  const ipHash = await sha256Hex(ip);
  const now = Date.now();
  const pid = body.player_id.toLowerCase();

  // Asking about a name you already have is free; taking or changing one is
  // limited, so nobody can sweep up every name going.
  const mine = await env.DB.prepare('SELECT username FROM players WHERE player_id = ?1').bind(pid).first();
  if (!(mine && mine.username === body.username)) {
    const holder = await env.DB.prepare('SELECT player_id FROM players WHERE username_key = ?1')
      .bind(body.username.toLowerCase()).first();
    if (holder && holder.player_id !== pid) return taken(request);
    const recent = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM players WHERE ip_hash = ?1 AND updated_at > ?2'
    ).bind(ipHash, now - RATE_WINDOW_MS).first();
    if (recent && recent.n >= NAME_LIMIT) {
      return json(request, 429, { error: `rate limit: at most ${NAME_LIMIT} names per hour`, retry_after_seconds: 3600 },
        { 'Retry-After': '3600' });
    }
  }
  if (await claimName(env, pid, body.username, ipHash, now) === 'taken') return taken(request);
  return json(request, 201, { ok: true, player_id: pid, username: body.username });
}

/* ---- times ------------------------------------------------------------------- */

async function submitTime(request, env) {
  const read = await readJson(request);
  if (read.error) return read.error;
  const body = read.body;

  const errors = validate(body);
  if (errors.length) return fail(request, 400, 'invalid submission', errors);

  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return fail(request, 400, 'could not identify the client');
  const ipHash = await sha256Hex(ip);
  const now = Date.now();

  // A time goes under a name only its own player holds. A name nobody holds
  // yet is claimed by the first time sent with it.
  if (await claimName(env, body.player_id.toLowerCase(), body.username, ipHash, now) === 'taken') {
    return taken(request);
  }

  /* The count and the insert are one statement, so two submissions arriving
   * together cannot both slip under the limit. No row inserted means the
   * limit had already been reached. */
  const result = await env.DB.prepare(
    `INSERT INTO times (track_id, player_id, username, time_ms, game_version, ip_hash, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
     WHERE (SELECT COUNT(*) FROM times WHERE ip_hash = ?6 AND created_at > ?8) < ?9`
  ).bind(
    body.track_id, body.player_id.toLowerCase(), body.username, body.time_ms,
    body.game_version ?? null, ipHash, now, now - RATE_WINDOW_MS, RATE_LIMIT
  ).run();

  if (!result.meta || result.meta.changes !== 1) {
    // When the oldest submission in the window leaves it, one more is allowed.
    const oldest = await env.DB.prepare(
      'SELECT MIN(created_at) AS t FROM times WHERE ip_hash = ?1 AND created_at > ?2'
    ).bind(ipHash, now - RATE_WINDOW_MS).first();
    const retry = oldest && oldest.t ? Math.max(1, Math.ceil((oldest.t + RATE_WINDOW_MS - now) / 1000)) : 3600;
    return json(request, 429,
      { error: `rate limit: at most ${RATE_LIMIT} submissions per hour`, retry_after_seconds: retry },
      { 'Retry-After': String(retry) });
  }

  // Where this player now stands on the track, ranked exactly as the
  // leaderboard ranks it - which may be on an older, better time.
  const standing = await env.DB.prepare(
    `WITH best AS (
       SELECT player_id, time_ms, created_at,
              ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY time_ms ASC, created_at ASC) AS rn
       FROM times WHERE track_id = ?1
     ), ranked AS (
       SELECT player_id, time_ms, ROW_NUMBER() OVER (ORDER BY time_ms ASC, created_at ASC) AS rank,
              COUNT(*) OVER () AS total
       FROM best WHERE rn = 1
     )
     SELECT rank, total, time_ms AS best_ms FROM ranked WHERE player_id = ?2`
  ).bind(body.track_id, body.player_id.toLowerCase()).first();

  return json(request, 201, {
    ok: true,
    id: result.meta.last_row_id,
    track_id: body.track_id,
    username: body.username,
    time_ms: body.time_ms,
    rank: standing ? standing.rank : null,
    total: standing ? standing.total : null,
    best_ms: standing ? standing.best_ms : null
  });
}

/* ---- GET /leaderboard/:track ------------------------------------------------- */

async function leaderboard(request, env, track) {
  if (!TRACKS.has(track)) return fail(request, 400, 'unknown track');

  const params = new URL(request.url).searchParams;
  const raw = params.get('limit');
  // Optional: the caller's own player_id, so its rows can be marked `me`.
  // It is only compared, never returned - the answer is "yours" or not.
  const mine = params.get('player_id');
  if (mine !== null && !UUID.test(mine)) return fail(request, 400, 'player_id must be a UUID');
  let limit = DEFAULT_LIMIT;
  if (raw !== null) {
    if (!/^\d+$/.test(raw) || Number(raw) < 1) return fail(request, 400, 'limit must be a positive integer');
    limit = Math.min(Number(raw), MAX_LIMIT);
  }

  /* Each player's best time (the earliest, if they matched it), ranked.
   * One pass gives the top `limit`, how many players there are, and - when
   * the caller says who it is - its own rank wherever that is, so a player
   * sixteenth of forty can be told so under a top five. player_id is only
   * compared, never sent: it is the only thing that makes a submission
   * count as that player's. */
  const { results } = await env.DB.prepare(
    `WITH best AS (
       SELECT player_id, username, time_ms, game_version, created_at,
              ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY time_ms ASC, created_at ASC) AS rn
       FROM times WHERE track_id = ?1
     ), ranked AS (
       SELECT player_id, username, time_ms, game_version, created_at,
              ROW_NUMBER() OVER (ORDER BY time_ms ASC, created_at ASC) AS rank,
              COUNT(*) OVER () AS total
       FROM best WHERE rn = 1
     )
     SELECT rank, total, username, time_ms, game_version, created_at, player_id = ?3 AS me
     FROM ranked WHERE rank <= ?2 OR player_id = ?3
     ORDER BY rank`
  ).bind(track, limit, mine ? mine.toLowerCase() : null).all();

  const shape = (r) => ({
    rank: r.rank,
    username: r.username,
    time_ms: r.time_ms,
    game_version: r.game_version,
    created_at: new Date(r.created_at).toISOString(),
    me: r.me === 1
  });
  const own = results.find((r) => r.me === 1);
  return json(request, 200, {
    track_id: track,
    limit,
    total: results.length ? results[0].total : 0,
    entries: results.filter((r) => r.rank <= limit).map(shape),
    you: mine ? (own ? shape(own) : null) : undefined
  });
}

/* ---- routing ----------------------------------------------------------------- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('Origin');
      if (origin !== ALLOWED_ORIGIN) return new Response(null, { status: 403, headers: { 'Vary': 'Origin' } });
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    try {
      if (path === '/') {
        if (request.method !== 'GET') return fail(request, 405, 'use GET');
        return json(request, 200, { service: 'leaderboard-api', version: API_VERSION, endpoints: ENDPOINTS });
      }
      if (path === '/players') {
        if (request.method !== 'POST') return fail(request, 405, 'use POST');
        return await registerPlayer(request, env);
      }
      if (path === '/times') {
        if (request.method !== 'POST') return fail(request, 405, 'use POST');
        return await submitTime(request, env);
      }
      const m = path.match(/^\/leaderboard\/([^/]+)$/);
      if (m) {
        if (request.method !== 'GET') return fail(request, 405, 'use GET');
        let track;
        try { track = decodeURIComponent(m[1]); } catch { return fail(request, 400, 'unknown track'); }
        return await leaderboard(request, env, track);
      }
      return fail(request, 404, 'not found');
    } catch (err) {
      console.error(err);
      return fail(request, 500, 'internal error');
    }
  }
};
