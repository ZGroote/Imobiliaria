import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const app=execFileSync('git',['-c','safe.directory='+root,'show','b48fd54:renderizador-v16-moveis/app.js'],{encoding:'utf8',maxBuffer:2e6}).replaceAll('\r','');
const source=app.slice(app.indexOf('const PAN = 1, ORBIT = 2;'),app.indexOf('$("hs").addEventListener'));
function create(modular) {
  const listeners={},captures=new Set(),calls=[];
  const canvas={style:{},addEventListener:(type,fn)=>{(listeners[type]||=[]).push(fn);},
    setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)};
  const ctx=vm.createContext({canvas,target:{x:0,z:0},sph:{radius:300,theta:.5,phi:.98},camera:{fov:50},innerHeight:600,
    INT:{on:false,orbita:false,fp:false},FP:{yaw:0,pitch:0},zoomMax:()=>1000,
    soltaSeta:()=>calls.push('release-editor'),cliqueInterior:()=>calls.push('interior-click'),cliqueNaCidade:()=>calls.push('city-click')});
  if(modular){vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/scene/camera-gestures.js',import.meta.url),'utf8'),ctx);
    vm.runInContext('globalThis.api=CameraGestures.create({canvas,target,sph,camera,zoomMax,getHeight:()=>innerHeight,getInterior:()=>INT,getFirstPerson:()=>FP,soltaSeta,cliqueInterior,cliqueNaCidade});',ctx);
  } else vm.runInContext(source+'\nglobalThis.api={isMultiTouch:e=>dedos.size>1||gestoDuplo&&e.pointerType==="touch",claimGesture(){drag=0;moveu=1;}};',ctx);
  return {ctx,calls,canvas,captures,send(type,extra={}) {const event={type,pointerId:1,pointerType:'mouse',button:0,clientX:100,clientY:100,preventDefault:()=>calls.push('prevent'),...extra};for(const fn of listeners[type]||[])fn(event);}};
}
test('pointer pan, orbit, touch, cancellation, interior look and editor ownership match the original',()=>{
  const a=create(false),b=create(true);
  const snapshot=c=>JSON.stringify({target:c.ctx.target,sph:c.ctx.sph,FP:c.ctx.FP,style:c.canvas.style,captures:[...c.captures],calls:c.calls,multi:c.ctx.api.isMultiTouch({pointerType:'touch'})});
  const send=(type,event)=>{a.send(type,event);b.send(type,event);assert.equal(snapshot(b),snapshot(a),type);};
  send('pointerdown');send('pointerup');send('pointerdown');send('pointermove',{clientX:160,clientY:130});send('pointerup');
  send('pointerdown',{button:2});send('pointermove',{clientX:190,clientY:600});send('pointerup',{button:2});
  send('wheel',{deltaY:-1});send('contextmenu');
  send('pointerdown',{pointerType:'touch'});send('pointerdown',{pointerType:'touch',pointerId:2,clientX:200});
  send('pointermove',{pointerType:'touch',pointerId:2,clientX:260,clientY:140});send('pointercancel',{pointerType:'touch',pointerId:2});
  send('lostpointercapture',{pointerType:'touch'});send('pointerup',{pointerType:'touch'});
  for(const c of [a,b]){c.ctx.INT.on=true;c.ctx.INT.fp=true;}
  send('pointerdown');send('pointermove',{clientX:120,clientY:900});send('wheel',{deltaY:1});send('pointerup');
  send('pointerdown');for(const c of [a,b])c.ctx.api.claimGesture();send('pointermove',{clientX:250});send('pointerup');
  for(const c of [a,b])c.ctx.INT.orbita=true;
  send('pointerdown',{shiftKey:true});send('pointermove',{clientX:160,clientY:120});send('pointerup');
  assert(a.calls.includes('city-click'));assert(a.calls.includes('release-editor'));assert.equal(b.ctx.FP.pitch,-1.25);
});
