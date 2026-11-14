const SIZE = 512, TAU = Math.PI * 2;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const mix = (a, b, t) => a + (b - a) * t;
const fract = value => value - Math.floor(value);
const smooth = (a, b, value) => {
  const t = clamp((value - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function hash(x, y, seed) {
  let value = Math.imul(x ^ seed, 374761393) + Math.imul(y, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

// Integer periods keep both edges identical when the maps repeat over metre UVs.
function noise(u, v, frequency, seed) {
  const x = u * frequency, y = v * frequency, ix = Math.floor(x), iy = Math.floor(y);
  const sx = smooth(0, 1, fract(x)), sy = smooth(0, 1, fract(y));
  const wrap = value => (value % frequency + frequency) % frequency;
  return mix(mix(hash(wrap(ix), wrap(iy), seed), hash(wrap(ix + 1), wrap(iy), seed), sx),
    mix(hash(wrap(ix), wrap(iy + 1), seed), hash(wrap(ix + 1), wrap(iy + 1), seed), sx), sy);
}

function wood(u, v, x, y) {
  const board = Math.floor(u * 5), across = fract(u * 5);
  const offset = [0, .36, .72, .18, .54][board];
  const along = fract(v + offset), variation = hash(board, 0, 431) - .5;
  const side = 1 - smooth(.004, .014, Math.min(across, 1 - across));
  const end = 1 - smooth(.0015, .0045, Math.min(along, 1 - along));
  const joint = Math.max(side, end);
  const warp = Math.sin(v * TAU * 2 + board * 1.9) * .6 + Math.sin(v * TAU * 5 + board) * .11;
  const phase = across * 43 + warp + noise(u, v, 8, 77) * .65;
  const grain = Math.sin(phase * TAU) * .52 + Math.sin(phase * TAU * 2) * .2;
  const pore = Math.pow(.5 + .5 * Math.sin((phase * 2 + across * 35) * TAU), 12);
  const dx = across - (.36 + hash(board, 1, 82) * .27);
  const dy = Math.min(Math.abs(along - .47), 1 - Math.abs(along - .47));
  const radius = Math.sqrt((dx / .19) ** 2 + (dy / .075) ** 2);
  const knotMask = board % 3 === 1 ? Math.exp(-radius * radius * 2) : 0;
  const knot = knotMask * (Math.sin(radius * TAU * 3.5) * .5 - .8);
  const fine = hash(x, y, 375) - .5;
  const detail = grain * 7 - pore * 5 + knot * 14 + fine * 3;
  const tone = 1 + variation * .15;
  return {
    rgb: [166, 149, 126].map((channel, index) => (channel * tone + detail * [1, .88, .72][index]) * (1 - joint * .32)),
    height: grain * .00010 - pore * .000035 + knot * .00008 - joint * .0008,
    roughness: .57 + grain * .045 + fine * .025 + joint * .24,
  };
}

function stone(u, v, x, y) {
  const a = fract(u * 2), b = fract(v * 2);
  const distance = Math.min(a, 1 - a, b, 1 - b);
  const grout = 1 - smooth(.0015, .007, distance);
  const cloud = noise(u, v, 4, 587) - .5, detail = noise(u, v, 32, 119) - .5;
  const vein = (1 - smooth(.015, .08, Math.abs(Math.sin(TAU * (u * 3 + v * 2 + noise(u, v, 4, 501) * .6))))) * .6;
  const tile = (hash(Math.floor(u * 2), Math.floor(v * 2), 685) - .5) * 4;
  const fine = hash(x, y, 940) - .5;
  const color = cloud * 12 + detail * 3 - vein * 7 + tile + fine * 1.5;
  return {
    rgb: [209, 207, 198].map((channel, index) => mix(channel + color, [166, 166, 158][index], grout)),
    height: cloud * .00007 + detail * .000018 - grout * .001,
    roughness: .34 + cloud * .07 + detail * .025 + grout * .37,
  };
}

function fabric(u, v, x, y) {
  const warp = Math.cos(u * TAU * 128), weft = Math.cos(v * TAU * 128);
  const weave = warp * weft * .5 + (warp + weft) * .17;
  const fleck = hash(x, y, 127) - .5;
  const slub = noise(u, v, 32, 81) - .5;
  const value = weave * 10 + slub * 8 + fleck * 5;
  return {
    rgb: [237 + value, 235 + value, 228 + value],
    height: weave * .00016 + slub * .00007 + fleck * .000025,
    roughness: .92 + weave * .035 + fleck * .025,
  };
}

function plaster(u, v, x, y) {
  const cloud = noise(u, v, 8, 103) - .5, grain = noise(u, v, 128, 870) - .5;
  const fine = hash(x, y, 928) - .5, pore = Math.max(0, fine - .47) / .03;
  const value = cloud * 2 + grain * 3 + fine * 1.5 - pore * 3;
  return {
    rgb: [248 + value, 247 + value, 244 + value],
    height: grain * .00014 + fine * .000035 - pore * .00011,
    roughness: .9 + grain * .06 + fine * .035,
  };
}

/** Three maps of the same physical surface; one repeat covers one square metre. */
export function createPBRSet(THREE, type) {
  const sample = { wood, stone, fabric, plaster }[type];
  if (!sample) throw new Error(`Superfície PBR desconhecida: ${type}`);
  const color = new Uint8Array(SIZE * SIZE * 4), normals = new Uint8Array(color.length);
  const roughness = new Uint8Array(color.length), heights = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const index = y * SIZE + x, at = index * 4;
    const pixel = sample(x / SIZE, y / SIZE, x, y);
    for (let channel = 0; channel < 3; channel++) {
      color[at + channel] = Math.round(clamp(pixel.rgb[channel], 0, 255));
      roughness[at + channel] = Math.round(clamp(pixel.roughness) * 255);
    }
    color[at + 3] = roughness[at + 3] = 255;
    heights[index] = pixel.height;
  }
  // Derivatives use metre heights, so broad boards and fine threads do not get
  // the same exaggerated relief. The same joints appear in every PBR channel.
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const left = y * SIZE + (x + SIZE - 1) % SIZE, right = y * SIZE + (x + 1) % SIZE;
    const below = ((y + SIZE - 1) % SIZE) * SIZE + x, above = ((y + 1) % SIZE) * SIZE + x;
    const nx = -(heights[right] - heights[left]) * SIZE * .5;
    const ny = -(heights[above] - heights[below]) * SIZE * .5;
    const length = Math.hypot(nx, ny, 1), at = (y * SIZE + x) * 4;
    normals[at] = Math.round((nx / length * .5 + .5) * 255);
    normals[at + 1] = Math.round((ny / length * .5 + .5) * 255);
    normals[at + 2] = Math.round((1 / length * .5 + .5) * 255);
    normals[at + 3] = 255;
  }
  function texture(bytes, slot) {
    const value = new THREE.DataTexture(bytes, SIZE, SIZE, THREE.RGBAFormat, THREE.UnsignedByteType);
    value.name = `Estudo LIV / ${type} / ${slot} / 1m`;
    value.colorSpace = slot === 'albedo' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    value.wrapS = value.wrapT = THREE.RepeatWrapping;
    value.minFilter = THREE.LinearMipmapLinearFilter; value.magFilter = THREE.LinearFilter;
    value.generateMipmaps = true; value.anisotropy = 8; value.needsUpdate = true;
    return value;
  }
  const set = { map: texture(color, 'albedo'), normalMap: texture(normals, 'normal'),
    roughnessMap: texture(roughness, 'roughness'), roughness: 1, metalness: 0,
    normalScale: new THREE.Vector2(type === 'fabric' ? .65 : .8, type === 'fabric' ? .65 : .8) };
  let disposed = false;
  Object.defineProperty(set, 'dispose', { value() {
    if (disposed) return; disposed = true;
    set.map.dispose(); set.normalMap.dispose(); set.roughnessMap.dispose();
  } });
  return set;
}

function surfaceType(material) {
  if (!(material.isMeshStandardMaterial || material.isMeshStandardNodeMaterial ||
    material.isMeshPhysicalMaterial || material.isMeshPhysicalNodeMaterial)) return null;
  const id = material.userData?.studioId;
  if (id === 'm0') return 'plaster';
  if (id === 'm1') return 'stone';
  if (id === 'm2') return 'wood';
  const name = (material.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/tecido|linho|algodao|tapete|estofad/.test(name)) return 'fabric';
  if (/madeira|carvalho|nogueira|assoalho|parquet|ripado|laminado/.test(name)) return 'wood';
  if (/porcelanato|ceramica|marmore|granito|pedra|piso.*frio|calcada/.test(name)) return 'stone';
  if (/reboco|alvenaria|estuque|argamassa|parede|peitoril|laje|forro|cornija|concreto/.test(name)) return 'plaster';
  return null;
}

/** Keeps the original RGBM transport and bake UVs; only finish maps are edited. */
export function architecturalSurfaces({ THREE, scene, kind }) {
  const seen = new Set(), saved = [], sets = new Map();
  const fields = ['map', 'normalMap', 'roughnessMap', 'normalMapType', 'roughness',
    'metalness', 'bumpMap', 'bumpScale', 'vertexColors'];
  const metrics = { kind, materials: 0, textures: 0, textureSize: SIZE,
    textureBytes: 0, types: {}, enabled: false };
  scene.traverse(object => {
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material || seen.has(material)) continue;
      seen.add(material);
      const type = surfaceType(material);
      if (!type) continue;
      const original = { material, type, color: material.color?.clone(), normalScale: material.normalScale?.clone() };
      for (const field of fields) original[field] = material[field];
      saved.push(original);
      metrics.types[type] = (metrics.types[type] || 0) + 1;
    }
  });
  metrics.materials = saved.length;
  let disposed = false;
  function restore(original) {
    const material = original.material;
    for (const field of fields) material[field] = original[field];
    if (original.color) material.color.copy(original.color);
    if (original.normalScale) material.normalScale.copy(original.normalScale);
  }
  function setEnabled(value) {
    if (disposed) return;
    metrics.enabled = Boolean(value);
    for (const original of saved) {
      restore(original);
      const material = original.material, id = material.userData?.studioId;
      if (metrics.enabled) {
        // Both interior typologies export these UVs in 1.2m / 2.4m units.
        const repeat = id === 'm1' ? 1.2 : id === 'm2' ? 2.4 : 1;
        const key = `${original.type}:${repeat}`;
        if (!sets.has(key)) {
          const set = createPBRSet(THREE, original.type);
          for (const field of ['map', 'normalMap', 'roughnessMap']) set[field].repeat.set(repeat, repeat);
          sets.set(key, set); metrics.textures += 3; metrics.textureBytes += SIZE * SIZE * 4 * 3;
        }
        const set = sets.get(key);
        material.map = set.map; material.normalMap = set.normalMap; material.roughnessMap = set.roughnessMap;
        material.normalScale.copy(set.normalScale); material.normalMapType = THREE.TangentSpaceNormalMap;
        material.roughness = set.roughness; material.metalness = 0;
        material.bumpMap = null; material.bumpScale = 0;
        // The old floor vertex tint is orange. Albedo already contains oak or
        // porcelain color; multiplying both would paint the new texture orange.
        if (id === 'm1' || id === 'm2') { material.color.setRGB(1, 1, 1); material.vertexColors = false; }
      }
      material.needsUpdate = true;
    }
  }
  return { setEnabled, metrics, dispose() {
    if (disposed) return;
    setEnabled(false); disposed = true;
    for (const set of sets.values()) set.dispose();
    sets.clear();
  } };
}
