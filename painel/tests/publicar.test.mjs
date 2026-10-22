// M2-5 e M2-7: as etapas de publicar e de reverter do robô (tools/worker_publicar.mjs; tasks/painel/
// m2-worker.md §3, §8, §9 e §13), no emulador. Builds, montar-preview e montar-live são os scripts de verdade (Python); o "ar" e
// o canal são pastas servidas por um HTTP local, e o deploy falso copia a pasta montada para o ar. O
// gerente aprova pelo SDK do navegador; o robô entra como users/worker, e as regras valem para os dois.
import { test, before, beforeEach, afterEach, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, normalize, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deleteApp } from 'firebase/app'
import { getAuth } from 'firebase-admin/auth'
import { getApps } from 'firebase-admin/app'
import { semear, adminDb, Timestamp } from '../scripts/seed.mjs'
import { entrarComoRobo } from '../scripts/robo.mjs'
import { EMULADOR } from '../src/lib/ambiente.ts'
import { aprovar } from '../src/lib/aprovacao.ts'
import { lerPreview } from '../src/lib/publicacao.ts'
import { registrarReversao } from '../src/lib/publicar.ts'
import { pedirReversaoAoRobo } from '../src/lib/robo.ts'
import { rodar, TravaPerdida, PRAZO_MS } from '../../tools/worker.mjs'
import { pipeline } from '../../tools/worker_previa.mjs'
import { executorPublicar, executorReverter, foraDoEscopo, comandoDeploy } from '../../tools/worker_publicar.mjs'
import { entrar, sairDeTodos } from './apoio.ts'
import { formatoNovo } from './formato-novo.mjs'

const RAIZ = fileURLToPath(new URL('../../', import.meta.url))
const X = 'monte-dos-cedros-37', Y = 'monte-das-colinas-39'
const db = () => adminDb()
const sha = (b) => createHash('sha256').update(b).digest('hex')
let servidor, porta, raizServida, fixo, buildX, buildX2, buildN, appRobo, dbRobo, trabalho, deploys

// http://127.0.0.1:<porta>/ar/ é o site no ar; /canal/<imovel>/ é o canal de prévia.
before(async () => {
  raizServida = await mkdtemp(join(tmpdir(), 'servido-'))
  servidor = http.createServer(async (req, res) => {
    const caminho = normalize(join(raizServida, decodeURIComponent(new URL(req.url, 'http://x').pathname)))
    if (!caminho.startsWith(raizServida)) return res.writeHead(403).end()
    const corpo = await readFile(caminho).catch(() => null)          // o 200 só depois de ler
    res.writeHead(corpo ? 200 : 404).end(corpo ?? undefined)
  })
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok))
  porta = servidor.address().port
  // Uma vez: os builds de X e Y; Y no ar (a primeira publicação de um site, à mão); X no canal.
  fixo = await mkdtemp(join(tmpdir(), 'fixo-'))
  const builds = join(fixo, 'builds')
  // Os builds de verdade daqui são do formato antigo: o novo pede o Chrome do exportador, que o CI não tem.
  // O formato novo vem do formatoNovo (o tour de verdade, o resto pequeno, o manifesto de verdade).
  const formato1 = ['--modo', 'leve', '--formato', '1', '--builds', builds]
  buildX = (await pipeline('python', RAIZ, ['pipeline/build_imovel.py', X, ...formato1])).build
  const buildY = (await pipeline('python', RAIZ, ['pipeline/build_imovel.py', Y, ...formato1])).build
  await pipeline('python', RAIZ, ['pipeline/publicar_imovel.py', 'montar-live', 'promover', Y, buildY, '--estado-vazio',
    '--manifest-aprovado', sha(await readFile(join(builds, Y, buildY, 'manifest.json'))), '--builds', builds, '--site', join(fixo, 'ar')])
  await pipeline('python', RAIZ, ['pipeline/publicar_imovel.py', 'montar-preview', X, buildX, '--builds', builds, '--site', join(fixo, 'canal')])
  // M2-7: X no ar com um par (atual = uma segunda versão válida do build, anterior = buildX)
  buildX2 = await variante(builds, X, buildX)
  const promove = async (b, de, para) => pipeline('python', RAIZ, ['pipeline/publicar_imovel.py', 'montar-live', 'promover', X, b,
    '--estado', join(fixo, de, 'estado.json'), '--manifest-aprovado', sha(await readFile(join(builds, X, b, 'manifest.json'))),
    '--builds', builds, '--site', join(fixo, para)])
  await promove(buildX, 'ar', 'ar-x1')
  await promove(buildX2, 'ar-x1', 'ar-par')
  // MG-6: X no formato novo, no canal e no ar com o par misturado (atual o novo, anterior o antigo)
  buildN = await formatoNovo(builds, X, buildX)
  await pipeline('python', RAIZ, ['pipeline/publicar_imovel.py', 'montar-preview', X, buildN, '--builds', builds, '--site', join(fixo, 'canal-novo')])
  await promove(buildN, 'ar-x1', 'ar-novo')
})

// Uma segunda versão do build, válida para o montar-live: a maquete com um comentário a mais, o build
// e o manifest recalculados (como os builds de mentira de tests/test_publicacao_live.py).
async function variante(builds, imovel, build) {
  const de = join(builds, imovel, build)
  const tour = await readFile(join(de, 'tour.html'))
  const maquete = Buffer.concat([await readFile(join(de, 'maquete.html')), Buffer.from('\n<!-- variante -->\n')])
  const novo = sha(Buffer.concat([tour, maquete])).slice(0, 12)
  const m = JSON.parse(await readFile(join(de, 'manifest.json'), 'utf-8'))
  m.build = novo
  m.arquivos['maquete.html'] = { bytes: maquete.length, sha256: sha(maquete) }
  const para = join(builds, imovel, novo)
  await mkdir(para, { recursive: true })
  await writeFile(join(para, 'tour.html'), tour)
  await writeFile(join(para, 'maquete.html'), maquete)
  await writeFile(join(para, 'manifest.json'), JSON.stringify(m, null, 2) + '\n')
  return novo
}
after(async () => {
  servidor.close()
  await rm(raizServida, { recursive: true, force: true })
  await rm(fixo, { recursive: true, force: true })
  await sairDeTodos()
})
beforeEach(async () => {
  await semear()
  await db().doc('users/worker').set({ name: 'Worker', email: '', role: 'platform_admin', active: true,
    createdAt: Timestamp.now(), updatedAt: Timestamp.now() })
  const token = await getAuth(getApps()[0]).createCustomToken('worker')
  ;({ app: appRobo, db: dbRobo } = await entrarComoRobo({ projectId: EMULADOR.projectId, apiKey: 'demo-key', token, emulador: EMULADOR }))
  await rm(raizServida, { recursive: true, force: true })
  await cp(join(fixo, 'ar'), arDir(), { recursive: true })
  await cp(join(fixo, 'canal'), join(raizServida, 'canal', X), { recursive: true })
  trabalho = await mkdtemp(join(tmpdir(), 'publicar-teste-'))
  deploys = 0
})
afterEach(async () => {
  await deleteApp(appRobo)
  await rm(trabalho, { recursive: true, force: true })
})

const arDir = () => join(raizServida, 'ar')
const AR = () => `http://127.0.0.1:${porta}/ar/`
const ler = async (p) => (await db().doc(p).get()).data()
// O deploy falso: o ar passa a ser a pasta montada, inteira.
const deployFalso = async (site) => {
  deploys++
  await rm(arDir(), { recursive: true, force: true })
  await cp(site, arDir(), { recursive: true })
}
const roda = (opcoes = {}) => rodar(db(), { dono: 'A', sinalMs: 0, executores: { publish: executorPublicar({
  db: db(), dbRobo, raiz: RAIZ, ar: AR(), deploy: deployFalso, site: join(trabalho, 'site'), releituras: 3, esperaMs: 0, ...opcoes,
}) } })
// Cada arquivo do ar e o sha256 dele.
async function arvore(pasta = arDir()) {
  const out = {}
  for (const f of await readdir(pasta, { recursive: true, withFileTypes: true })) {
    if (f.isFile()) { const p = join(f.parentPath, f.name); out[relative(pasta, p).replaceAll('\\', '/')] = sha(await readFile(p)) }
  }
  return out
}

// A equipe registra a prévia de X no pedido (lida do canal), e o gerente da conta aprova.
async function aprova(rid, gerente, build = buildX) {
  const preview = await lerPreview(`http://127.0.0.1:${porta}/canal/${X}/b/${X}/${build}/tour.html`, X)
  await db().doc('requests/' + rid).update({ status: 'agency_review', preview })
  const g = await entrar(gerente)
  await aprovar(g.db, gerente, { id: rid, ...(await ler('requests/' + rid)) })
  return 'publicar-' + (await ler('requests/' + rid)).lastAuditId
}
const imobiliaria = () => aprova('pedCedros', 'gerA')
async function construtora() {
  await db().doc('properties/imovelB').update({ pipelineUnitId: X })
  return aprova('pedB', 'gerB')
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
  assert.deepEqual([m.visibility, m.userId, m.after.jobId, m.after.stage, m.after.code], ['internal', 'worker', jobId, 'publish', code])
}
// Publicado de verdade: o ar mostra o build aprovado, e o registro bate com ele.
async function publicado(rid, pid, id) {
  const j = await ler('buildJobs/' + id), r = await ler('requests/' + rid), p = await ler('properties/' + pid)
  const estado = JSON.parse(await readFile(join(arDir(), 'estado.json')))
  assert.deepEqual([j.status, j.nextStatus, j.build, estado.imoveis[X].atual], ['succeeded', 'published', buildX, buildX])
  assert.equal(estado.arquivos[`b/${X}/${buildX}/manifest.json`], r.approvedManifestSha256)
  assert.equal(r.status, 'published')
  const log = await ler('auditLogs/' + r.lastAuditId)
  assert.deepEqual([log.action, log.userId, log.after.build, log.after.jobId], ['status:published', 'worker', buildX, id])
  assert.deepEqual([p.publishedBuild, p.publishedRequestId, p.tourUrl], [buildX, rid, AR() + 'imovel/' + X])
  const pub = await ler('publications/' + p.lastPublicationId)
  assert.deepEqual([pub.action, pub.build, pub.publishedBy, pub.requestId], ['publish', buildX, 'worker', rid])
  return j
}

test('M2-5 imobiliária: o gerente aprova, o robô publica e registra; o outro imóvel fica byte a byte', async () => {
  await db().doc('requests/pedCedros').update({ title: 'SEGREDO-DO-CLIENTE', notes: 'SEGREDO-DO-CLIENTE' })
  const id = await imobiliaria()
  const antes = await arvore(), estadoAntes = await readFile(join(arDir(), 'estado.json'))
  const saida = []
  const originais = ['log', 'info', 'warn', 'error'].map((k) => [k, console[k]])
  for (const [k] of originais) console[k] = (...a) => saida.push(a.join(' '))
  try { assert.equal((await roda()).encerrados, 1) } finally { for (const [k, f] of originais) console[k] = f }
  assert.equal(saida.join('\n').includes('SEGREDO'), false)

  const j = await publicado('pedCedros', 'cedros', id)
  assert.deepEqual([j.policy, j.step, j.attempt, deploys], [{ kind: 'imobiliaria' }, 'register', 1, 1])
  assert.deepEqual([j.stateBeforeSha256, j.stateAfterSha256], [sha(estadoAntes), sha(await readFile(join(arDir(), 'estado.json')))])
  // só mudou o que é de X, o índice e o estado; Y continua byte a byte
  const depois = await arvore()
  const mudou = Object.keys({ ...antes, ...depois }).filter((k) => antes[k] !== depois[k])
  assert.ok(mudou.length > 3)
  assert.deepEqual(mudou.filter((k) => !k.startsWith(`b/${X}/`) && ![`imovel/${X}`, `maquete/${X}`, 'index.html', 'estado.json'].includes(k)), [])
  assert.ok(Object.keys(antes).some((k) => k.startsWith(`b/${Y}/`)))
})

test('M2-5 construtora: o gerente aprova, o robô publica e registra', async () => {
  const id = await construtora()
  await roda()
  const j = await publicado('pedB', 'imovelB', id)
  assert.deepEqual([j.policy, deploys], [{ kind: 'construtora' }, 1])
})

test('M2-5 portão falha ao publicar, nas duas contas: o canal perdeu a prévia; revisão interna com o motivo, sem deploy', async () => {
  const antes = await arvore()
  const a = await imobiliaria()
  await rm(join(raizServida, 'canal'), { recursive: true, force: true })        // o canal venceu
  await roda()
  assert.deepEqual([(await ler('buildJobs/' + a)).status, (await ler('buildJobs/' + a)).error.code], ['blocked', 'PREVIEW_GONE'])
  await retido('pedCedros', a, 'PREVIEW_GONE')

  await cp(join(fixo, 'canal'), join(raizServida, 'canal', X), { recursive: true })
  const b = await construtora()
  const m = join(raizServida, 'canal', X, 'b', X, buildX, 'manifest.json')     // o canal recebeu outra prévia
  await writeFile(m, (await readFile(m, 'utf-8')) + '\n')
  await roda()
  assert.equal((await ler('buildJobs/' + b)).error.code, 'PREVIEW_GONE')
  await retido('pedB', b, 'PREVIEW_GONE')
  assert.deepEqual([deploys, (await ler('properties/imovelB')).publishedBuild], [0, undefined])
  assert.deepEqual(await arvore(), antes)

  // o manifest é o aprovado, mas o tour servido não é o dele
  await rm(join(raizServida, 'canal'), { recursive: true, force: true })
  await cp(join(fixo, 'canal'), join(raizServida, 'canal', X), { recursive: true })
  await db().doc('properties/colinas').update({ pipelineUnitId: X })
  const c = await aprova('pedColinas', 'gerA')
  const tour = join(raizServida, 'canal', X, 'b', X, buildX, 'tour.html')
  await writeFile(tour, (await readFile(tour, 'utf-8')) + '\n')
  await roda()
  assert.equal((await ler('buildJobs/' + c)).error.code, 'CHANNEL_MISMATCH')
  await retido('pedColinas', c, 'CHANNEL_MISMATCH')
})

test('M2-5 APPROVAL_MISMATCH: aprovação sem o manifest, ou com outra prévia no pedido; revisão interna com o motivo', async () => {
  // aprovação de antes da identidade do manifest: o job já nasce bloqueado, e ninguém clicou
  await db().doc('auditLogs/aprovSemManifest').set({ agencyId: 'agA', userId: 'gerA', entityType: 'request', entityId: 'pedCedros',
    action: 'status:approved', visibility: 'agency', timestamp: Timestamp.now() })
  await db().doc('requests/pedCedros').update({ status: 'approved', approvedBuild: buildX, lastAuditId: 'aprovSemManifest' })
  await roda()
  assert.deepEqual([(await ler('buildJobs/publicar-aprovSemManifest')).status, (await ler('buildJobs/publicar-aprovSemManifest')).error.code],
    ['blocked', 'APPROVAL_MISMATCH'])
  await retido('pedCedros', 'publicar-aprovSemManifest', 'APPROVAL_MISMATCH')

  // a prévia registrada no pedido não é a aprovada
  const id = await construtora()
  await db().doc('requests/pedB').update({ 'preview.build': 'ffffffffffff' })
  await roda()
  assert.equal((await ler('buildJobs/' + id)).error.code, 'APPROVAL_MISMATCH')
  await retido('pedB', id, 'APPROVAL_MISMATCH')
  assert.equal(deploys, 0)
})

test('M2-5 STATE_UNREADABLE: o ar sem estado.json (404) nunca vira site vazio; formato errado também', async () => {
  const a = await imobiliaria()
  await rm(join(arDir(), 'estado.json'))
  await roda()
  assert.equal((await ler('buildJobs/' + a)).error.code, 'STATE_UNREADABLE')
  await retido('pedCedros', a, 'STATE_UNREADABLE')
  assert.equal(deploys, 0)

  const b = await construtora()
  await writeFile(join(arDir(), 'estado.json'), JSON.stringify({ schema: 1, imoveis: { '../fora': { atual: 'abcdefabcdef' } } }))
  await roda()
  assert.match((await ler('buildJobs/' + b)).error.message, /formato/)
  await retido('pedB', b, 'STATE_UNREADABLE')
  assert.equal(deploys, 0)

  // o Hosting fora do ar (5xx) é infraestrutura: tenta de novo, sem mexer no pedido
  await db().doc('properties/colinas').update({ pipelineUnitId: X })
  const c = await aprova('pedColinas', 'gerA')
  const fora = async (url, init) => url.endsWith('/estado.json') ? { ok: false, status: 503 } : fetch(url, init)
  await roda({ buscar: fora })
  assert.deepEqual([(await ler('buildJobs/' + c)).status, (await ler('buildJobs/' + c)).error.code], ['pending', 'NETWORK'])
  assert.equal((await ler('requests/pedColinas')).status, 'approved')
})

test('M2-5 STATE_CHANGED e LIVE_DIFFERENT: o ar muda antes do deploy; o deploy não aparece no ar', async () => {
  const a = await imobiliaria()
  const script = async (args) => {
    const r = await pipeline('python', RAIZ, args)
    if (args[1] === 'montar-live') await writeFile(join(arDir(), 'estado.json'), (await readFile(join(arDir(), 'estado.json'), 'utf-8')) + '\n')
    return r
  }
  await roda({ script })
  assert.equal((await ler('buildJobs/' + a)).error.code, 'STATE_CHANGED')
  await retido('pedCedros', a, 'STATE_CHANGED')
  assert.equal(deploys, 0)

  const b = await construtora()
  await roda({ deploy: async () => { deploys++ } })                         // o deploy "passou", mas o ar é o de antes
  assert.equal((await ler('buildJobs/' + b)).error.code, 'LIVE_DIFFERENT')
  await retido('pedB', b, 'LIVE_DIFFERENT')
  deploys = 0

  // o pedido saiu de approved durante a montagem: o job para antes do deploy, sem mexer no pedido
  await db().doc('properties/colinas').update({ pipelineUnitId: X })
  const c = await aprova('pedColinas', 'gerA')
  const muda = async (args) => {
    const r = await pipeline('python', RAIZ, args)
    if (args[1] === 'montar-live') await db().doc('requests/pedColinas').update({ status: 'cancelled' })
    return r
  }
  await roda({ script: muda })
  assert.deepEqual([(await ler('buildJobs/' + c)).error.code, (await ler('buildJobs/' + c)).error.escalation], ['REQUEST_CHANGED', undefined])
  assert.deepEqual([(await ler('requests/pedColinas')).status, deploys], ['cancelled', 0])
})

test('M2-5 OUT_OF_SCOPE: publicar X mexeria no ponteiro de Y, feito por outro código; nada vai ao ar', async () => {
  const id = await imobiliaria()
  // Y no ar com um ponteiro de uma versão anterior do código (o estado.json registra esse)
  const ponteiro = join(arDir(), 'imovel', Y), estado = JSON.parse(await readFile(join(arDir(), 'estado.json')))
  await writeFile(ponteiro, (await readFile(ponteiro, 'utf-8')) + '<!-- vitrine antiga -->\n')
  estado.arquivos['imovel/' + Y] = sha(await readFile(ponteiro))
  await writeFile(join(arDir(), 'estado.json'), JSON.stringify(estado, null, 2) + '\n')
  await roda()
  const j = await ler('buildJobs/' + id)
  assert.deepEqual([j.status, j.error.code], ['blocked', 'OUT_OF_SCOPE'])
  assert.match(j.error.message, new RegExp(`imovel/${Y}$`))
  await retido('pedCedros', id, 'OUT_OF_SCOPE')
  assert.equal(deploys, 0)
})

test('M2-5 escopo: o que é de X, o índice e os quintais que entram ou saem passam; o resto é listado', () => {
  const antes = { 'b/x/aaa/tour.html': '1', 'b/x/bbb/tour.html': '2', 'imovel/x': '3', 'maquete/x': '4', 'index.html': '5',
    'b/y/ccc/tour.html': '6', 'imovel/y': '7', '404.html': '8', 'quintais/h1/0_0.bin': '9', 'quintais/h0/0_0.bin': '10' }
  const depois = { 'b/x/bbb/tour.html': '2', 'b/x/ddd/tour.html': '11', 'imovel/x': '12', 'maquete/x': '13', 'index.html': '14',
    'imoveis.json': '15', 'b/y/ccc/tour.html': '6', 'imovel/y': '7', '404.html': '8', 'quintais/h1/0_0.bin': '9', 'quintais/h2/0_0.bin': '16' }
  assert.deepEqual(foraDoEscopo(antes, depois, 'x'), [])
  assert.deepEqual(foraDoEscopo(antes, { ...depois, 'imovel/y': 'outro', '404.html': 'outro', 'quintais/h1/0_0.bin': 'outro',
    'b/xy/eee/tour.html': '17' }, 'x'), ['404.html', 'b/xy/eee/tour.html', 'imovel/y', 'quintais/h1/0_0.bin'])
  const { 'b/y/ccc/tour.html': _, ...semY } = depois
  assert.deepEqual(foraDoEscopo(antes, semY, 'x'), ['b/y/ccc/tour.html'])
})

test('M2-5 o robô morre depois do deploy: a execução seguinte registra e marca succeeded, sem novo deploy', async () => {
  const id = await imobiliaria()
  const morre = async (site) => { await deployFalso(site); throw new TravaPerdida() }
  assert.equal((await roda({ deploy: morre })).travaPerdida, true)
  const j = await ler('buildJobs/' + id)
  assert.deepEqual([j.status, j.step, (await ler('requests/pedCedros')).status], ['running', 'deploy', 'approved'])
  await db().doc('buildJobs/' + id).update({ heartbeatAt: Timestamp.fromMillis(Date.now() - PRAZO_MS - 60_000) })
  await roda({ deploy: async () => { throw new Error('não devia fazer deploy de novo') } })
  const fim = await publicado('pedCedros', 'cedros', id)
  assert.deepEqual([fim.attempt, deploys], [1, 1])

  // e se morrer depois de registrar, antes de encerrar o job: conta como feito, sem segundo registro
  await db().doc('buildJobs/' + id).update({ status: 'running', heartbeatAt: Timestamp.fromMillis(Date.now() - PRAZO_MS - 60_000) })
  await roda({ deploy: async () => { throw new Error('não devia fazer deploy de novo') } })
  assert.equal((await ler('buildJobs/' + id)).status, 'succeeded')
  assert.equal((await db().collection('publications').where('requestId', '==', 'pedCedros').get()).size, 1)
})

test('M2-5 o robô morre antes do deploy: a execução seguinte recomeça e publica', async () => {
  const id = await imobiliaria()
  const script = async (args) => {
    const r = await pipeline('python', RAIZ, args)
    if (args[1] === 'montar-live') throw new TravaPerdida()
    return r
  }
  await roda({ script })
  assert.deepEqual([(await ler('buildJobs/' + id)).status, (await ler('buildJobs/' + id)).step, deploys], ['running', 'assemble', 0])
  await db().doc('buildJobs/' + id).update({ heartbeatAt: Timestamp.fromMillis(Date.now() - PRAZO_MS - 60_000) })
  await roda()
  const j = await publicado('pedCedros', 'cedros', id)
  assert.deepEqual([j.attempt, deploys], [2, 1])
})

test('M2-5 o robô morre antes do deploy, e o ar muda no meio-tempo: STATE_CHANGED, sem novo deploy', async () => {
  const id = await imobiliaria()
  const script = async (args) => {
    const r = await pipeline('python', RAIZ, args)
    if (args[1] === 'montar-live') throw new TravaPerdida()
    return r
  }
  await roda({ script })
  await writeFile(join(arDir(), 'estado.json'), (await readFile(join(arDir(), 'estado.json'), 'utf-8')) + '\n')   // um deploy à mão
  await db().doc('buildJobs/' + id).update({ heartbeatAt: Timestamp.fromMillis(Date.now() - PRAZO_MS - 60_000) })
  await roda()
  assert.deepEqual([(await ler('buildJobs/' + id)).status, (await ler('buildJobs/' + id)).error.code, deploys], ['blocked', 'STATE_CHANGED', 0])
  await retido('pedCedros', id, 'STATE_CHANGED')
})

test('M2-5 falha depois do deploy: a tentativa seguinte só registra, sem novo deploy', async () => {
  const id = await imobiliaria()
  let depois = false, n = 0
  const buscar = async (url, init) => {
    if (depois && url.endsWith('/estado.json') && ++n === 2) throw new TypeError('fetch failed')   // a releitura do registro
    return fetch(url, init)
  }
  await roda({ buscar, deploy: async (site) => { await deployFalso(site); depois = true } })
  assert.deepEqual([(await ler('buildJobs/' + id)).status, (await ler('buildJobs/' + id)).error.code], ['pending', 'NETWORK'])
  await roda({ deploy: async () => { throw new Error('não devia fazer deploy de novo') } })
  const j = await publicado('pedCedros', 'cedros', id)
  assert.deepEqual([j.attempt, deploys], [2, 1])
})

test('M2-5 cancelar depois que o deploy começou não para: termina e confere', async () => {
  const id = await construtora()
  await roda({ deploy: async (site) => {
    await db().doc('buildJobs/' + id).update({ cancelRequested: true })
    await deployFalso(site)
  } })
  await publicado('pedB', 'imovelB', id)
})

test('M2-5 3ª falha de infraestrutura: failed, e o pedido vai para a revisão interna', async () => {
  const id = await imobiliaria()
  const antes = await arvore()
  const quebra = async () => { throw Object.assign(new Error('deploy do live falhou'), { code: 'DEPLOY_ERROR' }) }
  for (const [status, attempt] of [['pending', 1], ['pending', 2], ['failed', 3]]) {
    await roda({ deploy: quebra })
    const j = await ler('buildJobs/' + id)
    assert.deepEqual([j.status, j.attempt, j.error.code], [status, attempt, 'DEPLOY_ERROR'])
  }
  await retido('pedCedros', id, 'DEPLOY_ERROR')
  assert.deepEqual(await arvore(), antes)
})

test('M2-5 deploy: o comando é sempre o do site de imóveis', () => {
  const c = comandoDeploy('imobilaria-deccb')
  assert.deepEqual(c.slice(0, 2), ['firebase', 'deploy'])
  for (const [k, v] of [['--only', 'hosting:imoveis'], ['--config', 'firebase.imoveis.json'], ['--project', 'imobilaria-deccb']])
    assert.equal(c[c.indexOf(k) + 1], v)
})

// ── M2-7: reverter ──

const rodaVolta = (opcoes = {}) => rodar(db(), { dono: 'A', sinalMs: 0, executores: { rollback: executorReverter({
  db: db(), raiz: RAIZ, ar: AR(), deploy: deployFalso, site: join(trabalho, 'site'), releituras: 3, esperaMs: 0, ...opcoes,
}) } })
// X no ar com o par: atual buildX2 (pedAprovado), anterior buildX (pedCedros); o Firestore diz o mesmo. Com
// 'ar-novo', o atual é o build do formato novo (MG-6).
async function comPar(fixtura = 'ar-par', atual = buildX2) {
  await rm(arDir(), { recursive: true, force: true })
  await cp(join(fixo, fixtura), arDir(), { recursive: true })
  const m = async (b) => sha(await readFile(join(fixo, 'builds', X, b, 'manifest.json')))
  await db().doc('requests/pedCedros').update({ status: 'published', approvedBuild: buildX, approvedManifestSha256: await m(buildX) })
  await db().doc('requests/pedAprovado').update({ status: 'published', approvedBuild: atual, approvedManifestSha256: await m(atual) })
  await db().doc('properties/cedros').update({ publishedBuild: atual, publishedRequestId: 'pedAprovado',
    previousBuild: buildX, previousRequestId: 'pedCedros' })
}
async function pedeVolta() {
  const admin = await entrar('admin')
  await pedirReversaoAoRobo(admin.db, 'admin', { id: 'cedros', ...(await ler('properties/cedros')) })
  const s = await db().collection('auditLogs').where('action', '==', 'worker:reverter').get()
  return { admin, id: s.docs.map((d) => d.id).sort((a, b) => s.docs.find((d) => d.id === a).data().timestamp.toMillis()
    - s.docs.find((d) => d.id === b).data().timestamp.toMillis()).at(-1) }
}
const noArDeX = async () => JSON.parse(await readFile(join(arDir(), 'estado.json'))).imoveis[X]

test('M2-7 reverter: o admin pede, o robô volta o ar ao anterior sem registrar; o admin confere e registra', async () => {
  await comPar()
  const antes = await arvore()
  const { admin, id } = await pedeVolta()
  assert.equal((await rodaVolta()).encerrados, 1)
  const j = await ler('buildJobs/' + id)
  assert.deepEqual([j.stage, j.status, j.build, j.createdBy, deploys], ['rollback', 'succeeded', buildX, 'admin', 1])
  assert.deepEqual(await noArDeX(), { ...(await noArDeX()), atual: buildX, anterior: buildX2 })
  // só os ponteiros de X, o índice e o estado mudaram; os dois builds de X e o Y ficam byte a byte
  const depois = await arvore()
  const mudou = Object.keys({ ...antes, ...depois }).filter((k) => antes[k] !== depois[k])
  assert.deepEqual(mudou.filter((k) => ![`imovel/${X}`, `maquete/${X}`, 'index.html', 'estado.json'].includes(k)), [])
  assert.ok(mudou.includes(`imovel/${X}`))
  // o robô não registra: o imóvel continua dizendo o par de antes
  assert.deepEqual([(await ler('properties/cedros')).publishedBuild, (await ler('properties/cedros')).previousBuild], [buildX2, buildX])

  // pedir de novo antes de registrar: o ar já mostra o anterior, então termina sem novo deploy
  const outro = await pedeVolta()
  await rodaVolta({ deploy: async () => { throw new Error('não devia fazer deploy de novo') } })
  assert.equal((await ler('buildJobs/' + outro.id)).status, 'succeeded')

  // o admin confere o site e registra a volta, como antes do robô
  await registrarReversao(admin.db, 'admin', { id: 'cedros', ...(await ler('properties/cedros')) }, AR())
  const p = await ler('properties/cedros')
  assert.deepEqual([p.publishedBuild, p.previousBuild, p.publishedRequestId], [buildX, buildX2, 'pedCedros'])
})

test('M2-7 reverter sem anterior: o job nasce bloqueado; e o anterior que some depois do pedido também bloqueia', async () => {
  const admin = await entrar('admin')
  await assert.rejects(async () => pedirReversaoAoRobo(admin.db, 'admin', { id: 'cedros', ...(await ler('properties/cedros')) }),
    /anterior/)
  const c = await db().collection('auditLogs').add({ agencyId: 'agA', userId: 'admin', entityType: 'property', entityId: 'cedros',
    action: 'worker:reverter', visibility: 'internal', timestamp: Timestamp.now() })
  await rodaVolta()
  assert.deepEqual([(await ler('buildJobs/' + c.id)).status, (await ler('buildJobs/' + c.id)).error.code], ['blocked', 'NO_PREVIOUS_BUILD'])

  await comPar()
  const { id } = await pedeVolta()
  await rodar(db(), { dono: 'A', sinalMs: 0 })                       // só cria o job
  await db().doc('properties/cedros').update({ previousBuild: null, previousRequestId: null })
  await rodaVolta()
  assert.deepEqual([(await ler('buildJobs/' + id)).error.code, deploys], ['NO_PREVIOUS_BUILD', 0])
})

test('M2-7 portões: o ar sem o par, o anterior que não é o aprovado, o imóvel que muda, o admin que sai', async () => {
  await comPar()
  await rm(arDir(), { recursive: true, force: true })
  await cp(join(fixo, 'ar'), arDir(), { recursive: true })              // X nem está no ar
  const a = (await pedeVolta()).id
  await rodaVolta()
  assert.equal((await ler('buildJobs/' + a)).error.code, 'STATE_CHANGED')

  await comPar()
  await db().doc('requests/pedCedros').update({ approvedManifestSha256: 'a'.repeat(64) })
  const b = (await pedeVolta()).id
  await rodaVolta()
  assert.equal((await ler('buildJobs/' + b)).error.code, 'APPROVAL_MISMATCH')
  assert.equal(deploys, 0)
  assert.equal((await noArDeX()).atual, buildX2)

  // o imóvel mudou de build durante a montagem: para antes do deploy
  await comPar()
  const c = (await pedeVolta()).id
  const muda = async (args) => {
    const r = await pipeline('python', RAIZ, args)
    if (args[1] === 'montar-live') await db().doc('properties/cedros').update({ publishedBuild: 'ffffffffffff' })
    return r
  }
  await rodaVolta({ script: muda })
  assert.deepEqual([(await ler('buildJobs/' + c)).error.code, deploys], ['PROPERTY_CHANGED', 0])

  // quem pediu deixou de ser admin ativo antes de o robô começar
  await comPar()
  const d = (await pedeVolta()).id
  await rodar(db(), { dono: 'A', sinalMs: 0 })                       // só cria o job
  await db().doc('users/admin').update({ active: false })
  await rodaVolta()
  assert.deepEqual([(await ler('buildJobs/' + d)).error.code, deploys], ['NOT_ADMIN', 0])
})

test('M2-7 o robô morre depois do deploy da volta: a execução seguinte encerra, sem novo deploy e sem registrar', async () => {
  await comPar()
  const { id } = await pedeVolta()
  const morre = async (site) => { await deployFalso(site); throw new TravaPerdida() }
  assert.equal((await rodaVolta({ deploy: morre })).travaPerdida, true)
  assert.deepEqual([(await ler('buildJobs/' + id)).status, (await ler('buildJobs/' + id)).step], ['running', 'deploy'])
  await db().doc('buildJobs/' + id).update({ heartbeatAt: Timestamp.fromMillis(Date.now() - PRAZO_MS - 60_000) })
  await rodaVolta({ deploy: async () => { throw new Error('não devia fazer deploy de novo') } })
  assert.deepEqual([(await ler('buildJobs/' + id)).status, deploys, (await noArDeX()).atual], ['succeeded', 1, buildX])
  assert.equal((await ler('properties/cedros')).publishedBuild, buildX2)
})

// ── MG-6: o build novo (a maquete geral, manifest schema 2) misturado com o antigo no ar ──

const arquivosDe = async (b) => Object.keys(JSON.parse(await readFile(join(fixo, 'builds', X, b, 'manifest.json'))).arquivos)
const comCanalNovo = async () => {
  await rm(join(raizServida, 'canal', X), { recursive: true, force: true })
  await cp(join(fixo, 'canal-novo'), join(raizServida, 'canal', X), { recursive: true })
}

test('MG-6 o aprovado é do formato novo: o robô traz o build inteiro do canal, e Y (formato antigo) fica byte a byte', async () => {
  await comCanalNovo()
  const id = await aprova('pedCedros', 'gerA', buildN)
  const antes = await arvore()
  assert.equal((await roda()).encerrados, 1)
  const j = await ler('buildJobs/' + id), estado = JSON.parse(await readFile(join(arDir(), 'estado.json')))
  assert.deepEqual([j.status, j.build, estado.imoveis[X].atual, deploys], ['succeeded', buildN, buildN, 1])
  assert.equal((await ler('properties/cedros')).publishedBuild, buildN)
  // o build novo inteiro no ar, cada arquivo como o manifesto diz, e inventariado no estado.json
  const depois = await arvore(), nomes = await arquivosDe(buildN)
  assert.ok(nomes.includes('dados/maquete.js') && nomes.length > 3)
  for (const n of [...nomes, 'manifest.json']) {
    assert.equal(depois[`b/${X}/${buildN}/${n}`], sha(await readFile(join(fixo, 'builds', X, buildN, n))), n)
    assert.equal(estado.arquivos[`b/${X}/${buildN}/${n}`], depois[`b/${X}/${buildN}/${n}`], n)
  }
  const mudou = Object.keys({ ...antes, ...depois }).filter((k) => antes[k] !== depois[k])
  assert.deepEqual(mudou.filter((k) => !k.startsWith(`b/${X}/`) && ![`imovel/${X}`, `maquete/${X}`, 'index.html', 'estado.json'].includes(k)), [])
})

test('MG-6 o canal do formato novo perde um arquivo, ou serve outro: blocked e revisão interna, sem deploy', async () => {
  for (const [estraga, code, mensagem] of [
    [(p) => rm(join(p, 'dados/maquete.js')), 'PREVIEW_GONE', /dados\/maquete\.js/],
    [async (p) => writeFile(join(p, 'casa.js'), (await readFile(join(p, 'casa.js'), 'utf-8')) + '// outro\n'), 'CHANNEL_MISMATCH', /casa\.js/],
  ]) {
    await semear()                                               // semear apaga o users/worker: volta
    await db().doc('users/worker').set({ name: 'Worker', email: '', role: 'platform_admin', active: true,
      createdAt: Timestamp.now(), updatedAt: Timestamp.now() })
    deploys = 0
    await comCanalNovo()
    await estraga(join(raizServida, 'canal', X, 'b', X, buildN))
    const antes = await arvore(), id = await aprova('pedCedros', 'gerA', buildN)
    await roda()
    const j = await ler('buildJobs/' + id)
    assert.deepEqual([j.status, j.error.code, deploys], ['blocked', code, 0])
    assert.match(j.error.message, mensagem)
    await retido('pedCedros', id, code)
    assert.deepEqual(await arvore(), antes, 'o ar não mudou')
  }
})

test('MG-6 reverter com o par misturado: o atual do formato novo volta ao anterior do formato antigo, inteiro', async () => {
  await comPar('ar-novo', buildN)
  const antes = await arvore()
  const { id } = await pedeVolta()
  assert.equal((await rodaVolta()).encerrados, 1)
  assert.deepEqual([(await ler('buildJobs/' + id)).status, deploys], ['succeeded', 1])
  assert.deepEqual(await noArDeX(), { ...(await noArDeX()), atual: buildX, anterior: buildN })
  // o robô baixou os dois builds de X do ar e remontou: os dois ficam byte a byte, só os ponteiros mudam
  const depois = await arvore()
  const mudou = Object.keys({ ...antes, ...depois }).filter((k) => antes[k] !== depois[k])
  assert.deepEqual(mudou.filter((k) => ![`imovel/${X}`, `maquete/${X}`, 'index.html', 'estado.json'].includes(k)), [])
  assert.ok((await arquivosDe(buildN)).every((n) => depois[`b/${X}/${buildN}/${n}`]))
})

test('MG-6 um manifest no ar com caminho para fora da pasta: o robô recusa antes de gravar qualquer coisa dele', async () => {
  await comPar('ar-novo', buildN)
  const m = join(arDir(), 'b', X, buildN, 'manifest.json'), manifesto = JSON.parse(await readFile(m))
  manifesto.arquivos['../../fora.js'] = manifesto.arquivos['casa.js']
  await writeFile(m, JSON.stringify(manifesto, null, 2) + '\n')
  const { id } = await pedeVolta()
  await rodaVolta()
  const j = await ler('buildJobs/' + id)
  assert.deepEqual([j.status, j.error.code, deploys], ['blocked', 'STATE_UNREADABLE', 0])
  assert.match(j.error.message, /caminho de arquivo inválido/)
})
