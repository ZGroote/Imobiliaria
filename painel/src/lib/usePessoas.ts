'use client'
import { collection, query, where } from 'firebase/firestore'
import { db } from './firebase.ts'
import type { User } from './types.ts'
import { useColecao } from './useFirestore.ts'

// Nomes das pessoas de uma imobiliária. Só a equipe e o gerente leem users/ de outros; para o
// corretor a consulta é negada e os nomes ficam de fora (quem aparece é "você" ou "colega").
export function usePessoas(agencyId: string | undefined, podeLer: boolean) {
  const r = useColecao<User>(podeLer && agencyId ? `pessoas:${agencyId}` : null,
    () => query(collection(db, 'users'), where('agencyId', '==', agencyId)))
  const pessoas = r.dados ?? []
  return {
    pessoas,
    nome: (uid: string | undefined, eu?: string) =>
      !uid ? '—' : uid === eu ? 'Você' : pessoas.find((p) => p.id === uid)?.name ?? (podeLer ? '…' : 'Colega'),
  }
}
