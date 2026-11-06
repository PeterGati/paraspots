CREATE TABLE IF NOT EXISTS clubs (
 id TEXT PRIMARY KEY NOT NULL CHECK(id GLOB '[0-9][0-9][0-9]'),
 name TEXT NOT NULL, profile TEXT NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS site_clubs (
 site_id TEXT PRIMARY KEY REFERENCES sites(id), club_id TEXT NOT NULL REFERENCES clubs(id)
);
CREATE TABLE IF NOT EXISTS club_accounts (
 email TEXT PRIMARY KEY COLLATE NOCASE, club_id TEXT NOT NULL REFERENCES clubs(id), password_hash TEXT
);
CREATE TABLE IF NOT EXISTS club_sessions (
 token_hash TEXT PRIMARY KEY, email TEXT NOT NULL REFERENCES club_accounts(email), expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS regional_maps (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, image TEXT NOT NULL, source TEXT NOT NULL, updated TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS site_maps (
 site_id TEXT NOT NULL REFERENCES sites(id), map_id TEXT NOT NULL REFERENCES regional_maps(id),
 x REAL NOT NULL, y REAL NOT NULL, zoom REAL NOT NULL, PRIMARY KEY(site_id,map_id)
);
INSERT OR IGNORE INTO clubs(id,name) VALUES('001','Soaring Club Hohe Wand'),('002','Demo Flugclub');
INSERT OR IGNORE INTO club_accounts(email,club_id) VALUES('peter.behofsics@aon.at','001');
INSERT OR IGNORE INTO site_clubs(site_id,club_id) SELECT id,'001' FROM sites WHERE id='niederoesterreich/hohe-wand';
