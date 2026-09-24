import { collection, doc, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore'
import type { Request, RequestStatus, UserRole } from './types.ts'

export const ROTULO_STATUS: Record<RequestStatus, string> = {
  submitted: 'Recebida',
  waiting_materials: 'Aguardando materiais',
  accepted: 'Aceita',
  production: 'Em produção',
  internal_review: 'Revisão interna',
  agency_review: 'Revisão da imobiliária',
  approved: 'Aprovada',
  published: 'Publicada',
  cancelled: 'Cancelada',
}

export const TOM_STATUS: Record<RequestStatus, 'cinza' | 'verde' | 'ambar' | 'azul' | 'vermelho'> = {
  submitted: 'azul', waiting_materials: 'ambar', accepted: 'azul', production: 'azul',
  internal_review: 'azul', agency_review: 'ambar', approved: 'verde', published: 'verde', cancelled: 'cinza',
}

export const TODOS_STATUS = Object.keys(ROTULO_STATUS) as RequestStatus[]

// A imobiliária só edita o pedido antes de a produção começar (regras: requesterEdit).
export const editavelPelaImobiliaria = (s: RequestStatus) => s === 'submitted' || s === 'waiting_materials'

// Kanban (proposta §12). Cancelada fica fora: aparece na lista.
export const COLUNAS: { titulo: string; status: RequestStatus[] }[] = [
  { titulo: 'Recebidas', status: ['submitted', 'waiting_materials'] },
  { titulo: 'Produção', status: ['accepted', 'production'] },
  { titulo: 'Revisão', status: ['internal_review'] },
  { titulo: 'Aprovação', status: ['agency_review', 'approved'] },
  { titulo: 'Publicado', status: ['published'] },
]

// Botões de status que cada lado vê. Ficam de fora os que têm fluxo próprio:
// agency_review (registrar preview), approved/ajuste (aprovação) e published (publicação).
// As regras são a autoridade; isto só evita oferecer o que seria negado.
const DA_EQUIPE: Partial<Record<RequestStatus, RequestStatus[]>> = {
  submitted: ['waiting_materials', 'accepted', 'cancelled'],
  waiting_materials: ['accepted', 'cancelled'],
  accepted: ['production', 'cancelled'],
  production: ['internal_review', 'cancelled'],
  internal_review: ['production'],
  agency_review: ['production'],
  approved: ['production'],
  cancelled: ['submitted'],
}
const DA_IMOBILIARIA: Partial<Record<RequestStatus, RequestStatus[]>> = {
  submitted: ['cancelled'],
  waiting_materials: ['submitted', 'cancelled'],   // "materiais enviados" volta para Recebida
}

export function proximos(r: Pick<Request, 'status' | 'requestedBy'>, papel: UserRole, uid: string): RequestStatus[] {
  if (papel === 'platform_admin' || papel === 'operator') return DA_EQUIPE[r.status] ?? []
  if (papel === 'agency_manager' || r.requestedBy === uid) return DA_IMOBILIARIA[r.status] ?? []
  return []
}

// O nome do botão depende de onde o pedido está: produção a partir de Aceita é começo, não volta.
export function rotuloDaAcao(de: RequestStatus, para: RequestStatus) {
  if (para === 'production') return de === 'accepted' ? 'Iniciar produção' : 'Voltar para produção'
  if (para === 'submitted') return de === 'waiting_materials' ? 'Materiais enviados' : 'Reabrir'
  return ({ waiting_materials: 'Pedir materiais', accepted: 'Aceitar', internal_review: 'Enviar para revisão interna',
    cancelled: 'Cancelar' } as Partial<Record<RequestStatus, string>>)[para] ?? ROTULO_STATUS[para]
}

// A ÚNICA escrita de status: pedido + AuditLog no mesmo batch, do mesmo autor, na mesma hora
// (regras: auditedAs). `nota` vai para o log (ex.: o motivo de um ajuste).
export function mudarStatus(db: Firestore, uid: string, r: Pick<Request, 'id' | 'agencyId' | 'status'>,
  para: RequestStatus, extra: Record<string, unknown> = {}, nota?: string) {
  const b = writeBatch(db)
  const log = doc(collection(db, 'auditLogs'))
  b.set(log, {
    agencyId: r.agencyId, userId: uid, entityType: 'request', entityId: r.id,
    action: `status:${para}`, visibility: 'agency',
    before: { status: r.status }, after: { status: para, ...(nota ? { nota } : {}) },
    timestamp: serverTimestamp(),
  })
  b.update(doc(db, 'requests', r.id), { status: para, lastAuditId: log.id, updatedAt: serverTimestamp(), ...extra })
  return b.commit()
}
