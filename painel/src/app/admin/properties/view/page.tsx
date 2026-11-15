'use client'
import { useIdioma } from '@/components/Idioma'

import { useState } from 'react'
import { doc } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { EditarImovel } from '@/components/CadastroImovel'
import { CorretorResponsavel, Dados, LinksPublicos } from '@/components/imovel'
import { Aviso, ComId, Estado } from '@/components/ui'
import { db } from '@/lib/firebase'
import { podeGerenciarImovel } from '@/lib/acesso'
import { usePerfil } from '@/lib/session'
import { usePessoas } from '@/lib/usePessoas'
import { useCatalogoInterno } from '@/lib/useEquipe'
import { HistoricoDePublicacoes, PublicacaoDoImovel, ReverterPublicacao } from '@/components/publicacao'
import type { Agency, Property } from '@/lib/types'
import { useDoc } from '@/lib/useFirestore'

export default function VerImovelInterno() {
  return <ComId>{(id) => <Imovel id={id} />}</ComId>
}

function Imovel({ id }: { id: string }) {
  const { t: tr } = useIdioma()

  const perfil = usePerfil()
  const r = useDoc<Property>(`imovel:${id}`, () => doc(db, 'properties', id))
  const p = r.dado
  const ag = useDoc<Agency>(p ? `agencia:${p.agencyId}` : null, () => doc(db, 'agencies', p!.agencyId))
  const { pessoas } = usePessoas(p?.agencyId, true)
  const cat = useCatalogoInterno()
  const [editando, setEditando] = useState(false)
  const cadastro = !!p && podeGerenciarImovel(perfil, p.agencyId)

  if (p === null) return <Pagina titulo={tr("Imóvel")}><Aviso>{tr("Imóvel não encontrado.")}</Aviso></Pagina>
  return (
    <Pagina titulo={p?.title ?? tr("Imóvel")} sub={ag.dado?.name}
      acoes={cadastro && !editando && <button className="btn" onClick={() => setEditando(true)}>{tr("Editar")}</button>}>
      <Estado r={r}>
        {p && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <a className="btn" href={'/imoveis/planta?id='+encodeURIComponent(p.id)}>Editar planta e versões</a>
            {cadastro && <a className="btn" href={'/admin/properties/units?id='+encodeURIComponent(p.id)}>Unidades e disponibilidade do empreendimento</a>}
            {cadastro && editando ? <EditarImovel p={p} fechar={() => setEditando(false)} /> : <Dados p={p} nomeDaAgencia={ag.dado?.name} />}
            <PublicacaoDoImovel p={p} />
            <LinksPublicos p={p} />
            {cadastro && <CorretorResponsavel p={p} pessoas={pessoas} />}
            <HistoricoDePublicacoes p={p} interno pessoa={cat.pessoa} basePedido="/admin/requests" />
            <ReverterPublicacao p={p} />
          </div>
        )}
      </Estado>
    </Pagina>
  )
}
