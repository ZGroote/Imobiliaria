import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { aceitarConvite, lerConvite } from '../src/lib/convite.ts'
import { semear } from '../scripts/seed.mjs'
import { entrar, novaConta, sairDeTodos, verificarEmail } from './apoio.ts'
import type { Invite } from '../src/lib/types.ts'

before(semear)
after(sairDeTodos)

test('convite: só com e-mail verificado; users/{uid} nasce com o papel do convite', async () => {
  const admin = await entrar('admin')
  await setDoc(doc(admin.db, 'invites/novo@painel.test'), { email: 'novo@painel.test', name: 'Novo', role: 'agent',
    agencyId: 'agA', agencyName: 'Imobiliária Fictícia A (dev)', createdBy: 'admin', createdAt: serverTimestamp() })

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
})

test('sem convite: e-mail verificado não basta para entrar', async () => {
  const alguem = await novaConta('alguem@painel.test')
  await verificarEmail(alguem.auth)
  assert.equal(await lerConvite(alguem.db, 'alguem@painel.test'), null)
  const falso: Invite = { email: 'alguem@painel.test', name: 'X', role: 'operator', createdBy: 'x', createdAt: null as never }
  await assert.rejects(aceitarConvite(alguem.db, alguem.uid, falso), /permission/i)
})
