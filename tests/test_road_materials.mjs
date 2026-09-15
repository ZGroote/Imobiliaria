import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import test from 'node:test';

const original = execFileSync('git', ['-c', 'safe.directory=' + process.cwd().replaceAll('\\', '/'),
  'show', '131b60e:renderizador-v16-moveis/app.js'], {encoding: 'utf8', maxBuffer: 2000000});
const source = original.slice(original.indexOf('const RUA_MANCHA'), original.indexOf('function buildPatches'));
const three = fs.readFileSync(new URL('../renderizador-v16-moveis/lib/three.min.js', import.meta.url), 'utf8');
const module = fs.readFileSync(new URL('../renderizador-v16-moveis/materials/roads.js', import.meta.url), 'utf8');

for (const photo of [false, true]) for (const sidewalk of [false, true]) {
  test(`road shader preserves photo=${photo}, sidewalk=${sidewalk}`, () => {
    const ctx = vm.createContext({AP_RUA: photo, GLSL_RUIDO: 'noise fixture', K: {mark: 0xf0eeee, markEixo: 0xf4dd00}});
    vm.runInContext(three, ctx);
    vm.runInContext(source + ';globalThis.before=matVia;', ctx);
    vm.runInContext(module, ctx);
    const after = ctx.RoadMaterials.create(ctx).matVia;
    const a = ctx.before(0x666666, 1.5, sidewalk), b = after(0x666666, 1.5, sidewalk);
    const shader = () => ({uniforms: {}, vertexShader: ctx.THREE.ShaderLib.phong.vertexShader,
      fragmentShader: ctx.THREE.ShaderLib.phong.fragmentShader});
    const sa = shader(), sb = shader(); a.onBeforeCompile(sa); b.onBeforeCompile(sb);
    assert.equal(sb.vertexShader, sa.vertexShader);
    assert.equal(sb.fragmentShader, sa.fragmentShader);
    assert.deepEqual(sb.uniforms, sa.uniforms);
    assert.equal(b.customProgramCacheKey(), a.customProgramCacheKey());
    for (const key of ['shininess', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits']) assert.equal(b[key], a[key]);
    assert.equal(b.color.getHex(), a.color.getHex());
  });
}
