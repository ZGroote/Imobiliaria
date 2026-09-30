'use client'
import {lazy, Suspense, type ReactNode} from 'react'
import {usePathname} from 'next/navigation'

// O capturador local não inicializa Auth nem listeners do Firestore.
const Sessao=lazy(()=>import('@/lib/session').then(m=>({default:m.SessaoProvider})))
export function SessaoDaRota({children}:{children:ReactNode}){
  const path=usePathname()
  if(path==='/capturador'||path==='/capturador/') return <>{children}</>
  return <Suspense fallback={<p className="p-8">Carregando sessão…</p>}><Sessao>{children}</Sessao></Suspense>
}
