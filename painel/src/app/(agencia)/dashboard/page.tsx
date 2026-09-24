'use client'
import Link from 'next/link'
import { collection, orderBy, query, where } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { ListaDePedidos } from '@/components/pedido'
import { Estado } from '@/components/ui'
import { db } from '@/lib/firebase'
import { usePessoas } from '@/lib/usePessoas'
import { usePerfil } from '@/lib/session'
import type { Property, Request, RequestStatus } from '@/lib/types'
import { useColecao } from '@/lib/useFirestore'

// Spec §23 sem "Visualizações": métricas são da Fase 3.
const CARTOES: { rotulo: string; status: RequestStatus[] }[] = [
  { rotulo: 'Recebidas', status: ['submitted', 'waiting_materials'] },
  { rotulo: 'Em produção', status: ['accepted', 'production', 'internal_review'] },
  { rotulo: 'Aguardando aprovação', status: ['agency_review'] },
]

export default function Dashboard() {
  const perfil = usePerfil()
  const pedidos = useColecao<Request>(`pedidos:${perfil.agencyId}`, () => query(collection(db, 'requests'),
    where('agencyId', '==', perfil.agencyId), orderBy('updatedAt', 'desc')))
  const imoveis = useColecao<Property>(`imoveis:${perfil.agencyId}`,
    () => query(collection(db, 'properties'), where('agencyId', '==', perfil.agencyId)))
  const { nome } = usePessoas(perfil.agencyId, perfil.role === 'agency_manager')
  const lista = pedidos.dados ?? []
  const numeros = [
    { rotulo: 'Imóveis publicados', n: (imoveis.dados ?? []).filter((p) => p.publishedBuild).length, href: '/properties' },
    ...CARTOES.map((c) => ({ rotulo: c.rotulo, n: lista.filter((p) => c.status.includes(p.status)).length, href: '/requests' })),
  ]
  return (
    <Pagina titulo="Início" acoes={<Link href="/requests/new" className="btn-primario">Nova solicitação</Link>}>
      <Estado r={pedidos}>
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {numeros.map((c) => (
            <Link key={c.rotulo} href={c.href} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-400">
              <p className="text-sm text-slate-500">{c.rotulo}</p>
              <p className="mt-1 text-3xl font-semibold">{c.n}</p>
            </Link>
          ))}
        </div>
        <h2 className="mb-3 text-sm font-semibold">Movimentações recentes</h2>
        <ListaDePedidos pedidos={lista.slice(0, 5)} base="/requests"
          imovel={(id) => (id ? imoveis.dados?.find((p) => p.id === id)?.title ?? '…' : '—')}
          pessoa={(uid) => nome(uid, perfil.id)} />
      </Estado>
    </Pagina>
  )
}
