import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const context=vm.createContext({});
vm.runInContext(readFileSync(new URL('./busca-proximos.js',import.meta.url),'utf8'),context);
const api=context.LivNearby;
const raw=[{n:'Escola',c:'escola',x:330,z:420},
  {n:'Farmácia São João',c:'farmacia',x:110,z:220},
  {n:'Hospital externo',c:'hospital',x:5111,z:220},
  {n:'Farmácia Central',c:'farmacia',x:140,z:260}];
const catalog=api.createCatalog(raw,[110,220],5000);
test('regional places retain source ids, sort by distance and reject external records',()=>{
  assert.deepEqual(Array.from(catalog,p=>p.id),[1,3,0]);
  assert.equal(catalog[1].distance,50);assert.equal(catalog[0].distance,0);
  assert.equal(raw.length,4);assert.equal(raw[0].distance,undefined);
  assert.equal(api.createCatalog([{n:'Na borda',c:'escola',x:5110,z:220}],[110,220],5000).length,1);
});
test('category and accent insensitive name filters compose',()=>{
  assert.deepEqual(Array.from(api.filterCatalog(catalog,'farmacia','SAO JOAO'),p=>p.id),[1]);
  assert.equal(api.filterCatalog(catalog,'escola','farmacia').length,0);
  assert.equal(api.filterCatalog(catalog,'','zzzz nao existe').length,0);
  assert.equal(api.filterCatalog(catalog,'','').length,3);
  assert.equal(api.distanceLabel(850),'850 m');assert.equal(api.distanceLabel(1250),'1,3 km');
});
