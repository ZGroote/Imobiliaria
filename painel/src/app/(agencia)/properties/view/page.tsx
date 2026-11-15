'use client'
import { useIdioma } from '@/components/Idioma'

import { useState } from 'react'
import { doc } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { EditarImovel } from '@/components/CadastroImovel'
import { CorretorResponsavel, Dados, LinksPublicos } from '@/components/imovel'
import { HistoricoDePublicacoes, PublicacaoDoImovel } from '@/components/publicacao'
import { Aviso, Cartao, ComId, Estado } from '@/components/ui'
import { db } from '@/lib/firebase'
import { usePessoas } from '@/lib/usePessoas'
import { usePerfil } from '@/lib/session'
import { podeGerenciarImovel } from '@/lib/acesso'
import type { Property } from '@/lib/types'
import { useDoc } from '@/lib/useFirestore'

export default function VerImovel() {
  return <ComId>{(id) => <Imovel id={id} />}</ComId>
}

function Imovel({ id }: { id: string }) {
  const { t: tr } = useIdioma()

  const perfil = usePerfil()
  const gerente = perfil.role === 'agency_manager'
  const r = useDoc<Property>(`imovel:${id}`, () => doc(db, 'properties', id))
  const { pessoas, nome } = usePessoas(perfil.agencyId, gerente)
  const p = r.dado
  const [editando, setEditando] = useState(false)
  const cadastro = !!p && podeGerenciarImovel(perfil, p.agencyId)
  if (p === null) return <Pagina titulo={tr("Imóvel")}><Aviso>{tr("Imóvel não encontrado.")}</Aviso></Pagina>
  return (
    <Pagina titulo={p?.title ?? tr("Imóvel")}
      acoes={cadastro && !editando && <button className="btn" onClick={() => setEditando(true)}>{tr("Editar")}</button>}>
      <Estado r={r}>
        {p && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {gerente && <a className="btn" href={'/properties/units?id='+encodeURIComponent(p.id)}>{tr("Preços e vendas das unidades")}</a>}
            <p className="text-sm text-slate-500 lg:col-span-2">{tr("Informações, plantas e publicação são configuradas pela equipe Conecta.")}</p>
            <PublicacaoDoImovel p={p} />
            <LinksPublicos p={p} />
            {cadastro && editando ? <EditarImovel p={p} fechar={() => setEditando(false)} /> : <Dados p={p} />}
            <Cartao titulo={tr("Corretor responsável")}><p className="text-sm">{nome(p.assignedAgentId, perfil.id)}</p></Cartao>
            <HistoricoDePublicacoes p={p} interno={false} pessoa={() => 'Equipe interna'} basePedido="/requests" />
          </div>
        )}
      </Estado>
    </Pagina>
  )
}
