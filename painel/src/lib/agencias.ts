import { addDoc, collection, doc, serverTimestamp, updateDoc, type Firestore } from 'firebase/firestore'
import { slug } from './formato.ts'
import { TIPOS_DE_CONTA, type TipoDeConta } from './types.ts'

function conferirTipo(kind: TipoDeConta) {
  if (!TIPOS_DE_CONTA.includes(kind)) throw new Error('Escolha imobiliária ou construtora.')
}

// Só platform_admin escreve (regras: agencies). Não se apaga agência: desativa (active = false).
export function criarAgencia(db: Firestore, nome: string, kind: TipoDeConta) {
  const name = nome.trim()
  if (!name) throw new Error('Informe o nome da imobiliária.')
  conferirTipo(kind)
  return addDoc(collection(db, 'agencies'), {
    name, slug: slug(name), kind, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
}

export function atualizarAgencia(db: Firestore, id: string, campos: { name?: string; active?: boolean; kind?: TipoDeConta }) {
  if (campos.name !== undefined && !campos.name.trim()) throw new Error('Informe o nome da imobiliária.')
  if (campos.kind !== undefined) conferirTipo(campos.kind)
  return updateDoc(doc(db, 'agencies', id), { ...campos, updatedAt: serverTimestamp() })
}
