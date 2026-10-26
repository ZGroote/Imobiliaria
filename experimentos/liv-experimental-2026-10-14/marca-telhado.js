import * as THREE from 'three/webgpu';

/* Letreiro da Conecta na laje da torre (26/10), no lugar do selo do canto da página.
   Painel em pé sobre estrutura de aço, voltado para +z (lado da vista principal), na metade
   leste da cobertura (48,66 m), livre da caixa d'água (x -8..-5) e dos poços do meio.
   À noite a face acende como letreiro com luz por trás (setNight).
   ponytail: posição e medidas medidas nesta edição da maquete; outra torre pede medir a laje de novo. */
const CENTER=[10,3],WIDTH=15,DEPTH=.3,LIFT=1.2,TUBE=.2,GLOW=1.6;

function beam(from,to,size,material){
  const length=from.distanceTo(to),mesh=new THREE.Mesh(new THREE.BoxGeometry(size,size,length),material);
  mesh.position.copy(from).add(to).multiplyScalar(.5);mesh.lookAt(to);return mesh;
}

export async function addRoofLogo({scene,towerMeshes,url}){
  const ray=new THREE.Raycaster(new THREE.Vector3(CENTER[0],200,CENTER[1]),new THREE.Vector3(0,-1,0));
  const hit=ray.intersectObjects(towerMeshes,false)[0];
  if(!hit||Math.abs(hit.face.normal.y)<.99)throw Error('Laje da torre não encontrada para o letreiro.');
  const texture=await new THREE.TextureLoader().loadAsync(url.href);
  texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
  const height=WIDTH*texture.image.height/texture.image.width,floor=hit.point.y,[x,z]=CENTER;
  const steel=new THREE.MeshStandardMaterial({name:'Letreiro · aço',color:0x2d3236,metalness:.6,roughness:.45});
  const face=new THREE.MeshStandardMaterial({name:'Letreiro · face',map:texture,roughness:.55,emissive:0xffffff,emissiveMap:texture,emissiveIntensity:0});
  const group=new THREE.Group();group.name='Letreiro Conecta na cobertura';
  // Painel: face com o logo em +z, costas e laterais de chapa.
  const panel=new THREE.Mesh(new THREE.BoxGeometry(WIDTH,height,DEPTH),[steel,steel,steel,steel,face,steel]);
  const middle=floor+LIFT+height/2;panel.position.set(x,middle,z);group.add(panel);
  // Moldura saliente em volta da face.
  for(const [w,h,dx,dy]of [[WIDTH+.3,.15,0,height/2],[WIDTH+.3,.15,0,-height/2],[.15,height,WIDTH/2,0],[.15,height,-WIDTH/2,0]]){
    const rim=new THREE.Mesh(new THREE.BoxGeometry(w,h,DEPTH+.12),steel);rim.position.set(x+dx,middle+dy,z);group.add(rim);
  }
  // Quatro pilares atrás do painel, mão-francesa até a laje e chapa de base.
  const back=z-DEPTH/2-TUBE/2;
  for(const offset of [-.42,-.14,.14,.42]){
    const px=x+offset*WIDTH,top=floor+LIFT+height*.92;
    group.add(beam(new THREE.Vector3(px,floor,back),new THREE.Vector3(px,top,back),TUBE,steel));
    group.add(beam(new THREE.Vector3(px,floor+LIFT+height*.55,back),new THREE.Vector3(px,floor,back-2.4),TUBE*.8,steel));
    for(const foot of [back,back-2.4]){const plate=new THREE.Mesh(new THREE.BoxGeometry(.5,.08,.5),steel);plate.position.set(px,floor+.04,foot);group.add(plate);}
  }
  group.traverse(mesh=>{if(mesh.isMesh)mesh.castShadow=mesh.receiveShadow=true;});
  scene.add(group);
  return {name:group.name,group,setNight(night){face.emissiveIntensity=GLOW*Math.max(0,Math.min(1,night));}};
}
