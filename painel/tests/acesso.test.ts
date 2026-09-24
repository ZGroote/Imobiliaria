import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inicioDoPapel, pode, PAPEIS_DA_AREA } from '../src/lib/acesso.ts'
import type { UserRole } from '../src/lib/types.ts'

test('acesso: cada papel cai na sua área e só nela', () => {
  const papeis: UserRole[] = ['platform_admin', 'operator', 'agency_manager', 'agent']
  assert.deepEqual(papeis.map(inicioDoPapel), ['/admin', '/admin', '/dashboard', '/dashboard'])
  for (const r of papeis) {
    assert.equal(pode(r, PAPEIS_DA_AREA.admin), inicioDoPapel(r) === '/admin')
    assert.equal(pode(r, PAPEIS_DA_AREA.agencia), inicioDoPapel(r) === '/dashboard')
  }
})
