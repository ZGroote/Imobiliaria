'use client'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signOut, type User as FbUser } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from './firebase.ts'
import { lerConvite } from './convite.ts'
import { comId, type Invite, type User } from './types.ts'

// A sessão = login do Auth + users/{uid} AO VIVO. Desativar alguém vale na hora (D3).
export type Sessao =
  | { tipo: 'carregando' }
  | { tipo: 'fora' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'sem-verificacao'; user: FbUser }                // sem users/{uid}, e-mail não verificado
  | { tipo: 'convite'; user: FbUser; convite: Invite }       // verificado, com convite
  | { tipo: 'sem-acesso'; user: FbUser }                     // verificado, sem convite
  | { tipo: 'inativo'; user: FbUser; perfil: User }
  | { tipo: 'ativo'; user: FbUser; perfil: User }

const Ctx = createContext<{ sessao: Sessao; reavaliar: () => Promise<void> }>({
  sessao: { tipo: 'carregando' }, reavaliar: async () => {},
})

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FbUser | null | undefined>(undefined)
  const [sessao, setSessao] = useState<Sessao>({ tipo: 'carregando' })
  const [versao, setVersao] = useState(0)

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  useEffect(() => {
    if (user === undefined) return
    if (user === null) { setSessao({ tipo: 'fora' }); return }
    setSessao({ tipo: 'carregando' })
    return onSnapshot(doc(db, 'users', user.uid), async (s) => {
      if (s.exists()) {
        const perfil = comId<User>(s)
        setSessao({ tipo: perfil.active ? 'ativo' : 'inativo', user, perfil })
        return
      }
      if (!user.emailVerified) { setSessao({ tipo: 'sem-verificacao', user }); return }
      try {
        const convite = await lerConvite(db, user.email!)
        setSessao(convite ? { tipo: 'convite', user, convite } : { tipo: 'sem-acesso', user })
      } catch (e) {
        setSessao({ tipo: 'erro', mensagem: (e as Error).message })
      }
    }, (e) => setSessao({ tipo: 'erro', mensagem: e.message }))
  }, [user, versao])

  // Depois de clicar no link de verificação: o token só traz email_verified renovado.
  const reavaliar = useCallback(async () => {
    if (!auth.currentUser) return
    await auth.currentUser.reload()
    await auth.currentUser.getIdToken(true)
    setUser(auth.currentUser)
    setVersao((v) => v + 1)
  }, [])

  return <Ctx.Provider value={{ sessao, reavaliar }}>{children}</Ctx.Provider>
}

export const useSessao = () => useContext(Ctx)
export const sair = () => signOut(auth)
