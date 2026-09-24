import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const app=execFileSync('git',['-c','safe.directory='+root,'show','7f20dc5:renderizador-v16-moveis/app.js'],{encoding:'utf8',maxBuffer:2e6}).replaceAll('\r','');
const source=app.slice(app.indexOf('function locDaPlanta('),app.indexOf('MM.cv.addEventListener("click"'));
function context(modular,angle) {
  const calls=[],drawing=new Proxy({}, {get:(_,k)=>(...args)=>calls.push([k,...args]),set:(_,k,v)=>{calls.push(['=',k,v]);return true;}});
  const ctx=vm.createContext({document:{body:{}},getComputedStyle:()=>({fontFamily:'Arial'}),
    MM:{cv:{width:170,getContext:()=>drawing}},INT:{},FP:{pos:{x:1,z:1},yaw:.7},camera:{fov:65,aspect:1.5}});
  vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/core/geometry.js',import.meta.url),'utf8'),ctx);ctx.inside=ctx.MapGeometry.inside;
  ctx.INT.pl={ob:{cx:0,cz:0,ux:Math.cos(angle),uz:Math.sin(angle)},pd:2.6,area:30,
    comodos:[{nome:'Sala',area:20,poly:[[0,0],[5,0],[5,4],[0,4]]},{nome:'Cozinha',area:10,poly:[[5,0],[7,0],[7,4],[5,4]]}],
    paredes:[{a:[0,0],b:[5,0],y0:0,y1:2.6},{a:[5,0],b:[5,4],y0:1,y1:2.6}],
    esquadrias:[{a:[0,1],b:[0,2],porta:false},{a:[5,1],b:[5,2],porta:true}]};
  if(modular){vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/ui/floor-plan-minimap.js',import.meta.url),'utf8'),ctx);
    vm.runInContext('globalThis.api=FloorPlanMinimap.create({INT,MM,FP,camera,inside,document,getComputedStyle});',ctx);
  } else vm.runInContext(source+'\nglobalThis.api={locDaPlanta,desenhaPlantaMini};',ctx);
  return {ctx,calls};
}
test('interior minimap preserves drawing, room highlight, rotated frame and cached bounds',()=>{
  for(const angle of [0,.7,Math.PI/2]) {
    const a=context(false,angle),b=context(true,angle);
    for(const [x,z,yaw] of [[1,1,0],[6,2,1.7],[20,20,-2]]) {
      for(const c of [a,b]) {c.ctx.FP.pos={x,z};c.ctx.FP.yaw=yaw;c.ctx.api.desenhaPlantaMini();}
      assert.deepEqual(b.calls,a.calls);assert.equal(JSON.stringify(b.ctx.MM.lim),JSON.stringify(a.ctx.MM.lim));
    }
    const count=b.calls.length;b.ctx.INT.pl=null;b.ctx.api.desenhaPlantaMini();assert.equal(b.calls.length,count);
  }
});
