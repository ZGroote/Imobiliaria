import * as THREE from 'three/webgpu';
import {probeShaderCode} from './probe-code.js';
const gain={bake:{value:1},direct:{value:0},ambient:{value:0},normalize:{value:0}};
const uvVertex=`
#ifndef USE_UV1
attribute vec2 uv1;
#endif
varying vec2 vLivUV;
`;
export function setClassicGains({bake=1,direct=0,ambient=direct}={}){gain.bake.value=Math.max(0,bake);gain.direct.value=Math.max(0,direct);gain.ambient.value=Math.max(0,ambient);}
export function setClassicNormalization(enabled){gain.normalize.value=enabled?1:0;}
// Mobile WebGL2 may expose only 16 samplers. Pack temporal channels into one
// texture binding; retain every source texel and the existing interpolation.
/** Peso da noite gravada por cômodo (interruptor): o cômodo vem do mapa das sondas, um pouco à frente da face
 * (p + n·12 cm), para a parede pegar o cômodo que ela ilumina e não o vizinho. */
export const NIGHT_ROOMS=16;
export function classicNightRooms(map){
 const bytes=Uint8Array.from(atob(map.data),c=>c.charCodeAt(0)),rooms=new THREE.DataTexture(bytes,map.width,map.height,THREE.RedFormat,THREE.UnsignedByteType);
 rooms.minFilter=rooms.magFilter=THREE.NearestFilter;rooms.generateMipmaps=false;rooms.flipY=false;rooms.needsUpdate=true;
 const uniforms={livNightRooms:{value:rooms},livNightBounds:{value:new THREE.Vector4(map.x0,map.z0,map.width*map.cell,map.height*map.cell)},livNightLevel:{value:new Array(NIGHT_ROOMS).fill(0)}};
 const shader=`uniform sampler2D livNightRooms;uniform vec4 livNightBounds;uniform float livNightLevel[${NIGHT_ROOMS}];
 float livNightWeight(vec3 p,vec3 n){vec2 q=(p.xz+n.xz*0.12-livNightBounds.xy)/livNightBounds.zw;return livNightLevel[min(int(texture(livNightRooms,q).r*255.0+0.5),${NIGHT_ROOMS-1})];}`;
 return {uniforms,shader,resources:[rooms],set(levels){levels.forEach((value,index)=>{uniforms.livNightLevel.value[index]=value;});}};
}
export function classicAtlas({range,intensity,width,height,manualBilinear=false,night=null}){
 let atlas=new THREE.DataArrayTexture(new Uint8Array(4),1,1,1),previous=[];
 const uniforms={livAtlas:{value:atlas},livWeights:{value:new THREE.Vector3()},livLayers:{value:new THREE.Vector3()},...night?.uniforms};
 const owner={dispose(){atlas.dispose();previous=[];}};
 const sampling=manualBilinear?`
 vec3 livTexel(vec4 p){return (p.rgb*p.a)*p.a;}
 vec3 livSample(float layer){vec2 size=vec2(${width}.0,${height}.0),st=vLivUV*size-0.5,b=floor(st),f=fract(st);
  return mix(mix(livTexel(texture(livAtlas,vec3((b+vec2(0.5,0.5))/size,layer))),livTexel(texture(livAtlas,vec3((b+vec2(1.5,0.5))/size,layer))),f.x),mix(livTexel(texture(livAtlas,vec3((b+vec2(0.5,1.5))/size,layer))),livTexel(texture(livAtlas,vec3((b+vec2(1.5,1.5))/size,layer))),f.x),f.y);}`:
 `vec3 livSample(float layer){vec4 p=texture(livAtlas,vec3(vLivUV,layer));return (p.rgb*p.a)*p.a;}`;
 const shader=`uniform highp sampler2DArray livAtlas;uniform vec3 livWeights,livLayers;varying vec2 vLivUV;
 ${night?night.shader:''}
 ${sampling}
 vec3 livIrradiance(vec3 p,vec3 n){return ((livSample(livLayers.x)*livWeights.x+livSample(livLayers.y)*livWeights.y)+livSample(livLayers.z)*${night?'livNightWeight(p,n)':'livWeights.z'})*${range*intensity};}`;
 return {node:{kind:'atlas',uniforms,shader},resources:[owner],set({a,b,night,wa,wb,wn}){
  const channels=[a,b,night],unique=[...new Set(channels)];
  if(unique.some((texture,index)=>previous[index]!==texture)||unique.length!==previous.length){
   const count=width*height*4;
   for(const texture of unique)if(texture.image.width!==width||texture.image.height!==height||texture.image.data.length!==count)throw Error('Atlas temporal incompatível.');
   if(atlas.image.width!==width||atlas.image.height!==height||atlas.image.depth!==unique.length){
    // WebGL defers deletion until already submitted draws complete. Replacing
    // storage is required when the number of immutable array layers changes.
    atlas.dispose();atlas=new THREE.DataArrayTexture(new Uint8Array(count*unique.length),width,height,unique.length);
    atlas.minFilter=atlas.magFilter=manualBilinear?THREE.NearestFilter:THREE.LinearFilter;atlas.generateMipmaps=false;atlas.flipY=false;atlas.unpackAlignment=1;uniforms.livAtlas.value=atlas;
   }
   unique.forEach((texture,index)=>atlas.image.data.set(texture.image.data,index*count));atlas.needsUpdate=true;previous=unique;
  }
  uniforms.livLayers.value.set(...channels.map(texture=>unique.indexOf(texture)));uniforms.livWeights.value.set(wa,wb,wn);
 }};
}
export function classicProbes(probes,intensity,night=null){
 const map=probes.roomMap,bytes=Uint8Array.from(atob(map.data),c=>c.charCodeAt(0));
 const rooms=new THREE.DataTexture(bytes,map.width,map.height,THREE.RedFormat,THREE.UnsignedByteType);
 rooms.minFilter=rooms.magFilter=THREE.NearestFilter;rooms.generateMipmaps=false;rooms.flipY=false;rooms.needsUpdate=true;
 const {width,height,depth}=probes,data=new Uint16Array(width*3*height*depth*4),volume=new THREE.Data3DTexture(data,width*3,height,depth),previous=[];
 volume.type=THREE.HalfFloatType;volume.minFilter=volume.magFilter=THREE.LinearFilter;volume.generateMipmaps=false;volume.flipY=false;volume.unpackAlignment=1;volume.needsUpdate=true;
 const uniforms={livRooms:{value:rooms},livVolume:{value:volume},livWeights:{value:new THREE.Vector3()},
  livOrigin:{value:probes.rooms.map(r=>new THREE.Vector4(...r.origin,r.n[0]))},livStep:{value:probes.rooms.map(r=>new THREE.Vector4(...r.step,r.n[2]))},livOffset:{value:probes.rooms.map(r=>new THREE.Vector4(r.zOffset,0,0,0))},
  livBounds:{value:new THREE.Vector4(map.x0,map.z0,map.width*map.cell,map.height*map.cell)},livGrid:{value:new THREE.Vector4(width,height,depth,probes.rows)},...(night&&{livNightLevel:night.uniforms.livNightLevel})};
 const code=probeShaderCode(probes.rooms.length),cube=code.cube.replace('float rows)', 'float rows,float channel)').replace('(q.x+0.5)/size.x','(q.x+0.5+channel*size.x)/(size.x*3.0)');
 const transport=code.transport.replace('sampler3D a,sampler3D b,sampler3D night','sampler3D volume').replace('livAmbientCube(a,q,n,grid.xyz,grid.w)','livAmbientCube(volume,q,n,grid.xyz,grid.w,0.0)').replace('livAmbientCube(b,q,n,grid.xyz,grid.w)','livAmbientCube(volume,q,n,grid.xyz,grid.w,1.0)').replace('livAmbientCube(night,q,n,grid.xyz,grid.w)','livAmbientCube(volume,q,n,grid.xyz,grid.w,2.0)').replace('*weights.z;',night?'*livNightWeight(p,n);':'*weights.z;');
 const shader=`uniform sampler2D livRooms;uniform highp sampler3D livVolume;uniform vec3 livWeights;
 uniform vec4 livOrigin[${probes.rooms.length}],livStep[${probes.rooms.length}],livOffset[${probes.rooms.length}];uniform vec4 livBounds,livGrid;
 ${night?night.shader.replace('uniform sampler2D livNightRooms;uniform vec4 livNightBounds;','').replaceAll('livNightRooms','livRooms').replaceAll('livNightBounds','livBounds'):''}
 ${cube}
 ${transport}
 vec3 livIrradiance(vec3 p,vec3 n){return livProbeTransport(p,n,livRooms,livVolume,livOrigin,livStep,livOffset,livBounds,livGrid,livWeights,${intensity});}`;
 return {node:{kind:'probes',uniforms,shader,count:probes.rooms.length},rooms,resources:[volume],set({a,b,night,wa,wb,wn}){
  let changed=false;[a,b,night].forEach((texture,channel)=>{if(previous[channel]===texture)return;const image=texture.image;if(image.width!==width||image.height!==height||image.depth!==depth)throw Error('Sonda temporal incompatível.');
   for(let row=0;row<height*depth;row++)data.set(image.data.subarray(row*width*4,(row+1)*width*4),(row*3+channel)*width*4);previous[channel]=texture;changed=true;
  });if(changed)volume.needsUpdate=true;uniforms.livWeights.value.set(wa,wb,wn);
 }};
}
export function classicBakedMaterial(physical,parameters,irradiance){
 const material=new (physical?THREE.MeshPhysicalMaterial:THREE.MeshStandardMaterial)(parameters);
 material.isLivRGBMNodeMaterial=true;material.livIrradiance=irradiance;
 material.customProgramCacheKey=()=>`liv-classic-v4:${irradiance.kind}:${irradiance.count||0}:${'livNightLevel' in irradiance.uniforms}`;
 material.clone=()=>classicBakedMaterial(physical,{},irradiance).copy(material);
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,irradiance.uniforms,{livBakeGain:gain.bake,livDirectGain:gain.direct,livAmbientGain:gain.ambient,livNormalize:gain.normalize});
  shader.vertexShader='varying vec3 vLivWorld;\n'+(irradiance.kind==='atlas'?uvVertex:'')+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
   vec4 livPosition=vec4(transformed,1.0);
   #ifdef USE_BATCHING
 livPosition=batchingMatrix*livPosition;
 #endif
   #ifdef USE_INSTANCING
 livPosition=instanceMatrix*livPosition;
 #endif
   vLivWorld=(modelMatrix*livPosition).xyz;
   ${irradiance.kind==='atlas'?'vLivUV=uv1;':''}`);
  shader.fragmentShader=`varying vec3 vLivWorld;uniform float livBakeGain,livDirectGain,livAmbientGain,livNormalize;${irradiance.shader}
`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`
   vec3 livTransport=livIrradiance(vLivWorld,inverseTransformDirection(normal,viewMatrix))*livBakeGain;
   float livProbe=max(dot(iblIrradiance,vec3(0.2126,0.7152,0.0722)),0.0001);
   float livOcclusion=clamp(dot(livTransport,vec3(0.2126,0.7152,0.0722))/livProbe,0.0,1.0);
   iblIrradiance=vec3(0.0);
   #include <lights_fragment_end>
   reflectedLight.directDiffuse*=livDirectGain;
   reflectedLight.indirectDiffuse=(livTransport+irradiance*livAmbientGain)*material.diffuseContribution*RECIPROCAL_PI;
   reflectedLight.indirectSpecular*=livNormalize>0.0?livOcclusion:1.0;
  `);
 };
 return material;
}
