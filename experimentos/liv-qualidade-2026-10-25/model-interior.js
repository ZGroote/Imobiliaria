import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createPBRSet } from './materials-pbr.js';

// Each replacement stays inside the original furniture's local footprint.
// The unit, walls, openings and circulation therefore keep their dimensions.
export function upgradeInterior({ THREE, scene, layout }) {
  const root = new THREE.Group(); root.name = 'mobiliario-estudo-detalhado'; root.visible = false;
  const geometries = new Set(), materials = new Set(), cache = new Map(), originals = new Map();
  const pbr = { wood: createPBRSet(THREE, 'wood'), fabric: createPBRSet(THREE, 'fabric') };
  const metrics = { replacements: 0, meshes: 0, triangles: 0, placementChecks: [], enabled: false, disposed: false };
  let disposed = false;
  const ownGeometry = geometry => { geometries.add(geometry); return geometry; };
  function material(color, type = 'fabric', extra = {}) {
    const maps = pbr[type];
    const value = new THREE.MeshPhysicalMaterial({ color, roughness: type === 'wood' ? .48 : .92,
      ...(maps ? { map: maps.map, normalMap: maps.normalMap, roughnessMap: maps.roughnessMap,
        normalScale: new THREE.Vector2(type === 'wood' ? .11 : .24, type === 'wood' ? .11 : .24) } : {}),
      ...(type === 'fabric' ? { sheen: .32, sheenRoughness: .9, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), .4) }
        : type === 'wood' ? { clearcoat: .18, clearcoatRoughness: .5 } : {}), ...extra });
    materials.add(value); return value;
  }
  const oak = material('#aa8359', 'wood'), oakDark = material('#65513e', 'wood');
  const linen = material('#ede6da'), mattress = material('#f8f3e9');
  const seam = material('#cdc4b6'), feet = material('#4a4540', null, { roughness: .3, metalness: .62 });
  const sofaFabric = material('#b8b7ac'), sage = material('#7f9a8b'), sand = material('#c3a889');
  const ceramics = material('#d8d0c1', null, { roughness: .31, clearcoat: .25 });

  function metricUV(geometry, density = 1) {
    const p = geometry.attributes.position, n = geometry.attributes.normal, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
      uv[2 * i] = (nx > nz && nx > ny ? p.getZ(i) : p.getX(i)) * density;
      uv[2 * i + 1] = (ny >= nx && ny >= nz ? p.getZ(i) : p.getY(i)) * density;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geometry;
  }
  function rounded(w, h, d, radius, segments = 3) {
    const key = [w, h, d, radius, segments].join(':');
    if (!cache.has(key)) cache.set(key, ownGeometry(metricUV(new RoundedBoxGeometry(w, h, d, segments, radius))));
    return cache.get(key);
  }
  function mesh(group, geometry, mat, x = 0, y = 0, z = 0) {
    const value = new THREE.Mesh(geometry, mat); value.position.set(x, y, z);
    value.castShadow = value.receiveShadow = true; group.add(value); return value;
  }
  const box = (group, w, h, d, radius, mat, x = 0, y = 0, z = 0) => mesh(group, rounded(w, h, d, radius), mat, x, y, z);
  function beam(group, from, to, radius, mat, endRadius = radius) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), delta = b.clone().sub(a);
    const geometry = ownGeometry(new THREE.CylinderGeometry(endRadius, radius, delta.length(), 10));
    const value = mesh(group, geometry, mat); value.position.copy(a.add(b).multiplyScalar(.5));
    value.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return value;
  }
  function piping(group, w, d, y, radius, mat, z = 0, x = 0) {
    const points = [], edge = Math.min(.07, w / 5, d / 5);
    for (const [cx, cz, start] of [[w / 2 - edge, d / 2 - edge, 0], [-w / 2 + edge, d / 2 - edge, Math.PI / 2],
      [-w / 2 + edge, -d / 2 + edge, Math.PI], [w / 2 - edge, -d / 2 + edge, Math.PI * 1.5]]) {
      for (let i = 0; i <= 6; i++) {
        const angle = start + i / 6 * Math.PI / 2;
        points.push(new THREE.Vector3(x + cx + Math.cos(angle) * edge, y, z + cz + Math.sin(angle) * edge));
      }
    }
    const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
    return mesh(group, ownGeometry(new THREE.TubeGeometry(curve, 88, radius, 5, true)), mat);
  }
  function cloth(group, w, h, d, mat, x, y, z, phase = 0) {
    const geometry = ownGeometry(metricUV(new RoundedBoxGeometry(w, h, d, 8, Math.min(.065, h * .46))));
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const px = positions.getX(i), py = positions.getY(i), pz = positions.getZ(i);
      const top = Math.max(0, Math.min(1, (py / h + .5) * 2));
      // Woven cloth has long folds at the edge and smaller creases over the top.
      const fold = Math.sin(px * 19 + pz * 5 + phase) * .008 + Math.sin(pz * 24 - px * 4) * .004;
      const edge = (Math.abs(px) / (w / 2)) ** 5;
      positions.setY(i, py + top * (fold * (.35 + edge) + .005 * Math.cos(px * 8)));
    }
    geometry.computeVertexNormals(); return mesh(group, geometry, mat, x, y, z);
  }
  function bed(group, item) {
    const { w, h, d } = item;
    const bedColor = material(new THREE.Color(item.cor || '#95aa9b').lerp(new THREE.Color('#829586'), .3));
    for (const x of [-w * .38, w * .38]) for (const z of [-d * .36, d * .36])
      beam(group, [x, .015, z], [x, .19, z], .027, oakDark, .025);
    box(group, w * .98, .17, d * .96, .035, oak, 0, .22, 0);
    box(group, w, h - .05, .085, .03, bedColor, 0, h / 2 + .015, -d / 2 + .045);
    // Narrow stitched channels make the headboard read as upholstered joinery.
    const channels = w > 1.2 ? 6 : 4;
    for (let i = 0; i < channels; i++) box(group, w / channels - .013, h * .55, .024, .011, bedColor,
      -w / 2 + w / channels * (i + .5), h * .68, -d / 2 + .091);
    box(group, w * .96, .22, d * .92, .075, mattress, 0, .405, d * .015);
    piping(group, w * .93, d * .89, .49, .0035, seam, d * .015);
    cloth(group, w * .95, .115, d * .72, linen, 0, .558, d * .13, .4);
    piping(group, w * .91, d * .69, .559, .003, seam, d * .13);
    const throwZ = d * .33;
    cloth(group, w * .965, .045, d * .19, bedColor, 0, .64, throwZ, 1.4);
    cloth(group, w * .965, .022, d * .045, bedColor, 0, .669, throwZ - d * .067, .9);
    const count = w > 1.2 ? 2 : 1, pillowW = count === 2 ? w * .42 : w * .73;
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? 0 : (i ? 1 : -1) * w * .245;
      const pillow = cloth(group, pillowW, .135, d * .22, mattress, x, .59, -d * .285, i + .8);
      pillow.rotation.y = (i ? -1 : 1) * .035;
      piping(group, pillowW * .94, d * .205, .59, .003, seam, -d * .285, x);
      const accent = cloth(group, pillowW * .57, .14, d * .13, bedColor, x, .63, -d * .17, i);
      accent.rotation.y = (i ? .09 : -.08);
    }
  }
  function sofa(group, { w, h, d }) {
    for (const x of [-w * .4, w * .4]) for (const z of [-d * .34, d * .34])
      beam(group, [x, .015, z], [x * .98, .145, z * .95], .022, feet, .018);
    box(group, w * .96, .20, d * .94, .055, sofaFabric, 0, .23, 0);
    box(group, w * .96, h * .63, d * .19, .05, sofaFabric, 0, h * .65, -d * .395);
    for (const x of [-1, 1]) box(group, w * .105, h * .6, d * .94, .045, sofaFabric, x * w * .437, h * .51, 0);
    const seatW = w * .755 / 2, seatD = d * .7;
    for (let i = 0; i < 2; i++) {
      const x = (i ? 1 : -1) * (seatW / 2 + .008);
      cloth(group, seatW, .16, seatD, sofaFabric, x, h * .49, d * .09, i);
      piping(group, seatW * .96, seatD * .96, h * .485, .0032, seam, d * .09, x);
      const back = cloth(group, seatW, h * .46, d * .18, sofaFabric, x, h * .745, -d * .245, i + 1);
      back.rotation.x = -.11;
    }
    for (const [sign, mat] of [[-1, sage], [1, sand]]) {
      const pillow = cloth(group, w * .16, h * .32, d * .18, mat, sign * w * .29, h * .68, d * .01, sign);
      pillow.rotation.z = -sign * .18; pillow.rotation.x = -.12;
    }
    // A folded throw includes an actual lip and sagging fabric, not a color patch.
    cloth(group, w * .25, .038, d * .60, linen, -w * .17, h * .61, d * .135, 2.1);
    const drape = cloth(group, w * .25, h * .27, .033, linen, -w * .17, h * .48, d * .452, 1.8);
    drape.rotation.z = .035;
  }
  function table(group, { w, h, d, nome = '' }) {
    const desk = /bancada/i.test(nome);
    box(group, w, .048, d, Math.min(.022, d / 12), oak, 0, h - .024, 0);
    box(group, w * .82, .055, d * .74, .009, oakDark, 0, h - .075, 0);
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      const top = [x * (w / 2 - .075), h - .075, z * (d / 2 - .065)];
      const foot = [x * (w / 2 - .035), .01, z * (d / 2 - .035)];
      beam(group, foot, top, .018, oak, .027);
    }
    if (desk) {
      box(group, .23, .022, Math.min(.17, d * .5), .004, sage, -w * .28, h + .012, 0);
      box(group, .225, .014, Math.min(.165, d * .49), .003, linen, -w * .28, h + .030, -.006);
    } else {
      // A low ceramic centrepiece remains inside the table, preserving circulation.
      const profile = [new THREE.Vector2(.048, 0), new THREE.Vector2(.075, .015), new THREE.Vector2(.087, .043),
        new THREE.Vector2(.083, .05), new THREE.Vector2(.066, .038), new THREE.Vector2(.035, .023), new THREE.Vector2(0, .022)];
      mesh(group, ownGeometry(new THREE.LatheGeometry(profile, 28)), ceramics, 0, h + .001, 0);
    }
  }
  function curvedBack(w, h, d) {
    const positions = [], indices = [], steps = 28;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps * 2 - 1, x = u * w * .44, z = -d * .36 + d * .16 * u * u;
      const y0 = h * .59 + .015 * u * u, y1 = h * .98 - .022 * u * u;
      positions.push(x, y0, z - .013, x, y1, z - .013, x, y0, z + .013, x, y1, z + .013);
      if (i < steps) {
        const a = i * 4, b = a + 4;
        indices.push(a, a + 1, b + 1, a, b + 1, b, a + 2, b + 3, a + 3, a + 2, b + 2, b + 3,
          a + 1, a + 3, b + 3, a + 1, b + 3, b + 1, a, b + 2, a + 2, a, b, b + 2);
      }
    }
    indices.push(0, 2, 3, 0, 3, 1);
    const e = steps * 4; indices.push(e, e + 3, e + 2, e, e + 1, e + 3);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); return ownGeometry(metricUV(geometry));
  }
  function chair(group, { w, h, d, nome = '' }) {
    const outdoor = /varanda/i.test(nome), mat = outdoor ? sage : linen;
    box(group, w * .94, .035, d * .87, .028, oak, 0, h * .49, d * .025);
    cloth(group, w * .89, .06, d * .82, mat, 0, h * .54, d * .03, .4);
    mesh(group, curvedBack(w, h, d), outdoor ? oak : mat);
    for (const x of [-1, 1]) for (const z of [-1, 1])
      beam(group, [x * w * .41, .01, z * d * .41], [x * w * .33, h * .49, z * d * .31], .012, oak, .019);
    for (const x of [-1, 1]) beam(group, [x * w * .34, h * .47, -d * .29], [x * w * .38, h * .84, -d * .26], .014, oak, .012);
  }

  const builders = { cama: bed, sofa, mesa: table, cadeira: chair };
  try {
    layout.unit.planta.moveis.forEach((item, i) => {
      const build = builders[item.tipo]; if (!build) return;
      const id = `movel-${i}`, found = [];
      scene.traverse(object => { if (object.isMesh && object.userData.furnitureId === id) found.push(object); });
      if (!found.length) return;
      if (![item.w, item.h, item.d, ...item.p].every(Number.isFinite) || Math.min(item.w, item.h, item.d) <= 0)
        throw Error(`Dimensões inválidas do móvel ${id}.`);
      const group = new THREE.Group(); group.name = `detalhado-${id}-${item.tipo}`;
      build(group, item); group.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(group), tolerance = .006;
      const placement = { id, kind: item.tipo, width: item.w, depth: item.d,
        bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
        insideFootprint: bounds.min.x >= -item.w / 2 - tolerance && bounds.max.x <= item.w / 2 + tolerance
          && bounds.min.z >= -item.d / 2 - tolerance && bounds.max.z <= item.d / 2 + tolerance,
        position: [item.p[0] - layout.center[0], .03, item.p[1] - layout.center[1]], rotation: (item.rot || 0) * Math.PI / 2 };
      metrics.placementChecks.push(placement);
      if (!placement.insideFootprint) throw Error(`Substituição ${id} saiu da área original.`);
      group.position.fromArray(placement.position); group.rotation.y = placement.rotation;
      group.traverse(object => {
        if (!object.isMesh) return;
        object.userData.furnitureId = id; object.userData.studioReplacement = true;
        metrics.meshes++; metrics.triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
      });
      for (const original of found) originals.set(original, original.visible);
      root.add(group); metrics.replacements++;
    });
    scene.add(root);
  } catch (error) { dispose(); throw error; }

  function setEnabled(enabled) {
    if (disposed) return;
    metrics.enabled = Boolean(enabled); root.visible = metrics.enabled;
    for (const [original, visible] of originals) original.visible = metrics.enabled ? false : visible;
  }
  function dispose() {
    if (disposed) return; disposed = true; metrics.disposed = true; metrics.enabled = false;
    for (const [original, visible] of originals) original.visible = visible;
    root.removeFromParent();
    for (const geometry of geometries) geometry.dispose();
    for (const value of materials) value.dispose();
    for (const value of Object.values(pbr)) value.dispose();
    geometries.clear(); materials.clear(); cache.clear(); originals.clear();
  }
  return { setEnabled, dispose, metrics };
}
