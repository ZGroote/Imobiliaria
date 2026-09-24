import { addDoc, collection, doc, serverTimestamp, updateDoc, type Firestore } from 'firebase/firestore'
import { slug } from './formato.ts'

// Só platform_admin escreve (regras: agencies). Não se apaga agência: desativa (active = false).
export function criarAgencia(db: Firestore, nome: string) {
  const name = nome.trim()
  if (!name) throw new Error('Informe o nome da imobiliária.')
  return addDoc(collection(db, 'agencies'), {
    name, slug: slug(name), active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
}

export function atualizarAgencia(db: Firestore, id: string, campos: { name?: string; active?: boolean }) {
  if (campos.name !== undefined && !campos.name.trim()) throw new Error('Informe o nome da imobiliária.')
  return updateDoc(doc(db, 'agencies', id), { ...campos, updatedAt: serverTimestamp() })
}
