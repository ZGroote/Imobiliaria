/* LIV Ipanema completo no mapa. Reusa o GLB canônico; não recalcula a maquete.
 * Compatível com THREE r128. Unidades glTF/metas: metros, Y para cima.
 */
(function (global) {
  'use strict';

  // Contorno de modelar_implantacao.py: xy(u,v)=((432-v)*.145,(u-315)*.145).
  // A origem é o centro da torre, preservando seu vínculo com a implantação.
  var footprint = [
    [51.04, -39.585], [51.04, 27.985], [43.5, 35.525],
    [-36.54, 49.445], [-36.54, -39.15]
  ];

  function create(options) {
    options = options || {};
    var T = options.THREE, source = options.loadedScene;
    if (!T || !source || !source.isObject3D) {
      throw Error('LivMapModel requer THREE e loadedScene do GLTFLoader.');
    }
    var center = options.center || [0, 0];
    var terrainY = options.terrainY == null ? 0 : options.terrainY;
    var rotation = options.rotation == null ? 0 : options.rotation;
    if (center.length !== 2 || !center.concat([terrainY, rotation]).every(Number.isFinite)) {
      throw Error('Posição e giro do LIV devem ser números finitos.');
    }
    source.updateMatrixWorld(true);
    var rootInverse = new T.Matrix4().copy(source.matrixWorld).invert();
    var batches = new Map(), fallbacks = [], boundsLocal = new T.Box3();
    var sourceMeshes = 0, triangles = 0, sourceInstances = 0;

    function isVisible(mesh) {
      for (var node = mesh; node; node = node.parent) {
        if (!node.visible) return false;
        if (node === source) break;
      }
      return true;
    }
    function addBounds(geometry, matrix) {
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      boundsLocal.union(geometry.boundingBox.clone().applyMatrix4(matrix));
    }
    function triangleCount(geometry) {
      var count = geometry.index ? geometry.index.count : geometry.attributes.position.count;
      var range = geometry.drawRange || {};
      return Math.max(0, Math.min(count - (range.start || 0), range.count || Infinity)) / 3;
    }
    source.traverse(function (mesh) {
      if (!mesh.isMesh || !isVisible(mesh)) return;
      sourceMeshes++;
      var geometry = mesh.geometry;
      var material = mesh.material;
      var matrix = new T.Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld);
      // O GLB do LIV é estático. Casos que InstancedMesh não representa com
      // fidelidade ficam explícitos, mantendo seu objeto e transformação.
      if (mesh.isSkinnedMesh || mesh.morphTargetInfluences || matrix.determinant() < 0) {
        var cloned = mesh.clone(false);
        cloned.matrix.copy(matrix);
        cloned.matrixAutoUpdate = false;
        fallbacks.push(cloned);
        addBounds(geometry, matrix);
        triangles += triangleCount(geometry);
        sourceInstances++;
        return;
      }
      var materials = Array.isArray(material) ? material : [material];
      var key = geometry.uuid + '|' + materials.map(function (m) { return m.uuid; }).join(',')
        + '|' + (mesh.renderOrder || 0);
      var batch = batches.get(key);
      if (!batch) {
        batch = {geometry: geometry, material: material, matrices: [], names: [],
          renderOrder: mesh.renderOrder || 0};
        batches.set(key, batch);
      }
      if (mesh.isInstancedMesh) {
        // Suporta também uma futura exportação glTF com GPU instancing.
        for (var i = 0; i < mesh.count; i++) {
          var instance = new T.Matrix4();
          mesh.getMatrixAt(i, instance);
          var composed = new T.Matrix4().multiplyMatrices(matrix, instance);
          batch.matrices.push(composed);
          batch.names.push(mesh.name + ' / ' + i);
          addBounds(geometry, composed);
          triangles += triangleCount(geometry);
          sourceInstances++;
        }
      } else {
        batch.matrices.push(matrix);
        batch.names.push(mesh.name);
        addBounds(geometry, matrix);
        triangles += triangleCount(geometry);
        sourceInstances++;
      }
    });
    if (!sourceMeshes || boundsLocal.isEmpty()) throw Error('GLB do LIV não contém malhas visíveis.');

    var object = new T.Group();
    object.name = 'LIV Ipanema / torre e implantação';
    object.position.set(center[0], terrainY, center[1]);
    object.rotation.y = rotation;
    object.userData.livIpanema = true;
    object.userData.propertyId = 'liv-ipanema';
    var drawCalls = 0;
    batches.forEach(function (batch) {
      var mesh = new T.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
      mesh.name = 'LIV / ' + batch.geometry.name + ' / ' + batch.matrices.length;
      batch.matrices.forEach(function (matrix, i) { mesh.setMatrixAt(i, matrix); });
      mesh.instanceMatrix.setUsage(T.StaticDrawUsage);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = mesh.receiveShadow = true;
      // r128 culls pelo bounds da geometria original, sem abranger instâncias.
      // Esta maquete é um único marco, portanto manter seus batches visíveis
      // evita perder árvores/torre ao aproximar ou girar a câmera.
      mesh.frustumCulled = false;
      mesh.renderOrder = batch.renderOrder;
      mesh.userData.livIpanema = true;
      mesh.userData.propertyId = 'liv-ipanema';
      mesh.userData.sourceNames = batch.names;
      object.add(mesh);
      drawCalls += Array.isArray(batch.material)
        ? Math.max(1, batch.geometry.groups.length) : 1;
    });
    fallbacks.forEach(function (mesh) {
      mesh.userData.livIpanema = true;
      mesh.userData.propertyId = 'liv-ipanema';
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      object.add(mesh);
      drawCalls += Array.isArray(mesh.material) ? Math.max(1, mesh.geometry.groups.length) : 1;
    });
    if (options.scene) options.scene.add(object);
    object.updateMatrixWorld(true);
    var boundsWorld = boundsLocal.clone().applyMatrix4(object.matrixWorld);
    var footprintLocal = footprint.map(function (p) { return [p[0], p[1]]; });
    var footprintWorld = footprint.map(function (p) {
      var v = new T.Vector3(p[0], 0, p[1]).applyMatrix4(object.matrixWorld);
      return [v.x, v.y, v.z];
    });
    var metadata = {
      sourceMeshes: sourceMeshes, sourceInstances: sourceInstances,
      instancedBatches: batches.size, fallbackMeshes: fallbacks.length,
      estimatedDrawCalls: drawCalls, triangles: triangles,
      units: 'meters', anchor: 'tower-origin', floorLocalY: 0,
      terrainY: terrainY, rotationRadians: rotation,
      dimensionsInferred: true, lighting: 'map-lights',
      boundsLocal: {min: boundsLocal.min.toArray(), max: boundsLocal.max.toArray()},
      boundsWorld: {min: boundsWorld.min.toArray(), max: boundsWorld.max.toArray()}
    };
    object.userData.livModel = metadata;
    return {
      object: object, metadata: metadata,
      boundsLocal: boundsLocal, boundsWorld: boundsWorld,
      footprintLocal: footprintLocal, footprintWorld: footprintWorld,
      updateY: function (nextFloorY) {
        if (!Number.isFinite(nextFloorY)) throw Error('Altura do LIV deve ser finita.');
        if (object.position.y === nextFloorY) return false;
        var delta = nextFloorY - object.position.y;
        object.position.y = nextFloorY;
        metadata.terrainY = nextFloorY;
        boundsWorld.min.y += delta;
        boundsWorld.max.y += delta;
        footprintWorld.forEach(function (p) { p[1] += delta; });
        metadata.boundsWorld.min[1] += delta;
        metadata.boundsWorld.max[1] += delta;
        return true;
      },
      // Materiais e geometrias são compartilhados com loadedScene. Não os
      // destruir aqui: o chamador continua sendo dono do GLB carregado.
      dispose: function () {
        if (object.parent) object.parent.remove(object);
        object.traverse(function (child) {
          if (child.isInstancedMesh && typeof child.dispose === 'function') child.dispose();
        });
      }
    };
  }

  global.LivMapModel = {create: create};
})(typeof window === 'undefined' ? globalThis : window);
