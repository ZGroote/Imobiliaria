'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { REGIAO_PADRAO, type Idioma, type Regiao } from '@/lib/regiao'
import en from '@/lib/en.json'
import type { Timestamp } from 'firebase/firestore'

const Ctx = createContext({ regiao: REGIAO_PADRAO, idioma: 'pt-BR' as Idioma, t: (s: string) => s,
  dataHora: (_s?: Timestamp | null): string => '', mudar: (_s: Idioma) => {}, configurar: (_r: Regiao) => {} })

export function IdiomaProvider({ children }: { children: ReactNode }) {
  const [regiao, configurar] = useState(REGIAO_PADRAO)
  const [escolha, setEscolha] = useState<Idioma | null>(null)
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('lang')
    let saved: string | null = null
    try { saved = localStorage.getItem('conecta.idioma') } catch {}
    if (param === 'en' || param === 'pt-BR') setEscolha(param)
    else if (saved === 'en' || saved === 'pt-BR') setEscolha(saved)
    else if (navigator.language.startsWith('en')) setEscolha('en')
  }, [])
  const idioma = escolha ?? regiao.locale
  useEffect(() => { document.documentElement.lang = idioma; document.documentElement.dataset.locale = idioma }, [idioma])
  const mudar = (next: Idioma) => { setEscolha(next); try { localStorage.setItem('conecta.idioma', next) } catch {} }
  const t = (s: string) => idioma === 'en' ? (en as Record<string, string>)[s] ?? s : s
  const dataHora = (value?: Timestamp | null) => value ? value.toDate().toLocaleString(idioma, { dateStyle: 'short', timeStyle: 'short', timeZone: regiao.timeZone }) : idioma === 'en' ? 'now' : 'agora'
  return <Ctx.Provider value={{ regiao, idioma, t, dataHora, mudar, configurar }}>{children}</Ctx.Provider>
}
export const useIdioma = () => useContext(Ctx)
export function RegiaoProvider({ regiao, children }: { regiao: Regiao; children: ReactNode }) {
  const contexto = useIdioma()
  return <Ctx.Provider value={{ ...contexto, regiao }}>{children}</Ctx.Provider>
}
export function SeletorIdioma() {
  const { idioma, mudar } = useIdioma()
  const [pronto, setPronto] = useState(false)
  useEffect(() => { setPronto(true) }, [])
  return <label className="flex items-center gap-2 text-xs text-slate-500">Idioma / Language
    <select className="campo max-w-40" disabled={!pronto} value={idioma} onChange={e => mudar(e.target.value as Idioma)} aria-label="Idioma / Language">
      <option value="pt-BR">Português</option><option value="en">English</option>
    </select>
  </label>
}
