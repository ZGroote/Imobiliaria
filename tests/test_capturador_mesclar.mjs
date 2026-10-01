import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {iniciar, aplicar, desfazer, refazer, exportar, carregar, relacoes, mesmoGrupoMesclado}
  from '../painel/src/components/construtor-planta/modelo.ts';

const add = (s, name, w, d, pos={}) => aplicar(s, {type:'add', name, widthMm:w, depthMm:d, ceilingHeightMm:2700, ...pos});
const rootDir = fileURLToPath(new URL('..', import.meta.url));

function pythonValida(jsonString) {
  const res = spawnSync('python', ['-c', 'import json, sys, pipeline.validar_leitura as v; d=json.load(sys.stdin); errs=v.validar(d); sys.exit(0 if not errs else 1)'], {
    input: jsonString,
    encoding: 'utf8',
    cwd: rootDir
  });
  return res.status === 0;
}

test('M1.1-C2: mesclar dois comodos encostados gera leitura 1.1.0 valida, remove parede interna e sincroniza nome', () => {
  let s = add(iniciar('leitura-mesclar'), 'Sala', 4000, 3000, {xMm: 0, yMm: 0});
  s = add(s, 'Estar', 2000, 2000, {xMm: 0, yMm: 3000}); // encostado ao norte da sala
  s = add(s, 'Quarto', 3000, 3000, {xMm: 4000, yMm: 0}); // encostado a leste da sala

  // Antes de mesclar: 1.0.0, todas as relações adjacent
  const docAntes = JSON.parse(exportar(s));
  assert.equal(docAntes.schemaVersion, '1.0.0');
  assert.equal(docAntes.relations.every(r => r.kind === 'adjacent'), true);

  // Mesclar Sala (c1) com Estar (c2)
  const mesclado = aplicar(s, {type: 'merge', roomAId: 'c1', roomBId: 'c2'});
  const docMesclado = JSON.parse(exportar(mesclado));

  assert.equal(docMesclado.schemaVersion, '1.1.0');
  // Os dois cômodos agora têm o mesmo nome
  assert.equal(docMesclado.rooms.find(r => r.id === 'c1').name, 'Sala');
  assert.equal(docMesclado.rooms.find(r => r.id === 'c2').name, 'Sala');
  assert.equal(docMesclado.rooms.find(r => r.id === 'c3').name, 'Quarto');

  // Relação c1-c2 virou merged; c1-c3 continua adjacent
  const relC1C2 = docMesclado.relations.find(r => (r.wallA === 'c1-north' && r.wallB === 'c2-south') || (r.wallA === 'c2-south' && r.wallB === 'c1-north'));
  assert.ok(relC1C2);
  assert.equal(relC1C2.kind, 'merged');

  const relC1C3 = docMesclado.relations.find(r => (r.wallA === 'c1-east' && r.wallB === 'c3-west') || (r.wallA === 'c3-west' && r.wallB === 'c1-east'));
  assert.ok(relC1C3);
  assert.equal(relC1C3.kind, 'adjacent');

  // Validador normativo em Python aceita perfeitamente
  assert.equal(pythonValida(exportar(mesclado)), true);

  // Round-trip com carregar preserva integridade byte a byte
  const carregado = carregar(docMesclado);
  assert.deepEqual(JSON.parse(exportar(carregado)), docMesclado);
});

test('M1.1-C2: undo restaura 1.0.0 e nomes originais; redo reaplica 1.1.0', () => {
  let s = add(iniciar('leitura-undo'), 'Sala', 4000, 3000, {xMm: 0, yMm: 0});
  s = add(s, 'Estar', 2000, 2000, {xMm: 0, yMm: 3000});

  const mesclado = aplicar(s, {type: 'merge', roomAId: 'c1', roomBId: 'c2'});
  assert.equal(JSON.parse(exportar(mesclado)).schemaVersion, '1.1.0');

  const desfeito = desfazer(mesclado);
  const docDesfeito = JSON.parse(exportar(desfeito));
  assert.equal(docDesfeito.schemaVersion, '1.0.0');
  assert.equal(docDesfeito.rooms.find(r => r.id === 'c1').name, 'Sala');
  assert.equal(docDesfeito.rooms.find(r => r.id === 'c2').name, 'Estar');
  assert.equal(docDesfeito.relations[0].kind, 'adjacent');

  const refeito = refazer(desfeito);
  assert.equal(JSON.parse(exportar(refeito)).schemaVersion, '1.1.0');
});

test('M1.1-C2: separar (unmerge) desfaz a mesclagem e volta para 1.0.0', () => {
  let s = add(iniciar('leitura-unmerge'), 'Sala', 4000, 3000, {xMm: 0, yMm: 0});
  s = add(s, 'Estar', 2000, 2000, {xMm: 0, yMm: 3000});

  const mesclado = aplicar(s, {type: 'merge', roomAId: 'c1', roomBId: 'c2'});
  assert.equal(JSON.parse(exportar(mesclado)).schemaVersion, '1.1.0');

  const separado = aplicar(mesclado, {type: 'unmerge', roomId: 'c2'});
  const docSeparado = JSON.parse(exportar(separado));
  assert.equal(docSeparado.schemaVersion, '1.0.0');
  assert.equal(docSeparado.relations[0].kind, 'adjacent');
  assert.equal(mesmoGrupoMesclado(separado.present.mergedGroups, 'c1', 'c2'), false);
});

test('M1.1-C2: editar nome de cômodo mesclado sincroniza todas as partes', () => {
  let s = add(iniciar('leitura-sync-nome'), 'Sala', 4000, 3000, {xMm: 0, yMm: 0});
  s = add(s, 'Estar', 2000, 2000, {xMm: 0, yMm: 3000});
  s = aplicar(s, {type: 'merge', roomAId: 'c1', roomBId: 'c2'});

  const editado = aplicar(s, {type: 'edit', id: 'c1', name: 'Living Integrado', widthMm: 4000, depthMm: 3000, ceilingHeightMm: 2700});
  const doc = JSON.parse(exportar(editado));
  assert.equal(doc.rooms.find(r => r.id === 'c1').name, 'Living Integrado');
  assert.equal(doc.rooms.find(r => r.id === 'c2').name, 'Living Integrado');
  assert.equal(pythonValida(exportar(editado)), true);
});

test('M1.1-C2: guardrails - não mescla sem contato, nem com abertura divisória, nem abertura em trecho mesclado', () => {
  let s = add(iniciar('leitura-guardrails'), 'Sala', 4000, 3000, {xMm: 0, yMm: 0});
  s = add(s, 'Solto', 2000, 2000, {xMm: 10000, yMm: 10000});

  // Não encostados
  assert.throws(() => aplicar(s, {type: 'merge', roomAId: 'c1', roomBId: 'c2'}), /encostados parede com parede/);

  // Com porta entre eles
  let s2 = add(iniciar('leitura-com-porta'), 'Sala', 4000, 3000, {xMm: 0, yMm: 0});
  s2 = add(s2, 'Quarto', 3000, 3000, {xMm: 4000, yMm: 0});
  s2 = aplicar(s2, {type: 'opening-add', kind: 'door', wallId: 'c1-east', offsetMm: 500, widthMm: 800, heightMm: 2100, sillMm: 0});
  assert.throws(() => aplicar(s2, {type: 'merge', roomAId: 'c1', roomBId: 'c2'}), /Remova as portas e janelas da parede divisória/);

  // Tentar colocar abertura em parede mesclada
  let s3 = add(iniciar('leitura-sem-porta'), 'Sala', 4000, 3000, {xMm: 0, yMm: 0});
  s3 = add(s3, 'Estar', 2000, 2000, {xMm: 0, yMm: 3000});
  s3 = aplicar(s3, {type: 'merge', roomAId: 'c1', roomBId: 'c2'});
  assert.throws(() => aplicar(s3, {type: 'opening-add', kind: 'door', wallId: 'c1-north', offsetMm: 200, widthMm: 800, heightMm: 2100, sillMm: 0}), /trecho mesclado/);
});
test('M1.1-C2: unmerge e delete em grupo A-B-C tratam peca-ponte e preservam subconjuntos conectados', () => {
  // Configuração:
  // D: (0, 0), 9000 x 3000 (Corredor independente ao sul, mantém o conjunto conectado ao deletar peças)
  // A: (0, 3000), 3000 x 3000
  // B: (3000, 3000), 3000 x 3000 (ponte)
  // C: (6000, 3000), 3000 x 3000
  const criarCenario = () => {
    let s = add(iniciar('leitura-ponte'), 'Corredor', 9000, 3000, {xMm: 0, yMm: 0});
    s = add(s, 'Sala', 3000, 3000, {xMm: 0, yMm: 3000}); // c2
    s = add(s, 'Sala', 3000, 3000, {xMm: 3000, yMm: 3000}); // c3 (ponte)
    s = add(s, 'Sala', 3000, 3000, {xMm: 6000, yMm: 3000}); // c4
    s = aplicar(s, {type: 'merge', roomAId: 'c2', roomBId: 'c3'});
    s = aplicar(s, {type: 'merge', roomAId: 'c3', roomBId: 'c4'});
    assert.deepEqual(s.present.mergedGroups, [['c2', 'c3', 'c4']]);
    return s;
  };

  // 1. Separar a peça-ponte B (c3): A (c2) e C (c4) não se tocam, nenhum grupo inválido sobra
  const s1 = criarCenario();
  const sepB = aplicar(s1, {type: 'unmerge', roomId: 'c3'});
  assert.equal(sepB.present.mergedGroups, undefined);
  const docSepB = JSON.parse(exportar(sepB));
  assert.equal(docSepB.schemaVersion, '1.0.0');
  assert.equal(docSepB.relations.every(r => r.kind === 'adjacent'), true);
  assert.equal(pythonValida(exportar(sepB)), true);

  // 2. Separar a ponta A (c2): B (c3) e C (c4) continuam se tocando e permanecem mesclados
  const s2 = criarCenario();
  const sepA = aplicar(s2, {type: 'unmerge', roomId: 'c2'});
  assert.deepEqual(sepA.present.mergedGroups, [['c3', 'c4']]);
  const docSepA = JSON.parse(exportar(sepA));
  assert.equal(docSepA.schemaVersion, '1.1.0');
  const relC3C4 = docSepA.relations.find(r => (r.wallA === 'c3-east' && r.wallB === 'c4-west') || (r.wallA === 'c4-west' && r.wallB === 'c3-east'));
  assert.equal(relC3C4.kind, 'merged');
  assert.equal(pythonValida(exportar(sepA)), true);

  // 3. Excluir a peça-ponte B (c3): mesma semântica, A e C deixam de ser grupo
  const s3 = criarCenario();
  const delB = aplicar(s3, {type: 'delete', id: 'c3'});
  assert.equal(delB.present.mergedGroups, undefined);
  const docDelB = JSON.parse(exportar(delB));
  assert.equal(docDelB.schemaVersion, '1.0.0');
  assert.equal(docDelB.relations.every(r => r.kind === 'adjacent'), true);
  assert.equal(pythonValida(exportar(delB)), true);

  // 4. Excluir a ponta A (c2): B e C continuam mesclados
  const s4 = criarCenario();
  const delA = aplicar(s4, {type: 'delete', id: 'c2'});
  assert.deepEqual(delA.present.mergedGroups, [['c3', 'c4']]);
  const docDelA = JSON.parse(exportar(delA));
  assert.equal(docDelA.schemaVersion, '1.1.0');
  assert.equal(pythonValida(exportar(delA)), true);
});

test('M1.1-C2: regressao - merge recusa se houver abertura em qualquer divisoria que virara merged', () => {
  // Cenário:
  // A | C
  // --| C
  // B | C
  // A: (0, 0), 3000 x 3000
  // B: (0, 3000), 3000 x 3000
  // C: (3000, 0), 3000 x 6000 (toca A no leste e B no leste)
  let s = add(iniciar('leitura-regressao-abertura'), 'Sala A', 3000, 3000, {xMm: 0, yMm: 0});
  s = add(s, 'Sala B', 3000, 3000, {xMm: 0, yMm: 3000});
  s = add(s, 'Quarto C', 3000, 6000, {xMm: 3000, yMm: 0});

  // A (c1) + B (c2) já são um cômodo composto
  s = aplicar(s, {type: 'merge', roomAId: 'c1', roomBId: 'c2'});
  assert.deepEqual(s.present.mergedGroups, [['c1', 'c2']]);

  // Existe uma porta entre B (c2) e C (c3) na divisória B-C
  s = aplicar(s, {
    type: 'opening-add',
    kind: 'door',
    wallId: 'c2-east',
    offsetMm: 1000,
    widthMm: 800,
    heightMm: 2100,
    sillMm: 0,
  });
  assert.equal(s.present.openings.length, 1);
  assert.equal(s.present.openings[0].pairedWallId, 'c3-west');

  // Tentativa de mesclar A (c1) + C (c3) deve recusar antes de alterar a sessão
  assert.throws(
    () => aplicar(s, {type: 'merge', roomAId: 'c1', roomBId: 'c3'}),
    /Remova as portas e janelas da parede divisória antes de mesclar/
  );

  // Também recusa se a ordem dos argumentos for C (c3) + A (c1)
  assert.throws(
    () => aplicar(s, {type: 'merge', roomAId: 'c3', roomBId: 'c1'}),
    /Remova as portas e janelas da parede divisória antes de mesclar/
  );

  // A sessão NÃO foi alterada
  assert.equal(s.present.openings.length, 1);
  assert.deepEqual(s.present.mergedGroups, [['c1', 'c2']]);

  // Removendo a porta entre B e C, o merge passa e valida normativamente no Python
  s = aplicar(s, {type: 'opening-delete', id: 'a1'});
  const mescladoABC = aplicar(s, {type: 'merge', roomAId: 'c1', roomBId: 'c3'});
  assert.deepEqual(mescladoABC.present.mergedGroups, [['c1', 'c2', 'c3']]);
  assert.equal(pythonValida(exportar(mescladoABC)), true);
});
