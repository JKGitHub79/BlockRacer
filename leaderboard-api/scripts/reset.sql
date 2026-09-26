-- Wipe the leaderboard: every lap time and every claimed username.
-- The tables stay, empty, and the Worker carries on as it is.
--
-- Cannot be undone from here. Take a backup first (see README.md), or rely
-- on D1 Time Travel, which can restore the database to any minute in the
-- last 30 days.
--
-- Run it in the Cloudflare dashboard (D1 > leaderboard > Console: paste all
-- of this and run), or from this folder with `npm run db:reset`.

DELETE FROM times;
DELETE FROM players;
