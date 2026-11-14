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
  test(`${path}: facade taps resolve the floor without selecting it first; drag and multitouch do not pick`,()=>{
    const data=expandBuildingCatalog(pilot),camera=new PerspectiveCamera(45,800/600,.1,500),events=new Map(),selected=[];
    let floor=-1;
    const canvas={getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}),
      addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)};
    const picking=createUnitPicking({scene:new Scene(),canvas,catalog:data,getCamera:()=>camera,getFloor:()=>floor,onSelect:id=>selected.push(id)});
    for(const unit of data.units){
      const a=unit.bounds.min,b=unit.bounds.max,point=unit.pickPoint??[(a[0]+b[0])/2,(a[1]+b[1])/2,unit.side==='lazer'?b[2]:a[2]];
      camera.position.set(point[0],point[1],Math.sign(point[2])*90);camera.lookAt(new Vector3(...point));camera.updateMatrixWorld();
      assert.equal(picking.pick(400,300),unit.id);floor=1;
      assert.equal(picking.pick(400,300),unit.id,'A highlighted floor must not lock facade picking.');floor=-1;
    }
    const event=(id,x=400,y=300,primary=true)=>({pointerId:id,clientX:x,clientY:y,isPrimary:primary,button:0});
    const queries=picking.stats.pickQueries;
    events.get('pointerdown')(event(1));events.get('pointermove')(event(1,430));events.get('pointerup')(event(1,430));
    events.get('pointerdown')(event(1));events.get('pointerdown')(event(2,410,300,false));
    events.get('pointerup')(event(2,410,300,false));events.get('pointerup')(event(1));
    assert.equal(picking.stats.pickQueries,queries);assert.deepEqual(selected,[]);
    events.get('pointerdown')(event(1));events.get('pointerup')(event(1));assert.equal(selected[0],data.units.at(-1).id);
    picking.dispose();assert.equal(events.size,0);
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
  const bounds={min:[-23,-1,-8],max:[23,55,8]};
  for(const aspect of [.6,1,1.65,2.5])for(const side of ['lazer','estacionamento']){
    const s=buildingFacadeView(aspect,side,bounds),c=new PerspectiveCamera(s.fov,s.aspect,s.near,s.far);
    c.position.fromArray(s.position);c.lookAt(new Vector3().fromArray(s.target));c.updateMatrixWorld();
    for(const x of [bounds.min[0],bounds.max[0]])for(const y of [bounds.min[1],bounds.max[1]])for(const z of [bounds.min[2],bounds.max[2]]){
      const p=new Vector3(x,y,z).project(c);assert.ok(Math.abs(p.x)<.99&&Math.abs(p.y)<.99);
    }
  }
  assert.throws(()=>buildingFacadeView(1,'lazer',{min:[0,0,0],max:[1,1,NaN]}));
});
