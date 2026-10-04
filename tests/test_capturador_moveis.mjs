import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  iniciar, aplicar, desfazer, refazer, exportar, exportarMoveis
} from '../painel/src/components/construtor-planta/modelo.ts';
import { CATALOGO_MOVEIS, obterDefinicaoMovel } from '../painel/src/components/construtor-planta/catalogoMoveis.ts';

const rootDir = fileURLToPath(new URL('..', import.meta.url));

function pythonValida(jsonString) {
  const res = spawnSync('python', ['-c', 'import json, sys, pipeline.validar_leitura as v; d=json.load(sys.stdin); errs=v.validar(d); sys.exit(0 if not errs else 1)'], {
    input: jsonString,
    encoding: 'utf8',
    cwd: rootDir
  });
  return res.status === 0;
}

test('Catálogo de Móveis: contém peças arquitetônicas essenciais com dimensões normativas e tipos 3D', () => {
  assert.ok(CATALOGO_MOVEIS.length >= 10, 'deve ter pelo menos 10 peças no catálogo');

  const pecasEsperadas = [
    'cama-casal', 'cama-solteiro', 'sofa-3l', 'sofa-2l',
    'mesa-jantar-4l', 'geladeira', 'fogao-4b', 'pia-cozinha',
    'vaso-sanitario', 'box-chuveiro', 'maquina-lavar'
  ];

  for (const tipo of pecasEsperadas) {
    const item = obterDefinicaoMovel(tipo);
    assert.ok(item, `Peça ${tipo} deve existir no catálogo`);
    assert.ok(item.widthMm > 0, `${tipo} deve ter largura > 0`);
    assert.ok(item.depthMm > 0, `${tipo} deve ter profundidade > 0`);
    assert.ok(item.tipo3D, `${tipo} deve mapear para um tipo 3D`);
  }
});

test('Fluxo de Móveis: adicionar, mover, rotacionar, deletar, undo/redo e exportar dados', () => {
  let s = iniciar('imovel-teste-moveis');
  s = aplicar(s, {
    type: 'add',
    name: 'Quarto',
    widthMm: 3500,
    depthMm: 3000,
    ceilingHeightMm: 2700
  });

  assert.equal(s.present.furniture?.length ?? 0, 0);

  // 1. Adicionar Cama de Casal
  const defCama = obterDefinicaoMovel('cama-casal');
  s = aplicar(s, {
    type: 'furniture-add',
    item: {
      tipoCatalogo: defCama.id,
      tipo3D: defCama.tipo3D,
      nome: defCama.nome,
      xMm: 500,
      yMm: 500,
      widthMm: defCama.widthMm,
      depthMm: defCama.depthMm,
      rotDegrees: 0,
      cor: defCama.corPadrao
    }
  });

  assert.equal(s.present.furniture.length, 1);
  const movel1 = s.present.furniture[0];
  assert.equal(movel1.id, 'm1');
  assert.equal(movel1.nome, 'Cama Casal');
  assert.equal(movel1.xMm, 500);
  assert.equal(movel1.yMm, 500);

  // 2. Mover móvel com snap
  s = aplicar(s, {
    type: 'furniture-move',
    id: 'm1',
    xMm: 1000,
    yMm: 800
  });
  assert.equal(s.present.furniture[0].xMm, 1000);
  assert.equal(s.present.furniture[0].yMm, 800);

  // 3. Rotacionar móvel (passo de 90°)
  s = aplicar(s, {
    type: 'furniture-rotate',
    id: 'm1',
    deltaDegrees: 90
  });
  assert.equal(s.present.furniture[0].rotDegrees, 90);

  // 4. Adicionar Guarda-Roupa
  const defArmario = obterDefinicaoMovel('guardaroupa');
  s = aplicar(s, {
    type: 'furniture-add',
    item: {
      tipoCatalogo: defArmario.id,
      tipo3D: defArmario.tipo3D,
      nome: defArmario.nome,
      xMm: 1500,
      yMm: 200,
      widthMm: defArmario.widthMm,
      depthMm: defArmario.depthMm,
      rotDegrees: 0,
      cor: defArmario.corPadrao
    }
  });
  assert.equal(s.present.furniture.length, 2);

  // 5. Testar Desfazer (Undo)
  s = desfazer(s);
  assert.equal(s.present.furniture.length, 1);
  assert.equal(s.present.furniture[0].id, 'm1');

  // 6. Testar Refazer (Redo)
  s = refazer(s);
  assert.equal(s.present.furniture.length, 2);

  // 7. Deletar primeiro móvel
  s = aplicar(s, {
    type: 'furniture-delete',
    id: 'm1'
  });
  assert.equal(s.present.furniture.length, 1);
  assert.equal(s.present.furniture[0].id, 'm2');

  // 8. Exportar Companion moveis.json
  const moveisJson = exportarMoveis(s);
  const parsedMoveis = JSON.parse(moveisJson);
  assert.equal(parsedMoveis._gerado_por, 'capturador-2d');
  assert.equal(parsedMoveis.moveis.length, 1);
  assert.equal(parsedMoveis.moveis[0].tipo, 'guardaroupa');
  assert.equal(parsedMoveis.moveis[0].nome, 'Guarda-Roupa');

  // 9. Garantir que exportar() e documento() NÃO vazam furniture para leitura.json
  const leituraJson = exportar(s);
  const parsedLeitura = JSON.parse(leituraJson);
  assert.equal(parsedLeitura.furniture, undefined, 'leitura.json não deve ter additionalProperties "furniture"');
  assert.ok(pythonValida(leituraJson), 'leitura.json gerado deve ser 100% válido pelo schema normativo M1-0');
});

test('Preservação de Móveis: operações nos cômodos (adicionar, mesclar, mover) não perdem os móveis', () => {
  let s = iniciar('imovel-preservacao');
  s = aplicar(s, { type: 'add', name: 'Sala A', widthMm: 3000, depthMm: 3000, ceilingHeightMm: 2600, xMm: 0, yMm: 0 });
  s = aplicar(s, { type: 'add', name: 'Sala B', widthMm: 3000, depthMm: 3000, ceilingHeightMm: 2600, xMm: 3000, yMm: 0 });

  // Adiciona sofá
  const sofa = obterDefinicaoMovel('sofa-3');
  s = aplicar(s, {
    type: 'furniture-add',
    item: {
      tipoCatalogo: sofa.id,
      tipo3D: sofa.tipo3D,
      nome: sofa.nome,
      xMm: 500,
      yMm: 500,
      widthMm: sofa.widthMm,
      depthMm: sofa.depthMm,
      rotDegrees: 0,
      cor: sofa.corPadrao
    }
  });

  assert.equal(s.present.furniture?.length, 1);

  // Mesclar Salas A e B
  s = aplicar(s, { type: 'merge', roomAId: 'c1', roomBId: 'c2' });
  assert.equal(s.present.furniture?.length, 1, 'Móvel deve ser preservado após mesclar cômodos');
  assert.equal(s.present.furniture[0].id, 'm1');

  // Adicionar cômodo adicional
  s = aplicar(s, { type: 'add', name: 'Cozinha', widthMm: 2500, depthMm: 3000, ceilingHeightMm: 2600, xMm: 0, yMm: 3000 });
  assert.equal(s.present.furniture?.length, 1, 'Móvel deve ser preservado após adicionar novo cômodo');

  // Mover cômodo
  s = aplicar(s, { type: 'move', id: 'c3', xMm: 500, yMm: 3500 });
  assert.equal(s.present.furniture?.length, 1, 'Móvel deve ser preservado após mover cômodo');
});
