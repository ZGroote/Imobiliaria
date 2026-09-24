import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import test from 'node:test';

const original=execFileSync('git',['-c','safe.directory=C:/Users/respawn/Desktop/imobiliaria','show','786fd08:renderizador-v16-moveis/app.js'],{encoding:'utf8',maxBuffer:2e6});
const start=original.indexOf('const PORT = (() => {');
const source=original.slice(start,original.indexOf('/* ============================================================\n   6. Montagem',start));
const data=Array.from({length:280},(_,i)=>[10,(i%2?10:-10),i%256,30+i%30,i%4]).flat();
const ctx=vm.createContext({console,document:{getElementById:()=>({textContent:JSON.stringify(data)})},
  terrainY:(x,z)=>x*.1+z*.2,reliefAmount:0,SOMBRA_CIDADE:true,PORT_RAIO:700});
vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/lib/three.min.js',import.meta.url),'utf8'),ctx);
ctx.target=new ctx.THREE.Vector3();ctx.scene=new ctx.THREE.Scene();
vm.runInContext(source+'\nglobalThis.old={group:gPort,refresh:refazPortoes};',ctx);
vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/world/gates.js',import.meta.url),'utf8'),ctx);
const gates=ctx.Gates.create({THREE:ctx.THREE,data,target:ctx.target,terrainY:ctx.terrainY,
  getRelief:()=>ctx.reliefAmount,SOMBRA_CIDADE:true});
const snapshot=group=>JSON.stringify(group.children.map(mesh=>({count:mesh.count,
  matrix:Array.from(mesh.instanceMatrix.array),colors:Array.from(mesh.instanceColor.array),
  geometry:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([k,v])=>[k,Array.from(v.array)])),
  shadows:[mesh.castShadow,mesh.receiveShadow],culled:mesh.frustumCulled})));

test('all four gate types preserve geometry, instances, radius and relief',()=>{
  for(const [x,relief] of [[0,0],[0,1],[800,1],[1500,1],[0,0]]) {
    ctx.target.x=x;ctx.reliefAmount=relief;ctx.old.refresh();gates.refresh();
    assert.equal(snapshot(gates.group),snapshot(ctx.old.group));
  }
  assert.equal(gates.group.children.length,4);
});

test('absent and empty gate payloads produce no instances',()=>{
  for(const payload of [null,[]]) {
    const empty=ctx.Gates.create({THREE:ctx.THREE,data:payload,target:ctx.target,terrainY:()=>0,getRelief:()=>0});
    empty.refresh();assert.equal(empty.group.children.length,0);
  }
});
