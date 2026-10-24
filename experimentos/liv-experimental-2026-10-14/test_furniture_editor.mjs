import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import vm from 'node:vm';
import * as THREE from 'three/webgpu';
import {dimensionsOf,validFurnitureDimensions,sameFurnitureDimensions} from './furniture-editor.js';

test('medidas rejeitam valores inválidos e respeitam o teto sem perder a altura de tapetes',()=>{
  assert.equal(validFurnitureDimensions({w:2,d:.6,h:2.4},2.6),true);
  assert.equal(validFurnitureDimensions({w:2,d:1.6,h:.02},2.6),true);
  for(const value of [null,{w:NaN,d:.6,h:1},{w:Infinity,d:.6,h:1},{w:0,d:.6,h:1},{w:4,d:.6,h:1},{w:1,d:-1,h:1},{w:1,d:1,h:3}])
    assert.equal(validFurnitureDimensions(value,2.6),false);
  assert.equal(sameFurnitureDimensions({w:2,h:1,d:.6},{w:2,h:1,d:.6}),true);
  assert.equal(sameFurnitureDimensions({w:2.2,h:1,d:.6},{w:2,h:1,d:.6}),false);
});

const source=readFileSync(new URL('./interior-renderer.js',import.meta.url),'utf8');
const runtime=readFileSync(new URL('./interiores/shared/runtime.js',import.meta.url),'utf8');
const library=JSON.parse(gunzipSync(readFileSync(new URL('./interiores/shared/furniture.json.gz',import.meta.url))));

test('largura reconstrói portas e assentos e restaurar recupera a malha congelada',async()=>{
  const root={};vm.runInNewContext(runtime,{globalThis:root});
  let catalog;const material=new THREE.MeshStandardMaterial({vertexColors:true});
  const params=root.FurnitureParam.create({THREE,getLib:()=>catalog?.MOVEIS_LIB||{},rgbDe:()=>[150,130,100]});
  catalog=root.FurnitureCatalog.create({THREE,document:{getElementById:()=>({textContent:JSON.stringify(library)})},rgbDe:()=>[150,130,100],getMaterial:()=>material,...params});
  const smallSofa=catalog.geoDoMovel(catalog.MOVEIS.sofa,0x555555,{w:1.2,h:.8,d:.9});
  const largeSofa=catalog.geoDoMovel(catalog.MOVEIS.sofa,0x555555,{w:3,h:.8,d:.9});
  assert.ok(largeSofa.children[0].geometry.attributes.position.count>smallSofa.children[0].geometry.attributes.position.count,'Quantidade de assentos deve responder à largura.');
  smallSofa.children[0].geometry.dispose();largeSofa.children[0].geometry.dispose();
  const scene=new THREE.Scene(),original=new THREE.Group();original.add(new THREE.Mesh(new THREE.BoxGeometry(2,2,.6),material));scene.add(original);
  const item={id:'movel-0',tipo:'guardaroupa',cor:0xeeeeee,w:2,h:2,d:.6,originalDimensions:{w:2,h:2,d:.6},group:original,baseRotation:0,originalRotation:1,rotation:1,position:[1,2]};
  let bakedActive=true;const released=[];
  const context=vm.createContext({THREE,scene,furnitureFactory:{catalog},furnitureMaterials:{},framePromise:Promise.resolve(),sameFurnitureDimensions,
    setBaked:active=>bakedActive=active,release:r=>released.push(r),registerTree(){},
    finishNativeFurniture(){},item});
  vm.runInContext(source.slice(source.indexOf('function furnitureTransform('),source.indexOf('function furnitureChanged('))+source.slice(source.indexOf('function disposeEditedGroup('),source.indexOf('state.resizeFurniture=')),context);
  assert.equal(vm.runInContext('resizeFurniture(item,{w:3,h:2,d:.6})',context),true);
  const wider=item.group,largeCount=wider.children[0].geometry.attributes.position.count;
  assert.notEqual(wider,original);assert.equal(item.w,3);assert.equal(bakedActive,false);
  assert.equal(wider.rotation.y,Math.PI/2);assert.deepEqual(wider.scale.toArray(),[1,1,1]);
  assert.equal(vm.runInContext('resizeFurniture(item,{w:1,h:2,d:.6})',context),true);
  assert.ok(item.group.children[0].geometry.attributes.position.count<largeCount,'Quantidade de portas deve responder à largura.');
  assert.equal(vm.runInContext('resizeFurniture(item,item.originalDimensions)',context),true);
  assert.equal(item.group,original);assert.equal(item.baseRotation,0);assert.deepEqual(dimensionsOf(item),item.originalDimensions);
  await new Promise(resolve=>setImmediate(resolve));assert.ok(released.length>=2);
  for(const resource of new Set(released))resource.dispose();material.dispose();original.children[0].geometry.dispose();
});

test('Concluir espera a imagem pendente, atualiza sombras e retoma a cena também após falha',async()=>{
  for(const fail of [false,true]){
    const calls=[],state={ready:true,active:true,disposed:false,lighting:{bakedActive:false}};
    const renderer={setAnimationLoop:loop=>calls.push(loop?'resume':'pause'),compileAsync:async()=>calls.push('compile'),
      renderAsync:async()=>{calls.push('render');if(fail)throw Error('GPU indisponível');}};
    const context=vm.createContext({state,renderer,camera:{},framePromise:Promise.resolve().then(()=>calls.push('pending')),
      check(){},scene:{updateMatrixWorld:()=>calls.push('world')},navigation:{invalidate:()=>calls.push('routes')},
      invalidateShadows:()=>calls.push('shadows'),renderFrame(){}});
    vm.runInContext(source.slice(source.indexOf('state.finishFurnitureEditing='),source.indexOf('\nfunction addLights(')),context);
    if(fail)await assert.rejects(state.finishFurnitureEditing(),/GPU/);else assert.equal(await state.finishFurnitureEditing(),true);
    assert.equal(calls[0],'pause');assert.equal(calls.at(-1),'resume');
    assert.ok(calls.indexOf('pending')<calls.indexOf('render'));
    assert.ok(calls.indexOf('shadows')<calls.indexOf('render'));
    assert.equal(state.lighting.bakedActive,false,'Concluir deve conservar a luz dinâmica do layout editado.');
  }
});
