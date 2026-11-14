/* LIV-only diffuse transport. Texture bytes are linear RGBM, never browser PNG alpha. */
async function aplicarLuzLiv(options) {
  var T = options.THREE, predio = options.predio, asset = options.asset;
  var base = options.urlBase || '', state = {ready:false, sourceSHA256:null, groups:0, triangles:0};
  window.__livLightmap = state;
  function url(relative) { return base + relative; }
  async function defaultBytes(relative) {
    var response = await fetch(url(relative));
    if (!response.ok) throw Error('LIV lightmap HTTP ' + response.status);
    var bytes = new Uint8Array(await response.arrayBuffer());
    if (/\.gz$/.test(relative)) {
      if (typeof DecompressionStream === 'undefined') throw Error('Gzip decoder unavailable');
      bytes = new Uint8Array(await new Response(new Blob([bytes]).stream()
        .pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    }
    return bytes;
  }
  var loadBytes = options.loadBytes || defaultBytes;
  var loadJSON = options.loadJSON || async function(relative) {
    return JSON.parse(new TextDecoder().decode(await defaultBytes(relative)));
  };
  async function hashBytes(data) {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null;
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)))
      .map(function(b){return b.toString(16).padStart(2,'0');}).join('');
  }
  function uvBytes(encoded) {
    var text = atob(encoded), data = new Uint8Array(text.length);
    for (var i = 0; i < text.length; i++) data[i] = text.charCodeAt(i);
    return new DataView(data.buffer);
  }
  try {
    var manifest = await loadJSON(options.manifestURL || 'luz/manifest.json');
    if (manifest.schema !== 'liv-lightmap-v1' || manifest.colorPass !== false)
      throw Error('Unsupported LIV lightmap manifest');
    var sourceHash = options.modeloHash;
    if (!sourceHash) {
      var source = await defaultBytes('modelo.json');
      sourceHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', source)))
        .map(function(b){return b.toString(16).padStart(2,'0');}).join('');
    }
    if (sourceHash !== manifest.sourceSHA256) throw Error('LIV UV/model SHA256 mismatch');
    var loaded = await Promise.all([loadJSON(manifest.geometryURL), loadBytes(manifest.textureURL)]);
    var compact = loaded[0], bytes = loaded[1];
    if (compact.schema !== 'liv-lightmap-corners-v1' || compact.sourceSHA256 !== sourceHash)
      throw Error('LIV compact/model SHA256 mismatch');
    if (bytes.byteLength !== manifest.width * manifest.height * 4)
      throw Error('LIV RGBM byte count mismatch');
    // preparar_luz writes compact JSON with Python's ensure_ascii=True.
    var canonical = JSON.stringify(compact).replace(/[\u007f-\uffff]/g, function(character){
      return '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0');
    });
    var hashes = await Promise.all([hashBytes(new TextEncoder().encode(canonical)), hashBytes(bytes)]);
    if (hashes[0] && hashes[0] !== manifest.geometrySHA256) throw Error('LIV compact SHA256 mismatch');
    if (hashes[1] && hashes[1] !== manifest.textureSHA256) throw Error('LIV texture SHA256 mismatch');
    state.geometryHashVerified = hashes[0] === manifest.geometrySHA256;
    state.textureHashVerified = hashes[1] === manifest.textureSHA256;
    if (!T.ShaderChunk.lights_fragment_maps.includes('lightMapTexel.rgb * lightMapIntensity'))
      throw Error('Three.js lightmap shader changed');
    var texture = new T.DataTexture(bytes, manifest.width, manifest.height, T.RGBAFormat, T.UnsignedByteType);
    texture.colorSpace = T.NoColorSpace;
    texture.channel = 1;
    texture.flipY = false;
    texture.premultiplyAlpha = false;
    texture.generateMipmaps = false;
    texture.minFilter = texture.magFilter = T.LinearFilter;
    texture.needsUpdate = true;
    var originals = new Map();
    predio.traverse(function(object){
      if (object.isMesh && object.name && object.name.indexOf('Blender / ') === 0)
        originals.set(object.name, object);
    });
    var clonedMaterials = new Map(), replacements = [];
    function bakedMaterial(original) {
      if (clonedMaterials.has(original)) return clonedMaterials.get(original);
      var material = original.clone();
      material.lightMap = texture;
      material.lightMapIntensity = manifest.lightMapIntensity;
      material.vertexColors = true;
      material.userData.livBakedTransport = true;
      var originalCompile = material.onBeforeCompile;
      material.onBeforeCompile = function(shader, renderer) {
        if (originalCompile) originalCompile.call(this, shader, renderer);
        var maps = T.ShaderChunk.lights_fragment_maps;
        var source = 'lightMapTexel.rgb * lightMapIntensity';
        if (maps.indexOf(source) === -1) throw Error('Three.js lightmap shader changed');
        maps = maps.replace(source, '(lightMapTexel.rgb * lightMapTexel.a * ' +
          Number(manifest.range).toFixed(8) + ') * lightMapIntensity');
        maps = maps.replace('irradiance += lightMapIrradiance;', 'irradiance = lightMapIrradiance;');
        // Baked sky/sun already contain diffuse IBL and direct lighting.
        maps = maps.replace('iblIrradiance += getIBLIrradiance( geometryNormal );', '');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <lights_fragment_maps>', maps)
          .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' +
            'reflectedLight.directDiffuse = vec3(0.0);');
      };
      material.customProgramCacheKey = function(){return 'liv-exclusive-rgbm-' + sourceHash;};
      material.needsUpdate = true;
      clonedMaterials.set(original, material);
      return material;
    }
    compact.groups.forEach(function(batch) {
      var group = asset.groups[batch.groupIndex];
      if (!group || group.geometry !== batch.geometry) throw Error('LIV source group mismatch');
      var old = originals.get('Blender / ' + group.geometry + ' / torre ' + group.tower);
      if (!old || !old.isInstancedMesh) throw Error('LIV source mesh missing: ' + group.geometry);
      var source = asset.geometries[group.geometry];
      if (source.position.length / 3 !== batch.sourceVertexCount)
        throw Error('LIV source vertex count mismatch');
      var corners = batch.indices.length, count = corners * batch.instances.length;
      var position = new Float32Array(count * 3), normal = new Float32Array(count * 3);
      var uv = new Float32Array(count * 2), uv1 = new Float32Array(count * 2);
      var color = new Float32Array(count * 3), floorIndex = new Float32Array(count);
      color.fill(1);
      var matrix = new T.Matrix4(), normalMatrix = new T.Matrix3();
      var p = new T.Vector3(), n = new T.Vector3(), ranges = [], offset = 0;
      batch.instances.forEach(function(instance) {
        var sourceInstance = group.instances[instance.instanceIndex];
        if (!sourceInstance || sourceInstance.floor !== instance.floor)
          throw Error('LIV instance/floor mismatch');
        matrix.fromArray(sourceInstance.matrix);
        normalMatrix.getNormalMatrix(matrix);
        var encoded = uvBytes(instance.uv1U16);
        if (encoded.byteLength !== corners * 4) throw Error('LIV corner UV count mismatch');
        for (var i = 0; i < corners; i++) {
          var index = batch.indices[i], target = offset + i;
          p.fromArray(source.position, index * 3).applyMatrix4(matrix).toArray(position, target * 3);
          n.fromArray(source.normal, index * 3).applyMatrix3(normalMatrix).normalize().toArray(normal, target * 3);
          uv[target * 2] = source.uv[index * 2];
          uv[target * 2 + 1] = source.uv[index * 2 + 1];
          uv1[target * 2] = encoded.getUint16(i * 4, true) / compact.uvScale;
          uv1[target * 2 + 1] = encoded.getUint16(i * 4 + 2, true) / compact.uvScale;
          floorIndex[target] = instance.floor;
        }
        ranges.push({floor:instance.floor, start:offset, count:corners, instanceIndex:instance.instanceIndex});
        offset += corners;
      });
      var geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.BufferAttribute(position, 3));
      geometry.setAttribute('normal', new T.BufferAttribute(normal, 3));
      geometry.setAttribute('uv', new T.BufferAttribute(uv, 2));
      geometry.setAttribute('uv1', new T.BufferAttribute(uv1, 2));
      geometry.setAttribute('color', new T.BufferAttribute(color, 3));
      geometry.setAttribute('livFloorIndex', new T.BufferAttribute(floorIndex, 1));
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      var mesh = new T.Mesh(geometry, bakedMaterial(old.material));
      mesh.name = old.name;
      mesh.userData = Object.assign({}, old.userData, {livBakedTransport:true,
        livFloorRanges:ranges, livGroupIndex:batch.groupIndex, tower:group.tower, role:group.role});
      mesh.position.copy(old.position); mesh.quaternion.copy(old.quaternion); mesh.scale.copy(old.scale);
      mesh.visible = old.visible; mesh.castShadow = mesh.receiveShadow = true;
      replacements.push({old:old, mesh:mesh, groupIndex:batch.groupIndex});
      state.groups++;
      state.triangles += count / 3;
    });
    // Material/tower buckets keep the expanded per-instance atlas under 70 draw calls.
    var buckets = new Map();
    replacements.forEach(function(item){
      var key = item.mesh.material.uuid + '|' + item.mesh.userData.tower;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(item);
    });
    buckets.forEach(function(items){
      var first = items[0], mergedMesh = first.mesh;
      if (items.length > 1) {
        var combined = new T.BufferGeometry(), attributes = first.mesh.geometry.attributes;
        Object.keys(attributes).forEach(function(name){
          var sourceAttribute = attributes[name], length = 0;
          items.forEach(function(item){length += item.mesh.geometry.attributes[name].array.length;});
          var array = new Float32Array(length), offset = 0;
          items.forEach(function(item){
            var values = item.mesh.geometry.attributes[name].array;
            array.set(values, offset); offset += values.length;
          });
          combined.setAttribute(name, new T.BufferAttribute(array, sourceAttribute.itemSize));
        });
        combined.computeBoundingBox(); combined.computeBoundingSphere();
        mergedMesh = new T.Mesh(combined, first.mesh.material);
        mergedMesh.name = 'LIV / ' + first.mesh.material.name + ' / torre ' + first.mesh.userData.tower;
        mergedMesh.userData = Object.assign({}, first.mesh.userData, {livFloorRanges:[],
          livGroupIndices:items.map(function(item){return item.groupIndex;})});
        var vertexOffset = 0;
        items.forEach(function(item){
          item.mesh.userData.livFloorRanges.forEach(function(range){
            mergedMesh.userData.livFloorRanges.push(Object.assign({}, range,
              {start:range.start + vertexOffset, groupIndex:item.groupIndex}));
          });
          vertexOffset += item.mesh.geometry.attributes.position.count;
          item.mesh.geometry.dispose();
        });
        mergedMesh.position.copy(first.mesh.position);
        mergedMesh.quaternion.copy(first.mesh.quaternion);
        mergedMesh.scale.copy(first.mesh.scale);
        mergedMesh.visible = first.mesh.visible;
        mergedMesh.castShadow = mergedMesh.receiveShadow = true;
      }
      first.old.parent.add(mergedMesh);
      items.forEach(function(item){
        item.old.parent.remove(item.old);
        if (options.onReplace) options.onReplace(item.old, mergedMesh, item.groupIndex);
      });
    });
    state.drawCalls = buckets.size;
    state.sourceSHA256 = sourceHash;
    state.texture = texture;
    state.ready = true;
    if (options.onReady) options.onReady(state, manifest);
    return state;
  } catch (error) {
    state.error = String(error);
    console.error('LIV lightmap:', error);
    throw error;
  }
}
