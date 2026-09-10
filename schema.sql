CREATE TABLE IF NOT EXISTS global_leaderboard (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  callsign TEXT,
  wave INTEGER,
  score INTEGER,
  timestamp INTEGER
);

CREATE TABLE IF NOT EXISTS beta_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  callsign TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'bug',
  title TEXT NOT NULL,
  details TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  device_info TEXT,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_timestamp ON beta_feedback(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_status ON beta_feedback(status);
