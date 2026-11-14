'use client'
import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { auth, sessoesDeTeste } from '@/lib/firebase'
import { criarTrocaDeTeste, PAR_DE_TESTE, PAR_EMULADOR } from '@/lib/trocaPerfil'
import { mensagemDoAuth, mensagemDoFirestore } from '@/lib/erros'
import type { User } from '@/lib/types'
import { useIdioma } from './Idioma'

const par = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === '1' ? PAR_EMULADOR : PAR_DE_TESTE

export function TrocaPerfilTeste({ perfil }: { perfil: User }) {
  const elegivel = perfil.active && ((perfil.id === par.adminUid && perfil.role === 'platform_admin')
    || (perfil.id === par.gerenteUid && perfil.role === 'agency_manager'))
  return elegivel ? <Controles key={perfil.id} perfil={perfil} /> : null
}

function Controles({ perfil }: { perfil: User }) {
  const { t: tr } = useIdioma(), router = useRouter()
  const [pronto, setPronto] = useState(false), [temAdmin, setTemAdmin] = useState(false), [temGerente, setTemGerente] = useState(false)
  const [formulario, setFormulario] = useState(false), [senha, setSenha] = useState(''), [ocupado, setOcupado] = useState(false), [erro, setErro] = useState('')
  const admin = perfil.id === par.adminUid
  useEffect(() => {
    let atual = true
    const s = sessoesDeTeste()
    Promise.all([s.administrador.auth.authStateReady(), s.gerente.auth.authStateReady()]).then(() => {
      if (!atual) return
      setTemAdmin(s.administrador.auth.currentUser?.uid === par.adminUid)
      setTemGerente(s.gerente.auth.currentUser?.uid === par.gerenteUid)
      setPronto(true)
    }, () => { if (atual) setErro(tr('Não foi possível preparar a troca de contas.')) })
    return () => { atual = false }
  }, [])
  async function trocar(e?: FormEvent) {
    e?.preventDefault()
    if (ocupado) return
    if (admin && !temGerente && !formulario) { setFormulario(true); return }
    setOcupado(true); setErro('')
    const s = sessoesDeTeste(), troca = criarTrocaDeTeste({ principal: auth, administrador: s.administrador.auth, gerente: s.gerente.auth,
      bancoAdmin: s.administrador.db, bancoGerente: s.gerente.db, par })
    try {
      if (admin) await troca.paraGerente(senha)
      else await troca.paraAdmin()
      router.replace(admin ? '/dashboard' : '/admin')
    } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      setErro(tr(code.startsWith('auth/') ? mensagemDoAuth(e) : mensagemDoFirestore(e)))
      setOcupado(false)
    } finally { setSenha('') }
  }
  if (pronto && !admin && !temAdmin) return null
  return <section className="mx-3 mb-4 rounded-md border border-slate-200 p-3" aria-label={tr('Contas de teste')}>
    <p className="mb-2 text-xs text-slate-500">{tr('Contas de teste')}</p>
    {!formulario ? <button type="button" className="btn w-full" disabled={!pronto || ocupado} onClick={() => trocar()}>
      {ocupado ? tr('Trocando…') : admin ? tr('Trocar para gerente') : tr('Voltar ao administrador')}</button>
      : <form onSubmit={trocar} className="space-y-3">
        <p className="break-all text-xs">{par.gerenteEmail}</p>
        <label className="block text-xs">{tr('Senha da conta de gerente')}<input autoFocus type="password" required autoComplete="current-password" className="campo mt-1" value={senha} onChange={e => setSenha(e.target.value)} /></label>
        <p className="text-xs text-slate-500">{tr('Entre uma vez para alternar rapidamente nesta aba. A senha não é salva pelo painel.')}</p>
        <button className="btn-primario w-full" disabled={ocupado}>{ocupado ? tr('Trocando…') : tr('Entrar como gerente')}</button>
        <button className="btn w-full" type="button" disabled={ocupado} onClick={() => { setFormulario(false); setSenha(''); setErro('') }}>{tr('Cancelar')}</button>
      </form>}
    {erro && <p role="alert" className="mt-2 text-xs text-red-700">{erro}</p>}
  </section>
}
