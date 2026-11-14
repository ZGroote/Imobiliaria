import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { doc, getDoc } from 'firebase/firestore'
import { aceitarConvite, lerConvite } from '../src/lib/convite.ts'
import { convidar } from '../src/lib/usuarios.ts'
import { semear } from '../scripts/seed.mjs'
import { entrar, novaConta, sairDeTodos, verificarEmail } from './apoio.ts'
import type { Invite } from '../src/lib/types.ts'
import { inicioDoPapel } from '../src/lib/acesso.ts'

before(semear)
after(sairDeTodos)

test('convites: os quatro papéis entram pela mesma porta e recebem somente a área do papel aceito', async () => {
  const admin = await entrar('admin')
  for (const role of ['platform_admin', 'operator', 'agency_manager', 'agent'] as const) {
    const email = `convite-${role}@painel.test`
    const agencyId = ['agency_manager', 'agent'].includes(role) ? 'agA' : undefined
    await convidar(admin.db, admin.uid, { email, name: 'Convidado de teste', role, agencyId })
    const novo = await novaConta(email)
    await verificarEmail(novo.auth)
    const convite = await lerConvite(novo.db, email)
    assert.ok(convite)
    await aceitarConvite(novo.db, novo.uid, convite)
    const perfil = (await getDoc(doc(novo.db, 'users', novo.uid))).data()!
    assert.equal(perfil.role, role)
    assert.equal(perfil.active, true)
    assert.equal(perfil.agencyId, agencyId)
    assert.equal(inicioDoPapel(perfil.role), agencyId ? '/dashboard' : '/admin')
    assert.equal((await getDoc(doc(admin.db, 'invites', email))).exists(), false)
  }
})

test('convite do gerente: só com e-mail verificado; perfil nasce como corretor da agência e consome convite', async () => {
  const admin = await entrar('admin'), gerente = await entrar('gerA')
  await convidar(gerente.db, gerente.uid, { email: 'novo@painel.test', name: 'Novo', role: 'agent',
    agencyId: 'agA', agencyName: 'Imobiliária Fictícia A (dev)' })

  const novo = await novaConta('novo@painel.test')
  await assert.rejects(lerConvite(novo.db, 'novo@painel.test'), /permission/i)   // e-mail ainda não verificado
  await verificarEmail(novo.auth)
  const convite = await lerConvite(novo.db, 'NOVO@painel.test ')                   // id normalizado
  assert.equal(convite?.role, 'agent')

  await assert.rejects(aceitarConvite(novo.db, novo.uid, { ...convite!, role: 'platform_admin' }), /permission/i)
  await assert.rejects(aceitarConvite(novo.db, novo.uid, { ...convite!, agencyId: 'agB' }), /permission/i)
  await aceitarConvite(novo.db, novo.uid, convite!)
  const perfil = (await getDoc(doc(novo.db, 'users', novo.uid))).data()!
  assert.deepEqual([perfil.role, perfil.agencyId, perfil.active], ['agent', 'agA', true])
  // o aceite consome o convite: invites/ fica só com os pendentes
  assert.equal((await getDoc(doc(admin.db, 'invites/novo@painel.test'))).exists(), false)
})

test('sem convite: e-mail verificado não basta para entrar', async () => {
  const alguem = await novaConta('alguem@painel.test')
  await verificarEmail(alguem.auth)
  assert.equal(await lerConvite(alguem.db, 'alguem@painel.test'), null)
  const falso: Invite = { email: 'alguem@painel.test', name: 'X', role: 'operator', createdBy: 'x', createdAt: null as never }
  await assert.rejects(aceitarConvite(alguem.db, alguem.uid, falso), /permission/i)
})
