import type { RequestStatus } from './types.ts'

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
