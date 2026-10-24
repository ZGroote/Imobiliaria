'use client'
import { useState } from 'react'
import { collection, orderBy, query } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { Portao } from '@/components/Portao'
import { LinhaConvite, NovoConvite } from '@/components/convites'
import { Aviso, CarregarMais, Cartao, Estado, Selo, Tabela, Td, useAcao, Vazio } from '@/components/ui'
import { db } from '@/lib/firebase'
import { usuariosPorNome } from '@/lib/listas'
import { usePerfil } from '@/lib/session'
import { interno, ROTULO_PAPEL, type Agency, type Invite, type User, type UserRole } from '@/lib/types'
import { useColecao, usePaginada } from '@/lib/useFirestore'
import { definirAtivo, mudarPapel } from '@/lib/usuarios'

const PAPEIS = Object.keys(ROTULO_PAPEL) as UserRole[]

export default function Usuarios() {
  return <Portao papeis={['platform_admin']}>{() => <Conteudo />}</Portao>
}

function Conteudo() {
  const agencias = useColecao<Agency>('agencias', () => query(collection(db, 'agencies'), orderBy('name')))
  const usuarios = usePaginada<User>('usuarios', () => usuariosPorNome(db))
  // invites/ guarda só os pendentes: o aceite consome o convite (regras), então a coleção inteira
  // é a lista de pendentes, sem cruzar com os e-mails dos usuários.
  const convites = useColecao<Invite & { id: string }>('convites', () => collection(db, 'invites'))
  const nomeDa = (id?: string) => agencias.dados?.find((a) => a.id === id)?.name ?? '—'
  const abertos = convites.dados ?? []

  return (
    <Pagina titulo="Usuários e convites" sub="Todo acesso começa por um convite. Papel e imobiliária só mudam aqui.">
      <div className="space-y-6">
        <NovoConvite agencias={(agencias.dados ?? []).filter((a) => a.active)} />
        <Cartao titulo="Convites pendentes">
          <Estado r={convites}>
            {abertos.length ? (
              <Tabela cabecalho={['E-mail', 'Nome', 'Papel', 'Imobiliária', 'Criado', '']}>
                {abertos.map((c) => <LinhaConvite key={c.id} c={c} agencia={nomeDa(c.agencyId)} />)}
              </Tabela>
            ) : <Vazio>Nenhum convite pendente.</Vazio>}
          </Estado>
        </Cartao>
        <Cartao titulo="Usuários">
          <Estado r={usuarios}>
            <Tabela cabecalho={['Nome', 'E-mail', 'Papel e imobiliária', 'Situação']}>
              {(usuarios.dados ?? []).map((u) => <LinhaUsuario key={u.id} u={u} agencias={agencias.dados ?? []} />)}
            </Tabela>
          </Estado>
          <CarregarMais r={usuarios} />
        </Cartao>
      </div>
    </Pagina>
  )
}

function LinhaUsuario({ u, agencias }: { u: User; agencias: Agency[] }) {
  const perfil = usePerfil()
  const eu = u.id === perfil.id                     // não se tranca para fora por engano
  const { executar, ocupado, erro } = useAcao()
  const [role, setRole] = useState(u.role)
  const [agencyId, setAgencyId] = useState(u.agencyId ?? '')
  const mudou = role !== u.role || (!interno(role) && agencyId !== (u.agencyId ?? ''))
  return (
    <tr>
      <Td>{u.name}{eu && <span className="text-slate-400"> (você)</span>}</Td>
      <Td>{u.email}</Td>
      <Td>
        <div className="flex flex-wrap gap-2">
          <select disabled={eu} value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="campo w-auto">
            {PAPEIS.map((r) => <option key={r} value={r}>{ROTULO_PAPEL[r]}</option>)}
          </select>
          {!interno(role) && (
            <select disabled={eu} value={agencyId} onChange={(e) => setAgencyId(e.target.value)} className="campo w-auto">
              <option value="">Escolha…</option>
              {agencias.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          {mudou && <button disabled={ocupado} className="btn-primario text-xs"
            onClick={() => executar(() => mudarPapel(db, u.id, role, agencyId || undefined))}>Salvar</button>}
        </div>
        {erro && <Aviso>{erro}</Aviso>}
      </Td>
      <Td>
        <div className="flex items-center gap-2">
          {u.active ? <Selo tom="verde">Ativo</Selo> : <Selo>Desativado</Selo>}
          {!eu && <button disabled={ocupado} className="btn text-xs"
            onClick={() => executar(() => definirAtivo(db, u.id, !u.active))}>{u.active ? 'Desativar' : 'Reativar'}</button>}
        </div>
      </Td>
    </tr>
  )
}
