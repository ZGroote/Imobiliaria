import { collection, doc, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore'
import { noBatch } from './status.ts'
import type { Property, Request } from './types.ts'

// Registro da publicação no Firestore (só platform_admin). Quem põe no ar é o pipeline
// (publicar_imovel.py promover); aqui se registra o que o estado.json do site já mostra.
// Um batch: pedido -> published (+ AuditLog), imóvel aponta o build, e o registro em publications.
export function registrarPublicacao(db: Firestore, uid: string, r: Request, p: Property,
  links: { tourUrl: string; maqueteUrl: string }) {
  if (r.status !== 'approved' || !r.approvedBuild) throw new Error('Só se publica um pedido aprovado.')
  if (r.propertyId !== p.id) throw new Error('O pedido não é deste imóvel.')
  const build = r.approvedBuild
  const anterior = p.publishedBuild ? { previousBuild: p.publishedBuild } : {}
  const b = writeBatch(db)
  const pub = doc(collection(db, 'publications'))
  b.set(pub, {
    propertyId: p.id, agencyId: p.agencyId, requestId: r.id, action: 'publish', build, ...anterior, ...links,
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
// publicar_imovel.py reverter, conferido no estado.json.
export function registrarReversao(db: Firestore, uid: string, p: Property) {
  if (!p.publishedBuild || !p.previousBuild) throw new Error('Não há build anterior para voltar.')
  const b = writeBatch(db)
  const pub = doc(collection(db, 'publications'))
  b.set(pub, {
    propertyId: p.id, agencyId: p.agencyId, action: 'rollback', build: p.previousBuild, previousBuild: p.publishedBuild,
    ...(p.tourUrl ? { tourUrl: p.tourUrl } : {}), ...(p.maqueteUrl ? { maqueteUrl: p.maqueteUrl } : {}),
    publishedBy: uid, publishedAt: serverTimestamp(),
  })
  b.update(doc(db, 'properties', p.id), {
    publishedBuild: p.previousBuild, previousBuild: p.publishedBuild, publishedAt: serverTimestamp(),
    lastPublicationId: pub.id, updatedAt: serverTimestamp(),
  })
  return b.commit()
}
