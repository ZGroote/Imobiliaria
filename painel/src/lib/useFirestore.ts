'use client'
import { useEffect, useState } from 'react'
import { onSnapshot, type DocumentReference, type Query } from 'firebase/firestore'
import { comId } from './types.ts'

// Leitura ao vivo. `chave` identifica a consulta: mudou a chave, troca a assinatura.
// null = ainda não dá para consultar (ex.: falta o id).
export function useColecao<T>(chave: string | null, consulta: () => Query) {
  const [estado, setEstado] = useState<{ chave: string | null; dados?: T[]; erro?: string }>({ chave: null })
  useEffect(() => {
    if (!chave) return
    return onSnapshot(consulta(),
      (s) => setEstado({ chave, dados: s.docs.map((d) => comId<T>(d)) }),
      (e) => setEstado({ chave, erro: e.code === 'permission-denied' ? 'Sem permissão para ver estes dados.' : e.message }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])
  return estado.chave === chave ? estado : { chave }   // não mostra dados de outra consulta
}

export function useDoc<T>(chave: string | null, ref: () => DocumentReference) {
  const [estado, setEstado] = useState<{ chave: string | null; dado?: T | null; erro?: string }>({ chave: null })
  useEffect(() => {
    if (!chave) return
    return onSnapshot(ref(),
      (s) => setEstado({ chave, dado: s.exists() ? comId<T>(s) : null }),
      (e) => setEstado({ chave, erro: e.code === 'permission-denied' ? 'Sem permissão para ver este item.' : e.message }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])
  return estado.chave === chave ? estado : { chave }
}
