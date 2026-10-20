'use client'
import { centavos, validarInformacoes, type Informacoes } from '@/lib/estoque-modelo'

export function lerInformacoes(form: FormData): Informacoes {
  const s = (k: string) => String(form.get(k) ?? '').trim(), n = (k: string) => s(k) ? Number(s(k).replace(',', '.')) : null
  return validarInformacoes({ priceCents: centavos(s('price')), areaM2: n('areaM2'), bedrooms: n('bedrooms'), bathrooms: n('bathrooms'),
    parking: s('parking') || null, description: s('description') || null, conditions: s('conditions') || null })
}
export function valorPreco(cents: number | null) {
  return cents === null ? '' : `${BigInt(cents) / 100n},${String(cents % 100).padStart(2, '0')}`
}
export function CamposDaFicha({ values, inherited }: { values: Informacoes; inherited?: Informacoes }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <label className="block text-sm">Preço (R$)<input className="campo mt-1" name="price" inputMode="decimal"
      defaultValue={valorPreco(values.priceCents)} placeholder={inherited?.priceCents !== undefined ? valorPreco(inherited.priceCents) || 'Não informado' : 'Não informado'} /></label>
    <label className="block text-sm">Área publicada (m²)<input className="campo mt-1" type="number" name="areaM2" min="0" max="10000" step="0.01"
      defaultValue={values.areaM2 ?? ''} placeholder={String(inherited?.areaM2 ?? 'Não informada')} /></label>
    {(['bedrooms', 'bathrooms'] as const).map((key, i) => <label key={key} className="block text-sm">{i === 0 ? 'Quartos' : 'Banheiros'}
      <input className="campo mt-1" type="number" name={key} min="0" max="100" step="1" defaultValue={values[key] ?? ''} placeholder={String(inherited?.[key] ?? 'Não informado')} /></label>)}
    <label className="block text-sm sm:col-span-2">Vaga / estacionamento<input className="campo mt-1" name="parking" maxLength={200}
      defaultValue={values.parking ?? ''} placeholder={inherited?.parking ?? 'Não informado'} /></label>
    {(['description', 'conditions'] as const).map((key, i) => <label key={key} className="block text-sm sm:col-span-2">{i === 0 ? 'Descrição pública' : 'Condições públicas'}
      <textarea className="campo mt-1" name={key} maxLength={2000} rows={3} defaultValue={values[key] ?? ''} placeholder={inherited?.[key] ?? 'Não informadas'} /></label>)}
  </div>
}
