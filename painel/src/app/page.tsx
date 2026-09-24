'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { EstadoDaConta } from '@/components/EstadoDaConta'
import { sair, useSessao } from '@/lib/session'
import { ROTULO_PAPEL } from '@/lib/types'

export default function Inicio() {
  const { sessao } = useSessao()
  const router = useRouter()
  useEffect(() => { if (sessao.tipo === 'fora') router.replace('/login') }, [sessao, router])

  if (sessao.tipo === 'carregando' || sessao.tipo === 'fora') return <p className="p-8 text-sm text-slate-500">Carregando…</p>
  if (sessao.tipo !== 'ativo') return <EstadoDaConta sessao={sessao} />
  return (
    <main className="p-8">
      <p>{sessao.perfil.name} · {ROTULO_PAPEL[sessao.perfil.role]}</p>
      <button onClick={sair} className="btn mt-4">Sair</button>
    </main>
  )
}
