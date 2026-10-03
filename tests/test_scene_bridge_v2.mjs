import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const ctx=vm.createContext({setTimeout});
for (const p of [
 '../v1.5/renderizador-v16-moveis/world/runtime-v2.js',
 '../v1.5/renderizador-v16-moveis/world/chunk-loader-v2.js',
 '../v1.5/renderizador-v16-moveis/world/scene-bridge-v2.js'
]) vm.runInContext(fs.readFileSync(new URL(p,import.meta.url),'utf8'),ctx);

const R=ctx.CityRuntimeV2,L=ctx.CityChunkLoaderV2,S=ctx.CitySceneBridgeV2;
const index={chunks:[
 {id:'near',cx:0,cz:60,rad:5,url:'near'},
 {id:'ahead',cx:0,cz:220,rad:5,url:'ahead'},
 {id:'behind',cx:0,cz:-220,rad:5,url:'behind'}
]};

test('warm chunks prefetch but only visible chunks mount',async()=>{
 const fetched=[],mounted=[];
 const loader=L.create({fetchJson:async u=>(fetched.push(u),{u}),decode:(x,c)=>c.id,maxResident:8});
 const bridge=S.create({loader,mountChunk:(id)=>(mounted.push(id),id),unmountChunk:()=>{}});
 const wanted=R.select(index,{x:0,z:0,dirX:0,dirZ:1,renderRadius:100,prefetchRadius:180,forwardExtra:80});
 await bridge.sync(index,wanted);
 assert.deepEqual(fetched,['near','ahead']);
 assert.deepEqual(mounted,['near']);
});

test('camera rotation unmounts old visible chunk and mounts the new side',async()=>{
 const loader=L.create({fetchJson:async u=>({u}),decode:(x,c)=>c.id,maxResident:8});
 const mounted=[],unmounted=[];
 const bridge=S.create({loader,mountChunk:id=>(mounted.push(id),id),unmountChunk:id=>unmounted.push(id)});
 await bridge.sync(index,R.select(index,{x:0,z:150,dirX:0,dirZ:1,renderRadius:100,prefetchRadius:100}));
 await bridge.sync(index,R.select(index,{x:0,z:-150,dirX:0,dirZ:-1,renderRadius:100,prefetchRadius:100}));
 assert.ok(mounted.includes('ahead')); assert.ok(mounted.includes('behind'));
 assert.ok(unmounted.includes('ahead'));
});

test('stale async load never mounts after a newer camera update',async()=>{
 let release; const gate=new Promise(r=>release=r);
 const loader=L.create({fetchJson:async u=>{if(u==='ahead') await gate; return {u};},decode:(x,c)=>c.id,maxResident:8});
 const mounted=[];
 const bridge=S.create({loader,mountChunk:id=>(mounted.push(id),id),unmountChunk:()=>{}});
 const first=bridge.sync(index,[{id:'ahead',state:'visible'}]);
 const second=bridge.sync(index,[{id:'behind',state:'visible'}]);
 release(); await Promise.all([first,second]);
 assert.ok(!mounted.includes('ahead')); assert.ok(mounted.includes('behind'));
 assert.equal(bridge.syncing(),0);
});
