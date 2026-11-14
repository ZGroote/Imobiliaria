'use client'
import { useIdioma } from '@/components/Idioma'

import { collection, doc, query, where } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { Portao } from '@/components/Portao'
import { LinhaConvite, NovoConvite } from '@/components/convites'
import { Cartao, Estado, Selo, Tabela, Td, Vazio } from '@/components/ui'
import { db } from '@/lib/firebase'
import { usePerfil } from '@/lib/session'
import { ROTULO_PAPEL, type Agency, type Invite, type User } from '@/lib/types'
import { useColecao, useDoc } from '@/lib/useFirestore'

export default function Equipe() {
  return <Portao papeis={['agency_manager']}>{() => <Conteudo />}</Portao>
}

function Conteudo() {
  const { t: tr } = useIdioma()

  const perfil = usePerfil()
  const agencia = useDoc<Agency>(`agencia:${perfil.agencyId}`, () => doc(db, 'agencies', perfil.agencyId!))
  const r = useColecao<User>(`equipe:${perfil.agencyId}`,
    () => query(collection(db, 'users'), where('agencyId', '==', perfil.agencyId)))
  const convites = useColecao<Invite & { id: string }>(`convites:${perfil.agencyId}`,
    () => query(collection(db, 'invites'), where('agencyId', '==', perfil.agencyId), where('role', '==', 'agent')))
  return (
    <Pagina titulo={tr("Equipe")} sub={tr("Convide corretores para sua imobiliária. Cada pessoa cria a própria senha no primeiro acesso.")}>
      <div className="space-y-6">
        <NovoConvite agencias={agencia.dado ? [agencia.dado] : []} />
        <Cartao titulo={tr("Convites pendentes")}>
          <Estado r={convites}>
            {convites.dados?.length ? (
              <Tabela cabecalho={[tr("E-mail"), tr("Nome"), tr("Papel"), tr("Criado"), '']}>
                {convites.dados.map((c) => <LinhaConvite key={c.id} c={c} />)}
              </Tabela>
            ) : <Vazio>{tr("Nenhum convite pendente.")}</Vazio>}
          </Estado>
        </Cartao>
        <Cartao titulo={tr("Pessoas da equipe")}>
          <Estado r={r}>
            <Tabela cabecalho={[tr("Nome"), tr("E-mail"), tr("Papel"), tr("Situação")]}>
              {(r.dados ?? []).map((u) => (
                <tr key={u.id}>
                  <Td>{u.name}</Td><Td>{u.email}</Td><Td>{tr(ROTULO_PAPEL[u.role])}</Td>
                  <Td>{u.active ? <Selo tom="verde">{tr("Ativo")}</Selo> : <Selo>{tr("Desativado")}</Selo>}</Td>
                </tr>
              ))}
            </Tabela>
          </Estado>
        </Cartao>
      </div>
    </Pagina>
  )
}
