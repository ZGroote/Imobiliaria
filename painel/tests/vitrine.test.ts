import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from 'firebase/firestore'
import { semear } from '../scripts/seed.mjs'
import { entrar, sairDeTodos } from './apoio.ts'
import { salvarVitrine, vitrinePadrao } from '../src/lib/vitrine.ts'

// A página pública lê sem login (pipeline/vitrine_ao_vivo.js): aqui, um cliente anônimo.
const app = initializeApp({ projectId: 'demo-painel', apiKey: 'demo-key' }, 'vitrine-publica-teste'), publico = getFirestore(app)
connectFirestoreEmulator(publico, '127.0.0.1', 8180)
before(semear)
after(async () => { await sairDeTodos(); await deleteApp(app) })
const SLUG = 'monte-dos-cedros-37'                          // pipelineUnitId do imóvel cedros no seed

test('vitrine: o gerente tira do ar e muda preço; o corretor não; o público lê', async () => {
  const ger = await entrar('gerA'), cor = await entrar('corA')
  await salvarVitrine(ger.db, SLUG, { ...vitrinePadrao('cedros'), online: false, precoCentavos: 72000000 })
  const lido = (await getDoc(doc(publico, 'vitrine', SLUG))).data()!
  assert.deepEqual([lido.online, lido.situacao, lido.precoCentavos, lido.propertyId], [false, 'disponivel', 72000000, 'cedros'])
  await assert.rejects(salvarVitrine(cor.db, SLUG, vitrinePadrao('cedros')), /permission/i)
  assert.throws(() => salvarVitrine(ger.db, SLUG, { ...vitrinePadrao('cedros'), precoCentavos: -5 }), /Preço/)
  await salvarVitrine(ger.db, SLUG, { ...vitrinePadrao('cedros'), situacao: 'vendido' })
  assert.equal((await getDoc(doc(publico, 'vitrine', SLUG))).data()!.situacao, 'vendido')
})
