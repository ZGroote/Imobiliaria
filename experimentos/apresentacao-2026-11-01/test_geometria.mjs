import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
import * as THREE from '../liv-experimental-2026-10-14/node_modules/three/build/three.webgpu.js';
import {createLayout,createNavigation} from './site/demo/interior-navigation.js';
import {ajustarFolhaAoBatente} from './interior-porta-fecho.js';

const read=name=>readFileSync(new URL(`./site/demo/${name}`,import.meta.url),'utf8');
globalThis.location={search:''};
vm.runInThisContext(read('interiores/shared/runtime.js'));
const context=vm.createContext({THREE,structuredClone});
vm.runInContext(read('interior-portas.js').replace(/^import .*;\r?\n/gm,'').replaceAll('export function','function'),context);
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<2e-6,`${message}: ${actual} ≠ ${expected}`);

function fixture(key){
  const unit=JSON.parse(read(`interiores/${key}/unidade.json`)),layout=createLayout(unit);
  const source=JSON.parse(gunzipSync(readFileSync(new URL(`./site/demo/interiores/${key}/source.json.gz`,import.meta.url))));
  const materials=Object.fromEntries(['m3','m4','m5'].map(id=>[id,new THREE.MeshStandardMaterial({side:THREE.DoubleSide})]));
  const rgb=hex=>{const color=new THREE.Color(hex);return [color.r,color.g,color.b].map(value=>Math.round(value*255));};
  const openings=globalThis.Openings.create({THREE,ESP:.13,rgbDe:rgb,matEsq:materials.m3,matAlum:materials.m4,matVidro:materials.m5});
  for(const mesh of openings.geoDasEsquadrias(layout.house))mesh.geometry.dispose();
  const scene=new THREE.Scene(),paint=[],alu=[],baked=[];
  for(const item of source.objects){
    if(!item.include||!['m3','m4'].includes(item.materials[0]))continue;
    const spec=source.geometries[item.geometry],geometry=new THREE.BufferGeometry();
    for(const [name,size]of [['position',3],['normal',3],['uv',2],['color',3]])if(spec[name]?.length)geometry.setAttribute(name,new THREE.Float32BufferAttribute(spec[name],size));
    if(spec.index)geometry.setIndex(spec.index);
    const mesh=new THREE.Mesh(geometry,materials[item.materials[0]]);mesh.name=item.name;
    mesh.matrix.fromArray(item.matrix);mesh.matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);scene.add(mesh);
    (item.materials[0]==='m3'?paint:alu).push(mesh);
    const target={mesh,originalGeometry:geometry,geometry:geometry.clone()};baked.push(target);mesh.geometry=target.geometry;
  }
  const before=baked.map(target=>target.geometry.attributes.position.count);
  const controller=context.createDoors({scene,layout,paint,alu,baked,doorColor:new THREE.Color(unit.cores?.porta??0xEDE7DD)});
  assert.deepEqual(Array.from(controller.skipped),[]);
  return {scene,layout,controller,baked,before};
}

function bounds(door){
  const position=door.group.children[0].geometry.attributes.position,u=[Math.cos(door.openAngle),Math.sin(door.openAngle)];
  const points=Array.from({length:position.count},(_,i)=>[position.getX(i)*u[0]+position.getZ(i)*u[1],position.getY(i),-position.getX(i)*u[1]+position.getZ(i)*u[0]]);
  return [0,1,2].map(axis=>[Math.min(...points.map(point=>point[axis])),Math.max(...points.map(point=>point[axis]))]);
}

function crossingRay(door,along,y){
  const closed=door.v.eixo?[-door.v.ux,-door.v.uz]:[door.v.ux,door.v.uz];
  const normal=[door.v.nx*door.v.lado,door.v.nz*door.v.lado];
  return new THREE.Raycaster(new THREE.Vector3(door.group.position.x+closed[0]*along+normal[0]*.5,y,
    door.group.position.z+closed[1]*along+normal[1]*.5),new THREE.Vector3(-normal[0],0,-normal[1]),0,1);
}

for(const key of ['canto','meio'])test(`${key}: snapshots reais fecham trinco e travessa com madeira, conservando ferragem e giro`,()=>{
  const {scene,layout,controller,baked,before}=fixture(key);
  assert.equal(controller.doors.length,key==='canto'?5:4);
  const sceneObjects=[];scene.traverse(object=>sceneObjects.push(object));
  for(const door of controller.doors){
    const [along,y,thickness]=bounds(door),leaf=door.group.children[0],handles=door.group.children.slice(1);
    near(door.v.L-.03-along[1],.025,'Fresta original no trinco medida na fonte');
    near(door.v.y1-.03-y[1],.008,'Fresta original sob a travessa medida na fonte');
    const handleVertices=handles.map(part=>Array.from(part.geometry.attributes.position.array));
    const hinge=door.group.position.clone(),angle=door.openAngle,rotation=door.group.rotation.y;
    const normals=Array.from(leaf.geometry.attributes.normal.array),colors=Array.from(leaf.geometry.attributes.color.array);
    controller.setOpen(door.id,false,{instant:true});scene.updateMatrixWorld(true);
    const latchRay=crossingRay(door,along[1]+.01,1.4),headerRay=crossingRay(door,door.v.L/2,y[1]+.004);
    assert.equal(latchRay.intersectObject(leaf).length,0);assert.equal(headerRay.intersectObject(leaf).length,0);
    controller.setOpen(door.id,true,{instant:true});
    const report=ajustarFolhaAoBatente(door),[fitted,fittedY,fittedThickness]=bounds(door);
    near(report.addedWidth,.04,'Madeira acrescentada no trinco');near(report.addedHeight,.023,'Madeira acrescentada no topo');
    near(.03-fitted[0],.015,'Sobreposição da dobradiça');near(fitted[1]-(door.v.L-.03),.015,'Sobreposição do trinco');
    near(fittedY[1]-(door.v.y1-.03),.015,'Sobreposição superior');near(fittedY[0],y[0],'Pé da folha preservado');
    near(fittedThickness[0],thickness[0],'Face interna preservada');near(fittedThickness[1],thickness[1],'Face externa preservada');
    assert.deepEqual(Array.from(leaf.geometry.attributes.normal.array),normals);assert.deepEqual(Array.from(leaf.geometry.attributes.color.array),colors);
    assert.deepEqual(door.group.position.toArray(),hinge.toArray());assert.equal(door.openAngle,angle);near(door.group.rotation.y,rotation,'Giro preservado');
    const u=[Math.cos(angle),Math.sin(angle)];
    for(const [partIndex,part]of handles.entries())for(let i=0;i<part.geometry.attributes.position.count;i++){
      const position=part.geometry.attributes.position,old=handleVertices[partIndex];
      near(position.getX(i),old[i*3]+u[0]*report.handleShift,'Ferragem transladada, sem escala X');
      near(position.getY(i),old[i*3+1],'Altura da ferragem preservada');
      near(position.getZ(i),old[i*3+2]+u[1]*report.handleShift,'Ferragem transladada, sem escala Z');
    }
    near(door.v.folha.larg,fitted[1],'Colisão chega à nova borda');
    controller.setOpen(door.id,false,{instant:true});scene.updateMatrixWorld(true);
    assert.equal(latchRay.intersectObject(leaf)[0]?.object,leaf,'A própria folha fecha a antiga fresta lateral');
    assert.equal(headerRay.intersectObject(leaf)[0]?.object,leaf,'A própria folha fecha a antiga fresta superior');
    near(door.v.folha.dx,door.v.eixo?-door.v.ux:door.v.ux,'Colisão fechada acompanha eixo X');
    near(door.v.folha.dz,door.v.eixo?-door.v.uz:door.v.uz,'Colisão fechada acompanha eixo Z');
    controller.setOpen(door.id,true);for(let i=0;i<60;i++)controller.update(1/60);scene.updateMatrixWorld(true);
    near(door.group.rotation.y,0,'Abertura original restaurada');near(door.v.folha.dx,u[0],'Colisão aberta acompanha fonte X');near(door.v.folha.dz,u[1],'Colisão aberta acompanha fonte Z');
    assert.equal(latchRay.intersectObject(leaf).length,0,'O antigo vão fica livre quando a porta abre');
    assert.equal(ajustarFolhaAoBatente(door),report,'Retomar a cena não alonga a porta novamente');
  }
  const afterObjects=[];scene.traverse(object=>afterObjects.push(object));assert.deepEqual(afterObjects,sceneObjects,'Nenhuma superfície adicional tampa a luz');
  for(const [i,target]of baked.entries()){
    const count=target.originalGeometry.attributes.position.count;
    assert.equal(count,target.geometry.attributes.position.count,'Versões original e baked perdem as mesmas folhas');
    assert.equal(count,before[i]-controller.doors.length*(target.mesh.material===controller.doors[0].group.children[0].material?36:144));
    assert.ok(controller.doors.every(door=>door.group.children.every(part=>part.geometry!==target.geometry&&part.geometry!==target.originalGeometry)));
  }
  const suite=controller.doors.find(door=>door.id==='a1'),navigation=createNavigation(layout);
  controller.setOpen(suite.id,false,{instant:true});assert.equal(navigation.free(...suite.center),false,'Folha fechada bloqueia a passagem');
  controller.setOpen(suite.id,true,{instant:true});assert.equal(navigation.free(...suite.center),true,'Folha aberta libera a passagem da suíte');
});
