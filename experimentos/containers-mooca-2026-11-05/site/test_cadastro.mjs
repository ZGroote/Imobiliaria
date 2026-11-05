// node --test experimentos/containers-mooca-2026-11-05/site/test_cadastro.mjs  (depois de modelo/exportar_cena.py)
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateUnits} from './unidades.js';
import {typology} from './tipologias.js';

const catalog=JSON.parse(readFileSync(new URL('../assets/unidades.json',import.meta.url),'utf8'));

test('20 dormitórios: 8 no térreo, 12 no 1º pavimento, tipos e aluguel do caderno', () => {
  validateUnits(catalog);
  assert.equal(catalog.units.length, 20);
  assert.equal(catalog.units.filter(u => u.floorIndex === 0).length, 8);
  const porTipo = {};
  for (const u of catalog.units) {
    typology(u.typology);
    porTipo[u.typology] = (porTipo[u.typology] || 0) + 1;
    assert.equal(u.areaM2, u.container === 'c12' ? 29.7 : 14.8, u.id);
    assert.ok(u.bounds.max[1] - u.bounds.min[1] > 2.5, u.id);
  }
  assert.deepEqual(porTipo, {individual: 12, 'individual-pne': 2, casal: 2, quadruplo: 3, 'casal-bebe': 1});
  // Containers não se cruzam: caixas do mesmo nível sem sobreposição.
  for (const a of catalog.units) for (const b of catalog.units) {
    if (a === b || a.floorIndex !== b.floorIndex) continue;
    const cruza = [0, 2].every(i => a.bounds.min[i] < b.bounds.max[i] - .2 && b.bounds.min[i] < a.bounds.max[i] - .2);
    assert.ok(!cruza, `${a.id} x ${b.id}`);
  }
});
