// Run with: node --test experimentos/mapa-liv-ipanema-5km-2026-10-08/test_liv_terreno.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {inflateRawSync} from 'node:zlib';
import vm from 'node:vm';
import test from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
// Exercise the same Three build embedded in the source map, without starting its app.
const snapshot = readFileSync(resolve(root,
  'v16-moveis/publicado/mapa/sao-carlos-exteriores-f16b0250b705.html'), 'utf8');
const tag = [...snapshot.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
  .find(match => /\bid="__three"/.test(match[1]));
assert.ok(tag, 'source map must include its Three library');
const threeSource = /data-zip=/.test(tag[1])
  ? inflateRawSync(Buffer.from(tag[2].trim(), 'base64')).toString('utf8') : tag[2];
const context = vm.createContext({console});
vm.runInContext(threeSource, context);
vm.runInContext(readFileSync(resolve(root, 'v1.5/renderizador-v16-moveis/terrain-fit.js'), 'utf8'), context);
vm.runInContext(readFileSync(resolve(here, 'liv-terreno.js'), 'utf8'), context);
const T = context.THREE;
const original = context.TerrainFit;

function patch(options = {}) {
  return context.LivTerrain.create({baseFit: original, center: [0, 0],
    rotation: -Math.PI / 3, transitionMeters: 12, stepMeters: 5, ...options});
}

function geometry(points, index = null) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(points.flatMap(([x, z]) =>
    [x, 3 + x * 0.025 - z * 0.05, z])), 3));
  g.setAttribute('uv', new T.BufferAttribute(new Float32Array(points.flatMap(([x, z]) =>
    [(x + 200) / 400, (z + 200) / 400])), 2));
  g.setAttribute('aVia', new T.BufferAttribute(new Uint8Array(points.length).fill(127), 1, true));
  g.setAttribute('color', new T.BufferAttribute(new Float32Array(points.flatMap(([x, z]) =>
    [0.5 + x / 1000, 0.5 + z / 1000, 0.75])), 3));
  g.userData.ground = true;
  if (index) g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function triangles(g) {
  const p = g.attributes.position, ids = g.index?.array;
  const result = [];
  for (let i = 0; i < (ids?.length ?? p.count); i += 3) {
    const triangle = [];
    for (let j = 0; j < 3; j++) {
      const k = ids ? ids[i + j] : i + j;
      triangle.push([p.array[k * 3], p.array[k * 3 + 2]]);
    }
    result.push(triangle);
  }
  return result;
}

function signedArea([a, b, c]) {
  return ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
}

function area(g) {
  return triangles(g).reduce((sum, triangle) => sum + Math.abs(signedArea(triangle)), 0);
}

function polygonArea(points) {
  return Math.abs(points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0)) / 2;
}

// Independent 2D intersection oracle: measure each output triangle against the footprint.
function intersection(subject, boundary) {
  let output = subject;
  for (let i = 0; i < boundary.length && output.length; i++) {
    const a = boundary[i], b = boundary[(i + 1) % boundary.length], input = output;
    output = [];
    const side = p => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    for (let j = 0; j < input.length; j++) {
      const p = input[j], q = input[(j + 1) % input.length], dp = side(p), dq = side(q);
      if (dp >= 0) output.push(p);
      if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) {
        const t = dp / (dp - dq);
        output.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return output;
}

function near(actual, expected, epsilon = 1e-5, message = '') {
  assert.ok(Math.abs(actual - expected) <= epsilon,
    `${message}: ${actual} differs from ${expected} by more than ${epsilon}`);
}

function finiteGeometry(g) {
  assert.equal(g.attributes.position.count % 3, 0);
  for (const [name, attribute] of Object.entries(g.attributes)) {
    assert.equal(attribute.count, g.attributes.position.count, `${name} count`);
    assert.ok([...attribute.array].every(Number.isFinite), `${name} must remain finite`);
  }
  if (g.index) assert.ok([...g.index.array].every(i =>
    Number.isInteger(i) && i >= 0 && i < g.attributes.position.count));
  assert.ok(Number.isFinite(g.boundingSphere.radius));
}

function affineAttributes(g, epsilon = 1e-5) {
  const {position: p, uv, color, aVia} = g.attributes;
  assert.equal(aVia.array.constructor, Uint8Array);
  assert.equal(aVia.normalized, true);
  for (let i = 0; i < p.count; i++) {
    const x = p.array[i * 3], z = p.array[i * 3 + 2];
    near(p.array[i * 3 + 1], 3 + x * 0.025 - z * 0.05, epsilon, 'original vertex Y');
    near(uv.array[i * 2], (x + 200) / 400, epsilon, 'interpolated U');
    near(uv.array[i * 2 + 1], (z + 200) / 400, epsilon, 'interpolated V');
    near(color.array[i * 3], 0.5 + x / 1000, epsilon, 'interpolated color X');
    near(color.array[i * 3 + 1], 0.5 + z / 1000, epsilon, 'interpolated color Z');
    near(color.array[i * 3 + 2], 0.75, epsilon, 'constant color');
    assert.equal(aVia.array[i], 127, 'constant normalized integer attribute');
  }
}

function grid(n = 80, half = 9500) {
  const values = new Float64Array(n * n);
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
    const x = -half + col * 2 * half / (n - 1), z = -half + row * 2 * half / (n - 1);
    values[row * n + col] = 40 + x * 0.035 - z * 0.08;
  }
  return {values, n, half};
}

test('clipping partitions indexed ground without losing area, winding or affine attributes', () => {
  const terrain = patch();
  for (const reverse of [false, true]) {
    const g = geometry([[-150, -150], [150, -150], [150, 150], [-150, 150]],
      reverse ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
    const before = area(g);
    const identity = terrain.refine(T, g);
    assert.equal(identity, g);
    assert.equal(g.index, null);
    assert.ok(g.attributes.position.count > 6, 'transition ring should be subdivided');
    near(area(g), before, before * 2e-6, 'conserved 2D area');
    for (const triangle of triangles(g)) {
      assert.ok((reverse ? -1 : 1) * signedArea(triangle) >= -1e-6, 'winding preserved');
    }
    finiteGeometry(g);
    affineAttributes(g);
  }
});

test('the entire footprint stays flat, transition blends, original terrain resumes beyond 250m', () => {
  const center = [-3208.4283207855997, -3185.4802476268346];
  const terrain = patch({center, exaggeration: 1.5});
  const {values, n, half} = grid();
  const expected = original.sample(values, n, half, ...center);
  near(terrain.sample(values, n, half, ...center), expected);
  const polygon = terrain.diagnostics().polygon;
  // Convex combinations cover the boundary, centroid and interior of this convex footprint.
  for (const vertex of polygon) for (const weight of [0, 0.2, 0.5, 0.9, 1]) {
    const x = center[0] + (vertex[0] - center[0]) * weight;
    const z = center[1] + (vertex[1] - center[1]) * weight;
    near(terrain.sample(values, n, half, x, z), expected, 1e-9, 'flat footprint');
  }
  const [a, b] = polygon, dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  const x = (a[0] + b[0]) / 2 + dz / length * 6;
  const z = (a[1] + b[1]) / 2 - dx / length * 6;
  near(terrain.sample(values, n, half, x, z),
    (expected + original.sample(values, n, half, x, z)) / 2, 1e-8, 'halfway smoothstep');
  for (let i = 0; i < 24; i++) {
    const angle = i * Math.PI / 12;
    const x = center[0] + Math.cos(angle) * 250, z = center[1] + Math.sin(angle) * 250;
    assert.equal(terrain.sample(values, n, half, x, z), original.sample(values, n, half, x, z));
  }
  near(terrain.diagnostics().centerHeightMeters, expected * 1.5);
  near(terrain.sampleOriginal(...center), expected * 1.5);
  // A replacement grid must refresh the cached center height.
  const replacement = Float64Array.from(values, value => value + 7);
  near(terrain.sample(replacement, n, half, ...center), expected + 7);
});

test('triangle edges separate the exact footprint, so interpolation cannot tilt its interior', () => {
  const terrain = patch(), g = geometry([[-150, -150], [150, -150], [150, 150], [-150, 150]],
    [0, 1, 2, 0, 2, 3]);
  terrain.refine(T, g);
  const polygon = terrain.diagnostics().polygon, {values, n, half} = grid();
  const centerHeight = terrain.sample(values, n, half, 0, 0);
  let insideArea = 0, insideTriangles = 0;
  for (const triangle of triangles(g)) {
    const full = Math.abs(signedArea(triangle)), clipped = polygonArea(intersection(triangle, polygon));
    insideArea += clipped;
    assert.ok(Math.min(clipped, Math.abs(full - clipped)) < 0.002,
      'a generated face must be entirely inside or outside the footprint');
    if (clipped > 0.002 && Math.abs(full - clipped) < 0.002) {
      insideTriangles++;
      for (const [x, z] of triangle) {
        near(terrain.sample(values, n, half, x, z), centerHeight, 1e-8,
          'all vertices of an interior face lie on the same height plane');
      }
    }
  }
  assert.ok(insideTriangles >= 3);
  near(insideArea, 7087.73775, 0.02, 'covered footprint area from source dimensions');
});

test('refinement at production coordinates is finite and preserves area', () => {
  const center = [-3208.4283207855997, -3185.4802476268346];
  const terrain = patch({center});
  const g = geometry([[-140, -140], [140, -140], [140, 140], [-140, 140]]
    .map(([x, z]) => [x + center[0], z + center[1]]), [0, 1, 2, 0, 2, 3]);
  const before = area(g);
  terrain.refine(T, g);
  near(area(g), before, before * 2e-5, 'translated area');
  finiteGeometry(g);
  affineAttributes(g, 5e-5);
});

test('repeated refinement is idempotent', () => {
  const terrain = patch(), g = geometry([[-150, -150], [150, -150], [0, 150]]);
  terrain.refine(T, g);
  const references = Object.values(g.attributes).map(attribute => attribute.array);
  const contents = references.map(array => Array.from(array));
  const diagnostics = terrain.diagnostics();
  assert.equal(terrain.refine(T, g, true), g);
  Object.values(g.attributes).forEach((attribute, i) => {
    assert.equal(attribute.array, references[i]);
    assert.deepEqual(Array.from(attribute.array), contents[i]);
  });
  assert.deepEqual(terrain.diagnostics(), diagnostics);
});

test('nonintersecting geometry remains unchanged, including index and attribute objects', () => {
  const terrain = patch(), g = geometry([[300, 300], [350, 300], [300, 350]], [0, 1, 2]);
  const attributes = {...g.attributes}, index = g.index;
  assert.equal(terrain.refine(T, g), g);
  assert.equal(g.index, index);
  for (const name of Object.keys(attributes)) assert.equal(g.attributes[name], attributes[name]);
  assert.equal(g.userData.livTerrainRefined, undefined);
  assert.equal(terrain.diagnostics().refinedGeometries, 0);
  // Bounding boxes can overlap while the triangle itself misses the footprint.
  const corner = geometry([[50, 65], [65, 50], [65, 65]], [0, 1, 2]);
  const cornerPositions = corner.attributes.position, cornerIndex = corner.index;
  terrain.refine(T, corner);
  assert.equal(corner.attributes.position, cornerPositions);
  assert.equal(corner.index, cornerIndex);
});

test('boundary vertices, thin crossings and degenerate triangles do not create nonfinite data', () => {
  const terrain = patch({rotation: 0});
  const cases = [
    [[51.04, -39.585], [51.04, 27.985], [120, -20]],
    [[-100, 0], [100, 0], [0, 0.0001]],
    [[-100, 0], [0, 0], [100, 0]],
    [[0, 0], [0, 0], [0, 0]],
  ];
  for (const points of cases) {
    const g = geometry(points), before = area(g);
    terrain.refine(T, g);
    if (!g.boundingSphere) g.computeBoundingSphere();
    finiteGeometry(g);
    near(area(g), before, Math.max(1e-6, before * 2e-6), 'boundary/degenerate area');
    affineAttributes(g);
  }
});

test('dynamic and preset heights are respected even when refinement is forced', () => {
  for (const flag of ['dynamicHeight', 'presetDY']) {
    const terrain = patch(), g = geometry([[-150, -150], [150, -150], [0, 150]]);
    g.userData[flag] = true;
    const positions = g.attributes.position;
    assert.equal(terrain.refine(T, g, true), g);
    assert.equal(g.attributes.position, positions);
    assert.equal(terrain.diagnostics().refinedGeometries, 0);
  }
});
