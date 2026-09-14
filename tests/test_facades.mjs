import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import test from 'node:test';

// Fixed source checkpoint: comparing emitted shaders catches altered GLSL,
// misplaced replacements and lost uniform references across every feature mode.
const original = execFileSync('git', ['-c', 'safe.directory=' + process.cwd().replaceAll('\\', '/'),
  'show', 'c93bc7b:renderizador-v16-moveis/app.js'], {encoding: 'utf8', maxBuffer: 2000000});
const tables = original.slice(original.indexOf('const AP_GLSL ='), original.indexOf('/* ---- textura de fachada'));
const functions = original.slice(original.indexOf('function facadeMaterial('), original.indexOf('const flat ='));
const three = fs.readFileSync(new URL('../renderizador-v16-moveis/lib/three.min.js', import.meta.url), 'utf8');
const module = fs.readFileSync(new URL('../renderizador-v16-moveis/materials/facades.js', import.meta.url), 'utf8');

for (const light of [false, true]) for (const windows of [false, true]) {
  test(`facade and growth shaders preserve light=${light}, metricWindows=${windows}`, () => {
    const inputs = {AP_LUZ: light, AP_JANELA: windows, TEX_CIDADE: {reboco: {}, tijolo: {}},
      GLSL_RUIDO: 'noise fixture', uRelief: {value: 0}, uHeight: {value: 1},
      uFuro: {value: null}, uNoite: {value: 0}};
    const ctx = vm.createContext(inputs);
    vm.runInContext(three, ctx);
    vm.runInContext(tables + functions + ';globalThis.before={facadeMaterial,riseLine};', ctx);
    vm.runInContext(module, ctx);
    const after = ctx.FacadeMaterials.create({...inputs, THREE: ctx.THREE, getNoise: () => inputs.GLSL_RUIDO});
    for (const method of ['facadeMaterial', 'riseLine']) {
      const time = {value: .5}, a = ctx.before[method](time), b = after[method](time);
      const shader = () => ({uniforms: {}, vertexShader: ctx.THREE.ShaderLib.phong.vertexShader,
        fragmentShader: ctx.THREE.ShaderLib.phong.fragmentShader});
      const sa = shader(), sb = shader(); a.onBeforeCompile(sa); b.onBeforeCompile(sb);
      assert.equal(sb.vertexShader, sa.vertexShader);
      assert.equal(sb.fragmentShader, sa.fragmentShader);
      for (const key of Object.keys(sa.uniforms)) assert.equal(sb.uniforms[key].value, sa.uniforms[key].value);
      for (const key of ['side', 'shininess', 'opacity', 'transparent', 'vertexColors']) assert.equal(b[key], a[key]);
      assert.equal(sb.uniforms.uRelief, inputs.uRelief);
      assert.equal(sb.uniforms.uT, time);
    }
  });
}
