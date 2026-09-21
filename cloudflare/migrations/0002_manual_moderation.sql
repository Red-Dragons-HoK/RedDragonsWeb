ALTER TABLE compositions ADD COLUMN moderation_note TEXT;
ALTER TABLE compositions ADD COLUMN moderated_at INTEGER;

CREATE TABLE IF NOT EXISTS moderation_actions (
  id TEXT PRIMARY KEY,
  composition_id TEXT,
  action TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS moderation_actions_composition_idx
  ON moderation_actions(composition_id, created_at DESC);
