import * as THREE from 'three/webgpu';

/* Folheado de nogueira dos guarda-roupas e armários (m12), no lugar da textura de 256 px tingida de cinza.
   Natural Walnut Veneer, Poly Haven (CC0): https://polyhaven.com/a/natural_walnut_veneer
   A tinta reproduz o albedo médio da madeira aprovada no LIV_Luz_Natural.blend (textura do SketchUp
   com saturação 0,65 e multiplicação por 0.85/0.78/0.60), mantendo veio, relevo e brilho da nogueira. */
export const NOGUEIRA={
  color:{path:'interiores/shared/folheado-nogueira/color.webp',bytes:98272,sha256:'3b87b5de2160194af6a4089b889c36ca97f9ff2669c732f13ad85b6fc94912ed'},
  normal:{path:'interiores/shared/folheado-nogueira/normal.webp',bytes:163716,sha256:'86397b1f20076ef070ab096306e423adc633ac9400175f3cc57eafe0fc55d8f5'},
  roughness:{path:'interiores/shared/folheado-nogueira/roughness.webp',bytes:122646,sha256:'20656d87153e9042d72ada8ec41b73a2884fbf7ea0e3f3d53959e0ac65d2d2d4'},
  tint:[.642,.392,.276],
};

/** As UVs dos móveis estão em metros e a nogueira cobre 1 m; o veio sobe na vertical. */
export async function applyVeneer(materials,{load,own=value=>value,onBitmap=()=>{}}){
  const maps={};
  for(const [field,file]of Object.entries({map:NOGUEIRA.color,normalMap:NOGUEIRA.normal,roughnessMap:NOGUEIRA.roughness})){
    const bitmap=await createImageBitmap(new Blob([await load(file)],{type:'image/webp'}),{colorSpaceConversion:'none'});onBitmap(bitmap);
    const texture=own(new THREE.Texture(bitmap));texture.flipY=false;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.colorSpace=field==='map'?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.center.set(.5,.5);texture.rotation=Math.PI/2;
    texture.anisotropy=8;texture.needsUpdate=true;maps[field]=texture;
  }
  // Um material ou vários (o Meio tem dois guarda-roupas): os mesmos mapas para todos.
  for(const material of [materials].flat()){
    Object.assign(material,maps,{vertexColors:false,roughness:1,metalness:0});material.color.setRGB(...NOGUEIRA.tint);
    material.userData.livVeneer=true;material.needsUpdate=true;
  }
  return materials;
}
