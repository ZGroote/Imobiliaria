import {classicAtlas,classicProbes,classicBakedMaterial,setClassicGains,setClassicNormalization} from './classic-lighting.js';
import * as THREE from 'three/webgpu';
import {texture, texture3D, uv, float, int, uniform, uniformArray, vec2, vec3, clamp, select, dot, floor, fract, mix, positionWorld, normalWorld, diffuseContribution} from 'three/tsl';

let classicBackend=false;
export function setBakedMaterialBackend(classic){classicBackend=classic;}

// Uniforms preserve program sharing while scrubbing the clock. Defaults retain the frozen bake.
// ambient separa o céu sintético do sol: a luz gravada por hora já contém o céu, mas não o sol direto.
const bakeGain=uniform(1),directGain=uniform(0),ambientGain=uniform(0);
export function setRGBMTimeLighting({bake=1,direct=0,ambient=direct}={}) {
  setClassicGains({bake,direct,ambient});
  bakeGain.value=Math.max(0,bake);directGain.value=Math.max(0,direct);ambientGain.value=Math.max(0,ambient);
}

// O reflexo vem de uma foto 360 só, tirada no meio da sala: dentro da cuba ou no canto do fogão ele
// refletia a janela. Normalização de sonda de reflexo: o reflexo cai na proporção entre a luz gravada
// que chega ali e a que a própria foto 360 daria na mesma normal (só reduz; desligada no exterior).
const reflectionNormalize=uniform(0);
export function setReflectionNormalization(enabled){setClassicNormalization(enabled);reflectionNormalize.value=enabled?1:0;}

/** Duas horas gravadas + a noite numa só expressão; trocar hora muda texturas e pesos, não o shader. */
export function createTimeIrradiance({range,intensity,width,height}) {
  if(classicBackend)return classicAtlas({range,intensity,width,height,manualBilinear:true});
  const placeholder=new THREE.DataTexture(new Uint8Array(4),1,1);placeholder.channel=1;placeholder.needsUpdate=true;
  // Decodifica os 4 texels vizinhos e só então mistura. O bilinear do hardware misturava o RGBM
  // codificado: onde o multiplicador muda entre vizinhos a média saía errada e a parede ganhava contornos em
  // degrau (curva de nível) em toda hora. Os atlas vêm em NearestFilter (interior-luz-horario.js).
  const size=vec2(width,height),st=uv(1).mul(size).sub(.5),base=floor(st),f=fract(st);
  const at=(dx,dy)=>base.add(vec2(dx,dy)).add(.5).div(size);
  const hashes=[0,1,2].map(()=>THREE.MathUtils.generateUUID());
  const samples=[0,1,2].map(channel=>[at(0,0),at(1,0),at(0,1),at(1,1)].map(coord=>{const node=texture(placeholder,coord);node.getUniformHash=()=>hashes[channel];return node;})),weights=[0,1,2].map(()=>uniform(0));
  // Multiplicador ao quadrado (linear-rgbm2-u8): luz = rgb·a²·range.
  const texel=sample=>sample.rgb.mul(sample.a).mul(sample.a);
  const decode=([s00,s10,s01,s11],weight)=>mix(mix(texel(s00),texel(s10),f.x),mix(texel(s01),texel(s11),f.x),f.y).mul(weight);
  const node=decode(samples[0],weights[0]).add(decode(samples[1],weights[1])).add(decode(samples[2],weights[2])).mul(float(range*intensity));
  return {node,
    set({a,b,night,wa,wb,wn}){
      [a,b,night].forEach((value,index)=>{for(const sample of samples[index])sample.value=value;});
      [wa,wb,wn].forEach((value,index)=>{weights[index].value=Math.max(0,value);});
    }};
}

// Equal RGBM expressions must share node identity: NodeMaterial includes its
// child nodes in the program cache key. Keep distinct atlases/parameters apart.
const irradianceByAtlas=new WeakMap(),samplesByAtlas=new WeakMap();
function irradianceNode(atlas,range,intensity) {
  let entries=irradianceByAtlas.get(atlas);
  if(!entries){entries=new Map();irradianceByAtlas.set(atlas,entries);samplesByAtlas.set(atlas,[]);}
  const key=`${range}:${intensity}`;
  if(!entries.has(key)) {
    const sample=texture(atlas,uv(1));samplesByAtlas.get(atlas).push(sample);
    entries.set(key,sample.rgb.mul(sample.a).mul(float(range)).mul(float(intensity)));
  }
  return entries.get(key);
}

/** Points built materials at another atlas with the same format (preview -> full); no shader rebuild. */
export function replaceRGBMAtlas(previous,next) {
  for(const sample of samplesByAtlas.get(previous)||[])sample.value=next;
  irradianceByAtlas.set(next,irradianceByAtlas.get(previous));samplesByAtlas.set(next,samplesByAtlas.get(previous));
}

/** Diffuse-only baked transport; specular remains lit. Works for standard and physical (sheen) models. */
const withBakedIrradiance = Base => class extends Base {
  setupLightingModel(builder) {
    const model = super.setupLightingModel(builder);
    const irradiance = this.livIrradiance;
    // Override the returned model, avoiding a second copy of Three's internal modules.
    model.indirect = function (builder) {
      const context = builder.context;
      context.reflectedLight.directDiffuse.mulAssign(directGain);
      // toVar fixa o valor aqui, antes de zerar iblIrradiance (o TSL calcula onde a expressão é usada).
      const luminance=vec3(.2126,.7152,.0722),probe=dot(context.iblIrradiance,luminance).max(1e-4).toVar('livProbeIrradiance');
      const occlusion=clamp(dot(irradiance.mul(bakeGain),luminance).div(probe),0,1).toVar('livReflectionOcclusion');
      context.iblIrradiance.assign(vec3(0));
      context.reflectedLight.indirectDiffuse.assign(irradiance.mul(bakeGain).add(context.irradiance.mul(ambientGain)).mul(diffuseContribution).mul(1 / Math.PI));
      this.indirectSpecular(builder);
      context.reflectedLight.indirectSpecular.mulAssign(select(reflectionNormalize.greaterThan(0),occlusion,float(1)));
      this.ambientOcclusion(builder);
    };
    return model;
  }
};

/** Diffuse-only RGBM transport matching the frozen r168 shader. */
export class LivRGBMNodeMaterial extends withBakedIrradiance(THREE.MeshStandardNodeMaterial) {
  constructor(parameters, atlas, range, intensity, irradiance = irradianceNode(atlas,range,intensity)) {
    if(classicBackend)return classicBakedMaterial(false,parameters,irradiance);
    super(parameters);
    this.isLivRGBMNodeMaterial = true;
    // Keep lightMap null: the normal lightMap path would add a second diffuse term.
    this.livIrradiance = irradiance;
  }
}

/** Same transport for physical materials (the approved fabrics keep their sheen). */
export class LivBakedPhysicalNodeMaterial extends withBakedIrradiance(THREE.MeshPhysicalNodeMaterial) {
  constructor(parameters, irradiance) {
    if(classicBackend)return classicBakedMaterial(true,parameters,irradiance);
    super(parameters);
    this.isLivRGBMNodeMaterial = true;
    this.livIrradiance = irradiance;
  }
}

/** Ambient cube from the per-room probe grid: room map (top view) picks the grid, so walls never leak.
 * Texture z = face * rows + room offset + row; faces +x -x +y -y +z -z. Values are E/π like the atlas. */
export function createProbeIrradiance(probes, intensity) {
  if(classicBackend)return classicProbes(probes,intensity);
  const map = probes.roomMap, bytes = Uint8Array.from(atob(map.data), c => c.charCodeAt(0));
  const rooms = new THREE.DataTexture(bytes, map.width, map.height, THREE.RedFormat, THREE.UnsignedByteType);
  rooms.minFilter = rooms.magFilter = THREE.NearestFilter; rooms.generateMipmaps = false; rooms.flipY = false; rooms.needsUpdate = true;
  const origin = uniformArray(probes.rooms.map(r => new THREE.Vector4(r.origin[0], r.origin[1], r.origin[2], r.n[0])), 'vec4');
  const step = uniformArray(probes.rooms.map(r => new THREE.Vector4(r.step[0], r.step[1], r.step[2], r.n[2])), 'vec4');
  const offset = uniformArray(probes.rooms.map(r => r.zOffset), 'float');
  const placeholder = new THREE.Data3DTexture(new Uint16Array(4), 1, 1, 1);
  placeholder.type = THREE.HalfFloatType; placeholder.needsUpdate = true;
  const volumes = [0, 1, 2].map(() => placeholder), weights = [0, 1, 2].map(() => uniform(0)), samplers = [];
  const p = positionWorld, n = normalWorld;
  const room = int(texture(rooms, vec2(p.x.sub(map.x0).div(map.width * map.cell), p.z.sub(map.z0).div(map.height * map.cell))).r.mul(255).add(.5));
  const o = origin.element(room), s = step.element(room);
  const gx = clamp(p.x.sub(o.x).div(s.x), 0, o.w.sub(1)), gy = clamp(p.y.sub(o.y).div(s.y), 0, probes.height - 1);
  const gz = clamp(p.z.sub(o.z).div(s.z), 0, s.w.sub(1)).add(offset.element(room));
  const coordinate = face => vec3(gx.add(.5).div(probes.width), gy.add(.5).div(probes.height), gz.add(face * probes.rows + .5).div(probes.depth));
  const n2 = n.mul(n);
  const channelHashes=[0,1,2].map(()=>THREE.MathUtils.generateUUID());
  const cube = index => {
    const sample = face => {const node = texture3D(placeholder, coordinate(face));node.getUniformHash=()=>channelHashes[index];samplers.push([index, node]);return node.rgb;};
    return select(n.x.greaterThan(0), sample(0), sample(1)).mul(n2.x)
      .add(select(n.y.greaterThan(0), sample(2), sample(3)).mul(n2.y))
      .add(select(n.z.greaterThan(0), sample(4), sample(5)).mul(n2.z));
  };
  const node = cube(0).mul(weights[0]).add(cube(1).mul(weights[1])).add(cube(2).mul(weights[2])).mul(float(intensity));
  return {node, rooms,
    set({a, b, night, wa, wb, wn}) {
      const next = [a, b, night];
      for (const [index, sampler] of samplers) sampler.value = next[index];
      [wa, wb, wn].forEach((value, index) => {weights[index].value = Math.max(0, value);});
    }};
}

export function createRGBMTexture(bytes, manifest) {
  if(bytes.length !== manifest.width * manifest.height * 4) throw Error('Quantidade de bytes RGBM inválida.');
  const atlas = new THREE.DataTexture(bytes,manifest.width,manifest.height,THREE.RGBAFormat,THREE.UnsignedByteType);
  atlas.colorSpace=THREE.NoColorSpace;
  atlas.channel=1;
  atlas.flipY=false;
  atlas.premultiplyAlpha=false;
  atlas.generateMipmaps=false;
  atlas.minFilter=atlas.magFilter=THREE.LinearFilter;
  atlas.needsUpdate=true;
  return atlas;
}

export function decodeRGBMReference(rgba, range=16, intensity=Math.PI) {
  if(rgba.length!==4) throw Error('RGBM requer quatro canais.');
  return rgba.slice(0,3).map(channel=>channel/255 * rgba[3]/255 * range * intensity / Math.PI);
}
