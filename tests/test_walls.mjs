import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import test from 'node:test';

const original=execFileSync('git',['-c','safe.directory=C:/Users/respawn/Desktop/imobiliaria','show','786fd08:renderizador-v16-moveis/app.js'],{encoding:'utf8',maxBuffer:2e6});
const start=original.indexOf('const MURO_COR =');
const source=original.slice(start,original.indexOf('(function buildStreets()',start));
const data=[0,0,1200,500,1200,500,-300,0,0,0,0,0];
const ctx=vm.createContext({console,window:{},document:{getElementById:()=>({textContent:JSON.stringify(data)})},
  terrainY:(x,z)=>Math.sin(x)*3+z*.3,hash:n=>Math.abs(Math.sin(n)),SOMBRA_CIDADE:true,
  registerTerrain:g=>{g.userData.registered=true;},roadSafety:null});
vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/lib/three.min.js',import.meta.url),'utf8'),ctx);
ctx.scene=new ctx.THREE.Scene();const material=new ctx.THREE.MeshBasicMaterial();
ctx.surfaceMaterials={muros:()=>material};let details;
ctx.exteriors={walls:(...args)=>{details=args;}};
vm.runInContext(source,ctx);
vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/world/walls.js',import.meta.url),'utf8'),ctx);
const plain=v=>JSON.parse(JSON.stringify(v));
const attributes=g=>Object.fromEntries(Object.entries(g.attributes).map(([name,a])=>[name,{array:Array.from(a.array),normalized:a.normalized,usage:a.usage}]));

test('wall subdivision, road clipping, colors and exterior metadata match the original',()=>{
  for(const roadSafety of [null,{clipSegment:()=>[[.1,.4],[.6,.9]]},{clipSegment:()=>[]}]) {
    ctx.roadSafety=roadSafety;vm.runInContext('buildMuros()',ctx);
    const result=ctx.WorldWalls.build(data,{THREE:ctx.THREE,roadSafety,terrainY:ctx.terrainY,
      hash:ctx.hash,registerTerrain:ctx.registerTerrain,material,shadows:true});
    assert.deepEqual(attributes(result.mesh.geometry),attributes(ctx.window.__gMuros.geometry));
    assert.deepEqual(plain(result.mesh.geometry.userData),plain(ctx.window.__gMuros.geometry.userData));
    assert.deepEqual(plain(result.detailSegments),plain(details[0]));
    assert.equal(result.detailHidden,result.mesh.geometry.attributes.aDetailHidden);
    assert.equal(result.mesh.material,material);assert.equal(result.mesh.receiveShadow,true);
  }
});
