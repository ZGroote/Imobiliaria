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
export function createTimeLightmaps({manifest,load,own=value=>value}){
  const textures=new Map(),pending=new Map();let last=null;
  const irradiance=createTimeIrradiance({range:manifest.range,intensity:manifest.lightMapIntensity,width:manifest.width,height:manifest.height});
  // Móveis, portas e moldura não têm UV1: leem a mesma hora nas sondas do cômodo.
  const probes=manifest.probes?createProbeIrradiance(manifest.probes,manifest.lightMapIntensity):null;
  if(probes)own(probes.rooms);
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
  const idsFor=side=>[...manifest.keys.filter(key=>key.side===side).map(key=>key.id),manifest.night.id];
  return {irradiance:irradiance.node,probeIrradiance:probes?.node||null,targets:manifest.targets||[],
    // A noite e as horas mais próximas chegam primeiro.
    ensure(time){
      const {a,b}=timeLightWeights(manifest,time);
      const order=[...new Set([a,b,manifest.night.id,...idsFor(time.context.side)])],first=order.slice(0,order.indexOf(manifest.night.id)+1);
      const urgent=Promise.all(first.map(fetchKey));
      // As demais horas só depois das urgentes: as 17 juntas (9,4 MB) disputavam a banda da abertura.
      urgent.then(()=>{for(const id of order.slice(first.length))fetchKey(id).catch(()=>{});},()=>{});
      return urgent;
    },
    /** Sem as texturas da hora pedida, devolve a última mistura (stale): trocar de lado não pisca nem recompila. */
    apply(time){
      const weights=timeLightWeights(manifest,time);
      const a=textures.get(weights.a),b=textures.get(weights.b),night=textures.get(manifest.night.id);
      if(!a||!b||!night)return last&&{...last,stale:true};
      irradiance.set({a:a.atlas,b:b.atlas,night:night.atlas,wa:weights.wa,wb:weights.wb,wn:weights.wn});
      if(probes&&a.volume&&b.volume&&night.volume)probes.set({a:a.volume,b:b.volume,night:night.volume,wa:weights.wa,wb:weights.wb,wn:weights.wn});
      return last=weights;
    },
    getState:()=>({keys:entries.size,loaded:[...textures.keys()],date:manifest.date,width:manifest.width,samples:manifest.samples}),
  };
}
