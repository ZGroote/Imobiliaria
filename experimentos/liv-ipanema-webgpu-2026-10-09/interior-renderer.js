import * as THREE from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {LivRGBMNodeMaterial,createRGBMTexture} from './material-rgbm.js';
import {createLayout,createNavigation} from './interior-navigation.js';

const query=new URLSearchParams(location.search),typology=query.get('tipologia')||'canto',requested=query.get('backend')||'auto';
const canvas=document.querySelector('#interior-canvas'),stage=document.querySelector('#interior-stage'),status=document.querySelector('#interior-status');
const controller=new AbortController(),base=new URL('./',import.meta.url),owned=new Set(),released=new WeakSet(),bitmaps=new Set(),closed=new WeakSet(),listeners=[],pendingDisposals=new Set(),initializedRenderers=new WeakSet();
const state=window.__livInterior={ready:false,error:null,backend:null,typology,mode:query.get('modo')||'planta3d',disposed:false,
  lighting:{bakedActive:false,reason:'carregando'},ownership:{created:0,disposed:0,bitmapsClosed:0}};
let renderer,scene,camera,controls,observer,startup,disposePromise,layout,navigation,entry,catalog,record,source,light,atlas;
let yaw=0,pitch=0,tourPosition=null,route=[],routeResolve=null,frameBusy=false,framePromise=Promise.resolve(),lastFrame=0,ceiling=[];
const furniture=[],meshBySlot=new Map(),baked=[],keys=new Set(),touchKeys=new Set();
let orbitSnapshot=null,pointer=null;

function check(){if(controller.signal.aborted||state.disposed)throw new DOMException('Interior cancelado.','AbortError');}
function own(value){if(value&&!owned.has(value)){owned.add(value);state.ownership.created++;}return value;}
function createRenderer(options){
  const value=own(new THREE.WebGPURenderer(options)),setLoop=value.setAnimationLoop.bind(value);
  // r186's dispose calls setAnimationLoop without awaiting it. A null loop
  // before init settles must not launch another init or leak a rejected promise.
  value.setAnimationLoop=callback=>initializedRenderers.has(value)?setLoop(callback):Promise.resolve();
  return value;
}
async function initializeRenderer(value){await value.init();initializedRenderers.add(value);}
function release(value){
  if(!value||released.has(value))return;released.add(value);
  const disposal=Promise.resolve().then(()=>value.dispose?.()).then(()=>{state.ownership.disposed++;});
  pendingDisposals.add(disposal);disposal.then(()=>pendingDisposals.delete(disposal),()=>{});return disposal;
}
function closeBitmap(value){if(closed.has(value))return;closed.add(value);value.close();state.ownership.bitmapsClosed++;}
function listen(target,type,handler,options){target.addEventListener(type,handler,options);listeners.push(()=>target.removeEventListener(type,handler,options));}
function progress(message,phase='download',extra={}){if(!state.disposed){status.textContent=message;state.progress={version:(state.progress?.version||0)+1,phase,message,at:performance.now(),...extra};}}
async function cleanup(){
  observer?.disconnect();renderer?.setAnimationLoop(null);
  for(const off of listeners.splice(0))off();
  for(const resource of owned)release(resource);
  await Promise.all([...pendingDisposals]);
  for(const bitmap of bitmaps)closeBitmap(bitmap);
  scene?.clear();state.ready=false;
}
state.dispose=function(){
  if(disposePromise)return disposePromise;
  state.disposed=true;state.ready=false;controller.abort();keys.clear();touchKeys.clear();stopRoute(false);
  renderer?.setAnimationLoop(null);observer?.disconnect();
  disposePromise=Promise.resolve(startup).catch(()=>{}).then(()=>framePromise.catch(()=>{})).then(cleanup);
  return disposePromise;
};
function fail(error){
  if(state.disposed||state.error)return;
  state.error=String(error?.message||error);state.ready=false;
  document.querySelector('#interior-error').textContent=state.error;document.querySelector('#failure').hidden=false;
  progress('Não foi possível abrir este interior.');
  const detail={error:state.error,backend:state.backend,typology,mode:state.mode};
  window.dispatchEvent(new CustomEvent('liv-renderer-error',{detail}));
  state.dispose().catch(error=>{state.disposalError=String(error);});
}
const retry=new URL(location.href);retry.searchParams.set('backend','webgl');document.querySelector('#retry-interior').href=retry.href;

async function sha(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function unzip(bytes){return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());}
async function load(file,json=false){
  if(!file||!/^interiores\/(?:shared|canto|meio)\/[a-zA-Z0-9._/-]+$/.test(file.path)||file.path.split('/').includes('..')||!/^[a-f0-9]{64}$/.test(file.sha256)||!Number.isInteger(file.bytes))throw Error('Identidade de recurso interior inválida.');
  check();const url=new URL(file.path,base);
  const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error(`${file.path}: HTTP ${response.status}.`);
  let bytes;
  if(response.body){
    const reader=response.body.getReader(),chunks=[];let loaded=0;
    try{for(;;){const {value,done}=await reader.read();if(done)break;check();loaded+=value.length;if(loaded>file.bytes){await reader.cancel();throw Error(`Tamanho do recurso ${file.path} inválido.`);}chunks.push(value);progress('Baixando o interior selecionado…','download',{resource:file.path,loaded,total:file.bytes});}}
    finally{reader.releaseLock();}
    bytes=new Uint8Array(loaded);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
  }else bytes=new Uint8Array(await response.arrayBuffer());check();
  if(bytes.length!==file.bytes||await sha(bytes)!==file.sha256)throw Error(`Identidade do recurso ${file.path} inválida.`);
  if(file.compression==='gzip'){
    progress('Preparando os recursos do interior…','decode',{resource:file.path});
    bytes=await unzip(bytes);check();
    if(bytes.length!==file.decodedBytes||await sha(bytes)!==file.decodedSHA256)throw Error(`Conteúdo comprimido ${file.path} inválido.`);
  }
  check();return json?JSON.parse(new TextDecoder().decode(bytes)):bytes;
}
function bytes64(encoded){const raw=atob(encoded),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes;}
async function materialsFrom(snapshot){
  const textures={};
  for(const [id,spec]of Object.entries(snapshot.textures)){
    check();const bytes=bytes64(spec.data.split(',')[1]);if(await sha(bytes)!==spec.pngSHA256)throw Error(`Textura ${id} alterada.`);
    const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}),{imageOrientation:spec.flipY?'flipY':'none',premultiplyAlpha:'none',colorSpaceConversion:'none'});
    bitmaps.add(bitmap);check();
    if(bitmap.width!==spec.width||bitmap.height!==spec.height)throw Error(`Dimensões da textura ${id} inválidas.`);
    const texture=own(new THREE.Texture(bitmap));texture.flipY=false;texture.colorSpace=spec.colorSpace;texture.wrapS=spec.wrapS;texture.wrapT=spec.wrapT;
    texture.repeat.fromArray(spec.repeat);texture.offset.fromArray(spec.offset);texture.center.fromArray(spec.center);texture.rotation=spec.rotation;texture.needsUpdate=true;
    textures[id]=texture;
  }
  const materials={};
  for(const [id,spec]of Object.entries(snapshot.materials)){
    if(!['MeshStandardMaterial','MeshBasicMaterial','MeshPhysicalMaterial'].includes(spec.type))throw Error(`Material nativo ${spec.type} sem suporte.`);
    const params={name:spec.name,color:new THREE.Color().fromArray(spec.color),vertexColors:spec.vertexColors,opacity:spec.opacity,transparent:spec.transparent,alphaTest:spec.alphaTest,side:spec.side};
    if(spec.type!=='MeshBasicMaterial')Object.assign(params,{roughness:spec.roughness,metalness:spec.metalness,emissive:new THREE.Color().fromArray(spec.emissive),emissiveIntensity:spec.emissiveIntensity,
      normalScale:new THREE.Vector2().fromArray(spec.normalScale),bumpScale:spec.bumpScale,normalMapType:spec.normalMapType});
    for(const field of ['map','normalMap','roughnessMap','metalnessMap','bumpMap','emissiveMap'])if(spec[field])params[field]=textures[spec[field]];
    materials[id]=own(new THREE[spec.type](params));
    if(id==='m5')materials[id].depthWrite=false;
  }
  return materials;
}
function geometryFrom(spec){
  const geometry=own(new THREE.BufferGeometry());
  for(const [name,size]of [['position',3],['normal',3],['uv',2],['color',3]])if(spec[name]?.length)geometry.setAttribute(name,new THREE.Float32BufferAttribute(spec[name],size));
  if(spec.index)geometry.setIndex(new THREE.Uint32BufferAttribute(spec.index,1));
  for(const group of spec.groups||[])geometry.addGroup(group.start,group.count,group.materialIndex);
  geometry.computeBoundingSphere();return geometry;
}
function registerTree(root){root.traverse(o=>{if(o.geometry)own(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])own(m);});}
function buildFrozen(source,materials){
  const geometries=new Map();
  for(const object of source.objects){
    if(!object.include)continue;
    if(object.instance!==null)throw Error('Cena interior instanciada requer mapeamento próprio.');
    if(!geometries.has(object.geometry))geometries.set(object.geometry,geometryFrom(source.geometries[object.geometry]));
    const list=object.materials.map(id=>materials[id]);if(list.some(x=>!x))throw Error('Material da fonte interior ausente.');
    const mesh=new THREE.Mesh(geometries.get(object.geometry),list.length===1?list[0]:list);
    mesh.name=object.name;mesh.matrix.fromArray(object.matrix);mesh.matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);
    mesh.visible=object.visible;mesh.castShadow=mesh.receiveShadow=!object.materials.every(id=>id==='m5');
    if(object.materials.every(id=>id==='m5'))mesh.renderOrder=3;mesh.userData.livSlot=object.slot;
    meshBySlot.set(object.slot,mesh);scene.add(mesh);if(object.name==='forro-original')ceiling.push(mesh);
  }
}
function nativeFactory(materials,library){
  let catalog;
  const rgb=hex=>{const c=new THREE.Color(typeof hex==='string'?hex:hex);return [Math.round(c.r*255),Math.round(c.g*255),Math.round(c.b*255)];};
  const param=globalThis.FurnitureParam.create({THREE,getLib:()=>catalog?.MOVEIS_LIB||{},rgbDe:rgb});
  const material=own(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.78,metalness:.04,side:THREE.DoubleSide}));
  catalog=globalThis.FurnitureCatalog.create({THREE,document:{getElementById:()=>({textContent:JSON.stringify(library)})},rgbDe:rgb,getMaterial:()=>material,
    ...Object.fromEntries(['geoDeParts','armarioParam','bancadaParam','aereoParam','ripadoParam','rackParam','tvParam','boxParam','maquinaParam','sofaParam'].map(key=>[key,param[key]]))});
  const openings=globalThis.Openings.create({THREE,ESP:.13,rgbDe:rgb,matEsq:materials.m3,matAlum:materials.m4,matVidro:materials.m5});
  return {catalog,openings,rgb};
}
function buildNative(materials,factory){
  const house=globalThis.HouseMesh.create({THREE,ESP:.13,rgbAcabamento:factory.rgb,
    triangulateRing:poly=>THREE.ShapeUtils.triangulateShape(poly.map(p=>new THREE.Vector2(...p)),[]),
    prismaQuad:globalThis.ShellGeometry.prismaQuad,quadDoSeg:globalThis.ShellGeometry.quadDoSeg,
    cursorDeLuz:()=>null,texturaDeLuz:()=>null,_LUZUE:{},BAKE:{on:false},bakePrepara:()=>null,
    matParede:materials.m0,matFrio:materials.m1,matMadeira:materials.m2,geoDasEsquadrias:factory.openings.geoDasEsquadrias});
  const root=house.geoDaCasa(layout.house,true,true);globalThis.corrigirNormaisCasaLiv(root,null);registerTree(root);scene.add(root);
  root.traverse(o=>{if(o.name==='forro-original')ceiling.push(o);});
  for(const item of furniture){
    const def=factory.catalog.MOVEIS[item.tipo];if(!def)throw Error(`Móvel ${item.tipo} ausente do catálogo nativo.`);
    const group=factory.catalog.geoDoMovel(def,item.cor,{w:item.w,d:item.d,h:item.h,estilo:item.estilo});
    if(!group)throw Error(`Não foi possível construir ${item.name}.`);
    finishNativeFurniture(group,item,materials);
    if(!def.param)group.scale.set(item.w/def.b[0],item.h/def.b[1],item.d/def.b[2]);
    group.position.set(item.position[0],.03,item.position[1]);group.rotation.y=item.rotation*Math.PI/2;
    group.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;o.userData.furnitureId=item.id;}});registerTree(group);scene.add(group);item.group=group;
  }
}
// Reuse the native PBR maps on the independently generated furniture. UVs
// are projected from local metre coordinates, so the material does not depend
// on the dimensions or room positions of the corner apartment.
function finishNativeFurniture(group,item,materials){
  const key=({guardaroupa:'m12',criado:'m13',mesa:'m16',cadeira:'m22',rack:'m19',
    bancada:'m24',pia:'m24',fogao:'m23',geladeira:'m25',vaso:'m26',maquina:'m29',
    cama:'m9',sofa:'m18',poltrona:'m18',tapete:'m21',box:'m27',tv:'m20',
    aereo:'m12',ripado:'m12'})[item.tipo]||'m6';
  const material=own(materials[key].clone());material.color.setRGB(1,1,1);material.vertexColors=true;
  group.traverse(mesh=>{
    if(!mesh.isMesh)return;const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal;
    if(material.map&&!g.attributes.uv){
      const uv=new Float32Array(p.count*2);
      for(let i=0;i<p.count;i++){
        const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
        uv[2*i]=nz>=nx||ny>=nx?p.getX(i):p.getZ(i);
        uv[2*i+1]=ny>=nx&&ny>=nz?p.getZ(i):p.getY(i);
      }
      g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    }
    mesh.material=material;
  });
}
function bindFrozenFurniture(){
  for(const mapping of record.furnitureSlots){
    const item=furniture[mapping.index],group=new THREE.Group();group.position.set(item.position[0],0,item.position[1]);scene.add(group);
    for(const slot of mapping.slots){const mesh=meshBySlot.get(slot);if(!mesh)throw Error('Móvel da fonte congelada perdeu uma parte.');group.attach(mesh);mesh.userData.furnitureId=item.id;}
    item.group=group;item.baseRotation=0;
  }
}
function expandedGeometry(spec,corner){
  const indicesBytes=bytes64(corner.indicesU32),uvBytes=bytes64(corner.uv1U16);
  if(indicesBytes.byteLength%4||uvBytes.byteLength%2)throw Error('Buffers compactos inválidos.');
  const indices=new Uint32Array(indicesBytes.buffer),uvs=new Uint16Array(uvBytes.buffer);
  if(indices.length!==corner.triangleCount*3||uvs.length!==indices.length*2||corner.sourceVertexCount!==spec.position.length/3||corner.sourceGeometrySHA256!==spec.sha256)throw Error('UV compacto não pertence à geometria original.');
  const geometry=own(new THREE.BufferGeometry());
  for(const [name,size]of [['position',3],['normal',3],['uv',2],['color',3]])if(spec[name]?.length){
    const data=new Float32Array(indices.length*size);
    for(let i=0;i<indices.length;i++){if(indices[i]>=corner.sourceVertexCount)throw Error('Índice compacto fora da fonte.');for(let k=0;k<size;k++)data[i*size+k]=spec[name][indices[i]*size+k];}
    geometry.setAttribute(name,new THREE.BufferAttribute(data,size));
  }
  geometry.setAttribute('uv1',new THREE.BufferAttribute(Float32Array.from(uvs,x=>x/65535),2));
  for(const group of corner.groups)geometry.addGroup(group.start,group.count,group.materialIndex);geometry.computeBoundingSphere();return geometry;
}
function installBake(compact){
  if(typology!=='canto'||!light.ready||!light.geometryApproved||light.colorPass!==false||light.sourceSHA256!==record.sourceSHA256||light.unitSHA256!==record.unitSHA256||compact.sourceSHA256!==record.sourceSHA256||compact.unitSHA256!==record.unitSHA256||light.geometrySHA256!==record.files.compact.decodedSHA256||light.textureSHA256!==record.files.atlas.decodedSHA256)throw Error('Identidade do bake interior não corresponde à unidade.');
  if(compact.schema!=='liv-interior-corners-v1'||compact.uvScale!==65535||compact.objects.length!==light.objects)throw Error('Contrato do bake interior inválido.');
  const nodeMaterials=new Map();
  for(const corner of compact.objects){
    const object=source.objects[corner.objectIndex],mesh=meshBySlot.get(corner.slot);
    if(!mesh||!object?.bake||object.slot!==corner.slot||object.instance!==corner.instance||object.geometry!==corner.geometry)throw Error('Alvo RGBM perdeu identidade.');
    const geometry=expandedGeometry(source.geometries[object.geometry],corner),original=mesh.material;
    const list=(Array.isArray(original)?original:[original]).map(native=>{
      if(!native.isMeshStandardMaterial)throw Error('RGBM requer um material PBR nativo.');
      if(!nodeMaterials.has(native)){const node=own(new LivRGBMNodeMaterial({},atlas,light.range,light.lightMapIntensity));node.copy(native);nodeMaterials.set(native,node);}
      return nodeMaterials.get(native);
    });
    baked.push({mesh,originalGeometry:mesh.geometry,originalMaterial:original,geometry,material:list.length===1?list[0]:list});
  }
  setBaked(true,'atlas aprovado da planta de canto');
}
function layoutOriginal(){return furniture.every(m=>Math.abs(m.position[0]-m.originalPosition[0])<1e-9&&Math.abs(m.position[1]-m.originalPosition[1])<1e-9&&m.rotation===m.originalRotation);}
function setBaked(active,reason){
  for(const target of baked){target.mesh.geometry=active?target.geometry:target.originalGeometry;target.mesh.material=active?target.material:target.originalMaterial;}
  state.lighting={bakedActive:active,reason};
}
function furnitureTransform(item){
  item.group.position.x=item.position[0];item.group.position.z=item.position[1];
  item.group.rotation.y=typology==='canto'?(item.rotation-item.originalRotation)*Math.PI/2:item.rotation*Math.PI/2;
  navigation.invalidate();stopRoute(false);
  if(tourPosition&&!navigation.free(...tourPosition))tourPosition=navigation.entry();
  setBaked(typology==='canto'&&baked.length>0&&layoutOriginal(),layoutOriginal()?(typology==='canto'?'atlas aprovado da planta de canto':'iluminação dinâmica da planta de meio'):'móveis alterados: iluminação dinâmica');
  refreshRooms();
}
state.moveFurniture=function(id,dx,dz){
  if(!state.ready)return false;const item=furniture.find(m=>m.id===id);if(!item||![dx,dz].every(Number.isFinite))return false;
  const p=[item.position[0]+dx,item.position[1]+dz];
  // Keep the furniture anchor in a real room; conservative collision remains
  // active even if the new layout blocks a destination.
  if(!layout.rooms.some(r=>r.poly&&pointIn(r.poly,...p)))return false;
  item.position=p;furnitureTransform(item);return true;
};
function pointIn(poly,x,z){let b=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],q=poly[j];if((a[1]>z)!==(q[1]>z)&&x<(q[0]-a[0])*(z-a[1])/(q[1]-a[1])+a[0])b=!b;}return b;}
state.rotateFurniture=function(id){if(!state.ready)return false;const item=furniture.find(m=>m.id===id);if(!item)return false;item.rotation=(item.rotation+1)%4;furnitureTransform(item);return true;};
state.resetFurniture=function(){if(!state.ready)return false;for(const item of furniture){item.position=[...item.originalPosition];item.rotation=item.originalRotation;furnitureTransform(item);}return true;};

function addLights(){
  scene.background=new THREE.Color('#e8ede9');
  const environment=own(new THREE.DataTexture(new Uint8Array([156,180,206,255,210,211,190,255,135,150,160,255,185,181,160,255]),2,2,THREE.RGBAFormat));
  environment.colorSpace=THREE.SRGBColorSpace;environment.mapping=THREE.EquirectangularReflectionMapping;environment.needsUpdate=true;scene.environment=environment;scene.environmentIntensity=.55;
  const hemi=new THREE.HemisphereLight(0xc8ddff,0x817664,1.2);scene.add(hemi);
  const sun=own(new THREE.DirectionalLight(0xffffff,light?.lighting?.sun?.energy||2.2));sun.position.fromArray(light?.lighting?.sun?.position||[-7,9,10]);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:.5,far:35});sun.shadow.bias=-.0003;sun.shadow.normalBias=.012;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xe3eaff,.6);fill.position.set(4,5,-4);scene.add(fill);
  for(const room of layout.rooms){const lamp=new THREE.PointLight(0xfff2dc,10,8,2);lamp.position.set(room.cx,layout.pd-.14,room.cz);scene.add(lamp);}
}
function orbitDefault(){
  const b=layout.bounds,w=b.x1-b.x0,d=b.z1-b.z0,aspect=camera.aspect;
  const vfov=THREE.MathUtils.degToRad(camera.fov),hfov=2*Math.atan(Math.tan(vfov/2)*aspect);
  const fit=Math.max(w/(2*Math.tan(hfov/2)),d/(2*Math.tan(vfov/2)))*1.15;
  camera.position.set(0,fit*.95,fit*.62);controls.target.set(0,.4,0);controls.update();
}
function setTourCamera(){camera.position.set(tourPosition[0],1.62,tourPosition[1]);camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);}
state.setMode=function(mode){
  if(!['planta3d','visita'].includes(mode)||!scene||state.disposed)return false;
  if(state.mode==='planta3d'&&mode==='visita')orbitSnapshot={position:camera.position.toArray(),target:controls.target.toArray()};
  state.mode=mode;controls.enabled=mode==='planta3d';for(const mesh of ceiling)mesh.visible=mode==='visita';
  keys.clear();touchKeys.clear();stopRoute(false);
  if(mode==='visita'){tourPosition??=[...entry];setTourCamera();}
  else if(orbitSnapshot){camera.position.fromArray(orbitSnapshot.position);controls.target.fromArray(orbitSnapshot.target);controls.update();}
  else orbitDefault();
  document.querySelector('#touch-pad').hidden=mode!=='visita';
  document.querySelector('#interior-tip').textContent=mode==='visita'?'Arraste para olhar · WASD ou setas para caminhar':'Arraste para girar · dois dedos ou roda para aproximar';
  for(const id of ['planta3d','visita'])document.querySelector(`#mode-${id}`).setAttribute('aria-pressed',String(mode===id));
  window.dispatchEvent(new CustomEvent('liv-interior-mode',{detail:{mode,typology}}));
  return true;
};
function stopRoute(result){route=[];if(routeResolve){const resolve=routeResolve;routeResolve=null;resolve(result);}}
state.getRoomRoutes=function(){return navigation?navigation.routes(tourPosition||entry):[];};
function refreshRooms(){
  if(!navigation)return;const routes=state.getRoomRoutes(),select=document.querySelector('#room-select'),previous=select.value;
  select.replaceChildren(...routes.map(r=>{const option=document.createElement('option');option.value=r.id;option.textContent=r.name+(r.reachable?'':' · passagem bloqueada');option.disabled=!r.reachable;return option;}));
  if(routes.some(r=>r.id===previous&&r.reachable))select.value=previous;
  state.rooms=routes.map(({id,name,reachable,target})=>({id,name,reachable,target}));
}
state.goToRoom=function(id,{instant=false}={}){
  if(!state.ready)return Promise.resolve(false);state.setMode('visita');const target=state.getRoomRoutes().find(r=>r.id===id);
  if(!target?.reachable)return Promise.resolve(false);stopRoute(false);
  if(instant){tourPosition=[...target.target];yaw=navigation.direction(tourPosition);pitch=0;setTourCamera();return Promise.resolve(true);}
  route=target.path.slice(1);return new Promise(resolve=>{routeResolve=resolve;if(!route.length)stopRoute(true);});
};
state.move=function(dx,dz){
  if(!state.ready||state.mode!=='visita')return false;
  if(typeof dx==='object'){const {forward=0,right=0}=dx;dz=-Math.cos(yaw)*forward-Math.sin(yaw)*right;dx=-Math.sin(yaw)*forward+Math.cos(yaw)*right;}
  if(![dx,dz].every(Number.isFinite))return false;stopRoute(false);tourPosition=navigation.move(tourPosition,dx,dz);setTourCamera();return true;
};
state.navigationDiagnostics=function(){return navigation?{safe:navigation.free(...(tourPosition||entry)),current:[...(tourPosition||entry)],radius:navigation.radius,eye:1.62,reachableRooms:state.rooms?.filter(r=>r.reachable).length||0,totalRooms:layout.rooms.length,followingRoute:route.length>0}:null;};
function tick(dt){
  if(state.mode!=='visita'){controls.update();return;}
  let forward=(keys.has('w')||keys.has('arrowup')||touchKeys.has('forward')?1:0)-(keys.has('s')||keys.has('arrowdown')||touchKeys.has('back')?1:0);
  let right=(keys.has('d')||keys.has('arrowright')||touchKeys.has('right')?1:0)-(keys.has('a')||keys.has('arrowleft')||touchKeys.has('left')?1:0);
  if(forward||right){stopRoute(false);const scale=1.4*dt/Math.hypot(forward,right);state.move({forward:forward*scale,right:right*scale});}
  else if(route.length){
    let remaining=1.4*dt;
    while(route.length&&remaining>0){const next=route[0],dx=next[0]-tourPosition[0],dz=next[1]-tourPosition[1],distance=Math.hypot(dx,dz);
      if(!navigation.segment(tourPosition,next)){stopRoute(false);break;}
      if(distance<=remaining){tourPosition=[...next];route.shift();remaining-=distance;}
      else {tourPosition=navigation.move(tourPosition,dx/distance*remaining,dz/distance*remaining);remaining=0;}
      if(distance>.02)yaw=Math.atan2(-dx,-dz);
    }
    if(!route.length&&routeResolve){yaw=navigation.direction(tourPosition);stopRoute(true);}
  }
  setTourCamera();
}
function wire(){
  listen(window,'keydown',event=>{if(state.mode!=='visita'||/^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName))return;const key=event.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){event.preventDefault();keys.add(key);}});
  listen(window,'keyup',event=>keys.delete(event.key.toLowerCase()));listen(window,'blur',()=>{keys.clear();touchKeys.clear();pointer=null;});
  listen(canvas,'pointerdown',event=>{if(state.mode!=='visita')return;pointer={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);canvas.focus();stopRoute(false);});
  listen(canvas,'pointermove',event=>{if(!pointer||pointer.id!==event.pointerId||state.mode!=='visita')return;yaw-=(event.clientX-pointer.x)*.004;pitch=Math.max(-1.2,Math.min(1.2,pitch-(event.clientY-pointer.y)*.004));pointer.x=event.clientX;pointer.y=event.clientY;setTourCamera();});
  for(const event of ['pointerup','pointercancel'])listen(canvas,event,()=>{pointer=null;});
  for(const direction of ['forward','back','left','right']){
    const button=document.querySelector(`#touch-${direction}`);
    listen(button,'pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);touchKeys.add(direction);});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(button,event,()=>touchKeys.delete(direction));
  }
  for(const mode of ['planta3d','visita'])listen(document.querySelector(`#mode-${mode}`),'click',()=>state.setMode(mode));
  listen(document.querySelector('#room-go'),'click',()=>state.goToRoom(document.querySelector('#room-select').value));
  const selected=()=>document.querySelector('#furniture-select').value;
  for(const [direction,dx,dz]of [['left',-.1,0],['right',.1,0],['forward',0,-.1],['back',0,.1]])listen(document.querySelector(`#furniture-${direction}`),'click',()=>state.moveFurniture(selected(),dx,dz));
  listen(document.querySelector('#furniture-rotate'),'click',()=>state.rotateFurniture(selected()));listen(document.querySelector('#furniture-reset'),'click',()=>state.resetFurniture());
  listen(document.querySelector('#capture-interior'),'click',()=>state.capture().then(url=>{const a=document.createElement('a');a.href=url;a.download=`liv-${typology}-${state.mode}.png`;a.click();}).catch(fail));
  listen(window,'pagehide',()=>state.dispose().catch(()=>{}));
}
function geometryInfo(){
  let objects=0,vertices=0,triangles=0;scene?.traverse(o=>{if(!o.isMesh)return;objects++;vertices+=o.geometry.attributes.position?.count||0;triangles+=(o.geometry.index?.count||o.geometry.attributes.position?.count||0)/3;});
  return {objects,vertices,triangles};
}
state.getState=function(){return {version:1,typology,mode:state.mode,backend:state.backend,ready:state.ready,error:state.error,disposed:state.disposed,unitSHA256:record?.unitSHA256,sourceSHA256:record?.sourceSHA256,
  geometry:geometryInfo(),camera:camera?{position:camera.position.toArray(),target:controls.target.toArray(),yaw,pitch}:null,
  ceiling:{visible:ceiling.length>0&&ceiling.every(m=>m.visible),count:ceiling.length},rooms:state.rooms||[],
  furniture:furniture.map(m=>({id:m.id,name:m.name,position:[...m.position],rotation:m.rotation,originalPosition:[...m.originalPosition],originalRotation:m.originalRotation,
    modified:Math.abs(m.position[0]-m.originalPosition[0])>1e-9||Math.abs(m.position[1]-m.originalPosition[1])>1e-9||m.rotation!==m.originalRotation})),
  lighting:{...state.lighting},navigation:state.navigationDiagnostics(),renderer:{calls:renderer?.info.render.calls||0,triangles:renderer?.info.render.triangles||0,geometries:renderer?.info.memory.geometries||0,textures:renderer?.info.memory.textures||0},ownership:{...state.ownership}};};
state.restoreState=function(snapshot){
  if(!state.ready||snapshot?.typology!==typology||snapshot.unitSHA256!==record.unitSHA256||snapshot.sourceSHA256!==record.sourceSHA256)return false;
  for(const transform of snapshot.furniture||[]){const item=furniture.find(m=>m.id===transform.id);if(!item||!Array.isArray(transform.position)||!transform.position.every(Number.isFinite)||!Number.isInteger(transform.rotation)||transform.rotation<0||transform.rotation>3)return false;}
  for(const transform of snapshot.furniture||[]){const item=furniture.find(m=>m.id===transform.id);item.position=[...transform.position];item.rotation=transform.rotation;furnitureTransform(item);}
  if(snapshot.camera){
    const p=snapshot.camera.position;if(Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)){
      if(snapshot.mode==='visita'&&navigation.free(p[0],p[2])){tourPosition=[p[0],p[2]];yaw=Number.isFinite(snapshot.camera.yaw)?snapshot.camera.yaw:0;pitch=Math.max(-1.2,Math.min(1.2,snapshot.camera.pitch||0));}
      else if(snapshot.mode==='planta3d'&&Array.isArray(snapshot.camera.target)&&snapshot.camera.target.length===3&&snapshot.camera.target.every(Number.isFinite))orbitSnapshot={position:p,target:snapshot.camera.target};
    }
  }
  return state.setMode(snapshot.mode);
};
state.capture=async function(){if(!state.ready||state.disposed)throw Error('Interior indisponível para captura.');await framePromise;check();await renderer.renderAsync(scene,camera);check();return canvas.toDataURL('image/png');};

async function start(){
  if(!['canto','meio'].includes(typology)||!['auto','webgpu','webgl'].includes(requested)||!['planta3d','visita'].includes(state.mode))throw Error('Parâmetros do interior inválidos.');
  progress('Preparando os gráficos…');let adapter=null;
  if(requested!=='webgl'&&navigator.gpu){try{adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});}catch(error){state.adapterError=String(error);}}
  check();if(requested==='webgpu'&&!adapter)throw Error('WebGPU não está disponível neste dispositivo.');
  const options={canvas,alpha:false,antialias:true,forceWebGL:requested==='webgl'||!adapter};renderer=createRenderer(options);state.renderer=renderer;
  try{await initializeRenderer(renderer);}catch(error){if(requested!=='auto'||options.forceWebGL)throw error;check();await release(renderer);renderer=createRenderer({...options,forceWebGL:true});state.renderer=renderer;await initializeRenderer(renderer);}
  check();state.backend=renderer.backend.isWebGPUBackend?'webgpu':'webgl';if(requested==='webgpu'&&state.backend!=='webgpu')throw Error('O backend WebGPU exigido não foi ativado.');
  renderer.onError=error=>fail(error);renderer.onDeviceLost=info=>fail(Error(`Dispositivo gráfico perdido: ${info?.message||info?.reason||'desconhecido'}`));
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  progress('Baixando o interior selecionado…');
  const response=await fetch(new URL('interiores/catalogo.json',base),{signal:controller.signal});if(!response.ok)throw Error(`Catálogo interior: HTTP ${response.status}.`);catalog=await response.json();check();
  if(catalog.schema!=='liv-interior-catalog-v1'||!catalog.tipologias?.[typology])throw Error('Tipologia interior ausente do catálogo.');record=catalog.tipologias[typology];
  const runtime=await load(catalog.shared.runtime);check();
  // Execute the exact bytes checked above, retaining the native factory APIs.
  const runtimeURL=URL.createObjectURL(new Blob([runtime],{type:'text/javascript'}));
  try{await import(runtimeURL);}finally{URL.revokeObjectURL(runtimeURL);}check();
  const [unit,nativeMaterials,library]=await Promise.all([load(record.files.unit,true),load(catalog.shared.materials,true),load(catalog.shared.furniture,true)]);check();
  if(record.unitSHA256!==record.files.unit.sha256||unit.id!==record.unitId)throw Error('Unidade não pertence à tipologia selecionada.');
  layout=createLayout(unit);scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(48,1,.02,100);state.scene=scene;state.camera=camera;
  controls=own(new OrbitControls(camera,canvas));controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=3;controls.maxDistance=32;
  const materials=await materialsFrom(nativeMaterials);check();
  for(const [i,m]of unit.planta.moveis.entries()){
    const position=[m.p[0]-layout.center[0],m.p[1]-layout.center[1]];
    furniture.push({...m,id:`movel-${i}`,name:m.nome||m.tipo,position,originalPosition:[...position],rotation:m.rot||0,originalRotation:m.rot||0});
  }
  const factory=nativeFactory(materials,library);
  if(record.geometryKind==='frozen-source'){
    [source,light]=await Promise.all([load(record.files.source,true),load(record.files.light,true)]);check();
    if(source.schema!=='liv-interior-scene-v1'||source.unitSHA256!==record.unitSHA256||record.files.source.decodedSHA256!==record.sourceSHA256)throw Error('Fonte congelada não corresponde à unidade.');
    buildFrozen(source,materials);bindFrozenFurniture();
    // Openings fills only the native collision leaf descriptors. The frozen
    // meshes remain untouched; these temporary construction meshes are released.
    for(const mesh of factory.openings.geoDasEsquadrias(layout.house)){own(mesh.geometry);release(mesh.geometry);}
    const [compact,atlasBytes]=await Promise.all([load(record.files.compact,true),load(record.files.atlas)]);check();atlas=own(createRGBMTexture(atlasBytes,light));installBake(compact);
  }else if(record.geometryKind==='native-factories'){
    const recipe=await load(record.files.recipe,true);check();
    if(recipe.unitSHA256!==record.unitSHA256||record.files.recipe.sha256!==record.sourceSHA256||recipe.runtimeSHA256!==catalog.shared.runtime.sha256||recipe.materialsSHA256!==catalog.shared.materials.sha256||recipe.furnitureSHA256!==catalog.shared.furniture.sha256||recipe.lighting!=='dynamic')throw Error('Receita da planta de meio inválida.');
    buildNative(materials,factory);state.lighting={bakedActive:false,reason:'iluminação dinâmica da planta de meio; bake específico pendente'};
  }else throw Error('Formato de geometria interior desconhecido.');
  check();if(!ceiling.length)throw Error('O interior perdeu o forro para o Tour.');addLights();
  navigation=createNavigation(layout,()=>furniture);entry=navigation.entry();tourPosition=[...entry];yaw=navigation.direction(entry);refreshRooms();
  function resize(){const width=stage.clientWidth,height=stage.clientHeight;if(!width||!height||state.disposed)return;camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);if(state.mode==='planta3d'&&!orbitSnapshot)orbitDefault();}
  observer=new ResizeObserver(resize);observer.observe(stage);resize();orbitDefault();const initialMode=state.mode;state.mode='planta3d';state.setMode(initialMode);
  wire();document.querySelector('#furniture-select').replaceChildren(...furniture.map(m=>{const option=document.createElement('option');option.value=m.id;option.textContent=m.name;return option;}));
  check();await renderer.renderAsync(scene,camera);check();state.ready=true;
  const area=record.areaPublishedRange?record.areaPublishedRange.map(a=>a.toFixed(2).replace('.',',')).join(' a '):record.area.toFixed(2).replace('.',',');
  progress(`${record.label} · ${area} m² · ilustração aproximada`);
  for(const element of document.querySelectorAll('#interior-controls button,#interior-controls select,#furniture-panel button,#furniture-panel select'))element.disabled=false;
  renderer.setAnimationLoop(time=>{
    if(state.disposed||frameBusy)return;const dt=Math.min(.05,Math.max(0,(time-lastFrame)/1000||0));lastFrame=time;tick(dt);frameBusy=true;
    framePromise=renderer.renderAsync(scene,camera).catch(fail).finally(()=>{frameBusy=false;});
  });
  return state;
}
startup=Promise.resolve().then(start);state.readyPromise=startup;
startup.catch(error=>{if(!state.disposed)fail(error);});
