import { serverTimestamp, type Firestore } from 'firebase/firestore'
import { mudarStatus } from './status.ts'
import type { Preview, Request } from './types.ts'

type Pedido = Pick<Request, 'id' | 'agencyId' | 'status' | 'preview'>

// Equipe: o build em preview vai para a imobiliária revisar. Trocar o preview de um pedido
// aprovado o tira de "approved": a aprovação é de um build, não do pedido (regras).
export function registrarPreview(db: Firestore, uid: string, r: Pedido, preview: Preview) {
  return mudarStatus(db, uid, r, 'agency_review', { preview }, { build: preview.build })
}

// Gerente da imobiliária: aprova exatamente o artefato em revisão -- o build E o manifest.json
// servido no preview. A promoção depois exige esse mesmo par.
export function aprovar(db: Firestore, uid: string, r: Pedido) {
  if (r.status !== 'agency_review' || !r.preview?.build) throw new Error('Não há build em revisão para aprovar.')
  if (!r.preview.manifestSha256) {
    throw new Error('Este preview não traz a identidade do manifest.json. Registre o preview de novo antes de aprovar.')
  }
  const { build, manifestSha256 } = r.preview
  return mudarStatus(db, uid, r, 'approved',
    { approvedBuild: build, approvedManifestSha256: manifestSha256, approvedBy: uid, approvedAt: serverTimestamp() },
    { build, manifestSha256 })
}

// Gerente: devolve para a produção. O motivo fica no histórico (o pedido em si não guarda).
export function pedirAjuste(db: Firestore, uid: string, r: Pedido, motivo: string) {
  if (!motivo.trim()) throw new Error('Diga o que precisa mudar.')
  return mudarStatus(db, uid, r, 'production', {}, { nota: motivo.trim(), ...(r.preview ? { build: r.preview.build } : {}) })
}
