import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { doc, getDoc } from 'firebase/firestore'
import { configDoAmbiente } from '../src/lib/ambiente.ts'
import { semear } from '../scripts/seed.mjs'
import { entrar, sairDeTodos } from './apoio.ts'

before(semear)
after(sairDeTodos)

test('ambiente: emulador usa projeto demo-; produção exige a config inteira', () => {
  assert.equal(configDoAmbiente({ NEXT_PUBLIC_FIREBASE_EMULATOR: '1' }).options.projectId, 'demo-painel')
  assert.throws(() => configDoAmbiente({}), /API_KEY.*AUTH_DOMAIN.*PROJECT_ID.*APP_ID/)
  assert.throws(() => configDoAmbiente({ NEXT_PUBLIC_FIREBASE_API_KEY: 'k' }), /AUTH_DOMAIN/)
  const prod = configDoAmbiente({ NEXT_PUBLIC_FIREBASE_API_KEY: 'k', NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'd',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'imobilaria-deccb', NEXT_PUBLIC_FIREBASE_APP_ID: 'a' })
  assert.equal(prod.emulador, false)
})

test('conexão: o seed entra no emulador e as regras reais valem', async () => {
  const { db } = await entrar('corA')
  const eu = await getDoc(doc(db, 'users/corA'))
  assert.equal(eu.data()?.role, 'agent')
  await assert.rejects(getDoc(doc(db, 'agencies/agB')), /permission/i)   // outra agência
})
