'use client'
import { useIdioma } from '@/components/Idioma'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, where } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { Aviso, Cartao, useAcao } from '@/components/ui'
import { db } from '@/lib/firebase'
import { criarPedido } from '@/lib/pedidos'
import { usePerfil } from '@/lib/session'
import { type Property, type Request } from '@/lib/types'
import { useCatalogoInterno } from '@/lib/useEquipe'
import { useColecao } from '@/lib/useFirestore'

export function NovaSolicitacaoInterna() {
  const { t: tr } = useIdioma()

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
        agencyId, title: s('title'),
        propertyId: s('propertyId'), listingUrl: s('listingUrl'),
        priority: s('priority') as Request['priority'], notes: s('notes'),
      })).id
    })
    if (ok) router.push(`/admin/requests/view?id=${id}`)
  }

  return (
    <Pagina titulo={tr('Nova solicitação')} sub={tr('Crie o pedido e envie os materiais pelo próprio painel.')}>
      <Cartao>
        <form onSubmit={enviar} className="grid max-w-2xl gap-4">
          <label className="text-sm">{tr("Imobiliária")}<select value={agencyId} onChange={(e) => setAgencyId(e.target.value)} required className="campo mt-1">
              <option value="">Escolha a imobiliária</option>
              {cat.agencias.filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="text-sm">{tr("Link do anúncio (opcional)")}<input name="listingUrl" type="url" placeholder="https://" className="campo mt-1" />
          </label>
          <label className="text-sm">{tr("Título")}<input name="title" required placeholder={tr("Tour do apartamento 42")} className="campo mt-1" />
          </label>
          <label className="text-sm">{tr("Imóvel")}<select key={agencyId} name="propertyId" disabled={!agencyId} className="campo mt-1">
              <option value="">{tr("Imóvel ainda não cadastrado")}</option>
              {imoveis.dados?.filter((p) => p.status === 'active')
                .map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
          <label className="text-sm">{tr("Prioridade")}<select name="priority" defaultValue="normal" className="campo mt-1">
              <option value="low">{tr("Baixa")}</option>
              <option value="normal">{tr("Normal")}</option>
              <option value="high">{tr("Alta")}</option>
            </select>
          </label>
          <label className="text-sm">{tr("Observações")}<textarea name="notes" rows={4} className="campo mt-1"
              placeholder={tr("Planta, medidas, prazo e outras instruções…")} />
          </label>
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">{tr('Não tem anúncio? Sem problema. Após criar a solicitação, envie plantas, fotos e documentos na próxima tela, pelo próprio painel.')}</p>
          <div>
            <button disabled={ocupado || !agencyId} className="btn-primario">{tr("Criar solicitação e anexar materiais")}
            </button>
          </div>
          {erro && <Aviso>{erro}</Aviso>}
        </form>
      </Cartao>
    </Pagina>
  )
}
