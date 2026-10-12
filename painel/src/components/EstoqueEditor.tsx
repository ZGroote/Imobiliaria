'use client'
import { useState, type FormEvent } from 'react'
import { Aviso, Cartao, useAcao } from './ui'
import { CamposDaFicha, lerInformacoes } from './EstoqueCampos'
import { db } from '@/lib/firebase'
import { salvarPerfil, salvarUnidade } from '@/lib/estoque'
import { resolverInformacoes, SITUACOES, validarLista, type Planta, type PerfilVenda, type UnidadeVenda } from '@/lib/estoque-modelo'

export function EditorDeUnidade({ unit, units, profiles, propertyId, uid, close }: {
  unit: UnidadeVenda; units: UnidadeVenda[]; profiles: PerfilVenda[]; propertyId: string; uid: string; close: () => void
}) {
  const { executar, ocupado, erro } = useAcao()
  const [profileId, setProfileId] = useState<Planta | null>(unit.profileId), [confirmed, setConfirmed] = useState(!!unit.profileId)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget)
    const ok = await executar(async () => {
      if (profileId && !confirmed) throw Error('Confirme a planta desta unidade. Não deduzir pelo final.')
      const next: UnidadeVenda = { ...unit, profileId, overrides: lerInformacoes(form), commercialNumber: String(form.get('commercialNumber') ?? '').trim() || null,
        availability: String(form.get('availability')) as UnidadeVenda['availability'] }
      validarLista(units.map(u => u.id === unit.id ? next : u))
      await salvarUnidade(db, propertyId, uid, next)
    })
    if (ok) close()
  }
  const inherited = resolverInformacoes({ ...unit, profileId, overrides: { priceCents: null, areaM2: null, bedrooms: null, bathrooms: null, parking: null, description: null, conditions: null } }, profiles)
  return <Cartao titulo={`Editar ${unit.commercialNumber || `pavimento ${unit.floor} · final ${String(unit.final).padStart(2, '0')}`}`}>
    <form onSubmit={submit} className="space-y-4" aria-label="Ficha da unidade">
      <p className="text-xs text-slate-500">Posição técnica: {unit.id}. Preencha a numeração comercial confirmada. Esta ficha contém somente informações públicas.</p>
      <fieldset disabled={ocupado} className="space-y-3">
        <label className="block text-sm">Número comercial<input className="campo mt-1" name="commercialNumber" maxLength={100} defaultValue={unit.commercialNumber ?? ''} /></label>
        <label className="block text-sm">Disponibilidade<select aria-label="Disponibilidade" className="campo mt-1" name="availability" defaultValue={unit.availability}>
          {Object.entries(SITUACOES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select></label>
        <label className="block text-sm">Planta associada<select aria-label="Planta associada" className="campo mt-1" value={profileId ?? ''} onChange={e => { setProfileId((e.target.value || null) as Planta | null); setConfirmed(false) }}>
          <option value="">Em conferência / sem associação</option><option value="canto">Canto — orientação original</option><option value="meio">Meio — orientação original</option>
        </select></label>
        {profileId && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} required />
          Conferi que esta unidade usa a planta selecionada na orientação original. Espelhamentos exigem outra variante de planta e Tour.</label>}
        <p className="text-xs text-slate-500">Campos vazios abaixo usam os dados comuns da planta. Preencha apenas as diferenças desta unidade.</p>
        <CamposDaFicha key={profileId ?? 'sem-planta'} values={unit.overrides} inherited={inherited} />
      </fieldset>
      <div className="flex gap-2"><button disabled={ocupado} className="btn-primario">Salvar unidade</button>
        <button disabled={ocupado} className="btn" type="button" onClick={close}>Cancelar</button></div>
      {erro && <Aviso>{erro}</Aviso>}
    </form>
  </Cartao>
}
export function EditorDePerfil({ profile, propertyId, uid, close }: { profile: PerfilVenda; propertyId: string; uid: string; close: () => void }) {
  const { executar, ocupado, erro } = useAcao()
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget)
    const ok = await executar(() => salvarPerfil(db, propertyId, uid, { ...profile, info: lerInformacoes(form) }))
    if (ok) close()
  }
  return <Cartao titulo={`Dados comuns — ${profile.id === 'canto' ? 'Canto' : 'Meio'}`}>
    <form onSubmit={submit} className="space-y-4" aria-label="Dados comuns da planta">
      <p className="text-sm text-slate-500">Uma alteração vale para todas as unidades associadas a esta planta, preservando as diferenças preenchidas individualmente.</p>
      <fieldset disabled={ocupado}><CamposDaFicha values={profile.info} /></fieldset>
      <div className="flex gap-2"><button disabled={ocupado} className="btn-primario">Salvar dados comuns</button>
        <button disabled={ocupado} className="btn" type="button" onClick={close}>Cancelar</button></div>
      {erro && <Aviso>{erro}</Aviso>}
    </form>
  </Cartao>
}
