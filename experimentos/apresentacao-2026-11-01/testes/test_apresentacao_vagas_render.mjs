import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as THREE from '../../liv-experimental-2026-10-14/node_modules/three/build/three.webgpu.js';
import {EXTERIOR_EDITIONS} from '../site/demo/edicoes.js';

const demo=new URL('../site/demo/',import.meta.url);
const read=name=>readFileSync(new URL(name,demo),'utf8');
const spaces=JSON.parse(read('modelo/entrada/candidato/vagas.json'));
const plain=value=>JSON.parse(JSON.stringify(value));

function parkingModule(){
  let now=0;
  const code=read('vagas.js').replace(/^import .*;\r?\n/gm,'').replaceAll('export function','function');
  const api=vm.runInNewContext(code+'\n({createParkingHighlight,validarVagas})',{THREE,performance:{now:()=>now}});
  return {...api,setTime:value=>{now=value;}};
}

test('selecting G01 highlights its real parking position; G02 replaces it and clearing removes the glow',()=>{
  const {createParkingHighlight}=parkingModule(),scene=new THREE.Scene();
  const parking=createParkingHighlight(scene,spaces);
  assert.equal(parking.group.visible,false);
  assert.deepEqual(plain(parking.setSpaces([1])),[1]);
  const [volume,outline]=parking.group.children,position=spaces.vagas.find(v=>v.numero===1);
  assert.equal(parking.group.visible,true);
  assert.equal(volume.isMesh,true);assert.equal(outline.isLineSegments,true);
  assert.equal(volume.name,'Vaga 1');
  for(const object of [volume,outline]){
    assert.equal(object.position.x,position.x);assert.equal(object.position.z,position.z);
    assert.equal(object.renderOrder,2,'The parking highlight must render after the apartment overlays.');
  }
  const bounds=new THREE.Box3().setFromObject(volume),size=bounds.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x-(position.sentido==='z'?position.largura:position.comprimento))<1e-9);
  assert.ok(Math.abs(size.z-(position.sentido==='z'?position.comprimento:position.largura))<1e-9);
  assert.ok(bounds.max.y>1.8,'The glow must extend above a parked car, rather than disappearing under it.');
  assert.equal(volume.material.transparent,true);assert.equal(volume.material.depthWrite,false);
  assert.equal(volume.material.toneMapped,false);
  assert.equal(outline.material.color.getHex(),0xffffff);

  assert.deepEqual(plain(parking.setSpaces([2])),[2]);
  assert.equal(volume.parent,null);assert.equal(outline.parent,null);
  assert.equal(parking.group.children.length,2);
  assert.equal(parking.group.children[0].name,'Vaga 2');
  assert.equal(parking.group.children[0].position.x,spaces.vagas.find(v=>v.numero===2).x);
  assert.deepEqual(plain(parking.setSpaces([])),[]);
  assert.equal(parking.group.visible,false);assert.equal(parking.group.children.length,0);
  parking.dispose();
});

test('invalid parking numbers do not highlight unrelated spaces, while duplicate valid numbers share one volume',()=>{
  const {createParkingHighlight}=parkingModule(),scene=new THREE.Scene();
  const parking=createParkingHighlight(scene,spaces);
  assert.deepEqual(plain(parking.setSpaces([0,176,-1,1.5,'1',null,undefined,NaN])),[]);
  assert.equal(parking.group.visible,false);assert.equal(parking.group.children.length,0);
  assert.deepEqual(plain(parking.setSpaces([2,1,2,1])),[1,2]);
  assert.deepEqual(parking.group.children.filter(child=>child.isMesh).map(child=>child.name),['Vaga 1','Vaga 2']);
  parking.dispose();
});

test('parking volumes visibly pulse and disposing detaches the glow and releases its shared GPU resources',()=>{
  const module=parkingModule(),scene=new THREE.Scene(),parking=module.createParkingHighlight(scene,spaces);
  parking.setSpaces([1,2]);
  const [volume,outline]=parking.group.children,opacities=[];
  for(const time of [300,900]){
    module.setTime(time);volume.onBeforeRender();
    opacities.push({fill:volume.material.opacity,line:outline.material.opacity});
  }
  assert.ok(opacities[0].fill-opacities[1].fill>.39);
  assert.ok(opacities[0].line-opacities[1].line>.39);
  assert.ok(opacities.every(value=>value.fill>=.55-1e-12&&value.fill<=.95+1e-12&&value.line>=.6-1e-12&&value.line<=1+1e-12));
  const released=new Set();
  for(const [name,resource] of [['volume',volume.geometry],['edges',outline.geometry],['fill',volume.material],['line',outline.material]])
    resource.addEventListener('dispose',()=>released.add(name));
  parking.dispose();
  assert.equal(scene.children.includes(parking.group),false);
  assert.equal(parking.group.children.length,0);
  assert.deepEqual([...released].sort(),['edges','fill','line','volume']);
});

function pendingRenderer(){
  const source=read('renderer.js');
  const begin=source.indexOf("  if(geometryProfile==='entrada')fetch("),end=source.indexOf('  function setUnitView(',begin);
  assert.ok(begin>=0&&end>begin,'The real renderer parking bootstrap must be present.');
  const {createParkingHighlight}=parkingModule(),scene=new THREE.Scene(),state={disposed:false};
  let resolveFetch,requested;
  const fetched=new Promise(resolve=>{resolveFetch=resolve;});
  const base=new URL(EXTERIOR_EDITIONS.entrada.assets,'https://conectaimoveis3d.com/demo/renderer.js');
  const api=vm.runInNewContext('(()=>{let parking,pendingSpaces=[];\n'+source.slice(begin,end)+
    '\nreturn {setSpaces:setParkingSpaces,getParking:()=>parking};})()',{
      scene,state,base,URL,geometryProfile:'entrada',createParkingHighlight,requests:new AbortController(),
      fetch(url){requested=String(url);return fetched;},
    });
  return {api,scene,state,get requested(){return requested;},async load(){resolveFetch({ok:true,json:async()=>spaces});await new Promise(setImmediate);}};
}

test('the renderer keeps the latest apartment selection while the parking map loads asynchronously',async()=>{
  const app=pendingRenderer();
  assert.equal(app.requested,'https://conectaimoveis3d.com/demo/modelo/entrada/candidato/vagas.json');
  assert.equal(app.api.setSpaces([1]),null);
  assert.equal(app.api.setSpaces([2,'3']),null);
  await app.load();
  const parking=app.api.getParking();
  assert.deepEqual(plain(parking.getState().spaces),[2]);
  assert.equal(parking.group.children[0].name,'Vaga 2');
  assert.deepEqual(plain(app.api.setSpaces([3])),[3]);
  assert.equal(parking.group.children[0].name,'Vaga 3');
  parking.dispose();
});

test('clearing selection or disposing before the parking map arrives cannot resurrect the old apartment glow',async()=>{
  const cleared=pendingRenderer();
  cleared.api.setSpaces([1]);cleared.api.setSpaces([]);await cleared.load();
  assert.equal(cleared.api.getParking().group.visible,false);
  assert.deepEqual(plain(cleared.api.getParking().getState().spaces),[]);
  cleared.api.getParking().dispose();
  const disposed=pendingRenderer();disposed.api.setSpaces([1]);disposed.state.disposed=true;await disposed.load();
  assert.equal(disposed.api.getParking(),undefined);
  assert.equal(disposed.scene.children.length,0);
  assert.equal(disposed.api.setSpaces([2]),false);
});
