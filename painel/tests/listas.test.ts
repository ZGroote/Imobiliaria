import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { getCountFromServer, getDocs, limit, query, type DocumentData, type Query } from 'firebase/firestore'
import { PAGINA, colunaDoKanban, imoveisDa, pedidosDaAgencia, pedidosInternos, temMais } from '../src/lib/listas.ts'
import { adminDb, semear, Timestamp } from '../scripts/seed.mjs'
import { entrar, sairDeTodos } from './apoio.ts'

// Mais do que cabe numa página: 80 pedidos e 60 imóveis a mais na agA, todos mais antigos que os
// do seed (20/09). Os 3 pedidos "production" são os MAIS antigos, fora dos 50 primeiros: um filtro
// feito no navegador sobre a página não os veria. "Recebidas" passa de 50 no Kanban.
before(async () => {
  await semear()
  const adm = adminDb()
  const antes = (min: number) => Timestamp.fromMillis(Date.UTC(2026, 8, 10) - min * 60_000)
  const b = adm.batch()
  for (let i = 0; i < 80; i++) {
    b.set(adm.doc(`requests/lista${String(i).padStart(2, '0')}`), {
      agencyId: 'agA', requestedBy: i % 2 === 0 || i >= 77 ? 'corA' : 'gerA', title: `Pedido ${i}`,
      status: i >= 77 ? 'production' : i % 4 === 0 ? 'accepted' : 'submitted', priority: 'normal',
      createdAt: antes(i), updatedAt: antes(i),
    })
  }
  for (let i = 0; i < 60; i++) {
    b.set(adm.doc(`properties/lista${String(i).padStart(2, '0')}`), {
      agencyId: 'agA', title: `Imóvel ${i}`, status: 'active', createdAt: antes(i), updatedAt: antes(i),
    })
  }
  await b.commit()
})
after(sairDeTodos)

type Linha = DocumentData & { id: string }
const ler = async (q: Query, n = PAGINA): Promise<Linha[]> =>
  (await getDocs(query(q, limit(n)))).docs.map((d) => ({ id: d.id, ...d.data() }))
const ids = (xs: Linha[]) => xs.map((x) => x.id)

test('limite crescente: 50, depois 100; o botão some quando vem menos que o pedido', () => {
  assert.equal(PAGINA, 50)
  assert.equal(temMais(50, 50), true)      // veio exatamente o limite: pode haver mais
  assert.equal(temMais(100, 100), true)
  assert.equal(temMais(83, 100), false)    // veio menos: acabou
  assert.equal(temMais(0, 50), false)
})

test('imobiliária: 50 por vez, mais recentes primeiro, e o filtro vale para a lista inteira', async () => {
  const corA = await entrar('corA')
  const todos = await ler(pedidosDaAgencia(corA.db, 'agA'), 1000)
  assert.equal(todos.length, 83)                                   // 3 do seed + 80
  for (let i = 1; i < todos.length; i++) assert.ok(todos[i - 1].updatedAt.toMillis() >= todos[i].updatedAt.toMillis())

  const p1 = await ler(pedidosDaAgencia(corA.db, 'agA'))
  assert.deepEqual(ids(p1), ids(todos.slice(0, 50)))               // a 1ª página é o começo da lista
  assert.equal(temMais(p1.length, 50), true)
  const p2 = await ler(pedidosDaAgencia(corA.db, 'agA'), 100)
  assert.deepEqual(ids(p2), ids(todos))
  assert.equal(temMais(p2.length, 100), false)

  // status no Firestore: os de produção além da 1ª página aparecem; filtrar a página perderia 3 de 4
  const producao = await ler(pedidosDaAgencia(corA.db, 'agA', { status: 'production' }))
  assert.deepEqual(ids(producao).sort(), ids(todos.filter((x) => x.status === 'production')).sort())
  assert.equal(producao.length, 4)
  assert.equal(p1.filter((x) => x.status === 'production').length, 1)
  // "só as minhas" também, e os dois juntos
  assert.deepEqual(ids(await ler(pedidosDaAgencia(corA.db, 'agA', { de: 'corA' }))).sort(),
    ids(todos.filter((x) => x.requestedBy === 'corA')).sort())
  assert.deepEqual(ids(await ler(pedidosDaAgencia(corA.db, 'agA', { status: 'production', de: 'corA' }))).sort(),
    ['lista77', 'lista78', 'lista79'])

  // imóveis da imobiliária, na mesma ordem e com o mesmo limite
  const im = await ler(imoveisDa(corA.db, 'agA'), 1000)
  assert.equal(im.length, 62)
  assert.equal((await ler(imoveisDa(corA.db, 'agA'))).length, 50)
  // e a outra imobiliária continua sem ver nada da agA
  const gerB = await entrar('gerB')
  await assert.rejects(ler(pedidosDaAgencia(gerB.db, 'agA')), /permission/i)
  await assert.rejects(ler(imoveisDa(gerB.db, 'agA')), /permission/i)
})

test('equipe: filtros no servidor, imóveis de todas e o Kanban com o total real', async () => {
  const admin = await entrar('admin')
  assert.deepEqual(ids(await ler(pedidosInternos(admin.db, { agencia: 'agB' }))), ['pedB'])
  assert.equal((await ler(pedidosInternos(admin.db, { status: 'production' }))).length, 4)
  assert.equal((await ler(pedidosInternos(admin.db, { agencia: 'agA', status: 'accepted' }))).length, 20)
  assert.equal((await ler(pedidosInternos(admin.db))).length, 50)
  assert.equal((await ler(imoveisDa(admin.db), 1000)).length, 63)  // cedros, colinas, imovelB + 60

  // a coluna mostra 50 cartões; o número no topo é o total do banco
  const recebidas = colunaDoKanban(admin.db, ['submitted', 'waiting_materials'])
  assert.equal((await ler(recebidas)).length, 50)
  assert.equal((await getCountFromServer(recebidas)).data().count, 58)   // 57 + pedCedros
  const producao = colunaDoKanban(admin.db, ['accepted', 'production'])
  assert.equal((await getCountFromServer(producao)).data().count, 25)    // 20 + pedB aceitos, 3 + pedColinas em produção
})
