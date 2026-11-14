import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=new URL('../experimentos/piloto-qualidade-visual-2026-10-04/visual.js',import.meta.url);
const threeSource=await readFile(new URL('../v1.5/renderizador-v16-moveis/lib/three.min.js',import.meta.url),'utf8');
const paramSource=await readFile(new URL('../v1.5/renderizador-v16-moveis/interior/furniture-param.js',import.meta.url),'utf8');
const catalogSource=await readFile(new URL('../v1.5/renderizador-v16-moveis/interior/furniture-catalog.js',import.meta.url),'utf8');
const librarySource=await readFile(new URL('../moveis/moveis_lib.json',import.meta.url),'utf8');
const assets=['madeira','tecido','frio','parede','madeira_movel'].map(id=>({id,
  tileMeters:id==='tecido'?.315:id==='parede'?2:1,tileHeightMeters:id==='tecido'?.3901:undefined,
  maps:Object.fromEntries(['color','normal','roughness'].map(kind=>[kind,{file:`${id}-${kind}.webp`,
    width:512,height:512,bytes:100,sha256:'a'.repeat(64)}]))}));

async function fixture({enabled=true,fail='',deferred=false,lazy=false,bed=false,types=[],customColors={},calibration,estilo}={}) {
  const requests=[],pending=[],frames=[];
  const document={getElementById(id){assert.equal(id,'__moveis');return {textContent:librarySource};},
    createElement(){throw new Error('O piloto real não deve gerar CanvasTexture');}};
  const ctx=vm.createContext({console,document,requestAnimationFrame:fn=>frames.push(fn)});
  ctx.window=ctx;vm.runInContext(threeSource,ctx);const T=ctx.THREE;
  T.TextureLoader.prototype.load=function(url,onLoad,_progress,onError){
    requests.push(url);const texture=new T.Texture();
    const complete=()=>url.includes(fail)&&fail?onError(new Error('404')):onLoad(texture);
    if(deferred)pending.push(complete);else queueMicrotask(complete);return texture;
  };
  const original=new T.MeshStandardMaterial({vertexColors:true,roughness:.78});
  const MAT={matParede:original.clone(),matFrio:original.clone(),matMadeira:original.clone()};
  MAT.matParede.color.setHex(0xE3DECB);MAT.matParede.map=new T.Texture();
  MAT.matParede.normalMap=new T.Texture();MAT.matParede.roughnessMap=new T.Texture();MAT.matParede.lightMap=new T.Texture();
  MAT.matParede.onBeforeCompile=function originalPaintShader(){};MAT.matParede.customProgramCacheKey=()=> 'forro16iso';
  const house=new T.Group();
  for(const name of ['matParede','matFrio','matMadeira']) {
    const geo=new T.PlaneGeometry(3,3);geo.setAttribute('uv1',geo.attributes.uv.clone());
    geo.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*3).fill(.8),3));
    house.add(new T.Mesh(geo,MAT[name]));
  }
  vm.runInContext(paramSource,ctx);vm.runInContext(catalogSource,ctx);
  const rgbDe=hex=>{const c=new T.Color(hex);return [c.r,c.g,c.b].map(v=>Math.round(v*255));};
  let FURN;const FP=ctx.FurnitureParam.create({THREE:T,getLib:()=>FURN?FURN.MOVEIS_LIB:{},rgbDe});
  FURN=ctx.FurnitureCatalog.create({THREE:T,document,rgbDe,geoDeParts:FP.geoDeParts,getMaterial:()=>original,...FP});
  const furniture=new Map();
  for(const tipo of ['sofa','armario',...(bed?['cama']:[]),...types]) {
    const def=FURN.MOVEIS[tipo],dims=tipo==='sofa'?{w:2.3,h:.84,d:.95,...(estilo?{estilo}:{})}:{w:def.b[0],h:def.b[1],d:def.b[2]};
    const cor=customColors[tipo]??def.cor,obj=FURN.geoDoMovel(def,cor,dims);
    if(!def.param)obj.scale.set(dims.w/def.b[0],dims.h/def.b[1],dims.d/def.b[2]);
    obj.userData={movel:true,registroMovel:{tipo,...dims,rot:1,cor}};
    if(tipo==='sofa'){obj.position.set(1,.03,2);obj.rotation.y=.4;}
    house.add(obj);furniture.set(tipo,obj);
  }
  const sofa=furniture.get('sofa'),oldSofa=sofa.children[0],woodMesh=furniture.get('armario').children[0],woodGeo=woodMesh.geometry;
  const bedMesh=furniture.get('cama')?.children[0],cam=new T.PerspectiveCamera();cam.position.set(3,4,5);
  let current=lazy?null:house;
  const maq={planta:()=>current,cam,ren:{capabilities:{getMaxAnisotropy:()=>4}},modo:()=> 'planta3d'};
  vm.runInContext(await readFile(source,'utf8'),ctx,{filename:'visual.js'});
  const api=ctx.PilotoVisual.start({THREE:T,maq,base:{MAT,matMovel:original,ambientePBR:null,PL_R:{},FURN},assets,assetPath:'assets/',enabled,calibration});
  return {T,api,house,MAT,sofa,oldSofa,woodMesh,woodGeo,bedMesh,furniture,FURN,FP,requests,pending,cam,original,
    frame(){current=house;frames.shift()?.();},finish(){pending.splice(0).forEach(fn=>fn());}};
}

test('cinco materiais reais carregam15mapas com espaços de cor corretos e restauram A sem mover câmera',async()=>{
  const f=await fixture(),before=f.cam.position.clone(),originalCold=f.house.children[1].geometry;await f.api.ready;
  assert.equal(f.requests.length,15);assert.equal(f.api.snapshot().loadedMaterials.length,5);
  const cold=f.house.children[1],floorWood=f.house.children[2];
  assert.equal(cold.material.map.colorSpace,f.T.SRGBColorSpace);assert.equal(cold.material.normalMap.colorSpace,f.T.NoColorSpace);
  assert.equal(cold.material.roughnessMap.colorSpace,f.T.NoColorSpace);assert.notEqual(cold.material.normalMap,cold.material.map);
  assert.equal(cold.geometry.attributes.color,originalCold.attributes.color);assert.equal(floorWood.material.vertexColors,true);
  const changed=cold.material;f.api.setEnabled(false);assert.equal(cold.material,f.MAT.matFrio);assert.equal(f.oldSofa.visible,true);
  f.api.setEnabled(true);await f.api.ready;assert.equal(cold.material,changed);assert.equal(f.requests.length,15);
  assert.ok(before.equals(f.cam.position));
});

test('A não baixa mapas e grupo lazy instala B uma vez preservando sofá, limites e metadata',async()=>{
  const f=await fixture({enabled:false,lazy:true});assert.equal(f.requests.length,0);
  const item=f.sofa.userData.registroMovel;f.api.setEnabled(true);await f.api.ready;f.frame();f.frame();
  assert.equal(f.api.snapshot().sofas,1);assert.equal(f.sofa.children.length,2);assert.equal(f.sofa.userData.registroMovel,item);
  assert.equal(f.sofa.position.x,1);assert.equal(f.sofa.rotation.y,.4);assert.equal(f.oldSofa.visible,false);
  const added=f.sofa.children[1];added.updateMatrixWorld(true);const bounds=new f.T.Box3().setFromObject(added);
  assert.ok(bounds.max.x<=1.15001&&bounds.min.x>=-1.15001);assert.ok(bounds.max.z<=.47501&&bounds.min.z>=-.47501);
  assert.ok(bounds.max.y<=.84001&&bounds.min.y>=-.00001);assert.ok(f.api.snapshot().extraTriangles<=10000);
  assert.equal(added.children[0].material.vertexColors,false);assert.equal(added.children[0].material.color.getHex(),0xffffff);
  assert.equal(added.children[1].material.map.name,'madeira_movel-color.webp');
  f.api.setEnabled(false);assert.equal(added.visible,false);assert.equal(f.woodMesh.geometry,f.woodGeo);
});

test('falha parcial restaura só seu acabamento e desativar durante load não ressuscita B',async()=>{
  const f=await fixture({fail:'frio-normal',deferred:true});f.api.setEnabled(false);f.finish();await f.api.ready;
  assert.equal(f.house.children[2].material,f.MAT.matMadeira);f.api.setEnabled(true);await f.api.ready;
  assert.equal(f.house.children[1].material,f.MAT.matFrio);assert.notEqual(f.house.children[2].material,f.MAT.matMadeira);
  assert.equal(f.api.snapshot().failures.length,1);
});

test('chegada escalonada espera os cinco materiais e falha de parede mantém parede original',async()=>{
  const f=await fixture({deferred:true});f.pending.splice(0,3).forEach(fn=>fn());await new Promise(resolve=>setImmediate(resolve));
  f.frame();assert.equal(f.api.snapshot().installed,false);f.finish();await f.api.ready;
  assert.equal(f.api.snapshot().loadedMaterials.length,5);assert.equal(f.api.snapshot().wallMeshes,1);
  const failed=await fixture({fail:'parede-normal'});await failed.api.ready;
  assert.equal(failed.house.children[0].material,failed.MAT.matParede);assert.equal(failed.api.snapshot().wallMeshes,0);
  assert.equal(failed.api.getWallTextureDownload(),null);assert.equal(failed.api.snapshot().loadedMaps,14);
});

test('manifesto rejeita caminho externo, orçamento3MB e altura física inválida antes de request',async()=>{
  const f=await fixture({enabled:false}),context={window:{},requestAnimationFrame:()=>{}};vm.runInNewContext(await readFile(source,'utf8'),context);
  const boot=materials=>context.window.PilotoVisual.start({THREE:f.T,maq:{planta:()=>null},base:{MAT:f.MAT},assets:materials,assetPath:'assets/',enabled:true});
  for(const change of [item=>({...item,tileHeightMeters:-1}),item=>({...item,maps:{...item.maps,color:{...item.maps.color,file:'../outside.webp'}}}),
    item=>({...item,maps:{...item.maps,color:{...item.maps.color,bytes:3000001}}})])assert.throws(()=>boot([change(assets[0]),...assets.slice(1)]),/manifesto/i);
  assert.equal(f.requests.length,0);
});

test('parede real preserva cor/bake/index/UV1/shader, tem UV métrica e alterna sem alterar portas',async()=>{
  const f=await fixture({deferred:true}),wall=f.house.children[0],original=wall.geometry;original.rotateY(Math.PI*.31);
  const oldUv=Array.from(original.attributes.uv.array),oldUv1=Array.from(original.attributes.uv1.array),oldColor=f.MAT.matParede.color.clone();
  const door=new f.T.Mesh(new f.T.BoxGeometry(.8,2,.04),f.MAT.matParede);f.house.add(door);const doorGeo=door.geometry;
  f.finish();await f.api.ready;const m=wall.material,g=wall.geometry;
  assert.equal(m.name,'piloto-parede');assert.equal(m.map.name,'parede-color.webp');assert.equal(m.normalMap.name,'parede-normal.webp');
  assert.equal(m.roughnessMap.name,'parede-roughness.webp');assert.equal(m.bumpMap,null);assert.ok(m.color.equals(oldColor.clone().multiplyScalar(1.7)));
  assert.equal(m.vertexColors,true);assert.equal(m.lightMap,f.MAT.matParede.lightMap);assert.equal(m.onBeforeCompile,f.MAT.matParede.onBeforeCompile);
  assert.equal(m.customProgramCacheKey(),'forro16iso');assert.equal(g.attributes.color,original.attributes.color);
  assert.deepEqual(Array.from(g.attributes.position.array),Array.from(original.attributes.position.array));
  assert.deepEqual(Array.from(g.index.array),Array.from(original.index.array));assert.deepEqual(Array.from(g.attributes.uv1.array),oldUv1);
  assert.deepEqual(Array.from(original.attributes.uv.array),oldUv);assert.ok(Math.abs(Math.abs(g.attributes.uv.getX(1)-g.attributes.uv.getX(0))-1.5)<.00001);
  original.attributes.color.setX(0,.35);assert.ok(Math.abs(g.attributes.color.getX(0)-.35)<.000001);
  assert.equal(door.material,f.MAT.matParede);assert.equal(door.geometry,doorGeo);assert.equal(f.api.snapshot().proceduralTextures,0);
  const floorB=f.house.children[1].material;f.api.setWallsEnabled(false);assert.equal(wall.material,f.MAT.matParede);assert.equal(f.house.children[1].material,floorB);
  f.api.setEnabled(false);f.api.setWallsEnabled(true);assert.equal(wall.geometry,original);f.api.setEnabled(true);await f.api.ready;assert.equal(wall.material,m);
  assert.equal(f.api.getWallTextureDownload().url,'assets/parede-color.webp');assert.equal(f.api.getWallTextureDownload().filename,'parede-color.webp');assert.equal(f.requests.length,15);
});

test('marcenaria real usa veio próprio sem tint duplo, preserva ferragem mesmo com cor coincidente',async()=>{
  const f=await fixture({types:['pia','balcao','cadeira','aereo'],customColors:{armario:0x1E2126,pia:0x1E2126,aereo:0x1E2126}});await f.api.ready;
  for(const tipo of ['armario','pia','balcao','cadeira','aereo']) {
    const mesh=f.furniture.get(tipo).children[0];assert.ok(mesh.geometry.groups.length<=2);
    assert.equal(mesh.material[0].name,'piloto-madeira_movel');assert.equal(mesh.material[0].map.name,'madeira_movel-color.webp');
    assert.equal(mesh.material[0].vertexColors,false);assert.equal(mesh.material[0].color.getHex(),0xffffff);
    assert.equal(mesh.material[1],f.original);assert.equal(mesh.material[1].vertexColors,true);assert.equal(f.api.snapshot().furnitureCoverage[tipo].textured,1);
  }
  const arm=f.furniture.get('armario').children[0],fixed=arm.geometry.groups.find(g=>g.materialIndex===1);
  assert.ok(fixed.count>0,'Puxadores/frestas de mesma cor devem permanecer originais');
  const tint=new f.T.Color(0x1E2126),c=arm.geometry.attributes.color;
  assert.ok(Array.from({length:fixed.count},(_,k)=>fixed.start+k).some(i=>Math.abs(c.getX(i)-tint.r)<.009));assert.equal(f.api.snapshot().maskFallbacks.length,0);
});

test('cama real separa tecido/madeira/pés mesmo com corpo branco e preserva bounds',async()=>{
  const f=await fixture({bed:true,customColors:{cama:0xF2EFE8},deferred:true}),mesh=f.bedMesh,original=mesh.geometry;original.computeBoundingBox();
  f.finish();await f.api.ready;const g=mesh.geometry;g.computeBoundingBox();assert.ok(g.boundingBox.equals(original.boundingBox));
  assert.equal(mesh.material[0].name,'piloto-tecido');assert.equal(mesh.material[1].name,'piloto-madeira_movel');assert.equal(mesh.material[2],f.original);
  assert.equal(mesh.material[0].vertexColors,false);assert.equal(mesh.material[1].vertexColors,false);
  let frame=0,garment=0,feet=0;const p=g.attributes.position,c=g.attributes.color;
  for(const group of g.groups)for(let i=group.start;i<group.start+group.count;i+=3) {
    const y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;
    if(z<-.95&&y>.3){assert.equal(group.materialIndex,1);frame++;}
    if(y>.48&&z>-.5){assert.equal(group.materialIndex,0);garment++;}
    if(c.getX(i)<.18&&y<.1){assert.equal(group.materialIndex,2);feet++;}
  }
  assert.ok(frame&&garment&&feet);f.api.setEnabled(false);assert.equal(mesh.geometry,original);
});

test('tapete inteiro recebe tecido, cortina preserva trilho e UV respeita largura/altura real',async()=>{
  const f=await fixture({types:['tapete','cortina']});await f.api.ready;
  const rug=f.furniture.get('tapete').children[0],curtain=f.furniture.get('cortina').children[0];
  assert.equal(rug.geometry.groups.length,1);assert.equal(rug.geometry.groups[0].count,rug.geometry.attributes.position.count);
  assert.equal(rug.material[0].name,'piloto-tecido');assert.ok(curtain.geometry.groups.some(g=>g.materialIndex===1));assert.equal(curtain.material[1],f.original);
  assert.equal(f.api.snapshot().furnitureCoverage.tapete.textured,1);
  const own=f.sofa.children[1].children[0].geometry,p=own.attributes.position,n=own.attributes.normal,uv=own.attributes.uv;
  const pairs=[];for(let i=0;i<p.count-1;i++)if(Math.abs(n.getZ(i))>.99&&Math.abs(n.getZ(i+1))>.99&&Math.abs(p.getZ(i)-p.getZ(i+1))<1e-6)pairs.push(i);
  assert.ok(pairs.length);const i=pairs.find(i=>Math.abs(p.getY(i+1)-p.getY(i))>.01);
  assert.ok(Math.abs((uv.getY(i+1)-uv.getY(i))*.3901-(p.getY(i+1)-p.getY(i)))<.001);assert.equal(f.api.snapshot().maskFallbacks.length,0);
  const horizontal=pairs.find(i=>Math.abs(p.getX(i+1)-p.getX(i))>.01);
  assert.ok(Math.abs((uv.getX(horizontal+1)-uv.getX(horizontal))*.315-(p.getX(horizontal+1)-p.getX(horizontal)))<.001);
});

test('calibração neutraliza o tint pela cor da planta e acompanha a troca Planta/Visita do Cedros',async()=>{
  const cal={parede:{neutralizeTint:true,gain:1.2}},f=await fixture({deferred:true,calibration:cal}),wall=f.house.children[0];
  const visita=wall.geometry,planta=visita.clone(),c=planta.attributes.color;
  for(let i=0;i<c.count;i++)c.setXYZ(i,.8,.6,.4);
  const basico=new f.T.MeshBasicMaterial();
  Object.assign(wall.userData,{geoVisita:visita,geoPlanta:planta,materialVisita:f.MAT.matParede});wall.material=basico;wall.geometry=planta;
  f.finish();await f.api.ready;
  const m=wall.userData.materialVisita,want=f.MAT.matParede.color.clone().multiply(new f.T.Color().setRGB(1.2/.8,1.2/.6,1.2/.4));
  assert.equal(m.name,'piloto-parede');assert.ok(['r','g','b'].every(k=>Math.abs(m.color[k]-want[k])<1e-6));
  assert.equal(wall.userData.geoVisita.attributes.color,visita.attributes.color);assert.notEqual(wall.userData.geoPlanta,planta);
  assert.equal(wall.userData.geoPlanta.attributes.uv,wall.userData.geoVisita.attributes.uv);
  assert.deepEqual(Array.from(wall.userData.geoPlanta.attributes.color.array),Array.from(planta.attributes.color.array));
  f.api.setEnabled(false);assert.equal(wall.userData.materialVisita,f.MAT.matParede);
  assert.equal(wall.userData.geoVisita,visita);assert.equal(wall.userData.geoPlanta,planta);
  const ctx={window:{},requestAnimationFrame:()=>{}};vm.runInNewContext(await readFile(source,'utf8'),ctx);
  for(const bad of [{parede:{gain:-1}},{vidro:{gain:1}},{tecido:{neutralizeTint:'sim'}}])
    assert.throws(()=>ctx.window.PilotoVisual.start({THREE:f.T,maq:{planta:()=>null},base:{MAT:f.MAT},assets,assetPath:'assets/',calibration:bad}),/Calibração/);
});

test('keepTint deixa cada peça com a cor do cadastro e a textura só como trama',async()=>{
  const f=await fixture({types:['cortina'],calibration:{tecido:{keepTint:true,gain:2}}});await f.api.ready;f.frame();
  const curtain=f.furniture.get('cortina').children[0].material,wood=f.woodMesh.material;
  assert.equal(curtain[0].name,'piloto-tecido');assert.equal(curtain[0].vertexColors,true);
  assert.equal(curtain[0].color.getHex(),new f.T.Color().setScalar(2).getHex());
  assert.equal(wood[0].vertexColors,false);
  const body=f.sofa.children[1].children[0].material,want=new f.T.Color(f.FURN.MOVEIS.sofa.cor).multiplyScalar(2);
  assert.equal(body.vertexColors,false);assert.ok(['r','g','b'].every(k=>Math.abs(body.color[k]-want[k])<1e-6));
});

test('sofá com estilo da biblioteca recebe tecido pela máscara em vez da troca pela caixa',async()=>{
  const f=await fixture({estilo:'palito'});await f.api.ready;f.frame();
  const mesh=f.sofa.children[0],snap=f.api.snapshot();
  assert.equal(snap.sofas,0);assert.equal(f.sofa.children.length,1);
  assert.equal(snap.maskFallbacks.length,0);assert.equal(snap.furnitureCoverage.sofa.textured,1);
  assert.ok(Array.isArray(mesh.material),'tecido + material original (pé de madeira)');
  assert.equal(mesh.material[0].name,'piloto-tecido');assert.equal(mesh.geometry.groups.length,2);
});
