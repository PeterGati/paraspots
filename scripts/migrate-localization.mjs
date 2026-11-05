// Offline SQLite migration. Export D1 first; never edit a live database blindly.
// Usage: node scripts/migrate-localization.mjs <database.sqlite> [--apply]
import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import {migrateContent} from '../backend/localization.js';
export function migrateDatabase(db) {
 db.exec('BEGIN IMMEDIATE');
 try {
  db.exec('CREATE TABLE IF NOT EXISTS localization_backups_v1 (id TEXT PRIMARY KEY, draft TEXT NOT NULL, published TEXT, revision INTEGER NOT NULL, updated_at TEXT NOT NULL, published_at TEXT)');
  const rows=db.prepare('SELECT * FROM sites').all();let changed=0;
  for(const row of rows) {
   const draft=JSON.stringify(migrateContent(JSON.parse(row.draft)));
   const published=row.published==null?null:JSON.stringify(migrateContent(JSON.parse(row.published)));
   if(draft===row.draft&&published===row.published)continue;
   db.prepare('INSERT OR IGNORE INTO localization_backups_v1 SELECT * FROM sites WHERE id=?').run(row.id);
   db.prepare('UPDATE sites SET draft=?,published=?,revision=revision+1 WHERE id=?').run(draft,published,row.id);changed++;
  }
  db.exec('COMMIT');return changed;
 }catch(e){db.exec('ROLLBACK');throw e;}
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
 const path=process.argv[2];if(!path||!existsSync(path))throw Error('Existing SQLite database path required.');
 const db=new DatabaseSync(path);
 const rows=db.prepare('SELECT * FROM sites').all();console.log(`${rows.length} records. Existing German fields and draft/publication separation are preserved.`);
 if(process.argv.includes('--apply')){
  const backup=path+'.before-localization-'+Date.now()+'.sqlite';
  db.exec("VACUUM INTO '"+backup.replaceAll("'","''")+"'");
  console.log(`Backup: ${backup}`);console.log(`Migrated: ${migrateDatabase(db)}`);
 }else console.log('Dry run. Add --apply to migrate; a complete database backup is created first.');
 db.close();
}
