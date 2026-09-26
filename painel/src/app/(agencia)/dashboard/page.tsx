'use client'
import Link from 'next/link'
import { limit, query, type Query } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { ListaDePedidos } from '@/components/pedido'
import { Estado } from '@/components/ui'
import { db } from '@/lib/firebase'
import { pedidosDaAgencia, pedidosNaEtapa, publicadosDa } from '@/lib/listas'
import { usePessoas } from '@/lib/usePessoas'
import { usePerfil } from '@/lib/session'
import type { Request, RequestStatus } from '@/lib/types'
import { useNomes } from '@/lib/useEquipe'
import { useColecao, useTotal } from '@/lib/useFirestore'

// Spec §23 sem "Visualizações": métricas são da Fase 3.
const CARTOES: { rotulo: string; status: RequestStatus[] }[] = [
  { rotulo: 'Recebidas', status: ['submitted', 'waiting_materials'] },
  { rotulo: 'Em produção', status: ['accepted', 'production', 'internal_review'] },
  { rotulo: 'Aguardando aprovação', status: ['agency_review'] },
]

// Os números vêm do servidor (count()), sem ler os pedidos e imóveis da imobiliária inteiros. Eles
// se recalculam quando as movimentações recentes mudam: toda mudança de pedido (inclusive a
// publicação) mexe em updatedAt e cai no topo dessa lista.
export default function Dashboard() {
  const perfil = usePerfil()
  const ag = perfil.agencyId ?? ''
  const recentes = useColecao<Request>(`recentes:${ag}`, () => query(pedidosDaAgencia(db, ag), limit(5)))
  const { imovel } = useNomes()
  const { nome } = usePessoas(perfil.agencyId, perfil.role === 'agency_manager')
  return (
    <Pagina titulo="Início" acoes={<Link href="/requests/new" className="btn-primario">Nova solicitação</Link>}>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Contador rotulo="Imóveis publicados" href="/properties" chave={`publicados:${ag}`}
          consulta={() => publicadosDa(db, ag)} gatilho={recentes.dados} />
        {CARTOES.map((c) => (
          <Contador key={c.rotulo} rotulo={c.rotulo} href="/requests" chave={`etapa:${ag}:${c.status.join(',')}`}
            consulta={() => pedidosNaEtapa(db, ag, c.status)} gatilho={recentes.dados} />
        ))}
      </div>
      <h2 className="mb-3 text-sm font-semibold">Movimentações recentes</h2>
      <Estado r={recentes}>
        <ListaDePedidos pedidos={recentes.dados ?? []} base="/requests" imovel={imovel}
          pessoa={(uid) => nome(uid, perfil.id)} />
      </Estado>
    </Pagina>
  )
}

function Contador({ rotulo, href, chave, consulta, gatilho }: {
  rotulo: string; href: string; chave: string; consulta: () => Query; gatilho: unknown
}) {
  const t = useTotal(chave, consulta, gatilho)
  return (
    <Link href={href} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-400">
      <p className="text-sm text-slate-500">{rotulo}</p>
      <p className="mt-1 text-3xl font-semibold" title={t?.erro}>{t ? (t.n ?? '?') : '…'}</p>
    </Link>
  )
}
