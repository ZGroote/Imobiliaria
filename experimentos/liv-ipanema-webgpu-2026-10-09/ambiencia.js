import * as THREE from 'three/webgpu';

import {AMBIENCES} from './ambiencia-perfis.js';
export {AMBIENCES,requestedAmbience} from './ambiencia-perfis.js';

/** Art direction over stock uniforms; one geometry, atlas and static shadow set.
 * The sunset uses the day bake. It is not a solar/time-of-day simulation.
 * Never replace an imported material or make a shader per material for this.
 */
export function exteriorAmbience({renderer,scene,materials,stage,preserveBackdrop=false}){
  const exposure=renderer.toneMappingExposure,background=scene.background,css=stage.style.background;
  const originals=[...new Set(materials)].map(material=>({material,color:material.color?.clone(),reflection:material.envMapIntensity}));
  const lights=[];scene.traverse(object=>{if(object.isLight)lights.push({light:object,color:object.color.clone(),intensity:object.intensity,ground:object.groundColor?.clone()});});
  const sunsetColor=new THREE.Color('#dec5ae');
  let profile='dia',disposed=false;
  function setProfile(key){
    if(!Object.hasOwn(AMBIENCES,key))throw Error('Ambiência inválida.');
    if(disposed)return false;
    const settings=AMBIENCES[key];
    renderer.toneMappingExposure=exposure*settings.exposure;
    const tint=new THREE.Color().fromArray(settings.color),lightTint=new THREE.Color().fromArray(settings.lightColor);
    for(const {material,color,reflection} of originals){
      if(color)material.color.copy(color).multiply(tint);
      if(Number.isFinite(reflection))material.envMapIntensity=reflection*settings.reflection;
    }
    for(const {light,color,intensity,ground} of lights){
      light.color.copy(color).multiply(lightTint);light.intensity=intensity*settings.lightIntensity;
      if(ground)light.groundColor.copy(ground).multiply(lightTint);
    }
    scene.background=preserveBackdrop||key==='dia'?background:sunsetColor;
    stage.style.background=preserveBackdrop||key==='dia'?css:'#dec5ae';
    profile=key;return true;
  }
  return {setProfile,getState:()=>({profile,illustrative:profile==='entardecer',sameAtlas:true}),
    dispose(){if(disposed)return;setProfile('dia');disposed=true;originals.length=0;lights.length=0;}};
}
