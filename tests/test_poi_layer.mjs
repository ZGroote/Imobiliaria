import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const ctx=vm.createContext({});
for(const name of ['lib/three.min.js','ui/poi-layer.js'])
  vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/'+name,import.meta.url),'utf8'),ctx);

test('POI layer builds one halo and one beam per category on the terrain',()=>{
  const THREE=ctx.THREE,registered=[];
  const document={createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
  const pois=[{c:'a',x:0,z:0},{c:'a',x:100,z:0},{c:'b',x:0,z:50}];
  const {group,layer}=ctx.PoiLayer.create({THREE,pois,cat:{a:{hex:0xff0000},b:{hex:0x00ff00}},
    terrainY:(x,z)=>x/10+z/100,registerTerrain:g=>registered.push(g),document,haloRadius:30,beamTop:24});
  assert.deepEqual(Object.keys(layer),['a','b']);assert.equal(group.children.length,4);assert.equal(registered.length,4);
  const [halo,beam]=layer.a;
  assert.equal(halo.geometry.attributes.position.count,12);assert.equal(beam.geometry.attributes.position.count,116);
  assert.equal(halo.geometry.userData.presetDY[6],10);assert.equal(beam.geometry.attributes.position.getY(1),24);
  assert.equal(halo.material.opacity,0.62);assert.equal(beam.material.depthTest,false);
  assert.equal(halo.renderOrder,3);assert.equal(beam.renderOrder,4);assert.equal(halo.geometry.userData.poi,true);
  assert.equal(layer.b[0].geometry.attributes.color.getY(0),1);
});

test('nearby counts include the radius boundary and group by category',()=>{
  const pois=[{c:'a',x:0,z:0},{c:'a',x:1000,z:0},{c:'b',x:0,z:1001},{c:'b',x:600,z:600}];
  assert.equal(JSON.stringify(ctx.PoiLayer.contaPerto(pois,0,0,1000)),'{"a":2,"b":1}');
  assert.equal(JSON.stringify(ctx.PoiLayer.contaPerto(pois,5000,0,1000)),'{}');
});
