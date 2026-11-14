import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {MeshStandardMaterial,Color} from './node_modules/three/build/three.webgpu.js';
import {applyReferenceFinishes,FINISH_SOURCE_SHA256} from './exterior-finishes.js';

const source=JSON.parse(gunzipSync(readFileSync(new URL('./assets-prova/scene.json.gz',import.meta.url))));
const names=['Blender / esquadrias-varandas-esquadria / torre 0',
  'Blender / SITE-implantacao-site-vidro / torre -1','Blender / LIV-IPANEMA-tipografia / torre -1'];
function fixture(){
  const materials=source.materials.map(spec=>{
    const material=new MeshStandardMaterial({color:new Color().fromArray(spec.color),roughness:spec.roughness,metalness:spec.metalness});
    material.userData.livBakedTransport=spec.baked;return material;
  });
  const meshes=source.meshes.filter(spec=>names.includes(spec.name)||spec.name.includes('SITE-car-vidro')).map(spec=>
    ({name:spec.name,userData:structuredClone(spec.userData),material:materials[spec.material]}));
  return {materials,meshes};
}

test('stock PBR clones isolate painted frames, site glazing and lettering from source/car materials',()=>{
  const {materials,meshes}=fixture(),count=materials.length;
  const originals=meshes.map(mesh=>mesh.material),signatures=originals.map(material=>material.toJSON());
  const result=applyReferenceFinishes(meshes,materials,source.sourceModelSHA256);
  assert.equal(result.changes.length,3);assert.equal(materials.length,count+3);
  const expectedRoughness=[.55,.16,.65];
  for(const [i,name] of names.entries()){
    const mesh=meshes.find(item=>item.name===name),original=originals[meshes.indexOf(mesh)];
    assert.notEqual(mesh.material,original);assert.equal(mesh.material.isMeshStandardMaterial,true);
    assert.equal(mesh.material.isNodeMaterial,undefined);assert.equal(mesh.material.metalness,0);
    assert.equal(mesh.material.roughness,expectedRoughness[i]);
    assert.deepEqual(mesh.material.color.toArray(),original.color.toArray());
    assert.equal(mesh.material.transparent,original.transparent);assert.equal(mesh.material.opacity,original.opacity);
  }
  assert.deepEqual(originals.map(material=>material.toJSON()),signatures);
  const car=meshes.find(mesh=>mesh.name.includes('SITE-car-vidro'));
  assert.equal(car.material,materials[4]);assert.equal(car.material.metalness,.25);
});

test('wrong edition, missing/duplicate targets and changed/baked materials fail before any mutation',()=>{
  const scenarios=[
    f=>{f.sha='0'.repeat(64);},
    f=>{f.meshes=f.meshes.filter(mesh=>mesh.name!==names[2]);},
    f=>{f.meshes.push({...f.meshes.find(mesh=>mesh.name===names[1])});},
    f=>{f.meshes.find(mesh=>mesh.name===names[1]).material.metalness=.5;},
    f=>{f.meshes.find(mesh=>mesh.name===names[2]).material.userData.livBakedTransport=true;},
    f=>{f.meshes.find(mesh=>mesh.name===names[1]).material.color.r+=.1;}
  ];
  for(const corrupt of scenarios){
    const f=fixture();f.sha=FINISH_SOURCE_SHA256;corrupt(f);
    const bindings=f.meshes.map(mesh=>mesh.material),owned=[...f.materials];
    assert.throws(()=>applyReferenceFinishes(f.meshes,f.materials,f.sha));
    assert.deepEqual(f.meshes.map(mesh=>mesh.material),bindings);assert.deepEqual(f.materials,owned);
  }
});
