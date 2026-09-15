import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import test from 'node:test';

const src=execFileSync('git',['-c','safe.directory='+process.cwd().replaceAll('\\','/'),
  'show','e0c8ea1:renderizador-v16-moveis/app.js'],{encoding:'utf8',maxBuffer:2000000});
const pal=src.slice(src.indexOf('const PAL ='),src.indexOf('/* ============================================================\n   5. Geometria'));
const roof=src.slice(src.indexOf('function roofFootprint('),src.indexOf('if (new URLSearchParams',src.indexOf('function roofFootprint(')));
const fn=src.slice(src.indexOf('function buildBuildings('),src.indexOf('/* A fita da rua'));
const hashSource=src.slice(src.indexOf('const hash ='),src.indexOf('const hash =')+src.slice(src.indexOf('const hash =')).indexOf('\n\n'));

for(const largePalette of [false,true]) test(`procedural building buffers preserve all classes, roofs and explicit records; large palette=${largePalette}`,()=>{
  const ctx=vm.createContext({APAR:{parede_grande:largePalette},CLS:['none','res','biz','civic'],TILE_M:500,LV:3.15,
    terrainY:(x,z)=>x*.03-z*.02,registerTerrain:()=>{},explicitBuilding:b=>b.lancamento||b.parede!=null||b.sacadas,roadSafety:null});
  for(const file of ['lib/three.min.js','lib/earcut.min.js','core/geometry.js','world/building-type.js','world/buildings.js'])
    vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/'+file,import.meta.url),'utf8'),ctx);
  Object.assign(ctx,ctx.MapGeometry,ctx.BuildingType);
  ctx.triangulateRing=r=>ctx.MapGeometry.triangulateRing(r,ctx.earcut,()=>{throw Error('unexpected fallback');});
  vm.runInContext(hashSource+';globalThis.hash=hash;'+pal+roof+fn+';globalThis.before=buildBuildings;',ctx);
  const after=ctx.WorldBuildings.create({...ctx,geometry:ctx.MapGeometry,types:ctx.BuildingType,getRoadSafety:()=>ctx.roadSafety}).buildBuildings;
  const records=[];
  for(let i=0;i<80;i++) for(const c of [0,1,2,3]) {
    const x=i*37,z=c*100,w=5+i%25,d=8+i%18;
    const r=[[x,z],[x,z+d],[x+w,z+d],[x+w,z]];
    if(i%2)r.reverse();
    records.push({r,c,h:3+(i%18)*3.15,area:w*d,...(i%9===0?{lancamento:true,parede:0xab9876}: {})});
  }
  for(const collision of [false,true]) {
    ctx.roadSafety=collision?{hit:()=>true}:null;
    const a=ctx.before(records,0,0),b=after(records,0,0);
    assert.equal(b.count,a.count);assert.deepEqual(b.sombras,a.sombras);
    for(const name of ['g','lg']) {
      for(const key of Object.keys(a[name].attributes))assert.deepEqual(b[name].attributes[key].array,a[name].attributes[key].array,name+'.'+key);
      for(const key of ['presetDY','presetCenter'])assert.deepEqual(b[name].userData[key],a[name].userData[key]);
      assert.equal(b[name].boundingSphere.radius,a[name].boundingSphere.radius);
      a[name].dispose();b[name].dispose();
    }
  }
  assert.equal(after([],0,0),null);
});
