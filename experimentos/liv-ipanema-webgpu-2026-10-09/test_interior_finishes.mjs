import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three/webgpu';
import {installCornice} from './interior-cornice.js';
import {createPlanCutaway} from './interior-cutaway.js';

test('o material novo do rodateto não substitui acabamentos compartilhados da Canto',()=>{
  const code=readFileSync(new URL('./interior-renderer.js',import.meta.url),'utf8');
  const functionCode=code.slice(code.indexOf('function sourceMaterialAdditions('),code.indexOf('async function materialsFrom('));
  const context=vm.createContext({});vm.runInContext(functionCode,context);
  const shared=JSON.parse(gunzipSync(readFileSync(new URL('./interiores/shared/materials.json.gz',import.meta.url))));
  const native=structuredClone(shared.materials),before=structuredClone(native);
  const source={materials:{...shared.materials,m6:{color:[1,1,1],emissiveIntensity:.6},m30:{name:'gesso-rodateto-liso',emissiveIntensity:0}},textures:shared.textures};
  const additions=context.sourceMaterialAdditions(source,native);Object.assign(native,additions.materials);
  assert.deepEqual(native.m6,before.m6);assert.deepEqual(Object.keys(additions.materials),['m30']);
  assert.equal(Object.keys(additions.textures).length,0);assert.equal(native.m30.emissiveIntensity,0);
});

test('rodateto fica nas paredes inteiras do 3D/Tour e acompanha somente o corte baixo',()=>{
  const scene=new THREE.Scene(),layout={pd:2.7,unit:{cores:{parede:'#eee7d9'}},
    rooms:[{poly:[[0,0],[4,0],[4,3],[0,3]]}],walls:[{a:[0,0],b:[4,0],y0:0,y1:2.7}]};
  const material=new THREE.MeshStandardMaterial(),roof=new THREE.Mesh(new THREE.BoxGeometry(4,.03,3),material);
  roof.name='forro-original';roof.position.set(2,2.715,1.5);scene.add(roof);
  const {meshes:[cornice]}=installCornice({scene,layout});
  const display=createPlanCutaway({scene,layout,architecture:[roof,cornice],wallMaterial:material,own:v=>v});
  display.setMode('planta3d');assert.equal(roof.visible,false);assert.equal(cornice.visible,true);
  assert.ok(cornice.parent.isClippingGroup);assert.equal(cornice.parent.enabled,false);
  display.setEnabled(true);assert.equal(cornice.parent.enabled,true);assert.equal(display.getState().active,true);
  display.setMode('visita');assert.equal(roof.visible,true);assert.equal(cornice.visible,true);assert.equal(cornice.parent.enabled,false);
  const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
  for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
});

test('tecido usa escala física compatível com Canto mesmo em caixas com UV normalizada',()=>{
  const source=readFileSync(new URL('./interior-renderer.js',import.meta.url),'utf8');
  const finish=source.slice(source.indexOf('function finishNativeFurniture('),source.indexOf('function bindFrozenFurniture('));
  const texture=new THREE.Texture(),material=new THREE.MeshStandardMaterial({map:texture});
  const context=vm.createContext({THREE,own:v=>v});vm.runInContext(finish,context);
  for(const tipo of ['sofa','cama','tapete']){
    const geometry=new THREE.BoxGeometry(2,.8,.9),group=new THREE.Group(),mesh=new THREE.Mesh(geometry,material);group.add(mesh);
    context.finishNativeFurniture(group,{tipo},{m18:material,m9:material,m21:material});
    const p=geometry.attributes.position,uv=geometry.attributes.uv,ids=geometry.index;
    for(let i=0;i<ids.count;i+=3){
      const [a,b,c]=[0,1,2].map(k=>ids.getX(i+k));
      const pa=new THREE.Vector3().fromBufferAttribute(p,a),pb=new THREE.Vector3().fromBufferAttribute(p,b),pc=new THREE.Vector3().fromBufferAttribute(p,c);
      const worldArea=pb.sub(pa).cross(pc.sub(pa)).length()/2;
      const uvArea=Math.abs((uv.getX(b)-uv.getX(a))*(uv.getY(c)-uv.getY(a))-(uv.getY(b)-uv.getY(a))*(uv.getX(c)-uv.getX(a)))/2;
      // The frozen Canto sofa has 3 cycles/metre; compare surface areas instead
      // of repeating the projection implementation or checking a flag.
      assert.ok(Math.abs(Math.sqrt(uvArea/worldArea)-3)<1e-5);
    }
    geometry.dispose();mesh.material.dispose();
  }
  material.dispose();texture.dispose();
});
