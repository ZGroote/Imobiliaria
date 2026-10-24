import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from 'three/webgpu';
import {unifiedWallTop,removeOriginalWallTop} from './interior-wall-tops.js';
import {wallTopContours} from './dados/topos-de-parede.js';

let overlaps=0,probes=0;
for(const typology of ['canto','meio']){
  const profile=wallTopContours[typology];
  const raw=gunzipSync(readFileSync(new URL(`./interiores/${typology}/source.json.gz`,import.meta.url)));
  assert.equal(createHash('sha256').update(raw).digest('hex'),profile.sourceSHA256,'Wall contours must match the active source snapshot');
  const source=JSON.parse(raw);
  const spec=source.geometries[source.objects.find(o=>o.slot===0).geometry];
  const original=new THREE.BufferGeometry();
  for(const [name,size]of [['position',3],['normal',3],['uv',2],['color',3]])
    if(spec[name])original.setAttribute(name,new THREE.Float32BufferAttribute(spec[name],size));
  if(spec.index)original.setIndex(spec.index);
  const clean=removeOriginalWallTop(original,profile.height),top=unifiedWallTop(typology,profile.sourceSHA256,'#eee7d9');
  // Source attributes are byte-identical: only the conflicting top draw list changes.
  for(const name of Object.keys(original.attributes))assert.deepEqual(clean.attributes[name].array,original.attributes[name].array);
  const expected=[];
  for(let i=0;i<(original.index?.count??original.attributes.position.count);i+=3){
    const ids=[0,1,2].map(k=>original.index?original.index.getX(i+k):i+k);
    if(ids.some(id=>Math.abs(original.attributes.position.getY(id)-profile.height)>1e-6))expected.push(...ids);
  }
  assert.deepEqual(Array.from(clean.index.array),expected);
  let area=0;const p=top.attributes.position;
  for(let i=0;i<p.count;i+=3){
    const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);
    const cross=b.sub(a).cross(c.sub(a));assert.ok(cross.y>0,JSON.stringify({typology,i,cross:cross.toArray(),points:Array.from(p.array.slice(i*3,i*3+9))}));area+=cross.length()/2;
  }
  assert.ok(Math.abs(area-profile.unionArea)<1e-5,{typology,area,expected:profile.unionArea});
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  const sourceMesh=new THREE.Mesh(original,material),cleanMesh=new THREE.Mesh(clean,material),topMesh=new THREE.Mesh(top,material);
  for(const mesh of [sourceMesh,cleanMesh,topMesh])mesh.updateMatrixWorld(true);
  original.computeBoundingBox();const bounds=original.boundingBox,ray=new THREE.Raycaster();ray.far=.05;
  for(let ix=0;ix<83;ix++)for(let iz=0;iz<71;iz++){
    // Avoid boundary/triangulation edges; compare independently against the
    // original triangle footprint, including holes and concave joins.
    const x=bounds.min.x+(ix+.371)/83*(bounds.max.x-bounds.min.x);
    const z=bounds.min.z+(iz+.617)/71*(bounds.max.z-bounds.min.z);
    ray.set(new THREE.Vector3(x,profile.height+.02,z),new THREE.Vector3(0,-1,0));
    const old=ray.intersectObject(sourceMesh).length,now=ray.intersectObject(topMesh).length;
    assert.equal(now,old?1:0,{typology,x,z,old,now});assert.equal(ray.intersectObject(cleanMesh).length,0);
    if(old>1)overlaps++;probes++;
  }
  for(const g of [original,clean,top])g.dispose();material.dispose();
}
assert.ok(overlaps>40,'The independent source probe must encounter the reported overlapping joints.');
assert.throws(()=>unifiedWallTop('canto','invalid-source','#fff'),/outra fonte/);
console.log(JSON.stringify({status:'PASS',probes,originalOverlappingProbes:overlaps}));
