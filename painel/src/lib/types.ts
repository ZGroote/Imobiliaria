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

// Tipo da conta: decide os módulos. Conta sem `kind` (anterior ao campo) é imobiliária.
export type TipoDeConta = 'imobiliaria' | 'construtora'
export const TIPOS_DE_CONTA: TipoDeConta[] = ['imobiliaria', 'construtora']
export const ROTULO_TIPO_DE_CONTA: Record<TipoDeConta, string> = { imobiliaria: 'Imobiliária', construtora: 'Construtora' }
export const tipoDaConta = (a: Pick<Agency, 'kind'>): TipoDeConta => a.kind ?? 'imobiliaria'

export interface Agency {                 // agencies/{id}
  id: string; name: string; slug?: string; logoUrl?: string; active: boolean
  kind?: TipoDeConta
  createdAt: Timestamp; updatedAt: Timestamp
}

export interface User {                   // users/{uid}: FONTE DE AUTORIZAÇÃO
  id: string
  agencyId?: string                       // obrigatório para papel de imobiliária; proibido para interno
  name: string; email: string
  role: UserRole; active: boolean
  publicContact?: { whatsapp: string | null } // E.164 sem "+"; o link por corretor mostra "Falar com <nome>"
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

export type ProductionMode = 'leve' | 'premium'
export const MODOS_PRODUCAO: ProductionMode[] = ['leve', 'premium']
export const ROTULO_MODO_PRODUCAO: Record<ProductionMode, string> = {
  leve: 'LEVE',
  premium: 'PREMIUM',
}

export interface Preview {
  build: string                           // identidade funcional: tour + maquete
  tourUrl: string
  maqueteUrl: string
  manifestSha256: string                  // identidade exata do artefato: os bytes do manifest.json servido
}

// M1-E: a leitura (propertyReadings) fixada como entrada da produção. Repete os números do snapshot
// imutável; as regras recusam qualquer divergência. NÃO é aprovação: aprovar é do build (approvedBuild).
export interface ProductionInput {
  readingId: string; readingVersion: number; readingRevision: number
  schemaVersion: string; contentSha256: string
  fixedBy: string; fixedAt: Timestamp
}

export interface Request {                // requests/{id}
  id: string; agencyId: string; requestedBy: string
  propertyId?: string; listingUrl?: string; title: string
  productionMode?: ProductionMode              // ausente só em pedidos anteriores ao produto LEVE/PREMIUM
  status: RequestStatus; priority?: 'low' | 'normal' | 'high'
  notes?: string
  assignedTo?: string
  preview?: Preview
  productionInput?: ProductionInput       // só a equipe, só em accepted/production, sempre com AuditLog
  approvedBuild?: string; approvedBy?: string; approvedAt?: Timestamp
  approvedManifestSha256?: string         // o artefato congelado pela aprovação; a promoção parte dele
  lastAuditId?: string
  createdAt: Timestamp; updatedAt: Timestamp
}

export type BuildJobStatus = 'pending' | 'running' | 'succeeded' | 'blocked' | 'failed' | 'cancelled'

// M2 (tasks/painel/m2-worker.md §3 e §4): a etapa do robô e o que disparou o job.
export type BuildJobStage = 'extract' | 'preview' | 'publish' | 'rollback' | 'retire'
export type BuildJobStep = 'build' | 'channel' | 'check_channel' | 'register' | 'state' | 'assemble'
  | 'deploy' | 'check_live'

export interface BuildJob {               // buildJobs/{id}; escrita só pelo robô (Admin SDK)
  id: string                              // M2: a identidade do fato que disparou (m2-worker.md §3)
  stage?: BuildJobStage                   // ausente = job manual de antes do M2 (tools/buildjob.mjs criar)
  trigger?: 'reading' | 'approval' | 'click'
  requestId?: string                      // rollback e retire não têm pedido
  propertyId: string; pipelineUnitId?: string; agencyId: string
  productionInput?: ProductionInput       // a entrada fixada que o job copiou do pedido
  productionMode?: ProductionMode
  requestedBy?: string; createdBy: string // createdBy = quem clicou, ou 'worker' no gatilho automático
  policy?: { kind: TipoDeConta }          // o tipo da conta, lido na hora da decisão
  status: BuildJobStatus
  attempt?: number                        // 1 a 3
  step?: BuildJobStep                     // onde está ou onde parou
  lease?: { owner: string; expiresAt: Timestamp }
  heartbeatAt?: Timestamp
  cancelRequested?: boolean
  commit?: string                         // a main que o robô usou
  inputSha256?: string
  build?: string; manifestSha256?: string; reportPath?: string
  tourUrl?: string; maqueteUrl?: string; previewExpiresAt?: Timestamp
  stateBeforeSha256?: string; stateAfterSha256?: string
  nextStatus?: RequestStatus              // para onde o robô levou o pedido
  error?: { code?: string; type?: string; message: string }
  startedAt?: Timestamp; finishedAt?: Timestamp
  lastAuditId?: string
  createdAt: Timestamp; updatedAt: Timestamp
}

export interface WorkerLease {            // workerLeases/{id}; a trava do robô (m2-worker.md §5)
  owner: string; jobId?: string; expiresAt: Timestamp
}

export interface AuditLog {               // auditLogs/{id}; só cresce
  id: string; agencyId?: string; userId: string
  entityType: 'request' | 'property' | 'agency' | 'user' | 'buildJob'
  entityId: string
  action: string                          // 'status:<novo>' | 'urls' | 'build_failed' | 'bootstrap' | 'production_input:set'
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
