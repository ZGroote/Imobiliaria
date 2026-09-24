import { serverTimestamp, type Firestore } from 'firebase/firestore'
import { mudarStatus } from './status.ts'
import type { Preview, Request } from './types.ts'

type Pedido = Pick<Request, 'id' | 'agencyId' | 'status' | 'preview'>

// Equipe: o build em preview vai para a imobiliária revisar. Trocar o preview de um pedido
// aprovado o tira de "approved": a aprovação é de um build, não do pedido (regras).
export function registrarPreview(db: Firestore, uid: string, r: Pedido, preview: Preview) {
  return mudarStatus(db, uid, r, 'agency_review', { preview }, { build: preview.build })
}

// Gerente da imobiliária: aprova exatamente o build em revisão.
export function aprovar(db: Firestore, uid: string, r: Pedido) {
  if (r.status !== 'agency_review' || !r.preview?.build) throw new Error('Não há build em revisão para aprovar.')
  return mudarStatus(db, uid, r, 'approved',
    { approvedBuild: r.preview.build, approvedBy: uid, approvedAt: serverTimestamp() }, { build: r.preview.build })
}

// Gerente: devolve para a produção. O motivo fica no histórico (o pedido em si não guarda).
export function pedirAjuste(db: Firestore, uid: string, r: Pedido, motivo: string) {
  if (!motivo.trim()) throw new Error('Diga o que precisa mudar.')
  return mudarStatus(db, uid, r, 'production', {}, { nota: motivo.trim(), ...(r.preview ? { build: r.preview.build } : {}) })
}
