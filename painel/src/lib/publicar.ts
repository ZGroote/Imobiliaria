import { collection, doc, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore'
import { comandoPromover, comandoReverter, conferirNoAr, lerEstado, linksPublicos, type Buscar } from './publicacao.ts'
import { noBatch } from './status.ts'
import type { Property, Request } from './types.ts'

export const APROVACAO_SEM_MANIFEST = 'Esta aprovação é de antes da identidade do manifest.json e não diz qual '
  + 'artefato foi aprovado. Registre o preview de novo e peça uma nova aprovação ao gerente.'

// Registro da publicação no Firestore (só platform_admin). Quem põe no ar é o pipeline
// (publicar_imovel.py montar-live promover); aqui se registra o que o estado.json do site mostra.
// Um batch: pedido -> published (+ AuditLog), imóvel aponta o build, e o registro em publications.
export async function registrarPublicacao(db: Firestore, uid: string, r: Request, p: Property, site: string,
  buscar?: Buscar) {
  if (r.status !== 'approved' || !r.approvedBuild) throw new Error('Só se publica um pedido aprovado.')
  // Sem hash inventado nem fallback: uma aprovação de antes da identidade do manifest não publica.
  if (!r.approvedManifestSha256) throw new Error(APROVACAO_SEM_MANIFEST)
  if (r.propertyId !== p.id) throw new Error('O pedido não é deste imóvel.')
  if (!p.pipelineUnitId) throw new Error('O imóvel não tem o id do pipeline.')
  const build = r.approvedBuild, unidade = p.pipelineUnitId
  // O que está no ar, lido AGORA no site: a conferência de antes é só visual, e outra operação pode
  // ter promovido ou revertido o live desde então. A autoridade é esta leitura, no clique que grava.
  // ponytail: sobra a janela entre esta leitura HTTP e o commit (Hosting + Firestore não são atômicos
  // num cliente web); na Fase 2, um BuildJob no servidor coordena a promoção e o registro.
  conferirNoAr(await lerEstado(site, unidade, buscar), build, comandoPromover(unidade, build, r.approvedManifestSha256))
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
  noBatch(b, db, uid, r, 'published', {}, { build })
  b.update(doc(db, 'properties', p.id), {
    publishedBuild: build, ...anterior, publishedRequestId: r.id, publishedAt: serverTimestamp(),
    ...links, publicUrl: links.tourUrl, lastPublicationId: pub.id, updatedAt: serverTimestamp(),
  })
  return b.commit()
}

// Reverter = o ponteiro volta ao build anterior, que continua no ar (§6). Registra depois de
// publicar_imovel.py montar-live reverter, conferido no estado.json. Troca SÓ os pares atual <-> anterior
// (build e pedido); URLs e ponteiros não mudam (regras: rollbackFields).
export async function registrarReversao(db: Firestore, uid: string, p: Property, site: string, buscar?: Buscar) {
  if (!p.publishedBuild || !p.previousBuild || !p.publishedRequestId || !p.previousRequestId) {
    throw new Error('Não há build anterior para voltar.')
  }
  if (!p.pipelineUnitId) throw new Error('O imóvel não tem o id do pipeline.')
  // a mesma releitura da publicação: no ar tem de estar o anterior, lido agora
  conferirNoAr(await lerEstado(site, p.pipelineUnitId, buscar), p.previousBuild, comandoReverter(p.pipelineUnitId))
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
