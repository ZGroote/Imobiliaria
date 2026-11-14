// Oracle: the same builders as they were in the monolith at a fixed commit (needs local Git history).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CHECKPOINT = '5d1d7e9';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const read = name => fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/' + name, import.meta.url), 'utf8');
const lib = JSON.parse(fs.readFileSync(new URL('../moveis/moveis_lib.json', import.meta.url), 'utf8'));
const pecas = lib.pecas || lib;
const NAMES = ['armarioParam','bancadaParam','aereoParam','ripadoParam','rackParam','tvParam','boxParam','maquinaParam','sofaParam'];

function context() {
  const ctx = vm.createContext({});
  vm.runInContext(read('lib/three.min.js'), ctx);
  vm.runInContext(`const _c = new THREE.Color();
    globalThis.rgbDe = hex => { _c.setHex(hex); return [Math.round(_c.r*255), Math.round(_c.g*255), Math.round(_c.b*255)]; };`, ctx);
  ctx.MOVEIS_LIB = pecas;
  return ctx;
}
function oracle() {
  const app = execFileSync('git', ['-c', 'safe.directory=' + root, 'show', CHECKPOINT + ':renderizador-v16-moveis/app.js'],
    {cwd: root, encoding: 'utf8', maxBuffer: 64 << 20}).replace(/\r/g, '');
  const start = app.indexOf('const B = (x, y, z, w, h, d, c)'), end = app.indexOf('const _cor = new THREE.Color();');
  assert.ok(start > 0 && end > start);
  const ctx = context();
  vm.runInContext(app.slice(start, end) + '\nglobalThis.__o = {geoDeParts, ' + NAMES.join(', ') + '};', ctx);
  return ctx.__o;
}
function modular() {
  const ctx = context();
  vm.runInContext(read('interior/furniture-param.js'), ctx);
  return vm.runInContext('FurnitureParam.create({THREE, getLib: () => MOVEIS_LIB, rgbDe})', ctx);
}

/* Quantos triângulos têm a volta dos vértices discordando da normal guardada. É o
   defeito medido: o three culla pela volta, a luz usa a normal, e onde os dois
   discordam a face some sem escurecer nada -- não há erro no console e a peça continua
   iluminada certo. Zero é o alvo. */
function incoerentes(g) {
  const p = g.attributes.position.array, n = g.attributes.normal.array;
  let mau = 0;
  for (let i = 0; i < p.length; i += 9) {
    const ax=p[i],ay=p[i+1],az=p[i+2], bx=p[i+3],by=p[i+4],bz=p[i+5], cx=p[i+6],cy=p[i+7],cz=p[i+8];
    const ux=bx-ax, uy=by-ay, uz=bz-az, vx=cx-ax, vy=cy-ay, vz=cz-az;
    const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
    if (nx*n[i] + ny*n[i+1] + nz*n[i+2] < 0) mau++;
  }
  return mau;
}

/* Os mesmos triângulos nos mesmos lugares -- o conserto não pode ter mexido na FORMA.
   Compara ponto a ponto sem olhar a ordem dentro do triângulo. */
function mesmosTriangulos(ga, gb, nome) {
  const pa = ga.attributes.position.array, pb = gb.attributes.position.array;
  assert.equal(pb.length, pa.length, nome + ': contagem de vértices');
  const chave = (p, i) => [[p[i],p[i+1],p[i+2]], [p[i+3],p[i+4],p[i+5]], [p[i+6],p[i+7],p[i+8]]]
    .map(v => v.join(',')).sort().join('|');
  for (let i = 0; i < pa.length; i += 9)
    assert.equal(chave(pb, i), chave(pa, i), nome + ': triângulo ' + (i / 9));
}

let incoerentesNoMonolito = 0;

test('parametric part lists and merged buffers match the monolith across measures', () => {
  const a = oracle(), b = modular();
  let cases = 0;
  for (const name of NAMES)
    for (const w of [0.3, 0.6, 0.95, 1.3, 2.0, 2.6, 3.2])
      for (const h of [0.5, 0.9, 1.8, 2.35, 2.7])
        for (const d of [0.3, 0.5, 0.6, 0.9])
          for (const tipo of ['pia', 'balcao']) {
            const m = {tipo, w, h, d};
            const pa = a[name](m), pb = b[name](m);
            assert.equal(JSON.stringify(pb), JSON.stringify(pa), name + ' ' + JSON.stringify(m));
            if (w === 1.3 || w === 3.2) for (const cor of [0x4A5A6B, 0xE8E4DC]) {
              const ga = a.geoDeParts(pa, cor), gb = b.geoDeParts(pb, cor);
              // Normal e cor continuam idênticas ao monólito: os três vértices de um
              // triângulo compartilham as duas, e o conserto não mexeu em nenhuma.
              for (const k of ['normal', 'color'])
                assert.ok(Buffer.from(gb.attributes[k].array.buffer).equals(Buffer.from(ga.attributes[k].array.buffer)), name + ' ' + k);
              assert.equal(gb.boundingSphere.radius, ga.boundingSphere.radius);
              // `position` DIVERGE de propósito, e é o conserto. O monólito virava a
              // normal pra fora da caixa e deixava a ordem dos vértices como estava;
              // o three descarta face pela ORDEM, não pela normal, então metade das
              // faces de cada caixa era cortada vista de fora -- na planta 3D, que se
              // olha de cima, todo armário aparecia aberto. Aqui a volta acompanha a
              // normal. Mesmos triângulos, mesmos pontos: só a volta muda.
              mesmosTriangulos(ga, gb, name);
              /* Só as CAIXAS. A peça que vem do Blender (`malha:`) traz normal
                 SUAVIZADA -- média das faces vizinhas --, e numa superfície curva
                 como o arco da torneira ela discorda da normal do triângulo por
                 construção, não por defeito. Medir a torneira aqui seria reprovar
                 sombreamento macio em nome de uma regra que é das caixas. */
              const caixasA = pa.filter(p => !p.malha), caixasB = pb.filter(p => !p.malha);
              if (caixasB.length) {
                assert.equal(incoerentes(b.geoDeParts(caixasB, cor)), 0,
                             name + ': face de caixa com volta contra a normal');
                incoerentesNoMonolito += incoerentes(a.geoDeParts(caixasA, cor));
              }
            }
            cases++;
          }
  assert.equal(cases, NAMES.length * 280);
  assert.ok(b.sofaParam({w: 3.2, h: 0.8, d: 0.9}).length > 2, 'sofa uses the real library modules');
  const estilo = Object.keys(pecas).find(k => k.startsWith('sofa_mod_')).slice('sofa_mod_'.length);
  assert.deepEqual(new Set(b.sofaParam({w: 2, h: 0.8, d: 0.92, estilo}).map(p => p.malha)),
                   new Set(['sofa_mod_' + estilo, 'sofa_braco_' + estilo]), 'estilo picks its own pair');
  assert.deepEqual(b.sofaParam({w: 2, h: 0.8, d: 0.92, estilo: 'nao-existe'}),
                   b.sofaParam({w: 2, h: 0.8, d: 0.92}), 'unknown estilo falls back to the default pair');
  // Sem isto o teste passaria também se `incoerentes` estivesse quebrada e devolvesse
  // 0 sempre: o monólito TEM o defeito, e medi-lo prova que a sonda enxerga.
  assert.ok(incoerentesNoMonolito > 0,
            'o monólito deveria ter faces com volta invertida -- a sonda não está medindo');
});

test('layout automático exporta a largura que cada estilo de sofá renderiza', () => {
  const codigo = `import json
from pipeline.mobiliar import mobilia, estilos_sofa
saida = []
for estilo in estilos_sofa() + ['nao-existe']:
    unidade = {'id': '2', 'planta': {'estilo_sofa': estilo, 'comodos': [
        {'nome': 'sala', 'poly': [[0, 0], [4.5, 0], [4.5, 3.6], [0, 3.6]], 'area': 16.2}]}}
    saida.extend(m for m in mobilia(unidade)[0] if m['tipo'] == 'sofa')
print(json.dumps(saida))`;
  const moveis = JSON.parse(execFileSync('python', ['-c', codigo], {cwd: root, encoding: 'utf8'}));
  const b = modular();
  assert.equal(moveis.length, 2 * (Object.keys(pecas).filter(k => k.startsWith('sofa_mod_')).length + 1));
  for (const m of moveis) {
    const g = b.geoDeParts(b.sofaParam(m), 0xCFC6B8);
    g.computeBoundingBox();
    const largura = g.boundingBox.max.x - g.boundingBox.min.x;
    assert.ok(Math.abs(m.w - largura) < 1e-5, `${m.estilo}: exportou ${m.w}, renderizou ${largura}`);
    const w = m.rot % 2 ? m.d : largura, d = m.rot % 2 ? largura : m.d;
    assert.ok(m.p[0] - w / 2 >= 0.065 && m.p[0] + w / 2 <= 4.5 - 0.065);
    assert.ok(m.p[1] - d / 2 >= 0.065 && m.p[1] + d / 2 <= 3.6 - 0.065);
    g.dispose();
  }
});
