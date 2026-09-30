'use client'
import { useState, type FormEvent } from 'react'
import { doc } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { CorretorResponsavel, Dados, LinksPublicos, ROTULO_SITUACAO } from '@/components/imovel'
import { Aviso, Cartao, ComId, Estado, useAcao } from '@/components/ui'
import { db } from '@/lib/firebase'
import { editarImovel } from '@/lib/imoveis'
import { usePessoas } from '@/lib/usePessoas'
import { useCatalogoInterno } from '@/lib/useEquipe'
import { HistoricoDePublicacoes, ReverterPublicacao } from '@/components/publicacao'
import type { Agency, Property } from '@/lib/types'
import { useDoc } from '@/lib/useFirestore'

export default function VerImovelInterno() {
  return <ComId>{(id) => <Imovel id={id} />}</ComId>
}

function Imovel({ id }: { id: string }) {
  const r = useDoc<Property>(`imovel:${id}`, () => doc(db, 'properties', id))
  const p = r.dado
  const ag = useDoc<Agency>(p ? `agencia:${p.agencyId}` : null, () => doc(db, 'agencies', p!.agencyId))
  const { pessoas } = usePessoas(p?.agencyId, true)
  const cat = useCatalogoInterno()
  const [editando, setEditando] = useState(false)

  if (p === null) return <Pagina titulo="Imóvel"><Aviso>Imóvel não encontrado.</Aviso></Pagina>
  return (
    <Pagina titulo={p?.title ?? 'Imóvel'} sub={ag.dado?.name}
      acoes={p && !editando && <button className="btn" onClick={() => setEditando(true)}>Editar</button>}>
      <Estado r={r}>
        {p && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <a className="btn" href={'/imoveis/planta?id='+encodeURIComponent(p.id)}>Editar planta e versões</a>
            {editando ? <Editar p={p} fechar={() => setEditando(false)} /> : <Dados p={p} nomeDaAgencia={ag.dado?.name} />}
            <LinksPublicos p={p} />
            <CorretorResponsavel p={p} pessoas={pessoas} />
            <HistoricoDePublicacoes p={p} interno pessoa={cat.pessoa} basePedido="/admin/requests" />
            <ReverterPublicacao p={p} />
          </div>
        )}
      </Estado>
    </Pagina>
  )
}

function Editar({ p, fechar }: { p: Property; fechar: () => void }) {
  const { executar, ocupado, erro } = useAcao()
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget), s = (k: string) => String(f.get(k) ?? '')
    const ok = await executar(() => editarImovel(db, p.id, {
      title: s('title'), developmentName: s('developmentName'), address: s('address'),
      externalListingUrl: s('externalListingUrl'), pipelineUnitId: s('pipelineUnitId'),
      status: s('status') as Property['status'],
    }))
    if (ok) fechar()
  }
  return (
    <Cartao titulo="Editar dados">
      <form onSubmit={enviar} className="space-y-3">
        <label className="block text-sm">Título<input name="title" defaultValue={p.title} required className="campo mt-1" /></label>
        <label className="block text-sm">Empreendimento
          <input name="developmentName" defaultValue={p.developmentName} className="campo mt-1" /></label>
        <label className="block text-sm">Endereço<input name="address" defaultValue={p.address} className="campo mt-1" /></label>
        <label className="block text-sm">Link do anúncio
          <input name="externalListingUrl" type="url" defaultValue={p.externalListingUrl} className="campo mt-1" /></label>
        <label className="block text-sm">Id no pipeline
          <input name="pipelineUnitId" defaultValue={p.pipelineUnitId} className="campo mt-1" /></label>
        <label className="block text-sm">Situação
          <select name="status" defaultValue={p.status} className="campo mt-1">
            {Object.entries(ROTULO_SITUACAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button disabled={ocupado} className="btn-primario">Salvar</button>
          <button type="button" className="btn" onClick={fechar}>Cancelar</button>
        </div>
        {erro && <Aviso>{erro}</Aviso>}
      </form>
    </Cartao>
  )
}
