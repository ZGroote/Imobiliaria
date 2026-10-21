// M2-4 e M2-6: o que o painel pede ao robô e mostra dele (tasks/painel/m2-worker.md §3, §7, §9 e
// §15), no emulador, pelo SDK do navegador e com as regras publicadas.
import { test, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { collection, doc, getDoc, getDocs, query, where, type Firestore } from 'firebase/firestore'
import { cancelarJob, cancelavel, descreverDoRobo, enviarParaRevisaoDoCliente, jobsDoPedido, motivoDoJob, pedidosDePrevia,
  pedirPreviaAoRobo, situacaoDoRobo, FILA_PARADA_MS, EXPIRA_MS } from '../src/lib/robo.ts'
import { aprovar } from '../src/lib/aprovacao.ts'
import { lerPreview } from '../src/lib/publicacao.ts'
import { faseDaPublicacao } from '../src/lib/publicar.ts'
import { mudarStatus, proximos, TODOS_STATUS } from '../src/lib/status.ts'
import { salvarVitrine, vitrinePadrao } from '../src/lib/vitrine.ts'
import type { AuditLog, BuildJob, Property, Request, UserRole } from '../src/lib/types.ts'
import { rodar } from '../../tools/worker.mjs'
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

// ── M2-6 ──

const MIN = 60_000, DIA = 24 * 60 * MIN, T0 = Date.parse('2026-10-21T12:00:00Z')
const ts = (ms: number) => Timestamp.fromMillis(ms) as unknown as BuildJob['createdAt']   // o do Admin SDK, com toMillis

test('M2-6 situação do robô: o pedido de prévia espera, a fila para, o pedido expira', () => {
  const r = { status: 'production' } as Request
  const cmd = (id: string, ms: number | null) => ({ id, timestamp: ms === null ? null : ts(ms) })
  assert.deepEqual(situacaoDoRobo(r, [], [], T0), { esperando: null, avisos: [] })
  assert.match(situacaoDoRobo(r, [], [cmd('c1', null)], T0).esperando!, /Pedido enviado/)        // acabou de clicar
  assert.match(situacaoDoRobo(r, [], [cmd('c1', T0 - 5 * MIN)], T0).esperando!, /Pedido enviado/)
  const parada = situacaoDoRobo(r, [], [cmd('c1', T0 - FILA_PARADA_MS - 2 * MIN)], T0)
  assert.equal(parada.esperando, null)
  assert.match(parada.avisos[0], /fila está parada.*32 min/)
  assert.match(situacaoDoRobo(r, [], [cmd('c1', T0 - EXPIRA_MS - MIN)], T0).avisos[0], /expirou/)
  // vale o último clique, e o clique que já virou job não espera nada
  const jobs = [{ id: 'c2', stage: 'preview', status: 'running' }] as BuildJob[]
  assert.deepEqual(situacaoDoRobo(r, jobs, [cmd('c1', T0 - EXPIRA_MS - MIN), cmd('c2', T0 - MIN)], T0), { esperando: null, avisos: [] })
  // fora de produção, o clique antigo não importa
  assert.deepEqual(situacaoDoRobo({ status: 'agency_review' } as Request, [], [cmd('c1', T0 - MIN)], T0), { esperando: null, avisos: [] })
})

test('M2-6 situação do robô: a aprovação espera o job de publicar; a prévia do canal vence', () => {
  const aprovado = { status: 'approved', lastAuditId: 'log1', approvedAt: ts(T0 - 2 * MIN) } as Request
  assert.match(situacaoDoRobo(aprovado, [], [], T0).esperando!, /publica na próxima execução/)
  assert.match(situacaoDoRobo({ ...aprovado, approvedAt: ts(T0 - 45 * MIN) }, [], [], T0).avisos[0], /aprovação espera o robô há 45 min/)
  const publicar = { id: 'publicar-log1', stage: 'publish', status: 'pending' } as BuildJob
  assert.deepEqual(situacaoDoRobo(aprovado, [publicar], [], T0), { esperando: null, avisos: [] })

  const preview = { build: 'a1b2c3d4e5f6' } as Request['preview']
  const previa = (build: string, vence: number) => ({ id: build + vence, stage: 'preview', status: 'succeeded', build,
    previewExpiresAt: ts(vence) }) as BuildJob
  const emRevisao = { status: 'agency_review', preview } as Request
  assert.deepEqual(situacaoDoRobo(emRevisao, [previa('a1b2c3d4e5f6', T0 + 10 * DIA)], [], T0).avisos, [])
  assert.deepEqual(situacaoDoRobo(emRevisao, [previa('a1b2c3d4e5f6', T0 + 2 * DIA + MIN)], [], T0).avisos, ['A prévia vence no canal em 3 dias.'])
  assert.deepEqual(situacaoDoRobo(emRevisao, [previa('a1b2c3d4e5f6', T0 + 5 * MIN)], [], T0).avisos, ['A prévia vence no canal em 1 dia.'])
  assert.match(situacaoDoRobo({ ...aprovado, preview }, [publicar, previa('a1b2c3d4e5f6', T0 - MIN)], [], T0).avisos[0], /venceu/)
  // a prévia de outro build não conta; a mais nova do mesmo build vale
  assert.deepEqual(situacaoDoRobo(emRevisao, [previa('ffffffffffff', T0 + MIN)], [], T0).avisos, [])
  assert.deepEqual(situacaoDoRobo(emRevisao, [previa('a1b2c3d4e5f6', T0 + MIN), previa('a1b2c3d4e5f6', T0 + 20 * DIA)], [], T0).avisos, [])
})

test('M2-6 cancelar: some depois que o deploy do live começa', () => {
  const j = (stage: string, status: string, step?: string) => ({ stage, status, step }) as BuildJob
  assert.equal(cancelavel(j('publish', 'pending')), true)
  assert.equal(cancelavel(j('publish', 'running', 'assemble')), true)
  for (const step of ['deploy', 'check_live', 'register']) assert.equal(cancelavel(j('publish', 'running', step)), false, step)
  assert.equal(cancelavel(j('preview', 'running', 'register')), true)                 // a prévia ainda para no registro
  assert.equal(cancelavel({ ...j('preview', 'running', 'build'), cancelRequested: true }), false)
  assert.equal(cancelavel(j('publish', 'succeeded', 'register')), false)
})

test('M2-6 histórico: o que o robô pediu e por que parou, em português', () => {
  const retido = { action: 'worker:retido', after: { jobId: 'j1', stage: 'publish', code: 'OUT_OF_SCOPE', message: 'publicar x mudaria imovel/y' } }
  assert.equal(descreverDoRobo(retido), 'O robô parou ao publicar: A publicação mexeria em outro imóvel do site.')
  assert.equal(descreverDoRobo({ action: 'worker:retido', after: { stage: 'preview', code: 'NOVO', message: 'texto do robô' } }),
    'O robô parou na prévia: texto do robô')
  assert.equal(descreverDoRobo({ action: 'worker:previa' }), 'Pediu a prévia ao robô')
  assert.equal(descreverDoRobo({ action: 'status:approved' }), null)
})

test('M2-6 publicação: publicando, no ar, fora do ar, substituído; e ninguém tem botão de publicar', () => {
  const p = { publishedRequestId: 'r1', tourUrl: 'https://imoveis/imovel/x', maqueteUrl: 'https://imoveis/maquete/x' } as Property
  assert.deepEqual(faseDaPublicacao({ id: 'r1', status: 'approved' }, null, null), { fase: 'publicando' })
  assert.deepEqual(faseDaPublicacao({ id: 'r1', status: 'published' }, p, null),
    { fase: 'no_ar', tourUrl: 'https://imoveis/imovel/x', maqueteUrl: 'https://imoveis/maquete/x' })
  assert.equal(faseDaPublicacao({ id: 'r1', status: 'published' }, p, { online: false })!.fase, 'fora_do_ar')
  assert.equal(faseDaPublicacao({ id: 'r1', status: 'published' }, { ...p, publishedRequestId: 'r2' }, null)!.fase, 'substituido')
  assert.equal(faseDaPublicacao({ id: 'r1', status: 'agency_review' }, p, null), null)
  // os botões de status de qualquer papel, em qualquer status, nunca levam a "publicado"
  const papeis: UserRole[] = ['platform_admin', 'operator', 'agency_manager', 'agent']
  for (const papel of papeis) for (const status of TODOS_STATUS) {
    assert.equal(proximos({ status, requestedBy: 'u' }, papel, 'u').includes('published'), false, `${papel} em ${status}`)
  }
})

test('M2-6 o cartão acompanha o job: aprovado, na fila, publicando, no ar e fora do ar', async () => {
  const op = await entrar('op'), gerA = await entrar('gerA')
  const texto = manifesto('a1b2c3d4e5f6')
  await emProducao()
  await mudarStatus(op.db, 'op', await ler(op.db, 'pedCedros'), 'agency_review',
    { preview: await lerPreview(tour('a1b2c3d4e5f6'), UNID, servir(texto)) })
  await aprovar(gerA.db, 'gerA', await ler(gerA.db, 'pedCedros'))
  const jobs = async () => (await getDocs(jobsDoPedido(op.db, 'pedCedros'))).docs.map((d) => ({ id: d.id, ...d.data() }) as BuildJob)
  const r = await ler(op.db, 'pedCedros')
  assert.match(situacaoDoRobo(r, await jobs(), [], Date.now()).esperando!, /publica na próxima execução/)
  assert.deepEqual(faseDaPublicacao(await ler(gerA.db, 'pedCedros'), null, null), { fase: 'publicando' })

  await rodar(adminDb(), { dono: 'A', sinalMs: 0 } as Parameters<typeof rodar>[1])   // o robô cria o job da aprovação
  const [j] = await jobs()
  assert.deepEqual([j.id, j.stage, j.status], ['publicar-' + r.lastAuditId, 'publish', 'pending'])
  assert.deepEqual(situacaoDoRobo(r, [j], [], Date.now()), { esperando: null, avisos: [] })
  await adminDb().doc('buildJobs/' + j.id).update({ status: 'running', step: 'deploy' })
  assert.equal(cancelavel((await jobs())[0]), false)

  // publicado (como o robô registra), visto pelo gerente com a vitrine do imóvel
  await adminDb().doc('requests/pedCedros').update({ status: 'published' })
  await adminDb().doc('properties/cedros').update({ publishedRequestId: 'pedCedros', tourUrl: 'https://imoveis/imovel/' + UNID,
    maqueteUrl: 'https://imoveis/maquete/' + UNID })
  const imovel = async () => ({ id: 'cedros', ...(await getDoc(doc(gerA.db, 'properties', 'cedros'))).data() }) as Property
  const vitrine = async () => (await getDoc(doc(gerA.db, 'vitrine', UNID))).data() ?? null
  assert.equal(faseDaPublicacao(await ler(gerA.db, 'pedCedros'), await imovel(), await vitrine())!.fase, 'no_ar')
  await salvarVitrine(gerA.db, UNID, { ...vitrinePadrao('cedros'), online: false })
  assert.equal(faseDaPublicacao(await ler(gerA.db, 'pedCedros'), await imovel(), await vitrine())!.fase, 'fora_do_ar')
})

test('M2-6 pedidos de prévia: a equipe lê para saber o que espera o robô; a imobiliária não', async () => {
  const op = await entrar('op'), gerA = await entrar('gerA')
  await emProducao()
  await pedirPreviaAoRobo(op.db, 'op', await ler(op.db, 'pedCedros'))
  const cmds = (await getDocs(pedidosDePrevia(op.db, 'pedCedros'))).docs.map((d) => ({ id: d.id, ...d.data() }) as AuditLog)
  assert.equal(cmds.length, 1)
  assert.match(situacaoDoRobo(await ler(op.db, 'pedCedros'), [], cmds, Date.now()).esperando!, /Pedido enviado/)
  await assert.rejects(getDocs(pedidosDePrevia(gerA.db, 'pedCedros')), /permission/i)
})
