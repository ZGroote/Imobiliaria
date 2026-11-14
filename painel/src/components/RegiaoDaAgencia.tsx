'use client'
import { useIdioma } from '@/components/Idioma'

import { useState, type FormEvent } from 'react'
import { Cartao, Aviso, useAcao } from './ui'
import { db } from '@/lib/firebase'
import { atualizarAgencia } from '@/lib/agencias'
import { REGIAO_PADRAO, REGIOES, type Regiao } from '@/lib/regiao'
import type { Agency } from '@/lib/types'

export function RegiaoDaAgencia({ agencia }: { agencia: Agency }) {
  const { t: tr } = useIdioma()

  const [regiao, setRegiao] = useState<Regiao>(agencia.region ?? REGIAO_PADRAO)
  const [salvo, setSalvo] = useState(false)
  const { executar, ocupado, erro } = useAcao()
  async function submit(e: FormEvent) {
    e.preventDefault()
    setSalvo(await executar(() => atualizarAgencia(db, agencia.id, { region: regiao })))
  }
  return <Cartao titulo={tr("Configuração regional")}><p className="mb-4 text-sm text-slate-500">{tr('A moeda define como os preços são apresentados. Alterar a região não converte os valores cadastrados.')}</p><form onSubmit={submit} onChange={() => setSalvo(false)} className="grid gap-4 sm:grid-cols-2">
    <label className="text-sm">{tr("País")}<select className="campo mt-1" value={regiao.country} onChange={e => setRegiao(REGIOES[e.target.value])}>
      <option value="BR">Brasil</option><option value="US">United States</option><option value="GB">United Kingdom</option><option value="CA">Canada</option><option value="AU">Australia</option><option value="PT">Portugal</option>
    </select></label>
    <label className="text-sm">{tr("Idioma")}<select className="campo mt-1" value={regiao.locale} onChange={e => setRegiao({ ...regiao, locale: e.target.value as Regiao['locale'] })}><option value="pt-BR">Português</option><option value="en">English</option></select></label>
    <label className="text-sm">{tr("Moeda")}<select className="campo mt-1" value={regiao.currency} onChange={e => setRegiao({ ...regiao, currency: e.target.value })}>
      {['BRL','USD','GBP','CAD','AUD','EUR'].map(c => <option key={c}>{c}</option>)}
    </select></label>
    <label className="text-sm">{tr("Fuso horário")}<input className="campo mt-1" required value={regiao.timeZone} onChange={e => setRegiao({ ...regiao, timeZone: e.target.value })} placeholder="America/New_York" /></label>
    <div><button className="btn-primario" disabled={ocupado}>{tr("Salvar região")}</button></div>
    {erro && <Aviso>{erro}</Aviso>}{salvo && <p role="status">{tr("Região salva.")}</p>}
  </form></Cartao>
}
