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

type Buscar = (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

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

// O operador cola a URL do tour em preview; o painel lê o manifest.json da mesma pasta.
export async function lerPreview(urlDoTour: string, pipelineUnitId: string, buscar: Buscar = fetch): Promise<Preview> {
  const pasta = new URL('./', url(urlDoTour))
  const r = await buscar(new URL('manifest.json', pasta).href, { cache: 'no-store' })
  if (!r.ok) throw new Error(`Não encontrei o manifest.json ao lado do tour (HTTP ${r.status}).`)
  const m = validarManifesto(await r.json(), { imovel: pipelineUnitId, pasta: pasta.pathname })
  return { build: m.build, tourUrl: new URL('tour.html', pasta).href, maqueteUrl: new URL('maquete.html', pasta).href }
}
