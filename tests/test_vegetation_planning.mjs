import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import test from 'node:test';

const original=execFileSync('git',['-c','safe.directory=C:/Users/respawn/Desktop/imobiliaria','show','8712430:renderizador-v16-moveis/app.js'],{encoding:'utf8',maxBuffer:2e6});
const start=original.indexOf('const ARV = (() => {');
const source=original.slice(start,original.indexOf('/* Uma InstancedMesh POR ESPECIE',start));
const raw=JSON.parse(fs.readFileSync(new URL('../arvores/arvores_lib.json',import.meta.url),'utf8'));
const library={especies:Object.fromEntries(Object.entries(raw.especies).map(([name,e])=>[name,{...e.lod['0'],alt_m:e.altura_m}]))};
const names=Object.keys(library.especies);
const config={rua:{[names[0]]:2,[names[1]]:1},praca:{[names[1]]:1},densidade_rua:1};
const hash=n=>{const v=Math.sin(n)*43758.5453;return v-Math.floor(v);};
const HW=['residential','primary','footway'],ROAD_W={residential:7.5,primary:13};
const ctx=vm.createContext({console,HW,ROAD_W,hash,ndviBruto:(x,z)=>.3+.2*Math.sin(x+z),indexaJuncoes(){},
  CIDADE:{arborizacao:config},document:{getElementById:()=>({textContent:JSON.stringify(library)})}});
vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/core/geometry.js',import.meta.url),'utf8'),ctx);
ctx.inside=ctx.MapGeometry.inside;
vm.runInContext(source+'\nglobalThis.old={ARV,indexaAsfalto,buildTrees};',ctx);
vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/world/vegetation-planning.js',import.meta.url),'utf8'),ctx);
const ARV=ctx.VegetationPlanning.decode(library,config);
const current=ctx.VegetationPlanning.create({ARV,HW,ROAD_W,hash,inside:ctx.inside,ndviBruto:ctx.ndviBruto});
const plain=v=>JSON.parse(JSON.stringify(v));

test('catalogue preserves every species buffer, height, configuration and weighted selection',()=>{
  assert.deepEqual(plain(ARV),plain(ctx.old.ARV));
  for(const kind of ['rua','praca'])for(let i=0;i<=100;i++)
    assert.equal(ARV.sorteia(ARV[kind],i/100),ctx.old.ARV.sorteia(ctx.old.ARV[kind],i/100));
  assert.equal(ctx.VegetationPlanning.decode({especies:{}},config),null);
});

test('planting preserves seeded output across crossings, neighbouring roads and index rebuilds',()=>{
  const polys=[[[0,0],[200,0],[200,200],[0,200]],[[0,0],[10,0],[10,400],[0,400]],[[0,0],[1000,0],[1000,1000],[0,1000]]];
  const roads=[{k:0,pts:[[-100,50],[300,50]]},{k:1,pts:[[50,-100],[50,300]]},{k:0,pts:[[0,0],[0,0],[4,4]]},{k:2,pts:[[0,120],[200,120]]}];
  for(const indexed of [roads,[],roads.slice(1),roads]) {
    ctx.old.indexaAsfalto(indexed);current.indexaAsfalto(indexed);
    const expected=plain(ctx.old.buildTrees(polys,roads));
    assert(expected.length>0);
    assert.deepEqual(plain(current.buildTrees(polys,roads)),expected);
    assert.deepEqual(plain(current.buildTrees(polys,roads)),expected);
  }
  const disabled=ctx.VegetationPlanning.create({ARV:null,HW,ROAD_W,hash,inside:ctx.inside,ndviBruto:ctx.ndviBruto});
  disabled.indexaAsfalto(roads);assert.equal(disabled.buildTrees(polys,roads),null);
});
