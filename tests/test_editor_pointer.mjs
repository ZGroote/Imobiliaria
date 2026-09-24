import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const app=execFileSync('git',['-c','safe.directory='+root,'show','19620c2:renderizador-v16-moveis/app.js'],{encoding:'utf8',maxBuffer:2e6}).replaceAll('\r','');
const source=app.slice(app.indexOf('/* ---- arrastar a seta'),app.indexOf('/* ---- os botoes do painel'));
function create(modular) {
  const calls=[],handlers={},captured=new Set();let multi=false;
  const canvas={addEventListener:(k,f)=>{(handlers[k]||=[]).push(f);},setPointerCapture:i=>captured.add(i),hasPointerCapture:i=>captured.has(i),releasePointerCapture:i=>captured.delete(i)};
  const ctx=vm.createContext({canvas,innerWidth:800,innerHeight:600,MOB_VERDE:0x5fc777,MOB_VERMELHO:0xe2564e,
    cameraGestures:{isMultiTouch:()=>multi,claimGesture:()=>calls.push('claim')},
    mobMed:[{el:{classList:{add:k=>calls.push(['add',k]),remove:k=>calls.push(['remove',k])}}}],
    paraUV:(x,z)=>[x,z],dirUV:(m,x,z)=>[x,z],arred:x=>Math.round(x*10)/10,
    redimensiona:(m,k,v,s)=>{calls.push(['resize',k,v,s]);m[k]=v;},cabeAqui:()=>true,
    atualizaMovel:()=>calls.push('update'),seleciona:i=>calls.push(['select',i]),salvaMoveis:()=>calls.push('save'),pintaMedidas:()=>calls.push('labels')});
  vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/lib/three.min.js',import.meta.url),'utf8'),ctx);
  vm.runInContext(`const camera=new THREE.PerspectiveCamera(60,800/600,.1,100);
    camera.position.set(0,8,10);camera.lookAt(0,0,0);camera.updateMatrixWorld();
    const INT={on:true,sel:0,baseY:0,pl:{W:(u,v)=>[u,v]},moveis:[{u:0,v:0,w:2,d:1,h:1}]};
    const MOB={on:true,modo:'medir',arrasto:null},mobSetas=new THREE.Group();
    const handle=new THREE.Mesh(new THREE.SphereGeometry(.4),new THREE.MeshBasicMaterial());
    handle.userData.eixo={k:'w',s:1};mobSetas.add(handle);mobSetas.updateMatrixWorld(true);
    const selBox={material:{color:new THREE.Color()}};`,ctx);
  if(modular){vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/interior/editor-pointer.js',import.meta.url),'utf8'),ctx);
    vm.runInContext('globalThis.api=EditorPointer.create({THREE,canvas,camera,INT,MOB,mobSetas,mobMed,cameraGestures,paraUV,dirUV,arred,redimensiona,cabeAqui,atualizaMovel,seleciona,selBox,MOB_VERDE,MOB_VERMELHO,salvaMoveis,pintaMedidas,getWidth:()=>innerWidth,getHeight:()=>innerHeight});',ctx);
  }else vm.runInContext('const rcaster=new THREE.Raycaster(),_ndc=new THREE.Vector2(),_mobV=new THREE.Vector3();'+source,ctx);
  return {ctx,calls,captured,setMulti:x=>multi=x,send(type,extra={}){for(const f of handlers[type]||[])f({type,button:0,pointerId:1,clientX:400,clientY:300,...extra});}};
}
test('editor pointer projection, capture, sizing, moving and multi-touch exclusion match the original',()=>{
  const a=create(false),b=create(true);
  const state=c=>vm.runInContext('JSON.stringify({MOB,m:INT.moveis[0],color:selBox.material.color.getHex()})',c.ctx);
  const send=(type,event)=>{a.send(type,event);b.send(type,event);assert.deepEqual(b.calls,a.calls);assert.equal(state(b),state(a));assert.deepEqual([...b.captured],[...a.captured]);};
  send('pointerdown');assert(a.calls.includes('claim'));send('pointermove',{clientX:440});send('pointerup');
  for(const c of [a,b])vm.runInContext("handle.userData.eixo={k:'h',s:1};",c.ctx);
  send('pointerdown');send('pointermove',{clientY:260,shiftKey:true});send('pointercancel');
  for(const c of [a,b])vm.runInContext("MOB.modo='mover';",c.ctx);
  send('pointermove',{clientX:450,clientY:330});send('pointermove',{clientX:430,clientY:320,shiftKey:true});
  for(const c of [a,b])c.setMulti(true);
  const count=a.calls.length;send('pointerdown');send('pointermove',{clientX:480});assert.equal(a.calls.length,count);
});
