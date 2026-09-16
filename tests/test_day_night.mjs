import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const original=execFileSync('git',['-c','safe.directory='+root,'show','6623aa2:renderizador-v16-moveis/app.js'],{encoding:'utf8',maxBuffer:2e6}).replaceAll('\r','');
const source=original.slice(original.indexOf('function guardaDia()'),original.indexOf('$("tNoite").addEventListener'));
const three=fs.readFileSync(new URL('../renderizador-v16-moveis/lib/three.min.js',import.meta.url),'utf8');
function create(modular) {
  const ctx=vm.createContext({});vm.runInContext(three,ctx);
  vm.runInContext(`const NOITE={on:false,t:0,dia:null},INT={on:false},uNoite={value:0},calls=[];
    const sun=new THREE.DirectionalLight(0xffe5c0,1.8),hemi=new THREE.HemisphereLight(0xb0ccff,0x665544,.9);
    const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x8899aa,100,500);
    const CEU=new THREE.Mesh(new THREE.SphereGeometry(1),new THREE.MeshBasicMaterial());
    let clear=new THREE.Color(0x778899);
    const renderer={toneMappingExposure:1.18,getClearColor:c=>c.copy(clear),setClearColor:c=>{clear.copy(c);}};
    const guarda={grava:(...a)=>calls.push(['save',...a])},sujaSombra=()=>calls.push(['shadow']),frameLoop=()=>calls.push(['frame']);
    const $=()=>({setAttribute:(...a)=>calls.push(['button',...a])});`,ctx);
  if(modular){
    vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/scene/day-night.js',import.meta.url),'utf8'),ctx);
    vm.runInContext('globalThis.api=DayNight.create({THREE,NOITE,renderer,sun,hemi,scene,INT,CEU,uNoite,sujaSombra,guarda,frameLoop,el:$});',ctx);
  } else vm.runInContext(source+'\nglobalThis.api={aplicaNoite,setNoite};',ctx);
  return ctx;
}
const snapshot=c=>vm.runInContext(`JSON.stringify({NOITE,exposure:renderer.toneMappingExposure,
  sun:[sun.intensity,sun.color.toArray()],hemi:[hemi.intensity,hemi.color.toArray(),hemi.groundColor.toArray()],
  fog:scene.fog.color.toArray(),clear:clear.toArray(),sky:CEU.material.color.toArray(),uniform:uNoite.value,calls})`,c);
test('day/night preserves transitions, saved preference, interior precedence and return to day',()=>{
  const a=create(false),b=create(true);
  for(const step of ['api.setNoite(true,false)','NOITE.t=.25;api.aplicaNoite()',
    'NOITE.t=.75;api.aplicaNoite()','api.setNoite(true,true)',
    'INT.on=true;api.setNoite(false,true)','INT.on=false;api.aplicaNoite()',
    'api.setNoite(true,true)','api.setNoite(false,true)']) {
    vm.runInContext(step,a);vm.runInContext(step,b);assert.equal(snapshot(b),snapshot(a),step);
  }
});
