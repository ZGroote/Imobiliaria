import { collection, doc, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore'
import { noBatch } from './status.ts'
import type { Preview, Request } from './types.ts'

// O que o robô do M2 escreve no pedido (tasks/painel/m2-worker.md §1.2 e §1.3). Ele entra como o
// usuário users/worker, então estas escritas passam pelas mesmas regras de um clique, e pelas que
// prendem o robô à política dele (firestore.rules, workerRequestOk).
export const ROBO = 'worker'
type Pedido = Pick<Request, 'id' | 'agencyId' | 'status'>

// Prévia pronta e conferida: grava a prévia e leva o pedido ao próximo status da política.
export function registrarPreviaDoRobo(db: Firestore, r: Pedido, para: 'agency_review' | 'internal_review',
  preview: Preview, jobId: string) {
  const b = writeBatch(db)
  noBatch(b, db, ROBO, r, para, { preview }, { build: preview.build, manifestSha256: preview.manifestSha256, jobId })
  return b.commit()
}

// Um portão falhou: o pedido vai para a revisão interna. O log do status, que a imobiliária vê, só
// diz o job; o motivo técnico vai num log interno, no mesmo batch.
export function reterNaRevisaoInterna(db: Firestore, r: Pedido,
  motivo: { jobId: string; stage: string; code: string; message: string }) {
  const b = writeBatch(db)
  noBatch(b, db, ROBO, r, 'internal_review', {}, { jobId: motivo.jobId })
  b.set(doc(collection(db, 'auditLogs')), {
    agencyId: r.agencyId, userId: ROBO, entityType: 'request', entityId: r.id,
    action: 'worker:retido', visibility: 'internal', after: motivo, timestamp: serverTimestamp(),
  })
  return b.commit()
}
