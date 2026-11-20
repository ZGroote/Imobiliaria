import * as THREE from 'three/webgpu';
import {texture, uv, float, vec3, diffuseContribution} from 'three/tsl';

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

/** Diffuse-only RGBM transport matching the frozen r168 shader; specular remains lit. */
export class LivRGBMNodeMaterial extends THREE.MeshStandardNodeMaterial {
  constructor(parameters, atlas, range, intensity) {
    super(parameters);
    this.isLivRGBMNodeMaterial = true;
    // Keep lightMap null: the normal lightMap path would add a second diffuse term.
    this.livIrradiance = irradianceNode(atlas,range,intensity);
  }

  setupLightingModel(builder) {
    const model = super.setupLightingModel(builder);
    const irradiance = this.livIrradiance;
    // Override the returned model, avoiding a second copy of Three's internal modules.
    model.indirect = function (builder) {
      const context = builder.context;
      context.reflectedLight.directDiffuse.assign(vec3(0));
      context.iblIrradiance.assign(vec3(0));
      context.reflectedLight.indirectDiffuse.assign(irradiance.mul(diffuseContribution).mul(1 / Math.PI));
      this.indirectSpecular(builder);
      this.ambientOcclusion(builder);
    };
    return model;
  }
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
