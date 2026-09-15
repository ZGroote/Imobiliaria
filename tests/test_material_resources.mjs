import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import test from 'node:test';

const ctx = vm.createContext({});
for (const name of ['lib/three.min.js', 'materials/resources.js'])
  vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/' + name, import.meta.url), 'utf8'), ctx);

test('shared GLSL preserves the original bytes and final newline', () => {
  const source = execFileSync('git', ['-c', 'safe.directory=' + process.cwd().replaceAll('\\', '/'),
    'show', 'b300541:renderizador-v16-moveis/app.js'], {encoding: 'utf8', maxBuffer: 2000000});
  const begin = source.indexOf('const GLSL_RUIDO ='), end = source.indexOf('const {matVia}', begin);
  const before = vm.createContext({});
  vm.runInContext(source.slice(begin, end) + ';globalThis.noise=GLSL_RUIDO;', before);
  assert.equal(ctx.MaterialResources.GLSL_RUIDO, before.noise);
  assert(ctx.MaterialResources.GLSL_RUIDO.endsWith('\n'));
});

test('city textures wait for image load and preserve sampling settings', () => {
  class ImageStub { set src(uri) {this.uri = uri;} }
  const textures = ctx.MaterialResources.cityTextures({THREE: ctx.THREE, ImageClass: ImageStub,
    data: {reboco: 'data:image/png;base64,fixture'}, maxAnisotropy: 2});
  assert.equal(textures.tijolo, null); assert.equal(textures.chao, null);
  const texture = textures.reboco;
  assert.equal(texture.version, 0);
  assert.equal(texture.image.uri, 'data:image/png;base64,fixture');
  assert.equal(texture.wrapS, ctx.THREE.RepeatWrapping);
  assert.equal(texture.wrapT, ctx.THREE.RepeatWrapping);
  assert.equal(texture.colorSpace, ctx.THREE.NoColorSpace);
  assert.equal(texture.anisotropy, 2);
  texture.image.onload(); assert.equal(texture.version, 1);
  const other = ctx.MaterialResources.cityTextures({THREE: ctx.THREE, ImageClass: ImageStub,
    data: {chao: 'ground'}, maxAnisotropy: 16});
  assert.equal(other.chao.anisotropy, 4);
});
