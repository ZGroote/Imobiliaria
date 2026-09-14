import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/core/storage.js', import.meta.url), 'utf8'), ctx);

test('existing furniture and anchor keys are read and written without transformation', () => {
  const values = new Map([['int_sao-carlos_casa', '[{"tipo":"sofa"}]']]);
  const store = ctx.MapStorage.create(() => ({getItem: k => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, String(v))}));
  assert.equal(store.le('int_sao-carlos_casa'), '[{"tipo":"sofa"}]');
  store.grava('ancora_sao-carlos_casa', 'predio-42');
  assert.equal(values.get('ancora_sao-carlos_casa'), 'predio-42');
  assert.equal(store.le('missing'), null);
});

test('denied storage and exhausted quota cannot break the caller', () => {
  const denied = ctx.MapStorage.create(() => { throw Error('SecurityError'); });
  assert.equal(denied.le('key'), null);
  assert.doesNotThrow(() => denied.grava('key', 'data'));
  const full = ctx.MapStorage.create(() => ({setItem() { throw Error('QuotaExceededError'); }}));
  assert.doesNotThrow(() => full.grava('key', 'data'));
});
