import * as THREE from 'three/webgpu';

const NAME='rodateto-liso-continuo',EPS=1e-9;
const area=ring=>ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2;
function cleanRing(poly){
  if(!Array.isArray(poly)||!poly.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))throw Error('Contorno do rodateto inválido.');
  const ring=poly.map(p=>[...p]).filter((p,i,all)=>Math.hypot(p[0]-all[(i+all.length-1)%all.length][0],p[1]-all[(i+all.length-1)%all.length][1])>EPS);
  // Remove collinear subdivisions before joining the offset faces. Otherwise
  // a cap can have one long edge opposite several shorter side edges.
  for(let i=ring.length-1;i>=0&&ring.length>3;i--){
    const a=ring[(i+ring.length-1)%ring.length],b=ring[i],c=ring[(i+1)%ring.length];
    const ux=b[0]-a[0],uz=b[1]-a[1],vx=c[0]-b[0],vz=c[1]-b[1];
    if(Math.abs(ux*vz-uz*vx)<EPS&&ux*vx+uz*vz>0)ring.splice(i,1);
  }
  if(ring.length<3||Math.abs(area(ring))<EPS)throw Error('Contorno do rodateto sem área.');
  return area(ring)>0?ring:ring.reverse();
}
function inset(ring,distance){
  return ring.map((p,i)=>{
    const a=ring[(i+ring.length-1)%ring.length],b=ring[(i+1)%ring.length];
    const la=Math.hypot(p[0]-a[0],p[1]-a[1]),lb=Math.hypot(b[0]-p[0],b[1]-p[1]);
    const ax=(p[0]-a[0])/la,az=(p[1]-a[1])/la,bx=(b[0]-p[0])/lb,bz=(b[1]-p[1])/lb;
    const denominator=1+ax*bx+az*bz;
    if(denominator<EPS)throw Error('Quina do rodateto inválida.');
    return [p[0]-(az+bz)*distance/denominator,p[1]+(ax+bx)*distance/denominator];
  });
}
function intersects(a,b,c,d){
  const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  return cross(a,b,c)*cross(a,b,d)<-EPS&&cross(c,d,a)*cross(c,d,b)<-EPS;
}
function validInset(ring){
  if(area(ring)<=EPS)return false;
  for(let i=0;i<ring.length;i++)for(let j=i+2;j<ring.length;j++){
    if(i===0&&j===ring.length-1)continue;
    if(intersects(ring[i],ring[(i+1)%ring.length],ring[j],ring[(j+1)%ring.length]))return false;
  }
  return true;
}
function geometryForRooms(rooms,{top,height,projection,wallThickness,ceilingOverlap,wallOverlap}){
  const positions=[],normals=[],uv=[];let footprintArea=0;
  const triangle=(a,b,c)=>{
    const normal=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).normalize();
    for(const p of [a,b,c]){
      positions.push(p.x,p.y,p.z);normals.push(...normal.toArray());
      uv.push(Math.abs(normal.x)>.9?p.z:p.x,Math.abs(normal.y)>.9?p.z:p.y);
    }
  };
  const quad=(a,b,c,d)=>{triangle(a,b,c);triangle(a,c,d);};
  const point=(p,y)=>new THREE.Vector3(p[0],y,p[1]);
  for(const room of rooms){
    // createLayout already exposes the physical merged polygon, including the
    // room's L-shaped wings. No border is drawn across its former part joins.
    const ring=cleanRing(room.poly),outer=inset(ring,wallThickness/2-wallOverlap),inner=inset(ring,wallThickness/2+projection);
    if(!validInset(outer)||!validInset(inner)||area(inner)>=area(outer))throw Error(`O perfil do rodateto não cabe em ${room.name||room.id}.`);
    footprintArea+=area(outer)-area(inner);
    for(let i=0;i<ring.length;i++){
      const j=(i+1)%ring.length;
      const a=point(outer[i],top-height),b=point(outer[j],top-height),c=point(inner[j],top-height),d=point(inner[i],top-height);
      // Embed the closed cap slightly above the ceiling plane. Coincident
      // opposing ceiling/cap faces contaminated the old contact light bake.
      const aa=point(outer[i],top+ceilingOverlap),bb=point(outer[j],top+ceilingOverlap),cc=point(inner[j],top+ceilingOverlap),dd=point(inner[i],top+ceilingOverlap);
      // Flat mitered quads share their complete edges: closed joints without
      // overlapping boxes, bevel fragments or T-junctions in triangulated caps.
      quad(a,b,c,d);quad(aa,dd,cc,bb);quad(a,aa,bb,b);quad(d,c,cc,dd);
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.name=NAME;
  for(const [key,data,size]of [['position',positions,3],['normal',normals,3],['uv',uv,2]])geometry.setAttribute(key,new THREE.Float32BufferAttribute(data,size));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return {geometry,footprintArea};
}
function faceArea(geometry){
  const p=geometry.attributes.position,index=geometry.index;let footprintArea=0;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<(index?.count??p.count);i+=3){
    a.fromBufferAttribute(p,index?index.getX(i):i);b.fromBufferAttribute(p,index?index.getX(i+1):i+1);c.fromBufferAttribute(p,index?index.getX(i+2):i+2);
    const cross=b.sub(a).cross(c.sub(a));if(cross.y>EPS)footprintArea+=cross.y/2;
  }
  return footprintArea;
}

// Install before cloning the authoring scene and before createPlanCutaway.
// A newly exported frozen cornice is retained with its approved RGBM/UV1.
// Old source resources keep their existing disposal owner when detached.
export function installCornice({scene,layout,own=value=>value,baked=[],height=.05,projection=.02,wallThickness=.13,ceilingOverlap=.004,wallOverlap=.003,color='#f4f2ee'}){
  if(!scene||!layout?.rooms?.length||![layout.pd,height,projection,wallThickness,ceilingOverlap,wallOverlap].every(Number.isFinite)||height<=0||height>=layout.pd||projection<=0||wallThickness<=0||ceilingOverlap<=0||wallOverlap<0||wallOverlap>=wallThickness/2)throw Error('Perfil do rodateto inválido.');
  const current=[],legacy=[];
  scene.traverse(mesh=>{
    if(!mesh.isMesh)return;
    if(mesh.name===NAME||mesh.name.startsWith(NAME+':'))current.push(mesh);
    else if(mesh.name==='rodateto'||mesh.name==='rodateto-unido'||mesh.geometry?.name==='rodateto-unido')legacy.push(mesh);
  });
  let meshes=current,footprintArea;
  if(current.length)footprintArea=current.reduce((sum,mesh)=>sum+faceArea(mesh.geometry),0);
  else {
    const generated=geometryForRooms(layout.rooms,{top:layout.pd,height,projection,wallThickness,ceilingOverlap,wallOverlap});footprintArea=generated.footprintArea;
    const material=own(new THREE.MeshStandardMaterial({name:'gesso-rodateto-liso',color,roughness:.85,metalness:0,emissiveIntensity:0,side:THREE.FrontSide}));
    const mesh=new THREE.Mesh(own(generated.geometry),material);mesh.name=NAME;mesh.castShadow=mesh.receiveShadow=true;meshes=[mesh];scene.add(mesh);
  }
  for(const mesh of legacy){mesh.removeFromParent();for(let i=baked.length-1;i>=0;i--)if(baked[i].mesh===mesh)baked.splice(i,1);}
  for(const mesh of meshes)mesh.userData.livCornice=true;
  return {meshes,metrics:{reused:current.length>0,rooms:layout.rooms.length,replacedMeshes:legacy.length,
    triangles:meshes.reduce((sum,mesh)=>sum+(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3,0),
    height,projection,wallThickness,ceilingOverlap,wallOverlap,footprintArea}};
}
