import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../../../',import.meta.url);
vm.runInThisContext(fs.readFileSync(new URL('v1.5/renderizador-v16-moveis/lib/three.min.js',root),'utf8'));
vm.runInThisContext(fs.readFileSync(new URL('v1.5/renderizador-v16-moveis/urban-models.js',root),'utf8'));
const pack=JSON.parse(fs.readFileSync(new URL('modelos_urbanos/v1/mapa-casas.json',root),'utf8'));
assert.equal(pack.assets.length,60);
for(const a of pack.assets){
  const bytes=Buffer.from(a.p,'base64'),p=new Int16Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/2);
  for(let i=0;i<p.length;i+=3){
    assert(Math.abs(p[i]/100)<=a.size[0]/2+.011,a.id+' width');
    assert(Math.abs(p[i+2]/100)<=a.size[2]/2+.011,a.id+' depth');
    assert(p[i+1]/100>=-.011&&p[i+1]/100<=a.size[1]+.011,a.id+' height');
  }
}
const T=globalThis.THREE, U=globalThis.UrbanModels, parent=new T.Group(), lib=U.create(T,pack,parent);
const ring=[[-10,-12],[10,-12],[10,12],[-10,12]],ob={cx:0,cz:0,ux:0,uz:1,hu:12,hv:10,rect:1};
const record={h:5,fa:90,r:ring}, selected=lib.select(record,ob,ring,'casas');
assert(selected);assert.deepEqual(selected,lib.select(record,ob,ring,'casas'));
assert(U.containsRectangle(selected.corners,ring));
const varied=lib.select(record,ob,ring,'casas',[selected]);
assert(varied);assert.notEqual(varied.asset.id,selected.asset.id,'avoid repeating a nearby compatible variant');
assert.deepEqual(varied,lib.select(record,ob,ring,'casas',[selected]));
const tower=pack.assets.find(a=>a.category==='predios');
const tr=[[-40,-40],[40,-40],[40,40],[-40,40]],to={cx:0,cz:0,ux:0,uz:1,hu:40,hv:40,rect:1};
const towerRecord={h:tower.size[1]*1.15,fa:90,r:tr};
const towerChoice=lib.select(towerRecord,to,tr,'predios');assert(towerChoice);
assert.equal(towerChoice.asset.category,'predios');assert(Math.abs(towerChoice.asset.size[1]*towerChoice.scale/towerRecord.h-1)<=.2);
assert.equal(lib.select({...towerRecord,lancamento:true},to,tr,'predios'),null);
assert.equal(lib.select({...towerRecord,h:300},to,tr,'predios'),null);
for(const special of [{lancamento:true},{parede:0},{sacadas:true}])assert.equal(lib.select({...record,...special},ob,ring,'casas'),null);
assert(U.containsRectangle(lib.select(record,{...ob,rect:.5},ring,'casas').corners,ring));
assert.equal(lib.select(record,{...ob,hu:1,hv:1},ring,'casas'),null);
assert.equal(U.containsRectangle([[-4,-4],[4,-4],[4,4],[-4,4]],[[-5,-5],[5,-5],[5,5],[1,5],[1,0],[-1,0],[-1,5],[-5,5]]),false);
// A tiny legacy footprint must not miniaturize an otherwise full-size house.
const tinyRing=[[-2.3,-4],[2.3,-4],[2.3,4],[-2.3,4]],tinyOb={cx:0,cz:0,ux:0,uz:1,hu:4,hv:2.3,rect:1};
assert.equal(lib.select(record,tinyOb,tinyRing,'casas'),null);
const lotRecord={...record,urbanLot:[0,1,-2,0]};
const realSize=lib.select(lotRecord,tinyOb,tinyRing,'casas');
assert.equal(realSize.scale,1);assert.equal(realSize.x,1);assert.equal(realSize.z,-2);
assert.equal(realSize.asset.id,pack.assets[0].id);
assert(U.containsRectangle(realSize.corners,[[-5,-12.5],[5,-12.5],[5,12.5],[-5,12.5]]));
assert.equal(lib.select({...lotRecord,lancamento:true},tinyOb,tinyRing,'casas'),null);
const slots=Array.from({length:70},(_,i)=>lib.add({...selected,x:i*30},{...record,id:i},10));lib.flush();
assert.equal(lib.stats().instances,70);assert.equal(parent.children.length,2);
lib.remove(slots[2]);lib.remove(slots[2]);lib.flush();assert.equal(lib.stats().instances,69);
assert.equal(lib.hit({object:parent.children[0],instanceId:2}).id,69);
lib.transform(1,2);const matrix=new T.Matrix4();parent.children[0].getMatrixAt(0,matrix);
assert.equal(matrix.elements[13],10);assert(Math.abs(new T.Vector3().setFromMatrixScale(matrix).y-selected.scale*2)<1e-6);
parent.updateMatrixWorld(true);
const ray=new T.Raycaster(new T.Vector3(0,100,0),new T.Vector3(0,-1,0));
const hits=ray.intersectObjects(parent.children);assert(hits.length);assert.equal(lib.hit(hits[0]).id,0);
lib.clear();assert.equal(parent.children.length,0);assert.equal(lib.stats().instances,0);
lib.add(selected,record,0);lib.flush();assert.equal(lib.stats().instances,1);lib.dispose();
console.log('PASS: selection, footprint, protected records, pool growth, swap removal, height, relief, raycast, reload.');
