import {createHash} from 'node:crypto'
import {mensagemConvite, LIMITE_DIARIO} from './config.mjs'

const versao = t => t && Number.isInteger(t.seconds) && Number.isInteger(t.nanoseconds) ? `${t.seconds}:${t.nanoseconds}` : null
const JANELA = 23 * 60 * 60 * 1000 // Resend mantém a idempotência por 24h; nunca repetir além dela.

export async function processarConvite(evento, {db, enviar, agora = Date.now}) {
  const depois = evento.data?.after
  if (!depois?.exists) return 'ignorado'
  const convite = depois.data(), geracao = versao(convite.createdAt)
  if (!geracao || (evento.data.before?.exists && versao(evento.data.before.data().createdAt) === geracao)) return 'ignorado'
  const ref = depois.ref
  const chave = createHash('sha256').update(`${ref.path}/${geracao}`).digest('hex')
  const instante = agora()
  const dia = new Date(instante).toISOString().slice(0,10)
  const quota = db.doc(`emailQuota/${dia}`)
  const estado = (status, extra = {}) => ({eventId:chave, status, quotaDay:dia, updatedAt:new Date(agora()), ...extra})

  const preparacao = await db.runTransaction(async tx => {
    const atual = await tx.get(ref)
    if (!atual.exists || versao(atual.data().createdAt) !== geracao) return {status:'cancelado'}
    const anterior = atual.data().emailDelivery
    if (anterior?.eventId === chave && ['accepted','failed'].includes(anterior.status)) return {status:anterior.status}
    const falhar = codigo => {
      tx.update(ref, {emailDelivery:estado('failed',{code:codigo})})
      return {status:'failed'}
    }
    const idade = instante - convite.createdAt.toMillis()
    if (idade >= JANELA || idade < -5 * 60 * 1000) return falhar('expired')
    let mensagem
    try {
      mensagem = mensagemConvite(convite)
      if (convite.email !== ref.id) return falhar('invalid_invite')
    } catch { return falhar('invalid_invite') }
    if (typeof convite.createdBy !== 'string' || !/^[^/]{1,128}$/.test(convite.createdBy)) return falhar('unauthorized')
    const autor = (await tx.get(db.doc(`users/${convite.createdBy}`))).data()
    if (!autor?.active) return falhar('unauthorized')
    if (autor.role !== 'platform_admin' && !(autor.role === 'agency_manager' && convite.role === 'agent'
        && autor.agencyId === convite.agencyId)) return falhar('unauthorized')
    if (['agent','agency_manager'].includes(convite.role)) {
      if (typeof convite.agencyId !== 'string' || !/^[^/]{1,128}$/.test(convite.agencyId)) return falhar('invalid_agency')
      const agencia = (await tx.get(db.doc(`agencies/${convite.agencyId}`))).data()
      if (!agencia?.active) return falhar('invalid_agency')
    }
    // Uma repetição do mesmo evento reutiliza a reserva e a mesma chave do Resend.
    if (anterior?.eventId !== chave || anterior?.quotaDay !== dia) {
      const usado = (await tx.get(quota)).data()?.count ?? 0
      if (usado >= LIMITE_DIARIO) return falhar('daily_limit')
      tx.set(quota, {count:usado + 1, updatedAt:new Date(instante)})
    }
    tx.update(ref, {emailDelivery:estado('processing')})
    return {mensagem}
  })
  if (!preparacao.mensagem) return preparacao.status

  async function registrar(status, extra = {}) {
    await db.runTransaction(async tx => {
      const atual = await tx.get(ref)
      if (atual.exists && versao(atual.data().createdAt) === geracao && atual.data().emailDelivery?.eventId === chave) {
        tx.update(ref, {emailDelivery:estado(status,extra)})
      }
    })
  }
  try {
    const resposta = await enviar(preparacao.mensagem, `convite/${chave}`)
    if (typeof resposta?.id !== 'string' || !resposta.id) throw new Error('Resposta de envio incompleta.')
    await registrar('accepted', {messageId:resposta.id})
    return 'accepted'
  } catch (e) {
    if (e.repetir !== false) throw new Error('Falha temporária no envio do convite; repetir com a mesma chave.')
    await registrar('failed', {code:'provider_rejected'})
    return 'failed'
  }
}
