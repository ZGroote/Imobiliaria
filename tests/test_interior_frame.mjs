import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const app=execFileSync('git',['-c','safe.directory='+root,'show','a2473f6:renderizador-v16-moveis/app.js'],{encoding:'utf8',maxBuffer:2e6}).replaceAll('\r','');
const source=app.slice(app.indexOf('function interiorFrame(now)'),app.indexOf('const tmp = new THREE.Vector3();'));
function create(modular) {
  const calls=[],ctx=vm.createContext({CORTE_OFF:1e6,OLHO:1.65,innerWidth:800,innerHeight:600,
    terrainYCached:(...x)=>calls.push(['terrain',...x]),baseDaCasa:pl=>pl.base,
    alturaDoCorte:()=>15,aplicaFuro:()=>calls.push(['cut']),distribuiLuzes:x=>calls.push(['lights',x]),
    seleciona:x=>calls.push(['select',x]),fpPasso:dt=>calls.push(['walk',dt]),posicionaMedidas:(...x)=>calls.push(['labels',...x])});
  vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/lib/three.min.js',import.meta.url),'utf8'),ctx);
  vm.runInContext(`const CORTE={constant:0},target=new THREE.Vector3(),camera=new THREE.PerspectiveCamera(60,4/3,.1,100);
    const FP={pos:new THREE.Vector3(1,0,2),pitch:.1,yaw:.4};
    const INT={on:false,voo:null,corteAlvo:5,baseY:0,fp:false,pl:null,sel:0,raiz:new THREE.Group(),
      lamps:[{p:new THREE.Vector3()}],pool:[],rotulos:[{c:{cx:0,cz:-2},v:new THREE.Vector3(),el:{style:{}}}]};`,ctx);
  if(modular){vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/interior/frame.js',import.meta.url),'utf8'),ctx);
    vm.runInContext('globalThis.step=InteriorFrame.create({THREE,INT,FP,CORTE,CORTE_OFF,camera,target,OLHO,terrainYCached,baseDaCasa,alturaDoCorte,aplicaFuro,distribuiLuzes,seleciona,fpPasso,posicionaMedidas,getWidth:()=>innerWidth,getHeight:()=>innerHeight});',ctx);
  }else vm.runInContext('let _tAnt=0;'+source+'\nglobalThis.step=interiorFrame;',ctx);
  return {ctx,calls};
}
const state=c=>vm.runInContext('JSON.stringify({cut:CORTE.constant,target:target.toArray(),pos:camera.position.toArray(),q:camera.quaternion.toArray(),base:INT.baseY,root:INT.raiz.position.toArray(),lamp:INT.lamps[0].p.toArray(),labels:INT.rotulos.map(r=>r.el.style),flight:!!INT.voo})',c);
test('interior frame preserves clipping, elevation, flight, walking and label projection',()=>{
  const a=create(false),b=create(true);
  for(const script of ['step(100);step(200);','INT.on=true;INT.pl={base:10,pd:3};step(300);',
    'INT.fp=true;step(400);','INT.fp=false;step(500);',
    'INT.voo={t0:500,dur:900,p0:camera.position.clone(),p1:new THREE.Vector3(4,5,6),q0:camera.quaternion.clone(),q1:new THREE.Quaternion(),fim:()=>{INT.fp=true;}};step(950);',
    'step(1400);','INT.on=false;INT.pl=null;INT.corteAlvo=CORTE_OFF;for(let i=0;i<30;i++)step(1500+i*30);']) {
    vm.runInContext(script,a.ctx);vm.runInContext(script,b.ctx);assert.equal(state(b.ctx),state(a.ctx));assert.deepEqual(b.calls,a.calls);
  }
});
