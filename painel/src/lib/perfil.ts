import { deleteField, doc, serverTimestamp, updateDoc, type Firestore } from 'firebase/firestore'

export function normalizarWhatsApp(value: string) {
  const text = value.trim()
  if (!text) return null
  if (!/^\+?[0-9\s().-]+$/.test(text)) throw new Error('Informe um WhatsApp válido com DDD.')
  let number = text.replace(/\D/g, '')
  if (!text.startsWith('+') && [10, 11].includes(number.length)) number = '55' + number
  if (!/^[1-9][0-9]{7,14}$/.test(number)) throw new Error('Informe um WhatsApp válido com DDD e código do país.')
  return number
}

export function salvarPerfil(db: Firestore, uid: string, name: string, whatsapp: string) {
  name = name.trim()
  if (!name) throw new Error('Informe seu nome.')
  const number = normalizarWhatsApp(whatsapp)
  return updateDoc(doc(db, 'users', uid), {
    name, publicContact: number ? { whatsapp: number } : deleteField(), updatedAt: serverTimestamp(),
  })
}
