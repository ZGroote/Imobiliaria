import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {Ray,Vector3,PerspectiveCamera} from 'three/webgpu';
import {pilotFloorView} from './cameras.js';
import {validateUnits,unitById} from './unidades.js';
import {createUnitResolver} from './picking.js';
const data=JSON.parse(readFileSync(new URL('./unidades.json',import.meta.url),'utf8'));
const ray=(from,to)=>new Ray(new Vector3(...from),new Vector3(...to).sub(new Vector3(...from)).normalize());

test('official final order has ten unique technical records without commercial or interior assignments',()=>{
  validateUnits(data);
  assert.equal(new Set(data.units.map(u=>u.id)).size,10);
  assert.deepEqual(data.units.filter(u=>u.side==='estacionamento').map(u=>u.final),['01','03','05','07','09']);
  assert.deepEqual(data.units.filter(u=>u.side==='lazer').map(u=>u.final),['02','04','06','08','10']);
  for(const unit of data.units){
    assert.equal(unitById(data,unit.id),unit);
    for(const key of ['typology','plan2d','mirroring','areaM2','commercialNumber','price','parking'])assert.equal(unit[key],null);
    assert.equal(unit.availability,'nao_informada');
  }
  assert.equal(unitById(data,null),null);
  assert.throws(()=>unitById(data,'101'));
});
test('registration reproduces the printed nonuniform bands and excludes the circulation core',()=>{
  for(const unit of data.units){
    const [a,b]=unit.printedBandV,x=v=>v>=708?-23.85+(898-v)*15.8364/190:-4.3884+(666-v)*28.2384/293;
    assert.ok(Math.abs(unit.bounds.min[0]-x(b))<1e-6);
    assert.ok(Math.abs(unit.bounds.max[0]-x(a))<1e-6);
    assert.ok(unit.printedLabelUV[1]>a&&unit.printedLabelUV[1]<b);
  }
  const resolver=createUnitResolver(data);
  for(const x of [-7.9,-6.201,-4.5])for(const side of [-1,1])assert.equal(resolver(ray([x,4.35,side*80],[x,4.35,0])),null);
});
test('straight and oblique rays select only the first visible facade position',()=>{
  const resolve=createUnitResolver(data);
  for(const unit of data.units){
    const [a,b]=[unit.bounds.min,unit.bounds.max],x=(a[0]+b[0])/2,z=unit.side==='lazer'?7.02:-7.02;
    assert.equal(resolve(ray([x,4.35,z*12],[x,4.35,z])),unit.id);
    assert.equal(resolve(ray([x+3,7,z*12],[x,4.35,z])),unit.id);
    assert.equal(resolve(ray([0,4.35,Math.sign(z)*92.06216808058765],[x,4.35,z])),unit.id);
    assert.equal(resolve(ray([x,80,0],[x,4.35,z])),null,'roof hides the pilot');
    assert.equal(resolve(ray([x,40,z*12],[x,40,z])),null,'other floor');
    assert.equal(resolve(ray([x,4.35,0],[x,4.35,z])),null,'inside the envelope');
  }
  for(const z of [-3.5,3.5]){
    const expected=z<0?'01':'02';
    assert.equal(unitById(data,resolve(ray([-80,4.35,z],[-23.85,4.35,z]))).final,expected);
    assert.equal(resolve(ray([-80,4.35,0],[-23.85,4.35,0])),null,'corridor');
  }
  assert.equal(resolve(ray([0,4.35,80],[70,4.35,0])),null,'background');
});
test('invalid IDs, overlapping zones, wrong sides and fabricated commercial data are rejected',()=>{
  for(const change of [
    d=>d.units[1].id=d.units[0].id,
    d=>d.units[0].side='lazer',
    d=>d.units[0].bounds.max[0]=0,
    d=>d.units[0].bounds.min[1]=NaN,
    d=>d.units[0].typology='canto',
    d=>d.units[0].plan2d='plantas2d/canto.jpg',
    d=>d.units[0].availability='disponivel',
    d=>d.units[0].commercialNumber='101',
  ]){const copy=structuredClone(data);change(copy);assert.throws(()=>validateUnits(copy));}
});
test('pilot cameras keep the whole selectable facade visible with little empty ground',()=>{
  for(const aspect of [.65,.8,1.65,2.5])for(const side of ['lazer','estacionamento']){
    const v=pilotFloorView(aspect,side),c=new PerspectiveCamera(v.fov,v.aspect,v.near,v.far);
    c.position.fromArray(v.position);c.lookAt(new Vector3().fromArray(v.target));c.updateMatrixWorld();
    const z=side==='lazer'?7.02:-7.02;
    for(const x of [-23.85,23.85])for(const y of [3.02,5.68]){
      const p=new Vector3(x,y,z).project(c);
      assert.ok(Math.abs(p.x)<.93&&Math.abs(p.y)<.99,'pilot facade outside the frame');
    }
    const ground=new Vector3(0,0,z).project(c);assert.ok(ground.y<-.65,'too much empty ground');
  }
  assert.throws(()=>pilotFloorView(0,'lazer'));assert.throws(()=>pilotFloorView(1,'norte'));
});
