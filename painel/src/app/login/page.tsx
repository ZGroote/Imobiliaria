'use client'
import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useSessao } from '@/lib/session'
import { mensagemDoAuth } from '@/lib/erros'
import AtalhosDev from '@/components/AtalhosDev'   // na build de produção vira Nada (next.config.ts)

export default function Login() {
  const { sessao } = useSessao()
  const router = useRouter()
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    if (sessao.tipo !== 'fora' && sessao.tipo !== 'carregando') router.replace('/')
  }, [sessao, router])

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const email = String(f.get('email')).trim().toLowerCase(), senha = String(f.get('senha'))
    setOcupado(true); setErro('')
    try {
      if (modo === 'entrar') await signInWithEmailAndPassword(auth, email, senha)
      else await sendEmailVerification((await createUserWithEmailAndPassword(auth, email, senha)).user)
    } catch (e) {
      setErro(mensagemDoAuth(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <main className="mx-auto mt-24 max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-lg font-semibold">{modo === 'entrar' ? 'Entrar no painel' : 'Primeiro acesso'}</h1>
      {modo === 'criar' && (
        <p className="mt-2 text-sm text-slate-600">
          Use o e-mail em que você recebeu o convite. Depois de criar a senha, confirme o e-mail pelo link.
        </p>
      )}
      <form onSubmit={enviar} className="mt-6 space-y-4">
        <label className="block text-sm">E-mail
          <input name="email" type="email" required autoComplete="email" className="campo mt-1" />
        </label>
        <label className="block text-sm">Senha
          <input name="senha" type="password" required minLength={6}
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} className="campo mt-1" />
        </label>
        {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
        <button disabled={ocupado} className="btn-primario w-full">
          {modo === 'entrar' ? 'Entrar' : 'Criar acesso'}
        </button>
      </form>
      <button onClick={() => { setModo(modo === 'entrar' ? 'criar' : 'entrar'); setErro('') }}
        className="mt-4 text-sm text-slate-600 underline">
        {modo === 'entrar' ? 'Primeiro acesso (recebi um convite)' : 'Já tenho acesso'}
      </button>
      <AtalhosDev />
    </main>
  )
}
