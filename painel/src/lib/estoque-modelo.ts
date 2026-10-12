// Modelo compartilhado entre o painel e o leitor público (compilado pelo esbuild).
export const BOOK_SHA = 'c7dae676c82eab758370e386cea7fe6bd31dded9fa436eb53ebdfe70be7bb50b'
export const SITUACOES = { nao_informada: 'Não informada', disponivel: 'Disponível', reservada: 'Reservada', vendida: 'Vendida', bloqueada: 'Bloqueada' } as const
export type Situacao = keyof typeof SITUACOES
export type Planta = 'canto' | 'meio'
export interface Informacoes {
  priceCents: number | null; areaM2: number | null; bedrooms: number | null; bathrooms: number | null
  parking: string | null; description: string | null; conditions: string | null
}
export interface Registro { revision: number; updatedAt: unknown; lastChangeId: string }
export interface Estoque extends Registro {
  schema: 'liv-sales-v1'; bookSHA256: string; model: 'liv-ipanema'; total: 170; title: string; publicEnabled: boolean
}
export interface UnidadeVenda extends Registro {
  id: string; floor: number; final: number; technicalId: string; commercialNumber: string | null
  availability: Situacao; profileId: Planta | null; overrides: Informacoes
}
export interface PerfilVenda extends Registro { id: Planta; info: Informacoes }
export const vazias = (): Informacoes => ({ priceCents: null, areaM2: null, bedrooms: null, bathrooms: null, parking: null, description: null, conditions: null })
export const chaveDaUnidade = (floor: number, final: number) => `p${String(floor).padStart(2, '0')}-f${String(final).padStart(2, '0')}`
export const idTecnico = (floor: number, final: number) => `liv-ipanema/pavimento-modelo-${String(floor).padStart(2, '0')}/final-${String(final).padStart(2, '0')}`
export function posicoes() {
  return Array.from({ length: 170 }, (_, i) => {
    const floor = Math.floor(i / 10), final = i % 10 + 1
    return { id: chaveDaUnidade(floor, final), floor, final, technicalId: idTecnico(floor, final) }
  })
}
function objeto(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('Cadastro inválido.')
  return v as Record<string, unknown>
}
function texto(v: unknown, max: number): string | null {
  if (v === null) return null
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw Error('Texto do cadastro inválido.')
  return v.trim()
}
export function validarInformacoes(v: unknown): Informacoes {
  const x = objeto(v), empty = vazias()
  if (Object.keys(x).length !== 7 || Object.keys(x).some(k => !Object.hasOwn(empty, k))) throw Error('Campos da ficha inválidos.')
  const numero = (key: string, max: number, integer: boolean) => {
    const value = x[key]
    if (value === null) return null
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isSafeInteger(value))) throw Error(`Valor inválido: ${key}.`)
    return value
  }
  return { priceCents: numero('priceCents', Number.MAX_SAFE_INTEGER, true), areaM2: numero('areaM2', 10000, false),
    bedrooms: numero('bedrooms', 100, true), bathrooms: numero('bathrooms', 100, true), parking: texto(x.parking, 200),
    description: texto(x.description, 2000), conditions: texto(x.conditions, 2000) }
}
export function validarUnidade(v: unknown): UnidadeVenda {
  const x = objeto(v), floor = x.floor as number, final = x.final as number
  if (!Number.isInteger(floor) || floor < 0 || floor > 16 || !Number.isInteger(final) || final < 1 || final > 10 ||
    x.id !== chaveDaUnidade(floor, final) || x.technicalId !== idTecnico(floor, final) ||
    typeof x.availability !== 'string' || !Object.hasOwn(SITUACOES, x.availability) ||
    (x.profileId !== null && !['canto', 'meio'].includes(x.profileId as string))) throw Error('Posição, planta ou disponibilidade inválida.')
  const number = texto(x.commercialNumber, 100)?.normalize('NFKC').toLocaleUpperCase('pt-BR') ?? null
  if (number !== null && !/^[A-Z0-9 _-]{1,100}$/.test(number)) throw Error('Use letras, números, espaço ou hífen no número comercial (ex.: TORRE A-101).')
  return { ...x, commercialNumber: number, overrides: validarInformacoes(x.overrides) } as unknown as UnidadeVenda
}
export function validarEstoque(v: unknown): Estoque {
  const x = objeto(v)
  if (x.schema !== 'liv-sales-v1' || x.model !== 'liv-ipanema' || x.bookSHA256 !== BOOK_SHA || x.total !== 170 ||
    typeof x.publicEnabled !== 'boolean' || !Number.isSafeInteger(x.revision) || (x.revision as number) < 1 || !texto(x.title, 200)) throw Error('Estoque de outra revisão.')
  return x as unknown as Estoque
}
export function resolverInformacoes(unit: UnidadeVenda, profiles: PerfilVenda[]): Informacoes {
  const base = profiles.find(p => p.id === unit.profileId)?.info ?? vazias()
  return Object.fromEntries(Object.keys(base).map(k => [k, unit.overrides[k as keyof Informacoes] ?? base[k as keyof Informacoes]])) as unknown as Informacoes
}
export function validarLista(units: UnidadeVenda[]) {
  if (units.length !== 170 || new Set(units.map(u => validarUnidade(u).id)).size !== 170) throw Error('O cadastro precisa conter as 170 posições, sem duplicatas.')
  const numbers = units.map(u => u.commercialNumber?.normalize('NFKC').toLocaleUpperCase('pt-BR')).filter(Boolean)
  if (new Set(numbers).size !== numbers.length) throw Error('Número comercial repetido. Confira o cadastro.')
  return units
}
export function totais(units: UnidadeVenda[]) {
  return Object.fromEntries(Object.keys(SITUACOES).map(k => [k, units.filter(u => u.availability === k).length])) as Record<Situacao, number>
}
// Converte reais digitados em centavos sem arredondar uma multiplicação binária.
export function centavos(v: string): number | null {
  if (!v.trim()) return null
  if (!/^\d+([,.]\d{1,2})?$/.test(v.trim())) throw Error('Use um preço como 350000,00, sem separador de milhar.')
  const [whole, fraction = ''] = v.trim().split(/[,.]/), result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('Preço fora do limite.')
  return Number(result)
}
