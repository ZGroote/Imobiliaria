'use client'
import { useEffect, useState } from 'react'
import { collection } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { usePerfil } from '@/lib/session'
import { useColecao } from '@/lib/useFirestore'
import { criarClienteRastreabilidade, type TrackingPeriod, type UnitTrackingReport } from '@/lib/rastreabilidade'
import type { UnidadeVenda } from '@/lib/estoque-modelo'
import { duracaoInicio } from '@/lib/resumoInicio'
import { useIdioma } from './Idioma'
import { Aviso, Carregando, Tabela, Td } from './ui'

export function ApartamentosInteresse({ propertyId, base, periodo }: { propertyId: string; base: string; periodo: TrackingPeriod }) {
  const { t, idioma } = useIdioma(), perfil = usePerfil()
  const [estado, setEstado] = useState<{ dado?: UnitTrackingReport; erro?: string }>({})
  const [busca, setBusca] = useState(''), [ordem, setOrdem] = useState('sessions'), [limite, setLimite] = useState(10), [revisao, setRevisao] = useState(0)
  const unidades = useColecao<UnidadeVenda>(`interesse-unidades:${perfil.id}:${propertyId}`, () => collection(db, 'salesInventory', propertyId, 'units'))
  useEffect(() => {
    const controller = new AbortController()
    setEstado({})
    const api = criarClienteRastreabilidade({ baseUrl: base, getToken: async () => auth.currentUser?.uid === perfil.id ? auth.currentUser.getIdToken() : '' })
    api.unidades({ propertyId, agencyId: perfil.agencyId!, ...(perfil.role === 'agent' ? { brokerUid: perfil.id } : {}) }, periodo, controller.signal)
      .then(dado => { if (!controller.signal.aborted) setEstado({ dado }) }, e => { if (!controller.signal.aborted) setEstado({ erro: e.message }) })
    return () => controller.abort()
  }, [base, propertyId, perfil.id, perfil.role, perfil.agencyId, periodo.from, periodo.to, revisao])
  if (estado.erro) return <div className="space-y-3"><Aviso>{t(estado.erro)}</Aviso><button className="btn" onClick={() => setRevisao(v => v + 1)}>{t('Tentar novamente')}</button></div>
  if (!estado.dado) return <Carregando />
  const report = estado.dado, metricas = new Map(report.byUnit.map(u => [u.unitKey, u]))
  const catalogo = new Map((unidades.dados ?? []).map(u => [u.id, u]))
  const keys = new Set([...metricas.keys(), ...catalogo.keys()])
  const linhas = [...keys].map(id => {
    const u = catalogo.get(id), m = metricas.get(id)
    const posicao = `${t('Pavimento')} ${u?.floor ?? Number(id.slice(1, 3))} · ${t('Final')} ${u?.final ?? Number(id.slice(5))}`
    return { id, m, titulo: u?.commercialNumber ? `${t('Apartamento')} ${u.commercialNumber}` : posicao, posicao }
  }).filter(l => `${l.id} ${l.titulo} ${l.posicao}`.toLocaleLowerCase(idioma).includes(busca.toLocaleLowerCase(idioma)))
    .sort((a, b) => (b.m?.[ordem as 'sessions' | 'returns' | 'activeMs'] ?? -1) - (a.m?.[ordem as 'sessions' | 'returns' | 'activeMs'] ?? -1) || a.id.localeCompare(b.id))
  const numero = (n: number) => n.toLocaleString(idioma)
  return <section aria-label={t('Interesse por apartamento')} className="space-y-4 bg-slate-50 p-4 sm:p-5">
    <div><h3 className="font-semibold">{t('Interesse por apartamento')}</h3><p className="mt-1 text-xs text-slate-500">{t('Mesmo período e responsável do empreendimento. Uma sessão pode explorar vários apartamentos; as linhas não devem ser somadas.')}</p></div>
    {report.coverage.truncated && <p role="status" className="text-sm text-amber-900">{t('Relatório parcial: o limite de dados consultados foi atingido. Os totais podem ficar abaixo do observado.')}</p>}
    <p className="text-xs text-slate-600">{t('Sessões com apartamento identificado')}: {numero(report.unitCoverage.sessionsWithUnit)} / {numero(report.summary.sessions)} · {t('Tempo sem apartamento identificado')}: {duracaoInicio(report.unitCoverage.unassignedActiveMs)}</p>
    <p className="text-xs text-slate-500">{t('A medição por apartamento começou nesta atualização. Acessos antigos e navegação geral permanecem apenas no total do empreendimento.')}</p>
    {unidades.erro && <Aviso>{t('Não foi possível carregar os nomes comerciais. As posições técnicas continuam disponíveis.')}</Aviso>}
    <div className="flex flex-wrap gap-3">
      <label className="min-w-0 flex-1 text-xs">{t('Buscar apartamento')}<input className="campo mt-1" value={busca} onChange={e => { setBusca(e.target.value); setLimite(10) }} /></label>
      <label className="text-xs">{t('Ordenar por')}<select className="campo mt-1" value={ordem} onChange={e => { setOrdem(e.target.value); setLimite(10) }}>
        <option value="sessions">{t('Sessões')}</option><option value="returns">{t('Retornos')}</option><option value="activeMs">{t('Tempo ativo')}</option>
      </select></label>
    </div>
    {!linhas.length ? <p className="text-sm text-slate-500">{t('Nenhum apartamento encontrado nos dados disponíveis.')}</p> : <Tabela cabecalho={[t('Apartamento'), t('Sessões'), t('Retornos'), t('Tempo ativo')]}>
      {linhas.slice(0, limite).map(l => <tr key={l.id}><Td><p className="font-medium">{l.titulo}</p>{l.titulo !== l.posicao && <p className="mt-1 text-xs text-slate-500">{l.posicao}</p>}</Td>
        <Td>{l.m ? numero(l.m.sessions) : '—'}</Td><Td>{l.m ? numero(l.m.returns) : '—'}</Td><Td>{l.m ? duracaoInicio(l.m.activeMs) : '—'}</Td></tr>)}
    </Tabela>}
    {linhas.length > limite && <button className="btn" onClick={() => setLimite(v => v + 10)}>{t('Mostrar mais apartamentos')}</button>}
    <p className="text-xs text-slate-500">{t('Retorno à unidade: nova sessão do mesmo navegador que já explorou esse apartamento neste período. Traço indica ausência de medição por unidade, não ausência de interesse.')}</p>
  </section>
}
