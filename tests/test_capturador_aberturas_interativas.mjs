import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {iniciar,aplicar,desfazer,refazer,exportar}
  from '../painel/src/components/construtor-planta/modelo.ts';

function setupCasa(){
  let s = iniciar('leitura-aberturas-interativas');
  s = aplicar(s, {type: 'add', name: 'Sala', widthMm: 5000, depthMm: 4000, ceilingHeightMm: 2700});
  // Adiciona porta na parede sul (offset 1000mm, largura 800mm)
  s = aplicar(s, {
    type: 'opening-add',
    kind: 'door',
    wallId: 'c1-south',
    offsetMm: 1000,
    widthMm: 800,
    heightMm: 2100,
    sillMm: 0
  });
  return s;
}

function validarPython(s){
  const dir = mkdtempSync(join(tmpdir(), 'aberturas-interativas-'));
  try{
    const file = join(dir, 'leitura.json');
    writeFileSync(file, exportar(s));
    const out = JSON.parse(execFileSync('python', ['-m', 'pipeline.validar_leitura', file], {encoding: 'utf8'}));
    assert.deepEqual(out, {valid: true, errors: []});
  }finally{
    rmSync(dir, {recursive: true, force: true});
  }
}

test('Aberturas móveis: deslocamento (nudge) ao longo da parede com cotas exatas', () => {
  let s = setupCasa();
  const o = s.present.openings[0];
  assert.equal(o.offsetMm, 1000);

  // Mover +50 mm (+5 cm)
  s = aplicar(s, {type: 'opening-edit', id: o.id, ...o, offsetMm: o.offsetMm + 50});
  assert.equal(s.present.openings[0].offsetMm, 1050);

  // Mover -100 mm (-10 cm)
  s = aplicar(s, {type: 'opening-edit', id: o.id, ...s.present.openings[0], offsetMm: 950});
  assert.equal(s.present.openings[0].offsetMm, 950);

  // Desfazer reverte exatamente a 1050 e depois a 1000
  s = desfazer(s);
  assert.equal(s.present.openings[0].offsetMm, 1050);
  s = desfazer(s);
  assert.equal(s.present.openings[0].offsetMm, 1000);

  // Refazer restaura
  s = refazer(s);
  assert.equal(s.present.openings[0].offsetMm, 1050);

  validarPython(s);
});

test('Aberturas móveis: ajuste de largura (+10cm, -10cm) preservando limites e validação', () => {
  let s = setupCasa();
  const o = s.present.openings[0];
  assert.equal(o.widthMm, 800);

  // Aumentar largura para 900 mm
  s = aplicar(s, {type: 'opening-edit', id: o.id, ...o, widthMm: 900});
  assert.equal(s.present.openings[0].widthMm, 900);

  // Reduzir largura para 700 mm
  s = aplicar(s, {type: 'opening-edit', id: o.id, ...s.present.openings[0], widthMm: 700});
  assert.equal(s.present.openings[0].widthMm, 700);

  validarPython(s);
});

test('Aberturas móveis: alternar tipo Porta ↔ Janela ajusta peitoril e altura automaticamente', () => {
  let s = setupCasa();
  const o = s.present.openings[0];
  assert.equal(o.kind, 'door');
  assert.equal(o.sillMm, 0);
  assert.equal(o.heightMm, 2100);

  // Virar janela: ganha peitoril padrão 1100 e altura 1000
  s = aplicar(s, {type: 'opening-edit', id: o.id, ...o, kind: 'window', heightMm: 1000, sillMm: 1100});
  assert.equal(s.present.openings[0].kind, 'window');
  assert.equal(s.present.openings[0].sillMm, 1100);
  assert.equal(s.present.openings[0].heightMm, 1000);
  validarPython(s);

  // Virar porta novamente: volta peitoril 0 e altura 2100
  s = aplicar(s, {type: 'opening-edit', id: o.id, ...s.present.openings[0], kind: 'door', heightMm: 2100, sillMm: 0});
  assert.equal(s.present.openings[0].kind, 'door');
  assert.equal(s.present.openings[0].sillMm, 0);
  assert.equal(s.present.openings[0].heightMm, 2100);
  validarPython(s);
});
