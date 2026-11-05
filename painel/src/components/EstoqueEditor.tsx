'use client'
import { useState, type FormEvent } from 'react'
import { Aviso, Cartao, useAcao } from './ui'
import { CamposDaFicha, lerInformacoes, valorPreco } from './EstoqueCampos'
import { db } from '@/lib/firebase'
import { salvarComercial, salvarPerfil, salvarUnidade, salvarVagas } from '@/lib/estoque'
import { useIdioma } from './Idioma'
import { centavos } from '@/lib/estoque-modelo'
import { lerVagas, resolverInformacoes, SITUACOES, TOTAL_VAGAS, vagasDaUnidade, validarLista, type ModeloEstoque, type Planta, type PerfilVenda, type UnidadeVenda } from '@/lib/estoque-modelo'

export function EditorComercial({ unit, profiles, propertyId, uid, close }: {
  unit: UnidadeVenda; profiles: PerfilVenda[]; propertyId: string; uid: string; close: () => void
}) {
  const { t: tr } = useIdioma()

  const { executar, ocupado, erro } = useAcao()
  const { regiao } = useIdioma()
  const info = resolverInformacoes(unit, profiles)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    if (await executar(() => salvarComercial(db, propertyId, uid, unit, centavos(String(f.get('price') ?? '')), String(f.get('availability')) as UnidadeVenda['availability']))) close()
  }
  return <Cartao titulo={`${tr("Preços e vendas")} · ${unit.commercialNumber || unit.id}`}>
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-slate-600">{tr("As características desta unidade são configuradas pela equipe Conecta.")}</p>
      <fieldset disabled={ocupado} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">{tr("Preço")} ({regiao.currency})<input className="campo mt-1" name="price" inputMode="decimal" defaultValue={unit.overrides.priceCents == null ? '' : valorPreco(unit.overrides.priceCents).replace(',', regiao.locale === 'en' ? '.' : ',')}
          placeholder={info.priceCents == null ? tr("Não informado") : valorPreco(info.priceCents).replace(',', regiao.locale === 'en' ? '.' : ',')} />
          <span className="text-xs text-slate-500">{tr("Sem separador de milhar. Vazio usa o preço configurado pela equipe.")}</span></label>
        <label className="text-sm">{tr("Disponibilidade")}<select aria-label={tr("Disponibilidade")} className="campo mt-1" name="availability" defaultValue={unit.availability}>
          {!['disponivel', 'vendida'].includes(unit.availability) && <option value={unit.availability}>{tr(SITUACOES[unit.availability])}</option>}
          <option value="disponivel">{tr("Disponível")}</option><option value="vendida">{tr("Vendida")}</option>
        </select></label>
      </fieldset>
      {erro && <Aviso>{erro}</Aviso>}
      <div className="flex gap-2"><button className="btn-primario" disabled={ocupado}>{tr("Salvar")}</button><button type="button" className="btn" disabled={ocupado} onClick={close}>{tr("Cancelar")}</button></div>
    </form>
  </Cartao>
}

export function EditorDeUnidade({ unit, units, profiles, spaces, model, propertyId, uid, close }: {
  unit: UnidadeVenda; units: UnidadeVenda[]; profiles: PerfilVenda[]; spaces: Record<string, string>; model: ModeloEstoque; propertyId: string; uid: string; close: () => void
}) {
  const { t: tr } = useIdioma()

  const usaMapaVagas = model === 'liv-ipanema'
  const vagasAtuais = usaMapaVagas ? vagasDaUnidade(spaces, unit.id) : []
  const { executar, ocupado, erro } = useAcao()
  const [profileId, setProfileId] = useState<Planta | null>(unit.profileId), [confirmed, setConfirmed] = useState(!!unit.profileId)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget)
    const ok = await executar(async () => {
      if (profileId && !confirmed) throw Error('Confirme a planta desta unidade. Não deduzir pelo final.')
      const next: UnidadeVenda = { ...unit, profileId, overrides: lerInformacoes(form), commercialNumber: String(form.get('commercialNumber') ?? '').trim() || null,
        availability: String(form.get('availability')) as UnidadeVenda['availability'] }
      validarLista(units.map(u => u.id === unit.id ? next : u), model)
      if (usaMapaVagas) {
        const vagas = lerVagas(String(form.get('parkingSpaces') ?? ''))
        // Vagas primeiro: se a vaga for de outro apartamento, nada é gravado.
        if (vagas.join() !== vagasAtuais.join()) await salvarVagas(db, propertyId, uid, unit.id, vagas)
      }
      await salvarUnidade(db, propertyId, uid, next)
    })
    if (ok) close()
  }
  const inherited = resolverInformacoes({ ...unit, profileId, overrides: { priceCents: null, areaM2: null, bedrooms: null, bathrooms: null, parking: null, description: null, conditions: null } }, profiles)
  const torre = unit.tower === undefined ? '' : `${tr("Torre")} ${String(unit.tower).padStart(2, '0')} · `
  const posicao = `${torre}${tr("Pavimento")} ${unit.floor} · ${tr("Final")} ${String(unit.final).padStart(2, '0')}`
  return <Cartao titulo={`${tr("Editar")} ${unit.commercialNumber || posicao}`}>
    <form onSubmit={submit} className="space-y-4" aria-label="Ficha da unidade">
      <p className="text-xs text-slate-500">Posição técnica: {unit.id}. Preencha a numeração comercial confirmada. Esta ficha contém somente informações públicas.</p>
      <fieldset disabled={ocupado} className="space-y-3">
        <label className="block text-sm">{tr("Número comercial")}<input className="campo mt-1" name="commercialNumber" maxLength={100} defaultValue={unit.commercialNumber ?? ''} /></label>
        {usaMapaVagas && <label className="block text-sm">{tr("Vagas na implantação")}<input className="campo mt-1" name="parkingSpaces" inputMode="numeric"
          defaultValue={vagasAtuais.join(', ')} placeholder="Ex.: 87 ou 12, 13" />
          <span className="mt-1 block text-xs text-slate-500">Números de 1 a {TOTAL_VAGAS} da planta de implantação. Na maquete, estas vagas piscam junto com o apartamento.</span></label>}
        <label className="block text-sm">{tr("Disponibilidade")}<select aria-label={tr("Disponibilidade")} className="campo mt-1" name="availability" defaultValue={unit.availability}>
          {Object.entries(SITUACOES).map(([k, label]) => <option key={k} value={k}>{tr(label)}</option>)}
        </select></label>
        <label className="block text-sm">{tr("Planta associada")}<select aria-label={tr("Planta associada")} className="campo mt-1" value={profileId ?? ''} onChange={e => { setProfileId((e.target.value || null) as Planta | null); setConfirmed(false) }}>
          <option value="">{tr("Em conferência / sem associação")}</option><option value="canto">{tr("Canto — orientação original")}</option><option value="meio">{tr("Meio — orientação original")}</option>
        </select></label>
        {profileId && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} required />
          Conferi que esta unidade usa a planta selecionada na orientação original. Espelhamentos exigem outra variante de planta e Tour.</label>}
        <p className="text-xs text-slate-500">{tr("Campos vazios abaixo usam os dados comuns da planta. Preencha apenas as diferenças desta unidade.")}</p>
        <CamposDaFicha key={profileId ?? 'sem-planta'} values={unit.overrides} inherited={inherited} />
      </fieldset>
      <div className="flex gap-2"><button disabled={ocupado} className="btn-primario">{tr("Salvar unidade")}</button>
        <button disabled={ocupado} className="btn" type="button" onClick={close}>{tr("Cancelar")}</button></div>
      {erro && <Aviso>{erro}</Aviso>}
    </form>
  </Cartao>
}
export function EditorDePerfil({ profile, propertyId, uid, close }: { profile: PerfilVenda; propertyId: string; uid: string; close: () => void }) {
  const { t: tr } = useIdioma()

  const { executar, ocupado, erro } = useAcao()
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget)
    const ok = await executar(() => salvarPerfil(db, propertyId, uid, { ...profile, info: lerInformacoes(form) }))
    if (ok) close()
  }
  return <Cartao titulo={`Dados comuns — ${profile.id === 'canto' ? tr("Canto") : tr("Meio")}`}>
    <form onSubmit={submit} className="space-y-4" aria-label={tr("Dados comuns da planta")}>
      <p className="text-sm text-slate-500">Uma alteração vale para todas as unidades associadas a esta planta, preservando as diferenças preenchidas individualmente.</p>
      <fieldset disabled={ocupado}><CamposDaFicha values={profile.info} /></fieldset>
      <div className="flex gap-2"><button disabled={ocupado} className="btn-primario">{tr("Salvar dados comuns")}</button>
        <button disabled={ocupado} className="btn" type="button" onClick={close}>{tr("Cancelar")}</button></div>
      {erro && <Aviso>{erro}</Aviso>}
    </form>
  </Cartao>
}
