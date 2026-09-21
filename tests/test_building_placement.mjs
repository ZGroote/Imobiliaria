import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const ctx=vm.createContext({});
for(const f of ['core/geometry.js','world/building-type.js','world/building-placement.js'])
  vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/'+f,import.meta.url),'utf8'),ctx);
const create=()=>ctx.BuildingPlacement.create({geometry:ctx.MapGeometry,types:ctx.BuildingType,terrainY:(x,z)=>x+z});
const record=(x=0)=>({r:[[x,0],[x,10],[x+10,10],[x+10,0]],c:1,h:4,area:100});
test('explicit properties bypass road filtering and cached collision results reset',()=>{
  const p=create(),b=record();let checks=0;
  const roads={hit:()=>{checks++;return true;}};
  assert.equal(p.blocked(b,roads),true);assert.equal(p.blocked(b,roads),true);assert.equal(checks,1);
  for(const metadata of [{lancamento:true},{parede:0},{sacadas:[]}])assert.equal(p.blocked({...b,...metadata},roads),false);
  assert.equal(checks,1);p.clear();p.blocked(b,roads);assert.equal(checks,2);
  assert.equal(p.blocked(b,null),false);
});
test('urban selection sorts a copy, falls back on collision and settles to the highest corner',()=>{
  const p=create(),a=record(20),b=record(0),records=[a,b],order=[],added=[];
  const urban={select(rec,ob,ring,category){order.push(rec);assert.equal(category,'casas');return {x:5,z:5,theta:0,scale:1,asset:{size:[10,4,10]},corners:[[0,0],[10,10]]};},
    add(choice,rec,base){added.push({rec,base});return rec;}};
  const out=p.split(records,urban,null);
  assert.equal(records[0],a);assert.equal(order[0],b);assert.equal(out.slots.length,2);assert.equal(out.rest.length,0);
  assert(added.every(x=>x.base===20));assert.equal(out.shadows.length,16);
  const rejected=p.split(records,urban,{hit:()=>true});assert.equal(rejected.slots.length,0);assert.equal(rejected.rest.length,2);
  assert.equal(p.split(records,null,null).rest,records);
});
