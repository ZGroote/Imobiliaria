import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const ctx=vm.createContext({});
for (const p of ['../v1.5/renderizador-v16-moveis/world/runtime-v2.js','../v1.5/renderizador-v16-moveis/world/chunk-loader-v2.js'])
  vm.runInContext(fs.readFileSync(new URL(p,import.meta.url),'utf8'),ctx);
const R=ctx.CityRuntimeV2, L=ctx.CityChunkLoaderV2;
const index={chunks:[
 {id:'near',cx:0,cz:80,rad:10,url:'near.json'},
 {id:'ahead',cx:0,cz:260,rad:10,url:'ahead.json'},
 {id:'behind',cx:0,cz:-260,rad:10,url:'behind.json'}
]};

test('scheduler to loader fetches only selected chunks and preserves ids', async()=>{
 const calls=[]; const loader=L.create({fetchJson:async u=>(calls.push(u),{u}),decode:(raw,c)=>({chunkId:c.id,raw}),maxResident:8});
 const wanted=R.select(index,{x:0,z:0,dirX:0,dirZ:1,renderRadius:100,prefetchRadius:220,forwardExtra:100});
 const got=await loader.sync(index,wanted);
 assert.deepEqual(calls,['near.json','ahead.json']);
 assert.deepEqual(Array.from(got, x=>String(x.id)),['near','ahead']);
 assert.equal(got[1].value.chunkId,'ahead');
});

test('concurrent loads deduplicate network fetch', async()=>{
 let calls=0; const loader=L.create({fetchJson:async()=>{calls++; await new Promise(r=>setTimeout(r,5)); return {};},decode:()=>({})});
 await Promise.all([loader.load(index.chunks[0]),loader.load(index.chunks[0])]);
 assert.equal(calls,1);
});

test('resident cache survives camera rotation and bounded eviction removes cold LRU', async()=>{
 const loader=L.create({fetchJson:async u=>({u}),decode:(x,c)=>c.id,maxResident:2});
 await loader.load(index.chunks[0]); await loader.load(index.chunks[1]); await loader.load(index.chunks[2]);
 loader.evict(new Set(['behind']));
 assert.equal(loader.has('near'),false);
 assert.equal(loader.has('ahead'),true);
 assert.equal(loader.has('behind'),true);
});
