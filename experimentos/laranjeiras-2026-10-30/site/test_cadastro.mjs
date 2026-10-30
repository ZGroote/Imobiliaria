// node --test experimentos/laranjeiras-2026-10-30/site/test_cadastro.mjs  (depois de modelo/exportar_cena.py)
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateUnits} from './unidades.js';

const catalog=JSON.parse(readFileSync(new URL('../assets/unidades.json',import.meta.url),'utf8'));

test('312 apartamentos: 3 torres x 13 pavimentos x 8 finais, canto nas pontas', () => {
  validateUnits(catalog);
  assert.equal(catalog.units.length, 312);
  for (const unit of catalog.units)
    assert.equal(unit.typology, ['01','02','07','08'].includes(unit.final) ? 'canto' : 'meio', unit.id);
  const areas = new Set(catalog.units.filter(u => u.floorIndex === 0).map(u => u.areaM2));
  assert.deepEqual([...areas].sort(), [54.17, 60.11]);
});

test('caixas dos finais não se sobrepõem e ficam dentro da torre', () => {
  const inside = (b, t) => b.min.every((v, i) => v >= t.min[i] - 1e-6) && b.max.every((v, i) => v <= t.max[i] + 1e-6);
  const overlap = (a, b) => a.min.every((v, i) => v < b.max[i] - 1e-6 && b.min[i] < a.max[i] - 1e-6);
  for (const tower of catalog.towers) {
    const units = catalog.units.filter(u => u.tower === tower.id && u.floorIndex === 3);
    assert.equal(units.length, 8);
    for (const u of units) assert.ok(inside(u.bounds, tower.bounds), u.id);
    for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++)
      assert.ok(!overlap(units[i].bounds, units[j].bounds), `${units[i].id} x ${units[j].id}`);
  }
});

test('cadastro adulterado é recusado', () => {
  const broken = structuredClone(catalog);
  broken.units.pop();
  assert.throws(() => validateUnits(broken), /quantidade/);
});
