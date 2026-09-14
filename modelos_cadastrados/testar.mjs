import fs from 'node:fs';import assert from 'node:assert/strict';import {NodeIO} from '@gltf-transform/core';
const pack=JSON.parse(fs.readFileSync('modelos_cadastrados/estudos.json','utf8'));
assert.deepEqual(pack.assets.map(a=>a.id).sort(),['57881','85452','86834','87313','89963','89981'].sort());
const io=new NodeIO();
for(const a of pack.assets){
  const doc=await io.read(`modelos_cadastrados/${a.id}/exterior-estudo.glb`);
  const primitive=doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const p=primitive.getAttribute('POSITION').getArray(),idx=primitive.getIndices().getArray();
  assert([...p].every(Number.isFinite));assert([...idx].every(i=>i<p.length/3));assert(a.parts.length>100);
  assert(a.front.w>0&&a.front.h>0);assert(a.status==='estudo_exterior');
  assert.equal(Buffer.from(a.p,'base64').length,p.length*2);assert(a.note.length>50);
}
console.log('PASS: seis cadastros exclusivos, GLBs legiveis, indices/buffers validos, referencias e estimativas registradas.');
