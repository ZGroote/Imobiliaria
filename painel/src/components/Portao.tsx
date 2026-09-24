'use client'
import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { EstadoDaConta } from './EstadoDaConta'
import { inicioDoPapel, pode } from '@/lib/acesso'
import { useSessao } from '@/lib/session'
import type { User, UserRole } from '@/lib/types'

// Só renderiza para quem está ativo e tem um dos papéis; os demais vão para o lugar certo.
export function Portao({ papeis, children }: { papeis: UserRole[]; children: (perfil: User) => ReactNode }) {
  const { sessao } = useSessao()
  const router = useRouter()
  const destino = sessao.tipo === 'fora' ? '/login'
    : sessao.tipo === 'ativo' && !pode(sessao.perfil.role, papeis) ? inicioDoPapel(sessao.perfil.role)
    : null
  useEffect(() => { if (destino) router.replace(destino) }, [destino, router])

  if (sessao.tipo === 'carregando' || sessao.tipo === 'fora' || destino) {
    return <p className="p-8 text-sm text-slate-500">Carregando…</p>
  }
  if (sessao.tipo !== 'ativo') return <EstadoDaConta sessao={sessao} />
  return <>{children(sessao.perfil)}</>
}
