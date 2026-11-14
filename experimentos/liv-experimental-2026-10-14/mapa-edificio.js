import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {environmentPixels} from './ambiente.js';
import {applyMapCamera,withStandardDepthRange} from './mapa-camera.js';
import '../mapa-liv-ipanema-5km-2026-10-08/maquete-no-mapa.js';

export async function attachBuilding({map,center,properties,focusId,onSelect,onLabelPosition}){
  const loaded=await Promise.all(properties.map(async property=>{
    const asset=property.asset,url=new URL(asset.url,import.meta.url);url.searchParams.set('v',asset.sha256);
    const response=await fetch(url);if(!response.ok)throw Error('Não foi possível carregar '+property.name+' em 3D.');
    const bytes=await response.arrayBuffer();
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
    if(bytes.byteLength!==asset.bytes||hash!==asset.sha256)throw Error('O modelo de '+property.name+' pertence a outra revisão.');
    const gltf=await new GLTFLoader().parseAsync(bytes,new URL('.',url).href);
    return {property,gltf,hash};
  }));
  const scene=new THREE.Scene(),camera=new THREE.Camera();
  const ambient=new THREE.HemisphereLight(0xe5f2ff,0x776c56,2);scene.add(ambient);
  const sun=new THREE.DirectionalLight(0xfff0d3,3);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-300,right:300,top:300,bottom:-300,near:1,far:1500});
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias=-0.00008;sun.shadow.normalBias=.04;sun.shadow.radius=2.5;scene.add(sun,sun.target);
  const origin=maplibregl.MercatorCoordinate.fromLngLat([center[1],center[0]],0),unit=origin.meterInMercatorCoordinateUnits();
  const models=loaded.map(entry=>{
    const point=maplibregl.MercatorCoordinate.fromLngLat([entry.property.center[1],entry.property.center[0]],0);
    const offset=[(point.x-origin.x)/unit,(point.y-origin.y)/unit];
    const model=window.LivMapModel.create({THREE,loadedScene:entry.gltf.scene,scene,center:offset,rotation:entry.property.rotation,terrainY:0});
    model.object.name=entry.property.name;
    model.object.updateMatrixWorld(true);
    model.object.traverse(object=>{
      object.userData.propertyId=entry.property.id;
      object.matrixAutoUpdate=false;
      if(object.isMesh){
        // Current Three.js includes instance transforms in these bounds.
        object.computeBoundingSphere?.();
        object.frustumCulled=true;
      }
    });
    return {...entry,model,offset};
  });
  const focused=models.find(entry=>entry.property.id===focusId),model=focused.model;
  const nightMaterials=new Set();for(const {gltf} of models)gltf.scene.traverse(mesh=>{for(const material of [mesh.material].flat().filter(Boolean))if(material.emissive&&(/luz-varanda/i.test(material.name)||material.name==='MAT-vidro'))nightMaterials.add(material);});
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(1400,1400),new THREE.ShadowMaterial({opacity:.4,depthWrite:false}));
  ground.rotation.x=-Math.PI/2;ground.position.y=.02;ground.receiveShadow=true;ground.frustumCulled=false;scene.add(ground);
  const mercator=maplibregl.MercatorCoordinate.fromLngLat([center[1],center[0]],0),scale=mercator.meterInMercatorCoordinateUnits();
  const local=new THREE.Matrix4().makeTranslation(mercator.x,mercator.y,mercator.z)
    .scale(new THREE.Vector3(scale,-scale,scale)).multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));
  let renderer=null,environment=null,active=true,disposed=false;
  const mapProjection=new THREE.Matrix4();
  const roof=new THREE.Vector3(focused.offset[0],model.boundsLocal.max.y+4,focused.offset[1]),projectedRoof=new THREE.Vector3();
  const layer={id:'liv-building-3d',type:'custom',renderingMode:'3d',
    onAdd(map,gl){
      renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});renderer.autoClear=false;
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
      // Buildings and sun are stationary while the map camera moves.
      // Keep the shadow texture until setSolar changes the illumination.
      renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
      renderer.info.autoReset=false;
      renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
      // Reuse the exterior's sky gradient for PBR reflections and indirect light.
      const pixels=environmentPixels(),texture=new THREE.DataTexture(pixels.bytes,pixels.width,pixels.height,THREE.RGBAFormat);
      texture.colorSpace=THREE.SRGBColorSpace;texture.mapping=THREE.EquirectangularReflectionMapping;texture.needsUpdate=true;
      const generator=new THREE.PMREMGenerator(renderer);environment=generator.fromEquirectangular(texture);
      scene.environment=environment.texture;scene.environmentIntensity=.42;generator.dispose();texture.dispose();renderer.resetState();
    },
    render(gl,args){
      if(!active||disposed)return;
      mapProjection.fromArray(args.defaultProjectionData.mainMatrix).multiply(local);
      applyMapCamera(camera,mapProjection);
      renderer.info.reset();
      const shadowUpdated=renderer.shadowMap.needsUpdate;
      withStandardDepthRange(gl,()=>{renderer.resetState();renderer.render(scene,camera);});
      const canvas=map.getCanvas();
      canvas.dataset.renderCalls=String(renderer.info.render.calls);
      canvas.dataset.renderTriangles=String(renderer.info.render.triangles);
      canvas.dataset.shadowUpdated=String(shadowUpdated);
      if(shadowUpdated)canvas.dataset.renderCallsWithShadow=String(renderer.info.render.calls);
      projectedRoof.copy(roof).project(camera);
      onLabelPosition?.({x:(projectedRoof.x+1)*map.getCanvas().clientWidth/2,y:(1-projectedRoof.y)*map.getCanvas().clientHeight/2,visible:projectedRoof.z>-1&&projectedRoof.z<1&&Math.abs(projectedRoof.x)<1.2&&Math.abs(projectedRoof.y)<1.2});
    },
  };
  map.addLayer(layer);
  function select(event){
    if(!active||disposed)return;
    const size=map.getCanvas(),point=event.point,x=2*point.x/size.clientWidth-1,y=1-2*point.y/size.clientHeight;
    const near=new THREE.Vector3(x,y,-1).unproject(camera),far=new THREE.Vector3(x,y,1).unproject(camera);
    const raycaster=new THREE.Raycaster(near,far.sub(near).normalize());
    const hits=raycaster.intersectObjects(models.map(entry=>entry.model.object),true);
    if(hits.length)onSelect(hits[0].object.userData.propertyId);
  }
  map.on('click',select);
  return {ready:true,metadata:{...model.metadata,propertyId:focusId,geometryVerified:true,assetSHA256:focused.hash,edition:focused.property.asset.edition,properties:models.map(entry=>({id:entry.property.id,name:entry.property.name,assetSHA256:entry.hash,geometryVerified:true,center:entry.property.center}))},
    setSolar(solar){
      sun.position.fromArray(solar.directionGeo).multiplyScalar(600);sun.intensity=5*solar.sunStrength;
      sun.color.set('#ffb36c').lerp(new THREE.Color('#fff5e3'),solar.sunStrength);
      ambient.intensity=.35*solar.daylight+.12*solar.night;
      ambient.color.set('#e3eef8');ambient.groundColor.set('#7e7666');
      scene.environmentIntensity=.18*solar.daylight+.05*solar.night;
      ground.material.opacity=.32*solar.sunStrength;
      // Same fixture/window rules and intensities as horario-exterior.js.
      for(const material of nightMaterials){material.emissive.set('#ffd29a');material.emissiveIntensity=(/luz-varanda/i.test(material.name)?2.4:.32)*solar.night;}
      sun.shadow.needsUpdate=true;if(renderer)renderer.shadowMap.needsUpdate=true;map.triggerRepaint();
    },
    setActive(value){active=value;if(value)map.triggerRepaint();},
    dispose(){if(disposed)return;disposed=true;map.off('click',select);if(map.getLayer(layer.id))map.removeLayer(layer.id);for(const entry of models)entry.model.dispose();
      const geometries=new Set(),materials=new Set(),textures=new Set();for(const {gltf} of models)gltf.scene.traverse(mesh=>{if(mesh.geometry)geometries.add(mesh.geometry);for(const material of [mesh.material].flat().filter(Boolean)){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
      for(const item of [...geometries,...materials,...textures])item.dispose();ground.geometry.dispose();ground.material.dispose();sun.shadow.dispose();environment?.dispose();renderer?.dispose();
    },
  };
}
