import {createHash} from 'node:crypto'
import {DOMINIO, PAINEL, LIMITE_DIARIO} from './config.mjs'

export class ErroVerificacao extends Error {
  constructor(codigo, mensagem) { super(mensagem); this.codigo = codigo }
}

export async function solicitarVerificacao(uid, {db, auth, enviar, agora = Date.now, locale = 'pt-BR'}) {
  if (!['pt-BR','en'].includes(locale)) throw new ErroVerificacao('invalid-argument', 'Idioma inválido.')
  if (typeof uid !== 'string' || !/^[^/]{1,128}$/.test(uid)) throw new ErroVerificacao('unauthenticated', 'Entre na sua conta para confirmar o e-mail.')
  const user = await auth.getUser(uid)
  if (user.disabled || !user.email || !/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(user.email)) {
    throw new ErroVerificacao('permission-denied', 'Não é possível enviar a confirmação para esta conta.')
  }
  if (user.emailVerified) throw new ErroVerificacao('failed-precondition', 'Seu e-mail já está confirmado. Clique em "Já confirmei".')
  const instante = agora(), dia = new Date(instante).toISOString().slice(0,10)
  const pessoal = db.doc(`emailVerificationQuota/${uid}`), global = db.doc(`emailQuota/${dia}`)
  const numero = await db.runTransaction(async tx => {
    const [p, g] = await Promise.all([tx.get(pessoal), tx.get(global)])
    const anterior = p.data(), count = anterior?.day === dia ? anterior.count : 0
    if (anterior?.lastAttemptAt && instante - anterior.lastAttemptAt.toMillis() < 60000) {
      throw new ErroVerificacao('resource-exhausted', 'Aguarde um minuto antes de reenviar o link.')
    }
    if (count >= 5 || (g.data()?.count ?? 0) >= LIMITE_DIARIO) {
      throw new ErroVerificacao('resource-exhausted', 'O limite de e-mails de hoje foi atingido. Tente novamente amanhã.')
    }
    tx.set(pessoal, {day:dia, count:count + 1, lastAttemptAt:new Date(instante)})
    tx.set(global, {count:(g.data()?.count ?? 0) + 1, updatedAt:new Date(instante)})
    return count + 1
  })
  // O Firebase fornece o código; o mesmo handler nativo está no Hosting do domínio próprio.
  const link = new URL(await auth.generateEmailVerificationLink(user.email, {url:PAINEL}))
  if (!['https://imobilaria-deccb.firebaseapp.com', new URL(PAINEL).origin].includes(link.origin)
      || link.pathname !== '/__/auth/action' || link.searchParams.get('mode') !== 'verifyEmail'
      || !link.searchParams.get('oobCode')) throw new Error('Formato inesperado do link de confirmação.')
  link.hostname = new URL(PAINEL).hostname
  link.searchParams.set('continueUrl', PAINEL)
  link.searchParams.set('lang', locale)
  const id = createHash('sha256').update(`${uid}/${dia}/${numero}`).digest('hex')
  await enviar({from:`Conecta Imóveis 3D <noreply@${DOMINIO}>`, to:[user.email], reply_to:`contact@${DOMINIO}`,
    subject:locale === 'en' ? 'Verify your email — Conecta Imóveis 3D' : 'Confirme seu e-mail — Conecta Imóveis 3D',
    text:locale === 'en' ? `Verify your email to access the Conecta Imóveis 3D dashboard.\n\nOpen ${link.href}\n\nThen return to the dashboard to accept your invitation.\n\nIf you did not create this account, ignore this message.\n\nConecta Imóveis 3D`
      : `Confirme seu e-mail para acessar o painel administrativo da Conecta Imóveis 3D.\n\nAbra ${link.href}\n\nDepois, volte ao painel para aceitar seu convite.\n\nSe você não solicitou este cadastro, ignore a mensagem.\n\nConecta Imóveis 3D`,
  }, `verificacao/${id}`)
  return {sent:true}
}
