import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {Ray,Vector3,Scene,PerspectiveCamera} from 'three/webgpu';
import {expandBuildingCatalog,unitsAtFloor,floorOf,floorLabel,unitScope} from './catalogo-unidades.js';
import {unitById} from './unidades.js';
import {createUnitResolver,createUnitPicking} from './picking.js';
import {buildingFacadeView} from './cameras.js';
for(const path of ['unidades.json','modelo/unidades-contorno.json','modelo/entrada/unidades-entrada.json']){
  const pilot=JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
  test(`${path}: 170 unique positions reconcile the 17 levels without modifying the pilot`,()=>{
    const before=JSON.stringify(pilot),data=expandBuildingCatalog(pilot);
    assert.equal(data.units.length,170);assert.equal(new Set(data.units.map(u=>u.id)).size,170);
    assert.equal(JSON.stringify(pilot),before);assert.equal(data.sourceModelSHA256,pilot.sourceModelSHA256);
    for(let floor=0;floor<=16;floor++){
      const units=unitsAtFloor(data,floor);assert.equal(units.length,10);
      for(const unit of units){
        assert.equal(floorOf(data,unit),floor);assert.equal(unitById(data,unit.id),unit);
        assert.equal(unit.bounds.min[1],Math.round((.17+floor*2.85)*1e6)/1e6);
        assert.equal(unit.bounds.max[1],Math.round((2.83+floor*2.85)*1e6)/1e6);
        assert.equal(unit.typology,null);assert.equal(unit.commercialNumber,null);assert.equal(unit.price,null);
        assert.equal(unit.availability,'nao_informada');assert.equal(unit.garden?.confidence??null,floor===0?'pendente':null);
      }
    }
    assert.equal(unitsAtFloor(data,1)[0].id,pilot.units[0].id);
    assert.equal(data.reconciliation.publishedUnits,data.reconciliation.technicalPositions);
    assert.equal(data.reconciliation.assignedParkingSpaces,0);
  });
  test(`${path}: first facade intersection resolves all 170 positions and excludes roof/circulation`,()=>{
    const data=expandBuildingCatalog(pilot),resolve=createUnitResolver(data);
    const ray=(a,b)=>new Ray(new Vector3(...a),new Vector3(...b).sub(new Vector3(...a)).normalize());
    for(const unit of data.units){
      const [a,b]=[unit.bounds.min,unit.bounds.max];
      const point=unit.pickPoint||[(a[0]+b[0])/2,(a[1]+b[1])/2,unit.side==='lazer'?b[2]:a[2]];
      assert.equal(resolve(ray([point[0],point[1],Math.sign(point[2])*90],point)),unit.id);
      assert.equal(resolve(ray([point[0],80,point[2]],point)),null);
    }
    assert.equal(resolve(ray([0,80,0],[0,0,0])),null);
  });
  test(`${path}: all floors share the pilot highlight buffers and respect the active floor`,()=>{
    let floor=1;
    const args={scene:new Scene(),canvas:{addEventListener(){},removeEventListener(){}},getCamera:()=>null,
      getFloor:()=>floor,onSelect(){}};
    const a=createUnitPicking({...args,catalog:pilot}),data=expandBuildingCatalog(pilot);
    const b=createUnitPicking({...args,catalog:data});
    assert.equal(b.highlight.children[0].geometry.attributes.position.count,a.highlight.children[0].geometry.attributes.position.count);
    assert.equal(b.highlight.children[1].geometry.attributes.position.count,a.highlight.children[1].geometry.attributes.position.count);
    for(const unit of data.units){
      floor=unit.floorIndex;b.select(unit.id);assert.equal(b.highlight.visible,true);
      assert.equal(b.highlight.position.y,(unit.bounds.min[1]+unit.bounds.max[1])/2);
      floor=-1;b.refresh();assert.equal(b.highlight.visible,false);
    }
    a.dispose();b.dispose();assert.equal(args.scene.children.length,0);
  });
}
test('scope is explicit and invalid or unconfirmed pilot inputs fail before expansion',()=>{
  assert.equal(unitScope('?unidades=edificio'),'edificio');assert.equal(unitScope('?unidades=__proto__'),'piloto');
  assert.equal(floorLabel(0),'Térreo');assert.equal(floorLabel(16),'16º pavimento tipo');
  assert.throws(()=>floorLabel(17));
  const pilot=JSON.parse(readFileSync(new URL('unidades.json',import.meta.url),'utf8'));
  pilot.units[0].typology='canto';assert.throws(()=>expandBuildingCatalog(pilot));
});
test('building mirror cameras frame the complete model facade in portrait and landscape',()=>{
  for(const aspect of [.6,1,1.65,2.5])for(const side of ['lazer','estacionamento']){
    const spec=buildingFacadeView(aspect,side),camera=new PerspectiveCamera(spec.fov,spec.aspect,spec.near,spec.far);
    camera.position.fromArray(spec.position);camera.lookAt(new Vector3().fromArray(spec.target));camera.updateMatrixWorld();
    for(const x of [-23.85,23.85])for(const y of [0,48.45]){
      const p=new Vector3(x,y,side==='lazer'?7.02:-7.02).project(camera);
      assert.ok(Math.abs(p.x)<.95&&Math.abs(p.y)<.95);
    }
  }
  assert.throws(()=>buildingFacadeView(0,'lazer'));
});
