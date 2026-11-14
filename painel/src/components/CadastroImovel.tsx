'use client'
import { useIdioma } from '@/components/Idioma'

import { useState, type FormEvent } from 'react'
import { Aviso, Cartao, useAcao } from './ui'
import { ROTULO_SITUACAO } from './imovel'
import { db } from '@/lib/firebase'
import { podeGerenciarImovel, PAPEIS_CADASTRO } from '@/lib/acesso'
import { criarImovel, editarImovel } from '@/lib/imoveis'
import { temPublicacao } from '@/lib/listas'
import { usePerfil } from '@/lib/session'
import type { Agency, Property } from '@/lib/types'

function Campos({ p, tecnico }: { p?: Property; tecnico: boolean }) {
  const { t: tr } = useIdioma()

  return <>
    <label className="block text-sm">{tr("Título")}<input name="title" defaultValue={p?.title} required className="campo mt-1" /></label>
    <label className="block text-sm">{tr("Empreendimento")}<input name="developmentName" defaultValue={p?.developmentName} className="campo mt-1" /></label>
    <label className="block text-sm">{tr("Endereço")}<input name="address" defaultValue={p?.address} className="campo mt-1" /></label>
    <label className="block text-sm">{tr("Link do anúncio")}<input name="externalListingUrl" type="url" defaultValue={p?.externalListingUrl} className="campo mt-1" /></label>
    {tecnico && <label className="block text-sm">Id no pipeline<input name="pipelineUnitId" defaultValue={p?.pipelineUnitId} className="campo mt-1" /></label>}
  </>
}

export function NovoImovel({ agencias = [] }: { agencias?: Agency[] }) {
  const { t: tr } = useIdioma()

  const perfil = usePerfil(), administrador = perfil.role === 'platform_admin'
  const { executar, ocupado, erro } = useAcao()
  const [aberto, setAberto] = useState(false)
  if (!PAPEIS_CADASTRO.includes(perfil.role)) return null
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget, f = new FormData(form), s = (k: string) => String(f.get(k) ?? '')
    const ok = await executar(() => criarImovel(db, administrador ? s('agencyId') : perfil.agencyId ?? '', {
      title: s('title'), developmentName: s('developmentName'), address: s('address'), externalListingUrl: s('externalListingUrl'),
      ...(administrador ? { pipelineUnitId: s('pipelineUnitId') } : {}),
    }))
    if (ok) { form.reset(); setAberto(false) }
  }
  if (!aberto) return <button className="btn" onClick={() => setAberto(true)}>{tr("Cadastrar imóvel")}</button>
  return <Cartao titulo={tr("Novo imóvel")}>
    <form onSubmit={enviar} className="grid gap-3 md:grid-cols-2">
      {administrador && <label className="text-sm">{tr("Imobiliária")}<select name="agencyId" required className="campo mt-1">
        <option value="">{tr("Escolha…")}</option>{agencias.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select></label>}
      <Campos tecnico={administrador} />
      <div className="flex gap-2 md:col-span-2">
        <button disabled={ocupado} className="btn-primario">{tr("Cadastrar")}</button>
        <button type="button" className="btn" onClick={() => setAberto(false)}>{tr("Cancelar")}</button>
      </div>
      {erro && <div className="md:col-span-2"><Aviso>{erro}</Aviso></div>}
    </form>
  </Cartao>
}

export function EditarImovel({ p, fechar }: { p: Property; fechar: () => void }) {
  const { t: tr } = useIdioma()

  const perfil = usePerfil(), administrador = perfil.role === 'platform_admin'
  const { executar, ocupado, erro } = useAcao()
  if (!podeGerenciarImovel(perfil, p.agencyId)) return <Aviso>{tr("Sem permissão para alterar este cadastro.")}</Aviso>
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget), s = (k: string) => String(f.get(k) ?? '')
    const ok = await executar(() => editarImovel(db, p.id, {
      title: s('title'), developmentName: s('developmentName'), address: s('address'), externalListingUrl: s('externalListingUrl'),
      ...(administrador ? { pipelineUnitId: s('pipelineUnitId') } : {}),
      ...(!temPublicacao(p) ? { status: s('status') as Property['status'] } : {}),
    }))
    if (ok) fechar()
  }
  return <Cartao titulo={tr("Editar dados")}>
    <form onSubmit={enviar} className="space-y-3">
      <Campos p={p} tecnico={administrador} />
      {temPublicacao(p) ? <p className="text-sm text-slate-600">Situação: {tr(ROTULO_SITUACAO[p.status])}. A visibilidade é controlada pelo gerente da imobiliária.</p> : <label className="block text-sm">{tr("Situação")}<select name="status" defaultValue={p.status} className="campo mt-1">
          {Object.entries(ROTULO_SITUACAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </label>}
      <div className="flex gap-2">
        <button disabled={ocupado} className="btn-primario">{tr("Salvar")}</button>
        <button type="button" className="btn" onClick={fechar}>{tr("Cancelar")}</button>
      </div>
      {erro && <Aviso>{erro}</Aviso>}
    </form>
  </Cartao>
}
