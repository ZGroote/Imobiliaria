import type { Invite } from './types.ts'

export function emailDoConvite(convite: Invite) {
  switch (convite.emailDelivery?.status) {
    case 'accepted': return 'E-mail enviado.'
    case 'processing': return 'Enviando e-mail…'
    case 'failed': return 'E-mail não enviado. Avise a pessoa para usar "Primeiro acesso".'
    default: return 'Envio de e-mail ainda não confirmado.'
  }
}
