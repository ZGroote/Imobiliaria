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
import { useCatalogoInterno } from '@/lib/useEquipe'
import { useColecao } from '@/lib/useFirestore'

export function NovaSolicitacaoInterna({ modo }: { modo: ProductionMode }) {
  const perfil = usePerfil()
  const router = useRouter()
  const cat = useCatalogoInterno()
  const { executar, ocupado, erro } = useAcao()
  const [agencyId, setAgencyId] = useState('')
  const imoveis = useColecao<Property>(agencyId ? `imoveis:${agencyId}` : null,
    () => query(collection(db, 'properties'), where('agencyId', '==', agencyId)))

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget), s = (k: string) => String(f.get(k) ?? '')
    let id = ''
    const ok = await executar(async () => {
      id = (await criarPedido(db, perfil.id, {
        agencyId, title: s('title'), productionMode: modo,
        propertyId: s('propertyId'), listingUrl: s('listingUrl'),
        priority: s('priority') as Request['priority'], notes: s('notes'),
      })).id
    })
    if (ok) router.push(`/admin/requests/view?id=${id}`)
  }

  return (
    <Pagina titulo={`Solicitar produção ${ROTULO_MODO_PRODUCAO[modo]}`}
      sub={modo === 'leve'
        ? 'Produção mais rápida e otimizada para web/mobile.'
        : 'Produção com mais acabamento e iluminação; pacote maior.'}>
      <Cartao>
        <form onSubmit={enviar} className="grid max-w-2xl gap-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            Produto desta solicitação: <strong>{ROTULO_MODO_PRODUCAO[modo]}</strong>.
            O modo fica travado depois que o pedido é criado.
          </div>
          <label className="text-sm">Imobiliária
            <select value={agencyId} onChange={(e) => setAgencyId(e.target.value)} required className="campo mt-1">
              <option value="">Escolha a imobiliária</option>
              {cat.agencias.filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Link do anúncio
            <input name="listingUrl" type="url" placeholder="https://" className="campo mt-1" />
          </label>
          <label className="text-sm">Título
            <input name="title" required placeholder="Tour do apartamento 42" className="campo mt-1" />
          </label>
          <label className="text-sm">Imóvel
            <select key={agencyId} name="propertyId" disabled={!agencyId} className="campo mt-1">
              <option value="">Imóvel ainda não cadastrado</option>
              {imoveis.dados?.filter((p) => p.status === 'active')
                .map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
          <label className="text-sm">Prioridade
            <select name="priority" defaultValue="normal" className="campo mt-1">
              <option value="low">Baixa</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
            </select>
          </label>
          <label className="text-sm">Observações
            <textarea name="notes" rows={4} className="campo mt-1"
              placeholder="Planta, medidas, prazo e outras instruções…" />
          </label>
          <div>
            <button disabled={ocupado || !agencyId} className="btn-primario">
              Criar solicitação {ROTULO_MODO_PRODUCAO[modo]}
            </button>
          </div>
          {erro && <Aviso>{erro}</Aviso>}
        </form>
      </Cartao>
    </Pagina>
  )
}
