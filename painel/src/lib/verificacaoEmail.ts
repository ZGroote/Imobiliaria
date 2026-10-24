import {sendEmailVerification, type User} from 'firebase/auth'
import {getFunctions, httpsCallable} from 'firebase/functions'
import {app} from './firebase'
import {VERIFICACAO_EMAIL} from './endereco'

export async function enviarVerificacaoEmail(user: User) {
  if (process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === '1') {
    await sendEmailVerification(user, VERIFICACAO_EMAIL)
    return
  }
  try {
    await httpsCallable(getFunctions(app, 'southamerica-east1'), 'enviarVerificacaoPainel')({})
  } catch (e) {
    const erro = e as {code?: string; message?: string}
    if (['functions/resource-exhausted', 'functions/failed-precondition'].includes(erro.code ?? '')) throw new Error(erro.message)
    throw new Error('Não foi possível enviar a confirmação. Aguarde um minuto e use "Reenviar link".')
  }
}
