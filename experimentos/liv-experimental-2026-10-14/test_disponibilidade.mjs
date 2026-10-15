import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {Scene,Box3,Vector3} from 'three/webgpu';
import {availableUnitIds} from './disponibilidade.js';
import {expandBuildingCatalog} from './catalogo-unidades.js';
import {createUnitPicking} from './picking.js';
import {containsPoint} from './unit-footprint.js';

test('only explicit available records glow; unverified and unknown never imply an offer',()=>{
  const catalog={units:['disponivel','vendida','reservada','bloqueada','nao_informada',null].map((status,i)=>({
    id:String(i),availability:'disponivel',commercial:status?{availability:status}:null}))};
  assert.deepEqual(availableUnitIds(catalog),['0']);
  assert.deepEqual(availableUnitIds(catalog,{unverified:true}),[]);
  assert.deepEqual(availableUnitIds(null),[]);
});
for(const path of ['unidades.json','modelo/entrada/unidades-entrada.json']){
  test(`${path}: batched glow respects apartment contour, updates atomically and disposes`,()=>{
    const pilot=JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
    const catalog=expandBuildingCatalog(pilot),scene=new Scene();
    const picker=createUnitPicking({scene,catalog,canvas:{addEventListener(){},removeEventListener(){}},
      getFloor:()=>-1,getCamera:()=>null,onSelect(){}});
    const glow=picker.availability,unit=catalog.units[82],other=catalog.units[151];
    assert.equal(glow.group.visible,false);
    assert.equal(glow.setUnits([unit.id]),true);
    assert.deepEqual(glow.getState().ids,[unit.id]);
    assert.equal(glow.group.children.length,2);
    const mesh=glow.group.children[0],attribute=mesh.geometry.getAttribute('position');
    assert.equal(attribute.count%3,0);
    const bounds=new Box3().setFromBufferAttribute(attribute);
    assert.ok(bounds.min.distanceTo(new Vector3(...unit.bounds.min))<1e-5);
    assert.ok(bounds.max.distanceTo(new Vector3(...unit.bounds.max))<1e-5);
    if(unit.footprint)for(let i=0;i<attribute.count;i++){
      assert.ok(containsPoint(unit.footprint,attribute.getX(i),attribute.getZ(i),1e-4));
    }
    const builds=glow.stats.geometryBuilds;
    assert.equal(glow.setUnits([unit.id,unit.id]),false);
    assert.equal(glow.stats.geometryBuilds,builds);
    assert.throws(()=>glow.setUnits([other.id,'unknown']));
    assert.deepEqual(glow.getState().ids,[unit.id]);
    glow.setUnits(catalog.units.map(u=>u.id));assert.equal(glow.group.children.length,2);
    assert.equal(glow.getState().ids.length,170);
    glow.setUnits([other.id]);assert.deepEqual(glow.getState().ids,[other.id]);
    glow.setUnits([]);assert.equal(glow.group.visible,false);
    assert.equal(mesh.material.isMeshBasicMaterial,true);assert.equal(mesh.material.toneMapped,false);
    picker.dispose();assert.equal(scene.children.length,0);assert.equal(glow.setUnits([unit.id]),false);
  });
}
