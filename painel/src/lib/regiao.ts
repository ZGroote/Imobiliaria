export type Idioma = 'pt-BR' | 'en'
export interface Regiao { country: string; locale: Idioma; currency: string; timeZone: string }
export const REGIAO_PADRAO: Regiao = { country: 'BR', locale: 'pt-BR', currency: 'BRL', timeZone: 'America/Sao_Paulo' }
export const REGIOES: Record<string, Regiao> = {
  BR: REGIAO_PADRAO,
  US: { country: 'US', locale: 'en', currency: 'USD', timeZone: 'America/New_York' },
  GB: { country: 'GB', locale: 'en', currency: 'GBP', timeZone: 'Europe/London' },
  CA: { country: 'CA', locale: 'en', currency: 'CAD', timeZone: 'America/Toronto' },
  AU: { country: 'AU', locale: 'en', currency: 'AUD', timeZone: 'Australia/Sydney' },
  PT: { country: 'PT', locale: 'pt-BR', currency: 'EUR', timeZone: 'Europe/Lisbon' },
}
export function validarRegiao(value: Regiao): Regiao {
  if (!/^[A-Z]{2}$/.test(value.country) || !['pt-BR', 'en'].includes(value.locale)
    || !['BRL','USD','GBP','CAD','AUD','EUR'].includes(value.currency)) throw Error('Região inválida.')
  try { new Intl.DateTimeFormat(value.locale, { timeZone: value.timeZone }).format() } catch { throw Error('Fuso horário inválido.') }
  return { country: value.country, locale: value.locale, currency: value.currency, timeZone: value.timeZone }
}
export function moeda(value: number | null, region = REGIAO_PADRAO) {
  return value == null ? '—' : new Intl.NumberFormat(region.locale, { style: 'currency', currency: region.currency }).format(value / 100)
}
