CREATE TABLE IF NOT EXISTS day_settings (
 club_id TEXT PRIMARY KEY REFERENCES clubs(id),
 settings TEXT NOT NULL, revision INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sticker_batches (
 id TEXT PRIMARY KEY, club_id TEXT NOT NULL REFERENCES clubs(id),
 site_id TEXT NOT NULL, snapshot TEXT NOT NULL, created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sticker_site ON sticker_batches(club_id,site_id);
