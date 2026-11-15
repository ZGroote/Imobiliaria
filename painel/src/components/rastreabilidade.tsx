'use client'
import { useIdioma } from '@/components/Idioma'

import { useEffect, useMemo, useRef, useState } from 'react'
import { collection, query, where } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { usePerfil } from '@/lib/session'
import { useColecao } from '@/lib/useFirestore'
import { baseRastreabilidade, responsaveisAtivos, criarClienteRastreabilidade, periodo30Dias,
  type TrackingLink, type TrackingReport, type TrackingScope, type TrackingSection, type SourceClass } from '@/lib/rastreabilidade'
import type { Property, User } from '@/lib/types'
import { Aviso, Carregando, Cartao, Selo, Tabela, Td } from './ui'

const SOURCE_NAMES: Record<SourceClass, string> = {
  root: 'Entradas pelo link raiz', forwarded: 'Entradas por sublink',
  own_return: 'Retornos reconhecidos', uncertain: 'Origem incerta',
}
const SECTION_NAMES: Record<TrackingSection, string> = {
  ficha: 'Ficha', mapa: 'Mapa', interior: 'Interior', planta: 'Planta', maquete: 'Maquete',
  planta2d: 'Planta 2D', planta3d: 'Planta 3D', visita: 'Visita', carregando: 'Carregamento',
}
function tempo(ms: number) {
  const s = Math.floor(ms / 1000)
  return s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min ${s % 60} s`
    : `${Math.floor(s / 3600)} h ${Math.floor(s % 3600 / 60)} min`
}
type Resultado<T> = { carregando: boolean; dado?: T; erro?: string }

export function RastreabilidadeImovel({ p }: { p: Property }) {
  const { t: tr, idioma, regiao } = useIdioma()
  const numero = (n: number) => n.toLocaleString(idioma)
  const data = (iso: string) => new Date(iso).toLocaleString(idioma, { dateStyle: 'short', timeStyle: 'short', timeZone: regiao.timeZone })

  const perfil = usePerfil()
  if (p.status !== 'active') return <Cartao titulo={tr("Links individuais")}>
    <p className="text-sm text-slate-600">{tr("A publicação está fora do ar. Os links e o histórico foram preservados e voltam a ficar disponíveis ao colocar o imóvel no ar novamente.")}</p>
  </Cartao>
  // Trocar imóvel ou papel encerra operações e descarta dados do escopo anterior.
  return <LinksERelatorio key={`${p.id}:${p.agencyId}:${perfil.id}:${perfil.role}:${perfil.agencyId ?? ''}`} p={p} perfil={perfil} />
}

function LinksERelatorio({ p, perfil }: { p: Property; perfil: User }) {
  const { t: tr, idioma, regiao } = useIdioma()
  const numero = (n: number) => n.toLocaleString(idioma)
  const data = (iso: string) => new Date(iso).toLocaleString(idioma, { dateStyle: 'short', timeStyle: 'short', timeZone: regiao.timeZone })

  const agente = perfil.role === 'agent'
  const interno = ['platform_admin', 'operator'].includes(perfil.role)
  const config = useMemo(() => {
    try { return { base: baseRastreabilidade(process.env.NEXT_PUBLIC_TRACKING_API_URL), invalida: false } }
    catch { return { base: null, invalida: true } }
  }, [])
  const api = useMemo(() => config.base ? criarClienteRastreabilidade({ baseUrl: config.base, getToken: async () => {
    if (auth.currentUser?.uid !== perfil.id) return ''
    return auth.currentUser.getIdToken()
  } }) : null, [config.base, perfil.id])
  const scope = useMemo<TrackingScope>(() => ({ propertyId: p.id, agencyId: p.agencyId,
    ...(agente ? { brokerUid: perfil.id } : {}) }), [p.id, p.agencyId, agente, perfil.id])
  const pessoas = useColecao<User>(api && !agente ? `rastreabilidade:responsaveis:${p.agencyId}:${interno}` : null,
    () => interno ? query(collection(db, 'users')) : query(collection(db, 'users'), where('agencyId', '==', p.agencyId)))
  const corretores = responsaveisAtivos(pessoas.dados ?? [], p.agencyId, interno)
  const [escolha, setEscolha] = useState('')
  const escolhido = corretores.some(u => u.id === escolha) ? escolha : corretores[0]?.id ?? ''
  const [links, setLinks] = useState<Resultado<{ links: TrackingLink[]; truncated: boolean }>>({ carregando: true })
  const [relatorio, setRelatorio] = useState<Resultado<TrackingReport>>({ carregando: true })
  const [atualizacao, setAtualizacao] = useState(0)
  const [ocupado, setOcupado] = useState('')
  const [erroAcao, setErroAcao] = useState('')
  const [aviso, setAviso] = useState('')
  const operacao = useRef<AbortController | null>(null)
  const emAcao = useRef(false)
  const tentativa = useRef<{ brokerUid?: string; attemptId: string } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    operacao.current = controller
    return () => { controller.abort(); operacao.current = null }
  }, [])
  useEffect(() => {
    if (!api) return
    const controller = new AbortController(), signal = controller.signal
    setLinks({ carregando: true }); setRelatorio({ carregando: true })
    api.listar(scope, signal).then(dado => { if (!signal.aborted) setLinks({ carregando: false, dado }) },
      e => { if (!signal.aborted) setLinks({ carregando: false, erro: e.message }) })
    api.relatorio(scope, periodo30Dias(), signal).then(dado => { if (!signal.aborted) setRelatorio({ carregando: false, dado }) },
      e => { if (!signal.aborted) setRelatorio({ carregando: false, erro: e.message }) })
    return () => controller.abort()
  }, [api, scope, atualizacao])

  async function criar() {
    const controller = operacao.current
    if (!api || !controller || emAcao.current || (!agente && !escolhido)) return
    const brokerUid = agente ? undefined : escolhido
    if (!tentativa.current || tentativa.current.brokerUid !== brokerUid)
      tentativa.current = { brokerUid, attemptId: crypto.randomUUID() }
    emAcao.current = true; setOcupado('criar'); setErroAcao(''); setAviso('')
    try {
      const link = await api.criar(scope, tentativa.current, controller.signal)
      if (controller.signal.aborted) return
      tentativa.current = null
      setAviso(idioma === 'en' ? `Link created for ${link.brokerName}. Copy the address to share it.` : `Link criado para ${link.brokerName}. Copie o endereço para compartilhar.`)
      setAtualizacao(n => n + 1)
    } catch (e) { if (!controller.signal.aborted) setErroAcao(tr((e as Error).message)) }
    finally { if (!controller.signal.aborted) { emAcao.current = false; setOcupado('') } }
  }
  async function revogar(link: TrackingLink) {
    const controller = operacao.current
    if (!api || !controller || emAcao.current || link.status !== 'active') return
    emAcao.current = true; setOcupado(link.id); setErroAcao(''); setAviso('')
    try {
      await api.revogar(link.id, controller.signal)
      if (controller.signal.aborted) return
      setLinks(r => ({ ...r, dado: r.dado && { ...r.dado, links: r.dado.links.map(l => l.id === link.id ? { ...l, status: 'revoked' } : l) } }))
      setAviso(tr("Link revogado. Seus sublinks também deixam de permitir acesso e coleta."))
      setAtualizacao(n => n + 1)
    } catch (e) { if (!controller.signal.aborted) setErroAcao(tr((e as Error).message)) }
    finally { if (!controller.signal.aborted) { emAcao.current = false; setOcupado('') } }
  }
  async function copiar(link: TrackingLink) {
    const controller = operacao.current
    if (!controller || link.status !== 'active') return
    try {
      await navigator.clipboard.writeText(link.url)
      if (!controller.signal.aborted) { setAviso(idioma === 'en' ? `Link for ${link.brokerName} copied.` : `Link de ${link.brokerName} copiado.`); setErroAcao('') }
    } catch { if (!controller.signal.aborted) setErroAcao(tr("Não foi possível copiar. Abra o link e copie o endereço pela barra do navegador.")) }
  }

  if (!api) return <Cartao titulo={tr("Links individuais e acessos")}>
    <p className="text-sm text-slate-600">{config.invalida
      ? tr("A rastreabilidade precisa de uma configuração válida. Avise a equipe responsável.")
      : tr("Os links individuais e os relatórios estarão disponíveis quando a equipe ativar a rastreabilidade.")}</p>
    <p className="mt-2 text-xs text-slate-500">{tr("Ainda não é possível criar links atribuídos ou consultar acessos por aqui.")}</p>
  </Cartao>

  return <div className="min-w-0 space-y-6">
    <Cartao titulo={tr("Sessões iniciadas nos últimos 30 dias")}>
      {relatorio.carregando ? <Carregando /> : relatorio.erro ? <Aviso>{relatorio.erro}</Aviso>
        : relatorio.dado && <Relatorio report={relatorio.dado} agente={agente} />}
    </Cartao>
    <Cartao titulo={tr("Links individuais")}>
      <p className="mb-3 text-sm text-slate-600">{agente ? tr("Seus links para este imóvel. Cada link mantém sua atribuição nos sublinks.")
        : tr("Este imóvel pode ter vários links. Cada um identifica um corretor ou membro da equipe.")}</p>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        {!agente && <label className="min-w-0 text-sm">{tr("Responsável pelo novo link")}<select className="campo mt-1 max-w-full" value={escolhido} disabled={!!ocupado || pessoas.dados === undefined || !!pessoas.erro}
            onChange={e => setEscolha(e.target.value)}>
            {!corretores.length && <option value="">{pessoas.dados === undefined ? tr("Carregando equipe…") : tr("Nenhum responsável ativo")}</option>}
            {corretores.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>}
        <button className="btn-primario" disabled={!!ocupado || p.status !== 'active' || (!agente && !escolhido)} onClick={criar}>
          {ocupado === 'criar' ? tr("Criando…") : tr("Criar link")}</button>
        <button className="btn" disabled={!!ocupado || links.carregando || relatorio.carregando}
          onClick={() => setAtualizacao(n => n + 1)}>{tr("Atualizar")}</button>
      </div>
      {p.status !== 'active' && <p className="mb-3 text-sm text-slate-500">{tr("O imóvel precisa estar ativo para criar links.")}</p>}
      {pessoas.erro && <Aviso>{pessoas.erro}</Aviso>}
      {erroAcao && <Aviso>{erroAcao}</Aviso>}
      {aviso && <p role="status" className="mb-3 text-sm text-emerald-700">{aviso}</p>}
      {links.carregando ? <Carregando /> : links.erro ? <Aviso>{links.erro}</Aviso> : links.dado && <>
        {links.dado.truncated && <p role="status" className="mb-2 text-sm text-amber-800">{tr("Lista parcial: nem todos os links foram retornados.")}</p>}
        {!links.dado.links.length ? <p className="text-sm text-slate-500">{agente ? tr("Você ainda não tem links deste imóvel.") : tr("Nenhum link criado para este imóvel.")}</p>
          : <ul className="divide-y divide-slate-200">
            {links.dado.links.map(link => <li key={link.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm"><strong>{link.brokerName}</strong>
                <Selo tom={link.status === 'active' ? 'verde' : 'cinza'}>{link.status === 'active' ? tr("Ativo") : tr("Revogado")}</Selo>
                <span className="text-xs text-slate-500">{tr("Criado em")}{' '}{data(link.createdAt)}</span>
              </div>
              {link.status === 'active' && <>
                <a className="mt-2 block break-all text-sm text-sky-700 hover:underline" href={link.url} target="_blank" rel="noopener noreferrer">{link.url}</a>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="btn text-xs" disabled={!!ocupado} onClick={() => copiar(link)} aria-label={`Copiar link de ${link.brokerName}`}>{tr("Copiar link")}</button>
                  <button className="btn text-xs" disabled={!!ocupado} onClick={() => revogar(link)} aria-label={`Revogar link de ${link.brokerName}`}>
                    {ocupado === link.id ? tr("Revogando…") : tr("Revogar")}</button>
                </div>
              </>}
            </li>)}
          </ul>}
        <p className="mt-3 text-xs text-slate-500">{tr("Revogar um link interrompe o acesso e a coleta dos seus sublinks. O histórico de acessos é preservado.")}</p>
      </>}
    </Cartao>

  </div>
}

function Relatorio({ report: r, agente }: { report: TrackingReport; agente: boolean }) {
  const { t: tr, idioma, regiao } = useIdioma()
  const numero = (n: number) => n.toLocaleString(idioma)
  const data = (iso: string) => new Date(iso).toLocaleString(idioma, { dateStyle: 'short', timeStyle: 'short', timeZone: regiao.timeZone })

  const resumo = r.summary
  return <>
    <p className="mb-3 text-xs text-slate-500">{data(r.from)} a {data(r.to)} · {agente ? tr("Seus links") : tr("Links da imobiliária neste imóvel")}</p>
    {r.coverage.truncated && <p role="status" className="mb-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{tr("Relatório parcial: o limite de dados consultados foi atingido. Os totais podem ficar abaixo do observado.")}</p>}
    <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
      {([[tr("Sessões iniciadas"), numero(resumo.sessions)], [tr("Navegadores estimados"), numero(resumo.estimatedVisitors)],
        [tr("Visualizações de páginas"), numero(resumo.pageViews)], [tr("Tempo ativo acumulado"), tempo(resumo.activeMs)]] as [string, string][])
        .map(([label, value]) => <div key={label} className="rounded border border-slate-200 p-3"><dt className="text-xs text-slate-500">{tr(label)}</dt><dd className="mt-1 text-lg font-semibold">{value}</dd></div>)}
    </dl>
    <p className="mb-3 text-xs text-slate-600">{tr("O período seleciona as sessões iniciadas entre essas datas. Visualizações e tempo ativo são os contadores acumulados dessas sessões até a consulta.")}</p>
    <p className="mb-3 text-xs text-slate-600">{tr("Métricas apenas de visitantes que aceitaram a coleta. Navegadores estimados não equivalem a pessoas únicas. O tempo ativo considera a página visível e atividade recente.")}</p>
    {resumo.sessions === 0 && <p className="mb-3 text-sm text-slate-600">{tr("Nenhuma sessão observada no período. Isso não significa que ninguém abriu os links.")}</p>}
    {!agente && r.byBroker.length > 0 && <div className="mb-4">
      <h3 className="mb-2 text-sm font-medium">{tr("Por responsável")}</h3>
      <Tabela cabecalho={[tr("Responsável"), tr("Sessões"), tr("Navegadores estimados"), tr("Tempo ativo")]}>
        {r.byBroker.map(b => <tr key={b.brokerUid}><Td>{b.brokerName}</Td><Td>{numero(b.sessions)}</Td><Td>{numero(b.estimatedVisitors)}</Td><Td>{tempo(b.activeMs)}</Td></tr>)}
      </Tabela>
      <p className="mt-2 text-xs text-slate-500">{tr("O total deduplica navegadores no período; somar as linhas pode contar o mesmo navegador mais de uma vez.")}</p>
    </div>}
    {r.bySource.length > 0 && <div className="mb-4">
      <h3 className="mb-2 text-sm font-medium">{tr("Origem das sessões")}</h3>
      <Tabela cabecalho={[tr("Origem"), tr("Sessões"), tr("Navegadores estimados"), tr("Tempo ativo")]}>
        {r.bySource.map(s => <tr key={s.sourceClass}><Td>{tr(SOURCE_NAMES[s.sourceClass])}</Td><Td>{numero(s.sessions)}</Td><Td>{numero(s.estimatedVisitors)}</Td><Td>{tempo(s.activeMs)}</Td></tr>)}
      </Tabela>
    </div>}
    <p className="mb-4 text-xs text-slate-500">{tr("Entradas pelo link raiz não comprovam envio direto pelo corretor. Entradas por sublink indicam a cadeia do endereço. Reenviar o texto do link original sem abri-lo não permite identificar o repasse.")}</p>
    {r.bySection.length > 0 && <div>
      <h3 className="mb-2 text-sm font-medium">{tr("Páginas e seções")}</h3>
      <Tabela cabecalho={[tr("Página"), tr("Seção"), tr("Visualizações"), tr("Tempo ativo")]}>
        {r.bySection.map(s => <tr key={`${s.page}:${s.section}`}><Td>{s.page === 'tour' ? 'Tour' : tr("Maquete")}</Td><Td>{tr(SECTION_NAMES[s.section])}</Td><Td>{numero(s.views)}</Td><Td>{tempo(s.activeMs)}</Td></tr>)}
      </Tabela>
    </div>}
  </>
}
