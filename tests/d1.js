import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function database(path=':memory:'){
 const sql=new DatabaseSync(path);sql.exec(readFileSync(new URL('../backend/schema.sql',import.meta.url),'utf8'));
 sql.exec(readFileSync(new URL('../backend/clubs.sql',import.meta.url),'utf8'));
 sql.exec(readFileSync(new URL('../backend/membership.sql',import.meta.url),'utf8'));
 sql.exec(readFileSync(new URL('../backend/club-members.sql',import.meta.url),'utf8'));
 return {sql,async batch(statements){
  sql.exec('BEGIN');try {const result=[];for(const stmt of statements)result.push(await stmt.run());sql.exec('COMMIT');return result;}
  catch(error){sql.exec('ROLLBACK');throw error;}
 },prepare(query){return {bind(...values){return {
  async first(){return sql.prepare(query).get(...values)||null;},
  async run(){const r=sql.prepare(query).run(...values);return {meta:{changes:r.changes}};},
  async all(){return {results:sql.prepare(query).all(...values)};}
 };},async all(){return {results:sql.prepare(query).all()};}};}};
}
