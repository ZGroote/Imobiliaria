'use client'
import { useSyncExternalStore } from 'react'
import { collection, query, where } from 'firebase/firestore'
import { db } from './firebase.ts'
import { assinarNomes, nomeEmCache, pedirNome, versaoDosNomes, type ColecaoDeNome } from './nomes.ts'
import { usePerfil } from './session.tsx'
import type { Agency, User } from './types.ts'
import { useColecao } from './useFirestore.ts'

// Nome de imóvel e de pessoa por id, só dos que a tela mostra (lib/nomes.ts): "…" enquanto busca,
// "—" sem id, "?" quando não existe ou a regra nega. Pedir no render é idempotente (uma busca por
// usuário e id) e a resposta chega pela assinatura.
export function useNomes() {
  useSyncExternalStore(assinarNomes, versaoDosNomes, versaoDosNomes)
  const uid = usePerfil().id
  const nome = (colecao: ColecaoDeNome, campo: string) => (id?: string) => {
    if (!id) return '—'
    const n = nomeEmCache(uid, colecao, id, campo)
    if (n === undefined) { void pedirNome(db, uid, colecao, id); return '…' }
    return n ?? '?'
  }
  return { imovel: nome('properties', 'title'), pessoa: nome('users', 'name') }
}

// Catálogos da equipe interna. Imobiliárias e equipe interna vêm inteiras: são poucas e alimentam
// filtros e seletores. Imóveis e pessoas vêm por id (useNomes), só os que aparecem na tela.
export function useCatalogoInterno() {
  const agencias = useColecao<Agency>('cat:agencias', () => collection(db, 'agencies'))
  const internos = useColecao<User>('cat:internos',
    () => query(collection(db, 'users'), where('role', 'in', ['platform_admin', 'operator'])))
  const { imovel, pessoa } = useNomes()
  return {
    agencias: agencias.dados ?? [], internos: internos.dados ?? [],
    agencia: (id: string) => agencias.dados?.find((x) => x.id === id)?.name ?? '…',
    imovel, pessoa,
  }
}
