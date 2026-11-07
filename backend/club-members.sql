-- Email-list access, deliberately without identity verification.
-- Separate from club_accounts: membership NEVER grants administration rights.
CREATE TABLE IF NOT EXISTS club_members (
 club_id TEXT NOT NULL REFERENCES clubs(id),
 email TEXT NOT NULL COLLATE NOCASE,
 created_at TEXT NOT NULL,
 PRIMARY KEY(club_id,email)
);
CREATE TABLE IF NOT EXISTS club_member_content (
 id TEXT PRIMARY KEY,
 club_id TEXT NOT NULL REFERENCES clubs(id),
 kind TEXT NOT NULL CHECK(kind IN ('news','documents','events')),
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS member_content_club ON club_member_content(club_id,kind);
