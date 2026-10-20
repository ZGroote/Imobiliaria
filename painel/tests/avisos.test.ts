import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chegaram } from '../src/lib/avisos.ts'

test('aviso de pedido novo: abrir o painel não avisa; só o que chegou depois', () => {
  const lista = [{ id: 'a' }, { id: 'b' }]
  assert.deepEqual(chegaram(null, lista), [])
  assert.deepEqual(chegaram(new Set(['a', 'b']), lista), [])
  assert.deepEqual(chegaram(new Set(['a']), [...lista, { id: 'c' }]).map((p) => p.id), ['b', 'c'])
  assert.deepEqual(chegaram(new Set(['a', 'b']), [{ id: 'a' }]), [], 'pedido aceito sai da lista sem avisar')
})
