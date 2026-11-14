'use client'
import { RegiaoProvider, useIdioma } from '@/components/Idioma'

import { useState, useRef, useEffect } from 'react'
import { collection, doc } from 'firebase/firestore'
import { Aviso, Cartao, Estado, Selo, Tabela, Td, useAcao } from './ui'
import { EditorComercial, EditorDePerfil, EditorDeUnidade } from './EstoqueEditor'
import { db } from '@/lib/firebase'
import { useColecao, useDoc } from '@/lib/useFirestore'
import { usePerfil } from '@/lib/session'
import { podeEditarComercial } from '@/lib/acesso'
import { iniciarEstoque, mostrarEstoque } from '@/lib/estoque'
import { CATALOGOS_ESTOQUE, MODELO_LARANJEIRAS, SITUACOES, TOTAL_VAGAS, resolverInformacoes, totais, vagasDaUnidade, validarEstoque, validarLista, validarVagas, type Estoque, type ModeloEstoque, type PerfilVenda, type UnidadeVenda, type VagasVenda } from '@/lib/estoque-modelo'
import type { Agency, Property } from '@/lib/types'
import { REGIAO_PADRAO, moeda } from '@/lib/regiao'

function modeloDoEmpreendimento(property: Property): ModeloEstoque {
  if (property.id === MODELO_LARANJEIRAS || property.pipelineUnitId === MODELO_LARANJEIRAS) return MODELO_LARANJEIRAS
  for (const value of [property.maqueteUrl, property.tourUrl, property.publicUrl]) {
    if (!value) continue
    try {
      const url = new URL(value)
      if (url.origin === 'https://conectaimoveis3d.com.br' &&
        ['/laranjeiras', '/laranjeiras/', '/laranjeiras/index.html'].includes(url.pathname)) return MODELO_LARANJEIRAS
    } catch { continue }
  }
  return 'liv-ipanema'
}

export function EstoqueEmpreendimento({ property }: { property: Property }) {
  const { t: tr } = useIdioma()
  const agencia = useDoc<Agency>(`regiao-estoque:${property.agencyId}`, () => doc(db, 'agencies', property.agencyId))

  return podeEditarComercial(usePerfil(), property.agencyId)
    ? <Estado r={agencia}>{agencia.dado && <RegiaoProvider regiao={agencia.dado.region ?? REGIAO_PADRAO}><CadastroDeEstoque property={property} /></RegiaoProvider>}</Estado> : <Aviso>{tr("Sem permissão para alterar este cadastro.")}</Aviso>
}

function CadastroDeEstoque({ property }: { property: Property }) {
  const { t: tr, regiao, idioma } = useIdioma()

  const uid = usePerfil().id, { executar, ocupado, erro } = useAcao()
  const configurador = usePerfil().role === 'platform_admin'
  const settings = useDoc<Estoque>(`estoque:${property.id}`, () => doc(db, 'salesInventory', property.id))
  const modeloInicial = modeloDoEmpreendimento(property)
  const isLaranjeiras = settings.dado?.model === MODELO_LARANJEIRAS
  const usaMapaVagas = settings.dado?.model === 'liv-ipanema'
  const unitsQuery = useColecao<UnidadeVenda>(settings.dado ? `estoque-unidades:${property.id}` : null, () => collection(db, 'salesInventory', property.id, 'units'))
  const profilesQuery = useColecao<PerfilVenda>(settings.dado ? `estoque-perfis:${property.id}` : null, () => collection(db, 'salesInventory', property.id, 'profiles'))
  const parkingQuery = useDoc<VagasVenda>(usaMapaVagas ? `estoque-vagas:${property.id}` : null, () => doc(db, 'salesInventory', property.id, 'parking', 'mapa'))
  const [floor, setFloor] = useState('todos'), [status, setStatus] = useState('todos'), [search, setSearch] = useState('')
  const [tower, setTower] = useState('todas')
  const [unit, setUnit] = useState<UnidadeVenda | null>(null), [profile, setProfile] = useState<PerfilVenda | null>(null)
  const editor = useRef<HTMLDivElement>(null), lastButton = useRef<HTMLButtonElement | null>(null)
  useEffect(() => { if (unit || profile) editor.current?.focus() }, [unit, profile])
  const close = () => { setUnit(null); setProfile(null); lastButton.current?.focus() }
  if (settings.erro) return <Aviso>{settings.erro}</Aviso>
  if (settings.dado === undefined) return <Estado r={settings}>{tr("Carregando estoque…")}</Estado>
  if (!settings.dado) return <Cartao titulo={tr("Unidades do empreendimento")}>
    {!configurador ? <p>{tr("A equipe Conecta está preparando o cadastro das unidades. Assim que estiver pronto, você poderá atualizar preços e vendas.")}</p> : <>
    {modeloInicial === MODELO_LARANJEIRAS ? <>
      <p className="mb-3 text-sm">{tr("Cadastre as 312 posições da maquete do Parque das Laranjeiras, distribuídas em três torres.")}</p>
      <p className="mb-3 text-xs text-slate-500">{tr("O cadastro começa com preço, disponibilidade e numeração comercial por preencher.")}</p>
    </> : <>
      <p className="mb-3 text-sm">Cadastre as 170 posições da maquete do LIV para informar numeração, disponibilidade e características por unidade.</p>
      <p className="mb-3 text-xs text-slate-500">Todas começam sem disponibilidade e sem planta associada. A numeração e a associação Canto/Meio devem ser conferidas pelo responsável.</p>
    </>}
    <button className="btn-primario" disabled={ocupado} onClick={() => executar(() => iniciarEstoque(db, property.id, uid, property.developmentName || property.title, modeloInicial))}>
      {modeloInicial === MODELO_LARANJEIRAS ? tr("Cadastrar unidades do Parque das Laranjeiras") : 'Cadastrar unidades do LIV'}
    </button>
    {erro && <Aviso>{erro}</Aviso>}
    </>}
  </Cartao>
  const stock = settings.dado, units = unitsQuery.dados, profiles = profilesQuery.dados
  const erroConsulta = unitsQuery.erro || profilesQuery.erro || (usaMapaVagas ? parkingQuery.erro : null)
  if (erroConsulta) return <Aviso>{erroConsulta}</Aviso>
  if (!units || !profiles || (usaMapaVagas && parkingQuery.dado === undefined)) return <Estado r={unitsQuery}>{tr("Carregando unidades…")}</Estado>
  let spaces: Record<string, string>
  try {
    validarEstoque(stock)
    validarLista(units, stock.model)
    spaces = usaMapaVagas && parkingQuery.dado ? validarVagas(parkingQuery.dado) : {}
  } catch (e) { return <Aviso>{(e as Error).message}</Aviso> }
  const catalogo = CATALOGOS_ESTOQUE[stock.model]
  const counts = totais(units), shown = units.filter(u => (floor === 'todos' || u.floor === Number(floor)) &&
    (!isLaranjeiras || tower === 'todas' || u.tower === Number(tower)) &&
    (status === 'todos' || u.availability === status) && `${u.commercialNumber ?? ''} ${u.id}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
    .sort((a, b) => (a.tower ?? 0) - (b.tower ?? 0) || a.floor - b.floor || a.final - b.final)
  return <div className="space-y-6">
    <Cartao titulo={tr("Estoque de apartamentos")}>
      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-6">{[[tr('Todas as unidades'), units.length], [tr('Disponível'), counts.disponivel], [tr('Vendida'), counts.vendida], [tr('Reservada'), counts.reservada], [tr('Bloqueada'), counts.bloqueada], [tr('Não informada'), counts.nao_informada]].map(([label,n]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 text-2xl font-semibold">{n}</dd></div>)}</dl>
      {configurador && usaMapaVagas && <p className="mt-3 text-sm">{Object.keys(spaces).length} / {TOTAL_VAGAS} {tr('Vagas')}</p>}
      {configurador && isLaranjeiras && <p className="mt-3 text-sm">{tr("A equipe Conecta configura as vagas a partir do arquivo de implantação confirmado.")}</p>}
      <p className="mt-2 text-xs text-slate-500">{isLaranjeiras
        ? tr("Os pavimentos 0 a 12 são posições da maquete. O público vê a numeração comercial após a conferência e o cadastro.")
        : tr("Pavimentos 0–16 são posições do modelo. A numeração comercial confirmada aparece para o público quando cadastrada.")}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Selo tom={stock.publicEnabled ? 'verde' : 'cinza'}>{stock.publicEnabled ? tr("Consulta pública habilitada") : tr("Consulta pública desabilitada")}</Selo>
        {configurador && <button className="btn" disabled={ocupado || !!unit || !!profile} onClick={() => executar(() => mostrarEstoque(db, property.id, uid, stock, !stock.publicEnabled))}>
          {stock.publicEnabled ? tr("Desabilitar consulta pública") : tr("Habilitar consulta pública")}</button>}
      </div>
      {configurador && <p className="mt-2 break-all text-xs text-slate-500">Identificador para ligar à maquete: {property.id}. As alterações salvas ficam visíveis quando a consulta está habilitada.</p>}
      {erro && <Aviso>{erro}</Aviso>}
    </Cartao>
    {!configurador && <Cartao titulo={tr("Preços e vendas")}><p className="text-sm text-slate-600">{tr("Atualize o preço e informe se a unidade está disponível ou vendida. Plantas, características, numeração e vagas são configuradas pela equipe Conecta.")}</p></Cartao>}
    {configurador && <Cartao titulo={tr("Informações comuns das plantas")}>
      <p className="mb-3 text-sm text-slate-500">{tr("Preencha uma vez por planta. Cada apartamento pode ter diferenças próprias; o status é sempre individual.")}</p>
      <div className="flex flex-wrap gap-2">{profiles.map(p => <button key={p.id} disabled={!!unit || !!profile} className="btn"
        onClick={e => { lastButton.current = e.currentTarget; setProfile(p) }}>{tr("Editar")}{' '}{p.id === 'canto' ? tr("Canto") : tr("Meio")}</button>)}</div>
    </Cartao>}
    {(unit || profile) && <div ref={editor} tabIndex={-1} aria-label="Editor do cadastro" className="outline-offset-4">
      {unit && (configurador ? <EditorDeUnidade unit={unit} units={units} profiles={profiles} spaces={spaces} model={stock.model} propertyId={property.id} uid={uid} close={close} />
        : <EditorComercial unit={unit} profiles={profiles} propertyId={property.id} uid={uid} close={close} />)}
      {profile && <EditorDePerfil profile={profile} propertyId={property.id} uid={uid} close={close} />}
    </div>}
    <Cartao titulo={tr("Todas as unidades")}>
      <div className={`mb-4 grid gap-3 ${isLaranjeiras ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
        {isLaranjeiras && <label className="text-sm">{tr("Torre")}<select className="campo mt-1" value={tower} onChange={e => setTower(e.target.value)}>
          <option value="todas">{tr("Todas")}</option>
          {Array.from({ length: catalogo.torres }, (_, i) => <option key={i + 1} value={i + 1}>{String(i + 1).padStart(2, '0')}</option>)}
        </select></label>}
        <label className="text-sm">{tr("Pavimento")}<select className="campo mt-1" value={floor} onChange={e => setFloor(e.target.value)}>
          <option value="todos">{tr("Todos")}</option>{Array.from({ length: catalogo.pavimentos }, (_, i) => <option key={i} value={i}>{idioma === 'en' ? `Model floor ${i}` : i === 0 ? tr("Térreo (modelo)") : `${i}º tipo (modelo)`}</option>)}</select></label>
        <label className="text-sm">{tr("Disponibilidade")}<select className="campo mt-1" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="todos">{tr("Todas")}</option>{Object.entries(SITUACOES).map(([key, label]) => <option key={key} value={key}>{tr(label)}</option>)}</select></label>
        <label className="text-sm">{tr("Número / posição")}<input className="campo mt-1" value={search} onChange={e => setSearch(e.target.value)} /></label>
      </div>
      <p className="mb-2 text-xs text-slate-500" role="status">{shown.length} / {units.length}</p>
      <Tabela cabecalho={[tr("Apartamento"), ...(isLaranjeiras ? [tr("Torre")] : []), tr("Pavimento / final"), tr("Planta"), ...(usaMapaVagas ? [tr("Vagas")] : []), tr("Disponibilidade"), tr('Preço'), tr("Cadastro")]}>
        {shown.map(u => <tr key={u.id}><Td>{u.commercialNumber || tr("Número a confirmar")}</Td>
          {isLaranjeiras && <Td>{String(u.tower).padStart(2, '0')}</Td>}
          <Td>{u.floor} / {String(u.final).padStart(2, '0')}</Td>
          <Td>{u.profileId === 'canto' ? tr("Canto") : u.profileId === 'meio' ? tr("Meio") : tr("Em conferência")}</Td>
          {usaMapaVagas && <Td>{vagasDaUnidade(spaces, u.id).join(', ') || '—'}</Td>}
          <Td><Selo tom={u.availability === 'disponivel' ? 'verde' : u.availability === 'vendida' ? 'vermelho' : 'cinza'}>{tr(SITUACOES[u.availability])}</Selo></Td>
          <Td>{moeda(resolverInformacoes(u, profiles).priceCents, { ...regiao, locale: idioma })}</Td>
          <Td><button className="btn" disabled={!!unit || !!profile} aria-label={`${tr('Editar')} ${u.commercialNumber || u.id}`} onClick={e => { lastButton.current = e.currentTarget; setUnit(u) }}>{tr("Editar")}</button></Td></tr>)}
      </Tabela>
    </Cartao>
  </div>
}
