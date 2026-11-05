import {test} from 'node:test';import assert from 'node:assert/strict';
import {database} from './d1.js';import {migrateContent,localizedContent,missingTranslations} from '../backend/localization.js';import {validateSite} from '../backend/validation.js';import {migrateDatabase} from '../scripts/migrate-localization.mjs';
const seed={region:'test',site:'localization',name:'Testgebiet',description:'Deutscher Originaltext',coordinates:{lat:47,lon:15},windDirections:['O','SO'],operator:{name:'Testverein',url:'https://example.test',phone:'123'},access:{parking:'Original Parktext',car:true},startpunkte:[{name:'Süd',description:'Originaltext Start',launchDirections:['S'],coordinates:{lat:47,lon:15}}],landeplaetze:[]};
test('migration preserves original fields, unknown data, numbers, directions, URLs and is idempotent',()=>{
 const before=structuredClone(seed);before.future={opaque:[1,'unchanged']};const m=migrateContent(before);assert.deepEqual(migrateContent(m),m);assert.equal(m.description,before.description);assert.deepEqual(m.coordinates,before.coordinates);assert.deepEqual(m.windDirections,before.windDirections);assert.deepEqual(m.future,before.future);assert.equal(m.operator.url,before.operator.url);assert.equal(m.translations.de.description,before.description);assert.deepEqual(m.translations.en,{});assert.equal(validateSite(m).length,0);assert(missingTranslations(m).some(x=>x.includes('startpunkte[1].description: HU')));
});
test('field-level fallback, nested point and operator translations; empty is missing',()=>{
 const m=migrateContent(seed);m.translations.en.description='Approved English';m.translations.hu.description='';m.startpunkte[0].translations.hu.description='Jóváhagyott magyar';
 assert.equal(localizedContent(m,'en').description,'Approved English');assert.equal(localizedContent(m,'hu').description,seed.description);assert.equal(localizedContent(m,'hu').startpunkte[0].description,'Jóváhagyott magyar');assert.equal(localizedContent(m,'fr').description,seed.description);assert.equal(m.description,seed.description);
});
test('rejects translations of structural fields and malformed payloads',()=>{
 for(const translations of [{en:{coordinates:'bad'}},{fr:{description:'bad'}},{en:{description:5}},{en:[]},{de:{description:'different'}},[],'bad'])assert(validateSite({...seed,translations}).length);
});
test('database migration backs up exact draft and published documents and preserves publication state',()=>{
 const db=database().sql;const draft=JSON.stringify({...seed,description:'Unpublished change'}),published=JSON.stringify(seed);
 db.prepare('INSERT INTO sites VALUES(?,?,?,?,?,?)').run('test/localization',draft,published,8,'original-update','original-publication');
 assert.equal(migrateDatabase(db),1);const row=db.prepare('SELECT * FROM sites').get();assert.equal(JSON.parse(row.draft).description,'Unpublished change');assert.equal(JSON.parse(row.published).description,seed.description);assert.equal(row.revision,9);assert.equal(row.updated_at,'original-update');assert.deepEqual({...db.prepare('SELECT * FROM localization_backups_v1').get()},{id:'test/localization',draft,published,revision:8,updated_at:'original-update',published_at:'original-publication'});assert.equal(migrateDatabase(db),0);
 db.close();
});
