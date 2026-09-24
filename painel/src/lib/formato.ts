import type { Timestamp } from 'firebase/firestore'

// Data e hora no fuso de quem usa. Timestamp pendente (serverTimestamp ainda local) vira "agora".
export function quando(t?: Timestamp | null) {
  if (!t) return 'agora'
  return t.toDate().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function slug(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
