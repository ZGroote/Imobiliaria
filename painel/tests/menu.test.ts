import { test } from 'node:test'
import assert from 'node:assert/strict'
import { itemAtivo, menuDoPapel } from '../src/lib/menu.ts'
import { inicioDoPapel } from '../src/lib/acesso.ts'
import type { UserRole } from '../src/lib/types.ts'

test('menu: cada papel vê só a sua área; usuários só o admin; equipe só o gerente', () => {
  const rotas = (r: UserRole) => menuDoPapel(r).map((i) => i.href)
  for (const r of ['platform_admin', 'operator', 'agency_manager', 'agent'] as UserRole[]) {
    const area = inicioDoPapel(r)
    assert.ok(rotas(r).every((h) => (area === '/admin') === h.startsWith('/admin')), r)
  }
  assert.ok(rotas('platform_admin').includes('/admin/users'))
  assert.ok(!rotas('operator').includes('/admin/users'))
  assert.ok(rotas('agency_manager').includes('/team'))
  assert.ok(!rotas('agent').includes('/team'))
})

test('menu: o item ativo é o de prefixo mais longo', () => {
  const itens = menuDoPapel('platform_admin')
  assert.equal(itemAtivo(itens, '/admin'), '/admin')
  assert.equal(itemAtivo(itens, '/admin/users'), '/admin/users')
  assert.equal(itemAtivo(itens, '/admin/requests/view'), '/admin/requests')
  assert.equal(itemAtivo(itens, '/administrativo'), undefined)
})
