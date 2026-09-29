import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/world/runtime-v2.js', import.meta.url), 'utf8'), context);
const V2 = context.CityRuntimeV2;

const index = {chunks:[
  {id:'near', cx:0, cz:80, rad:10},
  {id:'ahead', cx:0, cz:260, rad:10},
  {id:'behind', cx:0, cz:-260, rad:10},
  {id:'side', cx:260, cz:0, rad:10}
]};

test('visible radius wins before directional prefetch', () => {
  const got=V2.select(index,{x:0,z:0,dirX:0,dirZ:1,renderRadius:100,prefetchRadius:220,forwardExtra:100,prefetchBias:80});
  assert.equal(got[0].id,'near');
  assert.equal(got[0].state,'visible');
});

test('forward cone prefetches ahead without symmetrically loading behind', () => {
  const got=V2.select(index,{x:0,z:0,dirX:0,dirZ:1,renderRadius:100,prefetchRadius:220,forwardExtra:100,prefetchBias:80});
  assert.ok(got.some(x=>x.id==='ahead' && x.state==='warm'));
  assert.ok(!got.some(x=>x.id==='behind'));
});

test('hysteresis keeps an already resident chunk warm near the boundary', () => {
  const resident=new Set(['side']);
  const got=V2.select(index,{x:0,z:0,dirX:0,dirZ:1,renderRadius:100,prefetchRadius:220,hysteresis:40,resident});
  assert.ok(got.some(x=>x.id==='side' && x.state==='warm'));
});
