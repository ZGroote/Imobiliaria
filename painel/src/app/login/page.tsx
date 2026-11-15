'use client'
import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useSessao } from '@/lib/session'
import { mensagemDoAuth } from '@/lib/erros'
import { enviarVerificacaoEmail } from '@/lib/verificacaoEmail'
import AtalhosDev from '@/components/AtalhosDev'   // na build de produção vira Nada (next.config.ts)
import { useIdioma, SeletorIdioma } from '@/components/Idioma'

export default function Login() {
  const { t: tr, idioma } = useIdioma()

  const { sessao } = useSessao()
  const router = useRouter()
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [email, setEmail] = useState('')
  const [aviso, setAviso] = useState('')

  async function recuperar() {
    setErro(''); setAviso('')
    if (!email.trim()) { setErro(tr("Informe seu e-mail para recuperar a senha.")); return }
    setOcupado(true)
    auth.languageCode = idioma
    try { await sendPasswordResetEmail(auth, email.trim().toLowerCase()); setAviso(tr("Enviamos um link para redefinir sua senha. Confira também o spam.")) }
    catch (e) { setErro(tr(mensagemDoAuth(e))) } finally { setOcupado(false) }
  }

  useEffect(() => {
    if (sessao.tipo !== 'fora' && sessao.tipo !== 'carregando') router.replace('/')
  }, [sessao, router])

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const email = String(f.get('email')).trim().toLowerCase(), senha = String(f.get('senha'))
    auth.languageCode = idioma
    setOcupado(true); setErro('')
    try {
      if (modo === 'entrar') await signInWithEmailAndPassword(auth, email, senha)
      else await enviarVerificacaoEmail((await createUserWithEmailAndPassword(auth, email, senha)).user, idioma)
    } catch (e) {
      setErro(tr(mensagemDoAuth(e)))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <main className="login-frame">
      <section className="login-intro" aria-label="Conecta Imóveis 3D">
        <img className="brand-logo" src="/brand/logo-conecta.webp" alt="Conecta Imóveis 3D" width="190" height="60" />
        <div><p className="brand-kicker mb-4">{tr("Seu empreendimento, conectado")}</p><h2>{tr("Da primeira visita à")}{' '}<em>{tr("próxima venda.")}</em></h2>
          <p className="mt-6 max-w-md text-slate-600">{tr("Empreendimentos, equipe, links de apresentação e resultados em um só lugar.")}</p></div>
        <p className="mt-6 text-xs text-slate-500">Conecta Imóveis 3D</p>
      </section>
      <section className="login-form">
      <div className="mb-8"><SeletorIdioma /></div>
      <h1 className="text-lg font-semibold">{modo === 'entrar' ? tr("Entrar no painel") : tr("Primeiro acesso")}</h1>
      {modo === 'criar' && (
        <p className="mt-2 text-sm text-slate-600">{tr("Use o e-mail em que você recebeu o convite. Depois de criar a senha, confirme o e-mail pelo link.")}</p>
      )}
      <form onSubmit={enviar} className="mt-6 space-y-4">
        <label className="block text-sm">{tr("E-mail")}<input name="email" type="email" required autoComplete="email" className="campo mt-1" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="block text-sm">{tr("Senha")}<input name="senha" type="password" required minLength={6}
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} className="campo mt-1" />
        </label>
        {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
        <button disabled={ocupado} className="btn-primario w-full">
          {modo === 'entrar' ? tr("Entrar") : tr("Criar acesso")}
        </button>
      </form>
      {modo === 'entrar' && <button type="button" className="mt-4 block text-sm text-sky-700 underline" disabled={ocupado} onClick={recuperar}>{tr("Recuperar senha")}</button>}
      {aviso && <p role="status" className="mt-3 text-sm text-emerald-700">{aviso}</p>}
      <button onClick={() => { setModo(modo === 'entrar' ? 'criar' : 'entrar'); setErro('') }}
        className="mt-4 text-sm text-slate-600 underline">
        {modo === 'entrar' ? tr("Primeiro acesso (recebi um convite)") : tr("Já tenho acesso")}
      </button>
      <AtalhosDev />
      </section>
    </main>
  )
}
