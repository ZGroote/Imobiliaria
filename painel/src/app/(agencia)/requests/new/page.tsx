'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, where } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { Aviso, Cartao, useAcao } from '@/components/ui'
import { db } from '@/lib/firebase'
import { criarPedido } from '@/lib/pedidos'
import { usePerfil } from '@/lib/session'
import { ROTULO_MODO_PRODUCAO, type ProductionMode, type Property, type Request } from '@/lib/types'
import { useColecao } from '@/lib/useFirestore'

export default function NovaSolicitacao() {
  const perfil = usePerfil()
  const router = useRouter()
  const { executar, ocupado, erro } = useAcao()
  const [modo, setModo] = useState<ProductionMode | ''>('')
  const imoveis = useColecao<Property>(`imoveis:${perfil.agencyId}`,
    () => query(collection(db, 'properties'), where('agencyId', '==', perfil.agencyId)))

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget), s = (k: string) => String(f.get(k) ?? '')
    let id = ''
    const ok = await executar(async () => {
      id = (await criarPedido(db, perfil.id, {
        agencyId: perfil.agencyId!, title: s('title'), productionMode: modo as ProductionMode,
        propertyId: s('propertyId'), listingUrl: s('listingUrl'),
        priority: s('priority') as Request['priority'], notes: s('notes'),
      })).id
    })
    if (ok) router.push(`/requests/view?id=${id}`)
  }

  return (
    <Pagina titulo="Nova solicitação" sub="Peça a produção do tour 3D de um imóvel. A equipe confere os materiais e avisa.">
      <Cartao>
        <form onSubmit={enviar} className="grid max-w-2xl gap-4">
          <div>
            <p className="mb-2 text-sm font-medium">Tipo de produção</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['leve', 'premium'] as ProductionMode[]).map((m) => (
                <button key={m} type="button" onClick={() => setModo(m)}
                  className={modo === m ? 'btn-primario text-left' : 'btn text-left'}>
                  <span className="block font-semibold">{ROTULO_MODO_PRODUCAO[m]}</span>
                  <span className="block text-xs font-normal opacity-80">
                    {m === 'leve' ? 'Mais rápida e otimizada para web/mobile.' : 'Mais acabamento e iluminação; pacote maior.'}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <label className="text-sm">Título<input name="title" required placeholder="Tour do apartamento 42"
            className="campo mt-1" /></label>
          <label className="text-sm">Imóvel
            <select name="propertyId" className="campo mt-1">
              <option value="">Imóvel ainda não cadastrado</option>
              {imoveis.dados?.filter((p) => p.status === 'active').map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
          <label className="text-sm">Link do anúncio<input name="listingUrl" type="url" placeholder="https://"
            className="campo mt-1" /></label>
          <label className="text-sm">Prioridade
            <select name="priority" defaultValue="normal" className="campo mt-1">
              <option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option>
            </select>
          </label>
          <label className="text-sm">Observações<textarea name="notes" rows={4} className="campo mt-1"
            placeholder="O que a equipe precisa saber: planta, medidas, prazo…" /></label>
          <div><button disabled={ocupado || !modo} className="btn-primario">Enviar solicitação</button></div>
          {erro && <Aviso>{erro}</Aviso>}
        </form>
      </Cartao>
    </Pagina>
  )
}
