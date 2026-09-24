'use client'
import { useState, type FormEvent } from 'react'
import { collection, orderBy, query, where } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { ListaDeImoveis } from '@/components/imovel'
import { Aviso, Cartao, Estado, useAcao } from '@/components/ui'
import { db } from '@/lib/firebase'
import { criarImovel } from '@/lib/imoveis'
import type { Agency, Property, User } from '@/lib/types'
import { useColecao } from '@/lib/useFirestore'

export default function ImoveisInterno() {
  const [agencia, setAgencia] = useState('')
  const agencias = useColecao<Agency>('agencias', () => query(collection(db, 'agencies'), orderBy('name')))
  const imoveis = useColecao<Property>(`imoveis:${agencia}`, () => agencia
    ? query(collection(db, 'properties'), where('agencyId', '==', agencia))
    : collection(db, 'properties'))
  const corretores = useColecao<User>('corretores', () => query(collection(db, 'users'), where('role', '==', 'agent')))
  const nomeDaAgencia = (id: string) => agencias.dados?.find((a) => a.id === id)?.name ?? id
  const nomeDoCorretor = (uid?: string) => (uid ? corretores.dados?.find((u) => u.id === uid)?.name ?? '…' : '—')

  return (
    <Pagina titulo="Imóveis" sub="Todos os imóveis das imobiliárias. A ficha completa mora no pipeline."
      acoes={
        <select value={agencia} onChange={(e) => setAgencia(e.target.value)} className="campo w-64">
          <option value="">Todas as imobiliárias</option>
          {agencias.dados?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      }>
      <div className="space-y-6">
        <NovoImovel agencias={(agencias.dados ?? []).filter((a) => a.active)} />
        <Estado r={imoveis}>
          <ListaDeImoveis imoveis={imoveis.dados ?? []} base="/admin/properties"
            nomeDaAgencia={nomeDaAgencia} nomeDoCorretor={nomeDoCorretor} />
        </Estado>
      </div>
    </Pagina>
  )
}

function NovoImovel({ agencias }: { agencias: Agency[] }) {
  const { executar, ocupado, erro } = useAcao()
  const [aberto, setAberto] = useState(false)
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget, f = new FormData(form), s = (k: string) => String(f.get(k) ?? '')
    const ok = await executar(() => criarImovel(db, s('agencyId'), {
      title: s('title'), developmentName: s('developmentName'), address: s('address'),
      externalListingUrl: s('externalListingUrl'), pipelineUnitId: s('pipelineUnitId'),
    }))
    if (ok) { form.reset(); setAberto(false) }
  }
  if (!aberto) return <button className="btn" onClick={() => setAberto(true)}>Cadastrar imóvel</button>
  return (
    <Cartao titulo="Novo imóvel">
      <form onSubmit={enviar} className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">Imobiliária
          <select name="agencyId" required className="campo mt-1">
            <option value="">Escolha…</option>
            {agencias.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="text-sm">Título<input name="title" required className="campo mt-1" /></label>
        <label className="text-sm">Empreendimento<input name="developmentName" className="campo mt-1" /></label>
        <label className="text-sm">Endereço<input name="address" className="campo mt-1" /></label>
        <label className="text-sm">Link do anúncio<input name="externalListingUrl" type="url" className="campo mt-1" /></label>
        <label className="text-sm">Id no pipeline
          <input name="pipelineUnitId" placeholder="monte-dos-cedros-37" className="campo mt-1" />
        </label>
        <div className="flex gap-2 md:col-span-2">
          <button disabled={ocupado} className="btn-primario">Cadastrar</button>
          <button type="button" className="btn" onClick={() => setAberto(false)}>Cancelar</button>
        </div>
        {erro && <div className="md:col-span-2"><Aviso>{erro}</Aviso></div>}
      </form>
    </Cartao>
  )
}
