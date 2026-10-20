// M2-2: a trava, a fila e a identidade dos jobs do robô (tools/worker.mjs; tasks/painel/m2-worker.md
// §3, §5, §8 e §9), no emulador. Os executores aqui são de mentira: as etapas de verdade vêm no M2-3.
import { test, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { semear, adminDb, Timestamp } from '../scripts/seed.mjs'
import { pedirPrevia } from '../../tools/buildjob.mjs'
import { rodar, pegarTrava, renovarTrava, soltarTrava, Bloqueio, PRAZO_MS, TENTATIVAS } from '../../tools/worker.mjs'
import { sairDeTodos } from './apoio.ts'

beforeEach(semear)
after(sairDeTodos)

const MIN = 60_000
const db = () => adminDb()
const roda = (opcoes = {}) => rodar(db(), { dono: 'A', sinalMs: 0, ...opcoes })
const job = async (id) => (await db().doc('buildJobs/' + id).get()).data()
const trava = async () => (await db().doc('workerLeases/global').get()).data()
const pede = async () => (await pedirPrevia(db(), 'pedCedros', 'op')).commandId
async function emProducao() {
  await db().doc('requests/pedCedros').update({ status: 'production' })
  return pede()
}
async function aprovado(logId) {
  await db().doc('auditLogs/' + logId).set({ agencyId: 'agA', userId: 'gerA', entityType: 'request', entityId: 'pedAprovado',
    action: 'status:approved', visibility: 'agency', timestamp: Timestamp.now() })
  await db().doc('requests/pedAprovado').update({ lastAuditId: logId, approvedManifestSha256: 'a'.repeat(64) })
}

test('M2-2 trava: um robô por vez; a vencida é assumida; quem perdeu não renova nem solta a do outro', async () => {
  const t0 = Date.now()
  const [a, b] = await Promise.all([pegarTrava(db(), 'A', t0), pegarTrava(db(), 'B', t0)])
  assert.notEqual(a, b)                                            // exatamente um pegou
  const dono = a ? 'A' : 'B', outro = a ? 'B' : 'A'
  assert.equal(await pegarTrava(db(), outro, t0 + 14 * MIN), false)
  assert.equal(await renovarTrava(db(), dono, t0 + 10 * MIN), true)  // agora vale até t0 + 25 min
  assert.equal(await pegarTrava(db(), outro, t0 + 24 * MIN), false)
  assert.equal(await pegarTrava(db(), outro, t0 + 26 * MIN), true)   // venceu sem sinal de vida
  assert.equal(await renovarTrava(db(), dono, t0 + 26 * MIN), false)
  await soltarTrava(db(), dono)
  assert.equal((await trava()).owner, outro)
  await soltarTrava(db(), outro)
  assert.equal(await trava(), undefined)
})

test('M2-2 sem trabalho: a execução não pega a trava nem escreve nada', async () => {
  const antes = (await db().collection('auditLogs').get()).size
  assert.deepEqual(await roda(), { trabalho: false })
  assert.equal(await trava(), undefined)
  assert.equal((await db().collection('auditLogs').get()).size, antes)
})

test('M2-2 identidade: o mesmo pedido de trabalho dá um job só; dois cliques, um job ativo', async () => {
  const c1 = await emProducao()
  const c2 = await pede()                                          // segundo clique, antes de o robô rodar
  assert.equal((await job(c1)), undefined)                         // quem cria é o robô
  const r = await roda()
  assert.equal(r.criados, 2)
  const estados = [await job(c1), await job(c2)].map((j) => [j.status, j.error?.code ?? null]).sort()
  assert.deepEqual(estados, [['cancelled', 'DUPLICATE'], ['pending', null]])
  const ativo = (await job(c1)).status === 'pending' ? await job(c1) : await job(c2)
  assert.deepEqual([ativo.stage, ativo.trigger, ativo.attempt, ativo.createdBy, ativo.productionMode],
    ['preview', 'click', 0, 'op', 'leve'])
  assert.deepEqual(await roda(), { trabalho: false })              // lido de novo: nada de novo
  assert.equal((await db().collection('buildJobs').where('requestId', '==', 'pedCedros').get()).size, 2)
})

test('M2-2 aprovação: cada aprovação do gerente vira um job de publicar, uma vez', async () => {
  await aprovado('aprov1')
  await roda()
  const j1 = await job('publicar-aprov1')
  assert.deepEqual([j1.stage, j1.trigger, j1.status, j1.build, j1.manifestSha256, j1.createdBy],
    ['publish', 'approval', 'pending', 'a1b2c3d4e5f6', 'a'.repeat(64), 'worker'])
  await roda()
  assert.equal((await db().collection('buildJobs').where('stage', '==', 'publish').get()).size, 1)
  // o job terminou, e o pedido foi aprovado de novo (outra aprovação, outro AuditLog): outro job
  await db().doc('buildJobs/publicar-aprov1').update({ status: 'succeeded' })
  await aprovado('aprov2')
  await roda()
  assert.equal((await job('publicar-aprov2')).status, 'pending')
})

test('M2-2 fatos que não passam viram job bloqueado, com o motivo', async () => {
  const add = async (x) => (await db().collection('auditLogs').add({ agencyId: 'agA', entityType: 'request',
    visibility: 'internal', timestamp: Timestamp.now(), ...x })).id
  const a = await add({ userId: 'op', entityId: 'pedB', action: 'worker:previa' })                         // não está em produção
  const b = await add({ userId: 'admin', entityType: 'property', entityId: 'cedros', action: 'worker:reverter' })  // sem build anterior
  const c = await add({ userId: 'op', entityType: 'property', entityId: 'cedros', action: 'worker:reverter' })     // não é admin
  await db().doc('requests/pedAprovado').update({ lastAuditId: 'logDeOutraCoisa' })                         // aprovação sem o log dela
  await roda()
  for (const [id, code] of [[a, 'REQUEST_NOT_IN_PRODUCTION'], [b, 'NO_PREVIOUS_BUILD'], [c, 'NOT_ADMIN'],
                            ['publicar-logDeOutraCoisa', 'REQUEST_CHANGED']]) {
    const j = await job(id)
    assert.deepEqual([j.status, j.error.code], ['blocked', code])
  }
})

test('M2-2 execução: assume, passa pelos passos e encerra; quem perde a trava para antes do passo seguinte', async () => {
  const c1 = await emProducao()
  const efeitos = []
  const r = await roda({ executores: { preview: async (j, { passo }) => {
    await passo('build'); efeitos.push('build')
    return { status: 'succeeded', campos: { build: 'abcdefabcdef' } }
  } } })
  assert.equal(r.encerrados, 1)
  const j = await job(c1)
  assert.deepEqual([j.status, j.attempt, j.step, j.build], ['succeeded', 1, 'build', 'abcdefabcdef'])
  const log = (await db().doc('auditLogs/' + j.lastAuditId).get()).data()
  assert.deepEqual([log.action, log.userId, log.visibility, log.entityId], ['status:succeeded', 'worker', 'internal', c1])
  assert.equal(await trava(), undefined)                           // soltou no fim

  // no meio do segundo job, outro robô assume a trava
  const c2 = await pede()
  const r2 = await roda({ executores: { preview: async (_, { passo }) => {
    await passo('build')
    await db().doc('workerLeases/global').set({ owner: 'B', jobId: null, expiresAt: Timestamp.fromMillis(Date.now() + PRAZO_MS) })
    await passo('channel')
    efeitos.push('deploy')
  } } })
  assert.equal(r2.travaPerdida, true)
  const j2 = await job(c2)
  assert.deepEqual([j2.status, j2.step], ['running', 'build'])    // nada escrito depois de perder
  assert.deepEqual(efeitos, ['build'])
  assert.equal((await trava()).owner, 'B')                         // a do outro continua
})

test('M2-2 encerrar: quem perdeu a trava depois do último passo não grava o resultado', async () => {
  const c1 = await emProducao()
  const r = await roda({ executores: { preview: async (_, { passo }) => {
    await passo('deploy')
    await db().doc('workerLeases/global').set({ owner: 'B', jobId: null, expiresAt: Timestamp.fromMillis(Date.now() + PRAZO_MS) })
    return { status: 'succeeded' }
  } } })
  assert.equal(r.travaPerdida, true)
  assert.deepEqual([(await job(c1)).status, (await job(c1)).step], ['running', 'deploy'])   // quem assumiu reconcilia
})

test('M2-2 cancelar: o pendente sai na hora; o em andamento para na próxima fronteira de passo', async () => {
  const c1 = await emProducao()
  await roda()
  await db().collection('auditLogs').add({ agencyId: 'agA', userId: 'op', entityType: 'buildJob', entityId: c1,
    action: 'worker:cancelar', visibility: 'internal', timestamp: Timestamp.now() })
  await roda()
  assert.deepEqual([(await job(c1)).status, (await job(c1)).error.code], ['cancelled', 'CANCELLED'])

  const c2 = await pede()
  let passou = false
  await roda({ executores: { preview: async (j, { passo }) => {
    await db().doc('buildJobs/' + j.id).update({ cancelRequested: true })
    await passo('build'); passou = true
  } } })
  assert.deepEqual([(await job(c2)).status, passou], ['cancelled', false])
})

test('M2-2 reconciliação: job sem sinal de vida recomeça; já na 3ª tentativa, failed', async () => {
  const velho = Timestamp.fromMillis(Date.now() - PRAZO_MS - MIN)
  const c1 = await emProducao()
  await roda()
  await db().doc('buildJobs/' + c1).update({ status: 'running', attempt: 1, heartbeatAt: velho })
  await roda({ executores: { preview: async () => ({ status: 'succeeded' }) } })
  assert.deepEqual([(await job(c1)).status, (await job(c1)).attempt], ['succeeded', 2])

  const c2 = await pede()
  await roda()
  await db().doc('buildJobs/' + c2).update({ status: 'running', attempt: TENTATIVAS, heartbeatAt: velho })
  await roda()
  assert.deepEqual([(await job(c2)).status, (await job(c2)).error.code], ['failed', 'LEASE_LOST'])
})

test('M2-2 falhas: infraestrutura tenta de novo até a 3ª; portão bloqueia na hora', async () => {
  const c1 = await emProducao()
  const rede = { preview: async () => { throw new Error('rede caiu') } }
  for (let i = 0; i < TENTATIVAS; i++) await roda({ executores: rede })
  const j = await job(c1)
  assert.deepEqual([j.status, j.attempt, j.error.code], ['failed', TENTATIVAS, 'NETWORK'])

  const c2 = await pede()
  await roda({ executores: { preview: async () => { throw new Bloqueio('CHANNEL_MISMATCH', 'o canal serve outro manifest') } } })
  assert.deepEqual([(await job(c2)).status, (await job(c2)).attempt, (await job(c2)).error.code], ['blocked', 1, 'CHANNEL_MISMATCH'])
})

test('M2-2 escrita: pelo Admin SDK, o robô só toca buildJobs, workerLeases e auditLogs', async () => {
  const fotografia = async () => {
    const r = {}
    for (const c of ['requests', 'properties', 'users', 'agencies', 'publications', 'vitrine', 'propertyReadings', 'invites'])
      r[c] = (await db().collection(c).get()).docs.map((d) => [d.id, d.data()])
    return r
  }
  await emProducao()
  await aprovado('aprov1')
  const antes = await fotografia()
  const r = await roda({ executores: {
    preview: async (_, { passo }) => { await passo('build'); return { status: 'succeeded' } },
    publish: async () => { throw new Bloqueio('STATE_UNREADABLE') },
  } })
  assert.equal(r.encerrados, 2)
  assert.deepEqual(await fotografia(), antes)
})
