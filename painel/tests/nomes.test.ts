import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { collection, getCountFromServer, getDocs, query, where } from 'firebase/firestore'
import { estaPublicado, pedidosNaEtapa, publicadosDa } from '../src/lib/listas.ts'
import { nomeEmCache, pedirNome } from '../src/lib/nomes.ts'
import { adminDb, semear } from '../scripts/seed.mjs'
import { entrar, sairDeTodos } from './apoio.ts'

// Imóveis da agA para a semântica de "publicado": texto não vazio em publishedBuild. Os do seed
// (cedros, colinas) não têm o campo; aqui entram um publicado, um vazio e um null. E um publicado
// na agB, que não pode contar para a agA.
before(async () => {
  await semear()
  const adm = adminDb()
  const b = adm.batch()
  const base = { status: 'active', createdAt: new Date(), updatedAt: new Date() }
  b.set(adm.doc('properties/pub1'), { ...base, agencyId: 'agA', title: 'Publicado A', publishedBuild: 'a1b2c3d4e5f6' })
  b.set(adm.doc('properties/vazio'), { ...base, agencyId: 'agA', title: 'Vazio A', publishedBuild: '' })
  b.set(adm.doc('properties/nulo'), { ...base, agencyId: 'agA', title: 'Nulo A', publishedBuild: null })
  b.set(adm.doc('properties/pubB'), { ...base, agencyId: 'agB', title: 'Publicado B', publishedBuild: '0f9e8d7c6b5a' })
  await b.commit()
})
after(sairDeTodos)

test('nome por id: uma busca por documento, em cache, e separada por usuário', async () => {
  const corA = await entrar('corA')
  // duas telas pedindo o mesmo nome ao mesmo tempo esperam a MESMA busca
  const p1 = pedirNome(corA.db, 'corA', 'properties', 'cedros')
  const p2 = pedirNome(corA.db, 'corA', 'properties', 'cedros')
  assert.equal(p1, p2)
  assert.equal(nomeEmCache('corA', 'properties', 'cedros', 'title'), undefined)   // ainda buscando
  await p1
  assert.equal(nomeEmCache('corA', 'properties', 'cedros', 'title'), 'Monte dos Cedros 37')
  assert.equal(pedirNome(corA.db, 'corA', 'properties', 'cedros'), p1)            // já buscado: não busca de novo
  // outro usuário não herda o que corA leu: o cache é por usuário
  assert.equal(nomeEmCache('gerB', 'properties', 'cedros', 'title'), undefined)
  // e o que as regras negam vira "sem nome", sem derrubar a tela
  const gerB = await entrar('gerB')
  await pedirNome(gerB.db, 'gerB', 'properties', 'cedros')
  assert.equal(nomeEmCache('gerB', 'properties', 'cedros', 'title'), null)
  // documento que não existe também
  await pedirNome(corA.db, 'corA', 'properties', 'naoExiste')
  assert.equal(nomeEmCache('corA', 'properties', 'naoExiste', 'title'), null)
})

test('Início: "publicado" é texto não vazio em publishedBuild, igual na lista e no contador', async () => {
  const corA = await entrar('corA')
  assert.equal(estaPublicado({ publishedBuild: 'a1b2c3d4e5f6' }), true)
  for (const p of [{}, { publishedBuild: '' }, { publishedBuild: null }]) assert.equal(estaPublicado(p), false)

  // o contador (count no Firestore) bate com a etiqueta da lista (estaPublicado) sobre os mesmos imóveis
  const todos = (await getDocs(query(collection(corA.db, 'properties'), where('agencyId', '==', 'agA')))).docs.map((d) => d.data())
  assert.equal(todos.length, 5)                                                   // cedros, colinas, pub1, vazio, nulo
  const contador = (await getCountFromServer(publicadosDa(corA.db, 'agA'))).data().count
  assert.equal(contador, todos.filter(estaPublicado).length)
  assert.equal(contador, 1)

  // etapas contadas no servidor, só da própria imobiliária
  const pedidos = (await getDocs(query(collection(corA.db, 'requests'), where('agencyId', '==', 'agA')))).docs.map((d) => d.data())
  for (const etapa of [['submitted', 'waiting_materials'], ['accepted', 'production', 'internal_review'], ['agency_review']] as const) {
    assert.equal((await getCountFromServer(pedidosNaEtapa(corA.db, 'agA', [...etapa]))).data().count,
      pedidos.filter((p) => (etapa as readonly string[]).includes(p.status)).length, etapa.join(','))
  }
  // a outra imobiliária não conta imóveis da agA
  const gerB = await entrar('gerB')
  await assert.rejects(getCountFromServer(publicadosDa(gerB.db, 'agA')), /permission/i)
})
