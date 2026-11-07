import * as THREE from 'three/webgpu';
import {createRGBMTexture,createTimeIrradiance,createProbeIrradiance} from './material-rgbm.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const lerp=(a,b,t)=>a+(b-a)*t;

/** Duas horas gravadas vizinhas do mesmo lado + a noite. Sol direto em W/m² já com a exposição da câmera.
 * ponytail: outras datas usam a mesma hora de 26/10, só reescalada pela luz do dia; gravar por estação se a diferença aparecer. */
export function timeLightWeights(manifest,time){
  const keys=manifest.keys.filter(key=>key.side===time.context.side).sort((a,b)=>a.hour-b.hour);
  if(!keys.length)throw Error(`Sem luz gravada para o lado ${time.context.side}.`);
  const next=keys.findIndex(key=>key.hour>=time.hour);
  const [a,b]=next<0?[keys.at(-1),keys.at(-1)]:next===0?[keys[0],keys[0]]:[keys[next-1],keys[next]];
  const t=a===b?0:(time.hour-a.hour)/(b.hour-a.hour);
  const keyDaylight=lerp(a.daylight,b.daylight,t),keySun=lerp(a.sunStrength,b.sunStrength,t);
  const exposure=2**manifest.exposureEV,day=keyDaylight>0?clamp(time.daylight/keyDaylight,0,1.5)*exposure:0;
  const sunScale=keySun>0?clamp(time.sunStrength/keySun,0,1.5)*exposure:0;
  return {a:a.id,b:b.id,wa:(1-t)*day,wb:t*day,wn:time.night,
    sun:a.sunIrradianceRGB.map((value,channel)=>lerp(value,b.sunIrradianceRGB[channel],t)*sunScale)};
}

/** Baixa as horas do lado pedido sob demanda; a mistura troca só texturas e pesos, sem recompilar. */
export function createTimeLightmaps({manifest,load,own=value=>value,release=value=>value.dispose()}){
  const textures=new Map(),pending=new Map();let last=null;
  const irradiance=createTimeIrradiance({range:manifest.range,intensity:manifest.lightMapIntensity,width:manifest.width,height:manifest.height});
  // Móveis, portas e moldura não têm UV1: leem a mesma hora nas sondas do cômodo.
  const probes=manifest.probes?createProbeIrradiance(manifest.probes,manifest.lightMapIntensity):null;
  if(probes)own(probes.rooms);
  for(const resource of [...(irradiance.resources||[]),...(probes?.resources||[])])own(resource);
  const volume=bytes=>{
    const {width,height,depth}=manifest.probes,data=new Uint16Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/2);
    if(data.length!==width*height*depth*4)throw Error('Sondas de luz com tamanho inválido.');
    const texture=own(new THREE.Data3DTexture(data,width,height,depth));
    texture.type=THREE.HalfFloatType;texture.format=THREE.RGBAFormat;texture.minFilter=texture.magFilter=THREE.LinearFilter;
    texture.wrapS=texture.wrapT=texture.wrapR=THREE.ClampToEdgeWrapping;texture.generateMipmaps=false;texture.unpackAlignment=1;texture.needsUpdate=true;
    return texture;
  };
  const entries=new Map([...manifest.keys,manifest.night].map(entry=>[entry.id,entry]));
  function fetchKey(id){
    const entry=entries.get(id);
    if(!pending.has(id))pending.set(id,Promise.all([load(entry),probes&&entry.probes?load(entry.probes):null]).then(([bytes,probeBytes])=>{
      const texture=own(createRGBMTexture(bytes,manifest));texture.name=`LIV luz gravada · ${id}`;
      texture.minFilter=texture.magFilter=THREE.NearestFilter;  // o shader faz o bilinear já decodificado
      const value={atlas:texture,volume:probeBytes?volume(probeBytes):null};textures.set(id,value);return value;
    }).catch(error=>{pending.delete(id);throw error;}));
    return pending.get(id);
  }
  const required=weights=>{
    const ids=new Set();
    if(weights.wa>0)ids.add(weights.a);if(weights.wb>0)ids.add(weights.b);if(weights.wn>0)ids.add(manifest.night.id);
    // Mesmo uma mistura preta precisa de samplers válidos no shader.
    if(!ids.size)ids.add(manifest.night.id);return ids;
  };
  return {irradiance:irradiance.node,probeIrradiance:probes?.node||null,targets:manifest.targets||[],
    // Só canais com contribuição precisam baixar ou ocupar a GPU.
    ensure(time){
      return Promise.all([...required(timeLightWeights(manifest,time))].map(fetchKey));
    },
    /** Sem as texturas da hora pedida, devolve a última mistura (stale): trocar de lado não pisca nem recompila. */
    apply(time){
      const weights=timeLightWeights(manifest,time);
      const active=required(weights);
      if([...active].some(id=>!textures.has(id)))return last&&{...last,stale:true};
      const fallback=textures.get(active.values().next().value);
      // Canais de peso zero compartilham um sampler carregado; a soma fica idêntica.
      const a=weights.wa>0?textures.get(weights.a):fallback,b=weights.wb>0?textures.get(weights.b):fallback,
        night=weights.wn>0?textures.get(manifest.night.id):fallback;
      irradiance.set({a:a.atlas,b:b.atlas,night:night.atlas,wa:weights.wa,wb:weights.wb,wn:weights.wn});
      if(probes&&a.volume&&b.volume&&night.volume)probes.set({a:a.volume,b:b.volume,night:night.volume,wa:weights.wa,wb:weights.wb,wn:weights.wn});
      // Conserva até cinco horas, sem descartar os samplers da mistura ativa.
      for(const [id,value] of textures){
        if(textures.size<=5)break;
        if(active.has(id))continue;
        textures.delete(id);pending.delete(id);release(value.atlas);if(value.volume)release(value.volume);
      }
      return last=weights;
    },
    getState:()=>({keys:entries.size,loaded:[...textures.keys()],date:manifest.date,width:manifest.width,samples:manifest.samples}),
  };
}
