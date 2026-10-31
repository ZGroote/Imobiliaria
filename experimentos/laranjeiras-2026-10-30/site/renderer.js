import * as THREE from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {LivRGBMNodeMaterial,createRGBMTexture,replaceRGBMAtlas} from './material-rgbm.js';
import {applyReferenceFinishes} from './exterior-finishes.js';
import {balconyDetailView,BALCONY_DETAIL_BOUNDS,entryDetailView,ENTRY_DETAIL_BOUNDS,pilotFloorView,buildingFacadeView,towerFacadeView} from './cameras.js';
import {unitById} from './unidades.js';
import {loadUnitCatalog,floorOf} from './catalogo-unidades.js';
import {createUnitPicking} from './picking.js';
import {createParkingHighlight} from './vagas.js';
import {environmentTexture,precomputedEnvironment} from './ambiente.js';
import {EXTERIOR_EDITIONS} from './edicoes.js';
import {exteriorAmbience,requestedAmbience} from './ambiencia.js';
import {buyerExperienceEnabled} from './experiencia-compra.js';
import {exteriorTimeLighting} from './horario-exterior.js';
import {addRoofLogo} from './marca-telhado.js';

const state=window.__livProva={ready:false,backend:null,error:null,runtime:THREE.REVISION,active:new URLSearchParams(location.search).get('prewarm')!=='1'};
function progress(phase,message,extra={}){
  if(state.disposed)return;
  state.progress={version:(state.progress?.version||0)+1,phase,message,...extra};
}
const mark=name=>{(state.timings??={})[name]=performance.now();};mark('module');
const parameters=new URLSearchParams(location.search);
const buyerExperience=buyerExperienceEnabled(location.search);
const requested=parameters.get('backend')||'auto';
const finishProfile=parameters.get('acabamento')||'base';
const geometryProfile=parameters.get('geometria')||'base';
const environmentProfile=parameters.get('ambiente')||'precalculado';
const initialAmbience=requestedAmbience(location.search);
const recoveryURL=new URL(location.href);recoveryURL.searchParams.set('backend','webgl');
document.querySelector('#retry').href=recoveryURL.href;
document.body.classList.toggle('embedded',parameters.get('embed')==='1');
const darkBackdrop=parameters.get('embed')==='1'&&parameters.get('tema')==='escuro';
document.body.classList.toggle('dark-theme',darkBackdrop);
const stage=document.querySelector('#stage'),canvas=document.querySelector('#c'),status=document.querySelector('#status');
const base=new URL((Object.hasOwn(EXTERIOR_EDITIONS,geometryProfile)?EXTERIOR_EDITIONS[geometryProfile]:EXTERIOR_EDITIONS.base).assets,import.meta.url);
const requests=new AbortController();
const typedArrays={Float32Array,Float64Array,Uint32Array,Uint16Array,Uint8Array,Int32Array,Int16Array,Int8Array};

async function sha(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function loadBytes(name,record) {
  if(!record||!Number.isInteger(record.bytes)||!/^[a-f0-9]{64}$/.test(record.sha256))throw Error(`Identidade do recurso ${name} ausente no manifesto.`);
  const url=new URL(name,base);url.searchParams.set('v',record.sha256);
  const response=await fetch(url,{signal:requests.signal});
  if(!response.ok) throw Error(`Recurso ${name}: HTTP ${response.status}.`);
  const message=downloadMessage(name);
  let bytes;
  if(response.body){
    const reader=response.body.getReader(),chunks=[];let loaded=0;
    progress('download',message,{resource:name,loaded,total:record.bytes});
    try{
      for(;;){
        const {value,done}=await reader.read();if(done)break;
        loaded+=value.length;
        if(loaded>record.bytes){await reader.cancel();throw Error(`Tamanho do recurso ${name} inválido.`);}
        chunks.push(value);progress('download',message,{resource:name,loaded,total:record.bytes});
      }
      bytes=new Uint8Array(loaded);let offset=0;
      for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    }finally{reader.releaseLock();}
  }else{
    bytes=new Uint8Array(await response.arrayBuffer());
    progress('download',message,{resource:name,loaded:bytes.length,total:record.bytes});
  }
  if(record && (bytes.length!==record.bytes || await sha(bytes)!==record.sha256)) throw Error(`Identidade do recurso ${name} inválida.`);
  return bytes;
}

function downloadMessage(name) {
  return name==='scene.json.gz'?'Baixando o modelo':name==='irradiance.rgbm.gz'?'Baixando a iluminação':'Baixando os acabamentos';
}

// Scene and atlases are downloaded, verified, unzipped and parsed in a worker:
// on a phone that work blocked the page for ~0.5 s, plus ~0.7 s for the full atlas.
const decoder=new Worker(new URL('./decodificar-worker.js',import.meta.url),{type:'module'}),decoding=new Map();
let decodeSerial=0;
decoder.onmessage=({data})=>{
  const job=decoding.get(data.id);if(!job)return;
  if(data.progress){job.progress(data.progress);return;}
  decoding.delete(data.id);
  if(data.error)job.reject(Error(data.error));else job.resolve(data.data??data.bytes);
};
decoder.onerror=()=>{for(const job of decoding.values())job.reject(Error('O decodificador de recursos não pôde ser iniciado.'));decoding.clear();};
requests.signal.addEventListener('abort',()=>decoder.terminate());

function decode(name,record,decodedSHA256,scene=false) {
  if(!record||!Number.isInteger(record.bytes)||!/^[a-f0-9]{64}$/.test(record.sha256))throw Error(`Identidade do recurso ${name} ausente no manifesto.`);
  const url=new URL(name,base);url.searchParams.set('v',record.sha256);
  return new Promise((resolve,reject)=>{
    const id=++decodeSerial;
    decoding.set(id,{resolve,reject,progress:({loaded,total})=>{
      progress('download',downloadMessage(name),{resource:name,loaded,total});
      if(scene&&loaded===total)progress('decode','Preparando o modelo');
    }});
    decoder.postMessage({id,url:url.href,name,bytes:record.bytes,sha256:record.sha256,decodedSHA256,scene});
  });
}

function decodeAttribute(spec,instanced=false) {
  const Type=typedArrays[spec.type];
  if(!Type) throw Error(`Tipo de buffer não suportado: ${spec.type}.`);
  const values=new Type(spec.buffer);
  if(values.length!==spec.length) throw Error('Buffer de geometria incompleto.');
  const Attribute=instanced?THREE.InstancedBufferAttribute:THREE.BufferAttribute;
  return new Attribute(values,spec.itemSize,spec.normalized);
}

async function start() {
  progress('backend','Preparando os gráficos');
  if(!['auto','webgpu','webgl'].includes(requested)) throw Error('Backend de diagnóstico inválido.');
  if(!['base','referencia'].includes(finishProfile))throw Error('Perfil de acabamento inválido.');
  if(!Object.hasOwn(EXTERIOR_EDITIONS,geometryProfile))throw Error('Perfil de geometria inválido.');
  if(!['procedural','precalculado'].includes(environmentProfile))throw Error('Perfil de ambiente inválido.');
  if(geometryProfile!=='base'&&finishProfile!=='base')throw Error('A variante já possui calibração própria de materiais.');
  let adapter=null;
  if(requested!=='webgl' && navigator.gpu) {
    try {adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});} catch(error) {state.adapterError=String(error);}
  }
  if(requested==='webgpu' && !adapter) throw Error('WebGPU não está disponível neste navegador/dispositivo.');
  state.adapterInfo=adapter?{vendor:adapter.info?.vendor,architecture:adapter.info?.architecture,device:adapter.info?.device,description:adapter.info?.description}:null;
  const options={canvas,alpha:true,antialias:true,powerPreference:'high-performance',forceWebGL:requested==='webgl'||!adapter};
  let renderer=new THREE.WebGPURenderer(options);
  try {await renderer.init();}
  catch(error) {
    if(requested!=='auto' || options.forceWebGL) throw error;
    state.webgpuInitError=String(error);
    renderer.dispose();
    renderer=new THREE.WebGPURenderer({...options,forceWebGL:true});
    await renderer.init();
  }
  mark('backendReady');
  state.backend=renderer.backend.isWebGPUBackend?'webgpu':'webgl';
  if(requested==='webgpu' && state.backend!=='webgpu') throw Error('O renderer não ativou o backend WebGPU exigido.');
  const onDeviceLost=renderer.onDeviceLost.bind(renderer);
  renderer.onDeviceLost=info=>{
    if(state.disposed)return;
    onDeviceLost(info);state.deviceLoss={api:info.api,reason:info.reason,message:info.message};
    fail(Error('O contexto gráfico foi interrompido. Tente novamente ou abra a planta 2D.'));
  };
  renderer.onError=info=>{
    if(state.disposed)return;
    state.backendError={api:info.api,type:info.type,message:info.message};
    fail(Error('O renderizador encontrou uma falha gráfica. Tente novamente ou abra a planta 2D.'));
  };
  state.renderer=renderer;
  state.dispose=()=>{
    if(state.disposed)return;
    state.ready=false;state.disposed=true;requests.abort();return renderer.dispose();
  };
  progress('manifest','Conferindo a versão da maquete');
  const response=await fetch(new URL('manifest.json',base),{cache:'no-cache',signal:requests.signal});
  if(!response.ok) throw Error('Manifesto da prova indisponível.');
  const manifest=await response.json();
  if(manifest.schema!=='liv-proof-manifest-v1') throw Error('Manifesto desconhecido.');
  const data=await decode('scene.json.gz',manifest.files['scene.json.gz'],manifest.sceneJSONSHA256,true);
  mark('sceneDecoded');mark('sceneParsed');
  if(data.schema!=='liv-exterior-proof-v1' || data.sourceModelSHA256!==manifest.sourceModelSHA256 || data.rgbm.sourceSHA256!==manifest.sourceModelSHA256) throw Error('A geometria e o atlas não pertencem à mesma edição.');
  data.views.varandas=balconyDetailView();
  data.views.acesso=entryDetailView();
  // The full atlas is 13 MB. A 1/4-per-side preview lights the first image and
  // is replaced after it (upgradeAtlas); without a preview, wait for the full one.
  const previewName='irradiance-previa.rgbm.gz',preview=manifest.files[previewName];
  const atlasBytes=await decode(preview?previewName:data.rgbm.textureURL,preview||manifest.files[data.rgbm.textureURL],
    preview?preview.decodedSHA256:data.rgbm.textureSHA256);
  mark('atlasReady');
  progress('build','Montando a maquete');
  if(state.disposed)return;
  let atlas=createRGBMTexture(atlasBytes,preview?{...data.rgbm,width:preview.width,height:preview.height}:data.rgbm);
  async function upgradeAtlas(){
    const bytes=await decode(data.rgbm.textureURL,manifest.files[data.rgbm.textureURL],data.rgbm.textureSHA256);
    if(state.disposed)return;
    const full=createRGBMTexture(bytes,data.rgbm);
    replaceRGBMAtlas(atlas,full);atlas.dispose();atlas=state.atlas=full;mark('atlasFull');
  }
  renderer.setClearAlpha(0);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=data.renderer.exposure;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  const scene=new THREE.Scene();
  let environment,controls,resizeObserver,unitPicking,ambience,parking,pendingSpaces=[];
  const textures=[],materials=[],geometries=[];
  state.scene=scene;state.atlas=atlas;
  // Own resources before the first asynchronous environment/texture request.
  // A mode change during loading must release even a partially built scene.
  state.dispose=()=>{
    if(state.disposed)return;
    state.ready=false;state.disposed=true;requests.abort();renderer.setAnimationLoop(null);
    resizeObserver?.disconnect();controls?.dispose();unitPicking?.dispose();parking?.dispose();ambience?.dispose();
    for(const geometry of geometries)geometry.dispose();
    for(const material of materials)material.dispose();
    for(const texture of textures){texture?.dispose();texture?.image?.close?.();}
    atlas.dispose();environment?.dispose();scene.traverse(o=>o.shadow?.dispose());scene.clear();
    return renderer.dispose();
  };
  state.environmentProfile=environmentProfile;
  if(environmentProfile==='precalculado'){
    progress('environment','Preparando os reflexos');
    try{environment=await precomputedEnvironment(requests.signal);}
    catch(error){
      if(state.disposed)return;
      state.environmentFallbackError=String(error);state.environmentProfile='procedural';
      environment=environmentTexture();
    }
  }else environment=environmentTexture();
  if(state.disposed){environment.dispose();return;}
  mark('environmentReady');
  scene.environment=environment;
  await Promise.all(data.textures.map(async (spec,index)=>{
    const bytes=await loadBytes(spec.url,manifest.files[spec.url]);
    const image=await createImageBitmap(new Blob([bytes],{type:'image/png'}),{imageOrientation:spec.flipY?'flipY':'none',premultiplyAlpha:'none',colorSpaceConversion:'none'});
    if(state.disposed){image.close();return;}
    const texture=new THREE.Texture(image);
    for(const key of ['colorSpace','premultiplyAlpha','channel','wrapS','wrapT','minFilter','magFilter','generateMipmaps','rotation','anisotropy']) texture[key]=spec[key];
    // ImageBitmap upload ignores flipY; orientation was applied at bitmap creation.
    texture.flipY=false;
    texture.repeat.fromArray(spec.repeat);texture.offset.fromArray(spec.offset);texture.center.fromArray(spec.center);
    texture.needsUpdate=true;textures[index]=texture;
  }));
  if(state.disposed)return;
  data.materials.forEach(spec=>{
    const props={};
    for(const [key,value] of Object.entries(spec)) {
      if(['type','baked','color','emissive','normalScale','name'].includes(key)) continue;
      props[key]=/Map$/.test(key)||key==='map'?textures[value]:value;
    }
    if(spec.color) props.color=new THREE.Color().fromArray(spec.color);
    if(spec.emissive) props.emissive=new THREE.Color().fromArray(spec.emissive);
    if(spec.normalScale) props.normalScale=new THREE.Vector2().fromArray(spec.normalScale);
    // Stock materials are converted by the renderer itself. Keep the custom
    // NodeMaterial only for our source-locked RGBM transport.
    const StockMaterial={MeshBasicMaterial:THREE.MeshBasicMaterial,
      MeshStandardMaterial:THREE.MeshStandardMaterial,MeshPhysicalMaterial:THREE.MeshPhysicalMaterial}[spec.type];
    if(!spec.baked&&!StockMaterial)throw Error(`Material não suportado: ${spec.type}.`);
    const material=spec.baked?new LivRGBMNodeMaterial(props,atlas,data.rgbm.range,data.rgbm.lightMapIntensity):new StockMaterial(props);
    material.name=spec.name;
    material.userData.livBakedTransport=spec.baked;
    materials.push(material);
  });
  mark('geometryStart');
  data.geometries.forEach(spec=>{
    const geometry=new THREE.BufferGeometry();
    for(const [name,attribute] of Object.entries(spec.attributes)) geometry.setAttribute(name,decodeAttribute(attribute));
    if(spec.index) geometry.setIndex(decodeAttribute(spec.index));
    for(const group of spec.groups) geometry.addGroup(group.start,group.count,group.materialIndex);
    if(spec.drawRange.count!==null) geometry.setDrawRange(spec.drawRange.start,spec.drawRange.count);
    // Bounds were computed by the decoder worker with Three's own formula.
    const {min,max,center,radius}=spec.bounds;
    geometry.boundingBox=new THREE.Box3(new THREE.Vector3().fromArray(min),new THREE.Vector3().fromArray(max));
    geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3().fromArray(center),radius);geometries.push(geometry);
  });
  const building=new THREE.Group();building.name=geometryProfile==='entrada'?'LIV — entrada em estudo':geometryProfile==='contorno'?'LIV — contorno em estudo':'LIV — exterior da base preservada';
  const meshes=data.meshes.map(spec=>{
    const material=Array.isArray(spec.material)?spec.material.map(index=>materials[index]):materials[spec.material];
    const mesh=spec.instances?new THREE.InstancedMesh(geometries[spec.geometry],material,spec.instances.count):new THREE.Mesh(geometries[spec.geometry],material);
    if(spec.instances) {
      mesh.instanceMatrix=decodeAttribute(spec.instances.matrix,true);
      if(spec.instances.color) mesh.instanceColor=decodeAttribute(spec.instances.color,true);
    }
    mesh.name=spec.name;mesh.matrix.fromArray(spec.matrix);mesh.matrixAutoUpdate=false;
    mesh.castShadow=spec.castShadow;mesh.receiveShadow=spec.receiveShadow;mesh.renderOrder=spec.renderOrder;mesh.userData=spec.userData;
    building.add(mesh);return mesh;
  });
  mark('geometryReady');
  // r186 gives uniform instance buffers object-specific shader names. Its
  // existing interleaved attribute path shares those vertex programs instead.
  // Scope this policy to our source meshes; keep the actual device limits,
  // materials, matrices and instance counts intact. Requalify on Three upgrades.
  if(THREE.REVISION==='186'){
    const instances=new WeakSet(meshes.filter(mesh=>mesh.isInstancedMesh));
    const previous=renderer.debug.onNodeBuilderCreated;
    renderer.debug.onNodeBuilderCreated=(builder,object)=>{
      previous?.(builder,object);
      if(instances.has(builder.object))builder.getUniformBufferLimit=()=>0;
    };
  }
  scene.add(building);
  state.finish=finishProfile==='referencia'?applyReferenceFinishes(meshes,materials,data.sourceModelSHA256):{profile:'base',changes:[]};
  const groundHeight=data.visibleBounds.min[1]-.03;
  const shadowLights=[];
  for(const spec of data.lights) {
    let light;
    const color=new THREE.Color().fromArray(spec.color);
    if(spec.type==='DirectionalLight') light=new THREE.DirectionalLight(color,spec.intensity);
    else if(spec.type==='HemisphereLight') light=new THREE.HemisphereLight(color,new THREE.Color().fromArray(spec.groundColor),spec.intensity);
    else if(spec.type==='AmbientLight') light=new THREE.AmbientLight(color,spec.intensity);
    else throw Error(`Luz não suportada na prova: ${spec.type}.`);
    light.position.fromArray(spec.position);light.castShadow=!!spec.castShadow;
    if(spec.target) {light.target.position.fromArray(spec.target);scene.add(light.target);}
    if(spec.shadow) {
      light.shadow.bias=spec.shadow.bias;light.shadow.normalBias=spec.shadow.normalBias;
      light.shadow.mapSize.fromArray(spec.shadow.mapSize);
      Object.assign(light.shadow.camera,spec.shadow.camera);light.shadow.camera.updateProjectionMatrix();
    }
    if(light.castShadow) {
      // Camera, floor tint and selection do not change the static shadow casters.
      light.shadow.autoUpdate=false;light.shadow.needsUpdate=true;shadowLights.push(light);
    }
    scene.add(light);
  }
  function makeCamera(spec,viewName=null) {
    const camera=spec.type==='OrthographicCamera'?new THREE.OrthographicCamera(spec.left,spec.right,spec.top,spec.bottom,spec.near,spec.far):
      new THREE.PerspectiveCamera(spec.fov,spec.aspect,spec.near,spec.far);
    camera.zoom=spec.zoom||1;camera.position.fromArray(spec.position);
    camera.userData.projectionSource=spec;
    camera.userData.viewName=viewName;
    return camera;
  }
  let camera=makeCamera(data.views.perspectiva,'perspectiva');
  controls=new OrbitControls(camera,canvas);
  controls.target.fromArray(data.views.perspectiva.target);controls.enableDamping=false;controls.minDistance=9;controls.maxDistance=900;
  controls.maxPolarAngle=Math.PI;controls.update();
  // O pan do OrbitControls tirava o centro do giro da maquete. O botão direito agora desloca a
  // imagem (lente da câmera, setViewOffset): a maquete anda na tela e continua girando em volta
  // do próprio centro. Cada câmera nova (vista pronta) nasce sem deslocamento.
  controls.enablePan=false;controls.mouseButtons.RIGHT=null;controls.touches.TWO=THREE.TOUCH.DOLLY_ROTATE;
  function applyPan(){
    const pan=camera.userData.pan,rect=stage.getBoundingClientRect();
    if(!pan||(!pan.x&&!pan.y)){if(camera.view?.enabled)camera.clearViewOffset();return;}
    camera.setViewOffset(rect.width,rect.height,-pan.x,-pan.y,rect.width,rect.height);
  }
  let panPointer=null;
  canvas.addEventListener('contextmenu',event=>event.preventDefault(),{signal:requests.signal});
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==2||event.pointerType!=='mouse')return;
    panPointer={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);
    camera.userData.viewName=null;state.activeView='livre';
  },{signal:requests.signal});
  canvas.addEventListener('pointermove',event=>{
    if(!panPointer||event.pointerId!==panPointer.id)return;
    const rect=stage.getBoundingClientRect(),pan=camera.userData.pan??={x:0,y:0};
    // Até 45% da tela para cada lado: a maquete nunca some.
    pan.x=Math.max(-rect.width*.45,Math.min(rect.width*.45,pan.x+event.clientX-panPointer.x));
    pan.y=Math.max(-rect.height*.45,Math.min(rect.height*.45,pan.y+event.clientY-panPointer.y));
    panPointer.x=event.clientX;panPointer.y=event.clientY;applyPan();
  },{signal:requests.signal});
  for(const type of ['pointerup','pointercancel'])canvas.addEventListener(type,event=>{if(panPointer?.id===event.pointerId)panPointer=null;},{signal:requests.signal});
  if(buyerExperience)controls.screenSpacePanning=false;
  const visibleBounds=new THREE.Box3(new THREE.Vector3().fromArray(data.visibleBounds.min),new THREE.Vector3().fromArray(data.visibleBounds.max));
  const towerBox=new THREE.Box3();
  for(const mesh of meshes)if(mesh.userData.tower===0)towerBox.union(new THREE.Box3().setFromObject(mesh));
  const facadeBounds={min:towerBox.min.toArray(),max:towerBox.max.toArray()};
  const corners=[];
  function updateVisibleCorners(){
    corners.length=0;
    for(const x of [visibleBounds.min.x,visibleBounds.max.x])for(const y of [visibleBounds.min.y,visibleBounds.max.y])
      for(const z of [visibleBounds.min.z,visibleBounds.max.z])corners.push(new THREE.Vector3(x,y,z));
  }
  updateVisibleCorners();
  let roofSign=null;
  addRoofLogo({scene,towerMeshes:meshes.filter(mesh=>mesh.userData.tower===0),url:new URL('./marca-telhado.webp',import.meta.url)})
    .then(sign=>{
      if(state.disposed)return;
      roofSign=sign;state.roofLogo=sign.name;sign.setNight(state.solar?.night??0);
      const roofBounds=new THREE.Box3().setFromObject(sign.group);
      towerBox.union(roofBounds);facadeBounds.min=towerBox.min.toArray();facadeBounds.max=towerBox.max.toArray();
      visibleBounds.union(roofBounds);updateVisibleCorners();
      if(camera.userData.viewName)resize();
      for(const light of shadowLights)light.shadow.needsUpdate=true;  // o letreiro faz sombra na laje
    }).catch(error=>{state.roofLogoError=String(error.message||error);});
  const detailCorners=[];
  for(const x of [BALCONY_DETAIL_BOUNDS.min[0],BALCONY_DETAIL_BOUNDS.max[0]])
    for(const y of [BALCONY_DETAIL_BOUNDS.min[1],BALCONY_DETAIL_BOUNDS.max[1]])
      for(const z of [BALCONY_DETAIL_BOUNDS.min[2],BALCONY_DETAIL_BOUNDS.max[2]])detailCorners.push(new THREE.Vector3(x,y,z));
  const entryCorners=[];
  let entryBounds=ENTRY_DETAIL_BOUNDS;
  if(geometryProfile==='entrada'){
    building.updateWorldMatrix(true,true);
    const box=new THREE.Box3();
    for(const mesh of meshes){
      const assigned=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      if(assigned.some(m=>m.name.startsWith('MAT-entrada-')))box.union(new THREE.Box3().setFromObject(mesh));
    }
    if(box.isEmpty())throw Error('A entrada revisada não possui volumes para enquadrar.');
    entryBounds={min:box.min.toArray(),max:box.max.toArray()};
    data.views.acesso.target=box.getCenter(new THREE.Vector3()).toArray();
  }
  for(const x of [entryBounds.min[0],entryBounds.max[0]])
    for(const y of [entryBounds.min[1],entryBounds.max[1]])
      for(const z of [entryBounds.min[2],entryBounds.max[2]])entryCorners.push(new THREE.Vector3(x,y,z));
  function fitPreset() {
    const name=camera.userData.viewName;
    if(name?.startsWith('unit:')&&units){
      const view=towerView(camera.aspect,name.slice(5));
      camera.position.fromArray(view.position);controls.target.fromArray(view.target);
      controls.update();orientCamera();return true;
    }
    if(!['perspectiva','aerea','implantacao','varandas','acesso'].includes(name)) return false;
    const fittedCorners=name==='varandas'?detailCorners:name==='acesso'?entryCorners:corners;
    const source=camera.userData.projectionSource,{th,ph}=source.orbit;
    const st=Math.sin(th),ct=Math.cos(th),sp=Math.sin(ph),cp=Math.cos(ph);
    const direction=new THREE.Vector3(st*sp,cp,ct*sp);
    const right=new THREE.Vector3(ct,0,-st),up=new THREE.Vector3(-st*cp,sp,-ct*cp);
    controls.target.fromArray(source.target);
    let radius=9;
    if(!roofSign&&!['varandas','acesso'].includes(name)&&Math.abs(camera.aspect-source.aspect)<1e-9) radius=source.orbit.r;
    else if(camera.isOrthographicCamera) {
      for(const point of fittedCorners) {
        const delta=point.clone().sub(controls.target);
        radius=Math.max(radius,Math.abs(delta.dot(up)),Math.abs(delta.dot(right))/camera.aspect);
      }
      radius*=1.08;
    } else {
      const vf=camera.fov*Math.PI/180,hf=2*Math.atan(Math.tan(vf/2)*camera.aspect);
      for(const point of fittedCorners) {
        const delta=point.clone().sub(controls.target);
        radius=Math.max(radius,delta.dot(direction)+Math.max(Math.abs(delta.dot(right))/Math.tan(hf/2),Math.abs(delta.dot(up))/Math.tan(vf/2)));
      }
      radius*=1.08;
    }
    camera.position.copy(controls.target).addScaledVector(direction,camera.isOrthographicCamera?400:radius);
    if(camera.isOrthographicCamera) {
      camera.left=-radius*camera.aspect;camera.right=radius*camera.aspect;camera.top=radius;camera.bottom=-radius;
      camera.position.x+=400*1e-6*Math.sin(th);camera.position.z+=400*1e-6*Math.cos(th);
    }
    controls.update();orientCamera();
    return true;
  }
  function orientCamera() {
    if(buyerExperience){camera.position.y=Math.max(camera.position.y,groundHeight+.8);controls.target.y=Math.max(controls.target.y,groundHeight+.8);}
    // Use the same spherical tangent as the base, including the north of the top view.
    const offset=camera.position.clone().sub(controls.target).normalize();
    const horizontal=Math.hypot(offset.x,offset.z);
    const theta=Math.atan2(offset.x,offset.z);
    camera.up.set(-offset.y*Math.sin(theta),horizontal,-offset.y*Math.cos(theta));
    camera.lookAt(controls.target);camera.updateMatrixWorld();
  }
  function resize() {
    const rect=stage.getBoundingClientRect();
    renderer.setSize(rect.width,rect.height,false);
    camera.aspect=rect.width/rect.height;
    const fitted=fitPreset();
    if(camera.isOrthographicCamera && !fitted) {
      const source=camera.userData.projectionSource;
      const halfHeight=(source.top-source.bottom)/2,centerY=(source.top+source.bottom)/2;
      camera.left=-halfHeight*camera.aspect;camera.right=halfHeight*camera.aspect;
      camera.top=centerY+halfHeight;camera.bottom=centerY-halfHeight;
    }
    camera.updateProjectionMatrix();applyPan();
  }
  resizeObserver=new ResizeObserver(resize);
  resizeObserver.observe(stage);resize();
  controls.addEventListener('start',()=>{camera.userData.viewName=null;state.activeView='livre';});
  function setView(name) {
    const view=data.views[name];if(!view) throw Error(`Vista desconhecida: ${name}.`);
    camera=makeCamera(view,name);controls.object=camera;state.camera=camera;
    controls.target.fromArray(view.target);
    if(view.orbit.ph===0) {
      const distance=camera.position.distanceTo(controls.target);
      camera.position.x+=distance*1e-6*Math.sin(view.orbit.th);
      camera.position.z+=distance*1e-6*Math.cos(view.orbit.th);
    }
    controls.update();orientCamera();resize();
    state.activeView=name;
    for(const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed',String(button.dataset.view===name));
    renderer.render(scene,camera);
  }
  async function capture(download=true) {
    // Render and serialize in the same task; WebGPU has no preserveDrawingBuffer contract.
    renderer.render(scene,camera);
    const png=canvas.toDataURL('image/png');
    if(download) {
      const link=document.createElement('a');link.href=png;link.download=`liv-ipanema-${state.activeView||'livre'}-${state.backend}.png`;link.click();
    }
    return png;
  }
  let selectedFloor=-1;
  function setFloor(floor=-1) {
    const value=Number(floor);
    if(!Number.isInteger(value)||value < -1||value >=(units?.floors??13)) throw Error('Pavimento inválido.');
    selectedFloor=value;
    // Floor is selection context; only the apartment receives a visual outline.
    const selectedId=unitPicking?.getState().selectedId;
    if(selectedId&&floorOf(units,unitById(units,selectedId))!==value)unitPicking.select(null);
    unitPicking?.refresh();renderer.render(scene,camera);
  }
  const selection=parameters.get('selecao');
  // Edição sem cadastro de finais abre a maquete sem seleção de apartamento.
  const units=EXTERIOR_EDITIONS[geometryProfile].units&&(geometryProfile==='base'||['piloto','edificio'].includes(selection))?
    await loadUnitCatalog(requests.signal,geometryProfile,selection==='edificio'?'edificio':'piloto'):null;
  if(state.disposed)return;
  if(units&&units.sourceModelSHA256!==data.sourceModelSHA256)throw Error('As posições dos finais pertencem a outra edição da maquete.');
  if(units)unitPicking=createUnitPicking({scene,canvas,catalog:units,getCamera:()=>camera,getFloor:()=>selectedFloor,
    onSelect:(id,{activate})=>{
      if(id!==null)setFloor(floorOf(units,unitById(units,id)));
      unitPicking.select(id);window.dispatchEvent(new CustomEvent('liv-unit-selected',{detail:{id,activate}}));
    }});
  // Só a edição entrada tem as vagas da implantação oficial; a primeira imagem não espera por elas.
  if(geometryProfile==='entrada')fetch(new URL('../vagas.json',base),{signal:requests.signal}).then(r=>{if(!r.ok)throw Error('vagas.json '+r.status);return r.json();})
    .then(json=>{if(state.disposed)return;parking=state.parking=createParkingHighlight(scene,json);parking.setSpaces(pendingSpaces);})
    .catch(error=>{if(!state.disposed)state.parkingError=String(error);});
  function setParkingSpaces(numbers){
    if(state.disposed)return false;
    pendingSpaces=Array.isArray(numbers)?numbers.filter(Number.isInteger):[];
    return parking?parking.setSpaces(pendingSpaces):null;
  }
  // side = 'torre-02:+x': torre e lado da fachada (cadastro do Laranjeiras).
  function towerView(aspect,side){
    const [id,dir]=side.split(':'),tower=units?.towers.find(t=>t.id===id);
    if(!tower)throw Error('Lado do pavimento inválido.');
    const others=units.towers.filter(t=>t!==tower).map(t=>t.bounds);
    const floorY=selectedFloor>=0?(selectedFloor+.5)*(tower.bounds.max[1]/units.floors):null;
    return towerFacadeView(aspect,dir,tower.bounds,others,floorY);
  }
  function setUnitView(side,floor=1){
    if(!units||!units.units.some(unit=>floorOf(units,unit)===floor))throw Error('Pavimento fora do cadastro.');
    setFloor(floor);
    const rect=stage.getBoundingClientRect(),aspect=rect.width/rect.height;
    const view=towerView(aspect,side);camera=makeCamera(view,'unit:'+side);
    controls.object=camera;state.camera=camera;controls.target.fromArray(view.target);
    controls.update();orientCamera();resize();state.activeView='livre';
  }
  function setSelectedUnit(id){
    if(state.disposed)return false;
    if(id!==null&&!unitPicking)throw Error('Esta edição não carregou as posições verificadas dos finais.');
    if(id!==null&&floorOf(units,unitById(units,id))!==selectedFloor)throw Error('Selecione o pavimento correspondente antes do final.');
    return unitPicking?.select(id)??false;
  }
  ambience=exteriorAmbience({renderer,scene,materials,stage,preserveBackdrop:darkBackdrop});ambience.setProfile(initialAmbience);
  function setAmbience(profile){
    if(state.disposed)return false;
    ambience.setProfile(profile);state.ambience=profile;renderer.render(scene,camera);return true;
  }
  const clock=exteriorTimeLighting({scene,renderer,materials,data,shadowLights,invalidateShadows:()=>{for(const light of shadowLights)light.shadow.needsUpdate=true;}});
  function setTimeOfDay(hour,context=null,options={}) {
    if(state.disposed)return false;
    if(!state.solar||state.ambience!=='dia'){ambience.setProfile('dia');state.ambience='dia';}
    state.solar=clock.setTime(hour,options);roofSign?.setNight(state.solar.night);return state.solar;
  }
  if(parameters.has('hora'))setTimeOfDay(parameters.get('hora'),null,parameters.has('data')?{date:parameters.get('data')}:{});
  Object.assign(state,{renderer,scene,camera,controls,setView,setFloor,capture,setUnitView,setSelectedUnit,setAmbience,setTimeOfDay,setParkingSpaces,
    setAvailableUnits:ids=>unitPicking?.availability.setUnits(ids)??false,
    ambience:state.solar?'dia':initialAmbience,ambienceController:ambience,unitPicking,units,building,meshes,materials,atlas,manifest,data,visibleBounds,facadeBounds,entryDetailBounds:entryBounds,
    invalidateShadows(){
      if(state.disposed)return false;
      for(const light of shadowLights)light.shadow.needsUpdate=true;
      return true;
    },
    getState(){return {view:state.activeView,floor:selectedFloor,selectedUnitId:unitPicking?.getState().selectedId??null,backend:state.backend,ambience:state.ambience,solar:state.solar,
      camera:{type:camera.type,fov:camera.fov,near:camera.near,far:camera.far,zoom:camera.zoom,
        left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom,aspect:camera.aspect,
        position:camera.position.toArray(),target:controls.target.toArray()}};},
    restoreState(snapshot){
      if(snapshot.view&&snapshot.view!=='livre')setView(snapshot.view);
      else if(snapshot.camera){
        camera=makeCamera(snapshot.camera);controls.object=camera;state.camera=camera;
        controls.target.fromArray(snapshot.camera.target);controls.update();orientCamera();resize();state.activeView='livre';
      }
      setFloor(snapshot.floor??-1);
      if(unitPicking)setSelectedUnit(snapshot.selectedUnitId??null);
      if(snapshot.ambience)setAmbience(snapshot.ambience);
      if(snapshot.solar)setTimeOfDay(snapshot.solar.hour,null,{date:snapshot.solar.date});
    }});
  const renderFrame=()=>{if(state.active&&!state.disposed){controls.update();orientCamera();renderer.render(scene,camera);}};
  state.setActive=function(active){
    if(typeof active!=='boolean'||state.disposed)return false;
    state.active=active;controls.enabled=active;
    renderer.setAnimationLoop(active?renderFrame:null);
    if(active){resizeObserver.observe(stage);resize();renderFrame();}else resizeObserver.disconnect();
    return true;
  };
  mark('sceneBuilt');
  progress('compile','Preparando a primeira imagem');
  // Compile one building mesh at a time: compiling the whole scene starts every
  // shader build in the same task (~90 ms on a phone before Three's first yield).
  // Nothing is presented yet, so the temporary visibility is never on screen.
  const shown=meshes.filter(mesh=>mesh.visible);
  for(const mesh of shown)mesh.visible=false;
  try{
    for(const mesh of shown){
      mesh.visible=true;await renderer.compileAsync(scene,camera);mesh.visible=false;
      if(state.disposed)return;
    }
  }finally{for(const mesh of shown)mesh.visible=true;}
  await renderer.compileAsync(scene,camera);mark('compiled');
  if(state.disposed)return;
  renderer.render(scene,camera);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  if(state.disposed)return;
  mark('ready');state.ready=true;state.activeView='perspectiva';
  state.setActive(state.active);
  progress('ready','Maquete carregada');
  // A failed upgrade keeps the preview on screen; it never fails the scene.
  // Com o relógio do sol o atlas fica com peso 0 (horario-exterior.js): o completo seriam 13 MB
  // baixados e 67 MB descomprimidos sem aparecer, pressão de memória que o iPhone não perdoa.
  state.fullAtlas=preview&&!state.solar?upgradeAtlas().catch(error=>{if(!state.disposed)state.atlasError=String(error);}):Promise.resolve();
  status.textContent=`Prova carregada — ${state.backend==='webgpu'?'WebGPU':'WebGL2'}, Three.js r${THREE.REVISION}, ${meshes.length} malhas. A paridade visual está em verificação.`;
  for(const button of document.querySelectorAll('button')) button.disabled=false;
  for(const button of document.querySelectorAll('[data-view]')) button.addEventListener('click',()=>setView(button.dataset.view));
  document.querySelector('#capture').addEventListener('click',()=>capture().catch(fail));
}

function fail(error) {
  if(state.disposed)return;
  state.ready=false;state.error=String(error);state.renderer?.setAnimationLoop(null);
  status.textContent='A prova 3D não pôde ser carregada.';
  document.querySelector('#error').textContent=String(error.message||error);
  document.querySelector('#failure').hidden=false;
  if(requested==='webgl') document.querySelector('#retry').textContent='Tentar novamente com WebGL2';
  window.dispatchEvent(new CustomEvent('liv-renderer-error',{detail:{error:state.error}}));
  Promise.resolve(state.dispose?.()).catch(error=>{state.cleanupError=String(error);});
}

start().catch(fail);
