// Contrato painel ↔ pipeline (proposta §9). O painel só LÊ o que o Python publicou:
//   manifest.json ao lado de cada build (o que é o preview) e estado.json no site (o que está no ar).
// Nenhuma escrita aqui; nada de Firebase no pipeline.
import type { Preview } from './types.ts'

export const BUILD = /^[0-9a-f]{12}$/
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

export interface Manifesto {
  schema: 1; imovel: string; build: string
  arquivos: Record<string, { bytes: number; sha256: string }>
}

export type Buscar = (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>
// O manifest é lido em bytes: o hash tem de ser do arquivo servido, não de um JSON reinterpretado.
type BuscarBytes = (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>

function url(texto: string) {
  let u: URL
  try { u = new URL(texto.trim()) } catch { throw new Error('Cole o endereço completo do tour, começando com https://.') }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('O endereço precisa começar com https://.')
  return u
}

// O manifest precisa descrever ESTE imóvel e ESTE build, e o endereço precisa ser o do build.
export function validarManifesto(m: unknown, esperado: { imovel: string; pasta: string }): Manifesto {
  const x = m as Partial<Manifesto> | null
  if (!x || x.schema !== 1) throw new Error('manifest.json fora do formato esperado (schema 1).')
  if (typeof x.imovel !== 'string' || !SLUG.test(x.imovel)) throw new Error('manifest.json sem o id do imóvel.')
  if (x.imovel !== esperado.imovel) {
    throw new Error(`Este preview é de "${x.imovel}", mas o imóvel do pedido é "${esperado.imovel}".`)
  }
  if (typeof x.build !== 'string' || !BUILD.test(x.build)) throw new Error('manifest.json sem um build válido (12 hex).')
  if (!x.arquivos?.['tour.html'] || !x.arquivos?.['maquete.html']) throw new Error('O build não tem tour.html e maquete.html.')
  if (!esperado.pasta.endsWith(`/b/${x.imovel}/${x.build}/`)) {
    throw new Error(`O endereço não é o do build ${x.build}: esperado …/b/${x.imovel}/${x.build}/tour.html.`)
  }
  return x as Manifesto
}

// O que o estado.json DO SITE diz estar no ar para um imóvel (o painel nunca usa cópia local).
export function noAr(estado: unknown, unidade: string): { atual: string; anterior: string | null } {
  const e = estado as { schema?: number; imoveis?: Record<string, { atual?: unknown; anterior?: unknown }> } | null
  if (!e || e.schema !== 1 || typeof e.imoveis !== 'object') throw new Error('estado.json fora do formato esperado (schema 1).')
  const i = e.imoveis[unidade]
  if (!i) throw new Error(`O site de imóveis ainda não tem "${unidade}" no ar.`)
  if (typeof i.atual !== 'string' || !BUILD.test(i.atual)) throw new Error(`estado.json sem um build válido para "${unidade}".`)
  const anterior = typeof i.anterior === 'string' && BUILD.test(i.anterior) ? i.anterior : null
  return { atual: i.atual, anterior }
}

const raizDoSite = (site: string) => url(site.endsWith('/') ? site : site + '/')

export async function lerEstado(site: string, unidade: string, buscar: Buscar = fetch) {
  const r = await buscar(new URL('estado.json', raizDoSite(site)).href, { cache: 'no-store' })
  if (!r.ok) throw new Error(`Não consegui ler o estado.json do site de imóveis (HTTP ${r.status}).`)
  return noAr(await r.json(), unidade)
}

// Os ponteiros estáveis do imóvel (§8): nunca mudam; o que muda é o build para onde apontam.
export const linksPublicos = (site: string, unidade: string) => ({
  tourUrl: new URL(`imovel/${unidade}`, raizDoSite(site)).href,
  maqueteUrl: new URL(`maquete/${unidade}`, raizDoSite(site)).href,
})

// "Registrar publicado" só depois de ver no site que o build está no ar (§2).
export function conferirNoAr(estado: { atual: string }, esperado: string, comando: string) {
  if (estado.atual !== esperado) {
    throw new Error(`No ar está o build ${estado.atual}, e o esperado é ${esperado}. Rode ${comando} e confira de novo.`)
  }
}

// O operador cola a URL do tour em preview; o painel lê o manifest.json da mesma pasta. O hash
// é dos BYTES servidos, não de um JSON serializado de novo: é o artefato exato que se aprova
// (build once, promote the exact artifact). A leitura do JSON vem depois, só para validar.
export async function lerPreview(urlDoTour: string, pipelineUnitId: string, buscar: BuscarBytes = fetch): Promise<Preview> {
  const pasta = new URL('./', url(urlDoTour))
  const r = await buscar(new URL('manifest.json', pasta).href, { cache: 'no-store' })
  if (!r.ok) throw new Error(`Não encontrei o manifest.json ao lado do tour (HTTP ${r.status}).`)
  const bytes = await r.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const manifestSha256 = [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join('')
  let json: unknown
  try { json = JSON.parse(new TextDecoder().decode(bytes)) } catch { throw new Error('manifest.json não é um JSON válido.') }
  const m = validarManifesto(json, { imovel: pipelineUnitId, pasta: pasta.pathname })
  return { build: m.build, tourUrl: new URL('tour.html', pasta).href, maqueteUrl: new URL('maquete.html', pasta).href,
    manifestSha256 }
}

// O comando que põe no ar EXATAMENTE o artefato aprovado: o build e o manifest congelados na
// aprovação (nunca o preview que por acaso esteja no pedido).
export const comandoPromover = (unidade: string, build: string, manifestSha256: string) =>
  `python pipeline/publicar_imovel.py montar-live promover ${unidade} ${build} --estado <estado-live.json> --manifest-aprovado ${manifestSha256}`

// O preview: montar a pasta de deploy com o build e subir SÓ no canal de preview do imóvel.
export const comandosPreview = (unidade: string) => [
  `python pipeline/publicar_imovel.py montar-preview ${unidade} <build>`,
  `firebase hosting:channel:deploy imovel-${unidade} --only imoveis --config firebase.imoveis.json --project imobilaria-deccb --expires 30d`,
]

// Reverter volta ao build anterior, que já está no ar e no estado.json: sem aprovação nova.
export const comandoReverter = (unidade: string) =>
  `python pipeline/publicar_imovel.py montar-live reverter ${unidade} --estado <estado-live.json>`
