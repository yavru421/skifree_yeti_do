CREATE TABLE IF NOT EXISTS global_leaderboard (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  callsign TEXT,
  wave INTEGER,
  score INTEGER,
  timestamp INTEGER
);
