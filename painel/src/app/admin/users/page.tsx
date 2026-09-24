'use client'
import { useState, type FormEvent } from 'react'
import { collection, orderBy, query } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { Portao } from '@/components/Portao'
import { Aviso, Cartao, Estado, Selo, Tabela, Td, useAcao, Vazio } from '@/components/ui'
import { db } from '@/lib/firebase'
import { quando } from '@/lib/formato'
import { usePerfil } from '@/lib/session'
import { interno, ROTULO_PAPEL, type Agency, type Invite, type User, type UserRole } from '@/lib/types'
import { useColecao } from '@/lib/useFirestore'
import { cancelarConvite, convidar, definirAtivo, mudarPapel, pendentes } from '@/lib/usuarios'

const PAPEIS = Object.keys(ROTULO_PAPEL) as UserRole[]

export default function Usuarios() {
  return <Portao papeis={['platform_admin']}>{() => <Conteudo />}</Portao>
}

function Conteudo() {
  const agencias = useColecao<Agency>('agencias', () => query(collection(db, 'agencies'), orderBy('name')))
  const usuarios = useColecao<User>('usuarios', () => query(collection(db, 'users'), orderBy('name')))
  const convites = useColecao<Invite & { id: string }>('convites', () => collection(db, 'invites'))
  const nomeDa = (id?: string) => agencias.dados?.find((a) => a.id === id)?.name ?? '—'
  const abertos = pendentes(convites.dados ?? [], (usuarios.dados ?? []).map((u) => u.email))

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
        </Cartao>
      </div>
    </Pagina>
  )
}

function NovoConvite({ agencias }: { agencias: Agency[] }) {
  const perfil = usePerfil()
  const { executar, ocupado, erro } = useAcao()
  const [role, setRole] = useState<UserRole>('agent')
  const [ok, setOk] = useState('')
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget, f = new FormData(form)
    const agencyId = String(f.get('agencyId') ?? '')
    const email = String(f.get('email'))
    const feito = await executar(() => convidar(db, perfil.id, {
      email, name: String(f.get('name')), role, agencyId, agencyName: agencias.find((a) => a.id === agencyId)?.name,
    }))
    if (feito) { form.reset(); setOk(`Convite criado. Peça a ${email.trim()} que abra o painel e use "Primeiro acesso".`) }
  }
  return (
    <Cartao titulo="Convidar">
      <form onSubmit={enviar} className="flex flex-wrap items-end gap-3" onChange={() => setOk('')}>
        <label className="text-sm">E-mail<input name="email" type="email" required className="campo mt-1 w-64" /></label>
        <label className="text-sm">Nome<input name="name" required className="campo mt-1 w-48" /></label>
        <label className="text-sm">Papel
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="campo mt-1">
            {PAPEIS.map((r) => <option key={r} value={r}>{ROTULO_PAPEL[r]}</option>)}
          </select>
        </label>
        {!interno(role) && (
          <label className="text-sm">Imobiliária
            <select name="agencyId" required className="campo mt-1">
              <option value="">Escolha…</option>
              {agencias.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        )}
        <button disabled={ocupado} className="btn-primario">Convidar</button>
      </form>
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
      {ok && <p className="mt-3 text-sm text-emerald-700">{ok}</p>}
    </Cartao>
  )
}

function LinhaConvite({ c, agencia }: { c: Invite & { id: string }; agencia: string }) {
  const { executar, ocupado, erro } = useAcao()
  return (
    <tr>
      <Td>{c.email}</Td><Td>{c.name}</Td><Td>{ROTULO_PAPEL[c.role]}</Td>
      <Td>{c.agencyId ? agencia : '—'}</Td><Td>{quando(c.createdAt)}</Td>
      <Td>
        <button disabled={ocupado} className="btn text-xs" onClick={() => executar(() => cancelarConvite(db, c.email))}>
          Cancelar
        </button>
        {erro && <Aviso>{erro}</Aviso>}
      </Td>
    </tr>
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
