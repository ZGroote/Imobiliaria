'use client'
import { useIdioma } from '@/components/Idioma'

import type { FormEvent, ReactNode } from 'react'
import Link from 'next/link'
import { Aviso, Cartao, Selo, Tabela, Td, useAcao, Vazio } from './ui'
import { db } from '@/lib/firebase'
import { editarPedido } from '@/lib/pedidos'
import { ROTULO_STATUS, TOM_STATUS } from '@/lib/status'
import { ROTULO_MODO_PRODUCAO, type Request, type RequestStatus } from '@/lib/types'

export const SeloStatus = ({ s }: { s: RequestStatus }) => {
  const { t: tr } = useIdioma()
  return <Selo tom={TOM_STATUS[s]}>{tr(ROTULO_STATUS[s])}</Selo>
}
export const ROTULO_PRIORIDADE = { low: 'Baixa', normal: 'Normal', high: 'Alta' } as const

export function ListaDePedidos({ pedidos, base, imovel, pessoa, agencia }: {
  pedidos: Request[]; base: string; imovel: (id?: string) => string; pessoa: (uid: string) => string
  agencia?: (id: string) => string
}) {
  const { t: tr, dataHora: quando } = useIdioma()

  if (!pedidos.length) return <Vazio>{tr("Nenhuma solicitação.")}</Vazio>
  const cab = [tr("Solicitação"), ...(agencia ? [tr("Produto")] : []), tr("Imóvel"), ...(agencia ? [tr("Imobiliária")] : []), tr("Solicitante"), 'Status', tr("Prioridade"), tr("Atualizada")]
  return (
    <Tabela cabecalho={cab}>
      {pedidos.map((r) => (
        <tr key={r.id}>
          <Td><Link href={`${base}/view?id=${r.id}`} className="font-medium hover:underline">{r.title}</Link></Td>
          {agencia && <Td>{r.productionMode ? ROTULO_MODO_PRODUCAO[r.productionMode] : '—'}</Td>}
          <Td>{imovel(r.propertyId)}</Td>
          {agencia && <Td>{agencia(r.agencyId)}</Td>}
          <Td>{pessoa(r.requestedBy)}</Td>
          <Td><SeloStatus s={r.status} /></Td>
          <Td>{r.priority ? tr(ROTULO_PRIORIDADE[r.priority]) : '—'}</Td>
          <Td>{quando(r.updatedAt)}</Td>
        </tr>
      ))}
    </Tabela>
  )
}

export function DadosDoPedido({ r, imovel, pessoa, extra, interno = false }: {
  r: Request; imovel: ReactNode; pessoa: string; extra?: [string, ReactNode][]; interno?: boolean
}) {
  const { t: tr, dataHora: quando } = useIdioma()

  const linhas: [string, ReactNode][] = [
    ['Status', <SeloStatus key="s" s={r.status} />],
    ...(interno ? [[tr("Produto"), r.productionMode ? ROTULO_MODO_PRODUCAO[r.productionMode] : tr("Não registrado (pedido anterior)")] as [string, ReactNode]] : []),
    [tr("Imóvel"), imovel],
    [tr("Solicitante"), pessoa],
    [tr("Anúncio"), r.listingUrl &&
      <a href={r.listingUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline">{tr("Abrir anúncio")}</a>],
    [tr("Prioridade"), r.priority && tr(ROTULO_PRIORIDADE[r.priority])],
    [tr("Observações"), r.notes && <span className="whitespace-pre-wrap">{r.notes}</span>],
    [tr("Criada"), quando(r.createdAt)],
    [tr("Atualizada"), quando(r.updatedAt)],
    ...(extra ?? []),
  ]
  return (
    <Cartao titulo={tr("Solicitação")}>
      <dl className="grid gap-y-2 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
        {linhas.filter(([, v]) => v).map(([k, v]) => [
          <dt key={`${k}t`} className="text-slate-500">{k}</dt>, <dd key={`${k}d`} className="min-w-0 break-words">{v}</dd>])}
      </dl>
    </Cartao>
  )
}

export function EditarPedido({ r, fechar }: { r: Request; fechar: () => void }) {
  const { t: tr, dataHora: quando } = useIdioma()

  const { executar, ocupado, erro } = useAcao()
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget), s = (k: string) => String(f.get(k) ?? '')
    if (await executar(() => editarPedido(db, r.id, { title: s('title'), listingUrl: s('listingUrl'), notes: s('notes') }))) fechar()
  }
  return (
    <Cartao titulo={tr("Editar solicitação")}>
      <form onSubmit={enviar} className="space-y-3">
        <label className="block text-sm">{tr("Título")}<input name="title" defaultValue={r.title} required className="campo mt-1" /></label>
        <label className="block text-sm">{tr("Link do anúncio")}<input name="listingUrl" type="url" defaultValue={r.listingUrl} className="campo mt-1" /></label>
        <label className="block text-sm">{tr("Observações")}<textarea name="notes" rows={4} defaultValue={r.notes} className="campo mt-1" /></label>
        <div className="flex gap-2">
          <button disabled={ocupado} className="btn-primario">{tr("Salvar")}</button>
          <button type="button" className="btn" onClick={fechar}>{tr("Cancelar")}</button>
        </div>
        {erro && <Aviso>{erro}</Aviso>}
      </form>
    </Cartao>
  )
}
