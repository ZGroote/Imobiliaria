import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../node_modules/three/build/three.webgpu.js';
import {fitImprovedFurniture,loadInteriorImprovements} from '../interior-melhorias.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} ≈ ${b}`);
function model(name='PBR aprovado'){
  const root=new THREE.Group(),material=new THREE.MeshStandardMaterial({name,color:0xa7b2b8,roughness:.31,metalness:.2});
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,1,1),material);mesh.position.set(3,.5,-2);root.add(mesh);return root;
}
function blankGLB(){
  const json=new TextEncoder().encode('{"asset":{"version":"2.0"}} '),bytes=new ArrayBuffer(20+json.length),view=new DataView(bytes);
  view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,bytes.byteLength,true);view.setUint32(12,json.length,true);view.setUint32(16,0x4e4f534a,true);
  new Uint8Array(bytes,20).set(json);return bytes;
}
function geometricGLB(){
  const positions=new Float32Array([0,0,0,1,0,0,0,1,0,0,0,0,0,1,0,0,0,1]);
  const metadata={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],
    buffers:[{byteLength:positions.byteLength}],bufferViews:[{buffer:0,byteOffset:0,byteLength:positions.byteLength}],
    accessors:[{bufferView:0,componentType:5126,count:6,type:'VEC3',min:[0,0,0],max:[1,1,1]}],
    materials:[{name:'PBR efetivo',pbrMetallicRoughness:{baseColorFactor:[.2,.3,.4,1],metallicFactor:.4,roughnessFactor:.3}}]};
  const raw=new TextEncoder().encode(JSON.stringify(metadata)),length=Math.ceil(raw.length/4)*4;
  const bytes=new ArrayBuffer(28+length+positions.byteLength),view=new DataView(bytes);
  view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,bytes.byteLength,true);view.setUint32(12,length,true);view.setUint32(16,0x4e4f534a,true);
  new Uint8Array(bytes,20,length).fill(32);new Uint8Array(bytes,20,raw.length).set(raw);
  view.setUint32(20+length,positions.byteLength,true);view.setUint32(24+length,0x004e4942,true);new Uint8Array(bytes,28+length).set(new Uint8Array(positions.buffer));return bytes;
}
function smallHDR(pixels=[128,96,64,129,64,96,128,129]){
  const header=new TextEncoder().encode('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 1 +X 2\n'),hdr=new Uint8Array(header.length+8);
  hdr.set(header);hdr.set(pixels,header.length);return hdr;
}

test('carrega dependências da tipologia e conserva alternativas compatíveis de fallback',async()=>{
  const asset=(id,types=[],extra={})=>({id,path:id+'.glb',types,dimensions:{w:1,h:1,d:1},...extra});
  const catalog={schema:'liv-interior-improvements-v1',assets:[
    asset('sofa',['sofa']),asset('sofa-especifico',['sofa'],{replaces:['movel-1']}),
    asset('sofa-canto',['sofa'],{typology:'canto'}),asset('armario',['guardaroupa']),
    asset('parede'),asset('decor-meio'),asset('decor-canto')],
    materialOverrides:[{assetId:'parede',target:'wall',materialName:'PBR aprovado'}],
    decorations:[{assetId:'decor-meio',typology:'meio',position:[0,0,0]},{assetId:'decor-canto',typology:'canto',position:[0,0,0]}]};
  const asked=[],owned=new Set();
  const library=await loadInteriorImprovements({base:new URL('https://example.invalid/liv/'),typology:'meio',items:[{id:'movel-1',tipo:'sofa',name:'Sofá'}],
    own:value=>{owned.add(value);return value;},
    fetchImpl:async url=>String(url).endsWith('catalogo.json')?{ok:true,json:async()=>catalog}:{ok:true,arrayBuffer:async()=>{asked.push(new URL(url).pathname.split('/').at(-1));return blankGLB();}},
    parseGLB:async()=>({scene:model()})});
  assert.deepEqual(asked.sort(),['decor-meio.glb','parede.glb','sofa-especifico.glb','sofa.glb']);
  assert.equal(library.getState().assets,4);assert.equal(library.getState().loaded,4);
  for(const resource of owned)resource.dispose?.();
});

test('GLB preserva centro, base, giro e footprint cadastral com PBR independente por instância',()=>{
  const template=model(),source=template.children[0],owned=new Set();
  const item={id:'movel-7',name:'Sofá',position:[-1.2,2.7],rotation:3,w:1.95,h:.8,d:.9};
  const group=fitImprovedFurniture(template,item,item,{asset:{id:'sofa'},own:value=>{owned.add(value);return value;}});
  group.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(group),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  near(center.x,item.position[0]);near(center.z,item.position[1]);near(box.min.y,.03);
  near(size.x,item.d);near(size.z,item.w);near(size.y,item.h);near(group.rotation.y,3*Math.PI/2);
  let instance;group.traverse(mesh=>{if(mesh.isMesh)instance=mesh;});
  assert.equal(instance.geometry,source.geometry);assert.notEqual(instance.material,source.material);
  assert.equal(instance.material.color.getHex(),source.material.color.getHex());assert.equal(instance.material.roughness,.31);
  assert.equal(instance.userData.furnitureId,item.id);assert.equal(instance.castShadow,true);assert.equal(instance.receiveShadow,true);
  const resized=fitImprovedFurniture(template,item,{w:2.2,h:.9,d:1},{asset:{id:'sofa'}});
  assert.equal(resized.children[0].children[0].children[0].geometry,instance.geometry);
  assert.equal(template.children[0].position.x,3,'O template aprovado não muda ao editar a instância.');
  for(const resource of owned)resource.dispose();
  resized.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.dispose();mesh.material.dispose();}});source.geometry.dispose();source.material.dispose();
});

test('referência do tampo preserva torneira e prateleira acima da altura cadastral da pia',()=>{
  const template=model(),item={id:'pia',position:[0,0],rotation:0};
  const group=fitImprovedFurniture(template,item,{w:2.1,h:.92,d:.6},{asset:{fitHeightReference:.54}});
  group.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(group);
  near(box.max.y-box.min.y,.92/.54);near(box.min.y,.03);
  group.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.dispose();mesh.material.dispose();}});
  template.children[0].geometry.dispose();template.children[0].material.dispose();
});

test('biblioteca aplica modelos e acabamentos, conserva bancadas e exclui luzes importadas',async()=>{
  const assets=[
    {id:'sofa',path:'sofa.glb',types:['sofa'],dimensions:{w:2,h:1,d:1}},
    {id:'mesa',path:'mesa.glb',types:['mesa'],namePattern:'jantar|varanda',dimensions:{w:2,h:1,d:1}},
    {id:'acabamentos',path:'acabamentos.glb',types:[],dimensions:{w:2,h:1,d:1}},
  ];
  const catalog={schema:'liv-interior-improvements-v1',assets,materialOverrides:[{target:'wall',assetId:'acabamentos',materialName:'PBR aprovado'}],
    decorations:[{assetId:'sofa',anchorType:'sofa',offset:[.5,1.2,-.8],yaw:Math.PI/2,dimensions:{w:.4,h:.6,d:.3}}]},statuses=[],owned=new Set(),templates=[];
  const library=await loadInteriorImprovements({base:new URL('https://example.invalid/liv/'),own:value=>{owned.add(value);return value;},onStatus:value=>statuses.push(value),
    fetchImpl:async url=>String(url).endsWith('catalogo.json')?{ok:true,json:async()=>catalog}:{ok:true,arrayBuffer:async()=>blankGLB()},
    parseGLB:async()=>{const scene=model();scene.add(new THREE.DirectionalLight(),new THREE.PerspectiveCamera());templates.push(scene);return {scene};}});
  assert.ok(templates.every(root=>root.children.every(object=>!object.isLight&&!object.isCamera)));
  const scene=new THREE.Scene(),furniture=[
    {id:'sofa-1',tipo:'sofa',name:'Sofá',position:[0,0],rotation:2,originalRotation:2,w:1.75,h:.8,d:.8,group:new THREE.Group()},
    {id:'mesa-1',tipo:'mesa',name:'Mesa de jantar',position:[1,2],rotation:0,originalRotation:0,w:1.2,h:.76,d:.9,group:new THREE.Group()},
    {id:'mesa-2',tipo:'mesa',name:'Bancada do dormitório',position:[3,3],rotation:2,originalRotation:2,w:1.5,h:.74,d:.35,group:new THREE.Group()},
  ];
  for(const item of furniture)scene.add(item.group);
  const oldDesk=furniture[2].group;assert.equal(library.replaceFurniture(furniture,scene),2);assert.equal(furniture[2].group,oldDesk);
  assert.equal(furniture[0].baseRotation,2);assert.equal(furniture[0].improvementAsset,'sofa');
  const native={m0:new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true})},ceiling=new THREE.Mesh(new THREE.BoxGeometry(1,.1,1),native.m0);
  ceiling.name='forro-original';scene.add(ceiling);const before=native.m0.color.getHex();
  assert.equal(library.applyFinishes(native,scene),1);assert.equal(native.m0.color.getHex(),0xa7b2b8);assert.equal(native.m0.vertexColors,false);
  assert.notEqual(ceiling.material.color.getHex(),before);assert.equal(ceiling.material.color.getHex(),0xa7b2b8);assert.equal(ceiling.material,native.m0);
  assert.equal(library.getState().status,'ready');assert.equal(library.getState().loaded,3);assert.equal(statuses.at(-1).finishes,1);
  assert.equal(library.addDecorations(furniture,scene,'canto'),1);
  const decoration=scene.children.find(group=>group.userData.livImprovementDecoration);
  near(decoration.position.x,-.5);near(decoration.position.y,1.23);near(decoration.position.z,.8);near(decoration.rotation.y,3*Math.PI/2);
  const objects=scene.children.length;assert.equal(library.addDecorations(furniture,scene,'canto'),1);assert.equal(scene.children.length,objects);
  for(const resource of owned)resource.dispose?.();native.m0.dispose();ceiling.geometry.dispose();
});

test('criado gravado com giro 0 olha para onde a cama vizinha olha; o longe da cama fica como veio',async()=>{
  const catalog={schema:'liv-interior-improvements-v1',assets:[{id:'criado',path:'criado.glb',types:['criado'],dimensions:{w:.45,h:.55,d:.4}}]};
  const library=await loadInteriorImprovements({base:new URL('https://example.invalid/liv/'),
    fetchImpl:async url=>String(url).endsWith('catalogo.json')?{ok:true,json:async()=>catalog}:{ok:true,arrayBuffer:async()=>blankGLB()},
    parseGLB:async()=>({scene:model()})});
  const scene=new THREE.Scene(),furniture=[
    {id:'cama',tipo:'cama',name:'Cama da suíte',position:[3.6,.25],rotation:3,originalRotation:3,w:1.5,h:.95,d:1.9,group:new THREE.Group()},
    {id:'perto',tipo:'criado',name:'Criado 1',position:[4.5,-.75],rotation:0,originalRotation:0,w:.4,h:.55,d:.4,group:new THREE.Group()},
    {id:'longe',tipo:'criado',name:'Criado 2',position:[0,0],rotation:0,originalRotation:0,w:.4,h:.55,d:.4,group:new THREE.Group()},
  ];
  for(const item of furniture)scene.add(item.group);
  assert.equal(library.replaceFurniture(furniture,scene),2);
  assert.equal(furniture[1].rotation,3);assert.equal(furniture[1].originalRotation,3);near(furniture[1].group.rotation.y,3*Math.PI/2);
  assert.equal(furniture[2].rotation,0);
});

test('móvel de uma planta só entra nela; guarda-roupa vira a frente para longe da parede',async()=>{
  const catalog={schema:'liv-interior-improvements-v1',assets:[
    {id:'criado-canto',path:'a.glb',types:['criado'],typology:'canto',dimensions:{w:.45,h:.55,d:.4}},
    {id:'criado-meio',path:'b.glb',types:['criado'],typology:'meio',dimensions:{w:.45,h:.55,d:.4}},
    {id:'armario',path:'c.glb',types:['guardaroupa'],dimensions:{w:1.5,h:2.2,d:.6}}]};
  const library=await loadInteriorImprovements({base:new URL('https://example.invalid/liv/'),
    fetchImpl:async url=>String(url).endsWith('catalogo.json')?{ok:true,json:async()=>catalog}:{ok:true,arrayBuffer:async()=>blankGLB()},
    parseGLB:async()=>({scene:model()})});
  // Parede logo atrás de z=+0,3: com giro 0 (frente +Z) o armário abriria para ela.
  const wall=new THREE.Mesh(new THREE.PlaneGeometry(6,3),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));wall.position.set(0,1.5,.3);
  const far=new THREE.Mesh(new THREE.PlaneGeometry(6,3),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));far.position.set(0,1.5,-3);
  const scene=new THREE.Scene();scene.add(wall,far);
  const furniture=[
    {id:'criado',tipo:'criado',name:'Criado',position:[2,2],rotation:0,originalRotation:0,w:.4,h:.55,d:.4,group:new THREE.Group()},
    {id:'armario',tipo:'guardaroupa',name:'Armário da suíte',position:[0,0],rotation:0,originalRotation:0,w:2.15,h:2.35,d:.4,group:new THREE.Group()},
  ];
  for(const item of furniture)scene.add(item.group);
  assert.equal(library.replaceFurniture(furniture,scene,'meio',[wall,far]),2);
  assert.equal(furniture[0].improvementAsset,'criado-meio');
  assert.equal(furniture[1].rotation,2);near(furniture[1].group.rotation.y,Math.PI);
});

test('falha de GLB fica registrada no estado e no callback visível, sem trocar o móvel original',async()=>{
  const catalog={schema:'liv-interior-improvements-v1',assets:[{id:'sofa',path:'sofa.glb',types:['sofa'],dimensions:{w:2,h:1,d:1}}]},statuses=[];
  const library=await loadInteriorImprovements({base:new URL('https://example.invalid/liv/'),onStatus:value=>statuses.push(value),
    fetchImpl:async url=>String(url).endsWith('catalogo.json')?{ok:true,json:async()=>catalog}:{ok:false,status:404}});
  assert.equal(library.getState().status,'error');assert.equal(library.getState().errors[0].assetId,'sofa');assert.equal(statuses.at(-1).errors.length,1);
  const item={id:'sofa',tipo:'sofa',position:[0,0],w:2,h:1,d:1,group:new THREE.Group()},scene=new THREE.Scene();scene.add(item.group);
  assert.equal(library.replaceFurniture([item],scene),0);assert.equal(scene.children[0],item.group);
});

test('catálogo malformado mantém fallback utilizável e erro observável',async()=>{
  const library=await loadInteriorImprovements({base:new URL('https://example.invalid/liv/'),fetchImpl:async()=>({ok:true,json:async()=>({schema:'invalido'})})});
  assert.equal(library.getState().status,'error');assert.equal(library.createFurniture({tipo:'sofa'}),null);
  assert.equal(library.applyFinishes({},new THREE.Scene()),0);
});

test('GLTFLoader real lê o GLB em CPU e conserva os fatores PBR do Blender',async()=>{
  const catalog={schema:'liv-interior-improvements-v1',assets:[{id:'sofa',path:'sofa.glb',types:['sofa'],dimensions:{w:1,h:1,d:1}}]},owned=new Set();
  const library=await loadInteriorImprovements({base:new URL('https://example.invalid/liv/'),own:value=>{owned.add(value);return value;},
    fetchImpl:async url=>String(url).endsWith('catalogo.json')?{ok:true,json:async()=>catalog}:{ok:true,arrayBuffer:async()=>geometricGLB()}});
  assert.deepEqual(library.getState().errors,[]);assert.equal(library.getState().loaded,1);
  const group=library.createFurniture({id:'movel-7',tipo:'sofa',position:[1,2],rotation:1,w:1.95,h:.8,d:.9});
  let material;group.traverse(mesh=>{if(mesh.isMesh)material=mesh.material;});
  assert.equal(material.name,'PBR efetivo');near(material.color.r,.2);near(material.color.g,.3);near(material.color.b,.4);near(material.roughness,.3);near(material.metalness,.4);
  assert.equal(material.lightMap,null);for(const resource of owned)resource.dispose?.();
});

test('ambiente HDR aprovado é carregado e registrado sem criar luzes ou ajustar exposição',async()=>{
  const hdr=smallHDR();
  const catalog={schema:'liv-interior-improvements-v1',assets:[{id:'sofa',path:'sofa.glb',types:['sofa'],dimensions:{w:1,h:1,d:1}}],environment:{path:'ceu.hdr',bytes:hdr.byteLength,sourceExposureEV:3}},owned=new Set();
  const library=await loadInteriorImprovements({base:new URL('https://example.invalid/liv/'),own:value=>{owned.add(value);return value;},
    fetchImpl:async url=>String(url).endsWith('catalogo.json')?{ok:true,json:async()=>catalog}:{ok:true,arrayBuffer:async()=>String(url).endsWith('.hdr')?hdr.buffer:geometricGLB()}});
  assert.equal(library.getState().status,'ready');assert.equal(library.environment.isDataTexture,true);
  assert.deepEqual(library.getState().environment,{loaded:true,path:'ceu.hdr',width:2,height:1});
  assert.equal(library.environment.colorSpace,THREE.LinearSRGBColorSpace);assert.equal(library.environment.mapping,THREE.EquirectangularReflectionMapping);
  assert.equal(library.backgroundEnvironment,library.environment,'Catálogo legado usa o mesmo HDR para luz indireta e fundo.');
  assert.equal(library.getState().background.fallback,true);assert.equal(library.environmentExposureEV,null,'EV antigo não aplica conversão de probe local.');
  assert.ok(owned.has(library.environment));for(const resource of owned)resource.dispose?.();
});

test('probe e céu distintos carregam dois HDRs reais e cada recurso é descartado uma vez',async()=>{
  const probe=smallHDR([64,32,16,126,32,16,8,126]),sky=smallHDR();
  const catalog={schema:'liv-interior-improvements-v1',assets:[{id:'sofa',path:'sofa.glb',types:['sofa'],dimensions:{w:1,h:1,d:1}}],
    environment:{path:'ambiente-interior.hdr',bytes:probe.byteLength,kind:'local-interior-radiance-probe',sourceExposureEV:3,outputExposureEV:1},background:{path:'ceu.hdr',bytes:sky.byteLength}},
    owned=new Set(),fetches=[];
  const library=await loadInteriorImprovements({base:new URL('https://example.invalid/liv/'),own:value=>{owned.add(value);return value;},
    fetchImpl:async url=>{const path=new URL(url).pathname;fetches.push(path);return path.endsWith('catalogo.json')?{ok:true,json:async()=>catalog}:
      {ok:true,arrayBuffer:async()=>path.endsWith('ambiente-interior.hdr')?probe.buffer:path.endsWith('ceu.hdr')?sky.buffer:geometricGLB()};}});
  assert.equal(library.getState().status,'ready');assert.notEqual(library.environment,library.backgroundEnvironment);
  assert.notDeepEqual(library.environment.image.data,library.backgroundEnvironment.image.data);
  assert.equal(library.environmentExposureEV,2);assert.equal(library.getState().environmentExposureEV,2);
  assert.equal(fetches.filter(path=>path.endsWith('.hdr')).length,2);assert.equal(library.getState().background.path,'ceu.hdr');
  let disposedProbe=0,disposedSky=0;library.environment.addEventListener('dispose',()=>disposedProbe++);library.backgroundEnvironment.addEventListener('dispose',()=>disposedSky++);
  for(const resource of owned)resource.dispose?.();assert.equal(disposedProbe,1);assert.equal(disposedSky,1);
});

test('URLs HDR iguais compartilham textura, download e ownership mesmo com caminhos equivalentes',async()=>{
  const hdr=smallHDR(),catalog={schema:'liv-interior-improvements-v1',assets:[{id:'sofa',path:'sofa.glb',types:['sofa'],dimensions:{w:1,h:1,d:1}}],
    environment:{path:'interiores/melhorias/ceu.hdr',bytes:hdr.byteLength},background:{path:'ceu.hdr',bytes:hdr.byteLength}},owned=new Set(),ownCalls=[],fetches=[];
  const library=await loadInteriorImprovements({base:new URL('https://example.invalid/liv/'),own:value=>{owned.add(value);ownCalls.push(value);return value;},
    fetchImpl:async url=>{const path=new URL(url).pathname;fetches.push(path);return path.endsWith('catalogo.json')?{ok:true,json:async()=>catalog}:{ok:true,arrayBuffer:async()=>path.endsWith('.hdr')?hdr.buffer:geometricGLB()};}});
  assert.equal(library.getState().status,'ready');assert.equal(library.backgroundEnvironment,library.environment);
  assert.equal(fetches.filter(path=>path.endsWith('.hdr')).length,1);assert.equal(ownCalls.filter(resource=>resource===library.environment).length,1);
  let disposed=0;library.environment.addEventListener('dispose',()=>disposed++);for(const resource of owned)resource.dispose?.();assert.equal(disposed,1);
});

test('falha do fundo é visível e preserva o probe carregado como fallback',async()=>{
  const hdr=smallHDR(),catalog={schema:'liv-interior-improvements-v1',assets:[{id:'sofa',path:'sofa.glb',types:['sofa'],dimensions:{w:1,h:1,d:1}}],
    environment:{path:'ambiente-interior.hdr',bytes:hdr.byteLength},background:{path:'ceu.hdr'}},owned=new Set();
  const library=await loadInteriorImprovements({base:new URL('https://example.invalid/liv/'),own:value=>{owned.add(value);return value;},
    fetchImpl:async url=>{const path=new URL(url).pathname;return path.endsWith('catalogo.json')?{ok:true,json:async()=>catalog}:path.endsWith('ceu.hdr')?{ok:false,status:404}:
      {ok:true,arrayBuffer:async()=>path.endsWith('.hdr')?hdr.buffer:geometricGLB()};}});
  assert.equal(library.getState().status,'partial');assert.equal(library.getState().errors[0].assetId,'background');
  assert.equal(library.backgroundEnvironment,library.environment);assert.equal(library.getState().background.fallback,true);
  for(const resource of owned)resource.dispose?.();
});

test('escala autoral e pose do Canto são preservadas; Meio adapta a razão e editor parte do bbox canônico',async()=>{
  const asset={id:'sofa',path:'sofa.glb',types:['sofa'],dimensions:{w:2,h:1,d:1},referenceFootprintCanto:{w:2.6,h:.8,d:1.5},
    source:{positionThree:[1.2,.025,2.025],rotationQuarterTurns:3}},catalog={schema:'liv-interior-improvements-v1',assets:[asset]},owned=new Set();
  const library=await loadInteriorImprovements({base:new URL('https://example.invalid/liv/'),own:value=>{owned.add(value);return value;},
    fetchImpl:async url=>String(url).endsWith('catalogo.json')?{ok:true,json:async()=>catalog}:{ok:true,arrayBuffer:async()=>blankGLB()},parseGLB:async()=>({scene:model()})});
  const canto={id:'canto',tipo:'sofa',name:'Sofá',position:[9,9],rotation:0,originalRotation:0,w:2.6,h:.8,d:1.5,group:new THREE.Group()},scene=new THREE.Scene();scene.add(canto.group);
  library.replaceFurniture([canto],scene,'canto');assert.deepEqual(canto.originalDimensions,{w:2,h:1,d:1});assert.deepEqual(canto.originalPosition,[1.2,2.025]);assert.equal(canto.originalRotation,3);near(canto.group.position.y,.025);
  const cantoBox=new THREE.Box3().setFromObject(canto.group).getSize(new THREE.Vector3());near(cantoBox.x,1);near(cantoBox.z,2);
  assert.equal(canto.w,2,'Largura canônica não pode receber o bbox mundial girado de1m.');assert.equal(canto.d,1);
  const meio={id:'meio',tipo:'sofa',name:'Sofá',position:[-2,1],rotation:2,originalRotation:2,w:1.8,h:.8,d:1,group:new THREE.Group()};scene.add(meio.group);
  library.replaceFurniture([meio],scene,'meio');near(meio.w,2*1.8/2.6);near(meio.h,1);near(meio.d,1/1.5);assert.deepEqual(meio.position,[-2,1]);assert.equal(meio.rotation,2);
  const edited=library.createFurniture(canto,{w:2.2,h:1,d:1}),size=new THREE.Box3().setFromObject(edited).getSize(new THREE.Vector3());near(size.z,2.2);near(size.x,1);near(edited.position.y,.025);
  for(const resource of owned)resource.dispose?.();
});

test('snapshot legado não desfaz móveis aprovados, mas restaura mudanças reais do usuário',()=>{
  const source=readFileSync(new URL('../interior-renderer.js',import.meta.url),'utf8');
  const fragment=source.slice(source.indexOf('state.restoreState=function('),source.indexOf('state.capture=async function('));
  for(const modified of [false,true]){
    const item={id:'fogao',improvementAsset:'fogao',w:.46,h:.9,d:.58,position:[1,2],rotation:3},calls=[];
    const state={ready:true,setMode:()=>true},snapshot={typology:'canto',unitSHA256:'unit',sourceSHA256:'source',mode:'planta3d',furniture:[{id:'fogao',position:[3,4],rotation:1,w:.6,h:.92,d:.6,modified}]};
    const context=vm.createContext({state,typology:'canto',record:{unitSHA256:'unit',sourceSHA256:'source'},improvements:{getState:()=>({revision:'nova'})},furniture:[item],layout:{pd:2.7},
      resizeFurniture:(item,dimensions)=>{Object.assign(item,dimensions);calls.push('resize');return true;},dimensionsOf:item=>({w:item.w,h:item.h,d:item.d}),
      validFurnitureDimensions:()=>true,furnitureTransform:()=>calls.push('transform'),furnitureChanged:()=>calls.push('changed')});
    vm.runInContext(fragment,context);assert.equal(state.restoreState(snapshot),true);
    if(modified){assert.equal(item.w,.6);assert.deepEqual(Array.from(item.position),[3,4]);assert.equal(calls.length,3);}
    else{assert.equal(item.w,.46);assert.deepEqual(item.position,[1,2]);assert.deepEqual(calls,[]);}
  }
});

test('um template de cadeira mantém seis poses distintas e aceita pose aprovada por furnitureId',async()=>{
  const asset={id:'cadeira',path:'cadeira.glb',types:['cadeira'],dimensions:{w:2,h:1,d:1},referenceFootprintCanto:{w:.45,h:.85,d:.45},
    source:{positionThree:[99,.025,99],rotationQuarterTurns:0},instances:[{furnitureId:'cadeira-0',positionThree:[.7,.025,-.8],rotationQuarterTurns:3}]},
    catalog={schema:'liv-interior-improvements-v1',assets:[asset,{id:'cadeira-lateral',path:'lateral.glb',types:['cadeira'],replaces:['cadeira-5'],dimensions:{w:2,h:1,d:1},
      referenceFootprintCanto:{w:.45,h:.85,d:.45},source:{positionThree:[5,.03,1],rotationQuarterTurns:1}}]},owned=new Set();
  const library=await loadInteriorImprovements({base:new URL('https://example.invalid/liv/'),own:value=>{owned.add(value);return value;},
    fetchImpl:async url=>String(url).endsWith('catalogo.json')?{ok:true,json:async()=>catalog}:{ok:true,arrayBuffer:async()=>blankGLB()},parseGLB:async()=>({scene:model()})});
  const furniture=Array.from({length:6},(_,index)=>({id:`cadeira-${index}`,tipo:'cadeira',name:'Cadeira',w:.45,h:.85,d:.45,position:[index,index%2],rotation:index%4,originalRotation:index%4,group:new THREE.Group()})),scene=new THREE.Scene();
  for(const item of furniture)scene.add(item.group);assert.equal(library.replaceFurniture(furniture,scene,'canto'),6);
  assert.equal(new Set(furniture.map(item=>item.position.join(','))).size,6);
  assert.equal(furniture[5].improvementAsset,'cadeira-lateral','A variante de um item específico tem prioridade sobre o template genérico.');
  assert.deepEqual(furniture[0].position,[.7,-.8]);assert.equal(furniture[0].rotation,3);
  for(let index=1;index<6;index++){assert.deepEqual(furniture[index].position,[index,index%2]);assert.equal(furniture[index].rotation,index%4);}
  for(const resource of owned)resource.dispose?.();
});

test('conversão UV clona mapas por acabamento, deduplica ORM e preserva templates, móveis e canais extras',async()=>{
  const albedo=new THREE.Texture({width:4,height:4}),normal=new THREE.Texture(),orm=new THREE.Texture(),ao=new THREE.Texture(),environment=new THREE.Texture();
  albedo.repeat.set(2,3);albedo.offset.set(.1,.2);albedo.center.set(.3,.4);albedo.rotation=.25;albedo.wrapS=albedo.wrapT=THREE.ClampToEdgeWrapping;
  normal.repeat.set(.5,1);normal.channel=1;ao.channel=1;orm.repeat.set(2,2);
  const source=new THREE.MeshStandardMaterial({name:'web-wood',map:albedo,normalMap:normal,roughnessMap:orm,metalnessMap:orm,aoMap:ao,envMap:environment});
  const catalog={schema:'liv-interior-improvements-v1',assets:[
    {id:'acabamentos',path:'acabamentos.glb',types:[],dimensions:{w:2,h:1,d:1}},
    {id:'sofa',path:'sofa.glb',types:['sofa'],dimensions:{w:2,h:1,d:1}}],materialOverrides:[
    {target:'wood-floor',assetId:'acabamentos',materialName:'web-wood',textureRepeat:['0.787401575','1.968503937']},
    {target:'tile-floor',assetId:'acabamentos',materialName:'web-wood',textureRepeat:[1.968503937,-1.968503937]}]},owned=new Set();
  const library=await loadInteriorImprovements({base:new URL('https://example.invalid/liv/'),own:value=>{owned.add(value);return value;},
    fetchImpl:async url=>String(url).endsWith('catalogo.json')?{ok:true,json:async()=>catalog}:{ok:true,arrayBuffer:async()=>blankGLB()},
    parseGLB:async(bytes,url)=>{const root=model();root.children[0].material.dispose();root.children[0].material=url.pathname.endsWith('acabamentos.glb')?source:source.clone();return {scene:root};}});
  const other=library.createFurniture({id:'outro',tipo:'sofa',name:'Sofá',w:2,h:1,d:1,position:[0,0],rotation:0});
  let otherMaterial;other.traverse(mesh=>{if(mesh.isMesh)otherMaterial=mesh.material;});
  const native={m1:new THREE.MeshStandardMaterial(),m2:new THREE.MeshStandardMaterial()},scene=new THREE.Scene();scene.add(other);
  assert.equal(library.applyFinishes(native,scene),2);assert.equal(library.getState().status,'ready');
  assert.notEqual(native.m2.map,albedo);assert.notEqual(native.m1.map,native.m2.map);assert.equal(native.m2.map.image,albedo.image);
  near(native.m2.map.repeat.x,2*.787401575);near(native.m2.map.repeat.y,3*1.968503937);near(native.m1.map.repeat.y,-3*1.968503937);
  assert.equal(native.m2.roughnessMap,native.m2.metalnessMap);assert.notEqual(native.m2.roughnessMap,orm);assert.notEqual(native.m2.roughnessMap,native.m1.roughnessMap);
  assert.equal(native.m2.normalMap.channel,1);assert.equal(native.m2.aoMap.channel,1);assert.equal(native.m2.map.channel,0);
  assert.deepEqual(native.m2.map.offset.toArray(),[.1,.2]);assert.deepEqual(native.m2.map.center.toArray(),[.3,.4]);assert.equal(native.m2.map.rotation,.25);
  assert.equal(native.m2.map.wrapS,THREE.RepeatWrapping);assert.equal(native.m2.envMap,environment);
  assert.deepEqual(albedo.repeat.toArray(),[2,3]);assert.equal(albedo.wrapS,THREE.ClampToEdgeWrapping);assert.deepEqual(normal.repeat.toArray(),[.5,1]);assert.deepEqual(orm.repeat.toArray(),[2,2]);
  assert.equal(otherMaterial.map,albedo);assert.equal(otherMaterial.normalMap,normal);assert.equal(source.map,albedo);
  assert.equal([...owned].filter(resource=>resource.isTexture).length,13,'Cinco texturas fonte mais quatro cópias por override; ORM é compartilhado.');
  for(const resource of owned)resource.dispose?.();
});

test('repetição UV exige um par finito e falhas não alteram o material anterior',async()=>{
  for(const textureRepeat of [null,[1],[1,2,3],[NaN,1],[1,Infinity],['',1],[null,1],[true,1]]){
    const catalog={schema:'liv-interior-improvements-v1',assets:[{id:'acabamentos',path:'acabamentos.glb',types:[],dimensions:{w:2,h:1,d:1}}],
      materialOverrides:[{target:'wood-floor',assetId:'acabamentos',materialName:'PBR aprovado',textureRepeat}]},owned=new Set();
    const library=await loadInteriorImprovements({base:new URL('https://example.invalid/liv/'),own:value=>{owned.add(value);return value;},
      fetchImpl:async url=>String(url).endsWith('catalogo.json')?{ok:true,json:async()=>catalog}:{ok:true,arrayBuffer:async()=>blankGLB()},parseGLB:async()=>({scene:model()})});
    const previous=new THREE.MeshStandardMaterial(),native={m2:previous};assert.equal(library.applyFinishes(native,new THREE.Scene()),0);
    assert.equal(native.m2,previous);assert.equal(library.getState().status,'partial');assert.match(library.getState().errors[0].message,/UV/);
    for(const resource of owned)resource.dispose?.();previous.dispose();
  }
});

test('probe local real fica distinto do global e mantém ganho em noite, retorno e clones futuros',async()=>{
  const globalHDR=smallHDR(),localHDR=smallHDR([32,48,64,126,64,48,32,126]),owned=new Set(),ownCalls=[];
  const catalog={schema:'liv-interior-improvements-v1',assets:[{id:'mesa-jantar',path:'mesa.glb',types:['mesa'],environment:'jantar',dimensions:{w:1,h:1,d:1}}],
    environment:{path:'sala.hdr'},reflectionEnvironments:{jantar:{path:'jantar.hdr'}}};
  const library=await loadInteriorImprovements({base:new URL('https://example.invalid/liv/'),own:value=>{owned.add(value);ownCalls.push(value);return value;},
    fetchImpl:async url=>{const path=new URL(url).pathname;return path.endsWith('catalogo.json')?{ok:true,json:async()=>catalog}:{ok:true,arrayBuffer:async()=>path.endsWith('sala.hdr')?globalHDR.buffer:path.endsWith('jantar.hdr')?localHDR.buffer:geometricGLB()};}});
  const item={id:'mesa-1',tipo:'mesa',name:'Mesa',w:1.4,h:.76,d:.9,position:[1,2],rotation:0};
  const materialOf=group=>{let material;group.traverse(mesh=>{if(mesh.isMesh)material=mesh.material;});return material;};
  library.setEnvironmentIntensity(8);const first=materialOf(library.createFurniture(item)),texture=first.envMap;
  assert.ok(texture?.isDataTexture);assert.notEqual(texture,library.environment);assert.equal(first.envMapIntensity,8);
  near(first.color.r,.2);near(first.roughness,.3);near(first.metalness,.4);
  library.setEnvironmentIntensity(0);assert.equal(first.envMapIntensity,0);assert.equal(first.envMap,texture);
  const future=materialOf(library.createFurniture({...item,id:'mesa-2'}));assert.equal(future.envMapIntensity,0);assert.equal(future.envMap,texture);
  library.setEnvironmentIntensity(8);assert.equal(first.envMapIntensity,8);assert.equal(future.envMapIntensity,8);
  first.dispose();owned.delete(first);library.setEnvironmentIntensity(2);assert.equal(first.envMapIntensity,8);assert.equal(future.envMapIntensity,2);
  assert.equal(library.getState().reflectionMaterialCount,1);assert.equal(library.getState().reflectionEnvironmentIntensity,2);
  assert.equal(library.getState().reflectionEnvironments.jantar.loaded,true);assert.equal(ownCalls.filter(resource=>resource===texture).length,1);
  assert.throws(()=>library.setEnvironmentIntensity(NaN),RangeError);assert.throws(()=>library.setEnvironmentIntensity(-1),RangeError);
  let disposed=0;texture.addEventListener('dispose',()=>disposed++);for(const resource of owned)resource.dispose?.();assert.equal(disposed,1);
  assert.equal(library.getState().reflectionMaterialCount,0);
});

test('ambiente local compartilha HDR por URL com environment sem duplicar download ou ownership',async()=>{
  const hdr=smallHDR(),owned=new Set(),fetches=[];
  const catalog={schema:'liv-interior-improvements-v1',assets:[{id:'mesa-jantar',path:'mesa.glb',types:['mesa'],environment:'jantar',dimensions:{w:1,h:1,d:1}}],
    environment:{path:'sala.hdr'},reflectionEnvironments:{jantar:{path:'interiores/melhorias/sala.hdr'}}};
  const library=await loadInteriorImprovements({base:new URL('https://example.invalid/liv/'),own:value=>{owned.add(value);return value;},
    fetchImpl:async url=>{const path=new URL(url).pathname;fetches.push(path);return path.endsWith('catalogo.json')?{ok:true,json:async()=>catalog}:{ok:true,arrayBuffer:async()=>path.endsWith('.hdr')?hdr.buffer:geometricGLB()};}});
  const group=library.createFurniture({id:'mesa',tipo:'mesa',name:'Mesa',w:1,h:1,d:1,position:[0,0],rotation:0});let material;group.traverse(mesh=>{if(mesh.isMesh)material=mesh.material;});
  assert.equal(material.envMap,library.environment);assert.equal(fetches.filter(path=>path.endsWith('.hdr')).length,1);
  assert.equal([...owned].filter(resource=>resource.isDataTexture).length,1);assert.equal(library.getState().status,'ready');
  for(const resource of owned)resource.dispose?.();
});

test('falha de HDR local e referência ausente ficam visíveis sem alterar cor ou rugosidade',async()=>{
  for(const definitions of [{jantar:{path:'falha.hdr'}},{}]){
    const owned=new Set(),catalog={schema:'liv-interior-improvements-v1',assets:[{id:'mesa',path:'mesa.glb',types:['mesa'],environment:'jantar',dimensions:{w:1,h:1,d:1}}],reflectionEnvironments:definitions};
    const library=await loadInteriorImprovements({base:new URL('https://example.invalid/liv/'),own:value=>{owned.add(value);return value;},
      fetchImpl:async url=>String(url).endsWith('catalogo.json')?{ok:true,json:async()=>catalog}:String(url).endsWith('.hdr')?{ok:false,status:404}:{ok:true,arrayBuffer:async()=>geometricGLB()}});
    const group=library.createFurniture({id:'mesa',tipo:'mesa',name:'Mesa',w:1,h:1,d:1,position:[0,0],rotation:0});let material;group.traverse(mesh=>{if(mesh.isMesh)material=mesh.material;});
    assert.equal(material.envMap,null);near(material.color.r,.2);near(material.roughness,.3);assert.equal(library.getState().status,'partial');assert.ok(library.getState().errors.length>0);
    if(definitions.jantar){assert.equal(library.getState().reflectionEnvironments.jantar.loaded,false);assert.match(library.getState().reflectionEnvironments.jantar.error,/404/);}
    for(const resource of owned)resource.dispose?.();
  }
});

test('horário sincroniza intensidade dos ambientes locais depois do rig, inclusive à noite',()=>{
  const source=readFileSync(new URL('../interior-renderer.js',import.meta.url),'utf8'),calls=[],scene={environmentIntensity:1},state={disposed:false,mode:'visita'};
  const fragment=source.slice(source.indexOf('state.setTimeOfDay=function('),source.indexOf('\nfunction check('));
  const context=vm.createContext({state,scene,structuredClone,timeOfDay:{date:'2026-10-26',context:{}},
    interiorTimeState:(hour,unit,options)=>({hour,date:options.date,daylight:hour===22?0:1,context:unit}),setBaked:()=>{},timeLight:null,layoutOriginal:()=>true,setReflectionNormalization:()=>{},
    solarLighting:{apply:time=>{scene.environmentIntensity=8*time.daylight;calls.push('apply');},syncPresentation:()=>{}},
    improvements:{setEnvironmentIntensity:gain=>calls.push(gain)}});
  vm.runInContext(fragment,context);assert.equal(state.setTimeOfDay(14),true);assert.equal(state.setTimeOfDay(22),true);
  assert.deepEqual(calls,['apply',8,'apply',0]);
});
