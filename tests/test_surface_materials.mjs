import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import test from 'node:test';

const original = execFileSync('git', ['-c', 'safe.directory=' + process.cwd().replaceAll('\\', '/'),
  'show', '35fcefb:renderizador-v16-moveis/app.js'], {encoding: 'utf8', maxBuffer: 2000000});
const wall = original.slice(original.indexOf('const BLOCO_MURO ='), original.indexOf('function buildMuros()'));
const cases = [
  ['chao', '  const matChao = new THREE.MeshBasicMaterial(', 'matChao', 'basic'],
  ['muros', '  const mat = new THREE.MeshPhongMaterial({\n      vertexColors:true, side:THREE.DoubleSide', 'mat', 'phong'],
  ['asfalto', '  const mat = new THREE.MeshBasicMaterial({ color:K.asfaltoPlano', 'mat', 'basic'],
  ['fundo', '  const mat = new THREE.MeshBasicMaterial({ vertexColors:true, side:THREE.DoubleSide, fog:true });', 'mat', 'basic']
];
for (const [name, start, variable, type] of cases) {
  test(`${name} preserves surface shader, texture references and render settings`, () => {
    const ctx = vm.createContext({K: {asfaltoPlano: 0x555555}, TEX_CIDADE: {chao: {}}, GLSL_RUIDO: 'noise fixture'});
    vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/lib/three.min.js', import.meta.url), 'utf8'), ctx);
    const from = original.indexOf(start), to = original.indexOf('  const m = new THREE.Mesh(g, ' + variable + ');', from);
    assert(from >= 0 && to > from);
    vm.runInContext(wall + original.slice(from, to) + ';globalThis.before=' + variable, ctx);
    vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/materials/surfaces.js', import.meta.url), 'utf8'), ctx);
    const b = ctx.SurfaceMaterials.create({...ctx, GLSL_RUIDO: ctx.GLSL_RUIDO})[name](), a = ctx.before;
    const shader = () => ({uniforms: {}, vertexShader: ctx.THREE.ShaderLib[type].vertexShader,
      fragmentShader: ctx.THREE.ShaderLib[type].fragmentShader});
    const sa = shader(), sb = shader(); a.onBeforeCompile(sa); b.onBeforeCompile(sb);
    assert.equal(sb.vertexShader, sa.vertexShader);
    assert.equal(sb.fragmentShader, sa.fragmentShader);
    for (const key of Object.keys(sa.uniforms)) assert.equal(sb.uniforms[key].value, sa.uniforms[key].value);
    assert.equal(b.customProgramCacheKey(), a.customProgramCacheKey());
    for (const key of ['side', 'vertexColors', 'fog', 'flatShading', 'shininess']) assert.equal(b[key], a[key]);
    assert.equal(b.color.getHex(), a.color.getHex());
  });
}


test('V2 grass ground is shader-only and legacy remains the default', () => {
  const ctx = vm.createContext({K:{asfaltoPlano:0x555555},TEX_CIDADE:{chao:{}},
    GLSL_RUIDO:'float vnoise(vec2 p){return .5;}\nfloat h21(vec2 p){return .5;}'});
  vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/lib/three.min.js', import.meta.url), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/materials/surfaces.js', import.meta.url), 'utf8'), ctx);
  const legacy=ctx.SurfaceMaterials.create({...ctx,GLSL_RUIDO:ctx.GLSL_RUIDO,GRASS_V2:false}).chao();
  const grass=ctx.SurfaceMaterials.create({...ctx,GLSL_RUIDO:ctx.GLSL_RUIDO,GRASS_V2:true}).chao();
  assert.equal(legacy.customProgramCacheKey(),'chaoquadra');
  assert.equal(grass.customProgramCacheKey(),'chaoquadra-grass-v2');
  const shader={uniforms:{},vertexShader:ctx.THREE.ShaderLib.basic.vertexShader,
    fragmentShader:ctx.THREE.ShaderLib.basic.fragmentShader};
  grass.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/greenScore/);
  assert.match(shader.fragmentShader,/vec3 lawn/);
});
