-- One name per player, and one player per name. The name is unique ignoring
-- case, so "Bolt" and "bolt" are the same name; it is shown as it was typed.
CREATE TABLE IF NOT EXISTS players (
  player_id    TEXT PRIMARY KEY,
  username     TEXT NOT NULL,
  username_key TEXT NOT NULL UNIQUE,      -- lower(username)
  ip_hash      TEXT NOT NULL,             -- SHA-256 hex of whoever last set it
  created_at   INTEGER NOT NULL,          -- Unix time, milliseconds
  updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_players_ip_updated ON players (ip_hash, updated_at);

-- Names already on the board: each goes to whoever used it first. A player
-- who used several keeps the first; the rest are free again.
INSERT OR IGNORE INTO players (player_id, username, username_key, ip_hash, created_at, updated_at)
SELECT player_id, username, lower(username), ip_hash, first_at, first_at
FROM (
  SELECT player_id, username, ip_hash, MIN(created_at) AS first_at
  FROM times
  GROUP BY player_id, lower(username)
)
ORDER BY first_at ASC;

-- And every time a player has set goes under the one name they now hold, so
-- the board shows each player once, by one name.
UPDATE times
SET username = (SELECT p.username FROM players p WHERE p.player_id = times.player_id)
WHERE EXISTS (SELECT 1 FROM players p WHERE p.player_id = times.player_id AND p.username <> times.username);
