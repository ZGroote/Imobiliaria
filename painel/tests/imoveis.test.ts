import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { atribuirCorretor, criarImovel, editarImovel, urlSegura } from '../src/lib/imoveis.ts'
import { semear } from '../scripts/seed.mjs'
import { entrar, sairDeTodos } from './apoio.ts'

before(semear)
after(sairDeTodos)

test('imóveis: somente administrador cadastra e edita', async () => {
  const admin = await entrar('admin'), gerA = await entrar('gerA'), op = await entrar('op'), corA = await entrar('corA')
  const ref = await criarImovel(admin.db, 'agA', { title: ' Reserva 22 (dev) ', pipelineUnitId: 'reserva-22',
    externalListingUrl: 'https://anuncio.example/reserva-22' })
  const p = (await getDoc(ref)).data()!
  assert.deepEqual([p.agencyId, p.title, p.status], ['agA', 'Reserva 22 (dev)', 'active'])

  await editarImovel(admin.db, ref.id, { address: 'Rua Fictícia, 22', externalListingUrl: '' })
  const e = (await getDoc(ref)).data()!
  assert.deepEqual([e.address, 'externalListingUrl' in e], ['Rua Fictícia, 22', false])   // esvaziado = removido

  assert.throws(() => criarImovel(admin.db, 'agA', { title: 'X', externalListingUrl: 'javascript:alert(1)' }), /http/)
  assert.throws(() => criarImovel(admin.db, 'agA', { title: 'X', pipelineUnitId: 'Com Espaço' }), /pipeline/)
  assert.throws(() => criarImovel(admin.db, 'agA', { title: '  ' }), /título/)
  for (const account of [gerA, op, corA]) {
    await assert.rejects(criarImovel(account.db, 'agA', { title: 'Indevido' }), /permission/i)
    await assert.rejects(editarImovel(account.db, 'cedros', { title: 'Indevido' }), /permission/i)
  }
  await assert.rejects(criarImovel(gerA.db, 'agB', { title: 'Outra empresa' }), /permission/i)
  await assert.rejects(criarImovel(gerA.db, 'agA', { title: 'Campo técnico', pipelineUnitId: 'slug-tecnico' }), /permission/i)
  await assert.rejects(editarImovel(gerA.db, 'imovelB', { title: 'Outra empresa' }), /permission/i)
  await assert.rejects(editarImovel(gerA.db, 'cedros', { pipelineUnitId: 'slug-tecnico' }), /permission/i)
  assert.equal(urlSegura('http://x.test'), true)
})

test('imóveis: a equipe atribui o corretor; clientes não alteram a configuração', async () => {
  const gerA = await entrar('admin'), corA = await entrar('corA')
  await atribuirCorretor(gerA.db, 'colinas', 'corA')
  assert.equal((await getDoc(doc(gerA.db, 'properties/colinas'))).data()!.assignedAgentId, 'corA')
  const gerente = await entrar('gerA')
  await assert.rejects(atribuirCorretor(gerente.db, 'colinas', 'corA'), /permission/i)
  await assert.rejects(atribuirCorretor(corA.db, 'colinas', 'corA'), /permission/i)
  const lista = await getDocs(query(collection(corA.db, 'properties'), where('agencyId', '==', 'agA')))
  assert.ok(lista.size >= 2)                                                     // D4: corretor vê a imobiliária toda
})
