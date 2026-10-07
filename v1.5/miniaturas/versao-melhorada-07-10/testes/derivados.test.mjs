// Testes rápidos da v4 (sem navegador): formato binário, codificação da luz, perfis de
// qualidade e o site montado.   npm test   (dentro de versao-melhorada-07-10/)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { leMBN1 } from '../fonte/binario.js';
import { palpite, PERFIS } from '../fonte/qualidade.js';
import { decodificaGLSL } from '../fonte/luz.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA = path.resolve(AQUI, '..');
const DER = path.join(PASTA, 'derivados', 'monte-dos-cedros-37');
const rel = JSON.parse(fs.readFileSync(path.join(DER, 'relatorio.json'), 'utf8'));
const le = f => { const g = fs.readFileSync(path.join(DER, f)); const u = zlib.gunzipSync(g); return leMBN1(u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength)); };

test('predio.bin: as 35 malhas e os 64 grupos do Blender, com arrays coerentes', () => {
  const { cab, arrays } = le('predio.bin');
  assert.equal(Object.keys(cab.geometries).length, 35);
  assert.equal(cab.groups.length, 64);
  for (const [nome, g] of Object.entries(cab.geometries)) {
    const n = arrays[g.position].length / 3;
    assert.equal(arrays[g.normal].length, n * 3, nome);
    assert.equal(arrays[g.uv].length, n * 2, nome);
    if (g.index) assert.ok(Math.max(...arrays[g.index]) < n, nome);
  }
});

test('exterior-uv.bin: indexado, com os 367.380 cantos do original e UVs no atlas', () => {
  const { cab, arrays } = le('exterior-uv.bin');
  const cantos = cab.entradas.reduce((s, e) => s + e.nCantos, 0);
  const unicos = cab.entradas.reduce((s, e) => s + e.nUnicos, 0);
  assert.equal(cantos, 367380);
  assert.equal(unicos, rel.exteriorUV.unicos);
  assert.ok(unicos < cantos);
  for (const e of cab.entradas) for (let t = 0; t < e.nCantos; t++) assert.ok(arrays.tri[e.tri + t] < e.nUnicos);
  for (const e of cab.entradas) for (let j = 0; j < e.nUnicos; j++) assert.ok(arrays.src[e.src + j] < e.sourceVertexCount);
});

test('interior-uv.bin: os 153.606 cantos e a correção de molduras/batentes preservada', () => {
  const { cab, arrays } = le('interior-uv.bin');
  assert.equal(cab.entradas.reduce((s, e) => s + e.nCantos, 0), 153606);
  assert.equal(arrays.uv1.length, 153606 * 2);
  assert.ok(cab.entradas.some(e => e.correctedWorldMatrix));
  assert.ok(cab.entradas.some(e => e.correctedPosition));
});

test('atlas externo reempacotado: mesma densidade, 1/5 dos texels', () => {
  const r = rel.exteriorLuz.reempacotamento;
  assert.ok(r.texelsAtlas < r.texelsOrigem / 4);
  assert.equal(r.margem, 4);
  assert.ok(r.ocupacao > 0.9);
});

test('compressão UASTC: erro médio abaixo de 1 código de tela nos dois atlas', () => {
  for (const p of ['exteriorLuz', 'interiorLuz']) {
    assert.ok(rel[p].cheia.erro.codigosTelaMedio < 1, p);
    assert.ok(rel[p].cheia.erro.codigosTelaP99 <= 8, p);
  }
});

test('decodificação no shader = a do gerador (log2 com K e faixa)', () => {
  const meta = JSON.parse(fs.readFileSync(path.join(DER, 'luz.json'), 'utf8'));
  for (const m of Object.values(meta)) {
    const glsl = decodificaGLSL(m);
    const [, L, invK] = glsl.match(/\* ([\d.]+)\) - 1\.0\) \* ([\d.]+)\)/).map(Number);
    for (const t of [0, 0.25, 0.5, 1]) {
      const v = (2 ** (t * L) - 1) * invK;
      const esperado = (2 ** (t * Math.log2(1 + m.k * m.faixa)) - 1) / m.k;
      assert.ok(Math.abs(v - esperado) <= 1e-5 * Math.max(1, esperado));
    }
    assert.ok(Math.abs((2 ** L - 1) * invK - m.faixa) < 1e-3, 't = 1 é a faixa toda');
  }
});

test('perfis: software cai no baixo; celular fraco no baixo; computador com GPU dedicada no alto', () => {
  assert.equal(palpite({ gpu: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))', toque: false }), 'baixo');
  assert.equal(palpite({ gpu: 'Mali-G52', toque: true }), 'baixo');
  assert.equal(palpite({ gpu: 'Adreno (TM) 610', toque: true }), 'baixo');
  assert.equal(palpite({ gpu: 'Adreno (TM) 660', toque: true }), 'medio');
  assert.equal(palpite({ gpu: 'Adreno (TM) 740', toque: true }), 'alto');
  assert.equal(palpite({ gpu: 'Apple GPU', toque: true }), 'medio');
  assert.equal(palpite({ gpu: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)', toque: false }), 'alto');
  assert.equal(palpite({ gpu: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)', toque: false }), 'medio');
  // o médio é o padrão aprovado para celular: sem MSAA, DPR 1,25, sombra 1024
  assert.equal(PERFIS.medio.msaa, false); assert.equal(PERFIS.medio.dprToque, 1.25); assert.equal(PERFIS.medio.solMapa, 1024);
  assert.equal(PERFIS.alto.solMapa, 2048); assert.equal(PERFIS.alto.msaa, true);
});

test('site montado: arquivos versionados batem com o manifesto, sem "Ver mapa" nem offline', { skip: !fs.existsSync(path.join(PASTA, 'publicado')) }, () => {
  const man = JSON.parse(fs.readFileSync(path.join(PASTA, 'publicacao.json'), 'utf8'));
  for (const [rel, a] of Object.entries(man.arquivos)) {
    const b = fs.readFileSync(path.join(PASTA, 'publicado', rel));
    assert.equal(crypto.createHash('sha256').update(b).digest('hex'), a.sha256, rel);
  }
  const html = fs.readFileSync(path.join(PASTA, 'publicado', man.pagina), 'utf8');
  assert.ok(!html.includes('id="verMapa"') && !html.includes('id="cortina"'));
  assert.ok(!/<script id="__moveis"/.test(html), 'a biblioteca de móveis desce sob demanda');
  assert.ok(Buffer.byteLength(html) < 40_000, 'HTML pequeno');
});
