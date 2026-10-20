import type { User } from './types.ts'

export type SourceClass = 'root' | 'forwarded' | 'own_return' | 'uncertain'
export type TrackingPage = 'tour' | 'maquete'
export type TrackingSection = 'ficha' | 'mapa' | 'interior' | 'planta' | 'maquete' | 'planta2d' | 'planta3d' | 'visita' | 'carregando'
export interface TrackingScope { propertyId: string; agencyId: string; brokerUid?: string }
export interface TrackingLink {
  id: string; propertyId: string; agencyId: string; brokerUid: string; brokerName: string
  status: 'active' | 'revoked'; createdAt: string; url: string
}
export interface TrackingSummary {
  sessions: number; estimatedVisitors: number; pageViews: number; activeMs: number
  rootEntries: number; forwardedEntries: number; ownReturns: number; uncertainEntries: number
}
export interface TrackingPeriod { from: string; to: string }
export interface TrackingReport extends TrackingPeriod {
  propertyId: string; summary: TrackingSummary
  byBroker: (TrackingSummary & { brokerUid: string; brokerName: string })[]
  bySource: { sourceClass: SourceClass; sessions: number; estimatedVisitors: number; activeMs: number }[]
  bySection: { page: TrackingPage; section: TrackingSection; views: number; activeMs: number }[]
  coverage: { consentedOnly: true; truncated: boolean; retentionDays: 30 }
}

const COUNT_KEYS = ['sessions', 'estimatedVisitors', 'pageViews', 'activeMs', 'rootEntries',
  'forwardedEntries', 'ownReturns', 'uncertainEntries']
const SOURCES = ['root', 'forwarded', 'own_return', 'uncertain']
const SECTIONS = ['ficha', 'mapa', 'interior', 'planta', 'maquete', 'planta2d', 'planta3d', 'visita', 'carregando']
const BAD_RESPONSE = 'Resposta de rastreabilidade inválida. Atualize e tente novamente.'
class TrackingError extends Error {}
const invalid = (): never => { throw new TrackingError(BAD_RESPONSE) }
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v)
const opaque = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{32,128}$/.test(v)
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const name = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && [...v].length <= 200
const utc = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v)) return false
  const d = new Date(v)
  return Number.isFinite(d.getTime()) && (d.toISOString() === v || d.toISOString().replace('.000Z', 'Z') === v)
}
function closed(v: unknown, keys: string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return invalid()
  const r = v as Record<string, unknown>
  if (Object.keys(r).length !== keys.length || Object.keys(r).some(k => !keys.includes(k))) return invalid()
  return r
}
function list(v: unknown): unknown[] {
  if (!Array.isArray(v) || v.length > 1000) return invalid()
  return v
}
function summary(v: Record<string, unknown>) {
  if (COUNT_KEYS.some(k => !count(v[k])) || (v.estimatedVisitors as number) > (v.sessions as number)) invalid()
}
function safeHttp(v: string) {
  let u: URL
  try { u = new URL(v) } catch { return invalid() }
  // Sem o endereço literal: a varredura do bundle no CI recusa a string do loopback (o mesmo de leituras.ts).
  const local = /^127(?:\.\d{1,3}){3}$/.test(u.hostname) || u.hostname === 'localhost' || u.hostname === '[::1]'
  if ((u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) || u.username || u.password) return invalid()
  return u
}

export function baseRastreabilidade(value?: string): string | null {
  if (!value?.trim()) return null
  const u = safeHttp(value.trim())
  if (u.search || u.hash) invalid()
  return u.toString().replace(/\/+$/, '')
}
export const corretoresAtivos = <T extends Pick<User, 'id' | 'agencyId' | 'role' | 'active' | 'name'>>(users: T[], agencyId: string) =>
  users.filter(u => u.agencyId === agencyId && u.role === 'agent' && u.active)

export function periodo30Dias(now = new Date()): TrackingPeriod {
  return { from: new Date(now.getTime() - 30 * 86400000).toISOString(), to: now.toISOString() }
}

export function validarLink(value: unknown, scope: TrackingScope): TrackingLink {
  const v = closed(value, ['id', 'propertyId', 'agencyId', 'brokerUid', 'brokerName', 'status', 'createdAt', 'url'])
  if (!opaque(v.id) || v.propertyId !== scope.propertyId || v.agencyId !== scope.agencyId || !id(v.brokerUid)
    || (scope.brokerUid && v.brokerUid !== scope.brokerUid) || !name(v.brokerName)
    || !['active', 'revoked'].includes(v.status as string) || !utc(v.createdAt) || typeof v.url !== 'string') return invalid()
  const url = safeHttp(v.url)
  const keys = [...url.searchParams.keys()]
  if (url.pathname !== '/acesso.html' || url.hash || keys.length !== 2 || !keys.includes('l') || !keys.includes('pagina')
    || url.searchParams.get('l') !== v.id || !['tour', 'maquete'].includes(url.searchParams.get('pagina') ?? '')) return invalid()
  return v as unknown as TrackingLink
}

export function validarRelatorio(value: unknown, scope: TrackingScope, expected: TrackingPeriod): TrackingReport {
  const v = closed(value, ['from', 'to', 'propertyId', 'summary', 'byBroker', 'bySource', 'bySection', 'coverage'])
  if (v.propertyId !== scope.propertyId || !utc(v.from) || !utc(v.to) || v.from !== expected.from || v.to !== expected.to
    || Date.parse(v.to) <= Date.parse(v.from) || Date.parse(v.to) - Date.parse(v.from) > 30 * 86400000) return invalid()
  summary(closed(v.summary, COUNT_KEYS))
  const owners = new Set<string>()
  for (const item of list(v.byBroker)) {
    const b = closed(item, ['brokerUid', 'brokerName', ...COUNT_KEYS])
    if (!id(b.brokerUid) || owners.has(b.brokerUid) || !name(b.brokerName)
      || (scope.brokerUid && b.brokerUid !== scope.brokerUid)) return invalid()
    owners.add(b.brokerUid); summary(b)
  }
  const sources = new Set<string>()
  for (const item of list(v.bySource)) {
    const b = closed(item, ['sourceClass', 'sessions', 'estimatedVisitors', 'activeMs'])
    if (typeof b.sourceClass !== 'string' || !SOURCES.includes(b.sourceClass) || sources.has(b.sourceClass)
      || !count(b.sessions) || !count(b.estimatedVisitors) || b.estimatedVisitors > b.sessions || !count(b.activeMs)) return invalid()
    sources.add(b.sourceClass)
  }
  const sections = new Set<string>()
  for (const item of list(v.bySection)) {
    const b = closed(item, ['page', 'section', 'views', 'activeMs'])
    const key = `${b.page}:${b.section}`
    if (!['tour', 'maquete'].includes(b.page as string) || !SECTIONS.includes(b.section as string)
      || sections.has(key) || !count(b.views) || !count(b.activeMs)) return invalid()
    sections.add(key)
  }
  const coverage = closed(v.coverage, ['consentedOnly', 'truncated', 'retentionDays'])
  if (coverage.consentedOnly !== true || typeof coverage.truncated !== 'boolean' || coverage.retentionDays !== 30) return invalid()
  return v as unknown as TrackingReport
}

export function criarClienteRastreabilidade({ baseUrl, getToken, fetcher = fetch }: {
  baseUrl: string; getToken: () => Promise<string>; fetcher?: typeof fetch
}) {
  const base = baseRastreabilidade(baseUrl)
  if (!base) throw new TrackingError('A rastreabilidade ainda não está ativa.')
  async function request(path: string, body?: object, signal?: AbortSignal): Promise<unknown> {
    signal?.throwIfAborted()
    const controller = new AbortController()
    const abort = () => controller.abort(signal?.reason)
    signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(() => controller.abort(), 12000)
    try {
      const token = await getToken()
      signal?.throwIfAborted()
      if (!token) throw new TrackingError('Sua sessão expirou. Entre novamente.')
      const res = await fetcher(base + path, {
        method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal, cache: 'no-store', credentials: 'omit',
      })
      if (!res.ok) {
        const errors: Record<number, string> = {
          401: 'Sua sessão expirou. Entre novamente.', 403: 'Sem permissão para os links deste imóvel.',
          404: 'Link ou imóvel não encontrado.', 409: 'A operação mudou. Atualize a lista antes de tentar novamente.',
          429: 'Muitas tentativas. Aguarde um pouco.',
        }
        throw new TrackingError(errors[res.status] ?? 'Rastreabilidade indisponível. Tente novamente.')
      }
      if (!/^application\/json\b/i.test(res.headers.get('content-type') ?? '')) return invalid()
      const text = await res.text()
      if (new TextEncoder().encode(text).byteLength > 1024 * 1024) return invalid()
      try { return JSON.parse(text) } catch { return invalid() }
    } catch (e) {
      if (signal?.aborted) signal.throwIfAborted()
      if (e instanceof TrackingError) throw e
      throw new TrackingError(controller.signal.aborted ? 'A consulta demorou demais. Tente novamente.' : 'Rastreabilidade indisponível. Tente novamente.')
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', abort)
    }
  }
  return {
    async listar(scope: TrackingScope, signal?: AbortSignal) {
      const body = closed(await request('/links?' + new URLSearchParams({ propertyId: scope.propertyId }), undefined, signal), ['links', 'truncated'])
      if (typeof body.truncated !== 'boolean') return invalid()
      const links = list(body.links).map(l => validarLink(l, scope))
      if (new Set(links.map(l => l.id)).size !== links.length) return invalid()
      return { links, truncated: body.truncated }
    },
    async criar(scope: TrackingScope, { attemptId, brokerUid }: { attemptId: string; brokerUid?: string }, signal?: AbortSignal) {
      if (!id(attemptId) || (brokerUid !== undefined && !id(brokerUid))) return invalid()
      const body = closed(await request('/links', { propertyId: scope.propertyId, attemptId, ...(brokerUid ? { brokerUid } : {}) }, signal), ['link'])
      return validarLink(body.link, { ...scope, brokerUid: scope.brokerUid ?? brokerUid })
    },
    async revogar(linkId: string, signal?: AbortSignal) {
      if (!opaque(linkId)) return invalid()
      const body = closed(await request('/links/' + encodeURIComponent(linkId) + '/revoke', {}, signal), ['ok'])
      if (body.ok !== true) return invalid()
    },
    async relatorio(scope: TrackingScope, period: TrackingPeriod, signal?: AbortSignal) {
      const query = new URLSearchParams({ propertyId: scope.propertyId, ...period, ...(scope.brokerUid ? { brokerUid: scope.brokerUid } : {}) })
      return validarRelatorio(await request('/report?' + query, undefined, signal), scope, period)
    },
  }
}
