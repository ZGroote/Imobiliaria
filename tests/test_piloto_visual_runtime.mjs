import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = new URL('../experimentos/piloto-qualidade-visual-2026-10-04/visual.js', import.meta.url);
const threeSource = await readFile(new URL('../v1.5/renderizador-v16-moveis/lib/three.min.js', import.meta.url), 'utf8');
const bedLibrary=JSON.parse(await readFile(new URL('../moveis/moveis_lib.json',import.meta.url),'utf8')).pecas.cama;
const assets = ['madeira','tecido','frio'].map(id=>({id,tileMeters:id==='tecido'?.264:1.5,
  maps:Object.fromEntries(['color','normal','roughness'].map(kind=>[kind,{file:`${id}-${kind}.webp`,
    width:512,height:512,bytes:100,sha256:'a'.repeat(64)}]))}));

async function fixture({enabled=true, fail='', deferred=false, lazy=false, bed=false, failCanvas=false}={}) {
  const requests=[], pending=[], frames=[], canvases=[];
  const document={createElement(tag){
    assert.equal(tag,'canvas');const canvas={width:0,height:0};
    const drawing={createImageData(w,h){return {width:w,height:h,data:new Uint8ClampedArray(w*h*4)};},
      putImageData(image){canvas.pixels=image.data;}};
    canvas.downloadCalls=0;canvas.toDataURL=kind=>{assert.equal(kind,'image/png');canvas.downloadCalls++;
      return 'data:image/png;base64,cGludHVyYS1yb2xvLXJlbGV2bw==';};
    canvas.getContext=()=>failCanvas?null:drawing;canvases.push(canvas);return canvas;
  }};
  const ctx=vm.createContext({console,document,requestAnimationFrame:fn=>frames.push(fn)});
  ctx.window=ctx; vm.runInContext(threeSource,ctx);
  const T=ctx.THREE;
  T.TextureLoader.prototype.load=function(url,onLoad,_progress,onError){
    requests.push(url); const texture=new T.Texture();
    const complete=()=>url.includes(fail)&&fail ? onError(new Error('404')) : onLoad(texture);
    if(deferred) pending.push(complete); else queueMicrotask(complete);
    return texture;
  };
  const original = new T.MeshStandardMaterial({vertexColors:true,roughness:.78});
  const MAT={matParede:original.clone(),matFrio:original.clone(),matMadeira:original.clone()};
  MAT.matParede.color.setHex(0xE3DECB);MAT.matParede.map=new T.Texture();
  MAT.matParede.normalMap=new T.Texture();MAT.matParede.roughnessMap=new T.Texture();
  MAT.matParede.lightMap=new T.Texture();
  MAT.matParede.onBeforeCompile=function originalPaintShader(){};
  MAT.matParede.customProgramCacheKey=()=> 'forro16iso';
  const house=new T.Group();
  for(const name of ['matParede','matFrio','matMadeira']) {
    const geo=new T.PlaneGeometry(3,3); geo.setAttribute('uv1',geo.attributes.uv.clone());
    geo.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*3).fill(.8),3));
    house.add(new T.Mesh(geo,MAT[name]));
  }
  const sofa=new T.Group(); sofa.position.set(1,.03,2); sofa.rotation.y=.4;
  sofa.userData={movel:true,registroMovel:{tipo:'sofa',w:2.3,h:.84,d:.95,rot:1,cor:0x4A5A6B}};
  const oldSofa=new T.Mesh(new T.BoxGeometry(2.3,.84,.95),original); sofa.add(oldSofa); house.add(sofa);
  const wood=new T.Group(); wood.userData={movel:true,registroMovel:{tipo:'armario',w:1,h:2,d:.5,cor:0x9A7A55}};
  const woodGeo=new T.BoxGeometry(1,2,.5).toNonIndexed();
  const rgb=new T.Color(0x9A7A55), colors=[];
  for(let i=0;i<woodGeo.attributes.position.count;i++) colors.push(rgb.r,rgb.g,rgb.b);
  woodGeo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const woodMesh=new T.Mesh(woodGeo,original); wood.add(woodMesh); house.add(wood);
  let bedMesh;
  if(bed) {
    const b=bedLibrary, p=b.pos_cm.map(v=>v/100), n=b.nrm_127.map(v=>v/127), color=[];
    const tint=new T.Color(0x8A7660);
    for(let i=0;i<b.verts;i++)color.push(...(b.herda[i]?[tint.r,tint.g,tint.b]:b.col.slice(i*3,i*3+3).map(v=>v/255)));
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));
    geo.setAttribute('normal',new T.Float32BufferAttribute(n,3));geo.setAttribute('color',new T.Float32BufferAttribute(color,3));
    geo.setIndex(b.idx); bedMesh=new T.Mesh(geo,original);
    const obj=new T.Group();obj.userData={movel:true,registroMovel:{tipo:'cama',w:1.44,h:1.05,d:2.02,cor:0x8A7660}};
    obj.add(bedMesh);house.add(obj);
  }
  const cam=new T.PerspectiveCamera(); cam.position.set(3,4,5);
  let current=lazy?null:house;
  const maq={planta:()=>current,cam,ren:{capabilities:{getMaxAnisotropy:()=>4}},modo:()=> 'planta3d'};
  vm.runInContext(await readFile(source,'utf8'),ctx,{filename:'visual.js'});
  const api=ctx.PilotoVisual.start({THREE:T,maq,base:{MAT,matMovel:original,ambientePBR:null,PL_R:{}},
    assets,assetPath:'assets/',enabled});
  return {T,api,house,MAT,sofa,oldSofa,woodMesh,woodGeo,bedMesh,requests,pending,cam,canvases,
    frame(){current=house;frames.shift()?.();},finish(){pending.splice(0).forEach(fn=>fn());}};
}

test('PBR real usa espaços de cor corretos, preserva UV de luz e restaura A sem mover câmera',async()=>{
  const f=await fixture(); const before=f.cam.position.clone();
  const originalColdGeo=f.house.children[1].geometry;
  await f.api.ready;
  assert.equal(f.requests.length,9);
  const cold=f.house.children[1], wood=f.house.children[2];
  assert.notEqual(cold.material,f.MAT.matFrio);
  assert.equal(cold.material.map.colorSpace,f.T.SRGBColorSpace);
  assert.equal(cold.material.normalMap.colorSpace,f.T.NoColorSpace);
  assert.equal(cold.material.roughnessMap.colorSpace,f.T.NoColorSpace);
  assert.notEqual(cold.material.normalMap,cold.material.map);
  assert.equal(cold.geometry.attributes.uv1.count,4);
  assert.equal(cold.geometry.attributes.color,originalColdGeo.attributes.color);
  assert.equal(wood.material.vertexColors,true);
  const changed=cold.material;
  f.api.setEnabled(false);
  assert.equal(cold.material,f.MAT.matFrio);
  assert.equal(f.oldSofa.visible,true);
  f.api.setEnabled(true); await f.api.ready;
  assert.equal(cold.material,changed);
  assert.equal(f.requests.length,9);
  assert.ok(before.equals(f.cam.position));
});

test('A não baixa mapas; grupo lazy recebe B uma vez e móvel mantém identidade/transform',async()=>{
  const f=await fixture({enabled:false,lazy:true});
  assert.equal(f.requests.length,0);
  f.api.setEnabled(true); await f.api.ready;
  f.frame(); f.frame();
  assert.equal(f.api.snapshot().sofas,1);
  assert.equal(f.sofa.children.length,2);
  assert.equal(f.sofa.userData.registroMovel.w,2.3);
  assert.equal(f.sofa.position.x,1);
  assert.equal(f.sofa.rotation.y,.4);
  assert.equal(f.oldSofa.visible,false);
  const added=f.sofa.children[1]; added.updateMatrixWorld(true);
  const bounds=new f.T.Box3().setFromObject(added);
  assert.ok(bounds.max.x<=1.15001 && bounds.min.x>=-1.15001);
  assert.ok(bounds.max.z<=.47501 && bounds.min.z>=-.47501);
  assert.ok(bounds.max.y<=.84001 && bounds.min.y>=-.00001);
  assert.ok(f.api.snapshot().extraTriangles<=10000);
  f.api.setEnabled(false); assert.equal(added.visible,false);
  assert.equal(f.woodMesh.geometry,f.woodGeo);
});

test('falha em mapa restaura todo aquele acabamento; B desativado durante load não reaparece',async()=>{
  const f=await fixture({fail:'frio-normal',deferred:true});
  f.api.setEnabled(false); f.finish(); await f.api.ready;
  assert.equal(f.house.children[2].material,f.MAT.matMadeira);
  f.api.setEnabled(true); await f.api.ready;
  assert.equal(f.house.children[1].material,f.MAT.matFrio);
  assert.notEqual(f.house.children[2].material,f.MAT.matMadeira);
  assert.equal(f.api.snapshot().failures.length,1);
});

test('manifesto inválido não faz requests fora do pacote',async()=>{
  const f=await fixture({enabled:false});
  const ctx=vm.createContext({window:{},console,requestAnimationFrame:()=>{}});
  vm.runInContext(await readFile(source,'utf8'),ctx);
  assert.throws(()=>ctx.window.PilotoVisual.start({THREE:f.T,maq:{planta:()=>null},base:{MAT:f.MAT},
    assets:[{...assets[0],maps:{...assets[0].maps,color:{...assets[0].maps.color,file:'../outside.webp'}}}],
    assetPath:'assets/',enabled:true}),/manifesto/i);
});

test('chegada escalonada dos mapas não instala só o primeiro material',async()=>{
  const f=await fixture({deferred:true});
  f.pending.splice(0,3).forEach(fn=>fn());
  await new Promise(resolve=>setImmediate(resolve));
  f.frame();
  assert.equal(f.api.snapshot().installed,false);
  f.finish(); await f.api.ready;
  assert.equal(f.api.snapshot().loadedMaterials.length,3);
  assert.notEqual(f.house.children[1].material,f.MAT.matFrio);
  assert.notEqual(f.house.children[2].material,f.MAT.matMadeira);
  assert.equal(f.api.snapshot().sofas,1);
});

test('marcenaria mantém duas chamadas no máximo, preservando geometria original',async()=>{
  const f=await fixture({deferred:true});
  const colors=f.woodGeo.attributes.color;
  for(let i=0;i<colors.count;i+=6) for(let j=i;j<i+3;j++) colors.setXYZ(j,.1,.1,.1);
  const before=Array.from(colors.array);
  f.finish();await f.api.ready;
  assert.ok(f.woodMesh.geometry.groups.length<=2);
  assert.equal(f.woodMesh.material.length,2);
  assert.deepEqual(Array.from(f.woodGeo.attributes.color.array),before);
  assert.equal(f.woodMesh.geometry.attributes.uv.count,colors.count);
});

test('cama real separa algodão, box/cabeceira de madeira e pés, sem alterar dimensões',async()=>{
  const f=await fixture({bed:true}), original=f.bedMesh.geometry;
  original.computeBoundingBox();await f.api.ready;
  const g=f.bedMesh.geometry;g.computeBoundingBox();
  assert.equal(g.groups.length,3);
  assert.equal(f.bedMesh.material[0].name,'piloto-tecido');
  assert.equal(f.bedMesh.material[1].name,'piloto-madeira');
  assert.ok(g.boundingBox.equals(original.boundingBox));
  const p=g.attributes.position,c=g.attributes.color,tint=new f.T.Color(0x8A7660);
  let frame=0,linen=0,duvet=0,feet=0;
  for(const group of g.groups)for(let i=group.start;i<group.start+group.count;i+=3) {
    const inherited=Math.abs(c.getX(i)-tint.r)<.009;
    const y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3, z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;
    if(inherited && z<-.85){assert.equal(group.materialIndex,1);frame++;}
    if(c.getX(i)>.94){assert.equal(group.materialIndex,0);linen++;}
    if(inherited && y>.48 && z>-.5){assert.equal(group.materialIndex,0);duvet++;}
    if(c.getX(i)<.18 && y<.1){assert.equal(group.materialIndex,2);feet++;}
  }
  assert.ok(frame>0&&linen>0&&duvet>0&&feet>0);
  f.api.setEnabled(false);assert.equal(f.bedMesh.geometry,original);
});

test('pintura de rolo preserva cor/bake/UV1/index/câmera e não baixa arquivos novos',async()=>{
  const f=await fixture({deferred:true}), wall=f.house.children[0], original=wall.geometry;
  const oldUv=Array.from(original.attributes.uv.array), oldUv1=Array.from(original.attributes.uv1.array);
  const oldColor=f.MAT.matParede.color.clone(), camera=f.cam.position.clone();
  const door=new f.T.Mesh(new f.T.BoxGeometry(.8,2,.04),f.MAT.matParede);
  f.house.add(door); const doorGeo=door.geometry;
  f.finish();await f.api.ready;
  const m=wall.material,g=wall.geometry,s=f.api.snapshot();
  assert.notEqual(m,f.MAT.matParede);assert.equal(m.name,'piloto-pintura');
  assert.equal(m.normalMap,null);assert.ok(m.bumpMap?.isCanvasTexture);
  assert.ok(m.roughnessMap?.isCanvasTexture);assert.ok(m.bumpScale>=.004&&m.bumpScale<=.006);
  assert.equal(m.bumpMap.colorSpace,f.T.NoColorSpace);assert.equal(m.roughnessMap.colorSpace,f.T.NoColorSpace);
  assert.ok(m.color.equals(oldColor));assert.ok(m.map?.isCanvasTexture);
  assert.equal(m.map.colorSpace,f.T.SRGBColorSpace);assert.notEqual(m.map,f.MAT.matParede.map);
  assert.equal(m.lightMap,f.MAT.matParede.lightMap);
  assert.equal(m.onBeforeCompile,f.MAT.matParede.onBeforeCompile);
  assert.equal(m.customProgramCacheKey,f.MAT.matParede.customProgramCacheKey);
  assert.equal(m.customProgramCacheKey(),'forro16iso');
  assert.equal(g.attributes.color,original.attributes.color);
  assert.equal(g.attributes.position.count,original.attributes.position.count);
  assert.deepEqual(Array.from(g.attributes.position.array),Array.from(original.attributes.position.array));
  assert.deepEqual(Array.from(g.index.array),Array.from(original.index.array));
  assert.deepEqual(Array.from(g.attributes.uv1.array),oldUv1);
  assert.deepEqual(Array.from(original.attributes.uv.array),oldUv);
  assert.notDeepEqual(Array.from(g.attributes.uv.array),oldUv);
  assert.equal(s.wallMeshes,1);assert.equal(s.proceduralTextures,3);assert.equal(s.loadedMaps,9);
  assert.equal(f.requests.length,9);assert.equal(door.geometry,doorGeo);assert.equal(door.material,f.MAT.matParede);
  const materialB=m;
  f.api.setEnabled(false);assert.equal(wall.geometry,original);assert.equal(wall.material,f.MAT.matParede);
  assert.notEqual(f.MAT.matParede.map,m.map);
  assert.ok(f.MAT.matParede.normalMap);assert.ok(f.MAT.matParede.color.equals(oldColor));
  f.api.setEnabled(true);await f.api.ready;assert.equal(wall.material,materialB);
  assert.equal(f.canvases.length,3);assert.ok(f.cam.position.equals(camera));
});

test('UV de pintura mantém escala de 40 cm em parede girada e acompanha novo bake',async()=>{
  const f=await fixture({deferred:true}),original=f.house.children[0].geometry;
  original.rotateY(Math.PI*.31);
  f.finish();await f.api.ready;
  const g=f.house.children[0].geometry,uv=g.attributes.uv;
  assert.ok(Math.abs(Math.abs(uv.getX(1)-uv.getX(0))-3/.4)<.00001);
  assert.ok(Math.abs(Math.abs(uv.getY(2)-uv.getY(0))-3/.4)<.00001);
  original.attributes.color.setX(0,.35);
  assert.ok(Math.abs(g.attributes.color.getX(0)-.35)<.000001);
  assert.equal(g.index.count,original.index.count);
  assert.equal(g.attributes.position.count,original.attributes.position.count);
});

test('pintura procedural é determinística e falha de canvas mantém parede base',async()=>{
  const a=await fixture(),b=await fixture();await Promise.all([a.api.ready,b.api.ready]);
  assert.equal(a.canvases.length,3);assert.equal(b.canvases.length,3);
  for(let i=0;i<3;i++) {
    assert.deepEqual(a.canvases[i].pixels,b.canvases[i].pixels);
    const pixels=a.canvases[i].pixels, range=new Set();
    for(let j=0;j<pixels.length;j+=4){assert.equal(pixels[j],pixels[j+1]);assert.equal(pixels[j],pixels[j+2]);
      assert.equal(pixels[j+3],255);range.add(pixels[j]);}
    assert.ok(range.size>3&&range.size<(i===0?130:80));
    if(i===2)assert.ok([...range].every(value=>value>=242&&value<=252));
  }
  const failed=await fixture({failCanvas:true});await failed.api.ready;
  assert.equal(failed.house.children[0].material,failed.MAT.matParede);
  assert.equal(failed.api.snapshot().wallMeshes,0);assert.equal(failed.api.snapshot().proceduralTextures,0);
  assert.ok(failed.api.snapshot().failures.some(f=>f.material==='pintura'));
  assert.equal(failed.requests.length,9);
  assert.notEqual(failed.house.children[1].material,failed.MAT.matFrio);
});

test('relevo combina grão fino e grão de rolo que permanece após redução de mipmap',async()=>{
  const f=await fixture();await f.api.ready;
  const canvas=f.house.children[0].material.bumpMap.image,pixels=canvas.pixels,means=[];
  for(let y=0;y<canvas.height;y+=4)for(let x=0;x<canvas.width;x+=4) {
    let sum=0;for(let j=0;j<4;j++)for(let i=0;i<4;i++)sum+=pixels[((y+j)*canvas.width+x+i)*4];
    means.push(sum/16);
  }
  const mean=means.reduce((sum,n)=>sum+n,0)/means.length;
  const std=Math.sqrt(means.reduce((sum,n)=>sum+(n-mean)**2,0)/means.length);
  assert.ok(std>8&&std<30,`Contraste de relevo após mipmap: ${std}`);
  assert.equal(f.requests.length,9);
});

test('parede alterna independentemente e download do relevo PNG acontece só por pedido',async()=>{
  const f=await fixture();await f.api.ready;
  const wall=f.house.children[0],materialB=wall.material,floorB=f.house.children[1].material;
  assert.equal(f.api.snapshot().wallsEnabled,true);
  f.api.setWallsEnabled(false);
  assert.equal(wall.material,f.MAT.matParede);assert.equal(f.house.children[1].material,floorB);
  assert.equal(f.api.snapshot().enabled,true);assert.equal(f.api.snapshot().wallsEnabled,false);
  f.api.setEnabled(false);f.api.setWallsEnabled(true);assert.equal(wall.material,f.MAT.matParede);
  f.api.setEnabled(true);await f.api.ready;assert.equal(wall.material,materialB);
  assert.ok(f.canvases.every(canvas=>canvas.downloadCalls===0));
  const download=f.api.getWallTextureDownload();
  assert.equal(download.filename,'pintura-rolo-relevo.png');assert.match(download.url,/^data:image\/png;base64,/);
  assert.equal(materialB.bumpMap.image.downloadCalls,1);assert.equal(materialB.roughnessMap.image.downloadCalls,0);
  assert.equal(f.requests.length,9);assert.equal(f.canvases.length,3);
  const unavailable=await fixture({failCanvas:true});await unavailable.api.ready;
  assert.equal(unavailable.api.getWallTextureDownload(),null);
});

test('paintPixels é pura sem Three/DOM e gera exatamente o relevo usado no canvas runtime',async()=>{
  const standalone={window:{}};
  vm.runInNewContext(await readFile(source,'utf8'),standalone);
  assert.equal(typeof standalone.window.PilotoVisual.paintPixels,'function');
  const pixels=standalone.window.PilotoVisual.paintPixels();
  assert.equal(pixels.width,256);assert.equal(pixels.height,256);
  for(const name of ['bump','roughness','color']) {
    assert.equal(pixels[name].constructor.name,'Uint8Array');
    assert.equal(pixels[name].length,pixels.width*pixels.height*4);
  }
  const f=await fixture();await f.api.ready;
  const material=f.house.children[0].material;
  assert.deepEqual(Buffer.from(pixels.bump),Buffer.from(material.bumpMap.image.pixels));
  assert.deepEqual(Buffer.from(pixels.roughness),Buffer.from(material.roughnessMap.image.pixels));
  assert.deepEqual(Buffer.from(pixels.color),Buffer.from(material.map.image.pixels));
});
