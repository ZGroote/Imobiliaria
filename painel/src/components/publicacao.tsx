'use client'
import { useState } from 'react'
import Link from 'next/link'
import { collection, orderBy, query, where } from 'firebase/firestore'
import { Aviso, Cartao, Estado, Selo, useAcao } from './ui'
import { db } from '@/lib/firebase'
import { quando } from '@/lib/formato'
import { comandoPromover, comandoReverter } from '@/lib/publicacao'
import { estaPublicado, temPublicacao } from '@/lib/listas'
import { alterarDisponibilidadePublicacao, APROVACAO_SEM_MANIFEST, conferirPublicacao, conferirReversao, registrarPublicacao, registrarReversao }
  from '@/lib/publicar'
import { usePerfil } from '@/lib/session'
import type { Property, Publication, Request } from '@/lib/types'
import { useColecao } from '@/lib/useFirestore'

// Site de imóveis (proposta §7): estado.json e os ponteiros /imovel/<id> e /maquete/<id>.
const SITE = process.env.NEXT_PUBLIC_SITE_IMOVEIS ?? ''

export function ControlePublicacao({ p, compacto = false }: { p: Property; compacto?: boolean }) {
  const perfil = usePerfil()
  const { executar, ocupado, erro } = useAcao()
  const preparado = temPublicacao(p), publicado = estaPublicado(p)
  const gerente = perfil.role === 'agency_manager' && perfil.agencyId === p.agencyId
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Selo tom={publicado ? 'verde' : 'cinza'}>{publicado ? 'Publicado' : preparado ? 'Fora do ar' : 'Não publicado'}</Selo>
        {gerente && <button type="button" role="switch" aria-checked={publicado}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2
            disabled:cursor-not-allowed disabled:opacity-50 ${publicado ? 'bg-emerald-600' : 'bg-slate-400'}`}
          disabled={ocupado || !preparado || p.status === 'archived'}
          aria-label={`Visibilidade de ${p.title}`} aria-busy={ocupado}
          onClick={() => executar(() => alterarDisponibilidadePublicacao(db, perfil.id, p.id, !publicado))}>
          <span aria-hidden="true" className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform
            motion-reduce:transition-none ${publicado ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>}
        {ocupado && <span role="status" className="text-xs text-slate-500">Salvando…</span>}
      </div>
      {gerente && !preparado && <p className="text-xs text-slate-500">
        O tour ou a maquete ainda precisa ser preparado pela equipe.
      </p>}
      {perfil.role === 'platform_admin' && !preparado && <p className="text-xs text-slate-500">
        {compacto ? <Link href={`/admin/properties/view?id=${p.id}#publicacao`} className="text-sky-700 hover:underline">
          Preparar publicação
        </Link> : 'Ainda não há tour ou maquete preparado para colocar no ar.'}
      </p>}
      {p.status === 'archived' && <p className="text-xs text-slate-500">O imóvel está arquivado.</p>}
      {erro && <Aviso>{erro}</Aviso>}
    </div>
  )
}

export function PublicacaoDoImovel({ p }: { p: Property }) {
  const perfil = usePerfil()
  return (
    <div id="publicacao" className="lg:col-span-2">
      <Cartao titulo="Publicação">
        <ControlePublicacao p={p} />
        <p className="mt-3 text-sm text-slate-600">
          Retirar do ar pausa as páginas públicas e os links individuais de tour e maquete. Ao colocar no ar novamente,
          os mesmos links voltam a funcionar, com o histórico preservado.
        </p>
        {!temPublicacao(p) && perfil.role === 'platform_admin' && <SolicitacoesParaPublicar p={p} />}
      </Cartao>
    </div>
  )
}

function SolicitacoesParaPublicar({ p }: { p: Property }) {
  const r = useColecao<Request>(`aprovados:${p.id}`, () => query(collection(db, 'requests'),
    where('propertyId', '==', p.id), where('status', '==', 'approved')))
  return <div className="mt-3 text-sm"><Estado r={r}>
    {r.dados?.length ? r.dados.map((pedido) => <p key={pedido.id}>
      <Link href={`/admin/requests/view?id=${pedido.id}`} className="text-sky-700 hover:underline">
        Publicar solicitação aprovada: {pedido.title}
      </Link>
    </p>) : <Link href="/admin/requests" className="text-sky-700 hover:underline">Ver solicitações para preparar a publicação</Link>}
  </Estado></div>
}

// O admin registra a publicação depois que o pipeline pôs o build no ar, e o painel confere
// isso no estado.json do site antes de gravar (§2). "Conferir o site" é visual e vale só para a
// chave conferida: mudou o imóvel, o build ou o manifest, o botão some. Registrar relê o site.
export function RegistrarPublicacao({ r, imovel }: { r: Request; imovel?: Property }) {
  const perfil = usePerfil()
  const { executar, ocupado, erro } = useAcao()
  const [conferido, setConferido] = useState('')
  if (r.status !== 'approved' || perfil.role !== 'platform_admin') return null
  const unidade = imovel?.pipelineUnitId
  // Sempre o artefato APROVADO (approvedManifestSha256), nunca o preview que esteja no pedido.
  const comando = unidade && r.approvedBuild && r.approvedManifestSha256
    ? comandoPromover(unidade, r.approvedBuild, r.approvedManifestSha256) : ''
  const chave = `${unidade}:${r.approvedBuild}:${r.approvedManifestSha256}`
  return (
    <Cartao titulo="Publicação">
      {!SITE ? <Aviso>Site de imóveis não configurado (NEXT_PUBLIC_SITE_IMOVEIS).</Aviso>
        : !imovel || !unidade ? <p className="text-sm text-slate-600">O pedido precisa de um imóvel com id do pipeline.</p>
        : !r.approvedManifestSha256 ? <Aviso>{APROVACAO_SEM_MANIFEST}</Aviso> : (
        <>
          <p className="text-sm">Aprovado o build <code>{r.approvedBuild}</code> (manifest{' '}
            <code>{r.approvedManifestSha256.slice(0, 12)}…</code>). Ponha no ar com:</p>
          <pre className="mt-1 overflow-x-auto rounded bg-slate-100 p-2 text-xs">{comando}</pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={ocupado} className="btn" onClick={() => executar(async () => {
              setConferido('')
              await conferirPublicacao(r, imovel, SITE)
              setConferido(chave)
            })}>Conferir o site</button>
            {conferido === chave && (
              <button disabled={ocupado} className="btn-primario" onClick={() => executar(() =>
                registrarPublicacao(db, perfil.id, r, imovel, SITE))}>
                Registrar publicação
              </button>
            )}
          </div>
          {conferido === chave && <p className="mt-2 text-sm text-emerald-700">
            O site mostra no ar o build {r.approvedBuild} com o manifest aprovado.</p>}
        </>
      )}
      {erro && <Aviso>{erro}</Aviso>}
    </Cartao>
  )
}

// Volta o ponteiro para o build anterior (que continua no ar). Mesmo rito: pipeline, conferir, registrar.
export function ReverterPublicacao({ p }: { p: Property }) {
  const perfil = usePerfil()
  const { executar, ocupado, erro } = useAcao()
  const [conferido, setConferido] = useState('')
  if (perfil.role !== 'platform_admin' || !p.previousBuild || !p.previousRequestId || !p.publishedBuild
    || !p.pipelineUnitId || !SITE) return null
  const comando = comandoReverter(p.pipelineUnitId)
  const chave = `${p.pipelineUnitId}:${p.publishedBuild}:${p.previousBuild}`
  return (
    <Cartao titulo="Reverter">
      <p className="text-sm">No ar: <code>{p.publishedBuild}</code>. Anterior: <code>{p.previousBuild}</code>.</p>
      <pre className="mt-1 overflow-x-auto rounded bg-slate-100 p-2 text-xs">{comando}</pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={ocupado} className="btn" onClick={() => executar(async () => {
          setConferido('')
          await conferirReversao(db, p, SITE)
          setConferido(chave)
        })}>Conferir o site</button>
        {conferido === chave && <button disabled={ocupado} className="btn-primario"
          onClick={() => executar(() => registrarReversao(db, perfil.id, p, SITE))}>Registrar reversão</button>}
      </div>
      {erro && <Aviso>{erro}</Aviso>}
    </Cartao>
  )
}

// Histórico de publicar/reverter. A imobiliária consulta pela própria agência (índice
// agencyId + propertyId + publishedAt); a equipe, pelo imóvel.
export function HistoricoDePublicacoes({ p, interno, pessoa, basePedido }: {
  p: Property; interno: boolean; pessoa: (uid: string) => string; basePedido: string
}) {
  const r = useColecao<Publication>(`publicacoes:${p.id}:${interno}`, () => interno
    ? query(collection(db, 'publications'), where('propertyId', '==', p.id), orderBy('publishedAt', 'desc'))
    : query(collection(db, 'publications'), where('agencyId', '==', p.agencyId), where('propertyId', '==', p.id),
      orderBy('publishedAt', 'desc')))
  return (
    <Cartao titulo="Histórico de publicação">
      <Estado r={r}>
        {r.dados?.length ? (
          <ol className="space-y-3 text-sm">
            {r.dados.map((x) => (
              <li key={x.id} className="border-l-2 border-slate-200 pl-3">
                <p>
                  {x.action === 'publish' ? 'Publicado' : 'Revertido para'} o build <code>{x.build}</code>
                  {x.previousBuild && <span className="text-slate-500"> (antes: <code>{x.previousBuild}</code>)</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {pessoa(x.publishedBy)} · {quando(x.publishedAt)}
                  {x.requestId && <> · <Link href={`${basePedido}/view?id=${x.requestId}`} className="hover:underline">pedido</Link></>}
                </p>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-slate-500">Nenhuma publicação registrada neste histórico.</p>}
      </Estado>
    </Cartao>
  )
}
