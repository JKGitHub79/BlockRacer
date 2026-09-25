-- One row per submitted time. The leaderboard is the best row per player.
CREATE TABLE IF NOT EXISTS times (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id     TEXT    NOT NULL,
  player_id    TEXT    NOT NULL,             -- a UUID the game makes and keeps
  username     TEXT    NOT NULL,
  time_ms      INTEGER NOT NULL,
  game_version TEXT,
  ip_hash      TEXT    NOT NULL,             -- SHA-256 hex; the raw IP is never stored
  created_at   INTEGER NOT NULL              -- Unix time, milliseconds
);

CREATE INDEX IF NOT EXISTS idx_times_track_time ON times (track_id, time_ms);

-- The rate limit counts one address's rows in the last hour on every submit.
CREATE INDEX IF NOT EXISTS idx_times_ip_created ON times (ip_hash, created_at);
