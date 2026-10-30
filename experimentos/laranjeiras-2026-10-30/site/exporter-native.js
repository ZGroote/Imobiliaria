/* Export the actual FloorPlan/HouseMesh scene. This creates no alternate geometry. */
(function (global) {
  'use strict';
  async function sha(bytes) {
    const result = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(result), b => b.toString(16).padStart(2, '0')).join('');
  }
  function array(attribute) {
    if (!attribute) return [];
    const out = new Float32Array(attribute.count * attribute.itemSize);
    for (let i = 0; i < attribute.count; i++) {
      out[i * attribute.itemSize] = attribute.getX(i);
      if (attribute.itemSize > 1) out[i * attribute.itemSize + 1] = attribute.getY(i);
      if (attribute.itemSize > 2) out[i * attribute.itemSize + 2] = attribute.getZ(i);
      if (attribute.itemSize > 3) out[i * attribute.itemSize + 3] = attribute.getW(i);
    }
    // JSON serializes -0 as 0. Fingerprint the same values that a saved source
    // will contain, so reloading the JSON cannot change its geometry identity.
    return Array.from(out, value => value === 0 ? 0 : value);
  }
  // Same byte fingerprint is implemented in preparar_luz.py and the runtime hook.
  async function geometryHash(g) {
    const arrays = ['position', 'normal', 'uv', 'color'].map(k => new Float32Array(Array.from(g[k] || [], value => value === 0 ? 0 : value)));
    const ix = new Uint32Array(g.index || []);
    const lengths = new Uint32Array([...arrays.map(a => a.length), ix.length]);
    const parts = [lengths, ...arrays, ix];
    const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
    let offset = 0;
    for (const p of parts) { out.set(new Uint8Array(p.buffer, p.byteOffset, p.byteLength), offset); offset += p.byteLength; }
    return sha(out);
  }
  function albedo(mesh) {
    const saved = mesh.userData.livAlbedo;
    if (!saved) return array(mesh.geometry.attributes.color);
    if (saved.isBufferAttribute) return array(saved);
    return Array.from(saved, Number);
  }
  // Call immediately after HouseMesh returns, before its JS AO queue writes color.
  function guardarAlbedoInteriorLiv(root) {
    root.traverse(mesh => {
      if (!mesh.isMesh || !mesh.geometry.attributes.color || mesh.userData.livAlbedo) return;
      mesh.userData.livAlbedo = new Float32Array(array(mesh.geometry.attributes.color));
    });
  }
  async function exportarCenaInteriorLiv(options) {
    const { THREE, root } = options;
    if (!THREE || !root) throw Error('Interior export requires THREE and the actual planta3d root');
    if (!options.unitId || !/^[a-f0-9]{64}$/i.test(options.unitHash || '')) throw Error('Missing unit identity/SHA256');
    if (options.lighting && (Array.isArray(options.lighting) || typeof options.lighting !== 'object')) throw Error('lighting must be a declarative world/sun/ceiling object; runtime Three lights belong in runtimeLights');
    root.updateWorldMatrix(true, true);
    const data = {
      schema: 'liv-interior-scene-v1', unitId: options.unitId, unitSHA256: options.unitHash,
      height: Number(options.height), rooms: options.rooms || [], lighting: options.lighting || null,
      objects: [], geometries: {}, materials: {}, textures: {},
      metadata: { source: 'FloorPlan + HouseMesh + FurnitureCatalog, actual browser scene',
        unitPath: options.unitPath || null, captureMode: options.mode || null,
        runtimeLights: options.runtimeLights || null,
        ceilingIncludedWhenHidden: true, albedoBeforeVertexAO: true }
    };
    if (!(data.height > 1 && data.height < 10)) throw Error('Invalid interior height');
    const materials = new Map(), textures = new Map(), pending = [];
    function texture(tex) {
      if (!tex) return null;
      if (textures.has(tex)) return textures.get(tex);
      const key = 't' + textures.size; textures.set(tex, key);
      const image = tex.image;
      if (!image || !(image.width > 0 && image.height > 0)) throw Error('Texture has no readable pixels: ' + tex.name);
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (image.data) {
        const rgba = new Uint8ClampedArray(image.width * image.height * 4);
        const channels = image.data.length / (image.width * image.height);
        if (![1, 3, 4].includes(channels)) throw Error('Unsupported DataTexture channels');
        const floating = image.data instanceof Float32Array || image.data instanceof Float64Array;
        for (let i = 0; i < image.width * image.height; i++) {
          for (let c = 0; c < 3; c++) rgba[i * 4 + c] = Math.round(image.data[i * channels + (channels === 1 ? 0 : c)] * (floating ? 255 : 1));
          rgba[i * 4 + 3] = channels === 4 ? Math.round(image.data[i * channels + 3] * (floating ? 255 : 1)) : 255;
        }
        context.putImageData(new ImageData(rgba, image.width, image.height), 0, 0);
      } else context.drawImage(image, 0, 0);
      data.textures[key] = { data: canvas.toDataURL('image/png'), repeat: tex.repeat.toArray(),
        offset: tex.offset.toArray(), center: tex.center.toArray(), rotation: tex.rotation,
        wrapS: tex.wrapS, wrapT: tex.wrapT, flipY: tex.flipY, colorSpace: tex.colorSpace,
        width: image.width, height: image.height };
      const binary = atob(data.textures[key].data.split(',')[1]);
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      pending.push(sha(bytes).then(hash => { data.textures[key].pngSHA256 = hash; }));
      return key;
    }
    function material(m) {
      if (materials.has(m)) return materials.get(m);
      const key = 'm' + materials.size; materials.set(m, key);
      data.materials[key] = { name: m.name || '', type: m.type, color: m.color ? m.color.toArray() : [1, 1, 1],
        roughness: m.roughness == null ? 1 : m.roughness, metalness: m.metalness || 0,
        vertexColors: !!m.vertexColors, opacity: m.opacity == null ? 1 : m.opacity,
        transparent: !!m.transparent, alphaTest: m.alphaTest || 0, side: m.side,
        emissive: m.emissive ? m.emissive.toArray() : [0, 0, 0], emissiveIntensity: m.emissiveIntensity || 0,
        normalScale: m.normalScale ? m.normalScale.toArray() : [1, 1], bumpScale: m.bumpScale || 0,
        normalMapType: m.normalMapType || 0 };
      for (const field of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'bumpMap', 'emissiveMap']) data.materials[key][field] = texture(m[field]);
      return key;
    }
    let slot = 0;
    root.traverse(mesh => {
      if (!mesh.isMesh) return;
      const currentSlot = slot++, geometry = mesh.geometry;
      if (!geometry || !geometry.attributes.position) throw Error('Missing mesh geometry at slot ' + currentSlot);
      const key = 'g' + currentSlot;
      const g = { position: array(geometry.attributes.position), normal: array(geometry.attributes.normal),
        uv: array(geometry.attributes.uv), color: albedo(mesh),
        index: geometry.index ? Array.from(geometry.index.array) : null,
        groups: geometry.groups.map(a => ({ start: a.start, count: a.count, materialIndex: a.materialIndex })) };
      if (g.normal.length !== g.position.length) throw Error('Missing source normals at slot ' + currentSlot);
      if (g.uv.length && g.uv.length !== g.position.length / 3 * 2) throw Error('Invalid source UV0 at slot ' + currentSlot);
      if (g.color.length && g.color.length !== g.position.length) throw Error('Source vertex color must contain three channels at slot ' + currentSlot);
      if (mesh.userData.casa && geometry.attributes.color && !mesh.userData.livAlbedo) throw Error('HouseMesh albedo was not captured before JS AO at slot ' + currentSlot);
      if (![...g.position, ...g.normal, ...g.uv, ...g.color].every(Number.isFinite)) throw Error('Non-finite source attributes');
      data.geometries[key] = g; pending.push(geometryHash(g).then(hash => { g.sha256 = hash; }));
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const keys = list.map(material);
      const excluded = mesh.name === 'contact-occlusion' || mesh.name === 'holograma-movel' || mesh.userData.livBakeExclude;
      const target = !excluded && mesh.name !== 'plafon' && list.every(m => m.isMeshStandardMaterial && m.opacity >= .5 && (m.metalness || 0) < .75);
      const record = (instance, matrix, instanceColor) => data.objects.push({ name: mesh.name || 'mesh-' + currentSlot,
        slot: currentSlot, instance, geometry: key, materials: keys, matrix: matrix.toArray(),
        bake: target, include: !excluded, visible: mesh.visible,
        kind: mesh.userData.casa ? 'architecture' : mesh.userData.movel ? 'furniture' : 'detail',
        instanceColor: instanceColor || null });
      if (mesh.isInstancedMesh) {
        const local = new THREE.Matrix4(), world = new THREE.Matrix4(), color = new THREE.Color();
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, local); world.multiplyMatrices(mesh.matrixWorld, local);
          let rgb = null; if (mesh.instanceColor) { mesh.getColorAt(i, color); rgb = color.toArray(); }
          record(i, world, rgb);
        }
      } else record(null, mesh.matrixWorld, null);
    });
    await Promise.all(pending);
    data.metadata.meshSlots = slot; data.metadata.objects = data.objects.length;
    data.metadata.bakeObjects = data.objects.filter(o => o.bake).length;
    return data;
  }
  global.guardarAlbedoInteriorLiv = guardarAlbedoInteriorLiv;
  global.exportarCenaInteriorLiv = exportarCenaInteriorLiv;
  global.hashGeometriaInteriorLiv = geometryHash;
})(globalThis);
