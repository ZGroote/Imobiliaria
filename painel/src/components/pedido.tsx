'use client'
import type { FormEvent, ReactNode } from 'react'
import Link from 'next/link'
import { Aviso, Cartao, Selo, Tabela, Td, useAcao, Vazio } from './ui'
import { db } from '@/lib/firebase'
import { quando } from '@/lib/formato'
import { editarPedido } from '@/lib/pedidos'
import { ROTULO_STATUS, TOM_STATUS } from '@/lib/status'
import { ROTULO_MODO_PRODUCAO, type Request, type RequestStatus } from '@/lib/types'

export const SeloStatus = ({ s }: { s: RequestStatus }) => <Selo tom={TOM_STATUS[s]}>{ROTULO_STATUS[s]}</Selo>
export const ROTULO_PRIORIDADE = { low: 'Baixa', normal: 'Normal', high: 'Alta' } as const

export function ListaDePedidos({ pedidos, base, imovel, pessoa, agencia }: {
  pedidos: Request[]; base: string; imovel: (id?: string) => string; pessoa: (uid: string) => string
  agencia?: (id: string) => string
}) {
  if (!pedidos.length) return <Vazio>Nenhuma solicitação.</Vazio>
  const cab = ['Solicitação', 'Produto', 'Imóvel', ...(agencia ? ['Imobiliária'] : []), 'Solicitante', 'Status', 'Prioridade', 'Atualizada']
  return (
    <Tabela cabecalho={cab}>
      {pedidos.map((r) => (
        <tr key={r.id}>
          <Td><Link href={`${base}/view?id=${r.id}`} className="font-medium hover:underline">{r.title}</Link></Td>
          <Td>{r.productionMode ? ROTULO_MODO_PRODUCAO[r.productionMode] : '—'}</Td>
          <Td>{imovel(r.propertyId)}</Td>
          {agencia && <Td>{agencia(r.agencyId)}</Td>}
          <Td>{pessoa(r.requestedBy)}</Td>
          <Td><SeloStatus s={r.status} /></Td>
          <Td>{r.priority ? ROTULO_PRIORIDADE[r.priority] : '—'}</Td>
          <Td>{quando(r.updatedAt)}</Td>
        </tr>
      ))}
    </Tabela>
  )
}

export function DadosDoPedido({ r, imovel, pessoa, extra }: {
  r: Request; imovel: ReactNode; pessoa: string; extra?: [string, ReactNode][]
}) {
  const linhas: [string, ReactNode][] = [
    ['Status', <SeloStatus key="s" s={r.status} />],
    ['Produto', r.productionMode ? ROTULO_MODO_PRODUCAO[r.productionMode] : 'Não registrado (pedido anterior)'],
    ['Imóvel', imovel],
    ['Solicitante', pessoa],
    ['Anúncio', r.listingUrl &&
      <a href={r.listingUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline">Abrir anúncio</a>],
    ['Prioridade', r.priority && ROTULO_PRIORIDADE[r.priority]],
    ['Observações', r.notes && <span className="whitespace-pre-wrap">{r.notes}</span>],
    ['Criada', quando(r.createdAt)],
    ['Atualizada', quando(r.updatedAt)],
    ...(extra ?? []),
  ]
  return (
    <Cartao titulo="Solicitação">
      <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
        {linhas.filter(([, v]) => v).map(([k, v]) => [
          <dt key={`${k}t`} className="text-slate-500">{k}</dt>, <dd key={`${k}d`}>{v}</dd>])}
      </dl>
    </Cartao>
  )
}

export function EditarPedido({ r, fechar }: { r: Request; fechar: () => void }) {
  const { executar, ocupado, erro } = useAcao()
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget), s = (k: string) => String(f.get(k) ?? '')
    if (await executar(() => editarPedido(db, r.id, { title: s('title'), listingUrl: s('listingUrl'), notes: s('notes') }))) fechar()
  }
  return (
    <Cartao titulo="Editar solicitação">
      <form onSubmit={enviar} className="space-y-3">
        <label className="block text-sm">Título<input name="title" defaultValue={r.title} required className="campo mt-1" /></label>
        <label className="block text-sm">Link do anúncio
          <input name="listingUrl" type="url" defaultValue={r.listingUrl} className="campo mt-1" /></label>
        <label className="block text-sm">Observações
          <textarea name="notes" rows={4} defaultValue={r.notes} className="campo mt-1" /></label>
        <div className="flex gap-2">
          <button disabled={ocupado} className="btn-primario">Salvar</button>
          <button type="button" className="btn" onClick={fechar}>Cancelar</button>
        </div>
        {erro && <Aviso>{erro}</Aviso>}
      </form>
    </Cartao>
  )
}
