// As consultas das listas que crescem, paginadas por limite crescente (usePaginada). Tudo o que
// decide QUAIS documentos entram vai no Firestore: com limit(), filtrar no navegador mostraria só
// o que coube na página. Índices: firebase/firestore.indexes.json (a combinação status + "só as
// minhas" é servida pela fusão dos índices agencyId+status e agencyId+requestedBy).
import { collection, orderBy, query, where, type Firestore } from 'firebase/firestore'
import type { RequestStatus } from './types.ts'

export const PAGINA = 50

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

// "Publicado" = publishedBuild é texto não vazio. É o critério da etiqueta da lista e do contador
// do Início; no Firestore, `> ''` casa exatamente isso (campo ausente, null e '' ficam de fora).
export const estaPublicado = (p: { publishedBuild?: unknown }) =>
  typeof p.publishedBuild === 'string' && p.publishedBuild !== ''

export const publicadosDa = (db: Firestore, agencyId: string) =>
  query(collection(db, 'properties'), where('agencyId', '==', agencyId), where('publishedBuild', '>', ''))

export const pedidosNaEtapa = (db: Firestore, agencyId: string, status: RequestStatus[]) =>
  query(collection(db, 'requests'), where('agencyId', '==', agencyId), where('status', 'in', status))

// Usuários (tela da equipe), por nome. Convites não paginam: invites/ só guarda os pendentes.
export const usuariosPorNome = (db: Firestore) => query(collection(db, 'users'), orderBy('name'))

export const colunaDoKanban = (db: Firestore, status: RequestStatus[]) =>
  query(collection(db, 'requests'), where('status', 'in', status), orderBy('updatedAt', 'desc'))
