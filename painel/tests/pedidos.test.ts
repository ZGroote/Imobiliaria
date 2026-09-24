import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { doc, getDoc } from 'firebase/firestore'
import { criarPedido, editarPedido, editarPedidoInterno, salvarNotaInterna } from '../src/lib/pedidos.ts'
import { semear } from '../scripts/seed.mjs'
import { entrar, sairDeTodos } from './apoio.ts'

before(semear)
after(sairDeTodos)

test('pedidos: a imobiliária cria só na própria agência e só com imóvel dela', async () => {
  const corA = await entrar('corA')
  const ref = await criarPedido(corA.db, 'corA', { agencyId: 'agA', title: ' Tour novo ', propertyId: 'cedros',
    listingUrl: 'https://anuncio.example/1', priority: 'high', notes: '' })
  const p = (await getDoc(ref)).data()!
  assert.deepEqual([p.status, p.requestedBy, p.title, p.priority, 'notes' in p], ['submitted', 'corA', 'Tour novo', 'high', false])

  await assert.rejects(criarPedido(corA.db, 'corA', { agencyId: 'agB', title: 'Em nome de B' }), /permission/i)
  await assert.rejects(criarPedido(corA.db, 'corA', { agencyId: 'agA', title: 'Imóvel de B', propertyId: 'imovelB' }), /permission/i)
  await assert.rejects(criarPedido(corA.db, 'gerA', { agencyId: 'agA', title: 'Em nome de outro' }), /permission/i)
  assert.throws(() => criarPedido(corA.db, 'corA', { agencyId: 'agA', title: 'X', listingUrl: 'javascript:alert(1)' }), /http/)
  assert.throws(() => criarPedido(corA.db, 'corA', { agencyId: 'agA', title: ' ' }), /título/)
})

test('pedidos: quem edita o quê, e quando', async () => {
  const corA = await entrar('corA'), gerA = await entrar('gerA'), op = await entrar('op')
  await editarPedido(corA.db, 'pedCedros', { title: 'Tour do Cedros (revisado)', notes: 'Usar as fotos de agosto' })
  await editarPedido(gerA.db, 'pedCedros', { notes: '' })                        // gerente edita pedido do corretor
  assert.equal('notes' in (await getDoc(doc(op.db, 'requests/pedCedros'))).data()!, false)
  await assert.rejects(editarPedido(corA.db, 'pedColinas', { title: 'X' }), /permission/i)   // pedido do gerente, e em produção
  await assert.rejects(editarPedido(gerA.db, 'pedColinas', { title: 'X' }), /permission/i)   // produção já começou
  await assert.rejects(editarPedidoInterno(gerA.db, 'pedCedros', { priority: 'high' }), /permission/i)

  // o imóvel vinculado não pode ser de outra imobiliária, nem pela equipe, nem na edição
  await assert.rejects(editarPedidoInterno(op.db, 'pedCedros', { propertyId: 'imovelB' }), /permission/i)
  await editarPedidoInterno(op.db, 'pedCedros', { propertyId: 'colinas' })
  await editarPedidoInterno(op.db, 'pedCedros', { propertyId: 'cedros' })

  await editarPedidoInterno(op.db, 'pedB', { priority: 'low', assignedTo: 'op' })
  const b = (await getDoc(doc(op.db, 'requests/pedB'))).data()!
  assert.deepEqual([b.priority, b.assignedTo], ['low', 'op'])
})

test('nota interna: a equipe escreve e lê; a imobiliária não vê', async () => {
  const op = await entrar('op'), gerA = await entrar('gerA')
  await salvarNotaInterna(op.db, 'pedCedros', 'op', 'Planta sem cotas; pedir medidas.')
  assert.equal((await getDoc(doc(op.db, 'requests/pedCedros/internal/notes'))).data()!.text, 'Planta sem cotas; pedir medidas.')
  await assert.rejects(getDoc(doc(gerA.db, 'requests/pedCedros/internal/notes')), /permission/i)
  await assert.rejects(salvarNotaInterna(gerA.db, 'pedCedros', 'gerA', 'x'), /permission/i)
})
