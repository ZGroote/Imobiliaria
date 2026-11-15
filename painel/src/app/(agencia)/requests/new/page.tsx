'use client'
import { useIdioma } from '@/components/Idioma'

import { type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, where } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { Aviso, Cartao, useAcao } from '@/components/ui'
import { db } from '@/lib/firebase'
import { criarPedido } from '@/lib/pedidos'
import { usePerfil } from '@/lib/session'
import { type Property, type Request } from '@/lib/types'
import { useColecao } from '@/lib/useFirestore'

export default function NovaSolicitacao() {
  const { t: tr } = useIdioma()

  const perfil = usePerfil()
  const router = useRouter()
  const { executar, ocupado, erro } = useAcao()
  const imoveis = useColecao<Property>(`imoveis:${perfil.agencyId}`,
    () => query(collection(db, 'properties'), where('agencyId', '==', perfil.agencyId)))

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget), s = (k: string) => String(f.get(k) ?? '')
    let id = ''
    const ok = await executar(async () => {
      id = (await criarPedido(db, perfil.id, {
        agencyId: perfil.agencyId!, title: s('title'),
        propertyId: s('propertyId'), listingUrl: s('listingUrl'),
        priority: s('priority') as Request['priority'], notes: s('notes'),
      })).id
    })
    if (ok) router.push(`/requests/view?id=${id}`)
  }

  return (
    <Pagina titulo={tr("Nova solicitação")} sub={tr("Peça a produção do tour 3D de um imóvel. A equipe confere os materiais e avisa.")}>
      <Cartao>
        <form onSubmit={enviar} className="grid max-w-2xl gap-4">
          <label className="text-sm">{tr("Título")}<input name="title" required placeholder={tr("Tour do apartamento 42")}
            className="campo mt-1" /></label>
          <label className="text-sm">{tr("Imóvel")}<select name="propertyId" className="campo mt-1">
              <option value="">{tr("Imóvel ainda não cadastrado")}</option>
              {imoveis.dados?.filter((p) => p.status === 'active').map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
          <label className="text-sm">{tr("Link do anúncio (opcional)")}<input name="listingUrl" type="url" placeholder="https://"
            className="campo mt-1" /></label>
          <label className="text-sm">{tr("Prioridade")}<select name="priority" defaultValue="normal" className="campo mt-1">
              <option value="low">{tr("Baixa")}</option><option value="normal">{tr("Normal")}</option><option value="high">{tr("Alta")}</option>
            </select>
          </label>
          <label className="text-sm">{tr("Observações")}<textarea name="notes" rows={4} className="campo mt-1"
            placeholder="O que a equipe precisa saber: planta, medidas, prazo…" /></label>
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">{tr("Não tem anúncio? Sem problema. Após criar a solicitação, envie plantas, fotos e documentos na próxima tela, pelo próprio painel.")}</p>
          <div><button disabled={ocupado} className="btn-primario">{tr("Criar solicitação e anexar materiais")}</button></div>
          {erro && <Aviso>{erro}</Aviso>}
        </form>
      </Cartao>
    </Pagina>
  )
}
