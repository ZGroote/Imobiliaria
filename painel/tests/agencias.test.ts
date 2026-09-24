import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { doc, getDoc } from 'firebase/firestore'
import { atualizarAgencia, criarAgencia } from '../src/lib/agencias.ts'
import { semear } from '../scripts/seed.mjs'
import { entrar, sairDeTodos } from './apoio.ts'

before(semear)
after(sairDeTodos)

test('agências: só o admin cria e edita; ninguém cria sem nome', async () => {
  const admin = await entrar('admin'), op = await entrar('op'), gerA = await entrar('gerA')
  const nova = await criarAgencia(admin.db, '  Imobiliária Fictícia C (dev)  ')
  const dados = (await getDoc(nova)).data()!
  assert.deepEqual([dados.name, dados.slug, dados.active], ['Imobiliária Fictícia C (dev)', 'imobiliaria-ficticia-c-dev', true])
  assert.throws(() => criarAgencia(admin.db, '   '), /nome/)

  await assert.rejects(criarAgencia(op.db, 'Do operador'), /permission/i)
  await assert.rejects(criarAgencia(gerA.db, 'Do gerente'), /permission/i)
  await assert.rejects(atualizarAgencia(gerA.db, 'agA', { name: 'Renomeada' }), /permission/i)

  await atualizarAgencia(admin.db, nova.id, { active: false })
  assert.equal((await getDoc(nova)).data()!.active, false)
  assert.equal((await getDoc(doc(op.db, 'agencies', nova.id))).data()!.active, false)   // operador lê
})
