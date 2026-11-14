import * as THREE from 'three/webgpu';
import {solarState} from './horario-solar.js';
import {setRGBMTimeLighting} from './material-rgbm.js';

export function exteriorTimeLighting({scene,renderer,materials,data,shadowLights,invalidateShadows}) {
  const lights=[];scene.traverse(object=>{if(object.isLight)lights.push(object);});
  const sun=shadowLights.find(light=>light.isDirectionalLight)||lights.find(light=>light.isDirectionalLight);
  const center=new THREE.Vector3().fromArray(data.visibleBounds.min).add(new THREE.Vector3().fromArray(data.visibleBounds.max)).multiplyScalar(.5);
  const direction=new THREE.Vector3(),warm=new THREE.Color('#ffb36c'),white=new THREE.Color('#fff5e3');
  const nightSky=new THREE.Color('#070e20'),daySky=new THREE.Color('#a6c6da'),twilightSky=new THREE.Color('#8f767e');
  const fixtures=materials.filter((material,index)=>/luz-varanda/i.test(data.materials[index]?.name||material.name));
  const windows=materials.filter((material,index)=>(data.materials[index]?.name||material.name)==='MAT-vidro');
  let current;
  return {
    setTime(hour,options={}) {
      current=solarState(hour,options);
      const {daylight,night,sunStrength}=current;
      direction.fromArray(current.direction);
      for(const light of lights) {
        if(light===sun) {
          light.position.copy(center).addScaledVector(direction,180);light.target.position.copy(center);
          light.color.copy(warm).lerp(white,sunStrength);light.intensity=3.1*sunStrength;
        }else if(light.isHemisphereLight) {
          light.color.set('#c4d9f2');light.groundColor.set('#57564d');light.intensity=.85*daylight+.16*night;
        }else light.intensity=0;
      }
      scene.background=nightSky.clone().lerp(twilightSky,Math.sin(daylight*Math.PI)*.7).lerp(daySky,daylight*daylight);
      scene.environmentIntensity=.42*daylight+.06*night;
      renderer.toneMappingExposure=1;
      // Disable the frozen sun/shadows entirely. Hemisphere irradiance supplies the dynamic sky.
      setRGBMTimeLighting({bake:0,direct:1});
      for(const material of fixtures) {
        material.emissive.set('#ffd29a');material.emissiveIntensity=2.4*night;
      }
      // The exterior has no room volumes; this dim glow represents light behind existing windows.
      for(const material of windows){material.emissive.set('#ffd29a');material.emissiveIntensity=.32*night;}
      invalidateShadows();
      return current;
    },
    getState:()=>current,
  };
}
