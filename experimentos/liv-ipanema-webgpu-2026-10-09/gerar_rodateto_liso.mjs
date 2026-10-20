import * as THREE from './node_modules/three/build/three.module.js';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

import path from 'node:path';

const DIR = import.meta.dirname;

function digest(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function geometryHash(geo) {
  const p = Buffer.from(new Float32Array(geo.position || []).buffer);
  const n = Buffer.from(new Float32Array(geo.normal || []).buffer);
  const u = Buffer.from(new Float32Array(geo.uv || []).buffer);
  const c = Buffer.from(new Float32Array(geo.color || []).buffer);
  const idx = Buffer.from(new Uint32Array(geo.index || []).buffer);
  const header = Buffer.from(new Uint32Array([
    (geo.position || []).length,
    (geo.normal || []).length,
    (geo.uv || []).length,
    (geo.color || []).length,
    (geo.index || []).length
  ]).buffer);
  return digest(Buffer.concat([header, p, n, u, c, idx]));
}

const rings = JSON.parse(fs.readFileSync(path.join(DIR, 'rodateto_rings.json'), 'utf8'));

const shape = new THREE.Shape();
const ext = rings.exterior;
shape.moveTo(ext[0][0], ext[0][1]);
for(let i=1; i<ext.length; i++) {
  shape.lineTo(ext[i][0], ext[i][1]);
}
for(const hole of rings.interiors) {
  const p = new THREE.Path();
  p.moveTo(hole[0][0], hole[0][1]);
  for(let i=1; i<hole.length; i++) {
    p.lineTo(hole[i][0], hole[i][1]);
  }
  shape.holes.push(p);
}

const height = 2.700 - 2.590; // 0.11 m
const geom = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });

const posAttr = geom.attributes.position;
const count = posAttr.count;
const newPositions = new Float32Array(count * 3);
for(let i=0; i<count; i++) {
  const x = posAttr.getX(i);
  const z_shape = posAttr.getY(i);
  const extruded = posAttr.getZ(i);
  newPositions[i*3] = x;
  newPositions[i*3+1] = 2.590 + extruded;
  newPositions[i*3+2] = z_shape;
}

// Inverter winding order dos triângulos para compensar a reflexão de eixos (det = -1)
for (let i = 0; i < count; i += 3) {
  for (let k = 0; k < 3; k++) {
    const tmp = newPositions[(i + 1) * 3 + k];
    newPositions[(i + 1) * 3 + k] = newPositions[(i + 2) * 3 + k];
    newPositions[(i + 2) * 3 + k] = tmp;
  }
}

geom.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
geom.computeVertexNormals();

const posArray = Array.from(geom.attributes.position.array);
const normArray = Array.from(geom.attributes.normal.array);
const uvArray = Array(posArray.length / 3 * 2).fill(0);

const geoObj = {
  position: posArray,
  normal: normArray,
  uv: uvArray,
  color: null,
  index: null,
  groups: []
};
geoObj.sha256 = geometryHash(geoObj);

console.log('Geometry hash:', geoObj.sha256, 'vertices:', posArray.length / 3);

// Update canto/source.json
const sourcePath = path.join(DIR, 'interiores/canto/source.json');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
source.geometries['rodateto-unido'] = geoObj;

const sourceJson = JSON.stringify(source, null, '') + '\n';
const sourceBuf = Buffer.from(sourceJson, 'utf8');
fs.writeFileSync(sourcePath, sourceBuf);

const sourceGz = zlib.gzipSync(sourceBuf, { level: 6, mtime: 0 });
fs.writeFileSync(path.join(DIR, 'interiores/canto/source.json.gz'), sourceGz);

// Update catalogo.json
const catPath = path.join(DIR, 'interiores/catalogo.json');
const cat = JSON.parse(fs.readFileSync(catPath, 'utf8'));
cat.tipologias.canto.sourceSHA256 = digest(sourceBuf);
cat.tipologias.canto.files.source = {
  path: 'interiores/canto/source.json.gz',
  bytes: sourceGz.length,
  sha256: digest(sourceGz),
  compression: 'gzip',
  decodedBytes: sourceBuf.length,
  decodedSHA256: digest(sourceBuf)
};
fs.writeFileSync(catPath, JSON.stringify(cat, null, 2) + '\n');
console.log('Successfully updated canto source.json and catalogo.json!');
