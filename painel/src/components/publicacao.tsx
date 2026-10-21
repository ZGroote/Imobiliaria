'use client'
import { useState } from 'react'
import Link from 'next/link'
import { collection, doc, orderBy, query, where } from 'firebase/firestore'
import { Aviso, Cartao, Estado, useAcao } from './ui'
import { db } from '@/lib/firebase'
import { quando } from '@/lib/formato'
import { comandoPromover, comandoReverter } from '@/lib/publicacao'
import { APROVACAO_SEM_MANIFEST, conferirPublicacao, conferirReversao, faseDaPublicacao, registrarPublicacao,
  registrarReversao, TEXTO_DA_FASE } from '@/lib/publicar'
import { usePerfil } from '@/lib/session'
import type { Property, Publication, Request } from '@/lib/types'
import { useColecao, useDoc } from '@/lib/useFirestore'
import type { Vitrine } from '@/lib/vitrine'

// Site de imóveis (proposta §7): estado.json e os ponteiros /imovel/<id> e /maquete/<id>.
const SITE = process.env.NEXT_PUBLIC_SITE_IMOVEIS ?? ''

// A publicação deste pedido, para a equipe e para a imobiliária. Depois da aprovação, o robô publica
// sozinho (m2-worker.md §7): aqui só se acompanha, não há botão de publicar.
export function CartaoDaPublicacao({ r, imovel }: { r: Request; imovel?: Property | null }) {
  const slug = imovel?.pipelineUnitId
  const v = useDoc<Vitrine>(r.status === 'published' && slug ? `vitrine:${slug}` : null, () => doc(db, 'vitrine', slug!))
  const f = faseDaPublicacao(r, imovel, v.dado)
  if (!f) return null
  return (
    <Cartao titulo="Publicação">
      <div className="space-y-2 text-sm" data-fase={f.fase}>
        <p>{TEXTO_DA_FASE[f.fase]}</p>
        {'tourUrl' in f && (
          <p className="flex flex-wrap gap-4">
            {f.tourUrl && <a href={f.tourUrl} target="_blank" rel="noopener" className="text-sky-700 hover:underline">Abrir o tour</a>}
            {f.maqueteUrl && <a href={f.maqueteUrl} target="_blank" rel="noopener" className="text-sky-700 hover:underline">Abrir a maquete</a>}
          </p>
        )}
      </div>
    </Cartao>
  )
}

// Sem o robô: o admin registra a publicação depois que o pipeline pôs o build no ar, e o painel
// confere isso no estado.json do site antes de gravar (§2). "Conferir o site" é visual e vale só para
// a chave conferida: mudou o imóvel, o build ou o manifest, o botão some. Registrar relê o site. Fica
// fechado: com o robô, a publicação é automática depois da aprovação.
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
    <Cartao>
      <details>
      <summary className="cursor-pointer text-sm font-semibold">Sem o robô: registrar a publicação à mão</summary>
      <div className="mt-3">
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
      </div>
      </details>
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
        ) : <p className="text-sm text-slate-500">Ainda não publicado.</p>}
      </Estado>
    </Cartao>
  )
}
