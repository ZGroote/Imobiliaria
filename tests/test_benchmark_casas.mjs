import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { CASAS, construirCasa, identidadeArtefato, auditarLegado, executarBenchmark } from '../tools/benchmark_10_casas.mjs';

const sha256 = (x) => createHash('sha256').update(x).digest('hex');

test('as dez fixtures sintéticas passam pelo validador normativo', () => {
  const leituras = CASAS.map((c) => JSON.parse(construirCasa(c)));
  const res = spawnSync('python', ['-c', `import json,sys
from pipeline.validar_leitura import validar
errors=[(d['id'],validar(d)) for d in json.load(sys.stdin)]
bad=[(i,e) for i,e in errors if e]
print(json.dumps(bad));sys.exit(bool(bad))`], {
    input: JSON.stringify(leituras), encoding: 'utf8', cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  assert.equal(res.status, 0, res.stdout + res.stderr);
});

test('alteração do HTML é divergência e registro legado preserva relatório original', () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'benchmark-identidade-'));
  try {
    const destino = path.join(pasta, 'casa-01', 'maquete');
    fs.mkdirSync(destino, { recursive: true });
    const original = Buffer.from('<html>original</html>');
    fs.writeFileSync(path.join(destino, 'maquete.html'), original);
    const relatorio = JSON.stringify({ artefato: { bytes: original.length, sha256: sha256(original) } });
    fs.writeFileSync(path.join(destino, 'relatorio.json'), relatorio);
    assert.equal(identidadeArtefato(destino).confere, true);
    fs.writeFileSync(path.join(destino, 'maquete.html'), '<html>luz alterada depois</html>');
    assert.equal(identidadeArtefato(destino).confere, false);
    const registro = auditarLegado(pasta, true);
    assert.equal(registro.casas[0].confere, false);
    assert.equal(registro.casas[0].geometriaReverificada, false);
    assert.equal(fs.readFileSync(path.join(destino, 'relatorio.json'), 'utf8'), relatorio);
    assert.throws(() => auditarLegado(pasta, true), /EEXIST/);
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});

test('benchmark recusa destino ocupado sem substituir o que já existe', () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'benchmark-preserva-'));
  try {
    fs.writeFileSync(path.join(pasta, 'anterior.txt'), 'preservar');
    assert.throws(() => executarBenchmark(pasta, 1), /Destino ocupado/);
    assert.equal(fs.readFileSync(path.join(pasta, 'anterior.txt'), 'utf8'), 'preservar');
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});
