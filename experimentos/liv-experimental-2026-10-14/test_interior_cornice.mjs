import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import * as THREE from 'three/webgpu';
import {installCornice} from './interior-cornice.js';

function actualLayout(typology){
  const unit=JSON.parse(readFileSync(new URL(`./interiores/${typology}/unidade.json`,import.meta.url)));
  const points=unit.planta.comodos.flatMap(room=>room.poly);
  const center=[0,1].map(axis=>(Math.min(...points.map(p=>p[axis]))+Math.max(...points.map(p=>p[axis])))/2);
  return {pd:2.7,unit,center,rooms:unit.planta.comodos.map(room=>({id:room.id,name:room.nome,poly:room.poly.map(p=>p.map((v,i)=>v-center[i]))}))};
}
function triangles(geometry){
  const p=geometry.attributes.position,ids=geometry.index;
  return Array.from({length:(ids?.count??p.count)/3},(_,i)=>[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,ids?ids.getX(3*i+k):3*i+k)));
}
function probe(mesh,x,z){
  mesh.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(x,2.72,z),new THREE.Vector3(0,-1,0),0,.14);
  return ray.intersectObject(mesh).filter(hit=>hit.face.normal.y>.9).length;
}

for(const typology of ['canto','meio'])test(`${typology}: perfil fechado, normais externas e faixa fina sem alterar a planta`,()=>{
  const layout=actualLayout(typology),before=structuredClone(layout),scene=new THREE.Scene(),owned=new Set();
  const {meshes,metrics}=installCornice({scene,layout,own:value=>{owned.add(value);return value;}}),[mesh]=meshes;
  assert.deepEqual(layout,before);assert.equal(mesh.name,'rodateto-liso-continuo');assert.equal(mesh.userData.livCornice,true);
  assert.equal(metrics.rooms,6);assert.equal(metrics.reused,false);assert.equal(scene.children.length,1);assert.equal(owned.size,2);
  assert.equal(mesh.material.roughness,.85);assert.equal(mesh.material.emissiveIntensity,0);
  assert.equal(mesh.material.side,THREE.FrontSide);
  const edges=new Map(),normal=mesh.geometry.attributes.normal;let volume=0,topArea=0;
  for(const [i,[a,b,c]]of triangles(mesh.geometry).entries()){
    const cross=b.clone().sub(a).cross(c.clone().sub(a));assert.ok(cross.length()>1e-8);
    assert.ok(cross.normalize().dot(new THREE.Vector3().fromBufferAttribute(normal,i*3))>.99999);
    volume+=a.dot(b.clone().cross(c))/6;
    if(normal.getY(i*3)>.9)topArea+=b.clone().sub(a).cross(c.clone().sub(a)).length()/2;
    const points=[a,b,c].map(p=>p.toArray().map(v=>v.toFixed(6)).join(','));
    for(let k=0;k<3;k++){const key=[points[k],points[(k+1)%3]].sort().join('|');edges.set(key,(edges.get(key)||0)+1);}
  }
  assert.ok([...edges.values()].every(count=>count===2),'Every geometric edge belongs to exactly two faces.');
  assert.ok(Math.abs(topArea-metrics.footprintArea)<1e-5);
  assert.ok(Math.abs(volume-topArea*.054)<1e-5);
  mesh.geometry.computeBoundingBox();assert.ok(Math.abs(mesh.geometry.boundingBox.min.y-2.65)<1e-6);assert.ok(Math.abs(mesh.geometry.boundingBox.max.y-2.704)<1e-6);
  for(const [a,b,c]of triangles(mesh.geometry))if(a.y===b.y&&b.y===c.y){
    assert.ok(Math.abs(a.y-layout.pd)>.003,'No closed cap may coincide with the ceiling plane.');
  }
  // Independent samples sit midway along the inner wall and inside/outside the
  // 2 cm projection, with a hidden 3 mm wall overlap. No joints or triangulation diagonals are sampled.
  for(const room of layout.rooms){
    const signed=room.poly.reduce((sum,p,i)=>{const q=room.poly[(i+1)%room.poly.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
    for(let i=0;i<room.poly.length;i++){
      const a=room.poly[i],b=room.poly[(i+1)%room.poly.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      const nx=-dz/length*Math.sign(signed),nz=dx/length*Math.sign(signed);
      const x=a[0]+dx*.371,z=a[1]+dz*.371;
      assert.equal(probe(mesh,x+nx*.061,z+nz*.061),0,{typology,room:room.id,edge:i});
      assert.equal(probe(mesh,x+nx*.063,z+nz*.063),1,{typology,room:room.id,edge:i});
      assert.equal(probe(mesh,x+nx*.075,z+nz*.075),1,{typology,room:room.id,edge:i});
      assert.equal(probe(mesh,x+nx*.09,z+nz*.09),0,{typology,room:room.id,edge:i});
    }
  }
  for(const resource of owned)resource.dispose();
});

test('polígonos mesclados em L não ganham moldura cruzando a sala ou o vestíbulo',()=>{
  for(const [typology,worldPoint]of [['canto',[5.35,3.35]],['meio',[7.05,3.35]]]){
    const layout=actualLayout(typology),{meshes:[mesh]}=installCornice({scene:new THREE.Scene(),layout});
    assert.equal(probe(mesh,worldPoint[0]-layout.center[0],worldPoint[1]-layout.center[1]),0,typology);
    mesh.geometry.dispose();mesh.material.dispose();
  }
});

test('substitui molduras antigas sem remover paredes, móveis ou seus recursos',()=>{
  const scene=new THREE.Scene(),old=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());old.name='rodateto';scene.add(old);
  const wall=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshStandardMaterial());wall.name='paredes';scene.add(wall);
  const baked=[{mesh:old},{mesh:wall}],wallGeometry=wall.geometry,wallMaterial=wall.material;
  const result=installCornice({scene,layout:actualLayout('canto'),baked});
  assert.equal(result.metrics.replacedMeshes,1);assert.equal(old.parent,null);assert.equal(wall.parent,scene);
  assert.equal(wall.geometry,wallGeometry);assert.equal(wall.material,wallMaterial);assert.deepEqual(baked,[{mesh:wall}]);
  for(const mesh of [old,wall,...result.meshes]){mesh.geometry.dispose();mesh.material.dispose();}
});

test('a fonte congelada nova conserva material baked, geometria e UV1 sem sobreposição',()=>{
  const scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(1,.11,1),material=new THREE.MeshStandardMaterial();
  geometry.setAttribute('uv1',geometry.attributes.uv.clone());const mesh=new THREE.Mesh(geometry,material);mesh.name='rodateto-liso-continuo';scene.add(mesh);
  const baked=[{mesh,geometry}],result=installCornice({scene,layout:actualLayout('meio'),baked,own:()=>{throw Error('A frozen molding must not allocate another resource.');}});
  assert.equal(result.metrics.reused,true);assert.deepEqual(result.meshes,[mesh]);assert.equal(scene.children.length,1);
  assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);assert.equal(mesh.userData.livCornice,true);assert.equal(baked[0].geometry,geometry);
  const again=installCornice({scene,layout:actualLayout('meio')});assert.equal(again.meshes[0],mesh);assert.equal(scene.children.length,1);
  geometry.dispose();material.dispose();
});
