import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { collection, doc, getDoc, getDocs, orderBy, query, where, type Firestore } from 'firebase/firestore'
import { aprovar, registrarPreview } from '../src/lib/aprovacao.ts'
import { comandoPromover, comandoReverter, comandosPreview, conferirNoAr, lerEstado, linksPublicos, noAr }
  from '../src/lib/publicacao.ts'
import { registrarPublicacao, registrarReversao } from '../src/lib/publicar.ts'
import { criarPedido, editarPedidoInterno } from '../src/lib/pedidos.ts'
import { mudarStatus } from '../src/lib/status.ts'
import type { Property, Request } from '../src/lib/types.ts'
import { semear } from '../scripts/seed.mjs'
import { entrar, sairDeTodos } from './apoio.ts'

before(semear)
after(sairDeTodos)

const UNID = 'monte-dos-cedros-37', SITE = 'https://imoveis.example/'
const pedido = async (db: Firestore, id: string) => ({ id, ...(await getDoc(doc(db, 'requests', id))).data() }) as Request
const imovel = async (db: Firestore, id: string) => ({ id, ...(await getDoc(doc(db, 'properties', id))).data() }) as Property
const manifestDe = (build: string) => createHash('sha256').update(`manifest de ${build}`).digest('hex')
// O estado.json do site: outra operação pode mexer no live entre a conferência e o registro.
let noArAgora = ''
const siteRemoto = async (u: string) => ({ ok: u === `${SITE}estado.json`, status: 200,
  json: async () => ({ schema: 1, imoveis: { [UNID]: { atual: noArAgora, anterior: null } } }) })
const preview = (build: string) => ({ build, tourUrl: `${SITE}b/${UNID}/${build}/tour.html`,
  maqueteUrl: `${SITE}b/${UNID}/${build}/maquete.html`, manifestSha256: manifestDe(build) })

// Um ciclo inteiro até "approved": aceitar, produzir, preview, aprovação do gerente.
async function aprovado(rid: string, build: string) {
  const op = await entrar('op'), gerA = await entrar('gerA')
  await mudarStatus(op.db, 'op', await pedido(op.db, rid), 'accepted')
  await mudarStatus(op.db, 'op', await pedido(op.db, rid), 'production')
  await registrarPreview(op.db, 'op', await pedido(op.db, rid), preview(build))
  await aprovar(gerA.db, 'gerA', await pedido(gerA.db, rid))
}

test('estado.json: o que está no ar, e a conferência antes de registrar', async () => {
  const e = { schema: 1, imoveis: { [UNID]: { atual: 'a1b2c3d4e5f6', anterior: null } } }
  assert.deepEqual(noAr(e, UNID), { atual: 'a1b2c3d4e5f6', anterior: null })
  assert.throws(() => noAr(e, 'outro'), /ainda não tem/)
  assert.throws(() => noAr({ schema: 2 }, UNID), /schema 1/)
  assert.throws(() => noAr({ schema: 1, imoveis: { [UNID]: { atual: 'x' } } }, UNID), /build válido/)
  assert.doesNotThrow(() => conferirNoAr({ atual: 'a1b2c3d4e5f6' }, 'a1b2c3d4e5f6', 'x'))
  assert.throws(() => conferirNoAr({ atual: 'a1b2c3d4e5f6' }, '0f9e8d7c6b5a', 'promover'), /No ar está o build a1b2c3d4e5f6.*promover/)
  const buscar = async (u: string) => ({ ok: u === `${SITE}estado.json`, status: 200, json: async () => e })
  assert.equal((await lerEstado('https://imoveis.example', UNID, buscar)).atual, 'a1b2c3d4e5f6')
  assert.deepEqual(linksPublicos('https://imoveis.example', UNID),
    { tourUrl: `${SITE}imovel/${UNID}`, maqueteUrl: `${SITE}maquete/${UNID}` })
  // o comando de promoção já leva o artefato aprovado: build + manifest exato
  const m = manifestDe('a1b2c3d4e5f6')
  assert.equal(comandoPromover(UNID, 'a1b2c3d4e5f6', m),
    `python pipeline/publicar_imovel.py montar-live promover ${UNID} a1b2c3d4e5f6 --estado <estado-live.json> --manifest-aprovado ${m}`)
  // as outras dicas mostradas ao operador são o fluxo de hoje, não os comandos antigos
  assert.deepEqual(comandosPreview(UNID), [
    `python pipeline/publicar_imovel.py montar-preview ${UNID} <build>`,
    `firebase hosting:channel:deploy imovel-${UNID} --only imoveis --config firebase.imoveis.json --project imobilaria-deccb --expires 30d`])
  assert.equal(comandoReverter(UNID),
    `python pipeline/publicar_imovel.py montar-live reverter ${UNID} --estado <estado-live.json>`)
})

test('publicação: só o admin, só o aprovado; histórico visível só para a própria imobiliária', async () => {
  const admin = await entrar('admin'), op = await entrar('op'), corA = await entrar('corA'), gerB = await entrar('gerB')
  const links = linksPublicos(SITE, UNID)
  const naoAprovado = await pedido(admin.db, 'pedCedros'), cedros = await imovel(admin.db, 'cedros')
  await assert.rejects(registrarPublicacao(admin.db, 'admin', naoAprovado, cedros, SITE, siteRemoto), /aprovado/)
  await aprovado('pedCedros', 'a1b2c3d4e5f6')
  const aprovadoAgora = await pedido(admin.db, 'pedCedros')
  assert.equal(aprovadoAgora.approvedManifestSha256, manifestDe('a1b2c3d4e5f6'))
  // uma aprovação de antes da identidade do manifest não publica: sem hash inventado, sem fallback
  await assert.rejects(registrarPublicacao(admin.db, 'admin', { ...aprovadoAgora, approvedManifestSha256: undefined },
    cedros, SITE, siteRemoto), /manifest/)
  // a conferência visual passa, outra operação troca o live, e o clique que grava relê e recusa
  noArAgora = 'a1b2c3d4e5f6'
  conferirNoAr(await lerEstado(SITE, UNID, siteRemoto), 'a1b2c3d4e5f6', 'promover')
  noArAgora = '0f9e8d7c6b5a'
  await assert.rejects(registrarPublicacao(admin.db, 'admin', aprovadoAgora, cedros, SITE, siteRemoto),
    /No ar está o build 0f9e8d7c6b5a/)
  assert.equal((await pedido(admin.db, 'pedCedros')).status, 'approved')          // nada gravado
  noArAgora = 'a1b2c3d4e5f6'
  await assert.rejects(registrarPublicacao(op.db, 'op', await pedido(op.db, 'pedCedros'), await imovel(op.db, 'cedros'),
    SITE, siteRemoto), /permission/i)
  await registrarPublicacao(admin.db, 'admin', await pedido(admin.db, 'pedCedros'), await imovel(admin.db, 'cedros'),
    SITE, siteRemoto)

  const p = await imovel(admin.db, 'cedros')
  assert.deepEqual([p.publishedBuild, p.previousBuild, p.publishedRequestId, p.tourUrl, p.publicUrl],
    ['a1b2c3d4e5f6', undefined, 'pedCedros', links.tourUrl, links.tourUrl])
  assert.equal((await pedido(admin.db, 'pedCedros')).status, 'published')
  await assert.rejects(editarPedidoInterno(admin.db, 'pedCedros', { propertyId: 'colinas' }), /permission/i)  // publicado

  const historico = (db: Firestore, agencyId: string) => getDocs(query(collection(db, 'publications'),
    where('agencyId', '==', agencyId), where('propertyId', '==', 'cedros'), orderBy('publishedAt', 'desc')))
  assert.deepEqual((await historico(corA.db, 'agA')).docs.map((d) => [d.data().action, d.data().build]),
    [['publish', 'a1b2c3d4e5f6']])
  await assert.rejects(historico(gerB.db, 'agA'), /permission/i)
})

test('republicar guarda o anterior; reverter volta a ele e fica no histórico', async () => {
  const admin = await entrar('admin'), corA = await entrar('corA'), op = await entrar('op')
  const novo = await criarPedido(corA.db, 'corA', { agencyId: 'agA', title: 'Nova versão do Cedros', propertyId: 'cedros' })
  await aprovado(novo.id, '0f9e8d7c6b5a')
  noArAgora = '0f9e8d7c6b5a'
  await registrarPublicacao(admin.db, 'admin', await pedido(admin.db, novo.id), await imovel(admin.db, 'cedros'),
    SITE, siteRemoto)
  let p = await imovel(admin.db, 'cedros')
  const par = (x: Property) => [x.publishedBuild, x.publishedRequestId, x.previousBuild, x.previousRequestId]
  assert.deepEqual(par(p), ['0f9e8d7c6b5a', novo.id, 'a1b2c3d4e5f6', 'pedCedros'])
  const links = [p.tourUrl, p.maqueteUrl, p.publicUrl]

  // o pipeline reverteu e a conferência passa; outra promoção muda o live antes do clique que grava
  noArAgora = 'a1b2c3d4e5f6'
  conferirNoAr(await lerEstado(SITE, UNID, siteRemoto), p.previousBuild!, 'reverter')
  noArAgora = '0f9e8d7c6b5a'
  await assert.rejects(registrarReversao(admin.db, 'admin', p, SITE, siteRemoto), /No ar está o build 0f9e8d7c6b5a/)
  assert.deepEqual(par(await imovel(admin.db, 'cedros')), par(p))                  // nada gravado
  noArAgora = 'a1b2c3d4e5f6'
  await assert.rejects(registrarReversao(op.db, 'op', p, SITE, siteRemoto), /permission/i)
  await registrarReversao(admin.db, 'admin', p, SITE, siteRemoto)
  p = await imovel(admin.db, 'cedros')
  // o pedido registrado volta junto com o build: o que está no ar foi aprovado por pedCedros
  assert.deepEqual(par(p), ['a1b2c3d4e5f6', 'pedCedros', '0f9e8d7c6b5a', novo.id])
  assert.deepEqual([p.tourUrl, p.maqueteUrl, p.publicUrl], links)   // reverter não mexe nos ponteiros

  const todos = await getDocs(query(collection(admin.db, 'publications'), where('propertyId', '==', 'cedros'),
    orderBy('publishedAt', 'desc')))
  assert.deepEqual(todos.docs.map((d) => `${d.data().action}:${d.data().build}:${d.data().requestId}`),
    ['rollback:a1b2c3d4e5f6:pedCedros', `publish:0f9e8d7c6b5a:${novo.id}`, 'publish:a1b2c3d4e5f6:pedCedros'])
})
