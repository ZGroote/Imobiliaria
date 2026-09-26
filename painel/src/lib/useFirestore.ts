'use client'
import { useEffect, useState } from 'react'
import { getCountFromServer, limit, onSnapshot, query, type DocumentReference, type Query } from 'firebase/firestore'
import { PAGINA, temMais } from './listas.ts'
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

// Lista ao vivo paginada por limite crescente: 50, 100, 150... sob um único onSnapshot. Mudou a
// chave (filtro, agência): volta à primeira página. Enquanto o limite maior não chega, a lista de
// antes continua na tela (carregando = true) em vez de piscar para "Carregando".
export function usePaginada<T>(chave: string | null, consulta: () => Query) {
  const [pedido, setPedido] = useState({ chave, limite: PAGINA })
  // O limite é da chave atual. Sem zerar aqui, voltar a um filtro já expandido traria o limite dele.
  if (pedido.chave !== chave) setPedido({ chave, limite: PAGINA })
  const limite = pedido.chave === chave ? pedido.limite : PAGINA
  const [estado, setEstado] = useState<{ chave: string | null; limite: number; dados?: T[]; erro?: string }>(
    { chave: null, limite: 0 })
  useEffect(() => {
    if (!chave) return
    return onSnapshot(query(consulta(), limit(limite)),
      (s) => setEstado({ chave, limite, dados: s.docs.map((d) => comId<T>(d)) }),
      (e) => setEstado({ chave, limite, erro: e.code === 'permission-denied' ? 'Sem permissão para ver estes dados.' : e.message }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, limite])
  const r = estado.chave === chave ? estado : { chave, limite: 0, dados: undefined, erro: undefined }
  return {
    dados: r.dados, erro: r.erro,
    temMais: r.dados !== undefined && temMais(r.dados.length, r.limite),
    carregando: r.limite !== limite,
    carregarMais: () => setPedido({ chave, limite: limite + PAGINA }),
  }
}

// Total real de uma consulta (count() no servidor), para quando a lista mostra só uma página. Não é
// ao vivo: recalcula quando `gatilho` muda (ex.: a página da mesma consulta, que é ao vivo).
export function useTotal(chave: string, consulta: () => Query, gatilho: unknown) {
  const [total, setTotal] = useState<{ chave: string; n?: number; erro?: string } | null>(null)
  useEffect(() => {
    let vivo = true
    getCountFromServer(consulta()).then(
      (s) => { if (vivo) setTotal({ chave, n: s.data().count }) },
      (e: Error) => { if (vivo) setTotal({ chave, erro: e.message }) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, gatilho])
  return total?.chave === chave ? total : null
}
