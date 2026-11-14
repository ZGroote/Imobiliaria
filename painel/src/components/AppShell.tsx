'use client'
import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { itemAtivo, menuDoPapel } from '@/lib/menu'
import { sair } from '@/lib/session'
import { ROTULO_PAPEL, type User } from '@/lib/types'
import { SeletorIdioma, useIdioma } from './Idioma'
import { REGIAO_PADRAO } from '@/lib/regiao'
import { TrocaPerfilTeste } from './TrocaPerfilTeste'

export function AppShell({ perfil, children }: { perfil: User; children: ReactNode }) {
  const { t: tr } = useIdioma()

  const caminho = usePathname()
  const itens = menuDoPapel(perfil.role)
  const ativo = itemAtivo(itens, caminho)
  const [agencia, setAgencia] = useState('')
  const { configurar } = useIdioma()

  useEffect(() => {
    let atual = true
    configurar(REGIAO_PADRAO)
    setAgencia('')
    if (!perfil.agencyId) return
    getDoc(doc(db, 'agencies', perfil.agencyId)).then((s) => {
      if (!atual) return
      setAgencia(s.data()?.name ?? '')
      configurar(s.data()?.region ?? REGIAO_PADRAO)
    }, () => {})
    return () => { atual = false }
  }, [perfil.agencyId])

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-white focus:p-3">{tr("Pular para o conteúdo")}</a>
      <aside className="brand-sidebar border-b border-slate-200 md:sticky md:top-0 md:min-h-dvh md:w-64 md:shrink-0 md:self-start md:border-r md:border-b-0">
        <div className="px-5 py-4">
          <Link href={itens[0]?.href ?? '/'} aria-label={tr("Conecta Imóveis 3D — início")}><img className="brand-logo mb-6" src="/brand/logo-conecta.webp" alt="Conecta Imóveis 3D" width="190" height="60" /></Link>
          <p className="brand-kicker mb-2">{tr("Gestão de empreendimentos")}</p>
          <p className="text-sm font-semibold">{agencia || tr("Painel")}</p>
          <p className="text-xs text-slate-500">{perfil.name} · {tr(ROTULO_PAPEL[perfil.role])}</p>
        </div>
        <nav aria-label={tr("Menu principal")} className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
          {itens.map((i) => (
            <Link key={i.href} href={i.href} aria-current={ativo === i.href ? 'page' : undefined}
              className="brand-nav whitespace-nowrap rounded-md px-3 py-3 text-sm text-slate-700">
              {tr(i.rotulo)}
            </Link>
          ))}
          <button onClick={sair} className="rounded-md px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100">{tr("Sair")}</button>
        </nav>
        <TrocaPerfilTeste perfil={perfil} />
        <div className="px-5 pb-5"><SeletorIdioma /></div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

// Cabeçalho padrão das páginas: título, subtítulo opcional e ações à direita.
export function Pagina({ titulo, sub, acoes, children }:
  { titulo: string; sub?: ReactNode; acoes?: ReactNode; children: ReactNode }) {
  return (
    <main id="conteudo" className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{titulo}</h1>
          {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
        </div>
        {acoes && <div className="flex gap-2">{acoes}</div>}
      </div>
      {children}
    </main>
  )
}
