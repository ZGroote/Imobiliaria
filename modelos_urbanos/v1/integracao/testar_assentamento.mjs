import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../../../',import.meta.url);
for(const name of ['lib/three.min.js','terrain-fit.js','urban-models.js'])
  vm.runInThisContext(fs.readFileSync(new URL('v1.5/renderizador-v16-moveis/'+name,root),'utf8'));
const T=globalThis.THREE;
// Curved hillside with a grid-cell boundary inside a long road segment.
const grid=[0,12,30,3,21,27,2,11,22];
const terrain=(x,z)=>TerrainFit.sample(grid,3,100,x,z);
terrain.grid={n:3,half:100};
const make=y=>{
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute([0,y,-7,180,y,-7,180,y,7,0,y,-7,180,y,7,0,y,7],3));
  g.setAttribute('aVia',new T.Float32BufferAttribute([0,-7,7,180,-7,7,180,7,7,0,-7,7,180,7,7,0,7,7],3));
  g.setAttribute('aViaSurface',new T.Float32BufferAttribute([2,2,2,2,2,2],1));
  return g;
};
function worst(g){
  const p=g.attributes.position;let error=0;
  for(let i=0;i<p.count;i+=3)for(const [a,b,c] of [[1/3,1/3,1/3],[.5,.5,0],[.5,0,.5],[0,.5,.5],[.1,.2,.7]]){
    const x=a*p.getX(i)+b*p.getX(i+1)+c*p.getX(i+2),z=a*p.getZ(i)+b*p.getZ(i+1)+c*p.getZ(i+2);
    const interpolated=a*terrain(p.getX(i),p.getZ(i))+b*terrain(p.getX(i+1),p.getZ(i+1))+c*terrain(p.getX(i+2),p.getZ(i+2));
    error=Math.max(error,Math.abs(interpolated-terrain(x,z)));
  }
  return error;
}
const g=make(.1),before=worst(g);assert(before>1,'reproduces sinking road');
TerrainFit.refine(T,g,terrain);const after=worst(g);assert(after<.015,after);
const p=g.attributes.position,v=g.attributes.aVia;
for(let i=0;i<p.count;i++){
  assert(Math.abs(p.getX(i)-v.getX(i))<1e-5,'continuous markings');
  assert.equal(g.attributes.aViaSurface.getX(i),2);
}
// Shared pools must keep houses upright and close the entire slope below them.
const pack=JSON.parse(fs.readFileSync(new URL('modelos_urbanos/v1/mapa-casas.json',root)));
const compact=JSON.parse(fs.readFileSync(new URL('modelos_urbanos/v1/compactos.json',root))).assets;
const narrow=[[-2.3,-4],[2.3,-4],[2.3,4],[-2.3,4]],ob={cx:0,cz:0,ux:0,uz:1,hu:4,hv:2.3,rect:1};
assert.equal(UrbanModels.select(pack.assets,{h:3.5,fa:90},ob,narrow,'casas'),null);
const fitted=UrbanModels.select([...pack.assets,...compact],{h:3.5,fa:90},ob,narrow,'casas');
assert(fitted&&fitted.scale>=.95&&fitted.asset.id.includes('compacta'));
assert(UrbanModels.containsRectangle(fitted.corners,narrow));
// An L-shaped footprint has no valid centred rectangle, but room in either wing.
const lRing=[[-6,-6],[6,-6],[6,6],[0,6],[0,0],[-6,0]];
const lOb={cx:0,cz:0,ux:0,uz:1,hu:6,hv:6,rect:.75};
const translated=UrbanModels.select(compact,{h:3.5,fa:400},lOb,lRing,'casas');
assert(translated,'find an intact model inside an off-centre wing');
assert(Math.hypot(translated.x,translated.z)>.1,'actually shifted from OBB centre');
assert(UrbanModels.containsRectangle(translated.corners,lRing),'no corner or edge crosses concave boundary');
assert(translated.scale>=.95,'no miniaturised model');
const parent=new T.Group(),slope=(_,x,z)=>.15*x+.05*z;
const lib=UrbanModels.create(T,pack,parent,{terrain:slope}),asset=pack.assets[0];
const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>[x*asset.size[0]/2,z*asset.size[2]/2]);
const record={r:[[100,100],[110,100],[110,110],[100,110]]};
const slot=lib.add({asset,x:0,z:0,theta:0,scale:1,corners},record,100);
assert.equal(slot.base,Math.max(...corners.map(p=>slope(null,...p))),'ignore displaced legacy footprint');
for(const relief of [0,.5,1])for(const height of [1,3]){
  lib.transform(relief,height,slope);
  const house=new T.Matrix4(),base=new T.Matrix4();slot.pool.mesh.getMatrixAt(0,house);slot.pool.foundation.getMatrixAt(0,base);
  assert(Math.abs(house.elements[13]-base.elements[13])<1e-6,'foundation meets house');
  for(const p of corners)assert(base.elements[13]-base.elements[5]<=slope(null,...p)*relief,'foundation reaches ground');
  assert.equal(house.elements[1],0,'house is upright');assert.equal(base.elements[5]>0,true);
}
lib.remove(slot);lib.flush();assert.equal(slot.pool.foundation.count,0);lib.dispose();assert.equal(parent.children.length,0);
console.log(JSON.stringify({pass:true,roadErrorBefore:before,roadErrorAfter:after,triangles:p.count/3,foundation:'flat/slope/height/unload'}));
