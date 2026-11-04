import {test} from 'node:test';import assert from 'node:assert/strict';
import {googleMapsUrl} from '../platform/superadmin/coordinates.js';
import {validateSite} from '../backend/validation.js';
test('Google Maps uses latitude first and longitude second without rounding',()=>{
 const url=new URL(googleMapsUrl(47.20083,15.47583));assert.equal(url.origin,'https://www.google.com');assert.equal(url.searchParams.get('api'),'1');assert.equal(url.searchParams.get('query'),'47.20083,15.47583');
 assert.equal(new URL(googleMapsUrl(-47.20083,-15.47583)).searchParams.get('query'),'-47.20083,-15.47583');
 assert.equal(new URL(googleMapsUrl(0,0)).searchParams.get('query'),'0,0');
});
test('incomplete, out-of-range or textual coordinates cannot open a wrong map point',()=>{
 for(const [lat,lon] of [[null,15],[47,null],[NaN,15],[91,15],[47,181],['47.2',15],['47,2',15]])assert.equal(googleMapsUrl(lat,lon),null);
});
test('import rejects strings and DMS with an actionable WGS84 example',()=>{
 for(const lat of ['47,20083',`47° 12′ 03″`,91]){
  const errors=validateSite({region:'steiermark',site:'test',name:'Test',coordinates:{lat,lon:15.47583}});assert.ok(errors.some(x=>x.includes('WGS84')&&x.includes('47.20083')));
 }
});
