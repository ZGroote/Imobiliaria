'use client'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { doc } from 'firebase/firestore'
import { AtivarAvisos, contagem, usePedidosNovos } from './AvisoDePedidos'
import { db } from '@/lib/firebase'
import { itemAtivo, menuDoPapel } from '@/lib/menu'
import { sair } from '@/lib/session'
import { interno, ROTULO_PAPEL, tipoDaConta, type Agency, type User } from '@/lib/types'
import { useDoc } from '@/lib/useFirestore'

export function AppShell({ perfil, children }: { perfil: User; children: ReactNode }) {
  const caminho = usePathname()
  // Ao vivo: se o admin troca o tipo da conta, o menu muda sem recarregar.
  const conta = useDoc<Agency>(perfil.agencyId ? `conta:${perfil.agencyId}` : null, () => doc(db, 'agencies', perfil.agencyId!))
  const itens = menuDoPapel(perfil.role, conta.dado ? tipoDaConta(conta.dado) : undefined)
  const ativo = itemAtivo(itens, caminho)
  const equipe = interno(perfil.role)
  const novos = usePedidosNovos(equipe)

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-slate-200 bg-white md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="px-5 py-4">
          <p className="text-sm font-semibold">{conta.dado?.name || 'Painel'}</p>
          <p className="text-xs text-slate-500">{perfil.name} · {ROTULO_PAPEL[perfil.role]}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
          {itens.map((i) => (
            <Link key={i.href} href={i.href} aria-current={ativo === i.href ? 'page' : undefined}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-sm ${ativo === i.href
                ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
              {i.rotulo}
              {i.href === '/admin/requests' && novos > 0 && (
                <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white"
                  title="Pedidos novos esperando aceite">{contagem(novos)}</span>
              )}
            </Link>
          ))}
          {equipe && <AtivarAvisos />}
          <button onClick={sair} className="rounded-md px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100">
            Sair
          </button>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

// Cabeçalho padrão das páginas: título, subtítulo opcional e ações à direita.
export function Pagina({ titulo, sub, acoes, children }:
  { titulo: string; sub?: ReactNode; acoes?: ReactNode; children: ReactNode }) {
  return (
    <main className="p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{titulo}</h1>
          {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
        </div>
        {acoes && <div className="flex gap-2">{acoes}</div>}
      </div>
      {children}
    </main>
  )
}
