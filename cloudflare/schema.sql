CREATE TABLE IF NOT EXISTS compositions (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS compositions_status_idx
  ON compositions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS compositions_owner_idx
  ON compositions(owner_hash, updated_at DESC);

CREATE TABLE IF NOT EXISTS moderation_reports (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS moderation_reports_created_idx
  ON moderation_reports(created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limits (
  owner_hash TEXT NOT NULL,
  action TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (owner_hash, action)
);
