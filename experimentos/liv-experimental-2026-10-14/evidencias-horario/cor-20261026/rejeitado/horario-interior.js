import * as THREE from 'three/webgpu';
import {solarState,unitSolarContext,interiorSunDirection,facadeExposure} from './horario-solar.js';
import {inside} from './interior-navigation.js';

export function interiorTimeState(hour,unitContext,{date}={}){
  const input=unitContext||{side:'estacionamento'};
  const context=unitSolarContext({...input,id:input.unitId??input.id});
  if(input.yaw!==undefined){
    if(!Number.isFinite(input.yaw))throw new RangeError('Rotação da unidade inválida.');
    context.yaw=input.yaw;
  }
  const solar=solarState(hour,{date});
  return {...solar,context,directionGlobal:[...solar.direction],direction:interiorSunDirection(solar.direction,context),
    facadeExposure:facadeExposure(solar.direction,context.side)};
}

function roomCenter(room){
  if(inside(room.poly,room.cx,room.cz))return [room.cx,room.cz];
  // Um centro médio de vértices pode cair fora de um ambiente em L.
  const xs=room.poly.map(p=>p[0]),zs=room.poly.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  const candidates=[];
  for(let x=minX+.1;x<maxX;x+=.15)for(let z=minZ+.1;z<maxZ;z+=.15)if(inside(room.poly,x,z))candidates.push([x,z]);
  candidates.sort((a,b)=>Math.hypot(a[0]-room.cx,a[1]-room.cz)-Math.hypot(b[0]-room.cx,b[1]-room.cz));
  return candidates[0]||room.poly[0];
}

/** Um único rig reutilizado em todo input; os recursos são liberados pelo own do renderer. */
export function createInteriorSolarLighting({scene,layout,own=value=>value,ceiling=[],environment=null,backgroundEnvironment=environment,environmentExposureEV=null}){
  if(environmentExposureEV!==null&&!Number.isFinite(environmentExposureEV))throw new RangeError('Exposição do ambiente importado inválida.');
  const objects=[],fixtures=[],spots=[],originals=[],roofShadows=[];
  const add=object=>{scene.add(object);objects.push(object);return object;};
  const oldEnvironment=scene.environment,oldEnvironmentIntensity=scene.environmentIntensity,oldBackground=scene.background;
  const oldBackgroundIntensity=scene.backgroundIntensity;
  const skyTexture=environment||own(new THREE.DataTexture(new Uint8Array([156,180,206,255,210,211,190,255,135,150,160,255,185,181,160,255]),2,2,THREE.RGBAFormat));
  if(!environment){skyTexture.colorSpace=THREE.SRGBColorSpace;skyTexture.mapping=THREE.EquirectangularReflectionMapping;skyTexture.needsUpdate=true;}
  scene.environment=skyTexture;
  const sky=add(own(new THREE.HemisphereLight(0xc8ddff,0x6e675f,0)));
  sky.name='Céu difuso LIV por horário';
  const sun=add(own(new THREE.DirectionalLight(0xffffff,0)));
  sun.name='Sol LIV por horário';sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
  const bounds=layout.bounds,radius=Math.hypot(bounds.x1-bounds.x0,bounds.z1-bounds.z0)/2+1;
  Object.assign(sun.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius,near:.1,far:50});
  sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.0003;sun.shadow.normalBias=.02;
  sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;sun.target.position.set(0,layout.pd/2,0);add(sun.target);

  const diffuser=own(new THREE.MeshStandardMaterial({name:'Difusor de plafon LIV por horário',color:0xf0f0ec,roughness:.72,
    emissive:0xffe0af,emissiveIntensity:0}));
  const existing=[];scene.updateMatrixWorld(true);
  scene.traverse(mesh=>{if(mesh.isMesh&&/^plafon(?:\b|-)/i.test(mesh.name))existing.push(mesh);});
  const used=new Set(),world=new THREE.Vector3();
  let fixtureGeometry;
  for(const room of layout.rooms){
    const center=roomCenter(room);
    const real=existing.filter(mesh=>{mesh.getWorldPosition(world);return !used.has(mesh)&&inside(room.poly,world.x,world.z);})
      .sort((a,b)=>a.getWorldPosition(new THREE.Vector3()).distanceToSquared(new THREE.Vector3(center[0],layout.pd,center[1]))-
        b.getWorldPosition(new THREE.Vector3()).distanceToSquared(new THREE.Vector3(center[0],layout.pd,center[1])))[0];
    let fixture=real;
    if(real){
      used.add(real);originals.push({mesh:real,material:real.material});real.material=diffuser;
      const p=real.getWorldPosition(new THREE.Vector3());center[0]=p.x;center[1]=p.z;
    }else{
      fixtureGeometry??=own(new THREE.CylinderGeometry(.13,.13,.035,24));
      fixture=add(new THREE.Mesh(fixtureGeometry,diffuser));fixture.name=`Plafon LIV · ${room.name}`;
      fixture.position.set(center[0],layout.pd-.045,center[1]);fixture.receiveShadow=true;ceiling.push(fixture);
    }
    fixture.userData.livSolarFixture=true;fixtures.push(fixture);
    // A fonte fica sob o difusor, e sua sombra usa as paredes reais do cômodo.
    const lamp=add(own(new THREE.SpotLight(0xffe4bd,0)));
    lamp.name=`Luz do plafon LIV · ${room.name}`;lamp.position.set(center[0],layout.pd-.18,center[1]);
    lamp.target.position.set(center[0],.02,center[1]);add(lamp.target);
    const reach=Math.max(...room.poly.map(p=>Math.hypot(p[0]-center[0],p[1]-center[1])));
    lamp.angle=Math.min(1.4,Math.atan2(reach,layout.pd-.2)+.16);lamp.penumbra=.8;lamp.decay=2;
    lamp.distance=Math.hypot(reach,layout.pd)+.75;lamp.castShadow=true;
    lamp.shadow.mapSize.set(512,512);lamp.shadow.camera.near=.04;lamp.shadow.camera.far=lamp.distance;
    lamp.shadow.bias=-.0005;lamp.shadow.normalBias=.025;lamp.shadow.radius=2;lamp.shadow.autoUpdate=false;lamp.shadow.needsUpdate=true;
    lamp.userData.livDayIntensity=24*Math.min(1.3,Math.max(.65,Math.sqrt(room.area/9)));
    spots.push(lamp);
  }
  // A planta oculta o teto apenas na apresentação; ele continua barrando o sol.
  const blockerMaterial=own(new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,side:THREE.DoubleSide}));
  for(const mesh of ceiling){
    if(mesh.name!=='forro-original')continue;
    const blocker=add(new THREE.Mesh(mesh.geometry,blockerMaterial));blocker.name='Teto oculto · sombra solar LIV';
    blocker.matrix.copy(mesh.matrixWorld);blocker.matrix.decompose(blocker.position,blocker.quaternion,blocker.scale);
    blocker.castShadow=true;blocker.userData.livSolarOccluder=true;roofShadows.push({mesh,blocker});
  }
  let current=null,disposed=false,presentationMode='planta3d';
  function syncPresentation(mode){
    if(mode)presentationMode=mode;
    for(const {mesh,blocker}of roofShadows)blocker.visible=!mesh.visible;
    scene.background=backgroundEnvironment&&presentationMode==='visita'?backgroundEnvironment:oldBackground;
    if(backgroundEnvironment)scene.backgroundIntensity=.005+.995*(current?.daylight??1);
  }
  function invalidateShadows(){sun.shadow.needsUpdate=true;for(const lamp of spots)lamp.shadow.needsUpdate=true;}
  return {sun,
    apply(time){
      if(disposed)return false;
      current=structuredClone(time);
      const direct=time.sunStrength;
      sun.position.fromArray(time.direction).multiplyScalar(20).add(sun.target.position);
      sun.intensity=3.2*direct;sun.color.setRGB(1,.78+.22*direct,.55+.45*direct);sun.shadow.needsUpdate=true;
      // A low diffuse floor approximates room bounce, which this real-time renderer does not trace.
      sky.intensity=environment?0:.18+.56*time.daylight;sky.color.setRGB(.58+.2*time.daylight,.7+.18*time.daylight,1);
      // Local probes are linear EV 0. Carry the approved source's exposure into
      // this indirect term; camera, dynamic sun and artificial lights stay unchanged.
      scene.environmentIntensity=environment&&environmentExposureEV!==null?2**environmentExposureEV*time.daylight:.06+.215*time.daylight;
      diffuser.emissiveIntensity=1.6*time.night;
      for(const lamp of spots)lamp.intensity=lamp.userData.livDayIntensity*time.night;
      syncPresentation();return true;
    },
    syncPresentation,invalidateShadows,
    getState(){return {time:current?structuredClone(current):null,sunIntensity:sun.intensity,skyIntensity:sky.intensity,
      environmentIntensity:scene.environmentIntensity,artificialIntensity:spots.reduce((sum,lamp)=>sum+lamp.intensity,0),
      fixtures:fixtures.length,existingFixtures:originals.length,spots:spots.length,spotShadowSize:512,
      shadowAutoUpdate:false,roofShadowBlockers:roofShadows.length,approximate:true};},
    dispose(){
      if(disposed)return;disposed=true;
      for(const {mesh,material}of originals)mesh.material=material;
      for(const object of objects)scene.remove(object);
      for(const fixture of fixtures)if(!used.has(fixture)){const index=ceiling.indexOf(fixture);if(index>=0)ceiling.splice(index,1);}
      scene.environment=oldEnvironment;scene.environmentIntensity=oldEnvironmentIntensity;
      scene.background=oldBackground;scene.backgroundIntensity=oldBackgroundIntensity;
    },
  };
}
