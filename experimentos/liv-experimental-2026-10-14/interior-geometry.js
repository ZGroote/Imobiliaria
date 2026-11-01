import * as THREE from 'three/webgpu';
const bytes64=value=>Uint8Array.from(atob(value),char=>char.charCodeAt(0));
function windWithNormals(geometry){
  const p=geometry.attributes.position,n=geometry.attributes.normal,index=geometry.index;if(!n)return geometry;
  const at=i=>index?index.getX(i):i,count=index?index.count:p.count,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),s=new THREE.Vector3(),t=new THREE.Vector3();
  let against=0,total=0;
  for(let i=0;i<count;i+=3){
    a.fromBufferAttribute(p,at(i));b.fromBufferAttribute(p,at(i+1)).sub(a);c.fromBufferAttribute(p,at(i+2)).sub(a);b.cross(c);
    s.fromBufferAttribute(n,at(i)).add(t.fromBufferAttribute(n,at(i+1))).add(t.fromBufferAttribute(n,at(i+2)));
    const d=b.dot(s);if(Math.abs(d)<1e-12)continue;total++;if(d<0)against++;
  }
  if(!total||against<total)return geometry;
  if(index){for(let i=0;i<count;i+=3){const k=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,k);}}
  else for(const attribute of Object.values(geometry.attributes))for(let i=0;i<count;i+=3)for(let k=0;k<attribute.itemSize;k++){
    const v=attribute.getComponent(i+1,k);attribute.setComponent(i+1,k,attribute.getComponent(i+2,k));attribute.setComponent(i+2,k,v);
  }
  geometry.userData.livRewound=total;return geometry;
}
/** Vértice que só serve a triângulos de piso, parede ou teto (face a menos de 1° de um eixo) recebe a normal do eixo.
 * A fonte do Canto tem vértice de piso inclinado até 55° (o leque herda a média das paredes): o sol e o reflexo
 * acendiam cada triângulo de um jeito e o chão ganhava "raios" retos. O lado vem da normal, não da ordem dos cantos. */
function flattenAxisNormals(geometry){
  const p=geometry.attributes.position,n=geometry.attributes.normal,index=geometry.index;if(!n)return geometry;
  const at=i=>index?index.getX(i):i,count=index?index.count:p.count,want=new Map();
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),s=new THREE.Vector3(),t=new THREE.Vector3();
  for(let i=0;i<count;i+=3){
    const ids=[at(i),at(i+1),at(i+2)];
    a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]).sub(a);c.fromBufferAttribute(p,ids[2]).sub(a);b.cross(c);
    const length=b.length();let key=-1;
    if(length>1e-12){
      b.divideScalar(length);const f=[b.x,b.y,b.z],k=f.map(Math.abs).indexOf(Math.max(...f.map(Math.abs)));
      s.fromBufferAttribute(n,ids[0]).add(t.fromBufferAttribute(n,ids[1])).add(t.fromBufferAttribute(n,ids[2]));
      if(Math.abs(f[k])>.99985)key=k*2+(f[k]*[s.x,s.y,s.z][k]>0?(f[k]>0?1:0):(f[k]>0?0:1));
    }
    for(const id of ids){const prev=want.get(id);want.set(id,prev===undefined||prev===key?key:-1);}
  }
  let flattened=0;
  for(const [id,key]of want){if(key<0)continue;const v=[0,0,0];v[key>>1]=key&1?1:-1;n.setXYZ(id,...v);flattened++;}
  if(flattened)n.needsUpdate=true;
  return geometry;
}
export function geometryFromSpec(spec,own=value=>value){
  const geometry=own(new THREE.BufferGeometry());
  for(const [name,size]of [['position',3],['normal',3],['uv',2],['uv1',2],['color',3]])if(spec[name]?.length)geometry.setAttribute(name,spec.prepared?new THREE.BufferAttribute(spec[name],size):new THREE.Float32BufferAttribute(spec[name],size));
  if(spec.index)geometry.setIndex(spec.prepared?new THREE.BufferAttribute(spec.index,1):new THREE.Uint32BufferAttribute(spec.index,1));
  for(const group of spec.groups||[])geometry.addGroup(group.start,group.count,group.materialIndex);
  if(spec.prepared){if(spec.boundingSphere)geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(...spec.boundingSphere.center),spec.boundingSphere.radius);else geometry.computeBoundingSphere();return geometry;}
  geometry.computeBoundingSphere();return flattenAxisNormals(windWithNormals(geometry));
}
export function expandedGeometryFromSpec(spec,corner,own=value=>value){
  if(corner.preparedGeometry)return geometryFromSpec(corner.preparedGeometry,own);
  const indicesBytes=bytes64(corner.indicesU32),uvBytes=bytes64(corner.uv1U16);
  if(indicesBytes.byteLength%4||uvBytes.byteLength%2)throw Error('Buffers compactos inválidos.');
  const indices=new Uint32Array(indicesBytes.buffer),uvs=new Uint16Array(uvBytes.buffer);
  if(indices.length!==corner.triangleCount*3||uvs.length!==indices.length*2||corner.sourceVertexCount!==spec.position.length/3||corner.sourceGeometrySHA256!==spec.sha256)throw Error('UV compacto não pertence à geometria original.');
  const geometry=own(new THREE.BufferGeometry());
  for(const [name,size]of [['position',3],['normal',3],['uv',2],['color',3]])if(spec[name]?.length){
    const data=new Float32Array(indices.length*size);
    for(let i=0;i<indices.length;i++){if(indices[i]>=corner.sourceVertexCount)throw Error('Índice compacto fora da fonte.');for(let k=0;k<size;k++)data[i*size+k]=spec[name][indices[i]*size+k];}
    geometry.setAttribute(name,new THREE.BufferAttribute(data,size));
  }
  geometry.setAttribute('uv1',new THREE.BufferAttribute(Float32Array.from(uvs,x=>x/65535),2));
  for(const group of corner.groups)geometry.addGroup(group.start,group.count,group.materialIndex);geometry.computeBoundingSphere();return flattenAxisNormals(windWithNormals(geometry));
}
