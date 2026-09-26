'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Pagina } from '@/components/AppShell'
import { ListaDePedidos } from '@/components/pedido'
import { CarregarMais, Estado } from '@/components/ui'
import { db } from '@/lib/firebase'
import { pedidosDaAgencia } from '@/lib/listas'
import { usePessoas } from '@/lib/usePessoas'
import { usePerfil } from '@/lib/session'
import { ROTULO_STATUS, TODOS_STATUS } from '@/lib/status'
import type { Request } from '@/lib/types'
import { useNomes } from '@/lib/useEquipe'
import { usePaginada } from '@/lib/useFirestore'

// D4: o corretor vê os pedidos da imobiliária inteira. Status e "só as minhas" vão na consulta:
// com a lista paginada, filtrar a página na tela perderia o que não coube nela.
export default function Pedidos() {
  const perfil = usePerfil()
  const [status, setStatus] = useState('')
  const [meus, setMeus] = useState(false)
  const r = usePaginada<Request>(`pedidos:${perfil.agencyId}:${status}:${meus}`,
    () => pedidosDaAgencia(db, perfil.agencyId ?? '', { status, de: meus ? perfil.id : undefined }))
  const { imovel } = useNomes()
  const { nome } = usePessoas(perfil.agencyId, perfil.role === 'agency_manager')

  return (
    <Pagina titulo="Solicitações" acoes={<Link href="/requests/new" className="btn-primario">Nova solicitação</Link>}>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="campo w-56">
          <option value="">Todos os status</option>
          {TODOS_STATUS.map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
        </select>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={meus} onChange={(e) => setMeus(e.target.checked)} /> Só as minhas
        </label>
      </div>
      <Estado r={r}>
        <ListaDePedidos pedidos={r.dados ?? []} base="/requests"
          imovel={imovel}
          pessoa={(uid) => nome(uid, perfil.id)} />
      </Estado>
      <CarregarMais r={r} />
    </Pagina>
  )
}
