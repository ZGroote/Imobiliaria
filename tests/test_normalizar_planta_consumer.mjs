// Prova geométrica com o consumidor real, sem WebGL, Blender ou geração LEVE.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function derived(name) {
  return JSON.parse(execFileSync('python', ['-m', 'pipeline.normalizar_planta',
    'tests/fixtures/leitura/v1/' + name + '.json'], {cwd: root, encoding: 'utf8'}));
}
function consumer() {
  const ctx = vm.createContext({location: {search: ''}, URLSearchParams});
  vm.runInContext(read('v1.5/renderizador-v16-moveis/core/geometry.js'), ctx);
  vm.runInContext(read('v1.5/renderizador-v16-moveis/interior/floor-plan.js'), ctx);
  return vm.runInContext('FloorPlan.create({inside: MapGeometry.inside})', ctx);
}
// Convenção usada por plantaDaUnidade: centro p, largura, cotas y0/y1.
// O exemplo antigo omite cotas; aqui seus defaults são somente o oráculo do teste.
function openings(P) {
  return [...P.portas.map(p => ({rec:p, porta:true, p:p.p, largura:p.largura,
    y0:p.y0 ?? 0, y1:p.y1 ?? 2.1})),
    ...P.janelas.map(p => ({rec:p, porta:false, p:p.p, largura:p.largura,
      y0:p.y0 ?? 1, y1:p.y1 ?? 2.2}))];
}
const geometric = grade => JSON.stringify(grade, (k,v) => k === 'src' ? undefined : v);

test('fixture declarada reproduz a geometria de unidade _exemplo sem cadastro', () => {
  const expected = JSON.parse(read('plantas_fornecidas/_exemplo/unidade.json')).planta;
  const out = derived('exemplo-geometrico');
  assert.equal(out.planta.pe_direito, expected.pe_direito);
  assert.deepEqual(out.planta.comodos.map(c => ({nome:c.nome, poly:c.poly})),
    expected.comodos.map(c => ({nome:c.nome, poly:c.poly})));
  for (const kind of ['portas','janelas']) {
    assert.deepEqual(out.planta[kind].map(p => ({p:p.p, largura:p.largura})),
      expected[kind].map(p => ({p:p.p, largura:p.largura})));
  }
  for (const key of ['id','ficha','lote','predio_id','agencyId','propertyId','profile'])
    assert.equal(Object.hasOwn(out, key), false, key);
  const fp = consumer();
  const a = fp.paredesDaGrade(expected.comodos, openings(expected), expected.pe_direito);
  const b = fp.paredesDaGrade(out.planta.comodos, openings(out.planta), out.planta.pe_direito);
  assert.equal(geometric(b), geometric(a));
  assert.equal(b.vaos.length, 11);
  assert.equal(new Set(b.vaos.map(v => v.src.rec.id)).size, 11);
});

test('L, porta compartilhada e janela externa entram uma vez no consumidor real', () => {
  const P = derived('apartamento-simples').planta;
  const fp = consumer();
  const g = fp.paredesDaGrade(P.comodos, openings(P), P.pe_direito);
  assert.equal(g.vaos.length, 3);
  const door = g.vaos.find(v => v.src.rec.id === 'porta-1');
  assert.ok(door);
  assert.ok(Math.abs(door.a[0] - 4) < 1e-9);
  assert.ok(Math.abs(door.b[0] - 4) < 1e-9);
  assert.ok(Math.abs(Math.hypot(door.b[0]-door.a[0], door.b[1]-door.a[1])-.8) < 1e-9);
  assert.equal(door.y0, 0);
  assert.equal(door.y1, 2.1);
  const window = g.vaos.find(v => v.src.rec.id === 'janela-1');
  assert.equal(window.y0, 1);
  assert.equal(window.y1, 2);
});
