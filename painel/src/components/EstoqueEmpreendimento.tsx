'use client'
import { useState, useRef, useEffect } from 'react'
import { collection, doc } from 'firebase/firestore'
import { Aviso, Cartao, Estado, Selo, Tabela, Td, useAcao } from './ui'
import { EditorDePerfil, EditorDeUnidade } from './EstoqueEditor'
import { db } from '@/lib/firebase'
import { useColecao, useDoc } from '@/lib/useFirestore'
import { usePerfil } from '@/lib/session'
import { iniciarEstoque, mostrarEstoque } from '@/lib/estoque'
import { SITUACOES, totais, validarEstoque, validarLista, type Estoque, type PerfilVenda, type UnidadeVenda } from '@/lib/estoque-modelo'
import type { Property } from '@/lib/types'

export function EstoqueEmpreendimento({ property }: { property: Property }) {
  const uid = usePerfil().id, { executar, ocupado, erro } = useAcao()
  const settings = useDoc<Estoque>(`estoque:${property.id}`, () => doc(db, 'salesInventory', property.id))
  const unitsQuery = useColecao<UnidadeVenda>(settings.dado ? `estoque-unidades:${property.id}` : null, () => collection(db, 'salesInventory', property.id, 'units'))
  const profilesQuery = useColecao<PerfilVenda>(settings.dado ? `estoque-perfis:${property.id}` : null, () => collection(db, 'salesInventory', property.id, 'profiles'))
  const [floor, setFloor] = useState('todos'), [status, setStatus] = useState('todos'), [search, setSearch] = useState('')
  const [unit, setUnit] = useState<UnidadeVenda | null>(null), [profile, setProfile] = useState<PerfilVenda | null>(null)
  const editor = useRef<HTMLDivElement>(null), lastButton = useRef<HTMLButtonElement | null>(null)
  useEffect(() => { if (unit || profile) editor.current?.focus() }, [unit, profile])
  const close = () => { setUnit(null); setProfile(null); lastButton.current?.focus() }
  if (settings.erro) return <Aviso>{settings.erro}</Aviso>
  if (settings.dado === undefined) return <Estado r={settings}>Carregando estoque…</Estado>
  if (!settings.dado) return <Cartao titulo="Unidades do empreendimento">
    <p className="mb-3 text-sm">Cadastre as 170 posições da maquete do LIV para informar numeração, disponibilidade e características por unidade.</p>
    <p className="mb-3 text-xs text-slate-500">Todas começam sem disponibilidade e sem planta associada. A numeração e a associação Canto/Meio devem ser conferidas pelo responsável.</p>
    <button className="btn-primario" disabled={ocupado} onClick={() => executar(() => iniciarEstoque(db, property.id, uid, property.developmentName || property.title))}>Cadastrar unidades do LIV</button>
    {erro && <Aviso>{erro}</Aviso>}
  </Cartao>
  const stock = settings.dado, units = unitsQuery.dados, profiles = profilesQuery.dados
  if (unitsQuery.erro || profilesQuery.erro) return <Aviso>{unitsQuery.erro || profilesQuery.erro}</Aviso>
  if (!units || !profiles) return <Estado r={unitsQuery}>Carregando unidades…</Estado>
  try { validarEstoque(stock); validarLista(units) } catch (e) { return <Aviso>{(e as Error).message}</Aviso> }
  const counts = totais(units), shown = units.filter(u => (floor === 'todos' || u.floor === Number(floor)) &&
    (status === 'todos' || u.availability === status) && `${u.commercialNumber ?? ''} ${u.id}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
    .sort((a, b) => a.floor - b.floor || a.final - b.final)
  return <div className="space-y-6">
    <Cartao titulo="Estoque de apartamentos">
      <p className="text-sm">{units.length} unidades cadastradas · {counts.disponivel} disponíveis · {counts.vendida} vendidas · {counts.reservada} reservadas · {counts.bloqueada} bloqueadas · {counts.nao_informada} sem informação</p>
      <p className="mt-2 text-xs text-slate-500">Pavimentos 0–16 são posições do modelo. A numeração comercial confirmada aparece para o público quando cadastrada.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Selo tom={stock.publicEnabled ? 'verde' : 'cinza'}>{stock.publicEnabled ? 'Consulta pública habilitada' : 'Consulta pública desabilitada'}</Selo>
        <button className="btn" disabled={ocupado || !!unit || !!profile} onClick={() => executar(() => mostrarEstoque(db, property.id, uid, stock, !stock.publicEnabled))}>
          {stock.publicEnabled ? 'Desabilitar consulta pública' : 'Habilitar consulta pública'}</button>
      </div>
      <p className="mt-2 break-all text-xs text-slate-500">Identificador para ligar à maquete: {property.id}. As alterações salvas ficam visíveis quando a consulta está habilitada.</p>
      {erro && <Aviso>{erro}</Aviso>}
    </Cartao>
    <Cartao titulo="Informações comuns das plantas">
      <p className="mb-3 text-sm text-slate-500">Preencha uma vez por planta. Cada apartamento pode ter diferenças próprias; o status é sempre individual.</p>
      <div className="flex flex-wrap gap-2">{profiles.map(p => <button key={p.id} disabled={!!unit || !!profile} className="btn"
        onClick={e => { lastButton.current = e.currentTarget; setProfile(p) }}>Editar {p.id === 'canto' ? 'Canto' : 'Meio'}</button>)}</div>
    </Cartao>
    {(unit || profile) && <div ref={editor} tabIndex={-1} aria-label="Editor do cadastro" className="outline-offset-4">
      {unit && <EditorDeUnidade unit={unit} units={units} profiles={profiles} propertyId={property.id} uid={uid} close={close} />}
      {profile && <EditorDePerfil profile={profile} propertyId={property.id} uid={uid} close={close} />}
    </div>}
    <Cartao titulo="Todas as unidades">
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Pavimento<select className="campo mt-1" value={floor} onChange={e => setFloor(e.target.value)}>
          <option value="todos">Todos</option>{Array.from({ length: 17 }, (_, i) => <option key={i} value={i}>{i === 0 ? 'Térreo (modelo)' : `${i}º tipo (modelo)`}</option>)}</select></label>
        <label className="text-sm">Disponibilidade<select className="campo mt-1" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="todos">Todas</option>{Object.entries(SITUACOES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="text-sm">Número / posição<input className="campo mt-1" value={search} onChange={e => setSearch(e.target.value)} /></label>
      </div>
      <p className="mb-2 text-xs text-slate-500" role="status">{shown.length} de {units.length} unidades</p>
      <Tabela cabecalho={['Apartamento', 'Pavimento / final', 'Planta', 'Disponibilidade', 'Cadastro']}>
        {shown.map(u => <tr key={u.id}><Td>{u.commercialNumber || 'Número a confirmar'}</Td><Td>{u.floor} / {String(u.final).padStart(2, '0')}</Td>
          <Td>{u.profileId === 'canto' ? 'Canto' : u.profileId === 'meio' ? 'Meio' : 'Em conferência'}</Td><Td><Selo tom={u.availability === 'disponivel' ? 'verde' : u.availability === 'vendida' ? 'vermelho' : 'cinza'}>{SITUACOES[u.availability]}</Selo></Td>
          <Td><button className="btn" disabled={!!unit || !!profile} aria-label={`Editar ${u.commercialNumber || u.id}`} onClick={e => { lastButton.current = e.currentTarget; setUnit(u) }}>Editar</button></Td></tr>)}
      </Tabela>
    </Cartao>
  </div>
}
