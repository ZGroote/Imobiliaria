import {createHmac} from 'node:crypto'
import {domainToASCII} from 'node:url'
import {DOMINIO, LIMITE_DIARIO} from './config.mjs'

const LIMITE_CONTATO = 20
const LIMITE_PESSOAL = 3
const INTERVALO = 60_000
const LEASE = 90_000
const JANELA = 23 * 60 * 60 * 1000
const MAX_CORPO = 12 * 1024
const ORIGENS = new Set([
  'https://conectaimoveis3d.com', 'https://www.conectaimoveis3d.com',
  'https://conectaimoveis3d.com.br', 'https://www.conectaimoveis3d.com.br',
  'https://imobilaria-deccb-global.web.app', 'https://imobilaria-deccb-global.firebaseapp.com',
  'https://imobilaria-deccb-miniaturas.web.app', 'https://imobilaria-deccb-miniaturas.firebaseapp.com',
])
const CAMPOS = new Set(['name', 'email', 'company', 'message', 'locale', 'requestId', 'website'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const controles = /[\x00-\x1f\x7f]/

export class ErroContato extends Error {
  constructor(status, code, retryAfter) {
    super(code)
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

function texto(value, max, min = 1) {
  if (typeof value !== 'string' || value.length > max || controles.test(value)) throw new ErroContato(400, 'invalid_request')
  const next = value.trim()
  if (next.length < min) throw new ErroContato(400, 'invalid_request')
  return next
}

function email(value) {
  const input = texto(value, 254), parts = input.split('@')
  if (parts.length !== 2 || !parts[0] || parts[0].length > 64 ||
      !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(parts[0]) ||
      parts[0].startsWith('.') || parts[0].endsWith('.') || parts[0].includes('..')) throw new ErroContato(400, 'invalid_request')
  const domain = domainToASCII(parts[1]).toLowerCase(), labels = domain.split('.')
  if (domain.length > 253 || labels.length < 2 || !/[a-z]/i.test(labels.at(-1)) ||
      labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) throw new ErroContato(400, 'invalid_request')
  const result = `${parts[0]}@${domain}`
  if (result.length > 254) throw new ErroContato(400, 'invalid_request')
  return result
}

export function validarContato(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !CAMPOS.has(key)) || !['en', 'pt-BR'].includes(input.locale) ||
      typeof input.requestId !== 'string' || !UUID.test(input.requestId) ||
      (input.website !== undefined && input.website !== '')) throw new ErroContato(400, 'invalid_request')
  if (typeof input.message !== 'string' || input.message.length > 5000 ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(input.message)) throw new ErroContato(400, 'invalid_request')
  const message = input.message.replace(/\r\n?/g, '\n').trim()
  if (message.length < 10) throw new ErroContato(400, 'invalid_request')
  return {
    name: texto(input.name, 120), email: email(input.email),
    company: input.company === undefined || input.company === '' ? '' : texto(input.company, 160),
    message, locale: input.locale, requestId: input.requestId.toLowerCase(),
  }
}

function mensagemContato(input) {
  return {
    from: `Conecta Imóveis 3D <noreply@${DOMINIO}>`, to: [`contact@${DOMINIO}`], reply_to: input.email,
    subject: input.locale === 'en' ? 'Website enquiry — Conecta Imóveis 3D' : 'Contato pelo site — Conecta Imóveis 3D',
    text: `New website enquiry / Novo contato pelo site\n\nName / Nome: ${input.name}\nEmail: ${input.email}\nCompany / Empresa: ${input.company || '—'}\nLanguage / Idioma: ${input.locale}\n\nMessage / Mensagem:\n${input.message}\n\nReply to this message to contact the sender. / Responda a esta mensagem para falar com o remetente.`,
  }
}

const millis = value => typeof value?.toMillis === 'function' ? value.toMillis() : value instanceof Date ? value.getTime() : null

export async function processarContato(input, {db, enviar, segredo, agora = Date.now}) {
  const value = validarContato(input)
  if (typeof segredo !== 'string' || segredo.length < 16) throw new Error('Contact service unavailable.')
  const digest = text => createHmac('sha256', segredo).update(text).digest('hex')
  const id = digest(`contact/request/${value.requestId}`), instante = agora()
  const dia = new Date(instante).toISOString().slice(0, 10)
  const payloadHash = digest(`contact/payload/${JSON.stringify(value)}`)
  const ref = db.doc(`contactRequests/${id}`), quota = db.doc(`contactQuota/${dia}`)
  const global = db.doc(`emailQuota/${dia}`)
  // The day-specific keyed digest limits a sender without storing their address or any IP.
  const pessoal = db.doc(`contactEmailQuota/${dia}-${digest(`contact/email/${dia}/${value.email.toLowerCase()}`)}`)
  const reservation = await db.runTransaction(async tx => {
    const previous = (await tx.get(ref)).data()
    async function reservarDia() {
      const [localSnap, globalSnap, personSnap] = await Promise.all([tx.get(quota), tx.get(global), tx.get(pessoal)])
      const local = localSnap.data()?.count ?? 0, total = globalSnap.data()?.count ?? 0, person = personSnap.data()
      if (local >= LIMITE_CONTATO || total >= LIMITE_DIARIO || (person?.count ?? 0) >= LIMITE_PESSOAL ||
          (millis(person?.lastAttemptAt) !== null && instante - millis(person.lastAttemptAt) < INTERVALO)) throw new ErroContato(429, 'rate_limited', 60)
      tx.set(quota, {count: local + 1, updatedAt: new Date(instante)})
      tx.set(global, {count: total + 1, updatedAt: new Date(instante)})
      tx.set(pessoal, {count: (person?.count ?? 0) + 1, lastAttemptAt: new Date(instante)})
    }
    if (previous) {
      if (previous.payloadHash !== payloadHash) throw new ErroContato(409, 'request_conflict')
      if (previous.status === 'accepted') return {status: 'accepted'}
      const age = instante - millis(previous.createdAt)
      if (age < 0 || age >= JANELA || previous.retryable === false) {
        throw new ErroContato(503, 'send_failed')
      }
      if (previous.status === 'processing' && millis(previous.leaseUntil) > instante) return {status: 'processing'}
      if (previous.attempts >= 3) throw new ErroContato(503, 'send_failed')
      if (previous.status === 'failed' && millis(previous.updatedAt) + INTERVALO > instante) throw new ErroContato(503, 'send_failed', 60)
      // A retry crossing midnight must reserve the new day's shared provider budget too.
      if (previous.quotaDay !== dia) await reservarDia()
      const attempts = previous.attempts + 1, lease = digest(`contact/lease/${id}/${attempts}/${instante}`)
      tx.update(ref, {status: 'processing', retryable: true, quotaDay: dia, attempts, lease, leaseUntil: new Date(instante + LEASE), updatedAt: new Date(instante)})
      return {status: 'reserved', lease}
    }
    await reservarDia()
    const lease = digest(`contact/lease/${id}/1/${instante}`)
    tx.set(ref, {payloadHash, status: 'processing', quotaDay: dia, attempts: 1, retryable: true, lease,
      createdAt: new Date(instante), updatedAt: new Date(instante), leaseUntil: new Date(instante + LEASE)})
    return {status: 'reserved', lease}
  })
  if (reservation.status !== 'reserved') return {status: reservation.status}

  async function registrar(status, extra) {
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data()
      if (!current || current.payloadHash !== payloadHash || current.status === 'accepted') return
      // A successful idempotent response wins; a late failure cannot overwrite a newer attempt.
      if (status === 'failed' && current.lease !== reservation.lease) return
      tx.update(ref, {status, updatedAt: new Date(agora()), ...extra})
    })
  }
  try {
    const response = await enviar(mensagemContato(value), `contact/${id}`)
    if (typeof response?.id !== 'string' || !response.id || response.id.length > 200) throw new Error('Unconfirmed provider response.')
    await registrar('accepted', {messageId: response.id, retryable: false})
    return {status: 'accepted'}
  } catch (error) {
    const retryable = error.repetir !== false
    console.error('contato: envio falhou:', error?.message) // só status/código do provedor
    await registrar('failed', {retryable})
    throw new ErroContato(503, 'send_failed', retryable ? 60 : undefined)
  }
}

export function criarHandlerContato(deps) {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store')
    res.set('Content-Type', 'application/json; charset=utf-8')
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('Vary', 'Origin')
    const respond = (status, body) => res.status(status).json(body)
    try {
      const origin = req.headers?.origin
      if (typeof origin !== 'string' || !ORIGENS.has(origin)) throw new ErroContato(403, 'forbidden_origin')
      res.set('Access-Control-Allow-Origin', origin)
      if (req.method === 'OPTIONS') {
        if (req.headers['access-control-request-method'] !== 'POST' ||
            (req.headers['access-control-request-headers'] && req.headers['access-control-request-headers'].toLowerCase() !== 'content-type')) throw new ErroContato(403, 'forbidden_origin')
        res.set('Access-Control-Allow-Methods', 'POST')
        res.set('Access-Control-Allow-Headers', 'Content-Type')
        return res.status(204).end()
      }
      if (req.method !== 'POST') {res.set('Allow', 'POST, OPTIONS'); throw new ErroContato(405, 'method_not_allowed')}
      if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] ?? '') || req.headers['content-encoding']) throw new ErroContato(415, 'unsupported_media_type')
      const length = req.headers['content-length']
      if (length !== undefined && (typeof length !== 'string' || !/^\d+$/.test(length))) throw new ErroContato(400, 'invalid_request')
      if (Number(length) > MAX_CORPO || (req.rawBody && req.rawBody.length > MAX_CORPO)) throw new ErroContato(413, 'request_too_large')
      const body = req.rawBody ?? (typeof req.body === 'string' ? Buffer.from(req.body) : Buffer.from(JSON.stringify(req.body ?? null)))
      if (!Buffer.isBuffer(body) || body.length > MAX_CORPO) throw new ErroContato(413, 'request_too_large')
      let input
      try {input = JSON.parse(body.toString('utf8'))} catch {throw new ErroContato(400, 'invalid_request')}
      const result = await processarContato(input, deps)
      if (result.status === 'processing') res.set('Retry-After', '5')
      return respond(result.status === 'accepted' ? 200 : 202, result)
    } catch (error) {
      if (error instanceof ErroContato) {
        if (error.retryAfter) res.set('Retry-After', String(error.retryAfter))
        return respond(error.status, {status: 'failed', error: error.code})
      }
      return respond(503, {status: 'failed', error: 'unavailable'})
    }
  }
}
