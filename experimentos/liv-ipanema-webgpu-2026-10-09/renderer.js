import * as THREE from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {LivRGBMNodeMaterial,createRGBMTexture} from './material-rgbm.js';
import {applyReferenceFinishes} from './exterior-finishes.js';
import {balconyDetailView,BALCONY_DETAIL_BOUNDS,entryDetailView,ENTRY_DETAIL_BOUNDS,pilotFloorView} from './cameras.js';
import {loadUnits} from './unidades.js';
import {createUnitPicking} from './picking.js';

const state=window.__livProva={ready:false,backend:null,error:null,runtime:THREE.REVISION};
function progress(phase,message,extra={}){
  if(state.disposed)return;
  state.progress={version:(state.progress?.version||0)+1,phase,message,...extra};
}
const mark=name=>{(state.timings??={})[name]=performance.now();};mark('module');
const parameters=new URLSearchParams(location.search);
const requested=parameters.get('backend')||'auto';
const finishProfile=parameters.get('acabamento')||'base';
const geometryProfile=parameters.get('geometria')||'base';
const recoveryURL=new URL(location.href);recoveryURL.searchParams.set('backend','webgl');
document.querySelector('#retry').href=recoveryURL.href;
document.body.classList.toggle('embedded',parameters.get('embed')==='1');
const stage=document.querySelector('#stage'),canvas=document.querySelector('#c'),status=document.querySelector('#status');
const base=new URL(geometryProfile==='contorno'?'./modelo/variante/assets/':'./assets-prova/',import.meta.url);
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
  const message=name==='scene.json.gz'?'Baixando o modelo':name==='irradiance.rgbm.gz'?'Baixando a iluminação':'Baixando os acabamentos';
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

async function unzip(bytes) {
  if(typeof DecompressionStream==='undefined') throw Error('Este navegador não possui o decodificador de recursos comprimidos.');
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}

function decodeAttribute(spec,instanced=false) {
  const Type=typedArrays[spec.type];
  if(!Type) throw Error(`Tipo de buffer não suportado: ${spec.type}.`);
  const binary=atob(spec.base64),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  const values=new Type(bytes.buffer);
  if(values.length!==spec.length) throw Error('Buffer de geometria incompleto.');
  const Attribute=instanced?THREE.InstancedBufferAttribute:THREE.BufferAttribute;
  return new Attribute(values,spec.itemSize,spec.normalized);
}

function environmentTexture() {
  const width=64,height=32,bytes=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++) {
    const t=y/(height-1),horizon=Math.exp(-Math.pow((t-.52)/.09,2));
    const rgb=[30+130*(1-t)+150*horizon,44+150*(1-t)+155*horizon,66+175*(1-t)+160*horizon];
    for(let x=0;x<width;x++) {
      const i=(y*width+x)*4;
      for(let channel=0;channel<3;channel++) bytes[i+channel]=Math.min(255,rgb[channel]|0);
      bytes[i+3]=255;
    }
  }
  const texture=new THREE.DataTexture(bytes,width,height,THREE.RGBAFormat);
  texture.mapping=THREE.EquirectangularReflectionMapping;
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.needsUpdate=true;
  return texture;
}

async function start() {
  progress('backend','Preparando os gráficos');
  if(!['auto','webgpu','webgl'].includes(requested)) throw Error('Backend de diagnóstico inválido.');
  if(!['base','referencia'].includes(finishProfile))throw Error('Perfil de acabamento inválido.');
  if(!['base','contorno'].includes(geometryProfile))throw Error('Perfil de geometria inválido.');
  if(geometryProfile==='contorno'&&finishProfile!=='base')throw Error('A variante já possui calibração própria de materiais.');
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
  const sceneBytes=await loadBytes('scene.json.gz',manifest.files['scene.json.gz']);
  progress('decode','Preparando o modelo');
  const encoded=await unzip(sceneBytes);
  if(await sha(encoded)!==manifest.sceneJSONSHA256) throw Error('Cena descomprimida não corresponde ao manifesto.');
  mark('sceneDecoded');
  const data=JSON.parse(new TextDecoder().decode(encoded));mark('sceneParsed');
  if(data.schema!=='liv-exterior-proof-v1' || data.sourceModelSHA256!==manifest.sourceModelSHA256 || data.rgbm.sourceSHA256!==manifest.sourceModelSHA256) throw Error('A geometria e o atlas não pertencem à mesma edição.');
  data.views.varandas=balconyDetailView();
  data.views.acesso=entryDetailView();
  const atlasBytes=await unzip(await loadBytes(data.rgbm.textureURL,manifest.files[data.rgbm.textureURL]));
  if(await sha(atlasBytes)!==data.rgbm.textureSHA256) throw Error('Atlas RGBM corrompido.');
  mark('atlasReady');
  progress('build','Montando a maquete');
  if(state.disposed)return;
  const atlas=createRGBMTexture(atlasBytes,data.rgbm);
  renderer.setClearAlpha(0);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=data.renderer.exposure;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  const scene=new THREE.Scene();
  const environment=environmentTexture();
  // The renderer generates its own PMREM from this source, preserving the gradient
  // while allowing the pinned WebGPU and WebGL2 implementations to use it.
  scene.environment=environment;
  const textures=await Promise.all(data.textures.map(async spec=>{
    const bytes=await loadBytes(spec.url,manifest.files[spec.url]);
    const image=await createImageBitmap(new Blob([bytes],{type:'image/png'}),{imageOrientation:spec.flipY?'flipY':'none',premultiplyAlpha:'none',colorSpaceConversion:'none'});
    const texture=new THREE.Texture(image);
    for(const key of ['colorSpace','premultiplyAlpha','channel','wrapS','wrapT','minFilter','magFilter','generateMipmaps','rotation','anisotropy']) texture[key]=spec[key];
    // ImageBitmap upload ignores flipY; orientation was applied at bitmap creation.
    texture.flipY=false;
    texture.repeat.fromArray(spec.repeat);texture.offset.fromArray(spec.offset);texture.center.fromArray(spec.center);
    texture.needsUpdate=true;return texture;
  }));
  if(state.disposed){for(const texture of textures){texture.dispose();texture.image?.close?.();}atlas.dispose();environment.dispose();return;}
  const materials=data.materials.map(spec=>{
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
    return material;
  });
  const geometries=data.geometries.map(spec=>{
    const geometry=new THREE.BufferGeometry();
    for(const [name,attribute] of Object.entries(spec.attributes)) geometry.setAttribute(name,decodeAttribute(attribute));
    if(spec.index) geometry.setIndex(decodeAttribute(spec.index));
    for(const group of spec.groups) geometry.addGroup(group.start,group.count,group.materialIndex);
    if(spec.drawRange.count!==null) geometry.setDrawRange(spec.drawRange.start,spec.drawRange.count);
    geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
  });
  const building=new THREE.Group();building.name=geometryProfile==='contorno'?'LIV — contorno em estudo':'LIV — exterior da base preservada';
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
  scene.add(building);
  let controls,resizeObserver,unitPicking;
  // Install the owner before the reference identity gate can reject a material.
  // Construction errors must release assets even before camera/controls exist.
  state.dispose=()=>{
    if(state.disposed)return;
    state.ready=false;state.disposed=true;requests.abort();renderer.setAnimationLoop(null);
    resizeObserver?.disconnect();controls?.dispose();unitPicking?.dispose();
    for(const geometry of geometries)geometry.dispose();
    for(const material of materials)material.dispose();
    for(const texture of textures){texture.dispose();texture.image?.close?.();}
    atlas.dispose();environment.dispose();scene.traverse(o=>o.shadow?.dispose());scene.clear();
    return renderer.dispose();
  };
  state.finish=finishProfile==='referencia'?applyReferenceFinishes(meshes,materials,data.sourceModelSHA256):{profile:'base',changes:[]};
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
  const visibleBounds=new THREE.Box3(new THREE.Vector3().fromArray(data.visibleBounds.min),new THREE.Vector3().fromArray(data.visibleBounds.max));
  const corners=[];
  for(const x of [visibleBounds.min.x,visibleBounds.max.x]) for(const y of [visibleBounds.min.y,visibleBounds.max.y])
    for(const z of [visibleBounds.min.z,visibleBounds.max.z]) corners.push(new THREE.Vector3(x,y,z));
  const detailCorners=[];
  for(const x of [BALCONY_DETAIL_BOUNDS.min[0],BALCONY_DETAIL_BOUNDS.max[0]])
    for(const y of [BALCONY_DETAIL_BOUNDS.min[1],BALCONY_DETAIL_BOUNDS.max[1]])
      for(const z of [BALCONY_DETAIL_BOUNDS.min[2],BALCONY_DETAIL_BOUNDS.max[2]])detailCorners.push(new THREE.Vector3(x,y,z));
  const entryCorners=[];
  for(const x of [ENTRY_DETAIL_BOUNDS.min[0],ENTRY_DETAIL_BOUNDS.max[0]])
    for(const y of [ENTRY_DETAIL_BOUNDS.min[1],ENTRY_DETAIL_BOUNDS.max[1]])
      for(const z of [ENTRY_DETAIL_BOUNDS.min[2],ENTRY_DETAIL_BOUNDS.max[2]])entryCorners.push(new THREE.Vector3(x,y,z));
  function fitPreset() {
    const name=camera.userData.viewName;
    if(!['perspectiva','aerea','implantacao','varandas','acesso'].includes(name)) return false;
    const fittedCorners=name==='varandas'?detailCorners:name==='acesso'?entryCorners:corners;
    const source=camera.userData.projectionSource,{th,ph}=source.orbit;
    const st=Math.sin(th),ct=Math.cos(th),sp=Math.sin(ph),cp=Math.cos(ph);
    const direction=new THREE.Vector3(st*sp,cp,ct*sp);
    const right=new THREE.Vector3(ct,0,-st),up=new THREE.Vector3(-st*cp,sp,-ct*cp);
    controls.target.fromArray(source.target);
    let radius=9;
    if(!['varandas','acesso'].includes(name)&&Math.abs(camera.aspect-source.aspect)<1e-9) radius=source.orbit.r;
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
    camera.updateProjectionMatrix();
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
    if(!Number.isInteger(value)||value < -1||value >16) throw Error('Pavimento inválido.');
    selectedFloor=value;
    const selected=new THREE.Color(.28,.95,.53),white=new THREE.Color(1,1,1);
    for(const mesh of meshes) {
      if(mesh.userData.tower!==0) continue;
      if(mesh.isInstancedMesh) {
        const floors=mesh.userData.livPavimentos;
        if(!floors) continue;
        for(let i=0;i<mesh.count;i++) mesh.setColorAt(i,value>=0&&floors[i]===value?selected:white);
        if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true;
      } else {
        const floors=mesh.geometry.getAttribute('livFloorIndex'),colors=mesh.geometry.getAttribute('color');
        if(!floors||!colors) continue;
        for(let i=0;i<floors.count;i++) {
          const color=value>=0&&floors.getX(i)===value?selected:white;
          colors.setXYZ(i,color.r,color.g,color.b);
        }
        colors.needsUpdate=true;
      }
    }
    if(value!==1)unitPicking?.select(null);
    unitPicking?.refresh();renderer.render(scene,camera);
  }
  const units=geometryProfile==='base'?await loadUnits(requests.signal):null;
  if(state.disposed)return;
  if(units&&units.sourceModelSHA256!==data.sourceModelSHA256)throw Error('As posições dos finais pertencem a outra edição da maquete.');
  if(units)unitPicking=createUnitPicking({scene,canvas,catalog:units,getCamera:()=>camera,getFloor:()=>selectedFloor,
    onSelect:id=>{unitPicking.select(id);window.dispatchEvent(new CustomEvent('liv-unit-selected',{detail:{id}}));}});
  function setUnitView(side){
    if(!['lazer','estacionamento'].includes(side))throw Error('Lado do pavimento inválido.');
    setFloor(1);
    const rect=stage.getBoundingClientRect(),aspect=rect.width/rect.height;
    const view=pilotFloorView(aspect,side);camera=makeCamera(view);
    controls.object=camera;state.camera=camera;controls.target.fromArray(view.target);
    controls.update();orientCamera();resize();state.activeView='livre';
  }
  function setSelectedUnit(id){
    if(state.disposed)return false;
    if(id!==null&&!unitPicking)throw Error('A variante de contorno não possui posições comerciais verificadas.');
    if(id!==null&&selectedFloor!==1)throw Error('Selecione o pavimento piloto antes do final.');
    return unitPicking?.select(id)??false;
  }
  Object.assign(state,{renderer,scene,camera,controls,setView,setFloor,capture,setUnitView,setSelectedUnit,unitPicking,units,building,meshes,materials,atlas,manifest,data,visibleBounds,
    getState(){return {view:state.activeView,floor:selectedFloor,selectedUnitId:unitPicking?.getState().selectedId??null,backend:state.backend,
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
      if(selectedFloor===1)setSelectedUnit(snapshot.selectedUnitId??null);
    }});
  renderer.setAnimationLoop(()=>{controls.update();orientCamera();renderer.render(scene,camera);});
  mark('sceneBuilt');
  progress('compile','Preparando a primeira imagem');
  await renderer.compileAsync(scene,camera);mark('compiled');
  if(state.disposed)return;
  renderer.render(scene,camera);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  if(state.disposed)return;
  mark('ready');state.ready=true;state.activeView='perspectiva';
  progress('ready','Maquete carregada');
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
