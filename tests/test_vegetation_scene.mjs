import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const ctx=vm.createContext({console});
for(const file of ['lib/three.min.js','world/vegetation-scene.js'])
  vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/'+file,import.meta.url),'utf8'),ctx);
const {THREE,VegetationScene}=ctx;
const species={pos:new Float32Array([0,0,0,1,0,0,0,1,0]),nrm:new Float32Array(9),col:new Float32Array(9)};
const makePlant=(x,sp=0)=>({x,z:0,sp,rua:true,s:1,rot:0,tint:1});
const snapshot=scene=>JSON.stringify(scene.group.children.map(m=>({count:m.count,
  matrix:Array.from(m.instanceMatrix.array.slice(0,m.count*16)),color:Array.from(m.instanceColor.array.slice(0,m.count*3))})));

test('tree membership survives growth, removal, radius movement, cap and relief changes',()=>{
  const target=new THREE.Vector3(),live=new Map();let relief=0;
  const scene=VegetationScene.create({THREE,ARV:{cat:[species,species],raio:100,teto:150},target,
    terrainY:()=>12,getRelief:()=>relief,getLive:()=>live,SOMBRA_CIDADE:true});
  const update=()=>{scene.trackTarget();if(scene.dirty)scene.refresh();};
  const check=()=>{const report=scene.confereArvores();assert.equal(report.ok,true,JSON.stringify(report));};
  live.set(0,{cx:0,cz:0,plants:Array.from({length:70},(_,i)=>makePlant(i))});
  live.set(1,{cx:90,cz:0,plants:[makePlant(90,1)]});update();check();
  assert.equal(scene.group.userData.pesRua.length,71);
  assert.equal(scene.group.children[0].instanceMatrix.count,128);
  const stable=snapshot(scene);update();assert.equal(snapshot(scene),stable);assert.equal(scene.dirty,false);
  target.x=-20;update();check();assert.equal(scene.group.userData.pesRua.length,70);
  live.delete(0);scene.invalidate();update();check();assert.equal(scene.group.userData.pesRua.length,0);
  live.set(2,{cx:0,cz:0,plants:Array.from({length:200},(_,i)=>makePlant(i,i%2))});
  scene.invalidate();update();check();assert.equal(scene.group.userData.pesRua.length,150);
  relief=1;scene.invalidate(true);update();check();
  for(const mesh of scene.group.children)for(let i=0;i<mesh.count;i++)assert.equal(mesh.instanceMatrix.array[i*16+13],12);
  target.x=500;assert.equal(scene.trackTarget(),true);scene.refresh();check();assert.equal(scene.group.userData.pesRua.length,0);
});

test('missing tree catalogue leaves an empty group and clears pending work',()=>{
  const scene=VegetationScene.create({THREE,ARV:null,target:new THREE.Vector3(),terrainY:()=>0,
    getRelief:()=>0,getLive:()=>new Map(),SOMBRA_CIDADE:false});
  scene.refresh();assert.equal(scene.dirty,false);assert.equal(scene.group.children.length,0);
  assert.equal(scene.confereArvores().ok,true);
});
