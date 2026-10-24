'use client'
import { useState, type FormEvent } from 'react'
import { Aviso, Cartao, Td, useAcao } from '@/components/ui'
import { db } from '@/lib/firebase'
import { quando } from '@/lib/formato'
import { usePerfil } from '@/lib/session'
import { interno, ROTULO_PAPEL, type Agency, type Invite, type UserRole } from '@/lib/types'
import { cancelarConvite, convidar } from '@/lib/usuarios'
import { emailDoConvite } from '@/lib/emailDoConvite'

const PAPEIS = Object.keys(ROTULO_PAPEL) as UserRole[]

export function NovoConvite({ agencias }: { agencias: Agency[] }) {
  const perfil = usePerfil()
  const gerente = perfil.role === 'agency_manager'
  const { executar, ocupado, erro } = useAcao()
  const [role, setRole] = useState<UserRole>('agent')
  const [ok, setOk] = useState('')
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget, f = new FormData(form)
    const agencyId = gerente ? perfil.agencyId : String(f.get('agencyId') ?? '')
    const email = String(f.get('email'))
    const feito = await executar(() => convidar(db, perfil.id, {
      email, name: String(f.get('name')), role: gerente ? 'agent' : role, agencyId,
      agencyName: agencias.find((a) => a.id === agencyId)?.name,
    }))
    if (feito) { form.reset(); setOk(`Convite criado para ${email.trim()}. Acompanhe o envio do e-mail na lista de convites.`) }
  }
  return (
    <Cartao titulo={gerente ? 'Convidar corretor' : 'Convidar'}>
      <form onSubmit={enviar} className="flex flex-wrap items-end gap-3" onChange={() => setOk('')}>
        <label className="text-sm">E-mail<input name="email" type="email" required className="campo mt-1 w-64" /></label>
        <label className="text-sm">Nome<input name="name" required className="campo mt-1 w-48" /></label>
        {!gerente && <>
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
        </>}
        <button disabled={ocupado} className="btn-primario">{gerente ? 'Convidar corretor' : 'Convidar'}</button>
      </form>
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
      {ok && <p role="status" className="mt-3 text-sm text-emerald-700">{ok}</p>}
    </Cartao>
  )
}

export function LinhaConvite({ c, agencia }: { c: Invite & { id: string }; agencia?: string }) {
  const { executar, ocupado, erro } = useAcao()
  return (
    <tr>
      <Td>{c.email}<p className="mt-1 text-xs text-slate-500">{emailDoConvite(c)}</p></Td><Td>{c.name}</Td><Td>{ROTULO_PAPEL[c.role]}</Td>
      {agencia !== undefined && <Td>{c.agencyId ? agencia : '—'}</Td>}<Td>{quando(c.createdAt)}</Td>
      <Td>
        <button disabled={ocupado} className="btn text-xs" onClick={() => executar(() => cancelarConvite(db, c.email))}>
          Cancelar
        </button>
        {erro && <Aviso>{erro}</Aviso>}
      </Td>
    </tr>
  )
}
