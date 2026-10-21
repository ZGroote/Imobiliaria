// M2-4: o que o painel pede ao robô e mostra dele (tasks/painel/m2-worker.md §3, §7 e §15), no
// emulador, pelo SDK do navegador e com as regras publicadas.
import { test, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { collection, doc, getDoc, getDocs, query, where, type Firestore } from 'firebase/firestore'
import { cancelarJob, enviarParaRevisaoDoCliente, jobsDoPedido, motivoDoJob, pedirPreviaAoRobo } from '../src/lib/robo.ts'
import { lerPreview } from '../src/lib/publicacao.ts'
import { mudarStatus } from '../src/lib/status.ts'
import type { BuildJob, Request } from '../src/lib/types.ts'
import { adminDb, semear, Timestamp } from '../scripts/seed.mjs'
import { entrar, sairDeTodos } from './apoio.ts'

beforeEach(semear)
after(sairDeTodos)

const UNID = 'monte-dos-cedros-37'
const ler = async (db: Firestore, id: string) => ({ id, ...(await getDoc(doc(db, 'requests', id))).data() }) as Request
const emProducao = () => adminDb().doc('requests/pedCedros').update({ status: 'production' })
const manifesto = (build: string) => JSON.stringify({ schema: 1, imovel: UNID, build,
  arquivos: { 'tour.html': { bytes: 1, sha256: 'x' }, 'maquete.html': { bytes: 1, sha256: 'y' } } })
const servir = (texto: string) => async () => ({ ok: true, status: 200,
  json: async () => JSON.parse(texto), arrayBuffer: async () => new TextEncoder().encode(texto).buffer })
const tour = (build: string) => `https://imoveis.example/b/${UNID}/${build}/tour.html`
async function pedidosDeTrabalho(db: Firestore, entityId: string) {
  return (await getDocs(query(collection(db, 'auditLogs'), where('entityId', '==', entityId)))).docs
    .map((d) => d.data()).filter((l) => String(l.action).startsWith('worker:'))
}

test('M2-4 gerar prévia: a equipe pede ao robô, só com o pedido em produção; a imobiliária não pede', async () => {
  const op = await entrar('op'), gerA = await entrar('gerA')
  assert.throws(() => pedirPreviaAoRobo(op.db, 'op', { id: 'pedCedros', agencyId: 'agA', status: 'submitted' }), /produção/)
  await emProducao()
  await pedirPreviaAoRobo(op.db, 'op', await ler(op.db, 'pedCedros'))
  const [p] = await pedidosDeTrabalho(op.db, 'pedCedros')
  assert.deepEqual([p.action, p.visibility, p.userId, p.entityType, p.agencyId], ['worker:previa', 'internal', 'op', 'request', 'agA'])
  await assert.rejects(pedirPreviaAoRobo(gerA.db, 'gerA', await ler(gerA.db, 'pedCedros')), /permission/i)
})

test('M2-4 trabalhos do pedido: a equipe vê, com o motivo em português; a imobiliária não vê', async () => {
  const op = await entrar('op'), gerA = await entrar('gerA')
  const T = Timestamp.now()
  await adminDb().doc('buildJobs/j1').set({ requestId: 'pedCedros', propertyId: 'cedros', agencyId: 'agA', stage: 'preview',
    status: 'blocked', error: { code: 'CHANNEL_MISMATCH', message: 'sha256 servido != montado' }, createdBy: 'op', createdAt: T, updatedAt: T })
  await adminDb().doc('buildJobs/j2').set({ requestId: 'pedCedros', propertyId: 'cedros', agencyId: 'agA', stage: 'preview',
    status: 'pending', createdBy: 'op', createdAt: Timestamp.fromMillis(T.toMillis() + 1000), updatedAt: T })
  const jobs = (await getDocs(jobsDoPedido(op.db, 'pedCedros'))).docs.map((d) => ({ id: d.id, ...d.data() }) as BuildJob)
  assert.deepEqual(jobs.map((j) => j.id).sort(), ['j1', 'j2'])
  await assert.rejects(getDocs(jobsDoPedido(gerA.db, 'pedCedros')), /permission/i)

  const j1 = jobs.find((j) => j.id === 'j1')!
  assert.equal(motivoDoJob(j1), 'O canal de prévia servia arquivos diferentes dos que o robô montou.')   // o texto da equipe, não o do robô
  assert.equal(motivoDoJob({ ...j1, error: { code: 'ALGO_NOVO', message: 'texto do robô' } }), 'texto do robô')
  assert.equal(motivoDoJob({ ...j1, error: undefined }), null)
})

test('M2-4 cancelar: a equipe pede o cancelamento do trabalho', async () => {
  const op = await entrar('op'), corA = await entrar('corA')
  const job = { id: 'j1', agencyId: 'agA' }
  await cancelarJob(op.db, 'op', job)
  const [p] = await pedidosDeTrabalho(op.db, 'j1')
  assert.deepEqual([p.action, p.entityType, p.visibility], ['worker:cancelar', 'buildJob', 'internal'])
  await assert.rejects(cancelarJob(corA.db, 'corA', job), /permission/i)
})

test('M2-4 enviar para a revisão do cliente: só da revisão interna, e relendo a prévia no canal', async () => {
  const op = await entrar('op')
  const texto = manifesto('a1b2c3d4e5f6')
  const preview = await lerPreview(tour('a1b2c3d4e5f6'), UNID, servir(texto))
  await adminDb().doc('requests/pedCedros').update({ status: 'internal_review', preview })
  // o canal mudou desde o registro (outro manifest servido): não envia
  await assert.rejects(enviarParaRevisaoDoCliente(op.db, 'op', await ler(op.db, 'pedCedros'), UNID,
    servir(manifesto('a1b2c3d4e5f6') + ' ')), /gere de novo/i)
  assert.equal((await ler(op.db, 'pedCedros')).status, 'internal_review')
  await enviarParaRevisaoDoCliente(op.db, 'op', await ler(op.db, 'pedCedros'), UNID, servir(texto))
  const r = await ler(op.db, 'pedCedros')
  assert.deepEqual([r.status, r.preview], ['agency_review', preview])
  await assert.rejects(enviarParaRevisaoDoCliente(op.db, 'op', r, UNID, servir(texto)), /revisão interna/)
})

test('M2-4 pedir revisão: o gerente leva o pedido à revisão interna, com o texto', async () => {
  const op = await entrar('op'), gerA = await entrar('gerA')
  const texto = manifesto('a1b2c3d4e5f6')
  await emProducao()
  await mudarStatus(op.db, 'op', await ler(op.db, 'pedCedros'), 'agency_review',
    { preview: await lerPreview(tour('a1b2c3d4e5f6'), UNID, servir(texto)) })
  const { pedirRevisao } = await import('../src/lib/aprovacao.ts')
  await pedirRevisao(gerA.db, 'gerA', await ler(gerA.db, 'pedCedros'), 'A varanda saiu fechada.')
  const r = await ler(op.db, 'pedCedros')
  const log = (await getDoc(doc(op.db, 'auditLogs', r.lastAuditId!))).data()!
  assert.deepEqual([r.status, log.after.nota, log.visibility], ['internal_review', 'A varanda saiu fechada.', 'agency'])
})
