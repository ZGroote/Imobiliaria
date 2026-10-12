import * as THREE from 'three/webgpu';

// A presentation cut only. Use the same wall axes, end trims and thickness as
// the native house; door/window voids stay empty at the section height.
export function wallCaps(layout,height,thickness=.13){
  const positions=[],normals=[],colors=[],uv=[];
  const color=new THREE.Color(layout.unit.cores?.parede||'#eee7d9').toArray().map(c=>Math.round(c*255)/255);
  for(const wall of layout.walls){
    if(wall.y0>=height||wall.y1<=height)continue;
    const dx=wall.b[0]-wall.a[0],dz=wall.b[1]-wall.a[1],length=Math.hypot(dx,dz);
    if(length<1e-8)continue;
    const ux=dx/length,uz=dz/length,nx=-uz*thickness/2,nz=ux*thickness/2;
    const ea=wall.remateA??(wall.pa?0:thickness/2),eb=wall.remateB??(wall.pb?0:thickness/2);
    const a=[wall.a[0]-ux*ea,wall.a[1]-uz*ea],b=[wall.b[0]+ux*eb,wall.b[1]+uz*eb];
    const q=[[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]];
    for(const i of [0,1,2,0,2,3]){
      positions.push(q[i][0],height,q[i][1]);normals.push(0,1,0);colors.push(...color);uv.push(...q[i]);
    }
  }
  const geometry=new THREE.BufferGeometry();
  for(const [name,data,size] of [['position',positions,3],['normal',normals,3],['color',colors,3],['uv',uv,2]])
    geometry.setAttribute(name,new THREE.Float32BufferAttribute(data,size));
  geometry.computeBoundingSphere();return geometry;
}

export function createPlanCutaway({scene,layout,architecture,wallMaterial,own,height=1.2}){
  scene.updateMatrixWorld(true);
  const group=new THREE.ClippingGroup();group.name='Corte da Planta 3D';
  group.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,-1,0),height)];
  // The bake and the frozen sun shadow describe the complete apartment.
  // Keep that transport independent of a display cut and of the orbit camera.
  group.clipShadows=false;group.enabled=false;scene.add(group);
  const ceiling=[],bounds=new THREE.Box3();
  for(const mesh of architecture){
    bounds.setFromObject(mesh);
    if(!mesh.userData.livWallTop&&(mesh.name==='forro-original'||bounds.min.y>=layout.pd-.25))ceiling.push(mesh);
    else if(bounds.max.y>height)group.attach(mesh);
  }
  const caps=new THREE.Mesh(own(wallCaps(layout,height)),wallMaterial);
  caps.name='Topo do corte das paredes';caps.userData.livPresentation=true;
  caps.castShadow=false;caps.receiveShadow=true;caps.visible=false;scene.add(caps);
  let mode='visita',enabled=false;
  function update(){
    group.enabled=mode==='planta3d'&&enabled;caps.visible=group.enabled;
    for(const mesh of ceiling)mesh.visible=mode==='visita';
  }
  return {ceiling,
    setMode(value){mode=value;update();},
    setEnabled(value){enabled=value;update();},
    getState(){return {enabled,active:group.enabled,height,objects:group.children.length,
      capTriangles:caps.geometry.attributes.position.count/3,clipShadows:group.clipShadows};}
  };
}
