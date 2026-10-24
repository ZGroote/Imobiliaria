// As consultas das listas que crescem, paginadas por limite crescente (usePaginada). Tudo o que
// decide QUAIS documentos entram vai no Firestore: com limit(), filtrar no navegador mostraria só
// o que coube na página. Índices: firebase/firestore.indexes.json (a combinação status + "só as
// minhas" é servida pela fusão dos índices agencyId+status e agencyId+requestedBy).
import { collection, orderBy, query, Timestamp, where, type Firestore } from 'firebase/firestore'
import type { RequestStatus } from './types.ts'

export const PAGINA = 50
export const PUBLICADO_POR = 48 * 60 * 60 * 1000

// Veio exatamente o limite: pode haver mais. Veio menos: acabou.
export const temMais = (recebidos: number, limite: number) => recebidos >= limite

export const pedidosDaAgencia = (db: Firestore, agencyId: string, f: { status?: string; de?: string } = {}) =>
  query(collection(db, 'requests'), where('agencyId', '==', agencyId),
    ...(f.status ? [where('status', '==', f.status)] : []),
    ...(f.de ? [where('requestedBy', '==', f.de)] : []),
    orderBy('updatedAt', 'desc'))

export const pedidosInternos = (db: Firestore, f: { agencia?: string; status?: string } = {}) =>
  query(collection(db, 'requests'),
    ...(f.agencia ? [where('agencyId', '==', f.agencia)] : []),
    ...(f.status ? [where('status', '==', f.status)] : []),
    orderBy('updatedAt', 'desc'))

export const imoveisDa = (db: Firestore, agencyId?: string) =>
  query(collection(db, 'properties'), ...(agencyId ? [where('agencyId', '==', agencyId)] : []),
    orderBy('updatedAt', 'desc'))

export const temPublicacao = (p: { publicationReady?: unknown; publishedBuild?: unknown }) =>
  typeof p.publicationReady === 'boolean' ? p.publicationReady
    : typeof p.publishedBuild === 'string' && p.publishedBuild !== ''

// Inativar pausa os acessos; os metadados e tokens ficam prontos para a reativação.
export const estaPublicado = (p: { status?: unknown; publicationReady?: unknown; publishedBuild?: unknown }) =>
  p.status === 'active' && temPublicacao(p)

export const publicadosDa = (db: Firestore, agencyId: string) =>
  query(collection(db, 'properties'), where('agencyId', '==', agencyId),
    where('status', '==', 'active'), where('publicationReady', '==', true))

export const pedidosNaEtapa = (db: Firestore, agencyId: string, status: RequestStatus[]) =>
  query(collection(db, 'requests'), where('agencyId', '==', agencyId), where('status', 'in', status))

// Usuários (tela da equipe), por nome. Convites não paginam: invites/ só guarda os pendentes.
export const usuariosPorNome = (db: Firestore) => query(collection(db, 'users'), orderBy('name'))

// O corte vale antes do limit() e do count(). Pedidos antigos sem publishedAt ficam no histórico.
export const colunaDoKanban = (db: Firestore, status: RequestStatus[], agora = Date.now()) =>
  status.length === 1 && status[0] === 'published'
    ? query(collection(db, 'requests'), where('status', '==', 'published'),
      where('publishedAt', '>', Timestamp.fromMillis(agora - PUBLICADO_POR)), orderBy('publishedAt', 'desc'))
    : query(collection(db, 'requests'), where('status', 'in', status), orderBy('updatedAt', 'desc'))
