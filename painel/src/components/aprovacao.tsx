'use client'
import { useState } from 'react'
import { Aviso, Cartao, useAcao } from './ui'
import { aprovar, pedirAjuste, registrarPreview } from '@/lib/aprovacao'
import { db } from '@/lib/firebase'
import { quando } from '@/lib/formato'
import { comandosPreview, lerPreview } from '@/lib/publicacao'
import { usePerfil } from '@/lib/session'
import type { Preview, Property, Request } from '@/lib/types'

const Link = ({ href, children }: { href: string; children: string }) =>
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline">{children}</a>

// O build em revisão e a decisão do gerente. Aprovar vale para ESTE build (hash), não para o pedido.
export function PreviewEmRevisao({ r, pessoa }: { r: Request; pessoa: (uid: string) => string }) {
  const perfil = usePerfil()
  const { executar, ocupado, erro } = useAcao()
  const [ajuste, setAjuste] = useState<string | null>(null)
  if (!r.preview) return null
  const decide = perfil.role === 'agency_manager' && r.status === 'agency_review'
  return (
    <Cartao titulo={r.status === 'agency_review' ? 'Preview para revisão' : 'Preview'}>
      <div className="space-y-1 text-sm">
        <p><Link href={r.preview.tourUrl}>Abrir o tour</Link> · <Link href={r.preview.maqueteUrl}>Abrir a maquete</Link></p>
        <p className="text-xs text-slate-500">Build <code>{r.preview.build}</code></p>
        {r.approvedBuild && r.status !== 'agency_review' && (
          <p className="text-emerald-700">
            Aprovado: build <code>{r.approvedBuild}</code>, por {pessoa(r.approvedBy!)} em {quando(r.approvedAt)}
          </p>
        )}
      </div>
      {decide && ajuste === null && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button disabled={ocupado} className="btn-primario" onClick={() =>
            confirm(`Aprovar o build ${r.preview!.build} para publicação?`) && executar(() => aprovar(db, perfil.id, r))}>
            Aprovar este build
          </button>
          <button disabled={ocupado} className="btn" onClick={() => setAjuste('')}>Pedir ajuste</button>
        </div>
      )}
      {decide && ajuste !== null && (
        <div className="mt-4 space-y-2">
          <textarea rows={3} value={ajuste} onChange={(e) => setAjuste(e.target.value)} className="campo"
            placeholder="O que precisa mudar no tour?" />
          <div className="flex gap-2">
            <button disabled={ocupado} className="btn-primario"
              onClick={async () => { if (await executar(() => pedirAjuste(db, perfil.id, r, ajuste))) setAjuste(null) }}>
              Enviar pedido de ajuste
            </button>
            <button className="btn" onClick={() => setAjuste(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {erro && <Aviso>{erro}</Aviso>}
    </Cartao>
  )
}

// Equipe: cola a URL do tour publicada no canal de preview; o painel lê o manifest.json ao lado.
export function RegistrarPreview({ r, imovel }: { r: Request; imovel?: Property | null }) {
  const perfil = usePerfil()
  const { executar, ocupado, erro } = useAcao()
  const [url, setUrl] = useState('')
  const [lido, setLido] = useState<Preview | null>(null)
  if (!['production', 'internal_review', 'agency_review'].includes(r.status)) return null
  if (!imovel?.pipelineUnitId) {
    return <Cartao titulo="Preview"><p className="text-sm text-slate-600">
      Para registrar o preview, vincule um imóvel que tenha o id do pipeline.</p></Cartao>
  }
  return (
    <Cartao titulo={r.preview ? 'Trocar o preview' : 'Registrar preview'}>
      <div className="mb-2 space-y-1 text-xs text-slate-500">
        <p>Monte o preview do build e depois suba só no canal de preview deste imóvel (nunca no live):</p>
        <pre className="overflow-x-auto rounded bg-slate-100 p-2">{comandosPreview(imovel.pipelineUnitId).join('\n')}</pre>
        <p>Cole aqui o endereço do tour que o canal publicou.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input value={url} onChange={(e) => { setUrl(e.target.value); setLido(null) }} className="campo min-w-72 flex-1"
          placeholder={`https://…/b/${imovel.pipelineUnitId}/<build>/tour.html`} />
        <button disabled={ocupado || !url} className="btn"
          onClick={() => executar(async () => setLido(await lerPreview(url, imovel.pipelineUnitId!)))}>Conferir</button>
      </div>
      {lido && (
        <div className="mt-3 space-y-2 text-sm">
          <p>Build <code>{lido.build}</code> de <code>{imovel.pipelineUnitId}</code> ·{' '}
            <Link href={lido.tourUrl}>tour</Link> · <Link href={lido.maqueteUrl}>maquete</Link></p>
          <button disabled={ocupado} className="btn-primario" onClick={async () => {
            if (await executar(() => registrarPreview(db, perfil.id, r, lido))) { setUrl(''); setLido(null) }
          }}>Enviar para revisão da imobiliária</button>
        </div>
      )}
      {erro && <Aviso>{erro}</Aviso>}
    </Cartao>
  )
}
