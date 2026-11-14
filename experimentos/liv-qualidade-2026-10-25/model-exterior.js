// Geometria complementar medida na maquete: nenhuma posição de implantação é criada.
export function upgradeExterior({ THREE, scene }) {
  scene.updateMatrixWorld(true);
  const group = new THREE.Group();
  group.name = 'LIV · geometria detalhada de vegetação e piscinas';
  group.userData.livModelUpgrade = 'exterior';
  group.visible = false;
  const owned = new Set(), replaced = new Map(), sourceObjects = [];
  const inverseScene = scene.matrixWorld.clone().invert();
  const metrics = { canopyVolumes: 0, trees: 0, palms: 0, leafSprays: 0, leaves: 0,
    branchSegments: 0, pools: 0, triangles: 0, drawCalls: 0, sourceFootprintsPreserved: true };
  let disposed = false;
  const own = resource => { owned.add(resource); return resource; };
  scene.traverse(object => { if (object.isMesh && !object.userData.livModelUpgrade) sourceObjects.push(object); });
  const materialName = object => Array.isArray(object.material) ? '' : object.material?.name || '';
  function sourceMatrix(object, index = 0) {
    const matrix = new THREE.Matrix4().multiplyMatrices(inverseScene, object.matrixWorld);
    if (object.isInstancedMesh) {
      const instance = new THREE.Matrix4(); object.getMatrixAt(index, instance); matrix.multiply(instance);
    }
    return matrix;
  }
  function replace(object) { if (!replaced.has(object)) replaced.set(object, object.visible); }
  function addMesh(geometry, material, name, matrix) {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true;
    if (matrix) { mesh.matrix.copy(matrix); mesh.matrixAutoUpdate = false; }
    group.add(mesh); return mesh;
  }
  function addInstances(geometry, material, transforms, colors, name) {
    if (!transforms.length) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, transforms.length); mesh.name = name;
    transforms.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    colors?.forEach((color, index) => mesh.setColorAt(index, color));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh;
  }
  function random(seed) {
    let state = seed >>> 0;
    return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  }
  function texture(size, pixel) {
    const bytes = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const value = pixel(x / size, y / size, x, y), offset = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) bytes[offset + c] = Math.max(0, Math.min(255, value[c]));
      bytes[offset + 3] = 255;
    }
    const map = own(new THREE.DataTexture(bytes, size, size));
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.generateMipmaps = true; map.minFilter = THREE.LinearMipmapLinearFilter;
    map.needsUpdate = true; return map;
  }
  const leafMap = texture(128, (u, v) => {
    const midrib = Math.exp(-Math.abs(u - .5) * 100);
    const veins = Math.exp(-Math.abs(Math.sin((v * 15 + Math.abs(u - .5) * 9) * Math.PI)) * 32);
    const edge = Math.abs(u - .5) * .24;
    const value = 1 - edge + midrib * .18 + veins * .09;
    return [172 * value, 202 * value, 130 * value];
  });
  leafMap.colorSpace = THREE.SRGBColorSpace;
  const barkMap = texture(128, (u, v) => {
    const ridge = Math.sin(u * 190 + Math.sin(v * 18) * .8) * .5 + .5;
    const cracks = Math.pow(Math.sin(u * 31 + Math.sin(v * 30) * .15), 16);
    return [95 + ridge * 35 - cracks * 29, 76 + ridge * 28 - cracks * 22, 55 + ridge * 18 - cracks * 17];
  });
  barkMap.colorSpace = THREE.SRGBColorSpace;
  const barkBump = texture(128, (u, v) => {
    const height = 115 + 55 * Math.sin(u * 190 + Math.sin(v * 18) * .8);
    return [height, height, height];
  });
  const foliage = own(new THREE.MeshStandardMaterial({ name: 'LIV folhagem · folhas curvas e nervuras',
    color: 0xffffff, map: leafMap, side: THREE.DoubleSide, roughness: .79,
    metalness: 0, envMapIntensity: .55 }));
  const bark = own(new THREE.MeshStandardMaterial({ name: 'LIV troncos · casca estriada',
    color: 0xd7c3a2, map: barkMap, bumpMap: barkBump, bumpScale: .025, roughness: .93 }));

  function meshBuilder() {
    const positions = [], uvs = [], colors = [], indices = [];
    return {
      vertex(point, u, v, color = [1, 1, 1]) {
        const index = positions.length / 3; positions.push(point.x, point.y, point.z);
        uvs.push(u, v); colors.push(...color); return index;
      },
      triangle(a, b, c) { indices.push(a, b, c); },
      geometry() {
        const geometry = own(new THREE.BufferGeometry());
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices); geometry.computeVertexNormals();
        geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
      },
    };
  }
  function appendLeaf(builder, origin, direction, width, length, color, twist = 0) {
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), twist));
    const rows = [];
    for (let j = 0; j < 4; j++) {
      const t = j / 3, spread = Math.sin(t * Math.PI) * width;
      const row = [];
      for (const side of [-1, 0, 1]) {
        const point = new THREE.Vector3(side * spread, t * length,
          Math.sin(t * Math.PI) * length * (.13 - Math.abs(side) * .13) - t * t * length * .12);
        point.applyQuaternion(rotation).add(origin);
        row.push(builder.vertex(point, (side + 1) / 2, t, color));
      }
      rows.push(row);
    }
    // Pontas têm largura zero; não geramos os seis triângulos degenerados.
    builder.triangle(rows[0][1], rows[1][0], rows[1][1]);
    builder.triangle(rows[0][1], rows[1][1], rows[1][2]);
    for (let side = 0; side < 2; side++) {
      builder.triangle(rows[1][side], rows[2][side], rows[2][side + 1]);
      builder.triangle(rows[1][side], rows[2][side + 1], rows[1][side + 1]);
    }
    builder.triangle(rows[2][0], rows[3][1], rows[2][1]);
    builder.triangle(rows[2][1], rows[3][1], rows[2][2]);
  }
  function appendStem(builder, from, to, radius, color) {
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    const ring = [];
    for (let side = 0; side < 3; side++) {
      const angle = side * Math.PI * 2 / 3;
      ring.push(builder.vertex(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
        .applyQuaternion(rotation).add(from), .5, 0, color));
    }
    const tip = builder.vertex(to, .5, 1, color);
    for (let side = 0; side < 3; side++) builder.triangle(ring[side], tip, ring[(side + 1) % 3]);
    builder.triangle(ring[0], ring[1], ring[2]);
  }
  const sprayBuilder = meshBuilder();
  appendStem(sprayBuilder, new THREE.Vector3(0, -.24, 0), new THREE.Vector3(0, .3, .035), .012, [.36, .4, .2]);
  for (let leaf = 0; leaf < 7; leaf++) {
    const t = leaf / 7, side = leaf % 2 ? 1 : -1;
    appendLeaf(sprayBuilder, new THREE.Vector3(0, -.22 + t * .43, Math.sin(t * 2) * .03),
      new THREE.Vector3(side * .8, .6, Math.sin(leaf * 2.7) * .35), .095,
      .32 + Math.sin(leaf * 1.7) * .045, [.88 + t * .12, .94 + t * .06, .83 + t * .12], side * .35);
  }
  const sprayGeometry = sprayBuilder.geometry();
  foliage.vertexColors = true;
  const sprayRadius = sprayGeometry.boundingSphere.radius + sprayGeometry.boundingSphere.center.length();
  const canopySources = sourceObjects.filter(object => object.isInstancedMesh &&
    /^MAT-site-folha-(media|escura|clara)$/.test(materialName(object)) && object.count > 10);
  const canopyLobes = [], leafTransforms = [], leafColors = [];
  const direction = new THREE.Vector3(), position = new THREE.Vector3(), scale = new THREE.Vector3();
  for (let sourceIndex = 0; sourceIndex < canopySources.length; sourceIndex++) {
    const object = canopySources[sourceIndex], sourceColor = object.material.color.clone(); replace(object);
    for (let index = 0; index < object.count; index++) {
      const matrix = sourceMatrix(object, index), seed = random(461 + sourceIndex * 10391 + index * 733);
      matrix.decompose(position, new THREE.Quaternion(), scale);
      const small = Math.max(scale.x, scale.y, scale.z) < .7, count = small ? 22 : 40;
      canopyLobes.push({ matrix, center: position.clone(), radius: Math.max(scale.x, scale.y, scale.z) });
      for (let leaf = 0; leaf < count; leaf++) {
        const azimuth = seed() * Math.PI * 2, vertical = seed() * 2 - 1;
        const radial = Math.sqrt(1 - vertical * vertical), extent = .54 * Math.pow(seed(), .36);
        direction.set(radial * Math.cos(azimuth), vertical, radial * Math.sin(azimuth));
        const center = direction.clone().multiplyScalar(extent);
        const size = (.31 + seed() * .12) / sprayRadius;
        const orientation = new THREE.Quaternion().setFromEuler(new THREE.Euler(seed() * 6.28, seed() * 6.28, seed() * 6.28));
        const local = new THREE.Matrix4().compose(center, orientation, new THREE.Vector3(size, size, size));
        // Cada spray inteiro fica dentro do volume da copa medida na fonte.
        local.premultiply(new THREE.Matrix4().makeScale(.93, .99, .99));
        leafTransforms.push(matrix.clone().multiply(local));
        const tint = sourceColor.clone().lerp(new THREE.Color('#567d38'), .35);
        tint.multiplyScalar(.82 + seed() * .36); leafColors.push(tint);
      }
      metrics.canopyVolumes++;
    }
  }
  metrics.leafSprays = leafTransforms.length; metrics.leaves = metrics.leafSprays * 7;
  addInstances(sprayGeometry, foliage, leafTransforms, leafColors, 'Folhas · copas e arbustos com ramagem aparente');

  const branches = [], branchColors = [], branchGeometry = own(new THREE.CylinderGeometry(.7, 1, 1, 9, 1));
  const yAxis = new THREE.Vector3(0, 1, 0);
  function branch(a, b, radius, brightness = 1) {
    const axis = b.clone().sub(a), length = axis.length(); if (length < .015) return;
    branches.push(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),
      new THREE.Quaternion().setFromUnitVectors(yAxis, axis.normalize()), new THREE.Vector3(radius, length, radius)));
    branchColors.push(new THREE.Color().setScalar(brightness));
  }
  const trunks = [];
  for (const object of sourceObjects.filter(object => materialName(object) === 'MAT-site-tronco')) {
    const points = object.geometry.getAttribute('position'), index = object.geometry.index;
    const transform = sourceMatrix(object), ranges = object.userData.livFloorRanges || [];
    if (!ranges.length) continue;
    replace(object);
    for (const range of ranges) {
      const box = new THREE.Box3();
      for (let offset = range.start; offset < range.start + range.count; offset++) {
        const vertex = index ? index.getX(offset) : offset;
        box.expandByPoint(new THREE.Vector3().fromBufferAttribute(points, vertex).applyMatrix4(transform));
      }
      if (box.isEmpty()) continue;
      const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
      const root = new THREE.Vector3(center.x, box.min.y, center.z), top = new THREE.Vector3(center.x, box.max.y, center.z);
      const radius = Math.min(size.x, size.z) * .43;
      const seed = random(5791 + trunks.length * 137), lean = new THREE.Vector3((seed() - .5) * radius, 0, (seed() - .5) * radius);
      let last = root;
      for (let segment = 1; segment <= 6; segment++) {
        const t = segment / 6, next = root.clone().lerp(top, t).addScaledVector(lean, Math.sin(t * Math.PI));
        branch(last, next, radius * (1 - t * .38), .88 + seed() * .2); last = next;
      }
      trunks.push({ root, top, radius });
    }
  }
  for (const lobe of canopyLobes) {
    if (lobe.center.y < 1.5 || !trunks.length) continue;
    const trunk = trunks.reduce((best, candidate) => {
      const score = candidate.top.distanceToSquared(lobe.center);
      return !best || score < best.score ? { trunk: candidate, score } : best;
    }, null).trunk;
    if (trunk.top.distanceTo(lobe.center) > lobe.radius * 2.3) continue;
    const fork = trunk.root.clone().lerp(trunk.top, .82);
    const end = lobe.center.clone().lerp(trunk.top, .18), elbow = fork.clone().lerp(end, .58);
    elbow.y += .16; branch(fork, elbow, trunk.radius * .43); branch(elbow, end, trunk.radius * .24);
    for (let twig = 0; twig < 3; twig++) {
      const angle = twig * Math.PI * 2 / 3 + lobe.center.x;
      const tip = lobe.center.clone().add(new THREE.Vector3(Math.cos(angle) * lobe.radius * .45,
        .15 + twig * .1, Math.sin(angle) * lobe.radius * .45));
      branch(end, tip, Math.max(.012, trunk.radius * .12), .9);
    }
  }
  metrics.trees = trunks.length; metrics.branchSegments = branches.length;
  addInstances(branchGeometry, bark, branches, branchColors, 'Troncos e bifurcações · casca em relevo');

  const palmSources = sourceObjects.filter(object => object.isInstancedMesh && materialName(object) === 'MAT-site-palmeira');
  if (palmSources.length) {
    const palmBuilder = meshBuilder(), fronds = 14;
    for (let frond = 0; frond < fronds; frond++) {
      const theta = frond * 2.39996323, tier = frond / fronds;
      const length = 2.6 + Math.sin(frond * 4.1) * .35;
      let last = new THREE.Vector3();
      for (let segment = 1; segment <= 10; segment++) {
        const t = segment / 10, height = Math.sin(t * Math.PI) * (.38 + tier * .36) - t * t * (.5 + tier * .3);
        const next = new THREE.Vector3(Math.cos(theta) * t * length, height, Math.sin(theta) * t * length);
        appendStem(palmBuilder, last, next, .025 * (1 - t * .7), [.56, .62, .24]); last = next;
      }
      for (let leaflet = 0; leaflet < 23; leaflet++) {
        const t = .12 + leaflet / 23 * .86, distance = t * length;
        const height = Math.sin(t * Math.PI) * (.38 + tier * .36) - t * t * (.5 + tier * .3);
        const base = new THREE.Vector3(Math.cos(theta) * distance, height, Math.sin(theta) * distance);
        for (const side of [-1, 1]) {
          const angle = theta + side * (1.02 - t * .2);
          appendLeaf(palmBuilder, base, new THREE.Vector3(Math.cos(angle), -.28 - t * .55, Math.sin(angle)),
            .029 + Math.sin(t * Math.PI) * .028, .12 + Math.sin(t * Math.PI) * .66,
            [.66 + t * .23, .78 + t * .2, .58 + t * .15], side * .45);
        }
      }
    }
    const geometry = palmBuilder.geometry(), transforms = [], colors = [];
    const target = new THREE.Box3().setFromBufferAttribute(palmSources[0].geometry.getAttribute('position'));
    const current = geometry.boundingBox;
    const sourceSize = current.getSize(new THREE.Vector3()), targetSize = target.getSize(new THREE.Vector3());
    const oldCenter = current.getCenter(new THREE.Vector3()), newCenter = target.getCenter(new THREE.Vector3());
    geometry.translate(-oldCenter.x, -oldCenter.y, -oldCenter.z);
    geometry.scale(targetSize.x / sourceSize.x, targetSize.y / sourceSize.y, targetSize.z / sourceSize.z);
    geometry.translate(newCenter.x, newCenter.y, newCenter.z);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const palmMaterial = own(foliage.clone()); palmMaterial.name = 'LIV palmeiras · folíolos pinados';
    for (const object of palmSources) {
      replace(object);
      for (let i = 0; i < object.count; i++) {
        transforms.push(sourceMatrix(object, i)); colors.push(new THREE.Color('#3f642b'));
        metrics.palms++; metrics.leaves += fronds * 23 * 2;
      }
    }
    addInstances(geometry, palmMaterial, transforms, colors, 'Palmeiras · frondes com folíolos individuais');
  }

  const normalMap = texture(128, (u, v) => {
    const x = u * Math.PI * 2, z = v * Math.PI * 2;
    const dx = .17 * Math.cos(x * 4 + z * 3) + .1 * Math.cos(x * 9 - z * 7);
    const dz = .16 * Math.cos(x * 4 + z * 3) - .08 * Math.cos(x * 9 - z * 7);
    const normal = new THREE.Vector3(-dx, -dz, 1).normalize();
    return [(normal.x * .5 + .5) * 255, (normal.y * .5 + .5) * 255, (normal.z * .5 + .5) * 255];
  });
  const waterSources = sourceObjects.filter(object => /^MAT-site-(agua|infantil)$/.test(materialName(object)));
  for (const object of waterSources) {
    const box = new THREE.Box3().setFromBufferAttribute(object.geometry.getAttribute('position'));
    if (!box || box.max.y - box.min.y > .1) continue;
    replace(object);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const geometry = own(new THREE.PlaneGeometry(size.x, size.z, 72, 32));
    geometry.rotateX(-Math.PI / 2); geometry.translate(center.x, box.max.y + .004, center.z);
    const attribute = geometry.getAttribute('position');
    for (let vertex = 0; vertex < attribute.count; vertex++) {
      const x = attribute.getX(vertex) - box.min.x, z = attribute.getZ(vertex) - box.min.z;
      const edge = Math.sin(x / size.x * Math.PI) * Math.sin(z / size.z * Math.PI);
      attribute.setY(vertex, attribute.getY(vertex) + edge * (.007 * Math.sin(x * 4.1 + z * 2.5) + .004 * Math.cos(z * 6 - x)));
    }
    attribute.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const normal = own(normalMap.clone()); normal.repeat.set(size.x / 3, size.z / 3); normal.needsUpdate = true;
    const material = own(new THREE.MeshPhysicalMaterial({ name: 'LIV água · reflexão Fresnel e ondulação',
      color: '#79bbbf', metalness: 0, roughness: .13, clearcoat: 1, clearcoatRoughness: .1,
      ior: 1.333, transmission: .28, thickness: .045, attenuationColor: '#298591', attenuationDistance: 1.8,
      normalMap: normal, normalScale: new THREE.Vector2(.32, .32), envMapIntensity: 1.2 }));
    const tileMap = texture(256, (u, v) => {
      const x = u * size.x, z = v * size.z, tx = x / .18, tz = z / .18;
      const grout = tx % 1 < .032 || tz % 1 < .032;
      const caustic = Math.pow(Math.max(0, Math.cos(x * 4.1 + Math.sin(z * 3.3) * 1.7)
        * Math.sin(z * 5.1 + Math.cos(x * 2.7))), 12) * 72;
      const shade = Math.sin(Math.floor(tx) * 67 + Math.floor(tz) * 13) * 9;
      return grout ? [99, 156, 157] : [50 + caustic * .6 + shade, 138 + caustic + shade, 151 + caustic + shade];
    });
    tileMap.colorSpace = THREE.SRGBColorSpace; tileMap.wrapS = tileMap.wrapT = THREE.ClampToEdgeWrapping;
    const bottom = own(new THREE.PlaneGeometry(size.x, size.z));
    bottom.rotateX(-Math.PI / 2); bottom.translate(center.x, box.min.y + .003, center.z);
    const floorMaterial = own(new THREE.MeshStandardMaterial({ name: 'LIV piscina · mosaico e cáusticas',
      color: 0xffffff, map: tileMap, roughness: .38 }));
    const count = object.isInstancedMesh ? object.count : 1;
    for (let i = 0; i < count; i++) {
      const matrix = sourceMatrix(object, i);
      const floor = addMesh(bottom, floorMaterial, 'Piscina · mosaico sob água', matrix); floor.castShadow = false;
      const surface = addMesh(geometry, material, 'Piscina · lâmina com ondulações geométricas', matrix); surface.castShadow = false;
      surface.onBeforeRender = () => { if (!disposed) normal.offset.set(performance.now() * .000004, performance.now() * -.000003); };
      metrics.pools++;
    }
  }
  group.traverse(object => {
    if (!object.isMesh) return;
    object.userData.livModelUpgrade = 'exterior';
    const triangles = (object.geometry.index?.count || object.geometry.getAttribute('position').count) / 3;
    metrics.triangles += triangles * (object.isInstancedMesh ? object.count : 1); metrics.drawCalls++;
  });
  group.userData.modelMetrics = metrics; scene.add(group);
  return {
    metrics,
    setEnabled(value) {
      if (disposed) return;
      const enabled = Boolean(value); group.visible = enabled;
      for (const [object, visible] of replaced) object.visible = enabled ? false : visible;
    },
    dispose() {
      if (disposed) return; disposed = true;
      for (const [object, visible] of replaced) object.visible = visible;
      group.removeFromParent();
      group.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
      for (const resource of owned) resource.dispose(); owned.clear();
    },
  };
}
