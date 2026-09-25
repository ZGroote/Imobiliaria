// Modelo canônico (tasks/painel/proposta.md, §3). As regras em firebase/firestore.rules são a
// autoridade: estes tipos só descrevem o que elas aceitam.
import type { Timestamp } from 'firebase/firestore'

export type UserRole = 'platform_admin' | 'operator' | 'agency_manager' | 'agent'
export const PAPEIS_INTERNOS: UserRole[] = ['platform_admin', 'operator']
export const ROTULO_PAPEL: Record<UserRole, string> = {
  platform_admin: 'Administrador',
  operator: 'Operador',
  agency_manager: 'Gerente',
  agent: 'Corretor',
}
export const interno = (r: UserRole) => PAPEIS_INTERNOS.includes(r)

export interface Agency {                 // agencies/{id}
  id: string; name: string; slug?: string; logoUrl?: string; active: boolean
  createdAt: Timestamp; updatedAt: Timestamp
}

export interface User {                   // users/{uid}: FONTE DE AUTORIZAÇÃO
  id: string
  agencyId?: string                       // obrigatório para papel de imobiliária; proibido para interno
  name: string; email: string
  role: UserRole; active: boolean
  createdAt: Timestamp; updatedAt: Timestamp
}

export interface Invite {                 // invites/{email}; só platform_admin escreve
  email: string; name: string; role: UserRole; agencyId?: string
  agencyName?: string                     // só para exibir: o convidado ainda não lê agencies/
  createdBy: string; createdAt: Timestamp
}

export interface Property {               // properties/{id}
  id: string; agencyId: string
  title: string; developmentName?: string; address?: string; externalListingUrl?: string
  assignedAgentId?: string
  pipelineUnitId?: string                 // plantas_fornecidas/<id>/; também é o slug público
  status: 'active' | 'inactive' | 'archived'
  tourUrl?: string; maqueteUrl?: string; publicUrl?: string
  publishedBuild?: string; previousBuild?: string
  publishedRequestId?: string             // o pedido que aprovou o publishedBuild
  previousRequestId?: string              // o que aprovou o previousBuild; a reversão troca os pares
  publishedAt?: Timestamp
  lastPublicationId?: string; lastAuditId?: string
  createdAt: Timestamp; updatedAt: Timestamp
}

export type RequestStatus =
  | 'submitted' | 'waiting_materials' | 'accepted' | 'production'
  | 'internal_review' | 'agency_review' | 'approved' | 'published' | 'cancelled'

export interface Preview {
  build: string                           // identidade funcional: tour + maquete
  tourUrl: string
  maqueteUrl: string
  manifestSha256: string                  // identidade exata do artefato: os bytes do manifest.json servido
}

export interface Request {                // requests/{id}
  id: string; agencyId: string; requestedBy: string
  propertyId?: string; listingUrl?: string; title: string
  status: RequestStatus; priority?: 'low' | 'normal' | 'high'
  notes?: string
  assignedTo?: string
  preview?: Preview
  approvedBuild?: string; approvedBy?: string; approvedAt?: Timestamp
  approvedManifestSha256?: string         // o artefato congelado pela aprovação; a promoção parte dele
  lastAuditId?: string
  createdAt: Timestamp; updatedAt: Timestamp
}

export interface AuditLog {               // auditLogs/{id}; só cresce
  id: string; agencyId?: string; userId: string
  entityType: 'request' | 'property' | 'agency' | 'user' | 'buildJob'
  entityId: string
  action: string                          // 'status:<novo>' | 'urls' | 'build_failed' | 'bootstrap'
  visibility: 'internal' | 'agency'
  before?: Record<string, unknown>; after?: Record<string, unknown>
  timestamp: Timestamp
}

export interface Publication {            // publications/{id}; só cresce; só platform_admin
  id: string; propertyId: string; agencyId: string
  action: 'publish' | 'rollback'
  build: string; previousBuild?: string
  requestId?: string
  tourUrl?: string; maqueteUrl?: string
  publishedBy: string; publishedAt: Timestamp
}

// Converte um snapshot em objeto com id.
export const comId = <T,>(s: { id: string; data: () => unknown }) => ({ id: s.id, ...(s.data() as object) }) as T
