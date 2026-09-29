import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const ctx=vm.createContext({console});
vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/world/controller-v2.js',import.meta.url),'utf8'),ctx);
const C=ctx.CityControllerV2;

test('movement direction leads while panning, then camera direction takes over',async()=>{
 let time=0,sample={x:0,z:0,viewDirX:1,viewDirZ:0}; const dirs=[];
 const controller=C.create({
  index:{chunks:[]},select:(idx,v)=>(dirs.push([v.dirX,v.dirZ]),[]),
  bridge:{sync:async()=>{},reset(){}},getResident:()=>new Set(),getSample:()=>sample,
  getViewConfig:()=>({renderRadius:100}),now:()=>time,moveThreshold:1,turnDot:.999,motionHoldMs:200
 });
 controller.update(true); // camera: east
 sample={...sample,z:10}; time=20; controller.update(false); // movement: south/+z
 await Promise.resolve();
 assert.ok(dirs.at(-1)[1]>.99);
 time=300; sample={...sample,viewDirX:-1,viewDirZ:0}; controller.update(false);
 await Promise.resolve();
 assert.ok(dirs.at(-1)[0]<-.99);
});

test('small unchanged samples do not reschedule work',()=>{
 let calls=0,time=0,sample={x:0,z:0,viewDirX:0,viewDirZ:1};
 const c=C.create({index:{chunks:[]},select:()=>[],bridge:{sync:async()=>{calls++},reset(){}},
  getResident:()=>new Set(),getSample:()=>sample,getViewConfig:()=>({}),now:()=>time,moveThreshold:30});
 assert.equal(c.update(true),true);
 sample={...sample,x:2}; time=10;
 assert.equal(c.update(false),false);
 assert.equal(calls,1);
});

test('sub-threshold pan samples accumulate into a stable movement direction',()=>{
 let time=0,sample={x:0,z:0,viewDirX:0,viewDirZ:1}; const dirs=[];
 const c=C.create({index:{chunks:[]},select:(idx,v)=>(dirs.push([v.dirX,v.dirZ]),[]),
  bridge:{sync:async()=>{},reset(){}},getResident:()=>new Set(),getSample:()=>sample,
  getViewConfig:()=>({}),now:()=>time,moveThreshold:30,directionThreshold:4,turnDot:.999});
 c.update(true);
 sample={...sample,x:2};time=10;assert.equal(c.update(false),false);
 sample={...sample,x:4.2};time=20;assert.equal(c.update(false),true);
 assert.ok(dirs.at(-1)[0]>.99);
});
