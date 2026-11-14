// Modelo compartilhado entre o painel e o leitor público (compilado pelo esbuild).
export const BOOK_SHA = 'c7dae676c82eab758370e386cea7fe6bd31dded9fa436eb53ebdfe70be7bb50b'
export const BOOK_SHA_LARANJEIRAS = 'c90d9d22d6252f86a4597fb33ac22f9ea1d11ee2a5c8608fda8e7552af956911'
export const MODELO_LARANJEIRAS = 'parque-das-laranjeiras'
export const CATALOGOS_ESTOQUE = {
  'liv-ipanema': { bookSHA256: BOOK_SHA, total: 170, torres: 1, pavimentos: 17, finais: 10 },
  [MODELO_LARANJEIRAS]: { bookSHA256: BOOK_SHA_LARANJEIRAS, total: 312, torres: 3, pavimentos: 13, finais: 8 },
} as const
export type ModeloEstoque = keyof typeof CATALOGOS_ESTOQUE
export const ehModeloEstoque = (v: unknown): v is ModeloEstoque => typeof v === 'string' && Object.hasOwn(CATALOGOS_ESTOQUE, v)
export const SITUACOES = { nao_informada: 'Não informada', disponivel: 'Disponível', reservada: 'Reservada', vendida: 'Vendida', bloqueada: 'Bloqueada' } as const
export type Situacao = keyof typeof SITUACOES
export type Planta = 'canto' | 'meio'
export interface Informacoes {
  priceCents: number | null; areaM2: number | null; bedrooms: number | null; bathrooms: number | null
  parking: string | null; description: string | null; conditions: string | null
}
export interface Registro { revision: number; updatedAt: unknown; lastChangeId: string }
export interface Estoque extends Registro {
  schema: 'liv-sales-v1'; bookSHA256: string; model: ModeloEstoque; total: 170 | 312; title: string; publicEnabled: boolean
}
export interface UnidadeVenda extends Registro {
  id: string; floor: number; final: number; tower?: number; technicalId: string; commercialNumber: string | null
  availability: Situacao; profileId: Planta | null; overrides: Informacoes
}
export interface PerfilVenda extends Registro { id: Planta; info: Informacoes }
export const vazias = (): Informacoes => ({ priceCents: null, areaM2: null, bedrooms: null, bathrooms: null, parking: null, description: null, conditions: null })
const doisDigitos = (n: number) => String(n).padStart(2, '0')
export const chaveDaUnidade = (floor: number, final: number, tower?: number) =>
  `${tower === undefined ? '' : `t${doisDigitos(tower)}-`}p${doisDigitos(floor)}-f${doisDigitos(final)}`
export const idTecnico = (floor: number, final: number, tower?: number) => {
  const prefixo = tower === undefined ? 'liv-ipanema/pavimento-modelo' : `laranjeiras/torre-${doisDigitos(tower)}/pavimento`
  return `${prefixo}-${doisDigitos(floor)}/final-${doisDigitos(final)}`
}
export function posicoes(model: ModeloEstoque = 'liv-ipanema') {
  const { total, pavimentos, finais } = CATALOGOS_ESTOQUE[model]
  const porTorre = pavimentos * finais
  return Array.from({ length: total }, (_, i) => {
    const floor = Math.floor((i % porTorre) / finais), final = i % finais + 1
    const tower = model === MODELO_LARANJEIRAS ? Math.floor(i / porTorre) + 1 : undefined
    return { id: chaveDaUnidade(floor, final, tower), floor, final, technicalId: idTecnico(floor, final, tower), ...(tower === undefined ? {} : { tower }) }
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
export function validarUnidade(v: unknown, model: ModeloEstoque = 'liv-ipanema'): UnidadeVenda {
  const x = objeto(v), floor = x.floor as number, final = x.final as number, tower = x.tower as number | undefined
  const { torres, pavimentos, finais } = CATALOGOS_ESTOQUE[model]
  const torreValida = model === MODELO_LARANJEIRAS ? tower !== undefined && Number.isInteger(tower) && tower >= 1 && tower <= torres : tower === undefined
  if (!torreValida || !Number.isInteger(floor) || floor < 0 || floor >= pavimentos || !Number.isInteger(final) || final < 1 || final > finais ||
    x.id !== chaveDaUnidade(floor, final, tower) || x.technicalId !== idTecnico(floor, final, tower) ||
    typeof x.availability !== 'string' || !Object.hasOwn(SITUACOES, x.availability) ||
    (x.profileId !== null && !['canto', 'meio'].includes(x.profileId as string))) throw Error('Posição, planta ou disponibilidade inválida.')
  const number = texto(x.commercialNumber, 100)?.normalize('NFKC').toLocaleUpperCase('pt-BR') ?? null
  if (number !== null && !/^[A-Z0-9 _-]{1,100}$/.test(number)) throw Error('Use letras, números, espaço ou hífen no número comercial (ex.: TORRE A-101).')
  return { ...x, commercialNumber: number, overrides: validarInformacoes(x.overrides) } as unknown as UnidadeVenda
}
export function validarEstoque(v: unknown): Estoque {
  const x = objeto(v)
  if (x.schema !== 'liv-sales-v1' || !ehModeloEstoque(x.model) || x.bookSHA256 !== CATALOGOS_ESTOQUE[x.model].bookSHA256 || x.total !== CATALOGOS_ESTOQUE[x.model].total ||
    typeof x.publicEnabled !== 'boolean' || !Number.isSafeInteger(x.revision) || (x.revision as number) < 1 || !texto(x.title, 200)) throw Error('Estoque de outra revisão.')
  return x as unknown as Estoque
}
export function resolverInformacoes(unit: UnidadeVenda, profiles: PerfilVenda[]): Informacoes {
  const base = profiles.find(p => p.id === unit.profileId)?.info ?? vazias()
  return Object.fromEntries(Object.keys(base).map(k => [k, unit.overrides[k as keyof Informacoes] ?? base[k as keyof Informacoes]])) as unknown as Informacoes
}
export function validarLista(units: UnidadeVenda[], model: ModeloEstoque = 'liv-ipanema') {
  const { total } = CATALOGOS_ESTOQUE[model]
  if (units.length !== total || new Set(units.map(u => validarUnidade(u, model).id)).size !== total) throw Error(`O cadastro precisa conter as ${total} posições, sem duplicatas.`)
  const numbers = units.map(u => u.commercialNumber?.normalize('NFKC').toLocaleUpperCase('pt-BR')).filter(Boolean)
  if (new Set(numbers).size !== numbers.length) throw Error('Número comercial repetido. Confira o cadastro.')
  return units
}
// Vagas numeradas da implantação oficial (1–175). Um documento só guarda vaga → unidade,
// então a mesma vaga nunca pertence a dois apartamentos.
export const TOTAL_VAGAS = 175, VAGAS_POR_UNIDADE = 4
export interface VagasVenda extends Registro { id: 'mapa'; spaces: Record<string, string> }
export function validarVagas(v: unknown): Record<string, string> {
  const spaces = objeto(objeto(v).spaces), unidades = new Set(posicoes().map(p => p.id)), contagem = new Map<string, number>()
  for (const [vaga, unidade] of Object.entries(spaces)) {
    if (!/^[1-9]\d{0,2}$/.test(vaga) || Number(vaga) > TOTAL_VAGAS || typeof unidade !== 'string' || !unidades.has(unidade)) throw Error('Mapa de vagas inválido.')
    contagem.set(unidade, (contagem.get(unidade) ?? 0) + 1)
  }
  if ([...contagem.values()].some(n => n > VAGAS_POR_UNIDADE)) throw Error('Mapa de vagas inválido.')
  return spaces as Record<string, string>
}
export const vagasDaUnidade = (spaces: Record<string, string>, unitKey: string) =>
  Object.keys(spaces).filter(k => spaces[k] === unitKey).map(Number).sort((a, b) => a - b)
export function lerVagas(texto: string): number[] {
  const partes = texto.split(/[\s,;]+/).filter(Boolean)
  if (partes.some(p => !/^\d{1,3}$/.test(p) || Number(p) < 1 || Number(p) > TOTAL_VAGAS)) throw Error(`Use números de vaga de 1 a ${TOTAL_VAGAS}, separados por vírgula.`)
  const vagas = [...new Set(partes.map(Number))].sort((a, b) => a - b)
  if (vagas.length > VAGAS_POR_UNIDADE) throw Error(`No máximo ${VAGAS_POR_UNIDADE} vagas por apartamento.`)
  return vagas
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
