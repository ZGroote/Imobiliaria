import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { doc, getDoc } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { configDeProducao, configDoAmbiente } from '../src/lib/ambiente.ts'
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

test('.env.production: app web "painel" completo, emulador desligado, nada além da config pública', () => {
  const env: Record<string, string> = Object.fromEntries(readFileSync(new URL('../.env.production', import.meta.url), 'utf8')
    .split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
  assert.equal(env.NEXT_PUBLIC_FIREBASE_EMULATOR, '0')
  const o = configDeProducao(env)
  assert.deepEqual(Object.keys(o).sort(),
    ['apiKey', 'appId', 'authDomain', 'messagingSenderId', 'projectId', 'storageBucket'])
  assert.equal(o.projectId, 'imobilaria-deccb')
  assert.ok(Object.keys(env).every((k) => k.startsWith('NEXT_PUBLIC_')))    // nada de segredo de servidor
})

test('conexão: o seed entra no emulador e as regras reais valem', async () => {
  const { db } = await entrar('corA')
  const eu = await getDoc(doc(db, 'users/corA'))
  assert.equal(eu.data()?.role, 'agent')
  await assert.rejects(getDoc(doc(db, 'agencies/agB')), /permission/i)   // outra agência
})
