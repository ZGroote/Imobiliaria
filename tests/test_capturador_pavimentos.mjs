import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {iniciar, aplicar, exportar, problemas}
  from '../painel/src/components/construtor-planta/modelo.ts';

test('sobrado: térreo com escada e superior independente produzem JSONs válidos no validador M1-0', () => {
  // 1. Térreo (Andar 0): Sala, Cozinha e Escada (1000 x 2800 mm)
  let terreo = iniciar('leitura-terreo');
  terreo = aplicar(terreo, {type: 'add', name: 'Sala', widthMm: 4000, depthMm: 5000, ceilingHeightMm: 2700, xMm: 0, yMm: 0});
  terreo = aplicar(terreo, {type: 'add', name: 'Cozinha', widthMm: 3000, depthMm: 5000, ceilingHeightMm: 2700, xMm: 4000, yMm: 0});
  terreo = aplicar(terreo, {type: 'add', name: 'Escada', widthMm: 1000, depthMm: 2800, ceilingHeightMm: 2700, xMm: 0, yMm: 5000});

  assert.equal(problemas(terreo.present).length, 0);
  const jsonTerreo = exportar(terreo);

  // 2. Superior (Andar 1): Quarto 1, Quarto 2, Banheiro e Corredor
  let superior = iniciar('leitura-superior');
  superior = aplicar(superior, {type: 'add', name: 'Quarto 1', widthMm: 3500, depthMm: 3500, ceilingHeightMm: 2700, xMm: 0, yMm: 0});
  superior = aplicar(superior, {type: 'add', name: 'Quarto 2', widthMm: 3500, depthMm: 3500, ceilingHeightMm: 2700, xMm: 3500, yMm: 0});
  superior = aplicar(superior, {type: 'add', name: 'Banheiro', widthMm: 2000, depthMm: 2500, ceilingHeightMm: 2700, xMm: 0, yMm: 3500});

  assert.equal(problemas(superior.present).length, 0);
  const jsonSuperior = exportar(superior);

  // 3. Validação real contra o validador Python normativo do pipeline (M1-0)
  const dir = mkdtempSync(join(tmpdir(), 'sobrado-'));
  try {
    const fileTerreo = join(dir, 'terreo.json');
    const fileSuperior = join(dir, 'superior.json');
    writeFileSync(fileTerreo, jsonTerreo, 'utf8');
    writeFileSync(fileSuperior, jsonSuperior, 'utf8');

    const resTerreo = execFileSync('python', ['-m', 'pipeline.validar_leitura', fileTerreo], {encoding: 'utf8'});
    assert.equal(JSON.parse(resTerreo).valid, true);

    const resSuperior = execFileSync('python', ['-m', 'pipeline.validar_leitura', fileSuperior], {encoding: 'utf8'});
    assert.equal(JSON.parse(resSuperior).valid, true);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
