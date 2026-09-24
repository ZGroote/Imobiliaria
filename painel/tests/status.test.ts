import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { collection, doc, getDoc, getDocs, orderBy, query, where, type Firestore } from 'firebase/firestore'
import { COLUNAS, mudarStatus, proximos, rotuloDaAcao, TODOS_STATUS } from '../src/lib/status.ts'
import type { Request } from '../src/lib/types.ts'
import { semear } from '../scripts/seed.mjs'
import { entrar, sairDeTodos } from './apoio.ts'

before(semear)
after(sairDeTodos)

const ler = async (db: Firestore, id: string) =>
  ({ id, ...(await getDoc(doc(db, 'requests', id))).data() }) as Request

test('status: botões por papel; o Kanban cobre todo status menos Cancelada', () => {
  const r = { status: 'submitted' as const, requestedBy: 'corA' }
  assert.deepEqual(proximos(r, 'operator', 'op'), ['waiting_materials', 'accepted', 'cancelled'])
  assert.deepEqual(proximos(r, 'agent', 'corA'), ['cancelled'])           // quem pediu
  assert.deepEqual(proximos(r, 'agent', 'corA2'), [])                     // colega não
  assert.deepEqual(proximos({ ...r, status: 'production' }, 'agency_manager', 'gerA'), [])
  assert.equal(rotuloDaAcao('accepted', 'production'), 'Iniciar produção')
  assert.equal(rotuloDaAcao('internal_review', 'production'), 'Voltar para produção')
  assert.equal(rotuloDaAcao('waiting_materials', 'submitted'), 'Materiais enviados')
  const noKanban = COLUNAS.flatMap((c) => c.status)
  assert.deepEqual(TODOS_STATUS.filter((s) => !noKanban.includes(s)), ['cancelled'])
})

test('status: toda mudança grava o AuditLog no mesmo batch', async () => {
  const op = await entrar('op')
  await mudarStatus(op.db, 'op', await ler(op.db, 'pedCedros'), 'accepted')
  const r = await ler(op.db, 'pedCedros')
  const log = (await getDoc(doc(op.db, 'auditLogs', r.lastAuditId!))).data()!
  assert.deepEqual([r.status, log.action, log.userId, log.before.status, log.after.status, log.visibility],
    ['accepted', 'status:accepted', 'op', 'submitted', 'accepted', 'agency'])
})

test('status: a imobiliária cancela o que é dela e manda materiais; não mexe na produção', async () => {
  await semear()
  const op = await entrar('op'), corA = await entrar('corA'), gerA = await entrar('gerA'), gerB = await entrar('gerB')
  await mudarStatus(op.db, 'op', await ler(op.db, 'pedCedros'), 'waiting_materials')
  await mudarStatus(corA.db, 'corA', await ler(corA.db, 'pedCedros'), 'submitted')        // materiais enviados
  await assert.rejects(mudarStatus(corA.db, 'corA', await ler(corA.db, 'pedCedros'), 'accepted'), /permission/i)
  await assert.rejects(mudarStatus(gerA.db, 'gerA', await ler(gerA.db, 'pedColinas'), 'cancelled'), /permission/i) // em produção
  await assert.rejects(mudarStatus(gerB.db, 'gerB', await ler(op.db, 'pedCedros'), 'cancelled'), /permission/i)    // outra agência
  await assert.rejects(mudarStatus(op.db, 'op', await ler(op.db, 'pedColinas'), 'agency_review'), /permission/i)   // sem preview
  await assert.rejects(mudarStatus(op.db, 'op', await ler(op.db, 'pedColinas'), 'approved'), /permission/i)
  await mudarStatus(corA.db, 'corA', await ler(corA.db, 'pedCedros'), 'cancelled')

  // histórico que a imobiliária lê: só os logs "agency" do pedido, pelo índice da agência
  const h = await getDocs(query(collection(gerA.db, 'auditLogs'), where('agencyId', '==', 'agA'),
    where('visibility', '==', 'agency'), where('entityId', '==', 'pedCedros'), orderBy('timestamp', 'desc')))
  assert.deepEqual(h.docs.map((d) => d.data().action), ['status:cancelled', 'status:submitted', 'status:waiting_materials'])
})
