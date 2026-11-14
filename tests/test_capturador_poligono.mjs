import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  iniciar, aplicar, desfazer, refazer, exportar,
  decomporPoligonoOrtogonal, contornoPoligono
} from '../painel/src/components/construtor-planta/modelo.ts';

const rootDir = fileURLToPath(new URL('..', import.meta.url));

function pythonValida(jsonString) {
  const res = spawnSync('python', ['-c', 'import json, sys, pipeline.validar_leitura as v; d=json.load(sys.stdin); errs=v.validar(d); sys.exit(0 if not errs else 1)'], {
    input: jsonString,
    encoding: 'utf8',
    cwd: rootDir
  });
  return res.status === 0;
}

test('Ferramenta Parede: forma personalizada irregular do usuário é decomposta, validada e unificada', () => {
  // Forma do desenho do usuário (10 vértices ortogonais):
  // Corredor à esquerda descendo, corpo central, recorte superior
  const formaUsuario = [
    {x: 0, y: 0},
    {x: 1000, y: 0},
    {x: 1000, y: 3000},
    {x: 4000, y: 3000},
    {x: 4000, y: 5000},
    {x: 3000, y: 5000},
    {x: 3000, y: 6000},
    {x: 1000, y: 6000},
    {x: 1000, y: 5000},
    {x: 0, y: 5000}
  ];

  // 1. Decomposição em retângulos ortogonais mínimos
  const retangulos = decomporPoligonoOrtogonal(formaUsuario);
  assert.equal(retangulos.length, 3);
  assert.deepEqual(retangulos, [
    { xMm: 0, yMm: 0, widthMm: 1000, depthMm: 5000 },
    { xMm: 1000, yMm: 3000, widthMm: 3000, depthMm: 2000 },
    { xMm: 1000, yMm: 5000, widthMm: 2000, depthMm: 1000 }
  ]);

  // 2. Reconstrução do contorno unificado (sem divisões internas)
  const contorno = contornoPoligono(retangulos);
  assert.ok(contorno);
  assert.equal(contorno.length, 10);

  // 3. Aplicação na sessão via add-poligono
  let s = iniciar('leitura-poligono-custom');
  s = aplicar(s, {
    type: 'add-poligono',
    name: 'Sala',
    ceilingHeightMm: 2700,
    retangulos
  });

  assert.equal(s.present.rooms.length, 3);
  assert.ok(s.present.mergedGroups);
  assert.equal(s.present.mergedGroups.length, 1);
  assert.deepEqual(s.present.mergedGroups[0], ['c1', 'c2', 'c3']);

  // 4. Validação estrita pelo Python
  const json = exportar(s);
  assert.ok(pythonValida(json), 'O JSON gerado pela forma irregular deve passar no validador normativo sem erros');

  // 5. Movimentação em bloco do cômodo irregular
  const posAntes = s.present.rooms.map(r => ({x: r.xMm, y: r.yMm}));
  s = aplicar(s, { type: 'move', id: 'c1', xMm: 500, yMm: 200 }); // delta dx=+500, dy=+200
  const posDepois = s.present.rooms.map(r => ({x: r.xMm, y: r.yMm}));
  for (let i = 0; i < 3; i++) {
    assert.equal(posDepois[i].x, posAntes[i].x + 500);
    assert.equal(posDepois[i].y, posAntes[i].y + 200);
  }

  // 6. Desfazer move e desfazer add-poligono (atômico)
  s = desfazer(s); // desfaz o move
  assert.deepEqual(s.present.rooms.map(r => ({x: r.xMm, y: r.yMm})), posAntes);
  s = desfazer(s); // desfaz o cômodo inteiro de uma vez
  assert.equal(s.present.rooms.length, 0);

  // 7. Refazer
  s = refazer(s);
  assert.equal(s.present.rooms.length, 3);
  assert.ok(pythonValida(exportar(s)));

  // 8. Excluir uma parte do cômodo composto preserva as partes restantes conectadas
  s = aplicar(s, { type: 'delete', id: 'c3' });
  assert.equal(s.present.rooms.length, 2);
  assert.deepEqual(s.present.mergedGroups, [['c1', 'c2']]);
  assert.ok(pythonValida(exportar(s)));
});
