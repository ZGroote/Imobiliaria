import * as THREE from 'three/webgpu';
import {matchesImprovementAsset,selectImprovementAssets,selectPreparedDelivery,createPackedImageLoader,imageURI} from './improvement-delivery.js';
import {decodePreparedHDR} from './prepared-hdr.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';

const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
const materialTextures=material=>Object.values(material).filter(value=>value?.isTexture);
const aborted=signal=>{if(signal?.aborted)throw new DOMException('Carregamento dos móveis cancelado.','AbortError');};
const sha256=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');

function repeatPair(value){
  if(!Array.isArray(value)||value.length!==2)throw Error('Repetição UV inválida.');
  const pair=value.map(v=>typeof v==='number'||typeof v==='string'&&v.trim()?Number(v):NaN);
  if(!pair.every(Number.isFinite))throw Error('Repetição UV inválida.');
  return pair;
}

function assetURL(path,catalogURL,extension='glb'){
  if(typeof path!=='string'||!(/^[a-zA-Z0-9._/-]+\.(?:glb|hdr|bin\.gz)$/i.test(path))||!path.toLowerCase().endsWith(`.${extension}`)||path.startsWith('/')||path.split('/').includes('..'))throw Error('Caminho de recurso detalhado inválido.');
  return new URL(path.startsWith('interiores/melhorias/')?path.slice('interiores/melhorias/'.length):path,catalogURL);
}

function validateGLB(bytes,approvedImages=[]){
  const view=new DataView(bytes);
  if(bytes.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.byteLength||view.getUint32(16,true)!==0x4e4f534a)throw Error('Modelo detalhado não é um GLB2 válido.');
  const length=view.getUint32(12,true);
  if(length>bytes.byteLength-20)throw Error('Cabeçalho do modelo detalhado incompleto.');
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,length)));
  for(const entry of json.buffers||[])if(entry.uri&&!entry.uri.startsWith('data:'))throw Error('Buffer externo não autorizado.');
  const allowed=new Set(approvedImages.map(image=>imageURI(image.sha256)));
  for(const entry of json.images||[])if(entry.uri&&!entry.uri.startsWith('data:')&&!allowed.has(entry.uri))throw Error('O modelo detalhado precisa conter suas próprias texturas.');
  return json;
}


// Mesmo conteúdo e mesmo sampler/UV podem usar uma textura, inclusive entre GLBs distintos.
async function shareEmbeddedTextures(gltf,bytes,metadata,shared){
  if(!gltf.parser?.associations)return;
  const base=28+new DataView(bytes).getUint32(12,true);
  const hashes=await Promise.all((metadata.images||[]).map(async image=>{
    const external=image.uri?.match(/^texturas\/([a-f0-9]{64})$/)?.[1];if(external)return external;
    const view=metadata.bufferViews?.[image.bufferView];
    if(!view||view.buffer!==0)return null;
    return sha256(bytes.slice(base+(view.byteOffset||0),base+(view.byteOffset||0)+view.byteLength));
  }));
  const materials=new Set();gltf.scene.traverse(mesh=>{if(mesh.isMesh)for(const material of [mesh.material].flat())materials.add(material);});
  for(const material of materials)for(const [field,texture]of Object.entries(material)){
    if(!texture?.isTexture)continue;
    const index=gltf.parser.associations.get(texture)?.textures,hash=hashes[metadata.textures?.[index]?.source];
    if(!hash)continue;
    const key=JSON.stringify([hash,...['mapping','channel','wrapS','wrapT','wrapR','magFilter','minFilter','anisotropy','format','type','internalFormat','generateMipmaps','flipY','premultiplyAlpha','unpackAlignment','colorSpace','compareFunction','matrixAutoUpdate'].map(k=>texture[k]),texture.offset.toArray(),texture.repeat.toArray(),texture.center.toArray(),texture.rotation,texture.matrix.toArray()]);
    if(shared.has(key))material[field]=shared.get(key);else shared.set(key,texture);
  }
}

function registerModel(root,own,onBitmap){
  const excluded=[];let meshes=0;
  root.traverse(object=>{
    if(object.isLight||object.isCamera){excluded.push(object);return;}
    if(!object.isMesh)return;
    if(object.isSkinnedMesh)throw Error('Móvel articulado não pertence à biblioteca estática.');
    meshes++;own(object.geometry);
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      own(material);material.lightMap=null;
      for(const texture of materialTextures(material)){own(texture);if(texture.image?.close)onBitmap(texture.image);}
    }
  });
  for(const object of excluded)object.removeFromParent();
  if(!meshes)throw Error('O modelo detalhado não contém malhas.');
  return meshes;
}

/** Ajusta o móvel aprovado ao footprint cadastral, sem substituir seus materiais. */
export function fitImprovedFurniture(template,item,dimensions,{own=value=>value,asset={}}={}){
  if(!['w','h','d'].every(key=>positive(dimensions[key])))throw Error('Medidas do móvel detalhado inválidas.');
  const model=template.clone(true),materials=new Map();
  model.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const copy=material=>{if(!materials.has(material))materials.set(material,own(material.clone()));return materials.get(material);};
    mesh.material=Array.isArray(mesh.material)?mesh.material.map(copy):copy(mesh.material);
    mesh.castShadow=mesh.receiveShadow=true;mesh.userData.furnitureId=item.id;
  });
  model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
  if(![size.x,size.y,size.z].every(positive))throw Error('Volume do móvel detalhado inválido.');
  const center=bounds.getCenter(new THREE.Vector3());model.position.sub(new THREE.Vector3(center.x,bounds.min.y,center.z));
  const fitted=new THREE.Group();fitted.add(model);
  fitted.scale.set(dimensions.w/size.x,dimensions.h/(asset.fitHeightReference||size.y),dimensions.d/size.z);
  const group=new THREE.Group();group.name=item.name||asset.id||'Móvel detalhado';group.add(fitted);
  group.position.set(item.position[0],item.baseY??.03,item.position[1]);group.rotation.y=(item.rotation||0)*Math.PI/2;
  group.userData.livImprovementAsset=asset.id;group.userData.furnitureId=item.id;group.userData.livSharedGeometry=true;
  return group;
}

export async function loadInteriorImprovements({base,signal,typology=null,items=null,own=value=>value,onBitmap=()=>{},onStatus=()=>{},
  fetchImpl=globalThis.fetch,parseGLB,includeDecorations=true}={}){
  const catalogURL=new URL('interiores/melhorias/catalogo.json',base),report={status:'loading',assets:0,loaded:0,assetIds:[],sourceBlendSHA256:null,revision:null,replaced:0,decorations:0,finishes:0,environment:null,environmentExposureEV:null,background:null,reflectionEnvironments:{},reflectionEnvironmentIntensity:1,errors:[],warnings:[]};
  const emit=()=>onStatus(structuredClone(report));emit();
  const sharedTextures=new Map(),templates=new Map(),decorations=[],instanceCounts=new Map(),hdrResources=new Map(),reflectionTextures=new Map(),reflectionMaterials=new Set(),loader=new GLTFLoader();let catalog,environment=null,backgroundEnvironment=null,activeTypology=typology||'canto',packedImages=null;
  const matches=(asset,item)=>matchesImprovementAsset(asset,item,activeTypology);
  const assetFor=item=>{
    const candidates=(catalog?.assets||[]).filter(asset=>matches(asset,item)&&templates.has(asset.id));
    return candidates.find(asset=>asset.replaces?.length===1&&asset.replaces[0]===item.id)||candidates[0];
  };
  function resourceURL(record,extension='glb'){
    const url=assetURL(record.path,catalogURL,extension);if(record.sha256)url.searchParams.set('v',record.sha256);
    return url;
  }
  async function resource(record,extension='glb'){
    const url=resourceURL(record,extension);
    const response=await fetchImpl(url,{signal});if(!response.ok)throw Error(`${record.id||record.path}: HTTP ${response.status}.`);
    const bytes=await response.arrayBuffer();
    if(record.bytes!==undefined&&bytes.byteLength!==record.bytes)throw Error(`${record.id||record.path}: arquivo incompleto.`);
    if(record.sha256){
      if(await sha256(bytes)!==record.sha256)throw Error(`${record.id||record.path}: arquivo de outra revisão.`);
    }
    return {bytes,url};
  }
  async function hdrResource(record){
    const key=resourceURL(record,'hdr').href;
    if(!hdrResources.has(key))hdrResources.set(key,(async()=>{
      if(record.prepared&&record.prepared.sourceSHA256!==record.sha256)throw Error('Ambiente preparado não corresponde ao HDR aprovado.');
      const source=record.prepared||record,{bytes}=await resource(source,record.prepared?'bin.gz':'hdr');
      let data;
      if(record.prepared){
        const decoded=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
        if(decoded.length!==source.decodedBytes||await sha256(decoded)!==source.decodedSHA256)throw Error('Ambiente preparado de outra revisão.');
        data={...decodePreparedHDR(decoded),type:THREE.HalfFloatType,colorSpace:THREE.LinearSRGBColorSpace,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:false,flipY:true};
      }else data=new HDRLoader().parse(bytes);
      const texture=own(new THREE.DataTexture(data.data,data.width,data.height,THREE.RGBAFormat,data.type));
      for(const field of ['colorSpace','minFilter','magFilter','generateMipmaps','flipY'])texture[field]=data[field];
      texture.name='Ambiente HDR aprovado do Blender LIV';texture.mapping=THREE.EquirectangularReflectionMapping;texture.needsUpdate=true;
      aborted(signal);return {texture,width:data.width,height:data.height,bytes:bytes.byteLength};
    })());
    const loaded=await hdrResources.get(key);
    if(!record.prepared&&record.bytes!==undefined&&loaded.bytes!==record.bytes)throw Error(`${record.path}: arquivo incompleto.`);
    return loaded;
  }
  function bindReflectionMaterial(material,asset){
    const texture=reflectionTextures.get(asset.environment);
    if(!texture||!material.isMeshStandardMaterial)return;
    material.envMap=texture;material.envMapIntensity=report.reflectionEnvironmentIntensity;material.needsUpdate=true;
    if(!reflectionMaterials.has(material)){
      reflectionMaterials.add(material);
      const disposed=()=>{reflectionMaterials.delete(material);material.removeEventListener('dispose',disposed);};
      material.addEventListener('dispose',disposed);
    }
  }
  function bindReflectionGroup(group,asset){
    if(!asset.environment)return;
    group.traverse(mesh=>{if(mesh.isMesh)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])bindReflectionMaterial(material,asset);});
  }
  try{
    const response=await fetchImpl(catalogURL,{signal,cache:'no-cache'});if(!response.ok)throw Error(`Catálogo dos móveis: HTTP ${response.status}.`);
    catalog=await response.json();aborted(signal);
    if(catalog.schema!=='liv-interior-improvements-v1'||!Array.isArray(catalog.assets)||!catalog.assets.length)throw Error('Catálogo de móveis detalhados inválido.');
    report.sourceBlendSHA256=catalog.sourceBlendSha256||catalog.sourceBlend?.sha256||null;
    if(catalog.environment?.kind==='local-interior-radiance-probe'){
      const sourceEV=catalog.environment.sourceExposureEV,outputEV=catalog.environment.outputExposureEV||0;
      if(Number.isFinite(sourceEV)&&Number.isFinite(outputEV))report.environmentExposureEV=sourceEV-outputEV;
    }
    const {delivery:_transport,...authorialCatalog}=catalog;
    report.revision='authorial-v1:'+await sha256(new TextEncoder().encode(JSON.stringify(authorialCatalog)));
    if(catalog.complete===false)report.errors.push({assetId:'catalogo',message:'A exportação dos móveis aprovados ainda está incompleta.'});
    report.assets=catalog.assets.length;
    const reflectionDefinitions=catalog.reflectionEnvironments||{};
    if(typeof reflectionDefinitions!=='object'||Array.isArray(reflectionDefinitions))throw Error('Mapa de ambientes locais inválido.');
    const identities=new Set();
    for(const asset of catalog.assets){
      if(typeof asset.id!=='string'||identities.has(asset.id)||!Array.isArray(asset.types)||!asset.types.every(type=>typeof type==='string')||!['w','h','d'].every(key=>positive(asset.dimensions?.[key]))||
        (asset.fitHeightReference!==undefined&&!positive(asset.fitHeightReference)))throw Error('Identidade ou medidas da biblioteca de móveis inválidas.');
      assetURL(asset.path,catalogURL);identities.add(asset.id);
      if(asset.namePattern)new RegExp(asset.namePattern,'i');
      if(asset.environment!==undefined&&(typeof asset.environment!=='string'||!Object.hasOwn(reflectionDefinitions,asset.environment)))report.errors.push({assetId:asset.id,message:'Ambiente local do móvel ausente do catálogo.'});
    }
    const assets=selectImprovementAssets(catalog,{items,typology:activeTypology,includeDecorations});
    const delivery=selectPreparedDelivery(catalog,assets,activeTypology);
    if(delivery){
      packedImages=createPackedImageLoader({delivery,resource,signal,onBitmap});
      loader.manager.addHandler(/^texturas\/[a-f0-9]{64}$/,packedImages.handler);
    }
    report.assets=assets.length;
    const environments=new Set(assets.map(asset=>asset.environment));
    const jobs=assets.map(async asset=>{
      const prepared=delivery?.models[asset.id],record=prepared?.model||asset;
      const {bytes,url}=await resource(record),metadata=validateGLB(bytes,prepared?.images);
      if(prepared)await packedImages.prepare(prepared.images);
      const gltf=await (parseGLB?parseGLB(bytes,url):loader.parseAsync(bytes,new URL('.',url).href));
      await shareEmbeddedTextures(gltf,bytes,metadata,sharedTextures);aborted(signal);
      registerModel(gltf.scene,own,onBitmap);aborted(signal);
      const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3());
      if(asset.types.length&&![size.x,size.y,size.z].every(positive))throw Error(`${asset.id}: volume vazio.`);
      templates.set(asset.id,{asset,root:gltf.scene,size});report.loaded++;report.assetIds.push(asset.id);emit();
    });
    const jobIds=assets.map(asset=>asset.id);
    if(catalog.environment){jobIds.push('environment');jobs.push((async()=>{
      const loaded=await hdrResource(catalog.environment);environment=loaded.texture;
      report.environment={loaded:true,path:catalog.environment.path,width:loaded.width,height:loaded.height};emit();
    })());}
    if(catalog.background){jobIds.push('background');jobs.push((async()=>{
      const loaded=await hdrResource(catalog.background);backgroundEnvironment=loaded.texture;
      report.background={loaded:true,path:catalog.background.path,width:loaded.width,height:loaded.height};emit();
    })());}
    for(const [name,record]of Object.entries(reflectionDefinitions)){
      if(items&&!environments.has(name))continue;
      jobIds.push(`reflectionEnvironments.${name}`);jobs.push((async()=>{
        try{
          const loaded=await hdrResource(record);reflectionTextures.set(name,loaded.texture);
          report.reflectionEnvironments[name]={loaded:true,path:record.path,width:loaded.width,height:loaded.height};emit();
        }catch(error){
          report.reflectionEnvironments[name]={loaded:false,path:record?.path||null,error:String(error.message||error)};emit();throw error;
        }
      })());
    }
    const outcomes=await Promise.allSettled(jobs);
    aborted(signal);
    outcomes.forEach((outcome,index)=>{if(outcome.status==='rejected')report.errors.push({assetId:jobIds[index],message:String(outcome.reason?.message||outcome.reason)});});
    if(!backgroundEnvironment&&environment){backgroundEnvironment=environment;report.background={...report.environment,fallback:true};}
  }catch(error){
    if(signal?.aborted||error.name==='AbortError')throw error;
    catalog=null;
    report.errors.push({assetId:'catalogo',message:String(error.message||error)});
  }finally{packedImages?.release();}
  function updateStatus(){report.status=report.errors.length?(report.loaded?'partial':'error'):'ready';emit();}
  updateStatus();
  return {
    get environment(){return environment;},
    get backgroundEnvironment(){return backgroundEnvironment;},
    get environmentExposureEV(){return report.environmentExposureEV;},
    get lookRecord(){return catalog?.look?structuredClone(catalog.look):null;},
    setEnvironmentIntensity(gain){
      if(!Number.isFinite(gain)||gain<0)throw new RangeError('Intensidade do ambiente local inválida.');
      report.reflectionEnvironmentIntensity=gain;
      for(const material of reflectionMaterials)material.envMapIntensity=gain;
      return true;
    },
    createFurniture(item,dimensions=item){
      const asset=assetFor(item);
      if(!asset)return null;
      const entry=templates.get(asset.id),authorial=!!(asset.referenceFootprintCanto||asset.source?.positionThree);
      let pose=item,target=dimensions;
      if(authorial&&!item.improvementAsset){
        const reference=asset.referenceFootprintCanto||asset.dimensions;
        const ratio=key=>activeTypology==='canto'?1:dimensions[key]/reference[key];
        target={w:entry.size.x*ratio('w'),h:entry.size.y*ratio('h'),d:entry.size.z*ratio('d')};
        const instance=asset.instances?.find(instance=>instance.furnitureId===item.id);
        const sourcePose=instance||((instanceCounts.get(asset.id)||1)===1?asset.source:null);
        const sourcePosition=sourcePose?.positionThree,sourceRotation=sourcePose?.rotationQuarterTurns;
        pose={...item};
        if(activeTypology==='canto'&&Array.isArray(sourcePosition)&&sourcePosition.length===3&&sourcePosition.every(Number.isFinite)){
          pose.position=[sourcePosition[0],sourcePosition[2]];pose.baseY=sourcePosition[1];
        }
        if(activeTypology==='canto'&&Number.isInteger(sourceRotation)&&sourceRotation>=0&&sourceRotation<=3)pose.rotation=sourceRotation;
      }
      // Depois do rebase, altura significa a altura real completa, inclusive a torneira/prateleira.
      const group=fitImprovedFurniture(entry.root,pose,target,{own,asset:authorial?{...asset,fitHeightReference:undefined}:asset});
      bindReflectionGroup(group,asset);
      if(authorial&&!item.improvementAsset)group.userData.livAuthorialPlacement={dimensions:target,position:[...pose.position],baseY:group.position.y,rotation:pose.rotation||0};
      return group;
    },
    replaceFurniture(furniture,scene,typology='canto',walls=[]){
      activeTypology=typology;
      // Fora do Canto o cadastro encosta o móvel 2-4 cm dentro da parede: o azulejo no fundo da pia sumia nela.
      const ray=new THREE.Raycaster();ray.far=.6;scene.updateMatrixWorld(true);
      const backToWall=(group,authorial)=>{
        const angle=authorial.rotation*Math.PI/2,back=new THREE.Vector3(-Math.sin(angle),0,-Math.cos(angle));
        ray.set(new THREE.Vector3(authorial.position[0],.5,authorial.position[1]),back);
        const hit=ray.intersectObjects(walls,false)[0],inside=hit?authorial.dimensions.d/2-hit.distance+.002:0;
        if(inside<=0||inside>.1)return;
        authorial.position=[authorial.position[0]-back.x*inside,authorial.position[1]-back.z*inside];
        group.position.x=authorial.position[0];group.position.z=authorial.position[1];
      };
      // O giro do guarda-roupa no cadastro diverge entre as plantas (no Meio ele abria para a parede): a frente
      // vai para o lado em que a parede está mais longe.
      const faceRoom=(item,group)=>{
        const angle=item.rotation*Math.PI/2,front=new THREE.Vector3(Math.sin(angle),0,Math.cos(angle)),origin=new THREE.Vector3(item.position[0],1,item.position[1]);
        const reach=direction=>{ray.set(origin,direction);ray.far=4;const hit=ray.intersectObjects(walls,false)[0];ray.far=.6;return hit?.distance??Infinity;};
        if(reach(front)<reach(front.clone().negate())){item.rotation=item.originalRotation=(item.rotation+2)%4;group.rotation.y=item.rotation*Math.PI/2;}
      };
      instanceCounts.clear();
      for(const item of furniture){const asset=assetFor(item);if(asset)instanceCounts.set(asset.id,(instanceCounts.get(asset.id)||0)+1);}
      // O cadastro grava o criado sempre com giro 0 (a caixa antiga não tinha frente): a gaveta olha para onde a cama olha.
      const beds=furniture.filter(item=>item.tipo==='cama');
      for(const item of furniture.filter(item=>item.tipo==='criado')){
        const bed=beds.reduce((best,bed)=>{const d=Math.hypot(bed.position[0]-item.position[0],bed.position[1]-item.position[1]);return d<(best?.d??1.6)?{bed,d}:best;},null)?.bed;
        if(bed)item.rotation=item.originalRotation=bed.originalRotation??bed.rotation;
      }
      for(const item of furniture){
        try{
          const group=this.createFurniture(item);if(!group)continue;
          const authorial=group.userData.livAuthorialPlacement;
          if(!authorial&&item.tipo==='guardaroupa'&&walls.length)faceRoom(item,group);
          if(authorial){
            if(typology!=='canto')backToWall(group,authorial);
            Object.assign(item,authorial.dimensions);item.originalDimensions={...authorial.dimensions};
            item.position=[...authorial.position];item.originalPosition=[...authorial.position];item.baseY=authorial.baseY;
            item.rotation=item.originalRotation=authorial.rotation;
          }
          scene.remove(item.group);scene.add(group);item.group=group;item.baseRotation=item.originalRotation;item.improvementAsset=group.userData.livImprovementAsset;report.replaced++;
        }catch(error){report.errors.push({assetId:item.id,message:String(error.message||error)});}
      }
      updateStatus();return report.replaced;
    },
    applyFinishes(native,scene){
      for(const override of catalog?.materialOverrides||[]){
        try{
          const id=({'wall':'m0','tile-floor':'m1','wood-floor':'m2'})[override.target],entry=templates.get(override.assetId);
          if(!id||!entry||!native[id])throw Error('Acabamento aprovado ausente da biblioteca.');
          let imported;
          entry.root.traverse(mesh=>{if(mesh.isMesh)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(material.name===override.materialName)imported=material;});
          if(!imported)throw Error(`Material ${override.materialName} ausente do modelo aprovado.`);
          const repeat=override.textureRepeat===undefined?null:repeatPair(override.textureRepeat);
          const previous=native[id],replacement=own(imported.clone());replacement.lightMap=null;
          if(repeat){
            const copies=new Map();
            for(const [field,texture]of Object.entries(replacement)){
              if(!texture?.isTexture||field==='envMap')continue;
              if(!copies.has(texture)){
                const copy=own(texture.clone());copy.repeat.multiply(new THREE.Vector2(...repeat));
                copy.wrapS=copy.wrapT=THREE.RepeatWrapping;copy.updateMatrix();copy.needsUpdate=true;copies.set(texture,copy);
              }
              replacement[field]=copies.get(texture);
            }
          }
          bindReflectionMaterial(replacement,entry.asset);
          scene.traverse(mesh=>{
            if(!mesh.isMesh)return;
            mesh.material=Array.isArray(mesh.material)?mesh.material.map(material=>material===previous?replacement:material):mesh.material===previous?replacement:mesh.material;
          });
          native[id]=replacement;report.finishes++;
        }catch(error){report.errors.push({assetId:override.assetId,message:String(error.message||error)});}
      }
      updateStatus();return report.finishes;
    },
    addDecorations(furniture,scene,typology){
      if(!includeDecorations)return report.decorations;
      if(decorations.length)return report.decorations;
      for(const [index,placement]of (catalog?.decorations||[]).entries()){
        if(placement.typology&&placement.typology!==typology)continue;
        try{
          const entry=templates.get(placement.assetId);if(!entry)throw Error('Decoração aprovada ausente da biblioteca.');
          const anchor=placement.anchorType?furniture.find(item=>item.tipo===placement.anchorType&&(!placement.anchorNamePattern||new RegExp(placement.anchorNamePattern,'i').test(item.name||''))):null;
          if(placement.anchorType&&!anchor)throw Error('Móvel de referência da decoração ausente.');
          const offset=placement.offset||[0,0,0],authoredPosition=entry.asset.source?.positionThree;
          const useAuthored=typology==='canto'&&Array.isArray(authoredPosition)&&authoredPosition.length===3&&authoredPosition.every(Number.isFinite);
          const absolute=useAuthored?authoredPosition:placement.position;
          if(!Array.isArray(offset)||offset.length!==3||!offset.every(Number.isFinite)||
            (absolute&&(!Array.isArray(absolute)||absolute.length!==3||!absolute.every(Number.isFinite))))throw Error('Posição da decoração aprovada inválida.');
          const yaw=(anchor?.rotation||0)*Math.PI/2,c=Math.cos(yaw),s=Math.sin(yaw);
          const point=absolute||[(anchor?.position[0]||0)+c*offset[0]+s*offset[2],offset[1],(anchor?.position[1]||0)-s*offset[0]+c*offset[2]];
          const item={id:`decoracao-${index}`,name:entry.asset.id,position:[point[0],point[2]],rotation:0};
          const group=fitImprovedFurniture(entry.root,item,placement.dimensions||entry.asset.dimensions,{own,asset:entry.asset});
          bindReflectionGroup(group,entry.asset);
          group.position.y=(absolute?0:anchor?.baseY??.03)+point[1];
          group.rotation.y=useAuthored&&Number.isInteger(entry.asset.source.rotationQuarterTurns)?entry.asset.source.rotationQuarterTurns*Math.PI/2:yaw+(placement.yaw||0);group.userData.livImprovementDecoration=true;
          scene.add(group);decorations.push(group);report.decorations++;
        }catch(error){report.errors.push({assetId:placement.assetId,message:String(error.message||error)});}
      }
      updateStatus();return report.decorations;
    },
    getState:()=>({...structuredClone(report),reflectionMaterialCount:reflectionMaterials.size}),
  };
}
