// M2-3: a etapa de prévia do robô (tasks/painel/m2-worker.md §3, §1.2, §1.3 e §13), no fluxo legado
// (imóvel com pipelineUnitId). O build e a montagem são os scripts de sempre; o robô monta duas
// vezes, sobe no canal, confere os bytes servidos e registra a prévia como users/worker.
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Timestamp } from 'firebase-admin/firestore'
import { Bloqueio } from './worker.mjs'
import { lerPreview } from '../painel/src/lib/publicacao.ts'
import { registrarPreviaDoRobo, reterNaRevisaoInterna } from '../painel/src/lib/robo.ts'

const sha = (b) => createHash('sha256').update(b).digest('hex')

// Um script do pipeline: a última linha do stdout é o JSON do resultado; o progresso vai para o
// stderr e fica aqui dentro, fora do registro público. Recusa do script (saída 1 sem Traceback) é
// portão; Traceback ou o processo que não sobe é falha de infraestrutura, e tenta de novo.
export function pipeline(python, raiz, args) {
  return new Promise((ok, falha) => {
    const p = spawn(python, args, { cwd: raiz, env: { ...process.env, PYTHONUTF8: '1' } })
    let out = '', err = ''
    p.stdout.on('data', (d) => { out += d })
    p.stderr.on('data', (d) => { err += d })
    p.on('error', falha)
    p.on('close', (code) => {
      if (code === 0) return ok(JSON.parse(out.trim().split('\n').at(-1)))
      const ultima = err.trim().split('\n').at(-1) ?? ''
      if (/Traceback/.test(err)) return falha(new Error('o script quebrou: ' + ultima))
      falha(new Bloqueio(/nao se publica/.test(ultima) ? 'NAO_PUBLICAR' : 'BUILD_REFUSED', ultima))
    })
  })
}

// O canal do Firebase. Só o site de imóveis, sempre pela config dele: a conta do robô pode
// publicar em qualquer site do projeto, e quem segura isso é este comando (m2-worker.md §11).
export function comandoCanal(imovel, projeto) {
  return ['firebase', 'hosting:channel:deploy', 'imovel-' + imovel, '--only', 'imoveis',
    '--config', 'firebase.imoveis.json', '--project', projeto, '--expires', '30d', '--json']
}
// A saída `--json` do canal: { result: { <site>: { url, expireTime } } }.
export function lerSaidaCanal(texto) {
  const site = Object.values(JSON.parse(texto).result ?? {})[0]
  if (!site?.url) throw new Error('o deploy do canal não devolveu a URL')
  return { url: site.url, expira: site.expireTime ?? null }
}
// O canal de verdade (M2-8): o `public` do firebase.imoveis.json é publicacao/site.
export function canalFirebase({ raiz, projeto }) {
  return (imovel) => new Promise((ok, falha) => {
    const p = spawn('npx', comandoCanal(imovel, projeto), { cwd: raiz, shell: process.platform === 'win32' })
    let out = ''
    p.stdout.on('data', (d) => { out += d })
    p.on('error', falha)
    p.on('close', (code) => {
      if (code !== 0) return falha(Object.assign(new Error('deploy do canal falhou'), { code: 'DEPLOY_ERROR' }))
      try { ok(lerSaidaCanal(out)) } catch (e) { falha(e) }
    })
  })
}

// Os bytes que o canal serve são os montados? O manifest pelo sha256 que o montar-preview devolveu,
// tour e maquete pelo manifest. A prévia sai do mesmo lerPreview do painel.
export async function conferirCanal(buscar, base, imovel, montado) {
  const pasta = new URL(`b/${imovel}/${montado.build}/`, base.endsWith('/') ? base : base + '/')
  const bytes = async (nome) => {
    const r = await buscar(new URL(nome, pasta).href, { cache: 'no-store' })
    if (!r.ok) throw new Bloqueio('CHANNEL_MISMATCH', `o canal não serve ${nome} (HTTP ${r.status})`)
    return Buffer.from(await r.arrayBuffer())
  }
  const m = JSON.parse((await bytes('manifest.json')).toString('utf-8'))
  for (const n of ['tour.html', 'maquete.html']) {
    const b = await bytes(n)
    if (b.length !== m.arquivos[n].bytes || sha(b) !== m.arquivos[n].sha256) {
      throw new Bloqueio('CHANNEL_MISMATCH', `o canal serve outro ${n}`)
    }
  }
  const preview = await lerPreview(new URL('tour.html', pasta).href, imovel, buscar)
  if (preview.manifestSha256 !== montado.manifest_sha256) throw new Bloqueio('CHANNEL_MISMATCH', 'o canal serve outro manifest.json')
  return { preview, commit: m.commit ?? null }
}

// db: Admin SDK (leituras e o próprio job). dbRobo: o Firestore do cliente como users/worker
// (painel/scripts/robo.mjs). canal(imovel, site) -> { url, expira }. script(args): um script do
// pipeline, por padrão o de verdade.
export function executorPrevia({ db, dbRobo, raiz, canal, python = 'python', buscar = fetch, builds, site,
  script = (args) => pipeline(python, raiz, args) }) {
  builds ??= join(raiz, 'publicacao/builds')
  site ??= join(raiz, 'publicacao/site')

  // O pedido como o job o deixou; se mudou, o job para sem mexer nele (m2-worker.md §10).
  async function pedido(job) {
    const s = await db.doc('requests/' + job.requestId).get()
    const r = s.data()
    if (r?.status !== 'production' || r.propertyId !== job.propertyId) {
      throw new Bloqueio('REQUEST_CHANGED', 'o pedido saiu de production ou trocou de imóvel')
    }
    return { id: s.id, ...r }
  }

  async function previa(job, { passo }) {
    if (!job.pipelineUnitId) throw new Bloqueio('PRODUCTION_INPUT_UNSUPPORTED', 'só leitura fixada: o build pela planta é o M2-R')
    await pedido(job)
    const imovel = job.pipelineUnitId, modo = ['--modo', job.productionMode]

    await passo('build')
    const segunda = await mkdtemp(join(tmpdir(), 'build-'))
    let build
    try {
      const a = await script(['pipeline/build_imovel.py', imovel, ...modo, '--builds', builds])
      const b = await script(['pipeline/build_imovel.py', imovel, ...modo, '--builds', segunda])
      if (a.build !== b.build) throw new Bloqueio('BUILD_NOT_REPRODUCIBLE', `duas montagens deram ${a.build} e ${b.build}`)
      build = a.build
    } finally {
      await rm(segunda, { recursive: true, force: true })
    }

    await passo('channel')
    const montado = await script(
      ['pipeline/publicar_imovel.py', 'montar-preview', imovel, build, '--builds', builds, '--site', site])
    await pedido(job)
    const { url, expira } = await canal(imovel, site)

    await passo('check_channel')
    const { preview, commit } = await conferirCanal(buscar, url, imovel, montado)

    await passo('register')
    const r = await pedido(job)
    const kind = (await db.doc('agencies/' + r.agencyId).get()).data()?.kind ?? 'imobiliaria'
    const para = kind === 'imobiliaria' ? 'agency_review' : 'internal_review'
    // antes de registrar, o job guarda o que vai registrar: se o robô morrer no meio, a
    // reconciliação sabe dizer se o registro aconteceu (m2-worker.md §9)
    await db.doc('buildJobs/' + job.id).update({ build: preview.build, manifestSha256: preview.manifestSha256 })
    await registrarPreviaDoRobo(dbRobo, r, para, preview, job.id)
    return { status: 'succeeded', campos: {
      tourUrl: preview.tourUrl, maqueteUrl: preview.maqueteUrl, commit, policy: { kind }, nextStatus: para,
      ...(expira ? { previewExpiresAt: Timestamp.fromDate(new Date(expira)) } : {}),
    } }
  }

  // Portão falhou (ou a 3ª tentativa): o pedido vai para a revisão interna, com o motivo (§1.3).
  // Pedido que já mudou não é tocado.
  previa.aoFalhar = async (job, erro) => {
    if (erro.code === 'REQUEST_CHANGED') return
    const s = await db.doc('requests/' + job.requestId).get()
    if (s.data()?.status !== 'production') return
    await reterNaRevisaoInterna(dbRobo, { id: s.id, ...s.data() },
      { jobId: job.id, stage: 'preview', code: erro.code ?? 'FAILED', message: String(erro.message).slice(0, 500) })
  }

  // Robô morto no meio: se o pedido já tem esta prévia, o registro aconteceu (§9).
  previa.reconciliar = async (job) => {
    const p = (await db.doc('requests/' + job.requestId).get()).data()?.preview
    return job.build && p?.build === job.build && p.manifestSha256 === job.manifestSha256 ? { status: 'succeeded' } : null
  }
  return previa
}
