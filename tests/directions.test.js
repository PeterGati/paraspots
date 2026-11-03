import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateSite} from '../backend/validation.js';
const site={region:'steiermark',site:'test',name:'Test',windDirections:['N','NO','O','SO','S','SW','W','NW'],startpunkte:[{name:'Süd',launchDirections:['O','SO','S']}]};
test('canonical German direction arrays are accepted including empty unknown directions',()=>{
 assert.deepEqual(validateSite(site),[]);assert.deepEqual(validateSite({...site,windDirections:[]}),[]);
});
test('foreign labels and combined text give actionable format errors',()=>{
 for(const value of [['E'],['SE'],['South'],['O/SO/S'],'O, SO, S']){
  const errors=validateSite({...site,startpunkte:[{name:'Süd',launchDirections:value}]});
  assert.ok(errors.some(x=>x.includes('startpunkte[1].launchDirections')));
  assert.ok(errors.some(x=>x.includes('["O","SO","S"]')));
 }
});
test('duplicates are not stored as different choices',()=>{assert.ok(validateSite({...site,windDirections:['S','S']}).some(x=>x.includes('csak egyszer')));});
