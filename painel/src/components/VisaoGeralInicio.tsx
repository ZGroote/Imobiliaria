'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { auth } from '@/lib/firebase'
import { usePerfil } from '@/lib/session'
import { baseRastreabilidade, criarClienteRastreabilidade, type TrackingReport } from '@/lib/rastreabilidade'
import { duracaoInicio, resumoInicio } from '@/lib/resumoInicio'
import type { Property } from '@/lib/types'
import { useIdioma } from './Idioma'
import { Aviso, Carregando, Cartao, Tabela, Td } from './ui'
import { ApartamentosInteresse } from './ApartamentosInteresse'

type Linha = { id: string; relatorio?: TrackingReport; erro?: string }

export function VisaoGeralInicio({ imoveis, temMais, selecionar }: {
  imoveis: Property[]; temMais: boolean; selecionar: (id: string) => void
}) {
  const perfil = usePerfil()
  // Desmonta os dados do escopo anterior antes de consultar outra conta ou imobiliária.
  return <Resumo key={`${perfil.id}:${perfil.role}:${perfil.agencyId}`} imoveis={imoveis} temMais={temMais} selecionar={selecionar} />
}

function Resumo({ imoveis, temMais, selecionar }: { imoveis: Property[]; temMais: boolean; selecionar: (id: string) => void }) {
  const { t, idioma, regiao } = useIdioma(), perfil = usePerfil()
  const [dias, setDias] = useState(30), [revisao, setRevisao] = useState(0)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [resultado, setResultado] = useState<{ chave: string; linhas: Linha[]; periodo: string }>({ chave: '', linhas: [], periodo: '' })
  const ativos = imoveis.filter(p => p.status === 'active' && p.agencyId === perfil.agencyId)
  const ids = ativos.map(p => p.id).sort().join(',')
  const chave = `${ids}:${dias}:${revisao}`
  const config = useMemo(() => {
    try { return { base: baseRastreabilidade(process.env.NEXT_PUBLIC_TRACKING_API_URL), erro: false } }
    catch { return { base: null, erro: true } }
  }, [])
  useEffect(() => {
    if (!config.base) return
    const controller = new AbortController()
    const api = criarClienteRastreabilidade({ baseUrl: config.base, getToken: async () =>
      auth.currentUser?.uid === perfil.id ? auth.currentUser.getIdToken() : '' })
    const to = new Date(), from = new Date(to.getTime() - dias * 86400000)
    const periodo = { from: from.toISOString(), to: to.toISOString() }
    const pendentes = ids ? ids.split(',') : [], linhas: Linha[] = []
    // Limita as consultas simultâneas ao serviço de relatórios.
    async function consultar() {
      while (pendentes.length && !controller.signal.aborted) {
        const id = pendentes.shift()!
        try {
          const relatorio = await api.relatorio({ propertyId: id, agencyId: perfil.agencyId!,
            ...(perfil.role === 'agent' ? { brokerUid: perfil.id } : {}) }, periodo, controller.signal)
          linhas.push({ id, relatorio })
        } catch (e) { linhas.push({ id, erro: (e as Error).message }) }
      }
    }
    Promise.all(Array.from({ length: Math.min(3, pendentes.length) }, consultar)).then(() => {
      if (!controller.signal.aborted) setResultado({ chave, linhas, periodo: `${periodo.from}|${periodo.to}` })
    })
    return () => controller.abort()
  }, [config.base, chave, ids, dias, perfil.id, perfil.role, perfil.agencyId])

  if (!config.base) return <Cartao titulo={t('Visão geral de interesse')}><p className="text-sm text-slate-600">{t(config.erro
    ? 'A rastreabilidade precisa de uma configuração válida. Avise a equipe responsável.'
    : 'Os links individuais e os relatórios estarão disponíveis quando a equipe ativar a rastreabilidade.')}</p></Cartao>
  const carregando = resultado.chave !== chave
  const linhas = carregando ? [] : resultado.linhas
  const relatorios = linhas.flatMap(l => l.relatorio ? [l.relatorio] : [])
  const resumo = resumoInicio(relatorios), falhas = linhas.filter(l => l.erro)
  const ranking = linhas.filter(l => l.relatorio).sort((a, b) => b.relatorio!.summary.sessions - a.relatorio!.summary.sessions
    || b.relatorio!.summary.activeMs - a.relatorio!.summary.activeMs || a.id.localeCompare(b.id))
  const nomes = new Map(ativos.map(p => [p.id, p.title]))
  const n = (v: number) => v.toLocaleString(idioma)
  const valor = (v: number) => carregando ? '…' : relatorios.length ? n(v) : '—'
  const maior = Math.max(1, ...relatorios.map(r => r.summary.sessions))
  const retornos = ranking.filter(l => l.relatorio!.summary.ownReturns > 0)
    .sort((a, b) => b.relatorio!.summary.ownReturns - a.relatorio!.summary.ownReturns).slice(0, 3)
  const abrir = (id: string) => <a href="#detalhe-empreendimento" className="text-sm font-medium text-sky-700 hover:underline" onClick={() => selecionar(id)}>{t('Ver detalhes')}</a>
  return <section aria-label={t('Visão geral de interesse')} className="mb-8 space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-xl font-semibold">{t('Visão geral de interesse')}</h2>
        <p className="mt-1 text-sm text-slate-500">{t(perfil.role === 'agent' ? 'Desempenho dos seus links nos empreendimentos ativos.' : 'Desempenho dos links da imobiliária nos empreendimentos ativos.')}</p></div>
      <div className="flex items-end gap-2"><label className="text-xs text-slate-500">{t('Período')}<select className="campo mt-1" value={dias} onChange={e => setDias(Number(e.target.value))}>
        <option value={7}>{t('Últimos 7 dias')}</option><option value={30}>{t('Últimos 30 dias')}</option>
      </select></label><button className="btn" disabled={carregando} onClick={() => setRevisao(v => v + 1)}>{t('Atualizar')}</button></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        [t('Sessões iniciadas'), valor(resumo.sessoes), t('Acessos com coleta autorizada')],
        [t('Visualizações de páginas'), valor(resumo.visualizacoes), t('Tour e maquete')],
        [t('Tempo ativo por sessão'), carregando ? '…' : relatorios.length ? duracaoInicio(resumo.mediaMs) : '—', t('Média ponderada pelas sessões')],
        [t('Retornos reconhecidos'), valor(resumo.retornos), t('Sessões classificadas como retorno')],
      ].map(([rotulo, numero, sub]) => <div key={rotulo} className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-500">{rotulo}</p><p className="mt-2 text-3xl font-semibold tracking-tight">{numero}</p><p className="mt-2 text-xs text-slate-500">{sub}</p>
      </div>)}
    </div>
    {carregando ? <Carregando /> : <>
      {(temMais || resumo.parcial || falhas.length > 0) && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{t('Visão parcial. Os totais e o ranking consideram apenas os relatórios disponíveis dos empreendimentos carregados.')} {temMais && t('Use Carregar mais abaixo para incluir os demais empreendimentos.')}</p>}
      {falhas.length > 0 && <Aviso>{t('Não foi possível consultar alguns empreendimentos. Tente atualizar.')} {falhas.map(l => nomes.get(l.id)).join(', ')}</Aviso>}
      {!ativos.length ? <Cartao><p className="text-sm text-slate-500">{t('Nenhum empreendimento ativo para analisar.')}</p></Cartao> : <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Cartao titulo={t('Ranking de empreendimentos')}>
          <p className="mb-4 text-xs text-slate-500">{t('Ordenado por sessões; tempo ativo como desempate.')}</p>
          {ranking.length > 0 && resumo.sessoes === 0 && <p className="mb-4 text-sm text-slate-600">{t('Nenhuma sessão observada no período. Isso não significa que ninguém abriu os links.')}</p>}
          <Tabela cabecalho={[t('Empreendimento'), t('Sessões'), t('Retornos'), t('Tempo ativo')]}>
            {ranking.map((l, i) => { const s = l.relatorio!.summary; return <Fragment key={l.id}><tr>
              <Td><div className="min-w-44"><p className="mb-2 font-medium"><span className="mr-2 text-slate-400">{i + 1}.</span>{nomes.get(l.id)}</p>
                <div aria-hidden="true" className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${s.sessions / maior * 100}%` }} /></div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2"><button className="text-left text-sm font-medium text-sky-700 hover:underline" aria-expanded={expandidos.has(l.id)} aria-controls={`apartamentos-${l.id}`} onClick={() => setExpandidos(antes => {
                  const novos = new Set(antes); if (novos.has(l.id)) novos.delete(l.id); else novos.add(l.id); return novos
                })}>{t(expandidos.has(l.id) ? 'Recolher apartamentos' : 'Expandir apartamentos')}</button>{abrir(l.id)}</div></div></Td>
              <Td>{n(s.sessions)}</Td><Td>{n(s.ownReturns)}</Td><Td>{duracaoInicio(s.activeMs)}</Td>
            </tr>{expandidos.has(l.id) && <tr id={`apartamentos-${l.id}`}><td colSpan={4} className="p-0"><ApartamentosInteresse key={`${l.id}:${l.relatorio!.from}:${l.relatorio!.to}`} propertyId={l.id} base={config.base!} periodo={{ from: l.relatorio!.from, to: l.relatorio!.to }} /></td></tr>}</Fragment> })}
          </Tabela>
        </Cartao>
        <Cartao titulo={t('Onde acompanhar o interesse')}>
          <p className="mb-4 text-sm text-slate-600">{t('Empreendimentos com retornos reconhecidos no período.')}</p>
          {retornos.length ? <ul className="divide-y divide-slate-100">{retornos.map(l => <li key={l.id} className="py-3 first:pt-0">
            <p className="font-medium">{nomes.get(l.id)}</p><p className="my-2 text-sm text-slate-500">{t('Retornos reconhecidos')}: <strong className="text-slate-900">{n(l.relatorio!.summary.ownReturns)}</strong></p>{abrir(l.id)}
          </li>)}</ul> : <p className="text-sm text-slate-500">{t('Ainda não há retornos nos relatórios disponíveis.')}</p>}
          <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">{t('Retornos são sinais de interesse, não contatos identificados nem vendas confirmadas.')}</p>
        </Cartao>
      </div>}
      <p className="text-xs leading-relaxed text-slate-500">{t('Somente acessos com consentimento. Tempo ativo considera página visível e atividade recente. O período seleciona o início das sessões; seus contadores são acumulados até a consulta.')} {resultado.periodo && resultado.periodo.split('|').map(d => new Date(d).toLocaleDateString(idioma, { timeZone: regiao.timeZone })).join(' – ')}</p>
    </>}
  </section>
}
