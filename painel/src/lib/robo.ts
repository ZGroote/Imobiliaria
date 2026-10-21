import { collection, doc, query, serverTimestamp, setDoc, where, writeBatch, type Firestore } from 'firebase/firestore'
import { registrarPreview } from './aprovacao.ts'
import { lerPreview } from './publicacao.ts'
import { noBatch } from './status.ts'
import type { BuildJob, BuildJobStatus, Preview, Request } from './types.ts'

// O robô do M2 (tasks/painel/m2-worker.md): o que o painel pede a ele, o que mostra dele, e o que ele
// mesmo escreve no pedido. Ele entra como o usuário users/worker, então as escritas dele passam pelas
// mesmas regras de um clique, e pelas que o prendem à política (firestore.rules, workerRequestOk).
export const ROBO = 'worker'
type Pedido = Pick<Request, 'id' | 'agencyId' | 'status'>

// ── o que a equipe pede ao robô (§3) ──

// Pedido de trabalho: um AuditLog worker:* interno. O robô cria o job na próxima execução, com a
// identidade deste pedido; as regras só deixam a equipe pedir.
function pedirAoRobo(db: Firestore, uid: string, agencyId: string, entityType: 'request' | 'buildJob', entityId: string,
  action: 'worker:previa' | 'worker:cancelar') {
  return setDoc(doc(collection(db, 'auditLogs')), {
    agencyId, userId: uid, entityType, entityId, action, visibility: 'internal', timestamp: serverTimestamp(),
  })
}

export function pedirPreviaAoRobo(db: Firestore, uid: string, r: Pedido) {
  if (r.status !== 'production') throw new Error('Só se gera a prévia com o pedido em produção.')
  return pedirAoRobo(db, uid, r.agencyId, 'request', r.id, 'worker:previa')
}

export const cancelarJob = (db: Firestore, uid: string, job: Pick<BuildJob, 'id' | 'agencyId'>) =>
  pedirAoRobo(db, uid, job.agencyId, 'buildJob', job.id, 'worker:cancelar')

// ── o que o painel mostra dele (§7) ──

export const jobsDoPedido = (db: Firestore, requestId: string) =>
  query(collection(db, 'buildJobs'), where('requestId', '==', requestId))

export const jobAtivo = (j: Pick<BuildJob, 'status'>) => j.status === 'pending' || j.status === 'running'

export const ROTULO_JOB: Record<BuildJobStatus, string> = {
  pending: 'Na fila', running: 'Rodando', succeeded: 'Pronto', blocked: 'Parou num portão', failed: 'Falhou', cancelled: 'Cancelado',
}
export const TOM_JOB: Record<BuildJobStatus, 'cinza' | 'verde' | 'ambar' | 'azul' | 'vermelho'> = {
  pending: 'azul', running: 'azul', succeeded: 'verde', blocked: 'ambar', failed: 'vermelho', cancelled: 'cinza',
}
export const ROTULO_ETAPA: Record<string, string> = {
  extract: 'Ler materiais', preview: 'Prévia', publish: 'Publicar', rollback: 'Voltar ao anterior', retire: 'Retirar do site',
}

// O motivo de um job que parou, em português, para a equipe (m2-worker.md §4). Código sem texto
// aqui: vale a mensagem do próprio robô.
const MOTIVOS: Record<string, string> = {
  NOT_STAFF: 'Quem pediu não é da equipe.',
  NOT_ADMIN: 'Só o admin pode pedir isto.',
  WORKER_INACTIVE: 'O robô está desligado no painel (users/worker inativo).',
  REQUEST_CHANGED: 'O pedido mudou enquanto o robô trabalhava (saiu de produção ou trocou de imóvel).',
  REQUEST_NOT_IN_PRODUCTION: 'O pedido não estava em produção.',
  PIPELINE_UNIT_REQUIRED: 'O imóvel não tem o id do pipeline nem uma planta fixada.',
  PRODUCTION_MODE_MISSING: 'O pedido não diz se é LEVE ou PREMIUM.',
  AGENCY_MISMATCH: 'O imóvel não é da imobiliária do pedido.',
  PRODUCTION_INPUT_UNSUPPORTED: 'Este imóvel só tem a planta fixada; o 3D pela planta ainda não existe (M2-R).',
  NAO_PUBLICAR: 'Esta unidade não se publica até a origem dos dados ser confirmada.',
  BUILD_REFUSED: 'O build recusou os dados do imóvel.',
  BUILD_NOT_REPRODUCIBLE: 'Duas montagens do mesmo imóvel deram resultados diferentes.',
  CHANNEL_MISMATCH: 'O canal de prévia servia arquivos diferentes dos que o robô montou.',
  PREVIEW_GONE: 'A prévia aprovada não está mais no canal (venceu ou foi trocada).',
  APPROVAL_MISMATCH: 'A aprovação não traz o build e o manifest certos.',
  STATE_UNREADABLE: 'Não deu para ler o estado do site no ar.',
  STATE_CHANGED: 'O site no ar mudou enquanto o robô trabalhava.',
  OUT_OF_SCOPE: 'A publicação mexeria em outro imóvel do site.',
  LIVE_DIFFERENT: 'Depois do deploy, o site não mostrava o que foi publicado.',
  DUPLICATE: 'Já havia outro trabalho em andamento para este pedido.',
  CANCELLED: 'Cancelado pela equipe.',
  LEASE_LOST: 'O robô parou sem sinal de vida.',
  NETWORK: 'Falha de rede ou de um script, três vezes seguidas.',
  DEPLOY_ERROR: 'O deploy do Firebase falhou.',
}
export function motivoDoJob(j: Pick<BuildJob, 'error'>) {
  if (!j.error) return null
  return (j.error.code && MOTIVOS[j.error.code]) || j.error.message
}

// ── a equipe libera a prévia que parou na revisão interna ──

// Relê a prévia no canal, como no registro à mão: se o canal mudou desde que o robô registrou, a
// prévia não é mais a mesma, e o certo é gerar de novo.
export async function enviarParaRevisaoDoCliente(db: Firestore, uid: string, r: Request, pipelineUnitId: string,
  buscar?: Parameters<typeof lerPreview>[2]) {
  if (r.status !== 'internal_review' || !r.preview) throw new Error('Só se envia uma prévia que está na revisão interna.')
  const lida = await lerPreview(r.preview.tourUrl, pipelineUnitId, buscar)
  if (lida.build !== r.preview.build || lida.manifestSha256 !== r.preview.manifestSha256) {
    throw new Error('A prévia no canal não é mais a registrada: gere de novo.')
  }
  return registrarPreview(db, uid, r, lida)
}

// ── o que o robô escreve no pedido (§1.2 e §1.3) ──

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
