-- Additive, unapplied production migration. Requires verified backup + runtime restore.
CREATE TABLE IF NOT EXISTS translation_tasks (
 id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
 path TEXT NOT NULL, language TEXT NOT NULL CHECK(language IN ('en','hu')),
 source_text TEXT NOT NULL, source_anchor TEXT NOT NULL, context_json TEXT NOT NULL,
 previous_text TEXT NOT NULL DEFAULT '', translated_text TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending', revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL, due_at TEXT NOT NULL, approved_at TEXT, approved_by TEXT
);
CREATE INDEX IF NOT EXISTS translation_pending ON translation_tasks(status,due_at);
CREATE TABLE IF NOT EXISTS notification_outbox (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL,
 created_at TEXT NOT NULL, delivered_at TEXT, attempts INTEGER NOT NULL DEFAULT 0,
 last_error TEXT, lease_token TEXT, lease_until TEXT, cancelled_at TEXT
);
