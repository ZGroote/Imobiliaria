import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { atribuirCorretor, criarImovel, editarImovel, urlSegura } from '../src/lib/imoveis.ts'
import { semear } from '../scripts/seed.mjs'
import { entrar, sairDeTodos } from './apoio.ts'

before(semear)
after(sairDeTodos)

test('imóveis: a equipe cadastra e edita; a imobiliária não', async () => {
  const op = await entrar('op'), gerA = await entrar('gerA')
  const ref = await criarImovel(op.db, 'agA', { title: ' Reserva 22 (dev) ', pipelineUnitId: 'reserva-22',
    externalListingUrl: 'https://anuncio.example/reserva-22' })
  const p = (await getDoc(ref)).data()!
  assert.deepEqual([p.agencyId, p.title, p.status], ['agA', 'Reserva 22 (dev)', 'active'])

  await editarImovel(op.db, ref.id, { address: 'Rua Fictícia, 22', externalListingUrl: '' })
  const e = (await getDoc(ref)).data()!
  assert.deepEqual([e.address, 'externalListingUrl' in e], ['Rua Fictícia, 22', false])   // esvaziado = removido

  assert.throws(() => criarImovel(op.db, 'agA', { title: 'X', externalListingUrl: 'javascript:alert(1)' }), /http/)
  assert.throws(() => criarImovel(op.db, 'agA', { title: 'X', pipelineUnitId: 'Com Espaço' }), /pipeline/)
  assert.throws(() => criarImovel(op.db, 'agA', { title: '  ' }), /título/)
  await assert.rejects(criarImovel(gerA.db, 'agA', { title: 'Do gerente' }), /permission/i)
  await assert.rejects(editarImovel(gerA.db, 'cedros', { title: 'Renomeado' }), /permission/i)
  assert.equal(urlSegura('http://x.test'), true)
})

test('imóveis: o gerente atribui só corretor da própria imobiliária; o corretor não atribui', async () => {
  const gerA = await entrar('gerA'), corA = await entrar('corA')
  await atribuirCorretor(gerA.db, 'colinas', 'corA')
  assert.equal((await getDoc(doc(gerA.db, 'properties/colinas'))).data()!.assignedAgentId, 'corA')
  await assert.rejects(atribuirCorretor(gerA.db, 'colinas', 'gerB'), /permission/i)
  await assert.rejects(atribuirCorretor(corA.db, 'colinas', 'corA'), /permission/i)
  const lista = await getDocs(query(collection(corA.db, 'properties'), where('agencyId', '==', 'agA')))
  assert.ok(lista.size >= 2)                                                     // D4: corretor vê a imobiliária toda
})
