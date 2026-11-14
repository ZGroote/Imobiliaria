// CPU-only regression suite: no browser, WebGPU device or renderer is created.
// Run with: node test_interior_navigation.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as THREE from 'three/webgpu';

const root = path.dirname(fileURLToPath(import.meta.url));
const hashes = {};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function read(relative, record) {
  const bytes = fs.readFileSync(path.join(root, relative));
  hashes[relative] = sha256(bytes);
  if (record) {
    assert.equal(bytes.length, record.bytes, `${relative}: catalog byte count`);
    assert.equal(hashes[relative], record.sha256, `${relative}: catalog SHA-256`);
  }
  return bytes;
}
const catalog = JSON.parse(read('interiores/catalogo.json'));
assert.equal(catalog.schema, 'liv-interior-catalog-v1');
read('test_interior_navigation.mjs');
read('interior-navigation.js');
const {createLayout, createNavigation} = await import('./interior-navigation.js');
globalThis.location = {search: ''};
vm.runInThisContext(read(catalog.shared.runtime.path, catalog.shared.runtime).toString('utf8'), {
  filename: catalog.shared.runtime.path,
});

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const length = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const clamp = x => Math.max(0, Math.min(1, x));
const epsilon = 1e-7;
let oracleChecks = 0;

// Independent reference: minimize the squared distance of two parametric
// segments, including all four constrained boundaries and an interior minimum.
// This does not use the production crossing test or its point-distance helper.
function closestSquared(a, b, c, d) {
  const u = sub(b, a), v = sub(d, c), w = sub(a, c);
  const uu = dot(u, u), uv = dot(u, v), vv = dot(v, v);
  const uw = dot(u, w), vw = dot(v, w);
  const distance = (s, t) => {
    const x = w[0] + s * u[0] - t * v[0];
    const z = w[1] + s * u[1] - t * v[1];
    return x * x + z * z;
  };
  const candidates = [
    distance(0, vv ? clamp(vw / vv) : 0),
    distance(1, vv ? clamp((vw + uv) / vv) : 0),
    distance(uu ? clamp(-uw / uu) : 0, 0),
    distance(uu ? clamp((uv - uw) / uu) : 0, 1),
  ];
  const determinant = uu * vv - uv * uv;
  if (determinant > 1e-18) {
    const s = (uv * vw - vv * uw) / determinant;
    const t = (uu * vw - uv * uw) / determinant;
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) candidates.push(distance(s, t));
  }
  return Math.min(...candidates);
}

// Winding-number containment also accepts polygon edges for the reference union.
function contains(poly, p) {
  let winding = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if (closestSquared(p, p, a, b) < 1e-20) return true;
    const side = cross(sub(b, a), sub(p, a));
    if (a[1] <= p[1] && b[1] > p[1] && side > 0) winding++;
    if (a[1] > p[1] && b[1] <= p[1] && side < 0) winding--;
  }
  return winding !== 0;
}

// Partition a segment at every floor edge intersection. Each resulting open
// interval lies entirely in/out of a polygon: a narrow void cannot hide between
// periodic samples. Endpoints are checked separately by the production API.
function staysOnFloor(layout, a, b) {
  const delta = sub(b, a), parameters = [0, 1];
  for (const room of layout.rooms) {
    for (let i = 0; i < room.poly.length; i++) {
      const p = room.poly[i], q = room.poly[(i + 1) % room.poly.length];
      const edge = sub(q, p), determinant = cross(delta, edge);
      if (Math.abs(determinant) < 1e-15) continue;
      const t = cross(sub(p, a), edge) / determinant;
      const edgeT = cross(sub(p, a), delta) / determinant;
      if (t > 0 && t < 1 && edgeT >= 0 && edgeT <= 1) parameters.push(t);
    }
  }
  parameters.sort((x, y) => x - y);
  const inside = p => layout.rooms.some(room => contains(room.poly, p));
  if (!inside(a) || !inside(b)) return false;
  for (let i = 1; i < parameters.length; i++) {
    if (!inside(mix(a, b, (parameters[i - 1] + parameters[i]) / 2))) return false;
  }
  return true;
}

// SAT in world coordinates is independent of production's local-coordinate
// slab clipping. Touching an inflated rectangle's boundary is allowed.
function entersRectangle(a, b, item, radius) {
  const halfX = item.w / 2 + radius * .8 - epsilon;
  const halfZ = item.d / 2 + radius * .8 - epsilon;
  const theta = item.rotation * Math.PI / 2, c = Math.cos(theta), s = Math.sin(theta);
  const polygon = [[-halfX, -halfZ], [halfX, -halfZ], [halfX, halfZ], [-halfX, halfZ]]
    .map(([x, z]) => [item.position[0] + x * c - z * s, item.position[1] + x * s + z * c]);
  const movement = sub(b, a);
  const axes = [[c, s], [-s, c], [-movement[1], movement[0]]];
  for (const axis of axes) {
    const norm = Math.hypot(...axis);
    if (norm < 1e-14) continue;
    const unit = axis.map(x => x / norm);
    const obstacle = polygon.map(p => dot(p, unit));
    const endpoints = [dot(a, unit), dot(b, unit)];
    if (Math.max(...endpoints) <= Math.min(...obstacle) + 1e-11 ||
        Math.min(...endpoints) >= Math.max(...obstacle) - 1e-11) return false;
  }
  return true;
}
const overhead = new Set(['aereo', 'coifa', 'cortina', 'ripado', 'tv', 'rack', 'box']);
function obstacle(layout, furniture, a, b, radius = .3) {
  if (!a.concat(b).every(Number.isFinite)) return 'non-finite';
  if (!staysOnFloor(layout, a, b)) return 'outside-floor';
  for (const [i, wall] of layout.walls.entries()) {
    if (wall.y0 >= 1.2) continue;
    const d = length(wall.a, wall.b);
    const start = mix(wall.a, wall.b, wall.pa ? .14 / d : 0);
    const end = mix(wall.a, wall.b, wall.pb ? 1 - .14 / d : 1);
    if (closestSquared(a, b, start, end) < (radius + .065 - epsilon) ** 2 - 1e-12) return `wall-${i}`;
  }
  for (const [i, joinery] of layout.joinery.entries()) {
    const leaf = joinery.folha;
    if (!leaf) continue;
    const start = [leaf.x + leaf.dx * .12, leaf.z + leaf.dz * .12];
    const end = [leaf.x + leaf.dx * leaf.larg, leaf.z + leaf.dz * leaf.larg];
    if (closestSquared(a, b, start, end) < (.215 - epsilon) ** 2 - 1e-12) return `door-${i}`;
  }
  for (const [i, item] of furniture.entries()) {
    if (item.h < .35 || overhead.has(item.tipo)) continue;
    if (entersRectangle(a, b, item, radius)) return `furniture-${i}`;
  }
  return null;
}
function assertSweep(layout, furniture, a, b, context) {
  oracleChecks++;
  assert.equal(obstacle(layout, furniture, a, b), null,
    `${context}: independent swept collision ${JSON.stringify({a, b})}`);
}

function fixture({walls = [], joinery = [], furniture = [], rooms} = {}) {
  const layout = {
    rooms: rooms || [{id: 'sala', name: 'Sala', cx: 0, cz: 0,
      poly: [[-5, -5], [5, -5], [5, 5], [-5, 5]]}],
    walls, joinery, bounds: {x0: -5, x1: 5, z0: -5, z1: 5},
  };
  return {layout, furniture, nav: createNavigation(layout, () => furniture)};
}
const cases = [];
function collisionCase(name, value, a, b, expected) {
  const {layout, furniture, nav} = value;
  assert.equal(nav.free(...a), true, `${name}: start must be free`);
  assert.equal(nav.free(...b), true, `${name}: end must be free`);
  assert.equal(obstacle(layout, furniture, a, b) === null, expected, `${name}: reference`);
  assert.equal(nav.segment(a, b), expected, `${name}: forward`);
  assert.equal(nav.segment(b, a), expected, `${name}: reverse`);
  cases.push(name);
}
function oldSamplesAreFree(nav, a, b) {
  const samples = Math.ceil(length(a, b) / .025);
  for (let i = 0; i <= samples; i++) assert.equal(nav.free(...mix(a, b, i / samples)), true);
}

const box = {tipo: 'sofa', w: .2, d: .2, h: .8, position: [0, 0], rotation: 0};
const corner = fixture({furniture: [box]});
const cornerA = [.04, .6399], cornerB = [.64, .0399];
oldSamplesAreFree(corner.nav, cornerA, cornerB);
collisionCase('furniture-corner-between-25mm-samples', corner, cornerA, cornerB, false);
collisionCase('furniture-corner-tangent', corner, [.04, .64], [.64, .04], true);

const wall = fixture({walls: [{a: [0, 0], b: [0, 1], y0: 0, y1: 2.7}]});
const wallA = [-.0415, -.364999], wallB = [.0585, -.364999];
oldSamplesAreFree(wall.nav, wallA, wallB);
collisionCase('wall-capsule-between-25mm-samples', wall, wallA, wallB, false);
collisionCase('wall-capsule-tangent', wall, [-.1, -.365], [.1, -.365], true);
collisionCase('wall-perpendicular-crossing', wall, [-1, .5], [1, .5], false);
collisionCase('wall-collinear-overlap', wall, [0, -1], [0, 2], false);

const leaf = fixture({joinery: [{folha: {x: -.12, z: 0, dx: 1, dz: 0, larg: 1.12}}]});
const leafA = [-.214999, -.0415], leafB = [-.214999, .0585];
oldSamplesAreFree(leaf.nav, leafA, leafB);
collisionCase('door-capsule-between-25mm-samples', leaf, leafA, leafB, false);
collisionCase('door-capsule-tangent', leaf, [-.215, -.1], [-.215, .1], true);
collisionCase('door-perpendicular-crossing', leaf, [.5, -1], [.5, 1], false);
for (const rotation of [0, 1, 2, 3]) {
  const value = fixture({furniture: [{...box, w: .5, d: 1.4, rotation}]});
  collisionCase(`quarter-turn-${rotation}-crossing`, value, [-3, 0], [3, 0], false);
  collisionCase(`quarter-turn-${rotation}-clear`, value, [-3, 2], [3, 2], true);
  const moved = value.nav.move([-3, 0], 6, 0);
  assert.ok(moved[0] < 0, `quarter-turn-${rotation}: long move must stop before furniture`);
  assertSweep(value.layout, value.furniture, [-3, 0], moved, `quarter-turn-${rotation}: long move`);
}
for (const [name, value, start, delta] of [
  ['wall-long-move', wall, [-2, .5], [4, 0]],
  ['door-long-move', leaf, [.5, -2], [0, 4]],
]) {
  const moved = value.nav.move(start, ...delta);
  assert.ok(length(start, moved) < 2, `${name}: obstacle must stop the move`);
  assertSweep(value.layout, value.furniture, start, moved, name);
  cases.push(name);
}
collisionCase('zero-length-free', fixture(), [1, 1], [1, 1], true);
const ignored = fixture({furniture: [{...box, tipo: 'aereo', h: 1.5}, {...box, h: .2}]});
collisionCase('overhead-and-low-items-do-not-block', ignored, [-1, 0], [1, 0], true);

function validateRoutes(layout, furniture, nav, start, context) {
  const routes = nav.routes(start);
  for (const route of routes) {
    if (!route.reachable) {
      assert.equal(route.target, null, `${context}/${route.id}: unreachable target`);
      assert.deepEqual(route.path, [], `${context}/${route.id}: unreachable path`);
      continue;
    }
    assert.ok(contains(layout.rooms.find(room => room.id === route.id).poly, route.target),
      `${context}/${route.id}: target in correct room`);
    for (let i = 1; i < route.path.length; i++) {
      const a = route.path[i - 1], b = route.path[i];
      assert.equal(nav.segment(a, b), true, `${context}/${route.id}: route segment`);
      assert.equal(nav.segment(b, a), true, `${context}/${route.id}: reversible route segment`);
      assertSweep(layout, furniture, a, b, `${context}/${route.id}: planned path`);
    }
  }
  return routes;
}

// A blocking item closes a real doorway after the grid has been populated.
const doorway = fixture({
  rooms: [
    {id: 'sala', name: 'Sala', cx: -1.5, cz: 0, poly: [[-3, -2], [0, -2], [0, 2], [-3, 2]]},
    {id: 'suite', name: 'Suíte', cx: 1.5, cz: 0, poly: [[0, -2], [3, -2], [3, 2], [0, 2]]},
  ],
  walls: [{a: [0, -2], b: [0, -.55], y0: 0, y1: 2.7},
    {a: [0, .55], b: [0, 2], y0: 0, y1: 2.7}],
});
const doorwayStart = [-1.5, 0];
assert.equal(validateRoutes(doorway.layout, doorway.furniture, doorway.nav, doorwayStart, 'doorway-before')
  .filter(route => route.reachable).length, 2);
doorway.furniture.push({...box, w: .45, d: .4});
doorway.nav.invalidate();
const closedRoutes = validateRoutes(doorway.layout, doorway.furniture, doorway.nav, doorwayStart, 'doorway-blocked');
assert.equal(closedRoutes.find(route => route.id === 'suite').reachable, false);
assert.equal(closedRoutes.find(route => route.id === 'sala').reachable, true);
assert.deepEqual(closedRoutes.map(route => route.reachable),
  createNavigation(doorway.layout, () => doorway.furniture).routes(doorwayStart).map(route => route.reachable),
  'invalidated grid must agree with a newly constructed navigation');
doorway.furniture[0].position = [2, 1.5];
doorway.nav.invalidate();
assert.equal(validateRoutes(doorway.layout, doorway.furniture, doorway.nav, doorwayStart, 'doorway-reopened')
  .filter(route => route.reachable).length, 2);
cases.push('cached-grid-blocked-and-reopened');

const patterns = [
  {name: '70mm', deltas: [.07]},
  {name: '25mm', deltas: [.025]},
  {name: '14mm', deltas: [.014]},
  {name: 'variable-frame-time', deltas: [.005, .013, .067, .04, .18, .009]},
];
const results = [];
const started = Date.now();
for (const type of ['canto', 'meio']) {
  const record = catalog.tipologias[type];
  const unit = JSON.parse(read(record.files.unit.path, record.files.unit));
  assert.equal(record.unitSHA256, record.files.unit.sha256);
  const layout = createLayout(unit);
  assert.equal(layout.rooms.length, 6, `${type}: six authored rooms`);
  const material = new THREE.MeshStandardMaterial();
  const openingMeshes = globalThis.Openings.create({THREE, ESP: .13, rgbDe: () => [128, 128, 128],
    matEsq: material, matAlum: material, matVidro: material}).geoDasEsquadrias(layout.house);
  const furniture = unit.planta.moveis.map(item => ({...item, rotation: item.rot || 0,
    position: [item.p[0] - layout.center[0], item.p[1] - layout.center[1]]}));
  try {
    for (const pattern of patterns) {
      const navigation = createNavigation(layout, () => furniture);
      let position = navigation.entry(), steps = 0;
      const roomResults = [];
      for (const room of layout.rooms) {
        const context = `${type}/${pattern.name}/${room.id}`;
        const routes = validateRoutes(layout, furniture, navigation, position, context);
        assert.equal(routes.filter(route => route.reachable).length, 6, `${context}: all rooms reachable`);
        const route = routes.find(candidate => candidate.id === room.id);
        let iterations = 0, distanceWalked = 0;
        const remaining = route.path.slice(1).map(p => [...p]);
        while (remaining.length) {
          assert.ok(iterations++ < 10000, `${context}: route stalled before destination`);
          const next = remaining[0], distance = length(position, next);
          const delta = pattern.deltas[steps++ % pattern.deltas.length];
          assert.equal(navigation.segment(position, next), true,
            `${context}: route remained valid after a variable-size move`);
          const before = [...position];
          if (distance <= delta) { position = [...next]; remaining.shift(); }
          else position = navigation.move(position,
            (next[0] - position[0]) * delta / distance,
            (next[1] - position[1]) * delta / distance);
          assert.equal(navigation.free(...position), true, `${context}: safe endpoint`);
          assertSweep(layout, furniture, before, position, `${context}: actual movement`);
          const progressed = length(before, position);
          assert.ok(distance < 1e-10 || progressed > 1e-10, `${context}: no progress on clear route`);
          distanceWalked += progressed;
        }
        assert.ok(length(position, route.target) < 1e-8, `${context}: destination reached`);
        roomResults.push({id: room.id, name: room.name, steps: iterations,
          meters: Number(distanceWalked.toFixed(4))});
      }
      results.push({type, pattern: pattern.name, roomCount: roomResults.length, steps, rooms: roomResults});
    }

    // Invalidate the actual unit's cached grid after completely covering its
    // balcony. The old target must not survive a furniture edit.
    const nav = createNavigation(layout, () => furniture), entry = nav.entry();
    const before = validateRoutes(layout, furniture, nav, entry, `${type}/invalidation-before`);
    const balcony = layout.rooms.find(room => /varanda/i.test(room.name));
    assert.ok(balcony, `${type}: balcony fixture`);
    const xs = balcony.poly.map(p => p[0]), zs = balcony.poly.map(p => p[1]);
    const blocker = {...box, w: Math.max(...xs) - Math.min(...xs) + .1,
      d: Math.max(...zs) - Math.min(...zs) + .1,
      position: [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...zs) + Math.min(...zs)) / 2]};
    furniture.push(blocker);
    nav.invalidate();
    assert.equal(nav.free(...before.find(route => route.id === balcony.id).target), false,
      `${type}: old target is covered by new furniture`);
    const blocked = validateRoutes(layout, furniture, nav, entry, `${type}/invalidation-blocked`);
    assert.equal(blocked.find(route => route.id === balcony.id).reachable, false,
      `${type}: blocked balcony is unreachable after invalidation`);
    furniture.pop();
    nav.invalidate();
    assert.equal(validateRoutes(layout, furniture, nav, entry, `${type}/invalidation-restored`)
      .filter(route => route.reachable).length, 6, `${type}: six routes restored after furniture reset`);
    cases.push(`${type}-furniture-edit-invalidates-cached-grid`);
  } finally {
    for (const mesh of openingMeshes) mesh.geometry.dispose();
    material.dispose();
  }
}

// Other agents can change source files concurrently. Evidence is only valid for
// the exact source/units imported at the start of this run.
for (const [relative, expected] of Object.entries(hashes)) {
  assert.equal(sha256(fs.readFileSync(path.join(root, relative))), expected,
    `${relative}: source changed during the CPU run; rerun the suite`);
}
console.log(JSON.stringify({status: 'PASS', gpuDevices: 0, renderers: 0,
  typologies: 2, sequentialRoutes: results.reduce((sum, value) => sum + value.roomCount, 0),
  oracleChecks, cases, elapsedMs: Date.now() - started, sourceSHA256: hashes, results}, null, 2));
