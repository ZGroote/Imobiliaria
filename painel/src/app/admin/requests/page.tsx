'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Pagina } from '@/components/AppShell'
import { ListaDePedidos } from '@/components/pedido'
import { CarregarMais, Estado } from '@/components/ui'
import { db } from '@/lib/firebase'
import { pedidosInternos } from '@/lib/listas'
import { ROTULO_STATUS, TODOS_STATUS } from '@/lib/status'
import type { Request } from '@/lib/types'
import { useCatalogoInterno } from '@/lib/useEquipe'
import { usePaginada } from '@/lib/useFirestore'

// Filtros no servidor, pelos índices de firebase/firestore.indexes.json.
export default function PedidosInterno() {
  const [agencia, setAgencia] = useState('')
  const [status, setStatus] = useState('')
  const cat = useCatalogoInterno()
  const r = usePaginada<Request>(`pedidos:${agencia}:${status}`, () => pedidosInternos(db, { agencia, status }))

  return (
    <Pagina titulo="Solicitações" sub="Todas as imobiliárias."
      acoes={<div className="flex flex-wrap gap-2">
        <Link href="/admin/requests/new/leve" className="btn-primario">Solicitar LEVE</Link>
        <Link href="/admin/requests/new/premium" className="btn">Solicitar PREMIUM</Link>
      </div>}>
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={agencia} onChange={(e) => setAgencia(e.target.value)} className="campo w-64">
          <option value="">Todas as imobiliárias</option>
          {cat.agencias.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="campo w-56">
          <option value="">Todos os status</option>
          {TODOS_STATUS.map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
        </select>
      </div>
      <Estado r={r}>
        <ListaDePedidos pedidos={r.dados ?? []} base="/admin/requests"
          imovel={cat.imovel} pessoa={cat.pessoa} agencia={cat.agencia} />
      </Estado>
      <CarregarMais r={r} />
    </Pagina>
  )
}
