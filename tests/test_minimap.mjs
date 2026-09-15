import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

class Path2D { constructor(){ this.ops=[]; built.push(this); } moveTo(...a){this.ops.push(['m',...a]);} lineTo(...a){this.ops.push(['l',...a]);} arc(...a){this.ops.push(['a',...a]);} }
const built=[];
const ctx=vm.createContext({Path2D,document:{body:{}},getComputedStyle:()=>({fontFamily:'x'})});
vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/ui/minimap.js',import.meta.url),'utf8'),ctx);

function setup(){
  const calls=[];
  const g=new Proxy({},{get:(o,k)=>k in o?o[k]:(...a)=>calls.push([k,...a]),set:(o,k,v)=>{calls.push(['='+k,v]);return true;}});
  const canvas={width:170,getContext:()=>g};
  const target={x:0,z:0},sph={radius:200,theta:0},catOn={a:true,b:false};
  let hidden=true;
  const mm=ctx.StreetMinimap.create({canvas,target,sph,camera:{fov:40,aspect:1.5},cat:{a:{col:'#f00'},b:{col:'#0f0'}},
    catKeys:['a','b'],poiPorCat:{a:[{x:10,z:10},{x:9000,z:0}],b:[{x:-10,z:5}]},catOn,isPoiHidden:()=>hidden,
    bigRoad:/^primary$/,hw:['primary','residential']});
  return {mm,calls,target,sph,catOn,setHidden:v=>{hidden=v;}};
}

test('road index covers every cell a long road crosses and skips degenerate roads',()=>{
  const {mm}=setup();
  mm.montaBaseMinimapa([{k:0,pts:[[-100,0],[1300,0]]},{k:1,pts:[[5,5]]},{k:1,pts:[[700,700],[710,710]]}]);
  assert.equal(mm.MM.pronto,true);
  assert.equal(JSON.stringify([...mm.MM.grade.keys()]),JSON.stringify(['-1,0','0,0','1,0','2,0','1,1']));
  assert.equal(mm.MM.grade.get('1,0').length,1);assert.equal(mm.MM_CEL,600);
  mm.montaBaseMinimapa([]);assert.equal(mm.MM.pronto,false);
});

test('paths are rebuilt only when the cell window or scale changes; POI dots follow pins and categories',()=>{
  const {mm,calls,target,sph,catOn,setHidden}=setup();
  mm.montaBaseMinimapa([{k:0,pts:[[0,0],[100,0]]},{k:1,pts:[[0,50],[80,50],[80,90]]}]);
  built.length=0;mm.desenhaMinimapa();
  assert.equal(built.length,4);
  assert.equal(JSON.stringify(mm.MM.paths[1].ops),JSON.stringify([['m',0,0],['l',100,0]]));
  assert.equal(JSON.stringify(mm.MM.paths[0].ops),JSON.stringify([['m',0,50],['l',80,50],['l',80,90]]));
  assert.equal(JSON.stringify(Object.keys(mm.MM.pathsPoi)),JSON.stringify(['a','b']));
  assert.equal(mm.MM.pathsPoi.a.ops.length,2);
  target.x=5;built.length=0;mm.desenhaMinimapa();assert.equal(built.length,0);
  sph.radius=400;mm.desenhaMinimapa();assert.equal(built.length,4);
  const fills=()=>calls.filter(c=>c[0]==='=fillStyle').map(c=>c[1]);
  calls.length=0;mm.desenhaMinimapa();assert.ok(!fills().includes('#f00'));
  setHidden(false);calls.length=0;mm.desenhaMinimapa();assert.ok(fills().includes('#f00'));assert.ok(!fills().includes('#0f0'));
  catOn.b=true;calls.length=0;mm.desenhaMinimapa();assert.ok(fills().includes('#0f0'));
  mm.MM.on=false;calls.length=0;mm.desenhaMinimapa();assert.equal(calls.length,0);
});
