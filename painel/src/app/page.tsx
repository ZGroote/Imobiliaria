'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { EstadoDaConta } from '@/components/EstadoDaConta'
import { inicioDoPapel } from '@/lib/acesso'
import { useSessao } from '@/lib/session'

// A raiz só distribui: login, tela de estado da conta, ou a área do papel.
export default function Inicio() {
  const { sessao } = useSessao()
  const router = useRouter()
  useEffect(() => {
    if (sessao.tipo === 'fora') router.replace('/login')
    if (sessao.tipo === 'ativo') router.replace(inicioDoPapel(sessao.perfil.role))
  }, [sessao, router])

  if (sessao.tipo === 'carregando' || sessao.tipo === 'fora' || sessao.tipo === 'ativo') {
    return <p className="p-8 text-sm text-slate-500">Carregando…</p>
  }
  return <EstadoDaConta sessao={sessao} />
}
