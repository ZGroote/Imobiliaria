import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from '../node_modules/three/build/three.webgpu.js';
import {createInteriorSolarLighting,interiorTimeState} from '../horario-interior.js';
import {inside,shoelace} from '../interior-navigation.js';

const base=new URL('../',import.meta.url),date='2026-10-26';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} ≈ ${b}`);

test('o World importado aparece no Tour e é preservado ao voltar à planta e descartar o rig',()=>{
  const scene=new THREE.Scene(),backdrop=new THREE.Color('#101820');scene.background=backdrop;
  const environment=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1),owned=new Set();
  let disposed=false;environment.addEventListener('dispose',()=>{disposed=true;});
  const rig=createInteriorSolarLighting({scene,layout:actualLayout('meio'),environment,own:value=>{owned.add(value);return value;}});
  assert.equal(scene.environment,environment);
  rig.apply(interiorTimeState(12,{side:'lazer'},{date}));rig.syncPresentation('visita');
  assert.equal(scene.background,environment);assert.equal(scene.backgroundIntensity,1);
  assert.equal(rig.getState().skyIntensity,0,'World importado substitui o céu sintético, sem somar uma segunda fonte.');
  rig.apply(interiorTimeState(0,{side:'lazer'},{date}));assert.equal(scene.backgroundIntensity,.005);
  rig.syncPresentation('planta3d');assert.equal(scene.background,backdrop);
  rig.dispose();assert.equal(scene.background,backdrop);assert.equal(scene.environment,null);assert.equal(disposed,false);
  for(const resource of owned)resource.dispose?.();environment.dispose();
});

test('a luz indireta local usa o probe da sala e o fundo continua sendo o céu externo',()=>{
  const scene=new THREE.Scene(),environment=new THREE.DataTexture(),backgroundEnvironment=new THREE.DataTexture();
  const owned=new Set(),rig=createInteriorSolarLighting({scene,layout:actualLayout('meio'),environment,backgroundEnvironment,environmentExposureEV:3,own:value=>{owned.add(value);return value;}});
  rig.apply(interiorTimeState(12,{side:'lazer'},{date}));rig.syncPresentation('visita');
  assert.equal(scene.environment,environment);assert.equal(scene.background,backgroundEnvironment);
  assert.equal(scene.environmentIntensity,8,'Probe linear transfere os 3 EV da fonte aprovada apenas ao termo indireto.');
  assert.equal(scene.backgroundIntensity,8,'O céu visto pela janela recebe a mesma exposição da câmera aprovada.');
  rig.syncPresentation('planta3d');assert.equal(scene.environment,environment);assert.equal(scene.background,null);
  rig.apply(interiorTimeState(0,{side:'lazer'},{date}));assert.equal(scene.environmentIntensity,0);
  rig.dispose();assert.equal(scene.environment,null);assert.equal(scene.background,null);
  for(const resource of owned)resource.dispose?.();environment.dispose();backgroundEnvironment.dispose();
});

function actualLayout(typology){
  const unit=JSON.parse(readFileSync(new URL(`interiores/${typology}/unidade.json`,base)));
  const points=unit.planta.comodos.flatMap(room=>room.poly);
  const min=[0,1].map(axis=>Math.min(...points.map(p=>p[axis]))),max=[0,1].map(axis=>Math.max(...points.map(p=>p[axis])));
  const center=min.map((value,axis)=>(value+max[axis])/2);
  const rooms=unit.planta.comodos.map(room=>{
    const poly=room.poly.map(p=>p.map((v,i)=>v-center[i]));
    return {name:room.nome,poly,cx:poly.reduce((sum,p)=>sum+p[0],0)/poly.length,cz:poly.reduce((sum,p)=>sum+p[1],0)/poly.length,area:Math.abs(shoelace(poly))/2};
  });
  return {pd:unit.planta.pe_direito||2.7,rooms,bounds:{x0:min[0]-center[0],x1:max[0]-center[0],z0:min[1]-center[1],z1:max[1]-center[1]}};
}

test('contexto por unidade mantém o sol global e gira180° entre fachadas',()=>{
  const parking=interiorTimeState(9,{id:'p02-f01',side:'estacionamento'},{date});
  const leisure=interiorTimeState(9,{id:'p08-f02',side:'lazer'},{date});
  assert.deepEqual(parking.directionGlobal,leisure.directionGlobal);
  near(parking.direction[0],-leisure.direction[0]);near(parking.direction[1],leisure.direction[1]);near(parking.direction[2],-leisure.direction[2]);
  assert.equal(parking.context.floorIndex,2);assert.equal(leisure.context.floorIndex,8);
  assert.ok(leisure.facadeExposure>parking.facadeExposure);
  assert.deepEqual(interiorTimeState(9,leisure.context,{date}),leisure);
  assert.throws(()=>interiorTimeState(9,{side:'lazer',yaw:NaN},{date}),RangeError);
});

for(const typology of ['canto','meio'])test(`${typology}: plafons motivam spots estáticos, reversíveis e sem alocar em cada input`,()=>{
  const layout=actualLayout(typology),scene=new THREE.Scene(),owned=new Set(),ceiling=[];
  const originalFixtureMaterials=[];
  if(typology==='canto'){
    const source=JSON.parse(gunzipSync(readFileSync(new URL('interiores/canto/source.json.gz',base))));
    for(const object of source.objects.filter(object=>object.name==='plafon')){
      const material=new THREE.MeshBasicMaterial({color:0xffedbf});originalFixtureMaterials.push(material);
      const fixture=new THREE.Mesh(new THREE.CylinderGeometry(.115,.115,.04,8),material);
      fixture.name=object.name;fixture.matrix.fromArray(object.matrix);fixture.matrix.decompose(fixture.position,fixture.quaternion,fixture.scale);
      scene.add(fixture);ceiling.push(fixture);
    }
    assert.equal(originalFixtureMaterials.length,6);
  }
  const roof=new THREE.Mesh(new THREE.BoxGeometry(10,.08,7),new THREE.MeshStandardMaterial());
  roof.name='forro-original';roof.position.y=layout.pd;scene.add(roof);ceiling.push(roof);
  const baseline=scene.children.length;
  const rig=createInteriorSolarLighting({scene,layout,ceiling,own:value=>{owned.add(value);return value;}});
  const count=scene.children.length,resources=owned.size;
  const spots=scene.children.filter(object=>object.isSpotLight),fixtures=[];
  scene.traverse(object=>{if(object.userData.livSolarFixture)fixtures.push(object);});
  assert.equal(spots.length,6);assert.equal(fixtures.length,6);
  assert.equal(scene.children.filter(object=>object.isPointLight).length,0);
  assert.equal(scene.children.filter(object=>object.isDirectionalLight).length,1);
  assert.equal(rig.getState().existingFixtures,typology==='canto'?6:0);
  for(const [index,spot]of spots.entries()){
    assert.equal(spot.castShadow,true);assert.equal(spot.shadow.autoUpdate,false);
    assert.deepEqual(spot.shadow.mapSize.toArray(),[512,512]);
    assert.ok(inside(layout.rooms[index].poly,spot.position.x,spot.position.z));
    assert.ok(spot.position.y<fixtures[index].position.y);
    near(spot.position.x,spot.target.position.x);near(spot.position.z,spot.target.position.z);
  }
  const noon=interiorTimeState(12,{side:'estacionamento'},{date});
  rig.apply(noon);const day=rig.getState();
  assert.equal(day.artificialIntensity,0);assert.ok(day.sunIntensity>0);
  for(const fixture of fixtures){assert.equal(fixture.material.isMeshStandardMaterial,true);assert.equal(fixture.material.emissiveIntensity,0);}
  const night=interiorTimeState(0,{side:'lazer'},{date});rig.apply(night);
  assert.equal(rig.getState().sunIntensity,0);assert.ok(rig.getState().artificialIntensity>0);
  for(const fixture of fixtures)assert.equal(fixture.material.emissiveIntensity,1.6);
  for(const spot of spots)spot.shadow.needsUpdate=false;
  rig.apply(interiorTimeState(1,{side:'lazer'},{date}));
  assert.ok(spots.every(spot=>!spot.shadow.needsUpdate),'Mudar hora não recalcula sombras estáticas dos plafons.');
  rig.invalidateShadows();assert.ok(spots.every(spot=>spot.shadow.needsUpdate));
  roof.visible=false;rig.syncPresentation();
  const blocker=scene.children.find(object=>object.userData.livSolarOccluder);
  assert.equal(blocker.visible,true);assert.equal(blocker.castShadow,true);assert.equal(blocker.material.colorWrite,false);
  roof.visible=true;rig.syncPresentation();assert.equal(blocker.visible,true,'O bloqueador fica acima do forro e vale também no Tour.');
  assert.ok(blocker.position.y>=roof.position.y+.08-1e-9,'Topo das paredes e da moldura ficam sob o bloqueador.');
  for(let minute=0;minute<=1440;minute++)rig.apply(interiorTimeState(minute/60,{side:'estacionamento'},{date}));
  assert.equal(scene.children.length,count);assert.equal(owned.size,resources);
  rig.apply(noon);assert.deepEqual(rig.getState(),day);
  rig.dispose();rig.dispose();assert.equal(scene.children.length,baseline);assert.equal(scene.environment,null);
  if(typology==='canto')for(const [index,fixture]of fixtures.entries())assert.equal(fixture.material,originalFixtureMaterials[index]);
  for(const resource of owned)resource.dispose?.();
  for(const fixture of fixtures)if(typology==='canto'){fixture.geometry.dispose();fixture.material.dispose();}
  roof.geometry.dispose();roof.material.dispose();
});
