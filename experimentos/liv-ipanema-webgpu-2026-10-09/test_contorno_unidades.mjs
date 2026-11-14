import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {Ray,Vector3,Scene} from 'three/webgpu';
import {validateUnits} from './unidades.js';
import {containsPoint,validFootprint,intersectPrism} from './unit-footprint.js';
import {createUnitResolver,createUnitPicking} from './picking.js';
const data=JSON.parse(readFileSync(new URL('./modelo/unidades-contorno.json',import.meta.url),'utf8'));
const old=JSON.parse(readFileSync(new URL('./unidades.json',import.meta.url),'utf8'));
const ray=(from,to)=>new Ray(new Vector3(...from),new Vector3(...to).sub(new Vector3(...from)).normalize());
const area=ring=>ring.reduce((s,a,i)=>{const b=ring[(i+1)%ring.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;

test('registration is tied to the corrected model and independently pinned inputs',()=>{
  validateUnits(data);
  assert.equal(data.sourceModelSHA256,JSON.parse(readFileSync(new URL('./modelo/variante/assets/manifest.json',import.meta.url))).sourceModelSHA256);
  for(const [path,expected] of Object.entries(data.registration.sources)){
    const file=new URL(`../../${path}`,import.meta.url);
    assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),expected,path);
  }
  assert.deepEqual(data.units.map(u=>u.id),old.units.map(u=>u.id));
  for(let i=0;i<10;i++){
    const u=data.units[i],previous=old.units[i];
    assert.deepEqual(u.printedBandV,previous.printedBandV);
    for(const key of ['typology','plan2d','mirroring','areaM2','commercialNumber','price','parking'])assert.equal(u[key],null);
    assert.equal(u.availability,'nao_informada');
    assert.ok(area(u.footprint)<(u.bounds.max[0]-u.bounds.min[0])*(u.bounds.max[2]-u.bounds.min[2]),'each zone preserves a notch');
  }
});

test('closed concave prism picks the recessed surface, roof and first visible side',()=>{
  const envelope={footprint:[[0,0],[4,0],[4,4],[3,4],[3,2],[1,2],[1,4],[0,4]],minY:0,maxY:10};
  assert.ok(validFootprint(envelope.footprint));
  const point=new Vector3();
  assert.deepEqual(intersectPrism(ray([2,4,8],[2,4,0]),envelope,point).toArray(),[2,4,2]);
  assert.deepEqual(intersectPrism(ray([2,4,3],[2,4,0]),envelope,point).toArray(),[2,4,2],'origin in open notch');
  assert.deepEqual(intersectPrism(ray([2,20,1],[2,0,1]),envelope,point).toArray(),[2,10,1],'roof');
  assert.equal(intersectPrism(ray([2,20,3],[2,0,3]),envelope,point),null,'vertical ray in empty notch');
  assert.equal(intersectPrism(ray([2,4,1],[2,4,8]),envelope,point),null,'origin inside');
  assert.equal(intersectPrism(ray([2,4,3],[5,4,3]),envelope,point).x,3,'side of notch');
  assert.equal(intersectPrism(ray([2,-10,1],[2,10,1]),envelope,point).y,0,'bottom');
});

test('all ten registered positions resolve on both facades; core, roof, corridor and borders stay unassigned',()=>{
  const resolve=createUnitResolver(data);
  for(const u of data.units){
    const [x,y,z]=u.pickPoint,sign=Math.sign(z);
    assert.equal(resolve(ray([x,y,sign*80],[x,y,z])),u.id);
    assert.equal(resolve(ray([x+3,7,sign*80],[x,y,z])),u.id);
    assert.equal(resolve(ray([0,y,sign*92.06216808058765],[x,y,z])),u.id);
    assert.equal(resolve(ray([x,80,0],[x,y,z])),null);
    assert.equal(resolve(ray([x,40,sign*80],[x,40,z])),null);
    assert.equal(resolve(ray([x,y,sign],[x,y,z])),null);
  }
  for(const z of [-3.5,3.5])assert.equal(resolve(ray([-80,4.35,z],[-23.85,4.35,z])),data.units[z<0?0:1].id);
  assert.equal(resolve(ray([-80,4.35,0],[-23.85,4.35,0])),null,'corridor in head notch');
  for(const x of [-7.9,-6.201,-4.5])for(const sign of [-1,1])assert.equal(resolve(ray([x,4.35,sign*80],[x,4.35,0])),null,'core');
  const edge=data.units[0].bounds.max[0];
  assert.equal(resolve(ray([edge,4.35,80],[edge,4.35,0])),null,'shared boundary');
  assert.equal(resolve(ray([0,4.35,80],[70,4.35,0])),null,'background');
});

test('actual highlight triangles follow each concave zone and use only two reusable geometries',()=>{
  const scene=new Scene(),canvas={addEventListener(){},removeEventListener(){}};
  const p=createUnitPicking({scene,canvas,catalog:data,getCamera:()=>null,getFloor:()=>1,onSelect(){}});
  const geometry=p.highlight.children[0].geometry,edges=p.highlight.children[1].geometry;
  const resources=[geometry,edges,...p.highlight.children.map(o=>o.material)],disposed=resources.map(()=>0);
  resources.forEach((r,i)=>r.addEventListener('dispose',()=>disposed[i]++));
  for(const u of data.units){
    p.select(u.id);p.highlight.updateMatrixWorld(true);
    assert.equal(p.highlight.children[0].geometry,geometry);
    assert.equal(p.highlight.children[1].geometry,edges);
    const attr=geometry.getAttribute('position'),{start,count}=geometry.drawRange;
    let capArea=0;
    for(let i=start;i<start+count;i+=3){
      const pts=[0,1,2].map(k=>new Vector3().fromBufferAttribute(attr,i+k).applyMatrix4(p.highlight.matrixWorld));
      for(const v of pts)assert.ok(containsPoint(u.footprint,v.x,v.z,5e-6));
      if(Math.abs(pts[0].y-pts[1].y)<1e-6&&Math.abs(pts[1].y-pts[2].y)<1e-6){
        capArea+=Math.abs(area(pts.map(v=>[v.x,v.z])));
        for(let a=0;a<=10;a++)for(let b=0;b<=10-a;b++){
          const v=pts[0].clone().multiplyScalar(a/10).addScaledVector(pts[1],b/10).addScaledVector(pts[2],1-(a+b)/10);
          assert.ok(containsPoint(u.footprint,v.x,v.z,5e-6),'cap fills a notch');
        }
      }
    }
    assert.ok(Math.abs(capArea-2*area(u.footprint))<1e-4,'caps do not cover the polygon');
  }
  p.dispose();p.dispose();assert.deepEqual(disposed,[1,1,1,1]);
  assert.equal(scene.children.length,0);
});

test('invalid, crossed or rectangle-only zones are rejected before picking',()=>{
  for(const mutate of [
    d=>d.selectionEnvelope.footprint[1][0]=NaN,
    d=>d.selectionEnvelope.maxY=Infinity,
    d=>d.units[0].footprint=[[1,1],[4,1],[4,4],[2,4],[2,0],[3,0],[3,3],[1,3]],
    d=>{const u=d.units[0],a=u.bounds.min,b=u.bounds.max;u.footprint=[[a[0],a[2]],[b[0],a[2]],[b[0],b[2]],[a[0],b[2]]];},
    d=>d.units[0].footprint.pop(),
    d=>d.units[0].typology='canto',
    d=>d.schema='liv-pilot-units-v1'
  ]){const invalid=structuredClone(data);mutate(invalid);assert.throws(()=>validateUnits(invalid));}
});
