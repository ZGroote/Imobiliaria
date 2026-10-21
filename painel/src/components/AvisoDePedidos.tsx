'use client'
import { useEffect, useRef, useState } from 'react'
import { collection, limit, query, where } from 'firebase/firestore'
import { chegaram } from '@/lib/avisos'
import { db } from '@/lib/firebase'
import type { Request, RequestStatus } from '@/lib/types'
import { useColecao } from '@/lib/useFirestore'

const LIMITE = 50
export const contagem = (n: number) => (n >= LIMITE ? LIMITE + '+' : String(n))

// Aviso para a equipe (tasks/painel/mudancas-futuras.md §1 e m2-worker.md §1.1): enquanto o painel
// está aberto, o menu e o título da aba mostram quantos pedidos esperam a equipe, e o navegador avisa
// cada um que chega. Dois motivos: pedido novo (esperando aceite) e pedido na revisão interna (o
// gerente pediu revisão, ou o robô parou num portão). E-mail precisa de um servidor.
function usePedidosNoStatus(equipe: boolean, status: RequestStatus, aviso: string) {
  const r = useColecao<Request>(equipe ? 'pedidos:' + status : null,
    () => query(collection(db, 'requests'), where('status', '==', status), limit(LIMITE)))
  const vistos = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!r.dados) return
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted')
      for (const p of chegaram(vistos.current, r.dados)) new Notification(aviso, { body: p.title, tag: status + '-' + p.id })
    vistos.current = new Set(r.dados.map((p) => p.id))
  }, [r.dados, aviso, status])
  return r.dados?.length ?? 0
}

export function usePedidosParaAEquipe(equipe: boolean) {
  const novos = usePedidosNoStatus(equipe, 'submitted', 'Pedido novo no painel')
  const revisao = usePedidosNoStatus(equipe, 'internal_review', 'Pedido na revisão interna')
  const n = novos + revisao
  useEffect(() => { if (equipe) document.title = n ? `(${contagem(n)}) Painel` : 'Painel' }, [equipe, n])
  return { novos, revisao }
}

// O navegador só pergunta depois de um clique; quem já respondeu não vê o botão.
export function AtivarAvisos() {
  const [permissao, setPermissao] = useState<NotificationPermission>('denied')
  useEffect(() => { if (typeof Notification !== 'undefined') setPermissao(Notification.permission) }, [])
  if (permissao !== 'default') return null
  return (
    <button onClick={() => Notification.requestPermission().then(setPermissao)}
      className="rounded-md px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100">
      Avisar pedidos novos e revisões
    </button>
  )
}
