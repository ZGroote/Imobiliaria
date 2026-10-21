// M2-5: a etapa de publicar do robô (tasks/painel/m2-worker.md §3, §8, §9 e §13), no fluxo legado
// (imóvel com pipelineUnitId). O ar é a fonte do que está publicado: o robô baixa o estado.json dele,
// reconstrói os builds no ar, traz o aprovado do canal, monta com o montar-live de sempre, confere o
// escopo, faz o deploy, relê o ar e registra como users/worker, com a registrarPublicacao do painel.
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Bloqueio } from './worker.mjs'
import { pipeline, reter } from './worker_previa.mjs'
import { BUILD, noAr } from '../painel/src/lib/publicacao.ts'
import { registrarPublicacao } from '../painel/src/lib/publicar.ts'
import { ROBO } from '../painel/src/lib/robo.ts'

const sha = (b) => createHash('sha256').update(b).digest('hex')
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const PUBLICADOS = ['tour.html', 'maquete.html', 'manifest.json']

// O que publicar X pode mudar no ar (§13, portão 8): o que é de X, o índice, o ponto no mapa geral, e
// tiles de quintal que entram ou saem (o conjunto é imutável: o nome é o hash). Devolve o resto que
// mudaria; qualquer coisa ali é decisão de alguém, não efeito colateral.
export function foraDoEscopo(antes, depois, imovel) {
  const deX = (k) => k.startsWith(`b/${imovel}/`) || [`imovel/${imovel}`, `maquete/${imovel}`, 'index.html', 'imoveis.json'].includes(k)
  return [...new Set([...Object.keys(antes), ...Object.keys(depois)])].sort()
    .filter((k) => antes[k] !== depois[k] && !deX(k) && !(k.startsWith('quintais/') && !(k in antes && k in depois)))
}

// O deploy do live: só o site de imóveis, sempre pela config dele (m2-worker.md §11).
export function comandoDeploy(projeto) {
  return ['firebase', 'deploy', '--only', 'hosting:imoveis', '--config', 'firebase.imoveis.json', '--project', projeto, '--json']
}
// O deploy de verdade (M2-8): o `public` do firebase.imoveis.json é publicacao/site. O erro vai para o
// job, não para o registro público.
export function deployFirebase({ raiz, projeto }) {
  return () => new Promise((ok, falha) => {
    const p = spawn('npx', comandoDeploy(projeto), { cwd: raiz, shell: process.platform === 'win32', stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    p.stderr.on('data', (d) => { err = (err + d).slice(-2000) })
    p.on('error', falha)
    p.on('close', (code) => code === 0 ? ok()
      : falha(Object.assign(new Error('deploy do live falhou: ' + err.trim().split('\n').at(-1)), { code: 'DEPLOY_ERROR' })))
  })
}

// db: Admin SDK (leituras e o próprio job). dbRobo: o Firestore do cliente como users/worker. ar: a URL
// do site de imóveis no ar. deploy(site): põe a pasta montada no ar. script(args): um script do
// pipeline, por padrão o de verdade. releituras e esperaMs: a releitura do ar depois do deploy.
export function executorPublicar({ db, dbRobo, raiz, ar, deploy, python = 'python', buscar = fetch, site,
  script = (args) => pipeline(python, raiz, args), releituras = 10, esperaMs = 6_000 }) {
  site ??= join(raiz, 'publicacao/site')
  const raizDoAr = new URL(ar.endsWith('/') ? ar : ar + '/')

  // O estado.json do ar, agora e sem cache. 404 ou formato errado nunca vira "site vazio" (W8).
  async function lerAr() {
    const r = await buscar(new URL('estado.json', raizDoAr).href, { cache: 'no-store' })
    if (r.status >= 500) throw new Error(`o ar respondeu HTTP ${r.status} ao estado.json`)
    if (!r.ok) throw new Bloqueio('STATE_UNREADABLE', `o ar não serve o estado.json (HTTP ${r.status})`)
    const bytes = Buffer.from(await r.arrayBuffer())
    let estado = null
    try { estado = JSON.parse(bytes.toString('utf-8')) } catch { /* fica null */ }
    const ok = estado?.schema === 1 && estado.imoveis && typeof estado.imoveis === 'object'
      && Object.entries(estado.imoveis).every(([i, x]) => SLUG.test(i) && BUILD.test(x?.atual ?? '')
        && (x.anterior == null || BUILD.test(x.anterior)))
    if (!ok) throw new Bloqueio('STATE_UNREADABLE', 'o estado.json do ar está fora do formato (schema 1)')
    return { bytes, sha: sha(bytes), estado }
  }

  // O artefato aprovado já está no ar: o build E o manifest.json que o gerente aprovou.
  function noArAprovado(estado, job) {
    try {
      const x = noAr(estado, job.pipelineUnitId)
      return x.atual === job.build && x.manifestSha256 === job.manifestSha256
    } catch { return false }
  }

  // O pedido como o job o pegou: em approved, com o par aprovado do job. Senão, o pedido seguiu (uma
  // aprovação nova tem o job dela), e este para sem mexer nele (§10).
  async function pedido(job) {
    const s = await db.doc('requests/' + job.requestId).get(), r = s.data()
    if (r?.status !== 'approved' || r.propertyId !== job.propertyId || r.approvedBuild !== job.build
      || r.approvedManifestSha256 !== job.manifestSha256) {
      throw new Bloqueio('REQUEST_CHANGED', 'o pedido saiu de approved ou não é mais a aprovação deste job')
    }
    return { id: s.id, ...r }
  }

  // Registra a publicação, se ainda não foi registrada (§8). O tipo da conta vai para o job (§1.2).
  async function registrar(job) {
    const p = { id: job.propertyId, ...(await db.doc('properties/' + job.propertyId).get()).data() }
    const s = await db.doc('requests/' + job.requestId).get()
    if (!(s.data()?.status === 'published' && p.publishedRequestId === s.id && p.publishedBuild === job.build)) {
      await registrarPublicacao(dbRobo, ROBO, await pedido(job), p, raizDoAr.href, buscar, job.id)
    }
    const kind = (await db.doc('agencies/' + job.agencyId).get()).data()?.kind ?? 'imobiliaria'
    return { policy: { kind }, nextStatus: 'published' }
  }

  // Os arquivos de um build, de uma pasta b/<id>/<build>/ servida para `destino`.
  async function baixar(origem, destino, falta) {
    await mkdir(destino, { recursive: true })
    for (const n of PUBLICADOS) {
      const r = await buscar(new URL(n, origem).href, { cache: 'no-store' })
      if (!r.ok) throw new Bloqueio(falta, `${origem.pathname}${n} não está lá (HTTP ${r.status})`)
      await writeFile(join(destino, n), Buffer.from(await r.arrayBuffer()))
    }
  }

  async function publicar(job, { passo }) {
    if (!job.pipelineUnitId) throw new Bloqueio('PRODUCTION_INPUT_UNSUPPORTED', 'só leitura fixada: o build pela planta é o M2-R')
    const imovel = job.pipelineUnitId, ref = db.doc('buildJobs/' + job.id)

    await passo('state')
    const r = await pedido(job)
    if (r.preview?.build !== job.build || r.preview.manifestSha256 !== job.manifestSha256) {
      throw new Bloqueio('APPROVAL_MISMATCH', 'a prévia registrada no pedido não é a aprovada')
    }
    const antes = await lerAr()
    if (noArAprovado(antes.estado, job)) {             // uma tentativa anterior já fez o deploy (§8)
      await passo('register')
      return { status: 'succeeded', campos: await registrar(job) }
    }
    await ref.update({ stateBeforeSha256: antes.sha })

    await passo('assemble')
    const tmp = await mkdtemp(join(tmpdir(), 'publicar-'))
    try {
      const builds = join(tmp, 'builds')
      for (const [i, x] of Object.entries(antes.estado.imoveis)) {
        for (const b of [x.atual, x.anterior].filter(Boolean)) {
          await baixar(new URL(`b/${i}/${b}/`, raizDoAr), join(builds, i, b), 'STATE_UNREADABLE')
        }
      }
      // o aprovado vem do canal, e é conferido antes do montar-live, que confere de novo (portão 7)
      const aprovado = join(builds, imovel, job.build)
      await baixar(new URL('./', r.preview.tourUrl), aprovado, 'PREVIEW_GONE')
      const m = await readFile(join(aprovado, 'manifest.json'))
      if (sha(m) !== job.manifestSha256) throw new Bloqueio('PREVIEW_GONE', 'o canal tem outra prévia')
      const { arquivos } = JSON.parse(m)
      for (const n of ['tour.html', 'maquete.html']) {
        const b = await readFile(join(aprovado, n))
        if (b.length !== arquivos[n].bytes || sha(b) !== arquivos[n].sha256) throw new Bloqueio('CHANNEL_MISMATCH', `o canal serve outro ${n}`)
      }
      await writeFile(join(tmp, 'estado.json'), antes.bytes)
      await script(['pipeline/publicar_imovel.py', 'montar-live', 'promover', imovel, job.build, '--estado', join(tmp, 'estado.json'),
        '--manifest-aprovado', job.manifestSha256, '--builds', builds, '--site', site])
    } finally {
      await rm(tmp, { recursive: true, force: true })
    }
    const novo = await readFile(join(site, 'estado.json'))
    const fora = foraDoEscopo(antes.estado.arquivos ?? {}, JSON.parse(novo).arquivos, imovel)
    if (fora.length) throw new Bloqueio('OUT_OF_SCOPE', `publicar ${imovel} mudaria também: ${fora.slice(0, 20).join(', ')}`)
    const depois = sha(novo)

    await passo('deploy')
    await pedido(job)                                    // a aprovação de novo, logo antes do deploy
    if ((await lerAr()).sha !== antes.sha) throw new Bloqueio('STATE_CHANGED', 'o ar mudou desde a leitura do estado.json')
    await ref.update({ stateAfterSha256: depois })
    await deploy(site)

    await passo('check_live')
    for (let i = 1; (await lerAr().catch(() => null))?.sha !== depois; i++) {
      if (i >= releituras) throw new Bloqueio('LIVE_DIFFERENT', 'depois do deploy, o estado.json do ar não é o montado')
      await new Promise((ok) => setTimeout(ok, esperaMs))
    }

    await passo('register')
    return { status: 'succeeded', campos: { ...(await registrar(job)), stateBeforeSha256: antes.sha, stateAfterSha256: depois } }
  }

  publicar.aoFalhar = (job, erro) => reter(db, dbRobo, job, erro, 'approved')

  // Robô morto no meio (§9): o ar diz o que aconteceu. O aprovado está lá: o deploy aconteceu, falta
  // no máximo registrar. O ar é o de antes: nada aconteceu, recomeça. Outra coisa: o ar mudou.
  publicar.reconciliar = async (job) => {
    const agora = await lerAr()
    if (noArAprovado(agora.estado, job)) return { status: 'succeeded', campos: await registrar(job) }
    if (!job.stateBeforeSha256 || agora.sha === job.stateBeforeSha256) return null
    throw new Bloqueio('STATE_CHANGED', 'o ar mudou e não mostra o build aprovado')
  }
  return publicar
}
