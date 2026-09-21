ALTER TABLE moderation_reports ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE moderation_reports ADD COLUMN resolved_at INTEGER;
