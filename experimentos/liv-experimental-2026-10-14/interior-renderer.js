import * as THREE from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {LivRGBMNodeMaterial,LivBakedPhysicalNodeMaterial,setRGBMTimeLighting,setReflectionNormalization} from './material-rgbm.js';
import {createTimeLightmaps} from './interior-luz-horario.js';
import {createLayout,createNavigation,inside} from './interior-navigation.js';
import {createDoors} from './interior-portas.js';
import {applyVeneer} from './folheado.js';
import {planFrame,roomLook} from './interior-camera.js';
import {createPlanCutaway} from './interior-cutaway.js?rev=2026-10-13-rodateto-selado-final';
import {repairWallTops} from './interior-wall-tops.js?rev=2026-10-13-rodateto-selado-final';
import {installCornice} from './interior-cornice.js?rev=2026-10-13-rodateto-selado-final';
import {createFurnitureEditor,dimensionsOf,validFurnitureDimensions,sameFurnitureDimensions} from './furniture-editor.js';
import {createInteriorSolarLighting,interiorTimeState} from './horario-interior.js';
import {loadInteriorImprovements} from './interior-melhorias.js';
import {installInteriorLook} from './interior-look.js';

const query=new URLSearchParams(location.search),typology=query.get('tipologia')||'canto',requested=query.get('backend')||'auto';
const canvas=document.querySelector('#interior-canvas'),stage=document.querySelector('#interior-stage'),status=document.querySelector('#interior-status');
const controller=new AbortController(),base=new URL('./',import.meta.url),owned=new Set(),released=new WeakSet(),bitmaps=new Set(),closed=new WeakSet(),listeners=[],pendingDisposals=new Set(),initializedRenderers=new WeakSet();
const state=window.__livInterior={ready:false,error:null,backend:null,typology,mode:query.get('modo')||'planta3d',disposed:false,active:query.get('prewarm')!=='1',
  lighting:{bakedActive:false,reason:'carregando'},ownership:{created:0,disposed:0,bitmapsClosed:0}};
let renderer,scene,camera,controls,observer,startup,disposePromise,layout,navigation,entry,catalog,record,source,light,timeLight,resizeView;
let yaw=0,pitch=0,tourPosition=null,route=[],routeResolve=null,frameBusy=false,framePromise=Promise.resolve(),lastFrame=0,ceiling=[];
const furniture=[],meshBySlot=new Map(),baked=[],probeLit=[],keys=new Set(),touchKeys=new Set();
let orbitSnapshot=null,pointer=null,shadowLight=null,planAutoFrame=true,routeRoom=null,presentation=null;
let furnitureFactory,furnitureMaterials,furnitureEditor,solarLighting,improvements,improvementsNotice,doors,doorButton;
let timeOfDay=interiorTimeState(14);

function invalidateShadows(){if(solarLighting)solarLighting.invalidateShadows();else if(shadowLight)shadowLight.shadow.needsUpdate=true;}
state.setTimeOfDay=function(hour,unitContext=timeOfDay?.context,options={}){
  if(state.disposed)return false;
  let next;
  try{next=interiorTimeState(hour,unitContext,{date:options.date??timeOfDay?.date});}catch(error){state.timeError=String(error.message||error);return false;}
  timeOfDay=next;state.timeOfDay=structuredClone(next);state.timeError=null;
  if(solarLighting){
    const {weights}=applyTimeLight();improvements?.setEnvironmentIntensity(scene.environmentIntensity);solarLighting.syncPresentation(state.mode);
    // As horas deste lado ainda não chegaram: segue dinâmico e troca quando baixar.
    if(timeLight&&(!weights||weights.stale))timeLight.ensure(next).then(()=>{if(!state.disposed&&timeOfDay===next)applyTimeLight();})
      .catch(error=>{if(!state.disposed)state.timeLightError=String(error.message||error);});
  }
  return true;
};
/** Luz gravada no Cycles (céu + rebatimento) com o sol medido. Móvel movido segue nela: as sondas são lidas
 *  pela posição do pixel, e o sol (sombra do móvel) é em tempo real; só fica a sombra suave antiga no piso. */
function applyTimeLight(){
  const weights=timeLight?.apply(timeOfDay)||null,active=Boolean(weights);
  setBaked(active,active?'luz gravada no Cycles por hora':'horário solar: materiais e sombras dinâmicos');
  solarLighting.apply(timeOfDay,{sunIrradiance:active?weights.sun:null});
  setReflectionNormalization(active);
  return {weights,active};
}

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
function showInteriorWarning(message,detail){
  if(!improvementsNotice){improvementsNotice=document.createElement('p');improvementsNotice.id='interior-improvements-warning';improvementsNotice.setAttribute('role','status');
    Object.assign(improvementsNotice.style,{position:'absolute',left:'12px',bottom:'12px',maxWidth:'calc(100% - 24px)',margin:'0',padding:'9px 12px',borderRadius:'6px',background:'#3d2b1ef2',color:'#ffe1b5',fontSize:'12px',zIndex:'20'});stage.append(improvementsNotice);}
  improvementsNotice.textContent=message;improvementsNotice.title=detail;
}
async function cleanup(){
  furnitureEditor?.dispose();
  solarLighting?.dispose();
  improvementsNotice?.remove();doorButton?.remove();
  observer?.disconnect();renderer?.setAnimationLoop(null);
  for(const off of listeners.splice(0))off();
  for(const resource of owned)release(resource);
  await Promise.all([...pendingDisposals]);
  for(const bitmap of bitmaps)closeBitmap(bitmap);
  scene?.clear();state.authoringScene?.clear();state.ready=false;
}
state.dispose=function(){
  if(disposePromise)return disposePromise;
  state.disposed=true;state.ready=false;state.active=false;controller.abort();keys.clear();touchKeys.clear();stopRoute(false);
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
if(query.get('embed')==='1')document.querySelector('#touch-pad').style.right='96px';

async function sha(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function unzip(bytes){return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());}
async function load(file,json=false,quiet=false){
  if(!file||!/^interiores\/(?:shared|canto|meio)\/[a-zA-Z0-9._/-]+$/.test(file.path)||file.path.split('/').includes('..')||!/^[a-f0-9]{64}$/.test(file.sha256)||!Number.isInteger(file.bytes))throw Error('Identidade de recurso interior inválida.');
  // A luz gravada muda de conteúdo sem mudar de nome: o SHA no endereço evita a cópia velha do cache.
  check();const url=new URL(file.path,base);if(quiet)url.searchParams.set('v',file.sha256);
  const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error(`${file.path}: HTTP ${response.status}.`);
  let bytes;
  if(response.body){
    const reader=response.body.getReader(),chunks=[];let loaded=0;
    try{for(;;){const {value,done}=await reader.read();if(done)break;check();loaded+=value.length;if(loaded>file.bytes){await reader.cancel();throw Error(`Tamanho do recurso ${file.path} inválido.`);}chunks.push(value);if(!quiet)progress('Baixando o interior selecionado…','download',{resource:file.path,loaded,total:file.bytes});}}
    finally{reader.releaseLock();}
    bytes=new Uint8Array(loaded);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
  }else bytes=new Uint8Array(await response.arrayBuffer());check();
  if(bytes.length!==file.bytes||await sha(bytes)!==file.sha256)throw Error(`Identidade do recurso ${file.path} inválida.`);
  if(file.compression==='gzip'){
    if(!quiet)progress('Preparando os recursos do interior…','decode',{resource:file.path});
    bytes=await unzip(bytes);check();
    if(bytes.length!==file.decodedBytes||await sha(bytes)!==file.decodedSHA256)throw Error(`Conteúdo comprimido ${file.path} inválido.`);
  }
  check();return json?JSON.parse(new TextDecoder().decode(bytes)):bytes;
}
function bytes64(encoded){const raw=atob(encoded),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes;}
function sourceMaterialAdditions(source,native){
  const materials=Object.fromEntries(Object.entries(source.materials).filter(([id])=>!Object.hasOwn(native,id)));
  const textures={};
  for(const material of Object.values(materials))for(const field of ['map','normalMap','roughnessMap','metalnessMap','bumpMap','emissiveMap']){
    const id=material[field];if(!id)continue;
    if(!source.textures[id])throw Error('Textura do acabamento adicional ausente.');textures[id]=source.textures[id];
  }
  return {materials,textures};
}
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
    // Valores do LIV_Luz_Natural.blend: vidro com transmissão 1 e caixilho fosco sem metal.
    // A folha de correr empilha 4 faces; 17% em cada escurecia a varanda pela metade.
    if(id==='m5'){materials[id].opacity=.06;materials[id].color.setRGB(.97,.99,.99);}
    if(id==='m4'){materials[id].metalness=0;materials[id].roughness=.32;}
    // O box do chuveiro (2 m, encostado na janela do banho) era painel branco opaco e barrava o sol: vira vidro.
    // Vidro limpo quase não espalha luz: cor quase preta, fica o reflexo (com o sol medido, branco estourava).
    if(spec.name==='Acabamento box')Object.assign(materials[id],{transparent:true,opacity:.18,roughness:.05,metalness:0,depthWrite:false}),materials[id].color.setRGB(.02,.025,.025);
  }
  return materials;
}
/** As esquadrias da fonte (batentes, caixilhos, vidros e folhas) vêm com TODOS os triângulos girando contra a
 * normal. Com DoubleSide o Three tomava o lado de dentro por verso e virava a normal para fora: a porta lia a
 * sonda do lado de fora e estourava de branco. Só vira malha inteira ao contrário; a mista (folha de planta) fica. */
function windWithNormals(geometry){
  const p=geometry.attributes.position,n=geometry.attributes.normal,index=geometry.index;if(!n)return geometry;
  const at=i=>index?index.getX(i):i,count=index?index.count:p.count,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),s=new THREE.Vector3(),t=new THREE.Vector3();
  let against=0,total=0;
  for(let i=0;i<count;i+=3){
    a.fromBufferAttribute(p,at(i));b.fromBufferAttribute(p,at(i+1)).sub(a);c.fromBufferAttribute(p,at(i+2)).sub(a);b.cross(c);
    s.fromBufferAttribute(n,at(i)).add(t.fromBufferAttribute(n,at(i+1))).add(t.fromBufferAttribute(n,at(i+2)));
    const d=b.dot(s);if(Math.abs(d)<1e-12)continue;total++;if(d<0)against++;
  }
  if(!total||against<total)return geometry;
  if(index){for(let i=0;i<count;i+=3){const k=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,k);}}
  else for(const attribute of Object.values(geometry.attributes))for(let i=0;i<count;i+=3)for(let k=0;k<attribute.itemSize;k++){
    const v=attribute.getComponent(i+1,k);attribute.setComponent(i+1,k,attribute.getComponent(i+2,k));attribute.setComponent(i+2,k,v);
  }
  geometry.userData.livRewound=total;return geometry;
}
/** Vértice que só serve a triângulos de piso, parede ou teto (face a menos de 1° de um eixo) recebe a normal do eixo.
 * A fonte do Canto tem vértice de piso inclinado até 55° (o leque herda a média das paredes): o sol e o reflexo
 * acendiam cada triângulo de um jeito e o chão ganhava "raios" retos. O lado vem da normal, não da ordem dos cantos. */
function flattenAxisNormals(geometry){
  const p=geometry.attributes.position,n=geometry.attributes.normal,index=geometry.index;if(!n)return geometry;
  const at=i=>index?index.getX(i):i,count=index?index.count:p.count,want=new Map();
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),s=new THREE.Vector3(),t=new THREE.Vector3();
  for(let i=0;i<count;i+=3){
    const ids=[at(i),at(i+1),at(i+2)];
    a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]).sub(a);c.fromBufferAttribute(p,ids[2]).sub(a);b.cross(c);
    const length=b.length();let key=-1;
    if(length>1e-12){
      b.divideScalar(length);const f=[b.x,b.y,b.z],k=f.map(Math.abs).indexOf(Math.max(...f.map(Math.abs)));
      s.fromBufferAttribute(n,ids[0]).add(t.fromBufferAttribute(n,ids[1])).add(t.fromBufferAttribute(n,ids[2]));
      if(Math.abs(f[k])>.99985)key=k*2+(f[k]*[s.x,s.y,s.z][k]>0?(f[k]>0?1:0):(f[k]>0?0:1));
    }
    for(const id of ids){const prev=want.get(id);want.set(id,prev===undefined||prev===key?key:-1);}
  }
  let flattened=0;
  for(const [id,key]of want){if(key<0)continue;const v=[0,0,0];v[key>>1]=key&1?1:-1;n.setXYZ(id,...v);flattened++;}
  if(flattened)n.needsUpdate=true;
  return geometry;
}
function geometryFrom(spec){
  const geometry=own(new THREE.BufferGeometry());
  for(const [name,size]of [['position',3],['normal',3],['uv',2],['color',3]])if(spec[name]?.length)geometry.setAttribute(name,new THREE.Float32BufferAttribute(spec[name],size));
  if(spec.index)geometry.setIndex(new THREE.Uint32BufferAttribute(spec.index,1));
  for(const group of spec.groups||[])geometry.addGroup(group.start,group.count,group.materialIndex);
  geometry.computeBoundingSphere();return flattenAxisNormals(windWithNormals(geometry));
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
    mesh.visible=object.visible;mesh.castShadow=mesh.receiveShadow=!list.every(material=>material.transparent);
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
    let group;
    if(item.tipo==='tapete'){
      // Library stripes share coplanar top faces. A closed fabric slab keeps
      // the nominal footprint/thickness and avoids z-fighting and bake overlap.
      group=new THREE.Group();const geometry=new THREE.BoxGeometry(...def.b);
      geometry.translate(0,def.b[1]/2,0);const color=new THREE.Color(item.cor??def.cor),colors=new Float32Array(geometry.attributes.position.count*3);
      for(let i=0;i<colors.length;i+=3)colors.set(color.toArray(),i);
      geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
      group.add(new THREE.Mesh(geometry,materials.m21));
    }else group=factory.catalog.geoDoMovel(def,item.cor,{w:item.w,d:item.d,h:item.h,estilo:item.estilo});
    if(!group)throw Error(`Não foi possível construir ${item.name}.`);
    finishNativeFurniture(group,item,materials);
    if(!def.param)group.scale.set(item.w/def.b[0],item.h/def.b[1],item.d/def.b[2]);
    group.position.set(item.position[0],.03,item.position[1]);group.rotation.y=item.rotation*Math.PI/2;
    group.traverse(o=>{if(o.isMesh){o.castShadow=!o.material.transparent;o.receiveShadow=true;o.userData.furnitureId=item.id;}});registerTree(group);scene.add(group);item.group=group;
  }
}
// Reuse the native PBR maps on the independently generated furniture. UVs
// are projected from local metre coordinates, so the material does not depend
// on the dimensions or room positions of the corner apartment.
/** Os ids mN são do Canto (materials.json); o Meio numera os próprios: lá o m27 é uma pia e o box é m26/m29.
 * Procura pelo nome do material do Canto; no Canto o id já bate e nada muda. */
const CANTO_NAMES={m6:'gesso-rodateto',m9:'Algodao cru',m12:'Acabamento guardaroupa',m13:'Acabamento criado',m16:'Acabamento mesa',m18:'Tecido LIV',
  m19:'Acabamento rack',m20:'Acabamento tv',m21:'Tapete LIV',m22:'Acabamento cadeira',m23:'Acabamento fogao',m24:'Acabamento pia',
  m25:'Acabamento geladeira',m26:'Acabamento vaso',m27:'Acabamento box',m29:'Acabamento maquina'};
const byRole=(materials,id)=>materials[id]?.name===CANTO_NAMES[id]?materials[id]:Object.values(materials).find(material=>material.name===CANTO_NAMES[id])||materials[id];
const named=(materials,name)=>Object.values(materials).filter(material=>material.name===name);
function finishNativeFurniture(group,item,materials){
  const key=({guardaroupa:'m12',criado:'m13',mesa:'m16',cadeira:'m22',rack:'m19',
    bancada:'m24',pia:'m24',fogao:'m23',geladeira:'m25',vaso:'m26',maquina:'m29',
    cama:'m9',sofa:'m18',poltrona:'m18',tapete:'m21',box:'m27',tv:'m20',
    aereo:'m12',ripado:'m12'})[item.tipo]||'m6';
  const material=own(byRole(materials,key).clone());if(!material.userData.livVeneer){material.color.setRGB(1,1,1);material.vertexColors=true;}
  const textile=['cama','sofa','poltrona','tapete'].includes(item.tipo);
  group.traverse(mesh=>{
    if(!mesh.isMesh)return;const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal;
    if(material.map&&(textile||!g.attributes.uv)){
      const uv=new Float32Array(p.count*2);
      // The frozen Canto textiles use roughly three texture cycles per metre.
      // Generic box UVs stretch one weave across an entire cushion or mattress.
      const density=textile?3:1;
      for(let i=0;i<p.count;i++){
        const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
        uv[2*i]=(nz>=nx||ny>=nx?p.getX(i):p.getZ(i))*density;
        uv[2*i+1]=(ny>=nx&&ny>=nz?p.getZ(i):p.getY(i))*density;
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
  for(const group of corner.groups)geometry.addGroup(group.start,group.count,group.materialIndex);geometry.computeBoundingSphere();return flattenAxisNormals(windWithNormals(geometry));
}
function installBake(compact){
  if(!light.ready||!light.geometryApproved||light.colorPass!==false||light.sourceSHA256!==record.sourceSHA256||light.unitSHA256!==record.unitSHA256||compact.sourceSHA256!==record.sourceSHA256||compact.unitSHA256!==record.unitSHA256||light.geometrySHA256!==record.files.compact.decodedSHA256||light.textureSHA256!==record.files.atlas.decodedSHA256)throw Error('Identidade do bake interior não corresponde à unidade.');
  if(compact.schema!=='liv-interior-corners-v1'||compact.uvScale!==65535||compact.objects.length!==light.objects)throw Error('Contrato do bake interior inválido.');
  // Só o UV1 do atlas antigo é reaproveitado; a luz vem de luz-horario/.
  for(const corner of compact.objects){
    const object=source.objects[corner.objectIndex],mesh=meshBySlot.get(corner.slot);
    if(!mesh||!object?.bake||object.slot!==corner.slot||object.instance!==corner.instance||object.geometry!==corner.geometry)throw Error('Alvo RGBM perdeu identidade.');
    baked.push({mesh,originalGeometry:mesh.geometry,originalMaterial:mesh.material,geometry:expandedGeometry(source.geometries[object.geometry],corner),material:null});
  }
}
/** Depois dos acabamentos aprovados: cada material da casca ganha a versão que lê a luz gravada. */
function bindTimeLight(){
  const nodeMaterials=new Map();
  for(const target of baked){
    const list=(Array.isArray(target.originalMaterial)?target.originalMaterial:[target.originalMaterial]).map(native=>{
      if(!native.isMeshStandardMaterial)throw Error('RGBM requer um material PBR nativo.');
      if(!nodeMaterials.has(native)){const node=own(new LivRGBMNodeMaterial({},null,0,0,timeLight.irradiance));node.copy(native);nodeMaterials.set(native,node);}
      return nodeMaterials.get(native);
    });
    target.material=list.length===1?list[0]:list;
  }
  // O atlas tem céu e rebatimento; o sol e os plafons diretos continuam em tempo real.
  setRGBMTimeLighting({bake:1,direct:1,ambient:0});
}
/** Moldura (5 cm), batentes/guarnições e aros de gesso dos plafons têm menos de 1 texel de largura no atlas
 * de 1024 e pegam a luz da ilha vizinha (a faixa branca no teto): leem as sondas como os móveis. */
function dropThinBakes(){
  const thin=new Set([furnitureMaterials.m3,...named(furnitureMaterials,'gesso-rodateto')]),recorded=new Set(timeLight.targets);
  for(let i=baked.length-1;i>=0;i--){
    const target=baked[i],materials=[target.originalMaterial].flat();
    // Peças antigas fora da cena aprovada (as camas foram trocadas no Blender) não têm luz gravada: o atlas é preto ali.
    const missing=recorded.size>0&&!recorded.has(target.mesh.name);
    // Vidro (box) também sai do atlas: fica com o material transparente e o reflexo do ambiente.
    if(!missing&&!target.mesh.userData.livCornice&&!materials.every(material=>thin.has(material)||material.transparent))continue;
    target.mesh.geometry=target.originalGeometry;target.mesh.material=target.originalMaterial;baked.splice(i,1);
    state.thinBakes=(state.thinBakes||[]).concat(target.mesh.name);
  }
}
/** O que não tem UV1 (móveis aprovados, portas, moldura, caixilhos) lê a mesma hora nas sondas do cômodo. */
function bindProbeLight(root=scene){
  if(!timeLight?.probeIrradiance)return;
  if(root===scene)dropThinBakes();
  const bakedMeshes=new Set(baked.map(target=>target.mesh)),copies=new Map();
  root.traverse(mesh=>{
    if(!mesh.isMesh||bakedMeshes.has(mesh)||mesh.userData.livSolarFixture)return;
    const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    if(list.some(material=>!material.isMeshStandardMaterial||material.isLivRGBMNodeMaterial||material.transparent))return;
    const pairs=list.map(native=>{
      if(!copies.has(native)){
        const node=own(native.isMeshPhysicalMaterial?new LivBakedPhysicalNodeMaterial({},timeLight.probeIrradiance):new LivRGBMNodeMaterial({},null,0,0,timeLight.probeIrradiance));
        node.copy(native);copies.set(native,node);
      }
      return [copies.get(native),native];
    });
    probeLit.push({mesh,originalMaterial:mesh.material,material:Array.isArray(mesh.material)?pairs.map(pair=>pair[0]):pairs[0][0],pairs});
  });
}
async function loadTimeManifest(){
  const response=await fetch(new URL(`interiores/${typology}/luz-horario/manifest.json`,base),{signal:controller.signal,cache:'no-cache'});
  if(response.status===404)return null;if(!response.ok)throw Error(`Luz gravada: HTTP ${response.status}.`);
  const manifest=await response.json();
  if(manifest.schema!=='liv-interior-time-lightmaps-v1'||manifest.typology!==typology||manifest.encoding!=='linear-rgbm2-u8'||manifest.sourceSHA256!==record.sourceSHA256||manifest.geometrySHA256!==record.files.compact.decodedSHA256||!manifest.keys?.length||!manifest.night)throw Error('Luz gravada de outra revisão do interior.');
  return manifest;
}
function layoutOriginal(){return furniture.every(m=>Math.abs(m.position[0]-m.originalPosition[0])<1e-9&&Math.abs(m.position[1]-m.originalPosition[1])<1e-9&&m.rotation===m.originalRotation&&sameFurnitureDimensions(m,m.originalDimensions));}
function setBaked(active,reason){
  if(active&&!baked.every(target=>target.material))active=false;
  const changed=state.lighting.bakedActive!==active;
  for(const target of baked){target.mesh.geometry=active?target.geometry:target.originalGeometry;target.mesh.material=active?target.material:target.originalMaterial;}
  for(const target of probeLit){
    target.mesh.material=active?target.material:target.originalMaterial;
    // O ganho do ambiente local muda com a hora nos originais; a cópia acompanha.
    if(active)for(const [copy,native]of target.pairs)copy.envMapIntensity=native.envMapIntensity;
  }
  state.lighting={bakedActive:active,reason};
  if(changed)invalidateShadows();
}
function furnitureTransform(item){
  item.group.position.x=item.position[0];item.group.position.z=item.position[1];
  // Frozen meshes already contain their nominal rotation. Native factory
  // groups instead carry it on the parent; both apply only the requested delta.
  item.group.rotation.y=((item.baseRotation??item.originalRotation)+item.rotation-item.originalRotation)*Math.PI/2;
}
function furnitureChanged(){
  // Restore/reset applies all transforms before rebuilding collision/routes.
  navigation.invalidate();stopRoute(false);
  if(tourPosition&&!navigation.free(...tourPosition))tourPosition=navigation.entry();
  const original=layoutOriginal();if(solarLighting)applyTimeLight();else setBaked(false,original?'iluminação dinâmica':'móveis alterados: iluminação dinâmica');
  const note=document.querySelector('#furniture-lighting');
  const dynamic=!original&&!state.lighting.bakedActive;
  note.hidden=!dynamic;note.textContent=dynamic?'Móveis alterados: iluminação dinâmica.':'';
  furnitureEditor?.refresh();
  invalidateShadows();
  refreshRooms();
}
state.moveFurniture=function(id,dx,dz){
  if(!state.ready)return false;const item=furniture.find(m=>m.id===id);if(!item||![dx,dz].every(Number.isFinite))return false;
  const p=[item.position[0]+dx,item.position[1]+dz];
  // Keep the furniture anchor in a real room; conservative collision remains
  // active even if the new layout blocks a destination.
  if(!layout.rooms.some(r=>r.poly&&pointIn(r.poly,...p)))return false;
  item.position=p;furnitureTransform(item);furnitureChanged();return true;
};
function pointIn(poly,x,z){let b=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],q=poly[j];if((a[1]>z)!==(q[1]>z)&&x<(q[0]-a[0])*(z-a[1])/(q[1]-a[1])+a[0])b=!b;}return b;}
state.rotateFurniture=function(id){if(!state.ready)return false;const item=furniture.find(m=>m.id===id);if(!item)return false;item.rotation=(item.rotation+1)%4;furnitureTransform(item);furnitureChanged();return true;};
function disposeEditedGroup(group){
  const resources=new Set();group.traverse(mesh=>{if(mesh.geometry)resources.add(mesh.geometry);if(mesh.material)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])resources.add(material);});
  framePromise.catch(()=>{}).then(()=>{for(const resource of resources)release(resource);});
}
function resizeFurniture(item,dimensions){
  if(sameFurnitureDimensions(item,dimensions))return true;
  const original=sameFurnitureDimensions(dimensions,item.originalDimensions);
  let group=item.originalGroup;
  if(!original){
    group=furnitureFactory.improvements?.createFurniture(item,dimensions);
    if(!group){
      const def=furnitureFactory.catalog.MOVEIS[item.tipo];if(!def)return false;
      group=furnitureFactory.catalog.geoDoMovel(def,item.cor,{...dimensions,estilo:item.estilo});
      let meshes=0;group.traverse(mesh=>{if(mesh.isMesh)meshes++;});if(!meshes)return false;
      finishNativeFurniture(group,item,furnitureMaterials);
      if(!def.param)group.scale.set(dimensions.w/def.b[0],dimensions.h/def.b[1],dimensions.d/def.b[2]);
      group.position.y=.03;
    }
    group.traverse(mesh=>{if(mesh.isMesh){mesh.castShadow=![mesh.material].flat().every(material=>material.transparent);mesh.receiveShadow=true;mesh.userData.furnitureId=item.id;}});
    registerTree(group);bindProbeLight(group);
  }
  if(!group)return false;
  setBaked(false,'móveis alterados: iluminação dinâmica');
  if(!item.originalGroup){item.originalGroup=item.group;item.originalBaseRotation=item.baseRotation;}
  const previous=item.group;scene.remove(previous);scene.add(group);item.group=group;
  item.baseRotation=original?item.originalBaseRotation:item.originalRotation;
  Object.assign(item,dimensions);furnitureTransform(item);
  if(previous!==item.originalGroup){
    // A peça redimensionada sai das sondas com o material nativo, que é o que disposeEditedGroup libera.
    for(let i=probeLit.length-1;i>=0;i--){let o=probeLit[i].mesh;while(o&&o!==previous)o=o.parent;if(o){probeLit[i].mesh.material=probeLit[i].originalMaterial;probeLit.splice(i,1);}}
    disposeEditedGroup(previous);
  }
  return true;
}
state.resizeFurniture=function(id,dimensions){
  if(!state.ready||!validFurnitureDimensions(dimensions,layout.pd))return false;
  const item=furniture.find(item=>item.id===id);if(!item||!resizeFurniture(item,dimensions))return false;
  furnitureChanged();return true;
};
state.resetFurniture=function(){if(!state.ready)return false;for(const item of furniture){resizeFurniture(item,item.originalDimensions);item.position=[...item.originalPosition];item.rotation=item.originalRotation;furnitureTransform(item);}furnitureChanged();return true;};
state.finishFurnitureEditing=async function(){
  if(!state.ready||state.disposed)return false;
  renderer.setAnimationLoop(null);
  try{
    await framePromise;check();scene.updateMatrixWorld(true);navigation.invalidate();invalidateShadows();
    await renderer.compileAsync(scene,camera);check();await renderer.renderAsync(scene,camera);check();
    state.lighting.updatedAt=Date.now();return true;
  }finally{if(state.active&&!state.disposed)renderer.setAnimationLoop(renderFrame);}
};

function addLights(){
  // FUNDO-3D-20261023: o CSS fornece o fundo, sem passar pelo ajuste de exposição da cena.
  scene.background=null;
  solarLighting=createInteriorSolarLighting({scene,layout,own,ceiling,environment:improvements?.environment,backgroundEnvironment:improvements?.backgroundEnvironment,environmentExposureEV:improvements?.environmentExposureEV});shadowLight=solarLighting.sun;
  state.setTimeOfDay(timeOfDay.hour,timeOfDay.context,{date:timeOfDay.date});
}
function placeOrbit(position,target){
  // Settle old gesture inertia before applying a saved or newly framed pose.
  const damping=controls.enableDamping;controls.enableDamping=false;controls.update();
  controls.target.copy(target);camera.position.copy(position);controls.update();controls.enableDamping=damping;
}
function orbitDefault(){
  scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(scene);
  const area=stage.getBoundingClientRect(),toolbar=document.querySelector('#interior-controls').getBoundingClientRect();
  const bottom=[...document.querySelectorAll('#interior-note')].filter(element=>element.getClientRects().length).map(element=>area.bottom-element.getBoundingClientRect().top);
  const inset=Math.max(toolbar.bottom-area.top,...bottom)+16;
  const limits={x:Math.max(.5,1-32/area.width),y:Math.max(.3,1-2*inset/area.height)};
  const pose=planFrame(bounds,camera.fov,camera.aspect,limits);
  controls.maxDistance=Math.max(32,pose.distance*1.5);placeOrbit(pose.position,pose.target);
  state.framing={limits,bounds:[bounds.min.toArray(),bounds.max.toArray()]};
}
state.framePlan=function(){if(!state.ready||state.mode!=='planta3d')return false;planAutoFrame=true;orbitSnapshot=null;orbitDefault();return true;};
state.setWallCut=function(enabled){
  if(!state.ready||state.mode!=='planta3d'||typeof enabled!=='boolean')return false;
  presentation.setEnabled(enabled);document.querySelector('#cut-interior').setAttribute('aria-pressed',String(enabled));
  solarLighting?.syncPresentation(state.mode);invalidateShadows();
  return true;
};
function faceRoom(roomId){
  scene.updateMatrixWorld(true);const eye=new THREE.Vector3(tourPosition[0],1.62,tourPosition[1]),ray=new THREE.Raycaster();
  const look=roomLook(tourPosition,layout,furniture,roomId,candidate=>{
    const delta=new THREE.Vector3(...candidate.point).sub(eye),distance=delta.length();ray.set(eye,delta.normalize());ray.far=distance-.05;
    return !ray.intersectObjects(scene.children,true).some(hit=>{
      if(hit.object.userData.furnitureId&&hit.object.userData.furnitureId===candidate.id)return false;
      const materials=Array.isArray(hit.object.material)?hit.object.material:[hit.object.material];
      return hit.object.visible&&materials.some(material=>!material.transparent||material.opacity>=.7);
    });
  });
  yaw=look?.yaw??navigation.direction(tourPosition);pitch=look?.pitch??0;state.roomView=look;
}
function setTourCamera(){camera.position.set(tourPosition[0],1.62,tourPosition[1]);camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);}
state.setMode=function(mode,{restoreOrbit=false}={}){
  if(!['planta3d','visita'].includes(mode)||!presentation||state.disposed)return false;
  const changed=state.mode!==mode;
  if(state.mode==='planta3d'&&mode==='visita')orbitSnapshot={position:camera.position.toArray(),target:controls.target.toArray()};
  state.mode=mode;document.documentElement.dataset.mode=mode;controls.enabled=state.active&&mode==='planta3d';presentation.setMode(mode);solarLighting?.syncPresentation(state.mode);
  // O topo unido das paredes fica 6 cm acima do forro: no Tour ele só aparecia pela fresta da moldura,
  // aceso pelo sol que o forro não cobre. Na Planta 3D, sem forro, ele é o acabamento das paredes.
  scene.traverse(mesh=>{if(mesh.userData.livWallTop)mesh.visible=mode!=='visita';});
  if(mode==='visita')furnitureEditor?.stop();else furnitureEditor?.refresh();
  for(const id of ['frame-interior','cut-interior'])document.querySelector(`#${id}`).hidden=mode!=='planta3d';
  if(changed)invalidateShadows();
  keys.clear();touchKeys.clear();stopRoute(false);
  if(mode==='visita'){tourPosition??=[...entry];setTourCamera();}
  else if(planAutoFrame)orbitDefault();
  else if(orbitSnapshot&&(changed||restoreOrbit))placeOrbit(new THREE.Vector3(...orbitSnapshot.position),new THREE.Vector3(...orbitSnapshot.target));
  else if(changed)orbitDefault();
  document.querySelector('#touch-pad').hidden=mode!=='visita';
  document.querySelector('#interior-tip').textContent=mode==='visita'?'Arraste para olhar · WASD ou setas para caminhar':'Arraste para girar · dois dedos ou roda para aproximar';
  for(const id of ['planta3d','visita'])document.querySelector(`#mode-${id}`).setAttribute('aria-pressed',String(mode===id));
  window.dispatchEvent(new CustomEvent('liv-interior-mode',{detail:{mode,typology}}));
  return true;
};
function stopRoute(result){route=[];routeRoom=null;if(routeResolve){const resolve=routeResolve;routeResolve=null;resolve(result);}}
state.getRoomRoutes=function(){return navigation?navigation.routes(tourPosition||entry):[];};
function refreshRooms(){
  if(!navigation)return;const routes=state.getRoomRoutes(),select=document.querySelector('#room-select'),previous=select.value;
  select.replaceChildren(...routes.map(r=>{const option=document.createElement('option');option.value=r.id;option.textContent=r.name+(r.reachable?'':' · passagem bloqueada');option.disabled=!r.reachable;return option;}));
  if(routes.some(r=>r.id===previous&&r.reachable))select.value=previous;
  state.rooms=routes.map(({id,name,reachable,target})=>({id,name,reachable,target}));
}
state.goToRoom=function(id,{instant=false}={}){
  if(!state.ready)return Promise.resolve(false);state.setMode('visita');
  // A rota não atravessa folha fechada: "Ir ao ambiente" abre as portas de dentro.
  if(doors?.doors.some(door=>!door.entrance&&door.target<.5)){for(const door of doors.doors)if(!door.entrance)doors.setOpen(door.id,true,{instant:true});navigation.invalidate();invalidateShadows();}
  const target=state.getRoomRoutes().find(r=>r.id===id);
  if(!target?.reachable)return Promise.resolve(false);stopRoute(false);
  if(instant){tourPosition=[...target.target];faceRoom(id);setTourCamera();return Promise.resolve(true);}
  route=target.path.slice(1);routeRoom=id;pitch=0;return new Promise(resolve=>{routeResolve=resolve;if(!route.length){faceRoom(id);setTourCamera();stopRoute(true);}});
};
state.move=function(dx,dz){
  if(!state.ready||state.mode!=='visita')return false;
  if(typeof dx==='object'){const {forward=0,right=0}=dx;dz=-Math.cos(yaw)*forward-Math.sin(yaw)*right;dx=-Math.sin(yaw)*forward+Math.cos(yaw)*right;}
  if(![dx,dz].every(Number.isFinite))return false;stopRoute(false);tourPosition=navigation.move(tourPosition,dx,dz);setTourCamera();return true;
};
state.navigationDiagnostics=function(){return navigation?{safe:navigation.free(...(tourPosition||entry)),current:[...(tourPosition||entry)],radius:navigation.radius,eye:1.62,reachableRooms:state.rooms?.filter(r=>r.reachable).length||0,totalRooms:layout.rooms.length,followingRoute:route.length>0}:null;};
function tick(dt){
  if(doors?.update(dt)){invalidateShadows();navigation.invalidate();}
  if(state.mode!=='visita'){controls.update();showDoorButton(null);return;}
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
    if(!route.length&&routeResolve){faceRoom(routeRoom);stopRoute(true);}
  }
  setTourCamera();showDoorButton(doors?.nearest(tourPosition[0],tourPosition[1],yaw)||null);
}
/** Perto de uma porta de quarto ou banheiro, um botão (ou a tecla E) abre e fecha a folha. */
function showDoorButton(door){
  if(!doorButton){
    if(!door)return;
    doorButton=document.createElement('button');doorButton.id='door-toggle';doorButton.type='button';
    Object.assign(doorButton.style,{position:'absolute',left:'50%',bottom:'16px',transform:'translateX(-50%)',zIndex:'20',padding:'10px 16px',minHeight:'44px',
      border:'1px solid #ffffff55',borderRadius:'8px',background:'#10191fdd',color:'#f1f5fa',font:'600 13px system-ui,sans-serif',cursor:'pointer'});
    listen(doorButton,'click',()=>{if(doorButton.dataset.door)toggleDoor(doorButton.dataset.door);});stage.append(doorButton);
  }
  doorButton.hidden=!door;if(!door)return;
  const text=`${door.target>.5?'Fechar':'Abrir'} porta${door.room?` · ${door.room}`:''} (E)`;
  if(doorButton.dataset.door!==door.id||doorButton.textContent!==text){doorButton.dataset.door=door.id;doorButton.textContent=text;}
}
function toggleDoor(id){if(doors?.toggle(id))canvas.focus();}
/** A entrada fica sempre fechada; as de dentro abrem e fecham. */
state.setDoorOpen=function(id,open,{instant=false}={}){
  const door=doors?.doors.find(item=>item.id===id);if(!state.ready||!door||door.entrance||typeof open!=='boolean')return false;
  doors.setOpen(id,open,{instant});if(instant){navigation.invalidate();invalidateShadows();}return true;
};
function wire(){
  listen(window,'keydown',event=>{if(!state.active||state.mode!=='visita'||/^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName))return;const key=event.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){event.preventDefault();keys.add(key);}
    if(key==='e'&&!event.repeat&&doorButton?.dataset.door&&!doorButton.hidden){event.preventDefault();toggleDoor(doorButton.dataset.door);}});
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
  listen(document.querySelector('#frame-interior'),'click',()=>state.framePlan());
  listen(document.querySelector('#cut-interior'),'click',()=>state.setWallCut(!presentation.getState().enabled));
  const manualOrbit=()=>{planAutoFrame=false;};controls.addEventListener('start',manualOrbit);listeners.push(()=>controls.removeEventListener('start',manualOrbit));
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
state.getState=function(){return {version:1,typology,mode:state.mode,backend:state.backend,ready:state.ready,error:state.error,disposed:state.disposed,active:state.active,unitSHA256:record?.unitSHA256,sourceSHA256:record?.sourceSHA256,
  geometry:geometryInfo(),camera:camera?{position:camera.position.toArray(),target:controls.target.toArray(),yaw,pitch,autoFrame:planAutoFrame}:null,
  framing:state.framing||null,roomView:state.roomView||null,presentation:presentation?.getState()||null,wallTopRepair:state.wallTopRepair||null,cornice:state.cornice||null,
  ceiling:{visible:ceiling.length>0&&ceiling.every(m=>m.visible),count:ceiling.length},rooms:state.rooms||[],
  furniture:furniture.map(m=>({id:m.id,name:m.name,improvementAsset:m.improvementAsset||null,position:[...m.position],rotation:m.rotation,...dimensionsOf(m),originalDimensions:{...m.originalDimensions},originalPosition:[...m.originalPosition],originalRotation:m.originalRotation,
    modified:Math.abs(m.position[0]-m.originalPosition[0])>1e-9||Math.abs(m.position[1]-m.originalPosition[1])>1e-9||m.rotation!==m.originalRotation||!sameFurnitureDimensions(m,m.originalDimensions)})),
  improvements:improvements?.getState()||state.improvements||null,doors:doors?.getState()||null,look:state.look||null,lighting:{...state.lighting,solar:solarLighting?.getState()||null,timeLight:timeLight?.getState()||null,timeLightError:state.timeLightError||null},timeOfDay:structuredClone(timeOfDay),shadows:shadowLight?{autoUpdate:shadowLight.shadow.autoUpdate,needsUpdate:shadowLight.shadow.needsUpdate,mapSize:shadowLight.shadow.mapSize.toArray()}:null,
  navigation:state.navigationDiagnostics(),renderer:{calls:renderer?.info.render.drawCalls||0,framePasses:renderer?.info.render.frameCalls||0,totalPasses:renderer?.info.render.calls||0,triangles:renderer?.info.render.triangles||0,geometries:renderer?.info.memory.geometries||0,textures:renderer?.info.memory.textures||0},ownership:{...state.ownership}};};
state.restoreState=function(snapshot){
  if(!state.ready||snapshot?.typology!==typology||snapshot.unitSHA256!==record.unitSHA256||snapshot.sourceSHA256!==record.sourceSHA256)return false;
  let restoredTime;
  if(snapshot.timeOfDay){try{restoredTime=interiorTimeState(snapshot.timeOfDay.hour,snapshot.timeOfDay.context,{date:snapshot.timeOfDay.date});}catch{return false;}}
  const currentRevision=improvements?.getState().revision;
  const transforms=(snapshot.furniture||[]).filter(transform=>!(currentRevision&&snapshot.improvements?.revision!==currentRevision&&transform.modified===false&&furniture.find(item=>item.id===transform.id)?.improvementAsset));
  for(const transform of transforms){const item=furniture.find(m=>m.id===transform.id);if(!item||!Array.isArray(transform.position)||transform.position.length!==2||!transform.position.every(Number.isFinite)||!Number.isInteger(transform.rotation)||transform.rotation<0||transform.rotation>3||(['w','h','d'].some(key=>key in transform)&&!validFurnitureDimensions(transform,layout.pd)))return false;}
  for(const transform of transforms){const item=furniture.find(m=>m.id===transform.id);if('w' in transform&&!resizeFurniture(item,dimensionsOf(transform)))return false;item.position=[...transform.position];item.rotation=transform.rotation;furnitureTransform(item);}
  if(transforms.length)furnitureChanged();
  for(const door of snapshot.doors?.doors||[])if(!door.entrance)doors?.setOpen(door.id,door.open,{instant:true});
  if(snapshot.doors)navigation.invalidate();
  if(restoredTime)state.setTimeOfDay(restoredTime.hour,restoredTime.context,{date:restoredTime.date});
  if(typeof snapshot.presentation?.enabled==='boolean'){
    presentation.setEnabled(snapshot.presentation.enabled);document.querySelector('#cut-interior').setAttribute('aria-pressed',String(snapshot.presentation.enabled));
  }
  if(snapshot.camera){
    const p=snapshot.camera.position;if(Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)){
      if(snapshot.mode==='visita'&&navigation.free(p[0],p[2])){tourPosition=[p[0],p[2]];yaw=Number.isFinite(snapshot.camera.yaw)?snapshot.camera.yaw:0;pitch=Math.max(-1.2,Math.min(1.2,snapshot.camera.pitch||0));}
      else if(snapshot.mode==='planta3d'&&Array.isArray(snapshot.camera.target)&&snapshot.camera.target.length===3&&snapshot.camera.target.every(Number.isFinite)){orbitSnapshot={position:p,target:snapshot.camera.target};planAutoFrame=snapshot.camera.autoFrame===true;}
    }
  }
  return state.setMode(snapshot.mode,{restoreOrbit:true});
};
state.capture=async function(){if(!state.ready||state.disposed)throw Error('Interior indisponível para captura.');await framePromise;check();await renderer.renderAsync(scene,camera);check();return canvas.toDataURL('image/png');};

function renderFrame(time){
  if(state.disposed||!state.active||frameBusy)return;
  const dt=Math.min(.05,Math.max(0,(time-lastFrame)/1000||0));lastFrame=time;tick(dt);frameBusy=true;
  framePromise=renderer.renderAsync(scene,camera).catch(fail).finally(()=>{frameBusy=false;});
}
state.setActive=async function(active){
  if(typeof active!=='boolean'||!state.ready||state.disposed)return false;
  if(state.active===active)return true;
  state.active=active;keys.clear();touchKeys.clear();stopRoute(false);
  if(pointer&&canvas.hasPointerCapture(pointer.id))canvas.releasePointerCapture(pointer.id);pointer=null;
  controls.enabled=active&&state.mode==='planta3d';
  if(!active){renderer.setAnimationLoop(null);observer.disconnect();await framePromise;return true;}
  await framePromise;if(!state.active||state.disposed)return false;
  observer.observe(stage);resizeView();lastFrame=0;
  // Reuse the prepared renderer and present its current camera before revealing it.
  framePromise=renderer.renderAsync(scene,camera).catch(fail);await framePromise;
  if(!state.active||state.disposed)return false;
  await renderer.setAnimationLoop(renderFrame);return true;
};

async function start(){
  if(!['canto','meio'].includes(typology)||!['auto','webgpu','webgl'].includes(requested)||!['planta3d','visita'].includes(state.mode))throw Error('Parâmetros do interior inválidos.');
  progress('Preparando os gráficos…');let adapter=null;
  if(requested!=='webgl'&&navigator.gpu){try{adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});}catch(error){state.adapterError=String(error);}}
  check();if(requested==='webgpu'&&!adapter)throw Error('WebGPU não está disponível neste dispositivo.');
  const options={canvas,alpha:true,antialias:true,forceWebGL:requested==='webgl'||!adapter};renderer=createRenderer(options);renderer.setClearAlpha(0);state.renderer=renderer;
  try{await initializeRenderer(renderer);}catch(error){if(requested!=='auto'||options.forceWebGL)throw error;check();await release(renderer);renderer=createRenderer({...options,forceWebGL:true});state.renderer=renderer;await initializeRenderer(renderer);}
  check();state.backend=renderer.backend.isWebGPUBackend?'webgpu':'webgl';if(requested==='webgpu'&&state.backend!=='webgpu')throw Error('O backend WebGPU exigido não foi ativado.');
  renderer.onError=error=>fail(error);renderer.onDeviceLost=info=>fail(Error(`Dispositivo gráfico perdido: ${info?.message||info?.reason||'desconhecido'}`));
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  progress('Baixando o interior selecionado…');
  const response=await fetch(new URL('interiores/catalogo.json',base),{signal:controller.signal});if(!response.ok)throw Error(`Catálogo interior: HTTP ${response.status}.`);catalog=await response.json();check();
  if(catalog.schema!=='liv-interior-catalog-v1'||!catalog.tipologias?.[typology])throw Error('Tipologia interior ausente do catálogo.');record=catalog.tipologias[typology];
  const runtime=await load(catalog.shared.runtime);check();
  // Execute the exact bytes checked above, retaining the native factory APIs.
  const runtimeURL=URL.createObjectURL(new Blob([runtime],{type:'text/javascript'}));
  try{await import(runtimeURL);}finally{URL.revokeObjectURL(runtimeURL);}check();
  const sourceMaterials=record.geometryKind==='frozen-source'&&record.materialsOrigin==='source';
  const [unit,nativeMaterials,library]=await Promise.all([load(record.files.unit,true),
    load(sourceMaterials?record.files.source:catalog.shared.materials,true),
    load(catalog.shared.furniture,true)]);check();
  if(record.unitSHA256!==record.files.unit.sha256||unit.id!==record.unitId)throw Error('Unidade não pertence à tipologia selecionada.');
  layout=createLayout(unit);scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(48,1,.02,100);state.scene=scene;state.camera=camera;
  controls=own(new OrbitControls(camera,canvas));controls.enableDamping=false;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=3;controls.maxDistance=32;
  const native=await materialsFrom(nativeMaterials);check();
  // Antes de montar os móveis: as cópias do guarda-roupa (aéreos também) herdam a nogueira.
  await applyVeneer(named(native,'Acabamento guardaroupa'),{load:file=>load(file,false,true),own,onBitmap:bitmap=>bitmaps.add(bitmap)});check();
  for(const [i,m]of unit.planta.moveis.entries()){
    const position=[m.p[0]-layout.center[0],m.p[1]-layout.center[1]];
    furniture.push({...m,id:`movel-${i}`,name:m.nome||m.tipo,position,originalPosition:[...position],rotation:m.rot||0,originalRotation:m.rot||0,originalDimensions:dimensionsOf(m)});
  }
  const factory=nativeFactory(native,library);
  furnitureFactory=factory;furnitureMaterials=native;state.ceilingHeight=layout.pd;
  if(record.geometryKind==='frozen-source'){
    [source,light]=await Promise.all([sourceMaterials?Promise.resolve(nativeMaterials):load(record.files.source,true),load(record.files.light,true)]);check();
    if(source.schema!=='liv-interior-scene-v1'||source.unitSHA256!==record.unitSHA256||record.files.source.decodedSHA256!==record.sourceSHA256)throw Error('Fonte congelada não corresponde à unidade.');
    // The Canto source contains an old m6 override shared by many other meshes.
    // Retain its approved runtime palette; only the new cornice material is added.
    if(record.materialsOrigin==='shared-with-additions')Object.assign(native,await materialsFrom(sourceMaterialAdditions(source,native)));
    buildFrozen(source,native);bindFrozenFurniture();
    // Openings fills only the native collision leaf descriptors. The frozen
    // meshes remain untouched; these temporary construction meshes are released.
    for(const mesh of factory.openings.geoDasEsquadrias(layout.house)){own(mesh.geometry);release(mesh.geometry);}
    const [compact,manifest]=await Promise.all([load(record.files.compact,true),loadTimeManifest().catch(error=>{state.timeLightError=String(error.message||error);return null;})]);check();
    installBake(compact);if(manifest)timeLight=createTimeLightmaps({manifest,own,load:file=>load(file,false,true)});
  }else if(record.geometryKind==='native-factories'){
    const recipe=await load(record.files.recipe,true);check();
    if(recipe.unitSHA256!==record.unitSHA256||record.files.recipe.sha256!==record.sourceSHA256||recipe.runtimeSHA256!==catalog.shared.runtime.sha256||recipe.materialsSHA256!==catalog.shared.materials.sha256||recipe.furnitureSHA256!==catalog.shared.furniture.sha256||recipe.lighting!=='dynamic')throw Error('Receita da planta de meio inválida.');
    buildNative(native,factory);
    state.lighting={bakedActive:false,reason:'cena autoral dinâmica da planta de meio'};
  }else throw Error('Formato de geometria interior desconhecido.');
  progress('Carregando os móveis e acabamentos aprovados…','melhorias');
  improvements=await loadInteriorImprovements({base,signal:controller.signal,own,onBitmap:bitmap=>bitmaps.add(bitmap),onStatus:report=>{
    state.improvements=report;
    if(report.status==='loading')progress('Carregando os móveis e acabamentos aprovados…','melhorias',{loaded:report.loaded,total:report.assets});
    if(report.errors.length){
      showInteriorWarning('Parte dos móveis, acabamentos ou ambiente aprovado não carregou. Reabra a planta para tentar novamente.',report.errors.map(error=>`${error.assetId}: ${error.message}`).join('\n'));
    }
  }});check();
  progress('Preparando o acabamento de cor aprovado…','look');
  state.look=await installInteriorLook({renderer,base,record:improvements.lookRecord,signal:controller.signal,own,onStatus:report=>{
    if(report.status==='fallback')showInteriorWarning('O acabamento de cor aprovado não carregou. Usando AgX padrão.',report.error);
  }});check();
  furnitureFactory.improvements=improvements;
  const walls=[];scene.traverse(mesh=>{if(mesh.isMesh&&native.m0&&[mesh.material].flat().includes(native.m0))walls.push(mesh);});
  improvements.replaceFurniture(furniture,scene,typology,walls);improvements.applyFinishes(native,scene);
  improvements.addDecorations(furniture,scene,typology);
  for(const target of baked)target.originalMaterial=target.mesh.material;
  if(timeLight){
    bindTimeLight();
    // As duas horas vizinhas e a noite chegam antes da compilação final; as demais seguem em segundo plano.
    progress('Baixando a luz gravada do horário…','luz');
    await timeLight.ensure(timeOfDay).catch(error=>{state.timeLightError=String(error.message||error);});check();
  }
  state.cornice=installCornice({scene,layout,own,baked}).metrics;
  // Keep the nominal hierarchy before any presentation cut, including finishes
  // that must contribute to the exported light transport of the new Meio bake.
  if(record.geometryKind==='native-factories')state.authoringScene=scene.clone();
  check();if(!ceiling.length)throw Error('O interior perdeu o forro para o Tour.');
  if(record.geometryKind==='frozen-source')state.wallTopRepair=repairWallTops({scene,typology,
    sourceSHA256:record.sourceSHA256,baked,wallMaterial:native.m0,color:layout.unit.cores?.parede||'#eee7d9',own});
  const doorMeshes=material=>{const list=[];scene.traverse(mesh=>{if(mesh.isMesh&&!mesh.userData.furnitureId&&mesh.material===material)list.push(mesh);});return list;};
  doors=createDoors({scene,layout,paint:doorMeshes(native.m3),alu:doorMeshes(native.m4),doorColor:new THREE.Color(layout.unit.cores?.porta??0xEDE7DD),baked,own,roomAt:(x,z)=>layout.rooms.find(room=>inside(room.poly,x,z))?.name||null});
  for(const door of doors.doors)if(door.entrance)doors.setOpen(door.id,false,{instant:true});
  // Cada porta entra no corte inteira: o corte reparenta, e a folha solta pararia de girar.
  const architecture=doors.doors.map(door=>door.group);scene.traverse(mesh=>{if(mesh.isMesh&&!mesh.userData.furnitureId&&!mesh.parent?.userData.livDoor)architecture.push(mesh);});
  presentation=createPlanCutaway({scene,layout,architecture,wallMaterial:native.m0,own});ceiling=presentation.ceiling;
  addLights();bindProbeLight();if(timeLight)applyTimeLight();
  // Walking respects walls and openings; furniture stays visible without blocking passage.
  navigation=createNavigation(layout);entry=navigation.entry();tourPosition=[...entry];faceRoom();refreshRooms();
  function resize(){const width=stage.clientWidth,height=stage.clientHeight;if(!width||!height||state.disposed)return;camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);if(state.mode==='planta3d'&&planAutoFrame)orbitDefault();}
  resizeView=resize;observer=new ResizeObserver(resize);observer.observe(stage);resize();orbitDefault();const initialMode=state.mode;state.mode='planta3d';state.setMode(initialMode);
  wire();document.querySelector('#furniture-select').replaceChildren(...furniture.map(m=>{const option=document.createElement('option');option.value=m.id;option.textContent=m.name;return option;}));
  furnitureEditor=createFurnitureEditor({canvas,camera,scene,furniture,state,listen});
  const area=record.areaPublishedRange?record.areaPublishedRange.map(a=>a.toFixed(2).replace('.',',')).join(' a '):record.area.toFixed(2).replace('.',',');
  progress(`${record.label} · ${area} m² · ilustração aproximada`);
  if(state.mode==='planta3d'&&planAutoFrame)orbitDefault();
  if(query.get('prewarm')==='1'){
    // Tour exposes the ceiling and full walls. Render both presentations once
    // so their GPU buffers, materials and shadow passes are ready for reuse.
    // compileAsync links the shaders off the main thread; a bare first render
    // links them synchronously and froze the host page for ~4.5 s.
    state.setMode('visita');check();await renderer.compileAsync(scene,camera);check();await renderer.renderAsync(scene,camera);check();
    state.setMode('planta3d');await renderer.compileAsync(scene,camera);check();await renderer.renderAsync(scene,camera);check();
    state.setMode(initialMode);
  }
  check();await renderer.compileAsync(scene,camera);check();await renderer.renderAsync(scene,camera);check();state.ready=true;
  for(const element of document.querySelectorAll('#interior-controls button,#interior-controls select,#furniture-panel button,#furniture-panel select,#furniture-panel input'))element.disabled=false;
  if(state.active)renderer.setAnimationLoop(renderFrame);else observer.disconnect();
  return state;
}
startup=Promise.resolve().then(start);state.readyPromise=startup;
startup.catch(error=>{if(!state.disposed)fail(error);});
