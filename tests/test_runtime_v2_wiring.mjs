import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app=fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/app.js',import.meta.url),'utf8');
const modules=JSON.parse(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/modules.json',import.meta.url),'utf8'));

test('Runtime V2 is explicit opt-in and V1 remains the default boot path',()=>{
 assert.match(app,/const RUNTIME_V2 = URL_PARAMS\.get\("runtime"\) === "v2"/);
 assert.match(app,/if \(RUNTIME_V2\) \{/);
 assert.ok(app.indexOf('if (RUNTIME_V2) {') < app.indexOf('const embutida = document.getElementById("__citydata")'));
 assert.match(app,/loadCity\(JSON\.parse\(embutida\.textContent\)/);
});

test('Runtime V2 modules are composed before app.js',()=>{
 const required=[
  'core/city-chunk-data-v2.js','world/runtime-v2.js','world/chunk-loader-v2.js',
  'world/scene-bridge-v2.js','world/controller-v2.js'
 ];
 for(const name of required){
  assert.ok(modules.includes(name),name+' missing');
  assert.ok(modules.indexOf(name)<modules.indexOf('app.js'),name+' must load before app');
 }
});

test('composed classic bundle remains syntactically valid with V2 modules present',()=>{
 const root=new URL('../v1.5/renderizador-v16-moveis/',import.meta.url);
 const source=modules.map(name=>fs.readFileSync(new URL(name,root),'utf8')).join('\n');
 assert.doesNotThrow(()=>new Function(source));
});


test('Runtime V2 fetches its urban kit while legacy pack stays V1-only',()=>{
 assert.doesNotMatch(app,/RUNTIME_V2 && \$\("__urbanModelsV2"\)/);
 assert.match(app,/rawIndex\.urbanKit\?\.url/);
 assert.match(app,/fetchJsonV2\(kitUrl\)/);
 assert.match(app,/if \(!RUNTIME_V2 && new URLSearchParams\(location\.search\)\.get\("casas"\) !== "procedural"\)/);
});


test('property miniature prewarms the online V2 neighbourhood through a shared session cache',()=>{
 assert.match(app,/async function prewarmCityV2At\(x,z\)/);
 assert.match(app,/const v2JsonSession = new Map\(\)/);
 assert.match(app,/ranked\.slice\(0,12\)/);
 assert.match(app,/ranked\.slice\(12,32\)/);
 assert.match(app,/prewarmMapAt:\(x,z\)=>prewarmCityV2At\(x,z\)/);
});
