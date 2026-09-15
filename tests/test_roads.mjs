import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import test from 'node:test';

const original = execFileSync('git', ['-c', 'safe.directory=' + process.cwd().replaceAll('\\', '/'),
  'show', '4b648ff:renderizador-v16-moveis/app.js'], {encoding:'utf8', maxBuffer:2000000});
const block = original.slice(original.indexOf('const viaJunctions'), original.indexOf('const {matVia}'));
const ctx = vm.createContext({ROAD_W:{residential:7.5,primary:13}, HW:['residential','primary'], registerTerrain: () => {}});
for (const name of ['lib/three.min.js','world/roads.js'])
  vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/'+name, import.meta.url),'utf8'),ctx);
vm.runInContext(block+';globalThis.before={indexaJuncoes,buildRibbons};',ctx);

function compare(roads, batch=roads) {
  let registrations=0;
  const after=ctx.WorldRoads.create({THREE:ctx.THREE,widthOf:w=>ctx.ROAD_W[ctx.HW[w.k]]||6,
    registerTerrain:()=>{registrations++;}});
  ctx.before.indexaJuncoes(roads); after.indexaJuncoes(roads);
  for(const args of [[.1,1,undefined],[.32,1.55,{de:1,junta:false,meiofio:true,y_baixo:.1}]]) {
    const a=ctx.before.buildRibbons(batch,...args),b=after.buildRibbons(batch,...args);
    if(!a){assert.equal(b,null);continue;}
    for(const key of Object.keys(a.attributes)) {
      assert.deepEqual(b.attributes[key].array,a.attributes[key].array,key);
      assert.equal(b.attributes[key].itemSize,a.attributes[key].itemSize);
    }
    assert.equal(b.boundingSphere.radius,a.boundingSphere.radius);
    a.dispose();b.dispose();
  }
  return registrations;
}

test('road strips preserve intersections, widths, bevels and neighboring-block junctions',()=>{
  const roads=[{k:0,pts:[[-60,0],[0,0],[60,0]]},{k:1,pts:[[0,-60],[0,0],[35,60]]},
    {k:99,pts:[[60,0],[95,12],[120,12]]},{k:0,pts:[[0,0],[.1,0]]}];
  assert.equal(compare(roads),2);
  assert.equal(compare(roads,[roads[0]]),2);
});

test('empty and degenerate roads produce no geometry; indexing resets previous junctions',()=>{
  assert.equal(compare([]),0);
  assert.equal(compare([{k:0,pts:[[0,0],[.1,0]]}]),0);
  const api=ctx.WorldRoads.create({THREE:ctx.THREE,widthOf:()=>8,registerTerrain:()=>{}});
  const road={k:0,pts:[[-40,0],[0,0],[40,0]]},cross={k:0,pts:[[0,-40],[0,0],[0,40]]};
  api.indexaJuncoes([road,cross]); api.indexaJuncoes([road]);
  ctx.before.indexaJuncoes([road]);
  const opts={de:1,junta:false,meiofio:true};
  // Use a fresh baseline with the same width to compare reset behavior.
  const fresh=ctx.WorldRoads.create({THREE:ctx.THREE,widthOf:()=>8,registerTerrain:()=>{}});
  fresh.indexaJuncoes([road]);
  assert.deepEqual(api.buildRibbons([road],.32,1.55,opts).attributes.position.array,
    fresh.buildRibbons([road],.32,1.55,opts).attributes.position.array);
});
