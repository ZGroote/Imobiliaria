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

export function contatoPublico(canal: 'whatsapp' | 'sms' | 'email' | '', value: string) {
  if (!canal || !value.trim()) return null
  if (canal === 'email') {
    const email = value.trim().toLowerCase()
    if (email.length > 254 || !/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(email) || /[\x00-\x1f\x7f]/.test(email)) throw Error('E-mail inválido.')
    return { email }
  }
  if (!/^\+[1-9][0-9\s().-]{6,24}$/.test(value.trim())) throw Error('Inclua + e o código do país.')
  const phone = value.replace(/\D/g, '')
  if (!/^[1-9][0-9]{7,14}$/.test(phone)) throw Error('Telefone inválido.')
  return { [canal]: phone }
}

export function salvarContato(db: Firestore, uid: string, name: string, canal: 'whatsapp' | 'sms' | 'email' | '', value: string, emailPublico = '') {
  if (!name.trim()) throw Error('Informe seu nome.')
  const contato = { ...contatoPublico(canal, value), ...(emailPublico.trim() ? contatoPublico('email', emailPublico) : {}) }
  return updateDoc(doc(db, 'users', uid), { name: name.trim(), publicContact: Object.keys(contato).length ? contato : deleteField(), updatedAt: serverTimestamp() })
}

export function salvarPerfil(db: Firestore, uid: string, name: string, whatsapp: string) {
  name = name.trim()
  if (!name) throw new Error('Informe seu nome.')
  const number = normalizarWhatsApp(whatsapp)
  return updateDoc(doc(db, 'users', uid), {
    name, publicContact: number ? { whatsapp: number } : deleteField(), updatedAt: serverTimestamp(),
  })
}
