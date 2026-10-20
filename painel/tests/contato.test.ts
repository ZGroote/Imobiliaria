import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { doc, getDoc } from 'firebase/firestore'
import { semear } from '../scripts/seed.mjs'
import { entrar, sairDeTodos } from './apoio.ts'
import { normalizarWhatsapp, salvarMeuWhatsapp } from '../src/lib/contato.ts'

before(semear)
after(sairDeTodos)

test('WhatsApp: número brasileiro ganha o 55; formato estranho é recusado; vazio tira o número', () => {
  assert.equal(normalizarWhatsapp('(16) 99999-0000'), '5516999990000')
  assert.equal(normalizarWhatsapp('+55 16 3333-0000'), '551633330000')
  assert.equal(normalizarWhatsapp('+1 415 555 0100'), '14155550100')
  assert.equal(normalizarWhatsapp('   '), null)
  assert.throws(() => normalizarWhatsapp('123'), /DDD/)
  assert.throws(() => normalizarWhatsapp('0'.repeat(13)), /DDD/)
})

test('WhatsApp: o corretor grava o próprio e só o próprio', async () => {
  const cor = await entrar('corA'), ger = await entrar('gerA')
  await salvarMeuWhatsapp(cor.db, cor.uid, '(16) 99999-0000')
  assert.deepEqual((await getDoc(doc(cor.db, 'users', cor.uid))).data()!.publicContact, { whatsapp: '5516999990000' })
  await assert.rejects(salvarMeuWhatsapp(ger.db, cor.uid, '(16) 98888-0000'), /permission/i)
  await salvarMeuWhatsapp(cor.db, cor.uid, '')
  assert.deepEqual((await getDoc(doc(cor.db, 'users', cor.uid))).data()!.publicContact, { whatsapp: null })
})
