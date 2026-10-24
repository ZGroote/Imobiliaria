import { collection, doc, getDoc, runTransaction, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore'
import { temPublicacao } from './listas.ts'
import { comandoPromover, comandoReverter, conferirNoAr, lerEstado, linksPublicos, type Buscar } from './publicacao.ts'
import { noBatch } from './status.ts'
import type { Property, Request } from './types.ts'

export const APROVACAO_SEM_MANIFEST = 'Esta aprovação é de antes da identidade do manifest.json e não diz qual '
  + 'artefato foi aprovado. Registre o preview de novo e peça uma nova aprovação ao gerente.'

// O artefato aprovado está no ar? Lê o estado.json do site AGORA e exige o build E o manifest.json que
// o gerente aprovou. O botão "Conferir o site" usa isto para mostrar; registrarPublicacao usa de novo
// no clique que grava, e essa segunda leitura é a autoridade (o live pode ter mudado no meio-tempo).
// ponytail: sobra a janela entre esta leitura HTTP e o commit (Hosting + Firestore não são atômicos
// num cliente web); na Fase 2, um BuildJob no servidor coordena a promoção e o registro.
export async function conferirPublicacao(r: Request, p: Property, site: string, buscar?: Buscar) {
  if (r.status !== 'approved' || !r.approvedBuild) throw new Error('Só se publica um pedido aprovado.')
  // Sem hash inventado nem fallback: uma aprovação de antes da identidade do manifest não publica.
  if (!r.approvedManifestSha256) throw new Error(APROVACAO_SEM_MANIFEST)
  if (r.propertyId !== p.id) throw new Error('O pedido não é deste imóvel.')
  if (!p.pipelineUnitId) throw new Error('O imóvel não tem o id do pipeline.')
  const build = r.approvedBuild, unidade = p.pipelineUnitId
  conferirNoAr(await lerEstado(site, unidade, buscar), build,
    comandoPromover(unidade, build, r.approvedManifestSha256), r.approvedManifestSha256)
  return { build, unidade }
}

// Registro da publicação no Firestore (só platform_admin). Quem põe no ar é o pipeline
// (publicar_imovel.py montar-live promover); aqui se registra o que o estado.json do site mostra.
// Um batch: pedido -> published (+ AuditLog), imóvel aponta o build, e o registro em publications.
export async function registrarPublicacao(db: Firestore, uid: string, r: Request, p: Property, site: string,
  buscar?: Buscar) {
  const { build, unidade } = await conferirPublicacao(r, p, site, buscar)
  const links = linksPublicos(site, unidade)
  // O par que estava no ar (build, pedido) vira o anterior: é para ele que a reversão volta.
  const anterior = {
    ...(p.publishedBuild ? { previousBuild: p.publishedBuild } : {}),
    ...(p.publishedRequestId ? { previousRequestId: p.publishedRequestId } : {}),
  }
  const b = writeBatch(db)
  const pub = doc(collection(db, 'publications'))
  b.set(pub, {
    propertyId: p.id, agencyId: p.agencyId, requestId: r.id, action: 'publish', build,
    ...(p.publishedBuild ? { previousBuild: p.publishedBuild } : {}), ...links,
    publishedBy: uid, publishedAt: serverTimestamp(),
  })
  noBatch(b, db, uid, r, 'published', { publishedAt: serverTimestamp() }, { build })
  b.update(doc(db, 'properties', p.id), {
    publicationReady: true,
    publishedBuild: build, ...anterior, publishedRequestId: r.id, publishedAt: serverTimestamp(),
    ...links, publicUrl: links.tourUrl, lastPublicationId: pub.id, updatedAt: serverTimestamp(),
  })
  return b.commit()
}

// A API de acesso revalida properties.status em toda abertura, inclusive dos encaminhamentos.
// Pausar não revoga tokens nem altera o build: os mesmos links voltam quando o imóvel é reativado.
export function alterarDisponibilidadePublicacao(db: Firestore, uid: string, propertyId: string, publicar: boolean) {
  const ref = doc(db, 'properties', propertyId)
  return runTransaction(db, async (t) => {
    const s = await t.get(ref), p = s.data()
    if (!p) throw new Error('Imóvel não encontrado.')
    if (!temPublicacao(p)) throw new Error('Este imóvel ainda não tem conteúdo preparado para publicar.')
    if (p.status === 'archived') throw new Error('Desarquive o imóvel antes de alterar sua publicação.')
    const status = publicar ? 'active' : 'inactive'
    if (p.status === status) return
    const log = doc(collection(db, 'auditLogs'))
    t.set(log, {
      agencyId: p.agencyId, userId: uid, entityType: 'property', entityId: propertyId,
      action: publicar ? 'publication:resume' : 'publication:pause', visibility: 'agency',
      before: { status: p.status }, after: { status }, timestamp: serverTimestamp(),
    })
    t.update(ref, { status, lastAuditId: log.id, updatedAt: serverTimestamp() })
  })
}

// A volta confere o mesmo que a publicação: o artefato que volta é o que o pedido anterior aprovou,
// build E manifest.json, lido agora no estado.json (no botão e de novo no clique que grava).
export async function conferirReversao(db: Firestore, p: Property, site: string, buscar?: Buscar) {
  if (!p.publishedBuild || !p.previousBuild || !p.publishedRequestId || !p.previousRequestId) {
    throw new Error('Não há build anterior para voltar.')
  }
  if (!p.pipelineUnitId) throw new Error('O imóvel não tem o id do pipeline.')
  const volta = (await getDoc(doc(db, 'requests', p.previousRequestId))).data() as Request | undefined
  if (volta?.approvedBuild !== p.previousBuild || !volta.approvedManifestSha256) {
    throw new Error(`O pedido anterior não diz qual manifest.json aprovou para o build ${p.previousBuild}: `
      + 'não há como conferir a volta.')
  }
  conferirNoAr(await lerEstado(site, p.pipelineUnitId, buscar), p.previousBuild, comandoReverter(p.pipelineUnitId),
    volta.approvedManifestSha256)
}

// Reverter = o ponteiro volta ao build anterior, que continua no ar (§6). Registra depois de
// publicar_imovel.py montar-live reverter, conferido no estado.json. Troca SÓ os pares atual <-> anterior
// (build e pedido); URLs e ponteiros não mudam (regras: rollbackFields).
export async function registrarReversao(db: Firestore, uid: string, p: Property, site: string, buscar?: Buscar) {
  await conferirReversao(db, p, site, buscar)                   // garante os quatro campos do par
  const b = writeBatch(db)
  const pub = doc(collection(db, 'publications'))
  b.set(pub, {
    propertyId: p.id, agencyId: p.agencyId, requestId: p.previousRequestId, action: 'rollback',
    build: p.previousBuild, previousBuild: p.publishedBuild,
    ...(p.tourUrl ? { tourUrl: p.tourUrl } : {}), ...(p.maqueteUrl ? { maqueteUrl: p.maqueteUrl } : {}),
    publishedBy: uid, publishedAt: serverTimestamp(),
  })
  b.update(doc(db, 'properties', p.id), {
    publishedBuild: p.previousBuild, previousBuild: p.publishedBuild,
    publishedRequestId: p.previousRequestId, previousRequestId: p.publishedRequestId,
    publishedAt: serverTimestamp(), lastPublicationId: pub.id, updatedAt: serverTimestamp(),
  })
  return b.commit()
}
