'use client'
import { useState, type FormEvent } from 'react'
import { Aviso, Cartao, Td, useAcao } from '@/components/ui'
import { db } from '@/lib/firebase'
import { usePerfil } from '@/lib/session'
import { interno, ROTULO_PAPEL, type Agency, type Invite, type UserRole } from '@/lib/types'
import { cancelarConvite, convidar } from '@/lib/usuarios'
import { emailDoConvite } from '@/lib/emailDoConvite'
import { useIdioma } from './Idioma'

const PAPEIS = Object.keys(ROTULO_PAPEL) as UserRole[]

export function NovoConvite({ agencias }: { agencias: Agency[] }) {
  const { t: tr, dataHora: quando } = useIdioma()

  const perfil = usePerfil()
  const gerente = perfil.role === 'agency_manager'
  const { idioma } = useIdioma()
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
      locale: agencias.find(a => a.id === agencyId)?.region?.locale ?? idioma,
    }))
    if (feito) { form.reset(); setOk(idioma === 'en' ? `Invitation created for ${email.trim()}. Check email delivery in the invitations list.` : `Convite criado para ${email.trim()}. Acompanhe o envio do e-mail na lista de convites.`) }
  }
  return (
    <Cartao titulo={gerente ? tr("Convidar corretor") : tr("Convidar")}>
      <form onSubmit={enviar} className="flex flex-wrap items-end gap-3" onChange={() => setOk('')}>
        <label className="min-w-0 max-w-full text-sm">{tr("E-mail")}<input name="email" type="email" required className="campo mt-1 w-64 max-w-full" /></label>
        <label className="min-w-0 max-w-full text-sm">{tr("Nome")}<input name="name" required className="campo mt-1 w-48 max-w-full" /></label>
        {!gerente && <>
          <label className="min-w-0 max-w-full text-sm">{tr("Papel")}<select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="campo mt-1">
              {PAPEIS.map((r) => <option key={r} value={r}>{tr(ROTULO_PAPEL[r])}</option>)}
            </select>
          </label>
          {!interno(role) && (
            <label className="min-w-0 max-w-full text-sm">{tr("Imobiliária")}<select name="agencyId" required className="campo mt-1">
                <option value="">{tr("Escolha…")}</option>
                {agencias.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          )}
        </>}
        <button disabled={ocupado} className="btn-primario">{gerente ? tr("Convidar corretor") : tr("Convidar")}</button>
      </form>
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
      {ok && <p role="status" className="mt-3 text-sm text-emerald-700">{ok}</p>}
    </Cartao>
  )
}

export function LinhaConvite({ c, agencia }: { c: Invite & { id: string }; agencia?: string }) {
  const { t: tr, dataHora: quando } = useIdioma()

  const { executar, ocupado, erro } = useAcao()
  return (
    <tr>
      <Td>{c.email}<p className="mt-1 text-xs text-slate-500">{tr(emailDoConvite(c))}</p></Td><Td>{c.name}</Td><Td>{tr(ROTULO_PAPEL[c.role])}</Td>
      {agencia !== undefined && <Td>{c.agencyId ? agencia : '—'}</Td>}<Td>{quando(c.createdAt)}</Td>
      <Td>
        <button disabled={ocupado} className="btn text-xs" onClick={() => executar(() => cancelarConvite(db, c.email))}>{tr("Cancelar")}</button>
        {erro && <Aviso>{erro}</Aviso>}
      </Td>
    </tr>
  )
}
