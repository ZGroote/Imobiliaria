'use client'
import { useIdioma } from '@/components/Idioma'

import Link from 'next/link'
import { useState } from 'react'
import { limit, query, type Query } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { ListaDePedidos } from '@/components/pedido'
import { CarregarMais, Cartao, Estado } from '@/components/ui'
import { RastreabilidadeImovel } from '@/components/rastreabilidade'
import { VisaoGeralInicio } from '@/components/VisaoGeralInicio'
import { db } from '@/lib/firebase'
import { imoveisDa, pedidosDaAgencia, pedidosNaEtapa, publicadosDa } from '@/lib/listas'
import { usePessoas } from '@/lib/usePessoas'
import { usePerfil } from '@/lib/session'
import type { Property, Request, RequestStatus } from '@/lib/types'
import { useNomes } from '@/lib/useEquipe'
import { useColecao, usePaginada, useTotal } from '@/lib/useFirestore'

const CARTOES: { rotulo: string; status: RequestStatus[] }[] = [
  { rotulo: 'Recebidas', status: ['submitted', 'waiting_materials'] },
  { rotulo: 'Em produção', status: ['accepted', 'production', 'internal_review'] },
  { rotulo: 'Aguardando aprovação', status: ['agency_review'] },
]

// Os números vêm do servidor (count()), sem ler os pedidos e imóveis da imobiliária inteiros. Eles
// se recalculam quando as movimentações recentes mudam: toda mudança de pedido (inclusive a
// publicação) mexe em updatedAt e cai no topo dessa lista.
export default function Dashboard() {
  const { t: tr } = useIdioma()

  const perfil = usePerfil()
  const ag = perfil.agencyId ?? ''
  const recentes = useColecao<Request>(`recentes:${ag}`, () => query(pedidosDaAgencia(db, ag), limit(5)))
  const empreendimentos = usePaginada<Property>(`inicio-imoveis:${ag}`, () => imoveisDa(db, ag))
  const [escolha, setEscolha] = useState('')
  const selecionado = empreendimentos.dados?.find(p => p.id === escolha) ?? empreendimentos.dados?.find(p => p.status === 'active') ?? empreendimentos.dados?.[0]
  const { imovel } = useNomes()
  const { nome } = usePessoas(perfil.agencyId, perfil.role === 'agency_manager')
  return (
    <Pagina titulo={tr("Início")} acoes={<Link href="/requests/new" className="btn-primario">{tr("Nova solicitação")}</Link>}>
      <section className="brand-banner mb-6">
        <p className="brand-kicker mb-2">Conecta Imóveis 3D</p><h2 className="text-xl font-semibold">{tr("Acessos e interesse")}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">{tr("Veja quais empreendimentos atraem acessos, onde há retornos e como o interesse evolui dentro de cada visita.")}</p>
        <div className="mt-4 flex flex-wrap gap-2"><Link className="btn" href="/properties">{tr("Empreendimentos")}</Link>
          {perfil.role === 'agency_manager' && <Link className="btn" href="/team">{tr("Convidar corretor")}</Link>}<Link className="btn" href="/profile">{tr("Dados de contato")}</Link></div>
      </section>
      <Estado r={empreendimentos}><VisaoGeralInicio imoveis={empreendimentos.dados ?? []} temMais={empreendimentos.temMais} selecionar={setEscolha} /></Estado>
      <div id="detalhe-empreendimento" className="mb-8 scroll-mt-5 space-y-5"><Cartao titulo={tr("Explorar um empreendimento")}><Estado r={empreendimentos}>
        {empreendimentos.dados?.length ? <label className="block text-sm">{tr("Empreendimento")}<select aria-label={tr("Empreendimento")} className="campo mt-2 max-w-xl" value={selecionado?.id ?? ''} onChange={e => setEscolha(e.target.value)}>
          {empreendimentos.dados.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select></label> : <p className="text-sm text-slate-500">{tr("Nenhum imóvel.")}</p>}
        {selecionado && perfil.role === 'agency_manager' && <Link className="btn mt-3" href={`/properties/units?id=${encodeURIComponent(selecionado.id)}`}>{tr("Preços e vendas das unidades")}</Link>}
      </Estado><CarregarMais r={empreendimentos} /></Cartao>
      {selecionado && <RastreabilidadeImovel key={selecionado.id} p={selecionado} />}</div>
      <h2 className="mb-3 text-sm font-semibold">{tr("Produção e solicitações")}</h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Contador rotulo={tr("Imóveis publicados")} href="/properties" chave={`publicados:${ag}`}
          consulta={() => publicadosDa(db, ag)} gatilho={empreendimentos.dados} />
        {CARTOES.map((c) => (
          <Contador key={c.rotulo} rotulo={c.rotulo} href="/requests" chave={`etapa:${ag}:${c.status.join(',')}`}
            consulta={() => pedidosNaEtapa(db, ag, c.status)} gatilho={recentes.dados} />
        ))}
      </div>
      <h2 className="mb-3 text-sm font-semibold">{tr("Movimentações recentes")}</h2>
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
  const { t: traduzir } = useIdioma()
  const t = useTotal(chave, consulta, gatilho)
  return (
    <Link href={href} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-400">
      <p className="text-sm text-slate-500">{traduzir(rotulo)}</p>
      <p className="mt-1 text-3xl font-semibold" title={t?.erro}>{t ? (t.n ?? '?') : '…'}</p>
    </Link>
  )
}
