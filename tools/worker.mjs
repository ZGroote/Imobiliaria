// O robô do M2 (tasks/painel/m2-worker.md): trava global, fila de jobs e identidade (§3, §5, §8, §9).
// Cada etapa (prévia, publicar, reverter...) é um executor passado em `executores`; o M2-2 não tem
// nenhuma ainda, então os jobs nascem e esperam. Pelo Admin SDK, o robô só escreve em buildJobs,
// workerLeases e nos AuditLogs dos jobs; o resto ele grava como users/worker, pelas regras (M2-3).
//
//   node tools/worker.mjs rodar --project <projectId>
//
// No emulador, FIRESTORE_EMULATOR_HOST pode ser usado normalmente.
import { hostname } from 'node:os'
import { pathToFileURL } from 'node:url'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { planejarDoBanco } from './buildjob.mjs'

export const PRAZO_MS = 15 * 60_000            // a trava vale 15 min sem sinal de vida
export const SINAL_MS = 60_000                 // sinal de vida a cada minuto
export const JANELA_MS = 48 * 3_600_000        // pedido de trabalho mais velho que isso não vira job
export const TENTATIVAS = 3
const ATIVOS = new Set(['pending', 'running'])
const FINAIS = new Set(['succeeded', 'blocked', 'failed', 'cancelled'])
const COMANDOS = ['worker:previa', 'worker:reverter', 'worker:cancelar']
const TRAVA = 'workerLeases/global'
const BUILD = /^[0-9a-f]{12}$/, SHA256 = /^[0-9a-f]{64}$/
const ts = (ms) => Timestamp.fromMillis(ms)

// Outro robô assumiu a trava: parar já, sem nenhuma escrita a mais.
export class TravaPerdida extends Error { constructor() { super('LEASE_LOST') } }
// Um portão recusou: o job vai para `blocked` na hora, sem nova tentativa.
export class Bloqueio extends Error { constructor(code, message = code) { super(message); this.code = code } }
class Cancelado extends Error { constructor() { super('CANCELLED') } }

// ── a trava (§5) ──

export function pegarTrava(db, dono, agora) {
  return db.runTransaction(async (t) => {
    const ref = db.doc(TRAVA), s = await t.get(ref)
    if (s.exists && s.data().owner !== dono && s.data().expiresAt.toMillis() > agora) return false
    t.set(ref, { owner: dono, jobId: null, expiresAt: ts(agora + PRAZO_MS) })
    return true
  })
}

// Renova a trava e o sinal de vida do job. Falso: outro assumiu.
export function renovarTrava(db, dono, agora, jobId = null) {
  return db.runTransaction(async (t) => {
    const ref = db.doc(TRAVA), s = await t.get(ref)
    if (!s.exists || s.data().owner !== dono) return false
    t.update(ref, { jobId, expiresAt: ts(agora + PRAZO_MS) })
    if (jobId) t.update(db.doc('buildJobs/' + jobId), { heartbeatAt: ts(agora), updatedAt: ts(agora) })
    return true
  })
}

export function soltarTrava(db, dono) {
  return db.runTransaction(async (t) => {
    const ref = db.doc(TRAVA), s = await t.get(ref)
    if (s.exists && s.data().owner === dono) t.delete(ref)
  })
}

async function confereTrava(t, db, dono) {
  const s = await t.get(db.doc(TRAVA))
  if (!s.exists || s.data().owner !== dono) throw new TravaPerdida()
}

// ── o que cada fato pede (§3) ──

export function planejarPublicacao(rid, r, p) {
  if (!r || r.status !== 'approved') throw new Bloqueio('REQUEST_CHANGED')
  if (!BUILD.test(r.approvedBuild ?? '') || !SHA256.test(r.approvedManifestSha256 ?? '')) throw new Bloqueio('APPROVAL_MISMATCH')
  if (!p) throw new Bloqueio('PROPERTY_NOT_FOUND')
  if (p.agencyId !== r.agencyId) throw new Bloqueio('AGENCY_MISMATCH')
  return {
    requestId: rid, propertyId: r.propertyId, agencyId: r.agencyId,
    ...(p.pipelineUnitId ? { pipelineUnitId: p.pipelineUnitId } : {}),
    ...(r.productionMode ? { productionMode: r.productionMode } : {}),
    requestedBy: r.requestedBy, createdBy: 'worker',
    build: r.approvedBuild, manifestSha256: r.approvedManifestSha256,
  }
}

export function planejarReversao(pid, p, autor) {
  if (!autor?.active || autor.role !== 'platform_admin') throw new Bloqueio('NOT_ADMIN')
  if (!p) throw new Bloqueio('PROPERTY_NOT_FOUND')
  if (!p.publishedBuild || !p.previousBuild) throw new Bloqueio('NO_PREVIOUS_BUILD')
  return { propertyId: pid, agencyId: p.agencyId, ...(p.pipelineUnitId ? { pipelineUnitId: p.pipelineUnitId } : {}) }
}

const ler = async (db, caminho) => { const s = await db.doc(caminho).get(); return s.exists ? s.data() : null }

// O job que o fato pede. Fato que não passa vira job `blocked`, com o motivo.
async function planejar(db, f) {
  const base = { agencyId: f.agencyId, createdBy: f.createdBy, stage: f.stage, trigger: f.trigger,
    ...(f.requestId ? { requestId: f.requestId } : {}), ...(f.propertyId ? { propertyId: f.propertyId } : {}) }
  try {
    if (f.stage === 'preview') return { ...base, ...(await planejarDoBanco(db, f.requestId, f.createdBy)), stage: 'preview', trigger: 'click' }
    if (f.stage === 'publish') {
      const r = await ler(db, 'requests/' + f.requestId)
      const log = r?.lastAuditId ? await ler(db, 'auditLogs/' + r.lastAuditId) : null
      if (log?.action !== 'status:approved') throw new Bloqueio('REQUEST_CHANGED')
      return { ...base, ...planejarPublicacao(f.requestId, r, r && await ler(db, 'properties/' + r.propertyId)) }
    }
    const p = await ler(db, 'properties/' + f.propertyId)
    return { ...base, ...planejarReversao(f.propertyId, p, await ler(db, 'users/' + f.createdBy)), createdBy: f.createdBy }
  } catch (e) {
    const code = e.code ?? String(e.message).split(':')[0]
    return { ...base, status: 'blocked', error: { code, message: e.message } }
  }
}

// O job nasce uma vez: a identidade é o fato (`create` numa transação), e a trava está na mão. Um
// pedido (ou, sem pedido, um imóvel) tem no máximo um job ativo: o fato a mais é consumido como
// `cancelled`, para não virar um segundo build depois.
export function criarJob(db, dono, id, dados, agora) {
  return db.runTransaction(async (t) => {
    const ref = db.doc('buildJobs/' + id)
    await confereTrava(t, db, dono)
    if ((await t.get(ref)).exists) return 'existe'
    let status = dados.status ?? 'pending', error = dados.error
    if (status === 'pending') {
      const [campo, valor] = dados.requestId ? ['requestId', dados.requestId] : ['propertyId', dados.propertyId]
      const irmaos = await t.get(db.collection('buildJobs').where(campo, '==', valor))
      const ativo = irmaos.docs.find((d) => ATIVOS.has(d.data().status))
      if (ativo) { status = 'cancelled'; error = { code: 'DUPLICATE', message: 'já há um job ativo: ' + ativo.id } }
    }
    const log = db.collection('auditLogs').doc()
    const resumo = ['stage', 'requestId', 'propertyId', 'pipelineUnitId', 'productionInput', 'productionMode', 'build']
    t.set(log, {
      agencyId: dados.agencyId ?? null, userId: dados.createdBy, entityType: 'buildJob', entityId: id,
      action: 'created', visibility: 'internal', timestamp: ts(agora),
      after: { status, ...Object.fromEntries(resumo.filter((k) => dados[k] !== undefined).map((k) => [k, dados[k]])) },
    })
    t.set(ref, { ...dados, status, ...(error ? { error } : {}), attempt: 0, lastAuditId: log.id,
      ...(FINAIS.has(status) ? { finishedAt: ts(agora) } : {}), createdAt: ts(agora), updatedAt: ts(agora) })
    return status
  })
}

// ── o que há para fazer (só leitura) ──

export async function coletar(db, agora, executores = {}) {
  const [cmds, aprovados, pendentes, rodando] = await Promise.all([
    db.collection('auditLogs').where('action', 'in', COMANDOS).where('timestamp', '>=', ts(agora - JANELA_MS)).get(),
    db.collection('requests').where('status', '==', 'approved').get(),
    db.collection('buildJobs').where('status', '==', 'pending').get(),
    db.collection('buildJobs').where('status', '==', 'running').get(),
  ])
  const fatos = []
  for (const c of cmds.docs) {
    const x = c.data()
    if (x.action === 'worker:previa') fatos.push({ id: c.id, stage: 'preview', trigger: 'click', requestId: x.entityId, agencyId: x.agencyId, createdBy: x.userId })
    if (x.action === 'worker:reverter') fatos.push({ id: c.id, stage: 'rollback', trigger: 'click', propertyId: x.entityId, agencyId: x.agencyId, createdBy: x.userId })
  }
  for (const r of aprovados.docs) {
    const x = r.data()
    if (x.lastAuditId) fatos.push({ id: 'publicar-' + x.lastAuditId, stage: 'publish', trigger: 'approval', requestId: r.id, agencyId: x.agencyId, createdBy: 'worker' })
  }
  const alvos = cmds.docs.filter((c) => c.data().action === 'worker:cancelar').map((c) => c.data().entityId)
  const [jaExistem, cancelaveis] = await Promise.all([
    fatos.length ? db.getAll(...fatos.map((f) => db.doc('buildJobs/' + f.id))) : [],
    alvos.length ? db.getAll(...alvos.map((id) => db.doc('buildJobs/' + id))) : [],
  ])
  const novos = fatos.filter((f, i) => !jaExistem[i].exists)
  const cancelar = cancelaveis.filter((s) => s.exists && (s.data().status === 'pending'
    || (s.data().status === 'running' && !s.data().cancelRequested))).map((s) => s.id)
  const executaveis = pendentes.docs.filter((d) => executores[d.data().stage])
  const mortos = rodando.docs.filter((d) => (d.data().heartbeatAt?.toMillis() ?? 0) < agora - PRAZO_MS)
  return { novos, cancelar, executaveis, mortos,
    trabalho: novos.length + cancelar.length + executaveis.length + mortos.length > 0 }
}

// ── o estado do job ──

function encerrar(db, dono, id, status, extra, agora) {
  return db.runTransaction(async (t) => {
    await confereTrava(t, db, dono)
    const ref = db.doc('buildJobs/' + id), job = (await t.get(ref)).data()
    const campos = { ...extra, status, updatedAt: ts(agora) }
    if (FINAIS.has(status)) {
      const log = db.collection('auditLogs').doc()
      t.set(log, { agencyId: job.agencyId ?? null, userId: 'worker', entityType: 'buildJob', entityId: id,
        action: 'status:' + status, visibility: 'internal', timestamp: ts(agora),
        after: { status, ...(extra.error ? { error: extra.error } : {}) } })
      Object.assign(campos, { finishedAt: ts(agora), lastAuditId: log.id })
    }
    t.update(ref, campos)
  })
}

async function cancelarJob(db, dono, id, agora) {
  const job = await ler(db, 'buildJobs/' + id)
  if (job?.status === 'pending') return encerrar(db, dono, id, 'cancelled', { error: { code: 'CANCELLED', message: 'cancelado pela equipe' } }, agora)
  if (job?.status === 'running') return db.doc('buildJobs/' + id).update({ cancelRequested: true, updatedAt: ts(agora) })
}

// O job acabou mal (portão, ou a 3ª falha): a etapa avisa o pedido (`aoFalhar`, por exemplo a
// revisão interna com o motivo, m2-worker.md §1.3), com a trava conferida antes. Se o aviso falhar,
// o motivo fica no próprio job.
async function falhou(db, dono, job, executor, status, error, agora) {
  if (executor?.aoFalhar) {
    if (!(await renovarTrava(db, dono, agora, job.id))) throw new TravaPerdida()
    try { await executor.aoFalhar(job, error) } catch (e) { error = { ...error, escalation: String(e.message) } }
  }
  return encerrar(db, dono, job.id, status, { error }, agora)
}

// Falha de infraestrutura: volta para a fila até a 3ª tentativa; depois, `failed`.
const tentarDeNovo = (db, dono, job, executor, error, agora) => (job.attempt ?? 0) < TENTATIVAS
  ? encerrar(db, dono, job.id, 'pending', { error }, agora)
  : falhou(db, dono, job, executor, 'failed', error, agora)

// Job `running` sem sinal de vida (§9): a etapa decide pelo que o mundo mostra (`reconciliar`);
// sem isso, recomeça do zero.
async function reconciliar(db, dono, doc, executores, agora) {
  const job = { id: doc.id, ...doc.data() }
  const executor = executores[job.stage]
  const decisao = executor?.reconciliar ? await executor.reconciliar(job) : null
  if (decisao?.status) return encerrar(db, dono, job.id, decisao.status, decisao.campos ?? {}, agora)
  return tentarDeNovo(db, dono, job, executor, { code: 'LEASE_LOST', message: 'o robô anterior parou sem sinal de vida' }, agora)
}

function assumir(db, dono, id, agora) {
  return db.runTransaction(async (t) => {
    await confereTrava(t, db, dono)
    const ref = db.doc('buildJobs/' + id), s = await t.get(ref)
    if (s.data()?.status !== 'pending') return null
    const job = s.data()
    t.update(ref, { status: 'running', attempt: (job.attempt ?? 0) + 1, startedAt: ts(agora), heartbeatAt: ts(agora), updatedAt: ts(agora) })
    t.update(db.doc(TRAVA), { jobId: id, expiresAt: ts(agora + PRAZO_MS) })
    return { id, ...job, attempt: (job.attempt ?? 0) + 1 }
  })
}

async function executar(db, dono, job, executor, agora, sinalMs) {
  let perdida = false
  const timer = sinalMs ? setInterval(async () => {
    if (!(await renovarTrava(db, dono, agora(), job.id).catch(() => false))) perdida = true
  }, sinalMs) : null
  const ref = db.doc('buildJobs/' + job.id)
  // Fronteira de passo: a trava ainda é minha? Pediram para cancelar? Só então o passo seguinte.
  const passo = async (step) => {
    if (perdida || !(await renovarTrava(db, dono, agora(), job.id))) throw new TravaPerdida()
    if ((await ref.get()).data().cancelRequested) throw new Cancelado()
    if (step) await ref.update({ step, updatedAt: ts(agora()) })
  }
  try {
    const r = await executor(job, { passo })
    await encerrar(db, dono, job.id, r?.status ?? 'succeeded', r?.campos ?? {}, agora())
  } catch (e) {
    if (e instanceof TravaPerdida) throw e
    if (e instanceof Cancelado) return encerrar(db, dono, job.id, 'cancelled', { error: { code: 'CANCELLED', message: 'cancelado pela equipe' } }, agora())
    if (e instanceof Bloqueio) return falhou(db, dono, job, executor, 'blocked', { code: e.code, message: e.message }, agora())
    return tentarDeNovo(db, dono, job, executor, { code: e.code ?? 'NETWORK', message: String(e.message) }, agora())
  } finally {
    if (timer) clearInterval(timer)
  }
}

// ── uma execução (§5) ──

export async function rodar(db, { dono, agora = Date.now, executores = {}, limiteMs = 45 * 60_000, sinalMs = SINAL_MS } = {}) {
  const inicio = agora()
  if (!(await coletar(db, inicio, executores)).trabalho) return { trabalho: false }
  if (!(await pegarTrava(db, dono, agora()))) return { trabalho: true, trava: false }
  const feito = { trabalho: true, trava: true, criados: 0, encerrados: 0 }
  try {
    const c = await coletar(db, agora(), executores)        // de novo, com a trava na mão
    for (const d of c.mortos) await reconciliar(db, dono, d, executores, agora())
    for (const id of c.cancelar) await cancelarJob(db, dono, id, agora())
    for (const f of c.novos) {
      await criarJob(db, dono, f.id, await planejar(db, f), agora())
      feito.criados++
    }
    const fila = (await db.collection('buildJobs').where('status', '==', 'pending').get()).docs
      .filter((d) => executores[d.data().stage])
      .sort((a, b) => a.data().createdAt.toMillis() - b.data().createdAt.toMillis())
    for (const d of fila) {
      if (agora() - inicio > limiteMs) break
      const job = await assumir(db, dono, d.id, agora())
      if (!job) continue
      await executar(db, dono, job, executores[job.stage], agora, sinalMs)
      feito.encerrados++
    }
  } catch (e) {
    if (!(e instanceof TravaPerdida)) throw e
    return { ...feito, travaPerdida: true }
  } finally {
    await soltarTrava(db, dono)
  }
  return feito
}

function args(argv) {
  const [cmd, ...rest] = argv
  let project = ''
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === '--project') project = rest[++i] ?? ''
    else throw new Error('argumento desconhecido: ' + rest[i])
  }
  if (cmd !== 'rodar' || !project) throw new Error('uso: node tools/worker.mjs rodar --project <projectId>')
  return { project }
}

async function main(argv = process.argv.slice(2)) {
  const a = args(argv)
  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: a.project }))
  const dono = process.env.GITHUB_RUN_ID
    ? `gha-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT ?? 1}`
    : `local-${hostname()}-${process.pid}`
  // Só ids e contagens: o registro das execuções não leva dado de cliente (§11).
  console.log(JSON.stringify({ dono, ...(await rodar(db, { dono })) }))
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
