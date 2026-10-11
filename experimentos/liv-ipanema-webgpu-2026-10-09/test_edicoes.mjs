import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {EXTERIOR_EDITIONS,exteriorEdition,requestedEdition} from './edicoes.js';
import {validateUnits} from './unidades.js';

const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
test('each exterior catalogue belongs to the actual RGBM scene edition and pinned inputs',()=>{
  for(const [key,edition] of Object.entries(EXTERIOR_EDITIONS)){
    assert.equal(exteriorEdition(key),edition);
    const catalog=validateUnits(read(edition.units)),manifest=read(edition.assets+'manifest.json');
    assert.equal(catalog.sourceModelSHA256,manifest.sourceModelSHA256,key);
    for(const [path,expected] of Object.entries(catalog.registration.sources||{})){
      assert.equal(createHash('sha256').update(readFileSync(new URL('../../'+path,import.meta.url))).digest('hex'),expected,path);
    }
  }
});
test('entrance reconstruction preserves all ten illustrative units without commercial or interior assignments',()=>{
  const before=read(EXTERIOR_EDITIONS.contorno.units),after=read(EXTERIOR_EDITIONS.entrada.units);
  assert.notEqual(after.sourceModelSHA256,before.sourceModelSHA256);
  assert.deepEqual(after.units,before.units);
  assert.deepEqual(after.selectionEnvelope,before.selectionEnvelope);
});
test('unknown and prototype edition names cannot provide asset paths',()=>{
  for(const key of ['unknown','constructor','__proto__','toString'])assert.throws(()=>exteriorEdition(key));
  for(const key of Object.keys(EXTERIOR_EDITIONS))assert.equal(requestedEdition('?geometria='+key),key);
  assert.equal(requestedEdition(''),'base');
});
