'use client'
import { collection, query, where } from 'firebase/firestore'
import { db } from './firebase.ts'
import type { Agency, Property, User } from './types.ts'
import { useColecao } from './useFirestore.ts'

// Catálogos que a equipe interna usa para dar nome às coisas (ela lê tudo, pelas regras).
export function useCatalogoInterno() {
  const agencias = useColecao<Agency>('cat:agencias', () => collection(db, 'agencies'))
  const imoveis = useColecao<Property>('cat:imoveis', () => collection(db, 'properties'))
  const pessoas = useColecao<User>('cat:pessoas', () => collection(db, 'users'))
  const internos = useColecao<User>('cat:internos',
    () => query(collection(db, 'users'), where('role', 'in', ['platform_admin', 'operator'])))
  const achar = <T extends { id: string }>(l: T[] | undefined, id?: string) => (id ? l?.find((x) => x.id === id) : undefined)
  return {
    agencias: agencias.dados ?? [], imoveis: imoveis.dados ?? [], internos: internos.dados ?? [],
    agencia: (id: string) => achar(agencias.dados, id)?.name ?? '…',
    imovel: (id?: string) => (id ? achar(imoveis.dados, id)?.title ?? '…' : '—'),
    pessoa: (uid?: string) => (uid ? achar(pessoas.dados, uid)?.name ?? '…' : '—'),
  }
}
