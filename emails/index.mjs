import {onDocumentWritten} from 'firebase-functions/v2/firestore'
import {defineSecret} from 'firebase-functions/params'
import {onCall, onRequest, HttpsError} from 'firebase-functions/v2/https'
import {initializeApp, getApps} from 'firebase-admin/app'
import {getAuth} from 'firebase-admin/auth'
import {getFirestore} from 'firebase-admin/firestore'
import {processarConvite} from './convites.mjs'
import {clienteResend} from './resend.mjs'
import {solicitarVerificacao, ErroVerificacao} from './verificacao.mjs'
import {PAINEL} from './config.mjs'
import {criarHandlerContato} from './contato.mjs'

const chave = defineSecret('RESEND_API_KEY')
const chaveContato = defineSecret('CONTACT_HMAC_KEY')
export const enviarConvitePainel = onDocumentWritten({
  document:'invites/{email}', region:'southamerica-east1', retry:true,
  minInstances:0, maxInstances:1, concurrency:1, memory:'256MiB', timeoutSeconds:60,
  secrets:[chave], serviceAccount:'conecta-emails@imobilaria-deccb.iam.gserviceaccount.com',
}, async evento => {
  const db = getFirestore(getApps()[0] ?? initializeApp())
  const api = clienteResend(chave.value())
  await processarConvite(evento, {db, enviar:(mensagem,id) => api('POST','/emails',mensagem,id)})
})

export const enviarVerificacaoPainel = onCall({
  region:'southamerica-east1', minInstances:0, maxInstances:1, concurrency:1,
  memory:'256MiB', timeoutSeconds:60, secrets:[chave], invoker:'public',
  serviceAccount:'conecta-emails@imobilaria-deccb.iam.gserviceaccount.com',
  cors:[new URL(PAINEL).origin, 'https://imobilaria-deccb-painel.web.app'],
}, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para confirmar o e-mail.')
  if (req.data != null && (typeof req.data !== 'object' || Array.isArray(req.data)
      || Object.keys(req.data).some(k => k !== 'locale') || (req.data.locale !== undefined && !['pt-BR','en'].includes(req.data.locale)))) {
    throw new HttpsError('invalid-argument', 'Solicitação inválida.')
  }
  const app = getApps()[0] ?? initializeApp()
  try {
    const api = clienteResend(chave.value())
    return await solicitarVerificacao(req.auth.uid, {db:getFirestore(app), auth:getAuth(app), locale:req.data?.locale ?? 'pt-BR',
      enviar:(mensagem,id) => api('POST','/emails',mensagem,id)})
  } catch (e) {
    if (e instanceof ErroVerificacao) throw new HttpsError(e.codigo, e.message)
    throw new HttpsError('unavailable', 'Não foi possível enviar a confirmação. Tente novamente em um minuto.')
  }
})

export const receberContato = onRequest({
  region:'southamerica-east1', minInstances:0, maxInstances:1, concurrency:1,
  memory:'256MiB', timeoutSeconds:60, secrets:[chave, chaveContato], invoker:'public', cors:false,
  serviceAccount:'conecta-emails@imobilaria-deccb.iam.gserviceaccount.com',
}, async (req, res) => {
  try {
    const app = getApps()[0] ?? initializeApp(), segredo = chaveContato.value(), api = clienteResend(chave.value())
    return await criarHandlerContato({db:getFirestore(app), segredo,
      enviar:(mensagem,id) => api('POST','/emails',mensagem,id)})(req, res)
  } catch (e) {
    console.error('receberContato:', e?.message) // as mensagens não carregam a chave
    res.set('Cache-Control', 'no-store')
    return res.status(503).json({status:'failed', error:'unavailable'})
  }
})
