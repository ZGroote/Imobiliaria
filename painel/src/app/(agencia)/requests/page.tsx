'use client'
import { useState } from 'react'
import Link from 'next/link'
import { collection, orderBy, query, where } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { ListaDePedidos } from '@/components/pedido'
import { Estado } from '@/components/ui'
import { db } from '@/lib/firebase'
import { usePessoas } from '@/lib/usePessoas'
import { usePerfil } from '@/lib/session'
import { ROTULO_STATUS, TODOS_STATUS } from '@/lib/status'
import type { Property, Request } from '@/lib/types'
import { useColecao } from '@/lib/useFirestore'

// D4: o corretor vê os pedidos da imobiliária inteira; "só os meus" é filtro de tela.
export default function Pedidos() {
  const perfil = usePerfil()
  const [status, setStatus] = useState('')
  const [meus, setMeus] = useState(false)
  const r = useColecao<Request>(`pedidos:${perfil.agencyId}`, () => query(collection(db, 'requests'),
    where('agencyId', '==', perfil.agencyId), orderBy('updatedAt', 'desc')))
  const imoveis = useColecao<Property>(`imoveis:${perfil.agencyId}`,
    () => query(collection(db, 'properties'), where('agencyId', '==', perfil.agencyId)))
  const { nome } = usePessoas(perfil.agencyId, perfil.role === 'agency_manager')
  const visiveis = (r.dados ?? []).filter((p) => (!status || p.status === status) && (!meus || p.requestedBy === perfil.id))

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
        <ListaDePedidos pedidos={visiveis} base="/requests"
          imovel={(id) => (id ? imoveis.dados?.find((p) => p.id === id)?.title ?? '…' : '—')}
          pessoa={(uid) => nome(uid, perfil.id)} />
      </Estado>
    </Pagina>
  )
}
