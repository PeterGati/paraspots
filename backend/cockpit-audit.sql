-- Additive migration; prepare/test locally only. Do NOT apply to production until
-- verified backup, isolated runtime restore and reviewed deployment approval.
CREATE TABLE IF NOT EXISTS cockpit_audit (
 id TEXT PRIMARY KEY,
 site_id TEXT NOT NULL,
 actor TEXT NOT NULL,
 role TEXT NOT NULL,
 action TEXT NOT NULL,
 created_at TEXT NOT NULL,
 before_json TEXT,
 after_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cockpit_audit_created ON cockpit_audit(created_at);
