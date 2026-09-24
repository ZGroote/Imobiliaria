'use client'
import { collection, query, where } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { Portao } from '@/components/Portao'
import { Estado, Selo, Tabela, Td } from '@/components/ui'
import { db } from '@/lib/firebase'
import { usePerfil } from '@/lib/session'
import { ROTULO_PAPEL, type User } from '@/lib/types'
import { useColecao } from '@/lib/useFirestore'

export default function Equipe() {
  return <Portao papeis={['agency_manager']}>{() => <Conteudo />}</Portao>
}

// Só leitura: convites e papéis são do administrador do painel (D3).
function Conteudo() {
  const perfil = usePerfil()
  const r = useColecao<User>(`equipe:${perfil.agencyId}`,
    () => query(collection(db, 'users'), where('agencyId', '==', perfil.agencyId)))
  return (
    <Pagina titulo="Equipe" sub="Para convidar alguém ou mudar um papel, fale com o administrador do painel.">
      <Estado r={r}>
        <Tabela cabecalho={['Nome', 'E-mail', 'Papel', 'Situação']}>
          {(r.dados ?? []).map((u) => (
            <tr key={u.id}>
              <Td>{u.name}</Td><Td>{u.email}</Td><Td>{ROTULO_PAPEL[u.role]}</Td>
              <Td>{u.active ? <Selo tom="verde">Ativo</Selo> : <Selo>Desativado</Selo>}</Td>
            </tr>
          ))}
        </Tabela>
      </Estado>
    </Pagina>
  )
}
