import { doc, serverTimestamp, updateDoc, type Firestore } from 'firebase/firestore'

// O WhatsApp do próprio usuário (SPEC-captura-lead, L1). Só dígitos, com o país (E.164 sem "+"),
// o mesmo padrão das regras e do servidor do link. Sem "+" na frente, DDD + número (10 ou 11
// dígitos) é brasileiro e ganha o 55; com "+", o número já vem com o país.
export function normalizarWhatsapp(texto: string): string | null {
  const d = texto.replace(/\D/g, '')
  if (!d) return null
  const n = !texto.trim().startsWith('+') && (d.length === 10 || d.length === 11) ? '55' + d : d
  if (!/^[1-9][0-9]{7,14}$/.test(n)) throw new Error('Use o número com DDD, como (16) 99999-0000.')
  return n
}

export function salvarMeuWhatsapp(db: Firestore, uid: string, texto: string) {
  return updateDoc(doc(db, 'users', uid), { publicContact: { whatsapp: normalizarWhatsapp(texto) }, updatedAt: serverTimestamp() })
}
