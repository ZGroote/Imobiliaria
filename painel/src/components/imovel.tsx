'use client'
import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Aviso, Cartao, Selo, Tabela, Td, useAcao, Vazio } from './ui'
import { db } from '@/lib/firebase'
import { quando } from '@/lib/formato'
import { atribuirCorretor } from '@/lib/imoveis'
import { estaPublicado } from '@/lib/listas'
import type { Property, User } from '@/lib/types'

export const ROTULO_SITUACAO: Record<Property['status'], string> = { active: 'Ativo', inactive: 'Inativo', archived: 'Arquivado' }

export function ListaDeImoveis({ imoveis, base, nomeDaAgencia, nomeDoCorretor }: {
  imoveis: Property[]; base: string; nomeDaAgencia?: (id: string) => string; nomeDoCorretor: (uid?: string) => string
}) {
  if (!imoveis.length) return <Vazio>Nenhum imóvel.</Vazio>
  // Na ordem da consulta (mais recentes primeiro): com a lista paginada, reordenar aqui misturaria
  // as páginas e "Carregar mais" encaixaria itens no meio.
  const cab = ['Imóvel', ...(nomeDaAgencia ? ['Imobiliária'] : []), 'Corretor', 'No ar', 'Atualizado']
  return (
    <Tabela cabecalho={cab}>
      {imoveis.map((p) => (
        <tr key={p.id}>
          <Td>
            <Link href={`${base}/view?id=${p.id}`} className="font-medium hover:underline">{p.title}</Link>
            {p.developmentName && <p className="text-xs text-slate-500">{p.developmentName}</p>}
          </Td>
          {nomeDaAgencia && <Td>{nomeDaAgencia(p.agencyId)}</Td>}
          <Td>{nomeDoCorretor(p.assignedAgentId)}</Td>
          <Td>{estaPublicado(p) ? <Selo tom="verde">Publicado</Selo> : <Selo>Não publicado</Selo>}</Td>
          <Td>{quando(p.updatedAt)}</Td>
        </tr>
      ))}
    </Tabela>
  )
}

export function CopiarLink({ url, rotulo }: { url?: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false)
  if (!url) return <p className="text-sm text-slate-500">{rotulo}: ainda não publicado</p>
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium">{rotulo}</span>
      <a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-sky-700 hover:underline">{url}</a>
      <button className="btn text-xs" onClick={async () => {
        await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 1500)
      }}>{copiado ? 'Copiado' : 'Copiar'}</button>
    </div>
  )
}

// Links públicos: sempre os ponteiros estáveis (tourUrl/maqueteUrl), nunca a URL do build.
export function LinksPublicos({ p }: { p: Property }) {
  return (
    <Cartao titulo="Links para compartilhar">
      <div className="space-y-2">
        <CopiarLink url={p.tourUrl} rotulo="Tour" />
        <CopiarLink url={p.maqueteUrl} rotulo="Maquete" />
      </div>
      {estaPublicado(p) && (
        <p className="mt-3 text-xs text-slate-500">Build no ar: <code>{p.publishedBuild}</code> desde {quando(p.publishedAt)}</p>
      )}
    </Cartao>
  )
}

export function Dados({ p, nomeDaAgencia }: { p: Property; nomeDaAgencia?: string }) {
  const linhas: [string, ReactNode][] = [
    ['Imobiliária', nomeDaAgencia],
    ['Empreendimento', p.developmentName],
    ['Endereço', p.address],
    ['Anúncio', p.externalListingUrl &&
      <a href={p.externalListingUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline">Abrir anúncio</a>],
    ['Id no pipeline', p.pipelineUnitId && <code>{p.pipelineUnitId}</code>],
    ['Situação', ROTULO_SITUACAO[p.status]],
  ]
  return (
    <Cartao titulo="Dados">
      <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
        {linhas.filter(([, v]) => v).map(([k, v]) => [
          <dt key={`${k}t`} className="text-slate-500">{k}</dt>, <dd key={`${k}d`}>{v}</dd>])}
      </dl>
    </Cartao>
  )
}

// Gerente (e equipe) escolhe o corretor responsável entre os corretores da imobiliária.
export function CorretorResponsavel({ p, pessoas }: { p: Property; pessoas: User[] }) {
  const { executar, ocupado, erro } = useAcao()
  const corretores = pessoas.filter((u) => u.role === 'agent' && u.active)
  return (
    <Cartao titulo="Corretor responsável">
      <select disabled={ocupado} value={p.assignedAgentId ?? ''} className="campo w-72"
        onChange={(e) => e.target.value && executar(() => atribuirCorretor(db, p.id, e.target.value))}>
        {!p.assignedAgentId && <option value="">Escolha…</option>}
        {corretores.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      {erro && <Aviso>{erro}</Aviso>}
    </Cartao>
  )
}
