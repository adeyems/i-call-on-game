CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY,
  host_name TEXT NOT NULL,
  max_participants INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'LOBBY',
  created_at TEXT NOT NULL
);
