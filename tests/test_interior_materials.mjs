import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import test from 'node:test';

const original = execFileSync('git', ['-c', 'safe.directory=' + process.cwd().replaceAll('\\', '/'),
  'show', '8351273:renderizador-v16-moveis/app.js'], {encoding: 'utf8', maxBuffer: 2000000});
const basic = original.slice(original.indexOf('const matInt ='), original.indexOf('/* ---- textura sem arquivo'));
const surfaces = original.slice(original.indexOf('const matParede ='), original.indexOf('/* ---- sonda de ambiente:'));
const names = ['matInt', 'matVidro', 'matEsq', 'matAlum', 'matParede', 'matFrio', 'matMadeira'];

test('interior materials preserve textures, transparency, reflection and ceiling shaders', () => {
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/lib/three.min.js', import.meta.url), 'utf8'), ctx);
  for (const key of ['ambientePBR', 'texParede', 'texPiso', 'texMadeira', 'nrmParede', 'nrmPiso', 'nrmMadeira',
    'rugParede', 'rugPiso', 'rugMadeira']) ctx[key] = new ctx.THREE.Texture();
  vm.runInContext(basic + surfaces + ';globalThis.before={' + names.join(',') + '};', ctx);
  vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/materials/interior.js', import.meta.url), 'utf8'), ctx);
  const after = ctx.InteriorMaterials.create(ctx);
  for (const name of names) {
    const a = ctx.before[name], b = after[name];
    for (const key of ['map', 'normalMap', 'roughnessMap', 'envMap', 'envMapIntensity', 'roughness',
      'metalness', 'side', 'transparent', 'opacity', 'depthWrite', 'vertexColors']) assert.equal(b[key], a[key], name + '.' + key);
    assert.equal(b.color.getHex(), a.color.getHex());
    assert.deepEqual(b.normalScale.toArray(), a.normalScale.toArray());
    const shader = () => ({fragmentShader: ctx.THREE.ShaderLib.standard.fragmentShader});
    const sa = shader(), sb = shader(); a.onBeforeCompile(sa); b.onBeforeCompile(sb);
    assert.equal(sb.fragmentShader, sa.fragmentShader, name + ' fragment shader');
    assert.equal(b.customProgramCacheKey(), a.customProgramCacheKey());
  }
});
