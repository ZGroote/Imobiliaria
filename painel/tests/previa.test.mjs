// M2-3: a etapa de prévia do robô (tools/worker_previa.mjs; tasks/painel/m2-worker.md §1.2, §1.3,
// §13 e §15), no emulador. O build e a montagem são os scripts de verdade (Python); o "canal" é uma
// pasta servida por um HTTP local, e a conferência dos bytes é a de verdade. O robô entra como
// users/worker, por token próprio, e as regras do banco valem para ele.
import { test, before, beforeEach, afterEach, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deleteApp } from 'firebase/app'
import { getAuth } from 'firebase-admin/auth'
import { getApps } from 'firebase-admin/app'
import { semear, adminDb, Timestamp } from '../scripts/seed.mjs'
import { entrarComoRobo } from '../scripts/robo.mjs'
import { EMULADOR } from '../src/lib/ambiente.ts'
import { pedirPrevia } from '../../tools/buildjob.mjs'
import { rodar, Bloqueio, PRAZO_MS } from '../../tools/worker.mjs'
import { executorPrevia, pipeline, comandoCanal, lerSaidaCanal } from '../../tools/worker_previa.mjs'
import { sairDeTodos } from './apoio.ts'

const RAIZ = fileURLToPath(new URL('../../', import.meta.url))
const db = () => adminDb()
let servidor, porta, pastaCanal, appRobo, dbRobo, trabalho

// O canal: o que for copiado para pastaCanal/<imovel>/ é servido em http://127.0.0.1:<porta>/<imovel>/.
before(async () => {
  pastaCanal = await mkdtemp(join(tmpdir(), 'canal-'))
  servidor = http.createServer(async (req, res) => {
    const caminho = normalize(join(pastaCanal, decodeURIComponent(new URL(req.url, 'http://x').pathname)))
    if (!caminho.startsWith(pastaCanal)) return res.writeHead(403).end()
    const corpo = await readFile(caminho).catch(() => null)          // o 200 só depois de ler
    res.writeHead(corpo ? 200 : 404).end(corpo ?? undefined)
  })
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok))
  porta = servidor.address().port
})
after(async () => {
  servidor.close()
  await rm(pastaCanal, { recursive: true, force: true })
  await sairDeTodos()
})
beforeEach(async () => {
  await semear()
  await db().doc('users/worker').set({ name: 'Worker', email: '', role: 'platform_admin', active: true,
    createdAt: Timestamp.now(), updatedAt: Timestamp.now() })
  const token = await getAuth(getApps()[0]).createCustomToken('worker')
  ;({ app: appRobo, db: dbRobo } = await entrarComoRobo({ projectId: EMULADOR.projectId, apiKey: 'demo-key', token, emulador: EMULADOR }))
  trabalho = await mkdtemp(join(tmpdir(), 'previa-'))
})
afterEach(async () => {
  await deleteApp(appRobo)                                         // senão a conexão segura o processo
  await rm(trabalho, { recursive: true, force: true })
})

const canal = ({ estraga = null } = {}) => async (imovel, site) => {
  const destino = join(pastaCanal, imovel)
  await rm(destino, { recursive: true, force: true })
  await cp(site, destino, { recursive: true })
  if (estraga) {                                                   // 'manifest.json' ou 'tour.html'
    const [m] = await readdir(join(destino, 'b', imovel))
    const f = join(destino, 'b', imovel, m, estraga)
    await writeFile(f, (await readFile(f, 'utf-8')) + '\n')
  }
  return { url: `http://127.0.0.1:${porta}/${imovel}/`, expira: '2026-11-19T12:00:00Z' }
}
const roda = (opcoes = {}) => rodar(db(), { dono: 'A', sinalMs: 0, executores: { preview: executorPrevia({
  db: db(), dbRobo, raiz: RAIZ, canal: canal(), builds: join(trabalho, 'builds'), site: join(trabalho, 'site'), ...opcoes,
}) } })
const ler = async (p) => (await db().doc(p).get()).data()
async function emProducao(rid, campos = {}) {
  await db().doc('requests/' + rid).update({ status: 'production', ...campos })
  return (await pedirPrevia(db(), rid, 'op')).commandId
}
// O pedido foi retido na revisão interna: o log do status (que a imobiliária vê) só diz o job; o
// motivo, num log interno ao lado.
async function retido(rid, jobId, code) {
  const r = await ler('requests/' + rid)
  assert.equal(r.status, 'internal_review')
  const status = await ler('auditLogs/' + r.lastAuditId)
  assert.deepEqual([status.action, status.userId, status.visibility, status.after], ['status:internal_review', 'worker', 'agency',
    { status: 'internal_review', jobId }])
  const motivos = await db().collection('auditLogs').where('action', '==', 'worker:retido').where('entityId', '==', rid).get()
  assert.equal(motivos.size, 1)
  const m = motivos.docs[0].data()
  assert.deepEqual([m.visibility, m.userId, m.after.jobId, m.after.code], ['internal', 'worker', jobId, code])
}

test('M2-3 imobiliária: a prévia pronta vai direto para a revisão da imobiliária, e nada do cliente sai no console', async () => {
  await db().doc('requests/pedCedros').update({ title: 'SEGREDO-DO-CLIENTE', notes: 'SEGREDO-DO-CLIENTE' })
  const id = await emProducao('pedCedros')
  const saida = []
  const originais = ['log', 'info', 'warn', 'error'].map((k) => [k, console[k]])
  for (const [k] of originais) console[k] = (...a) => saida.push(a.join(' '))
  try { assert.equal((await roda()).encerrados, 1) } finally { for (const [k, f] of originais) console[k] = f }
  assert.equal(saida.join('\n').includes('SEGREDO'), false)

  const j = await ler('buildJobs/' + id)
  assert.deepEqual([j.status, j.step, j.policy, j.nextStatus], ['succeeded', 'register', { kind: 'imobiliaria' }, 'agency_review'])
  assert.match(j.build, /^[0-9a-f]{12}$/)
  assert.ok(j.previewExpiresAt instanceof Timestamp && j.commit)
  const r = await ler('requests/pedCedros')
  assert.equal(r.status, 'agency_review')
  assert.deepEqual(r.preview, { build: j.build, manifestSha256: j.manifestSha256, tourUrl: j.tourUrl, maqueteUrl: j.maqueteUrl })
  assert.equal(r.preview.tourUrl, `http://127.0.0.1:${porta}/monte-dos-cedros-37/b/monte-dos-cedros-37/${j.build}/tour.html`)
  const log = await ler('auditLogs/' + r.lastAuditId)
  assert.deepEqual([log.action, log.userId, log.after.jobId, log.after.build], ['status:agency_review', 'worker', id, j.build])
})

test('M2-3 construtora: a prévia pronta para na revisão interna', async () => {
  await db().doc('properties/imovelB').update({ pipelineUnitId: 'monte-dos-cedros-37' })
  const id = await emProducao('pedB')
  await roda()
  const j = await ler('buildJobs/' + id)
  assert.deepEqual([j.status, j.policy, j.nextStatus], ['succeeded', { kind: 'construtora' }, 'internal_review'])
  const r = await ler('requests/pedB')
  assert.deepEqual([r.status, r.preview.build], ['internal_review', j.build])
})

test('M2-3 o canal serve outros bytes (manifest ou tour): blocked, e o pedido vai para a revisão interna com o motivo', async () => {
  for (const [rid, estraga, mensagem] of [['pedCedros', 'manifest.json', /manifest/], ['pedColinas', 'tour.html', /tour\.html/]]) {
    await db().doc('properties/colinas').update({ pipelineUnitId: 'monte-dos-cedros-37' })
    const id = await emProducao(rid)
    await roda({ canal: canal({ estraga }) })
    const j = await ler('buildJobs/' + id)
    assert.deepEqual([j.status, j.error.code], ['blocked', 'CHANNEL_MISMATCH'])
    assert.match(j.error.message, mensagem)
    await retido(rid, id, 'CHANNEL_MISMATCH')
    assert.equal((await ler('requests/' + rid)).preview, undefined)
  }
})

test('M2-3 duas montagens com builds diferentes: BUILD_NOT_REPRODUCIBLE', async () => {
  const id = await emProducao('pedCedros')
  let montagens = 0
  const script = async (args) => {
    const r = await pipeline('python', RAIZ, args)
    return args[0].endsWith('build_imovel.py') && ++montagens === 2 ? { ...r, build: 'ffffffffffff' } : r
  }
  await roda({ script })
  assert.equal((await ler('buildJobs/' + id)).error.code, 'BUILD_NOT_REPRODUCIBLE')
  await retido('pedCedros', id, 'BUILD_NOT_REPRODUCIBLE')
})

test('M2-3 portões que recusam antes do build: mirra-114, só leitura fixada', async () => {
  // o build_imovel.py de verdade recusa a unidade que não se publica
  await db().doc('properties/cedros').update({ pipelineUnitId: 'mirra-114' })
  const id = await emProducao('pedCedros')
  await roda()
  assert.equal((await ler('buildJobs/' + id)).error.code, 'NAO_PUBLICAR')
  await retido('pedCedros', id, 'NAO_PUBLICAR')

  // imóvel do fluxo novo, só com a leitura fixada: o build pela planta é o M2-R
  await db().doc('requests/pedColinas').update({ status: 'production' })
  await db().doc('buildJobs/soLeitura').set({ stage: 'preview', trigger: 'click', status: 'pending', attempt: 0,
    requestId: 'pedColinas', propertyId: 'colinas', agencyId: 'agA', productionMode: 'premium', createdBy: 'op',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now() })
  await roda()
  assert.equal((await ler('buildJobs/soLeitura')).error.code, 'PRODUCTION_INPUT_UNSUPPORTED')
  await retido('pedColinas', 'soLeitura', 'PRODUCTION_INPUT_UNSUPPORTED')

  // na construtora, o mesmo caminho
  await db().doc('properties/imovelB').update({ pipelineUnitId: 'mirra-114' })
  const b = await emProducao('pedB')
  await roda()
  await retido('pedB', b, 'NAO_PUBLICAR')
})

test('M2-3 o pedido mudou depois de o job nascer: o job para sem mexer no pedido', async () => {
  const id = await emProducao('pedCedros')
  await rodar(db(), { dono: 'A', sinalMs: 0 })                       // só cria o job
  await db().doc('requests/pedCedros').update({ status: 'cancelled' })
  await roda()
  const j = await ler('buildJobs/' + id)
  assert.deepEqual([j.status, j.error.code, j.error.escalation], ['blocked', 'REQUEST_CHANGED', undefined])
  const r = await ler('requests/pedCedros')
  assert.deepEqual([r.status, r.lastAuditId], ['cancelled', undefined])

  // trocou de imóvel, ainda em produção: também não se mexe no pedido
  await db().doc('properties/colinas').update({ pipelineUnitId: 'monte-das-colinas-39' })
  const id2 = await emProducao('pedColinas')
  await rodar(db(), { dono: 'A', sinalMs: 0 })
  await db().doc('requests/pedColinas').update({ propertyId: 'cedros' })
  await roda()
  assert.equal((await ler('buildJobs/' + id2)).error.code, 'REQUEST_CHANGED')
  assert.deepEqual([(await ler('requests/pedColinas')).status, (await ler('requests/pedColinas')).lastAuditId], ['production', undefined])
})

test('M2-3 o pedido mudou durante o deploy e outro portão falhou: o pedido não é tocado', async () => {
  const id = await emProducao('pedCedros')
  const script = async () => ({ build: 'abcdefabcdef', manifest_sha256: 'a'.repeat(64) })   // sem build de verdade
  const canalQueCancela = async () => {
    await db().doc('requests/pedCedros').update({ status: 'cancelled' })
    throw new Bloqueio('CHANNEL_MISMATCH')
  }
  await roda({ script, canal: canalQueCancela })
  const j = await ler('buildJobs/' + id)
  assert.deepEqual([j.status, j.error.code, j.error.escalation], ['blocked', 'CHANNEL_MISMATCH', undefined])
  assert.deepEqual([(await ler('requests/pedCedros')).status, (await ler('requests/pedCedros')).lastAuditId], ['cancelled', undefined])
})

test('M2-3 robô morto depois de registrar: a reconciliação vê o registro e não refaz nada', async () => {
  const id = await emProducao('pedCedros')
  const preview = { build: 'abcdefabcdef', manifestSha256: 'a'.repeat(64), tourUrl: 'http://x/tour.html', maqueteUrl: 'http://x/maquete.html' }
  await db().doc('requests/pedCedros').update({ status: 'agency_review', preview })
  await rodar(db(), { dono: 'A', sinalMs: 0 })                       // só cria o job
  await db().doc('buildJobs/' + id).update({ status: 'running', attempt: 1, build: preview.build,
    manifestSha256: preview.manifestSha256, heartbeatAt: Timestamp.fromMillis(Date.now() - PRAZO_MS - 60_000) })
  const nada = async () => { throw new Error('não devia montar nada') }
  await roda({ script: nada })
  assert.equal((await ler('buildJobs/' + id)).status, 'succeeded')
})

test('M2-3 canal: o comando é sempre o do site de imóveis, e a saída dele é lida', () => {
  const c = comandoCanal('monte-dos-cedros-37', 'imobilaria-deccb')
  assert.deepEqual(c.slice(0, 3), ['firebase', 'hosting:channel:deploy', 'imovel-monte-dos-cedros-37'])
  for (const [k, v] of [['--only', 'imoveis'], ['--config', 'firebase.imoveis.json'], ['--project', 'imobilaria-deccb'], ['--expires', '30d']])
    assert.equal(c[c.indexOf(k) + 1], v)
  assert.ok(c.includes('--json'))
  const saida = JSON.stringify({ status: 'success', result: { 'imobilaria-deccb-imoveis': {
    site: 'imobilaria-deccb-imoveis', url: 'https://imobilaria-deccb-imoveis--imovel-x-ab12.web.app', expireTime: '2026-11-19T12:00:00Z' } } })
  assert.deepEqual(lerSaidaCanal(saida), { url: 'https://imobilaria-deccb-imoveis--imovel-x-ab12.web.app', expira: '2026-11-19T12:00:00Z' })
  assert.throws(() => lerSaidaCanal('{"status":"success","result":{}}'), /URL/)
})

test('M2-3 script: recusa é portão (blocked); Traceback é falha de infraestrutura (tenta de novo)', async () => {
  const recusa = await pipeline('python', RAIZ, ['-c', 'import sys; print("uma recusa", file=sys.stderr); sys.exit(1)']).catch((e) => e)
  assert.deepEqual([recusa.constructor.name, recusa.code, recusa.message], ['Bloqueio', 'BUILD_REFUSED', 'uma recusa'])
  const quebra = await pipeline('python', RAIZ, ['-c', 'raise RuntimeError("quebrou")']).catch((e) => e)
  assert.deepEqual([quebra.constructor.name, quebra.code], ['Error', undefined])
  assert.deepEqual(await pipeline('python', RAIZ, ['-c', 'print("progresso"); print(\'{"ok": 1}\')']), { ok: 1 })
})
