import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inicioDoPapel, pode, podeGerenciarImovel, podeEditarComercial, PAPEIS_DA_AREA } from '../src/lib/acesso.ts'
import type { UserRole } from '../src/lib/types.ts'

test('acesso: cada papel cai na sua área e só nela', () => {
  const papeis: UserRole[] = ['platform_admin', 'operator', 'agency_manager', 'agent']
  assert.deepEqual(papeis.map(inicioDoPapel), ['/admin', '/admin', '/dashboard', '/dashboard'])
  for (const r of papeis) {
    assert.equal(pode(r, PAPEIS_DA_AREA.admin), inicioDoPapel(r) === '/admin')
    assert.equal(pode(r, PAPEIS_DA_AREA.agencia), inicioDoPapel(r) === '/dashboard')
  }
})

test('cadastro do imóvel: somente administrador configura; gerente altera apenas comercial', () => {
  const perfil = (role: UserRole, agencyId?: string, active = true) => ({ role, agencyId, active })
  assert.equal(podeGerenciarImovel(perfil('platform_admin'), 'agA'), true)
  assert.equal(podeGerenciarImovel(perfil('agency_manager', 'agA'), 'agA'), false)
  assert.equal(podeGerenciarImovel(perfil('agency_manager', 'agB'), 'agA'), false)
  assert.equal(podeGerenciarImovel(perfil('agency_manager'), 'agA'), false)
  assert.equal(podeGerenciarImovel(perfil('operator'), 'agA'), false)
  assert.equal(podeGerenciarImovel(perfil('agent', 'agA'), 'agA'), false)
  assert.equal(podeGerenciarImovel(perfil('platform_admin', undefined, false), 'agA'), false)
  assert.equal(podeGerenciarImovel(perfil('agency_manager', 'agA', false), 'agA'), false)
})

test('comercial: gerente só da própria imobiliária e ativo', () => {
  assert.equal(podeEditarComercial({role:'agency_manager',agencyId:'agA',active:true},'agA'),true)
  assert.equal(podeEditarComercial({role:'agency_manager',agencyId:'agB',active:true},'agA'),false)
  assert.equal(podeEditarComercial({role:'agency_manager',agencyId:'agA',active:false},'agA'),false)
  assert.equal(podeEditarComercial({role:'agent',agencyId:'agA',active:true},'agA'),false)
})
