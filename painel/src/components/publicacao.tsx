'use client'
import { useState } from 'react'
import Link from 'next/link'
import { collection, orderBy, query, where } from 'firebase/firestore'
import { Aviso, Cartao, Estado, useAcao } from './ui'
import { db } from '@/lib/firebase'
import { quando } from '@/lib/formato'
import { conferirNoAr, lerEstado, linksPublicos } from '@/lib/publicacao'
import { registrarPublicacao, registrarReversao } from '@/lib/publicar'
import { usePerfil } from '@/lib/session'
import type { Property, Publication, Request } from '@/lib/types'
import { useColecao } from '@/lib/useFirestore'

// Site de imóveis (proposta §7): estado.json e os ponteiros /imovel/<id> e /maquete/<id>.
const SITE = process.env.NEXT_PUBLIC_SITE_IMOVEIS ?? ''

// O admin registra a publicação depois que o pipeline pôs o build no ar, e o painel confere
// isso no estado.json do site antes de gravar (§2).
export function RegistrarPublicacao({ r, imovel }: { r: Request; imovel?: Property }) {
  const perfil = usePerfil()
  const { executar, ocupado, erro } = useAcao()
  const [conferido, setConferido] = useState(false)
  if (r.status !== 'approved' || perfil.role !== 'platform_admin') return null
  const unidade = imovel?.pipelineUnitId
  const comando = `python pipeline/publicar_imovel.py promover ${unidade} ${r.approvedBuild}`
  return (
    <Cartao titulo="Publicação">
      {!SITE ? <Aviso>Site de imóveis não configurado (NEXT_PUBLIC_SITE_IMOVEIS).</Aviso>
        : !imovel || !unidade ? <p className="text-sm text-slate-600">O pedido precisa de um imóvel com id do pipeline.</p> : (
        <>
          <p className="text-sm">Aprovado o build <code>{r.approvedBuild}</code>. Ponha no ar com:</p>
          <pre className="mt-1 overflow-x-auto rounded bg-slate-100 p-2 text-xs">{comando}</pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={ocupado} className="btn" onClick={() => executar(async () => {
              setConferido(false)
              conferirNoAr(await lerEstado(SITE, unidade), r.approvedBuild!, comando)
              setConferido(true)
            })}>Conferir o site</button>
            {conferido && (
              <button disabled={ocupado} className="btn-primario" onClick={() => executar(() =>
                registrarPublicacao(db, perfil.id, r, imovel, linksPublicos(SITE, unidade)))}>
                Registrar publicação
              </button>
            )}
          </div>
          {conferido && <p className="mt-2 text-sm text-emerald-700">O site mostra o build {r.approvedBuild} no ar.</p>}
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
  const [conferido, setConferido] = useState(false)
  if (perfil.role !== 'platform_admin' || !p.previousBuild || !p.previousRequestId || !p.publishedBuild
    || !p.pipelineUnitId || !SITE) return null
  const comando = `python pipeline/publicar_imovel.py reverter ${p.pipelineUnitId}`
  return (
    <Cartao titulo="Reverter">
      <p className="text-sm">No ar: <code>{p.publishedBuild}</code>. Anterior: <code>{p.previousBuild}</code>.</p>
      <pre className="mt-1 overflow-x-auto rounded bg-slate-100 p-2 text-xs">{comando}</pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={ocupado} className="btn" onClick={() => executar(async () => {
          setConferido(false)
          conferirNoAr(await lerEstado(SITE, p.pipelineUnitId!), p.previousBuild!, comando)
          setConferido(true)
        })}>Conferir o site</button>
        {conferido && <button disabled={ocupado} className="btn-primario"
          onClick={() => executar(() => registrarReversao(db, perfil.id, p))}>Registrar reversão</button>}
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
