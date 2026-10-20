import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {expandBuildingCatalog} from './catalogo-unidades.js';
import {attachRelations,PLAN_HASH} from './vinculos.js';
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const catalog=expandBuildingCatalog(read('./modelo/entrada/unidades-entrada.json')),interiors=read('./interiores/catalogo.json');
const fixture={schema:'liv-unit-relations-v1',status:'fornecido',source:{label:'FIXTURE SINTÉTICA — SEM VÍNCULO REAL',asOf:'2026-10-11'},
  bookSHA256:catalog.source.bookSHA256,units:['canto','meio'].map((typology,index)=>({id:catalog.units[index].id,typology,orientation:'original',
    interiorUnitSHA256:interiors.tipologias[typology].unitSHA256,interiorSourceSHA256:interiors.tipologias[typology].sourceSHA256,planSHA256:PLAN_HASH[typology]}))};
test('ausência mantém todos os finais sem planta atribuída',()=>{
  const absent={schema:'liv-unit-relations-v1',status:'ausente',source:null,units:[]};
  const result=attachRelations(catalog,absent,interiors);
  assert.equal(result.units.filter(u=>u.relation).length,0);assert.equal(result.relationSource,null);
});
test('vínculo explícito preserva polígonos, campos comerciais e revisões',()=>{
  const original=structuredClone(catalog),result=attachRelations(catalog,fixture,interiors);
  assert.equal(result.units[0].relation.typology,'canto');assert.equal(result.units[1].relation.typology,'meio');
  assert.equal(result.units.slice(2).filter(u=>u.relation).length,0);assert.deepEqual(catalog,original);
  assert.deepEqual(result.units[0].footprint,catalog.units[0].footprint);assert.equal(result.units[0].typology,null);
});
test('rejeita origem diferente, revisão, duplicatas e espelhamento sem variante',()=>{
  const invalid=[d=>d.units.push({...d.units[0]}),d=>d.bookSHA256='0'.repeat(64),d=>d.units[0].interiorSourceSHA256='0'.repeat(64),
    d=>d.units[0].planSHA256='0'.repeat(64),d=>d.units[0].id='101',d=>d.units[0].orientation='espelhada',d=>d.source.asOf='2026-02-30'];
  for(const change of invalid){const data=structuredClone(fixture);change(data);assert.throws(()=>attachRelations(catalog,data,interiors));}
});
