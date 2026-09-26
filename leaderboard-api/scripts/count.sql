-- How much is on the leaderboard: run before and after a reset to check it.
SELECT
  (SELECT COUNT(*) FROM times)                  AS lap_times,
  (SELECT COUNT(DISTINCT player_id) FROM times) AS players_with_times,
  (SELECT COUNT(*) FROM players)                AS usernames;
