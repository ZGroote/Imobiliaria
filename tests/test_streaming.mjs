import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const ctx=vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/world/streaming.js',import.meta.url),'utf8'),ctx);

test('streaming prioritizes distance, respects hysteresis and resets pending work',()=>{
  const target={x:0,z:0},live=new Map(),built=[],dropped=[];
  let radius=100,overlays=0;
  const groups=[{cx:90,cz:0,rad:0},{cx:20,cz:0,rad:0},{cx:120,cz:0,rad:30}];
  const s=ctx.WorldStreaming.create({target,live,getGroups:()=>groups,getRadius:()=>radius,hysteresis:30,budgetMs:4,
    dropGroup:i=>{dropped.push(i);live.delete(i);},buildGroup:i=>{built.push(i);live.set(i,groups[i]);},
    rebuildOverlay:()=>overlays++,now:()=>0});
  s.update(true);assert.equal(s.pending,0);s.start();s.update(true);assert.equal(s.pending,3);
  assert.equal(s.pump(),3);assert.deepEqual(built,[1,0,2]);
  target.x=-20;s.update(false);assert.equal(dropped.length,0);
  s.update(true);assert.equal(dropped.length,0);
  target.x=-60;s.update(true);assert.deepEqual(dropped,[0,2]);assert.equal(overlays,1);
  radius=300;s.update(true);assert.equal(s.pending,2);
  s.reset();assert.equal(s.pending,0);s.update(true);assert.equal(s.pending,0);
  s.start();s.update(false);assert.equal(s.pending,2);assert.equal(s.buildNext(),true);assert.equal(s.pending,1);
});

test('frame budget leaves remaining work queued and diagnostic steps consume one group',()=>{
  const live=new Map();let clock=0;
  const s=ctx.WorldStreaming.create({target:{x:0,z:0},live,getGroups:()=>Array.from({length:5},(_,i)=>({cx:i,cz:0,rad:0})),
    getRadius:()=>100,hysteresis:30,budgetMs:4,dropGroup:()=>{},rebuildOverlay:()=>{},
    buildGroup:i=>{live.set(i,{});clock+=3;},now:()=>clock});
  s.start();s.update(true);assert.equal(s.pump(),2);assert.equal(s.pending,3);
  assert.equal(s.buildNext(),true);assert.equal(s.pending,2);assert.equal(s.pump(),2);
  assert.equal(s.buildNext(),false);assert.equal(s.pending,0);
});
