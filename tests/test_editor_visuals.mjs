import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const app=execFileSync('git',['-c','safe.directory='+root,'show','09fe211:renderizador-v16-moveis/app.js'],{encoding:'utf8',maxBuffer:2e6}).replaceAll('\r','');
const source=app.slice(app.indexOf('/* ---- a grade '),app.indexOf('/* ---- ligar e desligar o modo'));
function element() {return {children:[],style:{},listeners:{},appendChild(x){this.children.push(x);},setAttribute(k,v){this[k]=v;},addEventListener(k,f){this.listeners[k]=f;},blur(){}};}
function context(modular) {
  const changes=[],ctx=vm.createContext({document:{createElement:element,activeElement:null},overlay:element(),MOB_VERDE:0x5fc777,
    redimensiona:(m,k,v,side)=>{m[k]=v;changes.push([k,v,side]);}});
  vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/lib/three.min.js',import.meta.url),'utf8'),ctx);
  vm.runInContext(`const MOB={on:true,modo:'medir',passo:.1,fantasma:null},PLANTA={on:false};
    const gInteriores=new THREE.Group(),camera=new THREE.PerspectiveCamera(60,1,.1,100);
    camera.position.set(0,8,10);camera.lookAt(0,0,0);camera.updateMatrixWorld();
    const INT={sel:0,baseY:1,raiz:new THREE.Group(),pl:{ob:{cx:0,cz:0,hu:3,hv:2,ux:1,uz:0},W:(u,v)=>[u,v]},moveis:[]};
    const obj=new THREE.Group();obj.add(new THREE.Mesh(new THREE.BoxGeometry(2,1,1),new THREE.MeshBasicMaterial()));
    const m={u:0,v:0,w:2,d:1,h:1,obj};obj.userData.movel=m;INT.moveis.push(m);`,ctx);
  if(modular){vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/interior/editor-visuals.js',import.meta.url),'utf8'),ctx);
    vm.runInContext('globalThis.api=EditorVisuals.create({THREE,INT,MOB,MOB_VERDE,document,overlay,camera,redimensiona,getPlanta:()=>PLANTA});',ctx);
  }else vm.runInContext(source+'\nglobalThis.api={fazGrade,mobSetas,poeSetas,poeFantasma,tiraFantasma,mobMed,pintaMedidas,posicionaMedidas};',ctx);
  return {ctx,changes};
}
const snap=c=>vm.runInContext(`JSON.stringify({visible:api.mobSetas.visible,
  arrows:api.mobSetas.children.map(o=>[o.position.toArray(),o.rotation.toArray(),o.material.color.getHex()]),
  fields:api.mobMed.map(q=>[q.inp.value,q.el.style]),
  preview:MOB.fantasma&&[MOB.fantasma.children.length,MOB.fantasma.children[0].geometry===INT.moveis[0].obj.children[0].geometry]})`,c);
test('editor visuals preserve grid, handles, measurement input and shared preview geometry',()=>{
  const a=context(false),b=context(true);
  for(const script of ['api.poeSetas();api.pintaMedidas();api.posicionaMedidas(600,600);',
    'api.poeFantasma(INT.moveis[0]);',
    'api.mobMed[0].inp.value="3,25";api.mobMed[0].inp.listeners.change();api.poeSetas();',
    'document.activeElement=api.mobMed[1].inp;api.mobMed[1].inp.value="typing";api.pintaMedidas();',
    'api.tiraFantasma();INT.sel=-1;api.poeSetas();api.posicionaMedidas(600,600);']) {
    vm.runInContext(script,a.ctx);vm.runInContext(script,b.ctx);assert.equal(snap(b.ctx),snap(a.ctx));assert.deepEqual(b.changes,a.changes);
  }
  for(const size of [3,30]) {
    const snapshots=[a,b].map(c=>vm.runInContext(`INT.pl.ob.hu=${size};JSON.stringify(Array.from(api.fazGrade().geometry.attributes.position.array))`,c.ctx));
    assert.equal(snapshots[0],snapshots[1]);
  }
});

// v17: vista de 16 m de altura na cena da planta, a grade de 10 cm vira feltro verde. Ela so
// afina ali; fora da planta a opacidade continua a do original.
test('the grid thins out only in the floor plan scene',()=>{
  const a=context(false),b=context(true),opacidade=c=>vm.runInContext('api.fazGrade().material.opacity',c.ctx);
  assert.equal(opacidade(b),opacidade(a));
  vm.runInContext('PLANTA.on=true',b.ctx);
  assert.equal(opacidade(b),.22);
});
